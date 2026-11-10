// lpu-events-admin/src/components/superadmin/monitoring/utils/DiagnosticReportGenerator.ts
// AI-Ready Diagnostic Report Assembler adhering strictly to MON-003 (Stage 10)

import { scrubSensitiveData } from '../../../../shared/telemetry/scrub.ts';
import type { NormalizedPostHogIssue } from '../types.ts';

export const MAX_BUNDLE_ISSUES = 25;
export const MAX_BUNDLE_BYTES_WARNING = 50 * 1024; // 50 KB

/**
 * Normalizes absolute machine paths to clean repository-relative paths (e.g. `src/components/EventCard.tsx:84:28`)
 */
export function normalizeSourceFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return 'UnknownSourceFile';
  let cleaned = filePath.replace(/\\/g, '/');
  cleaned = cleaned.replace(/^file:\/\/\/?/, '');

  // Strip machine home directory paths
  const subprojectIndex = cleaned.search(/(lpu-events-student|lpu-events-admin|lpu-events-app|packages\/shared)\//);
  if (subprojectIndex !== -1) {
    return cleaned.slice(subprojectIndex);
  }

  const srcIndex = cleaned.indexOf('src/');
  if (srcIndex !== -1) {
    return cleaned.slice(srcIndex);
  }

  return cleaned.split('/').slice(-3).join('/');
}

export function extractExceptionType(errorTitle: string): string {
  if (!errorTitle) return 'Error';
  const match = errorTitle.match(/^([A-Za-z0-9_]+Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError)/);
  if (match) return match[1];
  return 'Error';
}

