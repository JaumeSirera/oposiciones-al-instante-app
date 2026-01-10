import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Trash2, 
  Edit, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Flashcard, flashcardService } from '@/services/flashcardService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FlashcardListProps {
  userId: number;
  onUpdate?: () => void;
}

export default function FlashcardList({ userId, onUpdate }: FlashcardListProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editForm, setEditForm] = useState({ front: '', back: '', category: '', tags: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadFlashcards();
  }, [userId, page]);

  const loadFlashcards = async () => {
    setLoading(true);
    try {
      const result = await flashcardService.getFlashcards(userId, {
        page,
        limit: 20,
      });
      
      setFlashcards(result.flashcards);
      setTotalPages(result.pages);
    } catch (error) {
      console.error('Error loading flashcards:', error);
      toast.error('Error al cargar las flashcards');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;

    try {
      const result = await flashcardService.deleteFlashcard(id, userId);
      if (result.success) {
        toast.success('Flashcard eliminada');
        loadFlashcards();
        onUpdate?.();
      } else {
        toast.error('Error al eliminar');
      }
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleEdit = (card: Flashcard) => {
    setEditingCard(card);
    setEditForm({
      front: card.front,
      back: card.back,
      category: card.category || '',
      tags: card.tags || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCard) return;

    setIsSubmitting(true);
    try {
      const result = await flashcardService.updateFlashcard({
        id: editingCard.id,
        user_id: userId,
        front: editForm.front,
        back: editForm.back,
        category: editForm.category,
        tags: editForm.tags,
      });

      if (result.success) {
        toast.success('Flashcard actualizada');
        setEditingCard(null);
        loadFlashcards();
        onUpdate?.();
      } else {
        toast.error(result.error || 'Error al actualizar');
      }
    } catch (error) {
      toast.error('Error al actualizar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCards = flashcards.filter(card => 
    card.front.toLowerCase().includes(search.toLowerCase()) ||
    card.back.toLowerCase().includes(search.toLowerCase()) ||
    (card.category && card.category.toLowerCase().includes(search.toLowerCase()))
  );

  const getProgressColor = (repetitions: number) => {
    if (repetitions >= 5) return 'bg-green-500';
    if (repetitions >= 3) return 'bg-blue-500';
    if (repetitions >= 1) return 'bg-orange-500';
    return 'bg-gray-300';
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar flashcards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {search ? 'No se encontraron flashcards' : 'No tienes flashcards aún'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCards.map((card) => (
            <Card key={card.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className={`h-2 w-2 rounded-full ${getProgressColor(card.repetitions)}`}
                        title={`${card.repetitions} repeticiones`}
                      />
                      <p className="font-medium line-clamp-1">{card.front}</p>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                      {card.back}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {card.category && (
                        <Badge variant="secondary" className="text-xs">
                          {card.category}
                        </Badge>
                      )}
                      {card.next_review && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(card.next_review), 'd MMM', { locale: es })}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        EF: {Number(card.ease_factor || 2.5).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(card)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(card.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCard} onOpenChange={() => setEditingCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar flashcard</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pregunta (frente)</Label>
              <Textarea
                value={editForm.front}
                onChange={(e) => setEditForm(prev => ({ ...prev, front: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Respuesta (reverso)</Label>
              <Textarea
                value={editForm.back}
                onChange={(e) => setEditForm(prev => ({ ...prev, back: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Input
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Etiquetas</Label>
                <Input
                  value={editForm.tags}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCard(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
