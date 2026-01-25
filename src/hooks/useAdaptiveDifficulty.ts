import { useState, useCallback, useMemo } from 'react';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface AdaptiveDifficultyState {
  currentLevel: DifficultyLevel;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  totalCorrect: number;
  totalWrong: number;
  levelHistory: DifficultyLevel[];
}

interface UseAdaptiveDifficultyReturn {
  currentLevel: DifficultyLevel;
  levelHistory: DifficultyLevel[];
  stats: {
    totalCorrect: number;
    totalWrong: number;
    consecutiveCorrect: number;
    consecutiveWrong: number;
  };
  recordAnswer: (isCorrect: boolean) => void;
  reset: () => void;
  getLevelColor: () => string;
  getLevelBgColor: () => string;
  getLevelIcon: () => string;
}

const initialState: AdaptiveDifficultyState = {
  currentLevel: 'medium',
  consecutiveCorrect: 0,
  consecutiveWrong: 0,
  totalCorrect: 0,
  totalWrong: 0,
  levelHistory: ['medium'],
};

// Thresholds for difficulty changes
const INCREASE_THRESHOLD = 3; // 3 consecutive correct answers to increase difficulty
const DECREASE_THRESHOLD = 2; // 2 consecutive wrong answers to decrease difficulty

export const useAdaptiveDifficulty = (): UseAdaptiveDifficultyReturn => {
  const [state, setState] = useState<AdaptiveDifficultyState>(initialState);

  const recordAnswer = useCallback((isCorrect: boolean) => {
    setState((prev) => {
      let newLevel = prev.currentLevel;
      let newConsecutiveCorrect = isCorrect ? prev.consecutiveCorrect + 1 : 0;
      let newConsecutiveWrong = isCorrect ? 0 : prev.consecutiveWrong + 1;

      // Check if we should increase difficulty
      if (newConsecutiveCorrect >= INCREASE_THRESHOLD) {
        if (prev.currentLevel === 'easy') {
          newLevel = 'medium';
        } else if (prev.currentLevel === 'medium') {
          newLevel = 'hard';
        }
        // Reset consecutive counter after level change
        if (newLevel !== prev.currentLevel) {
          newConsecutiveCorrect = 0;
        }
      }

      // Check if we should decrease difficulty
      if (newConsecutiveWrong >= DECREASE_THRESHOLD) {
        if (prev.currentLevel === 'hard') {
          newLevel = 'medium';
        } else if (prev.currentLevel === 'medium') {
          newLevel = 'easy';
        }
        // Reset consecutive counter after level change
        if (newLevel !== prev.currentLevel) {
          newConsecutiveWrong = 0;
        }
      }

      const newLevelHistory = newLevel !== prev.currentLevel
        ? [...prev.levelHistory, newLevel]
        : prev.levelHistory;

      return {
        currentLevel: newLevel,
        consecutiveCorrect: newConsecutiveCorrect,
        consecutiveWrong: newConsecutiveWrong,
        totalCorrect: prev.totalCorrect + (isCorrect ? 1 : 0),
        totalWrong: prev.totalWrong + (isCorrect ? 0 : 1),
        levelHistory: newLevelHistory,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const getLevelColor = useCallback((): string => {
    switch (state.currentLevel) {
      case 'easy':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400';
      case 'hard':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  }, [state.currentLevel]);

  const getLevelBgColor = useCallback((): string => {
    switch (state.currentLevel) {
      case 'easy':
        return 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700';
      case 'hard':
        return 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700';
      default:
        return 'bg-muted border-border';
    }
  }, [state.currentLevel]);

  const getLevelIcon = useCallback((): string => {
    switch (state.currentLevel) {
      case 'easy':
        return '🟢';
      case 'medium':
        return '🟡';
      case 'hard':
        return '🔴';
      default:
        return '⚪';
    }
  }, [state.currentLevel]);

  const stats = useMemo(() => ({
    totalCorrect: state.totalCorrect,
    totalWrong: state.totalWrong,
    consecutiveCorrect: state.consecutiveCorrect,
    consecutiveWrong: state.consecutiveWrong,
  }), [state.totalCorrect, state.totalWrong, state.consecutiveCorrect, state.consecutiveWrong]);

  return {
    currentLevel: state.currentLevel,
    levelHistory: state.levelHistory,
    stats,
    recordAnswer,
    reset,
    getLevelColor,
    getLevelBgColor,
    getLevelIcon,
  };
};
