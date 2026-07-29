import { success } from '../_shared/response.ts';
import { createServiceClient } from '../_shared/auth.ts';
import { handleRpcError, handleUnexpectedError } from '../_shared/errors.ts';
import { handleCors } from '../_shared/cors.ts';
import { withSentry } from '../_shared/sentry.ts';

Deno.serve(withSentry('expire-reservations', async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  if (req.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST',
      },
    });
  }

  try {
    const supabase = createServiceClient();
    const result = await supabase.rpc('expire_reservations_batch', {
      p_batch_size: 100,
    });

    if (result.error) {
      return handleRpcError(result.error as any);
    }

    return success('Reservations expired successfully', {
      expired_count: result.data?.expired_count || 0,
    });
  } catch (err) {
    return handleUnexpectedError(err);
  }
}));
