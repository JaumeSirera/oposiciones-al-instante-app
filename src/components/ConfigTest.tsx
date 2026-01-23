import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { ArrowLeft, BookOpen, Clock, Play, Loader2, Languages } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { testService, type Proceso } from '@/services/testService';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslateContent } from '@/hooks/useTranslateContent';

interface ConfigTestProps {
  onStartQuiz: (config: TestConfig) => void;
  onBack: () => void;
  initialType?: 'simulacion' | 'examen';
  isPsicotecnico?: boolean;
  initialProceso?: string | null;
  initialTemas?: string | null;
  initialSecciones?: string | null;
  autoStart?: boolean;
}

export interface TestConfig {
  proceso_id: number;
  secciones: string[];
  temas: string[];
  numPreguntas: number;
  minutos: number;
  tipo: 'simulacion' | 'examen';
  dificultad?: string;
  tipoPsico?: string;
  habilidad?: string;
}

const ConfigTest: React.FC<ConfigTestProps> = ({ 
  onStartQuiz, 
  onBack, 
  initialType = 'simulacion', 
  isPsicotecnico = false,
  initialProceso,
  initialTemas,
  initialSecciones,
  autoStart = false
}) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { translateTexts, isTranslating } = useTranslateContent();
  
  // Estados para traducciones
  const [translatedProcesos, setTranslatedProcesos] = useState<Record<number, string>>({});
  const [translatedSecciones, setTranslatedSecciones] = useState<Record<string, string>>({});
  const [translatedTemas, setTranslatedTemas] = useState<Record<string, string>>({});
  
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
  const [dificultad, setDificultad] = useState<string>('todas');
  const [tipoPsico, setTipoPsico] = useState<string>('todos');
  const [habilidad, setHabilidad] = useState<string>('todas');

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

  // Auto-iniciar el test si todos los parámetros están configurados
  useEffect(() => {
    if (autoStart && 
        selectedProceso && 
        selectedSecciones.length > 0 && 
        selectedTemas.length > 0 &&
        !loading) {
      // Pequeño delay para asegurar que todo está cargado
      const timer = setTimeout(() => {
        handleStartTest();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, selectedProceso, selectedSecciones, selectedTemas, loading]);

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
      const data = await testService.getProcesos(user?.id);
      setProcesos(data);
      
      // Traducir procesos si no es español
      if (i18n.language !== 'es' && data.length > 0) {
        const textos = data.map(p => p.descripcion);
        const traducciones = await translateTexts(textos);
        const mapeo: Record<number, string> = {};
        data.forEach((p, idx) => {
          mapeo[p.id] = traducciones[idx] || p.descripcion;
        });
        setTranslatedProcesos(mapeo);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('configTest.error'),
        description: t('configTest.couldNotLoadProcesses'),
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
        
        // Traducir secciones si no es español
        if (i18n.language !== 'es' && data.secciones && data.secciones.length > 0) {
          const traducciones = await translateTexts(data.secciones);
          const mapeo: Record<string, string> = {};
          data.secciones.forEach((s: string, idx: number) => {
            mapeo[s] = traducciones[idx] || s;
          });
          setTranslatedSecciones(mapeo);
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('configTest.error'),
        description: t('configTest.couldNotLoadSections'),
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
        return isPsicotecnico ? isPsicoTema : !isPsicoTema;
      });
      
      setTemas(uniqueTemas);
      setSelectedTemas([]);
      
      // Traducir temas si no es español
      if (i18n.language !== 'es' && uniqueTemas.length > 0) {
        const traducciones = await translateTexts(uniqueTemas);
        const mapeo: Record<string, string> = {};
        uniqueTemas.forEach((t, idx) => {
          mapeo[t] = traducciones[idx] || t;
        });
        setTranslatedTemas(mapeo);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('configTest.error'),
        description: t('configTest.couldNotLoadTopics'),
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
        title: t('configTest.error'),
        description: t('configTest.selectProcess'),
      });
      return;
    }

    if (selectedSecciones.length === 0) {
      toast({
        variant: 'destructive',
        title: t('configTest.error'),
        description: t('configTest.selectSection'),
      });
      return;
    }

    if (selectedTemas.length === 0) {
      toast({
        variant: 'destructive',
        title: t('configTest.error'),
        description: t('configTest.selectTopic'),
      });
      return;
    }

    const numPreguntasInt = parseInt(numPreguntas);
    const minutosInt = parseInt(minutos);

    if (isNaN(numPreguntasInt) || numPreguntasInt <= 0) {
      toast({
        variant: 'destructive',
        title: t('configTest.error'),
        description: t('configTest.invalidQuestions'),
      });
      return;
    }

    if (isNaN(minutosInt) || minutosInt <= 0) {
      toast({
        variant: 'destructive',
        title: t('configTest.error'),
        description: t('configTest.invalidMinutes'),
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
          const continuar = window.confirm(t('configTest.continueProgress'));

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
      dificultad: dificultad !== 'todas' ? dificultad : undefined,
      tipoPsico: isPsicotecnico && tipoPsico !== 'todos' ? tipoPsico : undefined,
      habilidad: isPsicotecnico && habilidad !== 'todas' ? habilidad : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('configTest.back')}
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            {isPsicotecnico ? t('configTest.titlePsycho') : t('configTest.title')}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="w-6 h-6 mr-2 text-primary" />
              {isPsicotecnico ? t('configTest.configurePsycho') : t('configTest.configureCustom')}
            </CardTitle>
            <CardDescription>
              {isPsicotecnico 
                ? t('configTest.selectProcessPsycho')
                : t('configTest.selectProcess')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seleccionar Proceso */}
            <div className="space-y-2">
              <Label htmlFor="proceso">{t('configTest.processManual')}</Label>
              <Select
                value={selectedProceso?.toString()}
                onValueChange={(value) => setSelectedProceso(parseInt(value))}
                disabled={loading}
              >
                <SelectTrigger id="proceso">
                  <SelectValue placeholder={t('configTest.selectProcessPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {procesos.map((proceso) => (
                    <SelectItem key={proceso.id} value={proceso.id.toString()}>
                      {i18n.language !== 'es' && translatedProcesos[proceso.id] 
                        ? translatedProcesos[proceso.id] 
                        : proceso.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isTranslating && i18n.language !== 'es' && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Languages className="w-3 h-3 animate-pulse" />
                  {t('quiz.translating')}
                </div>
              )}
            </div>

            {selectedProceso && (
              <>
                <Separator />
                
                {/* Secciones */}
                <div className="space-y-3">
                  <Label>{t('configTest.sections')}</Label>
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
                          {i18n.language !== 'es' && translatedSecciones[seccion] 
                            ? translatedSecciones[seccion] 
                            : seccion}
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
                  <Label>{t('configTest.topics')}</Label>
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
                          {i18n.language !== 'es' && translatedTemas[tema] 
                            ? translatedTemas[tema] 
                            : tema}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Configuración */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numPreguntas">{t('configTest.numQuestions')}</Label>
                    <Input
                      id="numPreguntas"
                      type="number"
                      min="1"
                      value={numPreguntas}
                      onChange={(e) => setNumPreguntas(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutos">{t('configTest.minutes')}</Label>
                    <Input
                      id="minutos"
                      type="number"
                      min="1"
                      value={minutos}
                      onChange={(e) => setMinutos(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                {/* Filtros de dificultad */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dificultad">{t('configTest.difficulty')}</Label>
                    <Select value={dificultad} onValueChange={setDificultad}>
                      <SelectTrigger id="dificultad">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">{t('configTest.allDifficulties')}</SelectItem>
                        <SelectItem value="facil">{t('configTest.easy')}</SelectItem>
                        <SelectItem value="media">{t('configTest.medium')}</SelectItem>
                        <SelectItem value="dificil">{t('configTest.hard')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isPsicotecnico && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="tipoPsico">{t('configTest.questionType')}</Label>
                        <Select value={tipoPsico} onValueChange={setTipoPsico}>
                          <SelectTrigger id="tipoPsico">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">{t('configTest.allTypes')}</SelectItem>
                            <SelectItem value="numerica">{t('configTest.numeric')}</SelectItem>
                            <SelectItem value="verbal">{t('configTest.verbal')}</SelectItem>
                            <SelectItem value="abstracta">{t('configTest.abstract')}</SelectItem>
                            <SelectItem value="espacial">{t('configTest.spatial')}</SelectItem>
                            <SelectItem value="mecanica">{t('configTest.mechanical')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="habilidad">{t('configTest.ability')}</Label>
                        <Select value={habilidad} onValueChange={setHabilidad}>
                          <SelectTrigger id="habilidad">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todas">{t('configTest.allAbilities')}</SelectItem>
                            <SelectItem value="razonamiento">{t('configTest.reasoning')}</SelectItem>
                            <SelectItem value="memoria">{t('configTest.memory')}</SelectItem>
                            <SelectItem value="atencion">{t('configTest.attention')}</SelectItem>
                            <SelectItem value="percepcion">{t('configTest.perception')}</SelectItem>
                            <SelectItem value="calculo">{t('configTest.calculation')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                <Button
                  onClick={handleStartTest}
                  className="w-full"
                  size="lg"
                  disabled={loading || selectedTemas.length === 0}
                >
                  <Play className="w-5 h-5 mr-2" />
                  {t('configTest.startTest')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Consejos */}
        <div className="mt-8 bg-white rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary" />
            {t('configTest.tips')}
          </h2>
          <div className="space-y-2 text-gray-600">
            <p>• {t('configTest.tipMultipleSections')}</p>
            {tipoTest === 'simulacion' ? (
              <>
                <p>• <strong>{t('configTest.simulationMode')}</strong> {t('configTest.simulationDesc')}</p>
                <p>• {t('configTest.simulationTimer')}</p>
              </>
            ) : (
              <>
                <p>• <strong>{t('configTest.examMode')}</strong> {t('configTest.examDesc')}</p>
                <p>• {t('configTest.examTimer')}</p>
              </>
            )}
            <p>• {t('configTest.progressSaved')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigTest;
