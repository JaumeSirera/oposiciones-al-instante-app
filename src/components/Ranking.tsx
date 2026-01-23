import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react';
import { testService } from '@/services/testService';
import { useAuth } from '@/contexts/AuthContext';

interface RankingProps {
  onBack: () => void;
}

const Ranking: React.FC<RankingProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<'simulacion' | 'examen' | ''>('');

  useEffect(() => {
    cargarRanking();
  }, [tipo]);

  const cargarRanking = async () => {
    setLoading(true);
    try {
      const userId = user?.id ? Number(user.id) : undefined;
      const response = await testService.getRanking({
        user_id: userId,
        tipo_test: tipo || undefined,
        limit: 50
      });
      setRanking(response.ranking);
    } catch (error) {
      console.error('❌ Error al cargar ranking:', error);
      setRanking([]);
    } finally {
      setLoading(false);
    }
  };

  const getMedalIcon = (posicion: number) => {
    if (posicion === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (posicion === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (posicion === 3) return <Award className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const getMedalBg = (posicion: number) => {
    if (posicion === 1) return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700';
    if (posicion === 2) return 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700';
    if (posicion === 3) return 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('ranking.backToHome')}
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            <Trophy className="w-10 h-10 inline-block text-yellow-500 mr-2" />
            {t('ranking.title')}
          </h1>
          <p className="text-muted-foreground">{t('ranking.subtitle')}</p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('ranking.filterByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="">{t('ranking.all')}</TabsTrigger>
                <TabsTrigger value="simulacion">{t('ranking.simulations')}</TabsTrigger>
                <TabsTrigger value="examen">{t('ranking.exams')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-center text-muted-foreground">{t('ranking.loading')}</p>
        ) : ranking.length === 0 ? (
          <p className="text-center text-muted-foreground">{t('ranking.noData')}</p>
        ) : (
          <div className="space-y-3">
            {ranking.map((item, index) => {
              const posicion = index + 1;
              const esUsuarioActual = user?.id && Number(user.id) === item.id;
              
              return (
                <Card 
                  key={item.id} 
                  className={`hover:shadow-lg transition-shadow ${getMedalBg(posicion)} ${esUsuarioActual ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-background shadow dark:shadow-none dark:border dark:border-border">
                        {getMedalIcon(posicion) || (
                          <span className="font-bold text-lg text-muted-foreground">#{posicion}</span>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-foreground">
                            {item.username || t('ranking.anonymousUser')}
                          </h3>
                          {esUsuarioActual && (
                            <Badge variant="default">{t('ranking.you')}</Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                          <span>{t('ranking.tests')}: <strong>{item.total_tests}</strong></span>
                          <span className="text-green-600 dark:text-green-400">{t('ranking.correct')}: <strong>{item.total_aciertos}</strong></span>
                          <span className="text-red-600 dark:text-red-400">{t('ranking.incorrect')}: <strong>{item.total_fallos}</strong></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {parseFloat(item.nota_media).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t('ranking.averageScore')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Ranking;
