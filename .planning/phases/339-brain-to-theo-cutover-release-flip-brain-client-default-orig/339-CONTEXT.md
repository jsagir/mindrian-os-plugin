# Phase 339: Brain-to-Theo cutover release - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the plugin release(s) that move every installed user's Brain traffic from the incumbent (`https://pws-brain-mcp.onrender.com`) to Theo (`https://theo-mcp.onrender.com`), and hand Theo's Phase 9 plan 09-12 its Task 2 resume signal ("flip verified" plus the shipped version). The required change is one line (`lib/core/brain-client.cjs:24`). Everything else in this phase exists so that line can ship safely, be rolled back trivially, and not go dark on the consumers that would otherwise fail silently.

NOT in this phase: the SDK v2 / stateless migration (Phase 267, blocked upstream on ext-apps, re-verified 2026-09-03), the entitlement-gate engineering (Phase 269-05, stays behind its own gate), decommissioning the incumbent on Render (Theo 09-12 Task 3, operator-held, after soak), and any Theo-side change (Session T owns `~/Theo`).

Two sessions run in parallel in two repos. Session M (this repo) owns this phase. Session T (`~/Theo`) resumes Phase 9 at 09-12 Task 2 and owns Tasks 3-4. The seam is exactly two artifacts: Theo's `09-FLIP-RECORD.md` section 2 (what the release changes) and its section 1 coverage ruling (what gates the release); and 09-12's resume signal (what M reports back).

</domain>

<decisions>
## Implementation Decisions

### Release shape (Claude's discretion, not discussed; flag for override)
- **D-01:** Two cuts, not one. A PREP release carries everything that is safe against BOTH Brains (the literal sweep, the two dual-shape adaptations, the refusal-copy amendment, the doc/connector changes, the 269-05 checklist rewrite, the schema-memo flush mechanism). A FLIP release then contains exactly `lib/core/brain-client.cjs:24` + the stale docblock at lines 4-7 + its CHANGELOG entry, so rollback of the flip is a one-line revert (or `MINDRIAN_BRAIN_URL` per install). Version numbers are `scripts/release.sh`'s call at cut time; CHANGELOG currently reads `v2.0.0-beta.16 (in progress)` and the latest tag is `v2.0.0-beta.15`, so the natural pair is beta.16 (prep) and beta.17 (flip). Both cuts are human-held.
- **D-02:** Before either cut: push the 295 commits `main` is ahead of `origin/main` (navigator directive). Phase 276 is executing in this same working tree; it pauses at a wave boundary for each cut so `verify-release` sees a clean tree. Every commit in this phase stages named files only (never `git add .`).

