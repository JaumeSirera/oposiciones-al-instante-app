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

interface PlanNutricionalResponse {
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
    pre_entreno: string[];
    post_entreno: string[];
    hidratacion: string[];
    suplementos: string[];
    timing_comidas: string[];
    alimentos_recomendados: string[];
    alimentos_evitar: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tipo_prueba, nivel_fisico, dias_semana, objetivo_nutricional } = await req.json();

    if (!tipo_prueba) {
      return new Response(
        JSON.stringify({ success: false, error: "Falta tipo_prueba" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "API key no configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`Generando plan nutricional para ${tipo_prueba}, nivel ${nivel_fisico}`);

    const prompt = `Eres un nutricionista deportivo experto. Genera un plan nutricional semanal completo adaptado al siguiente perfil:

**Perfil del deportista:**
- Tipo de entrenamiento: ${tipo_prueba}
- Nivel físico: ${nivel_fisico || 'intermedio'}
- Días de entrenamiento por semana: ${dias_semana || 4}
- Objetivo nutricional: ${objetivo_nutricional || 'rendimiento y recuperación'}

**Genera un JSON con esta estructura EXACTA:**

{
  "objetivo": "Descripción breve del objetivo nutricional (máx 100 caracteres)",
  "calorias_objetivo": 2500,
  "proteinas_objetivo": 150,
  "carbos_objetivo": 300,
  "grasas_objetivo": 80,
  "plan_semanal": {
    "lunes": {
      "desayuno": {
        "plato": "Nombre del plato",
        "calorias": 500,
        "proteinas": 30,
        "carbos": 50,
        "grasas": 15,
        "ingredientes": ["ingrediente1", "ingrediente2"]
      },
      "almuerzo": {
        "plato": "Nombre del plato",
        "calorias": 700,
        "proteinas": 45,
        "carbos": 70,
        "grasas": 25,
        "ingredientes": ["ingrediente1", "ingrediente2"]
      },
      "cena": {
        "plato": "Nombre del plato",
        "calorias": 600,
        "proteinas": 40,
        "carbos": 50,
        "grasas": 20,
        "ingredientes": ["ingrediente1", "ingrediente2"]
      },
      "snacks": [
        {
          "plato": "Snack 1",
          "calorias": 200,
          "proteinas": 15,
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
    "pre_entreno": ["Comer 2-3 horas antes", "Carbohidratos complejos + proteína ligera"],
    "post_entreno": ["Proteína dentro de 30 min", "Carbohidratos para reponer glucógeno"],
    "hidratacion": ["2-3L agua diaria", "Bebidas isotónicas en entrenos largos"],
    "suplementos": ["Proteína whey (opcional)", "Creatina 5g/día (opcional)"],
    "timing_comidas": ["5-6 comidas pequeñas", "No saltarse el desayuno"],
    "alimentos_recomendados": ["Pollo", "Pescado", "Arroz integral", "Verduras verdes"],
    "alimentos_evitar": ["Ultraprocesados", "Azúcares refinados", "Alcohol"]
  }
}

**Ajustes según tipo de entrenamiento:**
${getGuidelinesByType(tipo_prueba)}

**IMPORTANTE:**
- Genera los 7 días completos (lunes a domingo)
- Cada día debe tener: desayuno, almuerzo, cena y 1-2 snacks
- Las calorías de cada día deben sumar aproximadamente el objetivo diario
- Varía los platos para cada día (no repetir el mismo plato en la semana)
- Incluye 3-5 ingredientes por plato
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
            content: "Eres un nutricionista deportivo experto. Genera planes nutricionales estructurados en formato JSON. Responde SIEMPRE con JSON válido sin markdown." 
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
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Se requiere añadir créditos a Lovable AI." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
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

    let planData: PlanNutricionalResponse;
    try {
      planData = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parseando JSON:", parseError);
      
      // Intentar extraer JSON válido
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
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
      }

      const jsonStr = content.substring(startIdx, endIdx);
      try {
        planData = JSON.parse(jsonStr);
      } catch (finalError) {
        return new Response(
          JSON.stringify({ success: false, error: "Error procesando la respuesta" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    console.log("Plan nutricional generado correctamente");

    return new Response(
      JSON.stringify({
        success: true,
        plan: planData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en generar-plan-nutricional:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function getGuidelinesByType(tipo: string): string {
  const guidelines: Record<string, string> = {
    "Bombero": `- Alta demanda calórica (2800-3500 kcal/día)
- Enfasis en carbohidratos complejos para resistencia
- Proteína alta (2g/kg) para fuerza funcional
- Comidas que se puedan preparar rápido
- Snacks portátiles para guardias`,
    
    "Policía Nacional": `- Demanda calórica moderada-alta (2500-3000 kcal/día)
- Balance entre fuerza y resistencia
- Proteína 1.8g/kg
- Carbohidratos moderados
- Comidas equilibradas para horarios variables`,
    
    "Policía Local": `- Demanda calórica moderada (2200-2800 kcal/día)
- Enfasis en resistencia cardiovascular
- Proteína 1.6-1.8g/kg
- Carbohidratos moderados
- Hidratación especial en patrullas`,
    
    "Guardia Civil": `- Demanda calórica alta (2600-3200 kcal/día)
- Resistencia + fuerza funcional
- Proteína alta para recuperación
- Carbohidratos para marchas largas
- Preparación de comidas para campo`,
    
    "Militar": `- Demanda calórica muy alta (3000-4000 kcal/día)
- Carbohidratos 55-60% del total
- Proteína 2g/kg
- Comidas densas calóricamente
- Adaptado a raciones de campo`,
    
    "CrossFit": `- Demanda calórica alta (2800-3500 kcal/día)
- Proteína muy alta (2-2.4g/kg)
- Carbohidratos periódicos (pre/post entreno)
- Timing de nutrientes crucial
- Suplementación recomendada`,
    
    "Hyrox": `- Demanda calórica muy alta (3000-3800 kcal/día)
- Carbohidratos 55% (resistencia)
- Proteína 1.8-2g/kg
- Hidratación y electrolitos clave
- Comidas fáciles de digerir pre-competición`,
    
    "Hybrid": `- Demanda variable según fase (2600-3400 kcal/día)
- Periodización nutricional
- Proteína alta constante (2g/kg)
- Carbohidratos ciclados según entreno
- Flexibilidad en macros`,
  };
  
  return guidelines[tipo] || guidelines["CrossFit"];
}
