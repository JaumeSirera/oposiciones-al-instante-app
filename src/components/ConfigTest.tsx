import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, BookOpen, Clock, Play, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { testService, type Proceso } from '@/services/testService';
import { useAuth } from '@/contexts/AuthContext';

interface ConfigTestProps {
  onStartQuiz: (config: TestConfig) => void;
  onBack: () => void;
  initialType?: 'simulacion' | 'examen';
  isPsicotecnico?: boolean;
  initialProceso?: string | null;
  initialTemas?: string | null;
  initialSecciones?: string | null;
}

export interface TestConfig {
  proceso_id: number;
  secciones: string[];
  temas: string[];
  numPreguntas: number;
  minutos: number;
  tipo: 'simulacion' | 'examen';
}

const ConfigTest: React.FC<ConfigTestProps> = ({ 
  onStartQuiz, 
  onBack, 
  initialType = 'simulacion', 
  isPsicotecnico = false,
  initialProceso,
  initialTemas,
  initialSecciones
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [selectedProceso, setSelectedProceso] = useState<number | null>(null);
  const [secciones, setSecciones] = useState<string[]>([]);
  const [selectedSecciones, setSelectedSecciones] = useState<string[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [numPreguntas, setNumPreguntas] = useState('50');
  const [minutos, setMinutos] = useState('30');
  const [tipoTest, setTipoTest] = useState<'simulacion' | 'examen'>(initialType);
  const [initialLoad, setInitialLoad] = useState(true);

  // Cargar procesos al montar
  useEffect(() => {
    loadProcesos();
  }, []);

  // Configurar valores iniciales desde URL
  useEffect(() => {
    if (initialLoad && procesos.length > 0 && initialProceso) {
      const procesoId = parseInt(initialProceso);
      if (!isNaN(procesoId)) {
        setSelectedProceso(procesoId);
      }
      setInitialLoad(false);
    }
  }, [procesos, initialProceso, initialLoad]);

  // Pre-seleccionar secciones desde URL después de cargarlas
  useEffect(() => {
    if (initialSecciones && secciones.length > 0 && selectedSecciones.length === 0) {
      const seccionesArray = initialSecciones.split(',').map(s => s.trim());
      const seccionesValidas = seccionesArray.filter(s => secciones.includes(s));
      if (seccionesValidas.length > 0) {
        setSelectedSecciones(seccionesValidas);
      }
    }
  }, [secciones, initialSecciones]);

  // Pre-seleccionar temas desde URL después de cargarlos
  useEffect(() => {
    if (initialTemas && temas.length > 0 && selectedTemas.length === 0) {
      const temasArray = initialTemas.split(',').map(t => t.trim());
      const temasValidos = temasArray.filter(t => temas.includes(t));
      if (temasValidos.length > 0) {
        setSelectedTemas(temasValidos);
      }
    }
  }, [temas, initialTemas]);

  // Cargar secciones cuando se selecciona un proceso
  useEffect(() => {
    if (selectedProceso) {
      loadSeccionesYTemas();
    } else {
      setSecciones([]);
      setTemas([]);
      setSelectedSecciones([]);
      setSelectedTemas([]);
    }
  }, [selectedProceso]);

  // Cargar temas cuando se seleccionan secciones
  useEffect(() => {
    if (selectedProceso && selectedSecciones.length > 0) {
      loadTemasPorSecciones();
    } else if (selectedSecciones.length === 0) {
      setTemas([]);
      // Solo limpiar los temas seleccionados si no hay temas iniciales pendientes
      if (!initialTemas) {
        setSelectedTemas([]);
      }
    }
  }, [selectedSecciones]);

  const loadProcesos = async () => {
    try {
      setLoading(true);
      const data = await testService.getProcesos();
      setProcesos(data);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los procesos',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSeccionesYTemas = async () => {
    if (!selectedProceso) return;
    
    try {
      setLoading(true);
      const data = await testService.getSeccionesYTemas(selectedProceso);
      if (data.success) {
        setSecciones(data.secciones || []);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las secciones',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTemasPorSecciones = async () => {
    if (!selectedProceso || selectedSecciones.length === 0) return;

    try {
      setLoading(true);
      const allTemas = await Promise.all(
        selectedSecciones.map(seccion =>
          testService.getTemasPorSeccion(selectedProceso, seccion)
        )
      );
      
      const uniqueTemas = [...new Set(allTemas.flat())].filter(tema => {
        const isPsicoTema = /^(pisco|psico)\s*-\s*/i.test(tema);
        // Si es modo psicotécnico, solo mostrar temas con prefijo PSICO
        // Si es modo normal, excluir temas con prefijo PSICO
        return isPsicotecnico ? isPsicoTema : !isPsicoTema;
      });
      
      setTemas(uniqueTemas);
      setSelectedTemas([]);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los temas',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSeccion = (seccion: string) => {
    setSelectedSecciones(prev =>
      prev.includes(seccion)
        ? prev.filter(s => s !== seccion)
        : [...prev, seccion]
    );
  };

  const toggleTema = (tema: string) => {
    setSelectedTemas(prev =>
      prev.includes(tema)
        ? prev.filter(t => t !== tema)
        : [...prev, tema]
    );
  };

  const handleStartTest = async () => {
    if (!selectedProceso) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Selecciona un proceso',
      });
      return;
    }

    if (selectedSecciones.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Selecciona al menos una sección',
      });
      return;
    }

    if (selectedTemas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Selecciona al menos un tema',
      });
      return;
    }

    const numPreguntasInt = parseInt(numPreguntas);
    const minutosInt = parseInt(minutos);

    if (isNaN(numPreguntasInt) || numPreguntasInt <= 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Número de preguntas inválido',
      });
      return;
    }

    if (isNaN(minutosInt) || minutosInt <= 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Minutos inválidos',
      });
      return;
    }

    // Verificar si hay progreso guardado
    if (user) {
      const keySecciones = selectedSecciones.slice().sort().join(',');
      const keyTemas = selectedTemas.slice().sort().join(',');
      const test_key = `${selectedProceso}_${keySecciones}_${keyTemas}_${numPreguntasInt}`;

      try {
        const progreso = await testService.recuperarProgreso(user.id, test_key);
        
        if (progreso.ok && progreso.data) {
          const continuar = window.confirm(
            'Tienes un test sin finalizar con estos parámetros. ¿Quieres continuar donde lo dejaste?\n\nAceptar: Continuar\nCancelar: Empezar de cero'
          );

          if (!continuar) {
            await testService.eliminarProgreso(user.id, test_key);
          }
        }
      } catch (error) {
        console.error('Error verificando progreso:', error);
      }
    }

    onStartQuiz({
      proceso_id: selectedProceso,
      secciones: selectedSecciones,
      temas: selectedTemas,
      numPreguntas: numPreguntasInt,
      minutos: minutosInt,
      tipo: tipoTest,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">
            {isPsicotecnico ? 'Configurar Test Psicotécnico' : 'Configurar Test'}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-primary" />
              {isPsicotecnico ? 'Configura tu test psicotécnico' : 'Configura tu test personalizado'}
            </CardTitle>
            <CardDescription>
              {isPsicotecnico 
                ? 'Selecciona el proceso, secciones y temas psicotécnicos para empezar a practicar'
                : 'Selecciona el proceso, secciones y temas para empezar a practicar'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seleccionar Proceso */}
            <div className="space-y-2">
              <Label htmlFor="proceso">Proceso / Manual</Label>
              <Select
                value={selectedProceso?.toString()}
                onValueChange={(value) => setSelectedProceso(parseInt(value))}
                disabled={loading}
              >
                <SelectTrigger id="proceso">
                  <SelectValue placeholder="Selecciona un proceso" />
                </SelectTrigger>
                <SelectContent>
                  {procesos.map((proceso) => (
                    <SelectItem key={proceso.id} value={proceso.id.toString()}>
                      {proceso.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProceso && (
              <>
                <Separator />
                
                {/* Secciones */}
                <div className="space-y-3">
                  <Label>Secciones (selecciona varias)</Label>
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {secciones.map((seccion) => (
                        <Badge
                          key={seccion}
                          variant={selectedSecciones.includes(seccion) ? 'default' : 'outline'}
                          className="cursor-pointer hover:opacity-80 px-3 py-2"
                          onClick={() => toggleSeccion(seccion)}
                        >
                          {seccion}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedSecciones.length > 0 && (
              <>
                <Separator />
                
                {/* Temas */}
                <div className="space-y-3">
                  <Label>Temas (de esas secciones)</Label>
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                      {temas.map((tema) => (
                        <Badge
                          key={tema}
                          variant={selectedTemas.includes(tema) ? 'default' : 'outline'}
                          className="cursor-pointer hover:opacity-80 px-3 py-2"
                          onClick={() => toggleTema(tema)}
                        >
                          {tema}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Configuración */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numPreguntas">Número de preguntas</Label>
                    <Input
                      id="numPreguntas"
                      type="number"
                      min="1"
                      value={numPreguntas}
                      onChange={(e) => setNumPreguntas(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutos">Minutos</Label>
                    <Input
                      id="minutos"
                      type="number"
                      min="1"
                      value={minutos}
                      onChange={(e) => setMinutos(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleStartTest}
                  className="w-full"
                  size="lg"
                  disabled={loading || selectedTemas.length === 0}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Comenzar Test
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Consejos */}
        <div className="mt-8 bg-white rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary" />
            Consejos para el Test
          </h2>
          <div className="space-y-2 text-gray-600">
            <p>• Selecciona múltiples secciones y temas para una práctica más completa</p>
            {tipoTest === 'simulacion' ? (
              <>
                <p>• <strong>Modo Simulación:</strong> Ver respuestas y explicaciones inmediatamente</p>
                <p>• El cronómetro se pausa al mostrar las explicaciones</p>
              </>
            ) : (
              <>
                <p>• <strong>Modo Examen:</strong> Simula condiciones reales con tiempo cronometrado</p>
                <p>• El cronómetro NO se detiene, finaliza automáticamente al acabar el tiempo</p>
              </>
            )}
            <p>• Tu progreso se guarda automáticamente para continuar más tarde</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigTest;
