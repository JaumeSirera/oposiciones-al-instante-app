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
import { Loader2, ArrowLeft, X, Brain, Upload, FileText } from 'lucide-react';
import { testService, type Proceso } from '@/services/testService';
import { supabase } from '@/lib/supabaseClient';

export default function CrearPsicotecnicos() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  
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
  
  const [useCustomProceso, setUseCustomProceso] = useState(false);
  const [useCustomSeccion, setUseCustomSeccion] = useState(false);
  const [useCustomTema, setUseCustomTema] = useState(false);

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

    if (!formData.textoBase) {
      toast({
        variant: "destructive",
        title: t('createPsychotechnics.requiredField'),
        description: t('createPsychotechnics.mustProvideText')
      });
      return;
    }

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
      
      // Calcular total de combinaciones
      const totalCombinaciones = seccionesFinal.length * temasFinal.length;
      const preguntasPorCombinacion = Math.ceil(formData.numPreguntas / totalCombinaciones);
      
      // Check if text is long enough to use streaming
      const shouldUseStreaming = formData.textoBase.length > 6000;
      
      if (shouldUseStreaming) {
        // Create abort controller for cancellation
        const controller = new AbortController();
        setAbortController(controller);
        
        let totalGeneradas = 0;
        let errores = 0;
        let combinacionActual = 0;
        
        // Hacer una llamada por cada combinación sección-tema
        for (const seccion of seccionesFinal) {
          for (const tema of temasFinal) {
            combinacionActual++;
            
            try {
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
                    endpoint: 'generar_psicotecnicos.php',
                    id_proceso: procesoId,
                    tema: tema,
                    seccion: seccion,
                    id_usuario: user.id,
                    num_preguntas: preguntasPorCombinacion,
                    texto: formData.textoBase
                  })
                }
              );

              const data = await response.json();
              
              if (data.ok) {
                totalGeneradas += data.preguntas || 0;
                setProgressInfo({
                  current: combinacionActual,
                  total: totalCombinaciones,
                  message: `Generadas ${totalGeneradas} preguntas`,
                  generated: totalGeneradas,
                  fragmentos: data.texto_dividido ? {
                    total: data.fragmentos_totales || 1,
                    actual: 1
                  } : undefined
                });
              } else {
                errores++;
                console.error(`Error en ${seccion} - ${tema}:`, data.error);
                
                if (data.error && (data.error.includes('Límite') || data.error.includes('Créditos'))) {
                  setAbortController(null);
                  setProgressInfo(null);
                  setLoading(false);
                  
                  toast({
                    title: "Error al generar psicotécnicos",
                    description: data.error,
                    variant: "destructive",
                  });
                  
                  return;
                }
              }
            } catch (error: any) {
              if (error.name === 'AbortError') {
                throw error; // Re-throw abort errors
              }
              errores++;
              console.error(`Error en ${seccion} - ${tema}:`, error);
            }
          }
        }
        
        setAbortController(null);
        setProgressInfo(null);
        
        if (totalGeneradas > 0) {
          toast({
            title: "¡Psicotécnicos guardados!",
            description: `Se han generado y guardado ${totalGeneradas} preguntas psicotécnicas${errores > 0 ? ` (${errores} combinación${errores > 1 ? 'es' : ''} fallaron)` : ''}`
          });
          setFormData(prev => ({ ...prev, numPreguntas: 10, textoBase: '' }));
        } else {
          throw new Error('No se pudieron generar preguntas para ninguna combinación');
        }
      } else {
        // Direct calls for short texts (original logic)
        let totalGeneradas = 0;
        let errores = 0;

        // Hacer una llamada por cada combinación sección-tema
        for (const seccion of seccionesFinal) {
          for (const tema of temasFinal) {
            try {
              const response = await fetch(
                `https://yrjwyeuqfleqhbveohrf.supabase.co/functions/v1/php-api-proxy`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    endpoint: 'generar_psicotecnicos.php',
                    id_proceso: procesoId,
                    tema: tema,
                    seccion: seccion,
                    id_usuario: user.id,
                    num_preguntas: preguntasPorCombinacion,
                    texto: formData.textoBase
                  }),
                }
              );

              const data = await response.json();

              if (data.ok) {
                totalGeneradas += data.preguntas;
                
                // Update progress for short texts too
                const combinacionActual = (seccionesFinal.indexOf(seccion) * temasFinal.length) + temasFinal.indexOf(tema) + 1;
                setProgressInfo({
                  current: combinacionActual,
                  total: totalCombinaciones,
                  message: `Generando preguntas para ${seccion} - ${tema}`,
                  generated: totalGeneradas,
                  fragmentos: data.texto_dividido ? {
                    total: data.fragmentos_totales || 1,
                    actual: 1
                  } : undefined
                });
              } else {
                errores++;
                console.error(`Error en ${seccion} - ${tema}:`, data.error);
              }
            } catch (error) {
              errores++;
              console.error(`Error en ${seccion} - ${tema}:`, error);
            }
          }
        }

        if (totalGeneradas > 0) {
          toast({
            title: "¡Psicotécnicos guardados!",
            description: `Se han generado y guardado ${totalGeneradas} preguntas psicotécnicas${errores > 0 ? ` (${errores} combinación${errores > 1 ? 'es' : ''} fallaron)` : ''}`
          });
          // Resetear número de preguntas, mantener las selecciones
          setFormData(prev => ({ ...prev, numPreguntas: 10 }));
        } else {
          throw new Error('No se pudieron generar preguntas para ninguna combinación');
        }
      }
    } catch (error: any) {
      console.error('Error al generar psicotécnicos:', error);
      
      // Check if it was cancelled
      if (error.name === 'AbortError') {
        toast({
          title: "Generación cancelada",
          description: "El proceso ha sido cancelado por el usuario",
          variant: "destructive"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || 'No se pudieron generar los psicotécnicos'
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
              {/* Documento o Texto Base */}
              <div className="space-y-4">
                <div>
                  <Label>Documento o Texto Base *</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sube un documento o escribe el texto del cual se generarán las preguntas psicotécnicas
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
                          <p className="font-semibold text-lg mb-1">Extrayendo texto del documento</p>
                          <p className="text-sm text-muted-foreground">
                            Esto puede tardar unos segundos...
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
                            Subir documento
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PDF, DOC, DOCX o TXT
                          </span>
                        </label>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            O escribe el texto
                          </span>
                        </div>
                      </div>

                      <Textarea
                        placeholder="Escribe o pega aquí el texto del cual generar las preguntas psicotécnicas..."
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
                                  Texto extraído correctamente ({formData.textoBase.length} caracteres)
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
                            <p className="font-medium text-sm">Texto proporcionado</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formData.textoBase.length} caracteres
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
                <Label htmlFor="proceso">Proceso *</Label>
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
                          <SelectValue placeholder={loadingProcesos ? "Cargando..." : "Selecciona un proceso"} />
                        </SelectTrigger>
                        <SelectContent>
                          {procesos.map((proceso) => (
                            <SelectItem key={proceso.id} value={proceso.id.toString()}>
                              {proceso.descripcion}
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
                        O escribir concepto personalizado
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        id="procesoPersonalizado"
                        placeholder="Escribe tu propio concepto"
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
                        Volver a seleccionar de la lista
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Sección */}
              <div className="space-y-2">
                <Label>Sección * (puedes seleccionar varias)</Label>
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
                              loadingSecciones ? "Cargando..." :
                              !formData.proceso && !useCustomProceso ? "Primero selecciona un proceso" :
                              secciones.length === 0 ? "No hay secciones disponibles" :
                              "Selecciona una sección"
                            } 
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {secciones.filter(s => !seccionesSeleccionadas.includes(s)).map((seccion, index) => (
                            <SelectItem key={index} value={seccion}>
                              {seccion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {seccionesSeleccionadas.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                          {seccionesSeleccionadas.map((seccion, index) => (
                            <Badge key={index} variant="secondary" className="gap-1">
                              {seccion}
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
                        O escribir concepto personalizado
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder="Escribe tu propia sección"
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
                        Volver a seleccionar de la lista
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Temas */}
              <div className="space-y-2">
                <Label>Tema * (puedes seleccionar varios)</Label>
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
                              loadingTemas ? "Cargando..." :
                              seccionesSeleccionadas.length === 0 && !useCustomSeccion ? "Primero selecciona una sección" :
                              temas.length === 0 ? "No hay temas disponibles" :
                              "Selecciona un tema"
                            } 
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {temas.filter(t => !temasSeleccionados.includes(t)).map((tema, index) => (
                            <SelectItem key={index} value={tema}>
                              {tema}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {temasSeleccionados.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                          {temasSeleccionados.map((tema, index) => (
                            <Badge key={index} variant="secondary" className="gap-1">
                              {tema}
                              <X 
                                className="w-3 h-3 cursor-pointer hover:text-destructive" 
                                onClick={() => setTemasSeleccionados(prev => prev.filter(t => t !== tema))}
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
                        O escribir concepto personalizado
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        placeholder="Escribe tu propio tema"
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
                        Volver a seleccionar de la lista
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Número de preguntas */}
              <div className="space-y-2">
                <Label htmlFor="numPreguntas">Número de preguntas *</Label>
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
                  Entre 1 y 100 preguntas
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
                      {progressInfo.generated} preguntas generadas hasta ahora
                    </p>
                  )}
                  {progressInfo.fragmentos && (
                    <div className="flex items-center justify-between text-xs bg-primary/10 p-2 rounded">
                      <span className="text-muted-foreground">Fragmentos de texto procesados:</span>
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
                    Cancelar generación
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
                      Generando...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Generar Psicotécnicos
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
