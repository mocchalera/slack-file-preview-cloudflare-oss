# TDD/BDD Policy (T-Wada Inspired)

## Core principles

- Keep cycles short: Red -> Green -> Refactor.
- Write one failing test at a time.
- Make the smallest implementation change to pass.
- Refactor only while tests are green.

## Team agreements

- New behavior starts from a failing test or scenario.
- Bug fixes require at least one reproducing test first.
- Keep tests readable and intention-revealing.
- Prefer behavior-level naming over implementation details.
- For Slack payload changes, add or update a fixture-shaped example before adapting implementation.
- For security-sensitive behavior, assert both the allowed path and the rejected path.

## Project commands

- stack: node
- default test command: `npm test`
- default typecheck command: `npm run check`
- TDD/BDD profile check: `npm run tdd:check`

## Red -> Green -> Refactor loop

1. Red: write one failing Vitest test or one acceptance scenario for the next user-visible behavior.
2. Green: make the smallest implementation change that passes the test.
3. Refactor: simplify names, seams, or duplication only while `npm run check` and `npm test` stay green.

## High-risk areas that need tests first

- Slack Events API signature verification and raw-body handling.
- `file_shared` event deduplication and Workflow start parameters.
- `file_deleted` and `file_unshared` preview revocation.
- Signed preview URL verification, expiry, D1 status checks, and CSP responses.
- HTML text extraction that avoids serving unsafe raw HTML.
