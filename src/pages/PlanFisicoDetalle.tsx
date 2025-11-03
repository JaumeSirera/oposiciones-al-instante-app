import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calendar, Dumbbell, Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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

export default function PlanFisicoDetalle() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<any>(null);
  const [planIA, setPlanIA] = useState<Semana[]>([]);
  const [resumenIA, setResumenIA] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avance, setAvance] = useState<boolean[]>([]);
  const [ratio, setRatio] = useState(0);
  const [loadingWeek, setLoadingWeek] = useState<number | null>(null);
  const [imgLoading, setImgLoading] = useState<Record<string, boolean>>({});
  const [imgPreview, setImgPreview] = useState<Record<string, { url: string; credit?: string }[]>>({});

  useEffect(() => {
    if (id && user) {
      fetchPlan();
    }
  }, [id, user]);

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
      const response = await fetch(`${API_BASE}/planes_fisicos.php?action=buscar_imagen_stock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: params.nombre,
          bloque: params.bloqueTipo || '',
          limit: 4,
        }),
      });
      const data = await response.json();

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
    if (ej.series) detalles.push(`Series: ${ej.series}`);
    if (ej.reps) detalles.push(`Reps: ${ej.reps}`);
    if (ej.rpe) detalles.push(`RPE: ${ej.rpe}`);
    if (ej.tempo) detalles.push(`Tempo: ${ej.tempo}`);
    if (ej.descanso) detalles.push(`Descanso: ${ej.descanso}`);

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
                <span className="font-medium">Notas:</span> {ej.notas}
              </p>
            )}
            {ej.explicacion_neofita && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                <p className="text-sm">
                  <span className="font-medium text-green-800 dark:text-green-200">
                    Para principiantes:
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
              <p className="text-xs text-muted-foreground mt-2">Fuente: {preview[0].credit}</p>
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
        <p>No se encontró el plan físico.</p>
      </div>
    );
  }

  const totalSemanas = getTotalSemanas();

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate('/planes-fisicos')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">{plan.titulo}</CardTitle>
          <p className="text-muted-foreground">{plan.tipo_prueba}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Descripción</h3>
            <p className="text-muted-foreground">{plan.descripcion || '-'}</p>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(plan.fecha_inicio), 'dd/MM/yyyy', { locale: es })} →{' '}
              {format(new Date(plan.fecha_fin), 'dd/MM/yyyy', { locale: es })}
            </span>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">Avance total</h3>
            <Progress value={ratio * 100} className="h-2 mb-2" />
            <p className="text-sm text-muted-foreground">{Math.round(ratio * 100)}% completado</p>
          </div>

          {resumenIA && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-1">Resumen IA</h3>
                <p className="text-muted-foreground">{resumenIA}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan de Entrenamiento (semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {Array.from({ length: totalSemanas }).map((_, idx) => {
              const semana = planIA[idx] as Semana | undefined;
              const semanaN = idx + 1;

              return (
                <AccordionItem key={idx} value={`semana-${idx}`}>
                  <AccordionTrigger>
                    {semana
                      ? `${semana.titulo || `Semana ${semanaN}`} (${format(
                          new Date(semana.fecha_inicio || ''),
                          'dd/MM/yyyy',
                          { locale: es }
                        )} → ${format(new Date(semana.fecha_fin || ''), 'dd/MM/yyyy', {
                          locale: es,
                        })})`
                      : `Semana ${semanaN} (sin generar)`}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={avance[idx] || false}
                            onCheckedChange={(checked) => toggleAvance(idx, checked as boolean)}
                          />
                          <span className="text-sm">Marcar semana {semanaN} como completada</span>
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
                            {semana ? 'Regenerar' : 'Generar'} con IA
                          </Button>
                        )}
                      </div>

                      {semana ? (
                        <>
                          {semana.resumen && (
                            <div className="p-3 bg-muted rounded">
                              <h4 className="font-semibold mb-1">Foco semanal</h4>
                              <p className="text-sm">{semana.resumen}</p>
                            </div>
                          )}

                          {semana.glosario && semana.glosario.length > 0 && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border">
                              <h4 className="font-semibold mb-2">Glosario</h4>
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
                                <h4 className="font-bold text-lg">{ses.dia || `Sesión ${sidx + 1}`}</h4>
                                {Array.isArray(ses.bloques) &&
                                  ses.bloques.map((bloq, bidx) => (
                                    <div key={bidx} className="border-l-4 border-primary pl-4 space-y-2">
                                      <h5 className="font-semibold">{bloq.tipo || `Bloque ${bidx + 1}`}</h5>
                                      {bloq.descripcion && (
                                        <p className="text-sm text-muted-foreground">{bloq.descripcion}</p>
                                      )}
                                      {bloq.explicacion_neofita && (
                                        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                                          <p className="text-sm">
                                            <span className="font-medium">Explicación fácil:</span>{' '}
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
                          Esta semana aún no ha sido generada. Haz clic en "Generar con IA" para crearla.
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
