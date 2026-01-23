import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Smartphone, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';

const Donacion = () => {
  const { t } = useTranslation();
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
        title: t('donation.thankYou'),
        description: t('donation.supportValuable'),
      });
      navigate('/donacion', { replace: true });
    } else if (params.get('canceled') === 'true') {
      toast({
        title: t('donation.paymentCanceled'),
        description: t('donation.paymentCanceledDesc'),
        variant: 'destructive',
      });
      navigate('/donacion', { replace: true });
    }
  }, [toast, navigate, t]);

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
        title: t('donation.loginRequired'),
        description: t('donation.mustLoginToDonate'),
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Creating payment for user:', user.username);
      
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
        throw new Error(t('donation.noPaymentUrl'));
      }

      console.log('Payment session created, redirecting to:', data.url);

      window.open(data.url, '_blank');
      
      toast({
        title: t('donation.redirectingToPayment'),
        description: t('donation.newTabOpened'),
      });
    } catch (err: any) {
      console.error('Payment error:', err);
      toast({
        title: t('donation.paymentError'),
        description: t('donation.paymentErrorDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBizumDonation = (amount: number) => {
    if (!user?.id) {
      toast({
        title: t('common.error'),
        description: t('donation.mustBeAuthenticated'),
        variant: 'destructive',
      });
      return;
    }

    if (!phoneNumber || phoneNumber.length < 9) {
      toast({
        title: t('common.error'),
        description: t('donation.invalidPhone'),
        variant: 'destructive',
      });
      return;
    }

    setShowBizumInfo(true);
    toast({
      title: t('donation.donationInfo'),
      description: t('donation.openBizumApp', { amount }),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back')}
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {t('donation.title')} 💙
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('donation.subtitle')}
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">{t('donation.choosePaymentMethod')}</CardTitle>
            <CardDescription className="text-center">
              {t('donation.quickAndSecure')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-4">
                {t('donation.selectAmount')}
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
                  {t('donation.card')}
                </TabsTrigger>
                <TabsTrigger value="bizum">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Bizum
                </TabsTrigger>
              </TabsList>

              <TabsContent value="googlepay" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('donation.youWillDonate')} <span className="font-bold text-blue-600 dark:text-blue-400">{selectedAmount}€</span>
                    </p>
                  </div>
                  <Button
                    className="w-full bg-black hover:bg-gray-800" 
                    size="lg"
                    onClick={handleGooglePay}
                    disabled={isLoading || !user}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    {isLoading ? t('donation.processing') : t('donation.payWithCard')}
                  </Button>
                  {!user && (
                    <p className="text-xs text-amber-600 text-center">
                      {t('donation.mustLoginToDonate')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    {t('donation.securePayment')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="bizum" className="space-y-4 mt-4">
                {!showBizumInfo ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {t('donation.yourPhone')}
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
                        {t('donation.phoneNotShared')}
                      </p>
                    </div>

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => handleBizumDonation(selectedAmount)}
                    >
                      <Smartphone className="w-5 h-5 mr-2" />
                      {t('donation.donateWithBizum', { amount: selectedAmount })}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      {t('donation.onlySpain')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg">
                      <Smartphone className="w-12 h-12 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-semibold text-lg text-foreground mb-2">{t('donation.completeDonation')}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('donation.openBizumAndSend')} <span className="font-bold text-blue-600 dark:text-blue-400">{selectedAmount}€</span> {t('donation.toNumber')}:
                      </p>
                      <div className="bg-background p-4 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">612345678</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        {t('donation.concept')}
                      </p>
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => setShowBizumInfo(false)}
                      className="w-full"
                    >
                      {t('donation.changeAmountOrMethod')}
                    </Button>

                    <Button 
                      onClick={() => {
                        toast({
                          title: t('donation.thankYouMuch'),
                          description: t('donation.supportValuable'),
                        });
                        setTimeout(() => navigate('/'), 2000);
                      }}
                      className="w-full"
                    >
                      {t('donation.alreadyCompleted')}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('donation.whyDonate')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 dark:text-blue-400 text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('donation.keepPlatformFree')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('donation.keepPlatformFreeDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 dark:text-blue-400 text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('donation.newFeatures')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('donation.newFeaturesDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-blue-600 dark:text-blue-400 text-sm">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{t('donation.supportAndImprovements')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('donation.supportAndImprovementsDesc')}
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
            {t('donation.continueWithoutDonating')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Donacion;
