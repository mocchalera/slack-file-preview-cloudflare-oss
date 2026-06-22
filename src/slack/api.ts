import type { SlackFileInfoResponse } from "../types";

export class SlackApiError extends Error {
  constructor(public readonly method: string, public readonly slackError: string) {
    super(`Slack API ${method} failed: ${slackError}`);
  }
}

export class SlackApiClient {
  constructor(private readonly botToken: string) {}

  async filesInfo(fileId: string): Promise<SlackFileInfoResponse> {
    const url = new URL("https://slack.com/api/files.info");
    url.searchParams.set("file", fileId);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.botToken}` }
    });

    const data = (await res.json()) as SlackFileInfoResponse;
    if (!data.ok) {
      throw new SlackApiError("files.info", data.error ?? `http_${res.status}`);
    }
    return data;
  }

  async downloadPrivateFile(url: string, maxBytes: number): Promise<string> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.botToken}` }
    });

    if (!res.ok) {
      throw new Error(`Slack file download failed: HTTP ${res.status}`);
    }

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > maxBytes) {
      throw new Error(`File too large: ${contentLength} bytes`);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw new Error(`File too large: ${bytes.byteLength} bytes`);
    }

    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  async postMessage(input: {
    channel: string;
    threadTs?: string | null;
    text: string;
    blocks: unknown[];
  }): Promise<void> {
    const body: Record<string, unknown> = {
      channel: input.channel,
      text: input.text,
      blocks: input.blocks,
      unfurl_links: false,
      unfurl_media: false
    };

    if (input.threadTs) {
      body.thread_ts = input.threadTs;
    }

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(body)
    });

    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      throw new SlackApiError("chat.postMessage", data.error ?? `http_${res.status}`);
    }
  }
}
