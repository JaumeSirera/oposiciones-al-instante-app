import { supabase } from '@/lib/supabaseClient';

const PROXY_FUNCTION = 'php-api-proxy';

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  refresh_token?: string;
  username?: string;
  nivel?: string;
  user_id?: number;
  expires_in?: number;
  error?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  nivel: string;
}

class AuthService {
  private getAuthHeader(): { [key: string]: string } {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
        body: {
          action: 'login',
          ...credentials,
        },
      });

      if (error) throw error;
      
      if (data.success && data.token) {
        this.setToken(data.token);
        if (data.refresh_token) {
          this.setRefreshToken(data.refresh_token);
        }
        if (data.user_id) {
          localStorage.setItem('user_id', data.user_id.toString());
        }
        if (data.username) {
          localStorage.setItem('username', data.username);
        }
        if (data.nivel) {
          localStorage.setItem('nivel', data.nivel);
        }
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Error de conexión. Por favor, intenta de nuevo.',
      };
    }
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
        body: userData,
      });

      if (error) throw error;
      
      const result = data;
      
      if (result.success && result.token) {
        this.setToken(result.token);
        if (result.refresh_token) {
          this.setRefreshToken(result.refresh_token);
        }
        if (result.user_id) {
          localStorage.setItem('user_id', result.user_id.toString());
        }
        if (result.username) {
          localStorage.setItem('username', result.username);
        }
        if (result.nivel) {
          localStorage.setItem('nivel', result.nivel);
        }
      }

      return result;
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error: 'Error de conexión. Por favor, intenta de nuevo.',
      };
    }
  }

  async refreshToken(): Promise<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    try {
      const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
        body: {
          action: 'refresh_token',
          refresh_token: refreshToken,
        },
      });

      if (error) throw error;
      
      if (data.success && data.token) {
        this.setToken(data.token);
        if (data.user_id) {
          localStorage.setItem('user_id', data.user_id.toString());
        }
        if (data.username) {
          localStorage.setItem('username', data.username);
        }
        if (data.nivel) {
          localStorage.setItem('nivel', data.nivel);
        }
      }

      return data;
    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        error: 'Error al refrescar el token',
      };
    }
  }

  async getUserProfile(userId: number): Promise<User | null> {
    try {
      const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
        body: {
          id: userId,
        },
        headers: this.getAuthHeader(),
      });

      if (error) throw error;
      
      if (data.error) {
        return null;
      }

      return data;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  async recoverPassword(email: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
        body: {
          action: 'recover',
          email,
        },
      });

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Recover password error:', error);
      return {
        success: false,
        error: 'Error al solicitar recuperación de contraseña',
      };
    }
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('nivel');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem('refresh_token', token);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    // Verificar si el token JWT ha expirado
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) return false;
      
      // Token expirado
      if (payload.exp * 1000 < Date.now()) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  getCurrentUser(): { id: number; username: string; nivel: string } | null {
    const userId = localStorage.getItem('user_id');
    const username = localStorage.getItem('username');
    const nivel = localStorage.getItem('nivel');

    if (!userId || !username) return null;

    return {
      id: parseInt(userId),
      username,
      nivel: nivel || 'invitado',
    };
  }
}

export const authService = new AuthService();
