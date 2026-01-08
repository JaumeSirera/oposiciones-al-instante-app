import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  RotateCcw, 
  ThumbsDown, 
  Meh, 
  ThumbsUp, 
  Sparkles,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { Flashcard, flashcardService } from '@/services/flashcardService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FlashcardReviewProps {
  flashcards: Flashcard[];
  userId: number;
  onComplete: () => void;
  onExit: () => void;
}

export default function FlashcardReview({ 
  flashcards, 
  userId, 
  onComplete, 
  onExit 
}: FlashcardReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  const currentCard = flashcards[currentIndex];
  const progress = (reviewed / flashcards.length) * 100;

  const handleFlip = () => {
    if (!isAnimating) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleResponse = async (quality: number) => {
    if (isAnimating || !currentCard) return;

    setIsAnimating(true);

    try {
      await flashcardService.reviewFlashcard(userId, currentCard.id, quality);
      
      setReviewed(prev => prev + 1);
      if (quality >= 3) {
        setCorrect(prev => prev + 1);
      }

      // Animación de salida
      setTimeout(() => {
        if (currentIndex < flashcards.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setIsFlipped(false);
        } else {
          setSessionComplete(true);
        }
        setIsAnimating(false);
      }, 300);

    } catch (error) {
      console.error('Error registering review:', error);
      toast.error('Error al registrar la respuesta');
      setIsAnimating(false);
    }
  };

  // Respuestas con calidad SM-2
  const responseButtons = [
    { quality: 0, label: 'No lo sé', icon: ThumbsDown, color: 'text-red-500 hover:bg-red-500/10' },
    { quality: 2, label: 'Difícil', icon: Meh, color: 'text-orange-500 hover:bg-orange-500/10' },
    { quality: 4, label: 'Bien', icon: ThumbsUp, color: 'text-green-500 hover:bg-green-500/10' },
    { quality: 5, label: '¡Fácil!', icon: Sparkles, color: 'text-blue-500 hover:bg-blue-500/10' },
  ];

  if (sessionComplete) {
    const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;
    
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle2 className="h-20 w-20 mx-auto text-green-500 mb-6" />
            <h2 className="text-2xl font-bold mb-2">¡Sesión completada!</h2>
            <p className="text-muted-foreground mb-6">
              Has revisado todas las tarjetas pendientes
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{reviewed}</p>
                <p className="text-sm text-muted-foreground">Revisadas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{correct}</p>
                <p className="text-sm text-muted-foreground">Correctas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{accuracy}%</p>
                <p className="text-sm text-muted-foreground">Precisión</p>
              </div>
            </div>

            <Button onClick={onComplete} size="lg" className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentCard) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Salir
        </Button>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {flashcards.length}
          </span>
          <Badge variant="outline">
            {correct} correctas
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2 mb-8" />

      {/* Flashcard */}
      <div 
        className="perspective-1000 cursor-pointer mb-8"
        onClick={handleFlip}
      >
        <div
          className={cn(
            "relative w-full min-h-[300px] transition-transform duration-500 transform-style-preserve-3d",
            isFlipped && "rotate-y-180",
            isAnimating && "opacity-50"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <Card 
            className="absolute inset-0 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-8">
              {currentCard.category && (
                <Badge variant="secondary" className="mb-4">
                  {currentCard.category}
                </Badge>
              )}
              <p className="text-xl text-center leading-relaxed">
                {currentCard.front}
              </p>
              <p className="text-sm text-muted-foreground mt-6">
                Toca para ver la respuesta
              </p>
            </CardContent>
          </Card>

          {/* Back */}
          <Card 
            className="absolute inset-0 bg-primary/5 border-primary/20"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <CardContent className="flex flex-col items-center justify-center min-h-[300px] p-8">
              <p className="text-xl text-center leading-relaxed font-medium">
                {currentCard.back}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Response buttons - only show when flipped */}
      {isFlipped && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <p className="text-center text-sm text-muted-foreground mb-4">
            ¿Cómo de bien lo sabías?
          </p>
          
          <div className="grid grid-cols-4 gap-2">
            {responseButtons.map(({ quality, label, icon: Icon, color }) => (
              <Button
                key={quality}
                variant="outline"
                className={cn("flex-col h-auto py-4 gap-2", color)}
                onClick={() => handleResponse(quality)}
                disabled={isAnimating}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Flip hint when not flipped */}
      {!isFlipped && (
        <div className="text-center">
          <Button variant="outline" onClick={handleFlip} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Mostrar respuesta
          </Button>
        </div>
      )}
    </div>
  );
}
