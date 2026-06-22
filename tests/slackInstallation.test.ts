import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env, SlackInstallationRecord } from "../src/types";
import { encryptSecret } from "../src/utils/secretBox";

const mocks = vi.hoisted(() => ({
  getActiveSlackInstallation: vi.fn()
}));

vi.mock("../src/db/queries", async () => {
  const actual = await vi.importActual<typeof import("../src/db/queries")>("../src/db/queries");
  return {
    ...actual,
    getActiveSlackInstallation: mocks.getActiveSlackInstallation
  };
});

const { resolveSlackBotToken } = await import("../src/slack/installations");

describe("Slack installation token resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the encrypted installation token for the workspace", async () => {
    const env = createEnv();
    mocks.getActiveSlackInstallation.mockResolvedValue({
      team_id: "T_OAUTH",
      bot_token_ciphertext: await encryptSecret("test-oauth-token", env.INSTALLATION_TOKEN_ENCRYPTION_KEY!)
    } satisfies Partial<SlackInstallationRecord>);

    await expect(resolveSlackBotToken(env, "T_OAUTH")).resolves.toBe("test-oauth-token");
    expect(mocks.getActiveSlackInstallation).toHaveBeenCalledWith(env.DB, "T_OAUTH");
  });

  it("falls back to the legacy single-workspace bot token when no installation exists", async () => {
    const env = createEnv();
    mocks.getActiveSlackInstallation.mockResolvedValue(null);

    await expect(resolveSlackBotToken(env, "T_LEGACY")).resolves.toBe("test-legacy-token");
  });

  it("fails clearly when neither OAuth installation nor legacy token exists", async () => {
    const env = { ...createEnv(), SLACK_BOT_TOKEN: undefined };
    mocks.getActiveSlackInstallation.mockResolvedValue(null);

    await expect(resolveSlackBotToken(env, "T_MISSING")).rejects.toThrow("No active Slack installation");
  });
});

function createEnv(): Env {
  return {
    SLACK_SIGNING_SECRET: "signing-secret",
    SLACK_BOT_TOKEN: "test-legacy-token",
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
