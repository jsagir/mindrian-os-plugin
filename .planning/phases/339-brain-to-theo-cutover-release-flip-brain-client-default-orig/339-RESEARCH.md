# Phase 339: Brain-to-Theo cutover release - Research

**Researched:** 2026-09-03
**Domain:** Release engineering + cross-repo protocol cutover (one URL default, two cuts, one blocking human gate)
**Confidence:** HIGH on everything verified at HEAD `3782dbc7` / Theo `81dfac8`; MEDIUM on the two design recommendations that deviate from CONTEXT.md (D-01 version pair, D-13 memo premise)
**Plugin HEAD at research time:** `3782dbc7`, 309 commits ahead of `origin/main`, 0 behind
**Theo HEAD at research time:** `81dfac8` on `main`

---

## Summary

Every file:line cited in `339-CONTEXT.md` was re-verified at HEAD. **Zero drift in the code citations.** The alias map is still at `:1713-1722`, the pass-through at `:1743`, `recommendChain`'s send at `:1778`, the enrichment guards at `:471`/`:478`/`:493`, the refusal copy at `:260`/`:307`/`:370-373`, the matcher twins at `hooks/hooks.json:239,341`, the flip line at `brain-client.cjs:24`. The tree moved 14 commits under Phase 276 but touched none of this phase's surfaces.

Four things DID drift, and three of them change the plan:

1. **The version pair is wrong.** `release.sh` takes a bump MODE, not a version literal, and it increments from `plugin.json`'s CURRENT value, which is already `2.0.0-beta.16` because the previous release's Commit B pre-bumped it. Every released beta tag in this repo is ODD (`beta.1,3,5,7,9,11,13,15`) precisely because of this. The PREP cut is **v2.0.0-beta.17** and the FLIP cut is **v2.0.0-beta.19** under default flags, or **beta.17 / beta.18** if the PREP cut passes `--no-next-bump`. CONTEXT D-01's "beta.16 (prep) and beta.17 (flip)" is not reachable.
2. **D-10 already inverted.** Theo's `README.md` at commit `daa1e59` ALREADY prescribes `mindrian-brain` for MindrianOS users, already drops the `Authorization` header, and already forward-references `docs/339-NOTE-theo-desktop-connector-key.md` in THIS repo. That file does not exist. The cross-repo note is no longer an ask; it is a reciprocal artifact Theo's shipped README already cites and this repo currently 404s.
3. **D-14's source pointer is wrong.** SEED-004's latest dated `## UPDATE` is 2026-09-02 and it reads "not yet" on both legs. The 2026-09-03 re-measurement and its ruling live in the FLIP RECORD, not in the seed, and the ruling explicitly supersedes the 09-02 addendum on leg one. The 269-05 rewrite must read the flip record.
4. **Two silent-failure consumers are missing from D-03's list of three.** `lib/mcp/brain-router.cjs:307` reads `brainResult.next_gate.options[]`, a shape no Theo tool emits, and degrades to the Tier-2 heuristic with the disclosure suppressed. `lib/core/doctor/class-m-brain-smoke.cjs` layer 6 breaks THREE ways post-flip, not one.

