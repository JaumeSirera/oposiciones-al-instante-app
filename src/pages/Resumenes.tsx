import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Search, ArrowLeft, Calendar, BookOpen, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Resumen {
  id: number;
  tema: string;
  seccion: string;
  archivo_nombre: string;
  archivo_tipo: string;
  archivo_tamano: number;
  resumen: string;
  fecha: string;
}

export default function Resumenes() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [resumenes, setResumenes] = useState<Resumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeccion, setFilterSeccion] = useState<string>('all');

  useEffect(() => {
    cargarResumenes();
  }, [user]);

  const cargarResumenes = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://oposiciones-test.com/api/listar_resumenes.php?id_usuario=${user.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error(t('summaries.errorLoading'));
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.resumenes)) {
        setResumenes(data.resumenes);
      } else if (Array.isArray(data)) {
        setResumenes(data);
      } else {
        throw new Error(data.error || t('summaries.invalidResponse'));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message || t('summaries.couldNotLoad')
      });
      setResumenes([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (fecha: string) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;
    return new Intl.DateTimeFormat(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '-';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const secciones = ['all', ...new Set(resumenes.map(r => r.seccion).filter(Boolean))];

  const filteredResumenes = resumenes.filter(resumen => {
    const matchesSearch = searchQuery === '' || 
      resumen.tema?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resumen.seccion?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resumen.resumen?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeccion = filterSeccion === 'all' || resumen.seccion === filterSeccion;
    
    return matchesSearch && matchesSeccion;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('summaries.backToHome')}
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('summaries.mySummaries')}</h1>
              <p className="text-gray-600">
                {resumenes.length} {resumenes.length === 1 ? t('summaries.summarySaved') : t('summaries.summariesSaved')}
              </p>
            </div>
            <Button onClick={() => navigate('/crear-resumen')}>
              <FileText className="w-4 h-4 mr-2" />
              {t('summaries.create')}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={t('summaries.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {secciones.length > 1 && (
                <div className="w-full overflow-x-auto">
                  <Tabs value={filterSeccion} onValueChange={setFilterSeccion}>
                    <TabsList className="inline-flex w-auto min-w-full flex-nowrap">
                      {secciones.map(seccion => (
                        <TabsTrigger 
                          key={seccion} 
                          value={seccion}
                          className="whitespace-nowrap flex-shrink-0"
                        >
                          {seccion === 'all' ? t('summaries.all') : seccion}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de resúmenes */}
        {filteredResumenes.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {searchQuery || filterSeccion !== 'all' 
                  ? t('summaries.noSummariesFound') 
                  : t('summaries.noSummariesYet')}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || filterSeccion !== 'all'
                  ? t('summaries.tryOtherTerms')
                  : t('summaries.startCreating')}
              </p>
              {(searchQuery || filterSeccion !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterSeccion('all');
                  }}
                >
                  {t('summaries.clearFilters')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            {filteredResumenes.map((resumen) => (
              <Card
                key={resumen.id}
                className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden flex flex-col"
                onClick={() => navigate(`/resumenes/${resumen.id}`)}
              >
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="flex items-start gap-2">
                    <BookOpen className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <span className="line-clamp-2 break-words">{resumen.tema || t('summaries.noTitle')}</span>
                  </CardTitle>
                  {resumen.seccion && (
                    <CardDescription className="font-medium line-clamp-1">
                      {resumen.seccion}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3 break-words">
                    {resumen.resumen || t('summaries.noContent')}
                  </p>
                  
                  <div className="space-y-2 text-xs text-gray-500">
                    {resumen.archivo_nombre && (
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {resumen.archivo_nombre}
                          {resumen.archivo_tamano && ` (${formatFileSize(resumen.archivo_tamano)})`}
                        </span>
                      </div>
                    )}
                    {resumen.fecha && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span className="whitespace-nowrap">{formatDate(resumen.fecha)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
