---
phase: 250
slug: honesty-rail-doctrine-amendment
status: draft (pre-execution)
note: "Every referenced 250 test file is born RED-first INSIDE the tdd task that needs it (no separate Wave 0 plan - the 249 precedent); wave_0_complete flips true when 250-01 lands its suites and runner. Two mid-planning navigator rulings are folded in: SEED-011 = Option A baked-in behavior (REQUIREMENTS.md HONEST-03, 2026-08-10 - plan 250-04 exists because of it, coordinator-authorized 4th plan) and AVAIL-02 rides plan 250-01's transport task. AVAIL-01/AVAIL-03 are NOT this phase's (they ride 247-03's ceremony)."
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
source: 250-RESEARCH.md "## Validation Architecture" section (2026-08-10) + REQUIREMENTS.md navigator rulings 2026-08-10
---

# Phase 250 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Two repos: plugin
> (CJS, node --test + plain assert scripts) and ProblemsWorthSolving-Brain (ESM,
> node --test). The eval-honesty rule binds everything here: a test that cannot fail is
> not evidence - every gate ships a demonstrated red proof, and the doctrine fence's
> pre-rewrite RED run (7 known kill-list hits) is itself the fence's can-fail proof.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node --test (plugin `tests/test-250-*.cjs`; brain `tests/*.test.mjs`) + the plain-assert lock test `lib/core/tier0-messaging.test.cjs` + bash phase runner |
| **Config file** | none (convention-based); Node >= 22.16.0 (plugin floor) |
| **Quick run command** | `node --test tests/test-250-<name>.cjs` (plugin) / `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/register-endpoint.test.mjs` (brain) |
| **Full suite command** | `bash tests/run-all-250.sh` (created by 250-01 Task 1: glob discovery of tests/test-250-*, found-eq-0 guard, em-dash fence) + brain `node --test tests/` |
| **Live legs** | /register probe on pws-brain-mcp.onrender.com (250-04 checkpoint, operator ceremony) + the three-surface released-build matrix (manual, restart-to-apply rule) |
| **Estimated runtime** | hermetic suites ~10-40s per file (retry test uses tiny env-tuned backoffs); live legs ride the 250-04 checkpoint (Render cold start possible) |

---

## Sampling Rate

- **After every task commit:** run the task's own `<automated>` command (every task in all 4 plans carries one, including both checkpoint plans' surrounding tasks).
- **After every plan wave:** `bash tests/run-all-250.sh` green + `node lib/core/tier0-messaging.test.cjs` green + `node scripts/build-dist-bundles.cjs --check-stale` exit 0; waves 2+ add `node scripts/check-shape-declaration.cjs --check` (baseline-diff) + `node scripts/build-connector-registry.cjs --check`; wave 4 adds brain `node --test tests/`.
- **Before the phase gate:** both repos' suites green + both fences green + the amendment ratified + the 250-04 checkpoint's operator deploy, live /register probe, and three-surface released-build matrix complete.
- **Max feedback latency:** < 60s for the hermetic layer; live legs are checkpoint-scoped (async-tolerant).

---

## Per-Requirement Verification Map

