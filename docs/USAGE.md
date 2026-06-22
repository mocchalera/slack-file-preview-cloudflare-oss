# Slack File Previewer 使い方ガイド

このドキュメントは、Slackに共有されたMarkdown / HTMLファイルを自動プレビューするSlackアプリ「File Previewer」の使い方をまとめたものです。

## このアプリでできること

Slackチャンネルに `.md` / `.markdown` / `.html` / `.htm` ファイルが共有されると、botがファイルを読み取り、スレッドにプレビューへのリンクを投稿します。

Markdownプレビューでは、本文をブラウザで読みやすく表示できます。

- 見出しから自動生成される左サイドバー目次
- テーブル、数字リスト、区切り線、リンクの見やすい表示
- `Markdownをコピー` ボタン
- `Google Docsで開く` ボタン

HTMLファイルは安全性を優先し、生HTMLとして実行せず、テキスト化したプレビューを表示します。

## Slackでの使い方

1. botを使いたいチャンネルに招待します。

   ```text
   /invite @file-preview
   ```

2. チャンネルにMarkdownまたはHTMLファイルをアップロードします。

3. botがファイル共有イベントを受け取り、スレッドにプレビュー投稿を追加します。

4. スレッド内のプレビューボタンを開きます。

5. Markdownプレビューでは必要に応じて以下を使います。

   | 操作 | できること |
   |---|---|
   | 左サイドバー目次 | 見出しへ移動 |
   | Markdownをコピー | 元Markdown全文をクリップボードへコピー |
   | Google Docsで開く | 新規Google Docsを開き、コピー済みMarkdownを貼り付けられる状態にする |

Google Docsへの自動貼り付けはブラウザとGoogle側の制約でできません。ボタンを押した後、開いたGoogle Docsに貼り付けてください。

## 対応ファイル

| ファイル | 挙動 |
|---|---|
| `.md`, `.markdown` | Markdownとして安全なHTMLプレビューを生成 |
| `.html`, `.htm` | HTMLタグを実行せず、読み取り用テキストプレビューを生成 |
| その他 | 処理しない |

現在の最大ファイルサイズは `MAX_FILE_BYTES=5242880`、つまり約5MBです。

## プレビューURLの扱い

プレビューURLは署名付きURLです。現在の設定では `PREVIEW_TTL_SECONDS=604800` なので、生成から7日間で期限切れになります。

以下の場合、プレビューは見られなくなります。

- URLの有効期限が切れた
- Slack上で元ファイルが削除された
- Slack上で元ファイルの共有が解除された
- Worker側のD1/R2データが削除された

注意: プレビューHTMLは生成時にR2へ保存されます。Workerを更新しても、既存の古いプレビューURLのHTMLは自動では再生成されません。新しいUIや表示改善は、新しく共有されたファイルのプレビューから反映されます。

## 管理者向けセットアップ

### 1. Cloudflareへデプロイする

依存関係を入れます。

```bash
npm install
```

D1とR2を用意します。

```bash
npx wrangler d1 create slack-file-preview
npx wrangler r2 bucket create slack-file-previews
```

D1の `database_id` を `wrangler.jsonc` に反映し、マイグレーションを適用します。

```bash
npm run db:migrate:remote
```

Worker secretsを設定します。コマンドには「secretの値」ではなく「secret名」を渡してください。

```bash
npx wrangler secret put SLACK_SIGNING_SECRET
npx wrangler secret put PREVIEW_SIGNING_SECRET
```

OAuthで複数ワークスペースへインストールする場合は、追加で以下も設定します。

```bash
npx wrangler secret put SLACK_CLIENT_ID
npx wrangler secret put SLACK_CLIENT_SECRET
npx wrangler secret put INSTALLATION_TOKEN_ENCRYPTION_KEY
```

`PREVIEW_SIGNING_SECRET` と `INSTALLATION_TOKEN_ENCRYPTION_KEY` は以下のように生成できます。`INSTALLATION_TOKEN_ENCRYPTION_KEY` が未設定の場合は `PREVIEW_SIGNING_SECRET` を使ってinstallation tokenを暗号化しますが、運用では専用keyを推奨します。

```bash
openssl rand -base64 48
```

`SLACK_BOT_TOKEN` はOAuth移行前の単一ワークスペースfallback用です。新規ワークスペースは `/slack/install` からOAuthで追加してください。

デプロイします。

```bash
npm run deploy
```

現在のこのリポジトリでは、プレビューのベースURLは次です。

```text
https://YOUR_WORKER_DOMAIN
```

別のWorker URLや独自ドメインで使う場合は、`wrangler.jsonc` の `PREVIEW_BASE_URL` を実際のURLに合わせてから再デプロイしてください。

### 2. Slackアプリを設定する

Slack App Manifestとして `slack-app-manifest.yml` を読み込むか、Slackアプリの管理画面で手動設定します。

必要なBot Token Scopes:

```text
files:read
chat:write
```

Event Subscriptionsで購読するBot Events:

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

