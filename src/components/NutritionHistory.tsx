import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS, fr, pt, de } from 'date-fns/locale';
import { History, Trash2, Eye, Flame, Dumbbell, Star, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { nutritionHistoryService, NutritionHistoryItem, NutritionAnalysis } from '@/services/nutritionHistoryService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const localeMap: Record<string, typeof es> = {
  es: es,
  en: enUS,
  fr: fr,
  pt: pt,
  de: de,
};

interface NutritionHistoryProps {
  onSelectAnalysis?: (analysis: NutritionAnalysis) => void;
}

const NutritionHistory: React.FC<NutritionHistoryProps> = ({ onSelectAnalysis }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [historial, setHistorial] = useState<NutritionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<NutritionAnalysis | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const isSA = user?.nivel === 'SA';
  const dateLocale = localeMap[i18n.language] || es;

  const fetchHistorial = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const data = await nutritionHistoryService.listarHistorial(user.id, isSA);
      setHistorial(data);
    } catch (error) {
      console.error('Error fetching historial:', error);
      toast.error(t('nutritionHistory.errorLoading', 'Error al cargar el historial'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchHistorial();
    }
  }, [isOpen, user?.id]);

  const handleViewDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const detail = await nutritionHistoryService.obtenerDetalle(id);
      if (detail) {
        setSelectedDetail(detail);
      } else {
        toast.error(t('nutritionHistory.errorLoadingDetail', 'Error al cargar el detalle'));
      }
    } catch (error) {
      console.error('Error fetching detail:', error);
      toast.error(t('nutritionHistory.errorLoadingDetail', 'Error al cargar el detalle'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await nutritionHistoryService.eliminarAnalisis(id);
      if (result.success) {
        toast.success(t('nutritionHistory.deleted', 'Análisis eliminado'));
        setHistorial(prev => prev.filter(item => item.id !== id));
      } else {
        toast.error(result.error || t('nutritionHistory.errorDeleting', 'Error al eliminar'));
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(t('nutritionHistory.errorDeleting', 'Error al eliminar'));
    }
  };

  const handleLoadAnalysis = () => {
    if (selectedDetail && onSelectAnalysis) {
      onSelectAnalysis(selectedDetail);
      setSelectedDetail(null);
      setIsOpen(false);
      toast.success(t('nutritionHistory.loaded', 'Análisis cargado'));
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">
                  {t('nutritionHistory.title', 'Historial de Análisis')}
                </CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </div>
            <CardDescription>
              {t('nutritionHistory.description', 'Consulta y compara tus análisis anteriores')}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : historial.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t('nutritionHistory.empty', 'No hay análisis guardados')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('nutritionHistory.dish', 'Plato')}</TableHead>
                      <TableHead className="text-right">{t('nutritionAnalyzer.calories', 'Calorías')}</TableHead>
                      <TableHead className="text-right">{t('nutritionAnalyzer.protein', 'Proteínas')}</TableHead>
                      <TableHead className="text-center">{t('nutritionHistory.score', 'Puntuación')}</TableHead>
                      <TableHead>{t('nutritionHistory.date', 'Fecha')}</TableHead>
                      {isSA && <TableHead>{t('nutritionHistory.user', 'Usuario')}</TableHead>}
                      <TableHead className="text-right">{t('nutritionHistory.actions', 'Acciones')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historial.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {item.dish_name}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Flame className="h-3 w-3 text-orange-500" />
                            {item.totals?.calories || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex items-center justify-end gap-1">
                            <Dumbbell className="h-3 w-3 text-red-500" />
                            {item.totals?.protein || 0}g
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${getHealthScoreColor(item.health_score)} text-white`}>
                            <Star className="h-3 w-3 mr-1" />
                            {item.health_score}/10
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(item.fecha_analisis), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                        </TableCell>
                        {isSA && (
                          <TableCell className="text-sm">
                            {item.username || item.email || '-'}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleViewDetail(item.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>{selectedDetail?.dish_name || item.dish_name}</DialogTitle>
                                  <DialogDescription>
                                    {t('nutritionHistory.detailDescription', 'Detalle completo del análisis')}
                                  </DialogDescription>
                                </DialogHeader>
                                {loadingDetail ? (
                                  <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                  </div>
                                ) : selectedDetail ? (
                                  <div className="space-y-4">
                                    {/* Totals Summary */}
                                    <div className="grid grid-cols-4 gap-2">
                                      <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                                        <p className="text-lg font-bold text-orange-600">{selectedDetail.totals.calories}</p>
                                        <p className="text-xs text-muted-foreground">{t('nutritionAnalyzer.calories', 'Calorías')}</p>
                                      </div>
                                      <div className="text-center p-2 bg-red-50 dark:bg-red-950/30 rounded">
                                        <p className="text-lg font-bold text-red-600">{selectedDetail.totals.protein}g</p>
                                        <p className="text-xs text-muted-foreground">{t('nutritionAnalyzer.protein', 'Proteínas')}</p>
                                      </div>
                                      <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                                        <p className="text-lg font-bold text-amber-600">{selectedDetail.totals.carbs}g</p>
                                        <p className="text-xs text-muted-foreground">{t('nutritionAnalyzer.carbs', 'Carbos')}</p>
                                      </div>
                                      <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded">
                                        <p className="text-lg font-bold text-yellow-600">{selectedDetail.totals.fat}g</p>
                                        <p className="text-xs text-muted-foreground">{t('nutritionAnalyzer.fat', 'Grasas')}</p>
                                      </div>
                                    </div>

                                    {/* Ingredients Table */}
                                    {selectedDetail.ingredients && selectedDetail.ingredients.length > 0 && (
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>{t('nutritionAnalyzer.ingredient', 'Ingrediente')}</TableHead>
                                              <TableHead className="text-right">{t('nutritionAnalyzer.calories', 'Cal')}</TableHead>
                                              <TableHead className="text-right">{t('nutritionAnalyzer.proteinShort', 'Prot')}</TableHead>
                                              <TableHead className="text-right">{t('nutritionAnalyzer.carbsShort', 'Carb')}</TableHead>
                                              <TableHead className="text-right">{t('nutritionAnalyzer.fatShort', 'Gras')}</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {selectedDetail.ingredients.map((ing, idx) => (
                                              <TableRow key={idx}>
                                                <TableCell>{ing.name}</TableCell>
                                                <TableCell className="text-right">{ing.calories}</TableCell>
                                                <TableCell className="text-right">{ing.protein}g</TableCell>
                                                <TableCell className="text-right">{ing.carbs}g</TableCell>
                                                <TableCell className="text-right">{ing.fat}g</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}

                                    {/* Recommendations */}
                                    {selectedDetail.recommendations && selectedDetail.recommendations.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold mb-2">{t('nutritionAnalyzer.recommendations', 'Recomendaciones')}</h4>
                                        <ul className="space-y-1">
                                          {selectedDetail.recommendations.map((rec, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                              <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                                              {rec}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {onSelectAnalysis && (
                                      <Button onClick={handleLoadAnalysis} className="w-full">
                                        {t('nutritionHistory.loadAnalysis', 'Cargar este análisis')}
                                      </Button>
                                    )}
                                  </div>
                                ) : null}
                              </DialogContent>
                            </Dialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('nutritionHistory.deleteTitle', '¿Eliminar análisis?')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('nutritionHistory.deleteDescription', 'Esta acción no se puede deshacer. El análisis será eliminado permanentemente.')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel', 'Cancelar')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(item.id)}>
                                    {t('common.delete', 'Eliminar')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default NutritionHistory;