### Adaptation scope (navigator pick: A)
- **D-03 (locked):** Fold consumers 1 and 3 into the PREP release as ADDITIVE, incumbent-safe code; leave consumer 2 as-is. Verified from code by the advisor researcher (2026-09-03):
  - Consumer 1, `BRAIN_PROBLEM_TYPE_ALIASES` at `lib/core/brain-client.cjs:1713-1722` (the roadmap's `:1607-1616` is stale): the map ITSELF breaks the post-flip match. It sends `Undefined Problem`; Theo matches `toLower(m.id) = toLower($problemType)` with no suffix folding (`/home/jsagi/Theo/src/mcp/content/recommend-chain.ts:65-69`), so all three mapped types return a SUCCESS carrying `chain: []`, `refusal.code = PROBLEM_TYPE_NOT_FOUND` and `available_problem_types`. An unmapped `Undefined` would have matched Theo's `UnDefined`; `Wicked` passes through unmapped (`:1743`) and works. Fix: the alias table's TARGET values are selected by the resolved origin (`getBrainUrl()`), so incumbent origin projects onto `Undefined Problem` / `Ill-Defined Problem` / `Well-Defined Problem` and Theo origin projects onto `UnDefined` / `IllDefined` / `WellDefined` (plus `Wicked`, `Trinity`, `Compass` pass-through). A `MINDRIAN_BRAIN_URL` revert then moves vocabulary and URL together. `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4 and 5 (`:258-303`) pin exactly 8 keys onto the 3 incumbent values and prove disjointness from `lib/brain/chain-recommender.cjs`'s local `UDP/IDP/WDP` map; they change in the same commit to pin BOTH origins' value sets and re-prove disjointness against the Theo ids.
  - Consumer 3, `lib/core/enrichment-queue.cjs:471,478`: `_maybeCaptureEnrichmentMiss` requires `typeof pr.grounded === 'boolean'` and a finite `pr.readiness_score`; Theo's readiness payload emits `score` + `inputs` + `evidence` + `coverage` + `unsynced_inputs` (`/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts:494`) and neither name, so both arms miss, `:493` returns `{captured:false, reason:'invalid_probe_result'}`, and `brain-client.cjs:1631` logs only on `queued`. This is the one TRUE silent failure. Fix: one additive arm (`else if (typeof pr.score === 'number')`, reading groundedness from the `coverage` block: `{matched: 0, total: N>0}` is "nothing for your input", `{matched: 0, total: 0}` is "layer empty", never collapsed) that the incumbent's shape can never enter. Add a test that drives both shapes through the capture path.
  - Consumer 2, `lib/brain/chain-recommender.cjs:553-559`: degrades DISCLOSED, not silently (`grounded === false` never fires, the next clause `chain.length === 0` yields `note = 'unknown_problem_type'` plus a `_disclosureOffer`); on a type Theo matches, the success path runs intact because Theo's steps carry `framework` as a string. Rides as-is; its adaptation (reading `result.refusal`, `result.note` at `:633`, `step.commands` divergence logging) is a named follow-up, not this phase.
- **D-04 (locked, pattern):** Every adaptation follows the already-shipped `brain_query` dual-shape branch (`lib/core/brain-client.cjs:927-945`, commit `21fdd7bc`): guard on the shape (`Array.isArray`, `typeof === 'number'`), never on key presence; recognize both shapes in one block; keep the loud `_unrecognizedQueryShape` safety net.

### Coverage release gate (navigator pick: A; updated same day after Session T ruled)
- **D-05 (locked):** The FLIP release is gated by a `checkpoint:human-action gate="blocking"` task in the flip plan, ordered after every automatable task (sweep, adaptations, CHANGELOG entry, tests, `git push`) and immediately before the task that runs `scripts/verify-release` and `scripts/release.sh`. Under this repo's `mode: "yolo"`, `human-action` is the only checkpoint kind that still halts (precedent: `269-05-PLAN.md` Task 1). The gate task makes ZERO repository writes (`git status --porcelain` byte-identical before and after) and reads ONE cross-repo file read-only: `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md`.
- **D-06 (locked; the ruling ALREADY EXISTS, written by Session T at Theo commit `81dfac8`, 2026-09-03):** the gate reads, inside `## 1. Authorization evidence` (before `## 2. Flip instructions for the plugin release`), the subsection headed exactly `### Coverage re-measurement, 2026-09-03, and the ruling on it` (flip record line 301 at that commit) and requires, each a literal grep scoped to that subsection: the pins `Brain` `56bf75a` and Theo `83a1ce2` (repo = Render live deploy = served stamp, three-way on each side); the canon figures `1,253` / `1,522` / `420` and the Brain figures `29,200` / `24,375` / `258`; the name-level coverage line `Covered: 228 of 258, 88.4%` with `Uncovered: 30 of 258`; and the ruling sentence `Coverage does NOT block Task 2, the flip` (line ~437). The named-Frameworks ratio is RETIRED as a coverage measure by that ruling; coverage is a set question (of the Brain's 258 names, how many resolve in Theo by name). Freshness: the gate re-reads the file at run time and quotes the ruling sentence verbatim into the SUMMARY; if the section has been amended to `HOLD` or the sentence is gone, the gate reports "coverage held" and stops before `release.sh`. Resume signal: `coverage ruled` plus the ruling sentence verbatim, or `coverage held` plus what changed. "Held" is a successful gate outcome, not a stall.
- **D-06a (locked, consequence of the ruling):** the 30 uncovered names (20 leadership/teams, 5 due diligence, 5 misc) bind Theo's Task 3 (decommission), NOT the flip. Flip-day fact for the CHANGELOG and the tester note, verbatim from Session T: `/mos:leadership` and due-diligence consults answer thinner through Theo until the 30 names are ingested (Theo holds the `/mos:leadership` command node with zero framework links); this is an honest-empty coverage block, not an error.
- **D-07 (locked):** The PREP release is NOT gated by the coverage ruling (it is safe against both Brains by construction, D-01). Only the FLIP cut waits.

### Stale installs and connectors (navigator picks: i amend, ii keep `mindrian-brain`; iii adopted as discretion)
- **D-08 (locked, i):** Amend the refusal copy at the single chokepoint `lib/core/refusal-messaging.cjs` so BOTH `unreachable` (`:260`, `:370-373`, today "We can retry in a moment") and `no_key` (a fresh stale install lands here, "registration failed (HTTP 503, offline or unreachable)", because a suspended origin breaks `_tryAutoRegister` at `brain-client.cjs:337-346`) name the two-command update path verbatim from `.claude/includes/release-process.md:23-26`: `/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace`. `NEXT_MOVES.unreachable` (`:307`, frozen `['retry','continue_without']`) gains an `update` handle only if a consumer reads it; planner decides. `tests/test-250-refusal-shapes.cjs` pins are loose (`/Larry/`, `/brain-access/`); add a pin for the update path so the copy cannot drift back. State the honest limit in the plan and the CHANGELOG: this copy cannot reach an install that has not updated (stale bytes print the stale string); it is the durable fix for the next origin move and for honesty. The levers that reach today's stale population are the soak window and the tester note.
- **D-09 (locked, ii):** The prescribed Claude Desktop / Cowork direct-connector key stays `mindrian-brain`. Docs change ONLY the URL (`https://theo-mcp.onrender.com/mcp`, WITH the `/mcp` path, because a direct connector hits the MCP endpoint itself; this is deliberately different from line 24, which takes the BARE origin) and drop the now-unnecessary `Authorization` header (Session T verified 2026-09-03: real key, garbage key and no header return byte-identical payloads, and `/register` answers 200 with an opaque token Theo never checks, so pre-269 clients are not dark): `docs/brain-setup.md:21-32`, `commands/setup.md:95-108` and `:252-260`, `docs/install/BRAIN-SETUP.md:38-39`, `skills/pws-brain/SKILL.md`, `skills/setup/SKILL.md`, and their `dist/generic-claude-dir/` and `dist/zed/` mirrors. The docs say plainly: the key names the plugin's Brain slot, not the server. `BRAIN_TOOL_MATCHER` (`lib/core/brain-response-sanitize.cjs:61`) and its byte-identical twins at `hooks/hooks.json:239,341` are NOT touched; `tests/test-brain-response-sanitize.cjs:293-315` keeps enforcing parity.
- **D-10 (locked, escalation):** Theo's own `README.md` names the Desktop connector key `theo`. A user following it produces `mcp__theo__*` tool names that fall OUTSIDE the Part 8 egress guard (`scripts/part8-egress-guard-hook.cjs:153-154` allows unconditionally when `isBrainTool` is false) and the response sanitizer. This is a constitutional gap no test catches. Session M does not edit Theo; the plan includes a task that writes a short cross-repo note at EXACTLY `docs/339-NOTE-theo-desktop-connector-key.md`. UPDATE 2026-09-03: Session T already landed the README side at Theo commit `11d6f82` (README.md only, a ten-line callout after the Option A example: plugin users keep `mindrian-brain`, change only the URL to `https://theo-mcp.onrender.com/mcp`, no Authorization header; the `theo` key is for standalone use; mechanism stated; and a backticked cross-reference to that exact note path in this repo). The note path is therefore a HARD deliverable of the PREP cut: it must exist at that path, state the mechanism (matcher + egress guard), and cite Theo `11d6f82`. Theo-side hashes on the seam: `81dfac8` (coverage ruling), `221df3e` (close-out staging), `11d6f82` (README).
- **D-11 (Claude's discretion, iii, recommendation adopted; flag for override):** Testers get a STANDALONE cutover note at the flip release, with its own subject line, naming the suspend date, plus one short reminder at suspend minus one week. No suspend date is promised before Theo 09-12 Task 3 fixes one. Hard rules from the navigator's standing memory apply: Feynman-simplified, LTR, no em-dashes, website link in three places, npm-led update path, M:OS design tokens, signed "Js.". The note is a filed draft in this phase, not a send; sending is the operator's.

### Sweep, memo, checklist (locked from the roadmap goal, not contested)
- **D-12:** No runtime site carries its own origin literal. Every runtime read derives from `lib/core/brain-client.cjs`'s exported `getBrainUrl()` (`:1163`). Runtime sites: `lib/core/doctor/class-m-brain-smoke.cjs:76` (`CANON_BRAIN_URL`), `scripts/probe-brain-contract.cjs:74`, `scripts/build-brain-census.cjs:61`, plus the comment-level references in `lib/core/mcp-profiles.cjs:22`, `lib/core/enrichment-queue.cjs:465`, `scripts/rs-experts-command.cjs:10`, `scripts/rs-thesis-command.cjs:10`, `scripts/sessionstart-post-update-preflight.cjs:38`. Fixtures `tests/fixtures/246-census-fixture.json` and `tests/test-245-skill-frontmatter-inert-keys.cjs` follow. User-facing surfaces per D-09. `CLAUDE.md` Three Layers + stack tables. Dated handoffs, RCAs and `.planning/debug/*` under `docs/` are historical records: leave them.
- **D-13:** `brain_schema` memo (`lib/core/brain-client.cjs:1045-1070`, 30-minute process-wide TTL) is keyed on the resolved origin, so a cached incumbent schema cannot survive an origin change within one process (this mechanism is inert against the incumbent and may ship in the PREP cut). The FLUSH itself rides the FLIP cut, never the prep cut (Session T caution, 2026-09-03: flushing on prep leaves the incumbent schema able to survive the URL change for up to half an hour). `bin/mindrian-brain-mcp-client.cjs` tool descriptions drop "live Memgraph backend" / Pinecone / e5 wording and the `mode_signals` promise Theo does not honor.
- **D-14:** Phase 269-05's six-item Theo-readiness checklist is rewritten to the three real legs: (a) coverage re-measured live against a PINNED Brain count, read from Theo's SEED-004 latest dated `## UPDATE` (never from the 09-02 addendum); (b) Theo Phase 06.2 live, meaning summaries on disk; (c) 09-12 infrastructure legs (08.4 closed, 09-11 parity 0 mismatches, `/register` compat route). Items 1-3 of the old list (Theo Phase 7/8/9 `Plans: TBD`) are retired because they read PASS while the real legs were unchecked.

### Post-release verification (locked from Theo 09-12 Task 2)
- **D-15:** On an installed session running the FLIP release, exercise `brain_stats` and `brain_ask` through Larry and confirm structured Theo answers; run `scripts/probe-brain-contract.cjs` and record which legs invert (leg b: `text2cypher` now served, `brain_ask_anything` draws an MCP unknown-tool error instead of an allowlist 403; leg c's refusal marker changes; these are EXPECTED and documented, not failures); verify the enrichment queue captures on a Theo-shaped miss (the D-03 regression check); report to Session T: shipped version plus "flip verified" (the resume signal), or what failed so rollback is invoked. The same report carries the six flip-day fields T's `09-12-CLOSEOUT-STAGING.md` section F leaves blank: final URL, shipped version, cold-start latency (first call after the cut, seconds), `/register` route status observed from the installed client, decommission date (blank; T's), and `brain_schema` flush yes/no. Before the flip cut, M messages T "cutting the flip now" so T takes the same-minute `/health` + first-call latency reading for flip-record section 4.

### Research corrections (339-RESEARCH.md, 2026-09-03, verified at plugin HEAD 3782dbc7 and Theo HEAD 81dfac8; these SUPERSEDE the matching lines above where they conflict)
- **D-01 corrected (versions):** `scripts/release.sh` takes a bump MODE, not a version literal (`CLAUDE.md:83` is stale), and increments from `plugin.json`'s current `2.0.0-beta.16`; Commit B pre-bumps, which is why every released beta tag is odd. Computed live: PREP = **beta.17**, FLIP = **beta.19** by default (or .17/.18 with `--no-next-bump`; planner picks and states which). The npm package is `@mindrian_os/cli`, not `@mindrian/os`. `verify-release` gate 12 (git state) is a WARN, but `release.sh` Step 2.5's clean-tree gate is a FAIL: Phase 276's dirty tree must be clean before each cut. Gate 19 (Brain tool liveness) is offline and hermetic, so the flip cannot break it.
- **D-03 corrected (enrichment needs TWO arms):** Theo's readiness payload has two shapes; the refusal branch omits `score`, `inputs`, `evidence` and `framework` entirely (`/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts:92-101`), so `else if (typeof pr.score === 'number')` alone leaves `FRAMEWORK_NOT_FOUND` falling through to `invalid_probe_result`. Two additive arms: the `score` arm and a refusal arm keyed on the refusal envelope. Test drives all three shapes (incumbent, Theo success, Theo refusal).
- **D-03b (Claude's discretion, additive, flagged for override):** a fourth silent-degrade consumer joins the PREP cut: `lib/mcp/brain-router.cjs:307` reads `next_gate.options[]`, a shape no Theo tool emits, and falls through to the Tier-2 heuristic with its disclosure suppressed (gated on `!isAvailable()`, which stays true post-flip). Same class as consumer 3 (traceless), same fix shape (one additive branch that surfaces the disclosure when the Brain answered but the gate shape is absent). `lib/brain/chain-recommender.cjs` still rides as-is.
- **D-12b (locked, sweep addition):** `lib/core/doctor/class-m-brain-smoke.cjs` layer 6 breaks three ways, not one: `CANON_BRAIN_URL` (derive from `getBrainUrl()`), the `totalRecordCount` field name (Theo's `brain_stats` returns `{nodes, relationships, labels}`; read both shapes), and `CANON_NODE_FLOOR = 29000` against Theo's 1,253 (per-origin floor: keep 29000 for the incumbent origin, set a Theo floor of 1000 keyed on the same `THEO_ORIGINS` set; do not drop the assertion). Sweep total per research: 93 hits across 52 files; `data/brain-census.generated.json` has no `--check` release gate, so it may stay stale; `scripts/build-dist-bundles.cjs --check-stale` is wired to nothing (named Wave 0 gap: run it explicitly after editing `skills/`, never hand-edit `dist/`).
- **D-13 corrected (no flush exists to perform):** `BRAIN_URL` is a module-scope const and `_schemaCache` is in-memory and process-local, so no process can observe an origin change; an exported `flushSchemaMemo()` would have zero callers. Key-by-origin ships in PREP, provably inert against the incumbent. The FLIP cut therefore carries exactly: line 24, the lines 4-7 docblock, the CHANGELOG entry, and the three files whose VALUES must move in the same commit as the origin (`class-m-brain-smoke.cjs` constants per D-12b, `tests/test-245-skill-frontmatter-inert-keys.cjs`'s hard equality assert, `CLAUDE.md:51,131`). The alias-table selector (`THEO_ORIGINS` set) ships in PREP so Theo vocabulary engages the moment line 24 changes. The flip-day addendum field "brain_schema flush yes/no" is answered "no flush needed: memo is process-local, keyed by origin since beta.17".
- **D-14 corrected (source pointer):** SEED-004's latest dated `## UPDATE` is the 2026-09-02 one and says "not yet". The 2026-09-03 measurement and ruling live in Theo's `09-FLIP-RECORD.md:301-470` and explicitly supersede that addendum on leg (a). The 269-05 checklist rewrite points leg (a) at the flip record's coverage subsection (and any later dated re-measurement there), leg (b) at Theo Phase 06.2 summaries on disk plus the 06.3-or-catch-up clause now bound to Task 3 in `09-12-CLOSEOUT-STAGING.md` section B, leg (c) at 09-12 infrastructure.
- **D-10 corrected (already reciprocal):** Theo's README already prescribes `mindrian-brain` and already cites `docs/339-NOTE-theo-desktop-connector-key.md` (which 404s today). The note is a reciprocal artifact of the PREP cut, not an ask.
- **Open questions from research, decided here (Claude's discretion):** tester note is drafted and filed in the PREP cut with the suspend date left as a placeholder, and sent only when T's Task 3 fixes the date (draft-and-hold, consistent with D-11); the 30-name gap goes in the CHANGELOG and the tester note only, not in `/mos:leadership` help text.

### Claude's Discretion
- Release shape (D-01) and tester comms (D-11) as stated above.
- Alias mechanism: origin-derived table (preferred, keeps rollback coherent) over a one-shot retry on `PROBLEM_TYPE_NOT_FOUND` using `available_problem_types`.
- Whether the schema-memo fix is a key-by-origin, an exported `flushSchemaMemo()`, or both.
- Sweep granularity per file; where the update-path string lives (one constant, reused by refusal copy, doctor and docs, so it cannot drift).
- Wave layout: prep-release plans first, flip-release plans last, the human-action gate immediately before the flip cut.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The flip contract (Theo side, read-only from this repo)
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-FLIP-RECORD.md` - status AUTHORIZED not executed; section 2 = the exact line and value; section 3 = rollback; section 1 = where the D-06 coverage ruling lands
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-MOS-LEARNING.md` - response envelopes, the coverage block honesty contract, the named plugin change list, the 2026-09-02 addendum defining the three readiness legs
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-12-PLAN.md` - Tasks 2-4: what M reports back, soak, decommission (suspend `srv-d9gfa03tqb8s73csfmtg` then `srv-d9geq2urnols73cimkfg`, never delete)
- `/home/jsagi/Theo/.planning/phases/08.4-remote-hosting-mcp-server/08.4-MOS-LEARNING.md` - the bare origin, keyless property, `/register` compat route
- `/home/jsagi/Theo/.planning/phases/09-brain-contract-cutover/09-12-CLOSEOUT-STAGING.md` (Theo commit `221df3e`, 2026-09-03) - Session T staging for 09-12 close-out: A = 30-name decommission ledger (LEAD-01..20, DD-01..05, MISC-01..05); B = drift clause; C = six grep-checkable Task 3 exit conditions; D/E = flip-record section 5 and 4 templates (E holds the same-minute latency slot T fills on M's "cutting the flip now" cue); F = the 09-MOS-LEARNING flip-day addendum template whose blanks M's post-release report fills
- `/home/jsagi/Theo/src/mcp/content/recommend-chain.ts` (lines 27-47, 65-69, 241, 325, 530-548) - Theo's problem-type ids and matching rule
- `/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts` (line 494) - Theo's readiness payload shape
- `/home/jsagi/Theo/README.md` - "Option A: remote via the mcp-remote proxy" (the `theo` key mismatch, D-10)
- `/home/jsagi/Theo/.planning/seeds/SEED-004-*.md` latest dated `## UPDATE` - the pinned coverage numbers the 269-05 rewrite reads (D-14)

### Prior plugin decisions this phase inherits
- `docs/254-NOTE-theo-adaptation-list-additions.md` section 4 - alias map pinned, target named
- `.planning/phases/254-orchestration-projection-consumption-wiring-suggest-next-act/254-CONTEXT.md` D-07 - Theo forward-compatibility rule
- `.planning/phases/257-part-8-enforcement-locus-host-independent-egress-guard/257-CONTEXT.md` D-08 - Theo notes as written notes
- `.planning/phases/269-moat-shift-install-update-entitlement-gate-replaces-per-quer/269-05-PLAN.md` Task 1 - the blocking human-action gate precedent and the checklist D-14 rewrites
- `docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md` - credential model (option-b, one credential) and Q2 (refuse-to-operate stays public); context for why keyless Theo does not reopen decision 1
- `docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md` - findings 1 and 2, the two-session protocol
- `.planning/ROADMAP.md` section "### Phase 339" - the full goal text
- `.planning/ROADMAP.md` section "### Phase 267" - why the SDK migration is NOT this phase

### Mechanisms and tests this phase touches
- `lib/core/brain-client.cjs` :4-7 (docblock), :24 (the line), :337-346 (`_tryAutoRegister`), :927-945 (dual-shape pattern), :1045-1070 (schema memo), :1163 (`getBrainUrl`), :1631 (capture log), :1713-1743 (alias map and pass-through), :1778 (`recommendChain` send)
- `lib/core/enrichment-queue.cjs` :465-493
- `lib/brain/chain-recommender.cjs` :553-633 (read for D-03 consumer 2, not modified)
- `lib/core/refusal-messaging.cjs` :260, :307, :370-373
- `lib/core/brain-response-sanitize.cjs` :61 and `hooks/hooks.json` :239, :341 (NOT modified; parity test `tests/test-brain-response-sanitize.cjs:285-315`)
- `scripts/part8-egress-guard-hook.cjs` :142-154 (why D-10 matters)
- `tests/test-254-normalize-roundtrip-probe.cjs` :258-303 (Arms 4 and 5)
- `tests/test-247-contract-client.cjs` (stays green untouched, envelope-insensitive)
- `tests/test-250-refusal-shapes.cjs`
- `lib/core/doctor/class-m-brain-smoke.cjs` :76
- `scripts/probe-brain-contract.cjs`, `scripts/build-brain-census.cjs`, `scripts/sessionstart-post-update-preflight.cjs`
- `scripts/release.sh`, `scripts/verify-release`, `.claude/includes/release-process.md` :23-26
- `$HOME/.claude/gsd-core/references/checkpoints.md` - the `checkpoint:human-action` contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getBrainUrl()` (`brain-client.cjs:1163`): the single origin resolver; the sweep points every runtime site at it and the alias table selects by it.
- The `brain_query` dual-shape branch (`brain-client.cjs:927-945`): the exact pattern for D-03 (guard on shape, both shapes in one block, loud safety net).
- `lib/core/refusal-messaging.cjs`: one chokepoint for every surface's refusal copy; the update path lands once.
- `269-05-PLAN.md` Task 1: the repo's own blocking human-action gate, including checklist-with-verbatim-quote and resume-signal phrasing.
- `tests/test-254-normalize-roundtrip-probe.cjs` Arms 4-5: already name the alias target; extend, do not rewrite.
- `scripts/release.sh` five-gate lockstep; `scripts/verify-release`; the two-command upgrade path text in `release-process.md`.

### Established Patterns
- Honest refusal (Key Decision 8): a Brain failure surfaces in-turn, never concealed; the copy must not promise a retry that cannot succeed.
- Canon Part 8: only generic handles cross the wire; the alias table carries problem-type names, never room content.
- CIRS: connector declarations on every tool must survive description edits in `bin/mindrian-brain-mcp-client.cjs`.
- Tri-Polar: CLI goes through the bundled `mindrian-brain` stdio shim (zero change); Desktop and Cowork direct connectors are docs-only changes under the same key (D-09).
- `.planning/` is gitignored; planning artifacts are force-added by path.

### Integration Points
- `.mcp.json` `mindrian-brain` -> `bin/mindrian-brain-mcp-client.cjs` -> `brain-client.cjs` `callTool` -> `${BRAIN_URL}/mcp`: the only wire, so one line moves every surface.
- `_tryAutoRegister` -> `${BRAIN_URL}/register`: Theo's compat route keeps shipped clients working; a suspended incumbent yields `no_key` on stale installs (D-08).
- Doctor class M brain smoke: reports the resolved origin; must read `getBrainUrl()` not its own literal.

</code_context>

<specifics>
## Specific Ideas

- The line, verbatim after the flip: `const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://theo-mcp.onrender.com';` BARE origin. A `/mcp` suffix produces `/mcp/mcp` and a trailing slash a double slash; both 404 and the client renders a 404 as "Brain unreachable", so this typo class fails in the most expensive direction.
- Live on 2026-09-03: `GET https://theo-mcp.onrender.com/health` returns `{"status":"ok"}`.
- The coverage-ruling heading contract (D-06) is the ONE thing Session T must be told verbatim; put it in the T kickoff and in `docs/339-NOTE-theo-desktop-connector-key.md` alongside the connector-key ask (D-10).
- Two failure modes Larry inherits from Theo that the cutover note and CHANGELOG should name, not hide: `brain_write` always refuses (`WRITE_PATH_DISABLED`; canon writes go through Theo's governed payload path), and `PLAN_REJECTED` on count-store query plans (add a property filter, do not conclude the tool is broken). Neither is this phase's code to change.
- **Pre-flip reference reading (Session T, Theo commit `90219b4`, remote origin over HTTPS, keyless, SSE-framed, taken 2026-09-03 19:16Z; script `parity/20260903-coverage/preflip.py`, data `preflip-reference.json`, filed in `09-12-CLOSEOUT-STAGING.md` section E). FLIP-12 compares the installed-session reading against this line for line:
  - `brain_stats`: envelope is `result.content[0]` text-JSON plus `result.structuredContent` with the same object; payload keys EXACTLY `{diagnostics, labels, nodes, relationships}`; `nodes` 1253, `relationships` 1522, `Framework` 420, 14 labels. NO `backend`, NO `totalRecordCount`: an installed session that sees either key is still on the incumbent. First execution on the process 1.762 s (8.8% of the 20 s budget); `/health` 0.326 s. This is also the shape D-12b's doctor layer 6 must read (`nodes`, not `totalRecordCount`).
  - `brain_ask {question: "problem type ladder"}`: payload keys EXACTLY `{answer_mode, diagnostics, effective_top_k, query_terms, rows, search_mode}`, 8 rows of `{chapterId, score, section, snippet}`, 0.737 s. There is NO coverage block on the free-form ask by Theo's contract; coverage rides the curated ops (`brain_ask {op: "list_frameworks"}`) and the 7 contract tools. FLIP-12 must NOT assert coverage on the free-form path; the enrichment-capture check (D-03 consumer 3) uses a curated op or a contract tool instead.
  - `tools/list` serves 30 tools (09-11 counted 29; `framework_step` from Theo Phase 11 is the 30th). Served build stamp `83a1ce2`, warm process (up since 12:31Z, paid tier).
  - Theo's flip record section 2 was amended for the two-cut shape and the no-op memo flush at Theo `543b7ac`; T's quick-task docs at `c4ae9ad`.
- Populations after suspend: (1) un-updated installs print pre-flip refusal copy; only soak length and the tester note reach them. (2) direct connectors are moved by a one-line URL edit under the same `mindrian-brain` key.

</specifics>

<deferred>
## Deferred Ideas

- `lib/brain/chain-recommender.cjs` Theo-shape adaptation (`result.refusal`, `result.note`, `step.commands` divergence logging): named follow-up after the flip, it already discloses (D-03 consumer 2).
- `data/brain-surface-contract.json` `error_semantics` and `indexes` describe the incumbent; a v2 or annotation is a separate plugin decision (Theo 09-MOS-LEARNING list).
- Plugin paths that call `brain_write` / `ingest_framework` (`lib/core/methodology-ingest.cjs`, `/mos:admin`) meet Theo's `WRITE_PATH_DISABLED`; review and re-route is its own phase.
- Widening Theo's read allow-list for count-store plans: Theo's navigator decision, not this repo's.
- Phase 269-05's entitlement-gate engineering: stays behind its own (rewritten) gate.
- Theo README connector-key alignment: asked via D-10 note; Session T executes.
- Phase 267 (SDK v2 migration): still blocked upstream; do not fold.

### Reviewed Todos (not folded)
- Registry-drift gate keyed to F-shape (2026-07-03): unrelated to the flip.
- F7 rescope Phases 212/213 against registerCapability (2026-07-08): unrelated.
- Never git stash mid-merge-conflict (2026-07-12): operational rule, already honored.
- Ingest skill-description insight into Brain (2026-07-17): a Brain WRITE; post-flip it meets `WRITE_PATH_DISABLED`, so it belongs with the `brain_write` review above.
- Deck generation ignores explicit slide count (2026-07-29): unrelated.

</deferred>

---

*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Context gathered: 2026-09-03*
