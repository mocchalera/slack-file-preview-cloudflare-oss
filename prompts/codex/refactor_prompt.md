# Refactor Prompt

Refactor for readability and structure without changing behavior.

Rules:
1. Keep tests green throughout.
2. Preserve public behavior.
3. Prefer small, reviewable commits.
4. Do not weaken Slack signature checks, signed URL checks, R2 privacy assumptions, or HTML safety.
5. Verify with `npm run check`, `npm test`, and `npm run tdd:check`.