| Req | Behavioral contract | Test type | Automated command | Test file | File exists | Plan/Task | Coverage |
|-----|---------------------|-----------|-------------------|-----------|-------------|-----------|----------|
| HONEST-01 | refusalResponse four kinds: honest per-kind reason; unreachable-with-key NEVER says "key not set"; no_key keeps DIRECTOR_NOT_AVAILABLE + the 5 byte-locked keys; shim null branches flipped (source assertion) | unit (hermetic) | `node --test tests/test-250-refusal-shapes.cjs` | `tests/test-250-refusal-shapes.cjs` | NO - born RED in task | 250-01 T1 | HIGHEST (the conflation bug is the live dishonesty) |
| AVAIL-02 | transient (network/5xx) retries with bounded backoff BEFORE null; 401/403 zero-retry; null contract unchanged (null = transport failure AFTER budget); env override + invalid-value fallback | unit (loopback node:http server) | `node --test tests/test-250-transport-retry.cjs` | `tests/test-250-transport-retry.cjs` | NO - born RED in task | 250-01 T1 | HIGH (a blip must never become a refusal) |
| HONEST-01 | refuseNotReady enqueues source:'refusal' (never captureReadinessMiss), idempotent-merges with live_reach (hit_count++, no downgrade), never throws; renderRefusal per-kind copy | unit (temp room dirs) | `node --test tests/test-250-refusal-queue.cjs` | `tests/test-250-refusal-queue.cjs` | NO - born RED in task | 250-01 T2 | HIGH |
| HONEST-01 | hot-path fence: no refusal/queue require reachable from sensors/decide | fence (existing + Test 5 extension) | `node --test tests/test-249-capture-seam.cjs` | `tests/test-249-capture-seam.cjs` | EXISTS | 250-01 T2 verify | HIGH (1200ms NAV budget untouched) |
| HONEST-01 | doctrine phrases dead: /silent fallback/i and /never mention (failures\|this bookkeeping)/i absent from skills/, commands/, agents/, dist/ (closed 2-pattern list, Pitfall 6 scoping) | fence (scoped grep, red-first: 7 known hits pre-rewrite) | `node --test tests/test-250-doctrine-fence.cjs` | `tests/test-250-doctrine-fence.cjs` | NO - born RED in task | 250-01 T3 | HIGHEST (the phase's success criterion 1) |
| HONEST-02 | amendment doc: BOTH replacement rows verbatim, five causal-record anchors, effective clause, no em-dash, AND decisions.md rows 1/8 still OLD (lockstep negative assertion; inverts only on an explicit inline-now ruling) | unit | `node --test tests/test-250-amendment-unit.cjs` | `tests/test-250-amendment-unit.cjs` | NO - born RED in task | 250-02 T2 | HIGHEST (Pitfall 4 is the named worst state) |
| HONEST-02 | Form B hitl_stages conformant, connector.excluded retained, NO new warns vs pre-edit baseline | gate (baseline-diff) | `node scripts/check-shape-declaration.cjs --check` | script EXISTS | EXISTS | 250-02 T2 | HIGH |
| HONEST-02 | R1 connector ledger unbroken (excluded stays) | gate | `node scripts/build-connector-registry.cjs --check` | script EXISTS | EXISTS | 250-02 T2 | HIGH (hard-fails closed) |
| HONEST-03 | provenance contract strings in SKILL.md + BOTH dist mirrors (■ BRAIN form, degrade form, partial form, absence-is-signal, tier0-disclosure, anti-nagging); LIVE collision guard: countDeStijlGlyphs ignores U+25A0, exactly-one color mark survives a marked block | fence + live module call | `node --test tests/test-250-provenance-fence.cjs` | `tests/test-250-provenance-fence.cjs` | NO - born RED in task | 250-03 T1 | HIGH (frozen voice-mark contract) |
| HONEST-03 | /register endpoint: UUIDv4-strict closed schema, idempotent per install_id, keyless rate cap (429), READ tier ceiling, token never logged | unit (brain repo, hermetic) | `cd /home/jsagi/dev/ProblemsWorthSolving-Brain && node --test tests/register-endpoint.test.mjs` | brain `tests/register-endpoint.test.mjs` | NO - born RED in task | 250-04 T1 | HIGHEST (unauthenticated credential-minting surface) |
| HONEST-03 | silent registration: ladder precedence FROZEN for keyed users (legs 1-3 byte-identical); mint+cache single-POST; failure edge renders reframed no_key copy, once-per-process cap, never throws/blocks; opt-out var suppresses all; Part 8 payload = install_id ONLY | unit (loopback mock + temp HOME) | `node --test tests/test-250-silent-registration.cjs` | `tests/test-250-silent-registration.cjs` | NO - born RED in task | 250-04 T2 | HIGHEST (default-path behavior + Part 8 audit) |
| HONEST-01+03 | live refusal + provenance + silent registration + queue disclosure on CLI/Desktop/Cowork, on a RELEASED build after restart | manual-only | checkpoint (justification below) | - | - | 250-04 T3 | HIGH |
| all | dist mirrors fresh after every SKILL.md-touching task | gate | `node scripts/build-dist-bundles.cjs --check-stale` | script EXISTS | EXISTS | 250-01 T3, 250-02 T2, 250-03 T1, 250-04 T2 | HIGH (Pitfall 1) |
| all | no em-dashes; found-eq-0 runner guard | fence (runner) | `bash tests/run-all-250.sh` | `tests/run-all-250.sh` | NO - born in 250-01 T1 | every wave | MEDIUM |

*Coverage ranking (Nyquist sampling weight): the conflation red proof, the doctrine
fence's pre-rewrite RED run, the lockstep negative assertion, the /register abuse
surface, and the keyed-user-precedence freeze get the densest coverage - they are the
failure modes that look complete but are not (a visible-but-WRONG refusal, a fence that
never demonstrated red, rewritten rows riding an early beta, a token farm, a broken
existing user).*

---

## Wave 0 Requirements

(Research "Wave 0 Gaps" + the two rulings' additions, mapped to the tasks that create
each file RED-first - no separate Wave 0 plan exists.)

- [ ] `tests/run-all-250.sh` (glob discovery, found-eq-0 guard, em-dash fence) - 250-01 T1
- [ ] `tests/test-250-refusal-shapes.cjs` - 250-01 T1
- [ ] `tests/test-250-transport-retry.cjs` (AVAIL-02) - 250-01 T1
- [ ] `tests/test-250-refusal-queue.cjs` - 250-01 T2
- [ ] `tests/test-250-doctrine-fence.cjs` (red-first against the live kill list) - 250-01 T3
- [ ] `tests/test-250-amendment-unit.cjs` - 250-02 T2
- [ ] `tests/test-250-provenance-fence.cjs` - 250-03 T1
- [ ] brain `tests/register-endpoint.test.mjs` (cross-repo; deploy rides 250-04 T3) - 250-04 T1
- [ ] `tests/test-250-silent-registration.cjs` - 250-04 T2

---

## Manual-Only Verifications

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| Amendment application timing (doc-now vs inline-now) | HONEST-02 | Navigator sequencing call (research A2/A3) - the one judgment call in the phase; never auto-picked | 250-02 T1 checkpoint:decision; recommendation stated (option-doc-now); ruling recorded in 250-02-SUMMARY |
| Amendment ratification + the A3 interpretation flag ("TOGETHER as one reviewable unit" = doc-with-verbatim-rows) | HONEST-02 | Constitutional sign-off is a human act (Part 11); the interpretation must be confirmed, not assumed | 250-02 T3; sign-off block filled in the doc, unit test re-run green |
| Brain-repo deploy (push + Render redeploy) + live /register probe (200/429/400 legs) | HONEST-03 | The admin/operator key path is not on this machine by design (246-02/247-03 precedent); cross-repo definition of done requires the LIVE surface | 250-04 T3 Part A; responses recorded, token redacted |
| Three-surface matrix: fresh-install silent registration, keyed-user freeze, unreachable-after-retry honesty, not_ready + queue disclosure, provenance mark + absence, F.1 card fires, lockstep glance on decisions.md | HONEST-01/03 | Skill-layer behavior on three hosts is not automatable (test-245 claim-(b) precedent), and the standing rule binds: a commit is not live until a release ships AND is picked up - a dev session proves nothing (restart-to-apply; four filed occurrences) | 250-04 T3 Parts B/C, ten ordered steps on a released v2.0.0-beta.N after `claude plugin update` + restart; PAUSES honestly if the release train (Gates 0/1) is not open |

Note: the SEED-011 option pick is NOT in this table - it was ruled before execution
(NAVIGATOR RULING 2026-08-10, REQUIREMENTS.md HONEST-03: Option A, baked in by default)
and is cited, not re-decided.

---

## Validation Sign-Off

- [ ] Every task in all 4 plans has an `<automated>` verify command (checked: 8/8 tasks carry one, including both checkpoint tasks' surrounding gates)
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Every referenced-but-missing test file is created RED-first inside the task that needs it (TDD gate; 9 Wave-0 files mapped above)
- [ ] Red proofs demonstrated, not asserted: the conflation proof, the doctrine fence's 7-hit pre-rewrite run, the amendment-doc-absent run, the provenance-section-absent run, both registration suites' RED runs - all filed in SUMMARYs
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency < 60s for the hermetic layer
- [ ] Cross-repo definition of done honored: /register is not "done" until probed LIVE on pws-brain-mcp.onrender.com (250-04 T3)
- [ ] Amendment lockstep guarded by an automated negative assertion (test-250-amendment-unit Test 4), not by memory
- [ ] `wave_0_complete: true` set after 250-01 lands its suites and runner

**Approval:** pending
