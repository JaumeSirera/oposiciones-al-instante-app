import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Trophy, Clock, TrendingUp, Heart, ExternalLink, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import logo from '@/assets/logo.png';
import { supabase } from '@/lib/supabaseClient';
import { ModalPlanEstudio } from '@/components/ModalPlanEstudio';

const BASE_FOTO_URL = 'https://oposiciones-test.com/api/uploads/procesos/';
const PROXY_FUNCTION = 'php-api-proxy';

const CCAA_LIST = [
  { nombre: 'Galicia', url: 'http://www.xunta.es/diario-oficial-galicia?lang=gl', area: { left: 55, top: 21, width: 80, height: 47 } },
  { nombre: 'Asturias', url: 'https://sede.asturias.es/web/sede/ultimos-boletines?p_r_p_summaryLastBopa=true', area: { left: 120, top: 24, width: 60, height: 17 } },
  { nombre: 'Cantabria', url: 'http://boc.cantabria.es/boces/', area: { left: 177, top: 24, width: 35, height: 18 } },
  { nombre: 'País Vasco', url: 'https://www.euskadi.eus/y22-bopv/es/p43aBOPVWebWar/difuEntradaUsuario.do?idioma=es&submit=cargar', area: { left: 216, top: 26, width: 28, height: 23 } },
  { nombre: 'Navarra', url: 'http://www.navarra.es/home_es/Actualidad/BON/', area: { left: 235, top: 31, width: 33, height: 34 } },
  { nombre: 'La Rioja', url: 'https://www.larioja.org/bor/es?locale=es_ES', area: { left: 219, top: 59, width: 26, height: 13 } },
  { nombre: 'Aragón', url: 'https://www.boa.aragon.es/#/', area: { left: 260, top: 41, width: 54, height: 80 } },
  { nombre: 'Cataluña', url: 'http://www20.gencat.cat/portal/site/portaldogc?newLang=es_ES', area: { left: 295, top: 50, width: 65, height: 51 } },
  { nombre: 'Castilla y León', url: 'http://bocyl.jcyl.es/', area: { left: 135, top: 45, width: 79, height: 55 } },
  { nombre: 'Madrid', url: 'http://www.bocm.es/', area: { left: 190, top: 100, width: 29, height: 29 } },
  { nombre: 'Extremadura', url: 'http://doe.juntaex.es/', area: { left: 100, top: 112, width: 56, height: 58 } },
  { nombre: 'Castilla-La Mancha', url: 'http://docm.jccm.es/', area: { left: 165, top: 120, width: 90, height: 54 } },
  { nombre: 'Comunidad Valenciana', url: 'https://dogv.gva.es/es/inici', area: { left: 263, top: 117, width: 36, height: 70 } },
  { nombre: 'Murcia', url: 'https://www.borm.es/#/home/boletines', area: { left: 240, top: 180, width: 31, height: 23 } },
  { nombre: 'Andalucía', url: 'http://www.juntadeandalucia.es/eboja.html', area: { left: 110, top: 176, width: 140, height: 59 } },
  { nombre: 'Ceuta', url: 'https://www.ceuta.es/ceuta/bocce', area: { left: 133, top: 250, width: 44, height: 20 } },
  { nombre: 'Melilla', url: 'https://bomemelilla.es/bomes/2022', area: { left: 184, top: 250, width: 44, height: 20 } },
  { nombre: 'Canarias', url: 'https://www.gobiernodecanarias.org/boc/', area: { left: 40, top: 220, width: 60, height: 33 } },
  { nombre: 'Baleares', url: 'http://www.caib.es/eboibfront/?lang=es', area: { left: 320, top: 130, width: 70, height: 31 } },
];

