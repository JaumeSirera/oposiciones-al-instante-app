import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ConfigTest, { type TestConfig } from '@/components/ConfigTest';
import QuizInterface from '@/components/QuizInterface';
import { useToast } from '@/hooks/use-toast';

interface TestPageProps {
  mode: 'simulacion' | 'examen';
  isPsicotecnico?: boolean;
}

const TestPage = ({ mode, isPsicotecnico = false }: TestPageProps) => {
  const [currentView, setCurrentView] = useState<'config' | 'quiz'>('config');
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Extraer parámetros de URL
  const initialParams = {
    proceso: searchParams.get('proceso'),
    temas: searchParams.get('temas'),
    secciones: searchParams.get('secciones'),
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
