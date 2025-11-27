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

    const esPlanFisico = tipo_plan === 'fisico';

    // Obtener plan_json usando el nuevo endpoint optimizado
    console.log("Obteniendo plan_json desde obtener_plan_json.php");

    const planJsonResponse = await fetch('https://oposiciones-test.com/api/obtener_plan_json.php', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id_plan: id_plan,
        tipo_plan: tipo_plan
      }),
    });

    if (!planJsonResponse.ok) {
      console.error("Error HTTP al obtener plan_json:", planJsonResponse.status, planJsonResponse.statusText);
      throw new Error(`No se pudo obtener el plan_json (HTTP ${planJsonResponse.status})`);
    }

    const planJsonData = await planJsonResponse.json();

    if (!planJsonData.success) {
      console.error("Error obteniendo plan_json:", planJsonData.error);
      throw new Error(planJsonData.error || "Error al obtener plan_json");
    }

    console.log("plan_json obtenido exitosamente");

    // Parsear plan_json si viene como string
    let planJson;
    try {
      planJson = typeof planJsonData.plan_json === 'string' 
        ? JSON.parse(planJsonData.plan_json) 
        : planJsonData.plan_json;
    } catch (e) {
      console.error("Error parseando plan_json:", e);
      throw new Error("Error al parsear plan_json");
    }

    console.log("[DEBUG] plan_json completo length:", JSON.stringify(planJson).length, "caracteres");
    
    // Detectar estructura del JSON
    if (planJson.semanas) {
      console.log("[DEBUG] Estructura detectada: planJson.semanas con", planJson.semanas.length, "semanas");
    } else if (planJson.plan) {
      console.log("[DEBUG] Estructura detectada: planJson.plan con", planJson.plan.length, "semanas");
    } else {
      console.log("[DEBUG] Estructura desconocida. Keys disponibles:", Object.keys(planJson));
    }

    // Extraer nombre del plan
    const nombrePlan = planJson?.titulo || (esPlanFisico ? "Tu plan físico" : "Tu plan de estudio");

    // Para planes físicos, extraer ejercicios del día
    let temasReales = temas;
    let contenidoGenerado = false;

    // Detectar la estructura y normalizar
    const semanasArray = planJson?.plan || planJson?.semanas;

    if (esPlanFisico && semanasArray && Array.isArray(semanasArray)) {
      const temasOriginales = Array.isArray(temas) ? temas : [temas];

      try {
        console.log("[DEBUG] Semanas disponibles:", semanasArray.map((s: any) => ({
          semana: s.semana,
          titulo: s.titulo,
          fecha_inicio: s.fecha_inicio,
          fecha_fin: s.fecha_fin,
          dias: (s.sesiones || []).map((ses: any) => ses.dia),
        })));

        // Calcular qué día de la semana es el recordatorio
        const fechaRecordatorio = new Date(fecha);
        const diasSemana = [
          "domingo",
          "lunes",
          "martes",
          "miércoles",
          "jueves",
          "viernes",
          "sábado",
        ];

        const normalizar = (texto: string) =>
          (texto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

        const diaSemana = diasSemana[fechaRecordatorio.getDay()];
        const diaSemanaKey = normalizar(diaSemana);

        console.log(`Buscando contenido para ${diaSemana} en fecha ${fecha}`);

        // Buscar la semana que contiene esta fecha
        let sesionDelDia: any = null;
        let semanaSeleccionada: any = null;

        for (const semana of semanasArray) {
          const fechaInicio = new Date(semana.fecha_inicio);
          const fechaFin = new Date(semana.fecha_fin);

          console.log("[DEBUG] Revisando semana", {
            semana: semana.semana,
            titulo: semana.titulo,
            fecha_inicio: semana.fecha_inicio,
            fecha_fin: semana.fecha_fin,
            fechaRecordatorio: fecha,
          });

          if (fechaRecordatorio >= fechaInicio && fechaRecordatorio <= fechaFin) {
            console.log(`Encontrada semana ${semana.semana}: ${semana.titulo}`);
            semanaSeleccionada = semana;

            // Buscar el día en las sesiones de esta semana (permite variaciones de texto)
            sesionDelDia = semana.sesiones?.find((s: any) => {
              const diaSesionOriginal = s.dia || "";
              const diaSesion = normalizar(diaSesionOriginal);
              const match =
                diaSesion === diaSemanaKey ||
                diaSesion.startsWith(diaSemanaKey) ||
                diaSemanaKey.startsWith(diaSesion);
              if (match) {
                console.log("[DEBUG] Coincidencia de día encontrada", {
                  diaSesionOriginal,
                  diaSesion,
                  diaSemana,
                  diaSemanaKey,
                });
              }
              return match;
            });

            if (!sesionDelDia && semana.sesiones?.length) {
              console.log("[DEBUG] No se encontró sesión exacta para el día. Sesiones disponibles en la semana:",
                semana.sesiones.map((s: any) => s.dia));
            }

            if (sesionDelDia) {
              console.log(`Encontrada sesión para ${diaSemana}:`, sesionDelDia);
              break;
            }
          }
        }

        if (sesionDelDia && sesionDelDia.bloques) {
          // Extraer ejercicios de todos los bloques
          temasReales = [];

          for (const bloque of sesionDelDia.bloques) {
            if (bloque.ejercicios) {
              for (const ejercicio of bloque.ejercicios) {
                const nombreEjercicio = ejercicio.nombre || ejercicio.titulo || "";
                const seriesReps =
                  ejercicio.series && ejercicio.reps
                    ? `${ejercicio.series}x${ejercicio.reps}`
                    : "";
                const carga = ejercicio.carga?.rx || ejercicio.carga?.scaled || "";

                let descripcion = nombreEjercicio;
                if (seriesReps) descripcion += ` - ${seriesReps}`;
                if (carga) descripcion += ` (${carga})`;

                temasReales.push(descripcion);
              }
            }
          }

          contenidoGenerado = true;
          console.log(`Extraídos ${temasReales.length} ejercicios del día`);
        } else {
          console.log(`No se encontró sesión para ${diaSemana}, usando temas originales del recordatorio`, {
            semanaSeleccionada,
          });
          temasReales = temasOriginales;
          contenidoGenerado = false;
        }
      } catch (error) {
        console.error("Error extrayendo ejercicios del día:", error);
        temasReales = Array.isArray(temas) ? temas : [temas];
        contenidoGenerado = false;
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
