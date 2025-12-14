import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BATCH_CHARS = 8000; // Máximo de caracteres por lote para evitar límites de tokens

// Valida que la respuesta no contenga el prompt de la IA
function isValidTranslation(result: string, originalText: string): boolean {
  const promptIndicators = [
    'RULES:',
    '- Translate accurately',
    '- Preserve formatting',
    'Return ONLY the translated',
    'Spanish text to summarize',
    'You are a professional translator',
    'Create a summary of approximately',
    'Translate each line',
    'IMPORTANT:'
  ];
  
  for (const indicator of promptIndicators) {
    if (result.includes(indicator)) {
      return false;
    }
  }
  
  return true;
}

// Traducir un lote de textos en UNA sola llamada a la API
async function translateBatch(
  texts: string[], 
  targetLangName: string, 
  apiKey: string
): Promise<string[]> {
  if (texts.length === 0) return [];
  
  // Usar separador único para dividir las traducciones
  const separator = "|||SPLIT|||";
  const combinedText = texts.join(`\n${separator}\n`);
  
  const prompt = `Translate from Spanish to ${targetLangName}. 
Return ONLY the translations, separated by "${separator}" on its own line.
Do not add explanations or notes. Maintain the same number of items.

${combinedText}`;

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
      max_tokens: 8000,
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
  
  if (!isValidTranslation(result, combinedText)) {
    throw new Error('Invalid translation - contains prompt');
  }
  
  // Dividir el resultado por el separador
  const translations = result.split(separator).map((t: string) => t.trim()).filter((t: string) => t);
  
  // Si el número no coincide, devolver originales
  if (translations.length !== texts.length) {
    console.warn(`Translation count mismatch: expected ${texts.length}, got ${translations.length}`);
    // Intentar recuperar lo que podamos
    const recovered: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      recovered.push(translations[i] || texts[i]);
    }
    return recovered;
  }
  
  return translations;
}

// Dividir textos en lotes por tamaño de caracteres
function splitIntoBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentSize = 0;
  
  for (const text of texts) {
    const textSize = text.length;
    
    if (currentSize + textSize > MAX_BATCH_CHARS && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [text];
      currentSize = textSize;
    } else {
      currentBatch.push(text);
      currentSize += textSize;
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
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

    // Filtrar textos vacíos y mantener índices
    const indexedTexts: { index: number; text: string }[] = [];
    const results: string[] = new Array(textsArray.length);
    
    for (let i = 0; i < textsArray.length; i++) {
      const text = textsArray[i];
      if (!text || text.trim() === '') {
        results[i] = text;
      } else {
        indexedTexts.push({ index: i, text });
      }
    }
    
    if (indexedTexts.length === 0) {
      return new Response(JSON.stringify({ translations: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${indexedTexts.length} texts to ${targetLangName} in batches`);
    
    // Dividir en lotes
    const textValues = indexedTexts.map(t => t.text);
    const batches = splitIntoBatches(textValues);
    
    console.log(`Split into ${batches.length} batches`);
    
    let translatedCount = 0;
    const allTranslations: string[] = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Intentar hasta 2 veces por lote
      let success = false;
      for (let attempt = 0; attempt < 2 && !success; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 1000));
          }
          
          const batchTranslations = await translateBatch(batch, targetLangName, LOVABLE_API_KEY);
          allTranslations.push(...batchTranslations);
          translatedCount += batch.length;
          success = true;
          
          console.log(`Batch ${batchIndex + 1}/${batches.length} completed (${translatedCount}/${textValues.length})`);
        } catch (error) {
          console.error(`Batch ${batchIndex + 1} attempt ${attempt + 1} failed:`, error);
          
          if (attempt === 1) {
            // Último intento fallido, usar originales
            allTranslations.push(...batch);
          }
        }
      }
      
      // Pequeño delay entre lotes para evitar rate limit
      if (batchIndex < batches.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    // Mapear traducciones a sus índices originales
    for (let i = 0; i < indexedTexts.length; i++) {
      results[indexedTexts[i].index] = allTranslations[i] || indexedTexts[i].text;
    }

    console.log(`Translation completed: ${translatedCount}/${textValues.length} texts`);

    return new Response(JSON.stringify({ translations: results }), {
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
