# Architecture

## 方針

Slackの既存ファイルクリック挙動は差し替えず、ファイル共有イベントを検知してスレッドに有用なプレビューを置く。

```text
[Slack]
  └─ file_shared / file_deleted / file_unshared
       ↓
[Worker: src/index.ts]
  ├─ GET /slack/install
  ├─ GET /slack/oauth/callback
  ├─ POST /slack/events
  ├─ GET /p/:previewId
  └─ scheduled cleanup
       ↓
[Workflow: ProcessSlackFileWorkflow]
  ├─ resolve workspace installation token
  ├─ files.info
  ├─ Slack private file download
  ├─ file type detection
  ├─ render safe preview
  ├─ write R2
  ├─ upsert D1
  └─ post Slack thread message
```

## なぜWorkflowsか

ファイル処理は複数の外部I/Oを含む。

- Slack API呼び出し
- Slackファイルダウンロード
- R2保存
- D1更新
- Slack投稿

この処理を1つのWebhookリクエスト内で実行するとSlackの応答タイムアウト、Slack側リトライ、二重投稿が起きやすい。Webhookは受けたらすぐ200を返し、後続処理はWorkflowに逃がす。

## データの置き場所

| データ | 保存先 | 理由 |
|---|---|---|
| Slack event_id | D1 | 重複排除 |
| Slack workspace installation | D1 | team_idごとのbot token管理。tokenは暗号化して保存 |
| preview metadata | D1 | 状態管理、期限管理 |
| generated preview HTML | R2 | 本文をD1に置かない |
| Slack file source | 原則保存しない | 情報漏えい面積を減らす |

## セキュリティ境界

`url_private_download`はブラウザに渡さない。Worker/Workflow側でBot tokenを使って取得し、安全化したプレビューだけ配信する。

Slack bot tokenはOAuth callbackで取得し、workspaceの`team_id`ごとにD1へ暗号化保存する。Events APIから届く`team_id`でinstallationを解決し、該当workspaceのtokenだけをSlack API呼び出しに使う。

プレビューURLは以下で守る。

- HMAC署名付きtoken
- `exp`期限
- D1上のstatus確認
- R2 bucketはpublicにしない
- CSP付きレスポンス

## 将来拡張

1. Browser RunでHTMLスクリーンショット生成
2. Slack OIDC / Cloudflare Accessでプレビュー閲覧者認証
3. Slack OAuth token rotation対応
4. Remote Files化
5. App Unfurl対応
6. Mermaid / PlantUML対応
