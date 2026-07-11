import { supabase } from '@/lib/supabaseClient';

const PROXY_FUNCTION = 'php-api-proxy';

interface Proceso {
  id: number;
  descripcion: string;
  estado?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}

interface SeccionesTemasResponse {
  success: boolean;
  secciones?: string[];
  temas?: string[];
  error?: string;
}

interface Respuesta {
  indice: string;
  respuesta: string;
}

interface Pregunta {
  id: number;
  pregunta: string;
  respuestas: Respuesta[];
  correcta_indice: string;
  // Campos de trazabilidad de fuente (opcionales)
  documento?: string;
  pagina?: string;
  ubicacion?: string;
  cita?: string;
}

interface ProgresoData {
  actual: number;
  respuestas: string;
  tiempo_restante: number;
  preguntas: string;
}

interface ProgresoResponse {
  ok: boolean;
  data?: ProgresoData;
  error?: string;
}

class TestService {
  private async callAPI(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
        body: {
          endpoint,
          method: options.method || 'GET',
          ...(options.body ? JSON.parse(options.body as string) : {}),
        },
        headers,
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Error de conexión con el servidor');
      }

      // Si la respuesta es un string que parece un error HTML, lanzar error
      if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
        throw new Error('Error del servidor. Por favor, verifica que el endpoint PHP esté funcionando correctamente.');
      }

      return data;
    } catch (error) {
      console.error('Error in callAPI:', error);
      throw error;
    }
  }

  async getProcesos(id_usuario?: number): Promise<Proceso[]> {
    try {
      const endpoint = id_usuario 
        ? `procesos_usuario.php?id_usuario=${id_usuario}`
        : 'procesos.php';
      const data = await this.callAPI(endpoint);
      
      // Asegurar que siempre devolvemos un array
      if (!data) return [];
      if (Array.isArray(data)) return data;
      
      // Si data tiene una propiedad que es un array, devolverla
      if (data.procesos && Array.isArray(data.procesos)) return data.procesos;
      if (data.data && Array.isArray(data.data)) return data.data;
      
      console.warn('Formato inesperado de respuesta:', data);
      return [];
    } catch (error) {
      console.error('Error al obtener procesos:', error);
      return []; // Devolver array vacío en lugar de lanzar error
    }
  }

  async getAllProcesosComunidad(): Promise<Proceso[]> {
    try {
      const data = await this.callAPI('procesos.php');
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (data.procesos && Array.isArray(data.procesos)) return data.procesos;
      if (data.data && Array.isArray(data.data)) return data.data;
      console.warn('Formato inesperado de respuesta:', data);
      return [];
    } catch (error) {
      console.error('Error al obtener procesos de comunidad:', error);
      return [];
    }
  }

  async getSeccionesYTemas(id_proceso: number): Promise<SeccionesTemasResponse> {
    try {
      const data = await this.callAPI(`preguntas_auxiliares.php?id_proceso=${id_proceso}`);
      return data;
    } catch (error) {
      console.error('Error al obtener secciones y temas:', error);
      throw error;
    }
  }

  async getTemasPorSeccion(id_proceso: number, seccion: string): Promise<string[]> {
    try {
      const data = await this.callAPI(
        `preguntas_auxiliares.php?id_proceso=${id_proceso}&seccion=${encodeURIComponent(seccion)}`
      );
      return data.success && Array.isArray(data.temas) ? data.temas : [];
    } catch (error) {
      console.error('Error al obtener temas por sección:', error);
      throw error;
    }
  }

  async getPreguntas(params: {
    id_proceso: number;
    secciones: string[];
    temas: string[];
    numPreguntas: number;
    dificultad?: string;
    tipo?: string;
    habilidad?: string;
  }): Promise<Pregunta[]> {
    try {
      const queryParams = new URLSearchParams({
        proceso_id: params.id_proceso.toString(),
        secciones: params.secciones.join(','),
        temas: params.temas.join(','),
        numPreguntas: params.numPreguntas.toString(),
      });

      if (params.dificultad) {
        queryParams.append('dificultad', params.dificultad);
      }
      if (params.tipo) {
        queryParams.append('tipo', params.tipo);
      }
      if (params.habilidad) {
        queryParams.append('habilidad', params.habilidad);
      }

      console.log('🔗 Llamando a genera_test.php con:', queryParams.toString());
      const data = await this.callAPI(`genera_test.php?${queryParams.toString()}`);
      console.log('✅ Preguntas recibidas:', data?.length || 0);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Error al obtener preguntas:', error);
      throw error;
    }
  }

  async guardarProgreso(data: {
    user_id: number;
    test_key: string;
    actual: number;
    respuestas: any[];
    tiempo_restante: number;
    preguntas: any[];
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      console.log('📝 Guardando progreso:', { user_id: data.user_id, test_key: data.test_key, actual: data.actual });
      
      const result = await this.callAPI('test_progreso.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'guardar',
          user_id: data.user_id,
          test_key: data.test_key,
          actual: data.actual,
          respuestas: data.respuestas,
          tiempo_restante: data.tiempo_restante,
          preguntas: data.preguntas,
        }),
      });
      
      console.log('✅ Progreso guardado:', result);
      return result;
    } catch (error) {
      console.error('❌ Error al guardar progreso:', error);
      return { ok: false, error: 'Error de conexión' };
    }
  }

  async recuperarProgreso(user_id: number, test_key: string): Promise<ProgresoResponse> {
    try {
      console.log('🔍 Recuperando progreso:', { user_id, test_key });
      
      const result = await this.callAPI('test_progreso.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'recuperar',
          user_id,
          test_key,
        }),
      });
      
      console.log('✅ Progreso recuperado:', result);
      return result;
    } catch (error) {
      console.error('❌ Error al recuperar progreso:', error);
      return { ok: false, error: 'Error de conexión' };
    }
  }

  async eliminarProgreso(user_id: number, test_key: string): Promise<{ ok: boolean }> {
    try {
      console.log('🗑️ Eliminando progreso:', { user_id, test_key });
      
      const result = await this.callAPI('test_progreso.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'eliminar',
          user_id,
          test_key,
        }),
      });
      
      console.log('✅ Progreso eliminado:', result);
      return result;
    } catch (error) {
      console.error('❌ Error al eliminar progreso:', error);
      return { ok: false };
    }
  }

  async getComentarios(id_pregunta: number): Promise<any[]> {
    try {
      const data = await this.callAPI(`comentarios.php?id_pregunta=${id_pregunta}`);
      return data.comentarios || [];
    } catch (error) {
      console.error('Error al obtener comentarios:', error);
      return [];
    }
  }

  async addComentario(data: {
    id_proceso: number;
    id_usuario: number;
    id_pregunta: number;
    tipo: string;
    comentario: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.callAPI('comentarios.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'add', ...data }),
      });
    } catch (error) {
      console.error('Error al añadir comentario:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  async updateComentario(id: number, comentario: string, rol: string): Promise<{ success: boolean }> {
    try {
      return await this.callAPI('comentarios.php', {
        method: 'PUT',
        body: JSON.stringify({ id, comentario, rol }),
      });
    } catch (error) {
      console.error('Error al actualizar comentario:', error);
      return { success: false };
    }
  }

  async deleteComentario(id: number, rol: string): Promise<{ success: boolean }> {
    try {
      return await this.callAPI('comentarios.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id, rol }),
      });
    } catch (error) {
      console.error('Error al eliminar comentario:', error);
      return { success: false };
    }
  }

  async getProfesorExplicacion(data: {
    pregunta: string;
    respuestas: Respuesta[];
    correcta: string;
    elegida: string;
    idioma?: string;
  }): Promise<{ success: boolean; explicacion?: string; error?: string }> {
    try {
      const { data: result, error } = await supabase.functions.invoke('profesor-virtual', {
        body: data,
      });

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error al obtener explicación del profesor:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  async guardarTestRealizado(data: {
    user_id: number;
    id_proceso: number;
    tipo_test: 'simulacion' | 'examen';
    secciones: string;
    temas: string;
    num_preguntas: number;
    tiempo: number;
    tiempo_restante: number;
    aciertos: number;
    fallos: number;
    respuestas: any;
    preguntas_acertadas: any;
    preguntas_falladas: any;
    nota: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = {
        ...data,
        respuestas: typeof data.respuestas === 'object' ? data.respuestas : JSON.parse(data.respuestas),
        preguntas_acertadas: typeof data.preguntas_acertadas === 'object' ? data.preguntas_acertadas : JSON.parse(data.preguntas_acertadas),
        preguntas_falladas: typeof data.preguntas_falladas === 'object' ? data.preguntas_falladas : JSON.parse(data.preguntas_falladas),
      };

      return await this.callAPI('guardar_test_realizado.php', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Error al guardar test realizado:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  async getHistorialTests(params: {
    user_id: number;
    tipo_test?: 'simulacion' | 'examen';
    desde?: string;
    hasta?: string;
    q?: string;
  }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams({
        user_id: params.user_id.toString(),
      });
      if (params.tipo_test) queryParams.append('tipo_test', params.tipo_test);
      if (params.desde) queryParams.append('desde', params.desde);
      if (params.hasta) queryParams.append('hasta', params.hasta);
      if (params.q) queryParams.append('q', params.q);

      const data = await this.callAPI(`historial_tests.php?${queryParams.toString()}`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error al obtener historial:', error);
      return [];
    }
  }

  async getEstadisticasUsuario(params: {
    user_id: number;
    tipo_test?: 'simulacion' | 'examen';
  }): Promise<any> {
    try {
      const queryParams = new URLSearchParams({
        user_id: params.user_id.toString(),
      });
      if (params.tipo_test) queryParams.append('tipo_test', params.tipo_test);

      return await this.callAPI(`estadisticas_usuario.php?${queryParams.toString()}`);
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return null;
    }
  }

  async getRanking(params: {
    user_id?: number;
    id_proceso?: number;
    tipo_test?: 'simulacion' | 'examen';
    limit?: number;
  }): Promise<{ ranking: any[]; mi_posicion: number | null }> {
    try {
      const queryParams = new URLSearchParams();
      if (params.user_id) queryParams.append('user_id', params.user_id.toString());
      if (params.id_proceso) queryParams.append('id_proceso', params.id_proceso.toString());
      if (params.tipo_test) queryParams.append('tipo_test', params.tipo_test);
      if (params.limit) queryParams.append('limit', params.limit.toString());

      console.log('🔗 Llamando a ranking con URL:', `ranking_usuarios.php?${queryParams.toString()}`);
      
      const data = await this.callAPI(`ranking_usuarios.php?${queryParams.toString()}`);
      
      console.log('📦 Datos recibidos del ranking:', data);
      
      // Manejar diferentes formatos de respuesta
      if (data && typeof data === 'object') {
        if (Array.isArray(data.ranking)) {
          return {
            ranking: data.ranking,
            mi_posicion: data.mi_posicion || null
          };
        } else if (Array.isArray(data)) {
          // Si viene directamente como array
          return {
            ranking: data,
            mi_posicion: null
          };
        }
      }
      
      return { ranking: [], mi_posicion: null };
    } catch (error) {
      console.error('❌ Error al obtener ranking:', error);
      return { ranking: [], mi_posicion: null };
    }
  }
}

export const testService = new TestService();
export type { Proceso, Pregunta, Respuesta, ProgresoData };
