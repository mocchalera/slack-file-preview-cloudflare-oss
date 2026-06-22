import type { Env } from "./types";
import { routeSlackEvents } from "./routes/slackEvents";
import { routeSlackOAuth } from "./routes/slackOAuth";
import { routePreview } from "./routes/preview";
import { previewActionsScriptPath, routePreviewActionsScript } from "./routes/previewActions";
import { cleanupExpiredPreviews } from "./routes/cleanup";

export { ProcessSlackFileWorkflow } from "./workflows/processSlackFile";

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true, service: "slack-file-preview" });
    }

    if (request.method === "GET" && url.pathname === previewActionsScriptPath) {
      return routePreviewActionsScript();
    }

    if (request.method === "GET" && (url.pathname === "/slack/install" || url.pathname === "/slack/oauth/callback")) {
      return routeSlackOAuth(request, env);
    }

    if (request.method === "POST" && url.pathname === "/slack/events") {
      return routeSlackEvents(request, env, ctx);
    }

    if (request.method === "GET" && url.pathname.startsWith("/p/")) {
      return routePreview(request, env);
    }

    return json({ ok: false, error: "not_found" }, { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await cleanupExpiredPreviews(env);
  }
} satisfies ExportedHandler<Env>;
