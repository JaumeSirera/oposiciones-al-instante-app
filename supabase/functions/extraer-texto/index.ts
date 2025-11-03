import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Para archivos de texto plano
    if (file.type === 'text/plain') {
      texto = await file.text();
    } 
    // Para PDF (extraer texto simple - nota: esto es básico, para OCR más avanzado se necesitaría una librería especializada)
    else if (file.type === 'application/pdf') {
      // Por ahora, retornamos un mensaje indicando que se recibió el PDF
      // En producción, aquí se usaría una librería como pdf-parse
      texto = await file.text();
      
      // Si no se puede extraer texto directamente, informar al usuario
      if (!texto || texto.length < 50) {
        return new Response(
          JSON.stringify({ 
            error: 'No se pudo extraer texto del PDF. Por favor, copia y pega el contenido manualmente.',
            texto: ''
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // Para Word y otros formatos
    else if (
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      // Para Word, intentamos extraer como texto
      // En producción, se usaría una librería especializada como mammoth
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
        texto: texto,
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
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
