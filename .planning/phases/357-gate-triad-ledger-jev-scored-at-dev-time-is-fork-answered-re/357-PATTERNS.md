# Phase 357: Gate-triad replay harness - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 22 (new + modified)
**Analogs found:** 20 / 22

Post-research rulings R-A..R-J (357-CONTEXT.md) supersede D-07 / D-16 / SPEC R4, R6. This map follows the rulings.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `scripts/replay-card-fire.cjs` (NEW) | dev script / harness | batch, in-process | `tests/test-238-card-fire-corpus.cjs` + `tests/helpers/cardfire-hermetic-238.cjs` | role-match |
| `scripts/label-card-fire-replay.cjs` (NEW) | dev script (vendor) | batch request-response | `scripts/build-section-command-ledger.cjs` (jev/pool/loadKey) | exact |
| `scripts/jev-devtime-client.cjs` (NEW if absent, per 354-17) | shared utility | request-response + egress guard | `scripts/build-section-command-ledger.cjs` :70-172 | exact (extraction source) |
| `scripts/extract-dogfood-stop-events.cjs` (NEW) | dev script | file-I/O transform | `scripts/label-topic-forest.cjs` (fs/path script shell); transcript parse via `lib/hmi/turn-text.cjs` | partial |
| `data/jev-policies/card-fire-replay.json` (NEW) | config | static | none on disk (356 D-01 Noul shape) | no analog |
| `tests/fixtures/card-fire-replay/{debug-cases,live-2026-09-23,dogfood,baseline}.json` (NEW) | fixture | static | `tests/fixtures/card-fire-corpus-238.json` (`{meta, entries}`) | exact |
| `lib/hmi/turn-text.cjs` (MOD: `'harness'` source class, R-A) | utility | transform | self, `classifyPrecedingUserContentSource` :115-139 | self |
| `scripts/check-card-fire.cjs` (MOD: :683 equality, comment :1333-1334, `preceding_user_is_meta` in `deriveTurnSignals` :1482) | service | request-response | self | self |
| `lib/core/gate-relevance.cjs` (MOD: F.1 chrome tokens, R-F) | utility | transform | self, `GATE_BOILERPLATE_TOKENS` :139 | self |
| `lib/hmi/dial-presenter.cjs` (READ source of frozen chrome strings) | component | - | - | n/a |
| `agents/larry-extended.md` :84 section + SKILL :216 span (MOD shrink, R-B; SKILL :244 untouched) | prompt surface | static | self | self |
| `data/harness-manifest.json` (REGEN) | config | build output | `node scripts/build-harness-manifest.cjs` | self |
| `tests/test-353-tripwires.cjs` (MOD leg 2 named list) | test | static scan | self :104-116 | self |
| `tests/run-all-357.sh` (NEW) | test runner | batch | `tests/run-all-354.sh` | exact |
| `tests/run-all-238.sh` (MOD: add replay `run_if` leg, R-J) | test runner | batch | self :36-57 | self |
| `tests/test-357-replay.cjs`, `-corpus-loader`, `-labeler-refusal`, `-harness-source`, `-f1-chrome` (NEW x5) | test | unit/integration | `tests/test-238-card-fire-corpus.cjs` | exact |

## Pattern Assignments

### `scripts/replay-card-fire.cjs` (dev harness, batch)

**Analog:** `tests/test-238-card-fire-corpus.cjs` lines 31-37 (require REAL classifier, corpus JSON in place):
```js
const REPO = path.join(__dirname, '..');
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));
const { makeHermeticCardFireEnv } = require(path.join(REPO, 'tests', 'helpers', 'cardfire-hermetic-238.cjs'));
const corpus = require(path.join(REPO, 'tests', 'fixtures', 'card-fire-corpus-238.json'));
```
- `--code-root <dir>` (R-I): resolve `REPO` from the flag instead of `__dirname` so the same corpus runs against a `git archive` of the pre-phase sha.
- Hermetic env: `tests/helpers/cardfire-hermetic-238.cjs` `makeHermeticCardFireEnv(label)` sets BOTH `MINDRIAN_HOME` and `CARD_FIRE_SIDECHANNEL_PATH` together and returns `{dir, retryFile, sideFile, restore}`. Add `MINDRIAN_ROOMS_HOME` = empty temp dir, save/restore like `lib/core/graph-self-heal.cjs` :197-215:
```js
const prevRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
process.env.MINDRIAN_ROOMS_HOME = parentRoomDir;
... finally {
  if (typeof prevRoomsHome === 'string') process.env.MINDRIAN_ROOMS_HOME = prevRoomsHome;
  else delete process.env.MINDRIAN_ROOMS_HOME;
}
```
- CLI surface: `checkCardFire.deriveTurnSignals(envelope)` (:1482) then `classifyCardFire(turn, registry)` (:523).
- MCP surface: `require('lib/mcp/stop-gate-handler.cjs')`, `async handleStopEvent(sessionId, stopContext)` (:449); call `_resetForTest()` (:387, clears `_sessionDedupState`) per entry. Compare verdict CLASS only (R-H).
- Network ban: `globalThis.fetch = () => { throw new Error('network forbidden in replay') }` for the whole run (RESEARCH :379).
- Side-channel seeding (RESEARCH :482-485): `recordReachedGate({... shape, subjectText, filePath: scPath})` from `lib/core/card-fire-sidechannel.cjs`, then read JSON, back-date `ts`, write back.
- Exit: non-zero on `false_blocks > 0 || new_misses > 0` (D-13); `known_miss` / `known_false_block` (R-C) excluded.

