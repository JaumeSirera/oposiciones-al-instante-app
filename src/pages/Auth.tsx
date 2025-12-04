import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authService } from '@/services/authService';
import { LanguageSelector } from '@/components/LanguageSelector';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();

  // Si veníamos de una ruta protegida, volver ahí; si no, ir al dashboard
  const state = location.state as { from?: { pathname?: string } } | null;
  const from = state?.from?.pathname || '/dashboard';

  const [isLoading, setIsLoading] = useState(false);
  const [showRecoverDialog, setShowRecoverDialog] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Register form
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');

  // Canonical absoluta
  const siteUrl =
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://oposiciones-test.com');
  const canonical = useMemo(() => `${siteUrl}/auth`, [siteUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      toast({
        title: 'Error',
        description: 'Por favor, completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await login(loginEmail, loginPassword, rememberMe);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: '¡Bienvenido!',
        description: 'Has iniciado sesión correctamente',
      });
      navigate(from, { replace: true });
    } else {
      toast({
        title: 'Error al iniciar sesión',
        description: result.error || 'Credenciales incorrectas',
        variant: 'destructive',
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!registerUsername || !registerEmail || !registerPassword || !registerPasswordConfirm) {
      toast({
        title: 'Error',
        description: 'Por favor, completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    if (registerPassword !== registerPasswordConfirm) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden',
        variant: 'destructive',
      });
      return;
    }

    if (registerPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerEmail)) {
      toast({
        title: 'Error',
        description: 'Por favor, introduce un email válido',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await register(registerUsername, registerEmail, registerPassword);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: '¡Registro exitoso!',
        description: 'Tu cuenta ha sido creada correctamente',
      });
      navigate('/dashboard', { replace: true });
    } else {
      toast({
        title: 'Error al registrarse',
        description: result.error || 'No se pudo crear la cuenta',
        variant: 'destructive',
      });
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoverEmail) {
      toast({
        title: 'Error',
        description: 'Por favor, introduce tu email',
        variant: 'destructive',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recoverEmail)) {
      toast({
        title: 'Error',
        description: 'Por favor, introduce un email válido',
        variant: 'destructive',
      });
      return;
    }

    setIsRecovering(true);
    const result = await authService.recoverPassword(recoverEmail);
    setIsRecovering(false);

    if (result.success) {
      toast({
        title: 'Email enviado',
        description: 'Revisa tu correo para restablecer tu contraseña',
      });
      setShowRecoverDialog(false);
      setRecoverEmail('');
    } else {
      toast({
        title: 'Error',
        description: result.error || 'No se pudo enviar el email de recuperación',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <Helmet>
        <title>Acceso Alumnos | Oposiciones-Tests</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href={canonical} />
      </Helmet>

      {/* Language selector */}
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

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
          <p className="text-gray-600 mt-2">Prepara tus oposiciones con éxito</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accede a tu cuenta</CardTitle>
            <CardDescription>Inicia sesión o crea una cuenta nueva para comenzar</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="register">Registrarse</TabsTrigger>
              </TabsList>

              {/* LOGIN */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                        disabled={isLoading}
                      />
                      <label
                        htmlFor="remember"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Recordarme
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRecoverDialog(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                      disabled={isLoading}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      'Iniciar Sesión'
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* REGISTER */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Nombre de usuario</Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="TuNombre"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      name="register-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tu@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      id="register-password"
                      name="new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password-confirm">Confirmar Contraseña</Label>
                    <Input
                      id="register-password-confirm"
                      name="new-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={registerPasswordConfirm}
                      onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      'Crear Cuenta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Diálogo de recuperación de contraseña */}
        <Dialog open={showRecoverDialog} onOpenChange={setShowRecoverDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recuperar contraseña</DialogTitle>
              <DialogDescription>
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecover} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recover-email">Email</Label>
                <Input
                  id="recover-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  disabled={isRecovering}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isRecovering}>
                {isRecovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar enlace de recuperación'
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Auth;
