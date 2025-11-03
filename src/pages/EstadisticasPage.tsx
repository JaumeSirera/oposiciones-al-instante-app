import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import StatsPanel from '@/components/StatsPanel';
import { useAuth } from '@/contexts/AuthContext';

const EstadisticasPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userStats, setUserStats] = useState({
    totalQuestions: 0,
    correctAnswers: 0,
    averageTime: 0,
    streakCount: 0
  });

  useEffect(() => {
    const cargarEstadisticas = async () => {
      if (!user?.id) return;
      
      try {
        const ts = Date.now().toString();
        const response = await fetch(
          `https://oposiciones-test.com/api/estadisticas_usuario.php?user_id=${user.id}&_ts=${ts}`,
          { cache: 'no-store' }
        );
        const data = await response.json();
        
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
      }
    };

    cargarEstadisticas();
  }, [user?.id]);

  return <StatsPanel stats={userStats} onBack={() => navigate('/')} />;
};

export default EstadisticasPage;
