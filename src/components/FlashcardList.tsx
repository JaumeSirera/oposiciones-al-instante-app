import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  MoreVertical,
  Loader2
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
import { es, enUS, fr, de, pt } from 'date-fns/locale';
import { useTranslateContent } from '@/hooks/useTranslateContent';

interface TranslatedFlashcard extends Flashcard {
  translatedFront?: string;
  translatedBack?: string;
  translatedCategory?: string;
}

interface FlashcardListProps {
  userId: number;
  onUpdate?: () => void;
}

export default function FlashcardList({ userId, onUpdate }: FlashcardListProps) {
  const { t, i18n } = useTranslation();
  const { translateTexts, isTranslating, needsTranslation } = useTranslateContent();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [translatedCards, setTranslatedCards] = useState<TranslatedFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [editForm, setEditForm] = useState({ front: '', back: '', category: '', tags: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get date locale based on current language
  const getDateLocale = () => {
    const locales: { [key: string]: typeof es } = { es, en: enUS, fr, de, pt };
    return locales[i18n.language] || es;
  };

  useEffect(() => {
    loadFlashcards();
  }, [userId, page]);

  // Translate flashcards when loaded or language changes
  useEffect(() => {
    const translateCards = async () => {
      if (!needsTranslation || flashcards.length === 0) {
        setTranslatedCards(flashcards);
        return;
      }

      // Collect all texts to translate
      const textsToTranslate: string[] = [];
      flashcards.forEach(card => {
        textsToTranslate.push(card.front);
        textsToTranslate.push(card.back);
        if (card.category) textsToTranslate.push(card.category);
      });

      try {
        const translated = await translateTexts(textsToTranslate);
        
        // Map translations back to cards
        let idx = 0;
        const newTranslatedCards: TranslatedFlashcard[] = flashcards.map(card => {
          const translatedFront = translated[idx++];
          const translatedBack = translated[idx++];
          const translatedCategory = card.category ? translated[idx++] : undefined;
          return {
            ...card,
            translatedFront,
            translatedBack,
            translatedCategory,
          };
        });
        
        setTranslatedCards(newTranslatedCards);
      } catch (error) {
        console.error('Error translating flashcards:', error);
        setTranslatedCards(flashcards);
      }
    };

    translateCards();
  }, [flashcards, needsTranslation, i18n.language]);

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
      toast.error(t('flashcards.loadError2'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('flashcards.deleteConfirm'))) return;

    try {
      const result = await flashcardService.deleteFlashcard(id, userId);
      if (result.success) {
        toast.success(t('flashcards.deleted'));
        loadFlashcards();
        onUpdate?.();
      } else {
        toast.error(t('flashcards.deleteError'));
      }
    } catch (error) {
      toast.error(t('flashcards.deleteError'));
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
        toast.success(t('flashcards.updated'));
        setEditingCard(null);
        loadFlashcards();
        onUpdate?.();
      } else {
        toast.error(result.error || t('flashcards.updateError'));
      }
    } catch (error) {
      toast.error(t('flashcards.updateError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use translated cards for display and filtering
  const displayCards = translatedCards.length > 0 ? translatedCards : flashcards;

  const filteredCards = displayCards.filter(card => {
    const translatedCard = card as TranslatedFlashcard;
    const front = translatedCard.translatedFront || card.front;
    const back = translatedCard.translatedBack || card.back;
    const category = translatedCard.translatedCategory || card.category;
    
    return front.toLowerCase().includes(search.toLowerCase()) ||
      back.toLowerCase().includes(search.toLowerCase()) ||
      (category && category.toLowerCase().includes(search.toLowerCase()));
  });

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
          placeholder={t('flashcards.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
        {isTranslating && needsTranslation && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
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
              {search ? t('flashcards.noFlashcardsFound') : t('flashcards.noFlashcardsYet')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCards.map((card) => {
            const translatedCard = card as TranslatedFlashcard;
            return (
              <Card key={card.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className={`h-2 w-2 rounded-full ${getProgressColor(card.repetitions)}`}
                          title={`${card.repetitions} ${t('flashcards.repetitions')}`}
                        />
                        <p className="font-medium line-clamp-1">
                          {translatedCard.translatedFront || card.front}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                        {translatedCard.translatedBack || card.back}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {card.category && (
                          <Badge variant="secondary" className="text-xs">
                            {translatedCard.translatedCategory || card.category}
                          </Badge>
                        )}
                        {card.next_review && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(card.next_review), 'd MMM', { locale: getDateLocale() })}
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
                          {t('flashcards.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(card.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('flashcards.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
            {t('flashcards.page', { current: page, total: totalPages })}
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
            <DialogTitle>{t('flashcards.editFlashcard')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('flashcards.questionFront')}</Label>
              <Textarea
                value={editForm.front}
                onChange={(e) => setEditForm(prev => ({ ...prev, front: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t('flashcards.answerBack')}</Label>
              <Textarea
                value={editForm.back}
                onChange={(e) => setEditForm(prev => ({ ...prev, back: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('flashcards.category')}</Label>
                <Input
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('flashcards.tags')}</Label>
                <Input
                  value={editForm.tags}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCard(null)}>
              {t('flashcards.cancel')}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {t('flashcards.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}