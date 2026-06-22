import type { RenderedPreview } from "../types";
import { escapeHtml, createExcerpt } from "../utils/text";
import { wrapPreviewHtml } from "./renderMarkdown";

export function renderHtmlTextPreview(input: {
  source: string;
  fileName: string;
  previewId: string;
  fileSize: number;
}): RenderedPreview {
  const title = extractHtmlTitle(input.source) ?? input.fileName;
  const text = extractReadableTextFromHtml(input.source);
  const headings = extractHtmlHeadings(input.source);
  const links = extractHtmlLinks(input.source);
  const excerpt = createExcerpt(text, 1600);

  const body = `<pre>${escapeHtml(text || "No readable text was extracted from this HTML file.")}</pre>`;
  const html = wrapPreviewHtml({
    title,
    label: "HTML Text Preview",
    body,
    notice: "For safety, this MVP does not render raw HTML. It extracts readable text and serves it with a strict CSP."
  });

  return {
    previewId: input.previewId,
    fileType: "html",
    fileName: input.fileName,
    fileSize: input.fileSize,
    html,
    headings,
    links,
    excerpt,
    r2HtmlKey: `previews/${input.previewId}/index.html`
  };
}

function extractHtmlTitle(source: string): string | null {
  const match = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(stripTags(match[1])).trim().slice(0, 160) : null;
}

function extractHtmlHeadings(source: string): string[] {
  const headings: string[] = [];
  const regex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  for (const match of source.matchAll(regex)) {
    const text = decodeHtmlEntities(stripTags(match[1])).replace(/\s+/g, " ").trim();
    if (text) headings.push(text);
  }
  return headings.slice(0, 40);
}

function extractHtmlLinks(source: string): string[] {
  const links = new Set<string>();
  const regex = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  for (const match of source.matchAll(regex)) links.add(match[1]);
  return [...links].slice(0, 40);
}

function extractReadableTextFromHtml(source: string): string {
  return decodeHtmlEntities(
    source
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number.parseInt(num, 10)));
}
