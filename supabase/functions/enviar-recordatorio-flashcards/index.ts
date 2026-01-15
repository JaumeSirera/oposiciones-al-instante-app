import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_usuario, nombre_usuario, pending_count, flashcards_preview } = await req.json();

    console.log("Recibido:", { email_usuario, nombre_usuario, pending_count });

    if (!email_usuario || !nombre_usuario) {
      throw new Error("Faltan parámetros requeridos");
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY no configurada");
    }

    const resend = new Resend(RESEND_API_KEY);

    // Crear preview de flashcards si están disponibles
    const previewHTML = flashcards_preview && flashcards_preview.length > 0
      ? flashcards_preview.map((fc: any, index: number) => `
          <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #667eea;">
            <div style="font-weight: bold; color: #374151; margin-bottom: 5px;">📝 Pregunta ${index + 1}:</div>
            <div style="color: #6b7280; font-size: 14px;">${fc.front?.substring(0, 100)}${fc.front?.length > 100 ? '...' : ''}</div>
          </div>
        `).join('')
      : '';

    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>🧠 Recordatorio de Flashcards</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .count-badge { background: white; color: #d97706; font-size: 48px; font-weight: bold; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 20px 0; }
    .preview-section { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
    .cta-button { background: #f59e0b; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; font-weight: bold; }
    .cta-button:hover { background: #d97706; }
    .tips { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .tips ul { margin: 0; padding-left: 20px; }
    .tips li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🧠 ¡Hora de repasar!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Tienes flashcards esperándote</p>
      <div class="count-badge">${pending_count}</div>
      <p style="margin: 5px 0 0 0; font-size: 14px;">flashcards pendientes</p>
    </div>
    <div class="content">
      <p>¡Hola, ${nombre_usuario}! 👋</p>
      
      <p>El algoritmo SM-2 ha determinado que es el momento perfecto para repasar algunas de tus flashcards. 
         La repetición espaciada es la clave para una memoria a largo plazo.</p>
      
      ${previewHTML ? `
        <div class="preview-section">
          <h3 style="margin-top: 0; color: #92400e;">📚 Vista previa de lo que repasarás:</h3>
          ${previewHTML}
        </div>
      ` : ''}
      
      <div class="tips">
        <h3 style="margin-top: 0; color: #374151;">💡 Consejos para un repaso efectivo:</h3>
        <ul>
          <li>Intenta responder antes de ver la solución</li>
          <li>Sé honesto con tu nivel de confianza</li>
          <li>Las tarjetas difíciles se mostrarán más a menudo</li>
          <li>Dedica al menos 10-15 minutos al día</li>
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="https://oposiciones-al-instante-app.lovable.app/flashcards" class="cta-button">
          Comenzar Repaso
        </a>
      </div>
      
      <div class="footer">
        <p style="margin-bottom: 10px;">
          <a href="https://oposiciones-al-instante-app.lovable.app/flashcards/configurar-recordatorios" style="color: #6b7280;">
            Configurar frecuencia de recordatorios
          </a>
        </p>
        <p>© ${new Date().getFullYear()} Oposiciones-Test · Tu compañero de preparación</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    console.log("Enviando email a:", email_usuario);

    const { error: emailError } = await resend.emails.send({
      from: "Oposiciones-Test <notificaciones@oposiciones-test.com>",
      to: [email_usuario],
      subject: `🧠 Tienes ${pending_count} flashcards pendientes de repasar`,
      html: emailHTML,
    });

    if (emailError) {
      console.error("Error enviando email:", emailError);
      throw emailError;
    }

    console.log("Email enviado exitosamente");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Recordatorio de flashcards enviado exitosamente",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error en enviar-recordatorio-flashcards:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al enviar recordatorio",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
