import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHUNK_SIZE = 3000; // Máximo de caracteres por chunk para traducción segura

function splitTextIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const para of paragraphs) {
    // Si un solo párrafo es muy largo, dividirlo por oraciones
    if (para.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Dividir párrafo largo por oraciones
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if ((currentChunk + ' ' + sentence).length > maxSize) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
        }
      }
    } else if ((currentChunk + '\n\n' + para).length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function translateChunk(chunk: string, targetLangName: string, apiKey: string): Promise<string> {
  const prompt = `Translate the following text from Spanish to ${targetLangName}.

CRITICAL RULES:
- Translate the COMPLETE text, do NOT summarize or shorten it
- Keep ALL paragraphs, formatting, bullet points, and markdown exactly as in the original
- Preserve all markdown formatting (headers ##, lists *, bold **, etc.)
- Return ONLY the translated text, nothing else
- Do NOT add any explanations, comments, or notes

Text to translate:
${chunk}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a professional translator. Translate accurately and completely. NEVER summarize or shorten. Preserve all formatting.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 8000,
    })
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || chunk;
}

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Translating ${textsArray.length} texts to ${targetLangName}`);

    const translations: string[] = [];

    for (let i = 0; i < textsArray.length; i++) {
      const text = textsArray[i];
      
      // Si el texto está vacío, mantenerlo
      if (!text || text.trim() === '') {
        translations.push(text);
        continue;
      }

      // Para textos cortos, traducir directamente
      if (text.length <= MAX_CHUNK_SIZE) {
        try {
          const translated = await translateChunk(text, targetLangName, LOVABLE_API_KEY);
          translations.push(translated);
          console.log(`Translated text ${i} (${text.length} chars) directly`);
        } catch (error) {
          console.error(`Error translating text ${i}:`, error);
          translations.push(text); // Fallback al original
        }
        continue;
      }

      // Para textos largos, dividir en chunks y traducir cada uno
      console.log(`Text ${i} is long (${text.length} chars), splitting into chunks`);
      const chunks = splitTextIntoChunks(text, MAX_CHUNK_SIZE);
      console.log(`Split into ${chunks.length} chunks`);
      
      const translatedChunks: string[] = [];
      
      for (let j = 0; j < chunks.length; j++) {
        try {
          console.log(`Translating chunk ${j + 1}/${chunks.length} (${chunks[j].length} chars)`);
          const translatedChunk = await translateChunk(chunks[j], targetLangName, LOVABLE_API_KEY);
          translatedChunks.push(translatedChunk);
        } catch (error) {
          console.error(`Error translating chunk ${j}:`, error);
          translatedChunks.push(chunks[j]); // Fallback al original
        }
      }
      
      // Unir los chunks traducidos
      translations.push(translatedChunks.join('\n\n'));
      console.log(`Completed translation of text ${i}`);
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
