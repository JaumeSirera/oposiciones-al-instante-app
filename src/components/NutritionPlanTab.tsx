import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  Sparkles, 
  UtensilsCrossed, 
  Apple, 
  Coffee, 
  Moon, 
  Cookie,
  Droplets,
  Pill,
  Clock,
  CheckCircle,
  XCircle,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface Comida {
  plato: string;
  calorias: number;
  proteinas: number;
  carbos: number;
  grasas: number;
  ingredientes: string[];
}

interface DiaComida {
  desayuno: Comida;
  almuerzo: Comida;
  cena: Comida;
  snacks: Comida[];
}

interface PlanSemanal {
  lunes: DiaComida;
  martes: DiaComida;
  miercoles: DiaComida;
  jueves: DiaComida;
  viernes: DiaComida;
  sabado: DiaComida;
  domingo: DiaComida;
}

interface Recomendaciones {
  pre_entreno: string[];
  post_entreno: string[];
  hidratacion: string[];
  suplementos: string[];
  timing_comidas: string[];
  alimentos_recomendados: string[];
  alimentos_evitar: string[];
}

interface PlanNutricional {
  id?: number;
  objetivo: string;
  calorias_objetivo: number;
  proteinas_objetivo: number;
  carbos_objetivo: number;
  grasas_objetivo: number;
  plan_semanal: PlanSemanal;
  recomendaciones: Recomendaciones;
}

interface Props {
  planFisicoId: number;
  tipoPrueba: string;
  nivelFisico?: string;
  diasSemana?: number;
}

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

const DIAS_LABELS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo'
};

