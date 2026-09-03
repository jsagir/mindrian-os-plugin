# Phase 276: MCP Tool Honesty - Triage and Close - Research

**Researched:** 2026-09-03
**Domain:** Static analysis of MCP tool description-vs-behavior honesty; Tri-Polar surface parity
**Confidence:** HIGH (every finding below is measured against this checkout, not recalled)

---

## Summary

The phase goal asks the planner to triage 9 findings from `scripts/check-tool-honesty.cjs`. Three things about that framing need correcting before planning starts, all verified by running the checker against the current tree.

**First, the count.** The live sweep returns **10** non-OK rows, not 9: 1 HIGH RISK, 8 MEDIUM, 0 LOW, 1 UNKNOWN, 120 OK, over 36 tools / 130 branches. The tool and branch totals have NOT drifted since quick 260903-ljj; the "9" in the ROADMAP goal is an arithmetic slip (1 + 8 + 1 = 10), not evidence of movement. [VERIFIED: `node scripts/check-tool-honesty.cjs --report`, run 2026-09-03 against HEAD `2ba658be`]

**Second, and this is the load-bearing finding of this research: the detector's `switch (command)` branch splitter is dead code.** It has never split a single branch. `splitBranches` runs its `case` label regex over the MASKED text, where string literals have been blanked to spaces, so `\bcase\s+` greedily swallows the entire case value and the subsequent quote check rejects every label. Measured: `room_state` (5 commands), `room_content` (15), `room_graph` (13) all use `switch (command)` and all yield **zero** recognized branches, so every one of their 33 branches is classified against the tool's WHOLE handler body. Any write anywhere in the tool makes every command in it read OK. Repairing this with a one-line change moves the sweep from **10 findings to 24** (5 HIGH RISK, 18 MEDIUM, 1 UNKNOWN) and surfaces **4 genuinely new HIGH RISK findings in `room_content`, all hand-verified as real defects, not detector noise**. [VERIFIED: instrumented and patched copy at `/tmp/.../scratchpad/fix2.cjs`, measured both before and after]

**Third, the one existing HIGH RISK is a description defect, not a missing write, and it is the third confirmed instance of one repeating disease.** `orchestration.scout` claims "The room and scout operations are ordinary reads and writes" while `scout` falls through to the generic reference echo at `lib/mcp/tool-router.cjs:1623-1655`. But the CLI `/mos:scout` genuinely writes (snapshots, competitor reports, HSI recomputation). So the description is true of the CLI command and false of the MCP tool. That is exactly the shape of the `rooms-open-false-success` RCA (2026-07-27) and the `meeting-file-meeting-false-success` RCA (2026-09-03). Three instances of one pattern: **an MCP mega-tool description written from the CLI command's behavior, wired over an MCP reference echo.** The 4 new `room_content` findings are the fourth, fifth, sixth and seventh.

**Primary recommendation:** Sequence the phase as (1) fix the detector's dead switch parser FIRST, because triaging the 10 visible findings while 33 branches are unclassifiable would close a list that is not the real list; (2) re-run and triage the resulting 24; (3) apply the proven `noWriteBanner` + honest-description fix pattern from quick 260903-kwl to every confirmed reference-echo-described-as-write; (4) hand the meeting Tri-Polar parity gap to its own phase with a stated reason, because the honest, cheap half of it already shipped and the remaining half needs a new MCP write primitive plus a gate wiring, which is a feature phase not a triage phase.

---

## User Constraints

**No `276-CONTEXT.md` exists.** `/gsd-discuss-phase` was skipped (`.planning/config.json` sets `workflow.skip_discuss: true`). The ROADMAP Phase 276 goal text stands in as the spec and is treated as authoritative and locked.

### Locked Decisions (from `.planning/ROADMAP.md` Phase 276 goal, verbatim intent)

- Triage and close every finding from `scripts/check-tool-honesty.cjs`'s live sweep.
- For each finding, choose exactly one of three dispositions: **fix the real bug**, **fix the detector** (if a false positive), or **correct the description** (if a genuine scaffolding-tool-by-design case).
- **Never suppress a finding via `ALLOWED_UNVERIFIED` without root-causing why.** This is an explicit prohibition, not a preference.
- Resolve or explicitly re-home the still-open defect in `.planning/debug/meeting-file-meeting-false-success.md` (status `partial-close`): either scope and plan the Tri-Polar fix in this phase, or hand it to its own phase **with a stated reason**.
- Decide whether to extend the checker for the `extract_shallow`-class limitation (an argument-gated write invisible to static analysis) or accept it as a documented detector boundary.
- Theo's own ~27 tools are named as an **out-of-repo recommendation only**, not built in this phase.
- Critical priority, timed against Theo's approaching production deployment.

### Claude's Discretion

- The order of work within the phase.
- Whether to harden the gate from advisory to `--strict` (the ljj SUMMARY names this as available "only after the list is empty").
- The exact wording of every corrected tool description, subject to the test constraints in Project Constraints below.
- Whether to mint requirement IDs (this research proposes `TOOLHON-01..08`).

### Deferred Ideas (OUT OF SCOPE)

- Building the Theo-side audit (out-of-repo, named as a recommendation).
- Implementing `rooms-new` / `rooms-close` / `rooms-archive` (tracked separately at `.planning/debug/intern-w1-rooms-new-silent-fail.md`).
- The DIKW-rungs-vs-`ALLOWED_EPISTEMIC_TYPES` vocabulary bridge (named in CLAUDE.md as an unruled trap).

---

## Project Constraints (from CLAUDE.md)

These are binding and the planner must verify compliance for every task.

| # | Constraint | How it binds Phase 276 |
|---|-----------|------------------------|
| C-1 | **GSD workflow only.** No direct repo edits outside a GSD command. | Every fix lands through `/gsd-execute-phase`. |
| C-2 | **Canon Part 8 (Graph Boundary).** Room content never reaches Brain calls. | The checker is `node:fs` + `node:path` only, zero network (`check-tool-honesty.cjs:36-41`). Any detector extension must preserve that. No description fix may add a Brain call. |
| C-3 | **Canon Part 11 (CIRS / `hitl_shape`).** Every invocable surface declares a HITL shape. | **Measured gap:** only `room_bind` from `tool-router.cjs` has a connector descriptor (`tool-router.cjs:1926-1934`). The 9 mega-tools (`room_state`, `room_content`, `room_graph`, `methodology`, `analysis`, `intelligence`, `meeting`, `export`, `orchestration`) plus `eureka_critic` have NO connector entry and NO `hitl_shape`. `data/mcp-tool-connectors.json` holds 26 surfaces, none of them a mega-tool. Whether R16 covers MCP tools is OQ-3, still open (`dual-path.cjs:12-17`). Changing a mega-tool's description does NOT require registry regeneration today; ADDING a connector descriptor does. |
| C-4 | **Canon Part 9 (Memory Locality).** SQL is the local mind; only a human confirms a truth-claim node. | Binds any decision to wire `writeClaimNode` to MCP. `references/meeting/filing-protocol.md` already states the rule: "Nothing files without the navigator confirming." |
| C-5 | **Canon Part 7 (Reuse before build).** | The `noWriteBanner()` helper (`tool-router.cjs:384-394`) and the `UNIMPLEMENTED_MUTATING_ORCHESTRATION` NOT-EXECUTED banner (`tool-router.cjs:317-319`, `:1635-1638`) are the two existing, shipped honesty primitives. Do not invent a third. |
| C-6 | **No em-dashes anywhere.** Hyphens only. | Enforced by `tests/run-all-266.sh:176-208` `EMDASH_TARGETS` and by the checker's own HYGIENE assertion. |
| C-7 | **Dev-Research Compositing.** Every phase touching MindrianOS's own architecture files research in BOTH `.planning/` and `~/MindrianRooms/rethinking-mindrianos/research/`, cross-linked. | An entry already exists: `~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-mcp-tool-honesty-sweep-ljj/`. Phase 276's own trail must be filed there too and cross-linked back. |
| C-8 | **Mandatory grounding consults.** icm-architect (room/ICM/local-graph), langtalks-graph-expert (agent/LLM concepts), Theo (Brain/framework-adjacent), Context7 (library API claims). | See "Grounding Consults" below for what was and was not reachable from this research context. |
| C-9 | **Release lockstep.** Five-place version sync via `scripts/release.sh`. Never bump by hand. | Current version `2.0.0-beta.16`, CHANGELOG `[Unreleased]` section already open and already carries the ljj entry. Phase 276 adds to that section. |
| C-10 | **RCA standard.** Findings go to `.planning/debug/<slug>.md`; on resolve, move to `resolved/` and add a `knowledge-base.md` block. | `.planning/debug/meeting-file-meeting-false-success.md` explicitly forbids moving it to `resolved/` until the Tri-Polar half closes. |

### Project Skills

`.claude/skills/docu-optimizer/SKILL.md` is the only project skill. **Assessment: not relevant.** It optimizes `CLAUDE.md` and the `docs/` ecosystem per Boris Cherny / Thariq Shihipar practice. Phase 276's description edits are MCP tool registration strings governed by `tests/test-234-tool-description-floor.cjs`, a different contract entirely. Do not route description rewrites through docu-optimizer. [VERIFIED: read `.claude/skills/docu-optimizer/SKILL.md` frontmatter via CLAUDE.md's Project Skills table]

---

## Phase Requirements

