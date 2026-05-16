# Quick Task 260515-rd1 -- Deferred Items

Items observed during execution or during the v1.13.0-beta.17 cut that are
out of scope for the surfacing task. Each entry routes to a successor.

---

## 126.2-hotfix -- Step 9.7 sandbox design bug (HIGH priority)

**Surfaced by:** Live v1.13.0-beta.17 cut (release.sh, 2026-05-15 evening).

**What:** Step 9.7 npx-publish self-test FAILED on the live cut with
`sh: 1: mindrian-os: not found`. The package itself is structurally
correct (verified via direct tarball inspection: `bin/cli.js` present,
`package.json` `bin: { "mindrian-os": "bin/cli.js" }` correct, 662 files
in the published tarball). The failure is in OUR brand-new gate, not in
the published package.

**Smoke test of the real package:** From a clean shell without HOME
override, `npx --yes @mindrian_os/install@1.13.0-beta.17` successfully
updated the maintainer local install from `1.13.0-beta.14` to
`1.13.0-beta.17` for scope user. Output: "Plugin 'mos' updated from
1.13.0-beta.14 to 1.13.0-beta.17 for scope user. Restart to apply
changes." The package works for real testers.

**Root cause:** Our 126.1 Bug 3 fix shipped a HOME-override sandbox
approach that breaks npx's bin-linking inside the sandbox. Specifically,
when we set `HOME=$NPX_TEST_DIR` + `USERPROFILE=$NPX_TEST_DIR` +
`npm_config_cache=$NPX_TEST_DIR/.npm`, npx installs the package fine but
the `mindrian-os` bin symlink ends up at a location not on the sandbox
PATH. When npx then invokes the bin via `sh -c "mindrian-os ..."`, the
shell cannot find it.

**Two options for 126.2:**

- **Option B (the original deferred Bug 3 Option B).** Extend
  `~/mindrianos-install-site/` npm-installer source with a
  `--target=<dir>` flag. The installer reads the flag instead of
  defaulting to `~/.claude/`. Step 9.7 then passes `--target=$SANDBOX`
  and asserts the scaffold lands in the named dir. Cleaner long-term
  fix; eliminates the HOME-override hack entirely. Cost: edits a
  separate repo with its own publish cycle.
- **Option A2 (npm prefix-based sandbox).** Replace the HOME override
  with `npm install --prefix=$SANDBOX @mindrian_os/install` instead of
  `npx`. The `--prefix` flag controls the install root WITHOUT touching
  HOME, so the bin gets symlinked into `$SANDBOX/node_modules/.bin/`
  which IS on PATH for subsequent `sh -c` invocations. Stays in-repo;
  no second repo to coordinate.

**Recommendation:** Option A2 first (in-repo, single PR, simpler test),
then Option B in v1.14.0+ as the canonical retirement path.

**Acceptance gate:** After 126.2 ships, the Step 9.7 self-test must
pass on the next release cut (currently beta.18 or later) AND
`tests/test-release-bump-algebra.cjs` Test I must continue to assert
the sandbox path pattern is present (re-pointed for the new design).

**Family pre-mortem revisit:** Update `docs/install-cache-family-
premortem.md` Section 1 (append case #7: Step 9.7 design bug) and
Section 3 (Prediction E may now be reachable sooner if Option B is
chosen for 126.2).

---

## 118/deferred-items.md cleanup -- mark resolved

**What:** The pre-existing "Pre-existing build-command-registry teaching-
field gap" entry (118/deferred-items.md lines 5-20) is now RESOLVED.

`commands/mva-brief.md` and `commands/mva-option.md` both carry valid
`teaching:` frontmatter strings (verified Phase 122 invariant in this
quick task's chore commit 3d4e16b9). `node scripts/build-command-
registry.cjs --check` now exits 0 without `COMMIT_NO_VERIFY=1`.

**Action:** Edit `118/deferred-items.md` lines 5-20 to add a
"RESOLVED 2026-05-15 by Phase 126.1-hotfix quick task 260515-rd1"
header at the top of that section.

**Priority:** Low. Documentation hygiene.

---

## v1.14.0+ -- retire Step 9.6 + Step 9.7 entirely

**What:** Per `docs/install-cache-family-premortem.md` Section 3
Prediction E, replace the hardcoded version strings in the install-
minisite with `NEXT_PUBLIC_MINDRIAN_VERSION` env var on the Vercel
project OR build-time `npm view @mindrian_os/install version` fetch.
Either retires Step 9.6's manual surface AND the Step 9.7 gate
becomes trivially testable (the minisite reads from npm registry
directly, so `npx` round-trip becomes the only assertion needed).

**Priority:** v1.14.0 milestone planning.
