---
phase: quick-260722-wom
plan: 01
subsystem: brain-transport-auth
tags: [brain, auth, resolver, memgraph-migration, dark-ship]
requires:
  - lib/core/resolve-brain-key.cjs (the single key-resolution chokepoint)
provides:
  - Pre-prefixed Brain key normalization at the resolver (bare-token contract)
affects:
  - every resolveBrainKey() consumer (brain-client getApiKey, session-start CLI shell-out, doctor class-M brain smoke, tier0-messaging, the two-gauge meter)
tech-stack:
  added: []
  patterns:
    - Anchored single-pass prefix strip at the resolver chokepoint (repair-once)
key-files:
  created: []
  modified:
    - lib/core/resolve-brain-key.cjs
    - tests/test-resolve-brain-key.cjs
decisions:
  - Fix lives at resolve-brain-key.cjs (the ONE resolver), not brain-client.cjs, so one normalization repairs every consumer
  - Anchor stripping to the START of the value only, so a token containing the letters mid-string is never mangled
  - BRAIN_URL default left byte-unchanged (dark-ship, no endpoint flip)
metrics:
  tasks-completed: 2
  files-modified: 2
  completed: 2026-07-22
---

# Quick Task 260722-wom: Fix Brain Auth Header for Memgraph Migration Step 1 Summary

Memgraph brain migration step 1 (dark-ship prep): made the Brain auth path immune to a pre-prefixed `MINDRIAN_BRAIN_KEY` value by normalizing to a bare token at the single resolver chokepoint, and confirmed on the record that the `MINDRIAN_BRAIN_URL` override path is already clean with no code change.

## What Was Done

Two tasks, TDD-driven:

- **Task 1 (RED then GREEN):** Added five hermetic scenarios (rbk.10 through rbk.14) to `tests/test-resolve-brain-key.cjs`, confirmed rbk.10/11/12/14 fail against the current resolver, then added a pure `_normalizeKey(v)` helper to `lib/core/resolve-brain-key.cjs` and applied it at all three success paths (the env branch and both file branches). All 14 rbk scenarios now pass.
- **Task 2:** Ran the full regression gate set (six gates, all hold), then wrote this findings record.

## Finding 1: URL override path - confirmed clean, NO code change

The `MINDRIAN_BRAIN_URL` env override the brief's step 1 asks for already exists in production. The env-overridable constant lives at:

```
lib/core/brain-client.cjs:23
const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://mindrian-brain.onrender.com';
```

The migration brief's section 04 claimed this constant lives in `bin/mindrian-brain-mcp-client.cjs`. That is incorrect (confirmed in RESEARCH.md): the `bin/` file is a pure stdio-transport shim with zero network code and no `BRAIN_URL` constant. The real constant lives in `lib/core/brain-client.cjs`, and both fetch call sites (the init handshake near line 214 and the tool call near line 283) derive from that single top-of-file constant, so setting `MINDRIAN_BRAIN_URL` already redirects both call sites consistently. The default fallback remains byte-unchanged (dark-ship). No new override needed; `bin/mindrian-brain-mcp-client.cjs` was correctly left untouched.

## Finding 2: Double-Bearer bug - was REAL, now fixed at the resolver

The bug was real. `resolveBrainKey()` previously returned the raw trimmed env/file value with zero prefix normalization, and `brain-client.cjs` wraps it as `Bearer ${key}` at both fetch call sites. Per the migration brief, at least one live env stores the entire wire auth header value (`Authorization: Bearer <uuid>`) inside the var, which today double-prefixes and produces a misleading `401 {"error":"Invalid API key"}` on a valid key.

The fix is a small pure helper `_normalizeKey(v)` at the resolver:
1. Returns null for non-string or empty input.
2. Strips one leading `Authorization:` label plus its following whitespace (case-insensitive, anchored to start).
3. Then strips one leading `Bearer` scheme token (case-insensitive, anchored to start) when followed by whitespace OR end-of-string.
4. Trims and returns null if nothing remains.

Applied at all three success paths, so a null normalization falls through the precedence chain as if the value were unset.

**Why the resolver, not brain-client:** `resolve-brain-key.cjs` is the documented single key-resolution chokepoint ("the ONE resolver"). Normalizing there repairs every consumer at once (brain-client's `getApiKey()`, session-start's CLI shell-out, doctor's class-M brain smoke, tier0-messaging, the two-gauge meter). `brain-client.cjs`'s `Bearer ${key}` construction is now correct by the resolver's bare-token contract, so the client needed zero changes and stays byte-unchanged.

**Five test scenarios that pin the contract:**
- rbk.10: env `Bearer test-token-123` resolves to bare `test-token-123`.
- rbk.11: env `Authorization: Bearer <t>` (mixed and all-lowercase) resolves to the bare token.
- rbk.12: a `~/.mindrian.env` file value `Bearer <t>` normalizes too (file path, not just env).
- rbk.13: regression pin - a mid-string `xbearerx-mid-string` and a plain bare token pass through byte-unchanged (anchoring proof).
- rbk.14: a bare `Bearer` alone never yields an empty key; it falls through to the file chain.

## Verification (all six gates hold)

1. `node tests/test-resolve-brain-key.cjs` exits 0 (14 passed, 0 failed), including rbk.6 (zero-network grep) and rbk.9 (env-aware home).
2. `node lib/memory/security-trifecta.test.cjs` exits 0 (22 passed, 0 failed) - brain-client's SEC-01/SEC-02 surface intact, no new failures.
3. `node -e "require('.../lib/core/brain-client.cjs')"` loads without throwing.
4. `git diff --exit-code` on `brain-client.cjs`, `bin/mindrian-brain-mcp-client.cjs`, `package.json`, `.claude-plugin/plugin.json`, `CHANGELOG.md` returns 0 (byte-proof: client, shim, and every version surface untouched).
5. `grep "const BRAIN_URL" lib/core/brain-client.cjs` still shows the `mindrian-brain.onrender.com` default.
6. Em-dash gate: no em-dash characters in either touched file.

## Canon Compliance

- **Part 8 (Graph Boundary):** the resolver still reads only local files and env vars; rbk.6's zero-network grep stays green, so the new helper and comment added no network markers. No user or room-specific bytes touch the Brain.
- **No em-dashes:** verified clean in both files (hyphens only).

## Deviations from Plan

None - plan executed exactly as written. TDD RED confirmed rbk.10/11/12/14 failing before the fix; rbk.13 passed as a pin (expected).

## Deferred Follow-up

Live Tri-Polar (CLI/Desktop/Cowork) verification against the real `pws-brain-mcp.onrender.com` endpoint (with a live `MINDRIAN_BRAIN_URL` override and a real Bearer key in a dev session) is step 2 of the migration brief's sequence and is explicitly out of scope for this quick task. This task was a static code-correctness fix and verification only.

## Commits

- `4f443c3e` test(quick-260722-wom-01): add failing prefix-normalization scenarios rbk.10-14
- `61dc5467` feat(quick-260722-wom-01): normalize pre-prefixed Brain keys at the resolver

## Self-Check: PASSED

- Files verified on disk: `lib/core/resolve-brain-key.cjs`, `tests/test-resolve-brain-key.cjs`, `260722-wom-SUMMARY.md`.
- Commits verified in git log: `4f443c3e`, `61dc5467`.
- Em-dash gate clean across both code files and this SUMMARY.
