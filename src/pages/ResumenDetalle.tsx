import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, Brain, FileText, Calendar, Volume2, VolumeX } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useTranslateContent } from '@/hooks/useTranslateContent';
import { useToast } from '@/hooks/use-toast';

interface Detalle {
  id: number;
  tema?: string;
  seccion?: string;
  resumen?: string;
  archivo_nombre?: string;
  archivo_tipo?: string;
  archivo_tamano?: number;
  fecha?: string;
}

export default function ResumenDetalle() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [techVisible, setTechVisible] = useState(false);
  const [techText, setTechText] = useState('');
  const [techLoading, setTechLoading] = useState(false);
  const [techSaving, setTechSaving] = useState(false);
  const [techGenerating, setTechGenerating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<{
    tema?: string;
    seccion?: string;
    resumen?: string;
  }>({});

  const { speak, stop, isPlaying, isEnabled, toggleEnabled, isSupported } = useTextToSpeech(i18n.language);
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const cargarDetalle = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://oposiciones-test.com/api/detalle_resumen.php?id=${id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error(t('summaryDetail.errorLoading'));
      
      const data = await response.json();
      
      if (data?.resumen) {
        const resumenData = data.resumen as Detalle & { archivo_texto?: string };
        const resumenTexto = resumenData.resumen || (resumenData as any).archivo_texto || '';

        setDetalle({
          ...resumenData,
          resumen: resumenTexto,
        });
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error(t('summaries.invalidResponse'));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('summaryDetail.couldNotLoad')
      });
      navigate('/resumenes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast, t]);

  // Traducir contenido cuando cambia el idioma o se carga el detalle
  useEffect(() => {
    const translateContent = async () => {
      if (!detalle) return;
      
      const resumenTexto = detalle.resumen || '';
      
      if (!needsTranslation) {
        setTranslatedContent({
          tema: detalle.tema,
          seccion: detalle.seccion,
          resumen: resumenTexto,
        });
        return;
      }

      // Siempre intentar traducir, el Edge Function maneja textos largos por chunks
      const textsToTranslate = [
        detalle.tema || '',
        detalle.seccion || '',
        resumenTexto,
      ];

      const translated = await translateTexts(textsToTranslate);
      setTranslatedContent({
        tema: translated[0] || detalle.tema,
        seccion: translated[1] || detalle.seccion,
        resumen: translated[2] || resumenTexto,
      });
    };

    translateContent();
  }, [detalle, needsTranslation, translateTexts, i18n.language]);

  const cargarTecnica = useCallback(async () => {
    if (!id) return;
    
    setTechLoading(true);
    try {
      const response = await fetch(
        `https://oposiciones-test.com/api/tecnica_resumen.php?resumen_id=${id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error(t('summaryDetail.errorLoadingTechnique'));
      
      const data = await response.json();
      
      if (data?.tecnica) {
        setTechText(data.tecnica);
      }
    } catch (error: any) {
      console.error('Error cargando técnica:', error);
    } finally {
      setTechLoading(false);
    }
  }, [id, t]);

  const guardarTecnica = useCallback(async () => {
    if (!id) return;
    
    setTechSaving(true);
    try {
      const response = await fetch(
        `https://oposiciones-test.com/api/tecnica_resumen.php`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumen_id: Number(id),
            tecnica: techText,
          }),
        }
      );
      
      if (!response.ok) throw new Error(t('summaryDetail.errorSavingTechnique'));
      
      const data = await response.json();
      
      if (data?.success) {
        toast({
          title: t('common.success'),
          description: t('summaryDetail.techniqueSaved'),
        });
        setTechVisible(false);
      } else {
        throw new Error(data?.error || t('summaryDetail.errorSaving'));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('summaryDetail.couldNotSaveTechnique')
      });
    } finally {
      setTechSaving(false);
    }
  }, [id, techText, toast, t]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  const generarConGemini = useCallback(async (metodo: string) => {
    if (!detalle) return;
    
    setTechGenerating(true);
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generar-tecnica`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resumen: detalle.resumen,
            tema: detalle.tema,
            seccion: detalle.seccion,
            metodo: metodo,
          }),
        }
      );
      
      if (!response.ok) throw new Error(t('summaryDetail.errorGeneratingTechnique'));
      
      const data = await response.json();
      
      if (data?.tecnica) {
        setTechText(data.tecnica);
        toast({
          title: t('common.success'),
          description: t('summaryDetail.techniqueGenerated'),
        });
      } else {
        throw new Error(data?.error || t('summaryDetail.errorGenerating'));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('summaryDetail.couldNotGenerate')
      });
    } finally {
      setTechGenerating(false);
    }
  }, [detalle, supabaseUrl, supabaseKey, toast, t]);

  const insertTemplate = (template: string) => {
    const templates: Record<string, string> = {
      'loci': t('summaryDetail.templates.loci'),
      'feynman': t('summaryDetail.templates.feynman'),
      'acronimo': t('summaryDetail.templates.acronym'),
      'flashcards': t('summaryDetail.templates.flashcards'),
    };
    
    const txt = templates[template] || '';
    setTechText((prev) => (prev ? (prev + '\n\n' + txt) : txt));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const formatDate = (fecha?: string) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;
    return new Intl.DateTimeFormat(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{t('summaryDetail.notFound')}</p>
            <Button onClick={() => navigate('/resumenes')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('summaryDetail.backToSummaries')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/resumenes')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('summaryDetail.backToSummaries')}
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="flex items-start gap-2">
                <FileText className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <span>{isTranslating ? t('common.translating') : (translatedContent.tema || detalle.tema || t('summaryDetail.noTopic'))}</span>
              </CardTitle>
              {isSupported && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleEnabled}
                    title={isEnabled ? t('quiz.disableAudio') : t('quiz.enableAudio')}
                  >
                    {isEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                  {isEnabled && (detalle.resumen) && (
                    <Button
                      variant={isPlaying ? "secondary" : "default"}
                      size="sm"
                      onClick={() => isPlaying ? stop() : speak(detalle.resumen || '')}
                    >
                      {isPlaying ? t('quiz.stop') : t('quiz.listen')}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {detalle.seccion && (
              <CardDescription className="text-base font-medium">
                {isTranslating ? t('common.translating') : (translatedContent.seccion || detalle.seccion)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">{t('summaryDetail.summary')}:</h3>
              {isTranslating ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.translating')}
                </div>
              ) : (
                <p className="text-base leading-relaxed whitespace-pre-wrap">
                  {translatedContent.resumen || detalle.resumen || t('summaryDetail.noContent')}
                </p>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {detalle.archivo_nombre && (
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">{t('summaryDetail.originalFile')}:</h3>
                  <p className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {detalle.archivo_nombre}
                    {detalle.archivo_tamano && ` (${formatFileSize(detalle.archivo_tamano)})`}
                  </p>
                </div>
              )}
              
              {detalle.archivo_tipo && (
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">{t('summaryDetail.type')}:</h3>
                  <p>{detalle.archivo_tipo}</p>
                </div>
              )}
              
              {detalle.fecha && (
                <div>
                  <h3 className="font-semibold text-muted-foreground mb-1">{t('summaryDetail.date')}:</h3>
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(detalle.fecha)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            <Dialog open={techVisible} onOpenChange={setTechVisible}>
              <DialogTrigger asChild>
                <Button 
                  className="w-full" 
                  variant="default"
                  onClick={() => {
                    setTechVisible(true);
                    cargarTecnica();
                  }}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  {t('summaryDetail.memorizationTechnique')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('summaryDetail.memorizeThis')}</DialogTitle>
                  <DialogDescription>
                    {t('summaryDetail.addTechniqueOrTemplate')}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">{t('summaryDetail.generateWithAI')}:</p>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('feynman')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? t('summaryDetail.generating') : t('summaryDetail.generateFeynman')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('loci')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? t('summaryDetail.generating') : t('summaryDetail.generateLoci')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('mapa')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? t('summaryDetail.generating') : t('summaryDetail.generateMindMap')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default" 
                        onClick={() => generarConGemini('preguntas')}
                        disabled={techGenerating}
                      >
                        {techGenerating ? t('summaryDetail.generating') : t('summaryDetail.generateQA')}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">{t('summaryDetail.orInsertTemplate')}:</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('loci')}>
                        Loci
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('feynman')}>
                        Feynman
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('acronimo')}>
                        {t('summaryDetail.acronym')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => insertTemplate('flashcards')}>
                        Flashcards
                      </Button>
                    </div>
                  </div>

                  {techLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={techText}
                        onChange={(e) => setTechText(e.target.value)}
                        placeholder={t('summaryDetail.describeHowToMemorize')}
                        className="min-h-[300px]"
                      />
                      <p className="text-sm text-muted-foreground">
                        {techText.length} {t('summaryDetail.characters')}
                      </p>
                    </>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setTechVisible(false)}
                    >
                      {t('common.close')}
                    </Button>
                    <Button
                      onClick={guardarTecnica}
                      disabled={techSaving || techLoading}
                    >
                      {techSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {t('common.save')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
