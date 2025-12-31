import { createContext, useContext, ReactNode } from 'react';
import { useAppUpdate } from '@/hooks/useAppUpdate';

interface AppUpdateContextType {
  updateAvailable: boolean;
  currentVersion: string;
  availableVersion: string;
  showUpdateDialog: boolean;
  openAppStore: () => Promise<void>;
  dismissUpdateDialog: () => void;
}

const AppUpdateContext = createContext<AppUpdateContextType | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const {
    updateInfo,
    showUpdateDialog,
    openAppStore,
    dismissUpdateDialog,
  } = useAppUpdate();

  const value: AppUpdateContextType = {
    updateAvailable: updateInfo?.updateAvailable ?? false,
    currentVersion: updateInfo?.currentVersion ?? '',
    availableVersion: updateInfo?.availableVersion ?? '',
    showUpdateDialog,
    openAppStore,
    dismissUpdateDialog,
  };

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdateContext() {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdateContext must be used within an AppUpdateProvider');
  }
  return context;
}
