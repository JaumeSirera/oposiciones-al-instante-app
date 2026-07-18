import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PHP_BASE = "https://oposiciones-test.com/api";

const QUOTA_ERROR_PATTERNS = [
  "daily email sending limit",
  "daily sending limit",
  "reached your daily",
  "quota",
  "insufficient credits",
];

function getErrorMessage(error: unknown): string {
  if (!error) return "Error desconocido del proveedor de email";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
    return JSON.stringify(error);
  } catch {
    return "Error desconocido del proveedor de email";
  }
}

function isQuotaError(message: string): boolean {
  const normalized = message.toLowerCase();
  return QUOTA_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isRetryableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("rate") || normalized.includes("429") || normalized.includes("timeout") || normalized.includes("temporar");
}

interface Recipient {
  email: string;
  nombre?: string;
  recipientId?: number; // id in email_recipients table
}

interface EmailRequest {
  subject: string;
  message: string;
  recipients: Recipient[];
  historyId?: number;
}

async function updateRecipient(id: number, status: "sent" | "failed" | "pending", error?: string) {
  try {
    await fetch(`${PHP_BASE}/actualizar_email_recipient.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, error: error?.slice(0, 500) ?? null }),
    });
  } catch (e) {
    console.error("updateRecipient failed for", id, e);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, message, recipients, historyId }: EmailRequest = await req.json();

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: "Subject and message are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!recipients?.length) {
      return new Response(JSON.stringify({ error: "No recipients provided", emailsSent: 0 }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const validRecipients = recipients.filter(r => r.email && r.email.includes("@"));
    if (validRecipients.length === 0) {
      return new Response(JSON.stringify({ error: "No valid email addresses", emailsSent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const htmlMessage = message.replace(/\n/g, "<br>").replace(/¡/g, "&iexcl;");
    const playStoreLink = "https://play.google.com/store/apps/details?id=com.jaumesirera.TestsOposiciones.app";
    const htmlContent = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1e40af; margin: 0;"><span style="color: #2563eb;">Oposiciones-</span><span style="color: #16a34a;">Test</span></h1>
          </div>
          <div style="color: #374151; font-size: 16px; line-height: 1.6;">${htmlMessage}</div>
          <div style="text-align: center; margin-top: 32px;">
            <a href="${playStoreLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #16a34a); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">📲 Actualizar en Play Store</a>
          </div>
          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
            <p>© 2025 Oposiciones-Test. Todos los derechos reservados.</p>
          </div>
        </div>
      </body></html>`;

    const fromAddress = "Oposiciones-Test <notificaciones@oposiciones-test.com>";
    const concurrency = 2;
    const delayMs = 1100;

    const sendAll = async () => {
      let emailsSent = 0;
      let emailsFailed = 0;

      for (let i = 0; i < validRecipients.length; i += concurrency) {
        const chunk = validRecipients.slice(i, i + concurrency);

        const results = await Promise.all(chunk.map(async (r) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const resp = await resend.emails.send({
                from: fromAddress,
                to: [r.email],
                subject,
                html: htmlContent,
              });
              if (resp.error) {
                const msg = getErrorMessage(resp.error);
                if (isQuotaError(msg)) return { ok: false, r, error: msg, stopBatch: true };
                if (isRetryableError(msg) && attempt < 2) {
                  await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
                  continue;
                }
                return { ok: false, r, error: msg };
              }
              return { ok: true, r };
            } catch (err: unknown) {
              const msg = getErrorMessage(err);
              if (isQuotaError(msg)) return { ok: false, r, error: msg, stopBatch: true };
              if (isRetryableError(msg) && attempt < 2) {
                await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
                continue;
              }
              return { ok: false, r, error: msg };
            }
          }
          return { ok: false, r, error: "unknown" };
        }));

        const quotaFailure = results.find((x) => !x.ok && x.stopBatch);
        if (quotaFailure) {
          const remainingRecipients = validRecipients.slice(i);
          await Promise.all(remainingRecipients.map((r) =>
            r.recipientId ? updateRecipient(r.recipientId, "failed", quotaFailure.error) : Promise.resolve()
          ));
          emailsFailed += remainingRecipients.length;
          console.log(`STOPPED history=${historyId ?? "-"} reason=quota_limit failed_remaining=${remainingRecipients.length}`);
          break;
        }

        for (const x of results) {
          if (x.ok) {
            emailsSent++;
            if (x.r.recipientId) await updateRecipient(x.r.recipientId, "sent");
          } else {
            emailsFailed++;
            if (x.r.recipientId) await updateRecipient(x.r.recipientId, "failed", x.error);
          }
        }

        if (i + concurrency < validRecipients.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      console.log(`FINAL history=${historyId ?? "-"} sent=${emailsSent} failed=${emailsFailed}`);
    };

    // @ts-ignore
    EdgeRuntime.waitUntil(sendAll());

    return new Response(JSON.stringify({
      success: true,
      queued: validRecipients.length,
      emailsSent: validRecipients.length,
      historyId: historyId ?? null,
      message: `Envío en segundo plano iniciado para ${validRecipients.length} destinatarios.`,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-update-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
