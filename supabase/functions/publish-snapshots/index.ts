// lpu-events-admin/supabase/functions/publish-snapshots/index.ts
// LPU Events — Trusted Server-Side R2 Public Content Snapshot Publisher Edge Function
// Generates immutable revisioned snapshots and publishes manifest to Cloudflare R2.
// Invoked securely after successful database mutations or via scheduled reconciliation.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

// S3 / R2 Signing Utilities via Web Crypto
async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

async function uploadToR2S3(
  config: R2Config,
  key: string,
  bodyText: string,
  contentType: string,
  cacheControl: string
): Promise<{ success: boolean; error?: string }> {
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    return {
      success: false,
      error: "Missing R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)",
    };
  }

  const cleanKey = key.replace(/^\/+/, "");
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${config.bucketName}/${cleanKey}`;

  const bodyBytes = new TextEncoder().encode(bodyText);
  const bodyHash = await sha256Hex(bodyBytes);

  const now = new Date();
  const dateIso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateShort = dateIso.substring(0, 8);
  const region = "auto";
  const service = "s3";

  const canonicalHeaders = [
    `cache-control:${cacheControl}`,
    `content-length:${bodyBytes.byteLength}`,
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${bodyHash}`,
    `x-amz-date:${dateIso}`,
  ].join("\n") + "\n";

  const signedHeaders = "cache-control;content-length;content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    `/${config.bucketName}/${cleanKey}`,
    "",
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));

  const credentialScope = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateIso,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${config.secretAccessKey}`), dateShort);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  try {
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Host": host,
        "Content-Type": contentType,
        "Content-Length": String(bodyBytes.byteLength),
        "Cache-Control": cacheControl,
        "x-amz-content-sha256": bodyHash,
        "x-amz-date": dateIso,
        "Authorization": authHeader,
      },
      body: bodyBytes,
    });

    if (res.ok) {
      return { success: true };
    }
    const errTxt = await res.text().catch(() => "");
    return { success: false, error: `R2 S3 HTTP ${res.status}: ${errTxt}` };
  } catch (err: any) {
    return { success: false, error: `R2 network error: ${err?.message || String(err)}` };
  }
}

async function getObjectFromR2S3(
  config: R2Config,
  key: string
): Promise<{ exists: boolean; data?: string; error?: string }> {
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    return { exists: false, error: "Missing R2 credentials" };
  }

  const cleanKey = key.replace(/^\/+/, "");
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${config.bucketName}/${cleanKey}`;
  const emptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  const now = new Date();
  const dateIso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateShort = dateIso.substring(0, 8);
  const region = "auto";
  const service = "s3";

  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${emptyHash}`,
    `x-amz-date:${dateIso}`,
  ].join("\n") + "\n";

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "GET",
    `/${config.bucketName}/${cleanKey}`,
    "",
    canonicalHeaders,
    signedHeaders,
    emptyHash,
  ].join("\n");

  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const credentialScope = `${dateShort}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateIso,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${config.secretAccessKey}`), dateShort);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Host": host,
        "x-amz-content-sha256": emptyHash,
        "x-amz-date": dateIso,
        "Authorization": authHeader,
      },
    });

    if (res.ok) {
      const data = await res.text();
      return { exists: true, data };
    }
    return { exists: false };
  } catch (err: any) {
    return { exists: false, error: err?.message || String(err) };
  }
}

// Student safe settings allowlist
const STUDENT_SAFE_SETTING_KEYS = new Set([
  'maintenance_mode',
  'platform_maintenance_mode',
  'site_notice_banner',
  'ad_system_config',
  'happening_today_config',
  'initial_event_limit',
  'show_more_increment',
  'ad_placement_interval',
]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let queueId: string | null = null;
  let revision: string | null = null;
  let supabaseAdmin: any = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Edge function misconfigured: missing server credentials" }),
        { status: 500, headers: corsHeaders }
      );
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  // 1. Authenticate caller (Must be super_admin/admin, service_role, or match SNAPSHOT_CRON_SECRET)
  const authHeader = req.headers.get("Authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedCronSecret = Deno.env.get("SNAPSHOT_CRON_SECRET");

  let isAuthorized = false;
  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    isAuthorized = true;
  } else if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token === supabaseServiceKey) {
      isAuthorized = true;
    } else {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user?.id) {
        const { data: adminUser } = await supabaseAdmin
          .from("admin_users")
          .select("id, is_active")
          .eq("auth_user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (adminUser) {
          isAuthorized = true;
        }
      }
    }
  }

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Administrator privileges or valid secret required to publish snapshots" }),
      { status: 401, headers: corsHeaders }
    );
  }

  // 2. Parse request options & parameters
  let reqBody: any = {};
  if (req.method === "POST") {
    try {
      reqBody = await req.json();
    } catch {}
  }

  const url = new URL(req.url);
  const isDryRun = url.searchParams.get("dry_run") === "true" || reqBody.dry_run === true;
  queueId = reqBody.queue_id || null;
  let generation: number = Number(reqBody.generation) || 0;
  revision = reqBody.revision || null;

  if (!queueId) {
    try {
      const { data: claimed } = await supabaseAdmin.rpc("claim_snapshot_publication", {
        p_worker_id: "edge-publisher"
      });
      if (Array.isArray(claimed) && claimed.length > 0 && claimed[0].id) {
        queueId = claimed[0].id;
        if (!revision && claimed[0].revision) revision = claimed[0].revision;
        if (!generation && claimed[0].generation) generation = Number(claimed[0].generation);
      } else if (reqBody.force_full_publish || reqBody.trigger_source === "MANUAL") {
        const { data: enqueuedId } = await supabaseAdmin.rpc("enqueue_snapshot_publication", {
          p_trigger_source: "MANUAL",
        });
        if (enqueuedId) {
          const { data: newlyClaimed } = await supabaseAdmin.rpc("claim_snapshot_publication", {
            p_worker_id: "edge-publisher"
          });
          if (Array.isArray(newlyClaimed) && newlyClaimed.length > 0 && newlyClaimed[0].id) {
            queueId = newlyClaimed[0].id;
            if (!revision && newlyClaimed[0].revision) revision = newlyClaimed[0].revision;
            if (!generation && newlyClaimed[0].generation) generation = Number(newlyClaimed[0].generation);
          }
        }
      }
    } catch {}
  } else if (!generation) {
    try {
      const { data: qRow } = await supabaseAdmin
        .from("snapshot_publication_queue")
        .select("generation, revision")
        .eq("id", queueId)
        .maybeSingle();
      if (qRow?.generation) generation = Number(qRow.generation);
      if (!revision && qRow?.revision) revision = qRow.revision;
    } catch {}
  }

  // Gracefully handle scheduler invocations with empty queue
  const isSchedulerInvocation = Boolean(
    !reqBody.force_full_publish &&
    reqBody.trigger_source !== "MANUAL" &&
    (cronSecret || reqBody.trigger_source === "SCHEDULE")
  );
  if (isSchedulerInvocation && !queueId) {
    return new Response(
      JSON.stringify({ ok: true, status: "IDLE", message: "No pending publications in queue" }),
      { status: 200, headers: corsHeaders }
    );
  }

  if (!generation) {
    generation = Date.now();
  }

  const r2Config: R2Config = {
    accountId: Deno.env.get("R2_ACCOUNT_ID") || "",
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID") || "",
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY") || "",
    bucketName: Deno.env.get("R2_BUCKET_NAME") || "lpu-events-media",
  };

  const hasR2Creds = Boolean(
    r2Config.accountId && r2Config.accessKeyId && r2Config.secretAccessKey && r2Config.bucketName
  );

  // 3. Execution: Generate snapshot payloads with consistency check
  const now = new Date();
  const timePart = now.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const randPart = Math.random().toString(36).substring(2, 8);
  if (!revision) {
    revision = `rev_${timePart}_${randPart}`;
  }
  const generatedAt = now.toISOString();

  let categoriesData: any[] = [];
  let carouselData: any[] = [];
  let featuredData: any[] = [];
  let trendingData: any[] = [];
    let adsData: any[] = [];
    let safeSettings: any[] = [];
    let rawEvents: any[] = [];
    let vStart: Record<string, number> = {};

    // Consistent read retry loop (up to 3 attempts with backoff)
    for (let attempt = 0; attempt < 3; attempt++) {
      vStart = {};
      try {
        const { data: vData } = await supabaseAdmin.rpc("get_resource_versions");
        if (Array.isArray(vData)) {
          for (const row of vData) {
            if (row.resource) vStart[row.resource] = Number(row.version) || 1;
          }
        }
      } catch {}

      const [catRes, carRes, featRes, trendRes, adsRes, settRes, evtRes] = await Promise.all([
        supabaseAdmin
          .from("categories")
          .select("id,key,name,sort_order,subcategories(id,key,name,sort_order)")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("carousel_items")
          .select("id,item_type,event_id,advertisement_id,media_id,sort_order,is_active,start_at,end_at,display_duration_ms,custom_title,custom_subtitle,custom_cta_text,custom_cta_url,badge_text,events:event_id(id,name,description,start_at,end_at,venue_name,registration_mode,pricing_type,banner_media_id,status,category_id,subcategory_id,media_assets:banner_media_id(id,object_key),organizations(name),categories(name,key),subcategories(name,key)),advertisements:advertisement_id(id,name,redirect_url,media_id,status),media_assets:media_id(id,object_key)")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("featured_events")
          .select("event_id,sort_order,events(id,name,description,start_at,end_at,venue_name,registration_mode,pricing_type,price_amount,external_registration_url,banner_media_id,status,category_id,subcategory_id,media_assets:banner_media_id(id,object_key),organizations(id,name))")
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("trending_events")
          .select("event_id,sort_order,events(id,name,description,start_at,end_at,venue_name,registration_mode,pricing_type,price_amount,external_registration_url,banner_media_id,status,category_id,subcategory_id,media_assets:banner_media_id(id,object_key),organizations(id,name),categories(name,key),subcategories(name,key))")
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("advertisements")
          .select("id,name,media_id,redirect_url,start_at,end_at,status,media_assets:media_id(id,object_key)")
          .eq("status", "active"),
        supabaseAdmin
          .from("global_settings")
          .select("key,value"),
        supabaseAdmin
          .from("events")
          .select("id,name,description,start_at,end_at,venue_name,registration_mode,pricing_type,price_amount,external_registration_url,registration_format,capacity_limit,banner_media_id,organization_id,status,category_id,subcategory_id,created_at,updated_at,media_assets:banner_media_id(id,object_key),organizations(id,name),categories(id,name,key),subcategories(id,name,key),event_content_sections(id,section_type,title,content,sort_order)")
          .eq("status", "PUBLISHED")
          .order("start_at", { ascending: true })
      ]);

      if (catRes.error) throw new Error(`Failed to read categories: ${catRes.error.message}`);
      if (evtRes.error) throw new Error(`Failed to read published events: ${evtRes.error.message}`);

      categoriesData = catRes.data || [];
      carouselData = carRes.data || [];
      featuredData = featRes.data || [];
      trendingData = trendRes.data || [];
      adsData = adsRes.data || [];
      safeSettings = (settRes.data || [])
        .filter((s: any) => STUDENT_SAFE_SETTING_KEYS.has(s.key))
        .map((s: any) => ({ key: s.key, value: s.value }));
      rawEvents = evtRes.data || [];

      // Verify resource consistency post-read
      let hasMutated = false;
      try {
        const { data: vEndData } = await supabaseAdmin.rpc("get_resource_versions");
        if (Array.isArray(vEndData) && Object.keys(vStart).length > 0) {
          for (const row of vEndData) {
            const resKey = row.resource;
            const currentV = Number(row.version) || 1;
            const startV = vStart[resKey] || 1;
            if (currentV > startV) {
              hasMutated = true;
              console.warn(`[SnapshotPublisher] Warning: Concurrent DB mutation detected on ${resKey} (${startV} -> ${currentV}). Retrying attempt ${attempt + 1}...`);
              break;
            }
          }
        }
      } catch {}

      if (!hasMutated) {
        break;
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 60 * (attempt + 1) + Math.random() * 40));
      }
    }

    const compactCatalogue: any[] = [];
    const eventDetailsMap = new Map<string, any>();

    for (const evt of rawEvents || []) {
      if (evt.status !== "PUBLISHED") continue;

      // Prevent directory traversal: Event IDs must be alphanumeric or UUID
      if (!/^[a-zA-Z0-9_-]+$/.test(evt.id)) {
        console.warn(`[SnapshotPublisher] Skipping event with unsafe ID format: ${evt.id}`);
        continue;
      }

      const posterUrl = evt.media_assets?.object_key
        ? (evt.media_assets.object_key.startsWith("http")
            ? evt.media_assets.object_key
            : `https://images.lpuevents.live/${evt.media_assets.object_key.replace(/^\/+/, "")}`)
        : null;

      compactCatalogue.push({
        id: evt.id,
        name: evt.name,
        category_id: evt.category_id,
        subcategory_id: evt.subcategory_id,
        category_name: evt.categories?.name,
        subcategory_name: evt.subcategories?.name,
        organization_name: evt.organizations?.name,
        poster_url: posterUrl,
        start_at: evt.start_at,
        end_at: evt.end_at,
        venue_name: evt.venue_name || "LPU Campus",
        registration_mode: evt.registration_mode || "NONE",
        external_registration_url: evt.external_registration_url || null,
        pricing_type: evt.pricing_type === "PAID" ? "PAID" : "FREE",
        status: "PUBLISHED",
      });

      eventDetailsMap.set(evt.id, {
        schema_version: "1.0.0",
        revision,
        generated_at: generatedAt,
        event: {
          ...evt,
          event_content_sections: Array.isArray(evt.event_content_sections)
            ? evt.event_content_sections.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            : [],
        },
      });
    }

    const homepagePayload = {
      schema_version: "1.0.0",
      revision,
      generated_at: generatedAt,
      categories: categoriesData || [],
      carousel: (carouselData || []).filter((c: any) => c.is_active),
      featured: (featuredData || []).map((f: any) => f.events).filter(Boolean),
      trending: (trendingData || []).map((t: any) => t.events).filter(Boolean),
      advertisements: adsData || [],
      settings: safeSettings,
      events: (rawEvents || []).slice(0, 20),
    };

    const cataloguePayload = {
      schema_version: "1.0.0",
      revision,
      generated_at: generatedAt,
      total_count: compactCatalogue.length,
      events: compactCatalogue,
    };

    const categoriesPayload = {
      schema_version: "1.0.0",
      revision,
      generated_at: generatedAt,
      total_count: (categoriesData || []).length,
      categories: categoriesData || [],
    };

    const manifestPayload = {
      schema_version: "1.0.0",
      revision,
      generation,
      published_at: generatedAt,
      resources: {
        homepage: `revisions/${revision}/homepage.json`,
        catalogue: `revisions/${revision}/events-catalogue.json`,
        categories: `revisions/${revision}/categories.json`,
        event_details_dir: `revisions/${revision}/event-details`,
      },
      meta: {
        active_event_count: compactCatalogue.length,
        past_event_count: 0,
        category_count: (categoriesData || []).length,
        carousel_count: homepagePayload.carousel.length,
        ad_count: (adsData || []).length,
        db_resource_versions: vStart,
      },
    };

    // If Dry Run or R2 credentials not configured, return preview without failing
    if (isDryRun || !hasR2Creds) {
      if (queueId) {
        try {
          await supabaseAdmin.rpc("complete_snapshot_publication", {
            p_queue_id: queueId,
            p_revision: revision,
            p_artifacts: ["preview_only"],
            p_total_bytes: 0,
          });
        } catch {}
      }

      return new Response(
        JSON.stringify({
          ok: true,
          mode: isDryRun ? "dry_run" : "validation_preview",
          revision,
          published_at: generatedAt,
          r2_configured: hasR2Creds,
          stats: {
            events_count: compactCatalogue.length,
            categories_count: (categoriesData || []).length,
            homepage_events: homepagePayload.events.length,
          },
          manifest: manifestPayload,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 4. Upload immutable revision objects to R2
    const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
    const MANIFEST_CACHE = "public, max-age=60, s-maxage=60, stale-while-revalidate=300";
    const uploadedArtifacts: string[] = [];
    let totalBytes = 0;

    const hpStr = JSON.stringify(homepagePayload);
    const hpRes = await uploadToR2S3(
      r2Config,
      `public-content/revisions/${revision}/homepage.json`,
      hpStr,
      "application/json; charset=utf-8",
      IMMUTABLE_CACHE
    );
    if (!hpRes.success) throw new Error(`Failed to upload homepage: ${hpRes.error}`);
    uploadedArtifacts.push(`public-content/revisions/${revision}/homepage.json`);
    totalBytes += new TextEncoder().encode(hpStr).byteLength;

    const catStr = JSON.stringify(cataloguePayload);
    const catRes = await uploadToR2S3(
      r2Config,
      `public-content/revisions/${revision}/events-catalogue.json`,
      catStr,
      "application/json; charset=utf-8",
      IMMUTABLE_CACHE
    );
    if (!catRes.success) throw new Error(`Failed to upload catalogue: ${catRes.error}`);
    uploadedArtifacts.push(`public-content/revisions/${revision}/events-catalogue.json`);
    totalBytes += new TextEncoder().encode(catStr).byteLength;

    const catgStr = JSON.stringify(categoriesPayload);
    const catgRes = await uploadToR2S3(
      r2Config,
      `public-content/revisions/${revision}/categories.json`,
      catgStr,
      "application/json; charset=utf-8",
      IMMUTABLE_CACHE
    );
    if (!catgRes.success) throw new Error(`Failed to upload categories: ${catgRes.error}`);
    uploadedArtifacts.push(`public-content/revisions/${revision}/categories.json`);
    totalBytes += new TextEncoder().encode(catgStr).byteLength;

    // Upload individual event details
    for (const [evtId, detailObj] of eventDetailsMap.entries()) {
      const dStr = JSON.stringify(detailObj);
      const dRes = await uploadToR2S3(
        r2Config,
        `public-content/revisions/${revision}/event-details/${evtId}.json`,
        dStr,
        "application/json; charset=utf-8",
        IMMUTABLE_CACHE
      );
      if (!dRes.success) throw new Error(`Failed to upload event detail ${evtId}: ${dRes.error}`);
      uploadedArtifacts.push(`public-content/revisions/${revision}/event-details/${evtId}.json`);
      totalBytes += new TextEncoder().encode(dStr).byteLength;
    }

    // 5. Concurrency & Stale Overwrite Prevention: Inspect active manifest on R2
    if (hasR2Creds) {
      const activeManifestRes = await getObjectFromR2S3(r2Config, "public-content/manifest.json");
      if (activeManifestRes.exists && activeManifestRes.data) {
        try {
          const activeManifest = JSON.parse(activeManifestRes.data);
          const activeGen = Number(activeManifest.generation) || 0;
          const activeTime = activeManifest.published_at ? new Date(activeManifest.published_at).getTime() : 0;
          const curTime = new Date(manifestPayload.published_at).getTime();

          const isSuperseded = (activeGen > 0 && activeGen >= generation) || (activeTime > curTime);
          if (isSuperseded) {
            console.warn(`[SnapshotPublisher] Stale overwrite prevented: active revision (${activeManifest.revision}, gen ${activeGen}) is newer or equal to current (${revision}, gen ${generation}).`);
            if (queueId) {
              try {
                await supabaseAdmin.rpc("complete_snapshot_publication", {
                  p_queue_id: queueId,
                  p_revision: revision,
                  p_artifacts: uploadedArtifacts,
                  p_total_bytes: totalBytes,
                  p_generation: generation,
                });
              } catch {}
            }
            return new Response(
              JSON.stringify({
                ok: true,
                status: "SUPERSEDED",
                revision,
                generation,
                active_revision: activeManifest.revision,
                active_generation: activeGen,
                message: "Newer revision already published on R2",
              }),
              { status: 200, headers: corsHeaders }
            );
          }
        } catch {}
      }
    }

    // 6. Database Manifest Promotion: Enforce monotonic lock generation
    try {
      const { data: promoRes } = await supabaseAdmin.rpc("promote_snapshot_manifest", {
        p_queue_id: queueId,
        p_revision: revision,
        p_generation: generation,
        p_worker_id: "edge-publisher",
        p_artifacts: uploadedArtifacts,
        p_total_bytes: totalBytes,
      });
      if (promoRes && promoRes.promoted === false) {
        console.warn(`[SnapshotPublisher] Stale DB generation conflict: ${promoRes.reason}. Active generation is ${promoRes.current_generation}.`);
        return new Response(
          JSON.stringify({
            ok: true,
            status: "SUPERSEDED",
            revision,
            generation,
            active_generation: promoRes.current_generation,
            active_revision: promoRes.active_revision,
            message: "Newer generation already active in database",
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    } catch {
      // Fallback: If promote_snapshot_manifest RPC not yet present in target env, use complete_snapshot_publication
      if (queueId) {
        try {
          await supabaseAdmin.rpc("complete_snapshot_publication", {
            p_queue_id: queueId,
            p_revision: revision,
            p_artifacts: uploadedArtifacts,
            p_total_bytes: totalBytes,
            p_generation: generation,
          });
        } catch {}
      }
    }

    // 7. Update Manifest last! Readers will only see the new revision once this completes.
    const isUrgent = reqBody.is_urgent === true;
    const effectiveManifestCache = isUrgent
      ? "public, max-age=0, s-maxage=0, must-revalidate"
      : MANIFEST_CACHE;

    const mStr = JSON.stringify(manifestPayload, null, 2);
    const mRes = await uploadToR2S3(
      r2Config,
      "public-content/manifest.json",
      mStr,
      "application/json; charset=utf-8",
      effectiveManifestCache
    );
    if (!mRes.success) {
      throw new Error(`CRITICAL: Manifest update failed: ${mRes.error}. Revision not promoted.`);
    }
    uploadedArtifacts.push("public-content/manifest.json");
    totalBytes += new TextEncoder().encode(mStr).byteLength;

    // 8. Post-write verification: ensure an older concurrent publisher did not overwrite our newer manifest
    if (hasR2Creds) {
      try {
        const postCheckRes = await getObjectFromR2S3(r2Config, "public-content/manifest.json");
        if (postCheckRes.exists && postCheckRes.data) {
          const postManifest = JSON.parse(postCheckRes.data);
          const postGen = Number(postManifest.generation) || 0;
          if (generation > 0 && postGen > 0 && postGen < generation) {
            console.warn(`[SnapshotPublisher] Race detected: older generation (${postGen}) overwrote current (${generation}). Re-asserting newer manifest.`);
            await uploadToR2S3(
              r2Config,
              "public-content/manifest.json",
              mStr,
              "application/json; charset=utf-8",
              effectiveManifestCache
            );
          }
        }
      } catch {}
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: "PUBLISHED",
        revision,
        published_at: generatedAt,
        manifest_path: "public-content/manifest.json",
        stats: {
          events_count: compactCatalogue.length,
          categories_count: (categoriesData || []).length,
          details_uploaded: eventDetailsMap.size,
          total_bytes: totalBytes,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    const errorMsg = `Snapshot publication failed: ${err?.message || String(err)}`;
    try {
      if (queueId && supabaseAdmin) {
        await supabaseAdmin.rpc("fail_snapshot_publication", {
          p_queue_id: queueId,
          p_error: errorMsg,
        });
      }
    } catch {}

    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMsg,
        stack: err?.stack || null,
        revision,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
