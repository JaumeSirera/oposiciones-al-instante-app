import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
  const incorrectAnswers = stats.totalQuestions - stats.correctAnswers;

  const getAccuracyColor = (acc: number) => {
    if (acc >= 80) return 'text-green-600 dark:text-green-400';
    if (acc >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAccuracyBgColor = (acc: number) => {
    if (acc >= 80) return 'bg-green-100 dark:bg-green-900/30';
    if (acc >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={onBack} className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('stats.back')}
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{t('stats.title')}</h1>
        </div>

        {stats.totalQuestions === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">
                {t('stats.noQuizYet')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t('stats.startPracticing')}
              </p>
              <Button onClick={onBack} className="bg-primary hover:bg-primary/90">
                {t('stats.startFirstQuiz')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Resumen Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-foreground">{stats.totalQuestions}</div>
                  <div className="text-sm text-muted-foreground">{t('stats.totalQuestions')}</div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Target className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                  <div className={`text-3xl font-bold ${getAccuracyColor(accuracy)}`}>{accuracy}%</div>
                  <div className="text-sm text-muted-foreground">{t('stats.accuracy')}</div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-foreground">
                    {stats.averageTime > 0 ? `${Math.round(stats.averageTime)}s` : '-'}
                  </div>
                  <div className="text-sm text-muted-foreground">{t('stats.averageTime')}</div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="pt-6">
                  <Award className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-foreground">{stats.streakCount}</div>
                  <div className="text-sm text-muted-foreground">{t('stats.perfectStreak')}</div>
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
                    {t('stats.accuracyAnalysis')}
                  </CardTitle>
                  <CardDescription>
                    {t('stats.yourPerformance')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg ${getAccuracyBgColor(accuracy)}`}>
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${getAccuracyColor(accuracy)} mb-2`}>
                          {accuracy}%
                        </div>
                        <div className="text-sm text-muted-foreground">{t('stats.generalAccuracy')}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('stats.correctAnswers')}</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{stats.correctAnswers}</span>
                      </div>
                      <Progress value={(stats.correctAnswers / stats.totalQuestions) * 100} className="h-2" />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('stats.incorrectAnswers')}</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{incorrectAnswers}</span>
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
                    {t('stats.temporalPerformance')}
                  </CardTitle>
                  <CardDescription>
                    {t('stats.responseSpeed')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                        {stats.averageTime > 0 ? `${Math.round(stats.averageTime)}s` : '-'}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('stats.avgTimePerQuestion')}</div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('stats.idealTime')}</span>
                        <span className="text-green-600 dark:text-green-400">≤ 20s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('stats.acceptableTime')}</span>
                        <span className="text-yellow-600 dark:text-yellow-400">21-30s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('stats.needsImprovement')}</span>
                        <span className="text-red-600 dark:text-red-400">&gt; 30s</span>
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
                    {t('stats.unlockedAchievements')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.totalQuestions >= 10 && (
                      <div className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                        <Trophy className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mr-3" />
                        <div>
                          <div className="font-semibold text-foreground">{t('stats.beginner')}</div>
                          <div className="text-sm text-muted-foreground">{t('stats.completed10Questions')}</div>
                        </div>
                      </div>
                    )}
                    
                    {accuracy >= 80 && stats.totalQuestions >= 5 && (
                      <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <Target className="w-6 h-6 text-green-600 dark:text-green-400 mr-3" />
                        <div>
                          <div className="font-semibold text-foreground">{t('stats.precisionMaster')}</div>
                          <div className="text-sm text-muted-foreground">{t('stats.accuracy80Plus')}</div>
                        </div>
                      </div>
                    )}
                    
                    {stats.streakCount >= 3 && (
                      <div className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                        <Award className="w-6 h-6 text-purple-600 dark:text-purple-400 mr-3" />
                        <div>
                          <div className="font-semibold text-foreground">{t('stats.onStreak')}</div>
                          <div className="text-sm text-muted-foreground">{t('stats.streakOf', { count: stats.streakCount })}</div>
                        </div>
                      </div>
                    )}
                    
                    {stats.totalQuestions < 10 && (
                      <div className="text-center text-muted-foreground py-4">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <div>{t('stats.keepPracticing')}</div>
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
                    {t('stats.recommendations')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {accuracy < 60 && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="font-semibold text-red-800 dark:text-red-300 mb-1">{t('stats.improveAccuracy')}</div>
                        <div className="text-sm text-red-700 dark:text-red-400">
                          {t('stats.studyMoreBeforeQuiz')}
                        </div>
                      </div>
                    )}
                    
                    {stats.averageTime > 30 && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="font-semibold text-orange-800 dark:text-orange-300 mb-1">{t('stats.increaseSpeed')}</div>
                        <div className="text-sm text-orange-700 dark:text-orange-400">
                          {t('stats.practiceMoreForSpeed')}
                        </div>
                      </div>
                    )}
                    
                    {accuracy >= 80 && stats.averageTime <= 25 && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="font-semibold text-green-800 dark:text-green-300 mb-1">{t('stats.excellentWork')}</div>
                        <div className="text-sm text-green-700 dark:text-green-400">
                          {t('stats.keepThisRhythm')}
                        </div>
                      </div>
                    )}
                    
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="font-semibold text-blue-800 dark:text-blue-300 mb-1">{t('stats.generalTip')}</div>
                      <div className="text-sm text-blue-700 dark:text-blue-400">
                        {t('stats.practiceRegularly')}
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
