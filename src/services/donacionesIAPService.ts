import { supabase } from '@/lib/supabaseClient';

export interface ValidarDonacionPayload {
  id_usuario: number;
  product_id: string;
  purchase_token: string;
  order_id?: string;
}

export interface ValidarDonacionResponse {
  success: boolean;
  estado?: 'validated' | 'consumed' | 'failed';
  amount_cents?: number;
  error?: string;
}

/**
 * Valida en el backend PHP una compra realizada por Google Play Billing.
 * El backend consulta la Google Play Developer API con la cuenta de servicio.
 */
export async function validarDonacionGoogle(
  payload: ValidarDonacionPayload
): Promise<ValidarDonacionResponse> {
  const { data, error } = await supabase.functions.invoke('php-api-proxy', {
    body: {
      endpoint: 'validar_donacion_google.php',
      method: 'POST',
      body: payload,
    },
  });
  if (error) throw error;
  return data as ValidarDonacionResponse;
}
