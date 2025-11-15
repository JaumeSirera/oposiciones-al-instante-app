import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, X, FileQuestion } from 'lucide-react';
import { testService, type Proceso } from '@/services/testService';

export default function CrearTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    proceso: '',
    procesoPersonalizado: '',
    seccionPersonalizada: '',
    temaPersonalizado: '',
    numPreguntas: 50,
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
      if (!user?.id) return;
      
      setLoadingProcesos(true);
      try {
        const data = await testService.getProcesos(user.id);
        setProcesos(data || []);
      } catch (error) {
        console.error('Error al cargar procesos:', error);
        toast({
          variant: "destructive",
          title: "Error al cargar procesos",
          description: "No se pudieron cargar los procesos disponibles. Intenta recargar la página.",
        });
        setProcesos([]);
      } finally {
        setLoadingProcesos(false);
      }
    };
    loadProcesos();
  }, [user, toast]);

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
          title: "Error",
          description: "No se pudieron cargar las secciones del proceso seleccionado.",
        });
      } finally {
        setLoadingSecciones(false);
      }
    };
    loadSecciones();
  }, [formData.proceso, useCustomProceso, toast]);

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
          title: "Error",
          description: "No se pudieron cargar los temas de la sección seleccionada.",
        });
      } finally {
        setLoadingTemas(false);
      }
    };
    loadTemas();
  }, [formData.proceso, seccionesSeleccionadas, useCustomProceso, useCustomSeccion, toast]);

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

    if (!formData.proceso && !useCustomProceso) {
      toast({
        variant: "destructive",
        title: "Campo requerido",
        description: "Debes seleccionar un proceso"
      });
      return;
    }

    const seccionFinal = useCustomSeccion ? formData.seccionPersonalizada : seccionesSeleccionadas[0] || '';
    const temaFinal = useCustomTema ? formData.temaPersonalizado : temasSeleccionados[0] || '';

    if (!seccionFinal) {
      toast({
        variant: "destructive",
        title: "Campo requerido",
        description: "Debes seleccionar o escribir una sección"
      });
      return;
    }

    if (!temaFinal) {
      toast({
        variant: "destructive",
        title: "Campo requerido",
        description: "Debes seleccionar o escribir un tema"
      });
      return;
    }

    setLoading(true);
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
              texto: ''
            }
          })
        }
      );

      const data = await response.json();

      if (data.ok) {
        toast({
          title: "¡Preguntas guardadas!",
          description: `Se han generado y guardado ${data.preguntas} preguntas en la base de datos`
        });
        // Solo resetear el número de preguntas, mantener las selecciones
        setFormData(prev => ({ ...prev, numPreguntas: 50 }));
      } else {
        throw new Error(data.error || 'No se pudieron guardar las preguntas');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'No se pudo generar el test'
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
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inicio
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="w-6 h-6 text-primary" />
              Generar Test
            </CardTitle>
            <CardDescription>
              Selecciona el proceso, secciones y temas para generar preguntas de test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                <Label>Secciones (opcional - puedes seleccionar varias)</Label>
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
                <Label>Temas (opcional - puedes seleccionar varios)</Label>
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
                  max="200"
                  value={formData.numPreguntas}
                  onChange={(e) => setFormData(prev => ({ ...prev, numPreguntas: parseInt(e.target.value) || 50 }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Entre 1 y 200 preguntas
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
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileQuestion className="w-4 h-4 mr-2" />
                      Generar Test
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
