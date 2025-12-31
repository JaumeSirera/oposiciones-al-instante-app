import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

interface AppUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  availableVersion: string;
  immediateUpdateAllowed: boolean;
  flexibleUpdateAllowed: boolean;
}

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const checkForUpdate = useCallback(async () => {
    // Solo funciona en plataformas nativas
    if (!Capacitor.isNativePlatform()) {
      console.log('App update check: not on native platform');
      return null;
    }

    setIsChecking(true);

    try {
      // Importación dinámica para evitar errores en web
      const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update');
      
      const result = await AppUpdate.getAppUpdateInfo();
      
      const info: AppUpdateInfo = {
        updateAvailable: result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE,
        currentVersion: result.currentVersionName || result.currentVersionCode?.toString() || 'unknown',
        availableVersion: result.availableVersionName || result.availableVersionCode?.toString() || 'unknown',
        immediateUpdateAllowed: result.immediateUpdateAllowed || false,
        flexibleUpdateAllowed: result.flexibleUpdateAllowed || false,
      };

      setUpdateInfo(info);

      // Mostrar diálogo si hay actualización disponible
      if (info.updateAvailable) {
        setShowUpdateDialog(true);
      }

      return info;
    } catch (error) {
      console.error('Error checking for app update:', error);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const performImmediateUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update');
      
      const result = await AppUpdate.getAppUpdateInfo();
      
      if (result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE && result.immediateUpdateAllowed) {
        await AppUpdate.performImmediateUpdate();
      }
    } catch (error) {
      console.error('Error performing immediate update:', error);
    }
  }, []);

  const startFlexibleUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update');
      
      const result = await AppUpdate.getAppUpdateInfo();
      
      if (result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE && result.flexibleUpdateAllowed) {
        await AppUpdate.startFlexibleUpdate();
      }
    } catch (error) {
      console.error('Error starting flexible update:', error);
    }
  }, []);

  const openAppStore = useCallback(async () => {
    // En Android, el plugin usa automáticamente el package name de la app
    // Pero como fallback abrimos directamente la URL de Play Store
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { AppUpdate } = await import('@capawesome/capacitor-app-update');
      await AppUpdate.openAppStore();
    } catch (error) {
      console.error('Error opening app store:', error);
      // Fallback: abrir Play Store directamente en el navegador
      window.open('https://play.google.com/store/apps/details?id=com.jaumesirera.TestsOposiciones', '_blank');
    }
  }, []);

  const dismissUpdateDialog = useCallback(() => {
    setShowUpdateDialog(false);
  }, []);

  // Verificar actualizaciones al montar el componente
  useEffect(() => {
    // Pequeño delay para no bloquear el inicio de la app
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    updateInfo,
    isChecking,
    showUpdateDialog,
    checkForUpdate,
    performImmediateUpdate,
    startFlexibleUpdate,
    openAppStore,
    dismissUpdateDialog,
  };
}
