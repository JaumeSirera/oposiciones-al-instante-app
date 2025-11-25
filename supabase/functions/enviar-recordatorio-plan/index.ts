import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
    const { id_plan, id_usuario, fecha, temas, email_usuario, tipo_plan } = await req.json();

    console.log("Recibido:", { id_plan, id_usuario, fecha, temas, email_usuario, tipo_plan });

    if (!id_plan || !id_usuario || !fecha || !temas || !email_usuario) {
      throw new Error("Faltan parámetros requeridos");
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY no configurada");
    }

    const resend = new Resend(RESEND_API_KEY);

    // Obtener información del plan según el tipo
    const esPlanFisico = tipo_plan === 'fisico';
    const endpointUrl = esPlanFisico 
      ? `https://oposiciones-test.com/api/planes_fisicos.php?action=detalle&id_plan=${id_plan}`
      : `https://oposiciones-test.com/api/planes_estudio.php?action=detalle&id_plan=${id_plan}`;

    console.log("Consultando plan directamente en:", endpointUrl);

    const planResponse = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!planResponse.ok) {
      console.error("Error HTTP al obtener el plan:", planResponse.status, planResponse.statusText);
      throw new Error(`No se pudo obtener la información del plan (HTTP ${planResponse.status})`);
    }

    const planInfo = await planResponse.json();

    console.log("Plan info:", planInfo);

    const nombrePlan = planInfo?.plan?.titulo || (esPlanFisico ? "Tu plan físico" : "Tu plan de estudio");

    // Para planes físicos, procesar estructura por día de la semana si es necesario
    let temasReales = temas;
    let contenidoGenerado = false;

    if (esPlanFisico) {
      // Si temas es un objeto con días de la semana, extraer el día correcto
      if (typeof temas === 'object' && !Array.isArray(temas)) {
        const fechaRecordatorio = new Date(fecha);
        const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const diaSemana = diasSemana[fechaRecordatorio.getDay()];
        
        console.log(`Fecha recordatorio: ${fecha}, día: ${diaSemana}`);
        console.log(`Estructura temas:`, Object.keys(temas));
        
        // Buscar el día en el objeto (case insensitive)
        const diaKey = Object.keys(temas).find(k => k.toLowerCase() === diaSemana.toLowerCase());
        
        if (diaKey && temas[diaKey]) {
          console.log(`Encontrado contenido para ${diaSemana}`);
          // Si el contenido del día es un array, usarlo directamente
          if (Array.isArray(temas[diaKey])) {
            temasReales = temas[diaKey];
          } 
          // Si es un objeto con sesiones, extraerlas
          else if (temas[diaKey].sesiones && Array.isArray(temas[diaKey].sesiones)) {
            temasReales = temas[diaKey].sesiones;
          }
          // Si es un string, convertirlo a array
          else if (typeof temas[diaKey] === 'string') {
            temasReales = [temas[diaKey]];
          }
          contenidoGenerado = true;
        } else {
          console.log(`No se encontró contenido para ${diaSemana}, usando temas por defecto`);
          temasReales = [`Consulta tu plan completo para ver el entrenamiento de hoy`];
          contenidoGenerado = false;
        }
      } else {
        // Si ya es un array, usarlo directamente
        contenidoGenerado = true;
      }
    }

    // Crear lista de temas formateada (maneja strings u objetos)
    const normalizarTemas = Array.isArray(temasReales) ? temasReales : [temasReales];

    const listaTemasHTML = normalizarTemas
      .map((tema: any, index: number) => {
        if (!tema) return "";
        if (typeof tema === "string") return `<li>${index + 1}. ${tema}</li>`;
        const texto =
          tema.titulo || tema.nombre || tema.descripcion || JSON.stringify(tema);
        return `<li>${index + 1}. ${texto}</li>`;
      })
      .join("");

    const titulo = esPlanFisico ? "📋 Recordatorio de Entrenamiento" : "📚 Recordatorio de Estudio";
    const subtitulo = esPlanFisico 
      ? "Es hora de entrenar y mejorar tu rendimiento físico"
      : "Es hora de seguir avanzando en tu preparación";
    const contenidoTitulo = esPlanFisico ? "Entrenamiento del día" : "Contenido del día";
    const consejosTitulo = esPlanFisico ? "💪 Consejos para hoy:" : "💡 Consejos para hoy:";
    const consejosLista = esPlanFisico
      ? `<li>Realiza un calentamiento adecuado antes de empezar</li>
         <li>Mantén una buena hidratación durante el entrenamiento</li>
         <li>Presta atención a la técnica en cada ejercicio</li>
         <li>Descansa lo necesario entre series</li>`
      : `<li>Dedica al menos 2 horas a estos temas</li>
         <li>Haz resúmenes o esquemas de los puntos clave</li>
         <li>Realiza tests de práctica para reforzar lo aprendido</li>`;
    
    const urlPlan = esPlanFisico
      ? `https://oposiciones-test.com/planes-fisicos/${id_plan}`
      : `https://oposiciones-test.com/plan-estudio/${id_plan}`;

    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .date-badge { background: #667eea; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; }
    .tema-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .tema-list ul { list-style: none; padding: 0; }
    .tema-list li { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .tema-list li:last-child { border-bottom: none; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
    .cta-button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${titulo}</h1>
      <p style="margin: 0; opacity: 0.9;">${subtitulo}</p>
    </div>
    <div class="content">
      <div class="date-badge">📅 ${new Date(fecha).toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}</div>
      
      <h2 style="color: #667eea; margin-bottom: 10px;">${nombrePlan}</h2>
      
      <p>¡Hola! 👋</p>
      ${!contenidoGenerado && esPlanFisico 
        ? `<p style="background: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
             ⚠️ Esta semana aún no ha sido generada con IA. Las tareas mostradas son sugerencias generales.
             <br><strong>Accede al plan completo y genera esta semana para ver tu entrenamiento personalizado.</strong>
           </p>`
        : `<p>${esPlanFisico ? 'Este es tu entrenamiento de hoy:' : 'Estos son los temas que debes estudiar hoy:'}</p>`
      }
      
      <div class="tema-list">
        <h3 style="margin-top: 0; color: #374151;">${contenidoTitulo}</h3>
        <ul>
          ${listaTemasHTML}
        </ul>
      </div>
      
      <p>${consejosTitulo}</p>
      <ul>
        ${consejosLista}
      </ul>
      
      <div style="text-align: center;">
        <a href="${urlPlan}" class="cta-button">
          Ver Mi Plan Completo
        </a>
      </div>
      
      <div class="footer">
        <p>¿No quieres recibir más recordatorios? <a href="https://oposiciones-test.com/configuracion">Gestionar notificaciones</a></p>
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
      subject: `${esPlanFisico ? '💪' : '📚'} Recordatorio: ${esPlanFisico ? 'Entrenar' : 'Estudiar'} hoy - ${nombrePlan}`,
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
        message: "Recordatorio enviado exitosamente",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error en enviar-recordatorio-plan:", error);
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
