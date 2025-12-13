import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { useTranslateContent } from '@/hooks/useTranslateContent';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calendar, Dumbbell, Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS, fr, de, pt, zhCN } from 'date-fns/locale';
import { toast } from 'sonner';

const API_BASE = 'https://oposiciones-test.com/api';

interface Ejercicio {
  nombre: string;
  series?: number | string;
  reps?: string;
  carga?: any;
  rpe?: string;
  tempo?: string;
  descanso?: string;
  notas?: string;
  escalado?: any;
  explicacion_neofita?: string;
}

interface Bloque {
  tipo?: string;
  descripcion?: string;
  explicacion_neofita?: string;
  ejercicios?: Ejercicio[];
  formato?: string;
  tc?: string;
  rondas?: number | null;
  descanso_entre_series?: string | null;
  rpe_objetivo?: string;
  escalado?: any;
  notas?: string;
}

interface Sesion {
  dia?: string;
  bloques?: Bloque[];
  finisher?: { opcionales?: { nombre: string; reps?: string }[] };
}

interface Semana {
  titulo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  resumen?: string;
  sesiones?: Sesion[];
  glosario?: { termino: string; significado: string }[];
}

const dateLocales: Record<string, typeof es> = {
  es, en: enUS, fr, de, pt, zh: zhCN
};