### `scripts/jev-devtime-client.cjs` (shared utility; extract if absent)

**Analog/source:** `scripts/build-section-command-ledger.cjs`
- Constants :60-64 (`ENDPOINT = 'https://api.typesafe.ai/v1/systemone'`, `MODEL = 'jev-latest'`).
- `loadKey()` :70-78: env `TYPESAFE_API_KEY`, else parse `~/.secrets/typesafe.env`; never printed. Target signature per 354-17: `loadKey({env, secretsPath})`.
- `assertEgressCeiling(payload)` :82-~130: allow-list Sets, throws naming the key (`'disallowed state key "' + k + '"'`). Generalize to `makeEgressGuard(profile)` + frozen `EGRESS_PROFILES`; R-G adds optional `max_len_by_key` and `must_equal_file` (byte compare `fs.readFileSync(file,'utf8') === value`), refuse never strip.
- `jev(key, body)` :136-159 (guard first, then fetch with backoff on throw / 429 / 529):
```js
async function jev(key, body) {
  assertEgressCeiling(body);
  let attempt = 0;
  for (;;) { ... r = await fetch(ENDPOINT, { method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
    ... if ((r.status === 429 || r.status === 529) && attempt++ < 4) { await sleep(400 * 2 ** attempt); continue; }
    return { status: r.status, ms, json, text: text.slice(0, 200) };
```
Target signature: `jev(body, {key, guard, endpoint?, fetchImpl?, sleepImpl?})` (injectable fetch for tests).
- `pool(items, n, fn)` :161-172 copy verbatim.
- Leave re-exports in `build-section-command-ledger.cjs`. Coordinate with 356 (jsagi-a7) / 354-17 before editing (R-G, Pitfall).

### `scripts/label-card-fire-replay.cjs`

**Analog:** `scripts/build-section-command-ledger.cjs` header :1-20 (dev-only, navigator-invoked, never a hook, never release.sh). Pattern: load corpus, REFUSE `source === 'dogfood'` or missing `meta.sanitization_statement` BEFORE building any request (D-11); `loadKey()` null -> write `unlabeled`, exit 0; build 3 independent Noul bodies (is-fork / already-answered / relevant) with `state.policy` = policy file bytes; `pool(items, CONC=4, ...)`; write `357-JEV-LABEL-REPORT.md`. Thresholds >=0.80 yes, <=0.20 no, else `uncertain`.

### `scripts/extract-dogfood-stop-events.cjs`

**Analog:** script shell of `scripts/label-topic-forest.cjs` (:30-32 `fs`, `path`, `child_process` requires). Parse transcripts from `~/.cache/mindrian-dev/357-raw/` (R-D snapshot, never live paths); reuse `lib/hmi/turn-text.cjs` `readTurnText` on the prefix and real `classifyCardFire` (RESEARCH :194-197). Output entries with `label_origin: 'human'`, sanitized.

### Fixtures `tests/fixtures/card-fire-replay/*.json`

**Analog:** `tests/fixtures/card-fire-corpus-238.json`, top-level keys `['meta','entries']`; entry has `{id, source, expect_fire, why, text}`. New shape (D-02): `{id, source, envelope, expected_verdict_class, expected_reason?, label_origin, why, known_miss?}`; `meta.sanitization_statement` mandatory. 238 file read IN PLACE via an adapter (`expect_fire` -> `expected_verdict_class`, `text` -> `envelope.output_text`), never copied (D-01).

### `lib/hmi/turn-text.cjs` (MOD, R-A)

