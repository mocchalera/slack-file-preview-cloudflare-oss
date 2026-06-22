import type { RenderedPreview } from "../types";
import { escapeHtml, createExcerpt, truncate } from "../utils/text";
import { previewActionsScriptPath } from "./actionsScript";

interface MarkdownHeading {
  level: number;
  text: string;
  id: string;
}

interface RenderedMarkdownBody {
  html: string;
  headings: MarkdownHeading[];
}

export function renderMarkdownPreview(input: {
  source: string;
  fileName: string;
  previewId: string;
  fileSize: number;
}): RenderedPreview {
  const links = extractMarkdownLinks(input.source);
  const excerpt = createExcerpt(stripMarkdownNoise(input.source), 1600);
  const body = renderBasicMarkdownToHtml(input.source);
  const html = wrapPreviewHtml({
    title: input.fileName,
    label: "Markdown Preview",
    body: body.html,
    outline: body.headings,
    markdownSource: input.source,
    notice: "This preview is generated from Markdown and escaped/sanitized by the Worker MVP renderer."
  });

  return {
    previewId: input.previewId,
    fileType: "markdown",
    fileName: input.fileName,
    fileSize: input.fileSize,
    html,
    headings: body.headings.map((heading) => heading.text),
    links,
    excerpt,
    r2HtmlKey: `previews/${input.previewId}/index.html`
  };
}

export function extractMarkdownHeadings(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^#{1,6}\s+(.+)$/);
      return match ? normalizeHeadingText(match[1]) : null;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 40);
}

export function extractMarkdownLinks(source: string): string[] {
  const links = new Set<string>();
  const mdLinkRegex = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g;
  const bareUrlRegex = /https?:\/\/[^\s<>)"']+/g;

  for (const match of source.matchAll(mdLinkRegex)) links.add(match[1]);
  for (const match of source.matchAll(bareUrlRegex)) links.add(match[0]);

  return [...links].slice(0, 40);
}

function renderBasicMarkdownToHtml(source: string): RenderedMarkdownBody {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const headings: MarkdownHeading[] = [];
  const headingIds = new Map<string, number>();
  let inCode = false;
  let codeBuffer: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inlineMarkdown(escapeHtml(paragraph.join(" ")))}</p>`);
    paragraph = [];
  };

  const flushCode = () => {
    out.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    codeBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim().startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (isTableStart(lines, index)) {
      flushParagraph();
      const rendered = renderTable(lines, index);
      out.push(rendered.html);
      index = rendered.nextIndex - 1;
      continue;
    }

    if (parseListItem(line)) {
      flushParagraph();
      const rendered = renderList(lines, index);
      out.push(rendered.html);
      index = rendered.nextIndex - 1;
      continue;
    }

    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      out.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 6);
      const displayText = normalizeHeadingDisplayText(heading[2]);
      const text = normalizeHeadingText(heading[2]);
      const id = createHeadingId(text, headingIds);
      headings.push({ level, text, id });
      out.push(
        `<h${level} id="${escapeHtml(id)}"><a class="heading-link" href="#${escapeHtml(id)}">${inlineMarkdown(
          escapeHtml(displayText)
        )}</a></h${level}>`
      );
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode) flushCode();
  flushParagraph();

  return { html: out.join("\n"), headings };
}

type TableAlign = "left" | "center" | "right" | null;
type ListType = "ordered" | "unordered";

interface ListItemMatch {
  type: ListType;
  start: number | null;
  content: string;
}

function renderList(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const first = parseListItem(lines[startIndex]);
  if (!first) return { html: "", nextIndex: startIndex + 1 };

  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const item = parseListItem(lines[index]);
    if (item?.type === first.type) {
      items.push(inlineMarkdown(escapeHtml(item.content.trim())));
      index += 1;
      continue;
    }

    if (items.length && /^\s{2,}\S/.test(lines[index] ?? "")) {
      items[items.length - 1] += ` ${inlineMarkdown(escapeHtml(lines[index].trim()))}`;
      index += 1;
      continue;
    }

    break;
  }

  const tag = first.type === "ordered" ? "ol" : "ul";
  const start = tag === "ol" && first.start && first.start > 1 ? ` start="${first.start}"` : "";
  const html = `<${tag}${start}>\n${items.map((item) => `<li>${item}</li>`).join("\n")}\n</${tag}>`;

  return { html, nextIndex: index };
}

function parseListItem(line: string): ListItemMatch | null {
  const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
  if (ordered) {
    return { type: "ordered", start: Number(ordered[1]), content: ordered[2] };
  }

  const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
  if (unordered) {
    return { type: "unordered", start: null, content: unordered[1] };
  }

  return null;
}

function isTableStart(lines: string[], index: number): boolean {
  const header = parseTableRow(lines[index] ?? "");
  const separator = parseTableRow(lines[index + 1] ?? "");

  if (header.length < 2 || separator.length < 2) return false;
  return separator.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function renderTable(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const headers = parseTableRow(lines[startIndex]);
  const alignments = parseTableRow(lines[startIndex + 1]).map(parseTableAlignment);
  const bodyRows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const cells = parseTableRow(lines[index]);
    if (cells.length < 2) break;
    bodyRows.push(cells);
    index += 1;
  }

  const headerHtml = headers
    .map((cell, cellIndex) => renderTableCell("th", cell, alignments[cellIndex] ?? null))
    .join("");
  const bodyHtml = bodyRows
    .map((row) => {
      const cells = headers.map((_, cellIndex) => renderTableCell("td", row[cellIndex] ?? "", alignments[cellIndex] ?? null));
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("\n");

  return {
    html: `<div class="table-wrap"><table>\n<thead><tr>${headerHtml}</tr></thead>\n<tbody>\n${bodyHtml}\n</tbody>\n</table></div>`,
    nextIndex: index
  };
}

function renderTableCell(tag: "td" | "th", value: string, alignment: TableAlign): string {
  const align = alignment ? ` style="text-align: ${alignment}"` : "";
  return `<${tag}${align}>${inlineMarkdown(escapeHtml(value.trim()))}</${tag}>`;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return [];
  const withoutOuterPipes = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutOuterPipes.split("|").map((cell) => cell.trim());
}

function parseTableAlignment(separator: string): TableAlign {
  const value = separator.trim();
  const starts = value.startsWith(":");
  const ends = value.endsWith(":");
  if (starts && ends) return "center";
  if (ends) return "right";
  if (starts) return "left";
  return null;
}

function normalizeHeadingDisplayText(value: string): string {
  return value.replace(/\s+#+\s*$/, "").trim();
}

function normalizeHeadingText(value: string): string {
  const displayText = normalizeHeadingDisplayText(value);
  const plainText = displayText
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plainText || "Untitled";
}

function createHeadingId(text: string, usedIds: Map<string, number>): string {
  const words = text
    .toLocaleLowerCase()
    .normalize("NFKC")
    .match(/[\p{Letter}\p{Number}]+/gu);
  const base = words?.join("-").slice(0, 80) || "section";
  const count = usedIds.get(base) ?? 0;
  usedIds.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function inlineMarkdown(escaped: string): string {
  const codeSegments: string[] = [];
  const withCodePlaceholders = escaped.replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `@@CODE_${codeSegments.length}@@`;
    codeSegments.push(`<code>${code}</code>`);
    return token;
  });

  const linked = withCodePlaceholders.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, label: string, href: string) => {
      if (!isSafeMarkdownHref(href)) return label;
      return `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    }
  );

  const formatted = linked
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return codeSegments.reduce((value, code, index) => value.replace(`@@CODE_${index}@@`, code), formatted);
}

