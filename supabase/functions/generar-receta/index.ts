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
        restriccionDietetica = `

⚠️ **RESTRICCIÓN DIETÉTICA OBLIGATORIA: SIN GLUTEN** ⚠️
Esta receta DEBE ser 100% libre de gluten. Cumple ESTRICTAMENTE estas reglas:

INGREDIENTES TOTALMENTE PROHIBIDOS (no usar bajo ningún concepto):
- Trigo (harina de trigo, pan, pasta de trigo, sémola, cuscús, bulgur, seitan)
- Cebada (incluida la malta de cebada y cerveza)
- Centeno (pan de centeno, harina de centeno)
- Avena (salvo que sea certificada sin gluten)
- Espelta, kamut, triticale
- Salsas comerciales con gluten: salsa de soja normal, salsa teriyaki, salsa Worcestershire
- Rebozados con harina de trigo, pan rallado normal, empanados
- Cerveza, algunos caldos comerciales con gluten

SUSTITUCIONES OBLIGATORIAS:
- Harina de trigo → harina de arroz, harina de maíz, harina de almendra, harina de garbanzo, fécula de patata, almidón de maíz (maicena)
- Pasta de trigo → pasta de arroz, pasta de maíz, pasta de legumbres
- Pan normal → pan sin gluten (de arroz, maíz o trigo sarraceno)
- Pan rallado → pan rallado sin gluten o almendra molida
- Salsa de soja → tamari (salsa de soja sin gluten)
- Cuscús → quinoa o arroz
- Cerveza → vino o caldo sin gluten

Indica SIEMPRE entre paréntesis "(sin gluten)" junto a cada ingrediente sustituido.`;
        break;
      case "vegetariano":
        restriccionDietetica = `

⚠️ **RESTRICCIÓN DIETÉTICA OBLIGATORIA: VEGETARIANO** ⚠️
Esta receta DEBE ser 100% vegetariana. Cumple ESTRICTAMENTE estas reglas:

INGREDIENTES TOTALMENTE PROHIBIDOS (no usar bajo ningún concepto):
- Cualquier tipo de carne: ternera, cerdo, cordero, conejo, caballo, caza
- Cualquier tipo de ave: pollo, pavo, pato, codorniz
- Cualquier tipo de pescado: salmón, atún, merluza, bacalao, sardinas, anchoas
- Cualquier tipo de marisco: gambas, langostinos, mejillones, calamares, pulpo
- Embutidos y derivados cárnicos: jamón, chorizo, salchichón, bacon, salchichas
- Gelatina animal, manteca de cerdo, grasa animal
- Caldos de carne o pescado (usar caldo vegetal)
- Anchoas en salsas (como la salsa Caesar tradicional)

INGREDIENTES PERMITIDOS:
- Huevos, lácteos (leche, queso, yogur, nata, mantequilla), miel
- Todas las verduras, frutas, legumbres, cereales, frutos secos, semillas
- Tofu, tempeh, seitán, soja texturizada, heura
- Hongos y setas (portobello, shiitake, etc.)

SUSTITUCIONES OBLIGATORIAS para platos con carne/pescado:
- Carne → tofu firme marinado, seitán, soja texturizada, tempeh, legumbres (lentejas, garbanzos), setas portobello
- Pescado → tofu ahumado, algas, coliflor al horno
- Caldo de carne → caldo vegetal
- Gelatina → agar-agar

El plato resultante debe tener proteínas vegetarianas suficientes. Indica las sustituciones realizadas.`;
        break;
      case "vegano":
        restriccionDietetica = `

⚠️ **RESTRICCIÓN DIETÉTICA OBLIGATORIA: VEGANO** ⚠️
Esta receta DEBE ser 100% vegana. Cumple ESTRICTAMENTE estas reglas:

INGREDIENTES TOTALMENTE PROHIBIDOS (no usar bajo ningún concepto):
- Cualquier tipo de carne, ave, pescado o marisco (ver lista vegetariano)
- Huevos (ni como ingrediente ni para rebozar/empanar/pintar)
- Lácteos: leche, queso, yogur, nata, mantequilla, crema, requesón, kéfir
- Miel
- Gelatina animal, manteca de cerdo/animal
- Caseína, suero de leche (whey), lactosa
- Caldos de carne, pescado o con derivados animales
- Cualquier alimento que contenga trazas de productos animales como ingrediente principal

INGREDIENTES PERMITIDOS:
- Todas las verduras, frutas, legumbres, cereales, frutos secos, semillas
- Tofu, tempeh, seitán, soja texturizada, heura, proteína de guisante
- Leches vegetales: avena, soja, almendra, coco, arroz
- Yogur vegetal, queso vegano, nata vegetal (de coco, soja, avena)
- Levadura nutricional (para sabor a queso)
- Sirope de arce o agave (en lugar de miel)

SUSTITUCIONES OBLIGATORIAS:
- Leche → leche de avena, soja o almendra
- Mantequilla → aceite de oliva, margarina vegetal o aceite de coco
- Huevo (para rebozar) → mezcla de harina de garbanzo con agua, o semillas de lino/chía molidas con agua
- Huevo (para bizcochos) → puré de plátano, compota de manzana, o sustituto comercial vegano
- Queso → levadura nutricional, queso vegano, anacardos remojados
- Nata → nata de coco o de soja
- Miel → sirope de agave o de arce
- Yogur → yogur de soja o coco
- Caldo → caldo vegetal casero o comercial vegano

El plato debe ser nutricionalmente completo. Indica todas las sustituciones.`;
        break;
      default:
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
      
      console.log("Generating image for recipe:", plato);
      
      const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          prompt: imagePrompt,
          n: 1,
          size: "512x512",
        }),
      });

      console.log("Image API response status:", imageResponse.status);

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        
        // Format: choices[0].images[0].image_url.url (Gemini image model)
        const imageUrl = imageData.choices?.[0]?.images?.[0]?.image_url?.url;
        if (imageUrl) {
          receta.imagen_url = imageUrl;
          console.log("Image set from choices.images, length:", imageUrl.length > 200 ? imageUrl.substring(0, 50) + "..." : imageUrl);
        }
        // Fallback: data[0].url
        else if (imageData.data?.[0]?.url) {
          receta.imagen_url = imageData.data[0].url;
          console.log("Image URL set from data");
        }
        // Fallback: data[0].b64_json
        else if (imageData.data?.[0]?.b64_json) {
          receta.imagen_url = `data:image/png;base64,${imageData.data[0].b64_json}`;
          console.log("Image base64 set from data");
        } else {
          console.log("Unexpected image response:", JSON.stringify(imageData).substring(0, 500));
        }
      } else {
        const errorText = await imageResponse.text();
        console.error("Image API error:", imageResponse.status, errorText.substring(0, 500));
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
