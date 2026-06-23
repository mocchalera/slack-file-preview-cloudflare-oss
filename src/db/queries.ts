import type { PreviewRecord, SlackInstallationRecord } from "../types";

export interface PreviewSlackMessage {
  previewId: string;
  channelId: string;
  messageTs: string;
}

export async function insertSlackEventOnce(
  db: D1Database,
  input: {
    eventId: string;
    teamId: string;
    eventType: string;
    payload: string;
    receivedAt: number;
  }
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO slack_events (event_id, team_id, event_type, payload, received_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(input.eventId, input.teamId, input.eventType, input.payload, input.receivedAt)
    .run();

  return (result.meta.changes ?? 0) > 0;
}

export async function upsertPreview(
  db: D1Database,
  input: {
    id: string;
    teamId: string;
    channelId: string;
    fileId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    threadTs: string | null;
    slackPermalink: string | null;
    r2HtmlKey: string | null;
    r2ScreenshotKey: string | null;
    status: string;
    errorMessage: string | null;
    expiresAt: number;
    now: number;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO previews (
        id, team_id, channel_id, file_id, file_name, file_type, file_size,
        thread_ts, slack_permalink, r2_html_key, r2_screenshot_key,
        status, error_message, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        channel_id = excluded.channel_id,
        file_name = excluded.file_name,
        file_type = excluded.file_type,
        file_size = excluded.file_size,
        thread_ts = excluded.thread_ts,
        slack_permalink = excluded.slack_permalink,
        r2_html_key = excluded.r2_html_key,
        r2_screenshot_key = excluded.r2_screenshot_key,
        status = excluded.status,
        error_message = excluded.error_message,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`
    )
    .bind(
      input.id,
      input.teamId,
      input.channelId,
      input.fileId,
      input.fileName,
      input.fileType,
      input.fileSize,
      input.threadTs,
      input.slackPermalink,
      input.r2HtmlKey,
      input.r2ScreenshotKey,
      input.status,
      input.errorMessage,
      input.expiresAt,
      input.now,
      input.now
    )
    .run();
}

export async function getPreviewById(db: D1Database, id: string): Promise<PreviewRecord | null> {
  const result = await db.prepare(`SELECT * FROM previews WHERE id = ?`).bind(id).first<PreviewRecord>();
  return result ?? null;
}

export async function markPreviewsRevokedByFileId(db: D1Database, teamId: string, fileId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `UPDATE previews
       SET status = 'revoked', updated_at = ?
       WHERE team_id = ? AND file_id = ? AND status = 'active'`
    )
    .bind(now, teamId, fileId)
    .run();
}

export async function recordPreviewSlackMessagePosted(
  db: D1Database,
  input: {
    previewId: string;
    channelId: string;
    messageTs: string;
    now: number;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE previews
       SET slack_message_channel = ?, slack_message_ts = ?, slack_message_deleted_at = NULL, updated_at = ?
       WHERE id = ?`
    )
    .bind(input.channelId, input.messageTs, input.now, input.previewId)
    .run();
}

export async function listActivePreviewSlackMessagesByFileId(
  db: D1Database,
  teamId: string,
  fileId: string
): Promise<PreviewSlackMessage[]> {
  const result = await db
    .prepare(
      `SELECT id, slack_message_channel, slack_message_ts
       FROM previews
       WHERE team_id = ?
         AND file_id = ?
         AND status = 'active'
         AND slack_message_channel IS NOT NULL
         AND slack_message_ts IS NOT NULL`
    )
    .bind(teamId, fileId)
    .all<Pick<PreviewRecord, "id" | "slack_message_channel" | "slack_message_ts">>();

  return (result.results ?? []).flatMap((row) => {
    if (!row.slack_message_channel || !row.slack_message_ts) return [];
    return [{
      previewId: row.id,
      channelId: row.slack_message_channel,
      messageTs: row.slack_message_ts
    }];
  });
}

export async function markPreviewSlackMessageDeleted(db: D1Database, previewId: string, now: number): Promise<void> {
  await db
    .prepare(`UPDATE previews SET slack_message_deleted_at = ?, updated_at = ? WHERE id = ?`)
    .bind(now, now, previewId)
    .run();
}

export async function listExpiredActivePreviews(
  db: D1Database,
  now: number,
  limit: number
): Promise<PreviewRecord[]> {
  const result = await db
    .prepare(`SELECT * FROM previews WHERE status = 'active' AND expires_at <= ? LIMIT ?`)
    .bind(now, limit)
    .all<PreviewRecord>();
  return result.results ?? [];
}

export async function markPreviewExpired(db: D1Database, id: string, now: number): Promise<void> {
  await db
    .prepare(`UPDATE previews SET status = 'expired', updated_at = ? WHERE id = ?`)
    .bind(now, id)
    .run();
}

export async function insertPreviewAccessLog(
  db: D1Database,
  input: {
    previewId: string;
    teamId: string | null;
    requesterIpHash: string | null;
    userAgent: string | null;
    result: string;
    accessedAt: number;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO preview_access_logs (
        preview_id, team_id, requester_ip_hash, user_agent, result, accessed_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(input.previewId, input.teamId, input.requesterIpHash, input.userAgent, input.result, input.accessedAt)
    .run();
}

export async function upsertSlackInstallation(
  db: D1Database,
  input: SlackInstallationRecord
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO slack_installations (
        team_id, enterprise_id, enterprise_name, team_name, is_enterprise_install,
        app_id, bot_user_id, bot_token_ciphertext, scope, installed_by_user_id,
        installed_at, updated_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(team_id) DO UPDATE SET
        enterprise_id = excluded.enterprise_id,
        enterprise_name = excluded.enterprise_name,
        team_name = excluded.team_name,
        is_enterprise_install = excluded.is_enterprise_install,
        app_id = excluded.app_id,
        bot_user_id = excluded.bot_user_id,
        bot_token_ciphertext = excluded.bot_token_ciphertext,
        scope = excluded.scope,
        installed_by_user_id = excluded.installed_by_user_id,
        updated_at = excluded.updated_at,
        revoked_at = excluded.revoked_at`
    )
    .bind(
      input.team_id,
      input.enterprise_id,
      input.enterprise_name,
      input.team_name,
      input.is_enterprise_install,
      input.app_id,
      input.bot_user_id,
      input.bot_token_ciphertext,
      input.scope,
      input.installed_by_user_id,
      input.installed_at,
      input.updated_at,
      input.revoked_at
    )
    .run();
}

export async function getActiveSlackInstallation(
  db: D1Database,
  teamId: string
): Promise<SlackInstallationRecord | null> {
  const result = await db
    .prepare(`SELECT * FROM slack_installations WHERE team_id = ? AND revoked_at IS NULL`)
    .bind(teamId)
    .first<SlackInstallationRecord>();
  return result ?? null;
}

export async function revokeSlackInstallation(db: D1Database, teamId: string, now: number): Promise<void> {
  await db
    .prepare(`UPDATE slack_installations SET revoked_at = ?, updated_at = ? WHERE team_id = ?`)
    .bind(now, now, teamId)
    .run();
}
