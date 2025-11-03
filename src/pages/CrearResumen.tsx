import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Upload, FileText, Sparkles, X } from 'lucide-react';
import { testService, type Proceso } from '@/services/testService';

export default function CrearResumen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
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
  
  // Estados para controlar si usar select o input personalizado
  const [useCustomProceso, setUseCustomProceso] = useState(false);
  const [useCustomSeccion, setUseCustomSeccion] = useState(false);
  const [useCustomTema, setUseCustomTema] = useState(false);

  // Cargar procesos al montar
  useEffect(() => {
    const loadProcesos = async () => {
      setLoadingProcesos(true);
      try {
        const data = await testService.getProcesos();
        setProcesos(data);
      } catch (error) {
        console.error('Error al cargar procesos:', error);
      } finally {
        setLoadingProcesos(false);
      }
    };
    loadProcesos();
  }, []);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 
                           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Archivo no válido",
          description: "Solo se permiten archivos PDF, TXT, DOC o DOCX"
        });
        return;
      }
      
      // Validar tamaño (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Archivo muy grande",
          description: "El archivo no debe superar los 20MB"
        });
        return;
      }
      
      setArchivo(file);
    }
  };

  const handleGenerarConIA = async () => {
    if (!formData.resumen) {
      toast({
        variant: "destructive",
        title: "Contenido requerido",
        description: "Debes escribir contenido para generar el resumen"
      });
      return;
    }

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debes iniciar sesión"
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
        title: "Campos requeridos",
        description: "Debes completar al menos el tema"
      });
      return;
    }

    setGeneratingAI(true);
    try {
      const procesoId = formData.proceso ? parseInt(formData.proceso) : 1;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/php-api-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: 'generar_resumen.php',
            id_usuario: user.id,
            id_proceso: procesoId,
            tema: temaFinal,
            seccion: `${procesoFinal}${seccionFinal ? ' - ' + seccionFinal : ''}`,
            texto: formData.resumen,
            nivel_detalle: 'largo'
          }),
        }
      );

      const data = await response.json();
      
      if (data.success && data.resumen) {
        setFormData(prev => ({
          ...prev,
          resumen: data.resumen
        }));
        
        toast({
          title: "Resumen generado",
          description: "El resumen ha sido generado con IA. Puedes editarlo antes de guardar."
        });
      } else {
        throw new Error(data.error || 'Error al generar resumen');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'No se pudo generar el resumen'
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debes iniciar sesión"
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
        title: "Campos requeridos",
        description: "Debes completar al menos el tema y el resumen"
      });
      return;
    }

    setLoading(true);
    try {
      const procesoId = formData.proceso ? parseInt(formData.proceso) : 1;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/php-api-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
        }
      );

      const data = await response.json();

      if (data.success || data.id) {
        toast({
          title: "¡Resumen guardado!",
          description: "El resumen se ha guardado correctamente"
        });
        navigate('/resumenes');
      } else {
        throw new Error(data.error || 'Error al guardar resumen');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'No se pudo guardar el resumen'
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
          Volver a resúmenes
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Crear Nuevo Resumen
            </CardTitle>
            <CardDescription>
              Sube un archivo o escribe directamente tu contenido. Puedes usar IA para generar el resumen automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Proceso */}
              <div className="space-y-2">
                <Label htmlFor="proceso">Proceso</Label>
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
                <Label htmlFor="seccion">Sección (puedes seleccionar varias)</Label>
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
                        id="seccionPersonalizada"
                        placeholder="Escribe tu propia sección"
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
                        Volver a seleccionar de la lista
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Tema */}
              <div className="space-y-2">
                <Label htmlFor="tema">Tema * (puedes seleccionar varios)</Label>
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
                        id="temaPersonalizado"
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

              <div className="space-y-2">
                <Label htmlFor="archivo">Subir Archivo (opcional)</Label>
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
                      Quitar
                    </Button>
                  )}
                </div>
                {archivo && (
                  <p className="text-sm text-muted-foreground">
                    Archivo seleccionado: {archivo.name} ({(archivo.size / 1024).toFixed(1)} KB)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Formatos permitidos: PDF, TXT, DOC, DOCX (máx. 20MB)
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="resumen">Contenido / Resumen *</Label>
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
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generar con IA
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="resumen"
                  placeholder="Escribe o pega aquí el contenido a resumir..."
                  value={formData.resumen}
                  onChange={(e) => setFormData(prev => ({ ...prev, resumen: e.target.value }))}
                  className="min-h-[300px]"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Puedes generar el resumen con IA desde un archivo o desde el texto que escribas aquí
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
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Guardar Resumen
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/resumenes')}
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
