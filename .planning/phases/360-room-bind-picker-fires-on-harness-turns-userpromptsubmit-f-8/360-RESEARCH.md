# Phase 360: Room-bind picker fires on harness turns (UserPromptSubmit F.8) - Research

**Researched:** 2026-09-23
**Domain:** Claude Code UserPromptSubmit hook input contract; `scripts/intent-classifier.cjs` room-resolution path; the shared 357 harness classifier in `lib/hmi/turn-text.cjs`
**Confidence:** HIGH (A1 HIGH, A2 MEDIUM but covered either way, A3 unresolved but designed around)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Requirements are locked in `360-SPEC.md` (9 requirements). Decisions copied verbatim from `360-CONTEXT.md`:

#### Input source for the verdict (A1-A3 are open for the researcher)
- **D-01:** The verdict is computed from the hook's stdin payload, parsed once. `intent-classifier.cjs` hands the
  parsed payload (or `STDIN_RAW`) to ONE new export in `lib/hmi/turn-text.cjs` (working name
  `classifyUserPromptPayload(payload, opts)`, returning `'harness'` or a non-harness class). All reading of
  `prompt`, `isMeta`, `origin`, and `transcript_path` happens inside turn-text. `intent-classifier.cjs` never
  reads `isMeta` or `origin` itself (R4 tripwire).
- **D-02:** The new export does not carry its own rule body. It normalizes the payload into `(content, rec)` and
  calls `classifyPrecedingUserContentSource(content, rec)` from 357-07, so the Stop hook and the
  UserPromptSubmit hook share one rule body and one `HARNESS_LEADS` list. When stdin carries no `origin` or
  `isMeta` (the expected A1 answer), `rec.originKind` is `undefined`, so R-A's rule "origin not human AND the
  prompt leads with a harness tag" reduces to a lead-only verdict. The human path costs one `trimStart` plus a
  few `startsWith` calls and zero file reads.
- **D-03:** If A1 shows the stdin payload DOES carry `origin` / `isMeta`, use those fields directly and drop the
  transcript read in D-04 entirely.
- **D-04:** If stdin has no origin: do a bounded tail read of `transcript_path` (last 64 KB at most) ONLY when the
  prompt already leads with a harness tag, or when stdin says `isMeta:true`. The human path with no harness lead
  never touches the transcript (SPEC hook-budget constraint). The tail read can only VETO (never add) a harness
  verdict:
  - If it finds the triggering record with `origin.kind === 'human'` (a human pasted a tag as the lead), the
    verdict is non-harness.
  - For an `isMeta` payload with no harness lead, the R-A carve-out applies: harness only if the previous user
    record is not human-upstream. If the previous record cannot be read, the verdict is non-harness (fail toward
    human).
  - If the record is not in the transcript yet (A3 negative), or the read fails, the lead-only verdict from D-02
    stands. "Origin unknown" is not a fault under R6. A thrown exception is (D-06).
  - The researcher decides from A1-A3 evidence whether D-04 is needed at all. The SPEC allows lead-only if the
    R8 carve-out fixture still passes, and it does by construction, because a Skill body or image record does
    not lead with a harness tag.
- **D-05:** Raw prompt form (A2): the lead list must cover BOTH forms the snapshot shows for peers: the stored
  framing `Another Claude session sent a message:` and the raw queued tags `<agent-message from=` /
  `<cross-session-message from=`. Whichever form the hook actually receives, it is covered (R5).

#### Where the guard sits in `main()`
- **D-06:** Compute the verdict once, at module init next to `STDIN_MESSAGE` / `STDIN_SESSION_ID`:
  `const TURN_IS_HARNESS = harnessVerdict(STDIN_RAW)`. The helper lazy-requires turn-text inside try/catch and
  returns `true` only when the export returns exactly `'harness'`. Any missing module, throw, or unrecognized
  shape returns `false` (R6, PSB-06 never-block).
- **D-07:** Use a single early guard, not per-emitter guards. At the top of `main()`, directly after
  `if (!message) return 0;`, add `if (TURN_IS_HARNESS) return 0;`. This sits before the strict-mode override,
  the zero-score gate, the F.8 binding gate and the legacy advisory, so all four outputs and their side writes
  (`recordReachedGate`, `binding_gate` / `zero_score_gate` trace payloads, offered markers) are skipped by one
  line. The planner must confirm that `main()` (:477 to about :750) holds only room-resolution work, so nothing
  outside R1 is skipped. If anything else lives there, it moves to the guard's far side or is recorded as a
  deviation.
- **D-08:** Add a second guard at the answer consumer only: wrap the `consumePriorBindingAnswer(roomDir,
  sessionId, STDIN_MESSAGE)` call (:3575) in `if (!TURN_IS_HARNESS)`. The pending `binding_gate_payload` stays
  unconsumed for the next human turn (R2).
- **D-09:** Leave these untouched on harness turns (SPEC out of scope): `consumePriorF1Pick`, the engine NAV
  block (`emitEngineDecisionBlock`), and `injectGraphFindings`. Their harness-turn behavior is a deferred item
  (see below).

#### R5 tag re-add and compatibility with 357's replay
- **D-10:** 360 owns the edit that adds `<agent-message` and `<cross-session-message` to the ONE `HARNESS_LEADS`
  in `lib/hmi/turn-text.cjs`. It lands after 357-07 is on `main`, in 360's own commit, and the commit message
  cites R5 and the 15 queued-peer runs. If 357-07's measured peer-prefix step did not add
  `Another Claude session sent a message:`, 360 adds it in the same edit. `[Cross-session idle notice]` and
  `<task-notification` are already in the list from 357-07. Every match is a structural leading-tag
  `startsWith` on the trimmed text, never on meaning.
