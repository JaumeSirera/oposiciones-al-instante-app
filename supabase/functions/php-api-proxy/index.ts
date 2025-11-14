import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHP_API_URL = 'https://oposiciones-test.com/api/account.php';

serve(async (req) => {
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
    
    if (cleanEndpoint === 'procesos.php' || cleanEndpoint === 'preguntas_auxiliares.php' || cleanEndpoint === 'test_progreso.php' || cleanEndpoint === 'genera_test.php' || cleanEndpoint === 'generar_preguntas.php' || cleanEndpoint === 'comentarios.php' || cleanEndpoint === 'historial_tests.php' || cleanEndpoint === 'estadisticas_usuario.php' || cleanEndpoint === 'ranking_usuarios.php' || cleanEndpoint === 'guardar_tests_realizados.php' || cleanEndpoint === 'listar_resumenes.php' || cleanEndpoint === 'detalle_resumen.php' || cleanEndpoint === 'tecnica_resumen.php' || cleanEndpoint === 'generar_resumen.php' || cleanEndpoint === 'generar_psicotecnicos.php' || cleanEndpoint === 'planes_estudio.php' || cleanEndpoint === 'guardar_plan_ia.php' || cleanEndpoint === 'plan_ia_personal.php' || cleanEndpoint === 'ultimos_procesos.php' || cleanEndpoint === 'proxy_noticias_oposiciones.php' || cleanEndpoint === 'noticias_oposiciones_multifuente.php') {
      // Direct API calls to specific endpoints
      const baseUrl = 'https://oposiciones-test.com/api/';
      
      // Build query params from body.action if present
      const queryParams: string[] = [];
      if (endpointParams) queryParams.push(endpointParams);
      
      // For planes_estudio.php, extract action from body and add to URL
      if (cleanEndpoint === 'planes_estudio.php' && bodyData?.action) {
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
