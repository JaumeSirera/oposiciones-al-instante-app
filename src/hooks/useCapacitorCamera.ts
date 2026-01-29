import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraPermissionState } from '@capacitor/camera';

interface UseCapacitorCameraResult {
  takePhoto: () => Promise<string | null>;
  pickFromGallery: () => Promise<string | null>;
  isNativePlatform: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export const useCapacitorCamera = (): UseCapacitorCameraResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isNativePlatform = Capacitor.isNativePlatform();

  const checkPermissions = async (): Promise<boolean> => {
    try {
      const permissions = await Camera.checkPermissions();
      
      if (permissions.camera === 'denied' || permissions.photos === 'denied') {
        const requested = await Camera.requestPermissions();
        return requested.camera !== 'denied';
      }
      
      return true;
    } catch (err) {
      console.error('Error checking camera permissions:', err);
      return true; // Continue anyway, let the camera API handle it
    }
  };

  const takePhoto = useCallback(async (): Promise<string | null> => {
    if (!isNativePlatform) {
      setError('Camera is only available on native platforms');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        setError('Camera permission denied');
        return null;
      }

      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        correctOrientation: true,
      });

      if (image.base64String) {
        const mimeType = image.format === 'png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${image.base64String}`;
      }

      return null;
    } catch (err: any) {
      // User cancelled is not an error
      if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        return null;
      }
      console.error('Error taking photo:', err);
      setError(err?.message || 'Error taking photo');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isNativePlatform]);

  const pickFromGallery = useCallback(async (): Promise<string | null> => {
    if (!isNativePlatform) {
      setError('Gallery is only available on native platforms');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        setError('Gallery permission denied');
        return null;
      }

      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });

      if (image.base64String) {
        const mimeType = image.format === 'png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${image.base64String}`;
      }

      return null;
    } catch (err: any) {
      // User cancelled is not an error
      if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        return null;
      }
      console.error('Error picking from gallery:', err);
      setError(err?.message || 'Error selecting image');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isNativePlatform]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    takePhoto,
    pickFromGallery,
    isNativePlatform,
    isLoading,
    error,
    clearError,
  };
};
