import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { planesService, PlanDetalle } from "@/services/planesService";
import { useTranslateContent } from "@/hooks/useTranslateContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Calendar, BookOpen, Target, PlayCircle, Brain, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

const localeMap: Record<string, string> = {
  es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE', pt: 'pt-PT', zh: 'zh-CN'
};

export default function PlanEstudioDetalle() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { translateTexts, isTranslating, needsTranslation, translationFailed, retryTranslation } = useTranslateContent();
  const dateLocale = localeMap[i18n.language] || 'es-ES';
  const [detalle, setDetalle] = useState<PlanDetalle | null>(null);
  const [planIA, setPlanIA] = useState<SemanaPlan[] | null>(null);
  const [resumenIA, setResumenIA] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados para traducciones - solo cabecera/resumen al inicio
  const [translatedResumen, setTranslatedResumen] = useState<string | null>(null);
  const [translatedDescripcion, setTranslatedDescripcion] = useState<string | null>(null);
  const [translatedTitulo, setTranslatedTitulo] = useState<string | null>(null);
  const [translatedEstado, setTranslatedEstado] = useState<string | null>(null);
  
  // Traducciones lazy por semana (solo cuando se expande)
  const [translatedWeeks, setTranslatedWeeks] = useState<Record<number, SemanaPlan>>({});
  const [translatingWeek, setTranslatingWeek] = useState<number | null>(null);
  
  // Traducciones lazy por etapa (solo cuando se expande) - usar string como key porque PHP devuelve IDs como string
  const [translatedEtapasMap, setTranslatedEtapasMap] = useState<Record<string, any>>({});
  const [translatingEtapa, setTranslatingEtapa] = useState<string | number | null>(null);
  
  // Pre-traducciones de títulos y descripciones de etapas (se cargan al inicio)
  const [preTranslatedEtapas, setPreTranslatedEtapas] = useState<Record<string, { titulo: string; descripcion: string }>>({});
  const [isPreTranslatingEtapas, setIsPreTranslatingEtapas] = useState(false);

  useEffect(() => {
    if (id) {
      cargarDetalle();
      cargarPlanIA();
    }
  }, [id]);

  // Efecto para traducir el título y descripción del plan
  useEffect(() => {
    const translatePlanInfo = async () => {
      if (!detalle?.plan) {
        setTranslatedTitulo(null);
        setTranslatedDescripcion(null);
        setTranslatedEstado(null);
        return;
      }
      
      if (!needsTranslation) {
        setTranslatedTitulo(detalle.plan.titulo || null);
        setTranslatedDescripcion(detalle.plan.descripcion || null);
        setTranslatedEstado(detalle.plan.estado || null);
        return;
      }
      
      const textsToTranslate: string[] = [];
      if (detalle.plan.titulo) textsToTranslate.push(detalle.plan.titulo);
      if (detalle.plan.descripcion) textsToTranslate.push(detalle.plan.descripcion);
      if (detalle.plan.estado) textsToTranslate.push(detalle.plan.estado);
      
      if (textsToTranslate.length > 0) {
        const translations = await translateTexts(textsToTranslate);
        let idx = 0;
        if (detalle.plan.titulo) setTranslatedTitulo(translations[idx++]);
        if (detalle.plan.descripcion) setTranslatedDescripcion(translations[idx++]);
        if (detalle.plan.estado) setTranslatedEstado(translations[idx++]);
      }
    };
    translatePlanInfo();
  }, [detalle?.plan?.titulo, detalle?.plan?.descripcion, detalle?.plan?.estado, i18n.language, needsTranslation, translateTexts]);

  // Efecto para traducir solo el resumen al cargar (no todo el plan)
  useEffect(() => {
    const translateResumen = async () => {
      if (!needsTranslation) {
        setTranslatedResumen(resumenIA);
        return;
      }
      if (resumenIA) {
        const [translated] = await translateTexts([resumenIA]);
        setTranslatedResumen(translated);
      } else {
        setTranslatedResumen(null);
      }
    };
    translateResumen();
  }, [resumenIA, i18n.language, needsTranslation, translateTexts]);

  // Limpiar traducciones cuando cambia el idioma
  useEffect(() => {
    setTranslatedWeeks({});
    setTranslatedEtapasMap({});
    setPreTranslatedEtapas({});
  }, [i18n.language]);

  // Pre-traducir títulos y descripciones de etapas al cargar (para mostrar rápido)
  useEffect(() => {
    const preTranslateEtapas = async () => {
      const etapas = detalle?.etapas;
      if (!etapas || etapas.length === 0 || !needsTranslation) {
        setPreTranslatedEtapas({});
        return;
      }
      
      setIsPreTranslatingEtapas(true);
      
      const textsToTranslate: string[] = [];
      const etapaIds: string[] = [];
      
      etapas.forEach((etapa: any) => {
        const etapaIdStr = String(etapa.id);
        etapaIds.push(etapaIdStr);
        textsToTranslate.push(etapa.titulo || '');
        textsToTranslate.push(etapa.descripcion || '');
      });
      
      try {
        const translations = await translateTexts(textsToTranslate);
        const preTranslated: Record<string, { titulo: string; descripcion: string }> = {};
        
        etapaIds.forEach((id, idx) => {
          preTranslated[id] = {
            titulo: translations[idx * 2] || '',
            descripcion: translations[idx * 2 + 1] || ''
          };
        });
        
        setPreTranslatedEtapas(preTranslated);
      } catch (error) {
        console.error('Error pre-translating etapas:', error);
      }
      
      setIsPreTranslatingEtapas(false);
    };
    
    preTranslateEtapas();
  }, [detalle?.etapas, i18n.language, needsTranslation, translateTexts]);

  // Función para traducir una semana específica cuando se expande
  const translateWeek = async (weekIndex: number) => {
    if (!planIA || !planIA[weekIndex] || !needsTranslation) return;
    if (translatedWeeks[weekIndex]) return; // Ya traducida
    
    setTranslatingWeek(weekIndex);
    const semana = planIA[weekIndex];
    
    const allTexts: string[] = [];
    const textMap: { field: string; index?: number }[] = [];

    // Temas
    semana.temas_semana?.forEach((tema, tIdx) => {
      if (tema) {
        allTexts.push(tema);
        textMap.push({ field: 'temas_semana', index: tIdx });
      }
    });
    // Objetivos
    semana.objetivos?.forEach((obj, oIdx) => {
      if (obj) {
        allTexts.push(obj);
        textMap.push({ field: 'objetivos', index: oIdx });
      }
    });
    // Actividades
    semana.actividades?.forEach((act, aIdx) => {
      if (act.tema) {
        allTexts.push(act.tema);
        textMap.push({ field: 'actividad_tema', index: aIdx });
      }
      if (act.actividad) {
        allTexts.push(act.actividad);
        textMap.push({ field: 'actividad_actividad', index: aIdx });
      }
    });
    // Notas
    if (semana.notas) {
      allTexts.push(semana.notas);
      textMap.push({ field: 'notas' });
    }

    if (allTexts.length > 0) {
      try {
        const translations = await translateTexts(allTexts);
        const translatedSemana: SemanaPlan = JSON.parse(JSON.stringify(semana));

        textMap.forEach((map, idx) => {
          if (map.field === 'temas_semana' && map.index !== undefined) {
            translatedSemana.temas_semana[map.index] = translations[idx];
          } else if (map.field === 'objetivos' && map.index !== undefined) {
            translatedSemana.objetivos[map.index] = translations[idx];
          } else if (map.field === 'actividad_tema' && map.index !== undefined) {
            translatedSemana.actividades[map.index].tema = translations[idx];
          } else if (map.field === 'actividad_actividad' && map.index !== undefined) {
            translatedSemana.actividades[map.index].actividad = translations[idx];
          } else if (map.field === 'notas') {
            translatedSemana.notas = translations[idx];
          }
        });

        setTranslatedWeeks(prev => ({ ...prev, [weekIndex]: translatedSemana }));
      } catch (error) {
        console.error('Error translating week:', error);
      }
    }
    setTranslatingWeek(null);
  };

  // Handler para cuando se expande un acordeón de semana
  const handleWeekAccordionChange = (value: string) => {
    if (value && needsTranslation) {
      const match = value.match(/semana-(\d+)/);
      if (match) {
        const weekNum = parseInt(match[1]);
        const weekIndex = planIA?.findIndex(s => s.semana === weekNum);
        if (weekIndex !== undefined && weekIndex >= 0) {
          translateWeek(weekIndex);
        }
      }
    }
  };

  // Función para traducir solo las tareas de una etapa cuando se expande
  // (título y descripción ya están pre-traducidos)
  const translateEtapa = async (etapaId: string | number) => {
    const etapas = detalle?.etapas;
    if (!etapas || !needsTranslation) return;
    
    const etapaIdStr = String(etapaId);
    if (translatedEtapasMap[etapaIdStr]) return; // Ya traducida
    
    const etapa = etapas.find(e => String(e.id) === etapaIdStr);
    if (!etapa || !etapa.tareas || etapa.tareas.length === 0) {
      // Si no hay tareas, marcar como traducida con pre-traducción
      const preTranslated = preTranslatedEtapas[etapaIdStr];
      if (preTranslated) {
        const translatedEtapa = JSON.parse(JSON.stringify(etapa));
        translatedEtapa.titulo = preTranslated.titulo;
        translatedEtapa.descripcion = preTranslated.descripcion;
        setTranslatedEtapasMap(prev => ({ ...prev, [etapaIdStr]: translatedEtapa }));
      }
      return;
    }
    
    setTranslatingEtapa(etapaId);
    
    // Solo traducir tareas (título y descripción de etapa ya están pre-traducidos)
    const allTexts: string[] = [];
    const textMap: { tareaIdx: number; field: 'titulo' | 'descripcion' }[] = [];

    etapa.tareas.forEach((tarea: any, tIdx: number) => {
      if (tarea.titulo) {
        allTexts.push(tarea.titulo);
        textMap.push({ tareaIdx: tIdx, field: 'titulo' });
      }
      if (tarea.descripcion) {
        allTexts.push(tarea.descripcion);
        textMap.push({ tareaIdx: tIdx, field: 'descripcion' });
      }
    });

    if (allTexts.length > 0) {
      try {
        const translations = await translateTexts(allTexts);
        const translatedEtapa = JSON.parse(JSON.stringify(etapa));
        
        // Usar título y descripción pre-traducidos
        const preTranslated = preTranslatedEtapas[etapaIdStr];
        if (preTranslated) {
          translatedEtapa.titulo = preTranslated.titulo;
          translatedEtapa.descripcion = preTranslated.descripcion;
        }

        // Aplicar traducciones de tareas
        textMap.forEach((map, idx) => {
          translatedEtapa.tareas[map.tareaIdx][map.field] = translations[idx];
        });

        setTranslatedEtapasMap(prev => ({ ...prev, [etapaIdStr]: translatedEtapa }));
      } catch (error) {
        console.error('Error translating etapa tasks:', error);
      }
    }
    setTranslatingEtapa(null);
  };

  // Handler para cuando se expande un acordeón de etapa
  const handleEtapaAccordionChange = (value: string) => {
    if (value && needsTranslation) {
      const match = value.match(/etapa-(\d+)/);
      if (match) {
        const etapaId = match[1];
        translateEtapa(etapaId);
      }
    }
  };

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

      {/* Aviso de fallo de traducción */}
      {needsTranslation && translationFailed && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{t('common.translationFailed') || 'No se ha podido traducir el contenido (problema de conexión)'}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                retryTranslation();
                // Forzar recarga del detalle para reintentar traducciones
                if (id) {
                  cargarDetalle();
                  cargarPlanIA();
                }
              }}
              className="ml-4"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('common.retry') || 'Reintentar'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{translatedTitulo || plan.titulo}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {translatedDescripcion || plan.descripcion || t('studyPlans.noDescription')}
                </CardDescription>
              </div>
              <Badge className="text-sm px-4 py-1.5 shrink-0">{translatedEstado || plan.estado}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3 mb-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">{t('studyPlans.startDate')}</p>
                  <p className="text-lg font-medium">
                    {new Date(plan.fecha_inicio).toLocaleDateString(dateLocale, {
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
                    {new Date(plan.fecha_fin).toLocaleDateString(dateLocale, {
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

            {(translatedResumen || resumenIA) && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-lg">
                {isTranslating && needsTranslation && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('common.translating')}
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-line">{translatedResumen || resumenIA}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {planIA && planIA.length > 0 ? (
          <Tabs defaultValue="plan-ia" className="w-full">
            {isTranslating && needsTranslation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-2 bg-muted rounded">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.translatingContent')}
              </div>
            )}
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
                  <Accordion type="single" collapsible className="w-full" onValueChange={handleWeekAccordionChange}>
                    {planIA && Array.isArray(planIA) && planIA.map((semanaOriginal, index) => {
                      // Usar semana traducida si existe, sino original
                      const semana = (needsTranslation && translatedWeeks[index]) ? translatedWeeks[index] : semanaOriginal;
                      const isTranslatingThisWeek = translatingWeek === index;
                      
                      return (
                      <AccordionItem key={index} value={`semana-${semanaOriginal.semana}`}>
                        <AccordionTrigger>
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="text-left flex-1">
                              <p className="font-semibold text-base">
                                {t('studyPlans.week')} {semanaOriginal.semana}
                                {isTranslatingThisWeek && (
                                  <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {new Date(semanaOriginal.fecha_inicio).toLocaleDateString(dateLocale, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })} - {new Date(semanaOriginal.fecha_fin).toLocaleDateString(dateLocale, {
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
                                      +{semana.temas_semana.length - 12} {t('studyPlans.more')}
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
                                          {t('studyPlans.day')} {actividad.dia} - {new Date(actividad.fecha).toLocaleDateString(dateLocale, {
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
                      );
                    })}
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
                    <Accordion type="single" collapsible className="w-full" onValueChange={handleEtapaAccordionChange}>
                      {etapas.map((etapaOriginal) => {
                        // Usar etapa traducida si existe, sino usar pre-traducción para título/descripción
                        const etapaIdStr = String(etapaOriginal.id);
                        const fullTranslated = translatedEtapasMap[etapaIdStr];
                        const preTranslated = preTranslatedEtapas[etapaIdStr];
                        
                        // Para el título y descripción: usar fullTranslated > preTranslated > original
                        const displayTitulo = needsTranslation 
                          ? (fullTranslated?.titulo || preTranslated?.titulo || etapaOriginal.titulo)
                          : etapaOriginal.titulo;
                        const displayDescripcion = needsTranslation 
                          ? (fullTranslated?.descripcion || preTranslated?.descripcion || etapaOriginal.descripcion)
                          : etapaOriginal.descripcion;
                        
                        // Para las tareas: usar fullTranslated si existe, sino original
                        const etapa = fullTranslated || etapaOriginal;
                        
                        const isTranslatingThisEtapa = String(translatingEtapa) === etapaIdStr;
                        const progresoEtapa = etapaOriginal.tareas && etapaOriginal.tareas.length > 0
                          ? (etapaOriginal.tareas.filter((t: any) => t.completada === 1).length / etapaOriginal.tareas.length) * 100
                          : 0;
                        const tareasCompletadas = etapaOriginal.tareas ? etapaOriginal.tareas.filter((t: any) => t.completada === 1).length : 0;

                        return (
                          <AccordionItem key={etapaOriginal.id} value={`etapa-${etapaOriginal.id}`}>
                            <AccordionTrigger>
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="text-left">
                                  <p className="font-medium">
                                    {isPreTranslatingEtapas && needsTranslation ? (
                                      <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    {displayTitulo}
                                    {isTranslatingThisEtapa && (
                                      <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />
                                    )}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {displayDescripcion?.length > 100 ? displayDescripcion.substring(0, 100) + '...' : displayDescripcion}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {tareasCompletadas}/{etapaOriginal.tareas ? etapaOriginal.tareas.length : 0}
                                  </span>
                                  <Progress value={progresoEtapa} className="w-20" />
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3 pt-2">
                                {etapa.tareas && Array.isArray(etapa.tareas) && etapa.tareas.map((tarea: any, tareaIdx: number) => {
                                  const tareaOriginal = etapaOriginal.tareas[tareaIdx];
                                  return (
                                  <div
                                    key={tareaOriginal.id}
                                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => handleClickTarea(tareaOriginal, etapaOriginal)}
                                  >
                                    <Checkbox
                                      checked={tareaOriginal.completada === 1}
                                      onCheckedChange={(checked) => {
                                        checked && handleMarcarTarea(tareaOriginal.id, checked as boolean);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <p className={`font-medium ${tareaOriginal.completada === 1 ? "line-through text-muted-foreground" : ""}`}>
                                        {tarea.titulo}
                                      </p>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {tarea.descripcion}
                                      </p>
                                      {(tareaOriginal.titulo.toLowerCase().includes('test') || 
                                        tareaOriginal.titulo.toLowerCase().includes('examen') || 
                                        tareaOriginal.titulo.toLowerCase().includes('psicotécnico')) && (
                                        <Badge variant="outline" className="mt-2">
                                          <PlayCircle className="mr-1 h-3 w-3" />
                                          {t('studyPlans.clickToTake')}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  );
                                })}
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
                {t('studyPlans.noPlanContent')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('studyPlans.planStages')}</CardTitle>
              <CardDescription>
                {t('studyPlans.followProgress')}
              </CardDescription>
            </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full" onValueChange={handleEtapaAccordionChange}>
                  {etapas.map((etapaOriginal) => {
                    // Usar etapa traducida si existe, sino usar pre-traducción para título/descripción
                    const etapaIdStr = String(etapaOriginal.id);
                    const fullTranslated = translatedEtapasMap[etapaIdStr];
                    const preTranslated = preTranslatedEtapas[etapaIdStr];
                    
                    // Para el título y descripción: usar fullTranslated > preTranslated > original
                    const displayTitulo = needsTranslation 
                      ? (fullTranslated?.titulo || preTranslated?.titulo || etapaOriginal.titulo)
                      : etapaOriginal.titulo;
                    const displayDescripcion = needsTranslation 
                      ? (fullTranslated?.descripcion || preTranslated?.descripcion || etapaOriginal.descripcion)
                      : etapaOriginal.descripcion;
                    
                    // Para las tareas: usar fullTranslated si existe, sino original
                    const etapa = fullTranslated || etapaOriginal;
                    
                    const isTranslatingThisEtapa = String(translatingEtapa) === etapaIdStr;
                    const progresoEtapa = etapaOriginal.tareas && etapaOriginal.tareas.length > 0
                      ? (etapaOriginal.tareas.filter((t: any) => t.completada === 1).length / etapaOriginal.tareas.length) * 100
                      : 0;
                    const tareasCompletadas = etapaOriginal.tareas ? etapaOriginal.tareas.filter((t: any) => t.completada === 1).length : 0;

                    return (
                      <AccordionItem key={etapaOriginal.id} value={`etapa-${etapaOriginal.id}`}>
                        <AccordionTrigger>
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="text-left flex-1">
                              <p className="font-semibold text-base">
                                {isPreTranslatingEtapas && needsTranslation ? (
                                  <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                {displayTitulo}
                                {isTranslatingThisEtapa && (
                                  <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {tareasCompletadas}/{etapaOriginal.tareas ? etapaOriginal.tareas.length : 0} {t('studyPlans.tasksCompleted')}
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
                              {displayDescripcion && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-3">{t('studyPlans.topics')}:</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {displayDescripcion.split(',').slice(0, 12).map((tema: string, idx: number) => {
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
                                    {displayDescripcion.split(',').length > 12 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{displayDescripcion.split(',').length - 12} {t('studyPlans.more')}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Tareas de la etapa */}
                              {etapa.tareas && Array.isArray(etapa.tareas) && etapa.tareas.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-3">{t('studyPlans.tasks')}:</h4>
                                  <div className="space-y-3">
                                     {etapa.tareas.map((tarea: any, tareaIdx: number) => {
                                      const tareaOriginal = etapaOriginal.tareas[tareaIdx];
                                      return (
                                      <div
                                        key={tareaOriginal.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                                        onClick={() => handleClickTarea(tareaOriginal, etapaOriginal)}
                                      >
                                        <Checkbox
                                          checked={tareaOriginal.completada === 1}
                                          onCheckedChange={(checked) => {
                                            checked && handleMarcarTarea(tareaOriginal.id, checked as boolean);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-1"
                                        />
                                        <div className="flex-1">
                                          <p className={`font-medium ${tareaOriginal.completada === 1 ? "line-through text-muted-foreground" : ""}`}>
                                            {tarea.titulo}
                                          </p>
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {tarea.descripcion}
                                          </p>
                                          {(tareaOriginal.titulo.toLowerCase().includes('test') || 
                                            tareaOriginal.titulo.toLowerCase().includes('examen') || 
                                            tareaOriginal.titulo.toLowerCase().includes('psicotécnico')) && (
                                            <Badge variant="outline" className="mt-2">
                                              <PlayCircle className="mr-1 h-3 w-3" />
                                              {t('studyPlans.clickToTake')}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      );
                                    })}
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
