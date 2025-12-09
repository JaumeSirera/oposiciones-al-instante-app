import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { testService, Proceso } from "@/services/testService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Calendar, CheckCircle2, Languages, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslateContent } from "@/hooks/useTranslateContent";

interface PlanGenerado {
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  secciones: string[];
  temas: string[];
  resumen: string;
}

export default function GenerarPlanIA() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [translatedProcesos, setTranslatedProcesos] = useState<Record<number, string>>({});
  const [selectedProceso, setSelectedProceso] = useState<number | null>(null);
  const [semanas, setSemanas] = useState<number>(8);
  
  const [planGenerado, setPlanGenerado] = useState<PlanGenerado | null>(null);
  const [translatedPlan, setTranslatedPlan] = useState<{
    titulo?: string;
    descripcion?: string;
    resumen?: string;
    secciones?: string[];
    temas?: string[];
  }>({});
  const [notificacionesEmail, setNotificacionesEmail] = useState(true);
  const [horaNotificacion, setHoraNotificacion] = useState("09:00");

  useEffect(() => {
    cargarProcesos();
  }, []);

  // Traducir procesos cuando cambie el idioma
  useEffect(() => {
    const translateProcesos = async () => {
      if (!needsTranslation || procesos.length === 0) {
        setTranslatedProcesos({});
        return;
      }
      const textos = procesos.map(p => p.descripcion);
      const translated = await translateTexts(textos);
      const map: Record<number, string> = {};
      procesos.forEach((p, idx) => {
        map[p.id] = translated[idx];
      });
      setTranslatedProcesos(map);
    };
    translateProcesos();
  }, [procesos, needsTranslation, i18n.language]);

  // Traducir plan generado cuando cambie
  useEffect(() => {
    const translatePlan = async () => {
      if (!planGenerado || !needsTranslation) {
        setTranslatedPlan({});
        return;
      }
      const textos = [
        planGenerado.titulo,
        planGenerado.descripcion,
        planGenerado.resumen || '',
        ...planGenerado.secciones,
        ...planGenerado.temas
      ];
      const translated = await translateTexts(textos);
      
      setTranslatedPlan({
        titulo: translated[0],
        descripcion: translated[1],
        resumen: translated[2],
        secciones: translated.slice(3, 3 + planGenerado.secciones.length),
        temas: translated.slice(3 + planGenerado.secciones.length)
      });
    };
    translatePlan();
  }, [planGenerado, needsTranslation, i18n.language]);

  const cargarProcesos = async () => {
    try {
      const data = await testService.getProcesos(user?.id);
      setProcesos(data);
    } catch (error) {
      toast.error(t('generatePlanIA.errorLoadingProcesses'));
    }
  };

  const generarPlanAutomatico = async () => {
    if (!user?.id || !selectedProceso) {
      toast.error(t('generatePlanIA.selectProcess'));
      return;
    }

    if (semanas < 1 || semanas > 52) {
      toast.error(t('generatePlanIA.weeksRange'));
      return;
    }

    setGenerando(true);
    try {
      const proceso = procesos.find((p) => p.id === selectedProceso);
      
      const { data, error } = await supabase.functions.invoke("generar-plan-automatico", {
        body: {
          id_usuario: user.id,
          id_proceso: selectedProceso,
          proceso_descripcion: proceso?.descripcion || "",
          semanas: semanas,
          notificaciones_email: notificacionesEmail,
          hora_notificacion: horaNotificacion,
        },
      });

      if (error) throw error;

      if (data?.success && data?.plan) {
        setPlanGenerado(data.plan);
        toast.success(t('generatePlanIA.planGenerated'));
      } else {
        toast.error(data?.error || t('generatePlanIA.errorGenerating'));
      }
    } catch (error: any) {
      console.error("Error generando plan:", error);
      toast.error(error.message || t('generatePlanIA.errorGenerating'));
    } finally {
      setGenerando(false);
    }
  };

  const confirmarYGuardar = async () => {
    if (!planGenerado || !user?.id || !selectedProceso) return;

    const phpToken = localStorage.getItem("auth_token");
    if (!phpToken) {
      toast.error(t('generatePlanIA.invalidSession'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("guardar-plan-generado", {
        body: {
          id_usuario: user.id,
          id_proceso: selectedProceso,
          plan: planGenerado,
          notificaciones_email: notificacionesEmail,
          hora_notificacion: horaNotificacion,
          php_token: phpToken,
        },
      });

      if (error) throw error;

      if (data?.success && data?.id_plan) {
        toast.success(t('generatePlanIA.planSaved'));
        navigate(`/plan-estudio/${data.id_plan}`);
      } else {
        toast.error(t('generatePlanIA.errorSaving'));
      }
    } catch (error) {
      console.error("Error guardando plan:", error);
      toast.error(t('generatePlanIA.errorSaving'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('generatePlanIA.backToDashboard')}
      </Button>

      {!planGenerado ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('generatePlanIA.title')}
            </CardTitle>
            <CardDescription>
              {t('generatePlanIA.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="proceso">{t('generatePlanIA.processLabel')} *</Label>
                {needsTranslation && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Languages className="h-3 w-3" />
                    <Badge variant="outline" className="text-xs">{i18n.language.toUpperCase()}</Badge>
                    {isTranslating && <Loader2 className="h-3 w-3 animate-spin" />}
                  </div>
                )}
                <Select
                  value={selectedProceso?.toString()}
                  onValueChange={(value) => setSelectedProceso(parseInt(value))}
                  disabled={generando}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('generatePlanIA.selectProcessPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {procesos.map((proceso) => (
                      <SelectItem key={proceso.id} value={proceso.id.toString()}>
                        {needsTranslation && translatedProcesos[proceso.id] 
                          ? translatedProcesos[proceso.id] 
                          : proceso.descripcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="semanas">{t('generatePlanIA.durationLabel')} *</Label>
                <Input
                  id="semanas"
                  type="number"
                  min="1"
                  max="52"
                  value={semanas}
                  onChange={(e) => setSemanas(parseInt(e.target.value) || 1)}
                  disabled={generando}
                />
                <p className="text-sm text-muted-foreground">
                  {t('generatePlanIA.durationDescription', { weeks: semanas })}
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">{t('generatePlanIA.notificationsConfig')}</h3>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notificaciones"
                    checked={notificacionesEmail}
                    onCheckedChange={(checked) => setNotificacionesEmail(checked as boolean)}
                    disabled={generando}
                  />
                  <Label htmlFor="notificaciones" className="cursor-pointer">
                    {t('generatePlanIA.receiveReminders')}
                  </Label>
                </div>

                {notificacionesEmail && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="hora">{t('generatePlanIA.notificationTime')}</Label>
                    <Input
                      id="hora"
                      type="time"
                      value={horaNotificacion}
                      onChange={(e) => setHoraNotificacion(e.target.value)}
                      disabled={generando}
                    />
                    <p className="text-sm text-muted-foreground">
                      {t('generatePlanIA.dailyEmailDescription')}
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={generarPlanAutomatico}
                disabled={!selectedProceso || generando}
                className="w-full"
                size="lg"
              >
                {generando ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    {t('generatePlanIA.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('generatePlanIA.generateButton')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {t('generatePlanIA.planGeneratedTitle')}
            </CardTitle>
            <CardDescription>
              {t('generatePlanIA.reviewDescription')}
            </CardDescription>
            {needsTranslation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Languages className="h-4 w-4" />
                <Badge variant="outline">{i18n.language.toUpperCase()}</Badge>
                {isTranslating && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('common.translating')}
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">{t('generatePlanIA.titleLabel')}</h3>
              <p className="text-lg">
                {needsTranslation && translatedPlan.titulo ? translatedPlan.titulo : planGenerado.titulo}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('generatePlanIA.descriptionLabel')}</h3>
              <p className="text-muted-foreground">
                {needsTranslation && translatedPlan.descripcion ? translatedPlan.descripcion : planGenerado.descripcion}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">{t('generatePlanIA.startDate')}</h3>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(planGenerado.fecha_inicio).toLocaleDateString()}</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">{t('generatePlanIA.endDate')}</h3>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(planGenerado.fecha_fin).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">{t('generatePlanIA.sectionsIncluded')}</h3>
              <div className="flex flex-wrap gap-2">
                {planGenerado.secciones.map((seccion, idx) => (
                  <Badge key={idx} variant="secondary">
                    {needsTranslation && translatedPlan.secciones?.[idx] 
                      ? translatedPlan.secciones[idx] 
                      : seccion}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                {t('generatePlanIA.topicsSelected', { count: planGenerado.temas.length })}
              </h3>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                {planGenerado.temas.map((tema, idx) => (
                  <Badge key={idx} variant="outline">
                    {needsTranslation && translatedPlan.temas?.[idx] 
                      ? translatedPlan.temas[idx] 
                      : tema}
                  </Badge>
                ))}
              </div>
            </div>

            {planGenerado.resumen && (
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">{t('generatePlanIA.planSummary')}</h3>
                <p className="text-sm text-muted-foreground">
                  {needsTranslation && translatedPlan.resumen ? translatedPlan.resumen : planGenerado.resumen}
                </p>
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPlanGenerado(null)}
                disabled={loading}
              >
                {t('generatePlanIA.generateAnother')}
              </Button>
              <Button
                onClick={confirmarYGuardar}
                disabled={loading}
                className="flex-1"
              >
                {loading ? t('generatePlanIA.saving') : t('generatePlanIA.confirmAndSave')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