function isSafeMarkdownHref(href: string): boolean {
  const scheme = href.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1]?.toLowerCase();
  if (scheme) return scheme === "http" || scheme === "https" || scheme === "mailto";
  return /^(\/(?!\/)|\.{0,2}\/|[A-Za-z0-9._~-])/.test(href);
}

function stripMarkdownNoise(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

export function wrapPreviewHtml(input: {
  title: string;
  label: string;
  body: string;
  outline?: MarkdownHeading[];
  markdownSource?: string;
  notice?: string;
}): string {
  const title = escapeHtml(truncate(input.title, 160));
  const notice = input.notice ? `<p class="notice">${escapeHtml(input.notice)}</p>` : "";
  const outline = renderOutline(input.outline ?? []);
  const hasMarkdownSource = typeof input.markdownSource === "string";
  const sourceMarkdown = input.markdownSource ?? "";
  const actions = hasMarkdownSource ? renderPreviewActions() : "";
  const markdownSource = hasMarkdownSource
    ? `<textarea class="markdown-source" data-markdown-source readonly aria-hidden="true" tabindex="-1">${escapeHtml(sourceMarkdown)}</textarea>`
    : "";
  const script = hasMarkdownSource ? `<script src="${previewActionsScriptPath}" defer></script>` : "";
  const shellClass = outline ? "preview-shell has-sidebar" : "preview-shell";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; }
    html { scroll-behavior: smooth; }
    body { margin: 0; font: 16px/1.7 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: CanvasText; background: Canvas; overflow-wrap: anywhere; }
    .preview-shell { display: grid; grid-template-columns: minmax(0, 920px); justify-content: center; gap: 36px; max-width: 1240px; margin: 0 auto; padding: 36px 24px 64px; }
    .preview-shell.has-sidebar { grid-template-columns: minmax(180px, 236px) minmax(0, 920px); align-items: start; }
    .preview-sidebar { position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow: auto; padding: 4px 18px 0 0; border-right: 1px solid #8883; }
    .outline-title { margin-bottom: 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #666; }
    .outline-nav { display: flex; flex-direction: column; gap: 2px; }
    .outline-link { display: block; border-radius: 6px; padding: 4px 8px; color: #555; font-size: 14px; font-weight: 500; line-height: 1.35; text-decoration: none; }
    .outline-link:hover { color: #0f4f9f; background: #8881; text-decoration: none; }
    .outline-level-1 { padding-left: 0; font-weight: 700; }
    .outline-level-2 { padding-left: 12px; }
    .outline-level-3 { padding-left: 24px; }
    .outline-level-4, .outline-level-5, .outline-level-6 { padding-left: 36px; font-size: 13px; }
    .preview-document { min-width: 0; }
    header { border-bottom: 1px solid #8884; margin-bottom: 24px; padding-bottom: 18px; }
    .header-row { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .label { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #666; }
    h1, h2, h3, h4, h5, h6 { scroll-margin-top: 24px; }
    .heading-link { color: inherit; font-weight: inherit; text-decoration: none; }
    .heading-link:hover { color: #1b6ac9; text-decoration: underline; text-decoration-thickness: 0.08em; text-underline-offset: 0.18em; }
    .preview-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; min-width: 260px; padding-top: 2px; }
    .action-button { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 6px 11px; border: 1px solid #8884; border-radius: 7px; background: #8881; color: CanvasText; font: inherit; font-size: 14px; font-weight: 650; line-height: 1.2; text-decoration: none; cursor: pointer; }
    .action-button:hover { border-color: #1b6ac966; background: #1b6ac914; color: #0f4f9f; text-decoration: none; }
    .copy-status { min-height: 20px; flex-basis: 100%; color: #666; font-size: 13px; text-align: right; }
    .notice { padding: 12px 14px; border: 1px solid #8884; border-radius: 8px; background: #8881; }
    .table-wrap { margin: 24px 0; overflow-x: auto; border: 1px solid #8884; border-radius: 8px; }
    table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 15px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #8883; vertical-align: top; }
    th { background: #8881; font-weight: 650; text-align: left; }
    tr:last-child td { border-bottom: 0; }
    tbody tr:nth-child(even) { background: #88808010; }
    ol, ul { margin: 18px 0 24px; padding-left: 1.6rem; }
    li { margin: 8px 0; padding-left: 4px; }
    li::marker { font-weight: 650; color: #666; }
    hr { margin: 32px 0; border: 0; border-top: 1px solid #8884; }
    pre { overflow-x: auto; padding: 16px; border-radius: 8px; background: #8881; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    a { color: #1b6ac9; font-weight: 600; text-decoration: underline; text-decoration-thickness: 0.08em; text-underline-offset: 0.18em; overflow-wrap: anywhere; }
    a:hover { color: #0f4f9f; }
    .markdown-source { position: fixed; left: 0; bottom: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    @media (max-width: 900px) {
      .preview-shell, .preview-shell.has-sidebar { display: block; padding: 24px 18px 48px; }
      .preview-sidebar { position: static; max-height: none; margin-bottom: 24px; padding: 0 0 14px; border-right: 0; border-bottom: 1px solid #8883; }
      .outline-nav { flex-direction: row; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
      .outline-link, .outline-level-1, .outline-level-2, .outline-level-3, .outline-level-4, .outline-level-5, .outline-level-6 { flex: 0 0 auto; padding: 5px 9px; font-size: 13px; white-space: nowrap; }
      .header-row { display: block; }
      .preview-actions { justify-content: flex-start; min-width: 0; margin-top: 14px; }
      .copy-status { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="${shellClass}">
    ${outline}
    <div class="preview-document">
      <header>
        <div class="header-row">
          <div>
            <div class="label">${escapeHtml(input.label)}</div>
            <h1>${title}</h1>
          </div>
          ${actions}
        </div>
      </header>
      ${notice}
      <main>${input.body}</main>
    </div>
  </div>
  ${markdownSource}
  ${script}
</body>
</html>`;
}

function renderOutline(outline: MarkdownHeading[]): string {
  if (!outline.length) return "";
  const links = outline
    .map((heading) => {
      const level = Math.min(Math.max(heading.level, 1), 6);
      const id = escapeHtml(heading.id);
      return `<a class="outline-link outline-level-${level}" href="#${id}">${escapeHtml(heading.text)}</a>`;
    })
    .join("\n");

  return `<aside class="preview-sidebar" aria-label="Document outline">
      <div class="outline-title">目次</div>
      <nav class="outline-nav">
${links}
      </nav>
    </aside>`;
}

function renderPreviewActions(): string {
  return `<div class="preview-actions" aria-label="Preview actions">
              <button class="action-button" type="button" data-copy-markdown>Markdownをコピー</button>
              <a class="action-button" href="https://docs.new" target="_blank" rel="noreferrer noopener" data-open-google-docs>Google Docsで開く</a>
              <span class="copy-status" data-copy-status role="status" aria-live="polite"></span>
            </div>`;
}
