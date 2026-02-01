import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiaComida {
  desayuno: { plato: string; calorias: number; proteinas: number; carbos: number; grasas: number; ingredientes: string[] };
  almuerzo: { plato: string; calorias: number; proteinas: number; carbos: number; grasas: number; ingredientes: string[] };
  cena: { plato: string; calorias: number; proteinas: number; carbos: number; grasas: number; ingredientes: string[] };
  snacks: { plato: string; calorias: number; proteinas: number; carbos: number; grasas: number; ingredientes: string[] }[];
}

interface PlanNutricionalEstudioResponse {
  objetivo: string;
  calorias_objetivo: number;
  proteinas_objetivo: number;
  carbos_objetivo: number;
  grasas_objetivo: number;
  plan_semanal: {
    lunes: DiaComida;
    martes: DiaComida;
    miercoles: DiaComida;
    jueves: DiaComida;
    viernes: DiaComida;
    sabado: DiaComida;
    domingo: DiaComida;
  };
  recomendaciones: {
    antes_estudiar: string[];
    durante_estudio: string[];
    descansos: string[];
    hidratacion: string[];
    suplementos_cognitivos: string[];
    alimentos_brain_food: string[];
    alimentos_evitar: string[];
    horarios_optimos: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tipo_oposicion, horas_estudio_diarias, objetivo_nutricional } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "API key no configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`Generando plan nutricional para estudio: ${tipo_oposicion}, ${horas_estudio_diarias}h/día`);

