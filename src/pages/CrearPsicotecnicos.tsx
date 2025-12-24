import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, X, Brain, Upload, FileText, Languages, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { testService, type Proceso } from '@/services/testService';
import { supabase } from '@/lib/supabaseClient';
import { useTranslateContent } from '@/hooks/useTranslateContent';
import { useGenerarPsicotecnicosIA } from '@/hooks/useGenerarPsicotecnicosIA';

export default function CrearPsicotecnicos() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  const { generarPsicotecnicos: generarPsicotecnicosIA, loading: loadingIA, progress: progressIA } = useGenerarPsicotecnicosIA();
  
  const [loading, setLoading] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [progressInfo, setProgressInfo] = useState<{
    current: number;
    total: number;
    message: string;
    generated?: number;
    fragmentos?: {
      total: number;
      actual: number;
    };
  } | null>(null);
  const [formData, setFormData] = useState({
    proceso: '',
    procesoPersonalizado: '',
    seccionPersonalizada: '',
    temaPersonalizado: '',
    numPreguntas: 10,
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
  const [showContentSection, setShowContentSection] = useState(false);

  // Asegurar prefijo "PSICO -" en los temas de psicotcnicos
  const ensurePsicoPrefix = (label: string): string => {
    if (!label) return "PSICO - General";
    const upper = label.toUpperCase();
    if (upper.startsWith("PSICO - ")) return label;
    if (upper.startsWith("PSICO -")) return "PSICO - " + label.substring(7).trim();
    return "PSICO - " + label.trim();
  };

  useEffect(() => {
    const loadProcesos = async () => {
      setLoadingProcesos(true);
      try {
        const data = await testService.getProcesos(user?.id);
        setProcesos(data);
      } catch (error) {
        console.error('Error al cargar procesos:', error);
      } finally {
        setLoadingProcesos(false);
      }
    };
    loadProcesos();
  }, [user]);

  useEffect(() => {
    const loadSecciones = async () => {
      if (!formData.proceso || useCustomProceso) {
        setSecciones([]);
        return;
      }
      
      setLoadingSecciones(true);
      try {
        const procesoId = parseInt(formData.proceso);
        const data = await testService.getSeccionesYTemas(procesoId);
        setSecciones(data.secciones || []);
      } catch (error) {
        console.error('Error al cargar secciones:', error);
        setSecciones([]);
      } finally {
        setLoadingSecciones(false);
      }
    };
    loadSecciones();
  }, [formData.proceso, useCustomProceso]);

  useEffect(() => {
    const loadTemas = async () => {
      if (!formData.proceso || seccionesSeleccionadas.length === 0 || useCustomProceso || useCustomSeccion) {
        setTemas([]);
        return;
      }
      
      setLoadingTemas(true);
      try {
        const procesoId = parseInt(formData.proceso);
        // Cargar temas de la primera sección seleccionada
        const data = await testService.getTemasPorSeccion(procesoId, seccionesSeleccionadas[0]);
        setTemas(data || []);
      } catch (error) {
        console.error('Error al cargar temas:', error);
        setTemas([]);
      } finally {
        setLoadingTemas(false);
      }
    };
    loadTemas();
  }, [formData.proceso, seccionesSeleccionadas, useCustomProceso, useCustomSeccion]);

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
      temas.forEach((tem, i) => {
        newMap.set(tem, translated[i] || tem);
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
      if (!response.data?.texto) throw new Error('No se pudo extraer el texto');

      setFormData(prev => ({ ...prev, textoBase: response.data.texto }));

      toast({
        title: t('createPsychotechnics.textExtracted'),
        description: t('createPsychotechnics.textExtractedDesc'),
      });
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: t('createPsychotechnics.error'),
        description: error.message || t('createPsychotechnics.couldNotExtractText'),
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
        title: t('createPsychotechnics.error'),
        description: t('createPsychotechnics.mustLogin')
      });
      return;
    }

    // Texto es opcional - si no hay texto, se generan preguntas basadas en tema/sección

    if (!formData.proceso && !useCustomProceso) {
      toast({
        variant: "destructive",
        title: t('createPsychotechnics.requiredField'),
        description: t('createPsychotechnics.mustSelectProcess')
      });
      return;
    }

    const seccionesFinal = useCustomSeccion 
      ? [formData.seccionPersonalizada] 
      : seccionesSeleccionadas;
    const temasFinal = useCustomTema 
      ? [formData.temaPersonalizado] 
      : temasSeleccionados;

    if (seccionesFinal.length === 0) {
      toast({
        variant: "destructive",
        title: t('createPsychotechnics.requiredField'),
        description: t('createPsychotechnics.mustSelectSection')
      });
      return;
    }

    if (temasFinal.length === 0) {
      toast({
        variant: "destructive",
        title: t('createPsychotechnics.requiredField'),
        description: t('createPsychotechnics.mustSelectTopic')
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
          throw new Error(crearProcesoData.error || 'No se pudo crear el proceso');
        }
        
        procesoId = crearProcesoData.id_proceso;
      }

      if (!procesoId) {
        throw new Error('No se pudo determinar el ID del proceso');
      }
      
      // Usar Lovable AI Edge Function (más rápido)
      let totalGeneradas = 0;
      let errores = 0;
      
      for (const seccion of seccionesFinal) {
        for (const tema of temasFinal) {
          const temaConPrefijo = ensurePsicoPrefix(tema);
          const preguntasPorCombinacion = Math.ceil(formData.numPreguntas / (seccionesFinal.length * temasFinal.length));
          
          const result = await generarPsicotecnicosIA({
            id_proceso: procesoId,
            seccion: seccion,
            tema: temaConPrefijo,
            num_preguntas: preguntasPorCombinacion,
            texto: formData.textoBase || undefined,
            documento: archivo?.name || (formData.textoBase ? "Texto introducido" : undefined),
          });

          if (result.success && result.preguntas) {
            // Guardar las preguntas generadas en la base de datos via PHP
            const guardarResponse = await fetch(
              `https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/php-api-proxy`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endpoint: 'guardar_preguntas_generadas.php',
                  method: 'POST',
                  body: {
                    id_proceso: procesoId,
                    seccion: seccion,
                    tema: temaConPrefijo,
                    id_usuario: user.id,
                    preguntas: result.preguntas,
                  }
                })
              }
            );

            const guardarData = await guardarResponse.json();
            
            if (guardarData.ok || guardarData.success) {
              totalGeneradas += result.preguntas.length;
              setProgressInfo({
                current: totalGeneradas,
                total: formData.numPreguntas,
                message: `Generadas ${totalGeneradas} preguntas`,
                generated: totalGeneradas,
              });
            } else {
              errores++;
              console.error(`Error guardando ${seccion} - ${temaConPrefijo}:`, guardarData.error);
            }
          } else {
            errores++;
            console.error(`Error generando ${seccion} - ${temaConPrefijo}:`, result.error);
          }
        }
      }

      if (totalGeneradas > 0) {
        toast({
          title: "¡Psicotécnicos guardados!",
          description: `Se han generado y guardado ${totalGeneradas} preguntas psicotécnicas${errores > 0 ? ` (${errores} combinación${errores > 1 ? 'es' : ''} fallaron)` : ''}`
        });
        setFormData(prev => ({ ...prev, numPreguntas: 10, textoBase: '' }));
        setArchivo(null);
      } else {
        throw new Error('No se pudieron generar preguntas para ninguna combinación');
      }
    } catch (error: any) {
      console.error('Error al generar psicotécnicos:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'No se pudieron generar los psicotécnicos'
      });
    } finally {
      setLoading(false);
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
        title: "Cancelado",
        description: "La generación de psicotécnicos ha sido cancelada"
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
          {t('createPsychotechnics.backToHome')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              {t('createPsychotechnics.title')}
            </CardTitle>
            <CardDescription>
              {t('createPsychotechnics.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Oposición (antes Proceso) */}
              <div className="space-y-2">
                <Label htmlFor="proceso">{t('createPsychotechnics.opposition')}</Label>
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
                          <SelectValue placeholder={loadingProcesos ? t('createPsychotechnics.loading') : t('createPsychotechnics.selectOpposition')} />
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
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUseCustomProceso(true);
                          setFormData(prev => ({ ...prev, proceso: '' }));
                          setSeccionesSeleccionadas([]);
                          setTemasSeleccionados([]);
                        }}
                        className="mt-2"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {t('createPsychotechnics.writeCustomOpposition')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        id="procesoPersonalizado"
                        placeholder={t('createPsychotechnics.writeYourConcept')}
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
                        {t('createPsychotechnics.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Sección */}
              <div className="space-y-2">
                <Label>{t('createPsychotechnics.sections')}</Label>
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
                              loadingSecciones ? t('createPsychotechnics.loading') :
                              !formData.proceso && !useCustomProceso ? t('createPsychotechnics.firstSelectOpposition') :
                              secciones.length === 0 ? t('createPsychotechnics.noSectionsAvailable') :
                              t('createPsychotechnics.selectSection')
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
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUseCustomSeccion(true);
                          setSeccionesSeleccionadas([]);
                          setTemasSeleccionados([]);
                        }}
                        className="mt-2"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {t('createPsychotechnics.writeCustomSection')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder={t('createPsychotechnics.writeYourSection')}
                        value={formData.seccionPersonalizada}
                        onChange={(e) => setFormData(prev => ({ ...prev, seccionPersonalizada: e.target.value }))}
                        required
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
                        {t('createPsychotechnics.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Temas */}
              <div className="space-y-2">
                <Label>{t('createPsychotechnics.topics')}</Label>
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
                              loadingTemas ? t('createPsychotechnics.loading') :
                              seccionesSeleccionadas.length === 0 && !useCustomSeccion ? t('createPsychotechnics.firstSelectSection') :
                              temas.length === 0 ? t('createPsychotechnics.noTopicsAvailable') :
                              t('createPsychotechnics.selectTopic')
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
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUseCustomTema(true);
                          setTemasSeleccionados([]);
                        }}
                        className="mt-2"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        {t('createPsychotechnics.writeCustomTopic')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder={t('createPsychotechnics.writeYourTopic')}
                        value={formData.temaPersonalizado}
                        onChange={(e) => setFormData(prev => ({ ...prev, temaPersonalizado: e.target.value }))}
                        required
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
                        {t('createPsychotechnics.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Número de preguntas */}
              <div className="space-y-2">
                <Label htmlFor="numPreguntas">{t('createPsychotechnics.numberOfQuestions')}</Label>
                <Input
                  id="numPreguntas"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.numPreguntas}
                  onChange={(e) => setFormData(prev => ({ ...prev, numPreguntas: parseInt(e.target.value) || 10 }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('createPsychotechnics.between1And100')}
                </p>
              </div>

              {/* Contenido de referencia (opcional, colapsable) */}
              <Collapsible open={showContentSection} onOpenChange={setShowContentSection}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {archivo || formData.textoBase ? t('createPsychotechnics.hideContent') : t('createPsychotechnics.addContentButton')}
                    </span>
                    {showContentSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('createPsychotechnics.documentOrTextDesc')}
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
                          <p className="font-semibold text-lg mb-1">{t('createPsychotechnics.extractingText')}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('createPsychotechnics.mayTakeFewSeconds')}
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
                            {t('createPsychotechnics.uploadDocument')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t('createPsychotechnics.fileTypes')}
                          </span>
                        </label>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            {t('createPsychotechnics.orWriteText')}
                          </span>
                        </div>
                      </div>

                      <Textarea
                        placeholder={t('createPsychotechnics.writeOrPasteText')}
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
                                  {t('createPsychotechnics.textExtractedCorrectly', { chars: formData.textoBase.length })}
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
                            <p className="font-medium text-sm">{t('createPsychotechnics.textProvided')}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formData.textoBase.length} {t('createPsychotechnics.characters')}
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
                </CollapsibleContent>
              </Collapsible>

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
                      {t('createPsychotechnics.questionsGeneratedSoFar', { count: progressInfo.generated })}
                    </p>
                  )}
                  {progressInfo.fragmentos && (
                    <div className="flex items-center justify-between text-xs bg-primary/10 p-2 rounded">
                      <span className="text-muted-foreground">{t('createPsychotechnics.fragmentsProcessed')}</span>
                      <span className="font-medium text-primary">
                        {progressInfo.fragmentos.actual}/{progressInfo.fragmentos.total}
                      </span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelar}
                    className="w-full mt-2"
                  >
                    {t('createPsychotechnics.cancelGeneration')}
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
                      {t('createPsychotechnics.generating')}
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      {t('createPsychotechnics.generatePsychotechnics')}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  {t('createPsychotechnics.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
