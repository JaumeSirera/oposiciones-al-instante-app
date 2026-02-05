import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Heart, ShieldAlert, Cookie, Scale, FileWarning } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const DISCLAIMER_ACCEPTED_KEY = "nutrition_disclaimer_accepted";

interface NutritionDisclaimerProps {
  onAccept: () => void;
  onCancel?: () => void;
}

export function useNutritionDisclaimer() {
  const [hasAccepted, setHasAccepted] = useState<boolean>(() => {
    return localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === "true";
  });

  const acceptDisclaimer = () => {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, "true");
    setHasAccepted(true);
  };

  const resetDisclaimer = () => {
    localStorage.removeItem(DISCLAIMER_ACCEPTED_KEY);
    setHasAccepted(false);
  };

  return { hasAccepted, acceptDisclaimer, resetDisclaimer };
}

// Botón pequeño para revisar el disclaimer (siempre visible después de aceptar)
export const NutritionDisclaimerButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950"
    >
      <Info className="h-4 w-4" />
      <span className="hidden sm:inline">{t("nutritionDisclaimer.viewDisclaimer", "Ver Aviso Legal")}</span>
      <span className="sm:hidden">{t("nutritionDisclaimer.legal", "Legal")}</span>
    </Button>
  );
};

export const NutritionDisclaimerModal: React.FC<NutritionDisclaimerProps> = ({
  onAccept,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);

  const canAccept = checked1 && checked2;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel?.()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            {t("nutritionDisclaimer.title", "Descargo de Responsabilidad Nutricional")}
          </DialogTitle>
          <DialogDescription>
            {t("nutritionDisclaimer.subtitle", "Por favor, lee y acepta los siguientes términos antes de continuar.")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-[40vh] max-h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            {/* Sección 1 */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-primary" />
                {t("nutritionDisclaimer.section1Title", "1. Naturaleza Informativa y Educativa")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("nutritionDisclaimer.section1Text", "Esta aplicación (en adelante, \"la App\") es una herramienta tecnológica diseñada para proporcionar orientación general sobre fitness y nutrición. Los planes nutricionales, cálculos de macronutrientes (proteínas, glúcidos, grasas), valores calóricos y recetas generados por el algoritmo se basan en fórmulas matemáticas de estimación estándar y no constituyen, bajo ninguna circunstancia, un consejo médico, diagnóstico o tratamiento profesional.")}
              </p>
            </div>

            {/* Sección 2 */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" />
                {t("nutritionDisclaimer.section2Title", "2. Ausencia de Relación Profesional")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("nutritionDisclaimer.section2Text", "El uso de esta App no establece una relación profesional entre el usuario y un dietista-nutricionista o profesional de la salud colegiado. La App no está gestionada por personal médico y su propósito es puramente recreativo y de apoyo al rendimiento físico para oposiciones.")}
              </p>
            </div>

            {/* Sección 3 */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {t("nutritionDisclaimer.section3Title", "3. Advertencia de Salud y Patologías")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("nutritionDisclaimer.section3Text", "Los planes generados están destinados exclusivamente a personas sanas. Si usted padece alguna condición médica (incluyendo, pero no limitado a: diabetes, hipertensión, trastornos de la conducta alimentaria, insuficiencia renal o alergias severas), NO debe seguir las sugerencias de la App sin la supervisión previa de un médico o nutricionista titulado.")}
              </p>
            </div>

            {/* Sección 4 */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Cookie className="h-4 w-4 text-primary" />
                {t("nutritionDisclaimer.section4Title", "4. Alérgenos y Seguridad Alimentaria")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("nutritionDisclaimer.section4Text", "Las recetas e imágenes generadas por Inteligencia Artificial son sugerencias ilustrativas. Es responsabilidad exclusiva del usuario verificar que los ingredientes propuestos no contengan alérgenos que puedan afectarle y que las cantidades sean adecuadas para su situación personal.")}
              </p>
            </div>

            {/* Sección 5 */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                {t("nutritionDisclaimer.section5Title", "5. Exención de Responsabilidad")}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t("nutritionDisclaimer.section5Text", "El titular de la App no se hace responsable de cualquier daño, lesión o perjuicio derivado de la interpretación o uso de la información proporcionada. Al utilizar esta herramienta, el usuario asume toda la responsabilidad sobre su salud y bienestar físico.")}
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="disclaimer-check-1"
              checked={checked1}
              onCheckedChange={(checked) => setChecked1(checked === true)}
            />
            <Label htmlFor="disclaimer-check-1" className="text-sm leading-relaxed cursor-pointer">
              {t("nutritionDisclaimer.checkbox1", "Entiendo que esta App no sustituye el consejo de un nutricionista o médico profesional.")}
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="disclaimer-check-2"
              checked={checked2}
              onCheckedChange={(checked) => setChecked2(checked === true)}
            />
            <Label htmlFor="disclaimer-check-2" className="text-sm leading-relaxed cursor-pointer">
              {t("nutritionDisclaimer.checkbox2", "Confirmo que no padezco patologías médicas graves o, si las padezco, consultaré con un profesional antes de seguir cualquier plan.")}
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {t("common.cancel", "Cancelar")}
            </Button>
          )}
          <Button
            onClick={onAccept}
            disabled={!canAccept}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            {t("nutritionDisclaimer.accept", "Acepto los términos")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Banner visible en la aplicación
export const NutritionDisclaimerBanner: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
        {t("nutritionDisclaimer.banner", "Esta aplicación es una herramienta de orientación informativa y no constituye un consejo médico, diagnóstico o tratamiento. Consulte siempre con un profesional colegiado antes de iniciar cualquier plan nutricional.")}
      </AlertDescription>
    </Alert>
  );
};

// Etiqueta para imágenes generadas por IA
export const AIGeneratedImageLabel: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { t } = useTranslation();

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded ${className}`}>
      {t("nutritionDisclaimer.aiImageLabel", "Imagen generada por IA con fines ilustrativos")}
    </span>
  );
};

export default NutritionDisclaimerModal;
