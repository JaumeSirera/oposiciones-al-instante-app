import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Clock, CheckCircle, XCircle, RotateCcw, Loader2, MessageSquare, Send, Pencil, Trash2, GraduationCap, FileText, BookOpen, Languages, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { testService, type Pregunta, type Respuesta } from '@/services/testService';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslateContent } from '@/hooks/useTranslateContent';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import type { TestConfig } from './ConfigTest';

interface QuizInterfaceProps {
  config: TestConfig;
  onComplete: (results: any) => void;
  onExit: () => void;
}

interface TranslatedQuestion {
  pregunta: string;
  respuestas: string[];
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ config, onComplete, onExit }) => {
  const { t, i18n } = useTranslation();
  const [questions, setQuestions] = useState<Pregunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.minutos * 60);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [quizStartTime] = useState(Date.now());
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [textoEditado, setTextoEditado] = useState('');
  const [explicacionProfesor, setExplicacionProfesor] = useState<string>('');
  const [cargandoProfesor, setCargandoProfesor] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id;
  const isAdmin = user?.nivel === 'admin';

  // Traducción de contenido
  const { translateQuestion, translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  const [translatedQuestions, setTranslatedQuestions] = useState<Record<number, TranslatedQuestion>>({});
  const [translatedExplicacion, setTranslatedExplicacion] = useState<string>('');

  // Text-to-Speech
  const { speak, stop, isPlaying, isEnabled, toggleEnabled, isSupported } = useTextToSpeech();

  const currentQuestion = questions[currentQuestionIndex];
  const currentTranslation = translatedQuestions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  // Leer pregunta automáticamente cuando cambia y el audio está habilitado
  useEffect(() => {
    if (isEnabled && currentQuestion && !loading) {
      const textToRead = needsTranslation && currentTranslation 
        ? currentTranslation.pregunta 
        : currentQuestion.pregunta;
      speak(textToRead);
    }
    return () => stop();
  }, [currentQuestionIndex, currentQuestion, isEnabled, currentTranslation, needsTranslation]);

  // Traducir pregunta actual cuando cambia
  useEffect(() => {
    if (currentQuestion && needsTranslation && !translatedQuestions[currentQuestionIndex]) {
      translateCurrentQuestion();
    }
  }, [currentQuestionIndex, currentQuestion, needsTranslation, i18n.language]);

  const translateCurrentQuestion = async () => {
    if (!currentQuestion) return;
    
    const translated = await translateQuestion({
      pregunta: currentQuestion.pregunta,
      respuestas: currentQuestion.respuestas.map(r => r.respuesta)
    });
    
    setTranslatedQuestions(prev => ({
      ...prev,
      [currentQuestionIndex]: translated
    }));
  };

  // Obtener texto de pregunta (traducido o original)
  const getQuestionText = () => {
    if (needsTranslation && currentTranslation) {
      return currentTranslation.pregunta;
    }
    return currentQuestion?.pregunta || '';
  };

  // Obtener texto de respuesta (traducido o original)
  const getAnswerText = (index: number) => {
    if (needsTranslation && currentTranslation && currentTranslation.respuestas[index]) {
      return currentTranslation.respuestas[index];
    }
    return currentQuestion?.respuestas[index]?.respuesta || '';
  };

  // Cargar preguntas al inicio
  useEffect(() => {
    loadQuestions();
  }, []);

  // Limpiar traducciones cuando cambia el idioma
  useEffect(() => {
    setTranslatedQuestions({});
    setTranslatedExplicacion('');
  }, [i18n.language]);

  // Cargar comentarios cuando cambia la pregunta
  useEffect(() => {
    if (questions.length > 0 && currentQuestion) {
      loadComentarios();
    }
  }, [currentQuestionIndex, questions]);

  // Timer
  useEffect(() => {
    if (isTimerActive && timeLeft > 0 && questions.length > 0) {
      // En modo examen, el timer corre siempre (incluso con explicaciones)
      // En modo simulación, se pausa al mostrar explicaciones
      if (config.tipo === 'examen' || !showExplanation) {
        const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        return () => clearTimeout(timer);
      }
    } else if (timeLeft === 0 && questions.length > 0) {
      // Cuando se acaba el tiempo en modo examen, finalizar automáticamente
      if (config.tipo === 'examen') {
        handleFinishExam();
      } else {
        handleAnswer(null);
      }
    }
  }, [timeLeft, isTimerActive, showExplanation, questions, config.tipo]);

  // Auto-save progress cada 30 segundos
  useEffect(() => {
    if (user && questions.length > 0) {
      const interval = setInterval(() => {
        saveProgress();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [currentQuestionIndex, userAnswers, timeLeft, user, questions]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const preguntas = await testService.getPreguntas({
        id_proceso: config.proceso_id,
        secciones: config.secciones,
        temas: config.temas,
        numPreguntas: config.numPreguntas,
        dificultad: config.dificultad,
        tipo: config.tipoPsico,
        habilidad: config.habilidad,
      });

      if (preguntas.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: t('quiz.noQuestionsFound'),
        });
        onExit();
        return;
      }

      setQuestions(preguntas);
      
      // Intentar recuperar progreso guardado
      if (user) {
        await tryRecoverProgress(preguntas);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: t('quiz.couldNotLoadQuestions'),
      });
      onExit();
    } finally {
      setLoading(false);
    }
  };

  const tryRecoverProgress = async (preguntas: Pregunta[]) => {
    if (!user) return;

    const keySecciones = config.secciones.slice().sort().join(',');
    const keyTemas = config.temas.slice().sort().join(',');
    const test_key = `${config.proceso_id}_${keySecciones}_${keyTemas}_${config.numPreguntas}`;

    try {
      const progreso = await testService.recuperarProgreso(user.id, test_key);
      
      if (progreso.ok && progreso.data) {
        setCurrentQuestionIndex(progreso.data.actual);
        setTimeLeft(progreso.data.tiempo_restante);
        
        const respuestas = JSON.parse(progreso.data.respuestas || '{}');
        setUserAnswers(respuestas);
        
        // Calcular score actual
        let currentScore = 0;
        Object.entries(respuestas).forEach(([index, respuesta]) => {
          const pregunta = preguntas[parseInt(index)];
          if (pregunta && respuesta === pregunta.correcta_indice) {
            currentScore++;
          }
        });
        setScore(currentScore);
      }
    } catch (error) {
      console.error('Error al recuperar progreso:', error);
    }
  };

  const saveProgress = async () => {
    if (!user || questions.length === 0) return;

    const keySecciones = config.secciones.slice().sort().join(',');
    const keyTemas = config.temas.slice().sort().join(',');
    const test_key = `${config.proceso_id}_${keySecciones}_${keyTemas}_${config.numPreguntas}`;

    try {
      await testService.guardarProgreso({
        user_id: user.id,
        test_key,
        actual: currentQuestionIndex,
        respuestas: Object.values(userAnswers),
        tiempo_restante: timeLeft,
        preguntas: questions.map(q => q.id),
      });
    } catch (error) {
      console.error('Error al guardar progreso:', error);
    }
  };

  const handleAnswer = (answer: string | null) => {
    setSelectedAnswer(answer);
    setShowExplanation(true);
    setIsTimerActive(false);
    
    if (answer === currentQuestion.correcta_indice) {
      setScore(score + 1);
    }

    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer || '',
    }));
  };

  const handleNextQuestion = async () => {
    await saveProgress();
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setIsTimerActive(true);
    } else {
      handleQuizComplete();
    }
  };

  const handleFinishExam = async () => {
    setIsTimerActive(false);
    
    toast({
      title: t('quiz.timeUp'),
      description: t('quiz.examFinishedAuto'),
      variant: 'destructive',
    });

    // Contar respuestas correctas de todas las preguntas respondidas
    let finalScore = score;
    const allAnswers = { ...userAnswers };
    
    // Si hay una pregunta actual sin responder, marcarla como no respondida
    if (!selectedAnswer && currentQuestion) {
      allAnswers[currentQuestionIndex] = '';
    }

    // Calcular preguntas acertadas y falladas con detalles
    const acertadas: any[] = [];
    const falladas: any[] = [];
    
    questions.forEach((pregunta, index) => {
      const respuestaUsuario = allAnswers[index];
      const esCorrecta = respuestaUsuario === pregunta.correcta_indice;
      
      const detallePregunta = {
        id: pregunta.id,
        pregunta: pregunta.pregunta,
        respuesta_usuario: respuestaUsuario || 'Sin responder',
        correcta_indice: pregunta.correcta_indice,
      };
      
      if (esCorrecta) {
        acertadas.push(detallePregunta);
      } else {
        falladas.push(detallePregunta);
      }
    });
    
    const aciertos = acertadas.length;
    const fallos = falladas.length;
    const nota = ((aciertos / questions.length) * 10).toFixed(2);

    const totalTime = Math.round((Date.now() - quizStartTime) / 1000);
    const results = {
      totalQuestions: questions.length,
      correctAnswers: finalScore,
      totalTime,
      percentage: Math.round((finalScore / questions.length) * 100),
      perfectScore: finalScore === questions.length,
      timeOut: true,
    };

    // Guardar test realizado en la base de datos
    if (user) {
      try {
        await testService.guardarTestRealizado({
          user_id: user.id,
          id_proceso: config.proceso_id,
          tipo_test: config.tipo,
          secciones: config.secciones.join(','),
          temas: config.temas.join(','),
          num_preguntas: questions.length,
          tiempo: config.minutos * 60,
          tiempo_restante: 0,
          aciertos,
          fallos,
          respuestas: userAnswers,
          preguntas_acertadas: acertadas,
          preguntas_falladas: falladas,
          nota,
        });
      } catch (error) {
        console.error('Error al guardar test realizado:', error);
      }

      // Eliminar progreso guardado
      const keySecciones = config.secciones.slice().sort().join(',');
      const keyTemas = config.temas.slice().sort().join(',');
      const test_key = `${config.proceso_id}_${keySecciones}_${keyTemas}_${config.numPreguntas}`;
      await testService.eliminarProgreso(user.id, test_key);
    }

    onComplete(results);
  };

  const handleQuizComplete = async () => {
    const totalTime = Math.round((Date.now() - quizStartTime) / 1000);
    const tiempoUsado = (config.minutos * 60) - timeLeft;
    
    // Calcular preguntas acertadas y falladas con detalles
    const acertadas: any[] = [];
    const falladas: any[] = [];
    
    questions.forEach((pregunta, index) => {
      const respuestaUsuario = userAnswers[index];
      const esCorrecta = respuestaUsuario === pregunta.correcta_indice;
      
      const detallePregunta = {
        id: pregunta.id,
        pregunta: pregunta.pregunta,
        respuesta_usuario: respuestaUsuario || 'Sin responder',
        correcta_indice: pregunta.correcta_indice,
      };
      
      if (esCorrecta) {
        acertadas.push(detallePregunta);
      } else {
        falladas.push(detallePregunta);
      }
    });
    
    const aciertos = acertadas.length;
    const fallos = falladas.length;
    const nota = ((aciertos / questions.length) * 10).toFixed(2);
    
    const results = {
      totalQuestions: questions.length,
      correctAnswers: score,
      totalTime,
      percentage: Math.round((score / questions.length) * 100),
      perfectScore: score === questions.length
    };

    // Guardar test realizado en la base de datos
    if (user) {
      try {
        await testService.guardarTestRealizado({
          user_id: user.id,
          id_proceso: config.proceso_id,
          tipo_test: config.tipo,
          secciones: config.secciones.join(','),
          temas: config.temas.join(','),
          num_preguntas: questions.length,
          tiempo: config.minutos * 60,
          tiempo_restante: timeLeft,
          aciertos,
          fallos,
          respuestas: userAnswers,
          preguntas_acertadas: acertadas,
          preguntas_falladas: falladas,
          nota,
        });
      } catch (error) {
        console.error('Error al guardar test realizado:', error);
      }

      // Eliminar progreso guardado
      const keySecciones = config.secciones.slice().sort().join(',');
      const keyTemas = config.temas.slice().sort().join(',');
      const test_key = `${config.proceso_id}_${keySecciones}_${keyTemas}_${config.numPreguntas}`;
      await testService.eliminarProgreso(user.id, test_key);
    }

    onComplete(results);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadComentarios = async () => {
    if (!currentQuestion?.id) return;
    const data = await testService.getComentarios(currentQuestion.id);
    setComentarios(data);
  };

  const handleAddComentario = async () => {
    if (!nuevoComentario.trim() || !userId || !currentQuestion) return;
    const result = await testService.addComentario({
      id_proceso: config.proceso_id,
      id_usuario: userId,
      id_pregunta: currentQuestion.id,
      tipo: 'pregunta',
      comentario: nuevoComentario.trim(),
    });
    if (result.success) {
      setNuevoComentario('');
      loadComentarios();
      toast({ title: t('quiz.commentAdded') });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleEditComentario = async (id: number) => {
    if (!textoEditado.trim()) return;
    const result = await testService.updateComentario(id, textoEditado.trim(), user?.nivel || '');
    if (result.success) {
      setEditandoId(null);
      setTextoEditado('');
      loadComentarios();
      toast({ title: t('quiz.commentUpdated') });
    } else {
      toast({ title: t('quiz.errorUpdating'), variant: 'destructive' });
    }
  };

  const handleDeleteComentario = async (id: number) => {
    if (!confirm(t('quiz.deleteComment'))) return;
    const result = await testService.deleteComentario(id, user?.nivel || '');
    if (result.success) {
      loadComentarios();
      toast({ title: t('quiz.commentDeleted') });
    } else {
      toast({ title: t('quiz.errorDeleting'), variant: 'destructive' });
    }
  };

  const handlePedirExplicacion = async () => {
    if (!currentQuestion || !selectedAnswer) return;
    
    setCargandoProfesor(true);
    setExplicacionProfesor('');
    
    try {
      const result = await testService.getProfesorExplicacion({
        pregunta: currentQuestion.pregunta,
        respuestas: currentQuestion.respuestas,
        correcta: currentQuestion.correcta_indice,
        elegida: selectedAnswer,
        idioma: needsTranslation ? i18n.language : undefined,
      });

      if (result.success && result.explicacion) {
        setExplicacionProfesor(result.explicacion);
        // Ya no necesitamos traducir aquí, el profesor genera en el idioma correcto
        setTranslatedExplicacion('');
      } else {
        toast({ 
          title: 'Error', 
          description: result.error || t('quiz.errorGettingExplanation'),
          variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: t('quiz.errorConnectingProfessor'),
        variant: 'destructive' 
      });
    } finally {
      setCargandoProfesor(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-gray-600">{t('quiz.loadingQuestions')}</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={onExit}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('quiz.exitTest')}
          </Button>
          <div className="flex items-center space-x-4">
            {config.tipo === 'examen' && (
              <Badge variant="destructive" className="text-sm font-semibold">
                {t('quiz.examMode')}
              </Badge>
            )}
            {isSupported && (
              <Button
                variant={isEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleEnabled}
                className="flex items-center gap-1"
                title={isEnabled ? t('quiz.disableAudio') : t('quiz.enableAudio')}
              >
                {isEnabled ? (
                  <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </Button>
            )}
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className={`text-lg font-bold ${timeLeft <= 60 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {currentQuestionIndex + 1} / {questions.length}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <div className="text-center mt-2 text-sm text-gray-600">
            {t('quiz.progress')}: {Math.round(progress)}%
          </div>
        </div>

        {/* Question Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-xl leading-relaxed flex-1">
                {isTranslating && needsTranslation && !currentTranslation ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <Languages className="w-5 h-5" />
                    {t('common.loading')}
                  </span>
                ) : (
                  getQuestionText()
                )}
              </CardTitle>
              {needsTranslation && (
                <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                  <Languages className="w-3 h-3" />
                  {i18n.language.toUpperCase()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentQuestion.respuestas.map((respuesta: Respuesta, index: number) => {
                const isSelected = selectedAnswer === respuesta.indice;
                const isCorrect = respuesta.indice === currentQuestion.correcta_indice;
                const showResult = showExplanation;

                let buttonClass = "w-full justify-start text-left";
                if (showResult) {
                  if (isSelected && isCorrect) {
                    buttonClass += " bg-green-100 border-green-500 hover:bg-green-100";
                  } else if (isSelected && !isCorrect) {
                    buttonClass += " bg-red-100 border-red-500 hover:bg-red-100";
                  } else if (isCorrect) {
                    buttonClass += " bg-green-50 border-green-300";
                  }
                }

                return (
                  <Button
                    key={respuesta.indice}
                    variant={isSelected ? "default" : "outline"}
                    className={buttonClass}
                    onClick={() => !showExplanation && handleAnswer(respuesta.indice)}
                    disabled={showExplanation || (isTranslating && needsTranslation && !currentTranslation)}
                  >
                    <span className="font-bold mr-2 text-blue-600">
                      {String.fromCharCode(64 + parseInt(respuesta.indice))}.
                    </span>
                    <span className="flex-1">{getAnswerText(index)}</span>
                    {showResult && isCorrect && (
                      <CheckCircle className="w-5 h-5 text-green-600 ml-2" />
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-red-600 ml-2" />
                    )}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Explanation */}
        {showExplanation && (
          <Card className="mb-8 bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {selectedAnswer === currentQuestion.correcta_indice ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">
                    {selectedAnswer === currentQuestion.correcta_indice ? t('quiz.correct') : t('quiz.incorrect')}
                  </h3>
                  <p className="text-gray-700">
                    {t('quiz.correctAnswerIs')}: {String.fromCharCode(64 + parseInt(currentQuestion.correcta_indice))}. {
                      needsTranslation && currentTranslation
                        ? currentTranslation.respuestas[currentQuestion.respuestas.findIndex(r => r.indice === currentQuestion.correcta_indice)]
                        : currentQuestion.respuestas.find(r => r.indice === currentQuestion.correcta_indice)?.respuesta
                    }
                  </p>
                  
                  {/* Trazabilidad de fuente - solo si hay datos y el usuario acertó */}
                  {selectedAnswer === currentQuestion.correcta_indice && currentQuestion.documento && (
                    <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">{t('quiz.documentReference')}</span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="flex items-center gap-2">
                          <FileText className="w-3 h-3" />
                          <span className="font-medium">{t('quiz.document')}:</span> {currentQuestion.documento}
                        </p>
                        {currentQuestion.pagina && (
                          <p><span className="font-medium">{t('quiz.page')}:</span> {currentQuestion.pagina}</p>
                        )}
                        {currentQuestion.ubicacion && (
                          <p><span className="font-medium">{t('quiz.location')}:</span> {currentQuestion.ubicacion}</p>
                        )}
                        {currentQuestion.cita && (
                          <div className="mt-2 p-2 bg-gray-50 rounded border-l-2 border-blue-400 italic text-gray-700">
                            "{currentQuestion.cita}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        {showExplanation && (
          <div className="text-center">
            <Button onClick={handleNextQuestion} size="lg" className="bg-blue-600 hover:bg-blue-700">
              {currentQuestionIndex < questions.length - 1 ? t('quiz.nextQuestion') : t('quiz.finishTest')}
            </Button>
          </div>
        )}

        {/* Score Display */}
        <div className="text-center mt-8">
          <div className="text-lg text-gray-600">
            {t('quiz.currentScore')}: <span className="font-bold text-blue-600">{score}/{currentQuestionIndex + (showExplanation ? 1 : 0)}</span>
          </div>
        </div>

        {/* Comments Section */}
        {selectedAnswer && (
          <Card className="mt-8">
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {t('quiz.comments')}
            </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comentarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('quiz.noCommentsYet')}</p>
                ) : (
                  comentarios.map((c) => (
                    <div key={c.id} className="border-b pb-3 last:border-b-0">
                      {editandoId === c.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={textoEditado}
                            onChange={(e) => setTextoEditado(e.target.value)}
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleEditComentario(c.id)}>
                              {t('quiz.save')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>
                              {t('quiz.cancel')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{c.username || t('quiz.user')}</p>
                              <p className="text-sm mt-1">{c.comentario}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {c.fecha?.substring(0, 16).replace('T', ' ')}
                              </p>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 ml-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setEditandoId(c.id);
                                    setTextoEditado(c.comentario);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDeleteComentario(c.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
                <div className="space-y-2 pt-2">
                  <Textarea
                    placeholder={t('quiz.writeComment')}
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    rows={3}
                  />
                  <Button 
                    onClick={handleAddComentario} 
                    disabled={!nuevoComentario.trim()}
                    className="w-full sm:w-auto"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {t('quiz.sendComment')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profesor Virtual */}
        {selectedAnswer && (
          <Card className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <GraduationCap className="h-6 w-6" />
                  {t('quiz.virtualProfessor')}
                </CardTitle>
                <Button
                  onClick={handlePedirExplicacion}
                  disabled={cargandoProfesor}
                  variant="outline"
                  size="sm"
                  className="border-purple-300 hover:bg-purple-100"
                >
                  {cargandoProfesor ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('quiz.thinking')}
                    </>
                  ) : (
                    <>
                      <GraduationCap className="h-4 w-4 mr-2" />
                      {t('quiz.askExplanation')}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {explicacionProfesor ? (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  {needsTranslation && (
                    <div className="flex items-center gap-2 mb-2">
                      <Languages className="h-4 w-4 text-purple-600" />
                      <Badge variant="outline" className="text-xs">{i18n.language.toUpperCase()}</Badge>
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                    {explicacionProfesor}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-purple-700">
                  {t('quiz.clickToGetExplanation')}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QuizInterface;
