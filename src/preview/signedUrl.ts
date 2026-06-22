import { base64UrlDecodeJson, base64UrlEncodeJson, hmacSha256Hex, constantTimeEqual } from "../utils/crypto";

export interface PreviewTokenPayload {
  preview_id: string;
  team_id: string;
  channel_id: string;
  file_id: string;
  exp: number;
  nonce: string;
}

export async function createSignedPreviewUrl(input: {
  baseUrl: string;
  secret: string;
  previewId: string;
  teamId: string;
  channelId: string;
  fileId: string;
  expiresAt: number;
}): Promise<string> {
  const payload: PreviewTokenPayload = {
    preview_id: input.previewId,
    team_id: input.teamId,
    channel_id: input.channelId,
    file_id: input.fileId,
    exp: input.expiresAt,
    nonce: crypto.randomUUID()
  };
  const encoded = base64UrlEncodeJson(payload);
  const signature = await hmacSha256Hex(encoded, input.secret);
  const token = `${encoded}.${signature}`;
  const base = input.baseUrl.replace(/\/$/, "");
  return `${base}/p/${encodeURIComponent(input.previewId)}?token=${encodeURIComponent(token)}`;
}

export async function verifySignedPreviewToken(
  token: string,
  secret: string
): Promise<
  | { ok: true; payload: PreviewTokenPayload }
  | { ok: false; reason: "malformed" | "invalid_signature" | "expired" }
> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return { ok: false, reason: "malformed" };

  const expected = await hmacSha256Hex(encoded, secret);
  if (!constantTimeEqual(expected, signature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload: PreviewTokenPayload;
  try {
    payload = base64UrlDecodeJson<PreviewTokenPayload>(encoded);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}
