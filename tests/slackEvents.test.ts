import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/types";

const mocks = vi.hoisted(() => ({
  insertSlackEventOnce: vi.fn(),
  markPreviewsRevokedByFileId: vi.fn(),
  revokeSlackInstallation: vi.fn()
}));

vi.mock("../src/db/queries", () => ({
  insertSlackEventOnce: mocks.insertSlackEventOnce,
  markPreviewsRevokedByFileId: mocks.markPreviewsRevokedByFileId,
  revokeSlackInstallation: mocks.revokeSlackInstallation
}));

const { routeSlackEvents } = await import("../src/routes/slackEvents");

const signingSecret = "test-signing-secret";

describe("routeSlackEvents revocation events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertSlackEventOnce.mockResolvedValue(true);
    mocks.markPreviewsRevokedByFileId.mockResolvedValue(undefined);
    mocks.revokeSlackInstallation.mockResolvedValue(undefined);
  });

  it("revokes previews for file_deleted with file_id", async () => {
    const env = createEnv();
    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_deleted_file_id",
        event: { type: "file_deleted", file_id: "F_DELETED", event_ts: "1361482916.000004" }
      }),
      env,
      createExecutionContext()
    );

    await expect(response.json()).resolves.toEqual({ ok: true, revoked: true });
    expect(mocks.markPreviewsRevokedByFileId).toHaveBeenCalledWith(env.DB, "T123", "F_DELETED");
  });

  it("revokes previews for file_deleted with file string fallback", async () => {
    const env = createEnv();
    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_deleted_file_string",
        event: { type: "file_deleted", file: "F_DELETED_FALLBACK" }
      }),
      env,
      createExecutionContext()
    );

    await expect(response.json()).resolves.toEqual({ ok: true, revoked: true });
    expect(mocks.markPreviewsRevokedByFileId).toHaveBeenCalledWith(
      env.DB,
      "T123",
      "F_DELETED_FALLBACK"
    );
  });

  it("revokes previews for file_unshared with nested file object fallback", async () => {
    const env = createEnv();
    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_unshared_file_object",
        event: { type: "file_unshared", file: { id: "F_UNSHARED_OBJECT" } }
      }),
      env,
      createExecutionContext()
    );

    await expect(response.json()).resolves.toEqual({ ok: true, revoked: true });
    expect(mocks.markPreviewsRevokedByFileId).toHaveBeenCalledWith(
      env.DB,
      "T123",
      "F_UNSHARED_OBJECT"
    );
  });

  it("does not revoke previews when a revocation event has no file id", async () => {
    const env = createEnv();
    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_unshared_missing_file",
        event: { type: "file_unshared" }
      }),
      env,
      createExecutionContext()
    );

    await expect(response.json()).resolves.toEqual({ ok: true, revoked: false });
    expect(mocks.markPreviewsRevokedByFileId).not.toHaveBeenCalled();
  });

  it("does not revoke previews for duplicate revocation events", async () => {
    mocks.insertSlackEventOnce.mockResolvedValue(false);
    const env = createEnv();
    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_duplicate_deleted",
        event: { type: "file_deleted", file_id: "F_DUPLICATE" }
      }),
      env,
      createExecutionContext()
    );

    await expect(response.json()).resolves.toEqual({ ok: true, duplicate: true });
    expect(mocks.markPreviewsRevokedByFileId).not.toHaveBeenCalled();
  });

  it("revokes workspace installation for app_uninstalled", async () => {
    const env = createEnv();
    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_app_uninstalled",
        event: { type: "app_uninstalled" }
      }),
      env,
      createExecutionContext()
    );

    await expect(response.json()).resolves.toEqual({ ok: true, installation_revoked: true });
    expect(mocks.revokeSlackInstallation).toHaveBeenCalledWith(env.DB, "T123", expect.any(Number));
  });
});

function createEnv(): Env {
  return {
    SLACK_SIGNING_SECRET: signingSecret,
    SLACK_BOT_TOKEN: "test-bot-token",
    SLACK_CLIENT_ID: "111.222",
    SLACK_CLIENT_SECRET: "client-secret",
    INSTALLATION_TOKEN_ENCRYPTION_KEY: "installation-key",
    PREVIEW_SIGNING_SECRET: "preview-secret",
    PREVIEW_BASE_URL: "https://preview.example.com",
    MAX_FILE_BYTES: "5242880",
    PREVIEW_TTL_SECONDS: "604800",
    MAX_SLACK_BLOCK_EXCERPT_CHARS: "1200",
    DB: {} as D1Database,
    PREVIEWS: {} as R2Bucket,
    PREVIEW_WORKFLOW: { create: vi.fn() } as unknown as Env["PREVIEW_WORKFLOW"]
  };
}

function createExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {}
  } as unknown as ExecutionContext;
}

async function signedSlackRequest(input: { event_id: string; event: unknown }): Promise<Request> {
  const body = JSON.stringify({
    token: "verification-token",
    team_id: "T123",
    api_app_id: "A123",
    type: "event_callback",
    event_id: input.event_id,
    event_time: Math.floor(Date.now() / 1000),
    event: input.event
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await slackSignature(timestamp, body);

  return new Request("https://worker.example.com/slack/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature
    },
    body
  });
}

async function slackSignature(timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`v0:${timestamp}:${body}`)
  );
  return `v0=${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
