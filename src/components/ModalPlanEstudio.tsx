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
import { useTranslation } from "react-i18next";

interface ModalPlanEstudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalPlanEstudio({ open, onOpenChange }: ModalPlanEstudioProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
          <DialogTitle className="text-2xl">{t('plans.study.create')}</DialogTitle>
          <DialogDescription>
            {t('studyPlans.chooseHowToCreate')}
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
              <div className="font-bold text-lg">{t('plans.study.generateAI')}</div>
              <div className="text-xs opacity-90 font-normal">
                {t('studyPlans.aiWillCreatePlan')}
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
              <div className="font-bold text-lg">{t('plans.study.manual')}</div>
              <div className="text-xs opacity-90 font-normal">
                {t('studyPlans.customizeEveryDetail')}
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}