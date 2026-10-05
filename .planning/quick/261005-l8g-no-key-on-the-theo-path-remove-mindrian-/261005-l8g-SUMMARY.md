---
phase: quick
plan: 261005-l8g
status: complete
completed: 2026-10-05
subsystem: brain-client / refusal rail / doctor / session-start / setup docs
tags: [SEED-119, theo, no-key, tier-0, no_key, bearer, register, part-8-untouched]
requires: [261005-kvv]
provides:
  - "brain-client calls Theo bare: no resolver, no Authorization header, no /register, no install token, no availability gate beyond a configured origin"
  - "refusal rail with five kinds (unreachable, tier_denied, not_ready, rate_limited, egress_blocked); the keyless kind, sentinel, upgrade hint and Larry hint are gone"
  - "tests/test-l8g-theo-bare.cjs: 7 arms pinning the bare contract"
affects: [Phase 369.5 (rename, docs, admin write path, legacy connector leg)]
key-files:
  created:
    - tests/test-l8g-theo-bare.cjs
  modified:
    - lib/core/brain-client.cjs
    - lib/core/refusal-messaging.cjs
    - lib/core/resolve-brain-key.cjs
    - scripts/mindrian-brain-mcp-client.cjs
    - scripts/session-start
    - commands/setup.md
    - skills/setup/SKILL.md
    - skills/brain-connector/SKILL.md
  deleted:
    - tests/test-250-silent-registration.cjs
    - tests/test-resolve-brain-key.cjs
commits:
  - 19fb0a720  test RED
  - a2126a394  feat GREEN
  - 9086840a6  test moves
decisions:
  - "Theo is called bare: isAvailable() is true whenever MINDRIAN_BRAIN_URL (or the default origin) is a non-empty string; a real outage is the existing unreachable refusal"
  - "lib/core/part8-egress-guard.cjs and every Part 8 test are byte-identical to the RED commit (git diff 19fb0a720 HEAD is empty for them)"
metrics:
  tasks: 4
  commits: 3 plus this SUMMARY
---

# Quick 261005-l8g: no key on the Theo path (SEED-119 plan 1)

The client now calls Theo bare. A fresh home directory with no `~/.mindrian.env`, no `MINDRIAN_BRAIN_KEY` and no install json gets a Theo answer on the first call: no Authorization header, no `POST /register`, no token file. The Tier 0 branch, the keyless refusal kind, the bearer header, the silent register leg and every Brain-key prompt on the Theo path are gone.

## Before and after (every number measured by a command run in this quick)

| Measure | Before (Phase 0 J2 / RED run on HEAD) | After |
|---|---|---|
| `isAvailable()` on a fresh HOME, nothing configured | false | true (A1) |
| Requests to the fake Theo carrying an `authorization` header, one `stats()` call | 2 (initialize, tools/call) | 0 (A2) |
| Requests to `/register` | made (J2: silent POST, random install UUID) | 0 (A2) |
| `~/.mindrian-install.json` after the call | written (J2 03b) | absent (A2) |
| Shim `brain_stats` over stdio on a fresh HOME | carried a bearer header; keyless sentinel when registration was off | fixture payload, nodes 4242, no auth header, no `/register` (A3) |
| brain-client lines matching `MINDRIAN_BRAIN_KEY / Authorization / Bearer / no_key / Tier 0 / tier0` (J2 grep: 8 lines) | 8 | 1 (the header comment that says no Authorization header is sent) |
| getApiKey / isAvailable / ensureAvailable / resolveBrainKey sites in brain-client (J2: 20) | 20 | 5 (isAvailable and ensureAvailable definitions, one self-call, two exports) |
| A4 grep gate offending lines over lib scripts bin commands skills agents hooks | 200 (first RED run, with the earlier case-insensitive Tier 0 pattern) | 0 (final pattern, see deviation 1) |
| A5 session-start offline: lines matching Brain key / Tier 0 / not configured | 1 ("Brain: not configured (Tier 0)") | 0 |
| REFUSAL_KINDS | 6 | 5 |