**Primary recommendation:** Keep the two-cut shape, but move the alias-table SELECTOR entirely into the PREP cut so the FLIP cut stays exactly one line plus docblock plus CHANGELOG (an origin-keyed selector picks Theo's vocabulary automatically the moment line 24 changes, with no second edit). Add `class-m-brain-smoke.cjs`'s three constants and `test-245`'s hard pin to the FLIP cut, because those values must move in the same commit as line 24 or they are wrong on both sides of it. Add `brain-router.cjs` disclosure to the PREP cut as a fourth additive adaptation, or accept and document a silent Tier-3 degrade for the soak window.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two cuts, not one. A PREP release carries everything that is safe against BOTH Brains (the literal sweep, the two dual-shape adaptations, the refusal-copy amendment, the doc/connector changes, the 269-05 checklist rewrite, the schema-memo flush mechanism). A FLIP release then contains exactly `lib/core/brain-client.cjs:24` + the stale docblock at lines 4-7 + its CHANGELOG entry, so rollback of the flip is a one-line revert (or `MINDRIAN_BRAIN_URL` per install). Version numbers are `scripts/release.sh`'s call at cut time. Both cuts are human-held. *(Claude's discretion, flagged for override.)*
- **D-02:** Before either cut: push the commits `main` is ahead of `origin/main` (navigator directive). Phase 276 is executing in this same working tree; it pauses at a wave boundary for each cut so `verify-release` sees a clean tree. Every commit in this phase stages named files only (never `git add .`).
- **D-03 (locked):** Fold consumers 1 and 3 into the PREP release as ADDITIVE, incumbent-safe code; leave consumer 2 as-is. Consumer 1 is `BRAIN_PROBLEM_TYPE_ALIASES`, fixed by selecting the alias table's TARGET values from the resolved origin (`getBrainUrl()`). Consumer 3 is `_maybeCaptureEnrichmentMiss`, fixed by one additive arm reading `pr.score` and deriving groundedness from the `coverage` block, never collapsing `{matched:0,total:N>0}` with `{matched:0,total:0}`. Consumer 2 (`chain-recommender.cjs`) rides as-is because it degrades DISCLOSED.
- **D-04 (locked, pattern):** Every adaptation follows the already-shipped `brain_query` dual-shape branch (`brain-client.cjs:927-945`, commit `21fdd7bc`): guard on the shape, never on key presence; recognize both shapes in one block; keep the loud `_unrecognizedQueryShape` safety net.
- **D-05 (locked):** The FLIP release is gated by a `checkpoint:human-action gate="blocking"` task ordered after every automatable task and immediately before the task that runs `verify-release` and `release.sh`. The gate task makes ZERO repository writes and reads ONE cross-repo file read-only.
- **D-06 (locked):** The gate reads the subsection headed exactly `### Coverage re-measurement, 2026-09-03, and the ruling on it` inside `## 1. Authorization evidence` and requires literal greps for the pins, the figures, the coverage line and the ruling sentence `Coverage does NOT block Task 2, the flip`. "Held" is a successful gate outcome, not a stall.
- **D-06a (locked):** The 30 uncovered names bind Theo's Task 3, NOT the flip. Flip-day fact for the CHANGELOG and the tester note: `/mos:leadership` and due-diligence consults answer thinner through Theo until the 30 names are ingested; this is an honest-empty coverage block, not an error.
- **D-07 (locked):** The PREP release is NOT gated by the coverage ruling. Only the FLIP cut waits.
- **D-08 (locked):** Amend the refusal copy at `lib/core/refusal-messaging.cjs` so BOTH `unreachable` and `no_key` name the two-command update path verbatim from `.claude/includes/release-process.md:23-26`. Add a `tests/test-250-refusal-shapes.cjs` pin for the update path. State the honest limit: this copy cannot reach an install that has not updated.
- **D-09 (locked):** The prescribed Claude Desktop / Cowork direct-connector key stays `mindrian-brain`. Docs change ONLY the URL (`https://theo-mcp.onrender.com/mcp`, WITH the `/mcp` path) and drop the `Authorization` header. `BRAIN_TOOL_MATCHER` and its `hooks/hooks.json` twins are NOT touched.
- **D-10 (locked, escalation):** Write a cross-repo note `docs/339-NOTE-theo-desktop-connector-key.md` asking Theo's README to prescribe `mindrian-brain` for MindrianOS users. Session M does not edit Theo.
- **D-11 (discretion, adopted):** Testers get a STANDALONE cutover note at the flip release, plus one reminder at suspend minus one week. No suspend date promised before Theo 09-12 Task 3 fixes one. The note is a filed draft, not a send.
- **D-12:** No runtime site carries its own origin literal. Every runtime read derives from `getBrainUrl()` (`:1163`). Dated handoffs, RCAs and `.planning/debug/*` under `docs/` are historical records: leave them.
- **D-13:** `brain_schema` memo (`:1045-1070`) is keyed on the resolved origin. The FLUSH rides the FLIP cut, never the prep cut. `bin/mindrian-brain-mcp-client.cjs` tool descriptions drop "live Memgraph backend" / Pinecone / e5 wording and the `mode_signals` promise.
- **D-14:** Phase 269-05's six-item checklist is rewritten to the three real legs: (a) coverage re-measured live against a PINNED Brain count; (b) Theo Phase 06.2 live; (c) 09-12 infrastructure legs.
- **D-15:** On an installed session running the FLIP release, exercise `brain_stats` and `brain_ask`; run `probe-brain-contract.cjs` and record which legs invert; verify the enrichment queue captures on a Theo-shaped miss; report to Session T.

### Claude's Discretion

- Release shape (D-01) and tester comms (D-11).
- Alias mechanism: origin-derived table (preferred) over a one-shot retry on `PROBLEM_TYPE_NOT_FOUND`.
- Whether the schema-memo fix is key-by-origin, an exported `flushSchemaMemo()`, or both.
- Sweep granularity per file; where the update-path string lives (one constant, reused by refusal copy, doctor and docs).
- Wave layout: prep-release plans first, flip-release plans last, the human-action gate immediately before the flip cut.

### Deferred Ideas (OUT OF SCOPE)

- `lib/brain/chain-recommender.cjs` Theo-shape adaptation (`result.refusal`, `result.note` at `:633`, `step.commands` divergence logging).
- `data/brain-surface-contract.json` `error_semantics` and `indexes` v2 or annotation.
- Plugin paths that call `brain_write` / `ingest_framework` meeting Theo's `WRITE_PATH_DISABLED`.
- Widening Theo's read allow-list for count-store plans (Theo's navigator decision).
- Phase 269-05's entitlement-gate engineering.
- Theo README connector-key alignment (asked via D-10 note; Session T executes).
- Phase 267 (SDK v2 migration): still blocked upstream.
- Reviewed todos not folded: registry-drift gate keyed to F-shape; F7 rescope 212/213; never-git-stash rule; ingest skill-description insight into Brain; deck slide-count bug.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

`phase_req_ids` is null for Phase 339. No requirement family exists. Precedent: `254-CONTEXT.md` D-05 minted `WIRE-01..04` / `COMP-01..02` at plan time and `.planning/REQUIREMENTS.md:1107-1119` records the ratification. **Proposed family: `FLIP-01..FLIP-12`**, to be minted into `.planning/REQUIREMENTS.md` under a new `### Phase 339 - Brain-to-Theo cutover release (minted at plan time 2026-09-03)` heading, mirroring the Phase 254 and Phase 257 sections.

| ID | Requirement | Cut | Research support |
|----|-------------|-----|------------------|
| FLIP-01 | No runtime site resolves the Brain origin from its own literal; every one derives from `brain-client.cjs`'s exported `getBrainUrl()` or from a frozen constant that moves in the same commit as line 24 | PREP + FLIP | Sweep inventory below; `getBrainUrl` verified at `:1163` |
| FLIP-02 | `BRAIN_PROBLEM_TYPE_ALIASES` projects onto the vocabulary of the RESOLVED origin, and a `MINDRIAN_BRAIN_URL` change moves vocabulary and URL together | PREP | Theo ids verified in `recommend-chain.ts:44-48`; matching rule at `:320-321` |
| FLIP-03 | `_maybeCaptureEnrichmentMiss` captures a Theo-shaped readiness miss in BOTH Theo payload shapes (scored and refusal-only), and `{matched:0,total:0}` is never collapsed with `{matched:0,total:N>0}` | PREP | Theo payload verified at `orchestration-readiness.ts:446-449` and `:492-503`; `coverage.ts` status ordering |
| FLIP-04 | The `unreachable` and `no_key` refusal copy names the two-command update path, sourced from ONE shared constant that doctor and docs also read | PREP | `refusal-messaging.cjs:364-373`; `release-process.md:23-26` |
| FLIP-05 | `brain_schema`'s memo cannot serve a schema fetched from a different origin than the one currently resolved | PREP | `brain-client.cjs:1048-1070`; see the D-13 premise correction below |
| FLIP-06 | Desktop and Cowork connector docs name Theo's `/mcp` endpoint under the unchanged `mindrian-brain` key with no `Authorization` header, and every generated mirror is regenerated rather than hand-edited | PREP | `build-skill-mirrors.cjs` then `build-dist-bundles.cjs` chain, verified |
| FLIP-07 | `docs/339-NOTE-theo-desktop-connector-key.md` exists and states the egress-guard reason the key matters | PREP | Theo `README.md:135` already cites this path |
| FLIP-08 | Phase 269-05 Task 1's checklist reads the three real legs against live sources, and no item can read PASS while its real leg is unchecked | PREP | `269-05-PLAN.md` Task 1 verbatim; SEED-004 vs flip-record source conflict |
| FLIP-09 | The FLIP release cannot be cut until a human confirms Theo's coverage ruling, read live, with zero repository writes | FLIP | `checkpoints.md:191-221`; `269-05-PLAN.md` Task 1 precedent |
| FLIP-10 | `brain-client.cjs:24` resolves to `https://theo-mcp.onrender.com`, bare origin, and the docblock at `:4-7` no longer names the incumbent | FLIP | Theo `09-FLIP-RECORD.md` section 2 |
| FLIP-11 | `class-m-brain-smoke.cjs` layer 6 reports an honest verdict against Theo (canon origin, stats key, node floor all correct for the shipped default) | FLIP | Three-fold break documented below |
| FLIP-12 | An installed session running the FLIP release returns structured Theo answers through `brain_stats` and `brain_ask`, and the result is reported to Session T as 09-12 Task 2's resume signal | POST | Theo `09-12-PLAN.md` Task 2 `<resume-signal>` |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Binding directives extracted. The planner must verify compliance for every task.

| Directive | Source | Consequence for this phase |
|---|---|---|
| **Workspace guard** | `CLAUDE.md:9-13` | Every commit, push and release runs from `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/*`. Post-release verification READS the install cache; it never writes there. |
| **Canon Part 8 (LOCAL -> BRAIN: NO)** | `CLAUDE.md:70` | The alias table carries problem-type handles only. The `/register` body carries `install_id` only (`brain-client.cjs:344`). Theo being keyless does not widen what may cross. |
| **Canon Part 11 (CIRS)** | `CLAUDE.md:75` | `scripts/check-shape-declaration.cjs` and `build-connector-registry.cjs --check` walk `commands/`, `skills/`, `agents/`. `bin/*.cjs` is OUT of both walks (verified: `build-connector-registry.cjs:77-79`, `check-shape-declaration.cjs:695-702`). Tool-description edits in the Brain shim therefore cannot break either gate. Editing `commands/setup.md` DOES require regenerating skill mirrors. |
| **Canon Part 12 (Pedagogy)** | `CLAUDE.md:76` | Refusal copy stays honest and short; do not add praise or a promise the copy cannot keep. |
| **Canon Part 7 (Reuse before build)** | `CLAUDE.md:73` | Do NOT mint a second origin resolver, a second update-path string, or a second alias map. Extend `test-254` Arms 4-5, do not rewrite them. |
| **CJS only, no TypeScript** | `CLAUDE.md:151` | Every new file in `lib/` or `scripts/` is `.cjs`. |
| **No em-dashes anywhere** | `CLAUDE.md:157` | `run-all-<phase>.sh` carries a `grep -P '\x{2014}'` fence; the phase runner must include every file this phase touches. |
| **Release lockstep, five gates** | `.claude/includes/release-process.md` | CHANGELOG + `plugin.json` + `package.json` + `git tag` + `~/mindrian-marketplace/.claude-plugin/marketplace.json`. Never bump by hand. |
| **GSD workflow enforcement** | `CLAUDE.md:179-189` | All edits inside plan tasks. |
| **QA / RCA standard** | `CLAUDE.md:192-199` | Any defect found mid-execution goes to `.planning/debug/<slug>.md` with `git add -f`, not an improvised bug note. |
| **Dev-research compositing** | `CLAUDE.md:201-217` | This research must ALSO land in `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked. Not done by this agent; it is a plan task. |
| **Theo standing consult** | `CLAUDE.md:254-268` | Theo's own files are authority for Theo's contract. Read the `{phase}-MOS-LEARNING.md` files before assuming a gap is unaddressed. Done; see Sources. |
| **langtalks consult** | `CLAUDE.md:226-232` | **Deliberately NOT consulted.** This phase is a wire-protocol and release-mechanics question, not an agent-design or memory-architecture one. Its corpus does not cover "what does this specific MCP server return". Calling it here would be picking a source by habit, which `CLAUDE.md:222-224` names as itself a research gap. |
| **Context7** | `CLAUDE.md:233-237` | Not needed. No Node/library API contract is in question; every claim here is about this repo's own code or Theo's own source. |

---

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Origin resolution | Plugin core (`brain-client.cjs` module scope) | none | One `const` at `:24`, read once at require time, exposed by `getBrainUrl()`. Every other tier must ask, never re-derive. |
| Problem-type vocabulary projection | Plugin core (`brain-client.cjs`) | Remote graph (Theo `DomainConcept` ids) | The remote owns the vocabulary; the plugin owns the projection onto it. Selecting the projection by origin puts both halves under one switch. |
| Readiness scoring | Remote graph (Theo `orchestration-readiness.ts`) | Plugin core (capture seam) | Theo computes and refuses to render a verdict (`NO THRESHOLD, NO VERDICT STRING`, `:130`). The plugin owns the threshold and the queue. |
| Refusal copy | Plugin core (`refusal-messaging.cjs`) | Every surface | One chokepoint for CLI, Desktop and Cowork. The update-path string must live once and be read from there. |
| Egress guard scope | Plugin hook (`part8-egress-guard-hook.cjs` + `brain-response-sanitize.cjs:61`) | `hooks/hooks.json:239,341` | Keyed on the CONNECTOR NAME, not the URL. This is why D-09 and D-10 are about the key and not the host. |
| Release lockstep | Release scripts (`release.sh`, `verify-release`) | Marketplace repo, npm registry, mindrian-os.com | Five surfaces, one entry point. Never bump by hand. |
| Cutover authorization | Theo repo (`09-FLIP-RECORD.md` section 1) | This repo's gate task (read-only) | The ruling is Session T's to write and Session M's to read. Session M never edits Theo. |
| Decommission | Render (operator) | Theo `09-12-PLAN.md` Task 3 | Out of this phase entirely. |

---

## HEAD Drift Report

**Method:** every `file:line` in CONTEXT.md's `<decisions>`, `<canonical_refs>` and `<code_context>` sections was re-read at plugin HEAD `3782dbc7` and Theo HEAD `81dfac8` on 2026-09-03.

### Code citations: ZERO drift

| Citation | Verified at HEAD | Evidence |
|---|---|---|
| `brain-client.cjs:4-7` docblock names incumbent + Memgraph + 2026-07-22 migration | YES | `:5` reads `` * `https://pws-brain-mcp.onrender.com` (Memgraph-backed, step 4 of the`` |
| `brain-client.cjs:24` the flip line | YES, byte-exact | `const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL \|\| 'https://pws-brain-mcp.onrender.com';` |
| `brain-client.cjs:337-346` `_tryAutoRegister` | YES | `fetch(\`${BRAIN_URL}/register\`)` at `:337`; failure string `'registration failed (HTTP ' + res.status + ', offline or unreachable)'` at `:346` |
| `brain-client.cjs:927-945` dual-shape branch | YES | `if (result && Array.isArray(result.rows))` at `:933`, `_unrecognizedQueryShape(result)` at `:938` |
| `brain-client.cjs:1045-1070` schema memo | YES | `let _schemaCache = null;` at `:1048`, `_schemaCacheAt` at `:1049`, `SCHEMA_CACHE_TTL_MS = 30 * 60 * 1000` at `:1050`, `async function schema()` at `:1056` |
| `brain-client.cjs:1163` `getBrainUrl` | YES, exact line | `function getBrainUrl() {` at `:1163` |
| `brain-client.cjs:1631` capture log | YES | `_logEventBestEffort(opts.db, 'enrichment_queue_captured', {` at `:1632`; the `if (captureResult && captureResult.queued)` guard at `:1631` |
| `brain-client.cjs:1713-1722` alias map | YES, exact | `const BRAIN_PROBLEM_TYPE_ALIASES = Object.freeze({` at `:1713`, closing at `:1722`, 8 keys |
| `brain-client.cjs:1743` pass-through | YES | `return trimmed;` at `:1743`, inside `_normalizeBrainProblemType` (declared `:1734`) |
| `brain-client.cjs:1778` `recommendChain` send | YES | `return callTool('recommend_chain', { problem_type: normalized, max_steps: steps });` |
| `enrichment-queue.cjs:465-493` | YES | `:465` the deployed-refusal-shape comment, `:471` `typeof pr.grounded === 'boolean'`, `:478` `typeof pr.readiness_score === 'number'`, `:493` `return { captured: false, reason: 'invalid_probe_result' };` |
| `chain-recommender.cjs:553-633` | YES | `_noteForCallToolResult` at `:548-557`, `chain.length === 0 -> 'unknown_problem_type'` at `:553`, `_disclosureOffer` at `:559-567`, `note: (typeof result.note === 'string') ? result.note : null` at `:632` |
| `refusal-messaging.cjs:260, 307, 370-373` | YES, all three | `:260` unreachable REASON, `:307` `unreachable: Object.freeze(['retry', 'continue_without'])`, `:370-373` `RENDER_COPY.unreachable` ending `'We can retry in a moment, or keep going with your room context.'` |
| `brain-response-sanitize.cjs:61` | YES | `const BRAIN_TOOL_MATCHER = 'mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain\|pws-brain-mcp)__.*';` |
| `hooks/hooks.json:239, 341` | YES, byte-identical twins | Both lines are `"matcher": "mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain\|pws-brain-mcp)__.*",` |
| `part8-egress-guard-hook.cjs:142-154` | YES | `if (!sanitizer.isBrainTool(toolName)) return allow();` at `:152`, fail-OPEN catch at `:153-155` |
| `test-254-normalize-roundtrip-probe.cjs:258-303` Arms 4-5 | YES | Arm 4 record at `:260`, the 8-key assert at `:278`, the 3-value assert at `:281-285`; Arm 5 record at `:307`, disjointness assert at `:315-320` |
| `class-m-brain-smoke.cjs:76` | YES | `const CANON_BRAIN_URL = 'https://pws-brain-mcp.onrender.com';` |
| `probe-brain-contract.cjs:74` | YES | `const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL \|\| 'https://pws-brain-mcp.onrender.com';` |
| `build-brain-census.cjs:61` | YES | Same literal, with a comment at `:59-60` that says it "mirrors lib/core/brain-client.cjs line 24" |
| Theo `recommend-chain.ts:27-47` ids, `:65-69` matching rule | YES | Ids enumerated at `:47`: `UnDefined`, `IllDefined`, `WellDefined`, `Wicked`, `Trinity`, `Compass`. Matching rule stated `:65-69`, implemented `:320-321` as `WHERE toLower(m.id) = toLower($problemType)` |
| Theo `orchestration-readiness.ts:494` | YES | `score: readinessScoreOf(inputs),` at `:494`, inside the payload at `:492-503` |
| Theo `09-FLIP-RECORD.md` heading at line 301 | YES, exact line 301 | `### Coverage re-measurement, 2026-09-03, and the ruling on it` |

### Four real drifts

**DRIFT-1 (blocks D-01 as written): the version pair is unreachable.**
`scripts/release.sh:88` usage is `bash scripts/release.sh [--prerelease | --finalize | --start-prerelease | patch | minor | major] [flags]`. It takes a bump MODE, never a version literal. `CLAUDE.md:83` says `scripts/release.sh <version>`; that line is stale. Step 1 (`:123-168`) reads `plugin.json`'s CURRENT version and runs `semver.inc(cur, 'prerelease', 'beta')`. Verified live:

```
current: 2.0.0-beta.16   ->  prerelease: 2.0.0-beta.17  ->  then: 2.0.0-beta.18
```

Step 7.5 (`:commit B`) then bumps `plugin.json` to the NEXT prerelease and rewrites the CHANGELOG heading to `[Unreleased] -- v<next>`. That is why every released beta tag in this repo is odd: `v2.0.0-beta.1, .3, .5, .7, .9, .11, .13, .15`. `~/mindrian-marketplace/.claude-plugin/marketplace.json` is at `2.0.0-beta.15`, matching the latest tag. `CHANGELOG.md:1` currently reads `## [Unreleased] -- v2.0.0-beta.16 (in progress)`, which is the pre-bumped label, NOT the version the next cut will carry.

Consequence: **PREP = v2.0.0-beta.17, FLIP = v2.0.0-beta.19** under default flags. Passing `--no-next-bump` on the PREP cut leaves `main` HEAD at beta.17 and makes the FLIP cut **v2.0.0-beta.18**. Recommend `--no-next-bump` on PREP: it burns no version number, keeps the pair adjacent, and the FLIP cut's own Commit B then reopens the series normally.

**DRIFT-2 (inverts D-10): Theo's README already did the ask.**
Theo commit `daa1e59` rewrote `README.md`. Lines 127-137 now read, verbatim: *"If you already run the MindrianOS plugin, keep your connector key as `mindrian-brain` and change only the URL. Point it at `https://theo-mcp.onrender.com/mcp`, with no `Authorization` header. The `theo` key in the example above is for standalone Theo use... The plugin side records this in `docs/339-NOTE-theo-desktop-connector-key.md` in the MindrianOS-Plugin repo."* That path does not exist in this repo (`ls` returns "No such file"). D-10's escalation is satisfied on Theo's side; the remaining work is to WRITE the note Theo already points readers at. Keep the note, change its framing from "an ask" to "the reciprocal record".

**DRIFT-3 (redirects D-14 leg a): SEED-004's latest UPDATE is stale by one day.**
`/home/jsagi/Theo/.planning/seeds/SEED-004-brain-content-parity-blocks-the-pws-brain-cutover.md` has exactly four `## UPDATE` sections; the latest is `## UPDATE 2026-09-02`, and it concludes "The two legs do not disagree, both say not yet." The 2026-09-03 re-measurement is NOT in the seed. It is in `09-FLIP-RECORD.md:301-470`, and ruling clause 1 says explicitly: *"This supersedes the 2026-09-02 addendum's 'do not schedule the flip yet' on leg one."* CONTEXT D-14's instruction to read "SEED-004 latest dated `## UPDATE` (never from the 09-02 addendum)" is self-contradictory at HEAD, because the latest dated UPDATE IS the 09-02 one. The 269-05 rewrite must cite the flip record subsection.

**DRIFT-4 (adds to D-03): two consumers missing from the list of three.** See "Silent-Failure Consumers Not In D-03" below.

**Minor drift, non-blocking:** CONTEXT D-02 says 295 commits ahead; measured 309 after `git fetch origin main` (0 behind). Theo's flip record section 2 pins plugin HEAD `a659068a`; HEAD is now `3782dbc7`. The line is still at 24 and still byte-exact, verified directly rather than assumed. ROADMAP Phase 339 item 3 quotes Theo at "1252 nodes / 1518 rels / 419 named Frameworks"; the 09-03 ruling measured 1,253 / 1,522 / 420. Use the ruling's numbers.

---

## The Literal Sweep, Sized and Classified

**Measurement:** `grep -rIn 'pws-brain-mcp\.onrender\.com'`, excluding `node_modules/` and `.git/`: **93 hits across 52 files.**

| Class | Files | Hits | Disposition |
|---|---:|---:|---|
| Runtime origin resolution (must derive from `getBrainUrl()`) | 5 | 5 | Change |
| Runtime constant that must move WITH line 24 | 1 | 1 | Change, in the FLIP cut |
| Runtime user-facing string | 1 | 1 | Change |
| Comment-level reference in runtime code | 5 | 5 | Change (prose only) |
| User-facing connector docs (URL change per D-09) | 6 source + 4 generated | 22 | Change source, REGENERATE mirrors |
| Test hard-pin that fails on the flip | 1 | 2 | Change, in the FLIP cut |
| Fixtures | 2 | 4 | Change |
| Generated census artifacts | 2 | 2 | LEAVE (see below) |
| Reference / architecture docs | 6 | 7 | Change |
| CLAUDE.md | 1 | 2 | Change |
| Historical records (dated handoffs, RCAs, autopsies, testers outbox, CHANGELOG history, superpowers specs) | 22 | ~42 | LEAVE |

### Runtime sites, exact

| File:line | Current | Disposition |
|---|---|---|
| `lib/core/brain-client.cjs:24` | the const itself | **FLIP cut.** The one required change. |
| `lib/core/brain-client.cjs:5` | docblock | **FLIP cut**, same commit (flip record section 2 says so explicitly). |
| `lib/core/doctor/class-m-brain-smoke.cjs:76` | `const CANON_BRAIN_URL = '...'` | **FLIP cut.** Not derivable from `getBrainUrl()` without destroying the check. See the three-fold break below. |
| `scripts/probe-brain-contract.cjs:74` | own `BRAIN_URL` const | PREP: `require('../lib/core/brain-client.cjs').getBrainUrl()`. Env override already honored by that resolver, so behavior is identical. |
| `scripts/build-brain-census.cjs:61` | own `BRAIN_URL` const | PREP: same. Its own comment at `:59` already says it "mirrors line 24", which is the duplication D-12 removes. |
| `scripts/session-start:1896` | `echo "Brain: HTTP client active (pws-brain-mcp.onrender.com)"` | PREP. **Not in CONTEXT D-12's list.** This is a bash script printing a user-visible banner. It is prose (the surrounding comment at `:1889-1891` says so), but it is prose a user READS on every session start, and it will name the wrong host post-flip. Recommend deriving it: `node "$PLUGIN_ROOT/lib/core/brain-client.cjs"` has no CLI, so the cheapest honest fix is to drop the host from the banner entirely (`Brain: HTTP client active`) rather than shell out for a string. |
| `lib/core/mcp-profiles.cjs:22` | comment | PREP, prose only |
| `lib/core/enrichment-queue.cjs:465` | comment describing the incumbent refusal shape | PREP, prose; must be rewritten anyway as part of FLIP-03 |
| `scripts/rs-experts-command.cjs:10`, `scripts/rs-thesis-command.cjs:10` | comments | PREP, prose only |
| `scripts/sessionstart-post-update-preflight.cjs:38` | comment | PREP, prose only |

### Tests and fixtures

| File:line | Fact | Disposition |
|---|---|---|
| `tests/test-245-skill-frontmatter-inert-keys.cjs:127-131` | **HARD ASSERT**: `assert.ok(url === 'https://pws-brain-mcp.onrender.com', ...)` where `url` is regex-extracted from `brain-client.cjs`'s `const BRAIN_URL` line. Its own failure message says *"If the backend genuinely moved, update this test AND CLAUDE.md together - that pairing is the entire point of this claim."* | **FLIP cut, same commit as line 24 and CLAUDE.md.** This test is a tripwire built for exactly this event and it must be honored, not defeated. Note the extraction regex `/const BRAIN_URL = [^\n]*'(https:\/\/[^']+)'/` also constrains any refactor of line 24: keep the line's shape. |
| `tests/test-245-skill-frontmatter-inert-keys.cjs:32` | comment | FLIP cut, prose |
| `lib/core/doctor/class-m-brain-smoke.test.cjs:74, 333, 365` | `mockBrainUrl: () => 'https://pws-brain-mcp.onrender.com'` and `assert.equal(L6pass.payload.endpoint, ...)` | These are INJECTED mocks, not reads of the live default. They stay green through the flip on their own. They must be updated in the FLIP cut anyway because they pair with `CANON_BRAIN_URL`: with the constant moved, a mock returning the incumbent now exercises the not-canon branch, silently inverting what the test proves. |
| `tests/fixtures/246-census-fixture.json:6, 173` | `"brain_url"` in a census fixture; consumer is `tests/test-246-census-render.cjs` | PREP or FLIP, low risk either way. Recommend FLIP, paired with `data/brain-census.generated.json`, so the fixture keeps matching the artifact shape it models. |

### Generated artifacts: LEAVE, and say why in writing

`data/brain-census.generated.json:4` and `docs/BRAIN-GRAPH-CENSUS.generated.md` both carry `brain_url`. Their sole generator is `scripts/build-brain-census.cjs` (verified: `MD_PATH`/`JSON_PATH` at `:56-57`, `GENERATED_NOTE` at `:59-60`).

Three facts make re-running it wrong for this phase:
1. Its header (`:26-35`) states it has **NO `--check` release gate** by design, because "a release gate must never depend on live network". Verified: `grep build-brain-census scripts/verify-release` returns nothing. A stale census therefore blocks no gate.
2. Lane B requires an operator-supplied ADMIN key (`:36-39`). Theo has no admin key and `brain_write` returns `WRITE_PATH_DISABLED` (Theo `09-MOS-LEARNING.md:104-107`).
3. Re-running Lane A against Theo would replace a census of the incumbent's 29,200-node graph with a census of Theo's 1,253-node graph, silently discarding the record the 2026-08 phases were measured against.

**Recommendation:** leave both files untouched and add ONE dated line to `docs/BRAIN-GRAPH-CENSUS.generated.md`'s prose... except that file is `GENERATED - do not hand-edit`. So instead: record the disposition in the phase's CHANGELOG entry and in `docs/339-NOTE-theo-desktop-connector-key.md`, and register "re-census against Theo" as a deferred item. Do NOT hand-edit either artifact.

### The `dist/` generation chain, in required order

`dist/` is GENERATED and COMMITTED. Sole writer: `scripts/build-dist-bundles.cjs` (header `:24-28`: "GENERATE, NEVER HAND-EDIT. Everything under dist/ is output. This file is the sole writer"). `.gitignore:71` records the same rule.

The full chain, verified, and it has TWO stages, not one:

```
commands/setup.md            (SOURCE, hand-edited)
  -> node scripts/build-skill-mirrors.cjs        (writes skills/setup/SKILL.md)
skills/pws-brain/SKILL.md    (SOURCE, hand-authored, NOT a command mirror)
  -> node scripts/build-dist-bundles.cjs         (writes dist/generic-claude-dir/ and dist/zed/)
```

- `scripts/build-skill-mirrors.cjs:19-23`: "commands/ STAYS THE SINGLE SOURCE OF TRUTH (read-only here)". So `skills/setup/SKILL.md` must NEVER be hand-edited; edit `commands/setup.md` and regenerate.
- `verify-release` gate **10b** runs `node scripts/build-skill-mirrors.cjs --check` and **FAILS** the release on drift (`verify-release:328-334`). This is a hard gate. Editing `commands/setup.md` without regenerating breaks the release.
- `skills/pws-brain/SKILL.md` is hand-authored (it is not a mirror of `commands/pws-brain.md` byte-for-byte; both carry the same retired-harness `reason:` string and both must be edited). Verify against the mirror `--check` output rather than assuming.
- `build-dist-bundles.cjs --check-stale` is **NOT wired into `verify-release`, `release.sh`, or `doctor --acceptance`** (verified by grep across all three). `dist/BUNDLE-VERSION.json` currently reads `source_version: 2.0.0-beta.16`, matching `plugin.json`, so it is fresh today. Nothing will catch it if the phase forgets to regenerate. **This is a Wave 0 test gap** (see Validation Architecture).

---

## Silent-Failure Consumers Not In D-03

D-03 enumerates three consumers. There are five. The two additions are both real and both verified at HEAD.

### Consumer 4: `lib/mcp/brain-router.cjs` Tier 3, silent degrade to heuristic

`brain-router.cjs:307-309`:

```js
const options = (brainResult.next_gate && Array.isArray(brainResult.next_gate.options))
  ? brainResult.next_gate.options
  : [];
```

and `:310-312` reads `brainResult.directive.guided.framework`. Neither `next_gate` nor `directive` is emitted by any Theo tool (`docs/254-NOTE-theo-adaptation-list-additions.md` section 2 records the grep: `grep -rn "next_gate" /home/jsagi/Theo/src/mcp/content/*.ts` returns nothing, confirmed 2026-09-02).

Post-flip: `options` is `[]`, `anchorFramework` is `null`, `rawChain` stays empty, `brainRoute()` returns `null`, and `recommend()` falls through to the Tier-2 local heuristic. The Phase 252-01 disclosure at `:411-429` does NOT fire, because it is conditioned on `!brainClient.isAvailable()` and availability is still true (verified: `:429`). **This is a second TRUE silent failure**, of the same class D-03 calls out for consumer 3, and it is not in D-03's list.

Nuance that lowers its severity: the shim wraps `brain_ask` in a `wrapDirective` DirectiveEnvelope (`bin/mindrian-brain-mcp-client.cjs:197-199`), so the CLI path may still see a `directive` skeleton even when Theo's payload has no `mode_signals` (which `:198` degrades to `{}` harmlessly). What it will NOT see is `next_gate.options`, which is what the ranked chain is built from.

**Recommendation:** one additive disclosure in the PREP cut, not a shape adaptation. Change `brain-router.cjs`'s Tier-3 miss so a `brainResult` that arrived but carried no `next_gate` sets a distinct, disclosed note (the `_noteForCallToolResult` closed-vocabulary idiom `chain-recommender.cjs:548-557` already establishes) rather than being indistinguishable from "Brain never answered". Incumbent-safe by construction: the incumbent always carries `next_gate`, so the new branch cannot fire against it. If the navigator prefers to keep the flip cut minimal, the alternative is to accept the degrade and NAME it in the CHANGELOG and the tester note, which is worse but honest.

### Consumer 5: `lib/core/doctor/class-m-brain-smoke.cjs` layer 6 breaks THREE ways

CONTEXT D-12 names only `CANON_BRAIN_URL` at `:76`. Layer 6 (`_layer6`, `:299-358`) has three incumbent-shaped dependencies:

| `:line` | Constant / read | Value | Post-flip result |
|---|---|---|---|
| `:76` | `CANON_BRAIN_URL = 'https://pws-brain-mcp.onrender.com'` | incumbent | `canon` is `false`, `override` is `false` (no env var set) -> `:311` returns `{ok:false, reason:'endpoint is neither canon nor an explicit override'}` and the layer exits BEFORE any of the following runs |
| `:318` | `statsResult.totalRecordCount` | incumbent's `brain_stats` field | Theo's `brain_stats` returns `{nodes, relationships, labels, diagnostics}` (verified: `brain-stats.ts:211-216`). No `totalRecordCount` at all -> `{ok:false, reason:'brain_stats carried no usable totalRecordCount'}` |
| `:77` | `CANON_NODE_FLOOR = 29000` | the incumbent's 29,200 | Theo is 1,253 nodes -> below floor by 23x |
| `:78` | `STALE_REPLICA_NODE_COUNT = 28325` | retired replica signature | Theo cannot collide with it. Confirmed safe. |
| `:86-87` | `GRAPHRAG_STAMP_CYPHER` matches `(m:GraphRagMeta)` | incumbent label | Honest empty on Theo; `:340-352` degrades silently by design. No change needed. |

**Does this block a release?** No, and the reason matters. `scripts/doctor.cjs:1402-1417` hard-fails the acceptance arm on exactly two conditions: the `store_identity` layer being ABSENT from the payload, or its reason matching `/stale_replica_signature/`. Any other not-ok is "carried into detail as information only and does NOT flip ok" (`:1400-1401`). So the flip will not brick the release train. It WILL leave doctor's store-identity sense permanently red on a real signal, which is exactly the honesty failure Key Decision 8 and Phase 250's HONEST-01 exist to prevent, and it destroys the sense's ability to detect a genuinely wrong endpoint later.

**Recommendation:** all four constants (`CANON_BRAIN_URL`, `CANON_NODE_FLOOR`, `STALE_REPLICA_NODE_COUNT` review, and the `totalRecordCount` read) move in the FLIP cut, alongside line 24, plus the paired mock updates in `class-m-brain-smoke.test.cjs:74,333,365`. Design note for the stats read: follow D-04 and guard on shape, recognizing both `{totalRecordCount}` and `{nodes}` in one block, so the layer works either side of a rollback:

```js
const nodeCount = (typeof statsResult.totalRecordCount === 'number') ? statsResult.totalRecordCount
                : (typeof statsResult.nodes === 'number') ? statsResult.nodes
                : null;
```

`CANON_NODE_FLOOR` cannot be dual-valued the same way; recommend making it a per-origin constant selected the same way the alias table is (below), so one mechanism serves both and a rollback moves the floor with the URL.

---

## Design 1: The Origin-Derived Alias Table (D-03 consumer 1)

### The ground truth

Theo's ids, verbatim from `recommend-chain.ts:47`: `UnDefined`, `IllDefined`, `WellDefined`, `Wicked`, `Trinity`, `Compass`.

Theo's matching rule, verbatim from `:65-69` and implemented at `:320-321`:
> "MATCHING IS CASE-INSENSITIVE AND NOTHING MORE. `toLower(m.id) = toLower($problemType)`. No trimming, no hyphen folding, no suffix stripping, no fuzzy fallback."

Theo's own header names this as PLUGIN-SIDE work, not a Theo defect (`:59-66`): *"Until `BRAIN_PROBLEM_TYPE_ALIASES` is re-pointed at Theo's ids, every plugin call through that path reaches Theo with a value nothing matches and gets the honest-empty answer."*

The unknown-type response, verbatim from `:533-547`: a SUCCESS carrying `chain: []`, `available_problem_types`, `refusal: {code: 'PROBLEM_TYPE_NOT_FOUND', detail: ...}`, `evidence`, `coverage: coverageFrom(0, problemTypeTotal)`, `diagnostics`. The `isError` key is ABSENT (`:26-31`, and a unit test pins the absence).

### The current map at `:1713-1722` and its exact post-flip fate

| Local key | Current target | Theo `toLower` match? |
|---|---|---|
| `undefined`, `udp` | `Undefined Problem` | NO. `undefined problem` is not `undefined`. Falls to `PROBLEM_TYPE_NOT_FOUND`. |
| `ill-defined`, `ill_defined`, `idp` | `Ill-Defined Problem` | NO |
| `well-defined`, `well_defined`, `wdp` | `Well-Defined Problem` | NO |
| (unmapped) `Wicked` | passes through at `:1743` | YES. `toLower('Wicked') === toLower('Wicked')`. Works today. |
| (unmapped) `Trinity`, `Compass` | pass through | YES, if a local sensor ever emits them |

CONTEXT's finding is confirmed exactly: an UNMAPPED `Undefined` would match Theo's `UnDefined` case-insensitively, and the map itself is what breaks the match.

### Recommended mechanism

Two frozen tables plus one origin-keyed selector. **The whole mechanism ships in the PREP cut and needs ZERO edit in the FLIP cut**, because the selector reads `BRAIN_URL` and picks Theo automatically the moment line 24 changes. That keeps the FLIP cut at exactly one line plus docblock plus CHANGELOG, which is D-01's whole point.

```js
// Theo's live DomainConcept ids, verbatim from
// /home/jsagi/Theo/src/mcp/content/recommend-chain.ts:47. Matching there is
// toLower(m.id) = toLower($problemType) and NOTHING MORE (:65-69): no suffix
// folding, so the incumbent's 'Undefined Problem' matches nothing on Theo.
const BRAIN_PROBLEM_TYPE_ALIASES_INCUMBENT = Object.freeze({
  'undefined': 'Undefined Problem',
  udp: 'Undefined Problem',
  'ill-defined': 'Ill-Defined Problem',
  ill_defined: 'Ill-Defined Problem',
  idp: 'Ill-Defined Problem',
  'well-defined': 'Well-Defined Problem',
  well_defined: 'Well-Defined Problem',
  wdp: 'Well-Defined Problem',
});

const BRAIN_PROBLEM_TYPE_ALIASES_THEO = Object.freeze({
  'undefined': 'UnDefined',
  udp: 'UnDefined',
  'ill-defined': 'IllDefined',
  ill_defined: 'IllDefined',
  idp: 'IllDefined',
  'well-defined': 'WellDefined',
  well_defined: 'WellDefined',
  wdp: 'WellDefined',
});

// A SET, not a single literal, so a Theo staging origin is a one-line
// addition rather than a re-architecture. Anything not in this set gets the
// incumbent vocabulary, which is the correct default for as long as line 24
// names the incumbent and is the conservative default afterwards.
const THEO_ORIGINS = Object.freeze(['https://theo-mcp.onrender.com']);

function _brainProblemTypeAliases() {
  return THEO_ORIGINS.indexOf(BRAIN_URL) !== -1
    ? BRAIN_PROBLEM_TYPE_ALIASES_THEO
    : BRAIN_PROBLEM_TYPE_ALIASES_INCUMBENT;
}
```

`_normalizeBrainProblemType` (`:1734-1744`) changes two lines: `const table = _brainProblemTypeAliases();` then `hasOwnProperty.call(table, lc)` / `return table[lc];`. The pass-through `return trimmed;` at `:1743` is UNCHANGED, which is what keeps `Wicked` / `Trinity` / `Compass` working on both origins and keeps Arm 4's structural proof valid.

**Why not the retry-on-`PROBLEM_TYPE_NOT_FOUND` alternative** (the discretion option D-03 names): it costs a second round trip on every miss, it makes a vocabulary bug invisible by papering over it at runtime, and it breaks the "a `MINDRIAN_BRAIN_URL` revert moves vocabulary and URL together" property the origin-keyed table gives for free. The `available_problem_types` block is still valuable, but as diagnostics in a log line, not as a control-flow retry.

**Part 8 check:** the tables carry problem-type handles only. `PROBLEM_TYPE_HANDLE_RE` (the shape gate at `:1737`) is untouched, so the enum-only wire enforcement quick-260819-c8j installed still holds.

### How `test-254` Arms 4 and 5 must change

Arm 4 (`:260-303`) currently: extracts ONE literal named `const BRAIN_PROBLEM_TYPE_ALIASES = Object.freeze(`, asserts exactly 8 keys, asserts the 3 target values are the incumbent names, then proves pass-through structurally by asserting `lastIndexOf('return trimmed;') > indexOf('BRAIN_PROBLEM_TYPE_ALIASES[lc]')`.

Required changes, all inside the existing arm (extend, do not rewrite, per the CONTEXT reusable-assets note):

1. The `extractObjectLiteral` helper is called with a literal declaration prefix. It must now be called TWICE, once per table name. Verify `extractObjectLiteral`'s implementation tolerates the new names (it takes the prefix string as an argument, so it does).
2. Assert BOTH tables carry exactly the same 8 keys, and assert the key SETS are identical between the two. A key present in one and missing from the other is the drift this arm now has to catch.
3. Assert incumbent values are exactly `['Ill-Defined Problem','Undefined Problem','Well-Defined Problem']` (unchanged) and Theo values are exactly `['IllDefined','UnDefined','WellDefined']`.
4. Assert every Theo value is a member of the live Theo id list. Source that list from a frozen array in the test with a comment citing `recommend-chain.ts:47`, NOT from a live read (the test is hermetic by design; its own header at `:262-276` states the hermetic constraint).
5. Replace the `BRAIN_PROBLEM_TYPE_ALIASES[lc]` structural probe with `table[lc]` (or whatever the new accessor is named) and keep the ordering assertion: the pass-through `return trimmed;` must still come AFTER the table lookup.
6. **New assertion:** the selector must key on the module's resolved origin. Structural proof, matching the arm's own idiom: assert the `_brainProblemTypeAliases` function body contains `BRAIN_URL` and contains both table identifiers. This proves vocabulary and URL are wired to one switch without invoking an unexported function.
7. **Delete the stale STATED DECISION comment at `:261-276`**, which currently says the map is NOT re-pointed and explains why. That reasoning is superseded by this phase. Replace it with the new decision and cite Phase 339.

Arm 5 (`:307-325`) currently proves value disjointness between `BRAIN_PROBLEM_TYPE_ALIASES` and `chain-recommender.cjs`'s `PROBLEM_TYPE_ALIASES` (which targets local router codes `UDP`/`IDP`/`WDP`, consumed by `problem-type-router.cjs`). Required change: compute the union of BOTH brain tables' values and assert the union is disjoint from the local map's values. Verified today that `UDP`/`IDP`/`WDP` collide with neither incumbent names nor Theo ids, so the assertion holds; the point is to keep it holding across a future edit to either table.

---

## Design 2: The Additive Enrichment Arm (D-03 consumer 3)

### Theo's readiness payload has TWO shapes, not one. D-03 addresses only the first.

**Shape A, resolved framework** (`orchestration-readiness.ts:492-503`):
```
{ framework, score: <0..4>, inputs: {has_structure, has_ordering, has_technique, pattern_known},
  evidence: {structure_components, ordering_edges, technique_links, orchestration_status},
  unsynced_inputs: ['pattern_known'], coverage: {matched:1, total:<live>, status}, diagnostics }
```

**Shape B, unresolvable name or race** (`:446-449` and `:479-486`):
```
{ coverage: {matched:0, total:<live>, status:'empty'}, refusal: {code, detail}, diagnostics }
```
with `score`, `inputs`, `evidence` and `framework` **OMITTED ENTIRELY**. Theo's header states the reason at `:92-101`: *"`score: 0` is a CLAIM ... about a Framework that does not exist. An absent key says nothing, which is the only honest thing to say."*

Refusal codes on Shape B come from `resolveFramework`: `FRAMEWORK_NOT_FOUND`, `ALIAS_CYCLE`, `ALIAS_FORK`, and two more (`:106-113`).

An `else if (typeof pr.score === 'number')` arm alone therefore leaves Shape B falling through to `invalid_probe_result` at `:493`. Shape B is arguably the MOST important miss to capture: "this framework does not exist in canon by that name" is exactly what the enrichment queue is for. **The plan needs TWO additive arms, not one.**

### The score semantics, precisely

`readinessScoreOf` (`:344-350`) is the plain sum of four booleans, range 0..4. But `pattern_known` is `orchestration_status === PROMOTED_ORCHESTRATION_STATUS`, and Theo's own header says (`:44-46`) *"THE ANSWER WILL BE `false` FOR VIRTUALLY EVERY FRAMEWORK ... promotion has run for one Framework."* So the practical Theo ceiling is **3**, not 4.

The existing incumbent threshold is `if (pr.readiness_score > 2) return not_a_miss` (`enrichment-queue.cjs:479`), and `isValidReadinessScore` accepts `0..4` (`:186-188`). A Theo score of 3 is the achievable maximum and correctly reads as not-a-miss; a score of 2 is a genuine miss. So the `> 2` threshold ports as-is with no arithmetic change. **Say this explicitly in the code comment** so a future reader does not "fix" a threshold that is already correct.

### The dimensions mapping is exact, and better than the incumbent's

`ALLOWED_DIMENSIONS` (`enrichment-queue.cjs:74`) is `['pattern_type', 'structure', 'techniques', 'flow']`. Theo's four inputs map one-for-one:

| `ALLOWED_DIMENSIONS` | Theo `inputs` key | Theo's live layer (`:52-73`) |
|---|---|---|
| `structure` | `has_structure` | `HAS_PHASE\|HAS_STAGE\|HAS_PROCESS_STEP` |
| `flow` | `has_ordering` | `LEADS_TO` |
| `techniques` | `has_technique` | `HAS_TECHNIQUE` |
| `pattern_type` | `pattern_known` | `orchestration_status` |

This is strictly better than the incumbent path, which falls back to `inferMissingDimensionsFromScore` (`:426-432`) and produces a positional guess with `dimensions_inferred: true`. Against Theo, `dimensions_inferred` should be **`false`**, because the vector is exact.

**One honesty subtlety that must not be lost:** `unsynced_inputs: ['pattern_known']` declares that `pattern_known` is answered by Theo's own local proxy, not by the contract's source. Reporting `pattern_type` as a MISSING dimension on the strength of an input Theo itself flags as unsynced would queue enrichment for a gap that may not exist. **Filter any dimension whose Theo input appears in `unsynced_inputs`.**

### Recommended implementation

Insert after the existing `readiness_score` arm at `:478-492`, before the `else` at `:493`. Both new arms guard on SHAPE (D-04), and neither can be entered by an incumbent payload: the incumbent emits `grounded` or `readiness_score`, both caught by earlier arms, and emits no `coverage` block at all.

```js
} else if (typeof pr.score === 'number' && Number.isFinite(pr.score)
           && pr.inputs && typeof pr.inputs === 'object') {
  // Theo orchestration_readiness, RESOLVED shape. Guarded on the pair
  // (score, inputs) rather than on `score` alone: Theo omits `score`
  // entirely on its refusal branch (see the next arm), so a lone
  // typeof check would be a key-presence test in disguise.
  // Theo's practical ceiling is 3, not 4: pattern_known is declared
  // unsynced for virtually every Framework. The `> 2` threshold is
  // therefore already correct and must NOT be rescaled.
  if (pr.score > 2) return { captured: false, reason: 'not_a_miss' };
  readiness_score = Math.round(pr.score);
  const unsynced = Array.isArray(pr.unsynced_inputs) ? pr.unsynced_inputs : [];
  missing_dimensions = THEO_INPUT_DIMENSIONS
    .filter(function (m) { return pr.inputs[m.input] === false && unsynced.indexOf(m.input) === -1; })
    .map(function (m) { return m.dimension; });
  dimensions_inferred = false;   // exact vector, never inferred
  probe_provenance = 'orchestration_readiness_theo@' + nowTs;
} else if (pr.refusal && typeof pr.refusal === 'object'
           && pr.coverage && typeof pr.coverage === 'object'
           && typeof pr.coverage.matched === 'number'
           && typeof pr.coverage.total === 'number') {
  // Theo orchestration_readiness, REFUSAL shape: score/inputs/evidence
  // are OMITTED, and coverage carries the honesty. The two zeros are
  // DIFFERENT ANSWERS and are never collapsed:
  //   {matched:0, total:N>0} -> canon has N frameworks, none is yours. A MISS.
  //   {matched:0, total:0}   -> the layer itself is empty. NOT a miss about
  //                             this framework; queueing it would blame the
  //                             framework for an empty graph.
  if (pr.coverage.matched > 0) return { captured: false, reason: 'not_a_miss' };
  if (pr.coverage.total === 0) return { captured: false, reason: 'layer_empty' };
  readiness_score = null;
  missing_dimensions = ['structure'];
  dimensions_inferred = true;
  probe_provenance = 'orchestration_readiness_theo_refusal@'
    + (typeof pr.refusal.code === 'string' ? pr.refusal.code : 'unknown') + '@' + nowTs;
}
```

with the mapping as one frozen constant near `ALLOWED_DIMENSIONS`:

```js
const THEO_INPUT_DIMENSIONS = Object.freeze([
  Object.freeze({ input: 'has_structure', dimension: 'structure' }),
  Object.freeze({ input: 'has_ordering',  dimension: 'flow' }),
  Object.freeze({ input: 'has_technique', dimension: 'techniques' }),
  Object.freeze({ input: 'pattern_known', dimension: 'pattern_type' }),
]);
```

**Verified compatible with the storage contract:** `entry.source` is `'live_reach'` (`:502`), which is in `ALLOWED_SOURCES` (`:69`). `probe_provenance` is a free string (`:220`, `:355`). `readiness_score: null` passes `isValidReadinessScore` (`:186`). `normalized: pr.normalized !== false` yields `true` on a Theo payload that has no `normalized` key. `reason: 'layer_empty'` is a NEW value but `reason` is only ever a return field, never stored, so it needs no allowlist entry.

**Operational risk worth naming in the plan:** Theo's own header (`:66-70`) says 148 of 149 Frameworks have zero technique linkage and roughly 3 of 149 carry structure at all. Post-flip, nearly every `orchestration_readiness` call will score 0 or 1 and therefore capture. The queue is bounded (`SOFT_CAP = 500` warns, `HARD_CAP = 1000` rejects, `:47-48`) and `enqueue` de-duplicates by framework name with a `hit_count` bump (`:378`, `:397`), so the blast radius is capped at one entry per distinct framework. It is not a leak, but the soak-window observer should expect the queue to fill fast and should read that as canon thinness, not as a bug.

**The log line:** `brain-client.cjs:1634` logs `readiness_score: (typeof result.readiness_score === 'number') ? result.readiness_score : null`. Against a Theo payload that is always `null`, which makes the enrichment event unreadable. Add `result.score` as a second recognized shape in the same expression. One line, PREP cut, incumbent-safe.

**`_isCapturableResult` (`brain-client.cjs:1617`)** requires `!result.error`. Theo's honest-empty payloads carry `refusal`, not `error`, so they pass the gate. Theo's genuine failures go through `toToolError`. No change needed; verify this explicitly in the test rather than assuming it.

---

## Design 3: The Refusal Copy and the Single Update-Path Constant (D-08)

### Current copy, verbatim

`lib/core/refusal-messaging.cjs:370-373`, `RENDER_COPY.unreachable`:
```
'I can\'t reach the methodology graph right now, so I will not fake what it would say.',
'We can retry in a moment, or keep going with your room context.',
```

`:364-369`, `RENDER_COPY.no_key`:
```
'Methodology needs the Brain, and ' + _noKeyDetail(c) + '. I will not improvise it from memory.',
'We can keep working with your room context, or you can set a key at ~/.mindrian.env (chmod 600) or MINDRIAN_BRAIN_KEY as an override, then restart.',
```

`:256-258`, `REASONS.no_key`:
```
'Methodology needs the Brain for ' + c.tool + ', and ' + _noKeyDetail(c) + '. Larry will not improvise it from memory.'
```

`:250-252`, `_noKeyDetail(c)` returns `c.registration_reason` when it is a non-empty string, else `'registration has not completed (offline, or the attempt failed)'`. The stale-install string that actually reaches a user comes from `brain-client.cjs:346`: `'registration failed (HTTP ' + res.status + ', offline or unreachable)'`. A suspended incumbent returns a non-2xx, so a fresh stale install lands in `no_key` with `HTTP 503` or similar, exactly as D-08 states.

`:259-261`, `REASONS.unreachable`:
```
'The methodology graph is unreachable right now for ' + c.tool + ' (after the bounded retry budget). Larry will not fake what it would say.'
```

`:307`, `NEXT_MOVES.unreachable` is `Object.freeze(['retry', 'continue_without'])`.

### What `test-250-refusal-shapes.cjs` pins today

189 lines, seven tests. Relevant pins:
- `:61` `REFUSAL_KINDS` deep-equals `['no_key','unreachable','tier_denied','not_ready','rate_limited','egress_blocked']` and is frozen.
- `:72` `no_key.status === 'DIRECTOR_NOT_AVAILABLE'` (byte-locked wire string), `:73` `no_key` carries `upgrade_hint`.
- `:80-81` `unreachable.status === 'BRAIN_UNREACHABLE'` and it must NOT carry `upgrade_hint`.
- `:96` unreachable's reason must NOT include `'MINDRIAN_BRAIN_KEY not set'`; `:97` it must match `/reach|unreachable/i`.
- `:127` `tier0Response` keys deep-equal exactly `['command_context','fallback_advice','reason','status','upgrade_hint']`.
- `:129` `fallback_advice` matches `/Larry/`; `:130` must not contain `'Larry can still talk with you'`.
- `:140-143` `larryRefusalLine` for EVERY kind: non-empty string, **`length <= 120`**, single line (no `\n`).

**The 120-character ceiling at `:142` is the binding constraint.** The two-command update path is 76 characters of commands alone (`/plugin marketplace update` = 26, `claude plugin update mos@mindrian-marketplace` = 44, plus a separator). It cannot fit inside `larryRefusalLine` with any framing. Verify which function `larryRefusalLine` reads from before touching `REASONS`; if it composes from `REASONS`, then `REASONS.unreachable` must stay short and the update path belongs in `RENDER_COPY` only.

**Recommended split:**
- `RENDER_COPY.unreachable` and `RENDER_COPY.no_key` gain the update path (these are the multi-line render arrays, no length cap).
- `REASONS.*` stay as-is (they feed the 120-char line).
- `NEXT_MOVES.unreachable` gains an `'update'` handle ONLY if a consumer reads it. **Verified: zero consumers.** `refusal-messaging.cjs:311-313` and `:317-319` both record prior sessions' greps confirming "zero consumers of any next_moves handle anywhere in the repo". Recommend adding the handle anyway (it is free, it is the honest third move, and both prior phases set the precedent of adding handles ahead of consumers), and pinning it in `test-250`.

### Where the constant lives

The canonical text is `.claude/includes/release-process.md:23-26`:
```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

**Recommendation: `lib/core/update-path.cjs`**, a new ~20-line CJS module exporting three frozen values:

```js
const MARKETPLACE_UPDATE_COMMAND = '/plugin marketplace update';
const PLUGIN_UPDATE_COMMAND = 'claude plugin update mos@mindrian-marketplace';
const UPDATE_PATH_SENTENCE =
  'Run `' + MARKETPLACE_UPDATE_COMMAND + '` then `' + PLUGIN_UPDATE_COMMAND + '` to pick up the latest release.';
```

Consumers: `refusal-messaging.cjs` (both kinds), `scripts/doctor.cjs` wherever it advises an update, and a drift test.

**Why a module and not a JSON constant:** `refusal-messaging.cjs` is CJS and already the chokepoint idiom; a JSON file would need a reader in every consumer. **Why not read `release-process.md` at runtime:** that file is a `@include` for CLAUDE.md, not a shipped runtime asset; `package.json`'s `files` allowlist governs the npm tarball (`release.sh:9.5` payload gate refuses `.planning/` and `docs/`), so a runtime read of a doc path is a distribution hazard.

**The drift test (Wave 0):** a new `tests/test-339-update-path-single-source.cjs` that reads `.claude/includes/release-process.md`, extracts the two fenced commands, and asserts they are byte-identical to `lib/core/update-path.cjs`'s exports, AND that `refusal-messaging.cjs`'s rendered copy for both `unreachable` and `no_key` contains `PLUGIN_UPDATE_COMMAND`. That closes the drift D-08 asks for in both directions.

**The honest limit, verbatim for the plan and the CHANGELOG:** this copy ships in bytes. An install that has not updated prints the OLD string, because a `main` commit is not live until released AND picked up (`feedback_dev_repo_fix_not_live_until_released`, 4x proven). This change is the durable fix for the NEXT origin move and for honesty; the levers that reach today's stale population are the soak window and the tester note. Do not let the CHANGELOG imply otherwise.

---

## Design 4: The `brain_schema` Memo (D-13), and a Correction To Its Premise

### What the code actually does

`brain-client.cjs:1048-1070`:
```js
let _schemaCache = null;
let _schemaCacheAt = 0;
const SCHEMA_CACHE_TTL_MS = 30 * 60 * 1000;

async function schema() {
  if (_schemaCache && (Date.now() - _schemaCacheAt) < SCHEMA_CACHE_TTL_MS) return _schemaCache;
  const result = await callTool('brain_schema', {});
  if (result != null && !(typeof result === 'object' && result.error)) {
    _schemaCache = result; _schemaCacheAt = Date.now();
  }
  return result;
}
```

**The memo is in-memory and process-local. There is no cache file, no disk artifact, nothing persistent.** And `BRAIN_URL` is a module-scope `const` resolved once at require time (`:24`); `getBrainUrl()` (`:1163`) just returns it. **Within a single process the origin cannot change.**

### The consequence, stated plainly

The failure mode D-13 guards against, "a cached incumbent schema surviving the URL change within one process", **cannot occur through the shipped code path**, because the URL cannot change within one process. A process that loaded the incumbent bytes keeps the incumbent URL AND the incumbent schema, which is internally consistent. A process that loads the flipped bytes starts with an empty cache. Session T's caution ("flushing on prep leaves the incumbent schema able to survive the URL change for up to half an hour") is a correct instinct about a cache, applied to a cache whose key is already immutable per process.

So: **there is nothing to flush on the FLIP cut.** An exported `flushSchemaMemo()` would have zero callers, which Canon Part 7 and this repo's dead-surface discipline both argue against.

### What is still worth shipping, and why

Key-by-origin remains worth shipping in the PREP cut as **defense in depth that makes the invariant explicit and testable**, at a cost of three lines:

```js
let _schemaCache = null;
let _schemaCacheAt = 0;
let _schemaCacheOrigin = null;   // NEW

async function schema() {
  if (_schemaCache && _schemaCacheOrigin === getBrainUrl()
      && (Date.now() - _schemaCacheAt) < SCHEMA_CACHE_TTL_MS) {
    return _schemaCache;
  }
  const result = await callTool('brain_schema', {});
  if (result != null && !(typeof result === 'object' && result.error)) {
    _schemaCache = result; _schemaCacheAt = Date.now(); _schemaCacheOrigin = getBrainUrl();
  }
  return result;
}
```

This is provably inert against the incumbent (the comparison is always true today), so it satisfies D-01's "safe against both Brains" test for the PREP cut. It becomes load-bearing the day anything makes the origin mutable per process, which is exactly the class of future change that would otherwise reintroduce the bug silently.

**Test (Wave 0), structural not behavioral,** matching the `test-254` Arm 4 idiom: assert on `brain-client.cjs`'s source that inside `function schema()`, the index of `_schemaCacheOrigin` occurs BEFORE the index of the `return _schemaCache;` early return, and that `_schemaCacheOrigin` is assigned in the same block that assigns `_schemaCacheAt`. A behavioral test would need a test-only setter, which is a new surface for no gain.

**Flag for the navigator:** this is a deviation from D-13 as written. D-13 says the flush "rides the FLIP cut, never the prep cut". The recommendation is that there is no flush to schedule at all, and the origin key ships entirely in PREP. State this explicitly at plan-check time rather than silently implementing something narrower than the decision.

### The tool-description half of D-13

`bin/mindrian-brain-mcp-client.cjs` (304 lines) carries five stale descriptions:

| `:line` | Stale claim | Post-flip truth |
|---|---|---|
| `:151` `brain_ask` | "over the live Memgraph teaching graph using locally-embedded multilingual-e5-large vectors ... Returns a DirectiveEnvelope (default mode: GUIDED)" | Theo is Neo4j Aura, not Memgraph. And Theo `09-MOS-LEARNING.md:132-135`: *"`mode_signals` no longer arrives ... The tool description text that promises it is now wrong."* Also `:127-130`: *"`brain_ask` hands back no answer, only material. Larry composes."* |
| `:238` `brain_schema` | "from the live Memgraph backend" | Aura |
| `:253` `brain_search` | "locally-embedded multilingual-e5-large vectors, with a graph fulltext fallback" | Theo's `brain_search` sanitizes rather than refuses (`09-MOS-LEARNING.md:124-126`); the e5 claim is incumbent-specific |
| `:271` `brain_stats` | "from the live Memgraph backend" | Aura, and the payload shape differs (`{nodes, relationships, labels}`) |
| `:285` `brain_write` | "Admin-tier; requires a write-capable key" | Theo always refuses with `WRITE_PATH_DISABLED`; it is not a tier gate a better key opens (`09-MOS-LEARNING.md:104-107`) |

**Cut assignment:** these descriptions are wrong about the incumbent only AFTER the flip. Editing them in PREP would make them wrong about the CURRENT backend for the duration of the soak between cuts. Recommend **rewriting to backend-agnostic prose in the PREP cut** ("the remote teaching graph", "semantic search over the teaching graph"), which is true on both sides, and reserving only the `brain_write` and `mode_signals` corrections for the FLIP cut where the behavior genuinely changes. That keeps every string true at every moment.

---

## Design 5: The Blocking Human-Action Gate (D-05, D-06)

### The contract

`$HOME/.claude/gsd-core/references/checkpoints.md:191-221`:
```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>[What human must do - Claude already did everything automatable]</action>
  <instructions>
    [What Claude already automated]
    [The ONE thing requiring human action]
  </instructions>
  <verification>[What Claude can check afterward]</verification>
  <resume-signal>[How to continue]</resume-signal>
</task>
```

Golden rule 5 (`:11`): *"When `workflow._auto_chain_active` or `workflow.auto_advance` is true in config: human-verify auto-approves, decision auto-selects first option, **human-action still stops**."*

**Verified against this repo's `.planning/config.json`:** `mode: "yolo"`, `auto_advance: false`, `_auto_chain_active: false`, `human_verify_mode` ABSENT (so the `end-of-phase` default at `:21` applies, and mid-flight `human-verify` tasks are suppressed and folded into `<verify><human-check>` blocks). `checkpoints.md:25` confirms `checkpoint:decision` and `checkpoint:human-action` are unaffected by that value. **So `human-action` is the only kind that reliably halts here, exactly as D-05 states.**

### The repo precedent, and what to copy from it

`269-05-PLAN.md` Task 1 is the model. Its distinguishing features, all worth copying:
- `<name>` starts with `Task 1: BLOCKING GATE - ...` so the halt is visible in a task list.
- `<read_first>` lists the cross-repo paths with `(READ ONLY, never edit)` inline.
- `<action>` opens with a literal `STOP.` and enumerates a numbered checklist, each item quoting the CURRENT observed value so the human can see what changed.
- `<action>` closes with `Perform no repository writes in this task.`
- `<verify><automated>` runs greps against the cross-repo files.
- `<acceptance_criteria>` includes, verbatim: *"Zero files were written by this task: `git status --porcelain` is byte-identical before and after it."*
- `<acceptance_criteria>` includes: *"If the gate did NOT clear, the SUMMARY records which item failed ... That is a successful outcome for this task, not a failure."*
- `<resume-signal>` is a two-branch phrase: `"gate cleared" plus <the quoted line>, or "still blocked" plus which item failed`.

### The verify block, exact

The subsection to scope to runs from line 301 (`### Coverage re-measurement, 2026-09-03, and the ruling on it`) to line 470 (the `---` before `## 2.`), at Theo `81dfac8`. Line numbers will move if Session T amends the file, so the block must scope by HEADING, not by line number.

```bash
FR=/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md
BEFORE="$(cd /home/jsagi/dev/MindrianOS-Plugin && git status --porcelain | sha256sum)"

# Scope to the ruling subsection: from its exact heading to the next '### ' or '## '.
SEC="$(awk '/^### Coverage re-measurement, 2026-09-03, and the ruling on it$/{f=1;next} f&&/^#{2,3} /{exit} f' "$FR")"

test -n "$SEC" || { echo "GATE: ruling subsection not found - coverage held"; exit 1; }

for LIT in \
  'Brain@56bf75a' \
  '83a1ce2' \
  '1,253' '1,522' '420' \
  '29,200' '24,375' '258' \
  'Covered: 228 of 258, 88.4%' \
  'Uncovered: 30 of 258' \
  'Coverage does NOT block Task 2, the flip' ; do
  printf '%s' "$SEC" | grep -Fq "$LIT" || { echo "GATE: missing literal [$LIT] - coverage held"; exit 1; }
done

printf '%s' "$SEC" | grep -Fq 'HOLD' && echo "GATE: subsection carries HOLD - report and stop"

AFTER="$(cd /home/jsagi/dev/MindrianOS-Plugin && git status --porcelain | sha256sum)"
[ "$BEFORE" = "$AFTER" ] || { echo "GATE VIOLATION: this task wrote to the repository"; exit 1; }
echo "GATE: coverage ruled"
```

**Every literal above was verified present in that subsection at Theo `81dfac8`:**
- `Brain@56bf75a` at flip-record line 451, inside ruling clause 2(a): *"as a reviewed payload against `Brain@56bf75a`"*. Note it also appears as a bare `` `56bf75a` `` in the pins table at line ~313; grep for the `Brain@` form, which is unambiguous.
- `83a1ce2` in the pins table, Theo row.
- `1,253` / `1,522` / `420` in the canon-moved paragraph and the count table.
- `29,200` / `24,375` / `258` in the pins table and the count table.
- `Covered: 228 of 258, 88.4%` at line 375 (inside a `**...**` bold span; `grep -F` matches the inner substring).
- `Uncovered: 30 of 258` at line 376.
- `Coverage does NOT block Task 2, the flip` at line 437, ruling clause 1.

**Use `grep -F`, never `grep -E`.** Several literals contain regex metacharacters (the `.` in `88.4%`, the `@` is safe but the commas are not the issue; `-F` removes the whole class of problem). Use `printf '%s'` piping, not a here-string, so the subsection's own backticks and dollar signs cannot be re-interpreted.

**Why `awk` and not `sed -n '/start/,/end/p'`:** the heading contains commas and a comma-heavy `sed` range is fragile; `awk` with an anchored exact-match `/^### ...$/` and an explicit `exit` on the next heading is unambiguous and greppable.

### What section 2 and section 3 say (read in full, summarized for the plan)

**Section 2, "Flip instructions for the plugin release" (lines 471-560):**
- The one required change: `brain-client.cjs` line 24, current value quoted verbatim, new value `'https://theo-mcp.onrender.com'`. **BARE base origin, no path, no trailing slash.** The record explains why: the client appends `/mcp` for tool calls and `/register` for the key ladder (naming line 337); `/mcp` would produce `/mcp/mcp` and a trailing slash a double slash; both 404, and the client renders a 404 as "Brain unreachable" rather than a configuration error, so this typo class fails silently in the most expensive direction.
- The docblock at lines 4-7 "belongs in the same commit" as a cosmetic edit.
- NOT required: input arg keys (byte for byte unchanged; `tests/test-247-contract-client.cjs` is envelope-insensitive and "stays green untouched"); the shim server key `mindrian-brain`; `BRAIN_TOOL_MATCHER` and `hooks/hooks.json` for the CLI surface; the `brain_query` shape adaptation (verified closed at plugin line 927, commit `21fdd7bc`, quick task `260901-ipp`).
- SHOULD accompany, on the plugin's schedule: flush the `brain_schema` memo (see the premise correction above); the `09-MOS-LEARNING.md` adaptation list, decoupled from the flip on purpose under Theo's D-01, with the probe leg inversions explicitly EXPECTED rather than failures.

**Section 3, "Rollback" (lines 562-612):**
- Per install, immediate: `MINDRIAN_BRAIN_URL=https://pws-brain-mcp.onrender.com`. Line 24 reads the env var first, so one variable overrides with no release, no reinstall, no code change.
- Fleet-wide: a patch release restoring line 24's old default.
- **Both paths are valid ONLY while `pws-brain-mcp` is still running.** Pointing the env var at a suspended service "is not a rollback; it is a second outage on top of the first, and it would arrive at the exact moment the operator is under pressure."
- Ordering enforced by task ordering in 09-12: flip, verify, soak, suspend. Suspend `pws-brain-mcp` (`srv-d9gfa03tqb8s73csfmtg`) then `pws-brain-db` (`srv-d9geq2urnols73cimkfg`), compute before data. **Suspend, never delete.**
- The soak window is the navigator's to set; the exit condition is "no unresolved Theo-attributed failures across real usage", not a fixed number of days.
- One caveat: a caller who adapted to `PLAN_REJECTED` or Theo's `{rows, diagnostics}` during the soak finds the incumbent's older shapes underneath again on rollback. Line 927 handles both, so `brain_query` survives a round trip in either direction.

**Section 4 and 5 do not exist yet** (lines 613-629): *"the flip is authorized and has not happened."* They are appended by 09-12 Task 4 after both checkpoints resolve.

### Gate placement

Per D-05, immediately before the task that runs `verify-release` and `release.sh`, and after everything automatable. Concretely, the FLIP plan's task order should be:

1. `auto` - edit line 24 + docblock 4-7
2. `auto` - `class-m-brain-smoke.cjs` constants + its test mocks
3. `auto` - `test-245` hard pin + `CLAUDE.md` lines 51 and 131 (paired, as that test's own failure message demands)
4. `auto` - CHANGELOG entry for the flip cut, including the D-06a `/mos:leadership` fact
5. `auto` - run `bash tests/run-all-339.sh` and `scripts/verify-release`
6. `auto` - `git push origin main`
7. **`checkpoint:human-action gate="blocking"`** - the coverage gate above
8. `auto` - `scripts/release.sh --prerelease`
9. `auto` - post-release verification and the Session T report

---

## Release Mechanics

### `scripts/release.sh`, 1462 lines, ordered steps

| Step | What | Failure mode |
|---|---|---|
| 0 | Parse bump MODE and flags. Usage at `:88`. Modes: `--prerelease`, `--finalize`, `--start-prerelease`, `--start-major-prerelease`, `stable`, `patch`, `minor`, `major`. Flags: `--allow-ahead`, `--no-next-bump`, `--minisite`, `--no-website`, `--strict-shape`, `--dry-run` | unknown arg -> exit 1 |
| 0.5 | semver preflight (`node_modules/semver` must exist) | exit 1 with "run npm install first" |
| 1 | read `plugin.json` version, compute `NEW_VERSION` via semver | invalid semver -> exit 1 |
| 2 | `bash scripts/verify-release` | "DO NOT RELEASE" -> abort |
| 2.4 | coverage gates: `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage` | abort |
| 2.5 | `doctor --acceptance --pre-flight` HARD ABORT, clean-tree gate before any mutation |  |
| 3 | bump `plugin.json` + `package.json` |  |
| 4 | bump `~/mindrian-marketplace/.claude-plugin/marketplace.json` version + `source.ref` pinned to `vN` |  |
| 5 | `claude plugin validate` (marketplace) |  |
| 5b | reserved-name compliance |  |
| 6 | CHANGELOG: `sed -i "0,/^## \[Unreleased\].*/s//## [$NEW_VERSION] - $DATE/"` (`:456`). If no `[Unreleased]` heading exists it prompts interactively | interactive prompt is a hazard inside an agent task; ensure the heading exists |
| 6.5 | post-bump `verify-release`, rolls back `plugin.json`/`package.json`/`CHANGELOG.md` on failure |  |
| 6.6 | `doctor --acceptance --pre-tag` HARD ABORT |  |
| 6.6a | `data/doctor-modules.json` module-registration verification |  |
| 6.6b | `tests/test-doctor-acceptance-self-coverage.cjs` |  |
| 6.7 | vendor production `node_modules` via `npm ci --omit=dev` | requires `package-lock.json` in sync |
| 7 | Commit A `release: v$NEW_VERSION`, tag `v$NEW_VERSION` |  |
| 9.5 | **`npm publish @mindrian_os/cli@$NEW_VERSION`**, dist-tag `next` for any `-beta.`/`-alpha.`/`-rc.`/`-next.` suffix, then promoted to `@latest`. Payload gate refuses a tarball containing `.planning/`, `docs/`, `mcp-server-brain/`, `tests/`, `release.sh`, or `node_modules/` | publish failure HALTS |
| 7.5 | Commit B: bump `plugin.json`/`package.json` to NEXT prerelease, CHANGELOG `[Unreleased] -- v<next>`, un-track `node_modules`. Marketplace gets NO Commit B. Skipped by `--no-next-bump` |  |
| 8 | dirty-repo / ahead-of-origin guard | `--allow-ahead` bypasses |
| 9 | `git push origin main --tags` (plugin); `git push` (marketplace) |  |
| 5.5 | verify tag at origin (retries; `SKIP_TAG_VERIFY=1` bypasses) |  |
| 9.6a | install minisite RETIRED 2026-06-09, off by default |  |
| 9.6b | **sync mindrian-os.com `FALLBACK_VERSION`**, HARD lockstep, git-push deploy to `$MINDRIAN_WEBSITE_DIR` (default `$HOME/mindrian-website/website`) | dir missing -> HARD ABORT with a `gh repo clone` recovery |
| 9.7 | npx-publish self-test in a fresh temp dir |  |
| 9.8 | full `doctor --acceptance` HARD ABORT |  |
| 10 | `claude plugin marketplace update mindrian-marketplace` |  |
| 11 | post-release verification (remote HEAD match, marketplace cache version) |  |

**Corrections to the briefing:** the npm package is **`@mindrian_os/cli`** (`package.json:2`), not `@mindrian/os`. `CLAUDE.md:83`'s `scripts/release.sh <version>` is stale; it takes a bump mode.

**There is no `VERSION-BUMP-CHECKLIST.md` in this repo.** `find . -name "*VERSION-BUMP*"` returns nothing. The personal-memory rule `feedback_version_bump_website_facts_reconcile` names such a file; it is not here. Its mechanical half is already automated as Step 9.6b (the `FALLBACK_VERSION` sync). Its manual half, fact-checking hand-typed version surfaces on `mindrian-website`, has no artifact in this repo. **Recommendation:** the phase creates `docs/VERSION-BUMP-CHECKLIST.md` OR states in the plan that the rule is satisfied by Step 9.6b plus a named manual check. Do not silently skip it.

### `scripts/verify-release` gates, and what actually blocks

19 numbered sections plus a package-lock check. Sections relevant here:

| Gate | Blocks? | Relevance |
|---|---|---|
| 10b Skill Mirrors (`build-skill-mirrors.cjs --check`) | **FAIL** | Editing `commands/setup.md` without regenerating `skills/setup/SKILL.md` blocks the release |
| 10c Plugin Path Anchoring | FAIL | Not touched by this phase |
| **10f Plugin Script-Invocation Anchoring** (`check-plugin-path-anchoring.cjs --check-scripts`) | **FAIL**, zero-tolerance, no grandfather clause | Phase 274 landed it. Any NEW `bash scripts/x` or `node scripts/x` line added to command/skill/agent/pipeline markdown must be prefixed with `${CLAUDE_PLUGIN_ROOT}/` or the fail-closed `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}/` form. **Relevant here:** if the tester note or the connector docs add a command example inside `commands/setup.md` or `skills/*/SKILL.md`, this gate fires. |
| 12 Git State | **WARN only** | `UNCOMMITTED=$(git status --porcelain \| grep -v "^??" \| wc -l)`; non-zero produces `warn`, not `fail` (`:520-525`). Same for the marketplace repo. |
| 13 CHANGELOG has current version | **WARN only** | greps `\[$PLUGIN_VER\]`; today `plugin.json` is `2.0.0-beta.16` and CHANGELOG says `[Unreleased] -- v2.0.0-beta.16`, so this WARNs today and is expected to |
| 19 Brain Tool Liveness | **FAIL** | Spawns `bin/mindrian-brain-mcp-client.cjs` for a real stdio `tools/list` handshake and checks every `hooks.json` Brain matcher and every agent `allowed-tools` exact name against it. **Verified safe across the flip:** its own header (`:52-56`) states *"Tool registration happens at module load, before any network call, so this is fully offline and hermetic; no Brain API key is needed."* The shim registers its tool names statically. Changing tool DESCRIPTIONS cannot affect it; changing or removing a tool NAME would. |
| package-lock sync | FAIL | `npm ci --dry-run --omit=dev` must succeed |

### What "pause Phase 276 at a wave boundary" means operationally

Gate 12 is a **WARN**, so a dirty tree does not block `verify-release`. But `release.sh` Step 2.5 runs `doctor --acceptance --pre-flight` described in the dry-run preview (`:206`) as a *"clean-tree gate before any mutation"*, and Step 8 is an explicit dirty-repo guard. Treat a clean tree as required.

**Currently dirty at HEAD `3782dbc7` (`git status --short`):**
```
 M scripts/__pycache__/compute-hsi.cpython-312.pyc
 D tests/fixtures/sample-room-personas/personas/black-healthbridge-marketplace.md
 D tests/fixtures/sample-room-personas/personas/blue-healthbridge-marketplace.md
 D tests/fixtures/sample-room-personas/personas/green-healthbridge-marketplace.md
 D tests/fixtures/sample-room-personas/personas/red-healthbridge-marketplace.md
 D tests/fixtures/sample-room-personas/personas/white-healthbridge-marketplace.md
 D tests/fixtures/sample-room-personas/personas/yellow-healthbridge-marketplace.md
?? docs/2026-08-20-gate0-queries.cypher
?? docs/2026-09-03-DESIGN-t2-write-back-minimal.md
?? docs/2026-09-03-HANDOFF-RESPONSE-reasoning-constitution-v3-assessment.md
?? docs/MINDRIANOS-PRD.md
?? prototypes/
?? specs/
```

**Operationally, "pause at a wave boundary" means all of:**
1. The 6 deleted persona fixtures and the modified `.pyc` are resolved (committed as deletions, restored, or `.gitignore`d) so `git status --porcelain | grep -v '^??'` is empty. The `.pyc` in particular should be gitignored, not committed; check whether `scripts/__pycache__/` is already tracked.
2. Phase 276 has no plan mid-execution: 276 has 16 plans with SUMMARYs present for 01-06 and 09. Plans 07, 08, 10-16 have no SUMMARY. The pause point is after a plan whose SUMMARY exists, not mid-plan.
3. The untracked files are either committed or left untracked; `??` entries are filtered out of gate 12's count and do not affect the guard.
4. `git push origin main` has landed all 309 commits (D-02).

### Where the CHANGELOG entry goes

`CHANGELOG.md:1` is `## [Unreleased] -- v2.0.0-beta.16 (in progress)`, followed by `### Added`. Add this phase's entries under that heading (creating `### Changed` / `### Fixed` subsections as needed). Step 6's `sed` rewrites the whole `## [Unreleased]...` line to `## [<NEW_VERSION>] - <date>`, so the trailing `-- v2.0.0-beta.16 (in progress)` label is discarded and its being off by one is cosmetic. For clarity, recommend correcting the label to the version the cut will actually carry as part of the PREP plan.

### Marketplace repo

`~/mindrian-marketplace` exists, is clean, and its last three commits are `release: sync to v2.0.0-beta.{15,13,11}`. `.claude-plugin/marketplace.json` reads `"version": "2.0.0-beta.15"` with a `source.source: "url"` block. Step 4 bumps it and pins `source.ref` to the new tag; Step 9 pushes it. Nothing manual is required beyond having the directory present and clean.

---

## Design 6: The 269-05 Checklist Rewrite (D-14)

### What Task 1 says today, item by item

`.planning/phases/269-moat-shift-install-update-entitlement-gate-replaces-per-quer/269-05-PLAN.md` Task 1, six items:

1. Theo `ROADMAP.md` Phase 9 no longer reads `Plans: TBD (not yet planned; blocked on Phase 8)`.
2. Theo Phase 8 likewise no longer `Plans: TBD`.
3. Theo Phase 7 has completed.
4. The credential model in `docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md` is still intended; if Option C, confirm `POST /register` is live on `pws-brain-mcp.onrender.com`.
5. The `Q2 distribution reading:` line is answered and does not read `still open`.
6. `269-RESEARCH.md` is still inside its validity window (`Valid until: 2026-09-10`).

Its `<verify><automated>` is `grep -c 'Plans: TBD' /home/jsagi/Theo/.planning/ROADMAP.md; grep -Fq 'Credential model DECIDED:' docs/AMENDMENT-...`.

**The danger D-14 names, confirmed:** items 1-3 are all satisfied today (Theo Phase 9 has 11 of 12 plans with summaries; Phases 7 and 8 are closed), so the checklist reads 3/3 PASS on its first three items while the real content and infrastructure legs were never tested. Item 4's `POST /register` clause names the INCUMBENT host, which is the wrong host post-flip. Item 6's validity window expires 2026-09-10, one week out.

### The rewritten three legs

**Leg (a): coverage re-measured live against a PINNED Brain count.**
Source: `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md`, subsection `### Coverage re-measurement, 2026-09-03, and the ruling on it`. **NOT** SEED-004 (see DRIFT-3). Automated check: the same scoped-grep block the D-05 gate uses, reduced to the ruling sentence plus the `Brain@` pin. State in the item that this is a navigator RULING recorded in writing, not a mechanical threshold, and that the ratio measure is RETIRED (ruling clause 4). Record the current reading verbatim: `Covered: 228 of 258, 88.4%`, `Uncovered: 30 of 258`.

**Leg (b): Theo Phase 06.2 live, meaning summaries on disk.**
Automated check: `ls /home/jsagi/Theo/.planning/phases/06.2-*/06.2-*-SUMMARY.md | wc -l` is at least 1. Current state, per the flip record's "Leg two, re-read against what is on disk today": 06.2 has 4 of 4 summaries and closed 2026-09-02, so this passes on its own terms. **The item must also carry the flip record's own honesty caveat:** the mechanism that would keep the coverage table current is Phase 06.3 (the bidirectional drift detector, SEED-005), which has 0 plans and 0 summaries. Leg (b) as originally specified passes; the part of leg (b) that bears on drift does not. Write both, or the item reads greener than the evidence.

**Leg (c): 09-12 infrastructure legs.**
Three sub-checks, each with a source:
- Theo Phase 08.4 closed. Check: `08.4-MOS-LEARNING.md` exists and is non-empty.
- 09-11 remote parity, 0 mismatches. Check: `09-11-SUMMARY.md` exists; the flip record's `### The remote ledger verdict (09-11, 2026-09-03)` subsection carries the verdict.
- `/register` compat route live. Check: `08.4-MOS-LEARNING.md:47-49` records *"A `POST /register` route exists and hands an opaque `{token}` to anybody who asks"*. **Retarget item 4's host from `pws-brain-mcp.onrender.com` to `theo-mcp.onrender.com`.** Do not probe it live from the gate: `POST /register` is a WRITE-shaped call, and the gate is contractually zero-write.

**Retire items 1-3** with a one-line reason recorded in place, not deleted silently: *"Retired 2026-09-03 (Phase 339, D-14). These three read PASS from 2026-08-27 onward while the real content and infrastructure legs went unchecked. Superseded by legs (a), (b), (c)."*

**Item 6, the validity window:** `269-RESEARCH.md` expires 2026-09-10. Either extend it with a dated note or replace the item with a pointer to this phase's research. Recommend the latter: the entitlement-gate research is not what gates 269-05 any more; Theo's readiness is.

---

## Design 7: The Cross-Repo Note (D-10)

**Path:** `docs/339-NOTE-theo-desktop-connector-key.md`. Theo's shipped `README.md:135` already cites this exact path, so the filename is fixed, not a choice.

**Format precedent:** `docs/257-NOTE-part8-enforcement-locus-rulings.md` is the closer model of the two, because it opens with a metadata block (`**Phase:**`, `**Date:**`, `**Status:**`) and states up front what the document does NOT amend. `docs/254-NOTE-theo-adaptation-list-additions.md` contributes the section structure: `## 1. The Ask, Up Front`, `## 2. The Break, Precisely`, `## 3. What This Phase Did, and What It Deliberately Did Not`.

**Recommended structure**, blending both and reflecting DRIFT-2 (the ask is already satisfied):

```
# Note: Theo Desktop Connector Key (Phase 339)

**Phase:** 339-brain-to-theo-cutover-release-...
**Date:** 2026-09-03
**Status:** RECIPROCAL RECORD. Theo's README (commit daa1e59) already prescribes
`mindrian-brain` and already cites this file by path. This is the plugin-side half
of a decision Session T has already shipped, not a proposal.

## 1. The record, up front
Use `mindrian-brain` as the Claude Desktop / Cowork connector key. Point it at
https://theo-mcp.onrender.com/mcp (WITH the /mcp path, unlike brain-client.cjs
line 24 which takes the BARE origin). No Authorization header.

## 2. Why the key and not the host
`BRAIN_TOOL_MATCHER` (lib/core/brain-response-sanitize.cjs:61) is
'mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*'
and is byte-mirrored at hooks/hooks.json:239 and :341, with parity enforced by
tests/test-brain-response-sanitize.cjs. A connector registered as `theo` produces
mcp__theo__* names that match neither. scripts/part8-egress-guard-hook.cjs:152
allows UNCONDITIONALLY when isBrainTool(toolName) is false, so those calls run
outside the Canon Part 8 egress guard AND outside the response sanitizer. No test
catches it, because no test can see a connector a user registered by hand.

## 3. The two paths that already exist, and the one that does not
mindrian-brain and pws-brain-mcp are both recognized. theo is not.

## 4. Why the plugin is not widening the matcher
[reasoned: a third alternation token would legitimize a key whose only purpose
is standalone Theo use, and it would make the guard's own vocabulary a moving
target. The fix belongs where the instruction is, which is Theo's README, and
Theo has already made it.]

## 5. The other thing Session T must be told verbatim
[the D-06 coverage-ruling heading contract, quoted exactly, per CONTEXT
<specifics>]
```

Note the `/mcp` versus bare-origin asymmetry deserves its own sentence: a direct connector hits the MCP endpoint itself, while `brain-client.cjs` appends `/mcp` to its base. Getting that backwards produces `/mcp/mcp`, a 404 the client renders as "Brain unreachable".

---

## Design 8: Post-Release Verification (D-15)

### `scripts/probe-brain-contract.cjs`, five legs, and which invert

Legs enumerated verbatim in the script header (`:37-58`):

| Leg | Today, against the incumbent | Post-flip, against Theo | Source |
|---|---|---|---|
| **a** | `tools/list` on a read key: every `loop_tools` name present | **PORTS CLEANLY.** Theo's catalog serves the contract-pinned names | `09-MOS-LEARNING.md` change-list row 1: *"Leg a (tools/list contains the 7) ports cleanly"* |
| **b** | `text2cypher` refuses with httpStatus 403 + a `MoatViolation` body; `brain_ask_anything` is DELISTED (absent from `tools/list`, calling it yields a JSON-RPC unknown-tool error) | **INVERTS.** Theo SERVES `text2cypher` (`src/mcp/content/text2cypher.ts` exists), so the expected 403 does not arrive. `brain_ask_anything` still draws an unknown-tool error, but for a different reason: Theo has no allowlist gate at all | `09-MOS-LEARNING.md` change-list row 1: *"Leg b expects `text2cypher` to 403 (Theo serves it) and `brain_ask_anything` to draw an allowlist 403 (Theo has no allowlist gate, so an unknown tool draws an MCP unknown-tool error)"* |
| **c** | `brain_query` bounded read ADMITTED (200, bounded rows); a `CREATE` write refused IN-BAND with a `BoundedReadRefusal` marker in the tool result text; the refused write proven never executed | **PARTIALLY INVERTS.** The refusal MARKER changes: `BoundedReadRefusal` is incumbent-authored text; Theo's refusals are typed codes. Also new: Theo may answer `PLAN_REJECTED` on a count-store query plan, which the incumbent served | `09-MOS-LEARNING.md`: *"Leg c's `BoundedReadRefusal` marker is incumbent-authored text; Theo's refusals are typed codes."* Plus `:108-118` on `PLAN_REJECTED` |
| **d** | `search` + `brain_search` for "jobs to be done framework": no string value in any served hit matches the local-path regex | **PORTS.** Not named in the change list. Theo sanitizes rather than refuses on unsupported characters, which does not affect this assertion | `09-MOS-LEARNING.md:124-126` |
| **e** | `brain_stats`: every `contract.indexes.dropped` name ABSENT and every `keep`/`keep_retired` name PRESENT. **Already HONESTLY RED** pending 7 operator index DROPs | **INVERTS ENTIRELY.** Those are Memgraph index names on the incumbent; Theo's Aura instance does not have them. Also Theo's `brain_stats` payload is `{nodes, relationships, labels, diagnostics}` with no index block at all | `09-MOS-LEARNING.md`: *"Leg e asserts the incumbent's Memgraph index names, which Theo's Aura instance does not have."* |

`:421` prints `=== ALL ASSERTED LEGS PASSED (leg e HONESTLY RED: 7 DROPs pending operator checkpoint) ===` when the asserted legs pass. **Expected post-flip output: legs a and d pass, legs b, c and e report red.** These are DOCUMENTED, not failures. The plan should record the actual output verbatim in the SUMMARY rather than paraphrasing it, and the CHANGELOG should say plainly which legs are expected red so a later reader does not treat the probe as broken.

Also required by FLIP-01: the probe's own `BRAIN_URL` at `:74` must derive from `getBrainUrl()`, or the probe silently tests the incumbent after the flip.

### Exercising `brain_stats` / `brain_ask` through the installed plugin

The installed cache lives at `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/`. Session T reported this machine's cache at `2.0.0-beta.13`. **This must be checked, not assumed**, and it is a two-step confirmation:

1. `ls ~/.claude/plugins/cache/mindrian-marketplace/mos/` to see which versions are present.
2. `grep '"version"' ~/.claude/plugins/cache/mindrian-marketplace/mos/<v>/.claude-plugin/plugin.json` and `grep BRAIN_URL <cache>/lib/core/brain-client.cjs` to confirm the CACHE, not the dev tree, carries the flipped origin. This is the `feedback_dev_repo_fix_not_live_until_released` rule made mechanical: a `main` commit is not live until released AND picked up.

**The two-command update path**, verbatim from `.claude/includes/release-process.md:23-26`:
```bash
/plugin marketplace update                      # refreshes the catalog
claude plugin update mos@mindrian-marketplace   # installs the latest version
```

**How to exercise the tools:** in a fresh Claude Code session running the updated cache, call `brain_stats` and `brain_ask` through Larry (not through a direct script), because the point of D-15 is to prove the INSTALLED wire works end to end, not that the source does. Expected `brain_stats` shape post-flip: `{nodes: 1253-ish, relationships: 1522-ish, labels: [...], diagnostics: {...}}`. Expected `brain_ask`: structured material, never composed prose (Theo `09-MOS-LEARNING.md:127-130`: *"`brain_ask` hands back no answer, only material. Larry composes."*).

**The D-03 regression check** (the third clause of D-15): call `orchestration_readiness` for a framework Theo does not carry, and confirm the enrichment queue file gained an entry with `probe_provenance` starting `orchestration_readiness_theo`. Then call it for a framework Theo carries with thin structure and confirm a second entry with `dimensions_inferred: false`. Both shapes, both captured, or the D-03 fix did not land.

**Warning: never call a WRITE endpoint during verification.** `brain_write` and `/register` are both write-shaped. `/register` is fired automatically by `_tryAutoRegister` when no key resolves; that is the shipped path and is fine. A deliberate manual `POST /register` from a verification script is not.

---

## Tri-Polar and CIRS

| Surface | What changes | Gate |
|---|---|---|
| **Claude Code CLI** | Zero connector change. Traffic goes `.mcp.json` `mindrian-brain` -> `bin/mindrian-brain-mcp-client.cjs` -> `brain-client.cjs callTool` -> `${BRAIN_URL}/mcp`. One line moves every CLI surface. `scripts/session-start:1896`'s banner string is the one CLI-visible literal. | `verify-release` gate 19 (offline, unaffected) |
| **Claude Desktop** | Docs-only URL change under the unchanged `mindrian-brain` key, header dropped. `docs/brain-setup.md:23`, `commands/setup.md:99` and `:258`, `docs/install/BRAIN-SETUP.md:39`, plus the two generated mirrors. | gate 10b (skill mirrors) FAILS on drift |
| **Cowork** | Same as Desktop, plus the `commands/setup.md:108` Cowork instruction string. | same |

**CIRS scope, verified:** `scripts/build-connector-registry.cjs` walks `commands/`, `skills/`, `agents/` (`:77-79`, `:274-278`) plus an MCP-tool registry source (`:89`). `scripts/check-shape-declaration.cjs` walks `commands/`, `agents/`, pipelines and `skills/` (`:695-702`). **Neither walks `bin/`.** `bin/mindrian-brain-mcp-client.cjs` contains no `connectors` declaration (grep returns nothing across 304 lines), because connector declarations live in markdown frontmatter, not in CJS. **Therefore the D-13 tool-description edits cannot break `check-shape-declaration.cjs` or `build-connector-registry.cjs --check`.** Run both anyway per `CLAUDE.md:84`; they are cheap and the claim above is worth re-proving at execution time.

**`tests/test-234-tool-description-floor.cjs` does NOT cover the Brain shim.** Its `SERVER` constant at `:88` is `bin/mindrian-mcp-server.cjs`, the MindrianOS MCP server, not the Brain client shim. Phase 266-04 widened it from a hand-maintained list of 8 to every tool in the live `tools/list` response of THAT server. So the 120-char floor, the capital-start / sentence-terminator / no-em-dash prose checks apply to the 36 `mindrian-os` tools, not to the 6 `brain_*` descriptions D-13 edits.

**What DOES cover the shim:** `tests/test-265-mcp-description-hygiene.cjs`, `tests/test-257-shim-honest-refusal.cjs`, `tests/test-250-refusal-shapes.cjs:148-153` (the shim source assertion that transport-null is never mapped to `tier0Response`), and `tests/test-127-00-shim-handshake.sh`. Run all four after any shim edit. Also `tests/run-all-276.sh` TOOLHON-12 already diffs *"the five Theo description constants against the live plugin registration strings, cross-repo, skip-when-absent"*, so Phase 276 has a cross-repo description test in flight; check for a collision before editing the same strings.

**The em-dash fence:** every phase runner in this repo carries `grep -lP '\x{2014}'` over its own targets. `tests/run-all-339.sh` must list every file this phase touches, and a MISSING target must count as a failure unless an explicit `TEST_339_ALLOW_MISSING=1` escape is set (the `run-all-273` / `run-all-276` convention).

---

## Don't Hand-Roll

| Problem | Do NOT build | Use instead | Why |
|---|---|---|---|
| Resolving the Brain origin anywhere outside `brain-client.cjs` | A second `const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL \|\| '...'` | `require('.../brain-client.cjs').getBrainUrl()` | That duplication is the whole disease D-12 names. `build-brain-census.cjs:59` even documents itself as "mirrors line 24", which is a second source of truth admitting to being one. |
| Regenerating `dist/` or `skills/*/SKILL.md` | A hand edit | `node scripts/build-dist-bundles.cjs` and `node scripts/build-skill-mirrors.cjs` | `build-dist-bundles.cjs:24-28` declares itself the sole writer; gate 10b FAILS the release on mirror drift. |
| Version bumping | A hand edit to `plugin.json` / `package.json` / `marketplace.json` / CHANGELOG | `scripts/release.sh <mode>` | Five-gate lockstep; `CLAUDE.md:83` and `release-process.md` both say never bump by hand. |
| The two-command update-path string | Retyping it in refusal copy, doctor and docs | one `lib/core/update-path.cjs` constant | Three copies drift; that is exactly what D-08 asks to prevent. |
| Detecting whether a shape is Theo's or the incumbent's | `if ('rows' in result)` or `if (result.score !== undefined)` | `Array.isArray(result.rows)`, `typeof pr.score === 'number' && pr.inputs` | D-04, and the shipped precedent at `:930-933` explains the reason: a malformed value must still fall through to the safety net. |
| Proving an unexported function's behavior | Exporting it for the test | A structural assertion over the file's source, `test-254` Arm 4 idiom | Adding a test-only export widens the module's public surface permanently. |
| Deriving the coverage verdict | Recomputing coverage from Theo's graph | Reading the ruling that already exists | `09-FLIP-RECORD.md:301-470` is the measurement, the script is committed at `parity/20260903-coverage/remeasure.py`, and re-deriving it would be a second, drifting answer. |
| A retry loop on `PROBLEM_TYPE_NOT_FOUND` | Second round trip using `available_problem_types` | The origin-keyed alias table | Hides a vocabulary bug at runtime; breaks the rollback coherence property. |

**Key insight:** almost every trap in this phase is a SECOND SOURCE OF TRUTH. One origin, one vocabulary switch, one update-path string, one alias-table selector, one coverage ruling. The sweep is not tidying; it is the removal of duplicate authorities that would each need to be found again at the next move.

---

## Common Pitfalls

### Pitfall 1: The `/mcp` suffix on line 24
**What goes wrong:** `https://theo-mcp.onrender.com/mcp` produces `/mcp/mcp` for tool calls and `/mcp/register` for the key ladder. A trailing slash produces a double slash.
**Why it happens:** the Desktop connector docs (D-09) legitimately use `/mcp`, and the two values sit within a few lines of each other in the same plan.
**How to avoid:** the FLIP task's verify block must assert the exact string, not just that it contains "theo": `grep -Fq "|| 'https://theo-mcp.onrender.com';" lib/core/brain-client.cjs`.
**Warning signs:** every Brain call renders as "Brain unreachable". Flip record section 2: *"this typo class fails silently in exactly the direction that costs the most time to diagnose."*

### Pitfall 2: Cutting the release at beta.16
**What goes wrong:** `release.sh --prerelease` produces beta.17 from a tree at beta.16, so a plan that hard-codes "beta.16" in a CHANGELOG heading or a tester note ships a version number that does not exist.
**How to avoid:** never write the version into a plan. Have the plan read it back from the tag after Step 7, or run `scripts/release.sh --dry-run` first (`:173-180` short-circuits after the version arithmetic with no mutation).

### Pitfall 3: Hand-editing a generated file
**What goes wrong:** editing `skills/setup/SKILL.md` or anything under `dist/`. Gate 10b FAILS on the first; nothing catches the second.
**How to avoid:** edit `commands/setup.md` and `skills/pws-brain/SKILL.md` (hand-authored) only, then run both generators in order, then re-run `verify-release`.

### Pitfall 4: Defeating `test-245` instead of honoring it
**What goes wrong:** the temptation is to relax `tests/test-245-skill-frontmatter-inert-keys.cjs:127`'s assertion into a regex or delete it. Its own failure message forbids this: *"If the backend genuinely moved, update this test AND CLAUDE.md together - that pairing is the entire point of this claim."*
**How to avoid:** change the expected literal AND `CLAUDE.md:51` and `:131` in the same commit as line 24. Keep the assertion an equality.

### Pitfall 5: Treating the probe's red legs as failures
**What goes wrong:** the post-release verification sees legs b, c and e red and invokes rollback.
**How to avoid:** the plan's verification task lists the EXPECTED reds by name before running the probe, and the CHANGELOG says the same.

### Pitfall 6: Assuming the source tree is what users run
**What goes wrong:** verifying the flip by reading `lib/core/brain-client.cjs` in the dev tree.
**How to avoid:** verify against `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/lib/core/brain-client.cjs`, after `/plugin marketplace update` and `claude plugin update`.

### Pitfall 7: A write inside the zero-write gate
**What goes wrong:** the gate task runs a `git fetch` in the Theo repo, or writes a scratch file, or `sed`s a checklist.
**How to avoid:** capture `git status --porcelain | sha256sum` in BOTH repos before and after; assert equality; state it in `<acceptance_criteria>` verbatim as 269-05 Task 1 does.

### Pitfall 8: `grep -E` against the coverage literals
**What goes wrong:** `88.4%` contains a regex `.`; a `-E` grep for `Covered: 228 of 258, 88.4%` would match `88X4%` too, and more importantly a future edit could break the anchoring in a way that still matches.
**How to avoid:** `grep -F` for every literal, scoped to the awk-extracted subsection.

### Pitfall 9: The enrichment queue filling during soak, read as a bug
**What goes wrong:** post-flip, most `orchestration_readiness` calls capture, the queue approaches `SOFT_CAP = 500`, and someone treats it as a leak.
**How to avoid:** name the expectation in the CHANGELOG and the soak checklist. It is canon thinness (Theo: 3 of 149 frameworks carry structure), correctly measured.

### Pitfall 10: The interactive CHANGELOG prompt in `release.sh` Step 6
**What goes wrong:** if no `## [Unreleased]` heading and no `## [NEW_VERSION]` heading exists, Step 6 (`:459-471`) issues `read -r REPLY` and then opens `$EDITOR`. Inside an agent task that hangs forever.
**How to avoid:** the plan's pre-cut task asserts `grep -qE '^## \[Unreleased\]' CHANGELOG.md` before invoking `release.sh`.

---

## Runtime State Inventory

This is a release and cutover phase, not a rename, but the same discipline applies: after every file in the repo is updated, what runtime systems still hold the old origin?

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | `data/brain-census.generated.json` (`brain_url` = incumbent, plus a full census of the incumbent's graph) and `docs/BRAIN-GRAPH-CENSUS.generated.md`. Generated by `scripts/build-brain-census.cjs`, which requires live network and, for Lane B, an admin key Theo does not issue. | **LEAVE.** Not a runtime read; no `--check` gate depends on it. Record the disposition in the CHANGELOG and register a re-census as deferred. |
| | The enrichment queue file per room (`enrichment-queue.cjs` writes to `roomDir`). Existing entries carry `probe_provenance: 'orchestration_readiness@<ts>'` from incumbent probes. | **No migration.** Entries are additive, deduped by framework, and the new provenance strings distinguish origin. Old entries remain valid observations. |
| | `~/.mindrian.env` / `MINDRIAN_BRAIN_KEY` on user machines. | **No change.** Theo ignores the Authorization header entirely (Theo `README.md:146-149`: a call with no header and one with `Bearer garbage` return byte-identical bodies). A cached key is harmless. |
| **Live service config** | `~/mindrian-marketplace/.claude-plugin/marketplace.json` (in git, clean, at beta.15). | Updated by `release.sh` Step 4, pushed by Step 9. |
| | `mindrian-os.com`'s `FALLBACK_VERSION` in `$HOME/mindrian-website/website/src/lib/version.ts`. | Updated by `release.sh` Step 9.6b, HARD lockstep, git-push deploy. Manual fact-check of hand-typed version surfaces has no artifact in this repo (see release mechanics). |
| | npm dist-tags for `@mindrian_os/cli`: `next` gets the beta, then promoted to `latest`. | `release.sh` Step 9.5. |
| | Render services `srv-d9gfa03tqb8s73csfmtg` (`pws-brain-mcp`) and `srv-d9geq2urnols73cimkfg` (`pws-brain-db`), both live, neither suspended as of the 09-03 measurement. | **Out of this phase.** Theo 09-12 Task 3, operator-held, after soak. Suspend, never delete. |
| | User-registered Claude Desktop / Cowork connectors, which live in `claude_desktop_config.json` on each user's machine and in Cowork's settings UI, NOT in git. | **Not reachable by any release.** Moved only by the user following the updated docs. This is the second stale population D-11's tester note exists for. |
| **OS-registered state** | The plugin install cache at `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/`, reported at `2.0.0-beta.13` on this machine. Contains a FULL copy of `lib/core/brain-client.cjs` with the old origin compiled in. | **Moved only by `/plugin marketplace update` + `claude plugin update mos@mindrian-marketplace`.** This is the single most important runtime-state item in the phase and the reason D-15's verification must read the cache, not the source. |
| | No Windows Task Scheduler entries, no pm2 processes, no launchd/systemd units reference the Brain origin. | **None found.** Verified by grep across the repo; no scheduler registration exists for Brain traffic. |
| **Secrets and env vars** | `MINDRIAN_BRAIN_URL` (the rollback lever), `MINDRIAN_BRAIN_KEY`, `MINDRIAN_BRAIN_TIMEOUT_MS`, `MINDRIAN_DISABLE_AUTO_REGISTER`, `MINDRIAN_BRAIN_SMOKE_TIMEOUT_MS`. All names UNCHANGED by this phase. | **None.** No env-var rename. `.env.brain.template:9` carries the incumbent origin in a comment and should be swept in the PREP cut. |
| **Build artifacts / installed packages** | `dist/generic-claude-dir/` and `dist/zed/` (4 files, 12 hits). `dist/BUNDLE-VERSION.json` currently fresh at `source_version: 2.0.0-beta.16`. | **Regenerate** via `node scripts/build-dist-bundles.cjs` after the `skills/` edits. Nothing gates staleness; a Wave 0 test should. |
| | Vendored `node_modules` (32M, built by `release.sh` Step 6.7 via `npm ci --omit=dev`, tracked for the git-distributed marketplace artifact and un-tracked again by Commit B). | **No action.** Carries no Brain origin. |
| | `scripts/__pycache__/compute-hsi.cpython-312.pyc` is currently MODIFIED in the working tree. | Resolve before the cut (gitignore or commit). Unrelated to this phase but blocks the clean-tree posture. |

**The canonical question, answered:** after every file in the repo is updated and released, the systems still holding the old origin are (1) every install that has not run the two-command update, and (2) every hand-registered Desktop/Cowork connector. Neither is reachable by code. Both are addressed by the soak window and the tester note, and by nothing else. Say this plainly in the CHANGELOG rather than implying the release fixes it.

---

## Environment Availability

| Dependency | Required by | Available | Version / state | Fallback |
|---|---|---|---|---|
| `https://theo-mcp.onrender.com` | The flip target | YES | `GET /health` returned `{"status":"ok"}` at research time | none needed |
| `https://pws-brain-mcp.onrender.com` | Rollback path, PREP-cut safety | YES | `GET /health` returned `{"status":"ok","graph":true}` | none; rollback depends on it staying up |
| `/home/jsagi/Theo` git repo | The D-05/D-06 gate, the D-14 rewrite | YES | HEAD `81dfac8` on `main`, clean | none; the gate is read-only against it |
| `~/mindrian-marketplace` | `release.sh` Step 4, `verify-release` gate 2 and 3 | YES | clean, at `2.0.0-beta.15` | `verify-release` WARNs if absent, `release.sh` needs it |
| `$HOME/mindrian-website/website` | `release.sh` Step 9.6b | NOT VERIFIED by this research | unknown | Step 9.6b HARD ABORTS with a `gh repo clone` recovery, or `--no-website` opts out |
| `claude` CLI (`claude plugin validate`) | `verify-release` gates 1, 2, 5 | assumed present (the repo's own release path depends on it) | unverified this session | none |
| `npm` + publish credentials for `@mindrian_os/cli` | `release.sh` Step 9.5 | assumed present | unverified this session | `MOS_TEST_DRY_RUN=1` exercises the gate without publishing |
| `node_modules/semver` | `release.sh` Step 0.5 | YES (release.sh's own preflight would have flagged it) | vendored | none; script exits 1 |
| `node` >= 22.16.0 | CJS core, `node:sqlite` timeout option | assumed (the repo runs today) | unverified this session | none |
| `python3` | `verify-release` gate 14 uses it to validate `.mcp.json` | assumed | unverified | gate degrades |
| Note: `~/.claude/plugins/cache/mindrian-marketplace/mos/` | D-15 verification | NOT INSPECTED by this research | Session T reported `2.0.0-beta.13`; unverified here | the verification task must check it first |

**Missing with no fallback:** none identified.
**Not verified, must be checked at plan time:** the website repo path (Step 9.6b hard-aborts without it), the npm credential, and the actual installed cache version.

---

## Validation Architecture

`.planning/config.json` sets `workflow.nyquist_validation: true`. This section is mandatory.

### Test Framework

| Property | Value |
|---|---|
| Framework | Plain Node CJS test files under `tests/`, invoked bare (`node tests/test-NNN-x.cjs`). Some use `node:test` + `node:assert/strict` (`test-250`, `test-234`); some are hand-rolled `record()` harnesses that `process.exit(failed === 0 ? 0 : 1)` (`test-254`). Both exit non-zero on failure, which is all the aggregator needs. |
| Config file | none. There is no jest/vitest/pytest config. Discovery is by glob inside a per-phase bash aggregator. |
| Aggregator pattern | `tests/run-all-<phase>.sh`. Newest and best model: `tests/run-all-276.sh`. |
| Quick run command | `node tests/test-339-<name>.cjs` for a single arm |
| Full suite command | `bash tests/run-all-339.sh` |
| Related suites that must also stay green | `bash tests/run-all-250.sh`, `bash tests/run-all-252.sh`, plus `node tests/test-254-normalize-roundtrip-probe.cjs`, `node tests/test-245-skill-frontmatter-inert-keys.cjs`, `node tests/test-247-contract-client.cjs`, `node tests/test-brain-response-sanitize.cjs`, `node tests/test-265-mcp-description-hygiene.cjs`, `node tests/test-257-shim-honest-refusal.cjs`, `bash tests/test-127-00-shim-handshake.sh` |
| Release gate | `bash scripts/verify-release` then `bash scripts/release.sh --prerelease` |

### The `run-all-276.sh` conventions this phase must copy

Read `tests/run-all-276.sh` in full before writing `run-all-339.sh`. Load-bearing features:

1. **Glob discovery** with a `PREFIX="${TEST_339_PREFIX:-tests/test-339-}"` variable, so adding a test file requires no runner edit.
2. **The `found -eq 0` guard**, load-bearing and must not be softened: *"A harness reporting green over zero discovery is itself the false-success disease this phase exists to close."* The variable prefix exists ONLY so this guard is provable without editing the file: `TEST_339_PREFIX=test-339-nonexistent- bash tests/run-all-339.sh` must exit non-zero.
3. **`run_may_skip`** for `.sh` arms, treating a leading `SKIP` line as a skip rather than a pass.
4. **A Part 8 source sweep** over this phase's production targets, comment-stripped then grepped for `brain-client|brain_query|pws-brain|fetch\(|https?://|node:https?|curl |wget `. **Careful:** this phase's own production targets legitimately contain `brain-client` and `https://`, so the forbidden-token list must be scoped differently here than in 276. Recommend a phase-specific list that checks the OPPOSITE property: that no NEW file introduces a raw origin literal.
5. **A no-em-dash fence** over every target plus the runner itself, with `EMDASH_MISSING` counting a missing target as a failure unless `TEST_339_ALLOW_MISSING=1`.
6. **Wave 0 red by design** is an accepted convention here (`run-all-273.sh` and `run-all-276.sh` both document it). A Wave 0 test that fails until its Wave 1 fix lands is CORRECT, not a defect, and the runner header must say so by name.

### Requirements to Test Map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| FLIP-01 | No `pws-brain-mcp.onrender.com` literal survives in any runtime code path; every runtime origin read reaches `getBrainUrl()` | unit (source scan) | `node tests/test-339-origin-single-source.cjs` | NO, Wave 0 |
| FLIP-02 | Both alias tables carry identical 8-key sets; incumbent values are the 3 incumbent names; Theo values are the 3 Theo ids; the selector reads `BRAIN_URL`; pass-through still follows the lookup; both tables stay disjoint from `chain-recommender`'s local map | unit (source scan, extend existing) | `node tests/test-254-normalize-roundtrip-probe.cjs` | YES, Arms 4-5 modified |
| FLIP-03a | A Theo RESOLVED readiness payload (score + inputs) captures, with `dimensions_inferred: false` and an exact `missing_dimensions` vector excluding any `unsynced_inputs` member | unit | `node tests/test-339-enrichment-theo-shapes.cjs` | NO, Wave 0 |
| FLIP-03b | A Theo REFUSAL payload (`{coverage:{matched:0,total:N>0}, refusal}`) captures; `{matched:0,total:0}` returns `reason:'layer_empty'` and does NOT capture; the two are never collapsed | unit | same file | NO, Wave 0 |
| FLIP-03c | An incumbent `{grounded:false}` and an incumbent `{readiness_score:1}` still capture unchanged (no regression) | unit | same file | NO, Wave 0 |
| FLIP-04 | `refusal-messaging.cjs`'s rendered `unreachable` and `no_key` copy both contain the two update commands, sourced from `lib/core/update-path.cjs`, which is byte-identical to `.claude/includes/release-process.md:23-26` | unit | `node tests/test-339-update-path-single-source.cjs` | NO, Wave 0 |
| FLIP-04b | `test-250`'s existing shape pins stay green, `larryRefusalLine` stays <= 120 chars for every kind, `no_key` keeps `DIRECTOR_NOT_AVAILABLE`, `unreachable` still carries no `upgrade_hint` | unit | `node tests/test-250-refusal-shapes.cjs` | YES, one pin added |
| FLIP-05 | `schema()`'s cache-hit branch compares `_schemaCacheOrigin` against the resolved origin BEFORE returning, and the origin is recorded in the same block that records the timestamp | unit (source scan) | `node tests/test-339-schema-memo-origin-keyed.cjs` | NO, Wave 0 |
| FLIP-06 | `skills/setup/SKILL.md` matches `commands/setup.md` under `build-skill-mirrors --check`, AND `dist/` matches `skills/` (no hand-edit, no staleness) | integration | `node scripts/build-skill-mirrors.cjs --check && node scripts/build-dist-bundles.cjs --check-stale` | script exists; **the `--check-stale` arm is NOT wired to any gate: Wave 0 wires it into `run-all-339.sh`** |
| FLIP-07 | `docs/339-NOTE-theo-desktop-connector-key.md` exists, is non-empty, contains the `mindrian-brain` prescription, the `/mcp` path, and the `BRAIN_TOOL_MATCHER` reason, and has zero em-dashes | unit | `bash tests/test-339-cross-repo-note.sh` | NO, Wave 0 |
| FLIP-08 | `269-05-PLAN.md` Task 1 contains the three leg headings and does NOT contain the retired items 1-3 as live checks | unit | `bash tests/test-339-269-05-checklist.sh` | NO, Wave 0 |
| FLIP-09 | The gate's own verify block is a pure read: running it leaves `git status --porcelain` byte-identical in both repos | integration | inline in the gate task's `<verify><automated>`; ALSO a standalone `bash tests/test-339-gate-zero-write.sh` that runs the awk+grep block against the flip record and diffs the porcelain hash | NO, Wave 0 |
| FLIP-10 | `brain-client.cjs:24` is byte-exactly the bare Theo origin (no `/mcp`, no trailing slash) and the `:4-7` docblock no longer names the incumbent | unit | `node tests/test-245-skill-frontmatter-inert-keys.cjs` (its CLAIM b, retargeted) + a `grep -F` assertion in `run-all-339.sh` | YES, modified in the FLIP cut |
| FLIP-11 | `class-m-brain-smoke.cjs` layer 6 reports `ok` against a mocked Theo-shaped `brain_stats` (`{nodes: N}`), and still reports the named `stale_replica_signature` failure when fed that count | unit | `node lib/core/doctor/class-m-brain-smoke.test.cjs` | YES, mocks modified |
| FLIP-12 | An installed session running the FLIP release returns structured Theo answers | **manual-only** | none | Justified: it requires a released artifact, a plugin-cache update, and a live Larry turn. Automating it would require publishing a release from a test, which is the thing the human gate exists to prevent. Captured as a `<verify><human-check>` block harvested into `339-UAT.md`. |

### Sampling Rate

- **Per task commit:** the single test file for that task, plus `node tests/test-254-normalize-roundtrip-probe.cjs` and `node tests/test-250-refusal-shapes.cjs` for any commit touching `brain-client.cjs` or `refusal-messaging.cjs`. Each is under 5 seconds.
- **Per wave merge:** `bash tests/run-all-339.sh`, plus `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/check-shape-declaration.cjs`.
- **Pre-cut gate (both cuts):** `bash tests/run-all-339.sh` green, then `bash scripts/verify-release` with zero FAIL, then `node scripts/doctor.cjs --acceptance`.
- **Phase gate:** full suite green before `/gsd-verify-work`; plus the post-release manual verification for FLIP-12.

### Wave 0 Gaps

Tests that must exist before implementation, ordered:

- [ ] `tests/run-all-339.sh` - the aggregator, glob discovery, `found -eq 0` guard, Part 8 sweep scoped to this phase, no-em-dash fence. Copy the structure from `tests/run-all-276.sh`.
- [ ] `tests/test-339-origin-single-source.cjs` - FLIP-01. Scans `lib/`, `bin/`, `scripts/` for a raw `onrender.com` origin literal in NON-comment lines; allowlists exactly `brain-client.cjs:24` and `class-m-brain-smoke.cjs`'s canon constant, each with a written reason.
- [ ] `tests/test-339-enrichment-theo-shapes.cjs` - FLIP-03a/b/c. Four fixtures driven through `captureReadinessMiss` directly (it is exported at `enrichment-queue.cjs:519`): Theo resolved, Theo refusal with `total>0`, Theo refusal with `total===0`, incumbent `grounded:false`, incumbent `readiness_score:1`. Uses a temp `roomDir`.
- [ ] `tests/test-339-update-path-single-source.cjs` - FLIP-04. Cross-checks `release-process.md`, `lib/core/update-path.cjs`, and the rendered refusal copy.
- [ ] `tests/test-339-schema-memo-origin-keyed.cjs` - FLIP-05. Structural, over `brain-client.cjs`'s `schema()` body.
- [ ] `tests/test-339-cross-repo-note.sh` - FLIP-07.
- [ ] `tests/test-339-269-05-checklist.sh` - FLIP-08.
- [ ] `tests/test-339-gate-zero-write.sh` - FLIP-09. Runs the awk-scoped grep block against the live flip record and asserts both repos' porcelain hashes are unchanged. **Wave 0 GREEN, not red:** the flip record already carries the ruling, so this test passes on day one and its job is to keep passing.
- [ ] Wire `node scripts/build-dist-bundles.cjs --check-stale` into `run-all-339.sh` - closes the unguarded generated-artifact gap named in the sweep section.
- [ ] Modify `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4-5 - FLIP-02. **RED by design in Wave 0** until the two-table selector lands; the runner header must say so.
- [ ] Modify `tests/test-250-refusal-shapes.cjs` - FLIP-04b, add the update-path pin. **RED by design** until the copy lands.

No test framework install is needed: Node's built-in `node:test` and `node:assert/strict` are already the repo's idiom, and there is no package to add.

---

## Security Domain

`security_enforcement` is not set to `false` anywhere in `.planning/config.json`, so this section applies.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this phase |
|---|---|---|
| V2 Authentication | **partially** | The flip moves to a KEYLESS origin. Theo ignores the Authorization header entirely; a real key, a garbage key and no header return byte-identical payloads (Theo `README.md:146-149`, three-way verified 2026-09-03). `resolve-brain-key.cjs` and its SEC-02 mode-0600 gate are UNCHANGED by this phase; the credential still resolves and is still sent, and Theo just does not read it. **This is not an authentication regression introduced here**; it is Theo's design, and the entitlement moved to install/update time under Phase 269 (`.claude/includes/moat.md`). Do not use "Theo is keyless" as a reason to touch `resolve-brain-key.cjs` in this phase. |
| V3 Session Management | no | The MCP session handshake is unchanged; Phase 267's stateless migration is out of scope. |
| V4 Access Control | **yes** | `brain_write` post-flip is `WRITE_PATH_DISABLED`, an unconditional refusal, which is strictly MORE restrictive than the incumbent's admin-tier gate. Theo's read guard adds `PLAN_REJECTED`. Both tighten, neither loosens. |
| V5 Input Validation | **yes** | `PROBLEM_TYPE_HANDLE_RE` (`brain-client.cjs:1737`) is the enum-only wire gate; it is UNCHANGED and must stay unchanged by the alias-table edit. `sanitizeCypherInput` and the ajv packet validation in `sendPacket` are untouched. |
| V6 Cryptography | no | No crypto surface changes. `crypto.randomUUID()` at `:336` for the install id is untouched. |
| V7 Error handling and logging | **yes** | The refusal-copy change (D-08) and the enrichment-capture log line are both error-path surfaces. Neither may echo user turn text. `refusal-messaging.cjs:277-283` and `:293-299` document the V5-compliance rule for interpolation: only closed-enum kinds, coerced tool names and integers cross into refusal copy. The update-path string is a frozen constant, so it satisfies this trivially. |
| V13 API and web service | **yes** | The origin change itself. Bare origin, HTTPS only, no path. `AbortSignal.timeout(BRAIN_REQUEST_TIMEOUT_MS)` bounds every call (`:339`). |
| V14 Configuration | **yes** | `MINDRIAN_BRAIN_URL` is now a security-relevant lever: it is the rollback path AND, with the origin-keyed alias table, it selects the wire vocabulary. Document that it must be a bare origin. |

### Known threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| **T-339-01:** a Desktop/Cowork connector registered as `theo` escapes the Part 8 egress guard and the response sanitizer entirely | Information Disclosure | The guard is keyed on connector NAME (`brain-response-sanitize.cjs:61`), and `part8-egress-guard-hook.cjs:152` allows unconditionally when `isBrainTool` is false. Mitigation is documentation on both sides: Theo's README already prescribes `mindrian-brain` (commit `daa1e59`), and D-10's note records the plugin half. **No test can catch this**, because no test can see a connector a user registered by hand. State the residual risk in the note. |
| **T-339-02:** the flip lands with a `/mcp` suffix or trailing slash, every call 404s, and the client renders it as "Brain unreachable" | Denial of Service (self-inflicted) | Byte-exact `grep -F` assertion in the FLIP task's verify block; the flip record calls this out as the highest-cost typo class. |
| **T-339-03:** the release is cut against an unauthorized or amended coverage ruling | Repudiation / Elevation | The `checkpoint:human-action gate="blocking"` re-reads the ruling AT RUN TIME and quotes the sentence verbatim into the SUMMARY, so the authorization is recorded, not assumed. `HOLD` in the subsection reports "coverage held" and stops before `release.sh`. |
| **T-339-04:** the gate task mutates the Theo repo or this one while "checking" | Tampering | Zero-write acceptance criterion with a `git status --porcelain` hash comparison in BOTH repos, copied verbatim from the 269-05 precedent. Read-only reads only; no `git fetch`, no scratch files. |
| **T-339-05:** decommission happens before the soak, stranding un-updated installs with no rollback | Denial of Service | Out of this repo. Enforced by task ordering in Theo's 09-12 and by section 3's "suspend, do not delete" plus the two-service ordering (compute before data). Named in this repo's CHANGELOG so nobody compresses it. |
| **T-339-06:** the npm tarball leaks `.planning/` or `docs/` during the cut | Information Disclosure | `release.sh` Step 9.5's payload gate refuses a tarball matching `\.planning/\|docs/\|mcp-server-brain/\|tests/\|release\.sh\|node_modules/` and exits 1. Already in place; run it, do not bypass it. |
| **T-339-07:** the refusal copy interpolates a server-supplied string and re-leaks content Part 8 just refused | Information Disclosure | The update path is a frozen local constant with zero interpolation. `egress_blocked`'s existing rule (`refusal-messaging.cjs:293-299`) is the model: never interpolate `c.message`, `c.question` or `c.cypher`. |
| **T-339-08:** the enrichment queue captures a Theo `refusal.detail` string containing user-derived content | Information Disclosure | `refusal.detail` is Theo-authored and generic; the recommended `probe_provenance` embeds only `refusal.code` (a closed vocabulary), never `detail`. Explicitly do NOT store `detail`. |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `--no-next-bump` on the PREP cut produces the beta.17/beta.18 pair rather than beta.17/beta.19 | Release mechanics | Cosmetic. A burned version number, not a failure. Verify with `scripts/release.sh --prerelease --no-next-bump --dry-run` before committing to the pair in any user-facing text. |
| A2 | `larryRefusalLine` composes from `REASONS` rather than from `RENDER_COPY` | Design 3 | If it reads `RENDER_COPY`, adding the update path there breaks the 120-char pin at `test-250:142` and the split recommendation is wrong. **Read the function before implementing.** |
| A3 | `extractObjectLiteral` in `test-254` accepts an arbitrary declaration-prefix argument and will work with the two new table names | Design 1 | If it is hard-coded to the old name, Arm 4 needs a helper change too. Low risk; it takes the prefix as a parameter today. |
| A4 | The npm publish credential for `@mindrian_os/cli` is present on this machine | Environment | Step 9.5 HALTS the release. Check with `npm whoami` before the cut. |
| A5 | `$HOME/mindrian-website/website` exists with an `origin` remote | Environment | Step 9.6b HARD ABORTS mid-release, after Commit A and the tag. Check before either cut, or pass `--no-website`. |
| A6 | `claude plugin validate` is on PATH | Environment | `verify-release` gates 1, 2 and 5 degrade or fail. |
| A7 | The installed plugin cache on this machine is at `2.0.0-beta.13` | Post-release verification | Session T's report, not verified here. Affects only how many update steps the verification needs. Check with `ls ~/.claude/plugins/cache/mindrian-marketplace/mos/`. |
| A8 | Phase 276's next pause point is after plan 276-09 (the newest plan with a SUMMARY) | Release mechanics | If 276 is mid-plan when a cut is attempted, the tree is dirty and Step 2.5's clean-tree gate aborts. Confirm with the 276 executor before scheduling either cut. |
| A9 | `data/brain-surface-contract.json` carries no origin literal | Sweep | Verified by grep (0 hits). Included for completeness; its `error_semantics` and `indexes` blocks ARE incumbent-shaped, which is a deferred item, not a sweep item. |
| A10 | Theo's `brain_stats` field names are `nodes` and `relationships` at the top level of the tool result | Design 5 (class-m fix) | Read from `brain-stats.ts:211-216` source, not from a live call (a live `brain_stats` is a read and would have been safe, but the source is authoritative and the wire wrapping through `to-tool-result.ts` was not inspected). If `toToolResult` nests the payload, the dual-shape guard needs one more level. **Verify with one live read-only `brain_stats` call at execution time.** |

---

## Open Questions

1. **Does the FLIP cut include `brain-router.cjs`?**
   - What we know: `brain-router.cjs:307` reads a shape Theo never emits and degrades silently to the Tier-2 heuristic with the disclosure suppressed (verified at HEAD; documented in `docs/254-NOTE-...` section 2 as "the single highest-risk line" class).
   - What is unclear: D-03 locked "consumers 1 and 3, leave consumer 2", and this is a fourth consumer nobody scoped.
   - Recommendation: fold an ADDITIVE disclosure into the PREP cut (incumbent-safe by construction, since the incumbent always carries `next_gate`). If the navigator wants the prep cut narrower, name the silent degrade explicitly in the CHANGELOG and the soak checklist. Do not ship it unnamed.

2. **Does `CANON_NODE_FLOOR` become per-origin, or does layer 6 stop asserting a floor?**
   - What we know: `29000` is meaningless against Theo's 1,253, and layer 6's not-ok is information-only for the release gate.
   - What is unclear: whether a Theo-appropriate floor is knowable. Theo's canon is actively growing (1,253 nodes on 09-03, up from 712 on 09-02).
   - Recommendation: per-origin floor selected by the same `THEO_ORIGINS` mechanism as the alias table, with the Theo floor set conservatively (say 1000) and a comment that it is a floor, not a target. A moving denominator argues against a tight number.

3. **Is the D-13 flush a no-op, and does the navigator accept that reading?**
   - What we know: the memo is in-memory, process-local, and `BRAIN_URL` is immutable per process. There is nothing persistent to flush.
   - What is unclear: whether Session T's caution was based on a mechanism this research did not find.
   - Recommendation: ship key-by-origin in PREP, ship no `flushSchemaMemo()`, and put this question in the plan's own checkpoint text so Session T can correct it if the premise is wrong.

4. **Does the tester note ship at the FLIP cut or at suspend-minus-one-week?**
   - What we know: D-11 says a standalone note at the flip release plus one reminder at suspend minus one week, and no suspend date is promised before Theo 09-12 Task 3 fixes one.
   - What is unclear: Task 3 has not run, so there is no date. A "cutover note" with no date and no user-visible change (the flip is transparent to an updated install) may be noise.
   - Recommendation: draft BOTH at the flip cut, file both, and send only the first. State plainly in the draft that the note exists because an un-updated install will go dark at suspend, and that the update path is the whole ask.

5. **Where does the 30-name coverage gap get named to users?**
   - What we know: D-06a fixes the verbatim fact (`/mos:leadership` and due-diligence consults answer thinner). The flip record's ruling clause 3 says this line travels with the release, on flip day.
   - What is unclear: CHANGELOG only, or CHANGELOG plus the `/mos:leadership` command's own help text.
   - Recommendation: CHANGELOG plus the tester note. Do NOT edit `commands/leadership.md`'s body: that would be a user-facing behavior claim about a temporary state, and it would go stale the moment the 30 names are ingested.

---

## Sources

### Primary, HIGH confidence (read directly this session)

**This repo, at HEAD `3782dbc7`:**
- `lib/core/brain-client.cjs` (2251 lines): `:1-30`, `:330-352`, `:918-950`, `:1038-1078`, `:1155-1175`, `:1611-1645`, `:1700-1800`, `:1183`, `:1279`, `:1415`, `:2197-2199`
- `lib/core/enrichment-queue.cjs`: `:47-48`, `:55-79`, `:186-233`, `:329-410`, `:426-432`, `:435-520`
- `lib/core/refusal-messaging.cjs`: `:8-10`, `:84`, `:194-232`, `:241-320`, `:326-380`, `:397`, `:411`
- `lib/core/brain-response-sanitize.cjs:55-70`; `hooks/hooks.json:239,341`
- `lib/brain/chain-recommender.cjs`: `:46`, `:65-85`, `:545-580`, `:620-645`
- `lib/mcp/brain-router.cjs`: `:260`, `:277-320`, `:400`, `:411-429`
- `lib/core/doctor/class-m-brain-smoke.cjs`: `:55-90`, `:295-360`; `class-m-brain-smoke.test.cjs:74,333,365`
- `bin/mindrian-brain-mcp-client.cjs` (304 lines): `:151`, `:188-215`, `:238`, `:253`, `:271`, `:285`
- `scripts/release.sh` (1462 lines): `:28`, `:59-66`, `:81-175`, `:205-251`, `:267-285`, `:365-380`, `:383-410`, `:424-448`, `:448-500`, Step 7.5, Step 9.5, Step 9.6b
- `scripts/verify-release` (36KB): sections 1-19 plus the package-lock check; `:318-334`, `:458-496`, `:513-560`, `:674-720`
- `scripts/check-brain-tool-liveness.cjs:1-80`, `:122`, `:160`, `:247`
- `scripts/build-brain-census.cjs:1-70`; `scripts/build-dist-bundles.cjs:1-90`, `:315-435`; `scripts/build-skill-mirrors.cjs:1-40`, `:165`
- `scripts/build-connector-registry.cjs:36`, `:77-79`, `:274-278`; `scripts/check-shape-declaration.cjs:7`, `:695-702`
- `scripts/probe-brain-contract.cjs:20-74`, `:280-296`, `:421`
- `scripts/part8-egress-guard-hook.cjs:138-160`; `scripts/session-start:1875-1900`; `scripts/doctor.cjs:215-240`, `:1355-1420`, `:3149-3185`
- `tests/test-254-normalize-roundtrip-probe.cjs:250-336`; `tests/test-250-refusal-shapes.cjs` (189 lines, full); `tests/test-245-skill-frontmatter-inert-keys.cjs:32`, `:108-140`; `tests/test-234-tool-description-floor.cjs:1-90`; `tests/run-all-276.sh` (full)
- `commands/setup.md:92-115`, `:206`, `:226`, `:248-265`; `docs/brain-setup.md:15-40`; `docs/install/BRAIN-SETUP.md:30-45`
- `CHANGELOG.md:1-20`, `:127`, `:729`; `.claude-plugin/plugin.json`; `package.json`; `dist/BUNDLE-VERSION.json`
- `.planning/config.json`; `.planning/STATE.md` frontmatter + Phase 276/339 entries; `.planning/ROADMAP.md` Phase 339 and Phase 267 sections; `.planning/REQUIREMENTS.md` family headings + `:1107-1119`
- `.planning/phases/269-.../269-05-PLAN.md` Task 1 (full) and Task 2 opening
- `docs/254-NOTE-theo-adaptation-list-additions.md:1-45`; `docs/257-NOTE-part8-enforcement-locus-rulings.md:1-25`
- `CLAUDE.md` (full, 292 lines) plus all four `@include` files
- `~/mindrian-marketplace/.claude-plugin/marketplace.json`; `git -C ~/mindrian-marketplace log`

**Theo repo, at HEAD `81dfac8`:**
- `.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md` (629 lines): all headings, `:295-470` (the ruling subsection, in full), `:471-629` (sections 2, 3, and the sections-4-5 note, in full)
- `.planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md`: headings, `:102-185` (failure modes and the named plugin change-list table, in full)
- `.planning/phases/09-brain-contract-cutover/09-12-PLAN.md` (full): frontmatter, objective, Tasks 1-4, threat model, success criteria
- `.planning/phases/08.4-remote-hosting-mcp-server/08.4-MOS-LEARNING.md`: `:28`, `:47-69`, `:138`
- `.planning/seeds/SEED-004-...md`: heading census (four `## UPDATE` sections, latest 2026-09-02) plus the closing 60 lines
- `src/mcp/content/recommend-chain.ts`: `:1-90`, `:235-250`, `:318-332`, `:525-555`
- `src/mcp/content/orchestration-readiness.ts`: `:30-140`, `:300-345`, `:400-450`, `:460-540`
- `src/mcp/content/coverage.ts` (full)
- `src/mcp/content/brain-stats.ts`: `:1-70`, `:205-219`
- `README.md:105-175`; `git log -- README.md`

**GSD core:**
- `$HOME/.claude/gsd-core/references/checkpoints.md`: `:1-140`, `:191-234`

### Live read-only probes (no writes)

- `GET https://theo-mcp.onrender.com/health` -> `{"status":"ok"}` (2026-09-03)
- `GET https://pws-brain-mcp.onrender.com/health` -> `{"status":"ok","graph":true}` (2026-09-03)
- `node -e` semver arithmetic against this repo's own vendored `semver`, to compute the release version pair

### Deliberately not consulted, with reasons

- **langtalks-graph-expert:** this is a wire-protocol and release-mechanics question. Its corpus covers agent/LLM engineering CONCEPTS (memory, RAG, GraphRAG, context engineering, dispatch patterns). It cannot answer "what shape does this specific MCP server return" or "how does this repo's release script sequence its steps". `CLAUDE.md:222-224` names picking it by default for questions a different source answers more authoritatively as itself a research gap.
- **Context7:** no library, runtime or API contract is in question. Every claim here is about this repo's own source or Theo's own source. The one Node-adjacent claim (`AbortSignal.timeout`) is not load-bearing for any decision.
- **WebSearch / WebFetch:** nothing time-sensitive or external. Both origins were probed directly.
- **icm-architect:** no room-structure, ICM, or local-graph work in this phase.
- **Any write-shaped endpoint:** `brain_write`, `POST /register`, `text2cypher` against either origin. Not called, per the read-only constraint.

### No packages installed

This phase adds no npm dependency. `package.json` is not modified except by `release.sh`'s version bump. **The Package Legitimacy Audit section is therefore omitted as not applicable**; there is nothing to audit.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| HEAD drift re-verification | **HIGH** | Every citation read directly at HEAD with exact line numbers, not inferred |
| Literal sweep sizing and classification | **HIGH** | Mechanical grep, 93 hits / 52 files, each classified against a read of the file |
| Theo's contract (ids, matching rule, payload shapes) | **HIGH** | Read from Theo's own TypeScript source, which is the authority per the standing consult rule |
| The coverage ruling and its literals | **HIGH** | Read the subsection in full; every gate literal grep-verified present |
| Release mechanics and the version pair | **HIGH** | Read `release.sh` and `verify-release` end to end; version arithmetic computed live against the repo's own semver |
| The alias-table design | **HIGH** | Both vocabularies verified at source; the selector is a three-line addition with a verified inert-against-incumbent property |
| The enrichment-arm design | **MEDIUM-HIGH** | Both Theo payload shapes read at source; the storage contract verified. MEDIUM only on A10 (whether `toToolResult` nests the payload), which one live read-only call at execution time settles |
| The `class-m-brain-smoke` three-fold break | **HIGH** | All four constants read; Theo's `brain_stats` payload read at source; the doctor arm's fail conditions read at `doctor.cjs:1402-1417` |
| The `brain-router` fourth consumer | **HIGH** | Code read at HEAD; the `next_gate` absence independently recorded in `254-NOTE` with a cited grep |
| The D-13 memo premise correction | **MEDIUM** | The code reading is certain (module-scope const, in-memory cache, no disk artifact). MEDIUM because Session T may have had a mechanism in mind this research did not find, hence Open Question 3 |
| Environment availability | **MEDIUM** | Both origins and both repos verified live; the website repo, npm credential, `claude` CLI and installed cache version are assumed and flagged |
| Validation architecture | **HIGH** | The aggregator pattern read in full from `run-all-276.sh`; every named test file read or grepped |

**Research date:** 2026-09-03
**Valid until:** 2026-09-10 (7 days). Short window, deliberately: Theo's canon is moving (712 nodes on 09-02, 1,253 on 09-03), Phase 276 is executing in this working tree, and the flip record can be amended by Session T at any time. The D-05 gate re-reads the ruling at run time precisely so a stale reading here cannot authorize a release.
