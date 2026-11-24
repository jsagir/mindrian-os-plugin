---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 12
subsystem: decision-relay
tags: [decision-relay, gemini, labels-only, rate-limit, operator-token, install-id, rl-01, rl-02, rl-03, o-07, o-09, part-8]

requires:
  - phase: 400-07
    provides: labels-only.cjs catalogFingerprint() (one value for the client and the relay)
  - phase: 400-11
    provides: the run-all-400 runner order this plan extends
provides:
  - services/ROOM.md (served, not shipped) and services/decision-relay/ROOM.md (identity, owner-gated list)
  - services/decision-relay/config.cjs loadConfig(env), DEFAULTS (frozen), KEY_ENV
  - services/decision-relay/verify-caller.cjs verifyCaller(headers, cfg), headerValue
  - services/decision-relay/limits.cjs createLimits(cfg, now) -> {take, recordUsage, snapshot}
  - services/decision-relay/relay.cjs createRelay(deps).handleDecide, UPSTREAM_ORIGIN, CATALOG_HEADER, REASONS, ROUTE
  - tests/test-400-relay.cjs (legs C1 to C6, R1 to R13) in tests/run-all-400.sh
affects: [400-13, 400-14]

tech-stack:
  added: []
  patterns:
    - "A pure request handler {headers, bodyText, bytes, address} -> {status, headers, body}, so the socket layer (plan 13) is a thin adapter"
    - "A getter on bodyText counts reads, to prove the caller check runs before the body is read"
    - "A wrapper on labels.validateNeutralRequest records the argument, to prove the relay validates the parsed request unchanged (refuse, never strip)"
    - "An exit guard in the test: a pending promise with an empty event loop fails the test instead of ending it with code 0"

key-files:
  created:
    - services/ROOM.md
    - services/decision-relay/ROOM.md
    - services/decision-relay/config.cjs
    - services/decision-relay/verify-caller.cjs
    - services/decision-relay/limits.cjs
    - services/decision-relay/relay.cjs
    - tests/test-400-relay.cjs
  modified:
    - tests/run-all-400.sh

key-decisions:
  - "Operator usage is counted apart from the user counters: the operator meets only operator_daily_cap, and its questions, requests and input tokens do not use up the global user budget."
  - "bucket_table_full is checked first (before install_rate), for a new install bucket or a new address bucket on a full table; it is a 429 with Retry-After to the next UTC midnight, when the tables reset."
  - "Addresses are hashed with HMAC-sha256 and a per-process random salt; install buckets are sha256 of a fixed prefix plus the id, cut to 32 hex."
  - "The question cap is min(RELAY_MAX_QUESTIONS, PROVIDERS.gemini.MAX_QUESTIONS), so one request is always one upstream POST (no chunking on the relay)."
  - "The size cap uses the larger of the caller-sent byte count and the measured bodyText, so a small declared count cannot hide a large body."
  - "The 422 detail is the validator reason only, never the refused path or value; a non-200 upstream gives the status number only, never the upstream text."
  - "Only the exact value RELAY_USER_TRAFFIC=on turns user traffic on; empty operator hash entries are skipped, malformed entries are dropped and counted."
  - "A success reply holds command names only inside choice answers (the option ids the caller sent); R12 checks every other part of every reply."

patterns-established:
  - "services/<name>/ holds served code; it requires lib/core modules by relative path and is outside package.json files (npm pack --dry-run lists 0 files under services/)."

requirements-completed: [RL-01, RL-02, RL-03]

duration: 35min
completed: 2026-11-24
---

# Phase 400 Plan 12: Decision Relay Request Pipeline Summary

**A pure, labels-only Gemini Decision relay handler: O-09 callers (install id under per-install, per-address and global daily caps; operator token by sha256 and timingSafeEqual), the shared labels-only validator by path, a catalog fingerprint match, a server-side body render, and one pinned POST with no redirect and a timeout.**

## Performance

- **Duration:** about 35 min
- **Completed:** 2026-11-24
- **Tasks:** 2 of 2
- **Files:** 7 created, 1 modified

## Accomplishments

- `handleDecide` runs the fixed order of the first must-have truth: caller, key, size, JSON, catalog fingerprint, validator, question cap, caps, render and re-check, one POST. Each step refuses with a reason from the closed, frozen REASONS list (22 values).
- Callers follow O-09. A wrong Bearer token is refused `bad_token` even with a valid install id (no fallback). User calls are refused `user_traffic_off` until the owner sets `RELAY_USER_TRAFFIC=on`.
- Caps live in bounded Maps keyed by hashes, reset at UTC midnight, and never count a refused call. `snapshot()` returns counts only.
- The key comes from `deps.env` (default `process.env`) through `KEY_ENV`, goes in the one `x-goog-api-key` header, and never enters the config, a log, a reply body or a reply header (R12).
- Every reply carries `content-type: application/json`, `cache-control: no-store` and `x-mindrian-catalog: <catalogFingerprint()>`; a 429 also carries `Retry-After`.

