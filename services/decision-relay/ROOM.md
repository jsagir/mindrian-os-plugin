# services/decision-relay/

Phase 400 (S4, RL-01 to RL-05; owner rulings O-07, O-08, O-09, O-10). ICM Layer 0 identity for this folder.

What this folder is: the labels-only decision relay. It holds the owner's Gemini key on the server, so the key never ships in the plugin, the public repo or the npm package (O-07). A caller sends the neutral, closed-label request of Phase 399; the relay checks it with the same validator the plugin uses, builds the Gemini body on the server, sends one POST to the pinned Google AI host and path, and returns the parsed answers.

What this folder is not:
- Not a general Gemini endpoint. The relay accepts only requests that pass `lib/core/decision-advisor/labels-only.cjs`. It refuses anything else and never strips a field to make a request pass.
- Not plugin code. Nothing here is in package.json `files`; a plugin install never loads it. The per-turn path makes no live call.
- Not a second validator. The relay requires `lib/core/decision-advisor/labels-only.cjs`, `adapter.cjs` and `providers/gemini.cjs` by relative path from the repo root. Do not copy or vendor them here.

Rules this folder holds:
- The key comes from the environment only (`GEMINI_API_KEY`), goes in one header (`x-goog-api-key`), and is never logged, returned or copied into the config.
- Callers (O-09): an install id (`x-theo-install-id`, 32 lowercase hex) under per-install, per-address and global daily caps; or an owner-held operator token (Bearer, sha256 compared in constant time) that skips the user caps and has its own daily cap. User calls are refused until the owner sets `RELAY_USER_TRAFFIC=on`.
- Fixed order, every step refuses: caller check before any body parse, key present, size cap, JSON parse, catalog fingerprint match (`x-mindrian-catalog`), the shared labels-only validator, question cap, caps, server-side render and body re-check, one upstream POST.
- No redirects (`redirect: 'error'`), a timeout on the upstream call, no retry.
- Logs hold counts, durations and refusal reasons only: never a body, a token, an install id, an address or the key.

Contents:
- `config.cjs` - `loadConfig(env)` and `DEFAULTS` (stated default for every cap; an invalid number falls back).
- `verify-caller.cjs` - `verifyCaller(headers, cfg)`, the one pluggable caller check.
- `limits.cjs` - `createLimits(cfg, now)`: bounded per-bucket and global daily caps, in memory.
- `relay.cjs` - `createRelay(deps).handleDecide(...)`: the pure request pipeline, testable without a socket.
- Plan 400-13 adds the socket layer, the Render blueprint and the operator README.

OWNER-GATED (no agent does these):
- Create the Render service.
- Set any secret (the Gemini key, the operator token hashes).
- Choose and confirm the paid Gemini tier (F-09: only Paid Services may serve EEA, Switzerland or UK users).
- Turn on user traffic (`RELAY_USER_TRAFFIC=on`).
- Deploy.
- Change any egress default (`decision_advisor` stays off for users, O-10).

Tests: `tests/test-400-relay.cjs` (in `tests/run-all-400.sh`).
Canon: Part 8 (only closed labels leave the machine), Part 7 (reuse before build).
