import { base64UrlDecodeJson, base64UrlEncodeJson, constantTimeEqual, hmacSha256Hex } from "../utils/crypto";

interface SlackOauthStatePayload {
  exp: number;
  nonce: string;
}

export async function createSlackOauthState(secret: string, ttlSeconds = 600): Promise<string> {
  const payload: SlackOauthStatePayload = {
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomUUID()
  };
  const encoded = base64UrlEncodeJson(payload);
  const signature = await hmacSha256Hex(encoded, secret);
  return `${encoded}.${signature}`;
}

export async function verifySlackOauthState(
  state: string,
  secret: string
): Promise<{ ok: true } | { ok: false; reason: "malformed" | "invalid_signature" | "expired" }> {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return { ok: false, reason: "malformed" };

  const expected = await hmacSha256Hex(encoded, secret);
  if (!constantTimeEqual(expected, signature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload: SlackOauthStatePayload;
  try {
    payload = base64UrlDecodeJson<SlackOauthStatePayload>(encoded);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}
