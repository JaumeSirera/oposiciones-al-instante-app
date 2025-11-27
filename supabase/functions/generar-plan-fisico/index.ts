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

    const semanasTotal = Math.min(semanas || 6, 6);
    const diasSemanaIA = Math.min(dias_semana || 4, 4);

    if (!titulo || !tipo_prueba || !semanasTotal || !diasSemanaIA || !fecha_inicio || !fecha_fin) {
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

    console.log(`Generando plan de ${semanasTotal} semanas en múltiples llamadas...`);

    // Dividir las semanas en chunks de 2
    const SEMANAS_POR_CHUNK = 2;
    const numChunks = Math.ceil(semanasTotal / SEMANAS_POR_CHUNK);
    const todasLasSemanas = [];

    // Calcular fecha de inicio para cada chunk
    const fechaInicio = new Date(fecha_inicio);

    for (let chunk = 0; chunk < numChunks; chunk++) {
      const semanaInicio = chunk * SEMANAS_POR_CHUNK + 1;
      const semanaFin = Math.min((chunk + 1) * SEMANAS_POR_CHUNK, semanasTotal);
      const semanasEnChunk = semanaFin - semanaInicio + 1;

      // Calcular fechas para este chunk
      const fechaInicioChunk = new Date(fechaInicio);
      fechaInicioChunk.setDate(fechaInicio.getDate() + (chunk * SEMANAS_POR_CHUNK * 7));
      
      const fechaFinChunk = new Date(fechaInicioChunk);
      fechaFinChunk.setDate(fechaInicioChunk.getDate() + (semanasEnChunk * 7) - 1);

      console.log(`Generando semanas ${semanaInicio}-${semanaFin} (chunk ${chunk + 1}/${numChunks})`);

      const prompt = `Eres un experto entrenador deportivo. Genera las semanas ${semanaInicio} a ${semanaFin} de un plan de ${semanasTotal} semanas.

**Datos:**
- Título: ${titulo}
- Tipo: ${tipo_prueba}
- Objetivo: ${descripcion || "Mejorar condición física"}
- Semanas a generar: ${semanaInicio} a ${semanaFin} de ${semanasTotal} total
- Días/semana: ${diasSemanaIA}
- Nivel: ${nivel_fisico}
- Periodo chunk: ${fechaInicioChunk.toISOString().split('T')[0]} a ${fechaFinChunk.toISOString().split('T')[0]}

**Genera JSON con esta estructura EXACTA:**

{
  "semanas": [
    {
      "titulo": "Semana ${semanaInicio}: Título descriptivo",
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
                {
                  "nombre": "Movilidad articular",
                  "series": 1,
                  "reps": "10 min",
                  "descanso": "0"
                }
              ]
            },
            {
              "tipo": "Principal",
              "ejercicios": [
                {
                  "nombre": "Carrera continua",
                  "series": 1,
                  "reps": "20 min",
                  "carga": {
                    "rx": "RPE 6-7",
                    "scaled": "RPE 5-6",
                    "beginner": "RPE 4-5"
                  },
                  "descanso": "0"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

**IMPORTANTE:**
- Genera EXACTAMENTE ${semanasEnChunk} semanas (${semanaInicio} a ${semanaFin})
- Cada semana: EXACTAMENTE ${diasSemanaIA} sesiones (Lunes, Martes, Miércoles, etc.)
- Cada sesión: 2 bloques (Calentamiento + Principal)
- CRÍTICO: Cada ejercicio DEBE incluir:
  * "nombre": Nombre completo del ejercicio (ej: "12 KB Swings 24/16kg" o "Box Jumps 60cm")
  * "series": Número de series
  * "reps": Repeticiones o duración (ej: "12", "20 min", "10-12")
  * "carga": Objeto con rx/scaled/beginner cuando aplique (ej: {"rx": "24kg", "scaled": "16kg"})
  * "descanso": Tiempo de descanso en segundos (ej: "60", "90")
- Incluye las repeticiones y cargas en el nombre del ejercicio (ej: "12 KB Swings 24/16kg", "10 Box Jumps 60cm")
- Calcula fechas correctamente desde ${fechaInicioChunk.toISOString().split('T')[0]}
- Responde JSON puro sin markdown

**Enfoque ${tipo_prueba}:**
${getTipoPruebaGuidelines(tipo_prueba)}

**Progresión:**
${getProgresionGuidelines(semanaInicio, semanasTotal, nivel_fisico)}

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
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`Error en chunk ${chunk + 1}:`, errorText);
        return new Response(
          JSON.stringify({ success: false, error: `Error al generar semanas ${semanaInicio}-${semanaFin}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      const aiData = await aiResponse.json();
      let content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        console.error(`No se generó contenido para chunk ${chunk + 1}`);
        return new Response(
          JSON.stringify({ success: false, error: `No se generó contenido para semanas ${semanaInicio}-${semanaFin}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      // Limpiar markdown
      content = content.trim();
      content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      content = content.replace(/\/\*[\s\S]*?\*\//g, "");
      content = content.replace(/\/\/.*/g, "");

      let chunkData;
      try {
        chunkData = JSON.parse(content);
      } catch (directParseError) {
        // Buscar JSON válido
        const startIdx = content.indexOf('{');
        if (startIdx === -1) {
          throw new Error(`No se encontró JSON en chunk ${chunk + 1}`);
        }

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
          throw new Error(`JSON incompleto en chunk ${chunk + 1}`);
        }

        const jsonStr = content.substring(startIdx, endIdx);
        chunkData = JSON.parse(jsonStr);
      }

      if (!chunkData.semanas || !Array.isArray(chunkData.semanas)) {
        throw new Error(`Estructura inválida en chunk ${chunk + 1}`);
      }

      console.log(`Chunk ${chunk + 1} completado: ${chunkData.semanas.length} semanas`);
      todasLasSemanas.push(...chunkData.semanas);
    }

    // Construir el plan completo
    const planCompleto = {
      titulo: titulo,
      descripcion: descripcion || `Plan de ${semanasTotal} semanas para ${tipo_prueba}`,
      tipo_prueba: tipo_prueba,
      fecha_inicio: fecha_inicio,
      fecha_fin: fecha_fin,
      semanas: todasLasSemanas,
      resumen: `Plan de ${semanasTotal} semanas, ${diasSemanaIA} días/semana, nivel ${nivel_fisico}`
    };

    console.log(`Plan completo generado: ${todasLasSemanas.length} semanas`);

    return new Response(
      JSON.stringify({
        success: true,
        plan: planCompleto,
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

function getProgresionGuidelines(semanaActual: number, semanasTotal: number, nivel: string): string {
  const porcentaje = (semanaActual / semanasTotal) * 100;
  
  if (porcentaje <= 33) {
    return `Fase inicial (semana ${semanaActual}). Adaptación y técnica. Intensidad ${nivel === 'principiante' ? '60-65%' : nivel === 'intermedio' ? '65-70%' : '70-75%'}.`;
  } else if (porcentaje <= 66) {
    return `Fase intermedia (semana ${semanaActual}). Aumentar carga. Intensidad ${nivel === 'principiante' ? '65-70%' : nivel === 'intermedio' ? '70-80%' : '75-85%'}.`;
  } else {
    return `Fase final (semana ${semanaActual}). Consolidación y pico. Intensidad ${nivel === 'principiante' ? '70-75%' : nivel === 'intermedio' ? '75-85%' : '80-90%'}.`;
  }
}