export function NutritionPlanTab({ planFisicoId, tipoPrueba, nivelFisico, diasSemana }: Props) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<PlanNutricional | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('lunes');

  useEffect(() => {
    fetchPlan();
  }, [planFisicoId]);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const { data, error } = await supabase.functions.invoke('php-api-proxy', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: {
          endpoint: `planes_nutricionales.php?action=obtener&id_plan_fisico=${planFisicoId}`,
          method: 'GET'
        }
      });

      if (error) throw error;
      if (data?.success && data.plan_nutricional) {
        setPlan(data.plan_nutricional);
      }
    } catch (error) {
      console.error('Error al cargar plan nutricional:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerar = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generar-plan-nutricional', {
        body: {
          tipo_prueba: tipoPrueba,
          nivel_fisico: nivelFisico || 'intermedio',
          dias_semana: diasSemana || 4,
          objetivo_nutricional: 'rendimiento y recuperación'
        }
      });

      if (error) throw error;
      
      if (data?.success && data.plan) {
        setPlan(data.plan);
        toast.success(t('nutritionPlan.generated'));
      } else {
        throw new Error(data?.error || 'Error al generar');
      }
    } catch (error: any) {
      console.error('Error generando plan:', error);
      toast.error(error.message || t('nutritionPlan.generateError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleGuardar = async () => {
    if (!plan) return;
    
    setSaving(true);
    try {
      const token = authService.getToken();
      const { data, error } = await supabase.functions.invoke('php-api-proxy', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: {
          endpoint: 'planes_nutricionales.php?action=guardar',
          method: 'POST',
          id_plan_fisico: planFisicoId,
          objetivo: plan.objetivo,
          calorias_objetivo: plan.calorias_objetivo,
          proteinas_objetivo: plan.proteinas_objetivo,
          carbos_objetivo: plan.carbos_objetivo,
          grasas_objetivo: plan.grasas_objetivo,
          plan_semanal: plan.plan_semanal,
          recomendaciones: plan.recomendaciones
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success(t('nutritionPlan.saved'));
      } else {
        throw new Error(data?.error || 'Error al guardar');
      }
    } catch (error: any) {
      console.error('Error guardando plan:', error);
      toast.error(error.message || t('nutritionPlan.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const renderComida = (comida: Comida, tipo: 'desayuno' | 'almuerzo' | 'cena' | 'snack', icon: React.ReactNode) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">{comida.plato}</h4>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline">{comida.calorias} kcal</Badge>
              <Badge variant="secondary" className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                P: {comida.proteinas}g
              </Badge>
              <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                C: {comida.carbos}g
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                G: {comida.grasas}g
              </Badge>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{t('nutritionPlan.ingredients')}:</span>{' '}
                {comida.ingredientes.join(', ')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderDia = (dia: DiaComida) => (
    <div className="space-y-3">
      {renderComida(dia.desayuno, 'desayuno', <Coffee className="h-5 w-5 text-amber-600" />)}
      {renderComida(dia.almuerzo, 'almuerzo', <UtensilsCrossed className="h-5 w-5 text-green-600" />)}
      {renderComida(dia.cena, 'cena', <Moon className="h-5 w-5 text-indigo-600" />)}
      {dia.snacks && dia.snacks.map((snack, idx) => (
        <div key={idx}>
          {renderComida(snack, 'snack', <Cookie className="h-5 w-5 text-orange-600" />)}
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">{t('nutritionPlan.noPlan')}</h3>
          <p className="text-muted-foreground mb-6">
            {t('nutritionPlan.noPlanDescription', { type: tipoPrueba })}
          </p>
          <Button onClick={handleGenerar} disabled={generating} size="lg">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('nutritionPlan.generating')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('nutritionPlan.generateWithAI')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalDiario = plan.plan_semanal[selectedDay as keyof PlanSemanal];
  const calDia = totalDiario 
    ? totalDiario.desayuno.calorias + totalDiario.almuerzo.calorias + totalDiario.cena.calorias + 
      (totalDiario.snacks?.reduce((acc, s) => acc + s.calorias, 0) || 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header con objetivos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                {t('nutritionPlan.title')}
              </CardTitle>
              <CardDescription>{plan.objetivo}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerar} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">{t('nutritionPlan.regenerate')}</span>
              </Button>
              <Button size="sm" onClick={handleGuardar} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">{t('nutritionPlan.save')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-2xl font-bold">{plan.calorias_objetivo}</p>
              <p className="text-sm text-muted-foreground">{t('nutritionPlan.kcalDay')}</p>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{plan.proteinas_objetivo}g</p>
              <p className="text-sm text-muted-foreground">{t('nutritionPlan.protein')}</p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-600">{plan.carbos_objetivo}g</p>
              <p className="text-sm text-muted-foreground">{t('nutritionPlan.carbs')}</p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">{plan.grasas_objetivo}g</p>
              <p className="text-sm text-muted-foreground">{t('nutritionPlan.fats')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs principales */}
      <Tabs defaultValue="plan" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plan">{t('nutritionPlan.weeklyPlan')}</TabsTrigger>
          <TabsTrigger value="recomendaciones">{t('nutritionPlan.recommendations')}</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-4">
          {/* Selector de días */}
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((dia) => (
              <Button
                key={dia}
                variant={selectedDay === dia ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDay(dia)}
              >
                {DIAS_LABELS[dia]}
              </Button>
            ))}
          </div>

          {/* Progreso del día */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{t('nutritionPlan.dailyProgress')}</span>
                <span className="text-sm text-muted-foreground">
                  {calDia} / {plan.calorias_objetivo} kcal
                </span>
              </div>
              <Progress value={Math.min((calDia / plan.calorias_objetivo) * 100, 100)} className="h-2" />
            </CardContent>
          </Card>

          {/* Comidas del día */}
          {plan.plan_semanal[selectedDay as keyof PlanSemanal] && (
            renderDia(plan.plan_semanal[selectedDay as keyof PlanSemanal])
          )}
        </TabsContent>

        <TabsContent value="recomendaciones" className="space-y-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="pre">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('nutritionPlan.preWorkout')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {plan.recomendaciones.pre_entreno?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="post">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('nutritionPlan.postWorkout')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {plan.recomendaciones.post_entreno?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="hidratacion">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4" />
                  {t('nutritionPlan.hydration')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {plan.recomendaciones.hidratacion?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="suplementos">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  {t('nutritionPlan.supplements')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {plan.recomendaciones.suplementos?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="timing">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('nutritionPlan.mealTiming')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {plan.recomendaciones.timing_comidas?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="alimentos">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Apple className="h-4 w-4" />
                  {t('nutritionPlan.foodGuide')}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-green-600">{t('nutritionPlan.recommended')}</h4>
                    <ul className="space-y-1">
                      {plan.recomendaciones.alimentos_recomendados?.map((alimento, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {alimento}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-red-600">{t('nutritionPlan.avoid')}</h4>
                    <ul className="space-y-1">
                      {plan.recomendaciones.alimentos_evitar?.map((alimento, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <XCircle className="h-3 w-3 text-red-500" />
                          {alimento}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}
