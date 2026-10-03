// supabase/functions/r2-storage/index.ts
// LPU Events — Cloudflare R2 Administrative Storage Management Edge Function
// Handles: HeadObject, DeleteObject, Batch Deletion Claim Leases, and Verification.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Content-Type": "application/json",
};

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

async function deleteFromR2(
  config: { accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string },
  key: string
): Promise<{ success: boolean; error?: string }> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${config.bucketName}/${key.replace(/^\/+/, "")}`;
  const now = new Date();
  const dateIso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateShort = dateIso.substring(0, 8);
  const region = "auto";
  const service = "s3";

  const emptyHash = await sha256Hex(new Uint8Array(0));

  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${emptyHash}`,
    `x-amz-date:${dateIso}`,
  ].join("\n") + "\n";

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "DELETE",
    `/${config.bucketName}/${key.replace(/^\/+/, "")}`,
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
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "Host": host,
        "x-amz-content-sha256": emptyHash,
        "x-amz-date": dateIso,
        "Authorization": authHeader,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errText = await response.text();
      return { success: false, error: `R2 DELETE ${response.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reach Cloudflare R2 endpoint" };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization bearer token." }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);

  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid session." }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!adminUser || !adminUser.is_active) {
    return new Response(JSON.stringify({ error: "Unauthorized: Active administrative account required." }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  const { data: platformRole } = await supabase
    .from("platform_admin_roles")
    .select("role")
    .eq("admin_user_id", adminUser.id)
    .maybeSingle();

  if (platformRole?.role !== "SUPER_ADMIN") {
    return new Response(JSON.stringify({ error: "Forbidden: Super Administrator access required." }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    const { action, object_keys } = await req.json();

    const r2AccountId = Deno.env.get("R2_ACCOUNT_ID") || "";
    const r2AccessKey = Deno.env.get("R2_ACCESS_KEY_ID") || "";
    const r2SecretKey = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
    const bucketName = Deno.env.get("R2_BUCKET_NAME") || "lpu-events-images";

    if (action === "delete_objects") {
      const keysToDelete: string[] = Array.isArray(object_keys) ? object_keys : [];
      if (keysToDelete.length === 0 || keysToDelete.length > 100 || keysToDelete.some((key) =>
        typeof key !== "string" ||
        key.length > 512 ||
        key.startsWith("/") ||
        key.includes("..") ||
        key.includes("\\") ||
        !/^[A-Za-z0-9._/-]+$/.test(key)
      )) {
        return new Response(JSON.stringify({ error: "Invalid or excessive object key list." }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const deleted: string[] = [];
      const failed: string[] = [];

      if (!r2AccountId || !r2AccessKey || !r2SecretKey) {
        return new Response(JSON.stringify({ error: "R2 deletion is not configured." }), {
          status: 503,
          headers: corsHeaders,
        });
      }

      for (const key of keysToDelete) {
        const res = await deleteFromR2(
          { accountId: r2AccountId, accessKeyId: r2AccessKey, secretAccessKey: r2SecretKey, bucketName },
          key
        );
        if (res.success) {
          deleted.push(key);
        } else {
          failed.push(key);
        }
      }

      return new Response(JSON.stringify({ success: failed.length === 0, deleted, failed }), {
        status: failed.length === 0 ? 200 : 502,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action." }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error." }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
