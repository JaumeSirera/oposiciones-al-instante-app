import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/lib/supabaseClient';

export interface NutrientInfo {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  sugar: number;
  fat: number;
  saturatedFat: number;
  transFat: number;
  fiber: number;
  cholesterol: number;
  sodium: number;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  sugar: number;
  fat: number;
  saturatedFat: number;
  transFat: number;
  fiber: number;
  cholesterol: number;
  sodium: number;
}

export interface NutritionAnalysis {
  id?: number;
  id_usuario: number;
  dish_name: string;
  image_base64?: string;
  ingredients: NutrientInfo[];
  totals: NutritionTotals;
  health_score: number;
  recommendations: string[];
  fecha_analisis?: string;
  username?: string;
  email?: string;
}

export interface NutritionHistoryItem {
  id: number;
  id_usuario: number;
  dish_name: string;
  totals: NutritionTotals;
  health_score: number;
  fecha_analisis: string;
  username?: string;
  email?: string;
}

class NutritionHistoryService {
  private getAuthHeader(): { [key: string]: string } {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async callAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${SUPABASE_URL}/functions/v1/php-api-proxy`;
    
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

  async guardarAnalisis(analisis: {
    id_usuario: number;
    dish_name: string;
    image_base64?: string;
    ingredients: NutrientInfo[];
    totals: NutritionTotals;
    health_score: number;
    recommendations: string[];
  }): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      const data = await this.callAPI('historial_nutricional.php', {
        body: JSON.stringify({
          action: 'guardar',
          ...analisis,
        }),
      });
      return data;
    } catch (error) {
      console.error('Error al guardar análisis:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  async listarHistorial(userId: number, verTodos: boolean = false): Promise<NutritionHistoryItem[]> {
    try {
      const endpoint = verTodos 
        ? `historial_nutricional.php?action=listar_todos`
        : `historial_nutricional.php?action=listar&id_usuario=${userId}`;
      const data = await this.callAPI(endpoint, {
        method: 'GET',
      });
      return data.success && Array.isArray(data.historial) ? data.historial : [];
    } catch (error) {
      console.error('Error al listar historial:', error);
      return [];
    }
  }

  async obtenerDetalle(id: number): Promise<NutritionAnalysis | null> {
    try {
      const data = await this.callAPI(`historial_nutricional.php?action=detalle&id=${id}`, {
        method: 'GET',
      });
      if (data.success && data.analisis) {
        return data.analisis;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener detalle:', error);
      return null;
    }
  }

  async eliminarAnalisis(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      const data = await this.callAPI('historial_nutricional.php', {
        body: JSON.stringify({
          action: 'eliminar',
          id,
        }),
      });
      return data;
    } catch (error) {
      console.error('Error al eliminar análisis:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }
}

export const nutritionHistoryService = new NutritionHistoryService();
