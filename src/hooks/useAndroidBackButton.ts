import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Hook para manejar el botón atrás de Android.
 * - Si hay historial de navegación, navega hacia atrás
 * - Si está en la página principal, minimiza la app en lugar de cerrarla
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Solo ejecutar en plataforma nativa Android
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    const handleBackButton = async () => {
      // Páginas principales donde minimizar en lugar de salir
      const mainPages = ['/', '/dashboard', '/auth'];
      
      if (mainPages.includes(location.pathname)) {
        // Minimizar la app en lugar de cerrarla
        await App.minimizeApp();
      } else {
        // Navegar hacia atrás en el historial
        navigate(-1);
      }
    };

    // Registrar el listener para el botón atrás
    const listener = App.addListener('backButton', handleBackButton);

    return () => {
      // Limpiar el listener al desmontar
      listener.then(l => l.remove());
    };
  }, [navigate, location.pathname]);
}
