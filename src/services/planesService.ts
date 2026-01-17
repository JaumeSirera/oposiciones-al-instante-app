import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabaseClient';

interface Plan {
  id: number;
  id_usuario: number;
  id_proceso: number;
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  progreso: string;
  nota_general: string | null;
  tieneIA: boolean;
  ia_avance_ratio: number;
  total_sesiones: number;
  ultima_sesion: string | null;
  resumen_ia: string | null;
}

interface Etapa {
  id: number;
  id_plan: number;
  titulo: string;
  descripcion: string;
  orden: number;
  tareas: Tarea[];
}

interface Tarea {
  id: number;
  id_etapa: number;
  titulo: string;
  descripcion: string;
  orden: number;
  completada: number;
}

interface PlanDetalle {
  plan: Plan;
  etapas: Etapa[];
}

class PlanesService {
  private getAuthHeader(): { [key: string]: string } {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async callAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${SUPABASE_URL}/functions/v1/php-api-proxy`;
    
    // If endpoint already has query params, just pass the body
    // Otherwise, extract body params for POST requests
    const bodyParams = options.body ? JSON.parse(options.body as string) : {};
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        ...this.getAuthHeader(),
        ...options.headers,
      },
      body: JSON.stringify({
        endpoint: endpoint,
        method: options.method || 'POST',
        ...bodyParams,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error en la petición: ${response.status}`);
    }

    return response.json();
  }

  async listarPlanes(userId: number, verTodos: boolean = false): Promise<Plan[]> {
    try {
      const endpoint = verTodos 
        ? `planes_estudio.php?action=listar_todos`
        : `planes_estudio.php?action=listar&id_usuario=${userId}`;
      const data = await this.callAPI(endpoint, {
        method: 'GET',
      });
      return data.success && Array.isArray(data.planes) ? data.planes : [];
    } catch (error) {
      console.error('Error al listar planes:', error);
      throw error;
    }
  }

  async crearPlan(params: {
    id_usuario: number;
    id_proceso: number;
    titulo: string;
    descripcion: string;
    fecha_inicio: string;
    fecha_fin: string;
  }): Promise<{ success: boolean; id_plan?: number; error?: string }> {
    try {
      const data = await this.callAPI('planes_estudio.php', {
        body: JSON.stringify({
          action: 'crear',
          ...params,
        }),
      });
      return data;
    } catch (error) {
      console.error('Error al crear plan:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  async obtenerDetallePlan(idPlan: number): Promise<PlanDetalle | null> {
    try {
      const data = await this.callAPI(`planes_estudio.php?action=detalle&id_plan=${idPlan}`, {
        method: 'GET',
      });
      if (data.success) {
        return {
          plan: data.plan,
          etapas: data.etapas || [],
        };
      }
      return null;
    } catch (error) {
      console.error('Error al obtener detalle del plan:', error);
      return null;
    }
  }

  async actualizarPlan(params: {
    id_plan: number;
    titulo?: string;
    descripcion?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: string;
    progreso?: number;
    nota_general?: string;
  }): Promise<{ success: boolean }> {
    try {
      const data = await this.callAPI('planes_estudio.php', {
        body: JSON.stringify({
          action: 'actualizar',
          ...params,
        }),
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar plan:', error);
      return { success: false };
    }
  }

  async eliminarPlan(idPlan: number): Promise<{ success: boolean }> {
    try {
      const data = await this.callAPI(`planes_estudio.php?action=eliminar&id_plan=${idPlan}`, {
        method: 'POST',
      });
      return data;
    } catch (error) {
      console.error('Error al eliminar plan:', error);
      return { success: false };
    }
  }

  async obtenerPlanIA(idPlan: number, idUsuario?: number): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('id_plan', idPlan.toString());
      if (idUsuario) params.append('id_usuario', idUsuario.toString());

      const url = `${SUPABASE_URL}/functions/v1/php-api-proxy`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          ...this.getAuthHeader(),
        },
        body: JSON.stringify({
          endpoint: `plan_ia_personal.php?${params.toString()}`,
          method: 'GET',
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en la petición: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error al obtener plan IA:', error);
      return null;
    }
  }

  async marcarTarea(idTarea: number, completada: boolean): Promise<{ success: boolean }> {
    try {
      const data = await this.callAPI(`planes_estudio.php?action=marcar_tarea`, {
        body: JSON.stringify({
          id_tarea: idTarea,
          completada: completada ? 1 : 0,
        }),
      });
      return data;
    } catch (error) {
      console.error('Error al marcar tarea:', error);
      return { success: false };
    }
  }
}

export const planesService = new PlanesService();
export type { Plan, Etapa, Tarea, PlanDetalle };
