import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_MAX_CHARS = 9000;
const FUSION_NOTES_MAX_CHARS = 24000;
const MAX_TOKENS_BRIEF = 700;
const MAX_TOKENS_DEFAULT = 2800;
const MAX_TOKENS_NOTES = 900;
const RESUMEN_MAX_PALABRAS = 2500;

// Determinar idioma de respuesta
const langMap: Record<string, string> = {
  es: 'español',
  en: 'English',
  fr: 'français',
  pt: 'português',
  de: 'Deutsch',
  zh: '中文',
};

// Trocear texto largo
function chunkText(text: string, maxChars: number = CHUNK_MAX_CHARS): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  
  const chunks: string[] = [];
  for (let i = 0; i < trimmed.length; i += maxChars) {
    chunks.push(trimmed.slice(i, i + maxChars));
  }
  return chunks;
}

// Llamada a Lovable AI Gateway
async function callLovableAI(
  apiKey: string,
  messages: { role: string; content: string }[],
  maxTokens: number
): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    throw new Error(`AI Error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Generar resumen breve (bullets)
async function generarResumenBreve(
  apiKey: string,
  texto: string,
  tema: string,
  seccion: string,
  targetLang: string
): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: `Eres un asistente experto. Responde SIEMPRE en ${targetLang}. No inventes datos.`
    },
    {
      role: 'user',
      content: `Elabora un RESUMEN EJECUTIVO en viñetas (6–10 bullets) del siguiente texto. 
- Sé preciso con cifras, fechas, porcentajes, plazos y magnitudes.
- Si un dato no aparece, no lo inventes.
- Usa formato con guiones para las viñetas.

Contexto: Proceso=${seccion} / Tema=${tema}
Texto:
---
${texto.slice(0, CHUNK_MAX_CHARS)}
---`
    }
  ];

  return callLovableAI(apiKey, messages, MAX_TOKENS_BRIEF);
}

// Extraer notas de un trozo
async function extraerNotasTrozo(
  apiKey: string,
  trozo: string,
  targetLang: string
): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: `Eres un asistente experto. Responde SIEMPRE en ${targetLang}. No inventes datos.`
    },
    {
      role: 'user',
      content: `Del siguiente fragmento, extrae NOTAS ESTRUCTURADAS con:
- hechos clave
- cifras/fechas/porcentajes concretos
- definiciones/reglas
- listas y enumeraciones
- conclusiones
Devuelve texto con apartados y títulos claros, sin adornos.

Fragmento:
---
${trozo}
---`
    }
  ];

  return callLovableAI(apiKey, messages, MAX_TOKENS_NOTES);
}

// Fusionar notas en resumen extenso
async function fusionarResumenExtenso(
  apiKey: string,
  notasFusion: string,
  tema: string,
  seccion: string,
  palabrasObjetivo: number,
  targetLang: string
): Promise<string> {
  const palabras = Math.max(400, Math.min(palabrasObjetivo, RESUMEN_MAX_PALABRAS));
  
  const messages = [
    {
      role: 'system',
      content: `Eres un asistente experto en crear resúmenes para estudio. Responde SIEMPRE en ${targetLang}. No inventes datos.`
    },
    {
      role: 'user',
      content: `Proporciona un resumen detallado y completo del tema indicado.

PAUTAS:
- Cobertura EXHAUSTIVA y organizada por apartados.
- Incluye TODAS las cifras, fechas, porcentajes y plazos relevantes.
- Define términos clave cuando aparezcan.
- Evita repeticiones; prioriza claridad y concisión técnica.
- Extensión objetivo: aproximadamente ${palabras} palabras.
- Prohibido inventar datos; si algo no aparece, omítelo.
- Formato: texto con párrafos y subtítulos claros usando Markdown.

Contexto:
- Proceso/Sección: ${seccion}
- Tema: ${tema}

NOTAS AGREGADAS (derivadas del documento original):
---
${notasFusion}
---`
    }
  ];

  return callLovableAI(apiKey, messages, MAX_TOKENS_DEFAULT);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY no configurada');
    return new Response(
      JSON.stringify({ error: 'LOVABLE_API_KEY no configurada' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { contenido, idioma, palabras_objetivo, streaming } = await req.json();

    if (!contenido) {
      return new Response(
        JSON.stringify({ error: 'Falta el contenido a resumir' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetLang = langMap[idioma] || 'español';
    const palabrasObjetivo = palabras_objetivo || 1200;

    console.log('Generando resumen...');
    console.log('Idioma:', targetLang);
    console.log('Longitud contenido:', contenido.length, 'caracteres');
    console.log('Streaming:', streaming);

    // Extraer tema y sección del contenido si está incluido
    let tema = '';
    let seccion = '';
    const temaMatch = contenido.match(/Tema:\s*([^\n|]+)/);
    const procesoMatch = contenido.match(/Proceso:\s*([^\n|]+)/);
    const seccionMatch = contenido.match(/Sección:\s*([^\n]+)/);
    
    if (temaMatch) tema = temaMatch[1].trim();
    if (procesoMatch) seccion = procesoMatch[1].trim();
    if (seccionMatch) seccion += (seccion ? ' - ' : '') + seccionMatch[1].trim();

    // Si es streaming, usar SSE
    if (streaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
            // 1. Generar resumen breve
            sendEvent('progress', { fase: 'breve', mensaje: 'Generando resumen ejecutivo...' });
            const resumenBreve = await generarResumenBreve(
              LOVABLE_API_KEY,
              contenido,
              tema,
              seccion,
              targetLang
            );
            sendEvent('breve', { resumen: resumenBreve });

            // 2. Generar resumen extenso
            sendEvent('progress', { fase: 'extenso', mensaje: 'Procesando contenido...' });
            
            const chunks = chunkText(contenido, CHUNK_MAX_CHARS);
            const notas: string[] = [];
            
            if (chunks.length <= 1) {
              // Texto corto: generar directamente
              sendEvent('progress', { fase: 'extenso', mensaje: 'Generando resumen detallado...' });
              const notasBase = contenido || `SECCIÓN: ${seccion}\nTEMA: ${tema}`;
              notas.push(notasBase);
            } else {
              // Texto largo: procesar por trozos
              for (let i = 0; i < chunks.length; i++) {
                sendEvent('progress', { 
                  fase: 'trozos', 
                  mensaje: `Procesando fragmento ${i + 1} de ${chunks.length}...`,
                  progreso: Math.round(((i + 1) / chunks.length) * 100)
                });
                
                const notasTrozo = await extraerNotasTrozo(LOVABLE_API_KEY, chunks[i], targetLang);
                notas.push(`=== FRAGMENTO ${i + 1} ===\n${notasTrozo}`);
              }
            }

            // Fusionar notas
            sendEvent('progress', { fase: 'fusion', mensaje: 'Fusionando y generando resumen final...' });
            const notasFusion = notas.join('\n\n').slice(0, FUSION_NOTES_MAX_CHARS);
            const resumenExtenso = await fusionarResumenExtenso(
              LOVABLE_API_KEY,
              notasFusion,
              tema,
              seccion,
              palabrasObjetivo,
              targetLang
            );

            // Enviar resultado final
            sendEvent('complete', {
              success: true,
              resumen_breve: resumenBreve,
              resumen: resumenExtenso
            });

          } catch (error) {
            console.error('Error en streaming:', error);
            sendEvent('error', { 
              error: error instanceof Error ? error.message : 'Error desconocido' 
            });
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Sin streaming: proceso normal
    // 1. Generar resumen breve
    const resumenBreve = await generarResumenBreve(
      LOVABLE_API_KEY,
      contenido,
      tema,
      seccion,
      targetLang
    );

    // 2. Generar resumen extenso
    const chunks = chunkText(contenido, CHUNK_MAX_CHARS);
    let resumenExtenso = '';

    if (chunks.length <= 1) {
      // Texto corto o sin texto
      const notasBase = contenido || `SECCIÓN: ${seccion}\nTEMA: ${tema}`;
      resumenExtenso = await fusionarResumenExtenso(
        LOVABLE_API_KEY,
        notasBase,
        tema,
        seccion,
        palabrasObjetivo,
        targetLang
      );
    } else {
      // Texto largo: troceo → notas → fusión
      const notas: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const notasTrozo = await extraerNotasTrozo(LOVABLE_API_KEY, chunks[i], targetLang);
        notas.push(`=== FRAGMENTO ${i + 1} ===\n${notasTrozo}`);
      }
      
      const notasFusion = notas.join('\n\n').slice(0, FUSION_NOTES_MAX_CHARS);
      resumenExtenso = await fusionarResumenExtenso(
        LOVABLE_API_KEY,
        notasFusion,
        tema,
        seccion,
        palabrasObjetivo,
        targetLang
      );
    }

    console.log('Resumen generado exitosamente');

    return new Response(
      JSON.stringify({ 
        success: true, 
        resumen_breve: resumenBreve,
        resumen: resumenExtenso 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en generar-resumen:', error);
    
    if (error instanceof Response) {
      const status = error.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Límite de solicitudes excedido. Por favor, espera un momento.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos agotados. Por favor, añade créditos a tu cuenta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
