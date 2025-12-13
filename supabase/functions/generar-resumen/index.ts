import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contenido, idioma } = await req.json();

    if (!contenido) {
      return new Response(
        JSON.stringify({ error: 'Falta el contenido a resumir' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY no configurada');
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar idioma de respuesta
    const langMap: Record<string, string> = {
      es: 'español',
      en: 'English',
      fr: 'français',
      pt: 'português',
      de: 'Deutsch',
      zh: '中文',
    };
    const targetLang = langMap[idioma] || 'español';

    const systemPrompt = `Eres un asistente experto en crear resúmenes para estudio de oposiciones y exámenes oficiales.
Tu tarea es resumir contenido de manera clara, estructurada y concisa.
IMPORTANTE: Responde SIEMPRE en ${targetLang}.

Instrucciones:
- Organiza la información en secciones con títulos claros usando formato Markdown
- Destaca los puntos clave y conceptos importantes
- Usa un lenguaje preciso y profesional
- Incluye listas con viñetas cuando sea apropiado
- Mantén la información esencial sin perder detalles importantes
- No añadas información que no esté en el contenido original`;

    const userPrompt = `Resume el siguiente contenido:

${contenido}`;

    console.log('Llamando a Lovable AI Gateway para generar resumen...');
    console.log('Idioma destino:', targetLang);
    console.log('Longitud del contenido:', contenido.length, 'caracteres');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes excedido. Por favor, espera un momento.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos agotados. Por favor, añade créditos a tu cuenta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Error al generar resumen con IA', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const resumen = data.choices?.[0]?.message?.content || '';

    if (!resumen) {
      console.error('No se recibió resumen de la IA');
      throw new Error('No se recibió resumen de la IA');
    }

    console.log('Resumen generado exitosamente. Longitud:', resumen.length, 'caracteres');

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
