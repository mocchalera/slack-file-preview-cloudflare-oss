import { afterEach, describe, expect, it, vi } from "vitest";
import { SlackApiClient } from "../src/slack/api";

describe("SlackApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the posted message channel and ts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      channel: "C123",
      ts: "1710000000.000100"
    }));
    vi.stubGlobal("fetch", fetchMock);

    const slack = new SlackApiClient("xoxb-test");
    const posted = await slack.postMessage({
      channel: "C123",
      threadTs: "1710000000.000001",
      text: "Preview generated",
      blocks: []
    });

    expect(posted).toEqual({
      ok: true,
      channel: "C123",
      ts: "1710000000.000100"
    });
  });

  it("deletes a bot-authored message by channel and ts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const slack = new SlackApiClient("xoxb-test");
    await slack.deleteMessage({
      channel: "C123",
      ts: "1710000000.000100"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/chat.delete",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer xoxb-test",
          "Content-Type": "application/json; charset=utf-8"
        }),
        body: JSON.stringify({
          channel: "C123",
          ts: "1710000000.000100"
        })
      })
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" }
  });
}
