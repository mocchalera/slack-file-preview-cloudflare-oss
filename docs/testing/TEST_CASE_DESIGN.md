# Test Case Design Notes

## Mapping template

- Business behavior:
- Acceptance scenario:
- Unit-level boundary:
- Data variations:
- Risk cases:

## Current priority mappings

### Slack file event to Workflow start

- Business behavior: Slack users get a preview reply after sharing supported files.
- Acceptance scenario: Markdown file shared in Slack gets a safe preview.
- Unit-level boundary: `routeSlackEvents`, `insertSlackEventOnce`, `safeWorkflowId`.
- Data variations: public channel share, private channel share, missing `channel_id`, duplicate `event_id`.
- Risk cases: parsing JSON before signature verification, duplicate Workflows, wrong thread timestamp.

### Preview URL access control

- Business behavior: only time-limited signed preview URLs can read generated previews.
- Acceptance scenario: Markdown file shared in Slack gets a safe preview.
- Unit-level boundary: `createSignedPreviewUrl`, `verifySignedPreviewToken`, `routePreview`.
- Data variations: valid token, expired token, wrong secret, revoked preview, missing R2 object.
- Risk cases: URL token reuse after revocation, weak CSP, leaking Slack private URLs.

### HTML safe preview

- Business behavior: Slack users can inspect HTML-like files without executing them.
- Acceptance scenario: HTML file shared in Slack is not served as raw HTML.
- Unit-level boundary: `detectSupportedFileType`, `renderHtmlTextPreview`, `contentSecurityPolicy`.
- Data variations: `.html`, `.htm`, uppercase extension, embedded scripts, large file.
- Risk cases: preserving executable tags, exposing raw source, over-trusting MIME type.