No Phase 276 rows exist in `.planning/REQUIREMENTS.md`. Per the documented precedent (CHOKE-01..06 Phase 273, PYPORT-01..07 Phase 272, ANCHOR-01..10 Phase 274, HOOK-01..12 Phase 267.2), phase-local working IDs are minted in the phase's own RESEARCH/plan set and registered to REQUIREMENTS.md at phase close by the final plan. This research proposes the `TOOLHON-` family.

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOLHON-01 | The `switch (command)` branch splitter in `check-tool-honesty.cjs` actually splits branches; `room_state` / `room_content` / `room_graph` report per-command reachability, not whole-handler reachability, proven by a test that fails on the pre-fix code. | Detector Bug D-1 below, measured before and after. |
| TOOLHON-02 | Every finding in the post-fix sweep carries a recorded disposition (real-bug-fixed / detector-fixed / description-corrected / triaged-allowlist-with-reason). No finding is closed by silence. | Findings Dossier below. |
| TOOLHON-03 | `orchestration.scout`'s description no longer asserts a write the MCP handler cannot perform, and the `scout*` family self-discloses its reference-only nature in-band. | Finding F-1. |
| TOOLHON-04 | `room_content`'s description no longer names `new-project`, `setup`, `update` or `invoke-persona` as part of "the WRITE surface" while their branches echo a reference file. | Findings F-11..F-14. |
| TOOLHON-05 | The detector's own known boundaries (argument-gated writes, barrel re-exports, subprocess writes, non-`switch`/non-`if` dispatch shapes, write-primitive semantics) are enumerated in the script header AND covered by an assertion or an explicit documented-boundary note. Nothing is silently unknown. | Detector Boundaries B-1..B-5. |
| TOOLHON-06 | `ALLOWED_UNVERIFIED`'s entry contract is enforced, not merely commented: an entry without a stated reason fails a test, and the suppression path covers (or explicitly declines to cover) MEDIUM and UNKNOWN. | ALLOWED_UNVERIFIED Mechanism below. |
| TOOLHON-07 | The `meeting` Tri-Polar parity gap has an explicit, recorded disposition: either scoped into this phase or registered as its own numbered phase with a stated reason, and `.planning/debug/meeting-file-meeting-false-success.md` reflects that disposition. | Tri-Polar Assessment below. |
| TOOLHON-08 | The ROADMAP's stale `Depends on: Phase 275` line for Phase 276 is corrected, and the ROADMAP's "9 findings" count is reconciled with the measured 10. | Dependency Refutation below. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Description-vs-behavior static scan | Build/CI tooling (`scripts/`) | none | `check-tool-honesty.cjs` is a read-only analyzer; it must never become a runtime dependency of the modules it inspects (its own header, `:36-41`). |
| MCP tool description strings | MCP server registration (`lib/mcp/tool-router.cjs`, `lib/mcp/tools/*.cjs`) | none | Descriptions are the ONLY per-tool guidance channel a foreign host honors (`test-234` header). |
| In-band no-write disclosure | MCP handler response construction | none | `noWriteBanner()` at `tool-router.cjs:392`; a marker in the response body is the only signal a model reading a tool result can act on. |
| Actual room writes | `lib/core/navigation.cjs` chokepoint (Part 9) | `lib/core/node-insert.cjs` (node writes) | Never from the MCP layer directly; `tool-router.cjs` is NOT on the substrate allow-list (`:594-596`). |
| Human confirmation of a truth claim | `lib/mcp/gate-render.cjs` + `lib/mcp/gate-ledger.cjs` via `gate_render` / `gate_answer` | none | The one governed Decision-Gate mechanism (RCA Consult section, icm-architect Invariant 6). |
| Gate hardening posture | `scripts/hooks/pre-commit-*`, `scripts/doctor.cjs`, `scripts/release.sh` | none | All three currently ADVISORY by deliberate design. |

---

## The Live Sweep: Current Findings (measured, not recalled)

Run 2026-09-03 against HEAD `2ba658be`:

```
check-tool-honesty --report: 36 tool(s), 130 branch(es) scanned
HIGH 1  MEDIUM 8  LOW 0  UNKNOWN 1  OK 120   (total non-OK = 10)
```

**No drift from quick 260903-ljj.** The 36/130 totals and the 1/8/1 bucket split are byte-identical to the original sweep. Phases 269-274 landed before the checker was built, not after, so nothing has moved. [VERIFIED: `node scripts/check-tool-honesty.cjs --report`; cross-checked against `.planning/quick/260903-ljj-build-a-permanent-automated-mcp-tool-hon/260903-ljj-SUMMARY.md:43`]

### The 10 findings, enumerated

| # | Verdict | Tool.command | File | Detector reason (abbreviated) |
|---|---------|--------------|------|-------------------------------|
| F-1 | HIGH_RISK | `orchestration.scout` | `lib/mcp/tool-router.cjs` | claims "The room and scout operations are ordinary reads and writes, so use them freely" but no write primitive is reachable |
| F-2 | MEDIUM | `export.export` | `lib/mcp/tool-router.cjs` | weak claim from the "Choose by audience..." sentence, no reachable write |
| F-3 | MEDIUM | `export.radar` | same | same shared sentence |
| F-4 | MEDIUM | `export.dashboard` | same | same shared sentence |
| F-5 | MEDIUM | `export.wiki` | same | same shared sentence |
| F-6 | MEDIUM | `export.present` | same | same shared sentence |
| F-7 | MEDIUM | `export.publish` | same | same shared sentence |
| F-8 | MEDIUM | `export.snapshot` | same | same shared sentence |
| F-9 | MEDIUM | `gate_render.(default)` | `lib/mcp/tools/gate.cjs` | weak tool-scoped claim "Render the Mindrian gate superset card..." with no reachable write |
| F-10 | UNKNOWN | `context_assemble.(default)` | `lib/mcp/tools/context.cjs` | tool-scoped claim "Never returns raw file contents." but reachability could not be resolved |

### The 14 additional findings the detector cannot currently see

After the one-line D-1 fix (below), measured on a patched copy:

```
HIGH 5  MEDIUM 18  LOW 0  UNKNOWN 1  OK 106   (total non-OK = 24)
```

| # | Verdict | Tool.command | Detector reason |
|---|---------|--------------|-----------------|
| F-11 | HIGH_RISK | `room_content.new-project` | claims "This is the WRITE surface (new-project, setup, file-opportunity, create-funding, invoke-persona)" but no write primitive reachable |
| F-12 | HIGH_RISK | `room_content.setup` | same claim |
| F-13 | HIGH_RISK | `room_content.update` | claims "Create and update the entities that live inside a room..." |
| F-14 | HIGH_RISK | `room_content.invoke-persona` | same "WRITE surface" claim |
| F-15..F-24 | MEDIUM (10) | `room_graph.graph-index`, `.graph-rebuild`, `.graph-query`, `.graph-stats`, `.reasoning-get`, `.reasoning-verify`, `.reasoning-list`, `.visualize-room`, `.visualize-graph`, `.visualize-chain` | weak claim "Operate on the room's own knowledge graph: build and repair it..." with no reachable write in that branch |

Also note the reclassification signal: `room_content.help` moves from `OK: a write primitive is reachable` to `OK: no persistence claim found for this command`. Same verdict, completely different reason. That proves the pre-fix reason string was an artifact of whole-handler classification, not a real reachability result.

---

## Findings Dossier: file:line evidence and recommended disposition

### F-1: `orchestration.scout` (HIGH RISK) - REAL, description defect

**The claim.** `lib/mcp/tool-router.cjs:1491`:
> "Manage rooms (rooms-list, ...), run scout intelligence (scout, scout-health, ...), and handle admin, onboarding, models and scheduled tasks. **The room and scout operations are ordinary reads and writes, so use them freely.** Treat act, act-chain and act-swarm differently..."

**The behavior.** `scout` has no branch. It falls through to the generic reference-echo fallback at `lib/mcp/tool-router.cjs:1623-1655`: `loadReference(pluginRoot, command)` plus `loadRoomState(roomDir)` plus an echo of `context` and `room`, then a `Suggested Next` footer that reads **"Scout intelligence gathered - analyze room"** (`:1650-1651`). Nothing is gathered and nothing is written. **CONFIRMED, the ROADMAP's characterization is accurate.**

**Why the checker attributes it to `scout` only.** `sentenceNamesCommand` (`check-tool-honesty.cjs:939-948`) matches a command name with `(?<![\w-])NAME(?![\w-])`. Only the bare token `scout` appears in the claim sentence; `scout-health` etc. are hyphenated and appear only in the earlier, verb-free "Manage rooms..." sentence. So exactly one branch trips. Correct behavior, not over-firing.

**Why it is a real defect and not a scaffolding-by-design case.** `commands/scout.md` genuinely writes: Step 1 writes a state snapshot to `.snapshots/`, Step 4c writes `room/.intelligence/competitors-YYYY-MM-DD.md` (`commands/scout.md:206-234`), Step 5 runs the HSI pipeline. The description describes the CLI command's behavior. The MCP tool cannot do any of it. Same Tri-Polar shape as `meeting.file-meeting`.

**The codebase's own stated position on this class.** `tool-router.cjs:314-316`:
> "Read-only fallback commands (rooms-list, rooms-where, scout*, models, ...) are deliberately absent [from `UNIMPLEMENTED_MUTATING_ORCHESTRATION`]: returning documentation instead of data is a capability gap, not a false claim about a state change."

That reasoning holds for `rooms-list` (whose description makes no write claim). It does NOT hold for `scout`, because the shared description DOES make the write claim. The membership rule at `:312-313` ("a command belongs here if it MUTATES persistent state AND has no executing branch") is the wrong test for this case; the right test is "does the description claim it."

**Recommended disposition:** description correction (remove the false write assertion; state plainly that room and scout operations on this surface return instructions and room context, and name `/mos:scout` as the executing path), plus consider extending the in-band disclosure to the `scout*` family. Do NOT use `ALLOWED_UNVERIFIED`.

### F-2..F-8: the seven `export` MEDIUMs - REAL underlying issue, plus a detector false-attribution

**The claim sentence.** `tool-router.cjs:1456`, sentence 2:
> "Choose by audience: dashboard for a single-screen status view, wiki for a browsable cross-linked reference, present for a slide deck, radar for a scored-dimension chart, snapshot for a frozen point-in-time copy, **publish** to push an artifact outward, and export for a plain data dump."

**Why the detector fires.** `publish` and `snapshot` are both in `WEAK_VERBS` (`check-tool-honesty.cjs:860-863`). Here they are COMMAND NAMES in an enumeration, not prose verbs. This is the identical disease class as the already-fixed `isPartOfHyphenatedToken` bug (`:904-908`), which caught `rooms-archive` but not a bare, unhyphenated command name sitting in its own tool's parenthetical command list. **This is a detector false attribution and should be fixed at the detector, per the phase's own "never suppress without root-causing" rule.**

