import type {
  Env,
  SlackEventEnvelope,
  SlackFileDeletedEvent,
  SlackFileSharedEvent
} from "../types";
import { verifySlackSignature } from "../slack/verifySignature";
import {
  insertSlackEventOnce,
  listActivePreviewSlackMessagesByFileId,
  markPreviewSlackMessageDeleted,
  markPreviewsRevokedByFileId,
  revokeSlackInstallation,
  type PreviewSlackMessage
} from "../db/queries";
import { SlackApiClient } from "../slack/api";
import { resolveSlackBotToken } from "../slack/installations";

export async function routeSlackEvents(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const rawBody = await request.text();
  const verified = await verifySlackSignature(request, rawBody, env.SLACK_SIGNING_SECRET);

  if (!verified) {
    return Response.json({ ok: false, error: "invalid_slack_signature" }, { status: 401 });
  }

  let payload: SlackEventEnvelope;
  try {
    payload = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge ?? "" });
  }

  if (payload.type !== "event_callback" || !payload.event || !payload.event_id || !payload.team_id) {
    return Response.json({ ok: true, ignored: true });
  }

  const event = payload.event as { type?: string };
  const inserted = await insertSlackEventOnce(env.DB, {
    eventId: payload.event_id,
    teamId: payload.team_id,
    eventType: event.type ?? "unknown",
    payload: rawBody,
    receivedAt: Math.floor(Date.now() / 1000)
  });

  if (!inserted) {
    return Response.json({ ok: true, duplicate: true });
  }

  if (event.type === "file_shared") {
    const fileEvent = payload.event as SlackFileSharedEvent;
    if (!fileEvent.file_id || !fileEvent.channel_id) {
      return Response.json({ ok: true, ignored: true, reason: "missing_file_or_channel" });
    }

    await env.PREVIEW_WORKFLOW.create({
      id: safeWorkflowId(payload.event_id),
      params: {
        eventId: payload.event_id,
        teamId: payload.team_id,
        channelId: fileEvent.channel_id,
        fileId: fileEvent.file_id,
        userId: fileEvent.user_id,
        eventTs: fileEvent.event_ts
      },
      retention: {
        successRetention: "1 day",
        errorRetention: "7 days"
      }
    });

    return Response.json({ ok: true, workflow_started: true });
  }

  if (event.type === "file_deleted" || event.type === "file_unshared") {
    const fileEvent = payload.event as SlackFileDeletedEvent;
    const fileId = extractRevokedFileId(fileEvent);
    if (fileId) {
      const previewMessages = await listActivePreviewSlackMessagesByFileId(env.DB, payload.team_id, fileId);
      await markPreviewsRevokedByFileId(env.DB, payload.team_id, fileId);
      if (previewMessages.length > 0) {
        ctx.waitUntil(deletePreviewSlackMessages(env, payload.team_id, previewMessages));
      }
    }
    return Response.json({ ok: true, revoked: Boolean(fileId) });
  }

  if (event.type === "app_uninstalled") {
    await revokeSlackInstallation(env.DB, payload.team_id, Math.floor(Date.now() / 1000));
    return Response.json({ ok: true, installation_revoked: true });
  }

  return Response.json({ ok: true, ignored: true });
}

function safeWorkflowId(eventId: string): string {
  return eventId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);
}

function extractRevokedFileId(event: SlackFileDeletedEvent): string | null {
  if (typeof event.file_id === "string" && event.file_id.length > 0) {
    return event.file_id;
  }

  if (typeof event.file === "string" && event.file.length > 0) {
    return event.file;
  }

  if (event.file && typeof event.file === "object" && typeof event.file.id === "string" && event.file.id.length > 0) {
    return event.file.id;
  }

  return null;
}

async function deletePreviewSlackMessages(
  env: Env,
  teamId: string,
  previewMessages: PreviewSlackMessage[]
): Promise<void> {
  try {
    const botToken = await resolveSlackBotToken(env, teamId);
    const slack = new SlackApiClient(botToken);

    await Promise.all(previewMessages.map(async (previewMessage) => {
      try {
        await slack.deleteMessage({
          channel: previewMessage.channelId,
          ts: previewMessage.messageTs
        });
        await markPreviewSlackMessageDeleted(env.DB, previewMessage.previewId, Math.floor(Date.now() / 1000));
      } catch (error) {
        console.warn("Failed to delete Slack preview message", {
          previewId: previewMessage.previewId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }));
  } catch (error) {
    console.warn("Failed to initialize Slack preview message deletion", {
      teamId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
