---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 05
subsystem: decision-advisor-transport
tags: [egress-policy, transport, labels-only, capture-server, gemini, jev, dev-time]
requires: [399-04]
provides:
  - data/egress-policy.json line decision_advisor (default false; providers gemini_decision and jev_decision; paths)
  - scripts/decision-advisor-transport.cjs (send, dryRun, LINE, PROVIDER_IDS, REFUSALS; CLI)
  - tests/test-399-egress-line.cjs (E1-E5), tests/test-399-transport-capture.cjs (T1-T9)
  - tests/fixtures/399/neutral-request-sample.json
affects: [399-06]
tech-stack:
  added: []
  patterns: [policy line gated dev-time script, loopback capture server, refuse-never-strip before and after the policy check]
key-files:
  created:
    - scripts/decision-advisor-transport.cjs
    - tests/test-399-egress-line.cjs
    - tests/test-399-transport-capture.cjs
    - tests/fixtures/399/neutral-request-sample.json
  modified:
    - data/egress-policy.json
    - tests/test-366-egress-policy.cjs
    - tests/test-3692-web-lines.cjs
    - tests/run-all-399.sh
decisions:
  - "The decision_advisor line is off by default. A room override cannot turn it on (loader rule: named override_unknown_line or override_cannot_widen, never honored). The loader was not changed."
  - "send order is fixed: validate request, policy line, endpoint, env key, per-chunk render and body re-validation, POST, parse. A request that fails the labels-only check is refused before the policy check."
  - "Gemini PATH stays null and PATH_CONFIRMED stays false. Off loopback a gemini send returns endpoint_unconfirmed. On loopback the base URL is used as given, so no path is invented."
  - "Jev has no default host. The hosted base comes from opts.base (CLI --base) only. A keyless Jev send is allowed on loopback only (self-hosted Kev) and sends no Authorization header."
  - "Keyed Jev POSTs go through jev-devtime-client jev() with a guard that throws EGRESS_REFUSED unless the body is the render of its chunk. Gemini and keyless loopback Jev use a local POST with the same 429/529 backoff."
  - "dryRun prints the validated provider body (one body, or an array for several chunks). It makes no policy check, reads no key and makes no network call."
metrics:
  tasks: 2
  completed: 2026-11-24
---

# Phase 399 Plan 05: decision_advisor egress line and the dev-time transport Summary

One policy line (off by default) and one dev-time send path that validates labels-only, checks the line, reads the key from the environment only, and is proven on a loopback capture server.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | decision_advisor egress line, off by default (I-11) | 92ee4db4c |
| 2 | Dev-time decision transport and capture-server proof (I-04, I-11, D-03) | 14f59680e |

## What was built

- Policy: `lines.decision_advisor` (7th line) with endpoint text, `default: false`, a scope naming D-03 labels only and the Deferred user-access ruling, providers `gemini_decision` and `jev_decision`, and `paths { gemini_decision: null, jev_decision: "/v1/systemone" }`. The policy note gained the one sentence the plan specified. `lineForProvider('typesafe')` is still `judge_jev`.
- Transport: `send(req, opts)` returns `{ ok, answers, usage, provider, model, requests }` or `{ ok: false, reason, detail? }` with reasons labels_only_refused, egress_line_off, no_key, endpoint_unconfirmed, http_error, bad_response. CLI flags: --provider, --request, --base, --model, --dry-run, --room. Exit codes 0, 2, 4, 5, 6 as planned.
- The only policy seam is the function option `opts.policy`; no CLI flag or env variable sets it (T-399-17, accepted).
- Tests: E1-E5 for the line. T1-T9 for the wire: shipped policy gives zero fetch calls; invalid request is refused before the policy check; captured body equals the provider render with the right header per provider; chunks of 1,000 (Gemini) and 20 (Jev) on the wire; key value absent from bodies, results, stdout and stderr; no_key and keyless loopback Jev; endpoint_unconfirmed; CLI exit codes; no stray global fetch.

## Vendor path check (Level 1)

PATH_CONFIRMED stays false. UNVERIFIED. Pages tried: none. The fetch tools named in the run rules (WebFetch, Context7, Tavily) were not available to this agent, and the `ctx7` CLI is not installed. I did not fetch the vendor site by another route. So the Gemini Decisions REST path and the key header name (`x-goog-api-key`, ASSUMED from the Google AI REST convention) are unconfirmed. The live Gemini send stays refused off loopback.

## Deviations from Plan

**1. [Rule 3 - Blocking] Re-pinned a second test.** `tests/test-3692-web-lines.cjs` W10 pinned the exact six line names, so adding a 7th line failed it. I re-pinned the title and the expected name list (added `decision_advisor`). The plan listed the file only for read and count checks. Commit 92ee4db4c.

**2. [Choice] Keyless loopback Jev does not use jev().** jev() always sends `Authorization: Bearer <key>`. For the keyless case the transport uses its own POST so no Authorization header is sent. Keyed Jev uses jev() as planned.

**3. [Choice] Gemini on loopback with PATH null posts to the base URL as given.** The plan did not say where a loopback Gemini send goes while PATH is null. Using the base as given avoids inventing a path.

**4. [TDD] RED was proven for both tasks.** Task 1: E1, E4, E5 failed before the policy edit. Task 2: the capture test failed with module-not-found before the script existed. A mutation (policy check disabled) made 4 legs fail, then the script was restored.

No other auto-fixes were needed.

## Verification

- `node tests/test-399-egress-line.cjs`: 5 passed, 0 failed.
- `node tests/test-399-transport-capture.cjs`: 9 passed, 0 failed.
- `bash tests/run-all-399.sh`: 8 PASSED lines, exit 0 (includes test-399-advisor-fence, FN2 still passes).
- Policy tests before and after the re-pin: test-366-egress-policy, test-3692-web-lines, test-366-gated-term-release, test-366-mcp-release-route, test-391-radar-fetch-script, test-3692-judge-line, test-366-mcp-plan-only all 0 and 0.
- Base exit codes: test-353-tripwires, test-355-part8-egress, test-356-tripwires, test-359-devonly-tripwire all 0.
- `node scripts/decision-advisor-transport.cjs --provider jev --request tests/fixtures/399/neutral-request-sample.json`: exit 4, prints egress_line_off.
- `grep -c loadKey scripts/decision-advisor-transport.cjs`: 0.
- `git diff --stat lib/core/research-planner/egress-policy.cjs`: empty.
- `node scripts/build-connector-registry.cjs --check`: exit 0.
- No em or en dashes in the new files. Pre-commit hooks ran on both commits and passed.

## Risks and open items

- Gemini REST path, header name and REST JSON casing are ASSUMED. No live call was made and no key exists.
- The capture server proves the wire shape this code produces, not what the vendor accepts.
- Jev hosted base is not set anywhere; the owner supplies it with --base when a live run is wanted.
- The loopback test uses real fetch against 127.0.0.1 only.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The only new egress surface is the transport, and it is off in the shipped policy.

## Self-Check: PASSED

- Files found: scripts/decision-advisor-transport.cjs, tests/test-399-egress-line.cjs, tests/test-399-transport-capture.cjs, tests/fixtures/399/neutral-request-sample.json.
- Commits found: 92ee4db4c, 14f59680e.
