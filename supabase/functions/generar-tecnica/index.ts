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
    const { resumen, tema, seccion, metodo = 'feynman' } = await req.json();
    
    if (!resumen) {
      return new Response(
        JSON.stringify({ error: 'Resumen es requerido' }),
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

    const prompt = buildPrompt(metodo, tema, seccion, resumen);

    console.log('Calling Google Gemini API...');
    
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
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3200,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Google API error:', error);
      return new Response(
        JSON.stringify({ error: 'Error al generar técnica con Gemini', details: error }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('Gemini response received, length:', generatedText.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tecnica: generatedText 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generar-tecnica:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildPrompt(metodo: string, tema: string, seccion: string, resumen: string): string {
  const metodosNormalizados: Record<string, string> = {
    'loci': 'Método de Loci (palacio de la memoria)',
    'feynman': 'Técnica Feynman',
    'mapa': 'Mapa Mental',
    'preguntas': 'Preguntas y Respuestas',
    'spaced': 'Repetición Espaciada',
    'mixto': 'Técnica Mixta'
  };

  const metodoNombre = metodosNormalizados[metodo.toLowerCase()] || 'Feynman';

  return `Eres un coach experto en memorización para opositores hispanohablantes.

Genera una EXPLICACIÓN APLICADA AL RESUMEN usando la técnica: ${metodoNombre}.

Contexto:
- Tema: ${tema || 'General'}
- Sección: ${seccion || 'General'}
- Resumen a memorizar: 
"""
${resumen}
"""

Entrega en español y en formato claro con secciones. Incluye SIEMPRE:

1) **Resumen ultra-claro**: Reescribe el contenido con lenguaje llano y sin adornos.

2) **Cómo aplicar ${metodoNombre}**: Pasos detallados aplicados al contenido, con ejemplos concretos tomados del texto.

3) **Ejemplo práctico**: Crea un ejemplo de la técnica ya construido con el contenido (p. ej., si es Loci, lista de 8-12 ubicaciones y qué fragmento del resumen va en cada una; si es Feynman, la explicación para un niño; si es Mapa, nodos y subnodos; si es Preguntas, 10 tarjetas Q/A).

4) **Tarjetas exprés (Anki)**: 12 tarjetas concisas Q/A derivadas del resumen (sin inventar fechas o cifras que no estén).

5) **Plan de repasos**: Agenda de repetición espaciada para 30 días (días 0, 1, 3, 7, 14, 30) con instrucciones específicas sobre qué revisar en cada hito.

Sé compacto pero útil (2–4 páginas equivalentes). Usa formato markdown con títulos (##) y listas para mejor legibilidad.`;
}
