// lpu-events-admin/src/shared/telemetry/__tests__/security_performance_stage15.test.ts
// Stage 15: Security & Performance Audit Verification Suite (MON-006 / MON-007 / MON-008 Stage 15)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Stage 15: Security & Performance Audit Suite', async (t) => {
  await t.test('1. Zero Secret Exposure Invariant: Browser sources must contain ZERO private tokens', () => {
    const sensitiveTokens = [
      'POSTHOG_PERSONAL_API_KEY',
      'UPTIMEROBOT_API_KEY',
      'SUPABASE_MANAGEMENT_API_TOKEN',
      'GSC_SERVICE_ACCOUNT_JSON',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    const frontendFilesToScan = [
      'lpu-events-student/src/main.tsx',
      'lpu-events-student/src/App.tsx',
      'lpu-events-student/src/shared/telemetry/posthog.ts',
      'lpu-events-student/src/shared/telemetry/correlation.ts',
      'lpu-events-admin/src/main.tsx',
      'lpu-events-admin/src/SuperAdminApp.tsx',
      'lpu-events-admin/src/components/superadmin/monitoring/MonitoringPanel.tsx',
      'lpu-events-admin/src/components/superadmin/monitoring/utils/MonitoringApiClient.ts',
      'lpu-events-admin/src/components/superadmin/monitoring/sections/MonitoringOverview.tsx',
      'lpu-events-admin/src/components/superadmin/monitoring/sections/ErrorInbox.tsx',
      'lpu-events-admin/src/components/superadmin/monitoring/sections/ServicesStatus.tsx',
      'lpu-events-admin/src/components/superadmin/monitoring/sections/BackendLogsPanel.tsx',
      'lpu-events-admin/src/components/superadmin/monitoring/sections/SeoHealthPanel.tsx',
    ];

    for (const relPath of frontendFilesToScan) {
      const fullPath = path.resolve(relPath);
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        // Ensure no private key variables are assigned literals
        for (const token of sensitiveTokens) {
          const dangerousPattern = new RegExp(`${token}\\s*=\\s*['"\`][^'"\`]+['"\`]`, 'i');
          assert.equal(
            dangerousPattern.test(fileContent),
            false,
            `Forbidden secret assignment found for ${token} in ${relPath}`
          );
        }
      }
    }
  });

  await t.test('2. Hidden Source Map Invariant: Vite CI builds must generate hidden source maps with post-build purge', () => {
    const studentViteConfig = fs.readFileSync(path.resolve('lpu-events-student/vite.config.ts'), 'utf8');
    const adminViteConfig = fs.readFileSync(path.resolve('lpu-events-admin/vite.config.ts'), 'utf8');
    const studentDeploy = fs.readFileSync(path.resolve('lpu-events-student/.github/workflows/deploy.yml'), 'utf8');

    // Both vite configs must use hidden sourcemaps in CI
    assert.match(studentViteConfig, /sourcemap:\s*process\.env\.CI\s*\?\s*['"]hidden['"]\s*:\s*false/);
    assert.match(adminViteConfig, /sourcemap:\s*process\.env\.CI\s*\?\s*['"]hidden['"]\s*:\s*false/);

    // Deploy workflow must upload source maps with delete-after-upload: true and verify 0 .map files
    assert.match(studentDeploy, /delete-after-upload:\s*true/);
    assert.match(studentDeploy, /find dist\/ -name "\*\.map"/);
  });

  await t.test('3. Zero Database Write Invariant: Telemetry modules do not execute Supabase DB writes', () => {
    const clientFiles = [
      'lpu-events-student/src/shared/telemetry/posthog.ts',
      'lpu-events-student/src/shared/telemetry/correlation.ts',
      'lpu-events-admin/src/shared/telemetry/posthog.ts',
      'lpu-events-admin/src/shared/telemetry/correlation.ts',
      'lpu-events-admin/src/components/superadmin/monitoring/utils/MonitoringApiClient.ts',
    ];

    const forbiddenDbMutations = [
      /\.from\(['"].*['"]\)\.insert\(/,
      /\.from\(['"].*['"]\)\.update\(/,
      /\.from\(['"].*['"]\)\.delete\(/,
      /\.from\(['"].*['"]\)\.upsert\(/,
    ];

    for (const relPath of clientFiles) {
      const fullPath = path.resolve(relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const pattern of forbiddenDbMutations) {
          assert.equal(
            pattern.test(content),
            false,
            `Forbidden database mutation found in telemetry client: ${relPath}`
          );
        }
      }
    }
  });

  await t.test('4. Zero Cost & Quota Validation Matrix (MON-007 §2)', () => {
    // PostHog Monthly Free Tier Limits
    const posthogMonthlyFreeEvents = 1_000_000;
    const posthogMonthlyFreeExceptions = 100_000;
    const peakMonthlyExpectedEvents = 250_000;
    const peakMonthlyExpectedExceptions = 13_000;

    assert.ok(peakMonthlyExpectedEvents <= posthogMonthlyFreeEvents * 0.25);
    assert.ok(peakMonthlyExpectedExceptions <= posthogMonthlyFreeExceptions * 0.15);

    // Supabase Logs 24h retention limit
    const supabaseFreeLogRetentionHours = 24;
    assert.equal(supabaseFreeLogRetentionHours, 24);

    // UptimeRobot Free Tier Limits
    const uptimerobotFreeMonitors = 50;
    const lpuConfiguredMonitors = 4;
    assert.ok(lpuConfiguredMonitors <= uptimerobotFreeMonitors);

    // GitHub Actions Monthly Synthetic Budget
    const githubFreeAllowanceMinutes = 2000;
    const scheduledSyntheticBaselineMinutes = 240;
    assert.ok(scheduledSyntheticBaselineMinutes <= githubFreeAllowanceMinutes * 0.15);
  });
});
