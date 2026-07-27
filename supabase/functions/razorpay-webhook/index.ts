import * as response from '../_shared/response.ts';
import { createServiceClient } from '../_shared/auth.ts';
import { handleRpcError, handleUnexpectedError } from '../_shared/errors.ts';
import { handleCors } from '../_shared/cors.ts';

// Pre-shared secret for Razorpay webhook HMAC verification
const RAZORPAY_WEBHOOK_SECRET = 'rzp_test_your_secret_here';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'POST') {
    return response.methodNotAllowed(['POST']);
  }

  try {
    const signature = req.headers.get('X-Razorpay-Signature');
    if (!signature) {
      return response.badRequest('INVALID_SIGNATURE', 'Razorpay signature header is required.');
    }

    const body = await req.text();
    const calculatedSignature = await generateHmac(body, RAZORPAY_WEBHOOK_SECRET);

    if (!timingSafeEqual(signature, calculatedSignature)) {
      return response.badRequest('INVALID_SIGNATURE', 'Razorpay signature verification failed.');
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    const paymentEntity =
      (payload.payload as { payment?: { entity?: Record<string, unknown> } } | undefined)?.payment
        ?.entity ||
      (payload.data as { payment?: { entity?: Record<string, unknown> } } | undefined)?.payment
        ?.entity ||
      (payload.payment as { entity?: Record<string, unknown> } | undefined)?.entity ||
      (payload.entity as Record<string, unknown> | undefined) ||
      null;

    const orderId = String(paymentEntity?.order_id || payload.order_id || '');
    const paymentId = String(paymentEntity?.id || payload.payment_id || '');

    if (!orderId || !paymentId) {
      return response.badRequest(
        'INVALID_PAYLOAD',
        'Webhook payload did not include the Razorpay order and payment identifiers.'
      );
    }

    const supabase = createServiceClient();
    const result = await supabase.rpc('confirm_payment', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_signature: signature,
    });

    if (result.error) {
      return handleRpcError(result.error as any);
    }

    return response.success('Payment confirmed successfully', {
      order_id: orderId,
      payment_id: paymentId,
      status: 'captured',
    });
  } catch (err) {
    return handleUnexpectedError(err);
  }
});

/**
 * Generate HMAC-SHA256 signature
 */
async function generateHmac(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return arrayBufferToHex(signature);
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const hexCodes = [];
  const view = new DataView(buffer);
  for (let i = 0; i < view.byteLength; i += 4) {
    const value = view.getUint32(i, false);
    const stringValue = value.toString(16).padStart(8, '0');
    hexCodes.push(stringValue);
  }
  return hexCodes.join('');
}

/**
 * Timing-safe comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
