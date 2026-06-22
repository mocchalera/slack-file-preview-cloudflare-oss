import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";
import type { Env, FileSharedWorkflowParams, RenderedPreview, SlackFile } from "../types";
import { SlackApiClient } from "../slack/api";
import { buildPreviewBlocks, buildSkippedBlocks } from "../slack/blocks";
import { detectSupportedFileType, findShareTs, getFileDisplayName } from "../preview/fileDetection";
import { renderMarkdownPreview } from "../preview/renderMarkdown";
import { renderHtmlTextPreview } from "../preview/renderHtml";
import { createSignedPreviewUrl } from "../preview/signedUrl";
import { upsertPreview } from "../db/queries";
import { resolveSlackBotToken } from "../slack/installations";
import { sha256Hex } from "../utils/crypto";

export class ProcessSlackFileWorkflow extends WorkflowEntrypoint<Env, FileSharedWorkflowParams> {
  async run(event: WorkflowEvent<FileSharedWorkflowParams>, step: WorkflowStep): Promise<unknown> {
    const params = event.payload;
    const env = this.env;
    const maxBytes = Number(env.MAX_FILE_BYTES ?? "5242880");
    const ttlSeconds = Number(env.PREVIEW_TTL_SECONDS ?? "604800");
    const maxExcerptChars = Number(env.MAX_SLACK_BLOCK_EXCERPT_CHARS ?? "1200");
    const now = Math.floor(Date.now() / 1000);

    const botToken = await step.do("resolve Slack installation", async () => {
      return resolveSlackBotToken(env, params.teamId);
    });
    const slack = new SlackApiClient(botToken);

    const file = await step.do(
      "files.info",
      { retries: { limit: 3, delay: "3 seconds", backoff: "exponential" }, timeout: "30 seconds" },
      async () => {
        const response = await slack.filesInfo(params.fileId);
        if (!response.file) throw new Error("files.info returned no file");
        return response.file;
      }
    );

    const fileType = detectSupportedFileType(file);
    const fileName = getFileDisplayName(file);
    const fileSize = file.size ?? 0;
    const threadTs = findShareTs(file, params.channelId) ?? params.eventTs ?? null;

    if (!fileType) {
      return { ok: true, ignored: true, reason: "unsupported_file_type", fileName };
    }

    if (file.is_external) {
      await maybePostSkip(slack, params.channelId, threadTs, fileName, "外部ファイルはMVPでは対象外です。");
      return { ok: true, skipped: true, reason: "external_file" };
    }

    if (fileSize > maxBytes) {
      await maybePostSkip(slack, params.channelId, threadTs, fileName, `ファイルサイズが上限 ${maxBytes} bytes を超えています。`);
      return { ok: true, skipped: true, reason: "file_too_large" };
    }

    const previewId = await step.do("derive preview id", async () => {
      const digest = await sha256Hex(`${params.teamId}:${params.fileId}`);
      return `prv_${digest.slice(0, 24)}`;
    });

    const rendered = await step.do(
      "download and render preview",
      { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" }, timeout: "1 minute" },
      async () => {
        const downloadUrl = file.url_private_download ?? file.url_private;
        if (!downloadUrl) throw new Error("No Slack private download URL found");
        const source = await slack.downloadPrivateFile(downloadUrl, maxBytes);

        const result = fileType === "markdown"
          ? renderMarkdownPreview({ source, fileName, previewId, fileSize })
          : renderHtmlTextPreview({ source, fileName, previewId, fileSize });

        await env.PREVIEWS.put(result.r2HtmlKey, result.html, {
          httpMetadata: { contentType: "text/html; charset=utf-8" },
          customMetadata: {
            teamId: params.teamId,
            fileId: params.fileId,
            fileType
          }
        });

        return result;
      }
    ) as RenderedPreview;

    const expiresAt = now + ttlSeconds;

    await step.do("upsert preview record", async () => {
      await upsertPreview(env.DB, {
        id: previewId,
        teamId: params.teamId,
        channelId: params.channelId,
        fileId: params.fileId,
        fileName,
        fileType,
        fileSize,
        threadTs,
        slackPermalink: file.permalink ?? null,
        r2HtmlKey: rendered.r2HtmlKey,
        r2ScreenshotKey: null,
        status: "active",
        errorMessage: null,
        expiresAt,
        now
      });
      return { previewId };
    });

    const previewUrl = await step.do("create signed preview url", async () => {
      return createSignedPreviewUrl({
        baseUrl: env.PREVIEW_BASE_URL,
        secret: env.PREVIEW_SIGNING_SECRET,
        previewId,
        teamId: params.teamId,
        channelId: params.channelId,
        fileId: params.fileId,
        expiresAt
      });
    });

    await step.do(
      "post slack thread preview",
      { retries: { limit: 3, delay: "5 seconds", backoff: "linear" }, timeout: "30 seconds" },
      async () => {
        await slack.postMessage({
          channel: params.channelId,
          threadTs,
          text: `Preview generated for ${fileName}: ${previewUrl}`,
          blocks: buildPreviewBlocks({ rendered, file, previewUrl, maxExcerptChars })
        });
        return { posted: true };
      }
    );

    return { ok: true, previewId, fileType, fileName };
  }
}

async function maybePostSkip(
  slack: SlackApiClient,
  channel: string,
  threadTs: string | null,
  fileName: string,
  reason: string
): Promise<void> {
  await slack.postMessage({
    channel,
    threadTs,
    text: `Preview skipped for ${fileName}: ${reason}`,
    blocks: buildSkippedBlocks(fileName, reason)
  }).catch(() => undefined);
}
