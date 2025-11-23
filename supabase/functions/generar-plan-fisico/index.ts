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
  "descripcion": "Descripción completa del plan adaptada a ${tipo_prueba}",
  "tipo_prueba": "${tipo_prueba}",
  "fecha_inicio": "${fecha_inicio}",
  "fecha_fin": "${fecha_fin}",
  "semanas": [
    {
      "titulo": "Semana 1: Adaptación",
      "fecha_inicio": "YYYY-MM-DD",
      "fecha_fin": "YYYY-MM-DD",
      "resumen": "Resumen de objetivos de la semana",
      "sesiones": [
        {
          "dia": "Lunes",
          "bloques": [
            {
              "tipo": "Calentamiento",
              "ejercicios": [
                {
                  "nombre": "Ejercicio específico",
                  "series": 3,
                  "repeticiones": "10-12",
                  "descanso": "60 seg",
                  "notas": "Observaciones técnicas"
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
  "resumen": "Resumen general del plan de ${semanas} semanas"
}

**Criterios específicos para ${tipo_prueba}:**
${getTipoPruebaGuidelines(tipo_prueba)}

**Criterios generales:**
1. Distribuye ${dias_semana} sesiones por semana de forma equilibrada
2. Progresión gradual de intensidad según el nivel ${nivel_fisico}
3. Incluye calentamiento (10-15 min), parte principal (30-45 min) y vuelta a la calma (10 min)
4. Cada sesión debe tener bloques: Calentamiento, Principal, Vuelta a la calma
5. Especifica series, repeticiones, descansos y notas técnicas
6. Las últimas 2 semanas deben ser de consolidación y puesta a punto
7. Incluye días de descanso activo o completo
8. Adapta la intensidad al nivel: principiante (60-70%), intermedio (70-80%), avanzado (80-90%)

Genera el plan completo en formato JSON válido.`;

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
            maxOutputTokens: 8192,
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

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: "No se generó contenido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Limpiar markdown y extraer JSON
    content = content.trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
    let planData;
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No se encontró JSON en la respuesta");
      planData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Error al procesar respuesta de IA" }),
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
