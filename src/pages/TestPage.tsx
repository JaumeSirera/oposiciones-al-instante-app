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
  const [currentView, setCurrentView] = useState<'config' | 'quiz'>('config');
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
  const [autoStarting, setAutoStarting] = useState(false);
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

  // Auto-iniciar test si vienen parámetros completos
  useEffect(() => {
    const autoStartTest = async () => {
      if (initialParams.proceso && initialParams.temas && !autoStarting && currentView === 'config') {
        setAutoStarting(true);
        
        try {
          const procesoId = parseInt(initialParams.proceso);
          const temasArray = initialParams.temas.split(',').map(t => decodeURIComponent(t.trim()));
          
          // Obtener las secciones relacionadas con estos temas
          const seccionesData = await testService.getSeccionesYTemas(procesoId);
          let seccionesParaTemas: string[] = [];
          
          if (seccionesData.success && seccionesData.secciones) {
            // Obtener temas de cada sección para encontrar cuáles contienen nuestros temas
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

          // Si no encontramos secciones específicas, usar todas las secciones disponibles
          if (seccionesParaTemas.length === 0 && seccionesData.secciones) {
            seccionesParaTemas = seccionesData.secciones;
          }

          const config: TestConfig = {
            proceso_id: procesoId,
            secciones: seccionesParaTemas,
            temas: temasArray,
            numPreguntas: 50,
            minutos: 30,
            tipo: mode,
          };

          setTestConfig(config);
          setCurrentView('quiz');
          
          toast({
            title: "Test iniciado",
            description: `Comenzando test con ${temasArray.length} tema(s)`,
          });
        } catch (error) {
          console.error('Error al auto-iniciar test:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo iniciar el test automáticamente",
          });
          setAutoStarting(false);
        }
      }
    };

    autoStartTest();
  }, [initialParams.proceso, initialParams.temas, mode, currentView, autoStarting]);

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

  // Si está auto-iniciando, mostrar loading
  if (autoStarting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Iniciando test...</p>
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
