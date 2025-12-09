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
    const { pregunta, respuestas, correcta, elegida, idioma } = await req.json();

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

    // Determinar idioma de respuesta
    const targetLanguage = idioma && idioma !== 'es' ? idioma : null;
    const languageInstruction = targetLanguage 
      ? `\n\nIMPORTANTE: Responde COMPLETAMENTE en ${getLanguageName(targetLanguage)}. Toda tu explicación debe estar en ${getLanguageName(targetLanguage)}, no en español.`
      : '';

    const prompt = `Eres un profesor experto en oposiciones. Explica de forma didáctica y completa la siguiente pregunta de test.

Tu explicación DEBE incluir:

1. **Identificación de la respuesta correcta**: Indica claramente cuál es la opción correcta.

2. **Explicación detallada**: Explica POR QUÉ esa respuesta es la correcta, dando contexto teórico y ejemplos si es necesario.

3. **Análisis de las otras opciones**: Explica brevemente por qué cada una de las demás opciones NO es correcta.

4. **Retroalimentación al alumno**: Si el alumno acertó, felicítalo. Si se equivocó, corrígelo de forma amable y motívale a seguir estudiando.

Pregunta:
${pregunta}

Opciones:
${textoOpciones}

Respuesta correcta: ${correcta}
Respuesta elegida por el alumno: ${elegida}

Proporciona una explicación completa y educativa, con al menos 150-200 palabras.${languageInstruction}`;

    const systemPrompt = targetLanguage 
      ? `You are an expert professor who explains clearly each question and answer. You MUST respond entirely in ${getLanguageName(targetLanguage)}.`
      : "Eres un profesor experto en oposiciones que explica con claridad cada pregunta y respuesta.";

    // Usar Lovable AI directamente (más estable)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'No hay API keys configuradas disponibles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generando explicación con Lovable AI${targetLanguage ? ` en ${targetLanguage}` : ''}...`);
    
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
        max_tokens: 2048,
        temperature: 0.7,
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

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English',
    'fr': 'French',
    'pt': 'Portuguese',
    'de': 'German',
    'zh': 'Chinese',
  };
  return languages[code] || code;
}
