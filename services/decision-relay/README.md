# Decision relay: operator guide

Phase 400 (RL-01 to RL-05). Owner rulings O-07, O-08, O-09 and O-10.

This guide is for the person who runs the relay. It says what the relay is, what it accepts, how it is configured, and which steps only the owner takes. Nothing in this folder ships to users: `services/` is not in the package.json `files` list, and `npm pack` lists 0 files under it (`tests/test-400-relay-packaging.cjs`, leg K1).

## What the relay is

The relay is a small Node server that holds the owner's Gemini key, so the key never ships in the plugin, the public repo or the npm package (O-07).

It is a labels-only boundary. A caller sends the neutral, closed-label request of Phase 399: a job id, a short job summary from the shipped vocabulary, and questions whose subjects and options are command names from the shipped registry. The relay checks that request with the same validator the plugin uses (`lib/core/decision-advisor/labels-only.cjs`), builds the Gemini body itself, sends one POST to the pinned Google AI host, and returns the parsed answers.

It is not a content path. Room text, user notes and free text are refused, never stripped and passed on. It is not a general Gemini endpoint: a request that does not pass the shared validator never reaches Google.

## The two routes

| Route | What it does |
|---|---|
| `GET /health` | Returns 200 and exactly `{"status":"ok"}`. Liveness only: no catalog hash, no counts, no version. |
| `POST /v1/decide` | Runs the request pipeline in `relay.cjs` and returns its reply. |

Every other path returns 404 `not_found`. Another method on a known path returns 405 `method_not_allowed` with an `Allow` header. The server never sends a redirect and never rewrites a path, so `/health/` and `//health` are 404, not a 3xx.

## Headers a caller sends

| Header | Meaning |
|---|---|
| `content-type: application/json` | Required on `POST /v1/decide`. Anything else is 415 `not_json`. |
| `x-theo-install-id: <32 lowercase hex>` | A user install (the existing install id of `lib/core/install-id.cjs`). Refused `user_traffic_off` until the owner turns user traffic on. |
| `Authorization: Bearer <token>` | The owner's operator token, for release-time table builds. The relay compares the sha256 of the token in constant time. A wrong token is refused `bad_token`, even when an install id is also sent. |
| `x-mindrian-catalog: <fingerprint>` | The caller's `catalogFingerprint()` from `labels-only.cjs`. It must equal the relay's own; otherwise 409 `catalog_skew` with `relay_catalog` in the reply. |

Every `/v1/decide` reply carries `content-type: application/json`, `cache-control: no-store` and `x-mindrian-catalog: <the relay fingerprint>`. A 429 also carries `Retry-After` in seconds.

## Request and reply shapes

The request body is the neutral request (see `tests/fixtures/399/neutral-request-sample.json`):

```json
{
  "context": { "job_id": "validate-idea", "job_summary": "<the vocabulary sentence for that job>" },
  "questions": {
    "q0001": { "type": "yes_no", "template": "serves_job_v1", "subject": "/mos:validate" },
    "q0002": { "type": "choice", "template": "next_command_v1", "options": ["/mos:validate", "/mos:mullins"] }
  }
}
```

A success reply:

```json
{ "ok": true, "answers": { "q0001": { "...": "..." } }, "usage": { "input_tokens": 0, "output_tokens": 0 }, "model": "<pinned model>", "catalog": "<fingerprint>" }
```

A refusal reply is `{ "ok": false, "reason": "<reason>" }`, sometimes with one more field: `detail` (the validator reason only, never the refused value), `relay_catalog`, or `upstream_status` (a number only, never the upstream text).

| Status | Reasons |
|---|---|
| 400 | `not_json` (the body is not JSON) |
| 401 | `no_caller`, `bad_install_id`, `bad_token` |
| 403 | `user_traffic_off` |
| 404, 405, 415 | `not_found`, `method_not_allowed`, `not_json` (socket layer) |
| 409 | `catalog_skew` |
| 413 | `too_large`, `too_many_questions` |
| 422 | `labels_only_refused` |
| 429 | `install_rate`, `install_daily_cap`, `address_daily_cap`, `global_daily_requests`, `global_daily_questions`, `global_token_cap`, `operator_rate`, `operator_daily_cap`, `operator_token_cap`, `bucket_table_full` |
| 500 | `body_check_failed`, `internal` |
| 502, 503, 504 | `upstream_error`, `upstream_unreachable`, `no_upstream_key`, `relay_busy`, `upstream_timeout` |