## Task Commits

1. **Task 1: Config, caller check and caps (RL-02)** - RED `0406407eb` (test), GREEN `f1f6968d1` (feat)
2. **Task 2: The request pipeline with the shared validator (RL-01, RL-03)** - RED `f25dbc073` (test), GREEN `6c751daf3` (feat)

## Files Created/Modified

- `services/ROOM.md` - ICM Layer 0 for served code (not in package.json files).
- `services/decision-relay/ROOM.md` - what the relay is and is not; the owner-gated actions.
- `services/decision-relay/config.cjs` - env parsing with stated defaults; digits-only numbers; `hasKey` only.
- `services/decision-relay/verify-caller.cjs` - the one pluggable caller check; header name from `lib/core/install-id.cjs`.
- `services/decision-relay/limits.cjs` - per-minute install window, install, address, global and operator daily caps.
- `services/decision-relay/relay.cjs` - the pure request pipeline.
- `tests/test-400-relay.cjs` - 24 legs, fetch spy plus two loopback servers (R11), stray-fetch thrower, exit guard.
- `tests/run-all-400.sh` - runs the new test after test-400-problem-axes-wording.cjs.

## Decisions Made

See key-decisions in the frontmatter. The two with the most effect on plan 13 and plan 14:
- The socket layer must pass `address` (the client address after `RELAY_PROXY_HOPS`); without it every caller shares the `unknown` address bucket.
- The client must send `x-mindrian-catalog` with its own `catalogFingerprint()`; a missing header is a 409.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A fragile source regex in test leg C3**
- **Found during:** Task 1 GREEN
- **Issue:** The first C3 source check (`h\s*===`) matched `hashes.length === 0`, so a correct file failed.
- **Fix:** The check now refuses `hashes.indexOf/includes/some/find(` (a plain list compare) and still requires `timingSafeEqual`.
- **Files modified:** tests/test-400-relay.cjs
- **Commit:** f1f6968d1

**2. [Rule 2 - Missing critical] Test exit guard**
- **Found during:** Task 2 RED
- **Issue:** `AbortSignal.timeout` does not hold the event loop open. A pending promise could end the test with code 0 and no summary (a false pass).
- **Fix:** A ref'd keep-alive timer in the R10 timeout leg, and a `process.on('exit')` guard that sets exit code 1 when the summary did not print.
- **Files modified:** tests/test-400-relay.cjs
- **Commit:** f25dbc073

### Interpretations (not code deviations)

- R12 "no reply body holds a command name": a success reply returns choice answers whose `choice` and `probabilities` keys are the option ids the caller sent. R12 checks that a command name appears nowhere else in any reply, and nowhere in any log or header.
- R1 "the body is not parsed first" is proven more strictly: the body is not read at all before the caller check.
- An outer catch in `handleDecide` fails closed with `body_check_failed` (500), to stay inside the closed REASONS list.

## Issues Encountered

None.

## Known Stubs

None. The socket layer, the Render blueprint and the operator README are plan 400-13 by design.

## Threat Flags

None. The relay is the surface the threat model T-400-31 to T-400-36 covers; no listener, no deploy and no secret were added.

## User Setup Required

None in this plan. OWNER-GATED and not done: Render service creation, secrets, the paid tier, user traffic, deploy, any egress default change.

## Next Phase Readiness

- Plan 400-13 wraps `createRelay(...).handleDecide` in `node:http` and passes `{headers, bodyText, bytes, address}`.
- Plan 400-14 sends `x-mindrian-catalog` and the operator token from the release-time client.

## Self-Check: PASSED

- FOUND: services/ROOM.md, services/decision-relay/{ROOM.md,config.cjs,verify-caller.cjs,limits.cjs,relay.cjs}, tests/test-400-relay.cjs
- FOUND commits: 0406407eb, f1f6968d1, f25dbc073, 6c751daf3
- `node tests/test-400-relay.cjs`: 24 passed, 0 failed
- `bash tests/run-all-400.sh`: exit 0 (includes run-all-399: PASSED)
- `node tests/test-399-advisor-fence.cjs`: 9 passed
- `node scripts/build-skill-mirrors.cjs --check`: OK (112 mirrors)
- `ls services/decision-relay/ | grep -c labels-only`: 0; no npm require in services/decision-relay/*.cjs
- `npm pack --dry-run`: 0 files under services/
