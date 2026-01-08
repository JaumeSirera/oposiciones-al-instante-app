import { supabase } from '@/lib/supabaseClient';

const PROXY_FUNCTION = 'php-api-proxy';

export interface Flashcard {
  id: number;
  user_id: number;
  id_proceso?: number;
  front: string;
  back: string;
  category?: string;
  tags?: string;
  source_type: 'manual' | 'pregunta_fallada' | 'importada';
  source_id?: number;
  created_at: string;
  updated_at: string;
  // Campos de progreso
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review?: string;
  last_review?: string;
  total_reviews: number;
  correct_reviews: number;
}

export interface FlashcardStats {
  total: number;
  pending: number;
  mastered: number;
  avg_ease: number;
  total_reviews: number;
  correct_reviews: number;
  accuracy: number;
}

export interface ReviewResult {
  success: boolean;
  next_review: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
}

class FlashcardService {
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

      return data;
    } catch (error) {
      console.error('Error in callAPI:', error);
      throw error;
    }
  }

  // Obtener flashcards pendientes de revisión
  async getPendingFlashcards(userId: number, limit = 20, idProceso?: number): Promise<Flashcard[]> {
    try {
      const params = new URLSearchParams({
        user_id: userId.toString(),
        action: 'pending',
        limit: limit.toString(),
      });
      
      if (idProceso) {
        params.append('id_proceso', idProceso.toString());
      }

      const data = await this.callAPI(`flashcards.php?${params.toString()}`);
      return data.success ? data.flashcards : [];
    } catch (error) {
      console.error('Error al obtener flashcards pendientes:', error);
      return [];
    }
  }

  // Obtener todas las flashcards del usuario
  async getFlashcards(
    userId: number, 
    options?: { 
      idProceso?: number; 
      category?: string; 
      page?: number; 
      limit?: number 
    }
  ): Promise<{ flashcards: Flashcard[]; total: number; pages: number }> {
    try {
      const params = new URLSearchParams({
        user_id: userId.toString(),
        action: 'list',
      });

      if (options?.idProceso) params.append('id_proceso', options.idProceso.toString());
      if (options?.category) params.append('category', options.category);
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());

      const data = await this.callAPI(`flashcards.php?${params.toString()}`);
      
      return {
        flashcards: data.success ? data.flashcards : [],
        total: data.total || 0,
        pages: data.pages || 1,
      };
    } catch (error) {
      console.error('Error al obtener flashcards:', error);
      return { flashcards: [], total: 0, pages: 1 };
    }
  }

  // Obtener estadísticas
  async getStats(userId: number): Promise<FlashcardStats | null> {
    try {
      const data = await this.callAPI(`flashcards.php?user_id=${userId}&action=stats`);
      return data.success ? data.stats : null;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return null;
    }
  }

  // Obtener categorías
  async getCategories(userId: number): Promise<{ category: string; count: number }[]> {
    try {
      const data = await this.callAPI(`flashcards.php?user_id=${userId}&action=categories`);
      return data.success ? data.categories : [];
    } catch (error) {
      console.error('Error al obtener categorías:', error);
      return [];
    }
  }

  // Crear flashcard
  async createFlashcard(flashcard: {
    user_id: number;
    front: string;
    back: string;
    category?: string;
    tags?: string;
    id_proceso?: number;
    source_type?: string;
    source_id?: number;
  }): Promise<{ success: boolean; id?: number; error?: string }> {
    try {
      const data = await this.callAPI('flashcards.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'create',
          ...flashcard,
        }),
      });
      return data;
    } catch (error) {
      console.error('Error al crear flashcard:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  // Crear múltiples flashcards
  async createBulkFlashcards(
    userId: number,
    flashcards: Array<{
      front: string;
      back: string;
      category?: string;
      id_proceso?: number;
      source_type?: string;
      source_id?: number;
    }>
  ): Promise<{ success: boolean; created: number; errors: number }> {
    try {
      const data = await this.callAPI('flashcards.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'bulk_create',
          user_id: userId,
          flashcards,
        }),
      });
      return data;
    } catch (error) {
      console.error('Error al crear flashcards:', error);
      return { success: false, created: 0, errors: flashcards.length };
    }
  }

  // Registrar revisión (algoritmo SM-2)
  async reviewFlashcard(
    userId: number,
    flashcardId: number,
    quality: number // 0-5: 0-2 = incorrecto, 3-5 = correcto
  ): Promise<ReviewResult | null> {
    try {
      const data = await this.callAPI('flashcards.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'review',
          user_id: userId,
          flashcard_id: flashcardId,
          quality,
        }),
      });
      
      if (data.success) {
        return {
          success: true,
          next_review: data.next_review,
          interval_days: data.interval_days,
          ease_factor: data.ease_factor,
          repetitions: data.repetitions,
        };
      }
      return null;
    } catch (error) {
      console.error('Error al registrar revisión:', error);
      return null;
    }
  }

  // Actualizar flashcard
  async updateFlashcard(flashcard: {
    id: number;
    user_id: number;
    front: string;
    back: string;
    category?: string;
    tags?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const data = await this.callAPI('flashcards.php', {
        method: 'PUT',
        body: JSON.stringify(flashcard),
      });
      return data;
    } catch (error) {
      console.error('Error al actualizar flashcard:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  // Eliminar flashcard
  async deleteFlashcard(id: number, userId: number): Promise<{ success: boolean }> {
    try {
      const data = await this.callAPI(`flashcards.php?id=${id}&user_id=${userId}`, {
        method: 'DELETE',
      });
      return data;
    } catch (error) {
      console.error('Error al eliminar flashcard:', error);
      return { success: false };
    }
  }
}

export const flashcardService = new FlashcardService();
