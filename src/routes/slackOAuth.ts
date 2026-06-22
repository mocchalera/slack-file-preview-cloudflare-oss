import { upsertSlackInstallation } from "../db/queries";
import { installationTokenEncryptionKey } from "../slack/installations";
import { createSlackOauthState, verifySlackOauthState } from "../slack/oauthState";
import type { Env, SlackInstallationRecord } from "../types";
import { escapeHtml } from "../utils/text";
import { encryptSecret } from "../utils/secretBox";

const slackAuthorizeUrl = "https://slack.com/oauth/v2/authorize";
const slackOauthAccessUrl = "https://slack.com/api/oauth.v2.access";
const requiredBotScopes = "files:read,chat:write";

interface SlackOauthAccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id?: string; name?: string };
  enterprise?: { id?: string; name?: string };
  authed_user?: { id?: string };
  is_enterprise_install?: boolean;
}

export async function routeSlackOAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const config = getOauthConfig(env);
  if (!config.ok) {
    return htmlPage("Slack OAuth is not configured", "Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET.", 500);
  }

  if (request.method !== "GET") {
    return htmlPage("Method not allowed", "Use GET for Slack OAuth routes.", 405);
  }

  if (url.pathname === "/slack/install") {
    const state = await createSlackOauthState(env.PREVIEW_SIGNING_SECRET);
    const location = new URL(slackAuthorizeUrl);
    location.searchParams.set("client_id", config.clientId);
    location.searchParams.set("scope", requiredBotScopes);
    location.searchParams.set("redirect_uri", config.redirectUri);
    location.searchParams.set("state", state);
    return new Response(null, { status: 302, headers: { Location: location.toString() } });
  }

  if (url.pathname === "/slack/oauth/callback") {
    return handleOauthCallback(url, env, config);
  }

  return htmlPage("Not found", "Unknown Slack OAuth route.", 404);
}

async function handleOauthCallback(
  url: URL,
  env: Env,
  config: { clientId: string; clientSecret: string; redirectUri: string }
): Promise<Response> {
  const error = url.searchParams.get("error");
  if (error) {
    return htmlPage("Slack installation canceled", `Slack returned: ${error}`, 400);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return htmlPage("Invalid Slack OAuth callback", "Missing code or state.", 400);
  }

  const stateVerification = await verifySlackOauthState(state, env.PREVIEW_SIGNING_SECRET);
  if (!stateVerification.ok) {
    return htmlPage("Invalid Slack OAuth state", `State verification failed: ${stateVerification.reason}.`, 403);
  }

  const access = await exchangeOauthCode(code, config);
  if (!access.ok) {
    return htmlPage("Slack installation failed", `Slack OAuth failed: ${access.error ?? "unknown_error"}.`, 502);
  }

  if (!access.access_token || access.token_type !== "bot" || !access.bot_user_id || !access.team?.id) {
    return htmlPage("Slack installation failed", "Slack OAuth did not return a workspace bot token.", 502);
  }

  const now = Math.floor(Date.now() / 1000);
  const installation: SlackInstallationRecord = {
    team_id: access.team.id,
    enterprise_id: access.enterprise?.id ?? null,
    enterprise_name: access.enterprise?.name ?? null,
    team_name: access.team.name ?? null,
    is_enterprise_install: access.is_enterprise_install ? 1 : 0,
    app_id: access.app_id ?? null,
    bot_user_id: access.bot_user_id,
    bot_token_ciphertext: await encryptSecret(access.access_token, installationTokenEncryptionKey(env)),
    scope: access.scope ?? "",
    installed_by_user_id: access.authed_user?.id ?? null,
    installed_at: now,
    updated_at: now,
    revoked_at: null
  };

  await upsertSlackInstallation(env.DB, installation);

  return htmlPage(
    "Slack installation complete",
    `${installation.team_name ?? installation.team_id} にFile Previewerをインストールしました。`
  );
}

async function exchangeOauthCode(
  code: string,
  config: { clientId: string; clientSecret: string; redirectUri: string }
): Promise<SlackOauthAccessResponse> {
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("redirect_uri", config.redirectUri);

  const response = await fetch(slackOauthAccessUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body
  });

  return response.json() as Promise<SlackOauthAccessResponse>;
}

function getOauthConfig(
  env: Env
): { ok: true; clientId: string; clientSecret: string; redirectUri: string } | { ok: false } {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    return { ok: false };
  }

  const redirectUri = env.SLACK_OAUTH_REDIRECT_URL ?? `${env.PREVIEW_BASE_URL.replace(/\/$/, "")}/slack/oauth/callback`;
  return {
    ok: true,
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri
  };
}

function htmlPage(title: string, message: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(
      title
    )}</title><style>body{max-width:720px;margin:48px auto;padding:0 20px;font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{border:1px solid #8884;border-radius:10px;padding:24px;background:#8881}h1{margin-top:0}</style></head><body><main><h1>${escapeHtml(
      title
    )}</h1><p>${escapeHtml(message)}</p></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
