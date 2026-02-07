import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { plato, ingredientes, tipo_comida, preferencia_dietetica } = await req.json();

    if (!plato) {
      return new Response(
        JSON.stringify({ success: false, error: "Falta el nombre del plato" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "API key no configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Build dietary restriction text
    let restriccionDietetica = "";
    switch (preferencia_dietetica) {
      case "sin_gluten":
        restriccionDietetica = "\n\n**IMPORTANTE - RESTRICCIÓN DIETÉTICA: SIN GLUTEN**\nTodos los ingredientes y la receta deben ser 100% libres de gluten. Sustituye cualquier ingrediente con gluten (trigo, cebada, centeno, avena no certificada) por alternativas sin gluten. Indica claramente las sustituciones realizadas.";
        break;
      case "vegetariano":
        restriccionDietetica = "\n\n**IMPORTANTE - RESTRICCIÓN DIETÉTICA: VEGETARIANO**\nLa receta debe ser 100% vegetariana. No incluir carne, pescado ni mariscos. Se permiten huevos, lácteos y miel. Si el plato original contiene carne/pescado, adapta la receta con proteínas vegetarianas (tofu, tempeh, legumbres, huevos, queso, etc.).";
        break;
      case "vegano":
        restriccionDietetica = "\n\n**IMPORTANTE - RESTRICCIÓN DIETÉTICA: VEGANO**\nLa receta debe ser 100% vegana. No incluir ningún producto de origen animal (carne, pescado, huevos, lácteos, miel). Adapta todos los ingredientes a alternativas 100% vegetales (leche vegetal, tofu, tempeh, levadura nutricional, etc.).";
        break;
      default:
        // "normal" - no restriction
        break;
    }

    console.log(`Generando receta para: ${plato}, preferencia: ${preferencia_dietetica || 'normal'}`);

    const prompt = `Eres un chef profesional y nutricionista. Genera una receta detallada para el siguiente plato:

**Plato:** ${plato}
**Tipo de comida:** ${tipo_comida || 'principal'}
**Ingredientes base sugeridos:** ${ingredientes?.join(', ') || 'los habituales'}${restriccionDietetica}

Genera un JSON con esta estructura EXACTA:

{
  "nombre": "${plato}${preferencia_dietetica && preferencia_dietetica !== 'normal' ? ' (versión adaptada)' : ''}",
  "descripcion": "Breve descripción del plato (1-2 frases)",
  "tiempo_preparacion": "15 min",
  "tiempo_coccion": "25 min",
  "porciones": 2,
  "dificultad": "Fácil|Media|Difícil",
  "ingredientes": [
    { "cantidad": "200g", "ingrediente": "Ingrediente 1" },
    { "cantidad": "1 unidad", "ingrediente": "Ingrediente 2" }
  ],
  "instrucciones": [
    "Paso 1: descripción detallada",
    "Paso 2: descripción detallada"
  ],
  "consejos": [
    "Consejo útil 1",
    "Consejo útil 2"
  ]
}

**Requisitos:**
- Incluye 6-12 ingredientes con cantidades exactas
- Incluye 4-8 pasos de instrucciones detallados
- Incluye 2-4 consejos prácticos del chef
- La receta debe ser realista y práctica
- Adapta la receta al tipo de comida (desayuno/almuerzo/cena/snack)

Responde SOLO con JSON válido, sin markdown ni explicaciones.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un chef profesional. Genera recetas estructuradas en formato JSON. Responde SIEMPRE con JSON válido sin markdown."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error AI:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Límite de solicitudes excedido. Intenta de nuevo." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Error al generar la receta" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: "No se generó contenido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Clean markdown wrapping if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let receta;
    try {
      receta = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parsing recipe JSON:", parseError, "Content:", content.substring(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: "Error procesando la receta generada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Generate image for the recipe
    try {
      const imagePrompt = `Professional food photography of ${plato}, beautifully plated, restaurant quality, warm lighting, shallow depth of field, top-down view, 4k quality`;
      
      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "flux.schnell",
          prompt: imagePrompt,
          n: 1,
          size: "512x512",
        }),
      });

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        if (imageData.data?.[0]?.url) {
          receta.imagen_url = imageData.data[0].url;
        }
      }
    } catch (imgError) {
      console.error("Error generating image (non-fatal):", imgError);
    }

    console.log("Receta generada exitosamente:", receta.nombre);

    return new Response(
      JSON.stringify({ success: true, receta }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