## Configuration

Every value comes from the environment. The defaults below are the values in `config.cjs`; they are proposals, and the owner may change any of them in the Render Dashboard. A number must be digits only; anything else falls back to the default.

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | none | The upstream key. Secret. Set by the owner only. Sent in one `x-goog-api-key` header, never logged or returned. |
| `RELAY_OPERATOR_TOKEN_SHA256` | none | Comma-separated sha256 hex of operator tokens. Malformed entries are dropped and counted. |
| `RELAY_USER_TRAFFIC` | off | Only the exact value `on` lets install callers in. The Blueprint sets `"off"`. |
| `RELAY_PROXY_HOPS` | 0 | Trusted proxy hops in `X-Forwarded-For`. The Blueprint sets `"1"` for Render. |
| `RELAY_MAX_BODY_BYTES` | 524288 | The body cap, checked while the body is read. |
| `RELAY_MAX_QUESTIONS` | 1000 | Questions per request (also capped by the Gemini provider limit). |
| `RELAY_INSTALL_PER_MINUTE` | 10 | Requests per install per minute. |
| `RELAY_INSTALL_DAILY_QUESTIONS` | 2000 | Questions per install per UTC day. |
| `RELAY_ADDRESS_DAILY_QUESTIONS` | 20000 | Questions per client address per UTC day. |
| `RELAY_GLOBAL_DAILY_REQUESTS` | 5000 | User requests per UTC day, all installs together. |
| `RELAY_GLOBAL_DAILY_QUESTIONS` | 100000 | User questions per UTC day, all installs together. |
| `RELAY_GLOBAL_DAILY_INPUT_TOKENS` | 20000000 | User input tokens per UTC day, as Gemini reports them. |
| `RELAY_OPERATOR_DAILY_QUESTIONS` | 200000 | Operator questions per UTC day, counted apart from the user caps. |
| `RELAY_OPERATOR_PER_MINUTE` | 30 | Operator requests per minute (`operator_rate`). |
| `RELAY_OPERATOR_DAILY_INPUT_TOKENS` | 40000000 | Operator input tokens per UTC day, as Gemini reports them (`operator_token_cap`). |
| `RELAY_MAX_IN_FLIGHT` | 4 | The most upstream calls open at one time, all callers together. A call over it is `relay_busy` (503, `Retry-After: 1`) and is not counted. |
| `RELAY_MAX_BUCKETS` | 10000 | The most install or address buckets kept in memory; a new bucket on a full table is `bucket_table_full`. |
| `RELAY_UPSTREAM_TIMEOUT_MS` | 120000 | The upstream call timeout. The server request timeout is this plus 5000. |
| `PORT` | 10000 | The listen port. Render sets it. |
| `RELAY_HOST` | 0.0.0.0 | The bind address. Render needs 0.0.0.0; tests set 127.0.0.1. |
| `NODE_VERSION` | 22 (Blueprint) | Read by Render, not by the relay. Pinned because the repo engines range has no upper bound. |

The daily counters reset at UTC midnight. They live in memory, so a restart or a deploy resets them too. The caps therefore do not bound the spend over a day with restarts. Set a budget alert on the Gemini project as the spend bound that survives a restart (OWNER-GATED).

## Client address and the Theo analog

Render ends TLS at its proxy, so the socket peer is the proxy, not the caller. `server.cjs` takes the caller address from `X-Forwarded-For` through a fixed hop count, counted from the right, because each trusted proxy appends one entry and a caller can only add entries on the left. This is the same pattern as Theo's `clientAddressOf` in `src/http/rate-limit.ts` and its `THEO_HTTP_PROXY_HOPS`, written again here in plain CJS. Theo is not changed by this phase.

