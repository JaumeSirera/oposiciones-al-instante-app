import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ModalPlanEstudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalPlanEstudio({ open, onOpenChange }: ModalPlanEstudioProps) {
  const navigate = useNavigate();

  const handleManual = () => {
    onOpenChange(false);
    navigate("/planes-estudio");
  };

  const handleIA = () => {
    onOpenChange(false);
    navigate("/generar-plan-ia");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Crear Plan de Estudio</DialogTitle>
          <DialogDescription>
            Elige cómo quieres crear tu plan personalizado
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Button
            onClick={handleIA}
            className="h-auto py-6 flex flex-col gap-2 hover:scale-105 transition-transform"
            variant="default"
          >
            <Sparkles className="h-8 w-8" />
            <div className="text-center">
              <div className="font-bold text-lg">Generación con IA</div>
              <div className="text-xs opacity-90 font-normal">
                La IA creará un plan completo automáticamente
              </div>
            </div>
          </Button>

          <Button
            onClick={handleManual}
            className="h-auto py-6 flex flex-col gap-2 hover:scale-105 transition-transform"
            variant="outline"
          >
            <Calendar className="h-8 w-8" />
            <div className="text-center">
              <div className="font-bold text-lg">Creación Manual</div>
              <div className="text-xs opacity-90 font-normal">
                Personaliza cada detalle de tu plan
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
