# Install-Lifecycle Harness — Spec

Status: proposed (scaffold)
Date: 2026-05-12
Author: Jonathan Sagir with Claude-as-Larry
Canon parts: Part 6 (Product-as-Venture / dog-fooding mandate), Part 5 (Evidence Is Graded By Context)

> **Note (Phase 123 implementation):** this document is the original spec.
> The planning artifacts at `.planning/phases/123-install-lifecycle-harness/`
> (CONTEXT + RESEARCH + per-plan PLANs + SUMMARYs) supersede this doc where
> they differ. References to `scripts/release-beta-smoke.sh` are obsolete --
> that script was retired in Plan 123-04 and replaced by
> `mindrian-os doctor --acceptance --pre-tag` (run by `release.sh` before
> the tag) and the full `mindrian-os doctor --acceptance` (run after the
> publish).

---

## The disease

A 2026-05-12 Windows live test of `v1.13.0-beta.12` surfaced a *family* of install/update bugs — and they were all one bug wearing different coats:

| Symptom | What it actually derived from |
|---|---|
| `mindrian-os doctor` crashed (`MODULE_NOT_FOUND`) | a hardcoded legacy install path (`~/.claude/plugins/mindrian-os/`) |
| statusline showed `1.12.0` (stale) | a pure-semver regex (`^[0-9]+\.[0-9]+\.[0-9]+$`) that rejected `-beta.N` |
| deployed `~/.claude/statusline-mos` stayed byte-stale | `session-start` re-copying from *its own* `PLUGIN_ROOT` (which lags the just-updated version) |
| `~/.mindrian-last-version` reads `unknown` | the SessionStart hook's version resolver — same family of guess |
| `doctor` false-positives on marketplace-only installs (Bug 7) | "no legacy clone dir" treated as drift, when that dir never exists for a `claude plugin install` |
| version-number treadmill (beta.10→11→12→13, each "burned") | no separation between "the version in the repo" and "the version published" |
| releases hand-rolled | `release.sh` only handles clean `X.Y.Z` bumps → "never bump by hand" violated → the 1.9.9-vs-1.9.4 drift mechanism |
| a parallel process's commits hitchhiked into a release push | `release.sh` pushes whatever's on `main`, not just the release commit |
| cache accumulates every version, no prune | nothing prunes `~/.claude/plugins/cache/<marketplace>/mos/` |

**The pattern:** there is no single authoritative answer to "what version is active, where is it installed, and is the install consistent?" — so every consumer (doctor, statusline, the SessionStart hook, the plugin-bin PATH entry) re-derives it with its own ad-hoc heuristic, and each heuristic is wrong in a different way. No contract, no enforcement, every actor improvising.

This is Canon Part 6 biting back: the plugin's own install lifecycle doesn't honor the plugin's own canon. And it has the same *shape* as Part 9's memory constitution — a closed set of allowed mutations, a single enforcement chokepoint, human/CI confirmation as the only path to "trusted" — applied one level down, to the install state instead of the room memory.

---

## The contract (one line)

> Nothing improvises the install state. **One record** is the truth; **one manifest** says what should be on disk; **one command (`doctor`)** enforces the contract on every session and every release; **`release.sh`** is the only thing that touches a version.

---

## The five pieces

### 1. One install-state record

`~/.mindrian/install-state.json`, written by `session-start` on every session start. Fields:

- `active_version`, `active_root` — resolved via `lib/core/active-plugin-root.cjs` (already shipped: `MINDRIAN_OS_ROOT` → `installed_plugins.json` → newest pre-release-tolerant marketplace-cache dir → legacy clone → not-found).
- `topology` — `marketplace-cache | dev-clone | legacy | not-found`.
- `resolved_at` — timestamp.
- `surfaces` — for each deployed surface (see piece 2): `{ path, expected_kind, expected_hash | expected_marker, observed_hash | observed_marker, ok }`.

Every consumer reads this: the statusline banner, `~/.mindrian-last-version`, `bin/cli.js`, `doctor`. If `session-start` can't write it (e.g. node missing), the *absence* of this file is itself a hard-flagged state — never a silent `unknown`.

**Status:** the resolver (`lib/core/active-plugin-root.cjs`) is shipped. The record file is not.

### 2. A deployment-surface manifest

MindrianOS writes a *set* of files outside the plugin directory. Today that set is scattered across `install.sh` and `scripts/session-start` with no list — which is exactly how the statusline shim rotted unnoticed. Make it explicit (`data/deployment-surfaces.json` or a section in this spec):

| Surface | Owner | Expected form |
|---|---|---|
| `~/.claude/statusline-mos` | `session-start` Step A | the dispatcher shim (`scripts/statusline-mos-dispatch`, marker `MINDRIAN-STATUSLINE-DISPATCH`) — *shipped* |
| `~/.claude/settings.json` `statusLine.command` | `session-start` Step B | `bash "$HOME/.claude/statusline-mos"` |
| `<repo>/.git/hooks/pre-commit` (dev clones) | `session-start` hooks block | the ROOM.md/MINTO.md guard |
| `~/.mindrian/install-state.json` | `session-start` (piece 1) | the record above |
| `~/.mindrian-last-version` | `session-start` / SessionStart hook | `active_version` |
| plugin-bin on `$PATH` | Claude Code (not us) | `…/mos/<active>/bin` — *observed only*, not stamped |

