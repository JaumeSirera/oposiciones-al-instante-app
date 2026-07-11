import { supabase } from '@/lib/supabaseClient';
import { authService } from './authService';

const PROXY_FUNCTION = 'php-api-proxy';

export interface AdminProceso {
  id: number;
  descripcion: string;
  estado?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  id_usuario?: number | null;
  es_publico?: number | null;
  nivel?: string | null;
}

async function invoke(body: Record<string, any>) {
  const token = authService.getToken();
  const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (error) throw error;
  return data;
}

export const adminProcesosService = {
  async list(params: { q?: string; estado?: string } = {}): Promise<AdminProceso[]> {
    const qs = new URLSearchParams();
    if (params.q) qs.append('q', params.q);
    if (params.estado) qs.append('estado', params.estado);
    const endpoint = qs.toString() ? `procesos.php?${qs.toString()}` : 'procesos.php';
    const data = await invoke({ endpoint, method: 'GET' });
    if (Array.isArray(data)) return data;
    if (data?.procesos && Array.isArray(data.procesos)) return data.procesos;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  },

  async create(payload: {
    descripcion: string;
    estado: string;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
  }) {
    return invoke({ endpoint: 'procesos.php', method: 'POST', body: payload });
  },

  async update(id: number, payload: {
    descripcion: string;
    estado: string;
    fecha_inicio?: string | null;
    fecha_fin?: string | null;
  }) {
    return invoke({ endpoint: `procesos.php?id=${id}`, method: 'PUT', body: payload });
  },

  async remove(id: number) {
    return invoke({ endpoint: `procesos.php?id=${id}`, method: 'DELETE' });
  },
};
