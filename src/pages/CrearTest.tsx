import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, X, FileQuestion, Upload, FileText, Languages } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { testService, type Proceso } from '@/services/testService';
import { supabase } from '@/lib/supabaseClient';
import { useTranslateContent } from '@/hooks/useTranslateContent';

export default function CrearTest() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  
  const [loading, setLoading] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [progressInfo, setProgressInfo] = useState<{
    current: number;
    total: number;
    message: string;
    generated?: number;
  } | null>(null);
  const [formData, setFormData] = useState({
    proceso: '',
    procesoPersonalizado: '',
    seccionPersonalizada: '',
    temaPersonalizado: '',
    numPreguntas: 50,
    textoBase: '',
  });
  
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState<string[]>([]);
  const [temasSeleccionados, setTemasSeleccionados] = useState<string[]>([]);
  
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [secciones, setSecciones] = useState<string[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [loadingProcesos, setLoadingProcesos] = useState(false);
  const [loadingSecciones, setLoadingSecciones] = useState(false);
  const [loadingTemas, setLoadingTemas] = useState(false);
  
  // Translated versions
  const [translatedProcesos, setTranslatedProcesos] = useState<Map<number, string>>(new Map());
  const [translatedSecciones, setTranslatedSecciones] = useState<Map<string, string>>(new Map());
  const [translatedTemas, setTranslatedTemas] = useState<Map<string, string>>(new Map());
  
  const [useCustomProceso, setUseCustomProceso] = useState(false);
  const [useCustomSeccion, setUseCustomSeccion] = useState(false);
  const [useCustomTema, setUseCustomTema] = useState(false);

  useEffect(() => {
    const loadProcesos = async () => {
      if (!user?.id) return;
      
      setLoadingProcesos(true);
      try {
        const data = await testService.getProcesos(user.id);
        setProcesos(data || []);
      } catch (error) {
        console.error('Error al cargar procesos:', error);
        toast({
          variant: "destructive",
          title: t('createTest.errorLoadingProcesses'),
          description: t('createTest.errorLoadingProcessesDesc'),
        });
        setProcesos([]);
      } finally {
        setLoadingProcesos(false);
      }
    };
    loadProcesos();
  }, [user, toast, t]);

  useEffect(() => {
    const loadSecciones = async () => {
      if (!formData.proceso || useCustomProceso) {
        setSecciones([]);
        setSeccionesSeleccionadas([]);
        return;
      }
      
      setLoadingSecciones(true);
      try {
        const procesoId = parseInt(formData.proceso);
        const data = await testService.getSeccionesYTemas(procesoId);
        setSecciones(data?.secciones || []);
      } catch (error) {
        console.error('Error al cargar secciones:', error);
        setSecciones([]);
        toast({
          variant: "destructive",
          title: t('createTest.error'),
          description: t('createTest.errorLoadingSections'),
        });
      } finally {
        setLoadingSecciones(false);
      }
    };
    loadSecciones();
  }, [formData.proceso, useCustomProceso, toast, t]);

  useEffect(() => {
    const loadTemas = async () => {
      if (!formData.proceso || seccionesSeleccionadas.length === 0 || useCustomProceso || useCustomSeccion) {
        setTemas([]);
        setTemasSeleccionados([]);
        return;
      }
      
      setLoadingTemas(true);
      try {
        const procesoId = parseInt(formData.proceso);
        const data = await testService.getTemasPorSeccion(procesoId, seccionesSeleccionadas[0]);
        setTemas(data || []);
      } catch (error) {
        console.error('Error al cargar temas:', error);
        setTemas([]);
        toast({
          variant: "destructive",
          title: t('createTest.error'),
          description: t('createTest.errorLoadingTopics'),
        });
      } finally {
        setLoadingTemas(false);
      }
    };
    loadTemas();
  }, [formData.proceso, seccionesSeleccionadas, useCustomProceso, useCustomSeccion, toast, t]);

  // Translate processes when language changes or processes load
  useEffect(() => {
    const translateProcesosData = async () => {
      if (!needsTranslation || procesos.length === 0) {
        setTranslatedProcesos(new Map());
        return;
      }
      const descriptions = procesos.map(p => p.descripcion);
      const translated = await translateTexts(descriptions);
      const newMap = new Map<number, string>();
      procesos.forEach((p, i) => {
        newMap.set(p.id, translated[i] || p.descripcion);
      });
      setTranslatedProcesos(newMap);
    };
    translateProcesosData();
  }, [procesos, i18n.language, needsTranslation, translateTexts]);

  // Translate sections when language changes or sections load
  useEffect(() => {
    const translateSeccionesData = async () => {
      if (!needsTranslation || secciones.length === 0) {
        setTranslatedSecciones(new Map());
        return;
      }
      const translated = await translateTexts(secciones);
      const newMap = new Map<string, string>();
      secciones.forEach((s, i) => {
        newMap.set(s, translated[i] || s);
      });
      setTranslatedSecciones(newMap);
    };
    translateSeccionesData();
  }, [secciones, i18n.language, needsTranslation, translateTexts]);

  // Translate topics when language changes or topics load
  useEffect(() => {
    const translateTemasData = async () => {
      if (!needsTranslation || temas.length === 0) {
        setTranslatedTemas(new Map());
        return;
      }
      const translated = await translateTexts(temas);
      const newMap = new Map<string, string>();
      temas.forEach((t, i) => {
        newMap.set(t, translated[i] || t);
      });
      setTranslatedTemas(newMap);
    };
    translateTemasData();
  }, [temas, i18n.language, needsTranslation, translateTexts]);

  const handleArchivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivo(file);
    setExtractingText(true);

    try {
      const formDataFile = new FormData();
      formDataFile.append('file', file);

      const response = await supabase.functions.invoke('extraer-texto', {
        body: formDataFile,
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.texto) throw new Error(t('createTest.couldNotExtractText'));

      setFormData(prev => ({ ...prev, textoBase: response.data.texto }));

      toast({
        title: t('createTest.textExtracted'),
        description: t('createTest.textExtractedDesc'),
      });
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: t('createTest.error'),
        description: error.message || t('createTest.errorExtractingText'),
      });
      setArchivo(null);
    } finally {
      setExtractingText(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: t('createTest.error'),
        description: t('createTest.mustLogin')
      });
      return;
    }

    if (!formData.textoBase) {
      toast({
        variant: "destructive",
        title: t('createTest.requiredField'),
        description: t('createTest.mustProvideText')
      });
      return;
    }

    if (!formData.proceso && !useCustomProceso) {
      toast({
        variant: "destructive",
        title: t('createTest.requiredField'),
        description: t('createTest.mustSelectProcess')
      });
      return;
    }

    const seccionFinal = useCustomSeccion ? formData.seccionPersonalizada : seccionesSeleccionadas[0] || '';
    const temaFinal = useCustomTema ? formData.temaPersonalizado : temasSeleccionados[0] || '';

    if (!seccionFinal) {
      toast({
        variant: "destructive",
        title: t('createTest.requiredField'),
        description: t('createTest.mustSelectSection')
      });
      return;
    }

    if (!temaFinal) {
      toast({
        variant: "destructive",
        title: t('createTest.requiredField'),
        description: t('createTest.mustSelectTopic')
      });
      return;
    }

    setLoading(true);
    setProgressInfo(null);
    
    try {
      let procesoId = formData.proceso ? parseInt(formData.proceso) : null;
      
      // Si es proceso personalizado, primero crear el proceso
      if (useCustomProceso && formData.procesoPersonalizado) {
        const crearProcesoResponse = await fetch(
          `https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/php-api-proxy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              endpoint: 'procesos.php',
              method: 'POST',
              descripcion: formData.procesoPersonalizado,
              id_usuario: user.id
            })
          }
        );

        const crearProcesoData = await crearProcesoResponse.json();
        
        if (!crearProcesoData.ok) {
          throw new Error(crearProcesoData.error || t('createTest.couldNotCreateProcess'));
        }
        
        procesoId = crearProcesoData.id_proceso;
      }

      if (!procesoId) {
        throw new Error(t('createTest.couldNotDetermineProcess'));
      }
      
      // Check if text is long enough to use streaming
      const shouldUseStreaming = formData.textoBase.length > 6000;
      
      if (shouldUseStreaming) {
        // Create abort controller for cancellation
        const controller = new AbortController();
        setAbortController(controller);
        
        // Use SSE for progress updates
        const response = await fetch(
          `https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/php-api-proxy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
              endpoint: 'generar_preguntas.php',
              method: 'POST',
              body: {
                id_proceso: procesoId,
                seccion: seccionFinal,
                tema: temaFinal,
                id_usuario: user.id,
                num_preguntas: formData.numPreguntas,
                texto: formData.textoBase,
                use_streaming: true
              }
            })
          }
        );

        if (!response.ok || !response.body) {
          throw new Error('Failed to start streaming');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const event = JSON.parse(jsonStr);
                
                if (event.type === 'progress') {
                  setProgressInfo({
                    current: event.current,
                    total: event.total,
                    message: event.message
                  });
                } else if (event.type === 'chunk_complete') {
                  setProgressInfo({
                    current: event.current,
                    total: event.total,
                    message: t('createTest.completedFragment', { current: event.current, total: event.total }),
                    generated: event.totalGenerated
                  });
                } else if (event.type === 'complete') {
                  setAbortController(null);
                  toast({
                    title: t('createTest.questionsSaved'),
                    description: t('createTest.questionsSavedDesc', { count: event.generadas, chunks: event.chunks_procesados, total: event.total_chunks })
                  });
                  setFormData(prev => ({ ...prev, numPreguntas: 50, textoBase: '' }));
                  setProgressInfo(null);
                } else if (event.type === 'error') {
                  setAbortController(null);
                  throw new Error(event.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      } else {
        // Direct call for short texts
        const response = await fetch(
          `https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/php-api-proxy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              endpoint: 'generar_preguntas.php',
              method: 'POST',
              body: {
                id_proceso: procesoId,
                seccion: seccionFinal,
                tema: temaFinal,
                id_usuario: user.id,
                num_preguntas: formData.numPreguntas,
                texto: formData.textoBase
              }
            })
          }
        );

        const data = await response.json();

        if (data.ok) {
          toast({
            title: t('createTest.questionsSaved'),
            description: t('createTest.simpleQuestionsSavedDesc', { count: data.generadas || data.preguntas })
          });
          setFormData(prev => ({ ...prev, numPreguntas: 50, textoBase: '' }));
        } else {
          throw new Error(data.error || t('createTest.couldNotSaveQuestions'));
        }
      }
    } catch (error: any) {
      console.error('Error al generar preguntas:', error);
      
      // Check if it was cancelled
      if (error.name === 'AbortError') {
        toast({
          title: t('createTest.generationCancelled'),
          description: t('createTest.generationCancelledDesc'),
          variant: "destructive"
        });
      } else {
        toast({
          variant: "destructive",
          title: t('createTest.error'),
          description: error.message || t('createTest.couldNotGenerateTest')
        });
      }
    } finally {
      setLoading(false);
      setAbortController(null);
      setProgressInfo(null);
    }
  };

  const handleCancelar = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setLoading(false);
      setProgressInfo(null);
      toast({
        title: t('createTest.cancelled'),
        description: t('createTest.cancelledDesc')
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('createTest.backToHome')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="w-6 h-6 text-primary" />
              {t('createTest.title')}
            </CardTitle>
            <CardDescription>
              {t('createTest.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Documento o Texto Base */}
              <div className="space-y-4">
                <div>
                  <Label>{t('createTest.documentOrText')} *</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('createTest.documentOrTextDesc')}
                  </p>
                  
                  {extractingText && (
                    <div className="border-2 border-primary rounded-lg p-8 bg-primary/5">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <Loader2 className="h-12 w-12 text-primary animate-spin" />
                          <div className="absolute inset-0 animate-ping">
                            <Loader2 className="h-12 w-12 text-primary/30" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-lg mb-1">{t('createTest.extractingText')}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('createTest.mayTakeFewSeconds')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!extractingText && !archivo && !formData.textoBase && (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                        <Input
                          id="archivo"
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={handleArchivoChange}
                          className="hidden"
                          disabled={extractingText || loading}
                        />
                        <label
                          htmlFor="archivo"
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {t('createTest.uploadDocument')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PDF, DOC, DOCX {t('createTest.or')} TXT
                          </span>
                        </label>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            {t('createTest.orWriteText')}
                          </span>
                        </div>
                      </div>

                      <Textarea
                        placeholder={t('createTest.writeOrPasteText')}
                        value={formData.textoBase}
                        onChange={(e) => setFormData({ ...formData, textoBase: e.target.value })}
                        className="min-h-[200px]"
                        disabled={extractingText || loading}
                      />
                    </div>
                  )}

                  {!extractingText && archivo && (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{archivo.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {(archivo.size / 1024).toFixed(2)} KB
                            </p>
                            {formData.textoBase && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                                <p className="text-xs text-green-600 font-medium">
                                  {t('createTest.textExtractedCorrectly', { chars: formData.textoBase.length })}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setArchivo(null);
                            setFormData({ ...formData, textoBase: '' });
                          }}
                          disabled={extractingText || loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {!archivo && formData.textoBase && (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{t('createTest.textProvided')}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formData.textoBase.length} {t('createTest.characters')}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormData({ ...formData, textoBase: '' });
                          }}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Proceso */}
              <div className="space-y-2">
                <Label htmlFor="proceso">{t('createTest.process')} *</Label>
                <div className="space-y-2">
                  {!useCustomProceso ? (
                    <>
                      <Select
                        value={formData.proceso}
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, proceso: value }));
                          setSeccionesSeleccionadas([]);
                          setTemasSeleccionados([]);
                        }}
                        disabled={loadingProcesos}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingProcesos ? t('createTest.loading') : t('createTest.selectProcess')} />
                        </SelectTrigger>
                        <SelectContent>
                          {isTranslating && needsTranslation && (
                            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                              <Languages className="w-3 h-3 animate-pulse" />
                              {t('common.translating')}
                            </div>
                          )}
                          {procesos.map((proceso) => (
                            <SelectItem key={proceso.id} value={proceso.id.toString()}>
                              {translatedProcesos.get(proceso.id) || proceso.descripcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setUseCustomProceso(true);
                          setFormData(prev => ({ ...prev, proceso: '' }));
                          setSeccionesSeleccionadas([]);
                          setTemasSeleccionados([]);
                        }}
                        className="h-auto p-0 text-xs"
                      >
                        {t('createTest.orWriteCustom')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        id="procesoPersonalizado"
                        placeholder={t('createTest.writeYourConcept')}
                        value={formData.procesoPersonalizado}
                        onChange={(e) => setFormData(prev => ({ ...prev, procesoPersonalizado: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setUseCustomProceso(false);
                          setFormData(prev => ({ ...prev, procesoPersonalizado: '' }));
                        }}
                        className="h-auto p-0 text-xs"
                      >
                        {t('createTest.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Sección */}
              <div className="space-y-2">
                <Label>{t('createTest.sections')}</Label>
                <div className="space-y-2">
                  {!useCustomSeccion ? (
                    <>
                      <Select
                        onValueChange={(value) => {
                          if (!seccionesSeleccionadas.includes(value)) {
                            setSeccionesSeleccionadas(prev => [...prev, value]);
                          }
                        }}
                        disabled={loadingSecciones || (!formData.proceso && !useCustomProceso)}
                      >
                        <SelectTrigger>
                          <SelectValue 
                            placeholder={
                              loadingSecciones ? t('createTest.loading') :
                              !formData.proceso && !useCustomProceso ? t('createTest.firstSelectProcess') :
                              secciones.length === 0 ? t('createTest.noSectionsAvailable') :
                              t('createTest.selectSection')
                            } 
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {isTranslating && needsTranslation && (
                            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                              <Languages className="w-3 h-3 animate-pulse" />
                              {t('common.translating')}
                            </div>
                          )}
                          {secciones.filter(s => !seccionesSeleccionadas.includes(s)).map((seccion, index) => (
                            <SelectItem key={index} value={seccion}>
                              {translatedSecciones.get(seccion) || seccion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {seccionesSeleccionadas.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                          {seccionesSeleccionadas.map((seccion, index) => (
                            <Badge key={index} variant="secondary" className="gap-1">
                              {translatedSecciones.get(seccion) || seccion}
                              <X 
                                className="w-3 h-3 cursor-pointer hover:text-destructive" 
                                onClick={() => setSeccionesSeleccionadas(prev => prev.filter(s => s !== seccion))}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setUseCustomSeccion(true);
                          setSeccionesSeleccionadas([]);
                          setTemasSeleccionados([]);
                        }}
                        className="h-auto p-0 text-xs"
                      >
                        {t('createTest.orWriteCustom')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder={t('createTest.writeYourSection')}
                        value={formData.seccionPersonalizada}
                        onChange={(e) => setFormData(prev => ({ ...prev, seccionPersonalizada: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setUseCustomSeccion(false);
                          setFormData(prev => ({ ...prev, seccionPersonalizada: '' }));
                        }}
                        className="h-auto p-0 text-xs"
                      >
                        {t('createTest.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Temas */}
              <div className="space-y-2">
                <Label>{t('createTest.topics')}</Label>
                <div className="space-y-2">
                  {!useCustomTema ? (
                    <>
                      <Select
                        onValueChange={(value) => {
                          if (!temasSeleccionados.includes(value)) {
                            setTemasSeleccionados(prev => [...prev, value]);
                          }
                        }}
                        disabled={loadingTemas || (seccionesSeleccionadas.length === 0 && !useCustomSeccion)}
                      >
                        <SelectTrigger>
                          <SelectValue 
                            placeholder={
                              loadingTemas ? t('createTest.loading') :
                              seccionesSeleccionadas.length === 0 && !useCustomSeccion ? t('createTest.firstSelectSection') :
                              temas.length === 0 ? t('createTest.noTopicsAvailable') :
                              t('createTest.selectTopic')
                            } 
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {isTranslating && needsTranslation && (
                            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                              <Languages className="w-3 h-3 animate-pulse" />
                              {t('common.translating')}
                            </div>
                          )}
                          {temas.filter(tem => !temasSeleccionados.includes(tem)).map((tema, index) => (
                            <SelectItem key={index} value={tema}>
                              {translatedTemas.get(tema) || tema}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {temasSeleccionados.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                          {temasSeleccionados.map((tema, index) => (
                            <Badge key={index} variant="secondary" className="gap-1">
                              {translatedTemas.get(tema) || tema}
                              <X 
                                className="w-3 h-3 cursor-pointer hover:text-destructive" 
                                onClick={() => setTemasSeleccionados(prev => prev.filter(tem => tem !== tema))}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setUseCustomTema(true);
                          setTemasSeleccionados([]);
                        }}
                        className="h-auto p-0 text-xs"
                      >
                        {t('createTest.orWriteCustom')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder={t('createTest.writeYourTopic')}
                        value={formData.temaPersonalizado}
                        onChange={(e) => setFormData(prev => ({ ...prev, temaPersonalizado: e.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setUseCustomTema(false);
                          setFormData(prev => ({ ...prev, temaPersonalizado: '' }));
                        }}
                        className="h-auto p-0 text-xs"
                      >
                        {t('createTest.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Número de preguntas */}
              <div className="space-y-2">
                <Label htmlFor="numPreguntas">{t('createTest.numberOfQuestions')} *</Label>
                <Input
                  id="numPreguntas"
                  type="number"
                  min="1"
                  max="200"
                  value={formData.numPreguntas}
                  onChange={(e) => setFormData(prev => ({ ...prev, numPreguntas: parseInt(e.target.value) || 50 }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('createTest.between1And200')}
                </p>
              </div>

              {/* Progress Indicator */}
              {progressInfo && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{progressInfo.message}</span>
                    <span className="text-muted-foreground">
                      {progressInfo.current}/{progressInfo.total}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out"
                      style={{ width: `${(progressInfo.current / progressInfo.total) * 100}%` }}
                    />
                  </div>
                  {progressInfo.generated !== undefined && (
                    <p className="text-xs text-muted-foreground text-center">
                      {t('createTest.questionsGeneratedSoFar', { count: progressInfo.generated })}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelar}
                    className="w-full mt-2"
                  >
                    {t('createTest.cancelGeneration')}
                  </Button>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('createTest.generating')}
                    </>
                  ) : (
                    <>
                      <FileQuestion className="w-4 h-4 mr-2" />
                      {t('createTest.generateTest')}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  {t('createTest.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
