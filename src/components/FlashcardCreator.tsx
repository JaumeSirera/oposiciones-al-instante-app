import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Sparkles, Save } from 'lucide-react';
import { flashcardService } from '@/services/flashcardService';
import { toast } from 'sonner';

interface FlashcardCreatorProps {
  userId: number;
  onCreated?: () => void;
}

export default function FlashcardCreator({ userId, onCreated }: FlashcardCreatorProps) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!front.trim() || !back.trim()) {
      toast.error('Completa el frente y reverso de la tarjeta');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await flashcardService.createFlashcard({
        user_id: userId,
        front: front.trim(),
        back: back.trim(),
        category: category.trim() || undefined,
        tags: tags.trim() || undefined,
        source_type: 'manual',
      });

      if (result.success) {
        toast.success('Flashcard creada correctamente');
        setFront('');
        setBack('');
        setCategory('');
        setTags('');
        onCreated?.();
      } else {
        toast.error(result.error || 'Error al crear la flashcard');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear la flashcard');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdd = async () => {
    if (!front.trim() || !back.trim()) {
      toast.error('Completa el frente y reverso de la tarjeta');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await flashcardService.createFlashcard({
        user_id: userId,
        front: front.trim(),
        back: back.trim(),
        category: category.trim() || undefined,
        source_type: 'manual',
      });

      if (result.success) {
        toast.success('¡Añadida! Crea otra');
        setFront('');
        setBack('');
        // Mantener categoría para añadir varias del mismo tema
      } else {
        toast.error(result.error || 'Error al crear la flashcard');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear la flashcard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Crear nueva tarjeta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="front">Pregunta (frente)</Label>
              <Textarea
                id="front"
                placeholder="Escribe la pregunta o concepto..."
                value={front}
                onChange={(e) => setFront(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="back">Respuesta (reverso)</Label>
              <Textarea
                id="back"
                placeholder="Escribe la respuesta..."
                value={back}
                onChange={(e) => setBack(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  placeholder="Ej: Derecho Civil"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Etiquetas</Label>
                <Input
                  id="tags"
                  placeholder="Ej: contratos, obligaciones"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={handleQuickAdd}
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir y crear otra
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isSubmitting}
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Vista previa</h3>
        
        <Card className="min-h-[200px]">
          <CardContent className="flex items-center justify-center min-h-[200px] p-6">
            <p className="text-center text-lg">
              {front || <span className="text-muted-foreground italic">Pregunta...</span>}
            </p>
          </CardContent>
        </Card>

        <Card className="min-h-[200px] bg-primary/5 border-primary/20">
          <CardContent className="flex items-center justify-center min-h-[200px] p-6">
            <p className="text-center text-lg font-medium">
              {back || <span className="text-muted-foreground italic">Respuesta...</span>}
            </p>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Consejos para buenas flashcards:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Una sola idea por tarjeta</li>
                  <li>• Preguntas claras y concisas</li>
                  <li>• Respuestas breves y precisas</li>
                  <li>• Usa ejemplos cuando ayuden</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
