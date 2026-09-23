# Phase 356: Chain-executor irreversibility ledger (Jev Noul, dev-time, shipped as data) - Research

**Researched:** 2026-09-23
**Domain:** dev-time vendor scoring shipped as data; chain-executor gate predicate; shared dev-time client extraction
**Confidence:** HIGH on the code seams and consumers (read at HEAD `574c4b285`); HIGH on the Noul request/answer contract (live docs plus a recorded spike response); MEDIUM on threshold edge-case policy (SPEC wording needs one interpretation, flagged)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Policy text (SPEC R1)
- **D-01:** The policy lives at `data/jev-policies/command-irreversibility.json`: one file per dev-time Jev ledger, in a folder 357 and 354-17 can share. Fields: `policy_id`, `version`, `instructions`, `criteria[]`, `boundary_cases[]`. `policy_hash` = SHA-256 of the file bytes, recorded in the ledger. Add one row to `data/ROOM.md`. Do NOT use `data/harness-policies/` (runtime gate policies, different schema).
- **D-02:** Claude drafts from the SPEC R1 definition and lists local-file vs. upload boundary cases for every export and share command in the registry. The navigator edits and locks the wording (plain language, no em-dashes). The policy text is part of the data contract: the Jev docs name literal reading as failure mode #1, so the boundary cases carry most of the accuracy.
- **D-03:** The policy stays independent of Larry's contract. It never quotes `agents/larry-extended.md`. It carries one sentence stating that irreversible is narrower than material (every irreversible step is material, not every material step is irreversible), and a builder test asserts that sentence exists.

#### Answer key (SPEC R2, R4)
- **D-04:** Hybrid labeling. The navigator labels a risk subset blind, BEFORE seeing Claude's labels and before any Jev call. The subset is picked by a script that reads only the registry: every command that matches the keyword list, OR is one of the 65 not tagged `autonomous_safe`, OR has external verbs (send/share/export/upload/publish/deploy) in `teaching`/`jtbd_summary`, OR that Claude's pre-label calls irreversible. The navigator then reviews Claude's pre-labels for the rest. Estimated 30-35 min of navigator time.
- **D-05:** Label file: plain JSON, no plugin-runtime dependencies (a future Theo re-emission must be able to read it). Header: `{schema, labels_for: "data/command-registry.json", registry_hash, reviewed_by, reviewed_at, method, rows: [...]}`. Row: `{command, irreversible, reason, label_source}`, where `label_source` is one of `navigator-blind`, `claude-prelabel/navigator-confirmed`, `navigator-corrected`. The report states the blind-vs-Claude disagreement rate as a measure of LLM bias. The shape is offered for reuse by 354-17 and 357; do not write into their phase dirs.

#### Shared Jev client (SPEC R8)
- **D-06:** Extract if missing. 356's first executable task checks for `scripts/jev-devtime-client.cjs`. If present, import it. If absent, 356 extracts it, and `build-section-command-ledger.cjs` imports it and re-exports the same names (`assertEgressCeiling`, `jev`, `pool`, `loadKey`), so `scripts/eval-icm-writers.cjs` and the test-353 tests stay byte-compatible. Before touching any file with uncommitted diffs from another session (test-353 files, `eval-icm-writers.cjs` at discuss time), check `git status` and message the owner first.
- **D-07:** Module interface (pure, no `lib/` requires, no plugin-path assumptions, so Theo could vendor or port it): `loadKey({env, secretsPath})`, `makeEgressGuard(profile)`, `jev(body, {key, guard, endpoint?, fetchImpl?, sleepImpl?})`, `pool(items, n, fn)`, `EGRESS_PROFILES` (frozen, keyed by builder).
- **D-08:** One guard file, one profile per builder, never a merged union. A union would widen 353's limits. `section_command_ledger` keeps 353's exact key sets and caps. `material_step_ledger` (356) allows state keys `{slug, teaching, jtbd_summary, policy}`, no candidates, its own length cap for `policy`, and requires the `policy` value to be byte-identical to the policy file. Any other key throws before fetch. 357 adds its own profile. Add the new module name to the tripwire leg that bans ledger builders from `hooks/`.
- **D-09 (Theo consult, 2026-09-23):** Theo has no Jev client or gateway code. It already pins the plugin's spike sources (`/home/jsagi/Theo/.planning/quick/260917-co6-*/260917-co6-PIN-LEDGER.md`). Theo's own egress design (Theo Phase 3, `03-MOS-LEARNING.md`) refuses a call carrying any field the tool did not ask for (refuse outright, never silently strip) and keeps its tool sets separate by construction. D-08 follows the same philosophy: per-profile, refuse-don't-strip, separated by construction. Keep the module's error shape compatible, a thrown error naming the disallowed key, so a future Theo-side port maps one-to-one.

#### What Jev reads (SPEC R3, R7)
- **D-10:** Registry blurb only: `teaching` + `jtbd_summary`, about 70 tokens per command. Measured 2026-09-23: across all 48 `autonomous_safe: true` commands, the `commands/*.md` bodies added zero true positives. The export/snapshot/vault bodies contain advice lines ("deploy to Vercel") that would cause false alarms. `/mos:publish`'s blurb already names its external effect. `text_hash` covers slug + teaching + jtbd_summary only, so body edits never stale an entry, and Theo can re-emit from the registry JSON alone. The zero-miss threshold on the hand-labeled key is the safety net if a blurb ever hides an effect.

#### Cross-cutting (navigator directive, 2026-09-23)
- **D-11 Parallel sessions:** Phase 354 (jsagi-25: 354-17 framework ledger, 354-18 THEO-04), 355 (jsagi-d9: Jev-through-Theo engines), 357 (jsagi-e0: gate-triad ledger plus larry-extended prose shrink). Commit only by explicit path, never `git add -A`, never stash or revert other sessions' diffs, re-read ROADMAP.md/STATE.md from disk before editing, and message owners before touching shared files (the test-353 family, the 353 builder).
- **D-12 Larry contract calibration:** The contract in `agents/larry-extended.md` lines 72-80 (validated by `tests/test-larry-handoff-seam.cjs`) holds unchanged: runChain halts at the first material step. 356 only makes more steps count as irreversible, and therefore as material. The plan must include a check that re-reads larry-extended at execute time. If 357 has landed its gate-prose shrink, confirm the halt semantics and the `forced_material` reason code are still described consistently, and that nothing in 356 or 357 redefines "material" as "irreversible". Flag this to jsagi-e0.
- **D-13 Optimized for Theo:** Every 356 artifact (policy JSON, label file, ledger JSON, client module) is plain data or pure functions readable without the plugin working tree, so a future Theo-side re-emission (the dependency-shape ruling: "scored once at dev time or in Theo's re-emission and SHIPPED AS DATA"; `docs/THEO-NOTIFY-CONTRACT.md`) can rebuild the ledger from pinned `data/` sources with Theo holding the one key.

### Claude's Discretion
- Ledger file name under `data/` (proposed: `data/command-irreversibility-ledger.json`), the answer-key file location, and the hash encoding (SHA-256 hex).
- The builder's CLI flag names, beyond mirroring the 353 builder (`--check`, `--jev-fixture <path>`, default live build).
- How the runtime caches the ledger read (once per process is fine).

### Deferred Ideas (OUT OF SCOPE)
- Blurb plus filtered body lines as Jev input: revisit only if a hand label disagrees with its blurb verdict.
- Correcting `autonomous_safe` registry tags at the source, using ledger disagreements as evidence: a separate decision.
- The navigator's algorithm R&D briefing (https://mindrian-algorithm-rd.vercel.app/: five tier-1 discovery algorithms, three-signal convergence) belongs to Phase 355 and was forwarded to jsagi-d9 on 2026-09-23. It is not a 356 input.
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQ-IDs are minted yet. The 8 locked SPEC requirements are traced here as R356-01..R356-08.

