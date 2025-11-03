import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Smartphone, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const Donacion = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showBizumInfo, setShowBizumInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [paymentsClient, setPaymentsClient] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      toast({
        title: '¡Gracias por tu donación! 💙',
        description: 'Tu apoyo es muy valioso para nosotros',
      });
      navigate('/donacion', { replace: true });
    } else if (params.get('canceled') === 'true') {
      toast({
        title: 'Pago cancelado',
        description: 'El pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.',
        variant: 'destructive',
      });
      navigate('/donacion', { replace: true });
    }
  }, [toast, navigate]);

  // Inicializar Google Pay
  useEffect(() => {
    const initGooglePay = async () => {
      const googleObj = (window as any).google;
      if (typeof googleObj === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://pay.google.com/gp/p/js/pay.js';
        script.async = true;
        script.onload = () => setupGooglePay();
        document.body.appendChild(script);
      } else {
        setupGooglePay();
      }
    };

    const setupGooglePay = () => {
      const googleObj = (window as any).google;
      if (!googleObj?.payments?.api?.PaymentsClient) {
        console.log('Google Pay API not available');
        return;
      }
      
      const client = new googleObj.payments.api.PaymentsClient({
        environment: 'TEST', // Cambiar a 'PRODUCTION' cuando esté listo
      });
      
      setPaymentsClient(client);

      const isReadyToPayRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [{
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['MASTERCARD', 'VISA']
          }
        }]
      };

      client.isReadyToPay(isReadyToPayRequest)
        .then((response: any) => {
          if (response.result) {
            setGooglePayReady(true);
            console.log('Google Pay is ready');
          }
        })
        .catch((err: any) => {
          console.error('Error checking Google Pay availability:', err);
        });
    };

    initGooglePay();
  }, []);

  const handleGooglePay = async () => {
    if (!user?.id) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para donar',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Creating payment for user:', user.username);
      
      // Crear sesión de pago en el backend pasando el email del usuario
      const userEmail = user.username.includes('@') ? user.username : `${user.username}@oposiciones-test.com`;
      
      const { data, error } = await supabase.functions.invoke('create-donation-payment', {
        body: { 
          amount: selectedAmount,
          userEmail: userEmail
        }
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('No se recibió URL de pago');
      }

      console.log('Payment session created, redirecting to:', data.url);

      // Abrir Stripe Checkout en una nueva pestaña
      window.open(data.url, '_blank');
      
      toast({
        title: 'Redirigiendo a la pasarela de pago',
        description: 'Se ha abierto una nueva pestaña con el formulario de pago',
      });
    } catch (err: any) {
      console.error('Payment error:', err);
      toast({
        title: 'Error en el pago',
        description: 'No se pudo completar el pago. Por favor, intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBizumDonation = (amount: number) => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'Debes estar autenticado para donar',
        variant: 'destructive',
      });
      return;
    }

    if (!phoneNumber || phoneNumber.length < 9) {
      toast({
        title: 'Error',
        description: 'Por favor, introduce un número de teléfono válido',
        variant: 'destructive',
      });
      return;
    }

    setShowBizumInfo(true);
    toast({
      title: 'Información de donación',
      description: `Abre tu app de Bizum y envía ${amount}€ al número que te mostraremos`,
    });
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

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Apoya el proyecto 💙
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Puedes seguir usando la app gratuitamente. Si te aporta valor, 
            considera realizar una donación para ayudarnos a mantener y mejorar la plataforma.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">Elige tu método de pago</CardTitle>
            <CardDescription className="text-center">
              Realiza tu donación de forma rápida y segura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-4">
                Selecciona el importe de tu donación
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[5, 10, 20].map((amount) => (
                  <Button
                    key={amount}
                    variant={selectedAmount === amount ? "default" : "outline"}
                    onClick={() => setSelectedAmount(amount)}
                    className="h-20 flex flex-col"
                  >
                    <span className="text-2xl font-bold">{amount}€</span>
                  </Button>
                ))}
              </div>
            </div>

            <Tabs defaultValue="googlepay" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="googlepay">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Tarjeta
                </TabsTrigger>
                <TabsTrigger value="bizum">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Bizum
                </TabsTrigger>
              </TabsList>

              <TabsContent value="googlepay" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Donarás <span className="font-bold text-blue-600">{selectedAmount}€</span>
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-black hover:bg-gray-800" 
                    size="lg"
                    onClick={handleGooglePay}
                    disabled={isLoading || !user}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    {isLoading ? 'Procesando...' : 'Pagar con Tarjeta'}
                  </Button>
                  {!user && (
                    <p className="text-xs text-amber-600 text-center">
                      Debes iniciar sesión para donar
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Pago seguro procesado por Stripe
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="bizum" className="space-y-4 mt-4">
                {!showBizumInfo ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Tu número de teléfono (opcional)
                      </label>
                      <input
                        type="tel"
                        placeholder="612345678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-4 py-2 border border-input bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                        maxLength={9}
                      />
                      <p className="text-xs text-muted-foreground">
                        Para confirmar tu donación (no se compartirá)
                      </p>
                    </div>

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => handleBizumDonation(selectedAmount)}
                    >
                      <Smartphone className="w-5 h-5 mr-2" />
                      Donar {selectedAmount}€ con Bizum
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Solo disponible en España
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="bg-blue-50 p-6 rounded-lg">
                      <Smartphone className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                      <h3 className="font-semibold text-lg mb-2">Completa tu donación</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Abre tu app de Bizum y envía <span className="font-bold text-blue-600">{selectedAmount}€</span> al número:
                      </p>
                      <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                        <p className="text-3xl font-bold text-blue-600">612345678</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        Concepto: Donación Oposiciones-Test
                      </p>
                    </div>
                    
                    <Button 
                      variant="outline"
                      onClick={() => setShowBizumInfo(false)}
                      className="w-full"
                    >
                      Cambiar importe o método
                    </Button>

                    <Button 
                      onClick={() => {
                        toast({
                          title: '¡Muchas gracias! 💙',
                          description: 'Tu apoyo es muy valioso para nosotros',
                        });
                        setTimeout(() => navigate('/'), 2000);
                      }}
                      className="w-full"
                    >
                      Ya he completado la donación
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>¿Por qué donar?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Mantén la plataforma gratuita</h3>
                <p className="text-sm text-gray-600">
                  Tu donación ayuda a mantener Oposiciones-Test accesible para todos
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Nuevas funcionalidades</h3>
                <p className="text-sm text-gray-600">
                  Ayuda a financiar el desarrollo de nuevas características
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Soporte y mejoras</h3>
                <p className="text-sm text-gray-600">
                  Permite mantener el servidor y mejorar continuamente la experiencia
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/')}
          >
            Continuar sin donar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Donacion;
