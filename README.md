# Slack File Preview for Cloudflare

Slackに共有されたMarkdown / HTMLファイルを検知し、スレッドに軽量プレビューと安全な全文プレビューURLを投稿するCloudflare Workersアプリです。

このリポジトリは、コーディングエージェントがすぐ作業を開始できるスターターです。MVPとしてはMarkdownの安全プレビューを主軸にし、HTMLは安全性を優先してテキスト化プレビューから始める設計です。

## 何を解決するか

Slackで`.md`や`.html`が共有されたとき、毎回ダウンロードしないと中身を確認できない摩擦をなくします。

```text
Slack file_shared event
  ↓
Cloudflare Worker /slack/events
  ↓
Cloudflare Workflow
  ↓
Slack files.info + url_private_download
  ↓
R2に安全なHTMLプレビュー保存
  ↓
D1にメタデータ保存
  ↓
Slackスレッドにプレビュー投稿
```

## 採用構成

- Cloudflare Workers: Slackイベント受信、プレビュー配信
- Cloudflare Workflows: ファイル処理の非同期・耐障害ステップ実行
- Cloudflare D1: イベント重複排除、プレビューメタデータ
- Cloudflare R2: 生成済みHTMLプレビュー保存
- Slack Web API: `files.info`, `chat.postMessage`, `url_private_download`取得
- Slack OAuth: 複数ワークスペースへのインストールとworkspace別bot token管理

## MVPの対応範囲

| 種別 | 挙動 |
|---|---|
| `.md`, `.markdown` | 見出し・冒頭・リンクをSlackスレッドへ投稿し、R2上の安全な全文HTMLをWorker経由で表示 |
| `.html`, `.htm` | 生HTMLをそのまま配信せず、テキスト抽出した安全プレビューを生成 |
| その他 | 無視 |
| 大きすぎるファイル | スキップして必要ならスレッドに通知 |
| 削除 / unshare | D1上のプレビューをrevokedに変更 |
| app uninstall | D1上のworkspace installationをrevokedに変更 |

## セットアップ

### 1. 依存関係

Node.js `22.12.0` 以上を使ってください。現在のWrangler / Miniflare / Vite系の依存がNode 22以上を要求します。

```bash
npm install
```

### 2. Cloudflareリソース作成

```bash
npx wrangler d1 create slack-file-preview
npx wrangler r2 bucket create slack-file-previews
```

`wrangler.jsonc`の`database_id`をD1作成時に出力された値に置き換えてください。

### 3. D1マイグレーション

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

### 4. Secrets設定

```bash
cp .dev.vars.example .dev.vars
npx wrangler secret put SLACK_SIGNING_SECRET
npx wrangler secret put PREVIEW_SIGNING_SECRET
```

OAuthで複数ワークスペースにインストールする場合:

```bash
npx wrangler secret put SLACK_CLIENT_ID
npx wrangler secret put SLACK_CLIENT_SECRET
npx wrangler secret put INSTALLATION_TOKEN_ENCRYPTION_KEY
```

`PREVIEW_SIGNING_SECRET`と`INSTALLATION_TOKEN_ENCRYPTION_KEY`は32バイト以上のランダム文字列を推奨します。`INSTALLATION_TOKEN_ENCRYPTION_KEY`が未設定の場合は`PREVIEW_SIGNING_SECRET`でinstallation tokenを暗号化します。既存の単一ワークスペース運用から移行する場合だけ、互換fallbackとして`SLACK_BOT_TOKEN`も設定できます。

### 5. Slack App設定

`slack-app-manifest.yml`をSlack App Manifestとして読み込むか、手動で以下を設定します。

Bot scopes:

```text
files:read
chat:write
```

Event subscriptions:

```text
file_shared
file_deleted
file_unshared
app_uninstalled
```

Request URL:

```text
https://YOUR_WORKER_DOMAIN/slack/events
```

OAuth Redirect URL:

```text
https://YOUR_WORKER_DOMAIN/slack/oauth/callback
```

開発中は`wrangler dev --remote`やCloudflare Tunnelなどで公開URLを用意してください。

### 6. 開発起動

```bash
npm run dev
```

## エンドポイント

| Method | Path | 用途 |
|---|---|---|
| `GET` | `/healthz` | ヘルスチェック |
| `GET` | `/slack/install` | Slack OAuthインストール開始 |
| `GET` | `/slack/oauth/callback` | Slack OAuth callback |
| `POST` | `/slack/events` | Slack Events API受信 |
| `GET` | `/p/:previewId?token=...` | 署名付きプレビュー表示 |

## 使い方

Slackでの使い方、管理者向けセットアップ、トラブルシュートは [`docs/USAGE.md`](docs/USAGE.md) を参照してください。

## 本番化前に必ず詰めること

- HTMLの完全レンダリング。MVPは安全性優先でHTMLをテキスト化しています。Phase 2でBrowser Runまたはスクリーンショット専用処理を追加してください。
- Slack権限との厳密同期。MVPは署名付きURL + 有効期限です。機密性が高い会社ではCloudflare AccessまたはSign in with Slackを追加してください。
- プライベートチャンネルではbotをチャンネルへinviteする運用が必要です。

## コーディングエージェント向け

次に触るべき順番は`docs/AGENT_HANDOFF.md`にまとめています。
