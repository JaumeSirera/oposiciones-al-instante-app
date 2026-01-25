import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import type { DifficultyLevel } from '@/hooks/useAdaptiveDifficulty';

interface DifficultyIndicatorProps {
  currentLevel: DifficultyLevel;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  previousLevel?: DifficultyLevel;
  showStreak?: boolean;
}

const DifficultyIndicator: React.FC<DifficultyIndicatorProps> = ({
  currentLevel,
  consecutiveCorrect,
  consecutiveWrong,
  previousLevel,
  showStreak = true,
}) => {
  const { t } = useTranslation();

  const levelConfig = {
    easy: {
      label: t('quiz.difficultyEasy'),
      color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
      icon: '🟢',
      gradient: 'from-green-500 to-emerald-500',
    },
    medium: {
      label: t('quiz.difficultyMedium'),
      color: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
      icon: '🟡',
      gradient: 'from-amber-500 to-orange-500',
    },
    hard: {
      label: t('quiz.difficultyHard'),
      color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
      icon: '🔴',
      gradient: 'from-red-500 to-rose-500',
    },
  };

  const config = levelConfig[currentLevel];
  const levelChanged = previousLevel && previousLevel !== currentLevel;
  const levelIncreased = levelChanged && (
    (previousLevel === 'easy' && currentLevel !== 'easy') ||
    (previousLevel === 'medium' && currentLevel === 'hard')
  );

  // Progress towards next level change
  const progressToNextLevel = consecutiveCorrect > 0 
    ? (consecutiveCorrect / 3) * 100 
    : consecutiveWrong > 0 
      ? (consecutiveWrong / 2) * 100 
      : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`${config.color} border font-semibold transition-all duration-300 ${levelChanged ? 'animate-pulse scale-110' : ''}`}
            >
              <span className="mr-1.5">{config.icon}</span>
              <span className="hidden sm:inline">{config.label}</span>
              <span className="sm:hidden">{config.label.charAt(0)}</span>
              {levelChanged && (
                <span className="ml-1.5">
                  {levelIncreased ? (
                    <TrendingUp className="w-3 h-3 inline text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 inline text-red-600 dark:text-red-400" />
                  )}
                </span>
              )}
            </Badge>
            
            {/* Streak indicator */}
            {showStreak && (consecutiveCorrect > 0 || consecutiveWrong > 0) && (
              <div className="flex items-center gap-1">
                {consecutiveCorrect > 0 && (
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 text-xs px-1.5 py-0.5">
                    <Zap className="w-3 h-3 mr-0.5" />
                    {consecutiveCorrect}
                  </Badge>
                )}
                {consecutiveWrong > 0 && (
                  <Badge variant="outline" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 text-xs px-1.5 py-0.5">
                    <Minus className="w-3 h-3 mr-0.5" />
                    {consecutiveWrong}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-sm space-y-1">
            <p className="font-semibold">{t('quiz.difficultyAdaptive')}</p>
            <p className="text-muted-foreground text-xs">
              {currentLevel === 'easy' && '3 aciertos seguidos → Nivel Medio'}
              {currentLevel === 'medium' && '3 aciertos → Difícil | 2 fallos → Fácil'}
              {currentLevel === 'hard' && '2 fallos seguidos → Nivel Medio'}
            </p>
            {/* Progress bar */}
            <div className="mt-2">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 bg-gradient-to-r ${
                    consecutiveCorrect > 0 ? 'from-green-500 to-emerald-500' : 'from-red-500 to-rose-500'
                  }`}
                  style={{ width: `${Math.min(progressToNextLevel, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default DifficultyIndicator;
