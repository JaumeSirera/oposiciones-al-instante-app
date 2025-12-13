import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslateContent } from '@/hooks/useTranslateContent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Upload, FileText, Sparkles, X, Languages } from 'lucide-react';
import { testService, type Proceso } from '@/services/testService';

export default function CrearResumen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { translateTexts, isTranslating } = useTranslateContent();
  
  const [loading, setLoading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [formData, setFormData] = useState({
    proceso: '',
    procesoPersonalizado: '',
    seccionPersonalizada: '',
    temaPersonalizado: '',
    resumen: '',
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  
  // Arrays para selecciones múltiples
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState<string[]>([]);
  const [temasSeleccionados, setTemasSeleccionados] = useState<string[]>([]);
  
  // Estados para los datos de los selects
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [secciones, setSecciones] = useState<string[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [loadingProcesos, setLoadingProcesos] = useState(false);
  const [loadingSecciones, setLoadingSecciones] = useState(false);
  const [loadingTemas, setLoadingTemas] = useState(false);
  
  // Estados para traducciones
  const [translatedProcesos, setTranslatedProcesos] = useState<Map<number, string>>(new Map());
  const [translatedSecciones, setTranslatedSecciones] = useState<Map<string, string>>(new Map());
  const [translatedTemas, setTranslatedTemas] = useState<Map<string, string>>(new Map());
  
  // Estados para controlar si usar select o input personalizado
  const [useCustomProceso, setUseCustomProceso] = useState(false);
  const [useCustomSeccion, setUseCustomSeccion] = useState(false);
  const [useCustomTema, setUseCustomTema] = useState(false);

  // Cargar procesos al montar
  useEffect(() => {
    const loadProcesos = async () => {
      setLoadingProcesos(true);
      try {
        const data = await testService.getProcesos(user?.id);
        setProcesos(data);
        
        // Traducir procesos si no es español
        if (i18n.language !== 'es' && data.length > 0) {
          const textos = data.map(p => p.descripcion);
          const traducciones = await translateTexts(textos);
          const map = new Map<number, string>();
          data.forEach((p, idx) => {
            map.set(p.id, traducciones[idx] || p.descripcion);
          });
          setTranslatedProcesos(map);
        }
      } catch (error) {
        console.error('Error al cargar procesos:', error);
      } finally {
        setLoadingProcesos(false);
      }
    };
    loadProcesos();
  }, [user, i18n.language]);

  // Cargar secciones cuando se selecciona un proceso
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
        const seccionesData = data.secciones || [];
        setSecciones(seccionesData);
        
        // Traducir secciones si no es español
        if (i18n.language !== 'es' && seccionesData.length > 0) {
          const traducciones = await translateTexts(seccionesData);
          const map = new Map<string, string>();
          seccionesData.forEach((s: string, idx: number) => {
            map.set(s, traducciones[idx] || s);
          });
          setTranslatedSecciones(map);
        }
      } catch (error) {
        console.error('Error al cargar secciones:', error);
        setSecciones([]);
      } finally {
        setLoadingSecciones(false);
      }
    };
    loadSecciones();
  }, [formData.proceso, useCustomProceso, i18n.language]);

  // Cargar temas cuando se selecciona una sección
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
        const temasData = await testService.getTemasPorSeccion(procesoId, seccionesSeleccionadas[0]);
        setTemas(temasData || []);
        
        // Traducir temas si no es español
        if (i18n.language !== 'es' && temasData && temasData.length > 0) {
          const traducciones = await translateTexts(temasData);
          const map = new Map<string, string>();
          temasData.forEach((tema: string, idx: number) => {
            map.set(tema, traducciones[idx] || tema);
          });
          setTranslatedTemas(map);
        }
      } catch (error) {
        console.error('Error al cargar temas:', error);
        setTemas([]);
      } finally {
        setLoadingTemas(false);
      }
    };
    loadTemas();
  }, [formData.proceso, seccionesSeleccionadas, useCustomProceso, useCustomSeccion, i18n.language]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 
                           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: t('createSummary.invalidFile'),
          description: t('createSummary.onlyAllowedFormats')
        });
        return;
      }
      
      // Validar tamaño (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: t('createSummary.fileTooLarge'),
          description: t('createSummary.maxFileSize')
        });
        return;
      }
      
      setArchivo(file);
    }
  };

  const [progressMessage, setProgressMessage] = useState('');
  const [resumenBreve, setResumenBreve] = useState('');

  const handleGenerarConIA = async () => {
    if (!formData.resumen) {
      toast({
        variant: "destructive",
        title: t('createSummary.contentRequired'),
        description: t('createSummary.mustWriteContent')
      });
      return;
    }

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: t('createSummary.error'),
        description: t('createSummary.mustLogin')
      });
      return;
    }

    // Determinar valores finales
    const procesoFinal = useCustomProceso ? formData.procesoPersonalizado : 
                         procesos.find(p => p.id.toString() === formData.proceso)?.descripcion || '';
    const seccionFinal = useCustomSeccion ? formData.seccionPersonalizada : seccionesSeleccionadas.join(', ');
    const temaFinal = useCustomTema ? formData.temaPersonalizado : temasSeleccionados.join(', ');

    if (!temaFinal) {
      toast({
        variant: "destructive",
        title: t('createSummary.requiredFields'),
        description: t('createSummary.mustCompleteTopic')
      });
      return;
    }

    setGeneratingAI(true);
    setProgressMessage(t('createSummary.startingGeneration') || 'Iniciando generación...');
    setResumenBreve('');
    
    try {
      // Construir contexto para el resumen
      const contexto = `Tema: ${temaFinal}${procesoFinal ? ` | Proceso: ${procesoFinal}` : ''}${seccionFinal ? ` | Sección: ${seccionFinal}` : ''}

Contenido a resumir:
${formData.resumen}`;

      // Llamar a la edge function con streaming usando URL directa
      const supabaseUrl = 'https://yrjwyeuqfleqhbveohrf.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generar-resumen`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            contenido: contexto,
            idioma: i18n.language,
            palabras_objetivo: 1200,
            streaming: true,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('createSummary.errorGenerating'));
      }

      // Procesar SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No se pudo leer la respuesta');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.fase) {
                // Evento de progreso
                setProgressMessage(data.mensaje || data.fase);
              }
              
              if (data.resumen && !data.success) {
                // Resumen breve recibido
                setResumenBreve(data.resumen);
              }
              
              if (data.success && data.resumen) {
                // Resumen completo recibido
                setFormData(prev => ({
                  ...prev,
                  resumen: data.resumen
                }));
                
                if (data.resumen_breve) {
                  setResumenBreve(data.resumen_breve);
                }
                
                toast({
                  title: t('createSummary.summaryGenerated'),
                  description: t('createSummary.summaryGeneratedDesc')
                });
              }
              
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError) {
              // Ignorar errores de parsing en líneas incompletas
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error generando resumen:', error);
      toast({
        variant: "destructive",
        title: t('createSummary.error'),
        description: error.message || t('createSummary.couldNotGenerate')
      });
    } finally {
      setGeneratingAI(false);
      setProgressMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: t('createSummary.error'),
        description: t('createSummary.mustLogin')
      });
      return;
    }

    // Determinar valores finales
    const procesoFinal = useCustomProceso ? formData.procesoPersonalizado : 
                         procesos.find(p => p.id.toString() === formData.proceso)?.descripcion || '';
    const seccionFinal = useCustomSeccion ? formData.seccionPersonalizada : seccionesSeleccionadas.join(', ');
    const temaFinal = useCustomTema ? formData.temaPersonalizado : temasSeleccionados.join(', ');

    if (!temaFinal || !formData.resumen) {
      toast({
        variant: "destructive",
        title: t('createSummary.requiredFields'),
        description: t('createSummary.mustCompleteTopicAndSummary')
      });
      return;
    }

    setLoading(true);
    try {
      const procesoId = formData.proceso ? parseInt(formData.proceso) : 1;
      
      // Guardar vía php-api-proxy con URL directa
      const supabaseUrl = 'https://yrjwyeuqfleqhbveohrf.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyand5ZXVxZmxlcWhidmVvaHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjM1OTUsImV4cCI6MjA3NTUzOTU5NX0.QeAWfPjecNzz_d1MY1UHYmVN9bYl23rzot9gDsUtXKY';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/php-api-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          endpoint: 'generar_resumen.php',
          id_usuario: user.id,
          id_proceso: procesoId,
          tema: temaFinal,
          seccion: `${procesoFinal}${seccionFinal ? ' - ' + seccionFinal : ''}`,
          texto: formData.resumen,
          nivel_detalle: 'corto'
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al guardar');

      if (data.success || data.id) {
        toast({
          title: t('createSummary.summarySaved'),
          description: t('createSummary.summarySavedDesc')
        });
        navigate('/resumenes');
      } else {
        throw new Error(data.error || t('createSummary.errorSaving'));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('createSummary.error'),
        description: error.message || t('createSummary.couldNotSave')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/resumenes')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('createSummary.backToSummaries')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              {t('createSummary.title')}
            </CardTitle>
            <CardDescription>
              {t('createSummary.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Proceso */}
              <div className="space-y-2">
                <Label htmlFor="proceso">{t('createSummary.process')}</Label>
                <div className="space-y-2">
                  {!useCustomProceso ? (
                    <>
                      <Select
                        value={formData.proceso}
                        onValueChange={(value) => {
                          setFormData(prev => ({ 
                            ...prev, 
                            proceso: value
                          }));
                          setSeccionesSeleccionadas([]);
                          setTemasSeleccionados([]);
                        }}
                        disabled={loadingProcesos}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingProcesos ? t('createSummary.loading') : t('createSummary.selectProcess')} />
                        </SelectTrigger>
                        <SelectContent>
                          {isTranslating && i18n.language !== 'es' && (
                            <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                              <Languages className="w-3 h-3 animate-pulse" />
                              {t('common.translating')}
                            </div>
                          )}
                          {procesos.map((proceso) => (
                            <SelectItem key={proceso.id} value={proceso.id.toString()}>
                              {i18n.language !== 'es' && translatedProcesos.get(proceso.id) 
                                ? translatedProcesos.get(proceso.id) 
                                : proceso.descripcion}
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
                        {t('createSummary.orWriteCustom')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        id="procesoPersonalizado"
                        placeholder={t('createSummary.writeYourConcept')}
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
                        {t('createSummary.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Sección */}
              <div className="space-y-2">
                <Label htmlFor="seccion">{t('createSummary.sections')}</Label>
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
                              loadingSecciones ? t('createSummary.loading') :
                              !formData.proceso && !useCustomProceso ? t('createSummary.firstSelectProcess') :
                              secciones.length === 0 ? t('createSummary.noSectionsAvailable') :
                              t('createSummary.selectSection')
                            } 
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {isTranslating && i18n.language !== 'es' && (
                            <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                              <Languages className="w-3 h-3 animate-pulse" />
                              {t('common.translating')}
                            </div>
                          )}
                          {secciones.filter(s => !seccionesSeleccionadas.includes(s)).map((seccion, index) => (
                            <SelectItem key={index} value={seccion}>
                              {i18n.language !== 'es' && translatedSecciones.get(seccion) 
                                ? translatedSecciones.get(seccion) 
                                : seccion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {seccionesSeleccionadas.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                          {seccionesSeleccionadas.map((seccion, index) => (
                            <Badge key={index} variant="secondary" className="gap-1">
                              {i18n.language !== 'es' && translatedSecciones.get(seccion) 
                                ? translatedSecciones.get(seccion) 
                                : seccion}
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
                        {t('createSummary.orWriteCustom')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        id="seccionPersonalizada"
                        placeholder={t('createSummary.writeYourSection')}
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
                        {t('createSummary.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Tema */}
              <div className="space-y-2">
                <Label htmlFor="tema">{t('createSummary.topics')} *</Label>
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
                              loadingTemas ? t('createSummary.loading') :
                              seccionesSeleccionadas.length === 0 && !useCustomSeccion ? t('createSummary.firstSelectSection') :
                              temas.length === 0 ? t('createSummary.noTopicsAvailable') :
                              t('createSummary.selectTopic')
                            } 
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {isTranslating && i18n.language !== 'es' && (
                            <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                              <Languages className="w-3 h-3 animate-pulse" />
                              {t('common.translating')}
                            </div>
                          )}
                          {temas.filter(tema => !temasSeleccionados.includes(tema)).map((tema, index) => (
                            <SelectItem key={index} value={tema}>
                              {i18n.language !== 'es' && translatedTemas.get(tema) 
                                ? translatedTemas.get(tema) 
                                : tema}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {temasSeleccionados.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/30">
                          {temasSeleccionados.map((tema, index) => (
                            <Badge key={index} variant="secondary" className="gap-1">
                              {i18n.language !== 'es' && translatedTemas.get(tema) 
                                ? translatedTemas.get(tema) 
                                : tema}
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
                        {t('createSummary.orWriteCustom')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        id="temaPersonalizado"
                        placeholder={t('createSummary.writeYourTopic')}
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
                        {t('createSummary.backToList')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="archivo">{t('createSummary.uploadFile')}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="archivo"
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  {archivo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setArchivo(null)}
                    >
                      {t('createSummary.remove')}
                    </Button>
                  )}
                </div>
                {archivo && (
                  <p className="text-sm text-muted-foreground">
                    {t('createSummary.selectedFile')}: {archivo.name} ({(archivo.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('createSummary.allowedFormats')}
                </p>
              </div>

              {/* Progreso de streaming */}
              {generatingAI && progressMessage && (
                <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="font-medium">{progressMessage}</span>
                  </div>
                </div>
              )}

              {/* Resumen breve (preview durante generación) */}
              {resumenBreve && (
                <div className="space-y-2">
                  <Label>{t('createSummary.executiveSummary') || 'Resumen ejecutivo'}</Label>
                  <div className="p-4 border rounded-lg bg-muted/30 whitespace-pre-wrap text-sm">
                    {resumenBreve}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="resumen">{t('createSummary.content')} *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerarConIA}
                    disabled={generatingAI || (!archivo && !formData.resumen)}
                  >
                    {generatingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('createSummary.generating')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        {t('createSummary.generateWithAI')}
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="resumen"
                  placeholder={t('createSummary.writeOrPaste')}
                  value={formData.resumen}
                  onChange={(e) => setFormData(prev => ({ ...prev, resumen: e.target.value }))}
                  className="min-h-[300px]"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('createSummary.canGenerateWithAI')}
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('createSummary.saving')}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {t('createSummary.saveSummary')}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/resumenes')}
                  disabled={loading}
                >
                  {t('createSummary.cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
