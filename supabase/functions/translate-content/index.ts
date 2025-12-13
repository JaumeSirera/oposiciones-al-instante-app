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
    const { texts, targetLanguage, sourceLanguage = 'es' } = await req.json();

    // Si el idioma destino es español, devolver los textos originales
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
    const numberedTexts = textsArray.map((t: string, i: number) => `[${i}] ${t}`).join('\n');

    const prompt = `You are a professional translator. Translate ALL of the following texts from Spanish to ${targetLangName}.

CRITICAL RULES:
- Translate the COMPLETE text, do NOT summarize or shorten it
- Keep ALL paragraphs, sections, bullet points, and formatting exactly as in the original
- Preserve all markdown formatting (headers, lists, bold, etc.)
- Return ONLY the translations with their numbers [0], [1], etc., each on a new line
- Do NOT add any explanations, comments or notes
- Each numbered translation must contain the FULL translated text

Texts to translate:
${numberedTexts}`;

    console.log(`Translating ${textsArray.length} texts to ${targetLangName}`);

    // Use Lovable AI Gateway (no API key needed from user)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a professional translator. Your task is to translate text accurately and completely. NEVER summarize, shorten, or omit any content. Translate every single word and paragraph.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 32000,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded', translations: texts }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required', translations: texts }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content || '';

    // Parsear las traducciones
    const lines = translatedText.split('\n').filter((l: string) => l.trim());
    const translations: string[] = [];

    for (let i = 0; i < textsArray.length; i++) {
      const matchingLine = lines.find((l: string) => l.startsWith(`[${i}]`));
      if (matchingLine) {
        translations.push(matchingLine.replace(`[${i}]`, '').trim());
      } else if (lines[i]) {
        // Fallback: usar la línea por índice
        translations.push(lines[i].replace(/^\[\d+\]\s*/, '').trim());
      } else {
        translations.push(textsArray[i]); // Mantener original si falla
      }
    }

    console.log(`Successfully translated ${translations.length} texts`);

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
