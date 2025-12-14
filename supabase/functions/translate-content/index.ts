import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_DIRECT_TRANSLATE = 2500;
const SUMMARIZE_THRESHOLD = 2500;

// Valida que la respuesta no contenga el prompt de la IA
function isValidTranslation(result: string, originalText: string): boolean {
  const promptIndicators = [
    'RULES:',
    '- Translate accurately',
    '- Preserve formatting',
    'Return ONLY the translated',
    'Spanish text to summarize',
    'You are a professional translator',
    'Create a summary of approximately'
  ];
  
  // Si contiene indicadores del prompt, no es válida
  for (const indicator of promptIndicators) {
    if (result.includes(indicator)) {
      return false;
    }
  }
  
  // Si la respuesta es demasiado corta comparada con el original (menos del 20%), sospechosa
  if (result.length < originalText.length * 0.2 && originalText.length > 50) {
    return false;
  }
  
  return true;
}

async function translateOrSummarize(
  text: string, 
  targetLangName: string, 
  apiKey: string, 
  shouldSummarize: boolean
): Promise<string> {
  let prompt: string;
  
  if (shouldSummarize) {
    prompt = `Traduce y resume este texto del español al ${targetLangName}.

Crea un resumen de 500-800 palabras máximo con la información más importante.
Escribe SOLO en ${targetLangName}. No añadas explicaciones ni notas.

Texto:
${text}`;
  } else {
    prompt = `Traduce del español al ${targetLangName}. Devuelve SOLO la traducción:

${text}`;
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: shouldSummarize ? 4000 : 8000,
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim();
  
  if (!result) {
    throw new Error('Empty response from API');
  }
  
  // Validar que no sea el prompt
  if (!isValidTranslation(result, text)) {
    console.warn('Invalid translation detected, contains prompt fragments');
    throw new Error('Invalid translation - contains prompt');
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts, targetLanguage, sourceLanguage = 'es' } = await req.json();

    if (targetLanguage === 'es' || targetLanguage === sourceLanguage) {
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const languageNames: Record<string, string> = {
      'en': 'English',
      'fr': 'French',
      'pt': 'Portuguese',
      'de': 'German',
      'zh': 'Chinese (Simplified)',
      'es': 'Spanish'
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;
    const textsArray = Array.isArray(texts) ? texts : [texts];

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${textsArray.length} texts to ${targetLangName}`);

    const translations: string[] = [];
    let successCount = 0;
    let failCount = 0;

    // Delay base entre peticiones para evitar rate limit (429) - reducido para mejor UX
    const BASE_DELAY_MS = 200; // 200ms entre peticiones (más rápido)

    for (let i = 0; i < textsArray.length; i++) {
      const text = textsArray[i];
      
      if (!text || text.trim() === '') {
        translations.push(text);
        continue;
      }

      // Delay entre peticiones (excepto la primera)
      if (i > 0) {
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));
      }

      const shouldSummarize = text.length > SUMMARIZE_THRESHOLD;
      
      // Intentar hasta 3 veces con backoff exponencial
      let translated = false;
      for (let attempt = 0; attempt < 3 && !translated; attempt++) {
        try {
          if (attempt > 0) {
            // Backoff exponencial: 2s, 4s
            const backoffDelay = Math.pow(2, attempt) * 1000;
            console.log(`Retry ${attempt + 1} after ${backoffDelay}ms delay`);
            await new Promise(r => setTimeout(r, backoffDelay));
          }
          
          const result = await translateOrSummarize(text, targetLangName, LOVABLE_API_KEY, shouldSummarize);
          translations.push(result);
          translated = true;
          successCount++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`Error text ${i} attempt ${attempt + 1}: ${errorMsg}`);
          
          // Si es rate limit (429), esperar más tiempo
          if (errorMsg.includes('429')) {
            await new Promise(r => setTimeout(r, 3000)); // Esperar 3s extra
          }
          
          if (attempt === 2) {
            // Último intento fallido, usar original
            translations.push(text);
            failCount++;
          }
        }
      }
    }

    console.log(`Completed: ${successCount} ok, ${failCount} failed`);

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
