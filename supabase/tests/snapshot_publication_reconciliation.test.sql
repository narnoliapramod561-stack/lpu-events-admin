-- snapshot_publication_reconciliation.test.sql
-- Unit tests for snapshot publication queue, monotonic generations, and reconciliation RPCs

BEGIN;

-- 1. Test Enqueue
SELECT public.enqueue_snapshot_publication('MUTATION', '{"events": 10, "categories": 5}'::jsonb) AS queue_id \gset

SELECT 'Queue row was created' AS test_name,
       count(*) = 1 AS passed
FROM public.snapshot_publication_queue
WHERE id = :'queue_id' AND status = 'PENDING';

-- 2. Test Claim (returns generation counter)
SELECT id AS claimed_id, revision, generation, attempt_count
FROM public.claim_snapshot_publication('test-worker-1') \gset

SELECT 'Claimed row has PROCESSING status, generation allocated, and attempt_count incremented' AS test_name,
       status = 'PROCESSING' AND attempt_count = 1 AND generation > 0 AS passed
FROM public.snapshot_publication_queue
WHERE id = :'claimed_id';

-- 3. Test Fail with Exponential Backoff
SELECT public.fail_snapshot_publication(:'claimed_id', 'Simulated R2 network timeout') AS fail_result \gset

SELECT 'Failed row reset to PENDING with next_retry_at scheduled' AS test_name,
       status = 'PENDING' AND last_error = 'Simulated R2 network timeout' AND next_retry_at > clock_timestamp() AS passed
FROM public.snapshot_publication_queue
WHERE id = :'claimed_id';

-- 4. Test Monotonic Manifest Promotion (Success)
SELECT (public.promote_snapshot_manifest(:'claimed_id', 'rev_test_promoted', :'generation', 'test-worker-1', ARRAY['public-content/manifest.json'], 2048)->>'promoted')::boolean AS is_promoted \gset

SELECT 'Promoted manifest succeeded and advanced generation' AS test_name,
       :'is_promoted'::boolean = true AS passed;

-- 5. Test Stale Overwrite Prevention (Older generation must be rejected)
SELECT (public.promote_snapshot_manifest(gen_random_uuid(), 'rev_stale_attempt', (:'generation'::bigint - 1), 'test-worker-stale', ARRAY['public-content/manifest.json'], 1024)->>'promoted')::boolean AS stale_promoted \gset

SELECT 'Stale older generation correctly rejected by promote_snapshot_manifest' AS test_name,
       :'stale_promoted'::boolean = false AS passed;

-- 6. Test Retention Cleanup Invariant (PENDING jobs must NEVER be pruned)
INSERT INTO public.snapshot_publication_queue (revision, trigger_source, status, next_retry_at)
VALUES ('rev_pending_safe', 'MUTATION', 'PENDING', clock_timestamp());

SELECT public.prune_snapshot_publication_queue() AS pruned_count \gset

SELECT 'PENDING job survives retention pruning' AS test_name,
       count(*) = 1 AS passed
FROM public.snapshot_publication_queue
WHERE revision = 'rev_pending_safe';

-- 7. Test Status RPC
SELECT latest_published_revision = 'rev_test_promoted' AND current_generation >= :'generation'::bigint AS status_rpc_passed
FROM public.get_snapshot_publication_status();

ROLLBACK;