A hop count that is too low puts every caller in the proxy's one address bucket. A hop count that is too high lets a caller forge entries and get a fresh bucket for each request. The address is hashed with a per-process salt before it is used as a key, and it is never logged.

## Log lines

Logs go to stdout as one JSON object per line. They hold counts, durations and reasons only: never a body, a token, an install id, an address or the key.

- Start: `{"t":"...","event":"start","port":10000,"user_traffic":false,"operator_hashes":1,"has_key":true}`
- A `/v1/decide` reply: `{"t":"...","route":"/v1/decide","status":200,"reason":null,"kind":"operator","questions":3,"ms":812,"upstream_ms":790,"input_tokens":1234}`
- A refusal from the socket layer: `{"t":"...","route":null,"status":404,"reason":"not_found","ms":0}`

## Mint an operator token

Run this on the owner's own machine. The token stays there; only its sha256 goes to Render.

```bash
node -e "const c = require('node:crypto'); const t = c.randomBytes(32).toString('base64url'); console.log('token  ' + t); console.log('sha256 ' + c.createHash('sha256').update(t).digest('hex'));"
```

Keep the token in the owner's secret store. Put the sha256 line value in `RELAY_OPERATOR_TOKEN_SHA256`. To rotate, add the new hash beside the old one (comma-separated), move the release client to the new token, then remove the old hash.

## OWNER-GATED steps

No agent and no executor takes any of these steps. Each one is for the owner, in this order.

1. Choose the Render plan and confirm its price. The Blueprint names `0.5c-512mb` (the smallest paid web plan in Render's Blueprint reference) and the region `oregon`, beside Theo. Never the free plan: it sleeps when idle.
2. Create the service from the Blueprint: in the Render Dashboard choose New, then Blueprint, link this repo, and enter `services/decision-relay/render.yaml` in the Blueprint Path field.
3. Set `GEMINI_API_KEY` when Render prompts for it (the Blueprint gives it `sync: false` and no value).
4. Mint an operator token locally (above) and set its sha256 in `RELAY_OPERATOR_TOKEN_SHA256`. Never paste the token itself into Render.
5. Confirm the paid Gemini tier on the key's project before any user traffic. F-09: on the free tier Google may use the content it receives, and only Paid Services may serve users in the EEA, Switzerland or the UK.
6. Keep `RELAY_USER_TRAFFIC` off until a separate owner ruling turns it on (O-10). The shipped egress line `decision_advisor` also stays off for users.
7. Deploy only from the release commit. The relay checks requests against the catalog of the commit it runs; a deploy from another commit refuses current clients with `catalog_skew` (Pitfall 12). Auto deploy is off in the Blueprint (`autoDeployTrigger: "off"`).
8. Run one instance. The caps are in memory, so a second instance doubles every cap (assumption A3). The Blueprint sets `numInstances: 1`; do not turn on autoscaling.

Render notes for the owner: a push that changes the Blueprint file can sync the Blueprint (Render: "Each push to the linked branch that modifies your Blueprint file triggers a deploy of any added or modified resources"). Treat a change to `render.yaml` as a deploy change and review it like one.

## Unverified assumptions

- A2: Render accepts `buildCommand: node --version` (no install) for a node runtime. Not tested on Render. If the build fails, use `npm ci --omit=dev --ignore-scripts`; it costs build time only.
- A3: one instance keeps the in-memory caps whole. Render's reference says a new service gets 1 instance when the field is omitted, and the Blueprint sets 1. If more instances are ever needed, the caps must move to a shared store first.

## Files

- `server.cjs` - the socket layer and process entry (`createServer`, `clientAddressOf`, `SERVER_REASONS`).
- `relay.cjs` - the request pipeline (`createRelay(deps).handleDecide`).
- `config.cjs`, `verify-caller.cjs`, `limits.cjs` - configuration, the caller check and the caps.
- `render.yaml` - the Render Blueprint (custom Blueprint Path, no rootDir, NODE_VERSION pinned).

Tests: `tests/test-400-relay.cjs`, `tests/test-400-relay-server.cjs`, `tests/test-400-relay-packaging.cjs` (all in `tests/run-all-400.sh`). They use loopback only and a fake key.
