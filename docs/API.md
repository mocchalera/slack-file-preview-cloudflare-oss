# API

## GET /healthz

```json
{"ok":true,"service":"slack-file-preview"}
```

## POST /slack/events

Slack Events APIのRequest URL。

- `url_verification`は`challenge`を返す
- `event_callback`はD1で重複排除し、`file_shared`のみWorkflow起動
- `file_deleted` / `file_unshared`は既存previewをrevokedにする
- `app_uninstalled`はworkspace installationをrevokedにする

## GET /slack/install

Slack OAuthインストール開始URL。設定済みのBot scopesでSlackのOAuth許可画面へリダイレクトする。

要求scope:

```text
files:read,chat:write
```

## GET /slack/oauth/callback

Slack OAuth callback URL。

- `state`のHMAC署名と期限を検証する
- `oauth.v2.access`でtemporary `code`をbot tokenへ交換する
- workspace別installationをD1へ保存する
- bot tokenはD1へ平文保存せず、AES-GCMで暗号化する

## GET /p/:previewId?token=...

署名付きtokenを検証し、D1のstatusとexpires_atを確認して、R2のHTMLを返す。

エラー例:

| status | reason |
|---|---|
| 400 | token missing / invalid |
| 403 | signature invalid |
| 404 | preview not found |
| 410 | preview expired / revoked |
