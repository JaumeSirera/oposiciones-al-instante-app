import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Heart, Star, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

const DonacionPublica = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  const handleDonation = async (amount: number) => {
    // En Android nativo, la donación se hace por Google Play Billing (requiere login).
    if (isAndroidNative) {
      toast({
        title: 'Inicia sesión para donar vía Google Play',
        description: 'En la app Android las donaciones se procesan con Google Play Billing.',
      });
      navigate('/donacion');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-donation-payment', {
        body: { amount, userEmail: 'donacion@oposiciones-test.com' }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating donation:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la donación. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Apoya Oposiciones-Tests</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tu donación nos ayuda a mantener la plataforma gratuita y seguir mejorando
              las herramientas para todos los opositores.
            </p>
          </div>

          {isAndroidNative && (
            <Card className="mb-8 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
                <Smartphone className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-semibold text-foreground">Donar desde la app Android</h3>
                  <p className="text-sm text-muted-foreground">
                    En la app se paga con Google Play. Inicia sesión y accede a la pantalla de donación.
                  </p>
                </div>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => navigate('/donacion')}
                >
                  Ir a donar
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-purple-300 dark:border-purple-700"
              onClick={() => handleDonation(5)}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-2">
                  <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>Apoyo Medio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground mb-2">5€</p>
                <p className="text-muted-foreground">
                  Una ayuda significativa para mantener los servidores funcionando.
                </p>
                <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600">
                  Donar 5€
                </Button>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleDonation(10)}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg flex items-center justify-center mb-2">
                  <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <CardTitle>Gran Apoyo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground mb-2">10€</p>
                <p className="text-muted-foreground">
                  Contribuyes de manera importante al crecimiento de la plataforma.
                </p>
                <Button className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600">
                  Donar 10€
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">¿Por qué donar?</h2>
              <ul className="space-y-3 text-foreground">
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Mantener la plataforma gratuita para todos los opositores</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Desarrollar nuevas funcionalidades y herramientas</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Cubrir los costes de servidores y mantenimiento</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
                  <span>Mejorar la experiencia de usuario continuamente</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DonacionPublica;
