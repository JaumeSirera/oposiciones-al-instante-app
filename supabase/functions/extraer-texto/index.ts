import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No se proporcionó ningún archivo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Procesando archivo:', file.name, 'Tipo:', file.type);

    let texto = '';

    if (file.type === 'text/plain') {
      texto = await file.text();
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const pdf = await getDocumentProxy(buffer);
        const { text } = await extractText(pdf, { mergePages: true });
        texto = (Array.isArray(text) ? text.join('\n') : text || '').trim();
      } catch (e) {
        console.error('Error extrayendo PDF con unpdf:', e);
        return new Response(
          JSON.stringify({
            error: 'No se pudo extraer el texto del PDF. Puede ser un PDF escaneado (imagen). Copia y pega el contenido manualmente.',
            texto: ''
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!texto || texto.length < 50) {
        return new Response(
          JSON.stringify({
            error: 'El PDF no contiene texto extraíble (posiblemente escaneado). Copia y pega el contenido manualmente.',
            texto: ''
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      texto = await file.text();
      if (!texto || texto.length < 50) {
        return new Response(
          JSON.stringify({
            error: 'No se pudo extraer texto del documento Word. Por favor, copia y pega el contenido manualmente.',
            texto: ''
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Tipo de archivo no soportado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Texto extraído, longitud:', texto.length);

    return new Response(
      JSON.stringify({
        success: true,
        texto,
        nombre_archivo: file.name,
        tipo_archivo: file.type,
        tamano: file.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error al extraer texto:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al procesar el archivo',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
