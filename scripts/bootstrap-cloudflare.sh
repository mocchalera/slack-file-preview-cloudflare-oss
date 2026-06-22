#!/usr/bin/env bash
set -euo pipefail

APP_NAME="slack-file-preview"
BUCKET_NAME="slack-file-previews"

echo "Creating D1 database: ${APP_NAME}"
npx wrangler d1 create "${APP_NAME}"

echo "Creating R2 bucket: ${BUCKET_NAME}"
npx wrangler r2 bucket create "${BUCKET_NAME}"

echo "Next steps:"
echo "1. Copy the D1 database_id into wrangler.jsonc"
echo "2. Run: npm run db:migrate:remote"
echo "3. Set secrets with wrangler secret put"
