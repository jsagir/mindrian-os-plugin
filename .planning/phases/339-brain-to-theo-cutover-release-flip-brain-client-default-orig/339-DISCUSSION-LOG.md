# Phase 339: Brain-to-Theo cutover release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
**Areas discussed:** Coverage release gate, Adaptation scope, Stale installs + connectors
**Mode:** advisor (USER-PROFILE.md present), calibration tier minimal_decisive (profile: opinionated), technical framing kept (no keyed non-technical signals). Three gsd-advisor-researcher agents ran in parallel, read-only across both repos.

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Release shape | One release vs prep + flip-only | |
| Adaptation scope | URL-only vs fold silent-failure consumers | ✓ |
| Coverage release gate | Blocking checkpoint vs verbal go | ✓ |
| Stale installs + connectors | Refusal copy, connector key, tester comms | ✓ |

**User's choice:** the three above; Release shape left to Claude's discretion.

---

## Coverage release gate

| Option | Description | Selected |
|--------|-------------|----------|
| A. Blocking checkpoint | `checkpoint:human-action gate="blocking"` before release.sh, grepping Theo's 09-FLIP-RECORD.md for a dated `### Coverage ruling` section with Brain@sha pin, six figures, leg (b) citation, FLIP/HOLD verdict | ✓ |
| B. Verbal go, record after | Navigator says go in-session; ruling appended during 09-12 Task 4 | |

**User's choice:** A.
**Notes:** Researcher finding: under `mode: "yolo"`, human-action is the only checkpoint kind that halts; 269-05's checklist is the precedent AND the cautionary tale (it read PASS while real legs were unchecked). Cost: M's flip cut can sit blocked on a file only T writes; that is the declared seam. "Held" is a successful outcome.

---

## Adaptation scope

| Option | Description | Selected |
|--------|-------------|----------|
| A. Fold aliases + enrichment | Origin-derived alias table + additive `score` arm in enrichment-queue, prep release, incumbent-safe; chain-recommender rides as-is | ✓ |
| B. URL + memo + sweep only | Theo D-01 literally; one-line flip; enrichment queue goes dark unobserved | |

**User's choice:** A.
**Notes:** Researcher verified from code: alias map at `brain-client.cjs:1713` (roadmap's :1607 stale) is itself what breaks the match (unmapped `Undefined` would match Theo's `UnDefined`); chain-recommender degrades DISCLOSED (`unknown_problem_type` + disclosure offer); enrichment-queue is the one TRUE silent failure (`invalid_probe_result`, no log). Test-254 Arms 4/5 change in the same commit.

---

## Stale installs + connectors

### (i) Refusal copy

| Option | Description | Selected |
|--------|-------------|----------|
| Amend copy | `unreachable` + `no_key` copy in `refusal-messaging.cjs` name the two-command update path | ✓ |
| Leave copy | Path only in tester note + CHANGELOG | |

**User's choice:** Amend copy.
**Notes:** Today `:370-373` says "We can retry in a moment", false after a permanent suspend. Honest limit stated: stale bytes print stale strings; only soak + tester note reach un-updated installs. Fresh stale installs land on `no_key` (HTTP 503 at `_tryAutoRegister`), not `unreachable`.

### (ii) Connector key

| Option | Description | Selected |
|--------|-------------|----------|
| Keep mindrian-brain | URL-only doc change; matcher untouched; docs say the key names the plugin's Brain slot | ✓ |
| Prescribe theo | Third matcher token in both files in one commit; user-visible rename | |

**User's choice:** Keep `mindrian-brain`.
**Notes:** Escalation surfaced: Theo's README prescribes key `theo`; `mcp__theo__*` tools fall outside the Part 8 egress guard (`part8-egress-guard-hook.cjs:153-154` allows when not recognized) and the sanitizer. Cross-repo note + T kickoff ask recorded as D-10.

### (iii) Tester comms

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone note + reminder | Own subject line at flip release naming suspend date; reminder at suspend minus one week | (adopted as discretion) |
| Fold into release notes | One send; deadline inside a feature list | |

**User's choice:** no answer returned for this sub-question; the recommended option was adopted as Claude's discretion and flagged for override in CONTEXT.md D-11.

### Done gate

**User's choice:** Create context.

---

## Claude's Discretion

- Release shape: two cuts (prep safe against both Brains, then flip-only). D-01.
- Tester comms (iii) per above. D-11.
- Alias mechanism (origin-derived table preferred), schema-memo mechanism, sweep granularity, update-path constant location, wave layout.

## Deferred Ideas

- chain-recommender Theo-shape adaptation; `brain-surface-contract.json` v2/annotation; `brain_write` / `ingest_framework` callers vs `WRITE_PATH_DISABLED`; Theo read allow-list widening; 269-05 engineering; Theo README key alignment (asked, not done here); Phase 267 stays blocked.
- Reviewed todos (none folded): registry-drift gate, F7 rescope, never-git-stash, ingest-skill-insight (a Brain write), deck slide-count.
