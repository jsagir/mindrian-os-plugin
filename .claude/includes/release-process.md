# Release Process (MANDATORY)

Every time you push changes to the plugin repo, follow this exact process:

## Step 1: Update CHANGELOG.md
Add a new entry at the top with the version number and date:
```markdown
## [X.Y.Z] - YYYY-MM-DD
### Added
- Feature description
### Fixed
- Bug fix description
### Changed
- Change description
```

## Step 2: Bump version in plugin.json
Update "version" in .claude-plugin/plugin.json to match the CHANGELOG version.

## Step 3: Commit with version tag
```bash
git add CHANGELOG.md .claude-plugin/plugin.json [changed files]
git commit -m "release: vX.Y.Z -- [one-line summary]"
git tag vX.Y.Z
```

## Step 4: Push with tags
```bash
git push origin main --tags
```

Users get notified automatically -- SessionStart checks GitHub CHANGELOG once per day and shows "[Update Available]" in Larry's greeting.

Never skip this process. Every push that changes user-facing functionality MUST bump the version.
