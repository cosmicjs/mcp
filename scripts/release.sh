#!/usr/bin/env bash
#
# One-command release for @cosmicjs/mcp.
#
# Consumes pending changesets to bump the version, commits the release, then
# tags and pushes. Pushing the tag is what triggers the "Publish to npm"
# GitHub Actions workflow (.github/workflows/publish.yml), which verifies the
# tag matches package.json and runs `npm publish --provenance`.
#
# Usage:
#   bun run release          # interactive: prompts before the tag push
#   bun run release -- --yes # non-interactive (e.g. for automation)
#
set -euo pipefail

SKIP_CONFIRM="${RELEASE_YES:-0}"
for arg in "$@"; do
  case "$arg" in
    -y|--yes) SKIP_CONFIRM=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "❌ $1" >&2; exit 1; }

# --- Pre-flight checks ---------------------------------------------------
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || fail "Releases must run on 'main' (you are on '$BRANCH'). Run: git checkout main"

[ -z "$(git status --porcelain)" ] || fail "Working tree is not clean. Commit or stash your changes first."

# Count changesets excluding the README placeholder.
PENDING="$(find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' | wc -l | tr -d ' ')"
[ "$PENDING" != "0" ] || fail "No changesets found in .changeset/. Add one first with: bunx changeset"

echo "→ Syncing main..."
git pull --ff-only origin main

# Guard: a prior version bump that was never tagged/published. If package.json
# is already ahead of the latest tag, bumping again would skip publishing that
# version (this is exactly how an unpublished v1.5.0 turned into a bogus v1.6.0).
CURRENT_VERSION="$(node -p "require('./package.json').version")"
if ! git rev-parse "v${CURRENT_VERSION}" >/dev/null 2>&1; then
  echo "⚠️  package.json is at v${CURRENT_VERSION}, but no v${CURRENT_VERSION} tag exists."
  echo "    A previous release was likely versioned but never published."
  echo "    To publish that existing version instead of bumping again, run:"
  echo "      git push origin main && git tag v${CURRENT_VERSION} && git push origin v${CURRENT_VERSION}"
  if [ "$SKIP_CONFIRM" != "1" ]; then
    read -r -p "Bump to a NEW version on top of the unpublished one anyway? [y/N] " reply
    case "$reply" in
      y|Y|yes|YES) ;;
      *) fail "Aborted. Publish the existing v${CURRENT_VERSION} first (commands above)." ;;
    esac
  fi
fi

# --- Version bump from changesets ---------------------------------------
echo "→ Versioning from changesets..."
bunx changeset version

echo "→ Syncing server.json and SERVER_VERSION..."
node scripts/sync-version.mjs

echo "→ Refreshing lockfile..."
bun install

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

# Guard against re-releasing an existing version.
if git rev-parse "$TAG" >/dev/null 2>&1; then
  fail "Tag $TAG already exists. Did the version actually bump?"
fi

# --- Commit, tag, push ---------------------------------------------------
echo "→ Committing release ${TAG}..."
git add -A
git commit -m "chore(release): ${TAG}"

echo ""
echo "About to push ${TAG} to origin. This triggers the live npm publish."
if [ "$SKIP_CONFIRM" != "1" ]; then
  read -r -p "Continue? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) fail "Aborted. Local release commit is staged on main but nothing was pushed." ;;
  esac
fi

echo "→ Pushing main..."
git push origin main

echo "→ Pushing tag ${TAG}..."
git tag "${TAG}"
git push origin "${TAG}"

echo ""
echo "✅ Released ${TAG}. Track the publish at:"
echo "   https://github.com/cosmicjs/mcp/actions/workflows/publish.yml"
