import React, { useEffect, useState } from 'react';
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
      console.log('🔍 Cargando ranking con:', { userId, tipo });
      
      const response = await testService.getRanking({
        user_id: userId,
        tipo_test: tipo || undefined,
        limit: 50
      });
      
      console.log('📊 Respuesta del ranking:', response);
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
    if (posicion === 1) return 'bg-yellow-50 border-yellow-200';
    if (posicion === 2) return 'bg-gray-50 border-gray-200';
    if (posicion === 3) return 'bg-amber-50 border-amber-200';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            <Trophy className="w-10 h-10 inline-block text-yellow-500 mr-2" />
            Ranking de Usuarios
          </h1>
          <p className="text-gray-600">Los mejores estudiantes de Oposiciones-Test</p>
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filtrar por tipo de test</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="">Todos</TabsTrigger>
                <TabsTrigger value="simulacion">Simulaciones</TabsTrigger>
                <TabsTrigger value="examen">Exámenes</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Ranking */}
        {loading ? (
          <p className="text-center text-gray-600">Cargando ranking...</p>
        ) : ranking.length === 0 ? (
          <p className="text-center text-gray-600">No hay datos de ranking disponibles.</p>
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
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow">
                        {getMedalIcon(posicion) || (
                          <span className="font-bold text-lg text-gray-700">#{posicion}</span>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">
                            {item.username || 'Usuario Anónimo'}
                          </h3>
                          {esUsuarioActual && (
                            <Badge variant="default">Tú</Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600 mt-1">
                          <span>Tests: <strong>{item.total_tests}</strong></span>
                          <span className="text-green-600">Aciertos: <strong>{item.total_aciertos}</strong></span>
                          <span className="text-red-600">Fallos: <strong>{item.total_fallos}</strong></span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {parseFloat(item.nota_media).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">Nota media</div>
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
