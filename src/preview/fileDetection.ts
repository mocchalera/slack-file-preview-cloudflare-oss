import type { SlackFile, SupportedFileType } from "../types";

const MARKDOWN_EXTENSIONS = [".md", ".markdown"];
const HTML_EXTENSIONS = [".html", ".htm"];

export function detectSupportedFileType(file: SlackFile): SupportedFileType | null {
  const name = getFileDisplayName(file).toLowerCase();
  const filetype = (file.filetype ?? "").toLowerCase();
  const mimetype = (file.mimetype ?? "").toLowerCase();

  if (MARKDOWN_EXTENSIONS.some((ext) => name.endsWith(ext)) || filetype === "markdown" || mimetype === "text/markdown") {
    return "markdown";
  }

  if (HTML_EXTENSIONS.some((ext) => name.endsWith(ext)) || filetype === "html" || mimetype === "text/html") {
    return "html";
  }

  return null;
}

export function getFileDisplayName(file: SlackFile): string {
  return file.name || file.title || file.id || "untitled";
}

export function findShareTs(file: SlackFile, channelId: string): string | null {
  const publicShare = file.shares?.public?.[channelId]?.[0];
  const privateShare = file.shares?.private?.[channelId]?.[0];
  const share = publicShare ?? privateShare;
  return share?.thread_ts ?? share?.ts ?? null;
}
