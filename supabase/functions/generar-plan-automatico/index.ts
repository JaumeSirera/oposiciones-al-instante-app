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
      proceso_descripcion,
      semanas,
      notificaciones_email,
      hora_notificacion,
    } = await req.json();

    if (!id_usuario || !id_proceso || !proceso_descripcion || !semanas) {
      throw new Error("Faltan parámetros requeridos");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    // Crear cliente Supabase para obtener secciones y temas
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener secciones y temas del PHP API
    const { data: funcionProxy } = await supabase.functions.invoke(
      "php-api-proxy",
      {
        body: {
          endpoint: `secciones_temas.php?proceso_id=${id_proceso}`,
          method: "GET",
        },
      }
    );

    console.log("Respuesta PHP API:", funcionProxy);

    let secciones: string[] = [];
    let temas: string[] = [];

    if (funcionProxy && funcionProxy.success) {
      secciones = funcionProxy.secciones || [];
      temas = funcionProxy.temas || [];
    }

    // Validar que hay datos de la base de datos
    if (secciones.length === 0 || temas.length === 0) {
      throw new Error(
        `No se encontraron ${secciones.length === 0 ? 'secciones' : 'temas'} para el proceso ${id_proceso}. ` +
        `Asegúrate de que existen preguntas en la base de datos para este proceso.`
      );
    }

    console.log("Secciones disponibles:", secciones);
    console.log("Temas disponibles:", temas);

    // Calcular fechas
    const fecha_inicio = new Date();
    const fecha_fin = new Date();
    fecha_fin.setDate(fecha_fin.getDate() + semanas * 7);

    // Crear prompt para IA
    const prompt = `Eres un experto en planificación de estudios para oposiciones. Genera un plan de estudio optimizado.

CONTEXTO:
- Oposición: ${proceso_descripcion}
- Duración: ${semanas} semanas
- Fecha inicio: ${fecha_inicio.toISOString().split("T")[0]}
- Fecha fin: ${fecha_fin.toISOString().split("T")[0]}

SECCIONES DISPONIBLES:
${secciones.map((s, i) => `${i + 1}. ${s}`).join("\n")}

TEMAS DISPONIBLES:
${temas.slice(0, 30).map((t, i) => `${i + 1}. ${t}`).join("\n")}
${temas.length > 30 ? `... y ${temas.length - 30} temas más` : ""}

INSTRUCCIONES:
1. Genera un título atractivo y motivador para el plan
2. Escribe una descripción que explique la estrategia de estudio (100-150 palabras)
3. Selecciona entre 3-5 secciones de las disponibles (usar nombres exactos)
4. Selecciona entre 15-25 temas de los disponibles (usar nombres exactos, distribuidos equitativamente)
5. Crea un resumen ejecutivo del plan (50-80 palabras)

IMPORTANTE: 
- Usa EXACTAMENTE los nombres de secciones y temas de la lista proporcionada
- Distribuye los temas de forma equilibrada entre las secciones
- El plan debe ser realista para la duración especificada

Responde SOLO con un objeto JSON con esta estructura:
{
  "titulo": "string",
  "descripcion": "string",
  "secciones": ["string"],
  "temas": ["string"],
  "resumen": "string"
}`;

    console.log("Llamando a Lovable AI...");

    // Llamar a Lovable AI
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
              content:
                "Eres un experto en planificación de estudios para oposiciones. Respondes SOLO con JSON válido.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error AI:", errorText);
      throw new Error(`Error en Lovable AI: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("Respuesta AI:", JSON.stringify(aiData, null, 2));

    let content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No se recibió contenido de la IA");
    }

    // Limpiar y parsear JSON
    content = content.trim();
    content = content.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    
    const planData = JSON.parse(content);

    // Validar y filtrar secciones/temas
    const seccionesValidas = planData.secciones.filter((s: string) =>
      secciones.some((sec) => sec.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(sec.toLowerCase()))
    );
    const temasValidos = planData.temas.filter((t: string) =>
      temas.some((tema) => tema.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(tema.toLowerCase()))
    );

    console.log("Secciones válidas:", seccionesValidas);
    console.log("Temas válidos:", temasValidos);

    // Si no hay coincidencias exactas, usar aleatorios
    if (seccionesValidas.length === 0) {
      const numSecciones = Math.min(4, secciones.length);
      for (let i = 0; i < numSecciones; i++) {
        const randomIndex = Math.floor(Math.random() * secciones.length);
        if (!seccionesValidas.includes(secciones[randomIndex])) {
          seccionesValidas.push(secciones[randomIndex]);
        }
      }
    }

    if (temasValidos.length < 10) {
      const numTemas = Math.min(20, temas.length);
      while (temasValidos.length < numTemas) {
        const randomIndex = Math.floor(Math.random() * temas.length);
        if (!temasValidos.includes(temas[randomIndex])) {
          temasValidos.push(temas[randomIndex]);
        }
      }
    }

    const plan = {
      titulo: planData.titulo || `Plan ${proceso_descripcion} - ${semanas} semanas`,
      descripcion: planData.descripcion || `Plan de estudio intensivo para ${proceso_descripcion}`,
      fecha_inicio: fecha_inicio.toISOString().split("T")[0],
      fecha_fin: fecha_fin.toISOString().split("T")[0],
      secciones: seccionesValidas,
      temas: temasValidos,
      resumen: planData.resumen || "",
    };

    console.log("Plan generado:", plan);

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        notificaciones_config: {
          email: notificaciones_email,
          hora: hora_notificacion,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error en generar-plan-automatico:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error al generar plan",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
