CREATE TABLE IF NOT EXISTS slack_installations (
  team_id TEXT PRIMARY KEY,
  enterprise_id TEXT,
  enterprise_name TEXT,
  team_name TEXT,
  is_enterprise_install INTEGER NOT NULL DEFAULT 0,
  app_id TEXT,
  bot_user_id TEXT NOT NULL,
  bot_token_ciphertext TEXT NOT NULL,
  scope TEXT NOT NULL,
  installed_by_user_id TEXT,
  installed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS slack_installations_revoked_at_idx ON slack_installations(revoked_at);