export class DiagnosticReportGenerator {
  /**
   * Generates a canonical Markdown AI Diagnostic Report for a single issue.
   */
  static generateSingleReport(
    issue: NormalizedPostHogIssue,
    detail?: any
  ): string {
    const sanitizedName = scrubSensitiveData(issue.name || 'Unnamed Exception');
    const exceptionType = extractExceptionType(sanitizedName);
    const incidentId = `INC-ph_${issue.id}`;
    const generatedAt = new Date().toISOString();

    const appName =
      issue.app === 'student'
        ? 'student (`lpuevents.live`)'
        : issue.app === 'admin'
        ? 'admin (`admin.lpuevents.live`)'
        : issue.app === 'backend'
        ? 'backend (`api.lpuevents.live` / Supabase Edge)'
        : 'multi-platform';

    const usersMetric =
      issue.app === 'backend' || issue.users === 'N/A'
        ? '`N/A (Backend Service Event)`'
        : `\`${issue.users}\``;

    const occurrencesMetric = issue.occurrences;
    const releaseMetric = issue.release || 'unknown';
    const firstSeen = issue.firstSeen || 'Unavailable';
    const lastSeen = issue.lastSeen || 'Unavailable';

    // Correlation ID
    const correlationId =
      detail?.properties?.correlation_id ||
      detail?.correlation_id ||
      'None recorded';

    // Parse stack trace frames
    const rawFrames =
      detail?.properties?.$exception_list?.[0]?.stacktrace?.frames ||
      detail?.stack_trace ||
      [];

    let primarySourceLocation = 'Unavailable';
    let primaryFunction = 'anonymous';
    let stackTraceBlock = '';

    if (Array.isArray(rawFrames) && rawFrames.length > 0) {
      const inAppFrames = rawFrames.filter((f: any) => f.in_app !== false);
      const topFrame = inAppFrames[inAppFrames.length - 1] || rawFrames[rawFrames.length - 1];

      if (topFrame) {
        const cleanFile = normalizeSourceFilePath(topFrame.filename || topFrame.file || '');
        const line = topFrame.lineno || topFrame.line || 1;
        const col = topFrame.colno || topFrame.col || 1;
        primarySourceLocation = `${cleanFile}:${line}:${col}`;
        primaryFunction = topFrame.function || topFrame.method || 'anonymous';
      }

      stackTraceBlock = rawFrames
        .map((f: any) => {
          const fn = f.function || f.method || 'anonymous';
          const file = normalizeSourceFilePath(f.filename || f.file || '');
          const line = f.lineno || f.line || 1;
          const col = f.colno || f.col || 1;
          return `  at ${fn} (${file}:${line}:${col})`;
        })
        .join('\n');
    } else if (typeof detail?.stack === 'string') {
      stackTraceBlock = detail.stack
        .split('\n')
        .map((line: string) => `  ${line.trim()}`)
        .join('\n');
    } else {
      stackTraceBlock = `  at ${issue.component} (src/${issue.component}:1:1)\n  Note: Detailed stack frames not returned in initial payload.`;
    }

    // Breadcrumbs
    const rawBreadcrumbs =
      detail?.properties?.$breadcrumbs ||
      detail?.breadcrumbs ||
      [];

    let breadcrumbRows = '';
    if (Array.isArray(rawBreadcrumbs) && rawBreadcrumbs.length > 0) {
      breadcrumbRows = rawBreadcrumbs
        .slice(-6)
        .map((b: any, idx: number) => {
          const relTime = `${((idx - 5) * 2).toFixed(1)}s`;
          const cat = scrubSensitiveData(b.category || 'action');
          const type = scrubSensitiveData(b.type || 'log');
          const msg = scrubSensitiveData(b.message || JSON.stringify(b.data || {}));
          return `| ${relTime} | ${type} | \`${cat}\` | ${msg.replace(/\|/g, '\\|')} |`;
        })
        .join('\n');
    } else {
      breadcrumbRows = `| 0.0s | **Exception** | \`${exceptionType}\` | Crash in \`${issue.component}\` |`;
    }

    const subprojectFolder =
      issue.app === 'admin'
        ? 'lpu-events-admin'
        : issue.app === 'backend'
        ? 'lpu-events-admin/supabase/functions'
        : 'lpu-events-student';

    return `# LPU Events — AI Diagnostic Report

**Incident ID:** \`${incidentId}\`  
**Generated At:** ${generatedAt}  
**Report Version:** 1.3  

---

### 1. Issue Summary

| Attribute | Value | Note |
|---|---|---|
| **Error Title** | \`${sanitizedName.replace(/\|/g, '\\|')}\` | Normalized message |
| **Exception Type** | \`${exceptionType}\` | Runtime exception category |
| **Severity (Derived)** | \`${issue.severity}\` | Derived triage priority |
| **Application Surface** | ${appName} | Originating client/server surface |
| **Environment** | \`${issue.environment}\` | Runtime environment |
| **Component / Endpoint** | \`${issue.component}\` | Primary responsible module |
| **Issue Status** | \`${issue.status}\` | PostHog issue status |
| **PostHog Issue URL** | ${issue.deepLink} | Direct deep link to PostHog web console |

---

### 2. Occurrence & Exposure Metrics

| Metric | Value | Architectural Meaning |
|---|---|---|
| **PostHog Ingested Exceptions** | \`${occurrencesMetric}\` | Total $exception events captured |
| **Unique Affected Users** | ${usersMetric} | Distinct users (N/A for backend service events) |
| **First Seen** | \`${firstSeen}\` | Timestamp of first ingested event |
| **Last Seen** | \`${lastSeen}\` | Timestamp of most recent ingested event |
| **Release / Git Commit** | \`${releaseMetric}\` | Build-time injected commit identifier |

> ⓘ **Deduplication Note:** Client-side rate-limiting enforces a 30s throttle per error fingerprint. Total real-world error encounters may be higher than ingested occurrences.

---

### 3. Symbolicated Stack Trace

\`\`\`
${sanitizedName}
${stackTraceBlock}
\`\`\`

- **Primary Source Location:** \`${primarySourceLocation}\`
- **Enclosing Function:** \`${primaryFunction}\`

---

### 4. Request Correlation & Context

| Context Key | Value |
|---|---|
| **Correlation ID** | \`${correlationId}\` |
| **Originating Surface** | \`${issue.app}\` |
| **Active Environment** | \`${issue.environment}\` |

---

### 5. Client Breadcrumb Trail (Recent Events)

| Rel. Time | Event Type | Category / Destination | Payload / Message |
|---|---|---|---|
${breadcrumbRows}

---

### 6. Backend & Database Diagnostics

- **Correlation ID Lookup:** \`${correlationId}\`
- **Backend Log Search:** Use Section D (Backend Logs Explorer) with correlation ID to query ClickHouse \`function_logs\`.
- **Database Mutation Guard:** Monorepo rule enforces zero direct monitoring writes to PostgreSQL.

---

### 7. Evidence Classification & Root-Cause Assessment

#### Confirmed Observations
- The exception is \`${sanitizedName}\` observed in component \`${issue.component}\`.
- Originates from application surface: \`${issue.app}\`.
- Associated release commit: \`${releaseMetric}\`.

#### Probable Causes
- Schema mismatch, unhandled null/undefined object access, or edge function timeout.
- Unhandled API 5xx technical response triggering frontend error boundary.

---

### 8. Strict AI Coding Agent Instructions

\`\`\`text
================================================================================
MANDATORY INSTRUCTIONS FOR AI CODING AGENT:
================================================================================
You are investigating a production bug report from LPU Events. Follow these
strict rules to solve the problem safely:

1. REPOSITORY INSPECTION:
   - Open and read the actual source file in the correct subproject:
     ${subprojectFolder}/${issue.component}
   - Inspect the code logic thoroughly. Do NOT assume file contents.

2. TRACE DATA FLOW:
   - Trace props, state, and API payload contracts end-to-end.
   - Verify TypeScript type definitions in packages/shared/src/types.ts.
   - Check whether fields being accessed are optional or nullable.

3. ROOT-CAUSE VERIFICATION:
   - Fix the fundamental root cause, not just symptoms with blind optional chaining.
   - Provide safe fallbacks if legitimate null values are expected.

4. WRITE REPRODUCING REGRESSION TEST:
   - Add unit tests verifying the fix and preventing regressions.

5. VERIFY ZERO CODE BREAKAGE:
   - Run typecheck in the affected subproject: npm run typecheck
   - Verify zero TypeScript compiler errors before completing.
================================================================================
\`\`\`
`;
  }

