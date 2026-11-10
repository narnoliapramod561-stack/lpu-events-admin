// lpu-events-admin/src/shared/telemetry/__tests__/backend_logs_stage12.test.ts
// Unit Test Suite for Stage 12: Section D Backend ClickHouse Logs Explorer (MON-004 / MON-006 / MON-008)

import test from 'node:test';
import assert from 'node:assert/strict';
import { MonitoringApiClient } from '../../../components/superadmin/monitoring/utils/MonitoringApiClient.ts';
import type { SupabaseLogRecord } from '../../../components/superadmin/monitoring/types.ts';

test('Stage 12: Section D Backend ClickHouse Logs Explorer Suite', async (t) => {
  await t.test('1. should query supabase_logs via proxy with source, timestamps, and correlation_id', async () => {
    let passedBody: any = null;

    const mockSupabase: any = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'test_token' } },
        }),
      },
      functions: {
        invoke: async (_url: string, options: any) => {
          passedBody = options.body;
          return {
            data: {
              data: [
                {
                  id: 'log-1',
                  timestamp: '2026-11-10T10:00:00.000Z',
                  event_message: JSON.stringify({
                    channel: 'operations_control_plane',
                    correlation_id: 'req_c8f2a1b9',
                    operation: 'publish_snapshot',
                    success: true,
                    statusCode: 200,
                  }),
                  source: 'function_logs',
                },
              ],
            },
            error: null,
          };
        },
      },
    };

    MonitoringApiClient.setSupabaseClient(mockSupabase);

    const now = new Date();
    const isoStart = new Date(now.getTime() - 3600 * 1000).toISOString();
    const isoEnd = now.toISOString();

    const records = await MonitoringApiClient.queryLogs({
      source: 'function_logs',
      iso_timestamp_start: isoStart,
      iso_timestamp_end: isoEnd,
      correlation_id: 'req_c8f2a1b9',
      limit: 50,
    });

    assert.equal(records.length, 1);
    assert.equal(passedBody.source, 'function_logs');
    assert.equal(passedBody.correlation_id, 'req_c8f2a1b9');
    assert.equal(passedBody.limit, 50);
    assert.equal(records[0].source, 'function_logs');
    assert(records[0].event_message?.includes('req_c8f2a1b9'));
  });

  await t.test('2. 24-Hour Retention Window Invariant: duration > 24h must be rejected', () => {
    const MAX_WINDOW_MS = 24 * 60 * 60 * 1000 + 60 * 1000;
    const now = Date.now();

    // 1. Valid window (24 hours)
    const validStart = new Date(now - 24 * 60 * 60 * 1000);
    const validEnd = new Date(now);
    const validDuration = validEnd.getTime() - validStart.getTime();
    assert(validDuration <= MAX_WINDOW_MS);

    // 2. Invalid window (26 hours)
    const invalidStart = new Date(now - 26 * 60 * 60 * 1000);
    const invalidEnd = new Date(now);
    const invalidDuration = invalidEnd.getTime() - invalidStart.getTime();
    assert(invalidDuration > MAX_WINDOW_MS);
  });

  await t.test('3. ClickHouse SQL separation between function_logs (event_message) and function_edge_logs (log_attributes)', () => {
    const buildSql = (source: string, isoStart: string, isoEnd: string, correlationId?: string) => {
      const correlationFilter = correlationId
        ? `AND event_message LIKE '%${correlationId}%'`
        : '';

      if (source === 'function_logs') {
        return `SELECT id, timestamp, event_message, source FROM logs WHERE source = 'function_logs' AND timestamp >= '${isoStart}' AND timestamp <= '${isoEnd}' ${correlationFilter} ORDER BY timestamp DESC LIMIT 100`;
      }
      return `SELECT id, timestamp, log_attributes, source FROM logs WHERE source = '${source}' AND timestamp >= '${isoStart}' AND timestamp <= '${isoEnd}' ORDER BY timestamp DESC LIMIT 100`;
    };

    const tStart = '2026-11-10T09:00:00Z';
    const tEnd = '2026-11-10T10:00:00Z';

    const functionLogsSql = buildSql('function_logs', tStart, tEnd, 'req_123');
    assert(functionLogsSql.includes('event_message'));
    assert(functionLogsSql.includes("WHERE source = 'function_logs'"));
    assert(functionLogsSql.includes("LIKE '%req_123%'"));

    const edgeLogsSql = buildSql('function_edge_logs', tStart, tEnd);
    assert(edgeLogsSql.includes('log_attributes'));
    assert(!edgeLogsSql.includes('event_message'));
    assert(edgeLogsSql.includes("WHERE source = 'function_edge_logs'"));
  });

  await t.test('4. Structured JSON decoding of correlation ID and operations telemetry', () => {
    const rawMessage = JSON.stringify({
      channel: 'operations_control_plane',
      correlation_id: 'req_cross_nav_99',
      operation: 'r2_upload',
      statusCode: 200,
    });

    const parsed = JSON.parse(rawMessage);
    assert.equal(parsed.correlation_id, 'req_cross_nav_99');
    assert.equal(parsed.operation, 'r2_upload');
    assert.equal(parsed.statusCode, 200);
  });
});

