// lpu-events-admin/supabase/functions/superadmin-monitoring/providers/gsc.ts
// Google Search Console (GSC) API Client (MON-004 / MON-006 / MON-008 Stage 7)

import type { GscOverviewData, ProviderConnectivityStatus } from "../types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

const GSC_DEEP_LINK = "https://search.google.com/search-console";
const GSC_DELAY_NOTICE = "Note: Search Console performance data reflects search activity from 2–3 days ago (Google platform delay).";
const SITE_URL = "https://lpuevents.live";

function getServiceAccountJson(providedJson?: string): string {
  if (providedJson) return providedJson;
  if (typeof Deno !== "undefined") {
    return Deno.env.get("GSC_SERVICE_ACCOUNT_JSON") || "";
  }
  return "";
}

/**
 * Creates an OAuth2 access token for Google API using service account credentials.
 * Uses Web Crypto API available natively in Deno and browsers.
 */
async function getGoogleAccessToken(serviceAccountRaw: string): Promise<string> {
  const parsed = JSON.parse(serviceAccountRaw);
  const clientEmail = parsed.client_email;
  const privateKeyPem = parsed.private_key;

  if (!clientEmail || !privateKeyPem) {
    throw new Error("Invalid GSC_SERVICE_ACCOUNT_JSON structure.");
  }

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
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKeyPem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
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
    signal: AbortSignal.timeout(5000),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google OAuth2 token exchange failed: ${tokenRes.status} ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

export async function fetchGscOverview(options?: {
  days?: number;
  serviceAccountJson?: string;
  siteUrl?: string;
}): Promise<GscOverviewData> {
  const saJson = getServiceAccountJson(options?.serviceAccountJson);
  const days = options?.days || 28;
  const siteUrl = options?.siteUrl || SITE_URL;

  const endDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  const startIso = startDate.toISOString().split("T")[0];
  const endIso = endDate.toISOString().split("T")[0];

  if (!saJson) {
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      dateRange: { startDate: startIso, endDate: endIso },
      delayNotice: GSC_DELAY_NOTICE,
      deepLink: GSC_DEEP_LINK,
    };
  }

  try {
    const accessToken = await getGoogleAccessToken(saJson);
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: startIso,
        endDate: endIso,
        rowLimit: 1,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`GSC API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rows = data.rows || [];
    const firstRow = rows[0] || {};

    return {
      clicks: firstRow.clicks || 0,
      impressions: firstRow.impressions || 0,
      ctr: firstRow.ctr ? Math.round(firstRow.ctr * 10000) / 100 : 0,
      position: firstRow.position ? Math.round(firstRow.position * 10) / 10 : 0,
      dateRange: { startDate: startIso, endDate: endIso },
      delayNotice: GSC_DELAY_NOTICE,
      deepLink: GSC_DEEP_LINK,
    };
  } catch (err: any) {
    return {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      dateRange: { startDate: startIso, endDate: endIso },
      delayNotice: `${GSC_DELAY_NOTICE} (${err.message || "Failed to fetch live GSC data"})`,
      deepLink: GSC_DEEP_LINK,
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
