# Security Notes

## やっていること

- Slack署名検証
- `event_id`によるイベント重複排除
- Slack OAuth stateのHMAC署名と期限検証
- workspace別bot tokenのD1暗号化保存
- Slack private URLをユーザーへ露出しない
- プレビューURLにHMAC署名と有効期限を付与
- R2 bucketはprivate前提
- HTMLは生配信せず、MVPではテキスト化して表示
- プレビュー配信時に強いCSPを付与
- `file_deleted` / `file_unshared`でプレビューをrevokedにする

## まだやっていないこと

- Slack OIDCによる閲覧ユーザー認証
- Slackチャンネルメンバーシップとの厳密同期
- HTML完全サニタイズ / Browser Runスクリーンショット化
- 管理画面
- 監査ログの検索UI

## MVPのリスク

署名付きURLは、URLを知っている人が期限内にアクセスできる方式です。機密文書が多い組織では、Cloudflare AccessまたはSign in with Slackを追加してください。

## HTMLについて

HTMLはMarkdownより危険です。MVPでは生HTMLをそのまま配信せず、タグを落としてテキスト化します。完全なHTML表示をする場合は、以下のどちらかを推奨します。

1. Browser RunでスクリーンショットまたはPDF化し、HTML自体は表示しない
2. 実績あるHTML sanitizer + 厳格CSP + 外部通信遮断で表示する

## 推奨CSP

```http
Content-Security-Policy: default-src 'none'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'
```
