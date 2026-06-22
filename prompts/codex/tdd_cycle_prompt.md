# TDD Cycle Prompt

Follow strict Red -> Green -> Refactor.

1. Pick the next smallest behavior from `docs/testing/BDD_SCENARIOS.md`.
2. Add one failing Vitest test or fixture-backed scenario check.
3. Implement the smallest change to pass.
4. Run `npm run check`, `npm test`, and `npm run tdd:check`.
5. Refactor only with tests green.
6. Report:
   - added test
   - implementation diff summary
   - refactor summary
   - verification commands
