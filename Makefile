.PHONY: check test tdd-check verify

check:
	npm run check

test:
	npm test

tdd-check:
	npm run tdd:check

verify: tdd-check check test
