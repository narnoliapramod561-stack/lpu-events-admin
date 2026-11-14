// lpu-events-admin/supabase/functions/superadmin-monitoring/providers/gsc.ts
// Google Search Console (GSC) API Client (MON-004 / MON-006 / MON-008 Stage 7 & 13)

import type { GscOverviewData, GscDimensionRow, ProviderConnectivityStatus } from "../types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

const GSC_BASE_DASHBOARD = "https://search.google.com/search-console";
const GSC_DELAY_NOTICE = "Note: Search Console performance data reflects search activity from 2–3 days ago (Google platform delay).";
const DEFAULT_SITE_URL = "https://lpuevents.live/";

function getServiceAccountJson(providedJson?: string): string {
  if (providedJson) return providedJson;
  if (typeof Deno !== "undefined") {
    return Deno.env.get("GSC_SERVICE_ACCOUNT_JSON") || "";
  }
  return "";
}

function getSiteUrl(providedUrl?: string): string {
  if (providedUrl) return providedUrl;
  if (typeof Deno !== "undefined") {
    const envUrl = Deno.env.get("GSC_SITE_URL");
    if (envUrl) return envUrl;
  }
  return DEFAULT_SITE_URL;
}

/**
 * Creates an OAuth2 access token for Google API using service account credentials.
 * Uses Web Crypto API natively available in Deno and browsers.
 */
async function getGoogleAccessToken(serviceAccountRaw: string): Promise<string> {
  let parsed: any;
  try {
    parsed = JSON.parse(serviceAccountRaw);
  } catch {
    throw new Error("GSC_SERVICE_ACCOUNT_JSON contains invalid JSON syntax.");
  }

  const clientEmail = parsed.client_email;
  let privateKeyPem = parsed.private_key;

  if (!clientEmail || !privateKeyPem) {
    throw new Error("Invalid GSC_SERVICE_ACCOUNT_JSON structure: missing client_email or private_key.");
  }

  // Handle literal escaped newlines that frequently occur in cloud secret managers
  privateKeyPem = privateKeyPem.replace(/\\n/g, "\n");

  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowSec + 3600,
    iat: nowSec,
  };

  const b64Url = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${b64Url(header)}.${b64Url(claimSet)}`;

  // Clean PEM key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer.slice(binaryDer.byteOffset, binaryDer.byteOffset + binaryDer.byteLength),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signedJwt = `${unsignedToken}.${signatureB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    throw new Error(`Google OAuth2 token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/**
 * Execute Search Analytics query against Google Search Console API.
 * Gracefully tries alternative site property formats if a 403 / 404 occurs.
 */
async function executeGscQuery(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<{ data: any; propertyUsed: string }> {
  // Construct potential property identifiers to handle URL-prefix vs domain property mismatch
  const candidates: string[] = [siteUrl];
  if (siteUrl.endsWith("/")) {
    candidates.push(siteUrl.slice(0, -1));
  } else {
    candidates.push(`${siteUrl}/`);
  }
  const cleanDomain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  candidates.push(`sc-domain:${cleanDomain}`);

  const uniqueCandidates = Array.from(new Set(candidates));
  let lastError = "";

  for (const candidate of uniqueCandidates) {
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(candidate)}/searchAnalytics/query`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      return { data, propertyUsed: candidate };
    }

    const errBody = await res.text().catch(() => "");
    lastError = `Property '${candidate}': ${res.status} ${errBody || res.statusText}`;

    // If error is not 403 or 404 (e.g. rate limit 429, auth 401), don't keep trying other URLs
    if (res.status !== 403 && res.status !== 404) {
      break;
    }
  }

  throw new Error(`GSC query failed across candidate properties: ${lastError}`);
}

