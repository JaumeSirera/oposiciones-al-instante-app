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
    const { id_plan, titulo, descripcion, fecha_inicio, fecha_fin, proceso, secciones, temas } = await req.json();

    if (!id_plan || !titulo || !fecha_inicio || !fecha_fin || !secciones || !temas) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan parámetros requeridos" }),
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

    // Calcular duración del plan
    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    const semanas = Math.ceil(dias / 7);

    // Construir prompt para la IA
    const temasSeleccionados = Array.isArray(temas) ? temas : [];
    const seccionesSeleccionadas = Array.isArray(secciones) ? secciones : [];
    
    const prompt = `Eres un experto en planificación de estudios para oposiciones.

Genera un plan de estudio personalizado con las siguientes características:

**Información del plan:**
- Título: ${titulo}
- Descripción: ${descripcion || "Sin descripción adicional"}
- Proceso/Oposición: ${proceso || "No especificado"}
- Fecha inicio: ${fecha_inicio}
- Fecha fin: ${fecha_fin}
- Duración: ${semanas} semanas (${dias} días)

**Secciones a estudiar:**
${seccionesSeleccionadas.join(", ") || "No especificadas"}

**Temas específicos seleccionados:**
${temasSeleccionados.join(", ")}

**IMPORTANTE:** Debes distribuir ÚNICAMENTE estos ${temasSeleccionados.length} temas en las ${semanas} semanas disponibles.

**Estructura requerida:**

Genera un JSON con esta estructura exacta:
{
  "resumen": "Un resumen ejecutivo del plan (2-3 párrafos explicando cómo se distribuyen los ${temasSeleccionados.length} temas en ${semanas} semanas, la estrategia de estudio y objetivos clave)",
  "plan": [
    {
      "semana": 1,
      "fecha_inicio": "YYYY-MM-DD",
      "fecha_fin": "YYYY-MM-DD",
      "temas_semana": ["tema exacto 1", "tema exacto 2"],
      "objetivos": ["objetivo 1", "objetivo 2"],
      "actividades": [
        {
          "dia": 1,
          "fecha": "YYYY-MM-DD",
          "tema": "tema exacto del día",
          "actividad": "Estudiar teoría del tema",
          "duracion_horas": 2
        },
        {
          "dia": 2,
          "fecha": "YYYY-MM-DD",
          "tema": "tema exacto del día",
          "actividad": "Realizar test de práctica",
          "duracion_horas": 1.5
        }
      ],
      "notas": "Consejos para esta semana"
    }
  ]
}

**Criterios de distribución:**
1. Distribuye los ${temasSeleccionados.length} temas de forma equilibrada entre las ${semanas} semanas
2. Cada semana debe tener 2-4 temas máximo
3. Para cada tema de la semana, crea actividades diarias específicas:
   - Día 1-2: Estudio de teoría del tema
   - Día 3-4: Práctica y ejercicios del tema
   - Día 5: Test del tema
   - Día 6: Repaso del tema
   - Día 7: Descanso o repaso general
4. Cada día debe tener entre 1.5-3 horas de estudio
5. En el campo "tema" de cada actividad, usa EXACTAMENTE el nombre del tema de la lista proporcionada
6. Las últimas 2 semanas deben ser de repaso intensivo de TODOS los temas estudiados
7. Incluye una actividad de test semanal con los temas de esa semana
8. Las fechas deben ser consecutivas y coherentes

Genera el plan completo en formato JSON válido. Responde SOLO con JSON, sin markdown ni explicaciones.`;

    console.log(`Generando plan de estudio: ${semanas} semanas, ${temasSeleccionados.length} temas`);

    // Llamar a Lovable AI Gateway
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
            content: "Eres un experto en planificación de estudios para oposiciones. Genera planes de estudio estructurados en formato JSON. Responde SIEMPRE con JSON válido sin markdown." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 8192,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error de Lovable AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Límite de solicitudes excedido. Intenta de nuevo en unos segundos." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Se requiere añadir créditos a Lovable AI." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Error al generar plan con IA" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content;

    if (!generatedText) {
      return new Response(
        JSON.stringify({ success: false, error: "No se generó contenido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Extraer y sanitizar JSON del texto generado
    let planData;
    try {
      // Limpiar markdown y caracteres de control
      let cleanText = generatedText.trim();
      cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      cleanText = cleanText
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No se encontró JSON en la respuesta");
      
      planData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      console.error("Texto generado (primeros 500 chars):", generatedText.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Error al procesar respuesta de IA. Intenta de nuevo." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Guardar en la base de datos usando el proxy PHP
    const API_BASE_URL = "https://oposiciones-test.com/api";
    try {
      const saveResponse = await fetch(`${API_BASE_URL}/guardar_plan_ia.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_plan: id_plan,
          plan_json: JSON.stringify(planData),
          resumen: planData.resumen || "",
        }),
      });

      if (!saveResponse.ok) {
        console.error("Error al guardar en BD:", await saveResponse.text());
      } else {
        console.log("Plan guardado en BD correctamente");
      }
    } catch (saveError) {
      console.error("Error guardando plan:", saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan: planData.plan,
        resumen: planData.resumen,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en generar-plan-estudio:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
