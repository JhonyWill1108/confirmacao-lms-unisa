import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import CoordinatorDashboard from '@/components/dashboard/CoordinatorDashboard';
import { Loader2 } from 'lucide-react';

const CoordinatorPage = () => {
  const { isAuthenticated, userType } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (userType === 'admin') {
      navigate('/admin');
    }
  }, [isAuthenticated, userType, navigate]);

  if (!isAuthenticated || userType !== 'coordinator') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <CoordinatorDashboard />;
};

export default CoordinatorPage;
