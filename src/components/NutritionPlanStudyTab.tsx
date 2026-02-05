import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
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
  Brain, 
  Apple, 
  Coffee, 
  Moon, 
  Cookie,
  Droplets,
  Pill,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  BookOpen,
  Lightbulb,
  Zap
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
  antes_estudiar: string[];
  durante_estudio: string[];
  descansos: string[];
  hidratacion: string[];
  suplementos_cognitivos: string[];
  alimentos_brain_food: string[];
  alimentos_evitar: string[];
  horarios_optimos: string[];
}

interface PlanNutricionalEstudio {
  objetivo: string;
  calorias_objetivo: number;
  proteinas_objetivo: number;
  carbos_objetivo: number;
  grasas_objetivo: number;
  plan_semanal: PlanSemanal;
  recomendaciones: Recomendaciones;
}

interface Props {
  planEstudioId: number;
  tipoOposicion?: string;
  horasEstudioDiarias?: number;
}

interface Receta {
  nombre: string;
  descripcion: string;
  tiempo_preparacion: string;
  tiempo_coccion: string;
  porciones: number;
  dificultad: string;
  ingredientes: { cantidad: string; ingrediente: string }[];
  instrucciones: string[];
  consejos: string[];
  imagen_url?: string;
}

const DIAS_LABELS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export function NutritionPlanStudyTab({ planEstudioId, tipoOposicion, horasEstudioDiarias }: Props) {
  const { t, i18n } = useTranslation();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  const { hasAccepted, acceptDisclaimer } = useNutritionDisclaimer();
  
  const [plan, setPlan] = useState<PlanNutricionalEstudio | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('lunes');
  
  // Estado para mostrar el modal del disclaimer
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  // Estados para recetas
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState<Receta | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [currentPlatoNombre, setCurrentPlatoNombre] = useState('');

  // Estados para contenido traducido
  const [translatedObjetivo, setTranslatedObjetivo] = useState<string>('');
  const [translatedPlanSemanal, setTranslatedPlanSemanal] = useState<PlanSemanal | null>(null);
  const [translatedRecomendaciones, setTranslatedRecomendaciones] = useState<Recomendaciones | null>(null);

  // Cargar plan guardado en localStorage
  useEffect(() => {
    const savedPlan = localStorage.getItem(`nutrition_study_plan_${planEstudioId}`);
    if (savedPlan) {
      try {
        setPlan(JSON.parse(savedPlan));
      } catch (e) {
        console.error('Error loading saved plan:', e);
      }
    }
  }, [planEstudioId]);

  // Traducir contenido cuando cambia el idioma
  useEffect(() => {
    const translateContent = async () => {
      if (!plan) return;

      if (!needsTranslation) {
        setTranslatedObjetivo(plan.objetivo);
        setTranslatedPlanSemanal(plan.plan_semanal);
        setTranslatedRecomendaciones(plan.recomendaciones);
        return;
      }

      const textsToTranslate: string[] = [];
      
      // Objetivo
      textsToTranslate.push(plan.objetivo);
      
      // Platos y ingredientes del día seleccionado
      const dia = plan.plan_semanal[selectedDay as keyof PlanSemanal];
      if (dia) {
        textsToTranslate.push(dia.desayuno.plato);
        textsToTranslate.push(dia.almuerzo.plato);
        textsToTranslate.push(dia.cena.plato);
        dia.snacks.forEach(s => textsToTranslate.push(s.plato));
        
        // Ingredientes
        dia.desayuno.ingredientes.forEach(i => textsToTranslate.push(i));
        dia.almuerzo.ingredientes.forEach(i => textsToTranslate.push(i));
        dia.cena.ingredientes.forEach(i => textsToTranslate.push(i));
        dia.snacks.forEach(s => s.ingredientes.forEach(i => textsToTranslate.push(i)));
      }
      
      // Recomendaciones
      if (plan.recomendaciones) {
        plan.recomendaciones.antes_estudiar?.forEach(r => textsToTranslate.push(r));
        plan.recomendaciones.durante_estudio?.forEach(r => textsToTranslate.push(r));
        plan.recomendaciones.descansos?.forEach(r => textsToTranslate.push(r));
        plan.recomendaciones.hidratacion?.forEach(r => textsToTranslate.push(r));
        plan.recomendaciones.suplementos_cognitivos?.forEach(r => textsToTranslate.push(r));
        plan.recomendaciones.alimentos_brain_food?.forEach(r => textsToTranslate.push(r));
        plan.recomendaciones.alimentos_evitar?.forEach(r => textsToTranslate.push(r));
        plan.recomendaciones.horarios_optimos?.forEach(r => textsToTranslate.push(r));
      }

      try {
        const translations = await translateTexts(textsToTranslate);
        let idx = 0;
        
        setTranslatedObjetivo(translations[idx++]);
        
        // Reconstruir día traducido
        if (dia) {
          const translatedDia: DiaComida = JSON.parse(JSON.stringify(dia));
          translatedDia.desayuno.plato = translations[idx++];
          translatedDia.almuerzo.plato = translations[idx++];
          translatedDia.cena.plato = translations[idx++];
          translatedDia.snacks.forEach((s, i) => {
            translatedDia.snacks[i].plato = translations[idx++];
          });
          
          translatedDia.desayuno.ingredientes = dia.desayuno.ingredientes.map(() => translations[idx++]);
          translatedDia.almuerzo.ingredientes = dia.almuerzo.ingredientes.map(() => translations[idx++]);
          translatedDia.cena.ingredientes = dia.cena.ingredientes.map(() => translations[idx++]);
          translatedDia.snacks.forEach((s, si) => {
            translatedDia.snacks[si].ingredientes = s.ingredientes.map(() => translations[idx++]);
          });
          
          setTranslatedPlanSemanal(prev => ({
            ...plan.plan_semanal,
            [selectedDay]: translatedDia
          }));
        }
        
        // Recomendaciones
        if (plan.recomendaciones) {
          const tr: Recomendaciones = {
            antes_estudiar: plan.recomendaciones.antes_estudiar?.map(() => translations[idx++]) || [],
            durante_estudio: plan.recomendaciones.durante_estudio?.map(() => translations[idx++]) || [],
            descansos: plan.recomendaciones.descansos?.map(() => translations[idx++]) || [],
            hidratacion: plan.recomendaciones.hidratacion?.map(() => translations[idx++]) || [],
            suplementos_cognitivos: plan.recomendaciones.suplementos_cognitivos?.map(() => translations[idx++]) || [],
            alimentos_brain_food: plan.recomendaciones.alimentos_brain_food?.map(() => translations[idx++]) || [],
            alimentos_evitar: plan.recomendaciones.alimentos_evitar?.map(() => translations[idx++]) || [],
            horarios_optimos: plan.recomendaciones.horarios_optimos?.map(() => translations[idx++]) || [],
          };
          setTranslatedRecomendaciones(tr);
        }
      } catch (error) {
        console.error('Error translating:', error);
      }
    };

    translateContent();
  }, [plan, selectedDay, i18n.language, needsTranslation, translateTexts]);

  // Si no ha aceptado el disclaimer, mostrarlo primero
  if (!hasAccepted) {
    return (
      <NutritionDisclaimerModal
        onAccept={acceptDisclaimer}
        onCancel={() => {}}
      />
    );
  }

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generar-plan-nutricional-estudio', {
        body: {
          tipo_oposicion: tipoOposicion || 'Oposiciones generales',
          horas_estudio_diarias: horasEstudioDiarias || 6,
          objetivo_nutricional: 'Máxima concentración, memoria y energía mental'
        }
      });

      if (error) throw error;

      if (data?.success && data.plan) {
        setPlan(data.plan);
        localStorage.setItem(`nutrition_study_plan_${planEstudioId}`, JSON.stringify(data.plan));
        toast.success(t('nutritionPlanStudy.generated', '¡Plan nutricional para estudio generado!'));
      } else {
        throw new Error(data?.error || 'Error al generar plan');
      }
    } catch (error: any) {
      console.error('Error generating plan:', error);
      toast.error(t('nutritionPlanStudy.errorGenerating', 'Error al generar el plan nutricional'));
    } finally {
      setGenerating(false);
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

  const getDiaLabel = (dia: string) => {
    const labels: Record<string, Record<string, string>> = {
      es: DIAS_LABELS,
      en: { lunes: 'Monday', martes: 'Tuesday', miercoles: 'Wednesday', jueves: 'Thursday', viernes: 'Friday', sabado: 'Saturday', domingo: 'Sunday' },
      fr: { lunes: 'Lundi', martes: 'Mardi', miercoles: 'Mercredi', jueves: 'Jeudi', viernes: 'Vendredi', sabado: 'Samedi', domingo: 'Dimanche' },
      de: { lunes: 'Montag', martes: 'Dienstag', miercoles: 'Mittwoch', jueves: 'Donnerstag', viernes: 'Freitag', sabado: 'Samstag', domingo: 'Sonntag' },
      pt: { lunes: 'Segunda', martes: 'Terça', miercoles: 'Quarta', jueves: 'Quinta', viernes: 'Sexta', sabado: 'Sábado', domingo: 'Domingo' },
    };
    return labels[i18n.language]?.[dia] || DIAS_LABELS[dia];
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
                <span className="font-medium">{t('nutritionPlan.ingredients', 'Ingredientes')}:</span>{' '}
                {comida.ingredientes.join(', ')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            {t('nutritionPlanStudy.title', 'Plan Nutricional para el Estudio')}
          </CardTitle>
          <CardDescription>
            {t('nutritionPlanStudy.description', 'Alimentación optimizada para máximo rendimiento mental, concentración y memoria')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <NutritionDisclaimerBanner />
          <div className="h-4" />
          <Brain className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4 text-center">
            {t('nutritionPlanStudy.noPlan', 'No tienes un plan nutricional generado para este plan de estudio')}
          </p>
          <Button onClick={generatePlan} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('nutritionPlanStudy.generating', 'Generando...')}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('nutritionPlanStudy.generate', 'Generar Plan Nutricional')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const diaActual = (translatedPlanSemanal || plan.plan_semanal)[selectedDay as keyof PlanSemanal];
  const recomendaciones = translatedRecomendaciones || plan.recomendaciones;

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

      {/* Header con macros objetivo */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                {t('nutritionPlanStudy.title', 'Plan Nutricional para el Estudio')}
              </CardTitle>
              <CardDescription className="mt-2">
                {translatedObjetivo || plan.objetivo}
                {isTranslating && needsTranslation && (
                  <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />
                )}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={generatePlan} disabled={generating}>
              <RefreshCw className={`h-4 w-4 mr-1 ${generating ? 'animate-spin' : ''}`} />
              {t('common.regenerate', 'Regenerar')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-background rounded-lg">
              <Zap className="h-5 w-5 mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold">{plan.calorias_objetivo}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="h-5 w-5 mx-auto text-red-500 mb-1 font-bold">P</div>
              <p className="text-2xl font-bold">{plan.proteinas_objetivo}g</p>
              <p className="text-xs text-muted-foreground">{t('nutritionPlan.proteins', 'Proteínas')}</p>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="h-5 w-5 mx-auto text-amber-500 mb-1 font-bold">C</div>
              <p className="text-2xl font-bold">{plan.carbos_objetivo}g</p>
              <p className="text-xs text-muted-foreground">{t('nutritionPlan.carbs', 'Carbos')}</p>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="h-5 w-5 mx-auto text-blue-500 mb-1 font-bold">G</div>
              <p className="text-2xl font-bold">{plan.grasas_objetivo}g</p>
              <p className="text-xs text-muted-foreground">{t('nutritionPlan.fats', 'Grasas')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Plan Semanal y Recomendaciones */}
      <Tabs defaultValue="plan" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plan">
            <Apple className="h-4 w-4 mr-2" />
            {t('nutritionPlan.weeklyPlan', 'Plan Semanal')}
          </TabsTrigger>
          <TabsTrigger value="recomendaciones">
            <Lightbulb className="h-4 w-4 mr-2" />
            {t('nutritionPlanStudy.brainTips', 'Consejos Brain')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4">
          {/* Selector de días */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.keys(DIAS_LABELS).map((dia) => (
              <Button
                key={dia}
                variant={selectedDay === dia ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDay(dia)}
              >
                {getDiaLabel(dia)}
              </Button>
            ))}
          </div>

          {/* Comidas del día */}
          {diaActual && (
            <div className="space-y-4">
              {renderComida(diaActual.desayuno, 'desayuno', <Coffee className="h-5 w-5 text-amber-600" />)}
              {renderComida(diaActual.almuerzo, 'almuerzo', <Apple className="h-5 w-5 text-green-600" />)}
              {renderComida(diaActual.cena, 'cena', <Moon className="h-5 w-5 text-indigo-600" />)}
              
              {diaActual.snacks?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Cookie className="h-4 w-4 text-orange-500" />
                    {t('nutritionPlan.studySnacks', 'Snacks para Estudio')}
                  </h4>
                  {diaActual.snacks.map((snack, idx) => (
                    <div key={idx}>
                      {renderComida(snack, 'snack', <Cookie className="h-5 w-5 text-orange-500" />)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recomendaciones" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Antes de estudiar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  {t('nutritionPlanStudy.beforeStudy', 'Antes de Estudiar')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.antes_estudiar?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Durante el estudio */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  {t('nutritionPlanStudy.duringStudy', 'Durante el Estudio')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.durante_estudio?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Descansos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-amber-500" />
                  {t('nutritionPlanStudy.breaks', 'Descansos')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.descansos?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Hidratación */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  {t('nutritionPlan.hydration', 'Hidratación')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.hidratacion?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Suplementos cognitivos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4 text-purple-500" />
                  {t('nutritionPlanStudy.cognitiveSupplements', 'Suplementos Cognitivos')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.suplementos_cognitivos?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Brain Foods */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  {t('nutritionPlanStudy.brainFoods', 'Brain Foods')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.alimentos_brain_food?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Alimentos a evitar */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  {t('nutritionPlan.avoid', 'Evitar')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.alimentos_evitar?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Horarios óptimos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  {t('nutritionPlanStudy.optimalSchedule', 'Horarios Óptimos')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {recomendaciones?.horarios_optimos?.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
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
