import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AppUpdateDialogProps {
  open: boolean;
  onDismiss: () => void;
  onUpdate: () => void;
  currentVersion: string;
  availableVersion: string;
  immediateUpdateAllowed: boolean;
}

export function AppUpdateDialog({
  open,
  onDismiss,
  onUpdate,
  currentVersion,
  availableVersion,
  immediateUpdateAllowed,
}: AppUpdateDialogProps) {
  const { t, i18n } = useTranslation();

  // Textos según el idioma
  const getTexts = () => {
    const lang = i18n.language;
    
    if (lang === 'es') {
      return {
        title: '¡Nueva versión disponible!',
        description: `Hay una nueva versión de la aplicación disponible. Actualiza para disfrutar de las últimas mejoras y correcciones.`,
        versionInfo: `Versión actual: ${currentVersion} → Nueva: ${availableVersion}`,
        updateNow: 'Actualizar ahora',
        later: 'Más tarde',
      };
    } else if (lang === 'fr') {
      return {
        title: 'Nouvelle version disponible !',
        description: `Une nouvelle version de l'application est disponible. Mettez à jour pour profiter des dernières améliorations.`,
        versionInfo: `Version actuelle: ${currentVersion} → Nouvelle: ${availableVersion}`,
        updateNow: 'Mettre à jour',
        later: 'Plus tard',
      };
    } else if (lang === 'pt') {
      return {
        title: 'Nova versão disponível!',
        description: `Uma nova versão do aplicativo está disponível. Atualize para aproveitar as últimas melhorias.`,
        versionInfo: `Versão atual: ${currentVersion} → Nova: ${availableVersion}`,
        updateNow: 'Atualizar agora',
        later: 'Mais tarde',
      };
    } else if (lang === 'de') {
      return {
        title: 'Neue Version verfügbar!',
        description: `Eine neue Version der App ist verfügbar. Aktualisieren Sie, um die neuesten Verbesserungen zu genießen.`,
        versionInfo: `Aktuelle Version: ${currentVersion} → Neu: ${availableVersion}`,
        updateNow: 'Jetzt aktualisieren',
        later: 'Später',
      };
    } else if (lang === 'zh') {
      return {
        title: '新版本可用！',
        description: `应用程序有新版本可用。更新以享受最新的改进和修复。`,
        versionInfo: `当前版本: ${currentVersion} → 新版本: ${availableVersion}`,
        updateNow: '立即更新',
        later: '稍后',
      };
    } else {
      // English default
      return {
        title: 'New version available!',
        description: `A new version of the app is available. Update now to enjoy the latest improvements and fixes.`,
        versionInfo: `Current version: ${currentVersion} → New: ${availableVersion}`,
        updateNow: 'Update now',
        later: 'Later',
      };
    }
  };

  const texts = getTexts();

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <RefreshCw className="h-6 w-6 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl">
              {texts.title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>{texts.description}</p>
            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {texts.versionInfo}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={onDismiss}>
            {texts.later}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onUpdate} className="gap-2">
            <Download className="h-4 w-4" />
            {texts.updateNow}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