`session-start` walks the manifest and reconciles each owned surface. `doctor` walks it and flags. The dispatcher (piece-2 design, already shipped) is the principle generalized: the deployed file carries *zero logic* — it resolves at runtime — so a fix in the plugin reaches the deployment surface on next session with no re-stamp.

**Status:** the dispatcher shim is shipped (`scripts/statusline-mos-dispatch` + the `session-start` Step A migration). The manifest as a data file is not.

### 3. `doctor` drift classes = the exhaustive enumeration of how the lifecycle breaks

Each class has a name, a check, and a `--fix`, and each has a test fixture. The contract `doctor` asserts:

> `installed_plugins.json` active version == `~/.mindrian/install-state.json` `active_version` == the version the deployed statusline renders == the version the SessionStart banner reports == the version on the plugin-bin `$PATH` entry.

Any divergence is a class. Plus the topology classes — and **Bug 7's fix lives here**: "marketplace-cache install present per `installed_plugins.json`" is a *healthy* topology, not drift; "no legacy clone dir on a marketplace-only box" is *expected*, not a finding.

**Status:** `doctor` checks a subset today (`install-cache`, `dev-source`) and has the Bug-7 false positive. Not done.

### 4. `mindrian-os doctor --acceptance`

The release gate, as a command. It runs the full contract check: install record present + consistent, every owned deployment surface reconciled, version-of-record consistency across `plugin.json` / `package.json` / CHANGELOG / git tag / marketplace `source.ref` / the published npm version, the `npx @mindrian_os/cli` round-trip works, `doctor` exits 0. "Release infrastructure ALWAYS ships as a beta validated by Lawrence" then *means* "Lawrence ran `mindrian-os doctor --acceptance`, all green" — not "Lawrence eyeballed the statusline." `release.sh` runs it before it tags anything.

This replaces the ad-hoc 5-test suite the Windows tester re-ran by hand every cycle.

**Status:** not done.

### 5. `release.sh` owns versions — pre-releases included — and refuses on a dirty repo

- Teach it `--prerelease` (`beta.N → beta.N+1`). It currently does `IFS='.' read -r MAJOR MINOR PATCH` which mangles `1.13.0-beta.11` (`PATCH=0-beta`); it choked on the pre-release version, which is why beta.10 / 11 / 12 / 13 were hand-rolled.
- Fix Step 9.5: the live package is `@mindrian_os/cli`; `@mindrian_os/install` is the dead one (abandoned at beta.36). Phase 123 Plan-01 finalized the package name across `scripts/release.sh`; Plan-05 finished the doc/test sweep.
- `plugin.json` is always "the next version to ship." `release.sh` ships it *and* bumps to the next pre-release in the same commit — so there is never a "repo says `beta.11`, registry already has `beta.11`" state, and the CHANGELOG `[Unreleased]` heading tracks the next version instead of being repeatedly re-finalized.
- Before it pushes: snapshot `git log origin/main..HEAD`, print exactly what is going up, and refuse (or do the release on a branch) if the delta isn't just the release commit — so a parallel process's commits can't hitchhike (a Phase 109 docs commit did, into the beta.12 push).

**Status:** not done.

---

## What this absorbs (the loose-thread queue)

- Bug 7 (doctor false-positive on marketplace-only installs) → piece 3.
- `release.sh` pre-release support + Step 9.5 package rename → piece 5.
- Cache pruning on update (`~/.claude/plugins/cache/<marketplace>/mos/` accumulates) → a `session-start` / `doctor --fix` step keyed off `installed_plugins.json` (keep the active version + N most recent; never delete the active one).
- `@mindrian_os/install` → `@mindrian_os/cli` doc/test sweep (`docs/install/PACKAGING-PATHS.md`, `tests/manual/95.6-windows-cold-install-acceptance.md`, `tests/test-release-npm-gate.sh`) → cleanup, fold into the same phase. (Done in Plan-05.)

---

## Already laid (do not re-do)

- `lib/core/active-plugin-root.cjs` — the one resolver (piece 1's core). `bin/cli.js` and `scripts/statusline-mos` delegate to it. Shipped in `v1.13.0-beta.12`.
- `scripts/statusline-mos-dispatch` + `scripts/session-start` Step A migration — the dispatcher shim (piece 2, applied to the statusline surface). Committed; ships in the next release.
- `scripts/statusline-mos` — pre-release-tolerant regex fallback; resolves via the canonical module. Shipped in `v1.13.0-beta.12`.

---

## Proposed phase

`install-lifecycle-harness` — declares `canon_parts: [5, 6]`. Plans, roughly:

1. `release.sh` pre-release support + dirty-repo guard + Step 9.5 rename (first — so the rest cuts via `release.sh`).
2. The install-state record + the deployment-surface manifest (pieces 1 & 2 finished).
3. `doctor` drift-class enumeration + `--fix`s + fixtures (piece 3, incl. Bug 7).
4. `mindrian-os doctor --acceptance` + wire it into `release.sh` (piece 4).
5. Cache pruning + the `@mindrian_os/install` → `@mindrian_os/cli` doc/test sweep (cleanup).
6. Cut `v1.13.0-beta.13` (and onward) via the now-fixed `release.sh`; validate with `--acceptance` on a real Windows box before promotion.
