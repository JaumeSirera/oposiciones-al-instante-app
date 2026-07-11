import { supabase } from '@/lib/supabaseClient';
import { authService } from './authService';

const PROXY_FUNCTION = 'php-api-proxy';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  nivel: string;
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

export const adminUsuariosService = {
  async list(search = ''): Promise<AdminUser[]> {
    const endpoint = search
      ? `admin_usuarios.php?search=${encodeURIComponent(search)}`
      : 'admin_usuarios.php';
    const data = await invoke({ endpoint, method: 'GET' });
    if (Array.isArray(data)) return data;
    return [];
  },

  async create(payload: {
    username: string;
    email: string;
    password: string;
    nivel: string;
  }) {
    return invoke({ endpoint: 'admin_usuarios.php', body: payload });
  },

  async update(payload: {
    id: number;
    username?: string;
    email?: string;
    nivel?: string;
    password?: string;
  }) {
    return invoke({
      endpoint: 'admin_usuarios.php',
      method: 'PUT',
      body: payload,
    });
  },

  async remove(id: number) {
    return invoke({
      endpoint: `admin_usuarios.php?id=${id}`,
      method: 'DELETE',
    });
  },
};
