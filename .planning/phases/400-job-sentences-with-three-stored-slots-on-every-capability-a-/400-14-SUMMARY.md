---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 14
subsystem: decision-relay
tags: [decision-relay, transport, egress-line, operator-release-run, audit, rl-05, rl-03, o-07, o-10, owner-gated]

requires:
  - phase: 400-12
    provides: relay.cjs createRelay, REASONS, catalog_skew 409 with relay_catalog
  - phase: 400-13
    provides: server.cjs createServer(deps), POST /v1/decide socket layer
provides:
  - scripts/decision-advisor-transport.cjs provider relay (send, dryRun), RELAY_PATH, RELAY_MAX_QUESTIONS, RELAY_REASONS
  - the operator release run (--operator-release-run plus MINDRIAN_DECISION_RELAY_OPERATOR_TOKEN), printed bodies, audit record
  - transport --out pairs and repeated --request for provider relay
  - scripts/build-relay-release-requests.cjs (20 labels-only requests, 73 serves_job_v1 questions each)
  - tests/test-400-relay-transport.cjs (T1-T8, O1-O6, E1-E4) and tests/test-400-relay-fence.cjs (F1, F2) in tests/run-all-400.sh
affects: [400-15]

tech-stack:
  added: []
  patterns:
    - "The relay is a third send mode behind the same egress line name; the operator run builds an in-memory one-run policy and never writes the shipped file"
    - "The audit record is written before the first POST and rewritten at the end (temp and rename, 0600 in 0700); no record means no send"
    - "A shipped script keeps a copy of a services/ constant and a test pins the two equal, because services/ is not in the npm package"

key-files:
  created:
    - scripts/build-relay-release-requests.cjs
    - tests/test-400-relay-transport.cjs
    - tests/test-400-relay-fence.cjs
  modified:
    - scripts/decision-advisor-transport.cjs
    - data/egress-policy.json
    - tests/run-all-400.sh

key-decisions:
  - "The relay POST makes one attempt with no retry (also no retry on 5xx or a network error): a resend can spend twice, and the relay itself does not retry."
  - "RELAY_REASONS is a copy of services/decision-relay/relay.cjs REASONS; scripts/ ships in the npm package and services/ does not, so the transport does not require services/. T4 pins the lists equal."
  - "The audit record is written before the first POST (ok false) and rewritten at the end; a failed write refuses the run with the new reason audit_unwritable (exit 5)."
  - "The one-run policy copies the shipped lines with allowed false and sets only decision_advisor allowed true; opts.policy is ignored on an operator run."
  - "A 200 reply whose catalog field differs from catalogFingerprint() is also catalog_skew (64 hex) or bad_response."
  - "An operator run writes one audit record per request; a CLI run with N --request files writes N records."

patterns-established:
  - "Owner-gated release runs carry a printed body before each POST and a per-run audit file under the MindrianOS home."

requirements-completed: [RL-05, RL-03]

duration: 25min
completed: 2026-11-24
---

# Phase 400 Plan 14: Decision Relay Client and Operator Release Run Summary

**The transport gains provider relay behind the off decision_advisor line (install id and catalogFingerprint headers, neutral chunk body to /v1/decide, no redirect, skew and closed-list refusals), an operator release run that needs the CLI flag plus the env token and leaves a printed body and an audit record, and a request-set builder whose --out pairs feed derive-decision-fixture, proven end to end on loopback.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-24
- **Tasks:** 3 of 3
- **Files:** 3 created, 3 modified

## Accomplishments

