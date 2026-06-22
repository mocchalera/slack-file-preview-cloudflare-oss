export interface Env {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  SLACK_OAUTH_REDIRECT_URL?: string;
  INSTALLATION_TOKEN_ENCRYPTION_KEY?: string;
  PREVIEW_SIGNING_SECRET: string;

  PREVIEW_BASE_URL: string;
  MAX_FILE_BYTES: string;
  PREVIEW_TTL_SECONDS: string;
  MAX_SLACK_BLOCK_EXCERPT_CHARS: string;

  DB: D1Database;
  PREVIEWS: R2Bucket;
  PREVIEW_WORKFLOW: Workflow<FileSharedWorkflowParams>;
}

export interface FileSharedWorkflowParams {
  eventId: string;
  teamId: string;
  channelId: string;
  fileId: string;
  userId?: string;
  eventTs?: string;
}

export type SupportedFileType = "markdown" | "html";

export interface SlackEventEnvelope<TEvent = unknown> {
  token?: string;
  challenge?: string;
  type: "url_verification" | "event_callback" | string;
  team_id?: string;
  api_app_id?: string;
  event_id?: string;
  event_time?: number;
  authorizations?: SlackEventAuthorization[];
  context_team_id?: string | null;
  context_enterprise_id?: string | null;
  event?: TEvent;
}

export interface SlackEventAuthorization {
  enterprise_id?: string | null;
  team_id?: string | null;
  user_id?: string;
  is_bot?: boolean;
  is_enterprise_install?: boolean;
}

export interface SlackFileSharedEvent {
  type: "file_shared";
  file_id: string;
  channel_id: string;
  user_id?: string;
  event_ts?: string;
}

export interface SlackFileDeletedEvent {
  type: "file_deleted" | "file_unshared";
  file_id?: string;
  file?: string | { id?: string };
  channel_id?: string;
  event_ts?: string;
}

export interface SlackAppUninstalledEvent {
  type: "app_uninstalled";
}

export interface SlackFileInfoResponse {
  ok: boolean;
  error?: string;
  file?: SlackFile;
}

export interface SlackFile {
  id: string;
  created?: number;
  timestamp?: number;
  name?: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  pretty_type?: string;
  user?: string;
  size?: number;
  url_private?: string;
  url_private_download?: string;
  permalink?: string;
  is_external?: boolean;
  is_public?: boolean;
  shares?: {
    public?: Record<string, SlackFileShare[]>;
    private?: Record<string, SlackFileShare[]>;
  };
}

export interface SlackFileShare {
  reply_users?: string[];
  reply_users_count?: number;
  reply_count?: number;
  ts?: string;
  thread_ts?: string;
  channel_name?: string;
  team_id?: string;
}

export interface RenderedPreview {
  previewId: string;
  fileType: SupportedFileType;
  fileName: string;
  fileSize: number;
  html: string;
  headings: string[];
  links: string[];
  excerpt: string;
  r2HtmlKey: string;
}

export interface PreviewRecord {
  id: string;
  team_id: string;
  channel_id: string;
  file_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  thread_ts: string | null;
  slack_permalink: string | null;
  r2_html_key: string | null;
  r2_screenshot_key: string | null;
  status: string;
  error_message: string | null;
  expires_at: number;
  created_at: number;
  updated_at: number;
}

export interface SlackInstallationRecord {
  team_id: string;
  enterprise_id: string | null;
  enterprise_name: string | null;
  team_name: string | null;
  is_enterprise_install: number;
  app_id: string | null;
  bot_user_id: string;
  bot_token_ciphertext: string;
  scope: string;
  installed_by_user_id: string | null;
  installed_at: number;
  updated_at: number;
  revoked_at: number | null;
}
