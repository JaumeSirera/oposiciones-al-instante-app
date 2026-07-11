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

    // Construir prompt optimizado para generación rápida
    const promptBase = tieneTexto 
      ? `Genera exactamente ${num_preguntas} preguntas de test tipo oposición basándote en el siguiente texto:

"${texto.substring(0, 8000)}"

Las preguntas deben evaluar comprensión del contenido.
IMPORTANTE: Para cada pregunta, indica la ubicación aproximada en el texto donde se encuentra la respuesta.`
      : `Genera exactamente ${num_preguntas} preguntas de test tipo oposición sobre:
- Tema: ${tema || "General"}
- Sección: ${seccion || "General"}

Las preguntas deben ser de nivel oposición, precisas y con respuestas claras.`;

    // Sistema con o sin trazabilidad según haya texto
    const formatoConTrazabilidad = `{
  "preguntas": [
    {
      "pregunta": "texto de la pregunta",
      "respuestas": ["respuesta A", "respuesta B", "respuesta C", "respuesta D"],
      "correcta": 0,
      "explicacion": "breve explicación de por qué es correcta",
      "pagina": "1",
      "ubicacion": "inicio|medio|final",
      "cita": "fragmento textual exacto del documento donde se encuentra la respuesta"
    }
  ]
}`;

    const formatoSinTrazabilidad = `{
  "preguntas": [
    {
      "pregunta": "texto de la pregunta",
      "respuestas": ["respuesta A", "respuesta B", "respuesta C", "respuesta D"],
      "correcta": 0,
      "explicacion": "breve explicación de por qué es correcta"
    }
  ]
}`;

    const systemPrompt = `Eres un experto generador de preguntas para oposiciones españolas. 
Genera preguntas de opción múltiple con 4 respuestas cada una.
IMPORTANTE: Responde SOLO con un JSON válido, sin markdown ni texto adicional.

Formato requerido:
${tieneTexto ? formatoConTrazabilidad : formatoSinTrazabilidad}

El campo "correcta" es el índice (0-3) de la respuesta correcta.${tieneTexto ? `
Los campos "pagina", "ubicacion" y "cita" son OBLIGATORIOS cuando se genera desde texto.
- "pagina": número de página aproximado o "1" si no hay paginación
- "ubicacion": dónde está la respuesta en el texto (inicio, medio, final)  
- "cita": copia textual del fragmento donde aparece la información de la respuesta correcta` : ''}`;

    // Calcular tokens necesarios: ~200 tokens por pregunta con trazabilidad, ~150 sin
    const tokensPerQuestion = tieneTexto ? 250 : 180;
    const calculatedTokens = Math.min(16000, Math.max(4096, num_preguntas * tokensPerQuestion));
    
    console.log(`[generar-preguntas-ia] Generando ${num_preguntas} preguntas con max_tokens=${calculatedTokens}...`);

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
        max_tokens: calculatedTokens,
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

    // Parsear el JSON de la respuesta (tolerante a errores)
    let preguntas: any[] = [];
    
    const cleanMarkdown = (s: string) => {
      let c = s.trim();
      if (c.startsWith("```json")) c = c.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      else if (c.startsWith("```")) c = c.replace(/^```\s*/, "").replace(/\s*```$/, "");
      return c;
    };
    
    const sanitize = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ');
    
    // Extrae objetos JSON balanceados de un string, ignorando los inválidos
    const extractObjects = (text: string): any[] => {
      const results: any[] = [];
      let depth = 0;
      let start = -1;
      let inString = false;
      let escape = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const chunk = text.substring(start, i + 1);
            try {
              results.push(JSON.parse(chunk));
            } catch {
              // Intento de reparación: escapar backslashes sueltos
              try {
                const repaired = chunk.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
                results.push(JSON.parse(repaired));
              } catch {
                // descartar objeto inválido
              }
            }
            start = -1;
          }
        }
      }
      return results;
    };

    try {
      const cleanContent = sanitize(cleanMarkdown(content));
      const parsed = JSON.parse(cleanContent);
      preguntas = parsed.preguntas || parsed;
    } catch (parseError) {
      console.warn("[generar-preguntas-ia] JSON global inválido, extrayendo objetos individualmente");
      const cleanContent = sanitize(cleanMarkdown(content));
      // Buscar el array "preguntas" y extraer sus objetos uno a uno
      const idx = cleanContent.indexOf('"preguntas"');
      const region = idx >= 0 ? cleanContent.substring(idx) : cleanContent;
      preguntas = extractObjects(region).filter((p) => p && p.pregunta && Array.isArray(p.respuestas));
      if (preguntas.length === 0) {
        console.error("[generar-preguntas-ia] Content:", content.substring(0, 500));
        throw new Error("Error al procesar respuesta del modelo");
      }
      console.log(`[generar-preguntas-ia] Recuperadas ${preguntas.length} preguntas tras reparación`);
    }


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
      // Campos de trazabilidad (solo si hay texto fuente)
      documento: tieneTexto ? (documento || "Documento subido") : null,
      pagina: tieneTexto ? (p.pagina || "1") : null,
      ubicacion: tieneTexto ? (p.ubicacion || "medio") : null,
      cita: tieneTexto ? (p.cita || "") : null,
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
