import type { RenderedPreview, SlackFile } from "../types";
import { truncate, slackEscape } from "../utils/text";

export function buildPreviewBlocks(args: {
  rendered: RenderedPreview;
  file: SlackFile;
  previewUrl: string;
  maxExcerptChars: number;
}): unknown[] {
  const { rendered, file, previewUrl, maxExcerptChars } = args;
  const icon = rendered.fileType === "markdown" ? "📄" : "🌐";
  const headings = rendered.headings.length
    ? rendered.headings.slice(0, 10).map((h, i) => `${i + 1}. ${slackEscape(h)}`).join("\n")
    : "見出しは検出されませんでした。";

  const links = rendered.links.length
    ? rendered.links.slice(0, 8).map((link) => `• ${slackEscape(link)}`).join("\n")
    : null;

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${icon} Preview: ${truncate(rendered.fileName, 80)}`,
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*種別*: ${rendered.fileType}\n*サイズ*: ${formatBytes(rendered.fileSize)}`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*見出し*\n${headings}`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*冒頭プレビュー*\n>${slackEscape(truncate(rendered.excerpt, maxExcerptChars)).replace(/\n/g, "\n>")}`
      }
    }
  ];

  if (links) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*リンク*\n${links}`
      }
    });
  }

  const elements: unknown[] = [
    {
      type: "button",
      text: { type: "plain_text", text: "全文を開く", emoji: true },
      url: previewUrl,
      action_id: "open_preview"
    }
  ];

  if (file.permalink) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "元ファイル", emoji: true },
      url: file.permalink,
      action_id: "open_slack_file"
    });
  }

  blocks.push({ type: "actions", elements });

  if (rendered.fileType === "html") {
    blocks.splice(2, 0, {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "HTMLは安全のため、生HTMLではなくテキスト化プレビューとして処理しています。"
        }
      ]
    });
  }

  return blocks.slice(0, 50);
}

export function buildSkippedBlocks(fileName: string, reason: string): unknown[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *Preview skipped*: ${slackEscape(fileName)}\n${slackEscape(reason)}`
      }
    }
  ];
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