- Relay mode order: validate each 1,000-question chunk, policy, endpoint (base origin + prefix + /v1/decide), caller header, then per chunk re-validate and POST with `redirect: 'error'` and a timeout. Headers: `content-type: application/json`, `x-mindrian-catalog: catalogFingerprint()`, and `x-theo-install-id` from `peekInstallId` (never minted) or, on an operator run, `Authorization: Bearer <token>` with no install id header. The relay mode never reads GEMINI_API_KEY.
- Reply checks: 409 with a 64-hex `relay_catalog` gives `catalog_skew` (`detail: 'relay catalog <hex>'`); any other non-200 gives `relay_refused` with a reason from the closed list, else `status <n>`; an answer id outside the chunk, a wrong type or an out-of-range value gives `bad_response`.
- With the shipped policy a relay send returns `egress_line_off` with 0 fetch calls (T1; CLI exit 4 against https://relay.invalid).
- Operator release run (O-10): the token variable is read only when `--operator-release-run` is set; no env variable sets the flag (O6). It prints `decision relay release run: chunk <i> of <n>, <q> questions, to <url>` and the exact JSON body before each POST, and writes `<MINDRIAN_HOME>/decision-relay-audit/<YYYYMMDDTHHMMSSZ>-<8 hex>.json` with schema `mos.decision-relay-audit/1`, per-chunk `body_sha256`, status and reason, totals, `ok` and `operator_release_run: true`. The record holds no token, no key and no body (O4, O5). A refused run also writes its record.
- `scripts/build-relay-release-requests.cjs --out-dir <dir>` writes 20 requests (one per vocabulary job), each with 73 `serves_job_v1` questions in registry order (E1).
- `--out <file>` writes `{pairs: [{job, command, p}]}`; `derive-decision-fixture.cjs` accepts it (E2). E3 runs the CLI child through the real `createServer` relay and a fake loopback upstream: the upstream bodies equal the server render, 146 pairs reach the fixture, and 2 audit records exist. E4: no data/ file changes.
- `data/egress-policy.json`: one changed line (the endpoint text clause). Default stays false; providers and paths unchanged.
- Fence F1: no non-comment line under lib/ or hooks/ names decision-relay, services/, build-relay-release-requests or operator-release-run, and no lib/ file requires services/ (1,407 files scanned). F2 proves the scan catches a probe file.

## Task Commits

1. **Task 1: Provider relay in the one send path, and the relay fence** - RED `05d3f8313` (test), GREEN `27b2a7385` (feat)
2. **Task 2: The operator release run with a printed body and an audit record** - RED `746b1e6aa` (test), GREEN `666f9e0f2` (feat)
3. **Task 3: The release-run bridge to the 399 table pipeline** - RED `63242cc51` (test), GREEN `cdda7b1cb` (feat)

## Files Created/Modified

- `scripts/decision-advisor-transport.cjs` - relay mode, operator run, audit record, --out pairs, repeated --request, header comment with the Release run (owner-gated) section.
- `scripts/build-relay-release-requests.cjs` - the labels-only release request set builder (CJS, switch-case argv, no network).
- `data/egress-policy.json` - endpoint text clause for the relay.
- `tests/test-400-relay-transport.cjs` - legs T1-T8, O1-O6, E1-E4 on loopback only.
- `tests/test-400-relay-fence.cjs` - legs F1, F2 (F2b checks the probe is removed).
- `tests/run-all-400.sh` - runs both new tests after the relay packaging test.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Audit record before the first POST, and audit_unwritable**
- **Found during:** Task 2
- **Issue:** The plan writes the audit record after the run. A crash or a write failure after the POST leaves no trail (T-400-45).
- **Fix:** The record is written (ok false) before any network, then rewritten at the end. A failed write refuses with the new reason `audit_unwritable` (exit 5).
- **Files modified:** scripts/decision-advisor-transport.cjs
- **Commit:** 666f9e0f2

**2. [Rule 2 - Missing critical] Operator token shape check**
- **Issue:** A token with a newline or a space would make fetch throw with the header value in scope.
- **Fix:** A token that does not match the relay BEARER_RE shape (`[\x21-\x7e]{1,512}`) is refused `operator_token_missing` with detail `token shape`, before any network.
- **Commit:** 666f9e0f2

**3. [Rule 3 - Blocking] RELAY_REASONS copied, not required**
- **Issue:** The transport ships in the npm package; services/ does not (400-13 K1). A require of services/decision-relay/relay.cjs would break in an installed layout.
- **Fix:** A frozen copy in the transport; T4 pins it equal to the relay REASONS.
- **Commit:** 27b2a7385

### Interpretations (not code deviations)

- "postWithBackoff semantics" is read as redirect error plus a timeout with no retry at all for the relay (one POST per chunk).
- `send` with `operatorReleaseRun` and a non-relay provider refuses `labels_only_refused` (exit 2), the same code as the CLI usage error.
- `--operator-release-run` with `--dry-run` is a usage error.
- O2 and O6 passed at RED: the unknown flag was already a usage error, and no env read existed. They stay as regression legs.

## Issues Encountered

- Pre-existing, out of scope, logged in deferred-items.md: tests/test-346-catalogue-schema.cjs FAIL 12 and tests/test-355-direction-agreement.cjs leg H. Both fail the same way at a497f7877 (a scratch worktree check, removed after).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: file-write | scripts/decision-advisor-transport.cjs | The operator run writes audit files under the MindrianOS home (0600 in 0700, no token, key or body). Covered by T-400-45; the write path is new surface. |

## User Setup Required

None by an agent. OWNER-GATED and not done: a run of --operator-release-run against a non-loopback base, minting or setting the real operator token, turning the decision_advisor line on by default, any deploy.

## Next Phase Readiness

- Plan 400-15 can rely on `send(req, {provider: 'relay'})`, the audit record schema `mos.decision-relay-audit/1`, and `scripts/build-relay-release-requests.cjs`.
- No relay URL exists until the owner creates the service.

## Self-Check: PASSED

- FOUND: scripts/build-relay-release-requests.cjs, tests/test-400-relay-transport.cjs, tests/test-400-relay-fence.cjs
- FOUND commits: 05d3f8313, 27b2a7385, 746b1e6aa, 666f9e0f2, 63242cc51, cdda7b1cb
- `node tests/test-400-relay-transport.cjs`: PASS 18 FAIL 0
- `node tests/test-400-relay-fence.cjs`: PASS 3 FAIL 0
- `node tests/test-399-transport-capture.cjs`: PASS 11 FAIL 0; `test-399-egress-line`: PASS 5; `test-366-egress-policy`: PASS 24
- `node tests/test-400-relay.cjs`: 24 passed; `node tests/test-400-relay-server.cjs`: 8 passed
- `bash tests/run-all-400.sh`: exit 0; `bash tests/run-all-399.sh`: exit 0; `node scripts/build-skill-mirrors.cjs --check`: OK (112 mirrors)
- `tests/test-369-hook-require-graph.cjs` and `tests/test-399-advisor-fence.cjs`: exit 0
- `git diff c1e496ae8 -- data/egress-policy.json`: one changed line
- CLI `--provider relay --request tests/fixtures/399/neutral-request-sample.json --base https://relay.invalid`: exit 4, egress_line_off
- No U+2013 or U+2014 in any changed file
