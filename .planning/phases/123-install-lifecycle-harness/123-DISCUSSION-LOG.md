# Phase 123: install-lifecycle-harness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `123-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 123-install-lifecycle-harness
**Areas discussed:** Install-state record + consumer contract; Deployment-surface manifest; release.sh pre-release bump + dirty-repo guard; doctor drift classes + --acceptance gate
**Advisor mode:** off (no USER-PROFILE.md)

---

## Area selection (multiSelect)

| Option | Selected |
|--------|----------|
| Install-state record + consumer contract | ✓ |
| Deployment-surface manifest | ✓ |
| release.sh: pre-release bump + dirty-repo guard | ✓ |
| doctor drift classes + --acceptance gate | ✓ |

User selected all four.

---

## Area 1 — Install-state record + consumer contract

### Q: Consumer model — how do the four readers treat ~/.mindrian/install-state.json?

| Option | Selected |
|--------|----------|
| Layered: record fast-path, resolver fallback, absence-after-session = doctor flag (Claude-recommended) | |
| Hard dependency: record absence is an error everywhere | ✓ |
| Advisory only: record is a cache, resolver is always authoritative | |

**User's choice:** Hard dependency.
**Reflected back / refined into context:** consumers surface an explicit actionable error on a missing record (never crash, never silent guess, do not self-run the resolver); `doctor` is carved out — for it, "record absent" is a drift finding with a `--fix`; `session-start` writes the record in its earliest steps as the single writer, folding the `~/.mindrian-last-version` write into the same step. → D-01, D-02, D-03.

### Q: What does the record carry — resolver output + surface hashes only, or a full snapshot of the version-of-record cross-check values?

| Option | Selected |
|--------|----------|
| Resolver output + surfaces[] only; doctor re-derives the cross-check live (Claude-recommended) | |
| Record is a full snapshot of everything doctor needs | ✓ |
| (n/a) | |

**User's choice:** Full snapshot.
**Reflected back / refined:** record stores `installed_plugins_version` / `statusline_renders_version` / `last_version_file_value` / `path_bin_version` at write time; doctor reads the snapshot AND does one live spot-check of `active_version` vs `installed_plugins.json` → divergence reported as "record stale, re-run session-start", not "install drift". → D-04, D-05.

### Q: Hash-checked vs marker-checked per deployment surface?

| Option | Selected |
|--------|----------|
| Dispatcher shim + pre-commit hook = marker; settings.json line + last-version file = exact; $PATH bin = observed-only (Claude-recommended) | |
| Everything owned = exact hash against a frozen expected blob | |
| Everything = marker-only (presence of sentinel, content free) | ✓ |

**User's choice:** Everything = marker-only.
**Reflected back / refined:** kept marker-presence for the script/hook surfaces; for the two single-canonical-value surfaces (`~/.mindrian-last-version`, the `settings.json` statusLine line) the "marker" IS the exact expected value, so the check stays presence-of-exact-string (`exact-value` check kind), not a content hash; plugin-bin `$PATH` entry stays observed-only; install-state.json excluded from its own check. → D-09.

---

## Area 2 — Deployment-surface manifest

### Q: Where does the list of owned surfaces live?

| Option | Selected |
|--------|----------|
| data/deployment-surfaces.json — single source of truth, session-start + doctor both read it (Claude-recommended) | ✓ |
| Hardcoded table in a shared lib module (lib/core/deployment-surfaces.cjs) | |
| Keep it scattered (status quo) — just document the list in this spec | |

**User's choice:** data/deployment-surfaces.json. → D-06, D-07.

### Q: When does session-start reconcile owned surfaces?

| Option | Selected |
|--------|----------|
| Every session, but cheaply: compare-then-write-only-if-different (Claude-recommended) | |
| Only on version change (active_version != ~/.mindrian-last-version) | ✓ |
| (n/a) | |

**User's choice:** Only on version change.
**Reflected back / refined:** `session-start` reconciles on version change only (an absent `~/.mindrian-last-version` counts as a change → fresh installs get stamped on first session); `doctor --fix` and `doctor --acceptance` do a full unconditional manifest walk + reconcile, so mid-version corruption has an explicit recovery path. → D-10.

### Q: Owned (stamped) vs observed-only — which surfaces?

| Option | Selected |
|--------|----------|
| Owned: statusline shim, settings.json line, pre-commit (dev clones), install-state.json, ~/.mindrian-last-version. Observed-only: plugin-bin $PATH. (Claude-recommended) | ✓ |
| Same split, but also treat installed_plugins.json as owned (repair it on --fix) | |
| (n/a) | |

**User's choice:** the recommended split. (Note: D-13 later DOES allow conservative `installed_plugins.json` repair via `--fix` under hard preconditions — distinct from "owned surface stamped every session".) → D-08.

---

## Area 3 — release.sh: pre-release bump + dirty-repo guard

### Q: Pre-release bump algebra (replacing the IFS='.' read that mangles 1.13.0-beta.11)?

| Option | Selected |
|--------|----------|
| Semver-correct parse hand-rolled in bash (Claude-recommended) | |
| Add the npm 'semver' package and call semver.inc() from a node one-liner | ✓ |
| Keep patch/minor/major only; pre-releases stay hand-cut | |

