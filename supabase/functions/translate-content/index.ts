import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_DIRECT_TRANSLATE = 2500; // Traducir directamente si es menor
const SUMMARIZE_THRESHOLD = 2500;  // Resumir si es mayor

async function translateOrSummarize(text: string, targetLangName: string, apiKey: string, shouldSummarize: boolean): Promise<string> {
  let prompt: string;
  
  if (shouldSummarize) {
    prompt = `You are a professional translator and summarizer. 

Take this Spanish text and create a CONCISE SUMMARY in ${targetLangName}.

RULES:
- Create a summary of approximately 500-800 words maximum
- Keep the most important information, key facts, and main concepts
- Use clear, well-structured paragraphs
- Preserve any critical numbers, dates, or technical terms
- Write ONLY in ${targetLangName}, not Spanish
- Do NOT add any explanations or notes, just the summarized translation

Spanish text to summarize and translate:
${text}`;
  } else {
    prompt = `Translate the following text from Spanish to ${targetLangName}.

RULES:
- Translate accurately and completely
- Preserve formatting (headers, lists, etc.)
- Return ONLY the translated text

Text:
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
        { role: 'system', content: shouldSummarize 
          ? 'You summarize and translate long texts into concise, well-organized summaries in the target language.' 
          : 'You are a professional translator.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: shouldSummarize ? 4000 : 8000,
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
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

    for (let i = 0; i < textsArray.length; i++) {
      const text = textsArray[i];
      
      if (!text || text.trim() === '') {
        translations.push(text);
        continue;
      }

      const shouldSummarize = text.length > SUMMARIZE_THRESHOLD;
      
      try {
        console.log(`Text ${i}: ${text.length} chars, ${shouldSummarize ? 'summarizing' : 'translating directly'}`);
        const result = await translateOrSummarize(text, targetLangName, LOVABLE_API_KEY, shouldSummarize);
        translations.push(result);
        console.log(`Text ${i} done: ${result.length} chars`);
      } catch (error) {
        console.error(`Error processing text ${i}:`, error);
        translations.push(text);
      }
    }

    console.log(`Completed ${translations.length} texts`);

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
