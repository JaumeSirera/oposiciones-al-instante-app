import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const {
      id_usuario,
      id_proceso,
      plan,
      notificaciones_email,
      hora_notificacion,
    } = await req.json();

    if (!id_usuario || !id_proceso || !plan) {
      throw new Error("Faltan parámetros requeridos");
    }

    // Crear cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Guardar plan básico mediante PHP API
    const { data: planCreado } = await supabase.functions.invoke(
      "php-api-proxy",
      {
        body: {
          endpoint: "planes_estudio.php",
          method: "POST",
          action: "crear",
          id_usuario,
          id_proceso,
          titulo: plan.titulo,
          descripcion: plan.descripcion,
          fecha_inicio: plan.fecha_inicio,
          fecha_fin: plan.fecha_fin,
        },
      }
    );

    console.log("Plan creado:", planCreado);

    if (!planCreado?.success || !planCreado?.id_plan) {
      throw new Error("Error al crear plan en la base de datos");
    }

    const id_plan = planCreado.id_plan;

    // Generar etapas y tareas con IA
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    const fecha_inicio = new Date(plan.fecha_inicio);
    const fecha_fin = new Date(plan.fecha_fin);
    const dias_totales = Math.ceil(
      (fecha_fin.getTime() - fecha_inicio.getTime()) / (1000 * 60 * 60 * 24)
    );
    const semanas = Math.ceil(dias_totales / 7);

    const promptEtapas = `Genera un plan de estudio detallado dividido en etapas y tareas.

PLAN:
- Título: ${plan.titulo}
- Duración: ${semanas} semanas (${dias_totales} días)
- Temas: ${plan.temas.length} temas
- Secciones: ${plan.secciones.join(", ")}

TEMAS A CUBRIR:
${plan.temas.slice(0, 25).map((t, i) => `${i + 1}. ${t}`).join("\n")}

INSTRUCCIONES:
1. Divide el plan en 4-6 etapas lógicas (ej: "Etapa 1: Fundamentos", "Etapa 2: Profundización", etc.)
2. Para cada etapa, crea 3-5 tareas específicas usando los temas proporcionados
3. Distribuye los ${plan.temas.length} temas entre todas las etapas
4. Cada tarea debe incluir varios temas relacionados

ESTRUCTURA JSON requerida:
{
  "etapas": [
    {
      "titulo": "Nombre de la etapa",
      "descripcion": "Descripción breve",
      "tareas": [
        {
          "titulo": "Nombre de la tarea",
          "descripcion": "Estudiar: Tema X, Tema Y, Tema Z"
        }
      ]
    }
  ]
}

Responde SOLO con JSON válido.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Eres un experto en planificación de estudios. Respondes SOLO con JSON válido.",
            },
            { role: "user", content: promptEtapas },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      }
    );

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content;

      if (content) {
        content = content.trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
        const planDetallado = JSON.parse(content);

        // Guardar plan detallado en PHP API
        await supabase.functions.invoke("php-api-proxy", {
          body: {
            endpoint: "guardar_plan_ia.php",
            method: "POST",
            id_plan,
            plan: planDetallado.etapas || [],
            resumen: plan.resumen,
          },
        });
      }
    }

    // Si se solicitaron notificaciones, crear recordatorios
    if (notificaciones_email) {
      console.log("Creando recordatorios para el plan...");
      
      const recordatorios = [];
      const temasTotal = plan.temas.length;
      const temasPorDia = Math.max(1, Math.ceil(temasTotal / dias_totales));

      // Crear recordatorio para cada día con temas distribuidos
      for (let i = 0; i < dias_totales; i++) {
        const fecha = new Date(fecha_inicio);
        fecha.setDate(fecha_inicio.getDate() + i);
        
        const inicio = i * temasPorDia;
        const fin = Math.min((i + 1) * temasPorDia, temasTotal);
        const temasDelDia = plan.temas.slice(inicio, fin);

        if (temasDelDia.length > 0) {
          recordatorios.push({
            fecha: fecha.toISOString().split("T")[0],
            temas: temasDelDia,
          });
        }
      }

      console.log(`Guardando ${recordatorios.length} recordatorios...`);

      // Guardar recordatorios en la base de datos PHP
      const { data: recordatoriosResult } = await supabase.functions.invoke("php-api-proxy", {
        body: {
          endpoint: "recordatorios_plan.php",
          method: "POST",
          action: "crear",
          id_plan,
          id_usuario,
          recordatorios,
        },
      });

      console.log("Resultado guardado recordatorios:", recordatoriosResult);
    }

    return new Response(
      JSON.stringify({
        success: true,
        id_plan,
        message: "Plan guardado exitosamente",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error en guardar-plan-generado:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al guardar plan",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
