import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const {
    login,
    isAuthenticated,
    userType
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) {
      if (userType === 'admin') {
        navigate('/admin');
      } else {
        navigate('/coordinator');
      }
    }
  }, [isAuthenticated, userType, navigate]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: 'Preencha todos os campos',
        variant: 'destructive'
      });
      return;
    }
    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (success) {
        toast({
          title: 'Login realizado com sucesso!'
        });
      } else {
        toast({
          title: 'Login inválido',
          description: 'Verifique suas credenciais e tente novamente.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Erro ao fazer login',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="p-3 bg-primary rounded-2xl">
              
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Bem-vindo</CardTitle>
            <CardDescription className="text-base mt-2">
              Sistema de Confirmação de Disciplinas
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Login</Label>
              <Input id="username" type="text" placeholder="Seu login" value={username} onChange={e => setUsername(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </> : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>;
};
export default Login;