#!/usr/bin/env bash
#
# Retired. npm publishes now follow the same Changesets flow as @cosmicjs/sdk:
# merge a feature PR that includes a changeset, then merge the "Version Packages"
# PR that CI opens on main.
#
echo "scripts/release.sh is retired." >&2
echo "Add a changeset with: bunx changeset" >&2
echo "CI opens a Version Packages PR on main. Merging that PR publishes to npm." >&2
exit 1
