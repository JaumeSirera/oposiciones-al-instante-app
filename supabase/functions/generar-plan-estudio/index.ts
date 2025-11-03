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

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
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

    // Construir prompt para Gemini
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

Genera el plan completo en formato JSON válido.`;

    // Llamar a Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Error de Gemini:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Error al generar plan con IA" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return new Response(
        JSON.stringify({ success: false, error: "No se generó contenido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Extraer JSON del texto generado
    let planData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No se encontró JSON en la respuesta");
      planData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Error al procesar respuesta de IA" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Guardar en la base de datos usando el proxy PHP
    const API_BASE_URL = "https://oposiciones-test.com/api";
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
      console.error("Error al guardar en BD");
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