export async function fetchGscOverview(options?: {
  days?: number;
  serviceAccountJson?: string;
  siteUrl?: string;
}): Promise<GscOverviewData> {
  const saJson = getServiceAccountJson(options?.serviceAccountJson);
  const days = options?.days || 28;
  const initialSiteUrl = getSiteUrl(options?.siteUrl);

  // 72h platform buffer accounts for Pacific Time processing lag
  const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  const startIso = startDate.toISOString().split("T")[0];
  const endIso = endDate.toISOString().split("T")[0];

  const defaultDeepLink = GSC_BASE_DASHBOARD;

  if (!saJson) {
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      dateRange: { startDate: startIso, endDate: endIso },
      delayNotice: GSC_DELAY_NOTICE,
      deepLink: defaultDeepLink,
      status: "unconfigured",
      errorMessage: "GSC_SERVICE_ACCOUNT_JSON is not configured in Supabase Secrets.",
      propertyUrl: initialSiteUrl,
    };
  }

  try {
    const accessToken = await getGoogleAccessToken(saJson);

    // 1. Overall Aggregates Query
    const { data: overviewData, propertyUsed } = await executeGscQuery(
      accessToken,
      initialSiteUrl,
      {
        startDate: startIso,
        endDate: endIso,
        rowLimit: 1,
      }
    );

    const rows = overviewData.rows || [];
    const firstRow = rows[0] || {};

    const clicks = firstRow.clicks || 0;
    const impressions = firstRow.impressions || 0;
    const ctr = firstRow.ctr ? Math.round(firstRow.ctr * 10000) / 100 : 0;
    const position = firstRow.position ? Math.round(firstRow.position * 10) / 10 : 0;

    // 2. Query Top Search Keywords
    let topQueries: GscDimensionRow[] = [];
    try {
      const { data: queryData } = await executeGscQuery(accessToken, propertyUsed, {
        startDate: startIso,
        endDate: endIso,
        dimensions: ["query"],
        rowLimit: 8,
      });
      topQueries = (queryData.rows || []).map((r: any): GscDimensionRow => ({
        key: r.keys?.[0] || "(not provided)",
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr ? Math.round(r.ctr * 10000) / 100 : 0,
        position: r.position ? Math.round(r.position * 10) / 10 : 0,
      }));
    } catch {
      // Non-blocking query failure
    }

    // 3. Query Top Landing Pages
    let topPages: GscDimensionRow[] = [];
    try {
      const { data: pageData } = await executeGscQuery(accessToken, propertyUsed, {
        startDate: startIso,
        endDate: endIso,
        dimensions: ["page"],
        rowLimit: 8,
      });
      topPages = (pageData.rows || []).map((r: any): GscDimensionRow => ({
        key: r.keys?.[0] || "(unknown page)",
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr ? Math.round(r.ctr * 10000) / 100 : 0,
        position: r.position ? Math.round(r.position * 10) / 10 : 0,
      }));
    } catch {
      // Non-blocking page failure
    }

    const dynamicDeepLink = `${GSC_BASE_DASHBOARD}/performance/search-analytics?resource_id=${encodeURIComponent(propertyUsed)}`;

    return {
      clicks,
      impressions,
      ctr,
      position,
      dateRange: { startDate: startIso, endDate: endIso },
      delayNotice: GSC_DELAY_NOTICE,
      deepLink: dynamicDeepLink,
      topQueries,
      topPages,
      status: "connected",
      propertyUrl: propertyUsed,
    };
  } catch (err: any) {
    const errorMsg = err.message || "Failed to fetch live GSC data";
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      dateRange: { startDate: startIso, endDate: endIso },
      delayNotice: GSC_DELAY_NOTICE,
      deepLink: defaultDeepLink,
      status: "error",
      errorMessage: errorMsg,
      propertyUrl: initialSiteUrl,
    };
  }
}

export async function pingGsc(options?: {
  serviceAccountJson?: string;
}): Promise<ProviderConnectivityStatus> {
  const start = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const saJson = getServiceAccountJson(options?.serviceAccountJson);
    if (!saJson) {
      return { connected: false, error: "GSC_SERVICE_ACCOUNT_JSON not configured", checkedAt };
    }
    await getGoogleAccessToken(saJson);
    const latencyMs = Math.round(performance.now() - start);
    return { connected: true, latencyMs, checkedAt };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { connected: false, latencyMs, error: err.message || "Failed to authenticate with Google", checkedAt };
  }
}
