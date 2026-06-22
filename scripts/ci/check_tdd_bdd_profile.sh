#!/usr/bin/env bash
set -euo pipefail

required=(
  "docs/testing/TDD_BDD_POLICY.md"
  "docs/testing/BDD_SCENARIOS.md"
  "docs/testing/QUALITY_GATES.md"
  "docs/testing/TEST_CASE_DESIGN.md"
  "tests/spec/acceptance.feature"
  "prompts/codex/tdd_cycle_prompt.md"
  "prompts/codex/bdd_spec_prompt.md"
  "prompts/codex/refactor_prompt.md"
  "scripts/ci/check_tdd_bdd_profile.sh"
  ".github/workflows/tdd-bdd-health.yml"
  "Makefile"
)

missing=0
for path in "${required[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "missing: $path" >&2
    missing=1
  fi
done

if [[ -f "docs/testing/TDD_BDD_POLICY.md" ]]; then
  if ! grep -q "Red -> Green -> Refactor" "docs/testing/TDD_BDD_POLICY.md"; then
    echo "TDD_BDD_POLICY.md must include Red -> Green -> Refactor." >&2
    missing=1
  fi
fi

if [[ -f "docs/testing/BDD_SCENARIOS.md" ]]; then
  if ! grep -q "file_shared" "docs/testing/BDD_SCENARIOS.md"; then
    echo "BDD_SCENARIOS.md must include Slack file_shared behavior." >&2
    missing=1
  fi
fi

if [[ -f "package.json" ]]; then
  if ! grep -q '"tdd:check"' "package.json"; then
    echo "package.json must define npm run tdd:check." >&2
    missing=1
  fi
fi

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "check_tdd_bdd_profile.sh: OK"
