// lpu-events-admin/src/shared/telemetry/__tests__/diagnostic_report_stage10.test.ts
// Unit Test Suite for Stage 10: AI Diagnostic Report Generator (MON-003 / MON-008)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DiagnosticReportGenerator,
  normalizeSourceFilePath,
  extractExceptionType,
  MAX_BUNDLE_ISSUES,
} from '../../../components/superadmin/monitoring/utils/DiagnosticReportGenerator.ts';
import type { NormalizedPostHogIssue } from '../../../components/superadmin/monitoring/types.ts';

test('Stage 10: AI Diagnostic Report Generator Suite', async (t) => {
  await t.test('1. normalizeSourceFilePath converts absolute machine paths to clean repository-relative paths', () => {
    const macPath = '/Users/subham/Desktop/lpu1/lpu-events-student/src/components/EventCard.tsx';
    assert.equal(
      normalizeSourceFilePath(macPath),
      'lpu-events-student/src/components/EventCard.tsx'
    );

    const fileUri = 'file:///app/lpu-events-admin/src/SuperAdminApp.tsx';
    assert.equal(
      normalizeSourceFilePath(fileUri),
      'lpu-events-admin/src/SuperAdminApp.tsx'
    );

    const genericSrc = '/var/runner/work/build/src/worker.ts';
    assert.equal(normalizeSourceFilePath(genericSrc), 'src/worker.ts');
  });

  await t.test('2. extractExceptionType extracts proper runtime exception names', () => {
    assert.equal(extractExceptionType('TypeError: Cannot read properties of undefined'), 'TypeError');
    assert.equal(extractExceptionType('ReferenceError: window is not defined'), 'ReferenceError');
    assert.equal(extractExceptionType('Unhandled rejection'), 'Error');
  });

  await t.test('3. generateSingleReport produces canonical MON-003 schema with all 8 sections', () => {
    const issue: NormalizedPostHogIssue = {
      id: '01931a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b',
      name: 'TypeError: Cannot read properties of undefined (reading name)',
      status: 'active',
      severity: 'P0',
      app: 'student',
      environment: 'production',
      component: 'EventCard.tsx',
      occurrences: 47,
      users: 38,
      firstSeen: '2026-11-10T08:12:34.000Z',
      lastSeen: '2026-11-10T10:38:11.000Z',
      release: 'sha.a3f7c21',
      deepLink: 'https://us.posthog.com/project/531855/error_tracking/01931a2b',
    };

    const detail = {
      correlation_id: 'req_c8f2a1b9',
      properties: {
        $exception_list: [
          {
            stacktrace: {
              frames: [
                {
                  filename: '/Users/subham/Desktop/lpu1/lpu-events-student/src/components/EventCard.tsx',
                  function: 'EventCard',
                  lineno: 84,
                  colno: 28,
                  in_app: true,
                },
              ],
            },
          },
        ],
        $breadcrumbs: [
          { category: 'pageview', type: 'navigation', message: 'Navigated to /events' },
          { category: 'click', type: 'action', message: 'Clicked filter button' },
        ],
      },
    };

    const markdown = DiagnosticReportGenerator.generateSingleReport(issue, detail);

    // Verify Title & Metadata
    assert(markdown.includes('# LPU Events — AI Diagnostic Report'));
    assert(markdown.includes('INC-ph_01931a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b'));
    assert(markdown.includes('Report Version:** 1.3'));

    // Verify 8 Sections
    assert(markdown.includes('### 1. Issue Summary'));
    assert(markdown.includes('### 2. Occurrence & Exposure Metrics'));
    assert(markdown.includes('### 3. Symbolicated Stack Trace'));
    assert(markdown.includes('### 4. Request Correlation & Context'));
    assert(markdown.includes('### 5. Client Breadcrumb Trail'));
    assert(markdown.includes('### 6. Backend & Database Diagnostics'));
    assert(markdown.includes('### 7. Evidence Classification & Root-Cause Assessment'));
    assert(markdown.includes('### 8. Strict AI Coding Agent Instructions'));

    // Verify clean path in stacktrace
    assert(markdown.includes('lpu-events-student/src/components/EventCard.tsx:84:28'));
    assert(!markdown.includes('/Users/subham/Desktop/lpu1/'));

    // Verify mandatory AI instructions
    assert(markdown.includes('MANDATORY INSTRUCTIONS FOR AI CODING AGENT:'));
    assert(markdown.includes('1. REPOSITORY INSPECTION'));
    assert(markdown.includes('2. TRACE DATA FLOW'));
    assert(markdown.includes('3. ROOT-CAUSE VERIFICATION'));
    assert(markdown.includes('4. WRITE REPRODUCING REGRESSION TEST'));
    assert(markdown.includes('5. VERIFY ZERO CODE BREAKAGE'));
  });

  await t.test('4. Backend Service Event Invariant: users renders N/A (Backend Service Event)', () => {
    const backendIssue: NormalizedPostHogIssue = {
      id: 'backend-issue-99',
      name: 'Cloudflare Worker fetch error: upstream database timeout',
      status: 'active',
      severity: 'P1',
      app: 'backend',
      environment: 'production',
      component: 'worker.ts',
      occurrences: 12,
      users: 'N/A',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      release: 'sha.ff9012',
      deepLink: 'https://us.posthog.com/project/531855/error_tracking/backend-issue-99',
    };

    const markdown = DiagnosticReportGenerator.generateSingleReport(backendIssue);
    assert(markdown.includes('`N/A (Backend Service Event)`'));
  });

  await t.test('5. Sensitive tokens and JWTs must be scrubbed from report content', () => {
    const secretIssue: NormalizedPostHogIssue = {
      id: 'leak-1',
      name: 'Auth error with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload.sig',
      status: 'active',
      severity: 'P2',
      app: 'admin',
      environment: 'production',
      component: 'SettingsPanel.tsx',
      occurrences: 1,
      users: 1,
      firstSeen: '',
      lastSeen: '',
      release: 'sha.1',
      deepLink: '',
    };

    const markdown = DiagnosticReportGenerator.generateSingleReport(secretIssue);
    assert(!markdown.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload.sig'));
    assert(markdown.includes('[REDACTED'));
  });

  await t.test('6. generateBundleReport enforces MAX_BUNDLE_ISSUES (25) cap with truncation notice', () => {
    const manyIssues: NormalizedPostHogIssue[] = Array.from({ length: 30 }, (_, i) => ({
      id: `issue-${i + 1}`,
      name: `Error in component ${i + 1}`,
      status: 'active',
      severity: 'P2',
      app: 'student',
      environment: 'production',
      component: `Comp${i + 1}.tsx`,
      occurrences: i + 1,
      users: 1,
      firstSeen: '',
      lastSeen: '',
      release: 'sha.1',
      deepLink: `https://us.posthog.com/project/531855/error_tracking/issue-${i + 1}`,
    }));

    const result = DiagnosticReportGenerator.generateBundleReport(manyIssues);
    assert.equal(result.isTruncated, true);
    assert.equal(result.totalProvided, 30);
    assert(result.markdown.includes('BUNDLE TRUNCATED'));
    assert(result.markdown.includes(`Export capped at ${MAX_BUNDLE_ISSUES} issues`));
    assert(result.markdown.includes('5 additional issues were omitted'));
  });
});
