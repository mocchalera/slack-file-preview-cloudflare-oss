import { describe, expect, it } from "vitest";
import { createSignedPreviewUrl, verifySignedPreviewToken } from "../src/preview/signedUrl";

describe("signed preview URL", () => {
  it("creates and verifies a token", async () => {
    const url = await createSignedPreviewUrl({
      baseUrl: "https://preview.example.com",
      secret: "super-secret",
      previewId: "prv_123",
      teamId: "T123",
      channelId: "C123",
      fileId: "F123",
      expiresAt: Math.floor(Date.now() / 1000) + 60
    });

    const token = new URL(url).searchParams.get("token");
    expect(token).toBeTruthy();

    const result = await verifySignedPreviewToken(token!, "super-secret");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.preview_id).toBe("prv_123");
    }
  });

  it("rejects wrong secret", async () => {
    const url = await createSignedPreviewUrl({
      baseUrl: "https://preview.example.com",
      secret: "super-secret",
      previewId: "prv_123",
      teamId: "T123",
      channelId: "C123",
      fileId: "F123",
      expiresAt: Math.floor(Date.now() / 1000) + 60
    });

    const token = new URL(url).searchParams.get("token")!;
    const result = await verifySignedPreviewToken(token, "wrong-secret");
    expect(result.ok).toBe(false);
  });
});