**Self, :115-139** `classifyPrecedingUserContentSource(content)` returns `'typed'|'tool_result'|'none'`, wrapped in try/catch returning `'none'`. Add `'harness'` when record `isMeta:true` (unless the previous record is human-typed) OR non-human `origin.kind` leading with `<task-notification` / peer / idle framing. Needs record-level input (isMeta, origin, previous record), so pass extra context from `readTranscriptTurn` rather than content only. Keep never-throws.

### `scripts/check-card-fire.cjs` (MOD)

**Self, :683-685:**
```js
if (t.preceding_user_text_source === 'tool_result') {
  return { intercept: false, reason: 'preceding-turn-synthetic-no-user-engagement', degrade: false };
}
```
Extend to `=== 'tool_result' || === 'harness'` (RESEARCH :395). Update the block comment above (:670-682, it says tool_result is the ONLY producer) and :1333-1334. Exports :1753+ already re-export `classifyPrecedingUserContentSource` (:1771).

### `lib/core/gate-relevance.cjs` (MOD, R-F)

**Self, :139-141** plus header comment :102-138 (explicitly predicts the F.1 extension and warns canonical verbs are content, not chrome):
```js
const GATE_BOILERPLATE_TOKENS = Object.freeze(new Set([
  'bind', 'session', 'room', 'rooms', 'select', 'start', 'talk', 'new',
]));
```
Add frozen F.1 chrome tokens derived from `lib/hmi/dial-presenter.cjs` static template strings only (not frequency); consumed via `gateSubjectTokens` :180-188. Drift test in `test-357-f1-chrome.cjs` re-derives tokens from dial-presenter and asserts subset. Cite `live-2026-09-23-02`.

### `tests/test-353-tripwires.cjs` leg 2 (MOD)

**Self, :108-116:** `const bannedRe = /eval-icm-writers|build-section-command-ledger/;` Replace with a named list constant (e.g. `HOOK_BANNED_DEV_SCRIPTS = [...]`) joined into the regex, appending `label-card-fire-replay` (and `jev-devtime-client`). If 356 already introduced it, append only. Leg 1 writes a scratch file in `lib/core/`: run only when peers are idle.

### `tests/run-all-357.sh` (NEW)

**Analog:** `tests/run-all-354.sh` (`set -uo pipefail`, ROOT cd, PASS/FAIL/SKIP counters, `run()` with exit 77 = SKIPPED ENV GAP) plus `run_if label file cmd...` from `tests/run-all-238.sh` :36-43:
```bash
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then run "$label" "$@"
  else echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""; fi
}
```
Written once in Wave 0; later plans add test files only. Append a replay `run_if` leg to `tests/run-all-238.sh` after :57.

### `tests/test-357-*.cjs` (NEW x5)

**Analog:** `tests/test-238-card-fire-corpus.cjs`: `'use strict'`, `node:assert/strict`, header comment explaining hermetic both-vars rule, `console.log('test-...')`, `ok(desc, fn)` counter helper; non-throwing recorder for expected-red lists. Every leg calls `makeHermeticCardFireEnv` and `restore()`.

## Shared Patterns

- **Hermetic env:** `tests/helpers/cardfire-hermetic-238.cjs` (MINDRIAN_HOME + CARD_FIRE_SIDECHANNEL_PATH together) + `MINDRIAN_ROOMS_HOME` empty dir (R-H); assert `business.room_dir === null`.
- **Vendor boundary:** Jev only in `scripts/` dev tools; guard before every fetch, throw naming the key; tripwire leg 2 bans hooks/ references; `! grep -rn api.typesafe.ai lib/ hooks/`.
- **Never-throws classifiers:** try/catch returning a conservative default (`turn-text.cjs` :136-138).
- **House rule:** no em-dashes in any new file (headers state it).
- **Tracked .planning:** new phase-dir files need `git add -f`.

## No Analog Found

| File | Reason |
|---|---|
| `data/jev-policies/card-fire-replay.json` | `data/jev-policies/` does not exist yet; use 356 D-01 Noul shape `{policy_id, version, instructions, criteria:{"true","false"}, boundary_cases[]}` |
| `scripts/jev-devtime-client.cjs` profile extensions `max_len_by_key` / `must_equal_file` | No per-key cap precedent; design from RESEARCH :451 |

## Metadata

**Search scope:** scripts/, lib/hmi, lib/core, lib/mcp, tests/, tests/helpers, tests/fixtures, agents/
**Files scanned:** ~14
**Date:** 2026-09-23
