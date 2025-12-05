import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';
import { LanguageSelector } from '@/components/LanguageSelector';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');

    if (!tokenParam || !emailParam) {
      toast({ title: t('common.error'), description: t('resetPasswordPage.errors.invalidLink'), variant: 'destructive' });
      navigate('/auth');
      return;
    }

    setToken(tokenParam);
    setEmail(emailParam);
  }, [searchParams, navigate, toast, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast({ title: t('common.error'), description: t('resetPasswordPage.errors.fillAllFields'), variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: t('common.error'), description: t('resetPasswordPage.errors.passwordsNoMatch'), variant: 'destructive' });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: t('common.error'), description: t('resetPasswordPage.errors.passwordMinLength'), variant: 'destructive' });
      return;
    }

    if (!token || !email) {
      toast({ title: t('common.error'), description: t('resetPasswordPage.errors.invalidToken'), variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const result = await authService.resetPassword(token, email, newPassword);
    setIsLoading(false);

    if (result.success) {
      toast({ title: t('resetPasswordPage.success.passwordUpdated'), description: t('resetPasswordPage.success.passwordResetSuccess') });
      navigate('/auth');
    } else {
      toast({ title: t('common.error'), description: result.error || t('resetPasswordPage.errors.couldNotReset'), variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <Helmet>
        <title>{t('resetPasswordPage.title')}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BookOpen className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold">
            <span className="text-blue-600">Oposiciones-</span>
            <span className="text-green-600">Test</span>
          </h1>
          <p className="text-gray-600 mt-2">{t('resetPasswordPage.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('resetPasswordPage.newPassword')}</CardTitle>
            <CardDescription>{t('resetPasswordPage.newPasswordLabel')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('resetPasswordPage.newPasswordLabel')}</Label>
                <Input id="new-password" name="new-password" type="password" autoComplete="new-password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('resetPasswordPage.confirmPassword')}</Label>
                <Input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} required minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('resetPasswordPage.resetting')}</>) : t('resetPasswordPage.resetButton')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;