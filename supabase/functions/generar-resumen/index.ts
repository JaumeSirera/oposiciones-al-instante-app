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
    const { contenido } = await req.json();

    if (!contenido) {
      return new Response(
        JSON.stringify({ error: 'Falta el contenido a resumir' }),
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

    const prompt = `Eres un asistente experto en crear resúmenes para estudio de oposiciones. 
Resume el siguiente contenido de manera clara, estructurada y concisa. 
Organiza la información en secciones con títulos claros.
Destaca los puntos clave y conceptos importantes.
Usa un lenguaje preciso y profesional.

Contenido a resumir:
${contenido}`;

    console.log('Llamando a Google Gemini API para generar resumen...');
    
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
            maxOutputTokens: 4096,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Google API error:', error);
      return new Response(
        JSON.stringify({ error: 'Error al generar resumen con IA', details: error }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const resumen = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!resumen) {
      throw new Error('No se recibió resumen de la IA');
    }

    console.log('Resumen generado exitosamente');

    return new Response(
      JSON.stringify({ success: true, resumen: resumen.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en generar-resumen:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
