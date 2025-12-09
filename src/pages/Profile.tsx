import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Save, Trash2, Lock, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Profile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('profile.fillAllFields'),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('profile.passwordsNoMatch'),
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('profile.passwordMinLength'),
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('https://oposiciones-test.com/api/actualizar_perfil.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: user?.username || '',
          telefono: '',
          nueva_password: newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: t('profile.passwordUpdated'),
          description: t('profile.passwordUpdatedDesc'),
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast({
          title: t('common.error'),
          description: data.error || t('profile.couldNotUpdatePassword'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('profile.connectionError'),
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      const userId = user?.id;
      const response = await fetch('https://oposiciones-test.com/api/eliminar_usuario.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: t('profile.accountDeleted'),
          description: t('profile.accountDeletedDesc'),
        });
        localStorage.clear();
        navigate('/auth');
      } else {
        toast({
          title: t('common.error'),
          description: data.error || t('profile.couldNotDeleteAccount'),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('profile.connectionError'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>

        {/* User Info Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-blue-600 text-white text-2xl">
                  {user?.username?.slice(0, 2)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{user?.username}</CardTitle>
                <CardDescription className="text-base capitalize">{user?.nivel}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Change Password Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="mr-2 h-5 w-5" />
              {t('profile.changePassword')}
            </CardTitle>
            <CardDescription>
              {t('profile.changePasswordDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('profile.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('profile.enterCurrentPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('profile.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('profile.minCharacters')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('profile.confirmNewPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('profile.repeatNewPassword')}
              />
            </div>
            <Button 
              onClick={handleChangePassword} 
              disabled={isChangingPassword}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {isChangingPassword ? t('profile.updating') : t('profile.updatePassword')}
            </Button>
          </CardContent>
        </Card>

        {/* Donation Link */}
        <Card className="mb-8 border-pink-200">
          <CardHeader>
            <CardTitle className="flex items-center text-pink-600">
              <Heart className="mr-2 h-5 w-5" />
              {t('profile.supportProject')}
            </CardTitle>
            <CardDescription>
              {t('profile.supportProjectDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-pink-600 hover:bg-pink-700"
              onClick={() => navigate('/donacion')}
            >
              <Heart className="mr-2 h-4 w-4" />
              {t('profile.makeDonation')}
            </Button>
          </CardContent>
        </Card>

        {/* Privacy Policy Link */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('profile.privacyPolicy')}</CardTitle>
            <CardDescription>
              {t('profile.privacyPolicyDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/privacy-policy')}
            >
              {t('profile.viewPrivacyPolicy')}
            </Button>
          </CardContent>
        </Card>

        {/* Delete Account Card */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center">
              <Trash2 className="mr-2 h-5 w-5" />
              {t('profile.dangerZone')}
            </CardTitle>
            <CardDescription>
              {t('profile.dangerZoneDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isDeleting}>
                  {isDeleting ? t('profile.deleting') : t('profile.deleteAccountButton')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('profile.confirmDeleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('profile.confirmDeleteDesc')}
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>{t('profile.deleteItem1')}</li>
                      <li>{t('profile.deleteItem2')}</li>
                      <li>{t('profile.deleteItem3')}</li>
                      <li>{t('profile.deleteItem4')}</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {t('profile.confirmDelete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
