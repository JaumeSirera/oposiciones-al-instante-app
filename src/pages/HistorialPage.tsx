import { useNavigate } from 'react-router-dom';
import HistorialTests from '@/components/HistorialTests';

const HistorialPage = () => {
  const navigate = useNavigate();
  return <HistorialTests onBack={() => navigate('/')} />;
};

export default HistorialPage;