別のWorker URLを使う場合は、上記のドメイン部分を置き換えてください。

SlackアプリのBasic Informationにある `Client ID` と `Client Secret` をCloudflare secrets `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` に設定します。

### 3. SlackのSigning Secretを設定する

Slackアプリ管理画面の `Basic Information` にあるSigning SecretをCloudflare secret `SLACK_SIGNING_SECRET` に設定します。

```bash
npx wrangler secret put SLACK_SIGNING_SECRET
```

SlackのBot tokenとは別物です。Signing Secretは `SLACK_SIGNING_SECRET` に入れてください。

### 4. ワークスペースへインストールする

Workerをデプロイした後、次のURLをブラウザで開きます。

```text
https://YOUR_WORKER_DOMAIN/slack/install
```

Slackの許可画面でインストール先ワークスペースを選び、権限を承認します。成功すると、workspace別のbot tokenがD1の `slack_installations` テーブルへ暗号化保存されます。

2つ目以降のワークスペースも同じ `/slack/install` URLから追加します。ワークスペースごとに `SLACK_BOT_TOKEN` を差し替える必要はありません。

## 動作確認

### Workerの確認

```bash
curl https://YOUR_WORKER_DOMAIN/healthz
```

次のようなレスポンスが返ればWorkerは動いています。

```json
{"ok":true,"service":"slack-file-preview"}
```

### Slackでの確認

1. `/slack/install` から対象ワークスペースにアプリをインストールします。
2. botをテストチャンネルに招待します。
3. 小さなMarkdownファイルをアップロードします。
4. botがスレッドに返信することを確認します。
5. プレビューURLを開き、本文、目次、コピーボタン、Google Docsボタンを確認します。
6. 元ファイルを削除またはunshareし、プレビューが無効化されることを確認します。

## よくあるトラブル

### botが反応しない

確認すること:

- botが対象チャンネルに招待されているか
- Slack AppのEvent Subscriptionsが有効か
- Request URLが `/slack/events` まで含んでいるか
- `file_shared` イベントを購読しているか
- `/slack/install` から対象ワークスペースにインストール済みか
- `SLACK_SIGNING_SECRET` / `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` を正しいsecret名で登録したか
- Cloudflare Workerが最新デプロイになっているか

Cloudflare側のログを見る場合:

```bash
npx wrangler tail
```

### デプロイ時にrequired secretsエラーが出る

デプロイ時のrequired secretsは次の2つです。

```text
SLACK_SIGNING_SECRET
PREVIEW_SIGNING_SECRET
```

誤ってsecret名に実際のトークン値を渡した場合は、正しい名前で登録し直してください。

OAuth利用には追加で `SLACK_CLIENT_ID` と `SLACK_CLIENT_SECRET` が必要です。`INSTALLATION_TOKEN_ENCRYPTION_KEY` も設定を推奨します。

既存の単一ワークスペースfallbackを使う場合だけ、追加で `SLACK_BOT_TOKEN` を設定できます。

### /slack/install が設定エラーになる

`SLACK_CLIENT_ID` または `SLACK_CLIENT_SECRET` が未設定です。Slackアプリ管理画面のBasic Informationから値を取得し、Cloudflare secretsへ登録して再デプロイしてください。

### プレビューURLが期限切れになる

現在の有効期限は7日間です。必要に応じて `wrangler.jsonc` の `PREVIEW_TTL_SECONDS` を変更して再デプロイしてください。

### プライベートチャンネルで動かない

プライベートチャンネルでは、botをそのチャンネルへ明示的にinviteする必要があります。

```text
/invite @file-preview
```

### Google Docsボタンを押しても本文が入らない

正常です。ブラウザの制約によりGoogle Docsへ自動貼り付けはできません。ボタンを押すとMarkdownがクリップボードへコピーされるので、開いたGoogle Docsに手動で貼り付けてください。

## 運用上の注意

- Slackのprivate download URLやbot tokenは、Slackメッセージやブラウザへ出しません。
- R2 bucketはprivate前提です。
- プレビューは署名付きURLで保護されますが、URLを知っている人は期限内に閲覧できます。
- 機密性が高い文書を扱う場合は、Cloudflare AccessまたはSign in with Slackによる閲覧者認証を追加してください。
- HTMLファイルは安全のためテキスト化表示です。生HTMLを表示する設計へ変える場合は、別途サニタイズとCSPを厳密に設計してください。

## 便利なコマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー | `npm run dev` |
| 型チェック | `npm run check` |
| テスト | `npm test` |
| TDD/BDD設定チェック | `npm run tdd:check` |
| デプロイ | `npm run deploy` |
| 本番D1マイグレーション | `npm run db:migrate:remote` |
| Cloudflareログ確認 | `npx wrangler tail` |

## Slackアプリアイコン

このリポジトリにはSlackアプリ用アイコンを保存できます。Slack管理画面へ登録する場合は、512px版のPNGを使ってください。

```text
assets/slack-bot-icon-512.png
```
