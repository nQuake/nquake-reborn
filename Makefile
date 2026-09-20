.PHONY: install dev build preview test lint fmt fmt-check clean changelog bump

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

test:
	npm run test

lint:
	npm run lint

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

# Local preview of what the Release workflow will write to CHANGELOG.md.
# Pass the planned version: `make changelog VERSION=0.2.0`. Consumes the
# fragments in .changes/unreleased/ — run on a scratch branch.
changelog:
	@test -n "$(VERSION)" || { \
		echo "usage: make changelog VERSION=X.Y.Z"; exit 2; \
	}
	node scripts/release/collate-changelog.mjs $(VERSION)

# Print the semver bump the Release workflow will derive from the current
# .changes/unreleased/ fragments. Read-only.
bump:
	@node scripts/release/compute-bump.mjs

clean:
	rm -rf dist node_modules