const Index = () => {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  const isSpanish = i18n.language === 'es' || i18n.language.startsWith('es-');
  
  const [userStats, setUserStats] = useState({
    totalQuestions: 0,
    correctAnswers: 0,
    averageTime: 0,
    streakCount: 0
  });
  
  const [procesos, setProcesos] = useState<any[]>([]);
  const [noticias, setNoticias] = useState<any[]>([]);
  const [rssNoticias, setRssNoticias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ccaaTooltip, setCcaaTooltip] = useState<{ nombre: string; x: number; y: number } | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [showModalPlan, setShowModalPlan] = useState(false);

  useEffect(() => {
    const cargarEstadisticas = async () => {
      if (!user?.id) return;
      
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
          body: {
            endpoint: `estadisticas_usuario.php?user_id=${user.id}`,
            method: 'GET',
          },
          headers,
        });

        if (error) throw error;
        
        if (data && !data.error) {
          const totalPreguntas = parseInt(data.total_aciertos || 0) + parseInt(data.total_fallos || 0);
          
          setUserStats({
            totalQuestions: totalPreguntas,
            correctAnswers: parseInt(data.total_aciertos) || 0,
            averageTime: parseFloat(data.nota_media) || 0,
            streakCount: parseInt(data.total_tests) || 0
          });
        }
      } catch (error) {
        console.error('Error al cargar estadísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarEstadisticas();
  }, [user?.id]);

  // Cargar últimos procesos
  useEffect(() => {
    const cargarProcesos = async () => {
      if (!user?.id) return;
      
      try {
        const token = localStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
          body: {
            endpoint: `ultimos_procesos.php?user_id=${user.id}`,
            method: 'GET',
          },
          headers,
        });

        if (error) throw error;
        setProcesos(Array.isArray(data) ? data.slice(0, 4) : []);
      } catch (error) {
        console.error('Error al cargar procesos:', error);
        setProcesos([]);
      }
    };

    cargarProcesos();
  }, [user?.id]);

  // Cargar noticias
  useEffect(() => {
    const cargarNoticias = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
          body: {
            endpoint: 'proxy_noticias_oposiciones.php',
            method: 'GET',
          },
        });

        if (error) throw error;
        setNoticias(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch (error) {
        console.error('Error al cargar noticias:', error);
        setNoticias([]);
      }
    };

    cargarNoticias();
  }, []);

  // Cargar RSS extra
  useEffect(() => {
    const cargarRss = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(PROXY_FUNCTION, {
          body: {
            endpoint: 'noticias_oposiciones_multifuente.php',
            method: 'GET',
          },
        });

        if (error) throw error;
        setRssNoticias(Array.isArray(data) ? data.slice(0, 3) : []);
      } catch (error) {
        console.error('Error al cargar RSS:', error);
        setRssNoticias([]);
      }
    };

    cargarRss();
  }, []);

  const renderMapaCCAA = () => {
    const maxW = 420;
    const ratio = 270 / 420;
    const w = Math.min(maxW, 420);
    const h = w * ratio;

    return (
      <Card className="overflow-hidden bg-white shadow-md border-indigo-100">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-white">
          <CardTitle className="text-indigo-900">Mapa de Boletines CCAA</CardTitle>
          <CardDescription className="text-gray-600">Haz clic en una comunidad para ver su boletín oficial</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex justify-center p-6">
            <div className="relative" style={{ width: w, height: h }}>
              <img
                src="https://oposiciones-test.com/api/uploads/ccaa-mapa420x270.gif"
                alt="Mapa de España con las Comunidades Autónomas"
                className="w-full h-full rounded-lg"
              />
              {CCAA_LIST.map(ccaa => {
                const left = (ccaa.area.left * (w / 420));
                const top = (ccaa.area.top * (h / 270));
                const widthArea = (ccaa.area.width * (w / 420));
                const heightArea = (ccaa.area.height * (h / 270));
                const centerX = left + widthArea / 2;
                const centerY = top + heightArea / 2;
                const showTooltip = ccaaTooltip?.nombre === ccaa.nombre;

                return (
                  <React.Fragment key={ccaa.nombre}>
                    <a
                      href={ccaa.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute rounded-lg border-2 transition-all"
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${widthArea}px`,
                        height: `${heightArea}px`,
                        borderColor: showTooltip ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)',
                        backgroundColor: showTooltip ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.08)',
                      }}
                      onMouseEnter={() => setCcaaTooltip({ nombre: ccaa.nombre, x: centerX, y: centerY })}
                      onMouseLeave={() => setCcaaTooltip(null)}
                      aria-label={`Ir al boletín oficial de ${ccaa.nombre}`}
                    />
                    {showTooltip && (
                      <div
                        className="absolute bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-lg pointer-events-none z-10"
                        style={{
                          left: `${centerX - 60}px`,
                          top: `${centerY - 30}px`,
                          width: '120px',
                        }}
                      >
                        <p className="text-sm font-bold text-center">{ccaa.nombre}</p>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <ModalPlanEstudio open={showModalPlan} onOpenChange={setShowModalPlan} />
      <div className="container mx-auto px-4 py-8">
        {/* SEO H1 */}
        <h1 className="sr-only">Oposiciones-Test · App para opositores</h1>

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Oposiciones Test" className="h-16 w-16" />
          </div>
          <h2 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-3">
            {t('home.welcomeUser', { username: user?.username })}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t('home.progressSubtitle')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow border-blue-100">
            <CardContent className="pt-6 text-center">
              <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">{userStats.totalQuestions}</div>
              <div className="text-sm text-gray-600">{t('home.questionsAsked')}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow border-green-100">
            <CardContent className="pt-6 text-center">
              <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">{userStats.correctAnswers}</div>
              <div className="text-sm text-gray-600">{t('home.correctAnswers')}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow border-orange-100">
            <CardContent className="pt-6 text-center">
              <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">
                {userStats.averageTime > 0 ? userStats.averageTime.toFixed(2) : '-'}
              </div>
              <div className="text-sm text-gray-600">{t('home.averageScore')}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-lg hover:shadow-xl transition-shadow border-purple-100">
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-800">{userStats.streakCount}</div>
              <div className="text-sm text-gray-600">{t('home.testsCompleted')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action - Planes de Estudio */}
        <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-xl mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">{t('home.readyToStart')}</h3>
                <p className="opacity-90 mb-4">{t('home.createStudyPlanDesc')}</p>
                <Button
                  onClick={() => setShowModalPlan(true)}
                  variant="secondary"
                  size="lg"
                  className="bg-white text-purple-600 hover:bg-gray-100"
                >
                  <Calendar className="mr-2 h-5 w-5" />
                  {t('home.createStudyPlan')}
                </Button>
              </div>
              <BookOpen className="h-24 w-24 opacity-20" />
            </div>
          </CardContent>
        </Card>

        {/* Call to Action - Planes Físicos */}
        <Card className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-xl mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">{t('home.getPhysicallyReady')}</h3>
                <p className="opacity-90 mb-4">{t('home.createPhysicalPlanDesc')}</p>
                <Button
                  onClick={() => navigate('/generar-plan-fisico-ia')}
                  variant="secondary"
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-gray-100"
                >
                  <Heart className="mr-2 h-5 w-5" />
                  {t('home.createPhysicalPlan')}
                </Button>
              </div>
              <Heart className="h-24 w-24 opacity-20" />
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Últimos Procesos */}
            <Card className="bg-white shadow-md border-blue-100">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-white">
                <CardTitle className="text-blue-900">{t('home.yourLastProcesses')}</CardTitle>
              </CardHeader>
              <CardContent>
                {procesos.length > 0 ? (
                  <div className="space-y-3">
                    {procesos.map(p => (
                      <div
                        key={p.id_proceso}
                        className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-white hover:from-blue-100 hover:to-blue-50 transition-all cursor-pointer border border-blue-200 shadow-sm hover:shadow-md"
                        onClick={() => navigate('/test')}
                      >
                        {p.foto && !failedImages.has(`proceso-${p.id_proceso}`) ? (
                          <img
                            src={BASE_FOTO_URL + p.foto}
                            alt={p.descripcion}
                            className="w-20 h-20 object-cover rounded-lg shadow-sm"
                            onError={() => setFailedImages(prev => new Set(prev).add(`proceso-${p.id_proceso}`))}
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-blue-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-blue-900 line-clamp-1">{p.descripcion}</h3>
                          <p className="text-sm text-gray-700 mt-1">
                            <Calendar className="inline w-3 h-3 mr-1 text-blue-600" />
                            {p.fecha_inicio} - {p.fecha_fin}
                          </p>
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            {t('home.lastTest')}: {p.ultima_fecha?.substring(0, 16).replace('T', ' ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm">{t('home.noRecentProcesses')}</p>
                )}
              </CardContent>
            </Card>

            {/* Noticias de Oposiciones - Solo en español */}
            {isSpanish && (
              <Card className="bg-white shadow-md border-green-100">
                <CardHeader className="bg-gradient-to-r from-green-50 to-white">
                  <CardTitle className="text-green-900">{t('home.oppositionNews')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {noticias.length > 0 ? (
                    <div className="space-y-3">
                      {noticias.map((n, i) => (
                        <a
                          key={i}
                          href={n.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-white hover:from-green-100 hover:to-green-50 transition-all border border-green-200 shadow-sm hover:shadow-md"
                        >
                          {n.image && !failedImages.has(`noticia-${i}`) ? (
                            <img
                              src={n.image}
                              alt={n.title}
                              className="w-20 h-20 object-cover rounded-lg shadow-sm"
                              onError={() => setFailedImages(prev => new Set(prev).add(`noticia-${i}`))}
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                              <BookOpen className="w-8 h-8 text-green-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-green-900 line-clamp-2">{n.title}</h3>
                            <p className="text-sm text-gray-700 line-clamp-2 mt-1">{n.summary}</p>
                            <p className="text-xs text-gray-500 mt-1">{n.date}</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-green-600 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">Sin noticias recientes.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Últimas Oposiciones (BOE, BOCM, etc) - Solo en español */}
            {isSpanish && (
              <Card className="bg-white shadow-md border-purple-100">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-white">
                  <CardTitle className="text-purple-900">Últimas Oposiciones (BOE, BOCM, etc)</CardTitle>
                </CardHeader>
                <CardContent>
                  {rssNoticias.length > 0 ? (
                    <div className="space-y-3">
                      {rssNoticias.map((n, i) => (
                        <a
                          key={i}
                          href={n.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 hover:to-purple-50 transition-all border border-purple-200 shadow-sm hover:shadow-md"
                        >
                          {n.image && !failedImages.has(`rss-${i}`) ? (
                            <img
                              src={n.image}
                              alt={n.title}
                              className="w-20 h-20 object-cover rounded-lg shadow-sm"
                              onError={() => setFailedImages(prev => new Set(prev).add(`rss-${i}`))}
                            />
                          ) : (
                            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                              <BookOpen className="w-8 h-8 text-purple-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-purple-900 line-clamp-2">{n.title}</h3>
                            <p className="text-sm text-gray-700 italic line-clamp-2 mt-1">{n.summary}</p>
                            <p className="text-xs text-gray-500 mt-1">{n.date}</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">{t('home.loadingNews')}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Mapa CCAA - Solo en español */}
            {isSpanish && renderMapaCCAA()}

            {/* Acciones rápidas */}
            <Card className="bg-white shadow-md border-orange-100">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-white">
                <CardTitle className="text-orange-900">{t('home.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => navigate('/test')} 
                  className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {t('home.startTest')}
                </Button>
                
                <Button 
                  onClick={() => navigate('/simulacro')} 
                  className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {t('home.simulation')}
                </Button>

                <Button 
                  onClick={() => navigate('/test-personalidad')} 
                  className="w-full justify-start bg-green-600 hover:bg-green-700 text-white"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  {t('home.personalityTest')}
                </Button>
                
                <Button 
                  onClick={() => navigate('/donacion')} 
                  className="w-full justify-start bg-pink-600 hover:bg-pink-700 text-white"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  {t('home.supportProject')}
                </Button>

                {isSuperAdmin && (
                  <Button 
                    onClick={() => navigate('/crear-test')} 
                    className="w-full justify-start bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {t('home.generateTestAdmin')}
                  </Button>
                )}

                {(isAdmin || (!isSuperAdmin && !isAdmin)) && (
                  <Button 
                    onClick={() => navigate('/estadisticas')} 
                    className="w-full justify-start bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {t('home.viewProgress')}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* User Info */}
            <Card className="bg-white shadow-md border-blue-100">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-white">
                <CardTitle className="text-blue-900">{t('home.yourInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-blue-700">{t('home.user')}</p>
                  <p className="text-gray-800 font-medium">{user?.username}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-700">{t('home.level')}</p>
                  <Badge className="bg-blue-600 text-white font-bold">{user?.nivel}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
