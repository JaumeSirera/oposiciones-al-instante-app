import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');

    if (!tokenParam || !emailParam) {
      toast({
        title: 'Error',
        description: 'El enlace de recuperación no es válido',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setToken(tokenParam);
    setEmail(emailParam);
  }, [searchParams, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast({
        title: 'Error',
        description: 'Por favor, completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    if (!token || !email) {
      toast({
        title: 'Error',
        description: 'Token o email no válidos',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await authService.resetPassword(token, email, newPassword);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: '¡Contraseña actualizada!',
        description: 'Tu contraseña ha sido restablecida correctamente',
      });
      navigate('/auth');
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo restablecer la contraseña',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <Helmet>
        <title>Restablecer Contraseña | Oposiciones-Tests</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BookOpen className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold">
            <span className="text-blue-600">Oposiciones-</span>
            <span className="text-green-600">Test</span>
          </h1>
          <p className="text-gray-600 mt-2">Restablecer contraseña</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>Introduce tu nueva contraseña</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <Input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Restableciendo...
                  </>
                ) : (
                  'Restablecer Contraseña'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
