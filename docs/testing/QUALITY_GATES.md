# Quality Gates

## Minimum gates

1. Red test exists before implementation.
2. Green achieved with minimal change.
3. Refactor completed with test suite green.
4. Regression test added for each fixed bug.
5. Security-sensitive paths include a negative test.

## Required local checks

```sh
npm run tdd:check
npm run check
npm test
```

## Pull request checklist

- [ ] Added/updated behavior scenario
- [ ] Added failing test first
- [ ] Implementation change is minimal
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] `npm run tdd:check` passes
- [ ] Refactor diff reviewed
- [ ] No secrets, `.dev.vars`, `.env`, or `.Codex/settings.local.json` committed
