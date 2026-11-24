---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 13
subsystem: decision-relay
tags: [decision-relay, render, blueprint, node-http, proxy-hops, liveness, rl-04, o-08, owner-gated]

requires:
  - phase: 400-12
    provides: createRelay(deps).handleDecide, config.cjs loadConfig, verify-caller.cjs verifyCaller, limits.cjs
provides:
  - services/decision-relay/server.cjs createServer(deps), clientAddressOf(req, hops), SERVER_REASONS, HEALTH_PATH
  - services/decision-relay/render.yaml (Render Blueprint, custom Blueprint Path)
  - services/decision-relay/README.md (operator guide, OWNER-GATED list)
  - tests/test-400-relay-server.cjs (S1 to S8) and tests/test-400-relay-packaging.cjs (K1 to K5) in tests/run-all-400.sh
affects: [400-14, 400-15]

tech-stack:
  added: []
  patterns:
    - "The server runs the caller check before it reads any body byte; a refused caller gets the relay's own refusal with an empty body and connection close"
    - "The body cap holds while reading: a declared length over the cap is refused at once, a chunked body is stopped by a running count"
    - "A packaging leg runs a full handleDecide in a child process with readFileSync wrapped, and proves the Render buildFilter covers every file the relay loads or reads"

key-files:
  created:
    - services/decision-relay/server.cjs
    - services/decision-relay/render.yaml
    - services/decision-relay/README.md
    - tests/test-400-relay-server.cjs
    - tests/test-400-relay-packaging.cjs
  modified:
    - services/decision-relay/ROOM.md
    - tests/run-all-400.sh

key-decisions:
  - "render.yaml uses autoDeployTrigger \"off\" (the current Render field) and keeps the deprecated autoDeploy false; Render states the trigger wins when both are present."
  - "numInstances 1 is set (Render confirms the field; default 1 for a new service) so assumption A3 is visible in the Blueprint."
  - "plan 0.5c-512mb and region oregon, each with an owner-confirms-at-deploy comment; the Render plan table has no starter id."
  - "RELAY_HOST (default 0.0.0.0) lets the child-process test bind 127.0.0.1; Render keeps the default."
  - "headersTimeout is min(10000, requestTimeout), because Node refuses a headersTimeout above requestTimeout."

patterns-established:
  - "A served service under services/ carries a Blueprint with no rootDir and a buildFilter allowlist proven by a require-graph test."

requirements-completed: [RL-04]

duration: 25min
completed: 2026-11-24
---

# Phase 400 Plan 13: Decision Relay Socket Layer and Render Blueprint Summary

**A plain node:http socket layer for the labels-only relay (liveness-only /health, POST /v1/decide, body cap while reading, header and request timeouts, a fixed proxy hop count that feeds the address cap), a Render Blueprint with no rootDir and NODE_VERSION pinned to 22, and an operator README that lists every owner-gated step.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-24
- **Tasks:** 2 of 2
- **Files:** 5 created, 2 modified

## Accomplishments

- `server.cjs` routes `GET /health` to exactly `{"status":"ok"}` with no catalog header, `POST /v1/decide` to `createRelay(deps).handleDecide`, every other path to 404 and every other method to 405 with `Allow`. No 3xx write exists in the file (`grep -c "writeHead(30\|statusCode = 30"` prints 0).
- The 400-12 NEXT item is closed: the server passes `address = clientAddressOf(req, cfg.proxyHops)` to `handleDecide`. Leg S6 proves hops 0 gives the socket peer and hops 1 gives the last `X-Forwarded-For` entry through a real socket, with a forged left entry.
- `render.yaml` holds no rootDir, `NODE_VERSION "22"`, `buildCommand: node --version`, `startCommand: node services/decision-relay/server.cjs`, `healthCheckPath: /health`, auto deploy off, one instance, `RELAY_PROXY_HOPS "1"`, `RELAY_USER_TRAFFIC "off"`, and `GEMINI_API_KEY` and `RELAY_OPERATOR_TOKEN_SHA256` with `sync: false` and no value.
- K3 found 12 repo files in the relay require graph plus a full handleDecide run; all 12 are under the planned buildFilter paths, so the list needed no extension.
- `npm pack --dry-run` lists 0 files under `services/` (K1).

