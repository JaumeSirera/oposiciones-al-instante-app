import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  email: string;
  nombre: string;
}

interface EmailRequest {
  subject: string;
  message: string;
  recipients: Recipient[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, message, recipients }: EmailRequest = await req.json();

    console.log(`Received request to send emails. Subject: ${subject}, Recipients: ${recipients?.length || 0}`);

    if (!subject || !message) {
      return new Response(
        JSON.stringify({ error: "Subject and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients provided", emailsSent: 0 }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Filter valid emails
    const validRecipients = recipients.filter(r => r.email && r.email.includes("@"));
    const userEmails = validRecipients.map(r => r.email);

    if (userEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid email addresses", emailsSent: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending emails to ${userEmails.length} recipients`);

    // Convert plain text message to HTML
    const htmlMessage = message
      .replace(/\n/g, "<br>")
      .replace(/¡/g, "&iexcl;");

    const playStoreLink = "https://play.google.com/store/apps/details?id=com.jaumesirera.TestsOposiciones.app";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #1e40af; margin: 0;">
                <span style="color: #2563eb;">Oposiciones-</span><span style="color: #16a34a;">Test</span>
              </h1>
            </div>
            
            <div style="color: #374151; font-size: 16px; line-height: 1.6;">
              ${htmlMessage}
            </div>
            
            <div style="text-align: center; margin-top: 32px;">
              <a href="${playStoreLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #16a34a); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                📲 Actualizar en Play Store
              </a>
            </div>
            
            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
              <p>© 2025 Oposiciones-Test. Todos los derechos reservados.</p>
              <p>Este email fue enviado porque estás registrado en nuestra plataforma.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send emails in batches to avoid rate limits
    const batchSize = 50;
    let emailsSent = 0;
    const errors: string[] = [];

    for (let i = 0; i < userEmails.length; i += batchSize) {
      const batch = userEmails.slice(i, i + batchSize);
      
      try {
        const emailResponse = await resend.emails.send({
          from: "Oposiciones-Test <onboarding@resend.dev>",
          to: batch,
          subject: subject,
          html: htmlContent,
        });

        if (emailResponse.error) {
          errors.push(`Batch ${i / batchSize + 1}: ${emailResponse.error.message}`);
        } else {
          emailsSent += batch.length;
        }
      } catch (batchError: any) {
        errors.push(`Batch ${i / batchSize + 1}: ${batchError.message}`);
      }

      // Small delay between batches
      if (i + batchSize < userEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Emails sent: ${emailsSent}/${userEmails.length}`);
    if (errors.length > 0) {
      console.log("Errors:", errors);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        totalUsers: userEmails.length,
        errors: errors.length > 0 ? errors : undefined 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-update-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
