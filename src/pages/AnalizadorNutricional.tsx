import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { Camera, Upload, Loader2, UtensilsCrossed, Apple, Flame, Dumbbell, Wheat, Droplets, Leaf, Star, AlertCircle, Candy, Heart, Sparkles, Save, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { nutritionHistoryService, NutritionAnalysis } from "@/services/nutritionHistoryService";
import NutritionHistory from "@/components/NutritionHistory";
import { useCapacitorCamera } from "@/hooks/useCapacitorCamera";
import { useTranslateContent } from "@/hooks/useTranslateContent";

interface NutrientInfo {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  sugar: number;
  fat: number;
  saturatedFat: number;
  transFat: number;
  fiber: number;
  cholesterol: number;
  sodium: number;
}

interface AnalysisResult {
  ingredients: NutrientInfo[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    sugar: number;
    fat: number;
    saturatedFat: number;
    transFat: number;
    fiber: number;
    cholesterol: number;
    sodium: number;
  };
  dishName: string;
  healthScore: number;
  recommendations: string[];
}

const AnalizadorNutricional: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Capacitor camera hook for native platforms
  const { takePhoto, pickFromGallery, isNativePlatform, isLoading: isCameraLoading, error: cameraError, clearError } = useCapacitorCamera();
  
  // Translation hook for dynamic content
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  
  // Translated content state
  const [translatedDishName, setTranslatedDishName] = useState<string>('');
  const [translatedIngredients, setTranslatedIngredients] = useState<string[]>([]);
  const [translatedRecommendations, setTranslatedRecommendations] = useState<string[]>([]);
  
  // Translate dynamic content when result changes or language changes
  useEffect(() => {
    const translateContent = async () => {
      if (!result) {
        setTranslatedDishName('');
        setTranslatedIngredients([]);
        setTranslatedRecommendations([]);
        return;
      }
      
      if (!needsTranslation) {
        // If Spanish, use original content
        setTranslatedDishName(result.dishName);
        setTranslatedIngredients(result.ingredients.map(i => i.name));
        setTranslatedRecommendations(result.recommendations || []);
        return;
      }
      
      // Collect all texts to translate
      const textsToTranslate = [
        result.dishName,
        ...result.ingredients.map(i => i.name),
        ...(result.recommendations || [])
      ];
      
      const translated = await translateTexts(textsToTranslate);
      
      // Distribute translated texts back
      let idx = 0;
      setTranslatedDishName(translated[idx++]);
      setTranslatedIngredients(result.ingredients.map(() => translated[idx++]));
      setTranslatedRecommendations((result.recommendations || []).map(() => translated[idx++]));
    };
    
    translateContent();
  }, [result, i18n.language, needsTranslation, translateTexts]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('nutritionAnalyzer.imageTooLarge', 'La imagen es demasiado grande. Máximo 10MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTakePhoto = async () => {
    clearError();
    const imageData = await takePhoto();
    if (imageData) {
      setSelectedImage(imageData);
      setResult(null);
      setError(null);
    }
  };

  const handlePickFromGallery = async () => {
    clearError();
    const imageData = await pickFromGallery();
    if (imageData) {
      setSelectedImage(imageData);
      setResult(null);
      setError(null);
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analizar-plato', {
        body: { 
          imageBase64: selectedImage,
          language: i18n.language
        }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      toast.success(t('nutritionAnalyzer.analysisComplete', '¡Análisis completado!'));
    } catch (err) {
      console.error('Error analyzing image:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!result || !user?.id) {
      toast.error(t('nutritionHistory.loginRequired', 'Inicia sesión para guardar el análisis'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await nutritionHistoryService.guardarAnalisis({
        id_usuario: user.id,
        dish_name: result.dishName,
        image_base64: selectedImage || undefined,
        ingredients: result.ingredients,
        totals: result.totals,
        health_score: result.healthScore,
        recommendations: result.recommendations || [],
      });

      if (response.success) {
        toast.success(t('nutritionHistory.saved', '¡Análisis guardado en el historial!'));
      } else {
        toast.error(response.error || t('nutritionHistory.errorSaving', 'Error al guardar'));
      }
    } catch (err) {
      console.error('Error saving analysis:', err);
      toast.error(t('nutritionHistory.errorSaving', 'Error al guardar'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromHistory = (analysis: NutritionAnalysis) => {
    setResult({
      dishName: analysis.dish_name,
      ingredients: analysis.ingredients,
      totals: analysis.totals,
      healthScore: analysis.health_score,
      recommendations: analysis.recommendations,
    });
    if (analysis.image_base64) {
      setSelectedImage(analysis.image_base64);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <>
      <Helmet>
        <title>{t('nutritionAnalyzer.title', 'Analizador Nutricional')} | {t('appName')}</title>
        <meta name="description" content={t('nutritionAnalyzer.description', 'Analiza el valor nutricional de tus platos con IA')} />
      </Helmet>

      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('nutritionAnalyzer.title', 'Analizador Nutricional')}
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('nutritionAnalyzer.subtitle', 'Sube una foto de tu plato y obtén un análisis detallado de los ingredientes, calorías, proteínas y más.')}
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-6 border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
          <CardContent className="p-8">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {!selectedImage ? (
              <div className="flex flex-col items-center justify-center">
                <div className="p-6 rounded-full bg-muted mb-4">
                  <Camera className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">
                  {t('nutritionAnalyzer.uploadPrompt', 'Sube una foto de tu plato')}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isNativePlatform 
                    ? t('nutritionAnalyzer.uploadHintMobile', 'Toma una foto o selecciona de la galería')
                    : t('nutritionAnalyzer.uploadHint', 'Haz clic o arrastra una imagen aquí')
                  }
                </p>
                
                {/* Camera error message */}
                {cameraError && (
                  <Alert variant="destructive" className="mb-4 max-w-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{cameraError}</AlertDescription>
                  </Alert>
                )}
                
                {/* Native platform: Show camera and gallery buttons */}
                {isNativePlatform ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      variant="default" 
                      className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                      onClick={handleTakePhoto}
                      disabled={isCameraLoading}
                    >
                      {isCameraLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {t('nutritionAnalyzer.takePhoto', 'Tomar foto')}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={handlePickFromGallery}
                      disabled={isCameraLoading}
                    >
                      {isCameraLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                      {t('nutritionAnalyzer.selectFromGallery', 'Galería')}
                    </Button>
                  </div>
                ) : (
                  /* Web platform: Show file upload button */
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {t('nutritionAnalyzer.selectImage', 'Seleccionar imagen')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video max-h-80 mx-auto overflow-hidden rounded-lg">
                  <img
                    src={selectedImage}
                    alt="Plato seleccionado"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex justify-center gap-4 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedImage(null);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    {t('nutritionAnalyzer.changeImage', 'Cambiar imagen')}
                  </Button>
                  <Button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('nutritionAnalyzer.analyzing', 'Analizando...')}
                      </>
                    ) : (
                      <>
                        <Apple className="h-4 w-4" />
                        {t('nutritionAnalyzer.analyze', 'Analizar plato')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in-50 duration-500">
            {/* Dish Name & Health Score */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl">
                      {isTranslating ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {result.dishName}
                        </span>
                      ) : (
                        translatedDishName || result.dishName
                      )}
                    </CardTitle>
                    <CardDescription>
                      {result.ingredients.length} {t('nutritionAnalyzer.ingredientsDetected', 'ingredientes detectados')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{t('nutritionAnalyzer.healthScore', 'Puntuación saludable')}</p>
                      <p className={`text-3xl font-bold ${getHealthScoreColor(result.healthScore)}`}>
                        {result.healthScore}/10
                      </p>
                    </div>
                    <div className="p-2 rounded-full bg-muted">
                      <Star className={`h-6 w-6 ${getHealthScoreColor(result.healthScore)}`} />
                    </div>
                    {user && (
                      <Button
                        onClick={handleSaveAnalysis}
                        disabled={isSaving}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {t('nutritionHistory.save', 'Guardar')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Totals Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-200 dark:border-orange-800">
                <CardContent className="p-4 text-center">
                  <Flame className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{result.totals.calories}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">{t('nutritionAnalyzer.calories', 'Calorías')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30 border-red-200 dark:border-red-800">
                <CardContent className="p-4 text-center">
                  <Dumbbell className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{result.totals.protein}g</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{t('nutritionAnalyzer.protein', 'Proteínas')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
                <CardContent className="p-4 text-center">
                  <Wheat className="h-6 w-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{result.totals.carbs}g</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{t('nutritionAnalyzer.carbs', 'Carbohidratos')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950/30 dark:to-pink-900/30 border-pink-200 dark:border-pink-800">
                <CardContent className="p-4 text-center">
                  <Candy className="h-6 w-6 mx-auto mb-2 text-pink-600 dark:text-pink-400" />
                  <p className="text-2xl font-bold text-pink-700 dark:text-pink-300">{result.totals.sugar}g</p>
                  <p className="text-xs text-pink-600 dark:text-pink-400">{t('nutritionAnalyzer.sugar', 'Azúcar')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-4 text-center">
                  <Droplets className="h-6 w-6 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{result.totals.fat}g</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">{t('nutritionAnalyzer.fat', 'Grasas')}</p>
                  <p className="text-[10px] text-yellow-500 dark:text-yellow-500 mt-1">
                    {t('nutritionAnalyzer.saturatedFat', 'Sat')}: {result.totals.saturatedFat || 0}g | {t('nutritionAnalyzer.transFat', 'Trans')}: {result.totals.transFat || 0}g
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border-green-200 dark:border-green-800">
                <CardContent className="p-4 text-center">
                  <Leaf className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.totals.fiber}g</p>
                  <p className="text-xs text-green-600 dark:text-green-400">{t('nutritionAnalyzer.fiber', 'Fibra')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/30 border-rose-200 dark:border-rose-800">
                <CardContent className="p-4 text-center">
                  <Heart className="h-6 w-6 mx-auto mb-2 text-rose-600 dark:text-rose-400" />
                  <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{result.totals.cholesterol || 0}mg</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400">{t('nutritionAnalyzer.cholesterol', 'Colesterol')}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4 text-center">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{result.totals.sodium || 0}mg</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{t('nutritionAnalyzer.sodium', 'Sodio')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Ingredients Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Apple className="h-5 w-5" />
                  {t('nutritionAnalyzer.ingredientBreakdown', 'Desglose por ingredientes')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('nutritionAnalyzer.ingredient', 'Ingrediente')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.quantity', 'Cantidad')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.calories', 'Cal')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.proteinShort', 'Prot')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.carbsShort', 'Carb')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.sugarShort', 'Azúc')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.fatShort', 'Gras')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.saturatedFatShort', 'Sat')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.transFatShort', 'Trans')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.fiberShort', 'Fib')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.cholesterolShort', 'Col')}</TableHead>
                        <TableHead className="text-right">{t('nutritionAnalyzer.sodiumShort', 'Sod')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.ingredients.map((ingredient, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {translatedIngredients[index] || ingredient.name}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">{ingredient.quantity}</TableCell>
                          <TableCell className="text-right">{ingredient.calories}</TableCell>
                          <TableCell className="text-right">{ingredient.protein}g</TableCell>
                          <TableCell className="text-right">{ingredient.carbs}g</TableCell>
                          <TableCell className="text-right">{ingredient.sugar}g</TableCell>
                          <TableCell className="text-right">{ingredient.fat}g</TableCell>
                          <TableCell className="text-right">{ingredient.saturatedFat || 0}g</TableCell>
                          <TableCell className="text-right">{ingredient.transFat || 0}g</TableCell>
                          <TableCell className="text-right">{ingredient.fiber}g</TableCell>
                          <TableCell className="text-right">{ingredient.cholesterol || 0}mg</TableCell>
                          <TableCell className="text-right">{ingredient.sodium || 0}mg</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>{t('nutritionAnalyzer.total', 'TOTAL')}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right">{result.totals.calories}</TableCell>
                        <TableCell className="text-right">{result.totals.protein}g</TableCell>
                        <TableCell className="text-right">{result.totals.carbs}g</TableCell>
                        <TableCell className="text-right">{result.totals.sugar}g</TableCell>
                        <TableCell className="text-right">{result.totals.fat}g</TableCell>
                        <TableCell className="text-right">{result.totals.saturatedFat || 0}g</TableCell>
                        <TableCell className="text-right">{result.totals.transFat || 0}g</TableCell>
                        <TableCell className="text-right">{result.totals.fiber}g</TableCell>
                        <TableCell className="text-right">{result.totals.cholesterol || 0}mg</TableCell>
                        <TableCell className="text-right">{result.totals.sodium || 0}mg</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    {t('nutritionAnalyzer.recommendations', 'Recomendaciones')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5 shrink-0">{index + 1}</Badge>
                        <span className="text-muted-foreground">
                          {translatedRecommendations[index] || rec}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Macros Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>{t('nutritionAnalyzer.macroDistribution', 'Distribución de macros')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const totalMacros = result.totals.protein + result.totals.carbs + result.totals.fat;
                  const proteinPct = totalMacros > 0 ? Math.round((result.totals.protein / totalMacros) * 100) : 0;
                  const carbsPct = totalMacros > 0 ? Math.round((result.totals.carbs / totalMacros) * 100) : 0;
                  const fatPct = totalMacros > 0 ? Math.round((result.totals.fat / totalMacros) * 100) : 0;

                  return (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            {t('nutritionAnalyzer.protein', 'Proteínas')}
                          </span>
                          <span>{proteinPct}%</span>
                        </div>
                        <Progress value={proteinPct} className="h-2 [&>div]:bg-red-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            {t('nutritionAnalyzer.carbs', 'Carbohidratos')}
                          </span>
                          <span>{carbsPct}%</span>
                        </div>
                        <Progress value={carbsPct} className="h-2 [&>div]:bg-amber-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            {t('nutritionAnalyzer.fat', 'Grasas')}
                          </span>
                          <span>{fatPct}%</span>
                        </div>
                        <Progress value={fatPct} className="h-2 [&>div]:bg-yellow-500" />
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* History Section */}
        {user && (
          <div className="mt-6">
            <NutritionHistory onSelectAnalysis={handleLoadFromHistory} />
          </div>
        )}
      </div>
    </>
  );
};

export default AnalizadorNutricional;
