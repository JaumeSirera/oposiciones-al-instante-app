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
    const {
      titulo,
      tipo_prueba,
      descripcion,
      semanas,
      dias_semana,
      nivel_fisico,
      fecha_inicio,
      fecha_fin,
    } = await req.json();

    if (!titulo || !tipo_prueba || !semanas || !dias_semana || !fecha_inicio || !fecha_fin) {
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

    const prompt = `Eres un experto entrenador deportivo especializado en preparación física para oposiciones y competiciones.

Genera un plan de entrenamiento físico personalizado con las siguientes características:

**Información del plan:**
- Título: ${titulo}
- Tipo de prueba: ${tipo_prueba}
- Descripción/Objetivos: ${descripcion || "Sin objetivos específicos"}
- Duración: ${semanas} semanas
- Días de entrenamiento por semana: ${dias_semana}
- Nivel físico: ${nivel_fisico}
- Fecha inicio: ${fecha_inicio}
- Fecha fin: ${fecha_fin}

**Estructura requerida:**

Genera un JSON con esta estructura exacta:
{
  "titulo": "${titulo}",
  "descripcion": "Descripción breve del plan (máximo 2 líneas)",
  "tipo_prueba": "${tipo_prueba}",
  "fecha_inicio": "${fecha_inicio}",
  "fecha_fin": "${fecha_fin}",
  "semanas": [
    {
      "titulo": "Semana 1: Adaptación",
      "fecha_inicio": "YYYY-MM-DD",
      "fecha_fin": "YYYY-MM-DD",
      "resumen": "Objetivo breve (1 línea)",
      "sesiones": [
        {
          "dia": "Lunes",
          "bloques": [
            {
              "tipo": "Calentamiento",
              "ejercicios": [
                {
                  "nombre": "Ejercicio",
                  "series": 3,
                  "repeticiones": "10-12",
                  "descanso": "60s",
                  "notas": "Técnica"
                }
              ]
            },
            {
              "tipo": "Principal",
              "ejercicios": [...]
            },
            {
              "tipo": "Vuelta a la calma",
              "ejercicios": [...]
            }
          ]
        }
      ]
    }
  ],
  "resumen": "Resumen general breve (máx 2 líneas)"
}

**IMPORTANTE - Mantén el JSON CONCISO:**
- Descripciones: máximo 2 líneas
- Máximo 3 ejercicios por bloque
- Notas técnicas: 1 línea máximo

**Criterios específicos para ${tipo_prueba}:**
${getTipoPruebaGuidelines(tipo_prueba)}

**Criterios generales:**
1. ${dias_semana} sesiones/semana equilibradas
2. Progresión gradual según nivel ${nivel_fisico}
3. Calentamiento, principal y vuelta a la calma en cada sesión
4. Especifica series, reps, descansos
5. Últimas 2 semanas: consolidación
6. Intensidad: principiante (60-70%), intermedio (70-80%), avanzado (80-90%)

Genera el plan COMPLETO en formato JSON válido y CONCISO.`;

    const aiResponse = await fetch(
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
            maxOutputTokens: 16384,
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error de Gemini:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Error al generar plan con IA" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const aiData = await aiResponse.json();
    let content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log("Respuesta de Gemini (raw):", JSON.stringify(aiData).substring(0, 500));

    if (!content) {
      console.error("No se generó contenido de la IA");
      return new Response(
        JSON.stringify({ success: false, error: "No se generó contenido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Contenido recibido (primeros 500 chars):", content.substring(0, 500));

    // Limpiar markdown y caracteres especiales
    content = content.trim();
    // Remover bloques de código markdown
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    // Remover posibles comentarios
    content = content.replace(/\/\*[\s\S]*?\*\//g, "");
    content = content.replace(/\/\/.*/g, "");
    
    let planData;
    try {
      // Intentar parsear directamente primero
      try {
        planData = JSON.parse(content);
      } catch (directParseError) {
        console.log("Parse directo falló, intentando extraer JSON...");
        // Si falla, buscar el JSON dentro del contenido
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No se encontró JSON válido en la respuesta");
        }
        console.log("JSON extraído (primeros 500 chars):", jsonMatch[0].substring(0, 500));
        planData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      console.error("Contenido que falló:", content.substring(0, 1000));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Error al procesar respuesta de IA: " + parseError.message,
          debug: content.substring(0, 500)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan: planData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en generar-plan-fisico:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function getTipoPruebaGuidelines(tipo: string): string {
  const guidelines = {
    "Bombero": `- Enfoque en fuerza funcional y resistencia cardiovascular
- Incluir ejercicios específicos: dominadas, flexiones, carrera, natación
- Trabajo de resistencia aeróbica y anaeróbica
- Circuitos funcionales con material específico`,
    
    "Policía Nacional": `- Equilibrio entre fuerza, velocidad y resistencia
- Circuitos de fuerza-resistencia
- Trabajo de velocidad en distancias cortas
- Natación técnica y resistencia`,
    
    "Policía Local": `- Similar a Policía Nacional adaptado
- Enfoque en resistencia y pruebas físicas generales
- Circuitos metabólicos`,
    
    "Guardia Civil": `- Programa integral de condición física
- Resistencia cardiovascular de larga duración
- Fuerza funcional y natación`,
    
    "Militar": `- Alto componente de resistencia física y mental
- Marchas con carga
- Trabajo de fuerza-resistencia intenso`,
    
    "CrossFit": `- Alta intensidad y variedad de movimientos
- WODs (Workout of the Day) variados
- Trabajo de gimnásticos, halterofilia y metcon
- Énfasis en movimientos funcionales a alta intensidad`,
    
    "Hyrox": `- Formato específico: 8km carrera + 8 estaciones
- Trabajo de resistencia aeróbica base
- Entrenamiento en las 8 estaciones oficiales
- Transiciones rápidas entre ejercicios`,
    
    "Hybrid": `- Combinación de CrossFit y Hyrox
- Balance entre fuerza, potencia y resistencia
- Sesiones mixtas de gimnásticos + metcon
- Trabajo cardiovascular específico`,
    
    "Otro": `- Plan general de condición física
- Trabajo equilibrado de todas las capacidades
- Adaptable a diferentes objetivos`,
  };
  
  return guidelines[tipo] || guidelines["Otro"];
}
