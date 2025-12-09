import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Search, Trophy, XCircle, CheckCircle } from 'lucide-react';
import { testService } from '@/services/testService';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

interface HistorialTestsProps {
  onBack: () => void;
}

const HistorialTests: React.FC<HistorialTestsProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<'simulacion' | 'examen' | ''>('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [q, setQ] = useState('');
  const [statsGlobal, setStatsGlobal] = useState<any>(null);
  const [statsSim, setStatsSim] = useState<any>(null);
  const [statsExam, setStatsExam] = useState<any>(null);
  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      cargarDatos();
    }
  }, [user, tipo, desde, hasta, q]);

  const cargarDatos = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Cargar estadísticas
    const [global, sim, exam] = await Promise.all([
      testService.getEstadisticasUsuario({ user_id: user.id }),
      testService.getEstadisticasUsuario({ user_id: user.id, tipo_test: 'simulacion' }),
      testService.getEstadisticasUsuario({ user_id: user.id, tipo_test: 'examen' }),
    ]);
    
    setStatsGlobal(global);
    setStatsSim(sim);
    setStatsExam(exam);
    
    // Cargar historial
    const historial = await testService.getHistorialTests({
      user_id: user.id,
      tipo_test: tipo || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      q: q || undefined,
    });
    
    setTests(historial);
    setLoading(false);
  };

  const limpiarFiltros = () => {
    setTipo('');
    setDesde('');
    setHasta('');
    setQ('');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('es-ES', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseJsonField = (str: any) => {
    if (!str) return [];
    try {
      if (typeof str === 'string') return JSON.parse(str);
      if (typeof str === 'object') return str;
      return [];
    } catch {
      return [];
    }
  };

  const openModal = (test: any) => {
    setSelectedTest(test);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('history.backToHome')}
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {statsGlobal && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">{t('history.totalStats')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>{t('history.tests')}: <strong>{statsGlobal.total_tests}</strong></p>
                  <p className="text-green-600">{t('history.correct')}: <strong>{statsGlobal.total_aciertos}</strong></p>
                  <p className="text-red-600">{t('history.incorrect')}: <strong>{statsGlobal.total_fallos}</strong></p>
                  <p className="text-lg font-bold mt-3">{t('history.averageScore')}: <span className="text-green-600">{parseFloat(statsGlobal.nota_media).toFixed(2)}</span></p>
                </div>
              </CardContent>
            </Card>
          )}
          {statsSim && (
            <Card className="bg-cyan-50 border-cyan-200">
              <CardHeader>
                <CardTitle className="text-lg text-cyan-700">{t('history.simulationsOnly')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>{t('history.tests')}: <strong>{statsSim.total_tests}</strong></p>
                  <p className="text-green-600">{t('history.correct')}: <strong>{statsSim.total_aciertos}</strong></p>
                  <p className="text-red-600">{t('history.incorrect')}: <strong>{statsSim.total_fallos}</strong></p>
                  <p className="text-lg font-bold mt-3">{t('history.averageScore')}: <span className="text-green-600">{parseFloat(statsSim.nota_media).toFixed(2)}</span></p>
                </div>
              </CardContent>
            </Card>
          )}
          {statsExam && (
            <Card className="bg-red-50 border-red-200">
              <CardHeader>
                <CardTitle className="text-lg text-red-700">{t('history.examsOnly')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>{t('history.tests')}: <strong>{statsExam.total_tests}</strong></p>
                  <p className="text-green-600">{t('history.correct')}: <strong>{statsExam.total_aciertos}</strong></p>
                  <p className="text-red-600">{t('history.incorrect')}: <strong>{statsExam.total_fallos}</strong></p>
                  <p className="text-lg font-bold mt-3">{t('history.averageScore')}: <span className="text-red-600">{parseFloat(statsExam.nota_media).toFixed(2)}</span></p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('history.filters')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="">{t('history.all')}</TabsTrigger>
                <TabsTrigger value="simulacion">{t('history.simulations')}</TabsTrigger>
                <TabsTrigger value="examen">{t('history.exams')}</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="desde">{t('history.from')}</Label>
                <Input
                  id="desde"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="hasta">{t('history.to')}</Label>
                <Input
                  id="hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="buscar">{t('history.searchByTopic')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="buscar"
                  placeholder={t('history.searchPlaceholder')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button variant="outline" onClick={limpiarFiltros} className="w-full">
              {t('history.clearFilters')}
            </Button>
          </CardContent>
        </Card>

        {/* Historial */}
        <h2 className="text-2xl font-bold mb-4">{t('history.title')}</h2>
        
        {loading ? (
          <p className="text-center text-gray-600">{t('history.loading')}</p>
        ) : tests.length === 0 ? (
          <p className="text-center text-gray-600">{t('history.noTests')}</p>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <Card 
                key={test.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => openModal(test)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={test.tipo_test === 'examen' ? 'destructive' : 'default'}>
                        {test.tipo_test === 'examen' ? t('history.exam') : t('history.simulation')}
                      </Badge>
                      <Badge variant={test.estado === 'finalizado' ? 'outline' : 'secondary'}>
                        {test.estado === 'finalizado' ? t('history.finished') : t('history.inProgress')}
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(test.fecha_finalizacion || test.fecha_inicio)}
                    </span>
                  </div>
                  <CardTitle className="mt-2">{test.descripcion || t('history.noDescription')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p><strong>{t('history.topics')}:</strong> <span className="text-blue-600">{test.temas}</span></p>
                    <p><strong>{t('history.sections')}:</strong> <span className="text-blue-600">{test.secciones}</span></p>
                    <div className="flex gap-4 mt-3">
                      <span><strong>{t('history.correct')}:</strong> {test.aciertos}</span>
                      <span><strong>{t('history.incorrect')}:</strong> {test.fallos}</span>
                      <span><strong>{t('history.questions')}:</strong> {test.num_preguntas}</span>
                    </div>
                    {test.nota && (
                      <p className="text-lg font-bold mt-2">
                        {t('history.score')}: <span className="text-green-600">{test.nota}</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de detalles */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                {t('history.testDetails')} {selectedTest?.tipo_test === 'examen' ? t('history.exam') : t('history.simulation')}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              {selectedTest && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg mb-2">{selectedTest.descripcion}</h3>
                    <p><strong>{t('history.date')}:</strong> {formatDate(selectedTest.fecha_finalizacion || selectedTest.fecha_inicio)}</p>
                    <p><strong>{t('history.topics')}:</strong> <span className="text-blue-600">{selectedTest.temas}</span></p>
                    <p><strong>{t('history.sections')}:</strong> <span className="text-blue-600">{selectedTest.secciones}</span></p>
                    <p><strong>{t('history.correct')}:</strong> <span className="text-green-600">{selectedTest.aciertos}</span></p>
                    <p><strong>{t('history.incorrect')}:</strong> <span className="text-red-600">{selectedTest.fallos}</span></p>
                    <p><strong>{t('history.questions')}:</strong> {selectedTest.num_preguntas}</p>
                    <p className="text-lg"><strong>{t('history.score')}:</strong> <span className="text-green-600 font-bold">{selectedTest.nota}</span></p>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-bold text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      {t('history.correctQuestions')}
                    </h4>
                    {parseJsonField(selectedTest.acertadas).length === 0 ? (
                      <p className="text-gray-600">{t('history.noCorrectQuestions')}</p>
                    ) : (
                      <div className="space-y-2">
                        {parseJsonField(selectedTest.acertadas).map((p: any, i: number) => (
                          <Card key={`acertada-${i}`} className="bg-green-50">
                            <CardContent className="pt-4">
                              <p className="font-bold">{i + 1}. {p.pregunta}</p>
                              <p className="text-sm mt-1">{t('history.yourAnswer')}: <span className="text-green-600 font-bold">{p.respuesta_usuario}</span></p>
                              <p className="text-sm text-blue-600">{t('history.correctAnswer')}: {p.correcta_indice}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-bold text-red-600 mb-2 flex items-center gap-2">
                      <XCircle className="w-5 h-5" />
                      {t('history.incorrectQuestions')}
                    </h4>
                    {parseJsonField(selectedTest.falladas).length === 0 ? (
                      <p className="text-gray-600">{t('history.noIncorrectQuestions')}</p>
                    ) : (
                      <div className="space-y-2">
                        {parseJsonField(selectedTest.falladas).map((p: any, i: number) => (
                          <Card key={`fallada-${i}`} className="bg-red-50">
                            <CardContent className="pt-4">
                              <p className="font-bold">{i + 1}. {p.pregunta}</p>
                              <p className="text-sm mt-1">{t('history.yourAnswer')}: <span className="text-red-600 font-bold">{p.respuesta_usuario}</span></p>
                              <p className="text-sm text-blue-600">{t('history.correctAnswer')}: {p.correcta_indice}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default HistorialTests;