**But the underlying honesty issue is real and separate.** Sentence 1 is "Render what is already filed in a room into a shareable artifact." (`filed` is a STRONG verb; it becomes the tool-scoped claim). The handler at `:1465-1483` is a pure reference echo: `loadReference` plus `loadRoomState` plus echoes of `context` and `format`, then `Suggested Next` rationales that read **"Snapshot generated"**, **"Dashboard generated"**, **"Export complete"** (`:1476-1480`). Nothing is generated and nothing is exported. Same disease as F-1.

**Recommended disposition:** two-part. (a) Fix the detector so a command-name token appearing in its own tool's command enumeration does not register as a prose verb. (b) Independently correct the `export` description and the three false `Suggested Next` completion assertions, because the tool tells a caller a dashboard was generated when it returned an instruction sheet.

### F-9: `gate_render` (MEDIUM) - detector working as designed, benign, one near-miss worth flagging

**The claim.** `lib/mcp/tools/gate.cjs:113`: "Render the Mindrian gate superset card ... Returns a **minted** gate_id that gate_answer must reference to ratify."

**Reachability is correctly NO_WRITE.** `gate_render` calls `_mintLiveGate` (`gate.cjs:64-70`), which delegates to `gateLedger.mintGate` - an in-memory, TTL-bounded, single-use ledger (`gate.cjs:45-63`). No persistent write. `render` is a WEAK verb and rendering is intrinsically non-persisting, so MEDIUM is the honest verdict.

**The near-miss the planner should know about.** `STRONG_VERBS` (`:855-859`) contains `mint` and `mints` but NOT `minted`. The description uses the past participle. Add `minted` to the vocabulary and `gate_render` flips to HIGH RISK. That would then force a genuine question the phase should answer deliberately rather than accidentally: **is a process-lifetime in-memory ledger entry a "write" for honesty purposes?** Recommendation: no (it is not persistent state a user can lose), but say so once, in the script, rather than leaving it to a missing inflection.

**Recommended disposition:** documented no-action, with the `minted` inflection question answered explicitly in the script's verb-vocabulary comment.

### F-10: `context_assemble` (UNKNOWN) - two independent detector bugs stacked

**Bug A: a STRONG verb matched as a noun.** The description (`lib/mcp/tools/context.cjs:36`) ends "Never returns raw **file** contents." `file` is in `STRONG_VERBS` (`:855`). `isLocallyNegated` (`:888-892`) requires the negator to sit immediately adjacent to the verb; "Never returns raw " ends with "raw ", so the guard misses. The sentence is a NEGATIVE capability statement being read as a positive persistence claim, which is the worst possible inversion.

**Bug B: the depth-1 hop cannot follow a barrel re-export.** The handler calls `navigation.getRoomContext(db, ...)` (`context.cjs:61`). `lib/core/navigation.cjs:562` is `getRoomContext: roomContext.getRoomContext,` - an assignment from another module, not a local function definition. `locateFunctionBody` (`check-tool-honesty.cjs:702-760`) searches for a definition site in `navigation.cjs` and finds none, so `unresolved = true` and the branch reports UNKNOWN (`:811, :849`).

**Why Bug B matters far beyond this one finding.** `navigation.cjs` is the mandated Part 9 chokepoint. Every honest write on this surface goes through it, and it is a facade of re-export assignments. Any tool whose only write is a `navigation.<reexport>()` call is at risk of reporting UNKNOWN rather than WRITES. Most tools escape today only because they also call something else the scanner can resolve. That is luck, not coverage.

**Recommended disposition:** fix both. Bug A by widening the local-negation window or by demoting `file` when it is followed by a noun like `contents`/`path`/`name`. Bug B by teaching `locateFunctionBody` to follow a one-level re-export assignment (`NAME: mod.NAME`) to the module it names. Both are tractable; Bug B is the higher-value fix.

### F-11..F-14: `room_content` (4 x HIGH RISK, invisible today) - REAL, hand-verified

These only appear after the D-1 detector fix. Each was hand-verified against source.

**The claim.** `tool-router.cjs:738`:
> "Create and update the entities that live inside a room: projects, opportunities, funding stages, personas, and detected integrations. **This is the WRITE surface (new-project, setup, file-opportunity, create-funding, invoke-persona)**; ... Use room_state instead when you only need to READ the room ... **room_state never mutates anything, this tool usually does.**"

**F-11/F-12/F-13 (`new-project`, `setup`, `update`).** `tool-router.cjs:756-773` is a four-label fall-through group (`new-project` / `setup` / `update` / `help`) whose entire body is:
```
const ref = loadReference(pluginRoot, command);
const state = loadRoomState(roomDir);
... build parts ...
if (WRITE_TOOLS.has(command)) { await fireCascade(roomDir, command, section); }
return textResponse(response + defaultNext);
```
A reference echo. `fireCascade` (`:580-588`) calls `runCascade` on the intelligence cascade, which is downstream bookkeeping, not the project/section creation the description promises. **The tool that calls itself "the WRITE surface" hands back `commands/new-project.md` as text.** This is the exact `rooms-open-false-success` shape the codebase already fixed for `orchestration` with a NOT-EXECUTED banner, never applied here because the detector could not see it.

**F-14 (`invoke-persona`).** `tool-router.cjs:875-889` calls `personaOps.invokePersona(roomDir, hat, artifact)`. `lib/core/persona-ops.cjs:550-571` reads a persona file and returns it or an error object. **Read-only.** The description names `invoke-persona` explicitly as part of "the WRITE surface." Real defect.

**The honest counterpoint the triage must record.** Four `room_content` commands DO write and correctly read OK post-fix: `file-opportunity`, `create-funding`, `update-funding-stage`, `generate-personas`. So the description is half true, which is why it survived review. The fix is to make the WRITE-surface list match the four that actually write.

**Recommended disposition:** real bug. Correct the description's WRITE-surface enumeration, and apply the `UNIMPLEMENTED_MUTATING_ORCHESTRATION`-style NOT-EXECUTED banner to the `new-project` / `setup` / `update` group.

### F-15..F-24: `room_graph` (10 x MEDIUM, invisible today)

The description (`tool-router.cjs:914`) says "build and repair it (graph-index, graph-rebuild), interrogate it (graph-query, graph-stats), work the Minto reasoning layer over it (...), and render it (...)". Post-fix, `graph-index`, `graph-rebuild`, `reasoning-generate`, `reasoning-run` and `reasoning-frontmatter` correctly resolve WRITES; the ten read/render commands correctly resolve NO_WRITE and pick up the tool-scoped WEAK claim. **This is the detector doing its job on a mixed-mode tool, and it is exactly the case the `LOW` verdict exists for** (`classifyBranch:1027-1035`: a tool-scoped STRONG claim where a sibling writes becomes LOW). The claim here is WEAK, so it lands MEDIUM instead. Worth deciding once whether a WEAK tool-scoped claim on a mixed-mode tool should also get the sibling-writes discount.

**Recommended disposition:** mostly detector tuning (extend the `anyBranchWrites` discount to the WEAK tier), plus a light description edit if any command is genuinely misdescribed.

---

## Detector Bug D-1: the dead `switch (command)` branch splitter (THE headline)

**Severity: this is the single highest-value item in the phase.**

### The bug

`splitBranches` (`check-tool-honesty.cjs:512-626`) locates case labels with:

