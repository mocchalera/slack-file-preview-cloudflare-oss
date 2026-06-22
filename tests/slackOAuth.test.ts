import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, SlackInstallationRecord } from "../src/types";
import { decryptSecret, encryptSecret } from "../src/utils/secretBox";

const mocks = vi.hoisted(() => ({
  upsertSlackInstallation: vi.fn()
}));

vi.mock("../src/db/queries", async () => {
  const actual = await vi.importActual<typeof import("../src/db/queries")>("../src/db/queries");
  return {
    ...actual,
    upsertSlackInstallation: mocks.upsertSlackInstallation
  };
});

const { routeSlackOAuth } = await import("../src/routes/slackOAuth");
const { createSlackOauthState } = await import("../src/slack/oauthState");

describe("Slack OAuth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertSlackInstallation.mockResolvedValue(undefined);
    vi.restoreAllMocks();
  });

  it("redirects install requests to Slack OAuth with signed state", async () => {
    const env = createEnv();
    const response = await routeSlackOAuth(new Request("https://worker.example.com/slack/install"), env);

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.origin + location.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(location.searchParams.get("client_id")).toBe("111.222");
    expect(location.searchParams.get("scope")).toBe("files:read,chat:write");
    expect(location.searchParams.get("redirect_uri")).toBe("https://worker.example.com/slack/oauth/callback");
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("stores an encrypted workspace installation after OAuth callback", async () => {
    const env = createEnv();
    const state = await createSlackOauthState(env.PREVIEW_SIGNING_SECRET, 600);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ok: true,
        access_token: "test-installed-token",
        token_type: "bot",
        scope: "files:read,chat:write",
        bot_user_id: "U_BOT",
        app_id: "A_APP",
        team: { id: "T_INSTALLED", name: "Installed Team" },
        enterprise: { id: "E_ORG", name: "Enterprise Org" },
        authed_user: { id: "U_ADMIN" },
        is_enterprise_install: false
      })
    );

    const response = await routeSlackOAuth(
      new Request(`https://worker.example.com/slack/oauth/callback?code=abc123&state=${encodeURIComponent(state)}`),
      env
    );

    expect(response.status).toBe(200);
    expect(mocks.upsertSlackInstallation).toHaveBeenCalledOnce();
    const [, input] = mocks.upsertSlackInstallation.mock.calls[0] as [D1Database, SlackInstallationRecord];
    expect(input.team_id).toBe("T_INSTALLED");
    expect(input.team_name).toBe("Installed Team");
    expect(input.enterprise_id).toBe("E_ORG");
    expect(input.bot_user_id).toBe("U_BOT");
    expect(input.scope).toBe("files:read,chat:write");
    expect(input.revoked_at).toBeNull();
    expect(input.bot_token_ciphertext).not.toContain("test-installed-token");
    await expect(decryptSecret(input.bot_token_ciphertext, env.INSTALLATION_TOKEN_ENCRYPTION_KEY!)).resolves.toBe(
      "test-installed-token"
    );
  });

  it("returns a clear setup error when OAuth secrets are missing", async () => {
    const response = await routeSlackOAuth(
      new Request("https://worker.example.com/slack/install"),
      { ...createEnv(), SLACK_CLIENT_SECRET: undefined }
    );

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Slack OAuth is not configured");
  });
});

describe("secret box", () => {
  it("encrypts and decrypts secrets without storing plaintext", async () => {
    const encrypted = await encryptSecret("test-secret-token", "test-key-material");

    expect(encrypted).not.toContain("test-secret-token");
    await expect(decryptSecret(encrypted, "test-key-material")).resolves.toBe("test-secret-token");
  });
});

function createEnv(): Env {
  return {
    SLACK_SIGNING_SECRET: "signing-secret",
    SLACK_BOT_TOKEN: "test-legacy",
    SLACK_CLIENT_ID: "111.222",
    SLACK_CLIENT_SECRET: "client-secret",
    INSTALLATION_TOKEN_ENCRYPTION_KEY: "installation-encryption-key",
    PREVIEW_SIGNING_SECRET: "preview-secret",
    PREVIEW_BASE_URL: "https://worker.example.com",
    MAX_FILE_BYTES: "5242880",
    PREVIEW_TTL_SECONDS: "604800",
    MAX_SLACK_BLOCK_EXCERPT_CHARS: "1200",
    DB: {} as D1Database,
    PREVIEWS: {} as R2Bucket,
    PREVIEW_WORKFLOW: { create: vi.fn() } as unknown as Env["PREVIEW_WORKFLOW"]
  };
}
