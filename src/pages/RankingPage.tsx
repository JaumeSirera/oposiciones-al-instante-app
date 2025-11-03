import { useNavigate } from 'react-router-dom';
import Ranking from '@/components/Ranking';

const RankingPage = () => {
  const navigate = useNavigate();
  return <Ranking onBack={() => navigate('/')} />;
};

export default RankingPage;
