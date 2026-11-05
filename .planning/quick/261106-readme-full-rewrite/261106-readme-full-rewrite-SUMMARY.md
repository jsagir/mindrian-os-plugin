# Quick 261106-readme-full-rewrite: Summary

Rewrote the root README.md from scratch. Job first (find the real problem, right method, keep you honest, remember), then how it works, install, what you get, Eureka, three surfaces, the Part 8 promise, layers, optional extras, shortcuts, links, license.

Line count: 211 before, 184 after (`wc -l README.md`).

## Sources for every number in the README

| Number in README | Source command |
|------------------|----------------|
| Node.js 22.18.0 or newer | `grep '"node"' package.json` gives `>=22.18.0` |
| 113 commands | `ls commands/*.md \| wc -l` |
| 126 skills | `ls skills/*/SKILL.md \| wc -l` |
| 17 agents | `ls agents/*.md \| wc -l` |
| 4 pipelines | `ls pipelines/*/CHAIN.md \| wc -l` |
| 12 session events with hooks | `node -e "console.log(Object.keys(require('./hooks/hooks.json').hooks).length)"` |
| 28,131 nodes, 457 frameworks (dated 2026-10-01) | `docs/BRAIN-GRAPH-CENSUS.generated.md` (generated census, brain_stats) |
| 32-character install identifier | `docs/THEO-INSTALL-ID.md` line 17 (`crypto.randomBytes(16)`, 32 hex) |
| Part 8 | `docs/MINDRIAN-CANON.md` line 264 heading |

Removed because no source: plugin version number and badge (the old badge said beta.53; `node lib/core/repo-version.cjs` prints 2.0.0-beta.80, which is unreleased, latest released is beta.79), "10+ prompts", Claude plan price, SSO and Okta note, Windows native-modules note, example refusal digits, readiness score example, "six Brain tools".

Install commands checked against `.claude/includes/release-process.md`: marketplace add, `claude plugin install mos@mindrian-marketplace`, `/plugin marketplace update`, `claude plugin update mos@mindrian-marketplace`. `bin/cli.js` has `update` and `doctor` cases. `npx @mindrian_os/cli` kept as the one-command alternative (documented in bin/cli.js messages).

Eureka claim: `commands/eureka.md` and CHANGELOG describe a local engine located by `MINDRIAN_EUREKA_ROOT` plus an optional measuring tool installed by `/mos:eureka enable`. README states it needs these and does not work on a bare install.

No claim about phases 384 to 386.

## Tests that pin README text

Before the edit:
- tests/test-250-doctrine-fence.cjs: pass 6 of 6
- tests/test-341-install-sh-retired.cjs: PASS=7
- tests/test-first-touch-drift-scanner.cjs and scripts/check-first-touch-drift.cjs: pass
- tests/test-127-03-no-em-dashes.sh: pass
- tests/test-115-surfaces-grep.sh: FAIL at assertion 3 (README lacked the bold tagline)

After the edit: the first four pass again. test-115 passes assertion 3 (the new README carries the bold tagline `For founders stuck on a decision they can't name.`) and now stops at assertion 5, which fails because `docs/testers/REGISTRY.md` does not exist. That failure is pre-existing and not caused by this change. No other file was edited.

Checks: `grep -c "—" README.md` prints 0. `grep -c "–" README.md` prints 0. `grep -n "PWS" README.md` prints nothing (the license line now reads "PwS / Mindrian").

## Deviations from Plan

None.

## Deferred

- tests/test-115-surfaces-grep.sh assertion 5 fails on a missing `docs/testers/REGISTRY.md` (pre-existing, out of scope).
- The README holds the Brain graph counts from a census dated 2026-10-01. Regenerate the census to refresh them.

## Known Stubs

None.

## Self-Check

Self-check: PASSED after commit (see report).
