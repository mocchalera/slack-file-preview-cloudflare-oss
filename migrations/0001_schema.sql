CREATE TABLE IF NOT EXISTS slack_events (
  event_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS previews (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  thread_ts TEXT,
  slack_permalink TEXT,
  r2_html_key TEXT,
  r2_screenshot_key TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS previews_file_id_idx ON previews(team_id, file_id);
CREATE INDEX IF NOT EXISTS previews_expires_at_idx ON previews(expires_at);
CREATE INDEX IF NOT EXISTS previews_status_idx ON previews(status);

CREATE TABLE IF NOT EXISTS preview_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preview_id TEXT NOT NULL,
  team_id TEXT,
  requester_ip_hash TEXT,
  user_agent TEXT,
  result TEXT NOT NULL,
  accessed_at INTEGER NOT NULL
);