  /**
   * Generates a multi-issue bundled report respecting the 25-issue limit.
   */
  static generateBundleReport(
    issues: NormalizedPostHogIssue[],
    detailsMap?: Map<string, any>
  ): { markdown: string; isTruncated: boolean; totalProvided: number } {
    if (!issues || issues.length === 0) {
      return {
        markdown: '# LPU Events — AI Diagnostic Report\n\nNo issues selected for export.',
        isTruncated: false,
        totalProvided: 0,
      };
    }

    const totalProvided = issues.length;
    const isTruncated = totalProvided > MAX_BUNDLE_ISSUES;
    const cappedIssues = isTruncated ? issues.slice(0, MAX_BUNDLE_ISSUES) : issues;

    const sections = cappedIssues.map((issue) => {
      const detail = detailsMap?.get(issue.id);
      return this.generateSingleReport(issue, detail);
    });

    let bundleMarkdown = sections.join('\n\n---\n\n');

    if (isTruncated) {
      const excessCount = totalProvided - MAX_BUNDLE_ISSUES;
      bundleMarkdown += `\n\n---\n\n> ⚠️ **BUNDLE TRUNCATED**: Export capped at ${MAX_BUNDLE_ISSUES} issues. ${excessCount} additional issues were omitted to preserve memory and clipboard capacity.\n`;
    }

    return {
      markdown: bundleMarkdown,
      isTruncated,
      totalProvided,
    };
  }
}
