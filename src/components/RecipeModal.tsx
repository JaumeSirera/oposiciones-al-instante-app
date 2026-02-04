import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslateContent } from '@/hooks/useTranslateContent';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Clock,
  Users,
  ChefHat,
  Loader2,
  CheckCircle,
  Lightbulb,
  UtensilsCrossed
} from 'lucide-react';
import { AIGeneratedImageLabel } from '@/components/NutritionDisclaimer';

interface Ingrediente {
  cantidad: string;
  ingrediente: string;
}

interface Receta {
  nombre: string;
  descripcion: string;
  tiempo_preparacion: string;
  tiempo_coccion: string;
  porciones: number;
  dificultad: string;
  ingredientes: Ingrediente[];
  instrucciones: string[];
  consejos: string[];
  imagen_url?: string;
}

interface RecipeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receta: Receta | null;
  loading: boolean;
  platoNombre: string;
}

export function RecipeModal({ open, onOpenChange, receta, loading, platoNombre }: RecipeModalProps) {
  const { t, i18n } = useTranslation();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Estados para contenido traducido
  const [translatedReceta, setTranslatedReceta] = useState<Receta | null>(null);

  // Resetear estados de imagen cuando cambia la receta
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setTranslatedReceta(null);
  }, [receta]);

  // Traducir contenido de la receta
  useEffect(() => {
    const translateRecipe = async () => {
      if (!receta || !open) return;

      if (!needsTranslation) {
        setTranslatedReceta(receta);
        return;
      }

      const textsToTranslate: string[] = [];
      
      // Nombre, descripción, dificultad
      textsToTranslate.push(receta.nombre);
      textsToTranslate.push(receta.descripcion);
      textsToTranslate.push(receta.dificultad);
      
      // Ingredientes (solo el nombre, no la cantidad)
      receta.ingredientes.forEach(ing => textsToTranslate.push(ing.ingrediente));
      
      // Instrucciones
      receta.instrucciones.forEach(inst => textsToTranslate.push(inst));
      
      // Consejos
      receta.consejos.forEach(consejo => textsToTranslate.push(consejo));

      try {
        const translations = await translateTexts(textsToTranslate);
        let idx = 0;
        
        const translated: Receta = {
          ...receta,
          nombre: translations[idx++] || receta.nombre,
          descripcion: translations[idx++] || receta.descripcion,
          dificultad: translations[idx++] || receta.dificultad,
          ingredientes: receta.ingredientes.map(ing => ({
            cantidad: ing.cantidad,
            ingrediente: translations[idx++] || ing.ingrediente
          })),
          instrucciones: receta.instrucciones.map(() => translations[idx++] || ''),
          consejos: receta.consejos.map(() => translations[idx++] || '')
        };
        
        setTranslatedReceta(translated);
      } catch (error) {
        console.error('Error translating recipe:', error);
        setTranslatedReceta(receta);
      }
    };

    translateRecipe();
  }, [receta, open, i18n.language, needsTranslation, translateTexts]);

  const getDifficultyColor = (dificultad: string) => {
    const lower = dificultad.toLowerCase();
    if (lower.includes('fácil') || lower.includes('easy') || lower.includes('baja') || lower.includes('facile') || lower.includes('leicht')) {
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    }
    if (lower.includes('difícil') || lower.includes('hard') || lower.includes('alta') || lower.includes('difficile') || lower.includes('schwer')) {
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    }
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
  };

  const displayReceta = translatedReceta || receta;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">{t('recipe.generating', 'Generando receta...')}</p>
            <p className="text-sm text-muted-foreground">{platoNombre}</p>
          </div>
        ) : displayReceta ? (
          <>
            {/* Imagen del plato */}
            {displayReceta.imagen_url && !imageError && (
              <div className="relative w-full h-48 md:h-64 bg-muted">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                <img
                  src={displayReceta.imagen_url}
                  alt={displayReceta.nombre}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                {/* Etiqueta de imagen generada por IA */}
                {imageLoaded && (
                  <div className="absolute bottom-2 right-2">
                    <AIGeneratedImageLabel />
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="max-h-[calc(90vh-16rem)]">
              <div className="p-6 space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <UtensilsCrossed className="h-6 w-6 text-primary" />
                    {displayReceta.nombre}
                    {isTranslating && needsTranslation && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </DialogTitle>
                  <p className="text-muted-foreground">{displayReceta.descripcion}</p>
                </DialogHeader>

                {/* Información rápida */}
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t('recipe.prep', 'Prep')}: {displayReceta.tiempo_preparacion}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t('recipe.cook', 'Cocción')}: {displayReceta.tiempo_coccion}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {displayReceta.porciones} {t('recipe.servings', 'porciones')}
                  </Badge>
                  <Badge className={getDifficultyColor(displayReceta.dificultad)}>
                    <ChefHat className="h-3 w-3 mr-1" />
                    {displayReceta.dificultad}
                  </Badge>
                </div>

                <Separator />

                {/* Ingredientes */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    🥗 {t('recipe.ingredients', 'Ingredientes')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {displayReceta.ingredientes.map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <span className="font-medium text-primary">{ing.cantidad}</span>
                        <span>{ing.ingrediente}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Instrucciones */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    📝 {t('recipe.instructions', 'Instrucciones')}
                  </h3>
                  <ol className="space-y-3">
                    {displayReceta.instrucciones.map((paso, idx) => (
                      <li key={idx} className="flex gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </span>
                        <p className="pt-0.5">{paso.replace(/^Paso \d+:\s*/i, '')}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Consejos */}
                {displayReceta.consejos && displayReceta.consejos.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-amber-500" />
                        {t('recipe.tips', 'Consejos del Chef')}
                      </h3>
                      <ul className="space-y-2">
                        {displayReceta.consejos.map((consejo, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{consejo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 gap-4">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">{t('recipe.noRecipe', 'No se pudo cargar la receta')}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
