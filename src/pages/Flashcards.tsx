import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Plus, 
  Play, 
  BarChart3, 
  Layers,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { flashcardService, Flashcard, FlashcardStats } from '@/services/flashcardService';
import FlashcardReview from '@/components/FlashcardReview';
import FlashcardCreator from '@/components/FlashcardCreator';
import FlashcardList from '@/components/FlashcardList';
import { toast } from 'sonner';

export default function Flashcards() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('study');
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [pendingCards, setPendingCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStudying, setIsStudying] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const [statsData, pending] = await Promise.all([
        flashcardService.getStats(user.id),
        flashcardService.getPendingFlashcards(user.id, 50),
      ]);
      
      setStats(statsData);
      setPendingCards(pending);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleStartStudy = () => {
    if (pendingCards.length === 0) {
      toast.info('¡No tienes tarjetas pendientes de revisar!');
      return;
    }
    setIsStudying(true);
  };

  const handleStudyComplete = () => {
    setIsStudying(false);
    loadData();
    toast.success('¡Sesión de estudio completada!');
  };

  const handleFlashcardCreated = () => {
    loadData();
    setActiveTab('study');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Inicia sesión para acceder a las flashcards</p>
      </div>
    );
  }

  if (isStudying && pendingCards.length > 0) {
    return (
      <FlashcardReview 
        flashcards={pendingCards}
        userId={user.id}
        onComplete={handleStudyComplete}
        onExit={() => setIsStudying(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Flashcards - Repetición Espaciada
          </h1>
          <p className="text-muted-foreground mt-1">Sistema SM-2 para memorización a largo plazo</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Layers className="h-5 w-5 text-blue-500" /><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total tarjetas</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-orange-500" /><div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">Pendientes hoy</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-500" /><div><p className="text-2xl font-bold">{stats.mastered}</p><p className="text-xs text-muted-foreground">Dominadas</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-purple-500" /><div><p className="text-2xl font-bold">{stats.accuracy}%</p><p className="text-xs text-muted-foreground">Precisión</p></div></div></CardContent></Card>
        </div>
      )}

      {pendingCards.length > 0 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><Sparkles className="h-6 w-6 text-primary" /></div>
                <div><h3 className="font-semibold text-lg">¡Tienes {pendingCards.length} tarjetas para revisar!</h3><p className="text-muted-foreground text-sm">Mantén tu racha de estudio activa</p></div>
              </div>
              <Button onClick={handleStartStudy} size="lg" className="gap-2"><Play className="h-5 w-5" />Comenzar repaso</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="study" className="gap-2"><Brain className="h-4 w-4" />Estudiar</TabsTrigger>
          <TabsTrigger value="create" className="gap-2"><Plus className="h-4 w-4" />Crear</TabsTrigger>
          <TabsTrigger value="manage" className="gap-2"><Layers className="h-4 w-4" />Gestionar</TabsTrigger>
        </TabsList>

        <TabsContent value="study" className="mt-6">
          {pendingCards.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" /><h3 className="text-xl font-semibold mb-2">¡Todo al día!</h3><p className="text-muted-foreground mb-6">No tienes tarjetas pendientes de revisar.</p><Button onClick={() => setActiveTab('create')} variant="outline"><Plus className="h-4 w-4 mr-2" />Crear nuevas tarjetas</Button></CardContent></Card>
          ) : (
            <Card><CardHeader><CardTitle className="text-lg">Próximas tarjetas a revisar</CardTitle></CardHeader><CardContent><div className="space-y-3">{pendingCards.slice(0, 5).map((card, idx) => (<div key={card.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div className="flex items-center gap-3"><span className="text-muted-foreground font-mono text-sm">#{idx + 1}</span><div><p className="font-medium line-clamp-1">{card.front}</p>{card.category && <Badge variant="outline" className="mt-1 text-xs">{card.category}</Badge>}</div></div><p className="text-sm text-muted-foreground">{card.repetitions === 0 ? 'Nueva' : `Rep: ${card.repetitions}`}</p></div>))}</div>{pendingCards.length > 5 && <p className="text-center text-muted-foreground text-sm mt-4">+{pendingCards.length - 5} tarjetas más</p>}</CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="create" className="mt-6"><FlashcardCreator userId={user.id} onCreated={handleFlashcardCreated} /></TabsContent>
        <TabsContent value="manage" className="mt-6"><FlashcardList userId={user.id} onUpdate={loadData} /></TabsContent>
      </Tabs>
    </div>
  );
}