`node tests/test-l8g-theo-bare.cjs`: A1 to A7, 7 passed, 0 failed. The RED run on HEAD before any source change was 2 passed (A6, A7), 5 failed (A1 to A5); A5 first passed by accident because the earlier arm's fake `/register` left an install token in the shared HOME, so the test was fixed to use a fresh HOME, then re-measured red.

## Suite table (final run, after the test moves; baseline measured before any source change)

| Suite | Baseline PASS / FAIL | Final PASS / FAIL | Pre-existing red (named) |
|---|---|---|---|
| run-all-148 | 18 / 0 | 18 / 0 | none |
| run-all-149 | 8 / 0 | 8 / 0 | none |
| run-all-150 | 42 / 0 | 42 / 0 | none |
| run-all-239 | 9 / 0 | 9 / 0 | none |
| run-all-245 | 19 / 0 | 19 / 0 | none |
| run-all-247 | 3 / 1 | 3 / 1 | test-247-brain-client-403 Test 8 (`search()` returns `egress_blocked`, the 354-06 free-form gate, not `tier_denied`) |
| run-all-250 | 8 / 0 | 7 / 0 | none; one leg fewer because test-250-silent-registration was deleted |
| run-all-257 | 5 / 4 | 5 / 4 | Plan 06 shim honest refusal, Plan 07 egress invariant, Plan 08 strict input shapes, REGRESSION 254 ambiguous disclosure (the same four before and after; Part 8 tests, untouched; the shim's startup pre-warm `theo_health` call is counted by the zero-socket arm) |
| run-all-259 | 4 / 1 | 4 / 1 | test-259-brain-call-errorkind (closed port classification) |
| test-363-filing | exit 77 (fixture room absent, SKIP) | exit 0, PASS 51 / FAIL 0 | none |
| run-all-366 | 68 / 2 | 70 / 0 | baseline reds (doctor module contract parity, spike record --check) were not reproduced in the final run; peers' concurrent edits changed between the two runs, not this quick |

Gates: `build-connector-registry --check` OK, `build-orchestration-projection --check` OK, `check-render-coverage` 0 gap. `doctor --acceptance` 22 of 23 points; the one failure is `verify-release-clean-tree` (tracked-file drift, the peers' uncommitted work plus a tracked `.pyc`), environmental, not chased. New dashes in this quick's added lines: 0.

## Test files changed or deleted: 31 files (28 test files, 2 fixtures, 1 runner)

Rewritten to the bare contract (26): `lib/core/doctor/class-m-brain-smoke.test.cjs`, `lib/core/refusal-messaging.test.cjs`, `lib/memory/mcp-server-brain-deps.test.cjs`, `lib/memory/security-trifecta.test.cjs`, `lib/memory/session-start-brain-staleness.test.cjs`, `scripts/migrate-brain-mcp-from-http-to-stdio.test.cjs`, `tests/test-127-00-shim-handshake.sh`, `test-127-01-migration-safety.sh`, `test-127-02-doctor-class-m.sh`, `test-127-03-acceptance-gates.sh`, `test-245-drain-budget.cjs`, `test-245-skill-frontmatter-inert-keys.cjs`, `test-247-brain-client-403.cjs`, `test-249-capture-seam.cjs`, `test-250-refusal-shapes.cjs`, `test-250-transport-retry.cjs`, `test-252-guard-census.cjs`, `test-257-refusal-egress-kind.cjs`, `test-259-refusal-rate-limited.cjs`, `test-267-mcpv2-brain-shim.cjs`, `test-339-install-id-header.cjs`, `test-359-forward-harness.cjs`, `test-364-refusal-not-scored.cjs`, `test-acpt-05-brain-derive-tier-rise.cjs`, `test-c8j-brain-wire.cjs`, `test-c8j-chain-consumer.cjs`.
Deleted because the whole test pinned the key gate (2): `tests/test-250-silent-registration.cjs` (the register leg) and `tests/test-resolve-brain-key.cjs` (the resolver). Also: `tests/fixtures/267/wire-snapshot-zod3.json` and `zod4.json` (the `brain_write` description lost the words "regardless of key") and `lib/memory/run-feynman-tests.cjs` (dropped the deleted test from its list). One new file: `tests/test-l8g-theo-bare.cjs`.
`test-257-refusal-egress-kind.cjs` pins the refusal vocabulary (the five-member set), not egress content; it is a 257 file but not one of the Part 8 egress proofs, so only its kind list moved. `test-257-brain-tool-egress-invariant`, `test-257-shim-honest-refusal`, `test-257-strict-input-shapes`, `test-239-query-egress-canary` and `part8-egress-guard.cjs` were not touched.

## Deviations from the plan (all against real code)

1. **A4 scope.** `Tier 0` appears 260 times repo-wide in unrelated senses (a room.db cold start, HSI tiers, degradation rungs). The arm checks `MINDRIAN_BRAIN_KEY | no_key\b | tier0Response | mindrian-install.json | DISABLE_AUTO_REGISTER | Brain key | /register` repo-wide and `Tier 0` only on the 19 files that carry the Theo path; `commands/setup.md` and `skills/setup/SKILL.md` are key-checked only (their HSI section has its own tier ladder). `/register` is matched as a route, not `register-core-tools`. Excluded by name with reasons (in the test): the admin write scripts, the two Jev (TypeSafe) scripts that say `no_key` about another service, `lib/memory/run-feynman-tests.cjs`. Built assets (`dist`, `.next`) are not scanned.
2. **A7.** `test-257-brain-tool-egress-invariant.cjs` exits 1 on HEAD before any change (Arm 2 counts the shim's startup `theo_health` pre-warm as a socket). The arm asserts no failure beyond that one; `test-239-query-egress-canary.cjs` is asserted to exit 0.
3. **More files than the plan list**, all direct consumers of what was removed: seven callers of `refusalResponse('no_key')` (`lib/brain/chain-recommender`, `framework-chain-slice`, `lib/core/brain-derivation`, `research-corpus`, `rs-chain-feeder`, `lib/mcp/brain-router`, `scripts/brain-derive-command`), `scripts/migrate-brain-mcp-from-http-to-stdio.cjs` (it imported the deleted resolver; the two-key refusal is gone, a legacy entry is removed whatever header it carried), `lib/core/meter/two-gauge.cjs`, `lib/core/integration-registry.cjs`, `lib/core/mva-classifier.cjs`, `lib/mcp/brain-composition-census.cjs`, `scripts/build-dist-bundles.cjs`, `scripts/fetch-brain-baseline.cjs`, `scripts/forward-fork-scenarios-359.cjs`, `scripts/measure-hook-cold-start.cjs`, `scripts/check-cross-connection-honesty.cjs`, `scripts/rs-experts-command.cjs`, `scripts/rs-thesis-command.cjs`, `commands/rs-experts.md`, `commands/rs-thesis.md`, `skills/rs-experts/SKILL.md`, `skills/rs-thesis/SKILL.md`, plus `data/command-registry.json` and `data/harness-manifest.json` regenerated because the pre-commit hook demanded it (the manifest also picked up a peer's `larry-extended.md` digest).
4. **Rule-4-free design calls, stated.**
   - The 401 `invalid_key` sentinel is gone (no key is sent, so a 401 is an outage: null, then the `unreachable` refusal).
   - `tier_denied` copy and `larryRefusalLine` say "this install's tier"; the next-move handle `check_key_tier` became `check_tier` (no code reads it).
   - Doctor layer L2 `key_resolver` became `origin_configured` (id and name changed, seam `mockResolveKey` became `mockAvailable`).
   - `integration-registry` lost its `brain` entry (Theo is not an integration), so the proactive "connect Brain" offer is gone.
   - `lib/core/meter/two-gauge.cjs`: `subject_class` could only be `navigator` by comparing a key fingerprint; with no key it is `maintainer` (dogfood marker) or `unknown`. A positive navigator signal now needs a new local source (owner: a later phase).
   - `lib/hmi/decoy-tier.cjs` stays pure: an absent `brainAvailable` means tier-0, because `tests/test-decoy-tier.cjs` forbids that file from requiring the client. `lib/hmi/tier-check.cjs` uses `brainClient.isAvailable()` as planned. Nothing in lib or scripts requires decoy-tier.
   - Wire and enum strings kept: the shim envelope `stage: 'tier_0_<kind>'` (pinned by `test-257-shim-honest-refusal`, a Part 8 test I may not edit), the decoy enum `tier-0` and `modeForTier` `'0'`, `source:'tier0'` history bullet in brain-connector (pinned by `test-250-provenance-fence`).
   - `lib/core/install-id.cjs` needed only comment edits: its id was already local and random, not a key derivative, and the install token file was a different file.
5. **Behavior change worth reading.** `isAvailable()` is now always true, so the branches that fired on "no key" are dead in production: `ensureSectionDerived`'s local no-Brain derivation (it now goes straight to the live `deriveSection`), the derivation drain (an unreachable Theo no longer leaves entries queued by the availability gate), and session-start's enqueue of stale sections (it enqueues on any install). Tests that need the unavailable branch stub `isAvailable` to false (`test-acpt-05`, `test-c8j-chain-consumer`).
6. **Operational notes.** Two `git checkout -- <file>` calls on my own diffs (a comment in `scripts/release-lib/theo-stamp-gate.sh` and one in `lib/core/resolve-active-room.cjs`, both out-of-scope edits I reverted); no other checkout, no switch, no stash, no reset. The shared scratchpad directory was written by a peer mid-run (my `base/` folder was replaced); baseline numbers above were taken before that and recorded in this session.

## 369.5 leftovers found (not touched)

- **Admin write path loses its credential channel (functional, not just wording).** `scripts/admin-brain-write.cjs`, `scripts/backfill-correlation-id.cjs --execute` and `scripts/seed-brain-commands.cjs --execute` called `brain-client` with an admin `MINDRIAN_BRAIN_KEY`; the client now sends no header, so Theo will refuse their writes as `tier_denied`. They need their own operator client.
- `commands/admin.md` and `skills/admin/SKILL.md`: the hidden "Brain API key" admin panel (description, hitl_why, teaching, six intro lines).
- `lib/wiki/wiki-layout.cjs` lines 81, 285, 297: generated wiki footer says "Brain Access" and "API key required" and links `brain-access`.
- The rename `mindrian-brain` to `theo`, the `brain_*` verb aliases, `BRAIN_EGRESS_BLOCKED` wording, `stage: 'tier_0_*'` and the `tier-0` decoy enum, Canon wording, `.claude/includes/decisions.md` decisions 1 and 5, README and docs sweeps (`docs/339-NOTE-theo-desktop-connector-key.md`, `docs/BRAIN-IDENTITY-DESIGN.md`).
- `scripts/part8-egress-guard-hook.cjs` `pws-brain-mcp` branch and the doctor leg that retires the legacy connector.
- `scripts/release-lib/theo-stamp-gate.sh` header ("A key resolves through brain-client") and `scripts/release.sh:1040` ("Brain-key code") comments; `scripts/check-brain-tool-liveness.cjs:55` comment.
- `scripts/build-brain-census.cjs` still writes `key_tier_lane_a` / `key_tier_lane_b` into the census artifact and markdown; `scripts/probe-brain-contract.cjs` legs still describe read-tier tier gates of the old backend.
- `lib/memory/mcp-server-brain-deps.test.cjs` T2 and T4 and `.env.brain.template` still list `MINDRIAN_BRAIN_KEY` for the legacy bundled server (T4 fails on HEAD, pre-existing).
- Pre-existing, unrelated reds seen: `tests/test-257-*` (four), `test-247-brain-client-403` Test 8, `test-259-brain-call-errorkind`, `test-249-capture-seam` Tests 1/6/7/8 (egress disclosure decorates the payload), `security-trifecta` (two arms: HSI timeout site count, sanitizeCypherInput count 8 vs 9), `test-127-00` Tests 4 and 6 (bin to scripts move), `mcp-server-brain-deps` T4.

## Self-Check: PASSED

- tests/test-l8g-theo-bare.cjs present; commits 19fb0a720, a2126a394, 9086840a6 present on main; Part 8 files byte-identical to 19fb0a720.
