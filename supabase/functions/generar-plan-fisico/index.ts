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

    // Limitar semanas a máximo 4 para evitar respuestas demasiado largas
    const semanasLimitadas = Math.min(semanas || 4, 4);
    // Limitar días por semana usados por la IA para que el JSON sea compacto
    const diasSemanaIA = Math.min(dias_semana || 3, 4);

    if (!titulo || !tipo_prueba || !semanasLimitadas || !diasSemanaIA || !fecha_inicio || !fecha_fin) {
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

    const prompt = `Eres un experto entrenador deportivo. Genera un plan de entrenamiento físico personalizado.

**Datos:**
- Título: ${titulo}
- Tipo: ${tipo_prueba}
- Objetivo: ${descripcion || "Mejorar condición física"}
- Duración: ${semanasLimitadas} semanas
- Días/semana (IA): ${diasSemanaIA}
- Nivel: ${nivel_fisico}
- Periodo: ${fecha_inicio} a ${fecha_fin}

**Genera JSON con esta estructura EXACTA:**

{
  "titulo": "${titulo}",
  "descripcion": "Descripción breve del enfoque del plan (máx 150 caracteres)",
  "tipo_prueba": "${tipo_prueba}",
  "fecha_inicio": "${fecha_inicio}",
  "fecha_fin": "${fecha_fin}",
  "semanas": [
    {
      "titulo": "Semana 1: Fase Inicial",
      "fecha_inicio": "YYYY-MM-DD",
      "fecha_fin": "YYYY-MM-DD",
      "resumen": "Objetivo semanal breve",
      "sesiones": [
        {
          "dia": "Lunes",
          "bloques": [
            {
              "tipo": "Calentamiento",
              "ejercicios": [
                {"nombre": "Ejercicio 1", "notas": "Instrucción breve"}
              ]
            },
            {
              "tipo": "Principal",
              "ejercicios": [
                {"nombre": "Ejercicio 2", "notas": "Instrucción breve"}
              ]
            }
          ]
        }
      ]
    }
  ],
  "resumen": "Resumen del enfoque general"
}

**IMPORTANTE:**
- Genera las ${semanasLimitadas} semanas COMPLETAS
- Cada semana debe tener exactamente ${diasSemanaIA} sesiones (aunque el usuario haya indicado más)
- Distribuye las sesiones en días: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo según corresponda
- Cada sesión: 2 bloques máximo (Calentamiento + Principal)
- Cada bloque: 1 ejercicio con nombre y una nota corta
- Textos muy concisos (máx 8 palabras por nota)
- Calcula las fechas de cada semana correctamente
- NO uses markdown, ni listas, ni ```

**Enfoque ${tipo_prueba}:**
${getTipoPruebaGuidelines(tipo_prueba)}

**Criterios generales:**
- Progresión gradual según nivel ${nivel_fisico}
- Intensidad: principiante 60-70%, intermedio 70-80%, avanzado 80-90%
- Últimas 2 semanas: consolidación

Responde SOLO con JSON válido, sin markdown ni explicaciones.`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.9,
            maxOutputTokens: 4096,
          },
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
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    content = content.replace(/\/\*[\s\S]*?\*\//g, "");
    content = content.replace(/\/\/.*/g, "");
    
    let planData;
    try {
      // Intentar parsear directamente
      try {
        planData = JSON.parse(content);
      } catch (directParseError) {
        console.log("Parse directo falló, buscando JSON válido...");
        
        // Buscar el inicio del JSON
        const startIdx = content.indexOf('{');
        if (startIdx === -1) {
          throw new Error("No se encontró inicio de JSON");
        }
        
        // Intentar encontrar el JSON completo con balance de llaves
        let braceCount = 0;
        let endIdx = startIdx;
        let inString = false;
        let escapeNext = false;
        
        for (let i = startIdx; i < content.length; i++) {
          const char = content[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIdx = i + 1;
                break;
              }
            }
          }
        }
        
        if (braceCount !== 0) {
          console.error("JSON truncado o malformado. Braces no balanceadas:", braceCount);
          throw new Error("JSON incompleto o malformado");
        }
        
        const jsonStr = content.substring(startIdx, endIdx);
        console.log("JSON extraído (length):", jsonStr.length);
        planData = JSON.parse(jsonStr);
      }
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      console.error("Contenido (primeros 1000):", content.substring(0, 1000));
      console.error("Contenido (últimos 500):", content.substring(Math.max(0, content.length - 500)));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Error al procesar respuesta de IA. Intenta reducir el número de semanas o días.",
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
    "Bombero": "Fuerza funcional + resistencia. Incluir: dominadas, flexiones, carrera.",
    "Policía Nacional": "Equilibrio fuerza-velocidad-resistencia. Circuitos y natación.",
    "Policía Local": "Resistencia + pruebas físicas generales. Circuitos metabólicos.",
    "Guardia Civil": "Resistencia cardiovascular + fuerza funcional + natación.",
    "Militar": "Alta resistencia física. Marchas con carga + fuerza-resistencia.",
    "CrossFit": "Alta intensidad. WODs variados: gimnásticos + halterofilia + metcon.",
    "Hyrox": "8km carrera + 8 estaciones. Resistencia aeróbica + transiciones rápidas.",
    "Hybrid": "CrossFit + Hyrox. Balance fuerza-potencia-resistencia.",
    "Otro": "Condición física general. Trabajo equilibrado.",
  };
  
  return guidelines[tipo] || guidelines["Otro"];
}
