import { describe, expect, it } from "vitest";
import { extractMarkdownHeadings, extractMarkdownLinks, renderMarkdownPreview } from "../src/preview/renderMarkdown";

describe("markdown renderer", () => {
  const source = `# Title\n\nSee [example](https://example.com).\n\n## Details\n\n\`code\``;

  it("extracts headings", () => {
    expect(extractMarkdownHeadings(source)).toEqual(["Title", "Details"]);
  });

  it("extracts links", () => {
    expect(extractMarkdownLinks(source)).toContain("https://example.com");
  });

  it("escapes html in generated preview", () => {
    const rendered = renderMarkdownPreview({
      source: "# Hello\n\n<script>alert(1)</script>",
      fileName: "test.md",
      previewId: "prv_test",
      fileSize: 123
    });
    expect(rendered.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered.html).not.toContain("<script>alert(1)</script>");
  });

  it("renders markdown tables with styled table markup", () => {
    const rendered = renderMarkdownPreview({
      source: [
        "# Release checklist",
        "",
        "| Item | Owner | Status |",
        "| --- | :---: | ---: |",
        "| Slack event | Ops | **Done** |",
        "| Preview URL | App | `Pending` |"
      ].join("\n"),
      fileName: "table.md",
      previewId: "prv_table",
      fileSize: 456
    });

    expect(rendered.html).toContain('<div class="table-wrap">');
    expect(rendered.html).toContain("<table>");
    expect(rendered.html).toContain("<th>Item</th>");
    expect(rendered.html).toContain('<th style="text-align: center">Owner</th>');
    expect(rendered.html).toContain('<td style="text-align: right"><code>Pending</code></td>');
    expect(rendered.html).not.toContain("<p>| Item | Owner | Status |</p>");
  });

  it("renders ordered lists as separate list items", () => {
    const rendered = renderMarkdownPreview({
      source: [
        "## 作業フロー",
        "",
        "1. ラフな依頼なら [contracts/content-brief.md](contracts/content-brief.md) に沿って brief を固める。",
        "2. まず corpus の該当ファイルを読む。",
        "3. 媒体に合う型を templates から選ぶ。"
      ].join("\n"),
      fileName: "workflow.md",
      previewId: "prv_workflow",
      fileSize: 789
    });

    expect(rendered.html).toContain("<ol>");
    expect(rendered.html).toContain("<li>ラフな依頼なら");
    expect(rendered.html).toContain("<li>まず corpus の該当ファイルを読む。</li>");
    expect(rendered.html).not.toContain("<p>1. ラフな依頼なら");
    expect(rendered.html).not.toContain("<p>2. まず corpus");
  });

  it("renders horizontal rules and markdown links with safe styling", () => {
    const rendered = renderMarkdownPreview({
      source: [
        "# 作業フロー",
        "",
        "[content brief](contracts/content-brief.md) を読む。",
        "",
        "---",
        "",
        "[external](https://example.com?a=1&b=2) と [unsafe](javascript:alert(1))"
      ].join("\n"),
      fileName: "rules.md",
      previewId: "prv_rules",
      fileSize: 321
    });

    expect(rendered.html).toContain("<hr>");
    expect(rendered.html).toContain(
      '<a href="contracts/content-brief.md" target="_blank" rel="noreferrer noopener">content brief</a>'
    );
    expect(rendered.html).toContain(
      '<a href="https://example.com?a=1&amp;b=2" target="_blank" rel="noreferrer noopener">external</a>'
    );
    expect(rendered.html).toContain("unsafe");
    expect(rendered.html).not.toContain('href="javascript:alert');
    expect(rendered.html).not.toContain("<p>---</p>");
  });

  it("renders a document outline sidebar with heading anchors", () => {
    const rendered = renderMarkdownPreview({
      source: [
        "# 作業フロー",
        "",
        "## A. コンテンツを作るとき",
        "",
        "本文",
        "",
        "## A. コンテンツを作るとき",
        "",
        "本文2"
      ].join("\n"),
      fileName: "outline.md",
      previewId: "prv_outline",
      fileSize: 654
    });

    expect(rendered.headings).toEqual(["作業フロー", "A. コンテンツを作るとき", "A. コンテンツを作るとき"]);
    expect(rendered.html).toContain('<aside class="preview-sidebar" aria-label="Document outline">');
    expect(rendered.html).toContain('<nav class="outline-nav">');
    expect(rendered.html).toContain('<a class="outline-link outline-level-1" href="#作業フロー">作業フロー</a>');
    expect(rendered.html).toContain(
      '<h2 id="a-コンテンツを作るとき"><a class="heading-link" href="#a-コンテンツを作るとき">A. コンテンツを作るとき</a></h2>'
    );
    expect(rendered.html).toContain(
      '<a class="outline-link outline-level-2" href="#a-コンテンツを作るとき-2">A. コンテンツを作るとき</a>'
    );
  });

  it("adds markdown copy and Google Docs actions for markdown previews", () => {
    const rendered = renderMarkdownPreview({
      source: "# コピー\n\n`<textarea>` と & を含む本文",
      fileName: "copy.md",
      previewId: "prv_copy",
      fileSize: 987
    });

    expect(rendered.html).toContain('class="preview-actions"');
    expect(rendered.html).toContain('data-copy-markdown');
    expect(rendered.html).toContain('data-open-google-docs');
    expect(rendered.html).toContain('href="https://docs.new"');
    expect(rendered.html).toContain('data-markdown-source');
    expect(rendered.html).toContain("# コピー");
    expect(rendered.html).toContain("`&lt;textarea&gt;` と &amp; を含む本文");
    expect(rendered.html).toContain('<script src="/assets/preview-actions.js" defer></script>');
  });
});
