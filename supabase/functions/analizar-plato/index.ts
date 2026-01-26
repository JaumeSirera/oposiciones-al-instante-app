import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NutrientInfo {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  sugar: number;
  fat: number;
  saturatedFat: number;
  transFat: number;
  fiber: number;
}

interface AnalysisResult {
  ingredients: NutrientInfo[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    sugar: number;
    fat: number;
    saturatedFat: number;
    transFat: number;
    fiber: number;
  };
  dishName: string;
  healthScore: number;
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { imageBase64, language = 'es' } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Se requiere una imagen' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar idioma para la respuesta
    const langNames: Record<string, string> = {
      es: 'Spanish',
      en: 'English',
      fr: 'French',
      pt: 'Portuguese',
      de: 'German',
    };
    const targetLang = langNames[language] || 'Spanish';

    const systemPrompt = `You are a professional nutritionist AI that analyzes food images. 
Your task is to identify all visible ingredients in the dish and provide detailed nutritional information.

IMPORTANT: Respond in ${targetLang}.

You must return a valid JSON object with this exact structure:
{
  "dishName": "Name of the dish",
  "ingredients": [
    {
      "name": "Ingredient name",
      "quantity": "Estimated quantity (e.g., '100g', '1 cup')",
      "calories": number,
      "protein": number (grams),
      "carbs": number (grams),
      "sugar": number (grams) - this includes sugars, glucose, sucrose, fructose. If no carbs, analyze glucose/sucrose content separately,
      "fat": number (grams) - total fat,
      "saturatedFat": number (grams) - saturated fat content,
      "transFat": number (grams) - trans fat content (partially hydrogenated oils),
      "fiber": number (grams)
    }
  ],
  "totals": {
    "calories": total calories,
    "protein": total protein (g),
    "carbs": total carbs (g),
    "sugar": total sugar (g) - sum of all sugars from ingredients,
    "fat": total fat (g),
    "saturatedFat": total saturated fat (g),
    "transFat": total trans fat (g),
    "fiber": total fiber (g)
  },
  "healthScore": number from 1-10 (10 being healthiest),
  "recommendations": ["Array of 2-3 brief health recommendations based on the dish"]
}

IMPORTANT: 
- For sugar analysis, include all types of sugars (sucrose, glucose, fructose, lactose, maltose). Even if carbs are 0, check for any sugar alcohols or natural sugars present.
- For saturated fat, include fats from animal sources, tropical oils (coconut, palm), and dairy products.
- For trans fat, include naturally occurring trans fats and those from partially hydrogenated oils. If no trans fats are detected, use 0.

Be accurate with nutritional values. If you cannot identify an ingredient clearly, make a reasonable estimate based on visual appearance.
Respond ONLY with the JSON object, no additional text.`;

    console.log('Calling Lovable AI with multimodal request...');

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
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: 'Analyze this food image and provide detailed nutritional information for each ingredient visible in the dish.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes excedido. Por favor, inténtalo de nuevo más tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos agotados. Por favor, añade fondos a tu cuenta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response content from AI');
    }

    console.log('AI response received, parsing JSON...');

    // Limpiar y parsear JSON
    let cleanedContent = content.trim();
    
    // Eliminar bloques de código markdown si existen
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    // Parsear JSON
    const analysisResult: AnalysisResult = JSON.parse(cleanedContent);

    // Validar estructura básica
    if (!analysisResult.ingredients || !Array.isArray(analysisResult.ingredients)) {
      throw new Error('Invalid response structure: missing ingredients array');
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing dish:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido al analizar el plato' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