**User's choice:** add `semver`.
**Reflected back / refined:** `semver` goes in `devDependencies` (release.sh is dev tooling, never shipped) — stays out of the `files` allowlist; release.sh checks `node_modules/semver` (or runs `npm install`) first; semantics: `--prerelease` → `semver.inc(v,'prerelease','beta')`; `patch|minor|major` finalize the core; `--start-prerelease <core> <channel>` opens a fresh series. → D-18.

### Q: Does release.sh bump plugin.json/package.json to the NEXT pre-release immediately after shipping?

| Option | Selected |
|--------|----------|
| Yes, one commit (Claude-recommended; matches the spec) | ✓ |
| Yes, but two commits (cleaner tag checkout) | |
| No — plugin.json stays at the just-shipped vN | |

**User's choice:** one commit.
**Reflected back / refined:** flagged as OPEN for the researcher — if Claude Code reads the installed version from `plugin.json` (not `marketplace.json`), the one-commit form means installing `ref: vN` self-reports `vN+1`, and the planner must flip to the two-commit form (tag on the pre-bump commit). → D-19.

### Q: Dirty-repo / ahead-of-origin guard before release.sh pushes?

| Option | Selected |
|--------|----------|
| Require ahead==1 after the release commit; abort if more unpushed commits exist (--allow-ahead escape); block dirty tracked files except the bumped ones (Claude-recommended) | ✓ |
| Detect 'not my commit' by git author | |
| Always cut on a throwaway release/vN branch | |

**User's choice:** the recommended ahead==1 guard. → D-20.

---

## Area 4 — doctor drift classes + --acceptance gate

### Q: How do the new install-lifecycle checks slot into doctor's existing class roster (A–G)?

| Option | Selected |
|--------|----------|
| New class H (install-state + topology + version consistency) + new class I (manifest reconciliation); Bug 7 fixed in the existing legacy-clone check (Claude-recommended) | ✓ |
| One new class H covering all of it; Bug 7 inside H | |
| No new class — extend the existing class G | |

**User's choice:** the recommended H + I split. → D-11, D-12.

### Q: Which new checks get an auto-recovering --fix vs stay flag-only?

| Option | Selected |
|--------|----------|
| --fix auto-recovers: missing record, drifted owned-surface markers/values, ~/.mindrian-last-version mismatch. Flag-only: topology not-found/legacy, plugin-bin $PATH mismatch, statusline-renders-wrong-version. (Claude-recommended) | |
| --fix recovers everything it possibly can, including migrating a legacy clone to marketplace-cache and rewriting installed_plugins.json | ✓ |
| Flag-only for ALL new checks; no auto-fix | |

**User's choice:** aggressive --fix.
**Reflected back / refined:** allowed, but under hard preconditions — `legacy` vs `dev-clone` distinguished and `dev-clone` is untouchable; legacy migration is backup→verify→remove and refuses on uncommitted/unpushed work; `installed_plugins.json` repair is conservative (repoint, don't rewrite) + backed up + restart-noted; every --fix op is backup-before-mutate / idempotent / never touches the active root; still flag-only where nothing is safe (topology not-found, $PATH pointing at a vanished dir, statusline rendering the wrong version = a resolver bug to surface, not paper over). → D-13.

### Q: What does `mindrian-os doctor --acceptance` assert, and how hard does release.sh gate on it?

| Option | Selected |
|--------|----------|
| 5-point contract; wraps scripts/verify-release; two sub-modes (pre-tag + full); release.sh runs both as HARD gates with no override (Claude-recommended) | ✓ |
| Same 5-point contract, but release.sh runs it warn-only (y/n to proceed) | |
| Lean --acceptance: just `doctor --all exits 0` + repo-file version consistency; skip npx round-trip and npm-published check | |

**User's choice:** the recommended 5-point / 2-submode / hard-gate. → D-14, D-15, D-16, D-17.

---

## Wrap-up

**Q: Anything else to lock before writing the context file?**

| Option | Selected |
|--------|----------|
| Write the context file — that covers it | |
| One more area — I'll say which | ✓ |
| Adjust one of the decisions above | |

User picked "One more area" but, when asked which, replied **"go on"** — interpreted as an advancement phrase (proceed). The remaining loosely-specified items (cache-pruning retention N, npx round-trip mechanics, --acceptance on Windows, single-writer of ~/.mindrian-last-version, manifest schema details, pre-commit-hook surface scope) were captured either as concrete decisions (D-03, D-07, D-08, D-14, D-17, D-22) or under "Claude's Discretion" with stated defaults. CONTEXT.md written.

## Claude's Discretion

- Exact field names in `data/deployment-surfaces.json` (D-07 set is the floor).
- `npx` round-trip sandbox mechanics inside `--acceptance` (D-14 suggests `mktemp -d`).
- Cache-pruning retention count N (D-22 suggests 2).
- Whether classes H / I get their own CLI flags or share one.
- Internal structure of `--acceptance`; which existing harnesses it wraps vs supersedes.

## Deferred Ideas

- Phase 92 Drift Detection Engine (canon drift ≠ install-state drift).
- Desktop/Cowork install-state parity beyond the basic record.
- GitHub-side enforcement of the Part-8 brain-boundary PR gate.
- Auto-migrating a `dev-clone`.
- `--analyze`/`--batch`/`--text` parity for `--acceptance` output.
