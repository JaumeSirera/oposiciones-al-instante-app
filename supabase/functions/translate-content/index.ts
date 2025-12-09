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

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not configured');
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

    // Preparar el prompt para traducir múltiples textos
    const textsArray = Array.isArray(texts) ? texts : [texts];
    const numberedTexts = textsArray.map((t: string, i: number) => `[${i}] ${t}`).join('\n');

    const prompt = `Translate the following texts from Spanish to ${targetLangName}. 
Keep the exact same format and numbering. Only translate, do not add explanations.
Return ONLY the translations with their numbers, one per line.

${numberedTexts}`;

    console.log(`Translating ${textsArray.length} texts to ${targetLangName}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
