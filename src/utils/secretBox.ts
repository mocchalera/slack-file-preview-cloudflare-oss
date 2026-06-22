const secretBoxVersion = "v1";

export async function encryptSecret(value: string, keyMaterial: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(keyMaterial);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value)
  );

  return `${secretBoxVersion}.${base64UrlEncodeBytes(iv)}.${base64UrlEncodeBytes(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(encrypted: string, keyMaterial: string): Promise<string> {
  const [version, iv, ciphertext] = encrypted.split(".");
  if (version !== secretBoxVersion || !iv || !ciphertext) {
    throw new Error("Unsupported encrypted secret format");
  }

  const key = await deriveAesKey(keyMaterial);
  const ivBytes = base64UrlDecodeBytes(iv);
  const ciphertextBytes = base64UrlDecodeBytes(ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(ivBytes) },
    key,
    toArrayBuffer(ciphertextBytes)
  );
  return new TextDecoder().decode(plaintext);
}

async function deriveAesKey(keyMaterial: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