## Render field check (Level 1)

Fetched on 2026-11-24 (curl, the page text read locally):
- https://render.com/docs/blueprint-spec: confirms `type`, `name`, `runtime` (node), `plan` (ids `free`, `0.5c-512mb`, `1c-2g` and more; default `0.5c-512mb` for a new web service), `region` (oregon default), `buildCommand`, `startCommand`, `healthCheckPath` ("Web services only ... always starts with a /"), `numInstances` ("If you omit this field: Render uses 1 for a new service"), `buildFilter` with `paths` and `ignoredPaths` ("always relative to the repo's root directory"), `envVars` with `sync: false`, `rootDir`. `autoDeploy` is deprecated: "autoDeployTrigger ... off: Disable auto-deploys. Equivalent to the deprecated setting autoDeploy: false ... If you include both, autoDeployTrigger takes precedence."
- https://render.com/docs/node-version: precedence NODE_VERSION, .node-version, .nvmrc, package.json engines; "An unbounded range (such as >=20) always resolves to the latest release of Node.js"; a new service defaults to Node 24.22.1.
- https://render.com/docs/infrastructure-as-code: "you can define your Blueprint file anywhere"; the Blueprint Path field; "Each push to the linked branch that modifies your Blueprint file triggers a deploy of any added or modified resources" (stated in the README as an owner note).
- https://render.com/docs/monorepo-support: "Files outside your service's root directory are not available to the service at build time or at runtime."

## Task Commits

1. **Task 1: The socket layer (RL-04)** - RED `ab81654db` (test), GREEN `3eaa19a1d` (feat)
2. **Task 2: The Render Blueprint, the operator README and the packaging test (RL-04)** - RED `4434ebbeb` (test), GREEN `192201aef` (feat)

## Files Created/Modified

- `services/decision-relay/server.cjs` - socket layer and process entry; start line `{t, event, port, user_traffic, operator_hashes, has_key}`.
- `services/decision-relay/render.yaml` - the Blueprint, with a why-comment on every non-obvious field and a deliberately-absent list.
- `services/decision-relay/README.md` - routes, headers, request and reply shapes, status and reason table, every env var with its config.cjs default, log lines, token minting with node:crypto, the 8 OWNER-GATED steps, assumptions A2 and A3, the Theo rate-limit analog (Theo is not changed).
- `services/decision-relay/ROOM.md` - contents list now names server.cjs, render.yaml and README.md.
- `tests/test-400-relay-server.cjs` - legs S1 to S8 on loopback; every server and child closed in finally.
- `tests/test-400-relay-packaging.cjs` - legs K1 to K5; a small line reader for render.yaml (no YAML dependency).
- `tests/run-all-400.sh` - runs both new tests after test-400-relay.cjs.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] headersTimeout above requestTimeout throws**
- **Found during:** Task 1 GREEN (leg S5)
- **Issue:** `http.createServer` throws ERR_OUT_OF_RANGE when headersTimeout (10000) is above requestTimeout; a small `RELAY_UPSTREAM_TIMEOUT_MS` (for example 30) gives a requestTimeout of 5030.
- **Fix:** headersTimeout is `Math.min(10000, requestTimeout)`.
- **Files modified:** services/decision-relay/server.cjs
- **Commit:** 3eaa19a1d

**2. [Rule 2 - Missing critical] Caller check before the body is read**
- **Found during:** Task 1
- **Issue:** The plan reads the body and then calls handleDecide, so an unauthenticated caller could make the server buffer up to 512 KB per request.
- **Fix:** The server runs `verifyCaller` first; on a refusal it calls handleDecide with an empty body (the relay refuses at step 1 and logs it) and closes the connection.
- **Files modified:** services/decision-relay/server.cjs
- **Commit:** 3eaa19a1d

