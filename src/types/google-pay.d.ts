declare global {
  interface Window {
    google?: {
      payments: {
        api: {
          PaymentsClient: new (config: { environment: 'TEST' | 'PRODUCTION' }) => GooglePaymentsClient;
        };
      };
    };
  }
}

interface GooglePaymentsClient {
  isReadyToPay(request: any): Promise<{ result: boolean }>;
  loadPaymentData(request: any): Promise<any>;
}

export {};
