import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { planesService, PlanDetalle } from "@/services/planesService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Calendar, BookOpen, Target, PlayCircle, Brain } from "lucide-react";

interface ActividadDia {
  dia: number;
  fecha: string;
  tema: string;
  actividad: string;
  duracion_horas: number;
}

interface SemanaPlan {
  semana: number;
  fecha_inicio: string;
  fecha_fin: string;
  temas_semana: string[];
  objetivos: string[];
  actividades: ActividadDia[];
  notas: string;
}

export default function PlanEstudioDetalle() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detalle, setDetalle] = useState<PlanDetalle | null>(null);
  const [planIA, setPlanIA] = useState<SemanaPlan[] | null>(null);
  const [resumenIA, setResumenIA] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      cargarDetalle();
      cargarPlanIA();
    }
  }, [id]);

  const cargarDetalle = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const data = await planesService.obtenerDetallePlan(parseInt(id));
      setDetalle(data);
    } catch (error) {
      toast.error(t('studyPlans.errorLoadingPlan'));
    } finally {
      setLoading(false);
    }
  };

  const cargarPlanIA = async () => {
    if (!id || !user?.id) return;

    try {
      const data = await planesService.obtenerPlanIA(parseInt(id), user.id);
      if (data?.success && data.plan_ia) {
        setPlanIA(data.plan_ia.plan || data.plan_ia);
        setResumenIA(data.resumen_ia || null);
      }
    } catch (error) {
      console.error("Error al cargar plan IA:", error);
    }
  };

  const handleMarcarTarea = async (idTarea: number, completada: boolean) => {
    try {
      const result = await planesService.marcarTarea(idTarea, completada);
      if (result.success) {
        toast.success(completada ? t('studyPlans.taskCompleted') : t('studyPlans.taskPending'));
        cargarDetalle();
      } else {
        toast.error(t('studyPlans.errorUpdatingTask'));
      }
    } catch (error) {
      toast.error(t('studyPlans.errorUpdatingTask'));
    }
  };

  const handleIniciarTest = (temasSemana: string[]) => {
    if (!detalle?.plan.id_proceso) return;
    
    // Navegar a crear test con los parámetros de los temas de la semana
    const params = new URLSearchParams({
      proceso: detalle.plan.id_proceso.toString(),
      temas: temasSemana.join(","),
      modo: "simulacion",
    });
    
    navigate(`/test?${params.toString()}`);
  };

  const detectarTipoTest = (titulo: string, descripcion: string): string => {
    const texto = `${titulo} ${descripcion}`.toLowerCase();
    
    if (texto.includes('psicotécnico') || texto.includes('psicotecnico')) {
      if (texto.includes('examen') || texto.includes('simulacro')) {
        return '/simulacro-psicotecnico';
      }
      return '/test-psicotecnico';
    }
    
    if (texto.includes('examen') || texto.includes('simulacro')) {
      return '/simulacro';
    }
    
    return '/test';
  };

  const extraerTemaYSeccion = (tarea: any, etapa: any) => {
    // Extraer tema del título de la tarea
    // Formato: "Repasar y hacer test del tema: Nombre del Tema"
    let tema = '';
    const matchTema = tarea.titulo.match(/tema:\s*(.+?)(?:\s*$)/i);
    if (matchTema && matchTema[1]) {
      tema = matchTema[1].trim();
    }

    // Intentar extraer sección de la descripción de la etapa si está disponible
    let seccion = '';
    if (etapa?.descripcion) {
      // La descripción de la etapa contiene "Temas: tema1, tema2, ..."
      // Podríamos intentar encontrar una sección relacionada
      const descripcionLower = etapa.descripcion.toLowerCase();
      
      // Buscar patrones comunes de secciones
      if (descripcionLower.includes('sección:') || descripcionLower.includes('seccion:')) {
        const matchSeccion = etapa.descripcion.match(/secci[oó]n:\s*([^,\n]+)/i);
        if (matchSeccion && matchSeccion[1]) {
          seccion = matchSeccion[1].trim();
        }
      }
    }

    return { tema, seccion };
  };

  const handleClickTarea = (tarea: any, etapa?: any) => {
    if (!detalle?.plan.id_proceso) return;
    
    const tipoTest = detectarTipoTest(tarea.titulo, tarea.descripcion || '');
    const { tema, seccion } = extraerTemaYSeccion(tarea, etapa);
    
    // Construir parámetros de navegación
    const params = new URLSearchParams({
      proceso: detalle.plan.id_proceso.toString(),
      modo: tipoTest.includes('simulacro') ? 'examen' : 'simulacion',
    });

    if (tema) {
      params.append('temas', tema);
    }
    
    if (seccion) {
      params.append('secciones', seccion);
    }
    
    navigate(`${tipoTest}?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">{t('studyPlans.loadingPlan')}</p>
        </div>
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">{t('studyPlans.planNotFound')}</p>
            <Button onClick={() => navigate("/planes-estudio")} className="mt-4">
              {t('studyPlans.backToPlans')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { plan, etapas } = detalle || { plan: null, etapas: [] };

  return (
    <div className="container mx-auto p-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/planes-estudio")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('common.back')}
      </Button>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{plan.titulo}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {plan.descripcion || t('studyPlans.noDescription')}
                </CardDescription>
              </div>
              <Badge className="text-sm px-4 py-1.5 shrink-0">{plan.estado}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3 mb-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">{t('studyPlans.startDate')}</p>
                  <p className="text-lg font-medium">
                    {new Date(plan.fecha_inicio).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">{t('studyPlans.endDate')}</p>
                  <p className="text-lg font-medium">
                    {new Date(plan.fecha_fin).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">{t('studyPlans.totalProgress')}</p>
                  <p className="text-lg font-medium">
                    {parseFloat(plan.progreso || '0').toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Progress value={parseFloat(plan.progreso || '0')} className="h-2" />
            </div>

            {resumenIA && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-lg">
                <p className="text-sm leading-relaxed whitespace-pre-line">{resumenIA}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {planIA && planIA.length > 0 ? (
          <Tabs defaultValue="plan-ia" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="plan-ia">
                <Brain className="mr-2 h-4 w-4" />
                {t('studyPlans.aiWeeklyPlan')}
              </TabsTrigger>
              <TabsTrigger value="etapas">
                <BookOpen className="mr-2 h-4 w-4" />
                {t('studyPlans.manualStages')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plan-ia">
              <Card>
                <CardHeader>
                  <CardTitle>{t('studyPlans.aiGeneratedPlan')}</CardTitle>
                  <CardDescription>
                    {t('studyPlans.followPlanDayByDay')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {planIA && Array.isArray(planIA) && planIA.map((semana, index) => (
                      <AccordionItem key={index} value={`semana-${semana.semana}`}>
                        <AccordionTrigger>
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="text-left flex-1">
                              <p className="font-semibold text-base">{t('studyPlans.week')} {semana.semana}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {new Date(semana.fecha_inicio).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })} - {new Date(semana.fecha_fin).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-6 pt-2">
                            {/* Temas de la semana */}
                            {semana.temas_semana && Array.isArray(semana.temas_semana) && semana.temas_semana.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-3">{t('studyPlans.weekTopics')}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {semana.temas_semana.slice(0, 12).map((tema, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="secondary" 
                                      className="justify-start text-xs py-1.5 px-3 font-normal"
                                    >
                                      {tema.length > 50 ? tema.substring(0, 50) + '...' : tema}
                                    </Badge>
                                  ))}
                                  {semana.temas_semana.length > 12 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{semana.temas_semana.length - 12} más
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  onClick={() => handleIniciarTest(semana.temas_semana)}
                                  size="sm"
                                  className="mt-4"
                                >
                                  <PlayCircle className="mr-2 h-4 w-4" />
                                  {t('studyPlans.startWeekTest')}
                                </Button>
                              </div>
                            )}

                            {/* Objetivos */}
                            {semana.objetivos && Array.isArray(semana.objetivos) && semana.objetivos.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-3">{t('studyPlans.objectives')}</h4>
                                <ul className="space-y-2">
                                  {semana.objetivos.map((objetivo, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm">
                                      <span className="text-primary mt-1">•</span>
                                      <span className="text-muted-foreground flex-1">{objetivo}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Actividades diarias */}
                            {semana.actividades && Array.isArray(semana.actividades) && semana.actividades.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-3">{t('studyPlans.dailyActivities')}</h4>
                                <div className="space-y-3">
                                  {semana.actividades.map((actividad, idx) => (
                                    <div key={idx} className="p-4 bg-muted/50 border border-border rounded-lg">
                                      <div className="flex justify-between items-start mb-2">
                                        <p className="font-medium text-sm">
                                          {t('studyPlans.day')} {actividad.dia} - {new Date(actividad.fecha).toLocaleDateString('es-ES', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric'
                                          })}
                                        </p>
                                        <Badge variant="outline" className="text-xs">
                                          {actividad.duracion_horas}h
                                        </Badge>
                                      </div>
                                      <p className="text-sm mb-1">
                                        <span className="font-medium">{t('studyPlans.topic')}:</span> {actividad.tema}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {actividad.actividad}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {semana.notas && (
                              <div className="p-3 bg-muted rounded-lg">
                                <h4 className="font-medium mb-2">{t('studyPlans.notes')}</h4>
                                <p className="text-sm text-muted-foreground">{semana.notas}</p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="etapas">
              {etapas.length === 0 ? (
              <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {t('studyPlans.noManualStages')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('studyPlans.planStages')}</CardTitle>
                    <CardDescription>
                      {t('studyPlans.autoGeneratedTasks')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {etapas && Array.isArray(etapas) && etapas.map((etapa) => {
                        const progresoEtapa = etapa.tareas && etapa.tareas.length > 0
                          ? (etapa.tareas.filter(t => t.completada === 1).length / etapa.tareas.length) * 100
                          : 0;
                        const tareasCompletadas = etapa.tareas ? etapa.tareas.filter((t) => t.completada === 1).length : 0;

                        return (
                          <AccordionItem key={etapa.id} value={`etapa-${etapa.id}`}>
                            <AccordionTrigger>
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="text-left">
                                  <p className="font-medium">{etapa.titulo}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {etapa.descripcion}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {tareasCompletadas}/{etapa.tareas ? etapa.tareas.length : 0}
                                  </span>
                                  <Progress value={progresoEtapa} className="w-20" />
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3 pt-2">
                                {etapa.tareas && Array.isArray(etapa.tareas) && etapa.tareas.map((tarea) => (
                                  <div
                                    key={tarea.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => handleClickTarea(tarea, etapa)}
                                  >
                                    <Checkbox
                                      checked={tarea.completada === 1}
                                      onCheckedChange={(checked) => {
                                        checked && handleMarcarTarea(tarea.id, checked as boolean);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <p className={`font-medium ${tarea.completada === 1 ? "line-through text-muted-foreground" : ""}`}>
                                        {tarea.titulo}
                                      </p>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {tarea.descripcion}
                                      </p>
                                      {(tarea.titulo.toLowerCase().includes('test') || 
                                        tarea.titulo.toLowerCase().includes('examen') || 
                                        tarea.titulo.toLowerCase().includes('psicotécnico')) && (
                                        <Badge variant="outline" className="mt-2">
                                          <PlayCircle className="mr-1 h-3 w-3" />
                                          Click para realizar
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : etapas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Este plan aún no tiene contenido generado
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Etapas del Plan</CardTitle>
              <CardDescription>
                Sigue tu progreso semana a semana
              </CardDescription>
            </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {etapas && Array.isArray(etapas) && etapas.map((etapa) => {
                    const progresoEtapa = etapa.tareas && etapa.tareas.length > 0
                    ? (etapa.tareas.filter(t => t.completada === 1).length / etapa.tareas.length) * 100
                    : 0;
                  const tareasCompletadas = etapa.tareas ? etapa.tareas.filter((t) => t.completada === 1).length : 0;

                  return (
                    <AccordionItem key={etapa.id} value={`etapa-${etapa.id}`}>
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="text-left flex-1">
                            <p className="font-semibold text-base">{etapa.titulo}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {tareasCompletadas}/{etapa.tareas ? etapa.tareas.length : 0} tareas completadas
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-medium">
                              {progresoEtapa.toFixed(0)}%
                            </span>
                            <Progress value={progresoEtapa} className="w-24 h-2" />
                          </div>
                        </div>
                      </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-6 pt-2">
                            {/* Temas de la etapa */}
                            {etapa.descripcion && (
                              <div>
                                <h4 className="font-semibold text-sm mb-3">Temas:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {etapa.descripcion.split(',').slice(0, 12).map((tema: string, idx: number) => {
                                    const temaLimpio = tema.trim();
                                    return (
                                      <Badge 
                                        key={idx} 
                                        variant="secondary" 
                                        className="justify-start text-xs py-1.5 px-3 font-normal"
                                      >
                                        {temaLimpio.length > 50 ? temaLimpio.substring(0, 50) + '...' : temaLimpio}
                                      </Badge>
                                    );
                                  })}
                                  {etapa.descripcion.split(',').length > 12 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{etapa.descripcion.split(',').length - 12} más
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Tareas de la etapa */}
                            {etapa.tareas && Array.isArray(etapa.tareas) && etapa.tareas.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-3">Tareas:</h4>
                                <div className="space-y-3">
                                   {etapa.tareas.map((tarea) => (
                                    <div
                                      key={tarea.id}
                                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                                      onClick={() => handleClickTarea(tarea, etapa)}
                                    >
                                      <Checkbox
                                        checked={tarea.completada === 1}
                                        onCheckedChange={(checked) => {
                                          checked && handleMarcarTarea(tarea.id, checked as boolean);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1"
                                      />
                                      <div className="flex-1">
                                        <p className={`font-medium ${tarea.completada === 1 ? "line-through text-muted-foreground" : ""}`}>
                                          {tarea.titulo}
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {tarea.descripcion}
                                        </p>
                                        {(tarea.titulo.toLowerCase().includes('test') || 
                                          tarea.titulo.toLowerCase().includes('examen') || 
                                          tarea.titulo.toLowerCase().includes('psicotécnico')) && (
                                          <Badge variant="outline" className="mt-2">
                                            <PlayCircle className="mr-1 h-3 w-3" />
                                            Click para realizar
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
