import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Respuesta {
  indice: string;
  respuesta: string;
}

interface PreguntaGenerada {
  id: number;
  pregunta: string;
  respuestas: Respuesta[];
  correcta_indice: string;
  explicacion?: string;
  documento?: string | null;
  pagina?: string | null;
  ubicacion?: string | null;
  cita?: string | null;
}

interface GenerarPreguntasParams {
  id_proceso: number;
  seccion?: string;
  tema?: string;
  num_preguntas: number;
  texto?: string;
  documento?: string; // Nombre del documento fuente
}

interface GenerarPreguntasResult {
  success: boolean;
  preguntas?: PreguntaGenerada[];
  error?: string;
}

export function useGenerarPreguntasIA() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const generarPreguntas = async (params: GenerarPreguntasParams): Promise<GenerarPreguntasResult> => {
    setLoading(true);
    setProgress(null);

    try {
      // Dividir en lotes: para textos largos O cuando se piden muchas preguntas
      const textoLargo = params.texto && params.texto.length > 6000;
      const muchasPreguntas = params.num_preguntas > 15;
      const necesitaBatching = textoLargo || muchasPreguntas;
      
      // Máximo 15 preguntas por lote para evitar truncamiento de respuestas
      const numPreguntasPorLote = necesitaBatching ? Math.min(15, params.num_preguntas) : params.num_preguntas;
      const numLotes = necesitaBatching ? Math.ceil(params.num_preguntas / numPreguntasPorLote) : 1;
      
      let todasLasPreguntas: PreguntaGenerada[] = [];
      
      for (let i = 0; i < numLotes; i++) {
        setProgress({ current: i + 1, total: numLotes });
        
        const preguntasRestantes = params.num_preguntas - todasLasPreguntas.length;
        const preguntasEnEsteLote = Math.min(numPreguntasPorLote, preguntasRestantes);
        
        // Fragmento de texto para este lote si es texto largo
        let textoFragmento = params.texto;
        if (textoLargo && params.texto) {
          const fragmentoSize = Math.ceil(params.texto.length / numLotes);
          const start = i * fragmentoSize;
          const end = Math.min(start + fragmentoSize + 500, params.texto.length); // overlap de 500 chars
          textoFragmento = params.texto.substring(start, end);
        }

        const { data, error } = await supabase.functions.invoke('generar-preguntas-ia', {
          body: {
            id_proceso: params.id_proceso,
            seccion: params.seccion,
            tema: params.tema,
            num_preguntas: preguntasEnEsteLote,
            texto: textoFragmento,
            documento: params.documento, // Pasar nombre del documento
          },
        });

        if (error) {
          console.error('Error en lote', i + 1, error);
          // Continuar con el siguiente lote si hay error
          continue;
        }

        if (data?.success && data?.preguntas) {
          todasLasPreguntas = [...todasLasPreguntas, ...data.preguntas];
        }
      }

      if (todasLasPreguntas.length === 0) {
        return { success: false, error: 'No se pudieron generar preguntas' };
      }

      return { success: true, preguntas: todasLasPreguntas };
    } catch (error) {
      console.error('Error generando preguntas:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return { generarPreguntas, loading, progress };
}
