import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { base64ToBytes, validateDocument } from "../_shared/documents.ts";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
const uuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST")
    return response({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!,
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
    if (!token) return response({ error: "Authentication required" }, 401);
    const service = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await service.auth.getUser(token);
    if (authError || !user)
      return response({ error: "Authentication required" }, 401);
    if (Number(req.headers.get("content-length")) > 7100000)
      return response({ error: "File too large" }, 413);
    // A streaming cap also protects requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return response({ error: "Missing body" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 7100000) {
        await reader.cancel();
        return response({ error: "File too large" }, 413);
      }
      chunks.push(next.value);
    }
    const raw = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      raw.set(chunk, offset);
      offset += chunk.length;
    }
    const body = JSON.parse(new TextDecoder().decode(raw));
    if (!uuid(body.weddingId) || !uuid(body.id))
      return response({ error: "Invalid identifiers" }, 400);
    const { data: member, error: memberError } = await service
      .from("wedding_members")
      .select("user_id")
      .eq("wedding_id", body.weddingId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberError || !member) return response({ error: "Forbidden" }, 403);
    const path = `${body.weddingId}/${body.id}`,
      bucket = service.storage.from("wedding-documents");
    if (body.action === "upload") {
      if (
        (body.vendorId != null && !uuid(body.vendorId)) ||
        (body.paymentId != null && !uuid(body.paymentId))
      )
        return response({ error: "Invalid link" }, 400);
      const bytes = base64ToBytes(body.base64),
        valid = validateDocument(body.name, body.mime, bytes);
      // Server-key uploads have no personal storage owner. Shared files survive account departure.
      const { error: uploadError } = await bucket.upload(path, bytes, {
        contentType: valid.mime_type,
        upsert: false,
      });
      if (uploadError) return response({ error: "Upload failed" }, 409);
      const { error: saveError } = await service.rpc("register_document", {
        p_user_id: user.id,
        p_id: body.id,
        p_wedding_id: body.weddingId,
        p_name: valid.name,
        p_mime_type: valid.mime_type,
        p_size: valid.size_bytes,
        p_vendor_id: body.vendorId ?? null,
        p_payment_id: body.paymentId ?? null,
      });
      if (saveError) {
        const { error: cleanupError } = await bucket.remove([path]);
        if (cleanupError)
          console.error("Orphan document requires cleanup", path);
        return response({ error: "Document registration failed" }, 409);
      }
      return response({ ok: true });
    }
    if (body.action === "remove") {
      const { data: doc, error: readError } = await service
        .from("documents")
        .select("id")
        .eq("id", body.id)
        .eq("wedding_id", body.weddingId)
        .maybeSingle();
      if (readError) return response({ error: "Read failed" }, 500);
      if (!doc) return response({ ok: true });
      const { error: removeError } = await bucket.remove([path]);
      if (removeError) return response({ error: "Delete failed" }, 500);
      const { error: deleteError } = await service
        .from("documents")
        .delete()
        .eq("id", body.id)
        .eq("wedding_id", body.weddingId);
      if (deleteError)
        return response({ error: "Metadata deletion failed; retry" }, 500);
      return response({ ok: true });
    }
    return response({ error: "Invalid action" }, 400);
  } catch {
    return response({ error: "Invalid document request" }, 400);
  }
});
