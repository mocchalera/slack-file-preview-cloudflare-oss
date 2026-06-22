import { describe, expect, it } from "vitest";
import { previewCsp } from "../src/preview/contentSecurityPolicy";
import { previewActionsScriptPath, routePreviewActionsScript } from "../src/routes/previewActions";

describe("preview actions", () => {
  it("serves the static markdown action script", async () => {
    const response = routePreviewActionsScript();
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toContain("max-age=");
    expect(previewActionsScriptPath).toBe("/assets/preview-actions.js");
    expect(body).toContain("data-copy-markdown");
    expect(body).toContain("navigator.clipboard.writeText");
  });

  it("allows only self-hosted preview scripts", () => {
    expect(previewCsp).toContain("script-src 'self'");
    expect(previewCsp).not.toContain("script-src 'none'");
    expect(previewCsp).not.toContain("script-src 'unsafe-inline'");
    expect(previewCsp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
