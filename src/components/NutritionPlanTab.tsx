import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { useTranslateContent } from '@/hooks/useTranslateContent';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { RecipeModal } from '@/components/RecipeModal';
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
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  useNutritionDisclaimer, 
  NutritionDisclaimerModal, 
  NutritionDisclaimerBanner,
  NutritionDisclaimerButton 
} from '@/components/NutritionDisclaimer';

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

export function NutritionPlanTab({ planFisicoId, tipoPrueba, nivelFisico, diasSemana }: Props) {
  const { t, i18n } = useTranslation();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  const { hasAccepted, acceptDisclaimer } = useNutritionDisclaimer();
  
  const [plan, setPlan] = useState<PlanNutricional | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('lunes');
  
  // Estado para mostrar el modal del disclaimer
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  // Estados para recetas
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState<any>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [currentPlatoNombre, setCurrentPlatoNombre] = useState('');

  // Estados para contenido traducido
  const [translatedObjetivo, setTranslatedObjetivo] = useState<string>('');
  const [translatedPlanSemanal, setTranslatedPlanSemanal] = useState<PlanSemanal | null>(null);
  const [translatedRecomendaciones, setTranslatedRecomendaciones] = useState<Recomendaciones | null>(null);

  // Días traducidos
  const DIAS_LABELS: Record<string, string> = {
    lunes: t('nutritionPlan.days.monday', 'Lunes'),
    martes: t('nutritionPlan.days.tuesday', 'Martes'),
    miercoles: t('nutritionPlan.days.wednesday', 'Miércoles'),
    jueves: t('nutritionPlan.days.thursday', 'Jueves'),
    viernes: t('nutritionPlan.days.friday', 'Viernes'),
    sabado: t('nutritionPlan.days.saturday', 'Sábado'),
    domingo: t('nutritionPlan.days.sunday', 'Domingo')
  };

  useEffect(() => {
    fetchPlan();
  }, [planFisicoId]);

  // Efecto para traducir el plan nutricional
  useEffect(() => {
    const translatePlan = async () => {
      if (!plan) return;

      if (!needsTranslation) {
        setTranslatedObjetivo(plan.objetivo);
        setTranslatedPlanSemanal(plan.plan_semanal);
        setTranslatedRecomendaciones(plan.recomendaciones);
        return;
      }

      // Recopilar todos los textos a traducir
      const textsToTranslate: string[] = [];
      const textMapping: { type: string; dia?: string; meal?: string; idx?: number; field?: string }[] = [];

      // Objetivo
      if (plan.objetivo) {
        textsToTranslate.push(plan.objetivo);
        textMapping.push({ type: 'objetivo' });
      }

      // Plan semanal - platos e ingredientes
      DIAS_SEMANA.forEach((dia) => {
        const diaData = plan.plan_semanal[dia as keyof PlanSemanal];
        if (!diaData) return;

        // Desayuno
        if (diaData.desayuno) {
          textsToTranslate.push(diaData.desayuno.plato);
          textMapping.push({ type: 'plato', dia, meal: 'desayuno' });
          textsToTranslate.push(diaData.desayuno.ingredientes.join(', '));
          textMapping.push({ type: 'ingredientes', dia, meal: 'desayuno' });
        }
        // Almuerzo
        if (diaData.almuerzo) {
          textsToTranslate.push(diaData.almuerzo.plato);
          textMapping.push({ type: 'plato', dia, meal: 'almuerzo' });
          textsToTranslate.push(diaData.almuerzo.ingredientes.join(', '));
          textMapping.push({ type: 'ingredientes', dia, meal: 'almuerzo' });
        }
        // Cena
        if (diaData.cena) {
          textsToTranslate.push(diaData.cena.plato);
          textMapping.push({ type: 'plato', dia, meal: 'cena' });
          textsToTranslate.push(diaData.cena.ingredientes.join(', '));
          textMapping.push({ type: 'ingredientes', dia, meal: 'cena' });
        }
        // Snacks
        diaData.snacks?.forEach((snack, idx) => {
          textsToTranslate.push(snack.plato);
          textMapping.push({ type: 'snack_plato', dia, idx });
          textsToTranslate.push(snack.ingredientes.join(', '));
          textMapping.push({ type: 'snack_ingredientes', dia, idx });
        });
      });

      // Recomendaciones
      const recKeys: (keyof Recomendaciones)[] = [
        'pre_entreno', 'post_entreno', 'hidratacion', 'suplementos',
        'timing_comidas', 'alimentos_recomendados', 'alimentos_evitar'
      ];
      recKeys.forEach((key) => {
        plan.recomendaciones[key]?.forEach((rec, idx) => {
          textsToTranslate.push(rec);
          textMapping.push({ type: 'recomendacion', field: key, idx });
        });
      });

      // Traducir todo
      const translated = await translateTexts(textsToTranslate);

      // Reconstruir plan traducido
      let tIdx = 0;
      let newObjetivo = plan.objetivo;

      // Clonar plan semanal
      const newPlanSemanal: any = {};
      DIAS_SEMANA.forEach((dia) => {
        const orig = plan.plan_semanal[dia as keyof PlanSemanal];
        if (orig) {
          newPlanSemanal[dia] = JSON.parse(JSON.stringify(orig));
        }
      });

      // Clonar recomendaciones
      const newRecomendaciones: any = JSON.parse(JSON.stringify(plan.recomendaciones));

      // Aplicar traducciones
      textMapping.forEach((map, i) => {
        const tr = translated[i];
        if (!tr) return;

        if (map.type === 'objetivo') {
          newObjetivo = tr;
        } else if (map.type === 'plato' && map.dia && map.meal) {
          newPlanSemanal[map.dia][map.meal].plato = tr;
        } else if (map.type === 'ingredientes' && map.dia && map.meal) {
          newPlanSemanal[map.dia][map.meal].ingredientes = tr.split(', ');
        } else if (map.type === 'snack_plato' && map.dia !== undefined && map.idx !== undefined) {
          newPlanSemanal[map.dia].snacks[map.idx].plato = tr;
        } else if (map.type === 'snack_ingredientes' && map.dia !== undefined && map.idx !== undefined) {
          newPlanSemanal[map.dia].snacks[map.idx].ingredientes = tr.split(', ');
        } else if (map.type === 'recomendacion' && map.field && map.idx !== undefined) {
          newRecomendaciones[map.field][map.idx] = tr;
        }
      });

      setTranslatedObjetivo(newObjetivo);
      setTranslatedPlanSemanal(newPlanSemanal as PlanSemanal);
      setTranslatedRecomendaciones(newRecomendaciones as Recomendaciones);
    };

    translatePlan();
  }, [plan, i18n.language, needsTranslation, translateTexts]);

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

  const handleVerReceta = async (comida: Comida, tipo: string) => {
    setCurrentPlatoNombre(comida.plato);
    setCurrentRecipe(null);
    setLoadingRecipe(true);
    setRecipeModalOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke('generar-receta', {
        body: {
          plato: comida.plato,
          ingredientes: comida.ingredientes,
          tipo_comida: tipo
        }
      });

      if (error) throw error;

      if (data?.success && data.receta) {
        setCurrentRecipe(data.receta);
      } else {
        throw new Error(data?.error || 'Error al generar receta');
      }
    } catch (error: any) {
      console.error('Error generando receta:', error);
      toast.error(t('recipe.error', 'Error al generar la receta'));
      setRecipeModalOpen(false);
    } finally {
      setLoadingRecipe(false);
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
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold flex items-center gap-2">
                {comida.plato}
                {isTranslating && needsTranslation && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleVerReceta(comida, tipo)}
                className="flex-shrink-0"
              >
                <BookOpen className="h-4 w-4 mr-1" />
                {t('recipe.viewRecipe', 'Receta')}
              </Button>
            </div>
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

  // Si no ha aceptado el disclaimer, mostrarlo primero
  if (!hasAccepted) {
    return (
      <NutritionDisclaimerModal
        onAccept={acceptDisclaimer}
        onCancel={() => {}}
      />
    );
  }

  if (!plan) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <NutritionDisclaimerBanner />
          <div className="mt-4" />
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

  // Usar datos traducidos si están disponibles
  const displayPlanSemanal = translatedPlanSemanal || plan.plan_semanal;
  const displayRecomendaciones = translatedRecomendaciones || plan.recomendaciones;
  const displayObjetivo = translatedObjetivo || plan.objetivo;

  const totalDiario = displayPlanSemanal[selectedDay as keyof PlanSemanal];
  const calDia = totalDiario 
    ? totalDiario.desayuno.calorias + totalDiario.almuerzo.calorias + totalDiario.cena.calorias + 
      (totalDiario.snacks?.reduce((acc, s) => acc + s.calorias, 0) || 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Modal del disclaimer (para revisar) */}
      {showDisclaimerModal && (
        <NutritionDisclaimerModal
          onAccept={() => setShowDisclaimerModal(false)}
          onCancel={() => setShowDisclaimerModal(false)}
        />
      )}

      {/* Banner de disclaimer + botón para revisarlo */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <NutritionDisclaimerBanner />
        </div>
        <NutritionDisclaimerButton onClick={() => setShowDisclaimerModal(true)} />
      </div>

      {/* Header con objetivos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                {t('nutritionPlan.title')}
                {isTranslating && needsTranslation && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </CardTitle>
              <CardDescription>{displayObjetivo}</CardDescription>
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
          {displayPlanSemanal[selectedDay as keyof PlanSemanal] && (
            renderDia(displayPlanSemanal[selectedDay as keyof PlanSemanal])
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
                  {displayRecomendaciones.pre_entreno?.map((rec, idx) => (
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
                  {displayRecomendaciones.post_entreno?.map((rec, idx) => (
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
                  {displayRecomendaciones.hidratacion?.map((rec, idx) => (
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
                  {displayRecomendaciones.suplementos?.map((rec, idx) => (
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
                  {displayRecomendaciones.timing_comidas?.map((rec, idx) => (
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
                      {displayRecomendaciones.alimentos_recomendados?.map((alimento, idx) => (
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
                      {displayRecomendaciones.alimentos_evitar?.map((alimento, idx) => (
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

      {/* Modal de receta */}
      <RecipeModal
        open={recipeModalOpen}
        onOpenChange={setRecipeModalOpen}
        receta={currentRecipe}
        loading={loadingRecipe}
        platoNombre={currentPlatoNombre}
      />
    </div>
  );
}