- **D-11:** On the Stop path the lead rule is origin-gated (origin not human), and both tags have 0 stored
  occurrences as user text (357 Finding 4), so Stop-path verdicts should be unchanged. Proof is the replay, not
  the argument: `tests/run-all-357.sh` (replay leg with `--baseline compare`) must stay green, with 0
  pass->block flips, 0 new misses and 0 human-upstream flips. If a 357 test pins the ABSENCE of these two tags
  (357-07's acceptance grep is plan-time only, not a standing leg), 360 updates that leg in the same commit
  and cites R5. It never forks the list.
- **D-12:** A human prompt that quotes a tag mid-text stays non-harness, because only the lead is checked.
  A unit leg pins this.

#### Fixtures, tests and tripwires
- **D-13:** Fixtures follow 357's `tests/fixtures/card-fire-replay/` conventions: one JSON file,
  `tests/fixtures/ups-harness-360/cases.json`, with a top-level `meta` block (`schema_version`, `source:
  "authored"`, and a `sanitization_statement` in the style of `tests/fixtures/card-fire-corpus-238.json` /
  the 357 corpus meta) and an `entries` array. Each entry is `{id, shape, stdin: {prompt, session_id,
  transcript_path?}, transcript_records?, expect: "suppress" | "fire"}`. The session id, room names and peer
  names are placeholders (`sample-session-a`, `sample-room`, `sample-peer`).
- **D-14:** Entries: 5 harness shapes (task-notification, queued `<cross-session-message from=`, queued
  `<agent-message from=`, stored peer framing, idle notice), 1 carve-out (a Skill-body meta record right after a
  human prompt, in transcript mode, expect fire), 2 human controls (direct, and queued with `origin.kind:
  'human'`), 1 mid-text quote (expect fire), and 1 pasted-lead with human origin (expect fire). The last one
  applies only if D-03 or D-04 can see origin. Otherwise it is recorded as an accepted limit with 0 observed
  cases.
- **D-15:** Test files:
  - `tests/test-360-harness-picker.cjs`: R1 including the human control leg, R2 seeded pending payload then a
    human follow-up that binds, R3 byte-identical leg, and R6 fault injection. It uses the existing
    `spawnSync(process.execPath, [CLASSIFIER], {input, env: {MINDRIAN_ROOMS_HOME, ...}})` pattern from
    `tests/test-260917-binding-gate-offscope.cjs`, with temp homes in mkdtemp.
  - `tests/test-360-leads.cjs`: the 5 R5 lead legs plus the mid-text negative, run against the turn-text
    export directly.
  - `tests/test-360-tripwire.cjs`: R4 (no harness lead literal and no `isMeta` comparison in
    `scripts/intent-classifier.cjs`, and the list defined in exactly one file under `lib/` + `scripts/`) and R9
    (`git diff --name-only $PLAN_BASE..HEAD` has no `lib/mcp/` path).
  - `tests/test-360-snapshot-replay.cjs`: R7, local-only, reading `~/.cache/mindrian-dev/357-raw/` after
    `sha256sum -c SHA256SUMS`. It prints harness and human fire counts, exits non-zero unless the result is
    harness 0 and human 2, and SKIPs with a stated reason when the snapshot is absent. Its output is booleans,
    counts and leading tags only.
  - `tests/run-all-360.sh`: runs all of the above, then `tests/run-all-357.sh`, then the six R3 suites with a
    count compare.
- **D-16:** R6 fault injection uses a `--require` preload stub in the spawned child that makes the turn-text
  export throw. There is no production env seam. If the planner finds the preload cannot intercept the lazy
  require, an env seam in the same style as the existing `navTestThrowing` seams is the fallback, and the
  planner records why.
- **D-17:** R3 byte-identical leg: run the human-origin fixture against a `git archive` of `PLAN_BASE` (357's
  `--code-root` pattern) and against HEAD in the same temp home, and compare stdout bytes. The R3 suite
  baseline (pass/fail counts of `test-209-primary-sidechannel`, `test-209-engine-arm-contract`,
  `test-225-answer-narrowing`, `test-260917-binding-gate-offscope`, `test-251-skeleton-split`, and
  `lib/memory/userpromptsubmit-integration.test.cjs`) is recorded in the first plan's SUMMARY before any code
  change. Known reds stay known (357 R-J precedent) and are not fixed here.

#### Tri-Polar
- **D-18:** The defect is CLI-only because it needs a UserPromptSubmit hook. Desktop and Cowork bind through
  MCP `room_list` -> `room_bind` and `gate_render` with `kind:'binding'`, which have no harness-turn injection.
  No `lib/mcp/` file changes. The existing MCP room-bind tests run unchanged in `run-all-360.sh`:
  `tests/test-248-room-bind-honest-return.cjs`, `tests/test-248-room-bind-session-authoritative.cjs`,
  `tests/test-room-bind-health-signal.cjs`, and `tests/test-room-bind-stdio-session-fallback.cjs`. The Stop
  side is already Tri-Polar through 357's shared `classifyCardFire`.

#### Sequencing and coordination
- **D-19:** Execution is gated on 357-07 being on `main`. The first plan task checks that `lib/hmi/turn-text.cjs`
  exports `HARNESS_LEADS` and that `classifyPrecedingUserContentSource` returns `'harness'` for a peer-shaped
  rec, and that `tests/run-all-357.sh` exists. It HALTS if any check fails. If 357-07's shipped API differs
  from the plan, 360 adapts to it and does not fork it.
- **D-20:** Parallel-session rules follow 357-07: record `PLAN_BASE`, use explicit-path commits
  (`git commit --only -- <paths>`), and run `git status --short -- <file>` before each edit, stopping on a peer
  diff. The 357-07 never-edit list applies. Never write STATE.md while a peer session owns it. No em-dashes.

### Claude's Discretion
- The exact export name and signature of the turn-text entry point (D-01), as long as it has one rule body.
- The tail-read byte bound (64 KB suggested) and how the triggering record is matched in the tail (by exact
  prompt text equality on the last user record is the suggested method).
- Whether R7's replay is a test file or a `scripts/` dev tool invoked by the test.

### Deferred Ideas (OUT OF SCOPE)
- **Fire-every-human-turn policy for unbound sessions** (T-dia-02 comment :683). A declined or ignored card re-fires on every scoring human turn. This is a product decision with its own suites and a candidate follow-on phase.
- **Dev-repo / no-room suppression.** A "dev repo, no room" answer that is never persisted keeps the picker alive in dev sessions. It pairs with the item above.
- **Harness-turn behavior of `consumePriorF1Pick`, the NAV engine block and `injectGraphFindings`.** The same answer-hijack class as R2, but for F.1. It belongs with 357's deferred "intent-classifier mints F.1 reaches unrelated to the turn".
- **Auto-continuation turns** (`origin.kind:'auto-continuation'`). 1 run, 0 fires. Possible follow-on.
- **Stop-hook feedback meta records at UserPromptSubmit.** Not observed. Revisit only if the replay shows one.
</user_constraints>

<phase_requirements>
## Phase Requirements

Proposed IDs (mint in REQUIREMENTS.md at plan time, one per SPEC requirement, same order):

| ID | Description (SPEC req) | Research Support |
|----|-------------|------------------|
| BIND360-01 | Harness turns never mint or inject any room-bind output (R1) | Finding 4: `main()` :477-748 is room-resolution only; one early guard covers all four outputs plus `recordReachedGate`, trace payloads and both offered markers. Finding 6: the defect reproduces today in a temp fixture (control leg) |
| BIND360-02 | Harness turns never consume a pending binding answer (R2) | Finding 5: consumer scans backward for the last unconsumed payload; `_matchVerb` is exact-match, so a RED leg needs a call spy, not a bind outcome |
| BIND360-03 | Human turns keep today's behavior (R3) | Finding 6: human-turn stdout is byte-deterministic across fresh homes at the same path (1530 B == 1530 B); baseline counts measured (Environment section) |
| BIND360-04 | One classifier, reused from 357 (R4) | Finding 7: no harness literal exists in `lib/` or `scripts/` today; tripwire scope pitfalls |
| BIND360-05 | Every harness prompt shape seen at UPS is covered (R5) | Findings 2, 3: 30-day census, 100% lead coverage for peer / task-notification, 0 of 2,154 human prompts lead with any harness lead; LCP pitfall |
| BIND360-06 | Fail toward today's behavior (R6) | Pattern 3: `--require` preload patches the shared `require.cache` exports object; HIGH by Node CJS semantics |
| BIND360-07 | Replay proof on the 2026-09-23 evidence (R7) | Finding 3: counterfactual replay prototype reproduces SPEC baseline exactly (unbound header: harness 33 -> 0, human 2 -> 2) |
| BIND360-08 | Sanitized committed fixtures, raw evidence never committed (R8) | 238 corpus `sanitization_statement` style verified; placeholders per D-13 |
| BIND360-09 | Tri-Polar parity: MCP binding untouched (R9) | Sole F.8 picker emitter is `scripts/intent-classifier.cjs` (grep); four MCP room-bind suites green at research time; R9 diff must be scoped to 360's own commits (Pitfall 4) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- All MindrianOS-Plugin dev work runs through GSD; work only in `/home/jsagi/dev/MindrianOS-Plugin/`, never in the plugin install cache.
- CJS only, no TypeScript; Node built-ins only in hooks.
- No em-dashes anywhere (code, comments, docs, commits); use hyphens.
- Canon Part 8: no user/room content ever egresses to Brain. This phase is local-only; the hook makes no network call.
- Tri-Polar Design Rule: evaluate CLI / Desktop / Cowork. Skipping a surface must be a stated call (SPEC R9 states it: the defect needs a UPS hook, so it is CLI-only).
- Part 7 Reuse Before Build: reuse 357's classifier, never build a second one (SPEC R4).
- Verification: run `bash tests/run-all-<phase>.sh` after edits; Claude runs tests, users never do.
- `.planning/phases/**` files are force-tracked despite `.gitignore`; new phase-dir files need `git add -f` (user memory, 2026-09-16).
- Parallel sessions share this working tree: explicit-path commits only, never revert unowned diffs (user memory, 3 observations).
- A `main` commit is not live until released and picked up (user memory). Installed plugin at research time is `mos@2.0.0-beta.47`; repo is `2.0.0-beta.48`.

## Summary

Claude Code's UserPromptSubmit hook gets a small, fixed JSON payload: the common fields (`session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, plus `prompt_id`, `scratchpad_dir`, `agent_id`, `agent_type`, `effort` when they apply) and `prompt`. The installed 2.1.280 binary also adds `session_title`. It carries NO `origin`, NO `isMeta` and NO prompt-source field, even though Claude Code knows the prompt source internally. So the hook can only tell a harness turn from a human turn by what the prompt text starts with. That is a lead-only verdict, and it is enough. Across the four snapshot sessions and 30 days of this machine's transcripts, every peer and task-notification prompt starts with one of the five harness leads, and none of 2,154 human-origin prompts does.

A counterfactual replay of the snapshot reproduces the SPEC baseline exactly. With the unbound-header metric (the SPEC's "picker fire"), harness fires drop from 33 to 0 and human fires stay at 2. If you count every room-resolution output (the unbound header, the off-scope header, no-match, mismatch and strict-mode), harness fires drop from 36 to 0 and human fires stay at 5. No human-attributed run gets a harness verdict. The replay checks both possible prompt forms for stored peer records (the framed text, and the raw tag on its second line), so the A2 uncertainty does not change the result. A3 (is the triggering record on disk when the hook runs?) cannot be proven. The official docs say the transcript "may lag" at hook time, and nothing in this repo logs UPS stdin. The design therefore should not depend on it: drop D-04's transcript tail read entirely.

`main()` in `scripts/intent-classifier.cjs` (:477-748) contains only room-resolution work, so D-07's single early guard is correctly placed. `injectGraphFindings` and the NAV engine block run from the entry block and do not depend on `main()`'s return value, so they are unaffected (D-09 holds by construction). There is one hard sequencing fact: 357 has not executed yet. `lib/hmi/turn-text.cjs` still has the 3-class classifier, and `tests/run-all-357.sh` does not exist. So 360 is blocked on 357-07 AND on the 357 replay infrastructure (357-01/-02/-09) for its R5 acceptance.

**Primary recommendation:** Lead-only verdict, no transcript read. Add one export `classifyUserPromptText(text)` in `turn-text.cjs` that calls `classifyPrecedingUserContentSource(text, {isMeta:false, originKind:undefined, prevHumanUpstream:true})`. Compute `TURN_IS_HARNESS` from `STDIN_MESSAGE` at module init, and use the two guards (D-07, D-08). Widen the peer lead to the stem `Another Claude session sent a message`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Harness verdict (lead classification) | Shared lib (`lib/hmi/turn-text.cjs`) | - | One rule body and one `HARNESS_LEADS`, shared by the Stop hook (357) and the UPS hook (360); R4 |
| Suppress room-resolution outputs on harness turns | CLI hook process (`scripts/intent-classifier.cjs` `main()`) | - | Only the UPS hook injects the F.8 picker; the one early guard lives where the outputs are produced |
| Do not consume a pending binding answer on harness turns | CLI hook process (entry block :3575) | Filesystem state (decision-trace file) | The consumer reads `<roomDir>/.mindrian/decision-traces/<sid>.json`; the guard stops the read-and-write |
| Side writes (F.8 side channel, trace payloads, offered markers) | Filesystem state (`~/.mindrian/card-fire-reached.json`, room `.mindrian/decision-traces/`) | - | Skipped by construction because the writers are inside `emitBindingGate` / `emitNoMatchGate` / `emitStrictModeOverride` |
| MCP binding (`room_list` / `room_bind` / `gate_render kind:'binding'`) | MCP server (`lib/mcp/`) | - | No UPS hook on Desktop/Cowork; unchanged (R9) |
| Snapshot replay (R7) | Dev-time test (`tests/`) | Local snapshot (`~/.cache/mindrian-dev/357-raw/`) | Local-only evidence; never committed; SKIP when absent |

## Key Findings (verified this session)

### Finding 1 - A1: the UPS stdin has no origin / isMeta (HIGH)
- **Official docs** (`https://code.claude.com/docs/en/hooks.md`, section "UserPromptSubmit input", fetched 2026-09-23): UPS hooks get the common input fields plus `prompt`. The example payload has `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name` and `prompt`. The common-field table adds `prompt_id` (v2.1.196+), `scratchpad_dir` (v2.1.257+), `effort` (tool-use-context events only), and `agent_id` / `agent_type` (subagent or `--agent` only). There is no `origin`, `isMeta` or `promptSource` [CITED: code.claude.com/docs/en/hooks.md]. Note: a summarizing WebFetch of the same page claimed the field is `user_message`. The raw markdown (curl) shows `prompt`. Trust the raw file.
- **Installed binary** (`claude --version` = 2.1.280; `~/.local/share/claude/versions/2.1.280`): the UPS hook input is built as `{...Hl(session, cwd, mode), hook_event_name:"UserPromptSubmit", prompt:<text>, session_title:<title>}`. `Hl` returns `{session_id, transcript_path, cwd, scratchpad_dir, prompt_id, permission_mode, agent_id, agent_type, effort}`. The prompt-source object `Z(promptSource, wakeupSource)` is passed to the runner, but it is NOT put into the hook input [VERIFIED: byte-offset extraction from the binary, functions `Vvn` / `THe` / `Hl`]. D-03 is therefore moot, and D-02's lead-only reduction is the actual behavior.
- **Repo evidence:** no UPS hook in this repo logs its stdin (`admin-command-gate`, `mva-detect`, `first-install-router`, `brain-derivation-drain`, `operator-update`, `jtbd-update`, `auto-explore-drain` and `intent-classifier` have no stdin dump). None of them reads `transcript_path`. `~/.mindrian/` holds no stored hook payload. The one `~/.claude/debug/*.txt` log records hook OUTPUT only [VERIFIED: grep]. `extractMessage` (:340) reads `user_message`, then `prompt`, then `message`, then `text`. Real Claude Code sends `prompt`.

### Finding 2 - A2: what `prompt` carries for each harness shape (MEDIUM; covered either way)
- The stored transcript forms (snapshot, shape-only): stored peer records are `isMeta:true`, `origin.kind:'peer'`, `promptSource:'system'`. Their first line is `Another Claude session sent a message:` and their second line starts with `<agent-message` (19) or `<cross-session-message` (11). Queued peer deliveries are `queued_command` attachments with `attachment.origin.kind:'peer'` and `commandMode:'prompt'`, and `attachment.prompt` starts with the raw tag. Queued task notifications have `commandMode:'task-notification'`, no origin, and a prompt starting `<task-notification`. Stored task notifications have `origin.kind:'task-notification'`, `promptSource:'system'`, and text starting `<task-notification`. The idle notice is `isMeta:true` with no origin and `promptSource:'system'`, and its text starts `[Cross-session idle notice]` [VERIFIED: local scratch script over the R-D snapshot].
- The binary builds the peer framing from constants: `Another Claude session sent a message:`, `Another Claude session sent a message while you were working:`, and `A peer session sent a message while you were working:`. Claude Code's own peer detector accepts either a leading `<cross-session-message` tag or one of those framings followed by the tag [VERIFIED: binary constants `O3`, `F_e`, `Uz="cross-session-message"`]. The hook `prompt` is the text submitted through `prompt.submit`. It could not be observed directly, because no hook echoes it: 0 of 122 recorded intent-classifier stdouts contain any prompt-lead token.
- **Resolution:** the prototype replay classifies stored peer records under BOTH candidate forms (the framed text, and the raw tag on the second line). All 30 stored peer runs are harness under both forms. So D-05's "cover both" is sufficient no matter which form Claude Code hands the hook.

### Finding 3 - Counterfactual replay reproduces the SPEC baseline (HIGH)
Prototype (scratchpad only, never in the repo). It attributes each intent-classifier `hook_success` UPS attachment to its trigger by walking `parentUuid` back over every attachment that is not `queued_command`, until it reaches a `user` record or a `queued_command` attachment. Ground truth uses no harness literals: `origin.kind` in {peer, task-notification}, or `promptSource === 'system'`, or queued `commandMode === 'task-notification'` counts as harness. `origin.kind === 'human'` counts as human. Everything else is "other" (Skill bodies, other meta, auto-continuation). The post-change fire is `pre_fire AND verdict !== 'harness'`.

| Class | Runs | Unbound-header fires pre -> post | Any room-resolution output pre -> post | Runs with harness verdict |
|---|---|---|---|---|
| human | 38 | 2 -> 2 | 5 -> 5 | 0 |
| harness | 77 | 33 -> 0 | 36 -> 0 | 77 |
| other (Skill/meta/auto-continuation) | 7 | 0 -> 0 | 0 -> 0 | 0 |

- The SPEC's 84 harness / 38 human = 77 harness + 7 "other" / 38 human. The SPEC's "picker fire" = the unbound header `-- mindrianOS -- bind session -- select rooms --`. The extra 3 harness fires are off-scope headers (`-- bound to X -- also matches Y --`), all in session 0f86dd63, all from task-notification or peer triggers.
- **30-day corpus** (110 files under `~/.claude/projects/-home-jsagi/`, counts only). There are 1,543 stored and 611 queued `origin.kind:'human'` prompts, and 0 of them lead with any of `<task-notification`, `<cross-session-message`, `<agent-message`, `Another Claude session sent a message`, `A peer session sent a message`, `[Cross-session idle notice]`, `<teammate-message`. All 401 stored peer records lead with the framing. All 173 queued peer deliveries (139 `<cross-session-message`, 34 `<agent-message`) lead with the tag. All 1,664 task notifications (1,209 stored, 455 queued) lead with `<task-notification`. There are 31 idle notices. `A peer session sent a message` and `<teammate-message`: 0 each [VERIFIED: local scratch census].

### Finding 4 - A3: is the triggering record on disk at hook time? (UNRESOLVED; design must not depend on it)
- Docs: "The transcript file is written asynchronously and may lag the in-memory conversation, so it may not yet include the current turn's most recent messages when a hook fires" [CITED: code.claude.com/docs/en/hooks.md, common input fields].
- Snapshot timing: stored triggers (human `user` records, peer / idle meta records, task-notification user records) have an in-memory `timestamp` 1 to 43 ms (p50 7-8 ms) before the hook start (the attachment `timestamp` minus `durationMs`). In file order the trigger comes before its UPS attachment, and the attachment's `parentUuid` chain leads back to it. For queued deliveries, the attachment timestamp is the ENQUEUE time: hook start minus that ranges from 2 ms to 424 s, p50 12 s. Timestamps show creation order, not flush order. No evidence either way on disk presence at hook start [VERIFIED: local scratch script].
- **Recommendation: drop D-04 entirely.** A transcript read would add a file read, and its only job would be to veto a lead verdict when a human pasted a harness lead. That case has 0 observations in 2,154 human prompts, and the read cannot even be guaranteed to see the record. Record D-14's "pasted-lead with human origin" as an accepted limit (0 observed), as D-14's own fallback allows.

### Finding 5 - `main()` content and guard placement (HIGH)
`main()` spans `scripts/intent-classifier.cjs:477-748`. Everything after `if (!message) return 0;` (:482) is room resolution:
1. `resolveMindrianRoomsRoot`, `readRegistry`, `activeRoomFromRegistry`, `registeredRoomNames` (read-only).
2. Strict mode: `detectStrictMode` -> `emitStrictModeOverride` (stdout plus a `strict_mode` decision-trace write via `appendTraceTurnNumber` / `persistDecisionTrace`) at :503-509, or `_runBindingGate` (read-only; `lib/workflow/session-binding-consumer.cjs:204` only reads the binding) at :517-530.
3. `discoverSealedRooms`, `buildFingerprint`, `scoreRoom`, `tokenize` (read-only; no writes between :212 and :300).
4. The zero-score gate (:579-633): `readSessionBinding`, then `emitNoMatchGate`. That writes stdout, the side channel (`recordReachedGate` :3208), the `zero_score_gate` trace, and `markZeroScoreGateOffered` (:3273).
5. The F.8 gate (:635-697): `emitBindingGate` writes stdout, the side channel (:2943), the `binding_gate` trace (:2988), and **`markBindingGateOffered` (:3022). This runs even for UNBOUND sessions** (verified: `sample-session-a.binding-gate-offered.json` appeared in a temp fixture run).
6. The legacy advisory (:699-747): stdout only.

No other behavior lives there. The entry block (:3510) calls `main()`, then runs `injectGraphFindings` (gated only on `injectionEnabled()`), then the NAV block (gated only on `STDIN_MESSAGE` and `roomDir`). Neither uses `main()`'s return value, so an early `return 0` cannot skip them. **D-07's placement is correct as written; no deviation needed.**

A side effect the guard also removes: a harness turn in an unbound session today stamps a per-(session, room) offered marker. If the session later binds, `bindingGateAlreadyOffered` (:683) dedupes the off-scope gate for that room on human turns. So today's harness fires can silently suppress a later legitimate human off-scope gate.

### Finding 6 - Answer-consumer semantics (HIGH; changes how R2 is tested)
- `consumePriorBindingAnswer` (:3293) scans the trace BACKWARD for the newest `binding_gate_payload`, and stops at a `binding_gate_consumed` marker. The NAV block's own trace entries do not hide a pending payload. Trace rotation (>50 entries drops the oldest 10, `TRACE_ROTATE_AT`) could in theory rotate a pending payload out after many harness-turn NAV writes. That is out of scope and only noted.
- `captureCliActionSet` -> `_matchVerb` (`lib/hmi/f8-action-capture-cli.cjs:54-58`) is an **exact whole-string match** against the option labels. A raw-text prompt becomes `{selectedOptions:[<whole prompt>]}`. So a prompt that starts with a harness lead can never equal a room label, and today it already ends in `empty_confirm`: no binding write, no consumed marker. **R2's "binding file unchanged" assertion passes on pre-phase code too.** For a true RED -> GREEN leg, assert the consumer is NOT INVOKED on a harness turn. Use a `--require` preload spy that wraps `captureCliActionSet` and appends a line to a temp file: 1 call before the change, 0 after. The follow-up human turn with an exact label, for example `copper-ledger`, still binds (and writes `binding_gate_consumed`).
- Reproduced the defect in a temp fixture (isolated `HOME`, `MINDRIAN_HOME`, `CARD_FIRE_SIDECHANNEL_PATH`, `MINDRIAN_ROOMS_HOME`): an unbound session, and a prompt that starts with the stored peer framing followed by a queued tag whose body carries room-fingerprint tokens. Today it emits the `bind session` header (1 occurrence). The same fixture's human prompt emits identical 1530-byte stdout on two fresh runs at the same path (deterministic).

### Finding 7 - Tripwire scope and 357 interplay (HIGH for today's state, MEDIUM for post-357 state)
- Today: 0 files under `lib/` or `scripts/` contain any of the five lead literals, and `intent-classifier.cjs` has 0 `isMeta` occurrences [VERIFIED: grep].
- After 357: 357-07 adds `HARNESS_LEADS` to `turn-text.cjs`. 357-06's `scripts/extract-dogfood-stop-events.cjs` produces a "lead-tag class" per record and may hard-code lead literals. `scripts/replay-card-fire.cjs` might too. If either does, 360's "defined in exactly one file" tripwire fails on files 360 does not own. The Wave-0 check must grep, and the planner must decide: an allowlist with a reason, or a follow-on to make those tools import `HARNESS_LEADS`. 360 must not edit 357's files outside `turn-text.cjs` without citing R4.
- The peer-prefix measurement in 357-07 step 2 will likely keep the **40-char LCP `Another Claude session sent a message:\n<`** (measured the same way here: LCP length 40 over 401 peer records). That lead embeds a newline and the start of the tag. It would miss the binary's `... while you were working:` variant and any CRLF form. Recommend 360's R5 edit replace it with the stem `Another Claude session sent a message` (37 chars). It is a prefix of the LCP, so every record that matched before still matches (Stop verdicts on observed data cannot flip). Human-side risk: 0 of 2,154.
- On the Stop path, adding `<cross-session-message` / `<agent-message` cannot change a verdict. `readTurnText` only processes `role:'user'` records (`msg.role || obj.type`), and `queued_command` rows are `type:'attachment'` with no `message.role`, so they are never read. The only place those tags lead stored user text is the second line of a framed peer record, which is not the lead [VERIFIED: `turn-text.cjs:208-223`].

## Standard Stack

No new packages. Node built-ins only (`node:fs`, `node:path`, `node:child_process`, `node:os`, `node:crypto`), matching the existing hook and test conventions.

### Core
| Module | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lib/hmi/turn-text.cjs` | repo (after 357-07) | The ONE harness classifier and `HARNESS_LEADS` | Mandated by SPEC R4 / D-02; already requires only `node:fs` |
| `scripts/intent-classifier.cjs` | repo | UPS hook; the guard sites | The only F.8 picker emitter (grep: the other hits are comments) |
| Node.js | v22.23.1 (local) | Runtime | Existing |

### Supporting
| Tool | Purpose | When to Use |
|---------|---------|-------------|
| `node --require <stub>` | Fault injection (R6) and consumer spy (R2) in a spawned child | Test only; no production seam |
| `git archive <PLAN_BASE> scripts lib data \| tar -x` | Pre-phase code root for the R3 byte-identical leg | 357 Pattern 3 (`--code-root`) |
| `sha256sum -c SHA256SUMS` | Snapshot integrity before the R7 replay | Local-only leg |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external packages (Node built-ins and repo modules only). slopcheck not run.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Claude Code prompt.submit (human typed | queued human | stored peer | queued peer | task-notification | idle notice)
        |
        v   stdin JSON {session_id, transcript_path, cwd, permission_mode, hook_event_name, prompt, ...}  (no origin, no isMeta)
hooks/run-hook.cmd -> scripts/intent-classifier (bash drain, stdin untouched) -> node intent-classifier.cjs
        |
        v  module init
STDIN_RAW -> STDIN_MESSAGE (extractMessage) -> STDIN_SESSION_ID
        |
        +--> harnessVerdict(STDIN_MESSAGE) --lazy require--> turn-text.classifyUserPromptText(text)
        |        |                                              -> classifyPrecedingUserContentSource(text, {isMeta:false, originKind:undefined, prevHumanUpstream:true})
        |        |                                              -> 'harness' iff trimmed text startsWith one HARNESS_LEADS entry
        |        +--> TURN_IS_HARNESS (true only on exact 'harness'; any fault -> false)
        v
main():  empty? -> return | TURN_IS_HARNESS? -> return (NEW, D-07)
        |        (human path continues unchanged)
        +--> strict-mode override | zero-score gate | F.8 binding gate | legacy advisory
        |        side writes: stdout, ~/.mindrian/card-fire-reached.json (F.8), decision-trace payloads, offered markers
        v
entry block: injectGraphFindings (unchanged)
        +--> NAV block (roomDir): consumePriorF1Pick (unchanged, D-09)
        |                         TURN_IS_HARNESS? skip : consumePriorBindingAnswer (NEW, D-08)
        |                         emitEngineDecisionBlock (unchanged, D-09)
        v
stdout -> Claude Code additionalContext / systemMessage
```

### Recommended Project Structure
```
lib/hmi/turn-text.cjs                         # + classifyUserPromptText export; HARNESS_LEADS gains 2 tags + peer stem
scripts/intent-classifier.cjs                 # + harnessVerdict helper, TURN_IS_HARNESS, 2 guards (about 15 lines)
tests/fixtures/ups-harness-360/
  cases.json                                  # meta + entries (D-13/D-14), placeholders only
  throwing-turn-text.cjs                      # --require preload (R6)
  missing-export-turn-text.cjs                # --require preload (R6, "missing" leg)
  capture-spy.cjs                             # --require preload (R2 RED leg)
tests/test-360-leads.cjs                      # R5 unit legs + mid-text negative + carve-out-by-construction
tests/test-360-harness-picker.cjs             # R1, R2, R3 byte-identical, R6
tests/test-360-tripwire.cjs                   # R4, R8 grep, R9 (scoped to 360 commits)
tests/test-360-snapshot-replay.cjs            # R7 local-only (tests/, not scripts/, see Pitfall 3)
tests/run-all-360.sh                          # aggregator, isolated HOME for every leg
```

### Pattern 1: Lead-only verdict through the 357 rule body
**What:** A thin export that normalizes a prompt string into the 357 `(content, rec)` call. `rec` is chosen so that only R-A's lead rule can fire.
**When to use:** Every UPS turn, once, at module init.
**Example:**
```javascript
// lib/hmi/turn-text.cjs (added after 357-07 lands; adapt to 357-07's actual rec field names)
// classifyUserPromptText(text) -- Phase 360 (SPEC R4/R5): the UserPromptSubmit entry point.
// Claude Code's UPS stdin carries no origin and no isMeta (hooks docs + 2.1.280 binary), so this
// is a lead-only verdict: originKind undefined makes R-A's "origin not human AND leading harness
// tag" rule reduce to the lead check; isMeta false plus prevHumanUpstream true keeps the meta
// rule from ever firing here (the carve-out can only fail toward human). Never throws.
function classifyUserPromptText(text) {
  try {
    if (typeof text !== 'string') return 'none';
    return classifyPrecedingUserContentSource(text, {
      isMeta: false,
      originKind: undefined,
      prevHumanUpstream: true,
    });
  } catch (_e) {
    return 'none';
  }
}
```
Passing `STDIN_MESSAGE` (the string `extractMessage` already chose) instead of the raw payload means the verdict judges exactly the text the gate scores. It needs no second JSON parse, and no field-precedence logic gets duplicated in turn-text. The R4 tripwire is unaffected: it bans lead literals and `isMeta` comparisons in intent-classifier, not the word "harness".

### Pattern 2: One module constant, two guards
```javascript
// scripts/intent-classifier.cjs, directly after STDIN_SESSION_ID (:411)
// Phase 360 (D-06): true only on an exact 'harness' verdict from the ONE shared classifier;
// a missing module, a missing export or a throw leaves today's human path (R6, PSB-06).
function harnessVerdict(text) {
  try {
    const tt = require(path.join(__dirname, '..', 'lib', 'hmi', 'turn-text.cjs'));
    if (!tt || typeof tt.classifyUserPromptText !== 'function') return false;
    return tt.classifyUserPromptText(text) === 'harness';
  } catch (_e) {
    return false;
  }
}
const TURN_IS_HARNESS = harnessVerdict(STDIN_MESSAGE);

// main(), directly after `if (!message) return 0;` (:482)  -- D-07
if (TURN_IS_HARNESS) return 0;

// entry block, the consumer call (:3575)  -- D-08
if (!TURN_IS_HARNESS) {
  try {
    consumePriorBindingAnswer(roomDir, sessionId, STDIN_MESSAGE);
  } catch (_) { /* fire-and-forget: never disrupt the prompt (PSB-06) */ }
}
```
Cost: one extra module load (turn-text requires only `node:fs`). Measured: 0.35 ms to require, and about 0.4 microseconds per five-lead `startsWith` check. `BUDGET_MS` is 200 ms and the hook timeout is 2000 ms (`hooks/hooks.json`). Right now only 5 modules are in the require graph when the classifier loads, and turn-text is not one of them. No transcript read.

### Pattern 3: `--require` preload for fault injection and spies (R6, R2)
Node CJS caches the `module.exports` object. A preload that requires the real module and replaces a property changes what every later `require` of that resolved path returns, including the lazy require inside `harnessVerdict`. `turn-text.cjs`'s `module.exports` is a plain, unfrozen object literal (:260).
```javascript
// tests/fixtures/ups-harness-360/throwing-turn-text.cjs
'use strict';
const path = require('node:path');
const tt = require(path.resolve(__dirname, '..', '..', '..', 'lib', 'hmi', 'turn-text.cjs'));
tt.classifyUserPromptText = function () { throw new Error('injected fault (R6)'); };

// spawn: spawnSync(process.execPath, ['--require', STUB, CLASSIFIER], { input, env })
```
Use the same shape for the R2 spy on `lib/hmi/f8-action-capture-cli.cjs` `captureCliActionSet`: wrap it, and append one line per call to `process.env.SPY_OUT` (a temp path). This works because `consumePriorBindingAnswer` lazy-requires that module by the same absolute path.

### Pattern 4: Counterfactual snapshot replay (R7)
The UPS hook's side effects on rooms cannot be replayed faithfully, because live room state has moved on. So the replay is counterfactual:
- `pre_fire` comes from the recorded hook stdout. The F.8 gate arrives as a JSON line inside `stdout`, so match the header and the systemMessage strings on the raw text (357 Finding 1).
- `post_fire = pre_fire && verdict(prompt) !== 'harness'`, using the REAL `turn-text` export.
- This is exact for the unbound-header metric: an unbound session has no dedupe, so no state carries between turns. For bound sessions, off-scope counts are informational only (see Pitfall 5).
- Stored peer records are evaluated under both prompt forms (A2).
- Exit non-zero unless: unbound harness post = 0, unbound human post = unbound human pre (2), and human runs with a harness verdict = 0.
- Print the all-outputs row (36 -> 0, 5 -> 5) as information.

### Anti-Patterns to Avoid
- **A transcript tail read at UPS time (D-04):** it adds a file read and a timing race (A3), and it only vetoes a case with 0 observations. Drop it.
- **Per-emitter guards:** four guards plus side-write guards is more surface area and more ways to leave a path open. One early return covers them all (D-07).
- **Forwarding a future `isMeta` field into the 357 rule at UPS:** with `prevHumanUpstream` unknown, R-A's meta rule would mark Skill bodies as harness and break the carve-out. Keep `isMeta:false` at UPS unless the previous record can be proven.
- **Treating "binding file unchanged" as R2's RED leg:** it is green before the change too (Finding 6). Assert "consumer not invoked".
- **Putting the replay in `scripts/` with lead literals or ground-truth `isMeta` checks:** it trips R4's one-definition rule. Keep it in `tests/`, and derive ground truth from `origin.kind` / `promptSource` / `commandMode` (no lead literals needed).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Harness classification | A regex / tag list in intent-classifier | `turn-text.classifyUserPromptText` -> `classifyPrecedingUserContentSource` | R4; one list for Stop and UPS |
| Pre-phase comparison | A reimplementation of old behavior | `git archive PLAN_BASE` code root (357 Pattern 3) | Byte-truth, not approximation |
| Fault seam | A production env var | `--require` preload (D-16) | No production test branch; standard CJS cache semantics |
| Snapshot attribution | Timestamp-nearest matching | `parentUuid` walk over non-`queued_command` attachments | Measured to reproduce SPEC's 38 human / 84 other+harness exactly |

**Key insight:** the hook knows only the prompt text. The whole fix is a text-lead check, and the correctness question is empirical (which leads real harness and human prompts carry). The 30-day census answers it: 100% coverage and 0 false-human.

## Common Pitfalls

### Pitfall 1: 357 is not executed yet
**What goes wrong:** 360 plans assume `HARNESS_LEADS`, the `'harness'` class, `tests/run-all-357.sh`, and the 357 replay baseline. None exist on disk. There is no 357 SUMMARY, `turn-text.cjs:115` still has the 1-arg, 3-class body, and `tests/fixtures/card-fire-replay/` is absent.
**How to avoid:** The Wave-0 halt check (D-19) must also check that `tests/run-all-357.sh` exits 0 and that `tests/fixtures/card-fire-replay/baseline.json` exists (357-09), because R5 acceptance needs the replay's `--baseline compare`. HALT otherwise.
**Warning signs:** `grep -c HARNESS_LEADS lib/hmi/turn-text.cjs` is 0.

### Pitfall 2: Existing binding suites write outside temp
**What goes wrong:** `tests/test-260917-binding-gate-offscope.cjs` and similar suites spawn the classifier without `MINDRIAN_HOME` / `CARD_FIRE_SIDECHANNEL_PATH`. `emitBindingGate` then writes F.8 records into the real `~/.mindrian/card-fire-reached.json`, which the live Stop hook reads (keyed by session id, 10-minute TTL).
**How to avoid:** `run-all-360.sh` exports `HOME`, `MINDRIAN_HOME`, `CARD_FIRE_SIDECHANNEL_PATH` and `TMPDIR` to a `mktemp -d` for every leg (verified: all ten suites pass or keep their known red under this isolation, and no repo file changed). New 360 tests set these in their spawn env, and put `session_id` in the stdin payload (the real Claude Code shape) rather than `CLAUDE_SESSION_ID`.

### Pitfall 3: R4 tripwire scope collides with 357 dev tools
**What goes wrong:** "Harness tag list defined in more than one file under `lib/` and `scripts/`" fails if 357-06/-02 tools carry lead literals, or if 360's own replay lives in `scripts/`.
**How to avoid:** Define "defined" precisely: a non-comment line containing any of the lead literals. Scan `lib/**/*.cjs` and `scripts/**/*.cjs`, excluding `node_modules`. The expected set is exactly `{lib/hmi/turn-text.cjs}`. Put the replay in `tests/`. If 357 tools appear in the set, record them with a reason, or open a follow-on to import `HARNESS_LEADS`. Do not silently widen the tripwire.

### Pitfall 4: R9 `git diff PLAN_BASE..HEAD` sees peer commits
**What goes wrong:** Phases 354, 356 and 357 commit to the same `main` in parallel. A range diff includes their `lib/mcp/` edits and falsely fails R9.
**How to avoid:** Scope to 360's own commits: `git log --format=%H PLAN_BASE..HEAD --grep='(360-'`, then `git diff-tree --no-commit-id --name-only -r <sha>` per commit, and assert no `lib/mcp/` path. The same applies to any "files changed" acceptance.

### Pitfall 5: Off-scope metric is state-dependent
**What goes wrong:** In session 0f86dd63, 3 harness off-scope fires stamped offered markers for 3 rooms. After the fix those markers are never written, so a later human turn that scores one of those rooms would now fire (correctly) where the recording shows silence. A counterfactual replay cannot model this.
**How to avoid:** R7's pass criterion uses the unbound-header metric, which is exact because there is no dedupe for unbound sessions. Report the all-outputs row as information only, with this caveat.

### Pitfall 6: The peer LCP lead is brittle
**What goes wrong:** 357-07 step 2's LCP is `Another Claude session sent a message:\n<`. It hard-codes a newline plus the tag start, and misses the `while you were working:` framing variant (in the binary, 0 observed).
**How to avoid:** Use the 37-char stem in 360's R5 edit (Finding 7), and add a unit leg for both binary framing variants.

### Pitfall 7: A 357 leg may pin the absence of the two tags
**What goes wrong:** 357-07's must-have truth says `<agent-message` and `<cross-session-message` are NOT in the list. If the executor encoded that as a standing leg in `tests/test-357-harness-source.cjs`, 360's R5 edit turns it red.
**How to avoid:** After 357 lands, grep that file. If the leg exists, update it in the same commit citing R5 (D-11).

### Pitfall 8: stdin is read at require time
**What goes wrong:** `tests/test-209-engine-arm-contract.cjs` `require()`s the classifier, and `STDIN_RAW = readStdinSync()` reads fd 0 at load. Run interactively without `</dev/null`, it blocks.
**How to avoid:** Runners always redirect stdin (`</dev/null`). `TURN_IS_HARNESS` on empty stdin is `false`, so required-module tests are unchanged.

## Code Examples

### R1 fixture harness (temp-isolated spawn)
```javascript
// Pattern source: tests/test-260917-binding-gate-offscope.cjs (makeFixture + spawnSync), plus isolation
function spawnClassifier(tmp, prompt, extraArgs) {
  return spawnSync(process.execPath, (extraArgs || []).concat([CLASSIFIER]), {
    input: JSON.stringify({ session_id: 'sample-session-a', hook_event_name: 'UserPromptSubmit', prompt: prompt }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      HOME: tmp.home, MINDRIAN_HOME: tmp.mh, CARD_FIRE_SIDECHANNEL_PATH: tmp.sidechannel,
      MINDRIAN_ROOMS_HOME: tmp.rooms, MINDRIAN_ROOMS_ROOT: tmp.rooms,
      MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
    }),
    timeout: 30000,
  });
}
// Assert on harness prompt: no 'bind session', 'session unbound', 'Intent mismatch', 'no room matched',
// 'Strict-mode override'; sidechannel file has no entry with shape 'F.8' for sample-session-a;
// decision-trace has no binding_gate_payload / zero_score_gate; no *.binding-gate-offered.json /
// zero-score marker written. Control: same body as a human prompt fires the header.
```

### Carve-out by construction (R8)
A Skill-body prompt starts `Base directory for this skill`. It has no harness lead, so `classifyUserPromptText` returns `'typed'` and the gate fires as today. That is 3 such runs in the snapshot, 0 fires either way.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stop hook treated harness preceding records as typed | 357-07 `'harness'` class (R-A carve-out) | 357 (planned, not executed) | 360 reuses the same rule body |
| UPS hook treats every turn as human | Lead-only harness verdict at UPS | this phase | Removes 33/33 harness unbound fires in the snapshot |
| `extractMessage` checks `user_message` first | Real Claude Code sends `prompt` (docs + binary) | - | No change needed; the verdict judges `STDIN_MESSAGE` |

**Deprecated/outdated:**
- D-04 transcript tail read: not needed (Finding 4).
- D-03: moot. The UPS stdin has no origin/isMeta in 2.1.280.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The text Claude Code puts in `prompt` for a stored peer record is either the framed text or the raw tag (not some third form) | Finding 2 | A third form without a harness lead would miss suppression for that shape. The R7 local replay cannot catch this (it replays stored text). Low risk: the binary's own peer detector recognizes exactly these two forms |
| A2 | 357-07 ships `classifyPrecedingUserContentSource(content, rec)` with rec fields `isMeta`, `originKind`, `prevHumanUpstream` as its plan says | Pattern 1 | Field names differ; the 360 export adapts (D-19) |
| A3 | 357-06/-02 tools may hard-code lead literals under `scripts/` | Pitfall 3 | The tripwire needs an allowlist or a follow-on |
| A4 | The pre-existing red in `lib/memory/userpromptsubmit-integration.test.cjs` Test 8 ("tier_0 fallback leaves Phase 83 intent classifier path intact") is not caused by the isolated-HOME env used at research time | Environment | The baseline must be re-recorded at plan time without and with isolation |

## Open Questions (RESOLVED)

1. **Should 360 also add the 0-observed binary framings (`A peer session sent a message while you were working:`, `<teammate-message`)?**
   - What we know: they are real Claude Code harness framings (binary constants). 0 occurrences in 30 days. R-A's rule is observed-only.
   - RESOLVED: No. Keep R-A's evidence rule and record them as a follow-on candidate. The 37-char peer stem already covers both `Another Claude session ...` variants.
2. **Does 357-07 keep the peer LCP?**
   - What we know: the LCP measured here is 40 chars including `\n<`.
   - RESOLVED: 360's R5 edit replaces the peer entry with the 37-char stem regardless, and the 357 replay proves no flip (D-11).
3. **Auto-continuation (`origin.kind:'auto-continuation'`, 16 in 30 days, 1 in the snapshot, 0 fires)?**
   - RESOLVED: Out of scope (deferred). Under lead-only it stays non-harness, which is today's behavior.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | hook + tests | yes | v22.23.1 | - |
| Claude Code (for A1 grounding) | research only | yes | 2.1.280 | - |
| R-D snapshot `~/.cache/mindrian-dev/357-raw/` | R7 local replay | yes, `sha256sum -c` all OK (4 sessions + intercept log) | 2026-09-23 | SKIP with a stated reason |
| `lib/hmi/turn-text.cjs` 357-07 API | R4/R5 | **no** (357 not executed) | - | none: HALT (D-19) |
| `tests/run-all-357.sh` + `tests/fixtures/card-fire-replay/baseline.json` | R5 acceptance | **no** | - | none: HALT |
| git (archive for `PLAN_BASE` code root) | R3 byte-identical | yes | - | - |

**Missing dependencies with no fallback:** 357-01, -02, -05, -07, -09 outputs. 360 execution is gated on them.

**R3 / R9 baseline measured at research time** (isolated `HOME`/`MINDRIAN_HOME`/`CARD_FIRE_SIDECHANNEL_PATH`/`TMPDIR`, `</dev/null`, HEAD b0ce990dc; the planner re-records at `PLAN_BASE`):

| Suite | Result | Time |
|---|---|---|
| tests/test-209-primary-sidechannel.cjs | exit 0 (about 37 ok lines) | 0.3 s |
| tests/test-209-engine-arm-contract.cjs | exit 0 | 0.2 s |
| tests/test-225-answer-narrowing.cjs | exit 0, 4 checks | 0.6 s |
| tests/test-260917-binding-gate-offscope.cjs | exit 0, 4 checks | 1.3 s |
| tests/test-251-skeleton-split.cjs | exit 0 | 0.3 s |
| lib/memory/userpromptsubmit-integration.test.cjs | **exit 1, 13/14** (known red: Test 8) | 11.7 s |
| tests/test-248-room-bind-honest-return.cjs | 27/27 | 0.3 s |
| tests/test-248-room-bind-session-authoritative.cjs | 6/6 | 0.2 s |
| tests/test-room-bind-health-signal.cjs | ALL PASS | 0.5 s |
| tests/test-room-bind-stdio-session-fallback.cjs | ALL PASS | 0.4 s |

Other suites that spawn or require the classifier, useful as a wider regression net (not required by the SPEC): `tests/test-225-zero-score-gate.cjs`, `tests/test-225-gate-degrade.cjs`, `tests/test-226-session-binding-key-alignment.cjs`, `tests/test-260917-rooms-home-precedence.cjs`, `tests/test-binding-gate-degrade.test.cjs`, `lib/memory/room-classifier-strict-mode.test.cjs`, `tests/run-all-194.sh`, `tests/run-all-225.sh`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with `node:assert` plus bash aggregators (repo convention) |
| Config file | none; `tests/run-all-360.sh` is the aggregator (Wave 0) |
| Quick run command | `node tests/test-360-leads.cjs && node tests/test-360-harness-picker.cjs </dev/null` |
| Full suite command | `bash tests/run-all-360.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIND360-01 | Harness prompt in an unbound scoring session emits no room-resolution output and makes no side writes; the human control fires | integration (spawn) | `node tests/test-360-harness-picker.cjs --only r1` | no - Wave 0 |
| BIND360-02 | Harness turn does not invoke the binding consumer (spy: 1 call pre, 0 post); a following exact-label human turn binds | integration (spawn + preload spy) | `node tests/test-360-harness-picker.cjs --only r2` | no - Wave 0 |
| BIND360-03 | Human-origin fixture stdout byte-identical: `PLAN_BASE` archive vs HEAD; R3 suites no worse than baseline | integration + suite compare | `node tests/test-360-harness-picker.cjs --only r3 && bash tests/run-all-360.sh --r3-compare` | no - Wave 0 |
| BIND360-04 | No lead literal / `isMeta` comparison in intent-classifier; leads defined in exactly one file | static tripwire | `node tests/test-360-tripwire.cjs --only r4` | no - Wave 0 |
| BIND360-05 | 5 leads (plus both peer framing variants) return harness; a mid-text quote returns non-harness; Skill body returns typed; 357 replay still green | unit + replay | `node tests/test-360-leads.cjs && bash tests/run-all-357.sh` | no - Wave 0 (357 runner from 357) |
| BIND360-06 | Throwing export and missing export: the human turn fires unchanged, exit 0 | integration (preload) | `node tests/test-360-harness-picker.cjs --only r6` | no - Wave 0 |
| BIND360-07 | Snapshot replay: unbound harness 33 -> 0, human 2 -> 2, 0 human with a harness verdict; SKIP when absent | local replay | `node tests/test-360-snapshot-replay.cjs` | no - Wave 0 |
| BIND360-08 | Fixtures carry `sanitization_statement`; 0 hits for snapshot UUIDs, `uds:/run/user`, real peer names; no `.jsonl` added | static grep | `node tests/test-360-tripwire.cjs --only r8` | no - Wave 0 |
| BIND360-09 | No `lib/mcp/` path in 360's own commits; four MCP room-bind suites green | static + suites | `node tests/test-360-tripwire.cjs --only r9 && node tests/test-248-room-bind-honest-return.cjs` (plus the other 3) | partial (MCP suites exist) |

All legs run under 30 s except the R3 compare (about 15 s total, dominated by `userpromptsubmit-integration` at 11.7 s).

### Sampling Rate
- **Per task commit:** the quick run command, plus `node tests/test-360-tripwire.cjs`.
- **Per wave merge:** `bash tests/run-all-360.sh`.
- **Phase gate:** full suite green (known reds unchanged) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] 357 dependency halt check (D-19, plus Pitfall 1 additions)
- [ ] Record `PLAN_BASE` and the R3 baseline counts (isolated env), in the first SUMMARY
- [ ] `tests/fixtures/ups-harness-360/cases.json` plus the three preload stubs
- [ ] `tests/test-360-leads.cjs`, `tests/test-360-harness-picker.cjs`, `tests/test-360-tripwire.cjs`, `tests/test-360-snapshot-replay.cjs` (RED where applicable; R2 RED is the spy leg)
- [ ] `tests/run-all-360.sh` with isolated `HOME` for every leg

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | partial | The session binding file is written only by a human-turn answer (R2 guard); `session_id` comes from the hook stdin |
| V4 Access Control | yes | A peer or subagent must not be able to set this session's write scope (binding) or mint a gate the Stop hook enforces. Controls: the D-07/D-08 guards |
| V5 Input Validation | yes | Structural lead match only (`startsWith` on the trimmed text), never meaning; a fault falls back to today's behavior |
| V6 Cryptography | no | - |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A peer / subagent message read as the navigator's binding answer (write-scope hijack) | Spoofing / Elevation | D-08 guard; exact-match consumer already blocks lead-prefixed text (defense in depth) |
| A harness turn mints an F.8 gate that force-blocks the next Stop (the anchor false block) | Denial of service (of the conversation) | D-07 guard removes the minter |
| A human prompt wrongly classified harness, so a missed binding card | Spoofing (inverse) | Lead-only: 0 of 2,154 human prompts affected; fail toward human on any fault (R6) |
| Raw transcript content leaking into the repo via fixtures | Information disclosure | R8 sanitization and grep tripwire; the replay prints counts and tags only |
| A test run polluting live `~/.mindrian` state | Tampering | Isolated `HOME` / `MINDRIAN_HOME` / `CARD_FIRE_SIDECHANNEL_PATH` in every 360 leg (Pitfall 2) |

## Sources

### Primary (HIGH confidence)
- `https://code.claude.com/docs/en/hooks.md`: UserPromptSubmit input, common input fields, transcript-lag note, decision control (raw markdown, curl, 2026-09-23)
- Claude Code 2.1.280 binary (`~/.local/share/claude/versions/2.1.280`): UPS hook-input construction (`Vvn`, `THe`, `Hl`), peer framing constants (`O3`, `Qje`, `F_e`), harness tag list (`crn`)
- Repo code: `scripts/intent-classifier.cjs` (:340-411, :477-748, :2844-3025, :3293-3452, :3510-3891), `lib/hmi/turn-text.cjs`, `lib/workflow/session-binding-consumer.cjs:204`, `lib/hmi/f8-action-capture-cli.cjs:54-124`, `lib/core/card-fire-sidechannel.cjs:140-152`, `hooks/hooks.json:347+`
- Local measurements (scratchpad scripts, shape-only): the R-D snapshot attribution and counterfactual replay; the 30-day `~/.claude/projects/-home-jsagi/` lead census; the temp-fixture defect reproduction and stdout determinism

### Secondary (MEDIUM confidence)
- 357-CONTEXT D-07 / R-A, 357-RESEARCH Findings 1, 3, 4 and Patterns 3, 4, 357-07-PLAN Task 1 (planned API, not yet shipped)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- A1 / stdin shape: HIGH. Official docs and the installed binary agree.
- A2 / prompt form: MEDIUM. It cannot be observed directly, but the dual-form replay shows the design is correct under both candidate forms.
- A3 / transcript timing: unresolved by design. Docs say it may lag, and the recommendation removes the dependency.
- Guard placement: HIGH. Full read of `main()` and the entry block.
- Replay baseline: HIGH. The prototype reproduces the SPEC counts exactly.
- Pitfalls: HIGH for Pitfalls 2, 4, 5, 6 and 8 (verified); MEDIUM for Pitfalls 3 and 7 (depend on 357 execution).

**Research date:** 2026-09-23
**Valid until:** 2026-10-07 (Claude Code ships frequently; re-check the UPS input shape if the binary version changes before execution)
