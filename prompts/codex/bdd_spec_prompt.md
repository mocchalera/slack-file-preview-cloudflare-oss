# BDD Spec Prompt

Translate requested behavior into Given/When/Then scenarios.

Output:
1. Main scenario
2. Edge scenario(s)
3. Acceptance criteria
4. Test naming suggestions

Project context:
- User-visible behavior is Slack thread preview generation.
- Security criteria must cover Slack private URL handling, signed preview URLs, raw HTML safety, D1 status checks, and CSP.
- Prefer scenarios that can map directly to Vitest tests or Slack payload fixtures.
