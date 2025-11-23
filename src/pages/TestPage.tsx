import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfigTest, { type TestConfig } from '@/components/ConfigTest';
import QuizInterface from '@/components/QuizInterface';
import { useToast } from '@/hooks/use-toast';
import { testService } from '@/services/testService';
import { useAuth } from '@/contexts/AuthContext';

interface TestPageProps {
  mode: 'simulacion' | 'examen';
  isPsicotecnico?: boolean;
}

const TestPage = ({ mode, isPsicotecnico = false }: TestPageProps) => {
  const [currentView, setCurrentView] = useState<'config' | 'quiz' | 'mode-selection'>('config');
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
  const [selectedMode, setSelectedMode] = useState<'simulacion' | 'examen'>(mode);
  const [loadingMode, setLoadingMode] = useState<'simulacion' | 'examen' | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Extraer parámetros de URL
  const initialParams = {
    proceso: searchParams.get('proceso'),
    temas: searchParams.get('temas'),
    secciones: searchParams.get('secciones'),
  };

  // Mostrar selección de modo si vienen parámetros completos
  useEffect(() => {
    if (initialParams.proceso && initialParams.temas && currentView === 'config') {
      setCurrentView('mode-selection');
    }
  }, [initialParams.proceso, initialParams.temas]);

  // Función para iniciar test con modo seleccionado
  const iniciarTestConModo = async (modoSeleccionado: 'simulacion' | 'examen') => {
    setLoadingMode(modoSeleccionado);
    try {
      const procesoId = parseInt(initialParams.proceso!);
      const temasArray = initialParams.temas!.split(',').map(t => decodeURIComponent(t.trim()));
      
      // Obtener las secciones relacionadas con estos temas
      const seccionesData = await testService.getSeccionesYTemas(procesoId);
      let seccionesParaTemas: string[] = [];
      
      if (seccionesData.success && seccionesData.secciones) {
        for (const seccion of seccionesData.secciones) {
          const temasSeccion = await testService.getTemasPorSeccion(procesoId, seccion);
          const tieneTemas = temasArray.some(tema => 
            temasSeccion.some(ts => ts.toLowerCase().includes(tema.toLowerCase()) || tema.toLowerCase().includes(ts.toLowerCase()))
          );
          if (tieneTemas) {
            seccionesParaTemas.push(seccion);
          }
        }
      }

      if (seccionesParaTemas.length === 0 && seccionesData.secciones) {
        seccionesParaTemas = seccionesData.secciones;
      }

      const config: TestConfig = {
        proceso_id: procesoId,
        secciones: seccionesParaTemas,
        temas: temasArray,
        numPreguntas: 50,
        minutos: 30,
        tipo: modoSeleccionado,
      };

      setTestConfig(config);
      setCurrentView('quiz');
      
      toast({
        title: "Test iniciado",
        description: `Comenzando ${modoSeleccionado === 'examen' ? 'examen' : 'test'} con ${temasArray.length} tema(s)`,
      });
    } catch (error) {
      console.error('Error al iniciar test:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo iniciar el test",
      });
      setLoadingMode(null);
    }
  };

  const handleStartQuiz = (config: TestConfig) => {
    setTestConfig(config);
    setCurrentView('quiz');
    toast({
      title: "¡Test iniciado!",
      description: `Comenzando test con ${config.numPreguntas} preguntas`,
    });
  };

  const handleQuizComplete = (results: any) => {
    navigate('/');
    toast({
      title: "¡Quiz completado!",
      description: `Has respondido ${results.correctAnswers}/${results.totalQuestions} preguntas correctamente`,
    });
  };

  if (currentView === 'quiz' && testConfig) {
    return (
      <QuizInterface 
        config={testConfig} 
        onComplete={handleQuizComplete} 
        onExit={() => navigate('/')} 
      />
    );
  }

  // Mostrar selección de modo
  if (currentView === 'mode-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Elige el modo de práctica</h1>
            <p className="text-muted-foreground">Selecciona cómo quieres realizar este test</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => iniciarTestConModo('simulacion')}
              disabled={loadingMode !== null}
              className="group relative overflow-hidden rounded-xl border-2 border-primary/20 bg-card p-8 text-left transition-all hover:border-primary hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMode === 'simulacion' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Cargando...</p>
                  </div>
                </div>
              )}
              <div className="relative z-10">
                <div className="mb-4 inline-block rounded-lg bg-primary/10 p-3">
                  <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Test de Práctica</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Modo relajado para estudiar y aprender. Puedes ver las respuestas correctas después de cada pregunta.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    <span>Sin límite de tiempo estricto</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    <span>Feedback inmediato</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    <span>Ideal para aprender</span>
                  </li>
                </ul>
              </div>
            </button>

            <button
              onClick={() => iniciarTestConModo('examen')}
              disabled={loadingMode !== null}
              className="group relative overflow-hidden rounded-xl border-2 border-primary/20 bg-card p-8 text-left transition-all hover:border-primary hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMode === 'examen' && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Cargando...</p>
                  </div>
                </div>
              )}
              <div className="relative z-10">
                <div className="mb-4 inline-block rounded-lg bg-primary/10 p-3">
                  <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">Modo Examen</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Simula condiciones reales de examen. Cronómetro activo y sin ver respuestas hasta el final.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    <span>Cronómetro activo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    <span>Resultados al final</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    <span>Condiciones reales</span>
                  </li>
                </ul>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConfigTest 
      onStartQuiz={handleStartQuiz} 
      onBack={() => navigate('/')} 
      initialType={mode}
      isPsicotecnico={isPsicotecnico}
      initialProceso={initialParams.proceso}
      initialTemas={initialParams.temas}
      initialSecciones={initialParams.secciones}
    />
  );
};

export default TestPage;
