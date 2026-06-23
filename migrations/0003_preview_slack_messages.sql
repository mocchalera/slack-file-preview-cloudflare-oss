ALTER TABLE previews ADD COLUMN slack_message_channel TEXT;
ALTER TABLE previews ADD COLUMN slack_message_ts TEXT;
ALTER TABLE previews ADD COLUMN slack_message_deleted_at INTEGER;
