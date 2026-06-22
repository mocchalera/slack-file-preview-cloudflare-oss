import type { Env } from "../types";
import { listExpiredActivePreviews, markPreviewExpired } from "../db/queries";

export async function cleanupExpiredPreviews(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const expired = await listExpiredActivePreviews(env.DB, now, 100);

  for (const preview of expired) {
    if (preview.r2_html_key) {
      await env.PREVIEWS.delete(preview.r2_html_key).catch(() => undefined);
    }
    if (preview.r2_screenshot_key) {
      await env.PREVIEWS.delete(preview.r2_screenshot_key).catch(() => undefined);
    }
    await markPreviewExpired(env.DB, preview.id, now);
  }
}
