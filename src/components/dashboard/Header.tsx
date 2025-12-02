import { GraduationCap, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';

const Header = () => {
  const { userType, userData, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-xl">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Confirmação de Disciplinas</h1>
            <p className="text-xs text-muted-foreground">Pós-Graduação</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {userData && (
            <div className="text-sm text-right">
              <p className="font-medium">{userData.firstName} {userData.lastName}</p>
              <p className="text-muted-foreground">
                {userType === 'coordinator' ? 'Coordenador' : 'Administrador'}
              </p>
            </div>
          )}
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