```js
const labelRe = /\bcase\s+|\bdefault\s*:/g;          // :529
...
let idx = lm.index + lm[0].length;                    // :538
while (idx < masked.length && /\s/.test(masked[idx])) idx += 1;   // :539
const qc = handlerBodyText[idx];                      // :540
if (qc !== "'" && qc !== '"' && qc !== '`') continue; // :541
```

`labelRe` runs against `masked`, the output of `maskNonCode`, in which every string literal INCLUDING its delimiters is replaced by spaces (`:170-220`). So for `case 'graph-index': {`, the masked text reads `case               : {`. `\bcase\s+` is greedy, so `lm[0]` is `"case              "` (18 characters, not 5), `idx` lands directly on the `:`, `qc` is `':'`, and the label is `continue`d.

**Instrumented proof** (patched copy, `DBG=1`):
```
SLICE "case 'graph-index': {\n   " lm0 "case              "
QC ":" idx 52
SLICE "case 'graph-rebuild': {\n " lm0 "case                "
QC ":" idx 643
...
branches: []
```

Every `case` label in the repo is discarded. `branchMap` is always `{}` for a switch-dispatched tool.

### Measured branch-recognition coverage, current tree

| Tool | Vocabulary | Recognized branches | Dispatch shape | Status |
|------|-----------|--------------------|----------------|--------|
| `room_state` | 5 | **0** | `switch (command)` | D-1 |
| `room_content` | 15 | **0** | `switch (command)` | D-1 |
| `room_graph` | 13 | **0** | `switch (command)` | D-1 |
| `methodology` | 14 | 0 | no dispatch at all (single echo handler) | correct by design |
| `analysis` | 13 | 5 | `if (command === 'x')` | partial (B-4) |
| `intelligence` | 11 | 3 | `if (command === 'x')` + `ARRAY.includes(command)` | partial (B-4) |
| `meeting` | 3 | 3 | `if (command === 'x')` | full |
| `export` | 7 | 2 | `if (command === 'x')` | partial (B-4) |
| `orchestration` | 22 | 5 | `if (command === 'x')` + `command.startsWith()` | partial (B-4) |
| `room_bind` | 1 | 0 | single-purpose | correct by design |
| `eureka_critic` | 1 | 0 | single-purpose | correct by design |

**33 branches (room_state 5 + room_content 15 + room_graph 13) are classified against their tool's entire handler body.**

### The consequence

`scanAll` builds each branch's `effectiveText` as `ownText + '\n' + sharedBodyText` (`:1123`). When `branchMap` is empty, `ownText` is `''` and `sharedBodyText` is the whole handler. So a single write anywhere in a 15-command tool makes all 15 commands report `a write primitive is reachable`. This is a **false negative** in the same direction as the already-documented `extract_shallow` miss, at 33x the scale, and it is the structural reason the first sweep found only one HIGH RISK.

### The fix and its measured effect

One line. Anchor the scan at `lm.index + 4` (past the literal token `case`) and skip whitespace in the ORIGINAL text rather than the masked text:

```js
let idx = lm.index + 4;
while (idx < masked.length && /\s/.test(handlerBodyText[idx])) idx += 1;
```

Measured on a patched copy against the live tree:

| | Before | After |
|---|--------|-------|
| Tools / branches | 36 / 130 | 36 / 130 |
| HIGH_RISK | 1 | **5** |
| MEDIUM | 8 | **18** |
| LOW | 0 | 0 |
| UNKNOWN | 1 | 1 |
| OK | 120 | 106 |
| **Total non-OK** | **10** | **24** |

### A related honesty note the planner should record

The script's own header comment (`:559-565`) claims the fall-through grouping was "verified against real fall-through in this codebase (room_content's new-project/setup/update/help group)." That verification cannot have happened as described, because the switch path never produced a label. The comment is not malicious, but it is a false verification claim inside the honesty checker itself, and this phase is the right place to correct it. There is a pleasing symmetry here worth naming in the RCA trail: **the tool built to catch "claims it did X, did not do X" contains an instance of that exact defect.**

---

## Detector Boundaries (the honest coverage map)

| ID | Boundary | Direction | Evidence | Tractable? |
|----|----------|-----------|----------|-----------|
| B-1 | **Argument-gated writes.** A write inside `if (opts && opts.db)` counts as reachable even when no caller supplies `opts`. | FALSE NEGATIVE | `lib/mcp/tools/dual-path.cjs:52` calls `extractShallow(text, sessionId)` with 2 args; `lib/core/shallow-doc-parser.cjs:191` gates `navigation.setFocus` behind `if (opts && opts.db)`. The tool's OWN `hitl_why` (`dual-path.cjs:75`) already documents the mismatch. The checker reports `[OK] extract_shallow.(default): a write primitive is reachable`. | **Partially.** Full dataflow analysis is out of scope. But an ARITY check is cheap and would catch this exact shape: if the resolved function's write is inside a guard on formal parameter N and the call site supplies fewer than N arguments, downgrade WRITES to UNKNOWN. Recommend: implement the narrow arity heuristic, document the general dataflow limit as accepted. |
| B-2 | **Barrel re-exports.** `navigation.cjs` is a facade of `NAME: mod.NAME` assignments; `locateFunctionBody` finds no definition and returns UNKNOWN. | FALSE UNKNOWN | `lib/core/navigation.cjs:562`; produces F-10's UNKNOWN. Affects the mandated Part 9 chokepoint, so it is systemic. | **Yes.** One-level re-export following is a small, bounded addition. |
| B-3 | **Subprocess-mediated writes.** A write performed by a spawned script is invisible. | FALSE NEGATIVE (masked today by "no claim") | `orchestration.rooms-open` writes through a spawned `room-registry.cjs`; named as a Known Limitation in the ljj SUMMARY. `check-tool-honesty.cjs:355-361` covers only navigation exports, a fixed `fs` list and `.run(`/`.exec(`. | **Judgment call.** A blanket "any spawn counts as a write" rule creates the opposite failure. Recommend: accept as a documented boundary, or add a narrow allowlist of known-writing scripts. |
| B-4 | **Dispatch-shape coverage.** `splitBranches` recognizes exactly two idioms: top-level `switch (command)` (D-1: currently dead) and top-level `if (command === 'x')`. It does NOT recognize `command.startsWith(prefix)` or `ARRAY.includes(command)`, both used in this repo. | FALSE NEGATIVE | `tool-router.cjs:1648-1651` (`startsWith`); `intelligence`'s `EUREKA_COMPUTE_COMMANDS.includes(command)` at `:1246`. Table above shows 5 tools only partially split. | **Yes for `includes()`** (a small pattern addition). **`startsWith` is harder** because a prefix maps to many commands; recommend documenting it, and treating a prefix-dispatched tool as intentionally undifferentiated. |
| B-5 | **Write-primitive SEMANTICS.** "A write primitive is reachable" does not mean "the write the description promises happens." | FALSE NEGATIVE, conceptual | `analysis` classifies OK for all 13 commands because `pipelineState.recordStep` (`tool-router.cjs:1192`) writes a pipeline-state bookkeeping file, while the analysis output the description implies is never written. Same for `methodology`. | **Not fully.** This is the deepest limit of any text-level heuristic. Recommend: state it plainly in the header, and never present an OK verdict as a positive proof of honesty, only as an absence of a detectable mismatch. |

---

## `ALLOWED_UNVERIFIED` Mechanism (exact semantics)

The phase goal forbids suppression "without root-causing why," so the planner needs the mechanical facts.

**Declaration:** `scripts/check-tool-honesty.cjs:82`, `const ALLOWED_UNVERIFIED = [];` - ships EMPTY and is empty today. [VERIFIED]

**Entry shape:** inferred entirely from the consumption site (`:1161-1168`), because no schema, type, or validator exists:

```js
for (const row of rows) {
  if (row.verdict !== 'HIGH_RISK') continue;
  const allowed = ALLOWED_UNVERIFIED.find((a) => a.tool === row.tool && a.command === row.command);
  if (allowed) {
    row.verdict = 'OK';
    row.reason = 'allow-listed (triaged): ' + allowed.reason;
  }
}
```

A compliant entry therefore requires exactly three fields: `{ tool, command, reason }`. `reason` is interpolated into the output string.

**Five mechanical facts the planner must know:**

1. **It suppresses HIGH_RISK ONLY.** `:1162` skips every other verdict. **A MEDIUM or UNKNOWN finding cannot be allowlisted at all.** The 8 MEDIUM and 1 UNKNOWN in the current sweep have no suppression path, so their only dispositions are "fix the detector," "fix the code," or "document and leave visible."
2. **Suppression rewrites the row to OK.** It does not create a distinct `ALLOWLISTED` verdict, so a suppressed finding disappears from `--report` as a finding and appears as an OK row with a different reason string. There is no count of suppressions anywhere.
3. **Nothing enforces the contract.** No test asserts the array is empty, asserts an entry has a non-empty `reason`, asserts an entry names a tool/command that actually exists, or asserts entries are dated or attributed. `tests/test-ljj-tool-honesty.cjs`'s nine assertions do not touch it. The "never pre-populate" rule at `:76-81` is a comment only. [VERIFIED: grepped `ALLOWED_UNVERIFIED` across `tests/`, `scripts/`, `scripts/hooks/`]
4. **A stale entry never expires.** If a tool is later fixed, its allowlist entry silently keeps suppressing nothing, and if the tool regresses the entry silently re-suppresses it.
5. **The precedent it borrows from is stricter in practice.** `scripts/check-substrate.cjs:63-140` `ALLOWED_DIRECT_IMPORT` uses regexes with multi-line justification comments per entry and a documented membership rule. `check-tool-honesty.cjs` copied the discipline as prose but not as structure.

**Recommendation for TOOLHON-06:** add a test asserting every `ALLOWED_UNVERIFIED` entry has (a) a non-empty `reason` of at least N characters, (b) a `triaged` date field, and (c) a `tool`/`command` pair that resolves to a real row in the current scan (so a stale entry turns the suite red rather than rotting). Decide explicitly whether to extend suppression to MEDIUM/UNKNOWN or to state that those tiers are never suppressible by design.

---

## Tri-Polar Meeting Gap: buildable here, or its own phase?

### What already shipped (quick 260903-kwl, commits `3a35f4f6`, `2f1f4cf3`, `86c2e1e1` - all present in `git log`) [VERIFIED]

- `meeting`'s description rewritten to assert no capability the handler lacks (`tool-router.cjs:1381`).
- `noWriteBanner()` / `NO_WRITE_MARKER` (`**filed: false**`) leads all three branches (`:384-394`, `:1395`, `:1418`, `:1434`).
- Explicit missing-reference else arms instead of silent omission (`:1400-1402`, `:1423-1425`, `:1439-1441`).
- `references/meeting/filing-protocol.md` created (195 lines) as a faithful, surface-neutral extract, closing the dead-path half.
- `tests/test-kwl-meeting-mcp-honesty.cjs` (37 assertions, 5 scenarios) registered in `tests/run-all-266.sh:162`.

### What remains open, precisely

`references/meeting/filing-protocol.md:44-63` already enumerates the gap better than any restatement could. Three things an MCP caller cannot reach:

1. **The five-perspective subagent fan-out** (CLI Step 3a dispatches five `meeting-perspective-extractor` subagents). **Structurally unreachable from MCP.** No Agent tool, no subagent registry. Not fixable, only declarable.
2. **The F.8 filing gate** (CLI Step 4 renders through `renderShapeF8` / `consumeF8Fanout`, driven by `AskUserQuestion`). **This one IS reachable and is NOT wired.** `gate_render` (`lib/mcp/tools/gate.cjs:111`) has a three-rung ladder whose second rung is exactly a Claude Code `AskUserQuestion` thin adapter, and `gate_answer` (`:168`) is the governed ratification path with a real ledger and a real `confirmNode` promotion. The machinery exists; nothing connects meeting filing to it.
3. **A direct `writeClaimNode` call.** No MCP tool exposes it. The reachable write is `artifact_file`, which writes a `claim:artifact` reasoning node with an `epistemic_type` defaulting to `conclusion`, left at `proposed` (`lib/mcp/tools/views.cjs:202-236`). That is NOT a DIKW `claim` node with a 6-value `knowledge_type` (`lib/core/navigation/typed-claim.cjs:97-127`).

### Assessment: hand it to its own phase. Here is the stated reason.

**The cheap, honest half is already done.** The remaining work is a feature build, not a triage. Concretely it requires: (a) a new MCP write primitive exposing `writeClaimNode` with `knowledge_type` validation and the `agent_attribution_forbidden` guard; (b) wiring meeting filing through `gate_render`/`gate_answer` so a claim reaches `confirmed` only via the governed path (Part 9, icm-architect Invariant 6); (c) a decision on the three-way vocabulary collision CLAUDE.md already names as UNRULED - the DIKW rungs in `operator.cjs`'s `EPISTEMIC_LEVELS`, the 10-member `ALLOWED_EPISTEMIC_TYPES` at `node-insert.cjs:113`, and the 6-member `knowledge_type` enum. **(c) is a constitutional ruling, not an engineering task**, and it blocks (a) from being designed correctly.

Mixing that into a triage phase would do to Phase 276 exactly what the RCA warns against: producing a completion-shaped result over work that did not happen. The `.planning/debug/` file's own Current Focus already says "Do not move this file to `resolved/`... until that gap itself is closed by a future, separately-scoped GSD plan."

**Recommended smallest honest action inside Phase 276:** register the gap as a new numbered phase with the scope above, update the RCA's `next_action` to name that phase number, and leave the RCA at `partial-close`. Do not attempt the wiring here.

---

## Phase 275 Dependency: REFUTED, with evidence

The ROADMAP records `Phase 276 ... Depends on: Phase 275`. **There is no technical dependency.**

- Phase 275 (`ROADMAP.md:1116-1128`) is "Enlarge Room Schema by ICM Layer (Notion Gap-Close + icm-architect Audit Convergence)": per-section `STATEMENT`, per-section `CONTEXT.md` contracts, a per-room `references/`/`_shared/` folder, and section-set changes (`marketing-sales/` split, `funding/` promoted, `value-proposition/` top-level).
- Phase 275 is explicitly **gated** and not plannable ("Gated, not ready to plan yet", 0 plans).
- **Zero keyword overlap.** A case-insensitive grep for `icm layer`, `room schema`, and `layer` across `scripts/check-tool-honesty.cjs`, `lib/mcp/tools/dual-path.cjs` and `.planning/debug/meeting-file-meeting-false-success.md` returns **no matches**. [VERIFIED]
- The checker's scan set is `lib/mcp/tool-router.cjs`, `lib/mcp/tools/*.cjs`, `lib/mcp/contract-version.cjs` (`check-tool-honesty.cjs:1057-1074`). None of those files carries room-schema or section-metadata concerns.
- The `phase.add` heading bug that inserts a stale default `Depends on:` line is a documented, recurring GSD tooling defect named in three separate handoffs (`docs/2026-08-27-HANDOFF-goal-directed-phase-sweep-265-271.md`, and the 2026-09-03 handoff which states it was "caught and hand-corrected for Phase 276 itself").

**Conclusion: the planner may proceed without waiting on Phase 275.** TOOLHON-08 should correct the ROADMAP line and the "9 findings" count in the same edit.

---

## Prior Art: does the proven fix pattern generalize?

### The `meeting` honesty-fix pattern (quick 260903-kwl)

Four moves, all in `lib/mcp/tool-router.cjs`:
1. Rewrite the description to assert no capability the handler lacks, and NAME the surface that does have it ("For the fuller path... use `/mos:file-meeting` on the CLI", `:1381`).
2. Lead the response with a machine-checkable in-band marker (`noWriteBanner()` -> `**filed: false**`, `:392`).
3. Replace silent omission of a missing reference with an explicit not-found line (`:1400-1402`).
4. Point `Suggested Next` at the real write path instead of asserting completion (`:1410`).

### Does it generalize to the new findings?

| Finding class | Pattern applies cleanly? | Note |
|---------------|-------------------------|------|
| F-1 `orchestration.scout` | **Yes, all 4 moves.** | Move 4 is especially load-bearing: `:1651` currently asserts "Scout intelligence gathered". |
| F-2..F-8 `export` | **Yes, all 4 moves**, plus a detector fix. | Three false completion assertions at `:1476-1480`. |
| F-11..F-13 `room_content` new-project/setup/update | **Partly.** Moves 1 and 4 apply. For move 2, the codebase already has a SECOND, better-fitting primitive: the `UNIMPLEMENTED_MUTATING_ORCHESTRATION` NOT-EXECUTED banner (`:317-319`, `:1635-1638`), built by the `rooms-open-false-success` RCA for exactly "declared-but-unimplemented state mutation." **Reuse that one (Canon Part 7), do not add a third marker.** |
| F-14 `room_content.invoke-persona` | **Move 1 only.** The command genuinely performs a read operation and returns real data; only the description's WRITE-surface list is wrong. |
| F-9 `gate_render`, F-10 `context_assemble` | **No.** These are detector-side, not code-side. |
| F-15..F-24 `room_graph` | **Mostly no.** Detector tuning plus a light description edit. |

### The Phase 273 C1/C5 relationship

`ROADMAP.md:1012` (C1: `writeEdge` returns `ok:true` for a silently discarded write) and `:1016` (C5: a locked `room.db` misreported as `no_room_db`) are the **same false-success disease family at the substrate layer**, and the ROADMAP itself says so: both are named as "textbook instances" of the standing WATCH item `feedback_false_success_silent_skip_gates_academy_testers.md` (`:1024`).

**The useful transfer is the reviewer's thesis, quoted verbatim at `ROADMAP.md:1018`:** "What is missing is **propagation**: several of the good fixes here were applied at exactly one site and never carried to their siblings." That is precisely what happened here. The `rooms-open-false-success` RCA fixed the pattern for THREE orchestration commands and never carried it to `scout`, to `export`, or to `room_content`'s identical fall-through group. **Phase 276 is the propagation pass for the MCP-description layer, and the planner should frame it that way.** The fix shape differs (description strings and response markers, not `changes`-aware SQL), but the failure mode and the remedy discipline are identical.

---

## Out-of-Repo Recommendation: Theo

Per CLAUDE.md's standing Theo consult, and per the phase goal's explicit instruction to name this without building it.

**What Theo has.** `/home/jsagi/Theo/src/mcp/` holds ~30 content tools (`content/`: `brain-ask`, `brain-query`, `brain-write`, `recommend-chain`, `resolve-framework`, `text2cypher`, ...) plus 7 operational tools (`operational/`: `chain-run`, `gate-answer`, `gate-render`, `graph-write`, `delegate`, ...). Direct analogs to the tools in this phase's findings. [VERIFIED: directory listing]

**The one concrete portability fact the recommendation must carry.** Theo registers with `server.registerTool(name, config, cb)`, deliberately, and its own `register-graph-tool.ts:42-45` states that `server.tool(...)` is deprecated in its SDK version and calls it "a zero-gate." **`check-tool-honesty.cjs`'s `findServerToolCalls` (`:478-490`) matches `/server\.tool\s*\(/` and `scanAll` (`:1106-1113`) reads four POSITIONAL arguments.** Neither matches Theo's shape: `registerTool` takes a name plus a CONFIG OBJECT carrying `description` and `inputSchema`. A port therefore needs a second extractor (config-object key lookup) and TypeScript-aware masking, not a path change. Say this in the recommendation so the Theo side does not discover it by running the script and getting `0 tools scanned` - which would itself be a false-success result, in a phase about false success.

**Second Theo fact worth carrying:** Theo already solved an adjacent honesty problem the right way. Its `resolveFramework` (`src/mcp/content/normalize-framework-name.ts`) refuses honestly with `ALIAS_FORK` on an ambiguous match rather than guessing, where the current Brain's `NORMALIZE_NAME_CYPHER` silently returns two "canonical" matches (Phase 262). The disposition preference - refuse visibly over succeed ambiguously - is already Theo doctrine.

---

## Architecture Patterns

### System flow: how a finding is produced

```
lib/mcp/tool-router.cjs
lib/mcp/tools/*.cjs          [source text, never require()d by the scanner]
lib/mcp/contract-version.cjs
        |
        v
  maskNonCode()  ------------------------------> masked text (same length)
        |                                          strings/comments/regex -> spaces
        v
  findServerToolCalls()  --> splitTopLevelArgs() --> [name, description, schema, handler]
        |                                                |         |          |
        |                                                v         v          v
        |                                    extractClaims()  extractCommandVocabulary()
        |                                    (STRONG/WEAK,     (z.enum resolution)
        |                                     negation guards)          |
        v                                                |              v
  extractHandlerBody()  --> splitBranches() ---> branchMap + sharedBodyText
        |                        ^                       |
        |                   *** D-1 LIVES HERE ***       |
        |                   switch path yields {}        v
        |                                     effectiveText = own + shared
        |                                                |
        v                                                v
  resolveWritePrimitives()  ------------> resolveReachability()
   (navigation.cjs +                       depth 0 text match
    edges.cjs +                            depth 1 require() hop  [B-2 fails here]
    node-insert.cjs exports,               depth <=3 same-file chase
    + fixed fs list                                     |
    + .run( / .exec( )                                  v
                                              WRITES | NO_WRITE | UNKNOWN
                                                       |
                                                       v
                                              classifyBranch()
                                  banner check -> globalCancel -> WRITES
                                  -> per-command claim -> tool-scoped claim
                                                       |
                                                       v
                                    OK | LOW | MEDIUM | HIGH_RISK | UNKNOWN
                                                       |
                                                       v
                                          ALLOWED_UNVERIFIED  [HIGH_RISK only]
                                                       |
                              +------------------------+------------------------+
                              v                        v                        v
                    pre-commit hook            doctor --acceptance         release.sh
                    (advisory, no fail tail)   (gate id 'tool-honesty')    (|| true)
```

### Pattern 1: the in-band no-write marker

**What:** a machine-checkable literal leading a reference-only tool response.
**When:** any MCP handler that returns instructions rather than performing them.
**Source:** `lib/mcp/tool-router.cjs:384-394` (shipped, quick 260903-kwl)

```js
const NO_WRITE_MARKER = '**filed: false**';
function noWriteBanner(realPathSentence) {
  return `${NO_WRITE_MARKER} ${realPathSentence}`;
}
```
Recognized by the checker at `check-tool-honesty.cjs:101-102, :983-987` and classified OK regardless of claim tier. **This is why `meeting` is the load-bearing NEGATION_REGRESSION fixture the checker must never re-flag.**

### Pattern 2: the NOT-EXECUTED banner for a declared-but-unimplemented mutation

**What:** an explicit refusal-to-claim banner plus a `Suggested Next` that does not assert completion.
**When:** a command that MUTATES persistent state and has no executing branch.
**Source:** `lib/mcp/tool-router.cjs:317-319` (the membership set) and `:1636-1638`:

```js
if (unimplementedMutation) {
  parts.push(`\n> **NOT EXECUTED.** This returns the \`${command}\` instructions, not a completed operation. Nothing has changed yet. Follow the Reference steps below and verify the result before reporting success.`);
}
```
**Note the membership rule at `:312-313` is the thing to revise**, not the mechanism: it tests "mutates state AND has no branch" when the honest test is "the description claims it."

### Pattern 3: verified-result response construction

**What:** build the success payload FROM a verified operation result so a success shape is structurally impossible without the operation.
**When:** any MCP command that genuinely executes.
**Source:** `lib/mcp/tool-router.cjs:1574-1621` (`rooms-open`), the `rooms-open-false-success` RCA fix. `openRoom()` gates `ok:true` behind a `get-active` read-back; the response is constructed from `result.active`, and the failure arm enumerates a typed `reason` with a per-reason fix line.

### Anti-Patterns to Avoid

- **Suppressing a MEDIUM or UNKNOWN via `ALLOWED_UNVERIFIED`.** It is mechanically impossible (`:1162`), so an attempt would silently do nothing and look like it worked. That is itself a false success.
- **Adding a third no-write marker.** Two exist. Canon Part 7.
- **Editing a description without re-running `test-234` and `test-270`.** Both measure over the live wire; see Validation Architecture.
- **Hardening the gate to `--strict` before the list is empty.** The ljj SUMMARY names this as step 3 of 3, explicitly after triage.
- **Treating an `OK: a write primitive is reachable` verdict as proof of honesty.** See boundary B-5.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|------------|-------------|-----|
| JS source parsing | A new tokenizer or an AST dependency | The existing `maskNonCode` / `scanBalanced` / `splitTopLevelArgs` stage-A primitives (`:105-342`) | They already handle the regex-vs-division ambiguity that cost a real bug (`:115-128`). Adding acorn/espree would breach "CJS only, no new dependency" and the checker's zero-dependency posture. |
| No-write disclosure | A new marker literal or a new field | `noWriteBanner()` (`:392`) | Already machine-checked by `check-tool-honesty.cjs:101` and by `tests/test-kwl-meeting-mcp-honesty.cjs`. |
| Unimplemented-mutation disclosure | A new banner | The `UNIMPLEMENTED_MUTATING_ORCHESTRATION` pattern (`:317`, `:1636`) | Shipped by the `rooms-open` RCA; extending its membership rule is a smaller diff than a new mechanism. |
| Human confirmation of a claim | A bespoke confirm step | `gate_render` / `gate_answer` (`lib/mcp/tools/gate.cjs`) | The one governed Decision-Gate path; a second gate mechanism breaks the T-198-10 spoofing guard's single-ledger assumption (`gate.cjs:45-63`). |
| Room writes from MCP | A direct `room-db.cjs` or `node:sqlite` call | `lib/core/navigation.cjs` | `tool-router.cjs` is NOT on the substrate allow-list (`:594-596`); `scripts/check-substrate.cjs` will fail the build. |
| Test harness for tool descriptions | A source grep | `listToolsOverStdio` in `tests/test-234-tool-description-floor.cjs` | A grep misses runtime-assembled descriptions (`room_state` builds its own from a slice) and misreads template literals. The wire cannot lie. |

**Key insight:** every primitive this phase needs already exists in the repo, built by a prior RCA for the same disease. The phase is propagation, not construction.

---

## Common Pitfalls

### Pitfall 1: closing the list without fixing the detector first

**What goes wrong:** the 10 visible findings get triaged and closed, the gate goes green, and 14 real findings including 4 hand-verified HIGH RISK stay invisible forever behind a passing check.
**Why it happens:** the phase goal says "close all 9 findings," which reads as a fixed list.
**How to avoid:** sequence D-1 first. Re-run. Triage the resulting 24.
**Warning sign:** any plan whose first task edits a description string.

### Pitfall 2: a description edit that breaks `test-234` or `test-270`

**What goes wrong:** the description floor is 120 characters (`test-234:92`), applied over the wire to ALL 36 tools, together with capital-start, sentence-terminator, no-em-dash and a `HOST_DESCRIPTION_CAP_BYTES` of 2048 (`:103`). `test-270` measures total description plus schema bytes against a `BASELINE`/`AFTER` pair with a `DRIFT_TOLERANCE_PCT` of 10 (`:41`).
**Why it happens:** an honesty fix naturally SHORTENS an overclaiming description, and shortening below 120 characters or shifting the total by more than 10 percent turns a suite red.
**How to avoid:** the honest rewrite should ADD the disclosure sentence, not delete the claim sentence; `meeting`'s fixed description (`:1381`) is the worked example and it got longer, not shorter. Re-measure `test-270` and update `AFTER` deliberately if the delta is real.
**Warning sign:** a diff that removes more description bytes than it adds.

### Pitfall 3: mistaking a detector false positive for a real defect (or the reverse)

**What goes wrong:** a description gets rewritten to appease a heuristic bug (`context_assemble`'s "file contents"), or a real defect gets waved off as noise.
**Why it happens:** the two are indistinguishable from the verdict line alone.
**How to avoid:** the ljj plan's own mandated discipline - spot-check EVERY finding against source before disposing of it. That discipline took the first raw run from 34 HIGH RISK to 1, and four of those 33 were genuine detector bugs.
**Warning sign:** a disposition recorded without a file:line citation.

### Pitfall 4: assuming an OK verdict means the tool is honest

**What goes wrong:** 106 to 120 OK rows read as "the surface is clean."
**Why it happens:** boundary B-5. `analysis` and `methodology` are OK because a pipeline-state bookkeeping file gets written, not because the analysis output the description implies exists.
**How to avoid:** state in the script header and in any summary that OK means "no detectable mismatch," never "verified honest."

### Pitfall 5: the shared working tree

**What goes wrong:** another session commits into the same tree mid-phase; a git index-lock race or a clobbered edit.
**Why it happens:** documented operating reality (CLAUDE.md WORKSPACE GUARD; three handoffs name it).
**Current measured state, 2026-09-03:** local is **5 commits AHEAD of `origin/main` and 0 behind**, including `687df50e` (the Phase 276 registration) and the four ljj commits that BUILT the checker. **A session that pulls `origin/main` today does not have `scripts/check-tool-honesty.cjs` at all.** Working tree also carries 6 deleted `tests/fixtures/sample-room-personas/personas/*.md` (regenerated artifacts of `tests/test-phase-14.sh`, benign) and untracked `specs/`, `prototypes/`, `docs/MINDRIANOS-PRD.md`, `docs/2026-09-03-DESIGN-t2-write-back-minimal.md`.
**How to avoid:** `git fetch origin main` and check ahead/behind at the start of every plan; push before long-running work.

---

## Code Examples

### Reproduce the current sweep

```bash
node scripts/check-tool-honesty.cjs --report      # full 130-row table, exit 0
node scripts/check-tool-honesty.cjs --check       # advisory WARN block, ALWAYS exit 0
node scripts/check-tool-honesty.cjs --strict      # usage error, exit 2 (needs --check too)
node scripts/check-tool-honesty.cjs --check --strict   # exit 1 iff HIGH RISK findings exist
```
Source: `check-tool-honesty.cjs:1199-1246`.

### Programmatic bucket counts (what a plan's verification step should use)

```js
const { checkTree } = require('./scripts/check-tool-honesty.cjs');
const r = checkTree();
// r.toolCount, r.branchCount, r.highRisk[], r.medium[], r.low[], r.unknown[], r.ok[]
```
`scanAll` and `checkTree` never call `process.exit` (`:1077-1189`), so they are safe inside a test.

### The D-1 fix (one line, measured)

```js
// scripts/check-tool-honesty.cjs, inside splitBranches, replacing :538-539
let idx = lm.index + 4;                     // past the literal token "case"
while (idx < masked.length && /\s/.test(handlerBodyText[idx])) idx += 1;
```
The `masked[idx]` -> `handlerBodyText[idx]` change alone is NOT sufficient; `lm[0].length` must also stop being used, because `\s+` has already consumed the blanked literal.

### The three advisory gate call sites (all deliberately non-blocking)

```bash
# scripts/hooks/pre-commit-room-minto-guard.sh:523-525  (path-filtered, no failure tail)
node "$REPO_ROOT/scripts/check-tool-honesty.cjs" --check

# scripts/doctor.cjs:1055  (gate id, spawned with --check, r.status===0 always true today)
{ id: 'tool-honesty', script: 'check-tool-honesty.cjs' }

# scripts/release.sh:360
node "$PLUGIN_DIR/scripts/check-tool-honesty.cjs" --check || true
```
The pre-commit hook's missing `|| { exit 2; }` tail is load-bearing and documented as such (`:513-521`): it prevents a future change of the script's default posture from silently starting to block commits.

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| MCP tool descriptions as bare labels ("Meeting filing, intelligence pipeline, and speaker identification.") | Descriptions as INSTRUCTIONS, 120-char floor, enforced over the wire | Phase 234 (`71f15a3c`) | Improved tool selection on foreign hosts, but INTRODUCED the first-person capability overclaims this phase is cleaning up. The RCA states this plainly: Phase 234 "made this worse, not the origin." |
| Trust a tool's own success-shaped response | Independently verify against `room.db` mtime before/after | 2026-09-03 session | The discipline that found the whole defect class. Named in the 2026-09-03 handoff as "the discipline this whole session was built on." |
| Manual, one-off honesty review | A standing `scripts/check-tool-honesty.cjs` gate wired into pre-commit + doctor + release | quick 260903-ljj, 2026-09-03 | Advisory, never blocking, by deliberate design (Phase 210 posture). |
| Hard-fail CI gates on introduction | Advisory-on-introduction, `--strict` restores hard-fail | Phase 210 | The precedent `check-shape-declaration.cjs` set and `check-tool-honesty.cjs` copied. |

**Deprecated / outdated:**
- The ROADMAP's "9 findings" count: superseded by the measured 10.
- `check-tool-honesty.cjs:559-565`'s claim that fall-through grouping was "verified against real fall-through in this codebase (room_content's new-project/setup/update/help group)": cannot be true given D-1.
- `tool-router.cjs:314-316`'s reasoning that `scout*` needs no disclosure: superseded by F-1.

---

## Grounding Consults (honest accounting)

CLAUDE.md mandates consulting every authoritative source for the claim being made. What was and was not reachable from this research context:

| Source | Reachable here? | What it contributed |
|--------|-----------------|---------------------|
| **The repository itself** | Yes | Every substantive claim in this document is grounded in a file:line read or a measured run against this checkout. This is the authoritative source for every claim made here, and it was used exclusively. |
| **Theo** (`/home/jsagi/Theo`) | Yes, filesystem read | The `registerTool`-vs-`tool` portability finding and the `ALIAS_FORK` honest-refusal precedent. Both cited above. |
| **icm-architect** (`~/.claude/skills/icm-architect/`) | Present on disk, not invoked | Its Invariants 1, 4, 5 and 6 are already applied to this exact question in `.planning/debug/meeting-file-meeting-false-success.md:114-126`, and the resulting recommendation is quoted and assessed above. No new consult was needed; re-running it would have re-derived the same three invariants. **The planner should still bind it as a standing consult if any task touches `writeClaimNode` or room schema.** |
| **langtalks-graph-expert** | **NOT reachable** - no `mcp__langtalks-graph-expert__*` tools in this agent's tool set | The RCA already recorded a langtalks consult on the closest question ("How does A2A protocol relate to human-in-the-loop confirmation?") and reported a genuine miss: a 347-node BFS with no focused answer, and the one on-point node traced circularly back to icm-architect's own indexed material. Per that skill's own honesty rule, "not in the corpus yet" for this shape. `multihop_query` did confirm MCP and human-in-the-loop co-occur in episodes 50, 55 and 62, worth reading directly if the Tri-Polar phase becomes a real build. **Flagged as an unmet consult obligation for the planner, not papered over.** |
| **Context7** | **NOT reachable** - no `mcp__context7__*` tools; `ctx7` CLI absent (`command -v ctx7` -> not found) | **No consult needed.** This phase makes zero claims about a third-party library's behavior. It adds no dependency. The only runtime facts asserted are about Node's own regex semantics and this repo's own modules, both verified by execution rather than documentation. |
| **claude-api skill / claude-code-guide agent** | Not invoked | Relevant only if the phase touches MCP tool registration mechanics or `AskUserQuestion` behavior. It does not, unless the Tri-Polar gate wiring is pulled in (recommended against). |
| **WebSearch / WebFetch** | Available, not used | Per the standing MCP-stack-awareness rule, no silent web search was fired. Nothing in this phase is time-sensitive or external. |

---

## Validation Architecture

`.planning/config.json` sets `workflow.nyquist_validation: true`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Plain Node.js CJS scripts using `node:assert/strict`, aggregated by `tests/run-all-<phase>.sh`. No jest/vitest/mocha. |
| Node floor | `>=22.16.0` (CLAUDE.md stack table). Measured here: **v22.23.1**. |
| Config file | none (by design; the aggregator shell script IS the config) |
| Quick run command | `node tests/test-ljj-tool-honesty.cjs` (currently 16 passed, 0 failed across 9 named assertions) |
| Full suite command | `bash tests/run-all-266.sh` (the aggregator that currently owns both honesty tests) |
| Release gate | `scripts/verify-release` |
| Acceptance roll-up | `node scripts/doctor.cjs --acceptance` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOLHON-01 | `switch (command)` splitting yields per-command branches for `room_state`/`room_content`/`room_graph` | unit | `node tests/test-276-tool-honesty-switch-branches.cjs` | Wave 0 |
| TOOLHON-01 | The nine existing assertions still hold after the splitter change (no regression) | unit | `node tests/test-ljj-tool-honesty.cjs` | exists |
| TOOLHON-02 | Every non-OK row in the live sweep is either resolved or carries a triaged disposition | integration | `node tests/test-276-tool-honesty-findings-closed.cjs` | Wave 0 |
| TOOLHON-03 | `orchestration`'s description asserts no unreachable write; `scout*` self-discloses | unit | `node tests/test-276-orchestration-scout-honesty.cjs` | Wave 0 |
| TOOLHON-04 | `room_content`'s WRITE-surface list names only commands that reach a write; the new-project/setup/update group carries a NOT-EXECUTED banner | unit | `node tests/test-276-room-content-honesty.cjs` | Wave 0 |
| TOOLHON-05 | Every documented detector boundary is either asserted or explicitly listed in the script header | unit | folded into `test-276-tool-honesty-switch-branches.cjs` | Wave 0 |
| TOOLHON-06 | Every `ALLOWED_UNVERIFIED` entry has a non-empty reason, a triage date, and resolves to a live row | unit | `node tests/test-276-allowed-unverified-contract.cjs` | Wave 0 |
| all | Every registered tool description still clears the 120-char floor, prose shape, and 2048-byte cap over the wire | integration | `node tests/test-234-tool-description-floor.cjs` | exists |
| all | Total description + schema byte budget stays within the 10 percent drift tolerance | integration | `node tests/test-270-tool-schema-budget.cjs` | exists |
| all | The `meeting` honesty fix is not regressed | unit | `node tests/test-kwl-meeting-mcp-honesty.cjs` | exists |
| all | No em-dash in any touched file | lint | `bash tests/run-all-266.sh` (EMDASH_TARGETS, `:176-208`) | exists |
| all | Advisory gate posture unchanged unless deliberately hardened | integration | `node scripts/doctor.cjs --acceptance` | exists |

### Sampling Rate

- **Per task commit:** `node tests/test-ljj-tool-honesty.cjs && node scripts/check-tool-honesty.cjs --report | tail -30`
- **Per wave merge:** `bash tests/run-all-276.sh` (new) and `bash tests/run-all-266.sh`
- **Phase gate:** `bash tests/run-all-276.sh && bash tests/run-all-266.sh && node tests/test-234-tool-description-floor.cjs && node tests/test-270-tool-schema-budget.cjs && node scripts/doctor.cjs --acceptance` all green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/run-all-276.sh` - new aggregator, mirroring `run-all-274.sh`'s shape including an `EMDASH_TARGETS` block
- [ ] `tests/test-276-tool-honesty-switch-branches.cjs` - covers TOOLHON-01, TOOLHON-05. **Must be written RED against the pre-fix splitter** (assert `splitBranches` on a `switch (command)` fixture returns a non-empty `branchMap`), per this repo's TDD precedent (`209b604f` RED, `75278850` GREEN).
- [ ] `tests/test-276-tool-honesty-findings-closed.cjs` - covers TOOLHON-02
- [ ] `tests/test-276-orchestration-scout-honesty.cjs` - covers TOOLHON-03
- [ ] `tests/test-276-room-content-honesty.cjs` - covers TOOLHON-04
- [ ] `tests/test-276-allowed-unverified-contract.cjs` - covers TOOLHON-06
- [ ] `tests/fixtures/tool-honesty/switch-dispatch.cjs` - a synthetic `switch (command)` fixture with one writing case and one echo case (the existing 5 fixtures at `tests/fixtures/tool-honesty/` cover only positive/negated/banner/depth1 shapes)

No framework install needed.

---

## Security Domain

`security_enforcement` is not set to `false` anywhere in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | The checker is a local static analyzer; no auth surface. |
| V3 Session Management | **indirectly** | `gate_render`/`gate_answer`'s single-use, session-scoped ledger (`gate.cjs:45-63`) is a session-integrity control. Do not weaken it while triaging F-9. |
| V4 Access Control | **yes** | `writePathRefusal` gates `graph_write`/`memory_event` at CALL time (`graph.cjs:213-231`). Any new MCP write primitive must route through the same refusal. |
| V5 Input Validation | **yes** | `zod` schemas on every tool. `gate_answer`'s `validateChosenAgainstCard` (`gate.cjs:191`) is the value-domain check (GATE-01 G-2). `writeClaimNode` validates `knowledge_type` against a closed set (`typed-claim.cjs:106-108`). |
| V6 Cryptography | no | None involved. |
| V7 Error handling / logging | **yes** | The whole phase is an error-signalling problem: a tool that reports success it did not achieve is an error-handling defect, not a cosmetic one. |
| V12 File / resource | **yes** | `resolveRepoLocalPath` (`check-tool-honesty.cjs:666-683`) already contains the scanner inside `REPO_ROOT` with a `startsWith(rootWithSep)` check. Any detector extension that follows re-exports (fix for B-2) must preserve that containment or it becomes an arbitrary-file-read primitive in a pre-commit hook. |

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| A tool response asserting a write that did not occur | **Repudiation / Information disclosure** (the caller acts on false state) | Machine-checkable in-band marker + honest description. This is the phase's whole subject. |
| Gate replay / spoofing | Spoofing | T-198-10: single-use, session-scoped mint-then-consume ledger (`gate.cjs:18-21`, `:64-74`). Do not add a second gate mechanism. |
| Path traversal via a followed `require()` in the scanner | Elevation of privilege | `resolveRepoLocalPath`'s repo-root containment (`:666-683`). **Load-bearing for any B-2 fix.** |
| Arbitrary code execution via the scanner | Elevation of privilege | The scanner reads modules as TEXT and never `require()`s an MCP tool file (`:36-41`). It DOES `require()` exactly three modules (`navigation.cjs`, `navigation/edges.cjs`, `node-insert.cjs`) to enumerate exports (`:370-395`). **Do not widen that list.** |
| Room content egressing to the Brain (Canon Part 8) | Information disclosure | The checker makes zero network calls. `references/meeting/filing-protocol.md:186-193` names the specific risk if the Tri-Polar work is ever built: an MCP model walking the protocol is "one careless `brain_*` call away from a constitutional breach," with no F.8 gate to catch it. Reinforces the recommendation to give that work its own phase. |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 (floor is 22.16.0) | none needed |
| `node:sqlite` | `navigation.cjs` require during `resolveWritePrimitives` | yes | experimental warning printed to stderr on every run | The checker already degrades silently if a module fails to load (`:390-394`); the warning is cosmetic noise in `--report` output |
| git | phase workflow | yes | local 5 commits ahead of `origin/main`, 0 behind | none |
| `mcp__langtalks-graph-expert__*` | CLAUDE.md mandatory consult | **NO** | - | RCA's prior consult record + explicit flag as an unmet obligation |
| `mcp__context7__*` / `ctx7` CLI | library API claims | **NO** (`command -v ctx7` fails) | - | Not needed: this phase asserts no third-party library behavior |
| Theo repo (`/home/jsagi/Theo`) | out-of-repo recommendation | yes, filesystem read | Phase 9 in progress | none |
| `~/MindrianRooms/rethinking-mindrianos/` | compositing rule C-7 | yes | prior ljj entry present | none |

**Missing dependencies with no fallback:** none blocking.
**Missing dependencies with fallback:** langtalks (documented prior consult stands in, flagged); Context7 (not applicable to this phase's claims).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The proposed `TOOLHON-01..08` IDs are the right family name and granularity. | Phase Requirements | Cosmetic. IDs are phase-local working IDs by documented precedent; the navigator may rename at plan time. |
| A2 | Extending suppression to MEDIUM/UNKNOWN is NOT wanted, and those tiers should stay permanently visible. | ALLOWED_UNVERIFIED | If wrong, the 8 MEDIUM findings have no closure path and the phase cannot report a clean list. **Needs a navigator decision.** |
| A3 | An in-memory, process-lifetime gate-ledger entry is NOT a "write" for honesty purposes. | F-9 | If wrong, `gate_render` becomes a real HIGH RISK once `minted` is added to the verb vocabulary. **Needs a stated ruling either way.** |
| A4 | The Tri-Polar meeting gap should be a separate phase rather than scoped here. | Tri-Polar Assessment | If the navigator wants it in 276, the phase roughly triples in size and inherits an unruled constitutional question (the three-vocabulary collision). **This is the phase's biggest scoping decision.** |
| A5 | Hardening the gate to `--strict` is out of scope for 276 and belongs to a follow-up once the list is empty. | Locked Decisions / Discretion | If the navigator wants `--strict` in this phase, add a wave for it AFTER all findings close, and expect pre-commit to start blocking. |
| A6 | The 4 new `room_content` HIGH RISK findings are real defects, verified by reading `tool-router.cjs:756-773` and `persona-ops.cjs:550-571`. | F-11..F-14 | Low risk; hand-verified. But `fireCascade`'s downstream `runCascade` was not traced to a leaf write, so `new-project`/`setup`/`update` may reach SOME write via the cascade. That would not change the disposition (the cascade is not project creation), but the plan should trace it once to be exact. |
| A7 | `commands/scout.md`'s writes were confirmed by reading its step headings, not by executing it. | F-1 | Low risk; the step text is explicit ("Consolidate and Write the Competitor Report", `.snapshots/`, HSI pipeline). |

**Everything else in this document is `[VERIFIED]` by a file read or a measured command run in this session.**

---

## Open Questions

1. **Should MEDIUM and UNKNOWN be suppressible?**
   - What we know: `:1162` restricts `ALLOWED_UNVERIFIED` to HIGH_RISK. 8 MEDIUM and 1 UNKNOWN exist now, 18 and 1 after the D-1 fix.
   - What is unclear: whether "close all findings" means bucket-empty or disposition-recorded.
   - Recommendation: keep MEDIUM/UNKNOWN unsuppressible; define "closed" as "every row has a recorded disposition," and add a machine-readable disposition ledger rather than widening the allowlist.

2. **Is an in-memory ledger mint a write?** (A3)
   - Recommendation: no, and say so once in the verb-vocabulary comment so the `minted` inflection gap becomes a deliberate exclusion rather than an accident.

3. **Does the Tri-Polar meeting fix belong in 276?** (A4)
   - Recommendation: no. Register it as its own phase. Stated reason: it needs a new MCP write primitive plus gate wiring plus an unruled constitutional decision on the DIKW / `ALLOWED_EPISTEMIC_TYPES` / `knowledge_type` vocabulary collision, which CLAUDE.md already names as an open trap.

4. **How far should the detector extension go?**
   - Recommendation, in descending value order: D-1 (must, one line, unlocks 14 findings), B-2 barrel re-export (should, systemic, affects the Part 9 chokepoint), F-2's command-name-in-enumeration guard (should, cheap, mirrors the existing hyphenated-token fix), B-1 arity heuristic (could, narrow version only), B-4 `includes()` dispatch (could), B-3 subprocess (document only), B-5 semantics (document only).

5. **Should the 9 mega-tools get connector descriptors and `hitl_shape` declarations?**
   - What we know: only `room_bind` has one; 10 registrations in `tool-router.cjs` have none; OQ-3 (whether Part 11 R16 covers MCP tools) is still open.
   - Recommendation: out of scope for 276, but register it as a finding. A tool whose description this phase corrects is a natural place to also declare its shape, and doing it in the same edit later would be cheaper than a separate sweep.

6. **Was the `orchestration` description's write claim ever true?**
   - Not traced. Worth one `git log -S "ordinary reads and writes"` during planning: if it entered in Phase 234 like `meeting`'s did (`71f15a3c`), that strengthens the case that Phase 234's rewrite pass systematically introduced CLI-behavior descriptions over MCP echo handlers, which would justify auditing all 8 tools that pass rewrote.

---

## Sources

### Primary (HIGH confidence) - all read or executed in this session

- `scripts/check-tool-honesty.cjs` (1269 lines, read in full)
- `lib/mcp/tool-router.cjs` (1955 lines; regions :280-460, :580-588, :737-905, :912-930, :1175-1300, :1379-1500, :1487-1657, :1900-1955)
- `lib/mcp/tools/gate.cjs` (:1-220), `context.cjs` (full), `dual-path.cjs` (full), `graph.cjs` (:186-265), `views.cjs` (:196-242)
- `lib/core/shallow-doc-parser.cjs` (:136-200), `persona-ops.cjs` (:550-571), `navigation.cjs` (:460-670), `navigation/typed-claim.cjs` (:97-127)
- `.planning/debug/meeting-file-meeting-false-success.md` (full, 199 lines)
- `references/meeting/filing-protocol.md` (full, 195 lines)
- `.planning/quick/260903-ljj-.../260903-ljj-SUMMARY.md` (:43, :190-280)
- `.planning/ROADMAP.md` (Phase 273 :1004-1033, Phase 275 :1116-1128, Phase 276 :765-778)
- `.planning/REQUIREMENTS.md` (traceability section)
- `tests/test-ljj-tool-honesty.cjs`, `tests/test-234-tool-description-floor.cjs`, `tests/test-270-tool-schema-budget.cjs`, `tests/run-all-266.sh`
- `scripts/hooks/pre-commit-room-minto-guard.sh` (:505-527), `scripts/doctor.cjs` (:1040-1080), `scripts/release.sh` (:360), `scripts/check-substrate.cjs` (:53-140)
- `CLAUDE.md`, `.claude/includes/*.md`, `.planning/config.json`, `commands/scout.md`, `commands/dashboard.md`
- `~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-mcp-tool-honesty-sweep-ljj/`
- `/home/jsagi/Theo/src/mcp/` (directory listing, `register-graph-tool.ts` :16-56)

### Measured runs (HIGH confidence)

- `node scripts/check-tool-honesty.cjs --report` - 36 tools / 130 branches / 10 non-OK
- `node -e "checkTree()"` bucket counts - 1/8/0/1/120
- Custom instrumented probes of `splitBranches` proving D-1 (`SLICE`/`QC`/`lm0` traces)
- Patched-copy re-run proving the D-1 fix effect - 5/18/0/1/106
- `node tests/test-ljj-tool-honesty.cjs` - 16 passed, 0 failed
- `git fetch origin main` + ahead/behind - 5 ahead, 0 behind
- `node --version` - v22.23.1
- grep for `icm layer|room schema|layer` across the three Phase-275-relevance files - zero matches

### Not reachable (documented, not papered over)

- `mcp__langtalks-graph-expert__*` - unavailable in this agent's tool set; prior RCA consult record used instead and flagged as an unmet obligation
- `mcp__context7__*` / `ctx7` CLI - unavailable; not needed for this phase's claim set

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Current finding enumeration | **HIGH** | Executed against this checkout; cross-checked against the ljj SUMMARY. |
| Detector bug D-1 and its measured effect | **HIGH** | Instrumented, reproduced, patched, re-measured. Not inferred. |
| F-1 `orchestration.scout` disposition | **HIGH** | Handler and description read at file:line; CLI counterpart read. |
| F-11..F-14 `room_content` as real defects | **HIGH** | Both branch bodies and `invokePersona` read in full. |
| Detector boundaries B-1..B-5 | **HIGH** | Each grounded in a named file:line and, for B-1/B-2, in the repo's own prior documentation of the same gap. |
| `ALLOWED_UNVERIFIED` semantics | **HIGH** | Consumption site read; enforcement absence confirmed by grep. |
| Tri-Polar scoping recommendation | **MEDIUM** | The technical facts are HIGH confidence; the scoping call is a judgment the navigator owns (A4). |
| Requirement ID family | **MEDIUM** | Follows documented precedent, but IDs are proposals not ratifications (A1). |
| Theo portability finding | **MEDIUM** | Directory listing plus one source header read; no Theo build or run attempted. |

**Research date:** 2026-09-03
**Valid until:** 2026-09-17 for the detector analysis (stable, local, no external dependency). **Re-run `node scripts/check-tool-honesty.cjs --report` at plan time regardless** - the tree is shared and 5 commits are unpushed.
