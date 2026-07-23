import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { validarDonacionGoogle } from '@/services/donacionesIAPService';

// SKUs configurados en Google Play Console (productos consumibles)
export const DONATION_SKUS = {
  5: 'donation_5',
  10: 'donation_10',
  20: 'donation_20',
} as const;

export type DonationAmount = keyof typeof DONATION_SKUS;

interface UseGooglePlayBillingOptions {
  userId?: number;
  onSuccess?: (amount: number) => void;
  onError?: (msg: string) => void;
}

/**
 * Hook para Google Play Billing (donaciones consumibles).
 * Solo se activa en Android nativo. En web devuelve isAvailable=false.
 * Usa cordova-plugin-purchase (compatible con Billing v7+, actualiza a v8 vía plugin).
 */
export function useGooglePlayBilling(opts: UseGooglePlayBillingOptions = {}) {
  const { userId, onSuccess, onError } = opts;
  const [isAvailable, setIsAvailable] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const storeRef = useRef<any>(null);

  const isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isAndroidNative) return;

    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase) {
      console.warn('[Billing] cordova-plugin-purchase no disponible');
      return;
    }
    setIsAvailable(true);
    const { store, ProductType, Platform, LogLevel } = CdvPurchase;
    storeRef.current = store;

    store.verbosity = LogLevel.WARNING;

    // Registrar los SKUs consumibles
    store.register(
      Object.values(DONATION_SKUS).map((id) => ({
        id,
        type: ProductType.CONSUMABLE,
        platform: Platform.GOOGLE_PLAY,
      }))
    );

    // Validación server-side + entrega
    store
      .when()
      .approved((tx: any) => {
        (async () => {
          try {
            const productId = tx.products?.[0]?.id;
            if (!userId || !productId) {
              tx.finish();
              return;
            }
            const res = await validarDonacionGoogle({
              id_usuario: userId,
              product_id: productId,
              purchase_token: tx.transactionId || tx.purchaseToken || '',
              order_id: tx.nativePurchase?.orderId || '',
            });
            if (res.success) {
              tx.finish(); // consume la donación en Google Play
              const cents = res.amount_cents || 0;
              onSuccess?.(cents / 100);
            } else {
              onError?.(res.error || 'Validación fallida');
            }
          } catch (e: any) {
            onError?.(e?.message || 'Error validando la compra');
          } finally {
            setIsProcessing(false);
          }
        })();
      })
      .finished(() => setIsProcessing(false))
      .receiptUpdated(() => {})
      .productUpdated(() => {});

    store.error((err: any) => {
      console.error('[Billing] Error', err);
      onError?.(err?.message || 'Error del sistema de pagos');
      setIsProcessing(false);
    });

    store
      .initialize([Platform.GOOGLE_PLAY])
      .then(() => {
        setIsReady(true);
        console.log('[Billing] Store inicializado');
      })
      .catch((e: any) => {
        console.error('[Billing] Init error', e);
        setIsReady(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAndroidNative, userId]);

  const donate = useCallback(
    async (amount: DonationAmount) => {
      if (!isAndroidNative) {
        onError?.('Google Play Billing solo disponible en Android');
        return;
      }
      const store = storeRef.current;
      if (!store || !isReady) {
        onError?.('El sistema de pagos aún no está listo');
        return;
      }
      const sku = DONATION_SKUS[amount];
      const product = store.get(sku);
      if (!product) {
        onError?.(`Producto ${sku} no encontrado en Google Play`);
        return;
      }
      const offer = product.getOffer?.();
      if (!offer) {
        onError?.('Sin oferta disponible para este producto');
        return;
      }
      setIsProcessing(true);
      try {
        await offer.order();
      } catch (e: any) {
        setIsProcessing(false);
        onError?.(e?.message || 'No se pudo iniciar la compra');
      }
    },
    [isAndroidNative, isReady, onError]
  );

  return {
    isAndroidNative,
    isAvailable,
    isReady,
    isProcessing,
    donate,
  };
}
