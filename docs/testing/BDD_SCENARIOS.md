# BDD Scenarios

## Writing rules

- Write from user/business perspective.
- Use Given/When/Then.
- One scenario, one expected behavior.
- Keep setup minimal and explicit.

## Template

### Scenario: [behavior name]
- Given:
- When:
- Then:
- Notes:

## MVP scenarios

### Scenario: Workspace installs the app with Slack OAuth
- Given: a Slack workspace admin opens `/slack/install`
- When: Slack redirects back to `/slack/oauth/callback` with a valid temporary code and state
- Then: the app exchanges the code for a bot token and stores the workspace installation in D1 with the token encrypted
- Error/edge path: missing OAuth secrets or invalid state returns a clear setup/error page without storing an installation

### Scenario: Slack event uses the workspace-specific bot token
- Given: the app has active OAuth installations for multiple Slack workspaces
- When: a workspace sends a `file_shared` event
- Then: the Workflow resolves the bot token for that event's `team_id` before calling Slack APIs
- Error/edge path: if no active installation exists, the Workflow may use the legacy single-workspace fallback token when configured; otherwise it fails clearly

### Scenario: Markdown file shared in Slack gets a safe preview
- Given: a Slack `file_shared` event for a `.md` file in a channel where the bot has access
- When: the Worker verifies the event and the Workflow downloads the private file
- Then: the app stores safe preview HTML in private R2, stores metadata in D1, and posts a signed preview URL to the Slack thread
- Error/edge path: duplicate Slack event IDs do not start duplicate Workflows or create duplicate thread replies

### Scenario: Markdown tables are readable in the full preview
- Given: a Slack `file_shared` event for a Markdown file containing a pipe table
- When: the user opens the signed full preview URL
- Then: the table is rendered as styled HTML with readable borders, spacing, and horizontal overflow handling
- Error/edge path: table cell content is still escaped and inline formatting does not allow raw HTML execution

### Scenario: HTML file shared in Slack is not served as raw HTML
- Given: a Slack `file_shared` event for a `.html` file containing markup and script-like text
- When: the Workflow renders the preview
- Then: the app posts a preview generated from text extraction, not the original raw HTML document
- Error/edge path: rendered preview responses include a strict CSP and no executable script content

### Scenario: Deleted or unshared files revoke existing previews
- Given: an active preview exists for a Slack file
- When: Slack sends `file_deleted` or `file_unshared`
- Then: the matching preview record is marked revoked and `/p/:previewId` no longer returns the preview body
- Error/edge path: missing file IDs are ignored without failing Slack event handling

### Scenario: App uninstall revokes workspace installation
- Given: a workspace has installed the app through OAuth
- When: Slack sends `app_uninstalled`
- Then: the matching workspace installation is marked revoked and no longer used for Slack API calls
- Error/edge path: duplicate uninstall events are deduplicated by Slack event ID

### Scenario: Unsupported or oversized files are skipped safely
- Given: a Slack file is unsupported, external, or larger than the configured byte limit
- When: the Workflow inspects file metadata
- Then: the app avoids downloading or rendering unsafe content and posts a restrained skip message when appropriate
- Error/edge path: skipped files do not create active preview records
