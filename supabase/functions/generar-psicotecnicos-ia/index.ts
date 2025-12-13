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
    const { id_proceso, seccion, tema, num_preguntas, texto, documento } = await req.json();

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

    const tieneTexto = texto && texto.trim().length > 0;

    // Prompt específico para psicotécnicos
    const promptBase = tieneTexto 
      ? `Genera exactamente ${num_preguntas} preguntas psicotécnicas basándote en el siguiente texto:

"${texto.substring(0, 8000)}"

Las preguntas deben ser de tipo psicotécnico: series numéricas, series de letras, analogías, razonamiento lógico, problemas matemáticos, etc.`
      : `Genera exactamente ${num_preguntas} preguntas psicotécnicas sobre:
- Tema: ${tema || "Razonamiento general"}
- Sección: ${seccion || "Psicotécnicos"}

Tipos de preguntas a incluir:
- Series numéricas (encontrar el número que sigue)
- Series de letras (encontrar la letra que sigue)
- Analogías verbales
- Razonamiento lógico
- Problemas de cálculo mental
- Secuencias gráficas descritas

Las preguntas deben ser variadas y de nivel oposición.`;

    // Sistema con o sin trazabilidad según haya texto
    const formatoConTrazabilidad = `{
  "preguntas": [
    {
      "pregunta": "texto de la pregunta psicotécnica",
      "respuestas": ["respuesta A", "respuesta B", "respuesta C", "respuesta D"],
      "correcta": 0,
      "explicacion": "explicación paso a paso del razonamiento",
      "pagina": "1",
      "ubicacion": "inicio|medio|final",
      "cita": "fragmento del documento relacionado"
    }
  ]
}`;

    const formatoSinTrazabilidad = `{
  "preguntas": [
    {
      "pregunta": "texto de la pregunta psicotécnica",
      "respuestas": ["respuesta A", "respuesta B", "respuesta C", "respuesta D"],
      "correcta": 0,
      "explicacion": "explicación paso a paso del razonamiento"
    }
  ]
}`;

    const systemPrompt = `Eres un experto generador de preguntas psicotécnicas para oposiciones españolas.
Genera preguntas de razonamiento lógico, series numéricas, series de letras, analogías y problemas matemáticos.
Cada pregunta debe tener 4 respuestas posibles.
IMPORTANTE: Responde SOLO con un JSON válido, sin markdown ni texto adicional.

Formato requerido:
${tieneTexto ? formatoConTrazabilidad : formatoSinTrazabilidad}

El campo "correcta" es el índice (0-3) de la respuesta correcta.
El campo "explicacion" es OBLIGATORIO y debe explicar paso a paso cómo resolver el problema.${tieneTexto ? `
Los campos "pagina", "ubicacion" y "cita" son OBLIGATORIOS cuando se genera desde texto.` : ''}`;

    console.log(`[generar-psicotecnicos-ia] Generando ${num_preguntas} psicotécnicos...`);

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
      console.error("[generar-psicotecnicos-ia] Error API:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso alcanzado. Inténtalo en unos minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Añade más créditos a tu cuenta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      
      // Eliminar caracteres de control problemáticos (excepto espacios normales)
      cleanContent = cleanContent
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Eliminar control chars excepto \t \n \r
      
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("[generar-psicotecnicos-ia] Error parsing JSON:", parseError);
      console.error("[generar-psicotecnicos-ia] Content:", content.substring(0, 500));
      
      // Intentar extraer preguntas con regex como fallback
      try {
        const preguntasMatch = content.match(/"preguntas"\s*:\s*\[[\s\S]*\]/);
        if (preguntasMatch) {
          const sanitized = preguntasMatch[0]
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/,\s*]/g, ']'); // Fix trailing commas
          parsed = JSON.parse(`{${sanitized}}`);
        } else {
          throw new Error("No se pudo extraer JSON válido");
        }
      } catch {
        throw new Error("Error al procesar respuesta del modelo");
      }
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
        indice: String.fromCharCode(65 + i),
        respuesta: r,
      })),
      correcta_indice: String.fromCharCode(65 + (p.correcta || 0)),
      explicacion: p.explicacion || "",
      documento: tieneTexto ? (documento || "Documento subido") : null,
      pagina: tieneTexto ? (p.pagina || "1") : null,
      ubicacion: tieneTexto ? (p.ubicacion || "medio") : null,
      cita: tieneTexto ? (p.cita || "") : null,
    }));

    console.log(`[generar-psicotecnicos-ia] Generados ${resultado.length} psicotécnicos`);

    return new Response(
      JSON.stringify({ success: true, preguntas: resultado }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generar-psicotecnicos-ia] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
