import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pregunta, respuestas, correcta, elegida } = await req.json();

    if (!pregunta || !respuestas || !correcta || !elegida) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_API_KEY no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir texto de opciones
    const textoOpciones = respuestas
      .map((r: any) => `${r.indice}) ${r.respuesta}`)
      .join('\n');

    const prompt = `Eres un profesor experto en oposiciones. Explica de forma didáctica y sencilla la siguiente pregunta de test, especificando:

- Cuál es la respuesta correcta y por qué.
- Por qué las demás opciones no son correctas.
- Si el alumno se ha equivocado, corrígelo de forma amable y motívale.

Pregunta:
${pregunta}

Opciones:
${textoOpciones}

Respuesta correcta: ${correcta}
Respuesta elegida por el alumno: ${elegida}

Explica de forma breve y clara, con lenguaje sencillo.`;

    console.log('Llamando a Google Gemini API...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Eres un profesor experto en oposiciones que explica con claridad cada pregunta y respuesta.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Google API error:', error);
      return new Response(
        JSON.stringify({ error: 'Error al generar explicación con Gemini', details: error }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const explicacion = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!explicacion) {
      throw new Error('No se recibió explicación de la IA');
    }

    console.log('Explicación generada exitosamente');

    return new Response(
      JSON.stringify({ success: true, explicacion: explicacion.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en profesor-virtual:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
