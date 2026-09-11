# Deferred items -- Quick 260911-ddd

Out-of-scope findings surfaced while running the Task 3 full verification
pass. Not fixed here per the Scope Boundary rule (only auto-fix issues
directly caused by this quick task's own changes).

## dist bundle staleness (build-dist-bundles.cjs --check-stale)

`bash tests/run-all-339.sh`'s "dist bundle staleness" arm fails:

```
dist bundle STALE: bundle was generated from 2.0.0-beta.32, the live plugin is 2.0.0-beta.34
Recovery: node scripts/build-dist-bundles.cjs
```

**Confirmed pre-existing, not caused by this quick task.** Verified by spinning
up a throwaway worktree at this plan's own baseline commit (5ce0dd3a, D-05:
no `git stash`, worktree only) and running the same check there:

```
cd /tmp/ddd-baseline-check   # git worktree add ... 5ce0dd3a --detach
node scripts/build-dist-bundles.cjs --check-stale
# -> dist bundle STALE: bundle was generated from 2.0.0-beta.32, the live plugin is 2.0.0-beta.34
```

Identical failure, identical versions, at the unmodified baseline commit. This
quick task's `files_modified` list never touches `dist/` or
`.claude-plugin/plugin.json`, so this staleness is unrelated to any change in
this plan. Worktree removed after the check (`git worktree remove
/tmp/ddd-baseline-check --force`).

This leg was not one of the four legs Task 1 was instructed to capture into
`baseline-reds.txt` (that capture was scoped to
`test-339-update-path-single-source.cjs`, `run-all-127.sh`, `run-all-257.sh`,
`test-262-unrecognized-shape-voids.cjs`), so it does not literally appear
there by name -- but it is genuinely pre-existing, confirmed above, and
belongs to a completely different axis (a stale release-artifact build,
never regenerated after a version bump in an unrelated prior session).
Recorded here rather than annotated away, per the "never fixed, never
silently softened" discipline this repo's runners already document for
their own known-red legs.

**Follow-up (not this quick task's scope):** run
`node scripts/build-dist-bundles.cjs` to regenerate the bundle, or fold that
regeneration into whatever release/version-bump ceremony last touched
`plugin.json` without re-running it.
