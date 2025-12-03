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

    const systemPrompt = "Eres un profesor experto en oposiciones que explica con claridad cada pregunta y respuesta.";

    // Intentar primero con Google Gemini
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    
    if (GOOGLE_API_KEY) {
      console.log('Intentando con Google Gemini (gemini-1.5-flash)...');
      
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${systemPrompt}\n\n${prompt}`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
              }
            })
          }
        );

        if (geminiResponse.ok) {
          const data = await geminiResponse.json();
          const explicacion = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

          if (explicacion) {
            console.log('Explicación generada con Gemini exitosamente');
            return new Response(
              JSON.stringify({ success: true, explicacion: explicacion.trim() }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const errorText = await geminiResponse.text();
          console.error('Error de Gemini:', geminiResponse.status, errorText);
          
          // Si es error de cuota (429), continuar al fallback
          if (geminiResponse.status !== 429) {
            throw new Error(`Gemini error: ${errorText}`);
          }
          console.log('Cuota de Gemini agotada, usando Lovable AI como fallback...');
        }
      } catch (geminiError) {
        console.error('Error con Gemini:', geminiError);
        console.log('Cambiando a Lovable AI como fallback...');
      }
    }

    // Fallback a Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'No hay API keys configuradas disponibles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usando Lovable AI (gemini-2.5-flash)...');
    
    const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!lovableResponse.ok) {
      const errorText = await lovableResponse.text();
      console.error('Error de Lovable AI:', lovableResponse.status, errorText);
      
      if (lovableResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes excedido. Por favor, espera unos segundos e intenta de nuevo.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Error al generar explicación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableData = await lovableResponse.json();
    const explicacion = lovableData.choices?.[0]?.message?.content || '';

    if (!explicacion) {
      throw new Error('No se recibió explicación de la IA');
    }

    console.log('Explicación generada con Lovable AI exitosamente');

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
