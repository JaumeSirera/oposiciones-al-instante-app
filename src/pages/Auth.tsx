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
  const { t } = useTranslation();

  const state = location.state as { from?: { pathname?: string } } | null;
  const from = state?.from?.pathname || '/dashboard';

  const [isLoading, setIsLoading] = useState(false);
  const [showRecoverDialog, setShowRecoverDialog] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');

  const siteUrl = import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://oposiciones-test.com');
  const canonical = useMemo(() => `${siteUrl}/auth`, [siteUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({ title: t('common.error'), description: t('authPage.errors.fillAllFields'), variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const result = await login(loginEmail, loginPassword, rememberMe);
    setIsLoading(false);
    if (result.success) {
      toast({ title: t('authPage.success.welcome'), description: t('authPage.success.loginSuccess') });
      navigate(from, { replace: true });
    } else {
      toast({ title: t('common.error'), description: result.error || t('authPage.errors.invalidCredentials'), variant: 'destructive' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerUsername || !registerEmail || !registerPassword || !registerPasswordConfirm) {
      toast({ title: t('common.error'), description: t('authPage.errors.fillAllFields'), variant: 'destructive' });
      return;
    }
    if (registerPassword !== registerPasswordConfirm) {
      toast({ title: t('common.error'), description: t('authPage.errors.passwordsNoMatch'), variant: 'destructive' });
      return;
    }
    if (registerPassword.length < 6) {
      toast({ title: t('common.error'), description: t('authPage.errors.passwordMinLength'), variant: 'destructive' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerEmail)) {
      toast({ title: t('common.error'), description: t('authPage.errors.invalidEmail'), variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const result = await register(registerUsername, registerEmail, registerPassword);
    setIsLoading(false);
    if (result.success) {
      toast({ title: t('authPage.success.registerSuccess'), description: t('authPage.success.accountCreated') });
      navigate('/dashboard', { replace: true });
    } else {
      toast({ title: t('common.error'), description: result.error || t('authPage.errors.couldNotCreateAccount'), variant: 'destructive' });
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail) {
      toast({ title: t('common.error'), description: t('authPage.errors.enterEmail'), variant: 'destructive' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recoverEmail)) {
      toast({ title: t('common.error'), description: t('authPage.errors.invalidEmail'), variant: 'destructive' });
      return;
    }
    setIsRecovering(true);
    const result = await authService.recoverPassword(recoverEmail);
    setIsRecovering(false);
    if (result.success) {
      toast({ title: t('authPage.success.emailSent'), description: t('authPage.success.checkEmail') });
      setShowRecoverDialog(false);
      setRecoverEmail('');
    } else {
      toast({ title: t('common.error'), description: result.error || t('authPage.errors.couldNotSendRecovery'), variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-background dark:via-background dark:to-background flex items-center justify-center p-4">
      <Helmet>
        <title>{t('authPage.title')}</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BookOpen className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold">
            <span className="text-blue-600 dark:text-blue-400">Oposiciones-</span>
            <span className="text-green-600 dark:text-green-400">Test</span>
          </h1>
          <p className="text-muted-foreground mt-2">{t('authPage.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('authPage.accessAccount')}</CardTitle>
            <CardDescription>{t('authPage.accessDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t('authPage.loginTab')}</TabsTrigger>
                <TabsTrigger value="register">{t('authPage.registerTab')}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('authPage.email')}</Label>
                    <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder={t('authPage.emailPlaceholder')} value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} disabled={isLoading} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t('authPage.password')}</Label>
                    <Input id="password" name="password" type="password" autoComplete="current-password" placeholder={t('authPage.passwordPlaceholder')} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} disabled={isLoading} required />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(!!checked)} disabled={isLoading} />
                      <label htmlFor="remember" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('authPage.rememberMe')}</label>
                    </div>
                    <button type="button" onClick={() => setShowRecoverDialog(true)} className="text-sm text-blue-600 hover:text-blue-700 hover:underline" disabled={isLoading}>{t('authPage.forgotPassword')}</button>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('authPage.loggingIn')}</>) : t('authPage.loginButton')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">{t('authPage.username')}</Label>
                    <Input id="username" name="username" type="text" autoComplete="username" placeholder={t('authPage.usernamePlaceholder')} value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} disabled={isLoading} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">{t('authPage.email')}</Label>
                    <Input id="register-email" name="register-email" type="email" inputMode="email" autoComplete="email" placeholder={t('authPage.emailPlaceholder')} value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} disabled={isLoading} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">{t('authPage.password')}</Label>
                    <Input id="register-password" name="new-password" type="password" autoComplete="new-password" placeholder={t('authPage.passwordPlaceholder')} value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} disabled={isLoading} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password-confirm">{t('authPage.confirmPassword')}</Label>
                    <Input id="register-password-confirm" name="new-password-confirm" type="password" autoComplete="new-password" placeholder={t('authPage.passwordPlaceholder')} value={registerPasswordConfirm} onChange={(e) => setRegisterPasswordConfirm(e.target.value)} disabled={isLoading} required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('authPage.creatingAccount')}</>) : t('authPage.registerButton')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={showRecoverDialog} onOpenChange={setShowRecoverDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('authPage.recoverTitle')}</DialogTitle>
              <DialogDescription>{t('authPage.recoverDescription')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRecover} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recover-email">{t('authPage.email')}</Label>
                <Input id="recover-email" type="email" inputMode="email" autoComplete="email" placeholder={t('authPage.emailPlaceholder')} value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} disabled={isRecovering} required />
              </div>
              <Button type="submit" className="w-full" disabled={isRecovering}>
                {isRecovering ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('authPage.sending')}</>) : t('authPage.sendRecoveryLink')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Auth;