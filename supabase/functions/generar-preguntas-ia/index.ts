import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_proceso, seccion, tema, num_preguntas, texto } = await req.json();

    if (!id_proceso || !num_preguntas) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    // Construir prompt optimizado para generación rápida
    const promptBase = texto 
      ? `Genera exactamente ${num_preguntas} preguntas de test tipo oposición basándote en el siguiente texto:

"${texto.substring(0, 8000)}"

Las preguntas deben evaluar comprensión del contenido.`
      : `Genera exactamente ${num_preguntas} preguntas de test tipo oposición sobre:
- Tema: ${tema || "General"}
- Sección: ${seccion || "General"}

Las preguntas deben ser de nivel oposición, precisas y con respuestas claras.`;

    const systemPrompt = `Eres un experto generador de preguntas para oposiciones españolas. 
Genera preguntas de opción múltiple con 4 respuestas cada una.
IMPORTANTE: Responde SOLO con un JSON válido, sin markdown ni texto adicional.

Formato requerido:
{
  "preguntas": [
    {
      "pregunta": "texto de la pregunta",
      "respuestas": ["respuesta A", "respuesta B", "respuesta C", "respuesta D"],
      "correcta": 0,
      "explicacion": "breve explicación de por qué es correcta"
    }
  ]
}

El campo "correcta" es el índice (0-3) de la respuesta correcta.`;

    console.log(`[generar-preguntas-ia] Generando ${num_preguntas} preguntas...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptBase },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generar-preguntas-ia] Error API:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso alcanzado. Inténtalo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Respuesta vacía del modelo");
    }

    // Parsear el JSON de la respuesta
    let parsed;
    try {
      // Limpiar posibles caracteres de markdown
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("[generar-preguntas-ia] Error parsing JSON:", parseError);
      console.error("[generar-preguntas-ia] Content:", content.substring(0, 500));
      throw new Error("Error al procesar respuesta del modelo");
    }

    const preguntas = parsed.preguntas || parsed;

    if (!Array.isArray(preguntas) || preguntas.length === 0) {
      throw new Error("No se generaron preguntas válidas");
    }

    // Formatear respuesta para el frontend
    const resultado = preguntas.map((p: any, idx: number) => ({
      id: Date.now() + idx,
      pregunta: p.pregunta,
      respuestas: p.respuestas.map((r: string, i: number) => ({
        indice: String.fromCharCode(65 + i), // A, B, C, D
        respuesta: r,
      })),
      correcta_indice: String.fromCharCode(65 + (p.correcta || 0)),
      explicacion: p.explicacion || "",
    }));

    console.log(`[generar-preguntas-ia] Generadas ${resultado.length} preguntas`);

    return new Response(
      JSON.stringify({ success: true, preguntas: resultado }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generar-preguntas-ia] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
