import { useState, useEffect } from 'react';
import { flashcardService, FlashcardStats } from '@/services/flashcardService';
import { useAuth } from '@/contexts/AuthContext';

export function useFlashcardStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const result = await flashcardService.getStats(user.id);
      if (result) {
        setStats(result);
        setPendingCount(result.pending || 0);
      }
    } catch (error) {
      console.error('Error fetching flashcard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user?.id]);

  return {
    stats,
    pendingCount,
    loading,
    refetch: fetchStats,
  };
}
