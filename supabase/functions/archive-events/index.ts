import { success } from '../_shared/response.ts';
import { createServiceClient } from '../_shared/auth.ts';
import { handleRpcError, handleUnexpectedError } from '../_shared/errors.ts';
import { handleCors } from '../_shared/cors.ts';
import { withSentry } from '../_shared/sentry.ts';

Deno.serve(withSentry('archive-events', async (req: Request) => {
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
      return handleRpcError({
        message: String((result.error as unknown as { message?: string }).message || ''),
        code: (result.error as unknown as { code?: string }).code,
        details: (result.error as unknown as { details?: string }).details,
      });
    }

    return success('Archive events processed successfully', {
      archive_count: result.data?.expired_count || 0,
    });
  } catch (err) {
    return handleUnexpectedError(err);
  }
}));
