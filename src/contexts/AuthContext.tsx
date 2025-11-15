import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/authService';

interface User {
  id: number;
  username: string;
  nivel: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay una sesión activa al cargar
    const checkAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // Token válido pero no hay datos del usuario, intentar refrescar
            const result = await authService.refreshToken();
            if (result.success) {
              const refreshedUser = authService.getCurrentUser();
              setUser(refreshedUser);
            } else {
              authService.logout();
            }
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        authService.logout();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    try {
      const result = await authService.login({ email, password, remember });
      
      if (result.success) {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Error al iniciar sesión' };
    } catch (error) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const result = await authService.register({ username, email, password });
      
      if (result.success) {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
        return { success: true };
      }
      
      return { success: false, error: result.error || 'Error al registrarse' };
    } catch (error) {
      return { success: false, error: 'Error de conexión' };
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isSuperAdmin: user?.nivel === 'SA',
        isAdmin: user?.nivel === 'admin',
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
