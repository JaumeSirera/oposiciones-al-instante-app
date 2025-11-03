
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Trophy, Target, Clock, TrendingUp, BookOpen, Award } from 'lucide-react';

interface StatsData {
  totalQuestions: number;
  correctAnswers: number;
  averageTime: number;
  streakCount: number;
}

interface StatsPanelProps {
  stats: StatsData;
  onBack: () => void;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ stats, onBack }) => {
  const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
  const incorrectAnswers = stats.totalQuestions - stats.correctAnswers;

  const getAccuracyColor = (acc: number) => {
    if (acc >= 80) return 'text-green-600';
    if (acc >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyBgColor = (acc: number) => {
    if (acc >= 80) return 'bg-green-100';
    if (acc >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Tus Estadísticas</h1>
        </div>

        {stats.totalQuestions === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-600 mb-2">
                ¡Aún no has realizado ningún quiz!
              </h2>
              <p className="text-gray-500 mb-6">
                Comienza a practicar para ver tus estadísticas aquí
              </p>
              <Button onClick={onBack} className="bg-blue-600 hover:bg-blue-700">
                Empezar Primer Quiz
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Resumen Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-gray-800">{stats.totalQuestions}</div>
                  <div className="text-sm text-gray-600">Preguntas Totales</div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Target className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className={`text-3xl font-bold ${getAccuracyColor(accuracy)}`}>{accuracy}%</div>
                  <div className="text-sm text-gray-600">Precisión</div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-gray-800">
                    {stats.averageTime > 0 ? `${Math.round(stats.averageTime)}s` : '-'}
                  </div>
                  <div className="text-sm text-gray-600">Tiempo Promedio</div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Award className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-gray-800">{stats.streakCount}</div>
                  <div className="text-sm text-gray-600">Racha Perfecta</div>
                </CardContent>
              </Card>
            </div>

            {/* Análisis Detallado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Precisión */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="w-5 h-5 mr-2 text-green-600" />
                    Análisis de Precisión
                  </CardTitle>
                  <CardDescription>
                    Tu rendimiento en las respuestas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg ${getAccuracyBgColor(accuracy)}`}>
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${getAccuracyColor(accuracy)} mb-2`}>
                          {accuracy}%
                        </div>
                        <div className="text-sm text-gray-700">Precisión General</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Respuestas Correctas</span>
                        <span className="font-semibold text-green-600">{stats.correctAnswers}</span>
                      </div>
                      <Progress value={(stats.correctAnswers / stats.totalQuestions) * 100} className="h-2" />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Respuestas Incorrectas</span>
                        <span className="font-semibold text-red-600">{incorrectAnswers}</span>
                      </div>
                      <Progress value={(incorrectAnswers / stats.totalQuestions) * 100} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rendimiento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                    Rendimiento Temporal
                  </CardTitle>
                  <CardDescription>
                    Tu velocidad de respuesta
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {stats.averageTime > 0 ? `${Math.round(stats.averageTime)}s` : '-'}
                      </div>
                      <div className="text-sm text-gray-700">Tiempo Promedio por Pregunta</div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Tiempo Ideal</span>
                        <span className="text-green-600">≤ 20s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Tiempo Aceptable</span>
                        <span className="text-yellow-600">21-30s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Necesita Mejora</span>
                        <span className="text-red-600">&gt; 30s</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Logros y Recomendaciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Logros */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                    Logros Desbloqueados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.totalQuestions >= 10 && (
                      <div className="flex items-center p-3 bg-yellow-50 rounded-lg">
                        <Trophy className="w-6 h-6 text-yellow-600 mr-3" />
                        <div>
                          <div className="font-semibold">Principiante</div>
                          <div className="text-sm text-gray-600">Has completado 10 preguntas</div>
                        </div>
                      </div>
                    )}
                    
                    {accuracy >= 80 && stats.totalQuestions >= 5 && (
                      <div className="flex items-center p-3 bg-green-50 rounded-lg">
                        <Target className="w-6 h-6 text-green-600 mr-3" />
                        <div>
                          <div className="font-semibold">Precision Master</div>
                          <div className="text-sm text-gray-600">Precisión superior al 80%</div>
                        </div>
                      </div>
                    )}
                    
                    {stats.streakCount >= 3 && (
                      <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                        <Award className="w-6 h-6 text-purple-600 mr-3" />
                        <div>
                          <div className="font-semibold">En Racha</div>
                          <div className="text-sm text-gray-600">Racha de {stats.streakCount} quiz perfectos</div>
                        </div>
                      </div>
                    )}
                    
                    {stats.totalQuestions < 10 && (
                      <div className="text-center text-gray-500 py-4">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <div>¡Sigue practicando para desbloquear más logros!</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recomendaciones */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Recomendaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {accuracy < 60 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-semibold text-red-800 mb-1">Mejora tu precisión</div>
                        <div className="text-sm text-red-700">
                          Dedica más tiempo a estudiar los temas antes de hacer quiz
                        </div>
                      </div>
                    )}
                    
                    {stats.averageTime > 30 && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="font-semibold text-orange-800 mb-1">Aumenta tu velocidad</div>
                        <div className="text-sm text-orange-700">
                          Practica más para responder más rápidamente
                        </div>
                      </div>
                    )}
                    
                    {accuracy >= 80 && stats.averageTime <= 25 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="font-semibold text-green-800 mb-1">¡Excelente trabajo!</div>
                        <div className="text-sm text-green-700">
                          Mantén este ritmo y estarás listo para el examen
                        </div>
                      </div>
                    )}
                    
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="font-semibold text-blue-800 mb-1">Consejo general</div>
                      <div className="text-sm text-blue-700">
                        Practica regularmente para mantener y mejorar tu rendimiento
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;
