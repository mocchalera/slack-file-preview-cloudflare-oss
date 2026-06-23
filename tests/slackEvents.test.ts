import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/types";

const mocks = vi.hoisted(() => ({
  insertSlackEventOnce: vi.fn(),
  listActivePreviewSlackMessagesByFileId: vi.fn(),
  markPreviewSlackMessageDeleted: vi.fn(),
  markPreviewsRevokedByFileId: vi.fn(),
  revokeSlackInstallation: vi.fn(),
  resolveSlackBotToken: vi.fn(),
  deleteMessage: vi.fn()
}));

vi.mock("../src/db/queries", () => ({
  insertSlackEventOnce: mocks.insertSlackEventOnce,
  listActivePreviewSlackMessagesByFileId: mocks.listActivePreviewSlackMessagesByFileId,
  markPreviewSlackMessageDeleted: mocks.markPreviewSlackMessageDeleted,
  markPreviewsRevokedByFileId: mocks.markPreviewsRevokedByFileId,
  revokeSlackInstallation: mocks.revokeSlackInstallation
}));

vi.mock("../src/slack/installations", () => ({
  resolveSlackBotToken: mocks.resolveSlackBotToken
}));

vi.mock("../src/slack/api", () => ({
  SlackApiClient: vi.fn(function SlackApiClient() {
    return {
      deleteMessage: mocks.deleteMessage
    };
  })
}));

const { routeSlackEvents } = await import("../src/routes/slackEvents");

const signingSecret = "test-signing-secret";

describe("routeSlackEvents revocation events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertSlackEventOnce.mockResolvedValue(true);
    mocks.listActivePreviewSlackMessagesByFileId.mockResolvedValue([]);
    mocks.markPreviewSlackMessageDeleted.mockResolvedValue(undefined);
    mocks.markPreviewsRevokedByFileId.mockResolvedValue(undefined);
    mocks.revokeSlackInstallation.mockResolvedValue(undefined);
    mocks.resolveSlackBotToken.mockResolvedValue("xoxb-test");
    mocks.deleteMessage.mockResolvedValue(undefined);
  });

  it("revokes previews for file_deleted with file_id", async () => {
    const env = createEnv();
    const ctx = createExecutionContext();
    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_deleted_file_id",
        event: { type: "file_deleted", file_id: "F_DELETED", event_ts: "1361482916.000004" }
      }),
      env,
      ctx
    );

    await expect(response.json()).resolves.toEqual({ ok: true, revoked: true });
    expect(mocks.listActivePreviewSlackMessagesByFileId).toHaveBeenCalledWith(env.DB, "T123", "F_DELETED");
    expect(mocks.markPreviewsRevokedByFileId).toHaveBeenCalledWith(env.DB, "T123", "F_DELETED");
    expect(ctx.waitUntil).not.toHaveBeenCalled();
  });

  it("deletes the app preview message when a shared file is deleted", async () => {
    mocks.listActivePreviewSlackMessagesByFileId.mockResolvedValue([
      {
        previewId: "prv_deleted",
        channelId: "C123",
        messageTs: "1710000000.000200"
      }
    ]);
    const env = createEnv();
    const ctx = createExecutionContext();

    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_deleted_with_preview_message",
        event: { type: "file_deleted", file_id: "F_DELETED_WITH_MESSAGE" }
      }),
      env,
      ctx
    );

    await expect(response.json()).resolves.toEqual({ ok: true, revoked: true });
    expect(mocks.markPreviewsRevokedByFileId).toHaveBeenCalledWith(env.DB, "T123", "F_DELETED_WITH_MESSAGE");
    expect(ctx.waitUntil).toHaveBeenCalledOnce();

    const deletion = ctx.waitUntil.mock.calls[0]?.[0] as Promise<void>;
    await deletion;

    expect(mocks.resolveSlackBotToken).toHaveBeenCalledWith(env, "T123");
    expect(mocks.deleteMessage).toHaveBeenCalledWith({
      channel: "C123",
      ts: "1710000000.000200"
    });
    expect(mocks.markPreviewSlackMessageDeleted).toHaveBeenCalledWith(env.DB, "prv_deleted", expect.any(Number));
  });

  it("keeps preview revocation successful when Slack message deletion fails", async () => {
    mocks.listActivePreviewSlackMessagesByFileId.mockResolvedValue([
      {
        previewId: "prv_delete_failure",
        channelId: "C123",
        messageTs: "1710000000.000300"
      }
    ]);
    mocks.deleteMessage.mockRejectedValue(new Error("Slack API chat.delete failed: message_not_found"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = createEnv();
    const ctx = createExecutionContext();

    const response = await routeSlackEvents(
      await signedSlackRequest({
        event_id: "Ev_deleted_with_delete_failure",
        event: { type: "file_deleted", file_id: "F_DELETE_FAILURE" }
      }),
      env,
      ctx
    );

    await expect(response.json()).resolves.toEqual({ ok: true, revoked: true });
    expect(mocks.markPreviewsRevokedByFileId).toHaveBeenCalledWith(env.DB, "T123", "F_DELETE_FAILURE");

    const deletion = ctx.waitUntil.mock.calls[0]?.[0] as Promise<void>;
    await expect(deletion).resolves.toBeUndefined();
    expect(mocks.markPreviewSlackMessageDeleted).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to delete Slack preview message",
      expect.objectContaining({ previewId: "prv_delete_failure" })
    );

    warnSpy.mockRestore();
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
    expect(mocks.listActivePreviewSlackMessagesByFileId).not.toHaveBeenCalled();
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
    expect(mocks.listActivePreviewSlackMessagesByFileId).not.toHaveBeenCalled();
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

function createExecutionContext(): ExecutionContext & { waitUntil: ReturnType<typeof vi.fn> } {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {}
  } as unknown as ExecutionContext & { waitUntil: ReturnType<typeof vi.fn> };
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
