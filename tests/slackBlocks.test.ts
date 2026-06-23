import { describe, expect, it } from "vitest";
import { buildPreviewBlocks } from "../src/slack/blocks";
import type { RenderedPreview } from "../src/types";

describe("Slack preview blocks", () => {
  it("focuses the thread reply on the full preview CTA", () => {
    const previewUrl = "https://preview.example.com/p/prv_test?token=abc";
    const blocks = buildPreviewBlocks({
      rendered: createRenderedPreview(),
      file: {
        id: "F123",
        permalink: "https://slack.example.com/files/F123"
      },
      previewUrl,
      maxExcerptChars: 80
    });

    const payload = JSON.stringify(blocks);
    expect(payload).not.toContain("冒頭プレビュー");
    expect(payload).not.toContain("リンク");
    expect(payload).not.toContain("https://linked.example.com");
    expect(payload).not.toContain("元ファイル");
    expect(payload).not.toContain("open_slack_file");

    const actionBlock = blocks.find(isActionsBlock);
    expect(actionBlock).toBeDefined();
    expect(actionBlock?.elements).toEqual([
      expect.objectContaining({
        type: "button",
        style: "primary",
        url: previewUrl,
        action_id: "open_preview",
        text: expect.objectContaining({ text: "全文を開く" })
      })
    ]);
    expect(blocks.indexOf(actionBlock!)).toBe(1);
  });
});

function createRenderedPreview(): RenderedPreview {
  return {
    previewId: "prv_test",
    fileType: "markdown",
    fileName: "handoff.md",
    fileSize: 2048,
    html: "<main>safe</main>",
    headings: ["概要", "次の作業"],
    links: ["https://linked.example.com"],
    excerpt: "これはSlackには出さない冒頭テキストです。",
    r2HtmlKey: "previews/prv_test/index.html"
  };
}

function isActionsBlock(block: unknown): block is { type: "actions"; elements: Array<Record<string, unknown>> } {
  return typeof block === "object" && block !== null && "type" in block && block.type === "actions";
}
