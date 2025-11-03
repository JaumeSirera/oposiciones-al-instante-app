import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { titulo, proceso, temas, fecha_inicio, fecha_fin } = await req.json();

    if (!titulo) {
      return new Response(
        JSON.stringify({ error: "Falta el título" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key no configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Construir contexto
    const contexto = [];
    if (proceso) contexto.push(`Proceso: ${proceso}`);
    if (temas) contexto.push(`Temas: ${temas}`);
    if (fecha_inicio && fecha_fin) {
      const inicio = new Date(fecha_inicio);
      const fin = new Date(fecha_fin);
      const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      contexto.push(`Duración: ${dias} días`);
    }

    const contextoStr = contexto.length > 0 ? `\n\nContexto adicional:\n${contexto.join("\n")}` : "";

    const prompt = `Genera una descripción breve y motivadora (máximo 2-3 líneas) para un plan de estudio de oposiciones con el siguiente título:

"${titulo}"${contextoStr}

La descripción debe:
- Ser clara y concisa (40-60 palabras)
- Destacar los objetivos principales del plan
- Mencionar el enfoque de preparación
- Motivar al estudiante
- Ser profesional pero cercana

Responde SOLO con la descripción, sin comillas ni formato adicional.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error de Lovable AI:", errorText);
      return new Response(
        JSON.stringify({ error: "Error al generar descripción" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const data = await response.json();
    const descripcion = data.choices?.[0]?.message?.content?.trim();

    if (!descripcion) {
      return new Response(
        JSON.stringify({ error: "No se generó descripción" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ descripcion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en generar-descripcion-plan:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