    const prompt = `Eres un nutricionista especializado en rendimiento cognitivo y neurociencia de la alimentación. Genera un plan nutricional semanal optimizado para MÁXIMO RENDIMIENTO MENTAL durante el estudio.

**Perfil del opositor:**
- Tipo de oposición: ${tipo_oposicion || 'Oposiciones generales'}
- Horas de estudio diarias: ${horas_estudio_diarias || 6}
- Objetivo: ${objetivo_nutricional || 'Máxima concentración y memoria'}

**Genera un JSON con esta estructura EXACTA:**

{
  "objetivo": "Descripción del objetivo nutricional cognitivo (máx 120 caracteres)",
  "calorias_objetivo": 2200,
  "proteinas_objetivo": 100,
  "carbos_objetivo": 280,
  "grasas_objetivo": 75,
  "plan_semanal": {
    "lunes": {
      "desayuno": {
        "plato": "Nombre del plato para energía mental matutina",
        "calorias": 450,
        "proteinas": 25,
        "carbos": 50,
        "grasas": 18,
        "ingredientes": ["ingrediente1", "ingrediente2", "ingrediente3"]
      },
      "almuerzo": {
        "plato": "Nombre del plato para concentración prolongada",
        "calorias": 650,
        "proteinas": 35,
        "carbos": 70,
        "grasas": 25,
        "ingredientes": ["ingrediente1", "ingrediente2", "ingrediente3"]
      },
      "cena": {
        "plato": "Nombre del plato ligero para buen descanso",
        "calorias": 500,
        "proteinas": 30,
        "carbos": 45,
        "grasas": 20,
        "ingredientes": ["ingrediente1", "ingrediente2"]
      },
      "snacks": [
        {
          "plato": "Snack brain-boost para descanso de estudio",
          "calorias": 180,
          "proteinas": 8,
          "carbos": 20,
          "grasas": 8,
          "ingredientes": ["ingrediente1"]
        }
      ]
    },
    "martes": { ... mismo formato ... },
    "miercoles": { ... },
    "jueves": { ... },
    "viernes": { ... },
    "sabado": { ... },
    "domingo": { ... }
  },
  "recomendaciones": {
    "antes_estudiar": [
      "Desayunar 1-2 horas antes de empezar",
      "Incluir omega-3 y proteínas en el desayuno"
    ],
    "durante_estudio": [
      "Snacks pequeños cada 2-3 horas",
      "Evitar azúcares simples que causan picos"
    ],
    "descansos": [
      "Frutas y frutos secos en pausas de 15 min",
      "Chocolate negro 85% para impulso de dopamina"
    ],
    "hidratacion": [
      "2-2.5L de agua diaria mínimo",
      "Té verde para L-teanina (concentración sin nerviosismo)"
    ],
    "suplementos_cognitivos": [
      "Omega-3 DHA (1-2g/día)",
      "Magnesio (300-400mg) para memoria"
    ],
    "alimentos_brain_food": [
      "Salmón, sardinas (omega-3)",
      "Arándanos (antioxidantes)",
      "Nueces (forma de cerebro, ¡no es coincidencia!)",
      "Huevos (colina para memoria)",
      "Aguacate (grasas saludables)"
    ],
    "alimentos_evitar": [
      "Azúcares refinados (picos de glucosa)",
      "Comidas pesadas (somnolencia)",
      "Exceso de cafeína después de las 14h"
    ],
    "horarios_optimos": [
      "Comida principal ligera si estudias por la tarde",
      "Cena temprana (3h antes de dormir)"
    ]
  }
}

**PRINCIPIOS DE NUTRICIÓN PARA EL CEREBRO:**

1. **GLUCOSA ESTABLE**: Carbohidratos de índice glucémico bajo para energía constante
2. **OMEGA-3 DHA**: Fundamental para la función neuronal y memoria
3. **ANTIOXIDANTES**: Protegen el cerebro del estrés oxidativo
4. **COLINA**: Precursor de acetilcolina (neurotransmisor de la memoria)
5. **MAGNESIO**: Esencial para la plasticidad sináptica
6. **HIERRO**: Transporte de oxígeno al cerebro
7. **VITAMINAS B**: Producción de energía cerebral
8. **TRIPTÓFANO**: Precursor de serotonina (ánimo) → en la cena para buen sueño

**PAUTAS ESPECÍFICAS:**
- Desayuno: Rica en proteínas + grasas saludables + carbohidratos complejos
- Almuerzo: Equilibrado, evitar exceso para no causar somnolencia post-prandial
- Cena: Ligera con triptófano para mejorar calidad del sueño
- Snacks: Frutos secos, frutas, chocolate negro

**IMPORTANTE:**
- Genera los 7 días completos
- Varía los platos (no repetir en la semana)
- Incluye "brain foods" en cada comida
- Snacks pensados para pausas de estudio
- Todas las cantidades en gramos

Responde SOLO con JSON válido, sin markdown ni explicaciones.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "Eres un nutricionista especializado en neurociencia y rendimiento cognitivo. Generas planes nutricionales optimizados para el estudio y la memoria. Responde SIEMPRE con JSON válido sin markdown." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 12000,
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Límite de solicitudes excedido. Intenta de nuevo en unos segundos." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Error al generar el plan nutricional" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: "No se generó contenido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Limpiar y parsear
    content = content.trim();
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    content = content.replace(/\/\*[\s\S]*?\*\//g, "");
    content = content.replace(/\/\/.*/g, "");
    content = content
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');

    let planData: PlanNutricionalEstudioResponse;
    try {
      planData = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      
      const startIdx = content.indexOf('{');
      if (startIdx === -1) {
        return new Response(
          JSON.stringify({ success: false, error: "No se encontró JSON válido" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      let braceCount = 0;
      let endIdx = startIdx;
      let inString = false;
      let escapeNext = false;

      for (let i = startIdx; i < content.length; i++) {
        const char = content[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (char === '"' && !escapeNext) { inString = !inString; continue; }
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0) { endIdx = i + 1; break; }
          }
        }
      }

      try {
        planData = JSON.parse(content.substring(startIdx, endIdx));
      } catch (finalError) {
        return new Response(
          JSON.stringify({ success: false, error: "Error procesando la respuesta" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    console.log("Plan nutricional para estudio generado correctamente");

    return new Response(
      JSON.stringify({
        success: true,
        plan: planData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en generar-plan-nutricional-estudio:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
