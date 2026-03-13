---
description: "Create a new release with changelog update, npm publish, and git tag"
argument-hint: "[version] - optional, auto-detected if omitted"
allowed-tools: Bash(git *), Bash(gh release *), Bash(npm test), Bash(npm run *), Bash(npx *), Bash(npm publish *), Bash(npm view *), Bash(npm version *), Read, Edit, AskUserQuestion
---

Create a new release. Version can be provided as $1, or auto-detected from commits.

## Steps

1. **Determine version**:
   - Get current version: `node -p "require('./package.json').version"`
   - Get last tag: `git describe --tags --abbrev=0 2>/dev/null || echo "none"`
   - Get commits since last tag: `git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline`
   - If $1 provided, use that version (strip leading `v` if present)
   - Otherwise, analyze commits to suggest version bump:
     - **MAJOR**: commits with "BREAKING", "breaking change", removed commands/options
     - **MINOR**: commits with "add", "new", "feature", "feat:"
     - **PATCH**: commits with "fix", "bug", "patch", "docs", "chore", or any other changes
   - Present the suggested version and let user confirm or override

2. **Run pre-release checks**:
   - `npm test` — all tests must pass
   - `npm run typecheck` — no type errors
   - `npm run build` — build must succeed
   - If any check fails, stop and report the failure

3. **Generate changelog content**:
   - Analyze commits since last tag and categorize under: Added, Changed, Fixed, Removed
   - Format as markdown following Keep a Changelog format
   - Store this content to reuse in CHANGELOG.md and GitHub release

4. **Update CHANGELOG.md**:
   - Insert new section `## [X.Y.Z] - YYYY-MM-DD` (use today's date) under `## [Unreleased]`
   - Include the generated changelog content from step 3

5. **Update version in package.json**:
   - Use `npm version X.Y.Z --no-git-tag-version` to update package.json

6. **Commit and tag**:
   ```bash
   git add CHANGELOG.md package.json package-lock.json
   git commit -m "Prepare release vX.Y.Z"
   git tag vX.Y.Z
   ```

7. **Push** (ask for confirmation first):
   ```bash
   git push origin HEAD --tags
   ```

8. **Publish to npm** (ask for confirmation first):
   - First verify npm auth: `npm whoami`. If not logged in, ask user to run `npm login` manually.
   - Check the package exists: `npm view @jtsternberg/snip version`
   - Sign in to 1Password CLI first: `op signin --account my.1password.com`
   - Publish with OTP from 1Password: `npm publish --access public --otp=$(op item get "npmjs.com" --otp)`
   - Verify: `npm view @jtsternberg/snip version` should show the new version
   - Note: Package is scoped (@jtsternberg/snip) so `--access public` is required.
   - npm page: https://www.npmjs.com/package/@jtsternberg/snip

9. **Create GitHub release** (ask for confirmation first):
   - Use the changelog content from step 3 as the release notes
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "$CHANGELOG_CONTENT"
   ```