export default function PlanFisicoDetalle() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  
  const currentLocale = dateLocales[i18n.language] || es;

  const [plan, setPlan] = useState<any>(null);
  const [planIA, setPlanIA] = useState<Semana[]>([]);
  const [resumenIA, setResumenIA] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avance, setAvance] = useState<boolean[]>([]);
  const [ratio, setRatio] = useState(0);
  const [loadingWeek, setLoadingWeek] = useState<number | null>(null);
  const [imgLoading, setImgLoading] = useState<Record<string, boolean>>({});
  const [imgPreview, setImgPreview] = useState<Record<string, { url: string; credit?: string }[]>>({});
  
  // Estados para traducciones
  const [translatedResumen, setTranslatedResumen] = useState<string | null>(null);
  const [translatedPlanIA, setTranslatedPlanIA] = useState<Semana[]>([]);

  useEffect(() => {
    if (id && user) {
      fetchPlan();
    }
  }, [id, user]);

  // Efecto para traducir el contenido cuando cambia el idioma o se carga el plan
  useEffect(() => {
    const translateContent = async () => {
      if (!needsTranslation) {
        setTranslatedResumen(resumenIA);
        setTranslatedPlanIA(planIA);
        return;
      }

      // Traducir resumen
      if (resumenIA) {
        const [translated] = await translateTexts([resumenIA]);
        setTranslatedResumen(translated);
      }

      // Traducir planIA
      if (planIA && planIA.length > 0) {
        const allTexts: string[] = [];
        const textMap: { semana: number; field: string; indices?: number[] }[] = [];

        planIA.forEach((semana, semIdx) => {
          // Titulo
          if (semana.titulo) {
            allTexts.push(semana.titulo);
            textMap.push({ semana: semIdx, field: 'titulo' });
          }
          // Resumen
          if (semana.resumen) {
            allTexts.push(semana.resumen);
            textMap.push({ semana: semIdx, field: 'resumen' });
          }
          // Glosario
          semana.glosario?.forEach((g, gIdx) => {
            allTexts.push(g.termino);
            textMap.push({ semana: semIdx, field: 'glosario_termino', indices: [gIdx] });
            allTexts.push(g.significado);
            textMap.push({ semana: semIdx, field: 'glosario_significado', indices: [gIdx] });
          });
          // Sesiones
          semana.sesiones?.forEach((ses, sIdx) => {
            ses.bloques?.forEach((bloq, bIdx) => {
              if (bloq.tipo) {
                allTexts.push(bloq.tipo);
                textMap.push({ semana: semIdx, field: 'bloque_tipo', indices: [sIdx, bIdx] });
              }
              if (bloq.descripcion) {
                allTexts.push(bloq.descripcion);
                textMap.push({ semana: semIdx, field: 'bloque_descripcion', indices: [sIdx, bIdx] });
              }
              if (bloq.explicacion_neofita) {
                allTexts.push(bloq.explicacion_neofita);
                textMap.push({ semana: semIdx, field: 'bloque_explicacion', indices: [sIdx, bIdx] });
              }
              bloq.ejercicios?.forEach((ej, eIdx) => {
                if (ej.nombre) {
                  allTexts.push(ej.nombre);
                  textMap.push({ semana: semIdx, field: 'ejercicio_nombre', indices: [sIdx, bIdx, eIdx] });
                }
                if (ej.notas) {
                  allTexts.push(ej.notas);
                  textMap.push({ semana: semIdx, field: 'ejercicio_notas', indices: [sIdx, bIdx, eIdx] });
                }
                if (ej.explicacion_neofita) {
                  allTexts.push(ej.explicacion_neofita);
                  textMap.push({ semana: semIdx, field: 'ejercicio_explicacion', indices: [sIdx, bIdx, eIdx] });
                }
              });
            });
          });
        });

        if (allTexts.length > 0) {
          const translations = await translateTexts(allTexts);
          
          // Clonar planIA profundamente
          const translatedPlan: Semana[] = JSON.parse(JSON.stringify(planIA));

          textMap.forEach((map, idx) => {
            const sem = translatedPlan[map.semana];
            if (map.field === 'titulo') {
              sem.titulo = translations[idx];
            } else if (map.field === 'resumen') {
              sem.resumen = translations[idx];
            } else if (map.field === 'glosario_termino' && map.indices) {
              sem.glosario![map.indices[0]].termino = translations[idx];
            } else if (map.field === 'glosario_significado' && map.indices) {
              sem.glosario![map.indices[0]].significado = translations[idx];
            } else if (map.field === 'bloque_tipo' && map.indices) {
              sem.sesiones![map.indices[0]].bloques![map.indices[1]].tipo = translations[idx];
            } else if (map.field === 'bloque_descripcion' && map.indices) {
              sem.sesiones![map.indices[0]].bloques![map.indices[1]].descripcion = translations[idx];
            } else if (map.field === 'bloque_explicacion' && map.indices) {
              sem.sesiones![map.indices[0]].bloques![map.indices[1]].explicacion_neofita = translations[idx];
            } else if (map.field === 'ejercicio_nombre' && map.indices) {
              sem.sesiones![map.indices[0]].bloques![map.indices[1]].ejercicios![map.indices[2]].nombre = translations[idx];
            } else if (map.field === 'ejercicio_notas' && map.indices) {
              sem.sesiones![map.indices[0]].bloques![map.indices[1]].ejercicios![map.indices[2]].notas = translations[idx];
            } else if (map.field === 'ejercicio_explicacion' && map.indices) {
              sem.sesiones![map.indices[0]].bloques![map.indices[1]].ejercicios![map.indices[2]].explicacion_neofita = translations[idx];
            }
          });

          setTranslatedPlanIA(translatedPlan);
        } else {
          setTranslatedPlanIA(planIA);
        }
      }
    };

    translateContent();
  }, [planIA, resumenIA, i18n.language, needsTranslation, translateTexts]);

  const fetchPlan = async () => {
    if (!id || !user?.id) return;
    setLoading(true);
    try {
      const token = authService.getToken();
      const response = await fetch(
        `${API_BASE}/planes_fisicos.php?action=obtener&id_plan=${id}&id_usuario=${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setPlan(data.plan);
        setPlanIA(Array.isArray(data?.plan_ia?.plan) ? data.plan_ia.plan : []);
        setResumenIA(data?.plan_ia?.resumen || null);
        setAvance(data?.avance || []);
        setRatio(data?.ia_avance_ratio || 0);
      } else {
        toast.error(data.error || 'Error al cargar el plan');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const getTotalSemanas = () => {
    if (!plan?.fecha_inicio || !plan?.fecha_fin) return planIA?.length || 0;
    const start = new Date(plan.fecha_inicio);
    const end = new Date(plan.fecha_fin);
    const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return Math.max(planIA?.length || 0, Math.ceil(days / 7));
  };

  const handleGenerarSemana = async (idx: number) => {
    if (!id) return;
    setLoadingWeek(idx);
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE}/planes_fisicos.php?action=generar_semana`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_plan: Number(id),
          semana: idx + 1,
          fast: false,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Semana generada con IA');
        await fetchPlan();
      } else {
        toast.error(data.error || 'Error al generar la semana');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoadingWeek(null);
    }
  };

  const toggleAvance = async (idx: number, value: boolean) => {
    if (!id || !user?.id) return;
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_BASE}/planes_fisicos.php?action=avance`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_plan: Number(id),
          id_usuario: user.id,
          semana: idx,
          realizado: value,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const nuevo = Array.isArray(data.avance) ? data.avance : [...avance];
        setAvance(nuevo);
        const hechas = nuevo.filter(Boolean).length;
        const total = getTotalSemanas() || nuevo.length || 1;
        setRatio(hechas / total);
        toast.success(value ? 'Semana completada' : 'Semana marcada como pendiente');
      }
    } catch (error) {
      toast.error('Error al actualizar el avance');
    }
  };

  const handleBuscarImagen = async (params: {
    semanaIndex: number;
    dia: string;
    bidx: number;
    eidx: number;
    nombre: string;
    bloqueTipo?: string;
  }) => {
    const key = `${params.semanaIndex}-${params.dia}-${params.bidx}-${params.eidx}`;
    setImgLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const token = authService.getToken();
      const { data, error } = await supabase.functions.invoke('php-api-proxy', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: {
          endpoint: 'planes_fisicos.php',
          action: 'buscar_imagen_stock',
          ejercicio: params.nombre,
          tipo_prueba: plan?.tipo_prueba || '',
          limit: 4,
        },
      });

      if (error) {
        console.error('Error al buscar imagen:', error);
        toast.error('Error al buscar imágenes');
        return;
      }

      let entries: { url: string; credit?: string }[] = [];
      if (Array.isArray(data?.items) && data.items.length) {
        entries = data.items
          .map((it: any) => {
            const u = it?.media_url || it?.path || '';
            if (!u) return null;
            // Si ya es una URL completa, usarla directamente
            if (u.startsWith('http')) return { url: u, credit: it?.credit };
            // Si empieza con /api/, quitarlo antes de concatenar con API_BASE
            const cleanPath = u.startsWith('/api/') ? u.substring(4) : u;
            return { url: `${API_BASE}${cleanPath}`, credit: it?.credit };
          })
          .filter(Boolean);
      }

      if (entries.length) {
        setImgPreview((prev) => ({ ...prev, [key]: entries }));
      } else {
        toast.info('No se encontraron imágenes relevantes');
      }
    } catch (error) {
      console.error('Error al buscar imagen:', error);
      toast.error('Error al buscar imágenes');
    } finally {
      setImgLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderEjercicio = (
    ej: Ejercicio,
    ejidx: number,
    bloqTipo: string | undefined,
    semanaIndex: number,
    dia: string,
    bidx: number
  ) => {
    const key = `${semanaIndex}-${dia}-${bidx}-${ejidx}`;
    const preview = imgPreview[key];
    const loadingOne = !!imgLoading[key];

    const detalles: string[] = [];
    if (ej.series) detalles.push(`${t('physicalPlans.detail.series')}: ${ej.series}`);
    if (ej.reps) detalles.push(`${t('physicalPlans.detail.reps')}: ${ej.reps}`);
    if (ej.rpe) detalles.push(`${t('physicalPlans.detail.rpe')}: ${ej.rpe}`);
    if (ej.tempo) detalles.push(`${t('physicalPlans.detail.tempo')}: ${ej.tempo}`);
    if (ej.descanso) detalles.push(`${t('physicalPlans.detail.rest')}: ${ej.descanso}`);

    return (
      <div key={ejidx} className="border rounded-lg p-4 mb-3 bg-card">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h5 className="font-semibold flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />
              {ej.nombre}
            </h5>
            {detalles.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{detalles.join(' · ')}</p>
            )}
            {ej.notas && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">{t('physicalPlans.detail.notes')}:</span> {ej.notas}
              </p>
            )}
            {ej.explicacion_neofita && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                <p className="text-sm">
                  <span className="font-medium text-green-800 dark:text-green-200">
                    {t('physicalPlans.detail.forBeginners')}
                  </span>{' '}
                  {ej.explicacion_neofita}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              handleBuscarImagen({
                semanaIndex,
                dia,
                bidx,
                eidx: ejidx,
                nombre: ej.nombre,
                bloqueTipo: bloqTipo,
              })
            }
            disabled={loadingOne}
          >
            {loadingOne ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        {Array.isArray(preview) && preview.length > 0 && (
          <div className="mt-3">
            <div className="grid grid-cols-4 gap-2">
              {preview.slice(0, 4).map((img, i) => (
                <div key={i} className="aspect-video rounded overflow-hidden border">
                  <img
                    src={img.url}
                    alt={`${ej.nombre} ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            {preview[0]?.credit && (
              <p className="text-xs text-muted-foreground mt-2">{t('physicalPlans.detail.source')}: {preview[0].credit}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <p>{t('physicalPlans.detail.notFound')}</p>
      </div>
    );
  }

  const totalSemanas = getTotalSemanas();

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate('/planes-fisicos')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('physicalPlans.detail.back')}
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">{plan.titulo}</CardTitle>
          <p className="text-muted-foreground">{plan.tipo_prueba}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">{t('physicalPlans.detail.description')}</h3>
            <p className="text-muted-foreground">{plan.descripcion || '-'}</p>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(plan.fecha_inicio), 'dd/MM/yyyy', { locale: currentLocale })} →{' '}
              {format(new Date(plan.fecha_fin), 'dd/MM/yyyy', { locale: currentLocale })}
            </span>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">{t('physicalPlans.detail.totalProgress')}</h3>
            <Progress value={ratio * 100} className="h-2 mb-2" />
            <p className="text-sm text-muted-foreground">{Math.round(ratio * 100)}% {t('physicalPlans.completed')}</p>
          </div>

          {(translatedResumen || resumenIA) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-1">{t('physicalPlans.detail.aiSummary')}</h3>
                {isTranslating && needsTranslation && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('common.translating')}
                  </div>
                )}
                <p className="text-muted-foreground">{translatedResumen || resumenIA}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('physicalPlans.detail.trainingPlan')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isTranslating && needsTranslation && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-2 bg-muted rounded">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.translatingContent')}
            </div>
          )}
          <Accordion type="single" collapsible className="w-full">
            {Array.from({ length: totalSemanas }).map((_, idx) => {
              const displayPlan = translatedPlanIA.length > 0 ? translatedPlanIA : planIA;
              const semana = displayPlan[idx] as Semana | undefined;
              const semanaN = idx + 1;

              return (
                <AccordionItem key={idx} value={`semana-${idx}`}>
                  <AccordionTrigger>
                    {semana
                      ? `${semana.titulo || `${t('common.week')} ${semanaN}`} (${format(
                          new Date(semana.fecha_inicio || ''),
                          'dd/MM/yyyy',
                          { locale: currentLocale }
                        )} → ${format(new Date(semana.fecha_fin || ''), 'dd/MM/yyyy', {
                          locale: currentLocale,
                        })})`
                      : `${t('common.week')} ${semanaN} (${t('physicalPlans.detail.notGenerated')})`}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`week-${idx}`}
                            checked={avance[idx] || false}
                            onCheckedChange={(checked) => toggleAvance(idx, checked as boolean)}
                          />
                          <label htmlFor={`week-${idx}`} className="text-sm">{t('physicalPlans.detail.markWeekCompleted', { week: semanaN })}</label>
                        </div>

                        {loadingWeek === idx ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerarSemana(idx)}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {semana ? t('physicalPlans.detail.regenerate') : t('physicalPlans.detail.generate')} {t('physicalPlans.detail.withAI')}
                          </Button>
                        )}
                      </div>

                      {semana ? (
                        <>
                          {semana.resumen && (
                            <div className="p-3 bg-muted rounded">
                              <h4 className="font-semibold mb-1">{t('physicalPlans.detail.weekFocus')}</h4>
                              <p className="text-sm">{semana.resumen}</p>
                            </div>
                          )}

                          {semana.glosario && semana.glosario.length > 0 && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border">
                              <h4 className="font-semibold mb-2">{t('physicalPlans.detail.glossary')}</h4>
                              {semana.glosario.map((g, i) => (
                                <div key={i} className="mb-2">
                                  <p className="font-medium text-sm">{g.termino}</p>
                                  <p className="text-sm text-muted-foreground">{g.significado}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {Array.isArray(semana.sesiones) &&
                            semana.sesiones.map((ses, sidx) => (
                              <div key={sidx} className="space-y-3">
                                <h4 className="font-bold text-lg">{ses.dia || `${t('physicalPlans.detail.session')} ${sidx + 1}`}</h4>
                                {Array.isArray(ses.bloques) &&
                                  ses.bloques.map((bloq, bidx) => (
                                    <div key={bidx} className="border-l-4 border-primary pl-4 space-y-2">
                                      <h5 className="font-semibold">{bloq.tipo || `${t('physicalPlans.detail.block')} ${bidx + 1}`}</h5>
                                      {bloq.descripcion && (
                                        <p className="text-sm text-muted-foreground">{bloq.descripcion}</p>
                                      )}
                                      {bloq.explicacion_neofita && (
                                        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                                          <p className="text-sm">
                                            <span className="font-medium">{t('physicalPlans.detail.easyExplanation')}:</span>{' '}
                                            {bloq.explicacion_neofita}
                                          </p>
                                        </div>
                                      )}
                                      {Array.isArray(bloq.ejercicios) &&
                                        bloq.ejercicios.map((ej, eidx) =>
                                          renderEjercicio(
                                            ej,
                                            eidx,
                                            bloq.tipo,
                                            idx,
                                            ses.dia || `Dia${sidx + 1}`,
                                            bidx
                                          )
                                        )}
                                    </div>
                                  ))}
                              </div>
                            ))}
                        </>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          {t('physicalPlans.detail.weekNotGenerated')}
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
