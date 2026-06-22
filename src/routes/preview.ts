import type { Env } from "../types";
import { getPreviewById, insertPreviewAccessLog } from "../db/queries";
import { verifySignedPreviewToken } from "../preview/signedUrl";
import { previewCsp } from "../preview/contentSecurityPolicy";
import { sha256Hex } from "../utils/crypto";

export async function routePreview(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const previewId = decodeURIComponent(url.pathname.replace(/^\/p\//, "").split("/")[0] ?? "");
  const token = url.searchParams.get("token");
  const now = Math.floor(Date.now() / 1000);

  if (!previewId || !token) {
    return htmlError("Missing preview token", 400);
  }

  const verification = await verifySignedPreviewToken(token, env.PREVIEW_SIGNING_SECRET);
  if (!verification.ok) {
    await safeAccessLog(env, previewId, request, "invalid_token");
    return htmlError("Invalid or expired preview token", verification.reason === "expired" ? 410 : 403);
  }

  if (verification.payload.preview_id !== previewId) {
    await safeAccessLog(env, previewId, request, "preview_mismatch");
    return htmlError("Preview mismatch", 403);
  }

  const record = await getPreviewById(env.DB, previewId);
  if (!record) {
    await safeAccessLog(env, previewId, request, "not_found");
    return htmlError("Preview not found", 404);
  }

  if (record.status !== "active") {
    await safeAccessLog(env, previewId, request, `status_${record.status}`);
    return htmlError("Preview is no longer available", 410);
  }

  if (record.expires_at <= now) {
    await safeAccessLog(env, previewId, request, "expired");
    return htmlError("Preview expired", 410);
  }

  if (!record.r2_html_key) {
    await safeAccessLog(env, previewId, request, "missing_r2_key");
    return htmlError("Preview asset missing", 404);
  }

  const object = await env.PREVIEWS.get(record.r2_html_key);
  if (!object) {
    await safeAccessLog(env, previewId, request, "r2_not_found");
    return htmlError("Preview asset not found", 404);
  }

  await safeAccessLog(env, previewId, request, "ok", record.team_id);

  return new Response(object.body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Content-Security-Policy": previewCsp,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function htmlError(message: string, status: number): Response {
  const escaped = message.replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
  return new Response(`<!doctype html><html><body><h1>${escaped}</h1></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": previewCsp,
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

async function safeAccessLog(
  env: Env,
  previewId: string,
  request: Request,
  result: string,
  teamId?: string
): Promise<void> {
  try {
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "";
    const ipHash = ip ? await sha256Hex(`${teamId ?? "unknown"}:${ip}`) : null;
    await insertPreviewAccessLog(env.DB, {
      previewId,
      teamId: teamId ?? null,
      requesterIpHash: ipHash,
      userAgent: request.headers.get("user-agent"),
      result,
      accessedAt: Math.floor(Date.now() / 1000)
    });
  } catch {
    // Access logging must never block preview delivery.
  }
}
