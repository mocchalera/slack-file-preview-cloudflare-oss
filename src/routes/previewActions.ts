import { previewActionsScript, previewActionsScriptPath } from "../preview/actionsScript";

export { previewActionsScriptPath };

export function routePreviewActionsScript(): Response {
  return new Response(previewActionsScript, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
