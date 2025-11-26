const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHP_API_URL = 'https://oposiciones-test.com/api/account.php';
const MAX_CHUNK_SIZE = 6000; // Maximum characters per chunk

// Function to split text into chunks
function splitTextIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let currentIndex = 0;
  
  while (currentIndex < text.length) {
    let chunkEnd = currentIndex + maxSize;
    
    // If not the last chunk, try to find a paragraph break
    if (chunkEnd < text.length) {
      const searchStart = Math.max(currentIndex, chunkEnd - 500);
      const segment = text.substring(searchStart, chunkEnd + 500);
      const lastParagraph = segment.lastIndexOf('\n\n');
      
      if (lastParagraph !== -1) {
        chunkEnd = searchStart + lastParagraph;
      } else {
        // If no paragraph break, try to find a sentence break
        const lastPeriod = segment.lastIndexOf('. ');
        if (lastPeriod !== -1) {
          chunkEnd = searchStart + lastPeriod + 1;
        }
      }
    }
    
    chunks.push(text.substring(currentIndex, chunkEnd).trim());
    currentIndex = chunkEnd;
  }
  
  return chunks;
}

// Function to handle generar_psicotecnicos.php with automatic text chunking
async function handleGenerarPsicotecnicos(bodyData: any, corsHeaders: Record<string, string>) {
  try {
    // Extract the actual body data
    const actualBody = bodyData.body || bodyData;
    const texto = actualBody.texto || '';
    const numPreguntas = parseInt(actualBody.num_preguntas || '10');
    const useStreaming = actualBody.use_streaming === true;
    
    console.log('[Psicotécnicos] Text length:', texto.length, 'Streaming:', useStreaming);
    
    // If text is short enough, make direct call
    if (texto.length <= MAX_CHUNK_SIZE) {
      console.log('[Psicotécnicos] Text is short, making direct call');
      
      const googleApiKey = Deno.env.get('GOOGLE_API_KEY') || '';
      console.log('[Psicotécnicos] API Key exists:', !!googleApiKey, 'Length:', googleApiKey.length);
      
      // Remove use_streaming from data sent to PHP
      const { use_streaming, ...cleanBody } = actualBody;
      
      const response = await fetch('https://oposiciones-test.com/api/generar_psicotecnicos.php', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Google-API-Key': googleApiKey
        },
        body: JSON.stringify(cleanBody),
      });
      
      const result = await response.text();
      console.log('[Psicotécnicos] Direct call response status:', response.status);
      console.log('[Psicotécnicos] Direct call response preview:', result.substring(0, 200));
      
      return new Response(result, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Split text into chunks
    console.log('[Psicotécnicos] Text is long, splitting into chunks');
    const chunks = splitTextIntoChunks(texto, MAX_CHUNK_SIZE);
    console.log(`[Psicotécnicos] Split into ${chunks.length} chunks`);
    
    // If streaming is requested, use SSE
    if (useStreaming) {
      return handleStreamingResponsePsicotecnicos(actualBody, chunks, numPreguntas, corsHeaders);
    }
    
    // Calculate questions per chunk
    const questionsPerChunk = Math.ceil(numPreguntas / chunks.length);
    
    // Process each chunk
    const allResults = [];
    let totalGenerated = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const remainingQuestions = numPreguntas - totalGenerated;
      const questionsForThisChunk = Math.min(questionsPerChunk, remainingQuestions);
      
      if (questionsForThisChunk <= 0) break;
      
      console.log(`[Psicotécnicos] Processing chunk ${i + 1}/${chunks.length}, generating ${questionsForThisChunk} questions`);
      
      const googleApiKey = Deno.env.get('GOOGLE_API_KEY') || '';
      console.log('[Psicotécnicos] Chunk API Key exists:', !!googleApiKey);
      
      // Remove use_streaming before sending to PHP
      const { use_streaming, ...cleanBody } = actualBody;
      
      const chunkData = {
        ...cleanBody,
        texto: chunk,
        num_preguntas: questionsForThisChunk.toString(),
      };
      
      const response = await fetch('https://oposiciones-test.com/api/generar_psicotecnicos.php', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Google-API-Key': googleApiKey
        },
        body: JSON.stringify(chunkData),
      });
      
      const resultText = await response.text();
      
      try {
        const result = JSON.parse(resultText);
        console.log(`[Psicotécnicos] Chunk ${i + 1}/${chunks.length}:`, {
          ok: result.ok,
          preguntas: result.preguntas || 0,
          error: result.error || null,
          tiene_fragmentos: result.texto_dividido || false
        });
        
        // Check for success - API might return 'ok' or just have 'preguntas' field
        const isSuccess = result.ok === true || result.preguntas !== undefined;
        const generatedCount = result.preguntas || 0;
        
        if (isSuccess && generatedCount > 0) {
          totalGenerated += generatedCount;
          allResults.push(result);
          console.log(`[Psicotécnicos] Chunk ${i + 1} succeeded: ${generatedCount} questions, total: ${totalGenerated}`);
        } else {
          const errorMsg = result.msg || result.error || 'Error desconocido';
          console.error(`[Psicotécnicos] Chunk ${i + 1} failed:`, errorMsg, 'Full result:', result);
          
          // Si todos los chunks fallan por error de Gemini, devolver error específico
          if (result.msg && result.msg.includes('Gemini')) {
            return new Response(
              JSON.stringify({ 
                ok: false, 
                error: `Error en el fragmento ${i + 1}: ${errorMsg}. Por favor, intenta con un texto diferente o más corto.` 
              }),
              { 
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
      } catch (e) {
        console.error(`[Psicotécnicos] Failed to parse chunk ${i + 1} response:`, e);
      }
    }
    
    // Combine results
    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'No se pudieron generar preguntas psicotécnicas de ningún fragmento' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const combinedResult = {
      ok: true,
      preguntas: totalGenerated,
      chunks_procesados: allResults.length,
      total_chunks: chunks.length,
      es_publico: allResults[0].es_publico,
    };
    
    console.log('[Psicotécnicos] Final result:', combinedResult);
    
    return new Response(JSON.stringify(combinedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Psicotécnicos] Error in handleGenerarPsicotecnicos:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Function to handle streaming response for psicotécnicos with progress updates
async function handleStreamingResponsePsicotecnicos(
  bodyData: any,
  chunks: string[],
  numPreguntas: number,
  corsHeaders: Record<string, string>
) {
  const encoder = new TextEncoder();
  const questionsPerChunk = Math.ceil(numPreguntas / chunks.length);
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial progress
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            current: 0,
            total: chunks.length,
            message: 'Iniciando procesamiento...'
          })}\n\n`)
        );
        
        const allResults = [];
        let totalGenerated = 0;
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const remainingQuestions = numPreguntas - totalGenerated;
          const questionsForThisChunk = Math.min(questionsPerChunk, remainingQuestions);
          
          if (questionsForThisChunk <= 0) break;
          
          // Send progress update
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              current: i,
              total: chunks.length,
              message: `Procesando fragmento ${i + 1} de ${chunks.length}...`
            })}\n\n`)
          );
          
          // Remove use_streaming before sending to PHP
          const { use_streaming, ...cleanBodyData } = bodyData;
          
          const chunkData = {
            ...cleanBodyData,
            texto: chunk,
            num_preguntas: questionsForThisChunk.toString(),
          };
          
          try {
            const response = await fetch('https://oposiciones-test.com/api/generar_psicotecnicos.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(chunkData),
            });
            
            const resultText = await response.text();
            console.log(`[Psicotécnicos] Chunk ${i + 1} raw response:`, resultText);
            const result = JSON.parse(resultText);
            console.log(`[Psicotécnicos] Chunk ${i + 1} parsed result:`, JSON.stringify(result));
            
            // Check for success - API might return 'ok' or just have 'preguntas' field
            const isSuccess = result.ok === true || result.preguntas !== undefined;
            const generatedCount = result.preguntas || 0;
            
            if (isSuccess && generatedCount > 0) {
              totalGenerated += generatedCount;
              allResults.push(result);
              console.log(`[Psicotécnicos] Chunk ${i + 1} succeeded: ${generatedCount} questions, total: ${totalGenerated}`);
              
              // Send chunk complete update
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk_complete',
                  current: i + 1,
                  total: chunks.length,
                  generated: generatedCount,
                  totalGenerated: totalGenerated
                })}\n\n`)
              );
            } else {
              const errorMsg = result.msg || result.error || 'Error desconocido';
              console.error(`[Psicotécnicos] Chunk ${i + 1} failed:`, errorMsg, 'Full result:', result);
              
              // Si es un error de Gemini, enviar el error específico
              if (result.msg && result.msg.includes('Gemini')) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    error: `Error en el fragmento ${i + 1}: ${errorMsg}. Por favor, intenta con un texto diferente o más corto.`
                  })}\n\n`)
                );
                controller.close();
                return;
              }
            }
          } catch (e) {
            console.error(`[Psicotécnicos] Failed to process chunk ${i + 1}:`, e);
          }
        }
        
        // Send final result
        if (allResults.length === 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'No se pudieron generar preguntas psicotécnicas de ningún fragmento'
            })}\n\n`)
          );
        } else {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              ok: true,
              generadas: totalGenerated,
              chunks_procesados: allResults.length,
              total_chunks: chunks.length,
              es_publico: allResults[0].es_publico
            })}\n\n`)
          );
        }
        
        controller.close();
      } catch (error) {
        console.error('[Psicotécnicos] Streaming error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Error desconocido'
          })}\n\n`)
        );
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

// Function to handle generar_preguntas.php with automatic text chunking
async function handleGenerarPreguntas(bodyData: any, corsHeaders: Record<string, string>) {
  try {
    // Extract the actual body data (bodyData has { endpoint, method, body: {...} })
    const actualBody = bodyData.body || bodyData;
    const texto = actualBody.texto || '';
    const numPreguntas = parseInt(actualBody.num_preguntas || '10');
    const useStreaming = actualBody.use_streaming === true;
    
    console.log('Text length:', texto.length, 'Streaming:', useStreaming);
    
    // If text is short enough, make direct call
    if (texto.length <= MAX_CHUNK_SIZE) {
      console.log('Text is short, making direct call');
      
      // Remove use_streaming from data sent to PHP
      const { use_streaming, ...cleanBody } = actualBody;
      
      const response = await fetch('https://oposiciones-test.com/api/generar_preguntas.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanBody),
      });
      
      const result = await response.text();
      return new Response(result, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Split text into chunks
    console.log('Text is long, splitting into chunks');
    const chunks = splitTextIntoChunks(texto, MAX_CHUNK_SIZE);
    console.log(`Split into ${chunks.length} chunks`);
    
    // If streaming is requested, use SSE
    if (useStreaming) {
      return handleStreamingResponse(actualBody, chunks, numPreguntas, corsHeaders);
    }
    
    // Calculate questions per chunk
    const questionsPerChunk = Math.ceil(numPreguntas / chunks.length);
    
    // Process each chunk
    const allResults = [];
    let totalGenerated = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const remainingQuestions = numPreguntas - totalGenerated;
      const questionsForThisChunk = Math.min(questionsPerChunk, remainingQuestions);
      
      if (questionsForThisChunk <= 0) break;
      
      console.log(`Processing chunk ${i + 1}/${chunks.length}, generating ${questionsForThisChunk} questions`);
      
      // Remove use_streaming before sending to PHP
      const { use_streaming, ...cleanBody } = actualBody;
      
      const chunkData = {
        ...cleanBody,
        texto: chunk,
        num_preguntas: questionsForThisChunk.toString(),
      };
      
      const response = await fetch('https://oposiciones-test.com/api/generar_preguntas.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkData),
      });
      
      const resultText = await response.text();
      console.log(`Chunk ${i + 1} raw response:`, resultText);
      
      try {
        const result = JSON.parse(resultText);
        console.log(`Chunk ${i + 1} parsed result:`, JSON.stringify(result));
        
        // Check for success - API might return 'ok' or just have 'generadas' field
        const isSuccess = result.ok === true || result.generadas !== undefined;
        const generatedCount = result.generadas || 0;
        
        if (isSuccess && generatedCount > 0) {
          totalGenerated += generatedCount;
          allResults.push(result);
          console.log(`Chunk ${i + 1} succeeded: ${generatedCount} questions, total: ${totalGenerated}`);
        } else {
          const errorMsg = result.msg || result.error || 'Error desconocido';
          console.error(`Chunk ${i + 1} failed:`, errorMsg, 'Full result:', result);
          
          // Si todos los chunks fallan por error de Gemini, devolver error específico
          if (result.msg && result.msg.includes('Gemini')) {
            return new Response(
              JSON.stringify({ 
                ok: false, 
                error: `Error en el fragmento ${i + 1}: ${errorMsg}. Por favor, intenta con un texto diferente o más corto.` 
              }),
              { 
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        }
      } catch (e) {
        console.error(`Failed to parse chunk ${i + 1} response:`, e);
      }
    }
    
    // Combine results
    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'No se pudieron generar preguntas de ningún fragmento' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const combinedResult = {
      ok: true,
      generadas: totalGenerated,
      chunks_procesados: allResults.length,
      total_chunks: chunks.length,
      es_publico: allResults[0].es_publico,
    };
    
    console.log('Final result:', combinedResult);
    
    return new Response(JSON.stringify(combinedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in handleGenerarPreguntas:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Function to handle streaming response with progress updates
async function handleStreamingResponse(
  bodyData: any,
  chunks: string[],
  numPreguntas: number,
  corsHeaders: Record<string, string>
) {
  const encoder = new TextEncoder();
  const questionsPerChunk = Math.ceil(numPreguntas / chunks.length);
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial progress
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            current: 0,
            total: chunks.length,
            message: 'Iniciando procesamiento...'
          })}\n\n`)
        );
        
        const allResults = [];
        let totalGenerated = 0;
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const remainingQuestions = numPreguntas - totalGenerated;
          const questionsForThisChunk = Math.min(questionsPerChunk, remainingQuestions);
          
          if (questionsForThisChunk <= 0) break;
          
          // Send progress update
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              current: i,
              total: chunks.length,
              message: `Procesando fragmento ${i + 1} de ${chunks.length}...`
            })}\n\n`)
          );
          
          // Remove use_streaming before sending to PHP
          const { use_streaming, ...cleanBodyData } = bodyData;
          
          const chunkData = {
            ...cleanBodyData,
            texto: chunk,
            num_preguntas: questionsForThisChunk.toString(),
          };
          
          try {
            const response = await fetch('https://oposiciones-test.com/api/generar_preguntas.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(chunkData),
            });
            
            const resultText = await response.text();
            console.log(`Chunk ${i + 1} raw response:`, resultText);
            const result = JSON.parse(resultText);
            console.log(`Chunk ${i + 1} parsed result:`, JSON.stringify(result));
            
            // Check for success - API might return 'ok' or just have 'generadas' field
            const isSuccess = result.ok === true || result.generadas !== undefined;
            const generatedCount = result.generadas || 0;
            
            if (isSuccess && generatedCount > 0) {
              totalGenerated += generatedCount;
              allResults.push(result);
              console.log(`Chunk ${i + 1} succeeded: ${generatedCount} questions, total: ${totalGenerated}`);
              
              // Send chunk complete update
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk_complete',
                  current: i + 1,
                  total: chunks.length,
                  generated: generatedCount,
                  totalGenerated: totalGenerated
                })}\n\n`)
              );
            } else {
              const errorMsg = result.msg || result.error || 'Error desconocido';
              console.error(`Chunk ${i + 1} failed:`, errorMsg, 'Full result:', result);
              
              // Si es un error de Gemini, enviar el error específico
              if (result.msg && result.msg.includes('Gemini')) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    error: `Error en el fragmento ${i + 1}: ${errorMsg}. Por favor, intenta con un texto diferente o más corto.`
                  })}\n\n`)
                );
                controller.close();
                return;
              }
            }
          } catch (e) {
            console.error(`Failed to process chunk ${i + 1}:`, e);
          }
        }
        
        // Send final result
        if (allResults.length === 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'No se pudieron generar preguntas de ningún fragmento'
            })}\n\n`)
          );
        } else {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              ok: true,
              generadas: totalGenerated,
              chunks_procesados: allResults.length,
              total_chunks: chunks.length,
              es_publico: allResults[0].es_publico
            })}\n\n`)
          );
        }
        
        controller.close();
      } catch (error) {
        console.error('Streaming error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Error desconocido'
          })}\n\n`)
        );
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Proxying request to PHP API:', req.method);
    
    // Parse the request body
    let bodyData: any = null;
    let action = '';
    let endpoint = '';
    
    if (req.method !== 'GET') {
      const bodyText = await req.text();
      console.log('Raw body:', bodyText);
      
      try {
        bodyData = JSON.parse(bodyText);
        console.log('Parsed body:', bodyData);
        action = bodyData.action || '';
        endpoint = bodyData.endpoint || '';
      } catch (e) {
        console.error('Error parsing body:', e);
        bodyData = bodyText;
      }
    }
    
    // Get query parameters from the original request (fallback if not in body)
    const url = new URL(req.url);
    if (!endpoint) {
      endpoint = url.searchParams.get('endpoint') || '';
    }
    
    // Build the target URL based on endpoint
    let targetUrl: string;
    let finalBody: string | null = null;
    
    // Extract endpoint without query params
    const endpointParts = endpoint.split('?');
    const cleanEndpoint = endpointParts[0];
    const endpointParams = endpointParts[1] || '';
    
    // Handle generar_preguntas.php with text chunking
    if (cleanEndpoint === 'generar_preguntas.php') {
      return await handleGenerarPreguntas(bodyData, corsHeaders);
    }
    
    // Handle generar_psicotecnicos.php with text chunking
    if (cleanEndpoint === 'generar_psicotecnicos.php') {
      return await handleGenerarPsicotecnicos(bodyData, corsHeaders);
    }
    
    if (cleanEndpoint === 'procesos.php' || cleanEndpoint === 'crear_proceso.php' || cleanEndpoint === 'procesos_por_rol.php' || cleanEndpoint === 'procesos_usuario.php' || cleanEndpoint === 'preguntas_auxiliares.php' || cleanEndpoint === 'test_progreso.php' || cleanEndpoint === 'genera_test.php' || cleanEndpoint === 'comentarios.php' || cleanEndpoint === 'historial_tests.php' || cleanEndpoint === 'estadisticas_usuario.php' || cleanEndpoint === 'ranking_usuarios.php' || cleanEndpoint === 'guardar_tests_realizados.php' || cleanEndpoint === 'listar_resumenes.php' || cleanEndpoint === 'detalle_resumen.php' || cleanEndpoint === 'tecnica_resumen.php' || cleanEndpoint === 'generar_resumen.php' || cleanEndpoint === 'planes_estudio.php' || cleanEndpoint === 'guardar_plan_ia.php' || cleanEndpoint === 'plan_ia_personal.php' || cleanEndpoint === 'ultimos_procesos.php' || cleanEndpoint === 'proxy_noticias_oposiciones.php' || cleanEndpoint === 'noticias_oposiciones_multifuente.php' || cleanEndpoint === 'planes_fisicos.php' || cleanEndpoint === 'recordatorios_plan.php' || cleanEndpoint === 'obtener_plan_json.php') {
      // Direct API calls to specific endpoints
      const baseUrl = 'https://oposiciones-test.com/api/';
      
      // Build query params from body.action if present
      const queryParams: string[] = [];
      if (endpointParams) queryParams.push(endpointParams);
      
      // For planes_estudio.php, planes_fisicos.php or recordatorios_plan.php, extract action from body and add to URL
      if ((cleanEndpoint === 'planes_estudio.php' || cleanEndpoint === 'planes_fisicos.php' || cleanEndpoint === 'recordatorios_plan.php') && bodyData?.action) {
        queryParams.push(`action=${bodyData.action}`);
      }
      
      // Filter out 'endpoint' parameter from remaining params to avoid duplication
      const filteredParams = new URLSearchParams();
      url.searchParams.forEach((value, key) => {
        if (key !== 'endpoint') {
          filteredParams.append(key, value);
        }
      });
      
      const remainingParams = filteredParams.toString();
      if (remainingParams) queryParams.push(remainingParams);
      
      targetUrl = queryParams.length > 0
        ? `${baseUrl}${cleanEndpoint}?${queryParams.join('&')}`
        : `${baseUrl}${cleanEndpoint}`;
      
      // Remove the 'endpoint', 'action', and 'method' fields from bodyData before sending to PHP API
      if (bodyData && typeof bodyData === 'object') {
        const { endpoint: _, method: __, action: ___, body: bodyContent, ...cleanBody } = bodyData;
        // If there's a 'body' field, use its content directly
        const finalData = bodyContent || cleanBody;
        finalBody = Object.keys(finalData).length > 0 ? JSON.stringify(finalData) : null;
      } else {
        finalBody = bodyData ? JSON.stringify(bodyData) : null;
      }
    } else {
      // Default to account.php for auth operations
      targetUrl = action 
        ? `${PHP_API_URL}?action=${action}`
        : PHP_API_URL;
      finalBody = bodyData ? JSON.stringify(bodyData) : null;
    }
    
    console.log('Target URL:', targetUrl);
    console.log('Final body to send:', finalBody);

    // Forward the request to the PHP API
    // For GET requests that come with method:"GET" in body, use actual GET
    let requestMethod = req.method;
    if (bodyData?.method === 'GET') {
      requestMethod = 'GET';
    }
    
    // Get Authorization header from incoming request
    const authHeader = req.headers.get('authorization') || '';
    
    const response = await fetch(targetUrl, {
      method: requestMethod,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      body: requestMethod === 'GET' ? null : finalBody,
    });

    const data = await response.text();
    console.log('PHP API response status:', response.status);
    console.log('PHP API response:', data);

    // Si el servidor PHP devuelve un error, convertir a JSON válido
    if (!response.ok) {
      console.error('PHP API error:', response.status, data);
      
      // Intentar parsear la respuesta como JSON
      let errorData;
      try {
        errorData = JSON.parse(data);
      } catch {
        // Si no es JSON válido, crear un objeto de error
        errorData = {
          success: false,
          error: 'Error del servidor',
          details: data.substring(0, 200), // Primeros 200 caracteres del error
          status: response.status
        };
      }
      
      return new Response(JSON.stringify(errorData), {
        status: 200, // Devolver 200 para que el cliente pueda procesar el error
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in php-api-proxy:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error de conexión con el servidor',
        details: error.message 
      }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
