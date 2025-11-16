import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id_proceso, tema, seccion, id_usuario, num_preguntas, texto } = await req.json();

    console.log('Generating psychotechnics for:', { tema, seccion, num_preguntas, texto_length: texto?.length });

    if (!texto || texto.trim().length < 100) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'El texto debe tener al menos 100 caracteres' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const systemPrompt = `Eres un experto en crear preguntas psicotécnicas de alta calidad para oposiciones. 
Debes generar preguntas que evalúen:
- Razonamiento lógico y verbal
- Capacidad de análisis
- Atención al detalle
- Memoria y comprensión

IMPORTANTE:
- Genera preguntas variadas sobre el texto proporcionado
- Cada pregunta debe tener 4 opciones de respuesta
- Solo una respuesta es correcta
- Las preguntas deben ser claras y no ambiguas
- Evita preguntas triviales o demasiado simples`;

    const userPrompt = `Genera ${num_preguntas} preguntas psicotécnicas basadas en el siguiente texto:

${texto}

Devuelve un array JSON con este formato exacto:
[
  {
    "pregunta": "texto de la pregunta",
    "respuestas": [
      {"texto": "opción 1", "es_correcta": false},
      {"texto": "opción 2", "es_correcta": true},
      {"texto": "opción 3", "es_correcta": false},
      {"texto": "opción 4", "es_correcta": false}
    ],
    "tipo": "razonamiento_verbal",
    "habilidad": "comprension_lectora",
    "dificultad": "media"
  }
]

Tipos válidos: razonamiento_verbal, razonamiento_logico, atencion_detalle, memoria
Habilidades válidas: comprension_lectora, analisis, sintesis, deduccion, observacion
Dificultades válidas: facil, media, dificil`;

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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ ok: false, error: "Límite de solicitudes alcanzado. Por favor, intenta en unos momentos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ ok: false, error: "Créditos insuficientes. Por favor, recarga tu cuenta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;
    
    // Extract JSON from response
    let preguntas;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        preguntas = JSON.parse(jsonMatch[0]);
      } else {
        preguntas = JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('No se pudo procesar la respuesta de la IA');
    }

    if (!Array.isArray(preguntas) || preguntas.length === 0) {
      throw new Error('La IA no generó preguntas válidas');
    }

    // Insert questions into database
    let insertedCount = 0;
    const temaFinal = `PISCO - ${tema}`;

    for (const pregunta of preguntas) {
      const { data: preguntaData, error: preguntaError } = await supabase
        .from('preguntas')
        .insert({
          id_proceso,
          tema: temaFinal,
          seccion,
          pregunta: pregunta.pregunta,
          tipo: pregunta.tipo || 'razonamiento_verbal',
          habilidad: pregunta.habilidad || 'comprension_lectora',
          dificultad: pregunta.dificultad || 'media',
          es_publico: false,
        })
        .select()
        .single();

      if (preguntaError) {
        console.error('Error inserting question:', preguntaError);
        continue;
      }

      // Insert answers
      const respuestasData = pregunta.respuestas.map((r: any) => ({
        id_pregunta: preguntaData.id,
        respuesta: r.texto,
        es_correcta: r.es_correcta,
      }));

      const { error: respuestasError } = await supabase
        .from('respuestas')
        .insert(respuestasData);

      if (!respuestasError) {
        insertedCount++;
      }
    }

    console.log(`Successfully inserted ${insertedCount} questions`);

    return new Response(
      JSON.stringify({
        ok: true,
        preguntas: insertedCount,
        es_publico: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generar-psicotecnicos:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