| ID | Description (SPEC) | Research Support |
|----|--------------------|------------------|
| R356-01 | Written policy; Noul payload carries it byte-identical to the file | Request body under "Pattern 3"; `state.policy` = exact UTF-8 file text, guard enforces equality (D-08); Noul `criteria` must be `{true, false}` (docs, VERIFIED) which forces one shape decision on D-01's `criteria[]` (Open Question 1) |
| R356-02 | Hand-labeled answer key covering exactly the registry command set, reviewer + date | "Pattern 5" workflow and label JSON; measured blind-subset size 66+ of 113; build-time set-equality gate plus live test (Pitfall 6) |
| R356-03 | Dev-time builder, one Noul per command, ledger with 4 per-entry and 5 top-level fields | "Pattern 4" builder shape; fixture mode through a fake `fetchImpl` so the real request path is exercised (unlike 353's fixture shortcut, Pitfall 9) |
| R356-04 | Zero-miss threshold, false-alarm count recorded, fail loud | "Pattern 6" threshold math incl. ties, p = 0, zero positives, missing p, degenerate flag-all |
| R356-05 | Add-only runtime integration, local-only, silent degradation | "Pattern 2" seam: one added final clause in `isIrreversibleStep` (`chain-executor.cjs:546-555`) calling a lazily loaded `lib/core/irreversibility-ledger.cjs`; forces a re-pin in `tests/test-264-b3-frozen.cjs:108` (Pitfall 1) |
| R356-06 | Staleness fallback + key-free zero-network `--check` WARN exit 0 | `text_hash` = sha256 hex of `JSON.stringify([command, teaching, jtbd_summary])` (strings, null -> ""); "Pattern 7" `--check` |
| R356-07 | Egress allow-list before every fetch; key only from `~/.secrets/typesafe.env` or env | `material_step_ledger` profile (caps measured: teaching max 535 chars, jtbd_summary max 75); guard runs inside `client.jev` before `fetchImpl` |
| R356-08 | One shared Jev client, 353 builder re-exports, no local copies | "Pattern 1" extraction plan; consumer inventory; 354-17's current plan COPIES the client (coordination item) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- GSD owns all dev work; commits only by explicit path (never `git add -A`), never stash or revert another session's diffs (D-11, memory rule).
- `.planning/` is gitignored (`.gitignore:97`) but phase files are force-tracked: every new phase-dir file needs `git add -f` (verified with `git check-ignore -v`).
- Canon Part 8: no room content or user bytes cross to any vendor; only plugin-authored generic text.
- Part 7 reuse before build: extract, never copy, the 353 client (D-06).
- No em-dashes in any shipped file; hyphens only. CJS only, no new npm dependencies, native `fetch`, Node >= 22.16 (machine has v22.23.1).
- Every directory gets a ROOM.md identity (Decision #15). In practice `data/` subfolders carry none (`data/harness-policies/` has a CONTEXT.md, no ROOM.md); D-01 asks only for a row in `data/ROOM.md`.
- Dev-research compositing: findings filed in the phase dir AND `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>`.
- Grounding sources: Theo is a standing consult (done in discuss, D-09); TypeSafe is not in Context7 (355-AI-SPEC l.192), so docs were read from docs.typesafe.ai.
- Tests are run by Claude after edits (`bash tests/run-all-<phase>.sh`).
- Memory rule: no real names of testers/advisors in tracked files. `data/` ships in the npm tarball (`package.json` `files`), so `reviewed_by` should be the role handle `navigator`, not a person's name.

## Summary

The phase is small in code and large in coordination. The runtime change is one added clause at the end of `isIrreversibleStep` (`lib/core/chain-executor.cjs:546-555`): after the keyword loop, `return _ledgerForcesIrreversible(step.command)`. All four callers (`:571` `_isMaterialStep`, `:792` inside `makeGateFn`, `:1083` and `:1538` halt-reason, the last moved from `:1411` by 354-03's commit `ae595b101` today) inherit it with no edits. The catch: `tests/test-264-b3-frozen.cjs:106-113` SHA-256-pins the exact source text of `isIrreversibleStep`, so ANY edit reddens that suite. SPEC R5 names `isIrreversibleStep` explicitly, so the plan must include a documented re-pin of that one hash (the other five pins, including `makeGateFn` and `_isMaterialStep`, stay untouched because the ledger lookup lives in a new helper outside the pinned bodies).

The shared client extraction is straightforward because every consumer goes through the 353 builder's module exports: `scripts/eval-icm-writers.cjs:78,516,520,529,706` and `tests/test-353-grader-agreement.cjs:79,91` use `loadKey`, `jev(key, body)`, `assertEgressCeiling(payload) === true`, and `pool`. Keep those four names as thin wrappers in `build-section-command-ledger.cjs` (the old `jev(key, body)` argument order stays), and neither consumer needs an edit. That matters because both consumer files, plus `tests/test-353-ledger-shape.cjs`, carry UNCOMMITTED diffs from another session right now; `test-353-ledger-shape.cjs` is currently RED in the working tree (PASS=13 FAIL=6) because its diff expects a live-scored 353 ledger that has not been built. The 356 plan must record that baseline rather than "fix" it.

Jev's Noul contract is verified: request `{type: 'noul', instructions: string|object, criteria?: {true, false}}`, answer `{type: 'noul', noul: <0..1>}` with no confidence field (docs.typesafe.ai/primitives/noul.md, and the recorded spike-001 answer `{"type":"noul","noul":0.06}`). Returned values are two-decimal, so ties at the threshold are common and the math must use `>=` on the stored raw values. `TYPESAFE_API_KEY` is set in this machine's shell environment, so every 356 test must scrub the env var and stub `fetch` to throw, or a fixture-path bug becomes a real vendor call.

**Primary recommendation:** Build it in four tracks that can overlap: (1) extract `scripts/jev-devtime-client.cjs` with a parity test first; (2) land the runtime seam against synthetic test ledgers (re-pin 264 with a written reason); (3) run the human answer-key workflow (blind subset BEFORE the navigator sees the policy's boundary cases); (4) build and test the builder in fixture mode, then a navigator-run live build, then run every chain suite with the shipped ledger present.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vendor call, key load, egress guard | Dev-time tooling (`scripts/jev-devtime-client.cjs`) | - | Jev never runs on a user machine (dependency-shape ruling); tripwires ban it from `lib/` and `hooks/` |
| Scoring + threshold tuning | Dev-time tooling (`scripts/build-command-irreversibility-ledger.cjs`) | Navigator (live run, key) | Finite input space scored once, shipped as data |
| Policy text, answer key, ledger | Data (`data/`) | Theo re-emission (future) | Plain JSON, pinned by Theo at a tag; D-13 |
| Staleness hash (pure function) | Runtime library (`lib/core/irreversibility-ledger.cjs`) | Builder imports it | One definition shared by builder and runtime; builder may require `lib/`, `lib/` may never require the client |
| Registry text lookup | Runtime library (`lib/workflow/command-resolver.cjs`, one additive accessor) | - | Resolver already caches the registry and honors `MINDRIAN_COMMAND_REGISTRY`; avoids a second registry read (SPEC: "one cached local JSON read") |
| Halt decision | Runtime library (`lib/core/chain-executor.cjs` `isIrreversibleStep`) | - | Single seam; add-only |
| Blind labels, policy lock, live build approval | Human (navigator) | Executor transcribes | Checkpoints; LLM must not label its own ground truth unseen |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` | built-in (Node v22.23.1 on this machine) | SHA-256 hex for `text_hash`, `policy_hash`, `registry_hash` | Already used by `chain-executor.cjs:87` and a dozen `lib/core` modules [VERIFIED: codebase grep] |
| native `fetch` | Node 22 global | Jev POST in the dev-time client only | 353 builder and spikes 001-004 use it [VERIFIED: codebase] |
| `node:fs`, `node:path`, `node:os` | built-in | file reads, `~/.secrets/typesafe.env` path | Same as 353 builder l.49-51 |

### Supporting
None. No npm package is added.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| native fetch client | `@typesafe-ai/sdk` | Spike reference notes the SDK exists (ESM+CJS, Node 20+) but no spike used it; CLAUDE.md forbids new deps. Rejected |
| Independent registry read in the ledger module | Additive `commandRow(cmd)` export on `command-resolver.cjs` | The independent read is simpler but adds a second 92 KB JSON parse, against SPEC's "one cached local JSON read". Recommend the accessor |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck not run (nothing to check).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
DEV TIME (navigator's machine, key present)
  data/command-registry.json --(slug, teaching, jtbd_summary)--+
  data/jev-policies/command-irreversibility.json --(file bytes)-+--> builder: one payload per command
  data/jev-labels/command-irreversibility.json (answer key) ----+         |
                                                                          v
                                             client.jev(body,{key,guard})
                                               guard(body)  -- refuses unknown key / cap / policy mismatch (throws, no fetch)
                                               fetchImpl(POST api.typesafe.ai/v1/systemone)  [fixture mode: fake fetchImpl]
                                                          |
                                                          v  answers.irreversible = {type:'noul', noul:p}
                                             threshold T = min p over labeled-true   (fail loud on bad cases)
                                             flag = p >= T ; false_alarm_count vs labels
                                                          |
                                                          v
                                   data/command-irreversibility-ledger.json  (+ 356 report in phase dir)

RELEASE / CI (no key)
  builder --check --> reads ledger + registry + policy + labels --> WARN lines (stale / unscored / policy drift) --> exit 0, zero network

RUNTIME (user machine, zero network)
  runChain step --> gateFn (makeGateFn) --> isIrreversibleStep(step)
                                              step.irreversible === true ? -> halt (forced_material)
                                              keyword substring ?          -> halt (forced_material)
                                              ledger module (lazy, cached once):
                                                 entry.flag === true AND entry.text_hash === hash(current registry row) ? -> halt
                                                 missing file / bad JSON / stale / unknown -> false (today's behavior)
```

### Recommended Project Structure
```
scripts/
  jev-devtime-client.cjs                    # NEW shared client: loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES
  build-section-command-ledger.cjs          # EDIT: imports client, keeps loadKey/assertEgressCeiling/jev/pool exports
  build-command-irreversibility-ledger.cjs  # NEW builder: live / --jev-fixture / --check / --label-sheet
lib/core/
  irreversibility-ledger.cjs                # NEW pure runtime reader + commandTextHash (no Jev, no fetch)
  chain-executor.cjs                        # EDIT: lazy loader + one clause in isIrreversibleStep
lib/workflow/
  command-resolver.cjs                      # EDIT (additive): commandRow(cmd) accessor over the existing cache
data/
  jev-policies/command-irreversibility.json # NEW policy (navigator-locked)
  jev-labels/command-irreversibility.json   # NEW answer key (D-05 shape)   [name is discretion]
  command-irreversibility-ledger.json       # NEW shipped ledger
  ROOM.md                                   # EDIT: rows for the three data files
tests/
  test-356-*.cjs, run-all-356.sh, fixtures/356-jev-noul-responses.json
  test-264-b3-frozen.cjs                    # EDIT: re-pin isIrreversibleStep hash only
  test-353-tripwires.cjs                    # EDIT: leg 2 banned-name list (D-08)
```

### Pattern 1: Shared client extraction (R356-08, D-06..D-09)

**Consumer inventory of the 353 builder's exports** (grep, HEAD `574c4b285` plus working tree):

| Consumer | Uses | Line(s) | Uncommitted diff now? |
|----------|------|---------|-----------------------|
| `scripts/eval-icm-writers.cjs` | `require(build-section-command-ledger)`, `jev(key, payload)` via `jevFn`, `assertEgressCeiling(payload)`, `loadKey()` | 78, 516, 520, 529, 706 | YES (another session; adds typed Choice payload, `jevFn` seam) |
| `tests/test-353-grader-agreement.cjs` | `assertEgressCeiling(payload) === true` | 79, 91 | YES (same session's diff) |
| `tests/test-353-ledger-shape.cjs` | spawns the builder, `buildWithJevFixture`, `--check` with a fetch stub | 18, 45-55, 67-77 | YES; currently RED 6 legs (expects a jev-scored shipped ledger) |
| `tests/test-353-release-wiring.cjs` | text scan of `release.sh` for one `--check` call site | 32-61 | no |
| `tests/test-353-tripwires.cjs` | leg 2 regex `eval-icm-writers|build-section-command-ledger` over `hooks/` | 108-117 | no |
| `scripts/release.sh` | runs `--check` | 416-418 | no |
| `docs/SECTION-COMMAND-LEDGER.md` | prose | 4, 39, 53 | no |

The 353 builder's export object (`build-section-command-ledger.cjs:708-725`) also exports `LEDGER_PATH`, `CANON_PATH`, `pullTheoFrameworks`, `buildJobCandidateMap`, `rowsFromCandidateMap`, `calibrateFloor`, `serializeLedger`, `buildOfflineSeedLedger`, `buildWithJevFixture`, `buildJevScored`, `runCheck`, `main`; these stay in the builder untouched.

**Byte-compatible re-export recipe** (the only edit to the 353 builder):
- Delete l.67-172's local `loadKey`, `EGRESS_ALLOWED_*`, `assertEgressCeiling`, `sleep`, `jev`, `pool`.
- Add `const client = require('./jev-devtime-client.cjs');`
- `const assertEgressCeiling = client.makeEgressGuard(client.EGRESS_PROFILES.section_command_ledger);` It must return `true` on pass (test-353-grader-agreement l.91 asserts `=== true`) and throw with the SAME messages (`'assertEgressCeiling: disallowed state key "' + k + '"'` etc.) for this profile, so any log or test that matched them still does.
- `function loadKey() { return client.loadKey({ env: process.env, secretsPath: path.join(os.homedir(), '.secrets', 'typesafe.env') }); }`
- `function jev(key, body) { return client.jev(body, { key: key, guard: assertEgressCeiling, endpoint: ENDPOINT }); }` Keeps the `(key, body)` order eval-icm-writers calls.
- `const pool = client.pool;`
- Keep `ENDPOINT` and `MODEL` constants in the builder (353 code at l.559 builds bodies with `MODEL`); the client exports its own `DEFAULT_ENDPOINT`.

**Guard semantics to preserve exactly for `section_command_ledger`** (`build-section-command-ledger.cjs:90-128`): top keys `{model, state, questions}`; state keys checked ONLY when state is a non-array object; candidate keys `{name, jtbd, glossary, description}`; candidate string cap 140; `questions[qid].instructions.judge` string cap 400; returns `true`. Nothing else is checked (it does not check question keys or `criteria`, and eval-icm-writers' working-tree diff relies on `criteria` being unchecked). Write the parity corpus test BEFORE deleting the old code, then prove the extracted profile gives the same accept/throw and messages.

**Client behavior to preserve exactly** (`:134-172`): network error retry 3 times at `500 * 2 ** attempt` ms; 429/529 retry up to 4 at `400 * 2 ** attempt`; return `{status, ms, json, text: text.slice(0, 200)}` (status 0 and `json: null` after network exhaustion). Add `sleepImpl` injection so tests do not sleep. Resolve `fetchImpl` at CALL time (`opts.fetchImpl || globalThis.fetch`), never captured at module load: 353 tests replace `global.fetch` after requiring modules (`test-353-ledger-shape.cjs:45-54`).

**New rule the client adds:** `jev()` throws if `guard` is not a function. There is then no unguarded fetch path in the module (structural, D-09 "separated by construction").

**Guard error shape (D-09):** throw `Error` whose message names the key; also set `err.code = 'EGRESS_REFUSED'`, `err.profile`, `err.key`. The 353 profile keeps its historical `assertEgressCeiling:` message prefix.

**D-06 first task:** `test -f scripts/jev-devtime-client.cjs`. As of this research it does not exist, and 354-17 (wave 5) and 357 (waits for all of 354, D-15 of 357) are both later, so 356 almost certainly extracts. But 354-17's plan text (`354-17-PLAN.md:77`) says "same jev()/pool() client copied near-verbatim" and defines its own `assertEgressCeiling`; jsagi-25 has not confirmed the shared-client agreement (SPEC interview log). The plan needs a coordination task: message jsagi-25 that 354-17 should import the client and add a `framework_command_ledger` profile (their T3 expects `description` refused, which a per-profile design gives them for free).

### Pattern 2: Runtime seam (R356-05, R356-06)

**Edit exactly one pinned function, and only its last line:**

```js
// lib/core/chain-executor.cjs, beside the other lazy loaders (mirror _loadRecipeMaps at :445-453)
let _irreversibilityLedger = null;
function _loadIrreversibilityLedger() {
  if (_irreversibilityLedger !== null) return _irreversibilityLedger;
  try {
    _irreversibilityLedger = require(path.join(__dirname, 'irreversibility-ledger.cjs'));
  } catch (_e) {
    _irreversibilityLedger = false;
  }
  return _irreversibilityLedger;
}
function _ledgerForcesIrreversible(command) {
  const m = _loadIrreversibilityLedger();
  if (!m || typeof m.forcesIrreversible !== 'function') return false;
  try { return m.forcesIrreversible(command) === true; } catch (_e) { return false; }
}

function isIrreversibleStep(step) {
  if (!step || typeof step !== 'object') return false;
  if (step.irreversible === true) return true;
  const hay = String(step.command || '').toLowerCase();
  if (hay.length === 0) return false;
  for (const hint of IRREVERSIBLE_HINTS) {
    if (hay.indexOf(hint) !== -1) return true;
  }
  return _ledgerForcesIrreversible(step.command);   // Phase 356 R5: add-only, can never clear the two signals above
}
```

Why this shape:
- Add-only by construction: the ledger clause is reached only after both existing signals returned nothing, and it can only return `true` or `false` where the old code returned `false`.
- Lazy require keeps module load free of new imports (the Part 8 leak scan treats this file as a CODE_SURFACE; see the comment at `:126-129` on why lazy loaders exist). Do not name anything `*fetch*`: the leak scan's `RAW_FETCH = /[^a-zA-Z_]fetch[\s]*\(/` runs over this file's code lines (`tests/test-chain-executor-part8-leak.cjs`).
- The ledger key is the exact `step.command` (for example `/mos:publish`), the same exact-match rule `postureForCommand` uses (`recipe-maps.cjs:181-199`). Bare names like `publish` used in some tests simply do not match a ledger entry.

**Runtime reader (`lib/core/irreversibility-ledger.cjs`), pure, never throws:**

```js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_LEDGER_PATH = path.join(__dirname, '..', '..', 'data', 'command-irreversibility-ledger.json');
function _ledgerPath() {
  const o = process.env.MINDRIAN_IRREVERSIBILITY_LEDGER;          // test seam, mirrors MINDRIAN_COMMAND_REGISTRY
  return (typeof o === 'string' && o.length > 0) ? o : DEFAULT_LEDGER_PATH;
}
function _norm(v) { return typeof v === 'string' ? v : ''; }

// The ONE staleness hash. The builder imports this; Theo ports it (documented in the ledger's text_hash_basis).
function commandTextHash(command, teaching, jtbdSummary) {
  return crypto.createHash('sha256')
    .update(JSON.stringify([_norm(command), _norm(teaching), _norm(jtbdSummary)]), 'utf8')
    .digest('hex');
}

let _fresh = null;                                               // Set of commands with a FRESH flag:true entry
function _build() {
  const out = new Set();
  let ledger;
  try { ledger = JSON.parse(fs.readFileSync(_ledgerPath(), 'utf8')); } catch (_e) { return out; }
  const entries = (ledger && Array.isArray(ledger.entries)) ? ledger.entries : [];
  let resolver;
  try { resolver = require(path.join(__dirname, '..', 'workflow', 'command-resolver.cjs')); } catch (_e) { return out; }
  if (typeof resolver.commandRow !== 'function') return out;
  for (const e of entries) {
    if (!e || e.flag !== true || typeof e.command !== 'string' || typeof e.text_hash !== 'string') continue;
    const row = resolver.commandRow(e.command);
    if (!row) continue;                                          // command gone from registry: ignore
    if (commandTextHash(e.command, row.teaching, row.jtbd_summary) === e.text_hash) out.add(e.command);
  }
  return out;
}
function forcesIrreversible(command) {
  try {
    if (_fresh === null) _fresh = _build();
    return typeof command === 'string' && _fresh.has(command);
  } catch (_e) { return false; }
}
function __reset() { _fresh = null; }
module.exports = { DEFAULT_LEDGER_PATH, commandTextHash, forcesIrreversible, __reset };
```

`command-resolver.cjs` additive accessor (reuses `_load()` at `:60-77` and its `MINDRIAN_COMMAND_REGISTRY` override at `:48-51`; exports at `:250-257`; no test pins the export set, verified by grep):

```js
function commandRow(cmd) {
  if (typeof cmd !== 'string' || cmd.length === 0) return null;
  const c = _load().commands.find(function (x) { return x && x.command === cmd; });
  return c ? Object.freeze({ command: c.command, teaching: c.teaching, jtbd_summary: c.jtbd_summary }) : null;
}
```

Only flagged entries are hashed at runtime (a handful), so the per-process cost is one ledger read plus a few SHA-256s over short strings. When a test points `MINDRIAN_COMMAND_REGISTRY` at a fixture registry, every ledger hash mismatches and the ledger goes inert: the correct, safe degrade.

**Existing tests that touch this seam** (all green at HEAD except where noted): `test-chain-executor-{gate,loop,verdict,fable-mode,part8-leak}.cjs`, `test-larry-handoff-seam.cjs`, `test-bch-09-forced-material.cjs`, `test-ignite-on-runchain.cjs`, `test-201-bounded-retry.cjs`, `test-264-flagship-ralph.cjs`, `test-354-chain-resume-identity.cjs`, `test-act-on-runchain.cjs`, `test-pipeline-on-runchain.cjs`, `bash tests/run-all-166.sh` (pre-existing FAIL: `test-act-prebehavior-snapshot.cjs`, logged by 354-03 as deferred), `bash tests/run-all-264.sh` (pre-existing FAIL x2: frozen-166 passthrough, whole-file zero-diff arm, both already red). None of them sets an env override for data files except via `MINDRIAN_COMMAND_REGISTRY` (only `lib/workflow/command-resolver.test.cjs` does); they use injected `postureFn`/`gateFn` stubs and real registry slugs.

### Pattern 3: The Noul request body (R356-01, R356-07)

Verified contract (docs.typesafe.ai/primitives/noul.md, fetched 2026-09-23; spike-001 `results.json`):
- Question: `{ type: 'noul', instructions: <string | object | array>, criteria?: { true: <string>, false: <string> } }`.
- Answer: `{ type: 'noul', noul: <number 0..1> }`. No `confidence`. Values observed at two decimals (0.06, 0.93).
- Docs advice: phrase so high = yes; use `criteria` for subtle boundaries; "lower it [the threshold] when missing a true yes is expensive" (matches R4's zero-miss direction).

Proposed body under the `material_step_ledger` profile (one call per command, question id `irreversible`):

```json
{
  "model": "jev-latest",
  "state": {
    "slug": "/mos:export",
    "teaching": "When you need to share a Data Room view with someone outside the room, /mos:export packages it as a De Stijl HTML artifact. Investor-ready, no install required on their side.",
    "jtbd_summary": "Prepare for an investor / partner / customer meeting.",
    "policy": "<the exact UTF-8 text of data/jev-policies/command-irreversibility.json>"
  },
  "questions": {
    "irreversible": {
      "type": "noul",
      "instructions": {
        "question": "Under the policy in `policy`, does running the command named in `slug`, as described by `teaching` and `jtbd_summary`, take an effect the policy calls irreversible?",
        "rule": "<policy.instructions, verbatim>",
        "boundary_cases": ["<policy.boundary_cases, verbatim>"]
      },
      "criteria": { "true": "<policy.criteria.true, verbatim>", "false": "<policy.criteria.false, verbatim>" }
    }
  }
}
```

Notes:
- The policy appears twice (whole file in `state.policy` for D-08's byte-identity rule; its fields in `instructions`/`criteria` for SPEC R1 and the spike-004 lesson that a stated rule in `instructions` took agreement from 40/64 to 64/64). Cost is trivial: roughly 1.5-2k input tokens per call, 113 calls, about 200k tokens, about $0.008 at the vendor-claimed $0.042/1M (355-BRIEF l.93).
- Empty-field normalization: 4 commands have `jtbd_summary: null` (`/mos:correct-reference-now`, `/mos:ingest-methodology`, `/mos:memory-cortex-reach`, `/mos:stance`). Send `""` and hash `""` (the same `_norm`), so "the exact text that was scored" and `text_hash` agree.
- Keep instructions and criteria saying the same thing (355-AI-SPEC l.742, jaggedness #7: mismatched instructions/criteria confuse jev-1.13).

**`material_step_ledger` guard profile (refuse, never strip):**
- top keys exactly `{model, state, questions}`; `model === 'jev-latest'`.
- state must be a plain object with keys exactly `{slug, teaching, jtbd_summary, policy}` (all four required, all strings).
- `slug` matches `/^\/mos:[a-z0-9-]+$/`, cap 64. `teaching` cap 800 (measured max 535). `jtbd_summary` cap 200 (measured max 75). `policy` cap 8000 AND `=== bind.policy` (the file text bound at guard construction: `makeEgressGuard(EGRESS_PROFILES.material_step_ledger, { bind: { policy: text } })`; the frozen profile cannot hold the text, the client must stay path-free per D-07).
- `questions` has exactly one key; its keys are exactly `{type, instructions, criteria}`; `type === 'noul'`; `instructions` keys exactly `{question, rule, boundary_cases}`; `criteria` keys exactly `{true, false}`.
- Any violation throws before `fetchImpl` is called, naming the key.

### Pattern 4: Builder shape (R356-03)

`scripts/build-command-irreversibility-ledger.cjs`, mirroring the 353 dispatch (`:672-703`) with pure, exported build steps:
- `loadInputs({registryPath, policyPath, labelsPath})` reads the three files; refuses when the label command set != registry command set (R2 at build time) or when `reviewed_by`/`reviewed_at` is missing.
- `buildPayload(row, policyText, policyObj)` (Pattern 3).
- `scoreAll(rows, {key, fetchImpl, guard})` uses `client.pool(rows, 4, ...)` and `client.jev(...)`; parse `answers.irreversible` strictly (`type === 'noul'`, finite number in [0,1]); a non-200 or bad shape after the client's retries ABORTS the build (no nulls shipped; R3 says every entry carries all four fields).
- `computeThreshold(scored, labels)` (Pattern 6).
- `assembleLedger(...)`, `serializeLedger` (stable command order, trailing newline, 353 convention `:410-415`).
- Modes: default live (key required; exit 3 with no key, never print the key, as 353 `:510-515`); `--jev-fixture <path>` builds through a FAKE `fetchImpl` that answers from a recorded fixture keyed by command, so the guard, the serialized body and response parsing all run; `--out <path>` so tests never overwrite `data/`; `--check` (Pattern 7); `--label-sheet <out>` (Pattern 5).

Recommended ledger shape (SPEC R3 fields plus provenance for `--check` and Theo):

```json
{
  "schema": "command-irreversibility-ledger/v1",
  "built_at": "2026-09-2xT..Z",
  "build_mode": "jev-live",
  "jev_model": "jev-1.13.0",
  "policy_hash": "<sha256 hex of policy file bytes>",
  "answer_key_hash": "<sha256 hex of label file bytes>",
  "registry_hash": "<sha256 hex of data/command-registry.json bytes at build>",
  "text_hash_basis": "sha256 hex of UTF-8 JSON.stringify([command, teaching, jtbd_summary]), non-string -> \"\"",
  "threshold": 0.41,
  "false_alarm_count": 3,
  "false_alarms": ["/mos:..."],
  "labeled_irreversible": 9,
  "jev_calls": 113, "input_tokens": 0, "output_tokens": 0, "estimated_cost_usd": 0, "cost_basis": "vendor-claimed rate, unverified",
  "entries": [ { "command": "/mos:publish", "p_irreversible": 0.97, "flag": true, "text_hash": "1a60c8e0..." } ]
}
```

`build_mode` values: `jev-live` and `jev-fixture` (distinct, unlike 353 which stamps both `jev-scored`), so a shipped fixture build is detectable. Do NOT copy 353's `plugin_version` check from `--check` (`:634-638`): it turns every version bump into a check failure, which contradicts R6's "never a release blocker". Example hash, computed locally: `/mos:publish` -> `1a60c8e0c009e9cce1586bc1f2f0e6aba64400d01ed8ec536cb2510521d84a5e`; all 113 hashes are distinct; current registry file hash `43d13474f8028fb9a2cc589388a9aa2a2ef90cf5a7bb55fee10eb203c850f9f8`. Use bare 64-char lowercase hex for all three hashes, matching the `registryHash` convention Theo already stores (`scripts/release-lib/theo-notify-gate.sh:123-167`, `docs/THEO-NOTIFY-CONTRACT.md` WD-349-4).

### Pattern 5: Hybrid answer-key workflow (R356-02, D-04, D-05)

Measured subset (registry at HEAD): 65 commands not `autonomous_safe`; the keyword list matches only `/mos:publish` (already in the 65); the D-04 verb regex over teaching + jtbd_summary matches 7 (`/mos:export`, `/mos:mullins`, `/mos:mva-brief`, `/mos:publish`, `/mos:query`, `/mos:snapshot`, `/mos:vault`), of which only `/mos:mullins` is safe-tagged, and it is a false hit ("the most rigorous opportunity screen ever published"). So the blind subset is 66 plus any safe-tagged command Claude pre-labels irreversible; the review-only remainder is about 47 safe-tagged commands. The 30-35 minute estimate is plausible at 20-30 seconds per blind row, but tight.

Order of operations (the ordering is the point):
1. **Claude pre-labels all 113** into a sealed phase-dir file (`356-CLAUDE-PRELABELS.json`, `git add -f`, committed). Not shown to the navigator.
2. **Picker** (`--label-sheet`, zero network, reads the registry plus the sealed pre-label file only) writes `356-BLIND-LABEL-SHEET.md`: one row per subset command with slug, teaching, jtbd_summary, and blank `irreversible (y/n)` and `reason` cells. Show only the SPEC R1 definition sentence as the rubric. Do NOT show `autonomous_safe` (the tag under audit would anchor the label) and do NOT show the policy's boundary cases (they ARE Claude's labels for exactly the riskiest commands, D-02; see Pitfall 4).
3. **HUMAN CHECKPOINT (blocking, `checkpoint:human-action`):** the navigator fills the sheet (or answers in chat and the executor transcribes verbatim). Commit the filled sheet immediately (`git add -f`, explicit path). Its commit time is the evidence it predates any Jev call.
4. **HUMAN CHECKPOINT (`checkpoint:decision`):** Claude's policy draft (D-02) is shown now; the navigator edits and locks the wording.
5. **HUMAN CHECKPOINT (`checkpoint:human-verify`):** reveal Claude's pre-labels for the remaining ~47; the navigator confirms or corrects row by row (ask for an explicit per-row answer, not a bulk accept: this remainder IS the exposure set SPEC Background names).
6. Merge into the answer key and commit it before any live build. Compute the blind-vs-Claude disagreement rate on the blind subset only (the only rows where both exist independently).

Label file (D-05 header plus two additive fields):

```json
{
  "schema": "jev-answer-key/v1",
  "labels_for": "data/command-registry.json",
  "registry_hash": "<64-hex sha256 of the registry bytes labeled against>",
  "reviewed_by": "navigator",
  "reviewed_at": "2026-09-2x",
  "method": "hybrid: navigator-blind risk subset (D-04 rule) + claude-prelabel review of the remainder",
  "blind_subset_size": 66,
  "blind_sheet_ref": ".planning/phases/356-.../356-BLIND-LABEL-SHEET.md@<commit>",
  "rows": [
    { "command": "/mos:publish", "irreversible": true, "reason": "deploys the presentation to Vercel, a public third-party URL", "label_source": "navigator-blind" }
  ]
}
```

Location: `data/jev-labels/command-irreversibility.json` (discretion). Keep it out of `data/jev-policies/` so D-01's "one file per ledger" holds there, and inside `data/` so Theo's tag pin can read it (D-13). Label the ground truth on what the command actually DOES (the navigator may open `commands/*.md`); Jev sees only the blurb, so a label/verdict disagreement is exactly D-10's safety-net signal.

### Pattern 6: Zero-miss threshold math (R356-04)

Definitions: P = rows labeled `irreversible: true`, N = rows labeled `false`, p = stored raw Noul value.
- `T = min over P of p`. This is the highest T with recall 1.0: any T above it misses the row that set the minimum.
- `flag = p >= T` for every row. `false_alarm_count = |{n in N : p_n >= T}|`.
- **Ties:** reversible rows with p exactly T are flagged and counted (`>=`). Two-decimal values make this common; never compute `T - epsilon` or re-round. Store p exactly as returned so a recount from the ledger is exact.
- **All p equal:** T equals that value, every row flags, which trips the degenerate rule below.
- **Fail loud (throw, write nothing, non-zero exit)** when: any row lacks a finite p in [0,1] (failed call); any row's `irreversible` is not boolean; P is empty (nothing to calibrate against; `/mos:publish` alone makes this a data defect); T <= 0 (a labeled-true row scored 0: the classifier says "definitely not" about a command the human says is irreversible); every command flags (a threshold that halts everything carries no information).
- **Interpretation to confirm:** mathematically T = 0 always achieves zero misses, so SPEC's "if no T achieves zero misses, fail" is vacuous unless "degenerate" thresholds are excluded. The two degenerate rules above are how this research makes the acceptance test meaningful ([ASSUMED], Assumption A1).
- Report (phase dir, not shipped): T, the false-alarm list, margin (highest reversible p below T), per-row Jev-vs-label disagreements, and which false alarms land on commands existing chain suites run as autonomous_safe (Pitfall 3).

```js
function computeThreshold(rows) {                 // rows: [{command, p, irreversible}]
  for (const r of rows) {
    if (typeof r.irreversible !== 'boolean') throw new Error('threshold: unlabeled row ' + r.command);
    if (typeof r.p !== 'number' || !Number.isFinite(r.p) || r.p < 0 || r.p > 1) throw new Error('threshold: unscored row ' + r.command);
  }
  const pos = rows.filter((r) => r.irreversible);
  if (pos.length === 0) throw new Error('threshold: answer key has zero irreversible labels');
  const T = Math.min.apply(null, pos.map((r) => r.p));
  const culprits = pos.filter((r) => r.p === T).map((r) => r.command);
  if (!(T > 0)) throw new Error('threshold: labeled-irreversible scored 0 (' + culprits.join(', ') + '); no non-degenerate threshold reaches zero misses');
  if (rows.every((r) => r.p >= T)) throw new Error('threshold: degenerate, T=' + T + ' flags every command');
  const falseAlarms = rows.filter((r) => !r.irreversible && r.p >= T).map((r) => r.command).sort();
  const below = rows.filter((r) => !r.irreversible && r.p < T).map((r) => r.p);
  return { threshold: T, false_alarm_count: falseAlarms.length, false_alarms: falseAlarms,
           margin: below.length ? T - Math.max.apply(null, below) : null, set_by: culprits };
}
```

### Pattern 7: `--check` (R356-06)

- Reads the ledger, registry, policy and labels (paths overridable by `MINDRIAN_IRREVERSIBILITY_LEDGER` and `MINDRIAN_COMMAND_REGISTRY` so tests use temp copies). Never loads the key, never requires anything that calls `fetch`.
- Prints one `WARN` line each for: ledger missing or unparseable; each STALE entry (hash mismatch against current registry text); each UNSCORED command (in registry, not in ledger); each ledger entry whose command left the registry; `policy_hash` drift; `answer_key_hash` drift; label set != registry set; any entry whose `flag !== (p_irreversible >= threshold)`; a recomputed `false_alarm_count` that differs.
- Always exits 0 (R6). Ends with an `OK`/`WARN n` summary line.
- Zero-network proof in tests: in-process with `global.fetch` replaced by a counting thrower, and a spawned run with `NODE_OPTIONS=--require <thrower-preload>`.
- Do not wire into `scripts/release.sh`: `tests/test-353-release-wiring.cjs` counts `--check` call sites for the 353 builder only, and the release script is not part of this SPEC. Optional later: a doctor WARN.

### Anti-Patterns to Avoid
- **Copying the client into the 356 builder** (R8 violation; 354-17's current plan does this).
- **A merged egress union** (D-08; would silently widen 353's caps).
- **Stripping disallowed keys** instead of throwing (D-09).
- **Re-rounding p or using `T - epsilon`** (breaks the exact recount).
- **Fixture mode that bypasses `jev()`** (353's `buildWithJevFixture` reads rows straight from the fixture, `:455-505`, so no payload is ever built; that cannot prove R1 or R7).
- **Editing `makeGateFn` or `_isMaterialStep`** (both hash-pinned; not needed).
- **Reading the ledger per call** (SPEC: one cached read).
- **Hard-coding 113** anywhere in tests (enumerate from the registry at run time; the count will grow).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vendor fetch, retry, pool, key load | A second client | `scripts/jev-devtime-client.cjs` (extracted from 353 l.70-172) | R8; one retry policy measured in spikes |
| Registry parsing and caching at runtime | A second loader | `command-resolver.cjs` `_load()` via an additive `commandRow` | Single registry authority, existing env override and `__reset` |
| Hashing | Custom digest | `node:crypto` SHA-256 hex | Matches Theo's `registryHash` convention |
| Egress refusal | Ad-hoc key checks in the builder | `makeEgressGuard(EGRESS_PROFILES.material_step_ledger, {bind})` | D-08/D-09 shape Theo can port |
| Answer-key rubric | A new rubric doc | SPEC R1 definition sentence for blind labeling; policy file after | Keeps the blind labels uncontaminated |

**Key insight:** every piece of machinery this phase needs already exists once in the repo; the work is moving it to one shared place and adding a data file, not inventing mechanism.

## Common Pitfalls

### Pitfall 1: The B3 frozen pin reddens on any edit to `isIrreversibleStep`
**What goes wrong:** `tests/test-264-b3-frozen.cjs:106-113` pins the SHA-256 of six function bodies, `isIrreversibleStep` at l.108 (`037f9515...`). Any byte change fails it.
**Why:** Phase 264 froze the gate/stop surface on purpose.
**How to avoid:** change ONLY `isIrreversibleStep`'s final `return false;` to the ledger call, put the helper outside the pinned body, then update exactly one literal in `PINNED_HASHES` with a comment naming Phase 356 R5 and the reason, and update the test header note. Leave the other five pins alone. Tell the navigator this is the first re-pin of a Canon Part 3 surface.
**Warning signs:** `node tests/test-264-b3-frozen.cjs` shows any pin other than `isIrreversibleStep` changing.

### Pitfall 2: The key is live in this shell
**What goes wrong:** `TYPESAFE_API_KEY` is set in the environment (verified: present, value not read) and `~/.secrets/typesafe.env` exists (mode 600). A fixture-path bug makes a real, billable, unlogged vendor call from a test.
**How to avoid:** every 356 test starts with `delete process.env.TYPESAFE_API_KEY` and `global.fetch = () => { throw new Error('no network in 356 tests'); }`; spawned builders get an env without the key and `HOME` pointed at a temp dir. Assert the fetch counter is 0.

### Pitfall 3: Ledger false alarms break existing green suites
**What goes wrong:** the shipped ledger is live in every test process. `tests/test-larry-handoff-seam.cjs:69-75` runs `/mos:find-analogies` and `/mos:find-connections` through the default gate as autonomous_safe; other chain suites do the same with `/mos:explore-domains`, `/mos:analyze-needs`, `/mos:think-hats`, `/mos:lean-canvas`, `/mos:scenario-plan`, `/mos:find-bottlenecks`, `/mos:diagnose`, `/mos:grade`. If the zero-miss threshold flags one (a false alarm, which SPEC allows), that suite goes red and Larry's real chains start halting there.
**How to avoid:** after the live build, run every chain suite with the shipped ledger present, and have the builder report list false alarms that intersect those commands. The navigator decides (label correction, a policy boundary case, or accept and adjust). This is a real product cost, not just a test issue.

### Pitfall 4: The policy draft leaks Claude's labels into the "blind" pass
**What goes wrong:** D-02 has Claude write boundary cases naming `/mos:export`, `/mos:snapshot`, `/mos:vault`, `/mos:present` (reversible) and `/mos:publish` (irreversible). Those are the riskiest commands in the blind subset. If the navigator reads the draft first, those labels are no longer blind, and the disagreement rate (D-05) is biased low.
**How to avoid:** blind labeling first, with only the SPEC R1 definition sentence; policy review after.

### Pitfall 5: `test-353-ledger-shape.cjs` is already red, and it is not 356's to fix
**What goes wrong:** working-tree baseline is `PASS=13 FAIL=6`; the 6 are the shipped-ledger legs of an unowned uncommitted diff expecting a jev-scored 353 ledger. R8's "353 builder still passes its own tests" can be misread as "make it green".
**How to avoid:** record the baseline before extraction; after extraction assert the same 13 legs pass and the same 6 fail. Never edit, stash or revert that file (D-11). `test-353-grader-agreement.cjs` (30/30), `test-353-tripwires.cjs` (5/5) and `test-353-release-wiring.cjs` (8/8) are green and must stay so.

### Pitfall 6: A live-registry equality test becomes a standing red
**What goes wrong:** SPEC R2 wants the label set to equal the registry set, "checked by a test". The registry is regenerated whenever a command is added, so a naive test reds the 356 suite on every new command.
**How to avoid:** the hard gate is at BUILD time (builder refuses mismatched sets). The test asserts labels == ledger entries == registry-at-build (via `registry_hash`), and also compares against the live registry, failing with a precise diff. Name it plainly in the test output: a new command needs a label before the next rebuild. Phase suites are not in `scripts/verify-release`, so this never blocks a release; `--check` carries the same signal as WARN.

### Pitfall 7: Noul `criteria` is an object, D-01 says `criteria[]`
**What goes wrong:** the Noul API takes `criteria: { true, false }` (VERIFIED, docs). D-01 (and 357's D-12, "the 356 shape") wrote `criteria[]`. Putting an array in the Noul question is out of contract and may return 400 (the service returns 400, not 422, on malformed questions; spike 001).
**How to avoid:** store `criteria` in the policy file as `{ "true": "...", "false": "..." }` so it passes verbatim, and tell jsagi-e0 the shape before 357 authors its policy (Open Question 1).

### Pitfall 8: Line numbers moved under you
354-03 landed during this research (`ae595b101`, `574c4b285`): the second halt-reason caller moved from l.1411 to l.1538, and exports from ~l.1658 to l.1810. Plans should anchor on function names and grep, not line numbers.

### Pitfall 9: Reusing 353's fixture shortcut
353's `--jev-fixture` never builds a payload, so it cannot prove the egress guard or the policy byte-identity. 356's fixture mode must drive `client.jev` with a fake `fetchImpl` that captures `init.body`.

### Pitfall 10: New phase-dir files are silently not committed
`.planning/*` is ignored; the blind sheet, pre-labels and report need `git add -f` by explicit path. Without the commit, the "predates the build" evidence does not exist.

### Pitfall 11: Two-decimal rounding and run-to-run noise
Nouls come back at two decimals and carry sampling noise (355-AI-SPEC l.412: two of eight Nouls noisy in the vendor cookbook). A single low draw on one irreversible command drags T down and raises false alarms; a rebuild can move T. SPEC locks one Noul per command, so do not add repeats; record the margin and the command that set T, and treat a rebuild with a different T as expected, not a defect.

## Code Examples

Client skeleton (pure, D-07; no `lib/` requires, no repo paths):

```js
// scripts/jev-devtime-client.cjs
'use strict';
const fs = require('node:fs');
const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

function loadKey(opts) {
  const o = opts || {};
  const env = o.env || {};
  if (env.TYPESAFE_API_KEY) return env.TYPESAFE_API_KEY;
  if (!o.secretsPath) return null;
  try {
    const m = fs.readFileSync(o.secretsPath, 'utf8').match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_e) { /* fall through */ }
  return null;                                   // never logged, never thrown with the value
}

async function jev(body, opts) {
  const o = opts || {};
  if (typeof o.guard !== 'function') throw new Error('jev: a guard is required (no unguarded egress)');
  o.guard(body);                                 // throws before any network
  const doFetch = o.fetchImpl || globalThis.fetch;   // resolved at call time
  const sleep = o.sleepImpl || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const endpoint = o.endpoint || DEFAULT_ENDPOINT;
  let attempt = 0;
  for (;;) {
    const t0 = Date.now();
    let r;
    try {
      r = await doFetch(endpoint, { method: 'POST',
        headers: { Authorization: 'Bearer ' + o.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body) });
    } catch (_e) {
      if (attempt++ < 3) { await sleep(500 * 2 ** attempt); continue; }
      return { status: 0, ms: Date.now() - t0, json: null };
    }
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (_e) { /* leave null */ }
    if ((r.status === 429 || r.status === 529) && attempt++ < 4) { await sleep(400 * 2 ** attempt); continue; }
    return { status: r.status, ms: ms, json: json, text: text.slice(0, 200) };
  }
}
// pool: verbatim from build-section-command-ledger.cjs:161-172
// makeEgressGuard(profile, {bind}) -> function guard(payload) { ...; return true; }
// EGRESS_PROFILES = Object.freeze({ section_command_ledger: {...353 exact...}, material_step_ledger: {...} })
module.exports = { DEFAULT_ENDPOINT, loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES };
```

Fixture fetch that captures the outgoing body (for the R1/R7 tests):

```js
const sent = [];
const fixture = require('./fixtures/356-jev-noul-responses.json');   // { model, p: { "/mos:publish": 0.97, ... } }
async function fakeFetch(_url, init) {
  const body = JSON.parse(init.body);
  sent.push(body);
  const p = fixture.p[body.state.slug];
  return { status: 200, text: async () => JSON.stringify({ model: fixture.model,
    answers: { irreversible: { type: 'noul', noul: p } }, usage: { input_tokens: 1500, output_tokens: 5 } }) };
}
// assert: sent.every(b => b.state.policy === fs.readFileSync(POLICY_PATH, 'utf8'))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 7-keyword substring over the slug (`chain-executor.cjs:536-555`), matches 1 of 113 | keyword OR flag OR fresh dev-time ledger entry | this phase | catches safe-tagged commands whose blurb names an external effect |
| Client and guard inlined in the 353 builder | `scripts/jev-devtime-client.cjs` with per-builder profiles | this phase (first of 354-17/356/357 to run) | one retry policy, per-profile refusal |
| Noul treated like Choice with a confidence (spike 004's 0.90) | Noul probability only; threshold tuned on this key | 355-BRIEF, docs 2026-09-23 | nothing borrowed from 004 |

**Deprecated/outdated:** SPEC and CONTEXT cite `recipe-maps.cjs:172-181` for `postureForCommand`; it is now at l.181-199. CONTEXT cites caller `:1411`; it is now `:1538`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Fail loud when no T achieves zero misses" means excluding degenerate thresholds (T <= 0, or every command flagged), since T = 0 always has zero misses | Pattern 6 | If the navigator wants a different rule (for example a false-alarm cap), the fail test and builder change; low effort |
| A2 | Policy `criteria` should be the Noul-native `{true, false}` object rather than D-01's `criteria[]` | Pattern 3, Pitfall 7 | If an array is kept, the builder must map it, and "verbatim" becomes "derived"; 357 inherits the choice |
| A3 | Hide `autonomous_safe` and the policy's boundary cases from the blind sheet | Pattern 5 | If shown, blind labels anchor on the audited tag; the disagreement metric under-reads bias |
| A4 | Answer key at `data/jev-labels/command-irreversibility.json`, reviewer recorded as the handle `navigator` | Pattern 5 | Pure naming; `data/` ships in npm so a personal name would ship |
| A5 | The navigator (or an explicit navigator go-ahead) runs the live build, as 353 did | Validation | If the executor runs it unasked, a vendor call happens without consent |
| A6 | An additive `commandRow` export on `command-resolver.cjs` is acceptable to that module's owners | Pattern 2 | Fallback: the ledger module reads the registry itself (honoring `MINDRIAN_COMMAND_REGISTRY`), costing a second JSON parse |
| A7 | Egress caps teaching 800 / jtbd_summary 200 / slug 64 / policy 8000 | Pattern 3 | A longer future blurb makes the build throw (refuse, don't strip); raise the cap deliberately |

## Open Questions

1. **Policy `criteria` shape.** What we know: Noul takes `{true, false}`; D-01 and 357 D-12 say `criteria[]`. Recommendation: object in the file, confirm with the navigator at the policy-lock checkpoint, message jsagi-e0.
2. **Degenerate-threshold rule (A1).** Recommendation: adopt the two rules in Pattern 6 and state them in the policy-lock checkpoint.
3. **Who owns the uncommitted diffs** in `eval-icm-writers.cjs`, `test-353-grader-agreement.cjs`, `test-353-ledger-shape.cjs`? Git cannot say (no commits yet). The extraction does not touch them, but D-06/D-11 require messaging the owner before editing the 353 builder they depend on. Recommendation: first execute task lists peers and messages them; proceed only on the builder file, which is clean.
4. **354-17 copy-vs-import.** Its plan copies the client. Recommendation: message jsagi-25 with the client path and the `framework_command_ledger` profile slot; do not edit 354's plan.
5. **Should `--check` join `doctor --acceptance`?** Not required by SPEC; recommend deferring.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (>= 22.16 floor) | - |
| native fetch | dev-time client | yes | Node 22 global | - |
| TypeSafe key | live build only | yes (`~/.secrets/typesafe.env` mode 600; also exported in shell env) | - | fixture mode for all tests |
| git | predates evidence, explicit-path commits | yes | - | - |
| Theo | not needed (no Theo pull in this builder) | - | - | - |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain Node harness scripts (`check()` counters, exit 1 on failure, exit 77 = ENV GAP), the repo convention |
| Config file | none; aggregator `tests/run-all-356.sh` (Wave 0) modeled on `tests/run-all-354.sh` (run / run_if guarded legs) |
| Quick run command | `node tests/test-356-runtime.cjs && node tests/test-356-ledger-build.cjs` |
| Full suite command | `bash tests/run-all-356.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R356-01 | policy file exists, fields present, D-03 sentence present, no em-dash; outgoing payload `state.policy` byte-identical to file; `instructions.rule`/`criteria` equal the file fields; ledger `policy_hash` = sha256(file bytes) | unit (fixture, fake fetch) | `node tests/test-356-policy.cjs` | no, Wave 0 |
| R356-02 | label rows set == registry set (live and at build); header has reviewer + date; every row has reason and valid label_source; builder refuses mismatched sets | unit | `node tests/test-356-answer-key.cjs` | no, Wave 0 |
| R356-02 | blind sheet commit time < ledger `built_at` | git check | same file, exit 77 if the sheet is absent | no |
| R356-03 | fixture build: one entry per registry command, four fields each, top-level fields present, `build_mode` 'jev-fixture'; shipped ledger `build_mode` 'jev-live' | unit + shipped-file legs | `node tests/test-356-ledger-build.cjs` | no |
| R356-04 | `computeThreshold` cases: normal, ties counted, all-equal fails, true with p = 0 fails, zero positives fails, missing p fails; shipped ledger recall 1.0 and recount of `false_alarm_count`; failed build writes nothing | unit + shipped legs | same file | no |
| R356-05 (a) | a synthetic ledger with a fresh `flag: true` on `/mos:find-analogies` (autonomous_safe) makes default-gate `runChain` halt with `haltedAt.reason === 'forced_material'` | integration | `node tests/test-356-runtime.cjs` | no |
| R356-05 (b) | `/mos:publish` with `flag: false` still halts `forced_material` | integration | same | no |
| R356-05 (c) | ledger absent (env points to a missing path): `isIrreversibleStep` equals the pre-356 predicate over every registry command; malformed JSON degrades; existing chain suites green | integration + suite rerun | `MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent bash tests/run-all-166.sh` plus the named chain tests (compare to the recorded baseline) | existing |
| R356-05 (d) | no non-comment `lib/` or `hooks/` line matches `api\.typesafe\.ai|TYPESAFE_API_KEY|jev-devtime-client|build-command-irreversibility-ledger`, with a negative control | tripwire | `node tests/test-356-tripwires.cjs && node tests/test-353-tripwires.cjs` | no / yes |
| R356-05 | one ledger read per process (spy on `fs.readFileSync` for the ledger path across many calls), zero fetch | unit | `node tests/test-356-runtime.cjs` | no |
| R356-06 | edited teaching in a temp registry: runtime ignores the entry; `--check` prints STALE; added command: `--check` prints UNSCORED; exit 0; zero network (in-process thrower and spawned preload) | integration | `node tests/test-356-check.cjs` | no |
| R356-07 | guard throws on `room_path` in state, extra question key, policy mismatch, over-cap teaching, before `fetchImpl` is called (counter 0), message names the key; no key material in `data/` (sentinel key through fixture mode, and the real key if loadable, compared silently) | unit | `node tests/test-356-egress.cjs` | no |
| R356-08 | client exports the D-07 interface; `section_command_ledger` parity corpus identical to the pre-extraction guard; 353 builder exports still functions with the old `jev(key, body)` order; neither builder contains `fetch(` or a local guard definition; 353 tests keep their baseline | unit + suite | `node tests/test-356-jev-client.cjs && node tests/test-353-grader-agreement.cjs && node tests/test-353-ledger-shape.cjs` (expect the recorded 13/6 baseline) | no |
| D-12 | larry-extended "## Post-Gate Handoff" section still says runChain halts at the first material step; nothing in larry-extended or the larry-personality SKILL redefines material as irreversible; `test-larry-handoff-seam.cjs` passes with the shipped ledger | doc scan + suite | `node tests/test-356-larry-contract.cjs && node tests/test-larry-handoff-seam.cjs` | no / yes |
| Pin | `test-264-b3-frozen.cjs` passes after the documented one-hash re-pin; the other five pins unchanged | suite | `node tests/test-264-b3-frozen.cjs` | yes |

Human-checkpoint criteria (not automatable): the navigator's blind labels; policy wording lock; pre-label review; authorizing and running the live build; ruling on false alarms that hit commands chains run as autonomous_safe.

### Sampling Rate
- **Per task commit:** the quick command plus the specific test for the touched file.
- **Per wave merge:** `bash tests/run-all-356.sh` plus `node tests/test-264-b3-frozen.cjs` and the chain suites listed in Pattern 2.
- **Phase gate:** full 356 suite green; chain suites at their recorded baseline both WITH the shipped ledger and with `MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent`; 353 tests at baseline.

### Wave 0 Gaps
- [ ] `tests/run-all-356.sh` (guarded run_if legs, em-dash guard over new files)
- [ ] `tests/fixtures/356-jev-noul-responses.json` (synthetic p per command for fixture builds; not the real answer key)
- [ ] `tests/fixtures/356-ledger-*.json` synthetic ledgers (fresh flag, stale, malformed) built in-test from real registry text via `commandTextHash`
- [ ] Record baselines before any edit: `test-353-ledger-shape` 13/6, `run-all-166` (act-prebehavior-snapshot red), `run-all-264` (2 red arms)
- [ ] `tests/test-356-{jev-client,policy,answer-key,ledger-build,runtime,check,egress,tripwires,larry-contract}.cjs`

### Suggested plan and wave shape (for the planner)
- **Wave 1 (parallel):** (a) client extraction plus parity test plus tripwire leg (coordination messages first); (b) runtime seam plus resolver accessor plus 264 re-pin plus runtime tests on synthetic ledgers; (c) Claude pre-labels (sealed) plus `--label-sheet` picker.
- **Checkpoint A (human-action, blocking):** navigator blind labels; commit the sheet.
- **Wave 2:** policy draft -> **Checkpoint B (decision):** policy lock (incl. Open Questions 1-2); pre-label reveal -> **Checkpoint C (human-verify):** row-by-row review; commit the answer key. In parallel: builder in fixture mode, threshold math, `--check`, egress profile tests.
- **Wave 3:** **Checkpoint D (human-action):** navigator-run live build -> commit ledger -> shipped-ledger legs -> all chain suites with the ledger present -> **Checkpoint E (human-verify):** false-alarm ruling.
- **Wave 4:** `data/ROOM.md` rows, the D-12 larry re-read, research-trail filing, SUMMARY with measured numbers, messages to jsagi-25/-d9/-e0.

## Cross-Session Coordination (navigator directive D-11..D-13)

| Session | Phase | File-level overlap with 356 | Risk | Action |
|---------|-------|------------------------------|------|--------|
| jsagi-25 | 354 | `lib/core/chain-executor.cjs` (354-03, LANDED as `ae595b101`, touched `_runChainResilient` at l.1293-1640; no pinned function) | low now; re-read file before editing | anchor edits by function name |
| jsagi-25 | 354-17 (wave 5) | builds `scripts/build-framework-command-ledger.cjs` by COPYING the client (`354-17-PLAN.md:77-78`) | medium: second client | message: import `scripts/jev-devtime-client.cjs`, add `framework_command_ledger` profile |
| jsagi-25 | 354-15 (wave 6) | `agents/larry-extended.md` l.190-205 (upload path prose) | none (356 does not edit larry-extended) | - |
| jsagi-d9 | 355 | 355-SPEC R5 plans a dev-time Choice script "the 354-17 / build-section-command-ledger pattern" (`355-SPEC.md:51`); has an uncommitted `355-INTENT.md` diff | low | tell jsagi-d9 the shared client exists; never touch 355 files |
| jsagi-e0 | 357 | will import the client and add `card_fire_replay` profile (357 D-10); edits the same leg-2 regex in `tests/test-353-tripwires.cjs` (357 D-11); authors `data/jev-policies/card-fire-replay.json` "in the 356 shape" (357 D-12); edits larry-extended "## Decision Gates" section (l.84-91), leaves "## Post-Gate Handoff" (l.70-82) verbatim (357 D-16) | medium on the tripwire line and policy shape | 356 rewrites leg 2's regex as a named list constant so 357 appends one entry; send the criteria-shape decision before 357 writes its policy; flag D-12 consistency |
| unknown | 353 follow-up | uncommitted diffs in `scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs` | high if touched | never edit/stash/revert; re-exports make edits unnecessary; message before editing the 353 builder |

**Larry contract:** `agents/larry-extended.md` "## Post-Gate Handoff" (l.70-82) says runChain "halts at the FIRST material (non-autonomous_safe) step". After 356, a ledger-flagged autonomous_safe step also halts, as `forced_material`. The direction is consistent (more halts, never fewer), and the same was already true for explicit `irreversible: true` steps, so D-12's "holds unchanged" is right and the file is NOT edited. The parenthetical "(non-autonomous_safe)" was already a simplification; record that observation in the SUMMARY and send it to jsagi-e0 rather than editing the section.

**Theo (D-13):** every artifact is plain JSON or a pure function. Theo can rebuild the ledger from `data/command-registry.json`, `data/jev-policies/command-irreversibility.json`, `data/jev-labels/command-irreversibility.json` and the documented `text_hash_basis`, holding its own key, with the client ported one-to-one (error names the refused key). State in the SUMMARY that no Theo code changes, and that `release.sh` Step 5.6 already notifies Theo on release (`docs/THEO-NOTIFY-CONTRACT.md`).

## Dev-Research Compositing

Convention (from the 2026-09-23 entries): a single dated markdown file at `~/MindrianRooms/rethinking-mindrianos/research/2026-09-2X-<slug>.md` with frontmatter `methodology: research`, `title`, `created`, `status: active`, `room_section: research`, `informs: "dev/MindrianOS-Plugin Phase 356 (356-SPEC.md, 356-CONTEXT.md, 356-RESEARCH.md)"`, `related:` (the 2026-09-17 Jev spikes entry and 2026-09-23 larry-extended-x-jev entry), `sources:`. `~/MindrianRooms` lives in the home git repo (toplevel `/home/jsagi`); commits there use the message form `rethinking-mindrianos: file <topic> research trail (Phase 356)`, explicit path only. The source-of-record mirror is `~/MindrianRooms/mindrianOS/research/` (the 2026-09-17 Jev entries are mirrored there). Suggested slug: `2026-09-2X-chain-executor-irreversibility-ledger-356.md`, carrying the measured baseline (1 of 113 keyword hits, 66-command blind subset, the threshold, false alarms, blind-vs-Claude disagreement rate) and cross-linking back to this RESEARCH.md. That filing belongs in a late plan task, after the live build produces numbers.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no user auth) | - |
| V3 Session Management | no | - |
| V4 Access Control | no | - |
| V5 Input Validation | yes | per-profile allow-list egress guard, refuse-don't-strip; strict Noul answer parsing |
| V6 Cryptography | yes (integrity hashes only) | `node:crypto` SHA-256; never hand-rolled |
| V8 Data Protection | yes | Canon Part 8: only plugin-authored registry text and policy cross; key never printed, logged or written |
| V14 Configuration | yes | key only from env or `~/.secrets/typesafe.env`; tripwires keep vendor code out of `lib/` and `hooks/` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Room or user bytes leaking to TypeSafe | Information disclosure | guard throws on any key outside `{slug, teaching, jtbd_summary, policy}`; test injects `room_path` |
| Key printed or committed | Information disclosure | loadKey returns only; tests grep `data/` for a sentinel and the real key (silently) |
| Tampered local ledger clearing a halt | Tampering | add-only: the ledger can never override the keyword or explicit flag; it can only remove halts it added itself (same trust level as editing the local registry) |
| Stale verdict applied to a changed command | Tampering / integrity | per-entry `text_hash`; mismatch ignored at runtime, WARN in `--check` |
| Vendor code reaching a user's turn loop | Elevation / availability | tripwires over `lib/` and `hooks/`; lazy pure reader with no network |
| npm tarball ships `scripts/jev-devtime-client.cjs` with the endpoint literal | Information disclosure (minor) | no key in the file; same exposure the 353 builder already has today (`package.json` `files` includes `scripts`) |

## Sources

### Primary (HIGH confidence)
- Codebase at HEAD `574c4b285` (read directly): `lib/core/chain-executor.cjs` l.86-137, 440-610, 770-800, 1060-1095, 1530-1545, 1810; `scripts/build-section-command-ledger.cjs` (whole file); `scripts/eval-icm-writers.cjs` l.470-530, 706 and its working-tree diff; `tests/test-353-*.cjs`; `tests/test-264-b3-frozen.cjs`; `tests/test-larry-handoff-seam.cjs`; `tests/test-chain-executor-part8-leak.cjs`; `lib/core/recipe-maps.cjs`; `lib/workflow/command-resolver.cjs`; `agents/larry-extended.md`; `data/command-registry.json` (measured); `package.json` `files`; `scripts/release-lib/theo-notify-gate.sh`.
- Test baselines run in this session: 353 ledger-shape 13/6, grader-agreement 30/0, tripwires 5/0, release-wiring 8/0; chain suites green; run-all-166 one pre-existing fail; run-all-264 two pre-existing fails; 264 frozen pin 29/29.
- https://docs.typesafe.ai/primitives/noul.md (fetched 2026-09-23): request fields, `criteria {true, false}`, answer `{type, noul}`, threshold-by-cost-asymmetry advice.
- `.planning/spikes/001-jev-liveness-cost/results.json`: recorded Noul answer `{"type":"noul","noul":0.06}`, model `jev-1.13.0`.
- `.claude/skills/spike-findings-MindrianOS-Plugin/` SKILL.md and references (contract, retry, 400-not-422, stated-policy parity 64/64 vs 40/64).

### Secondary (MEDIUM confidence)
- `355-BRIEF.md` l.88-104 and `355-AI-SPEC.md` l.192, 387, 395, 411-412, 742 (Jev docs digest by jsagi-d9, 2026-09-23).
- `354-03-PLAN.md`, `354-15-PLAN.md`, `354-17-PLAN.md`, `357-CONTEXT.md` (other sessions' plans, read-only).
- `docs/THEO-NOTIFY-CONTRACT.md`, Theo `03-MOS-LEARNING.md`, Theo pin ledger.

### Tertiary (LOW confidence)
- None used for a recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (built-ins only, all verified in code).
- Architecture: HIGH (every seam and consumer read at file:line; the one surprise, the 264 pin, verified by running it).
- Pitfalls: HIGH for code and test interactions; MEDIUM for the labeling-workflow judgments (A3) and threshold edge policy (A1).

**Research date:** 2026-09-23
**Valid until:** about 7 days: four parallel sessions are editing adjacent files; re-read `git status`, `git log -5 -- lib/core/chain-executor.cjs scripts/build-section-command-ledger.cjs tests/test-353-tripwires.cjs` and `ls scripts/jev-devtime-client.cjs` before executing.