**3. [Rule 3 - Blocking] Render deprecated the autoDeploy field**
- **Found during:** Task 2 field check
- **Issue:** The plan names `autoDeploy false`; Render now documents `autoDeployTrigger` and marks `autoDeploy` deprecated.
- **Fix:** Both lines are written (`autoDeployTrigger: "off"` and `autoDeploy: false`); Render states the trigger wins. K2 checks both. `"off"` is quoted because a bare off is a YAML 1.1 boolean.
- **Files modified:** services/decision-relay/render.yaml, tests/test-400-relay-packaging.cjs
- **Commit:** 192201aef

**4. [Rule 2 - Missing critical] RELAY_HOST for a loopback-only child test**
- **Issue:** S7 starts the real process entry; binding 0.0.0.0 in a test breaks the loopback-only rule.
- **Fix:** `RELAY_HOST` (default 0.0.0.0, address characters only) lets the test bind 127.0.0.1. README and render.yaml state it.
- **Commit:** 3eaa19a1d

**5. [Rule 2 - Missing critical] ROOM.md contents**
- **Issue:** services/decision-relay/ROOM.md said plan 400-13 would add the files; ICM Layer 0 must name what the folder holds.
- **Fix:** The contents list names server.cjs, render.yaml and README.md; the tests line names all three tests.
- **Commit:** 192201aef

**6. [Rule 1 - Bug] A literal rootDir colon in a comment**
- **Issue:** The acceptance check `grep -c "rootDir:"` counted a comment line.
- **Fix:** The comment reads "rootDir (left out):". The count is 0.
- **Commit:** 192201aef

### Interpretations (not code deviations)

- S3 has two cases: a declared Content-Length over the cap (refused before any body byte) and a chunked body (stopped by the running count). Each case proves the reply came before the test sent the rest of the body, and that the socket closed.
- K3 runs a full operator handleDecide (with an in-process fake fetch) in addition to the require graph, so lazy reads at request time are also covered.
- K4 checks each number env var of config.cjs on a README table row with its DEFAULTS value, parsed from config.cjs at test time.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: listener | services/decision-relay/server.cjs | A new network listener (0.0.0.0 by default). Covered by T-400-37 to T-400-39; it runs only when the owner deploys it. |
| threat_flag: blueprint-sync | services/decision-relay/render.yaml | Render docs: a push that modifies the Blueprint file can deploy added or modified resources, even with auto deploy off. Stated in the README as an owner note; not in the plan threat register. |

## User Setup Required

None by an agent. OWNER-GATED and not done: choose and price the Render plan, create the service from the Blueprint (Blueprint Path services/decision-relay/render.yaml), set GEMINI_API_KEY, mint an operator token and set its sha256, confirm the paid Gemini tier (F-09), keep RELAY_USER_TRAFFIC off (O-10), deploy only from the release commit, run one instance.

## Next Phase Readiness

- Plan 400-14: the release-time client sends `Authorization: Bearer <operator token>`, `x-mindrian-catalog: catalogFingerprint()` and `content-type: application/json` to `POST /v1/decide`.
- No relay URL exists until the owner creates the service.

## Self-Check: PASSED

- FOUND: services/decision-relay/{server.cjs,render.yaml,README.md}, tests/test-400-relay-server.cjs, tests/test-400-relay-packaging.cjs
- FOUND commits: ab81654db, 3eaa19a1d, 4434ebbeb, 192201aef
- `node tests/test-400-relay-server.cjs`: 8 passed, 0 failed (3 runs)
- `node tests/test-400-relay-packaging.cjs`: 5 passed, 0 failed
- `node tests/test-400-relay.cjs`: 24 passed, 0 failed
- `bash tests/run-all-400.sh`: exit 0 (includes run-all-399: PASSED)
- `bash tests/run-all-399.sh`: exit 0
- `node scripts/build-skill-mirrors.cjs --check`: OK (112 mirrors)
- `grep -c "rootDir:" services/decision-relay/render.yaml`: 0
- No U+2013 or U+2014 in any changed file
