import React, { useState } from 'react';
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
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
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
          title: "¡Contraseña actualizada!",
          description: "Tu contraseña ha sido cambiada correctamente",
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo actualizar la contraseña",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor",
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
          title: "Cuenta eliminada",
          description: "Tu cuenta y todos tus datos han sido eliminados",
        });
        localStorage.clear();
        navigate('/auth');
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo eliminar la cuenta",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo conectar con el servidor",
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
          Volver
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
              Cambiar Contraseña
            </CardTitle>
            <CardDescription>
              Actualiza tu contraseña para mantener tu cuenta segura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Contraseña Actual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Introduce tu contraseña actual"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
              />
            </div>
            <Button 
              onClick={handleChangePassword} 
              disabled={isChangingPassword}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {isChangingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
            </Button>
          </CardContent>
        </Card>

        {/* Donation Link */}
        <Card className="mb-8 border-pink-200">
          <CardHeader>
            <CardTitle className="flex items-center text-pink-600">
              <Heart className="mr-2 h-5 w-5" />
              Apoya el proyecto
            </CardTitle>
            <CardDescription>
              Si Oposiciones-Test te está ayudando, considera hacer una donación para mantener la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-pink-600 hover:bg-pink-700"
              onClick={() => navigate('/donacion')}
            >
              <Heart className="mr-2 h-4 w-4" />
              Hacer una donación
            </Button>
          </CardContent>
        </Card>

        {/* Privacy Policy Link */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Políticas de Privacidad</CardTitle>
            <CardDescription>
              Consulta nuestra política de privacidad y protección de datos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/privacy-policy')}
            >
              Ver Políticas de Privacidad
            </Button>
          </CardContent>
        </Card>

        {/* Delete Account Card */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center">
              <Trash2 className="mr-2 h-5 w-5" />
              Zona de Peligro
            </CardTitle>
            <CardDescription>
              Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, asegúrate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isDeleting}>
                  {isDeleting ? 'Eliminando...' : 'Eliminar Cuenta y Todos los Datos'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente tu cuenta
                    y borrará todos tus datos de nuestros servidores, incluyendo:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Todos los tests realizados</li>
                      <li>Tu historial y estadísticas</li>
                      <li>Tu información de perfil</li>
                      <li>Cualquier dato asociado a tu cuenta</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Sí, eliminar mi cuenta
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
