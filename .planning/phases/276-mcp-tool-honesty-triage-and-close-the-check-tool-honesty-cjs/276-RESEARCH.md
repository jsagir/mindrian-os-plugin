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

### Phase Requirements to Test Map, Layer 2 and Theo (SECOND PASS, added 2026-09-03)

The three verification shapes the navigator named explicitly. Note the discipline that runs through all of them: **verify by observed output, never by an assertion that restates the code.** That is the same discipline that caught the D-1 bug (a header comment claimed a verification that had never run) and the same one Theo's own `05-REVIEW CR-01` records failing on its side ("rule 5 reported green over a live violation of the invariant it exists to protect").

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOLHON-01 | **RED proof against the pre-fix splitter.** `splitBranches` on a `switch (command)` fixture returns a non-empty `branchMap`. Must be authored and observed FAILING against the current `check-tool-honesty.cjs` before the fix lands, per the `209b604f` (RED) / `75278850` (GREEN) precedent this same script was built under. | unit | `node tests/test-276-tool-honesty-switch-branches.cjs` | Wave 0 |
| TOOLHON-02 | **Disposition verified by re-run output, not by assertion.** The test executes `scanAll()` and compares the live verdict rows against a checked-in expected-disposition ledger (`tests/fixtures/tool-honesty/276-dispositions.json`), failing on ANY row present in the scan but absent from the ledger. A new finding introduced later cannot pass silently, and a ledger entry for a row that no longer exists fails as stale. | integration | `node tests/test-276-tool-honesty-findings-closed.cjs` | Wave 0 |
| TOOLHON-09 | **C4 busy-timeout, proven under a held write lock.** Open a temp room.db, hold an exclusive write transaction on connection A, then attempt the opener under test on connection B and assert the typed outcome. Without a timeout the second open fails in ~0ms with `SQLITE_BUSY`; with `timeout: 5000` it waits. Assert the elapsed-time floor, not just the return value, or the test passes on an opener that never actually waited. | integration | `node tests/test-276-busy-timeout-propagation.cjs` | Wave 0 |
| TOOLHON-10 | **C5 typed reason, proven under a held write lock.** Same held-lock fixture. Call `spineEvents.logSpineRead(roomDir, ...)` while the lock is held and assert `reason` is a distinct busy reason (`room_db_busy`), NOT `no_room_db`. Then corrupt a room.db with garbage bytes and assert `room_db_broken`. Both must be observed against the real module, not a stub. | integration | `node tests/test-276-spine-events-typed-reason.cjs` | Wave 0 |
| TOOLHON-11 | **Every `no_room_db`-producing site is enumerated at run time, never from a frozen list.** The test greps the tree for the literal and asserts each production site either produces it only when `fs.statSync` genuinely fails, or has been migrated to a typed reason. Prevents the propagation gap from silently reopening. | unit | folded into `test-276-spine-events-typed-reason.cjs` | Wave 0 |
| TOOLHON-12 | **Theo mirror-task verification: a pinned five-constant diff.** Extract `ROOM_BIND_DESCRIPTION`, `GRAPH_WRITE_DESCRIPTION`, `GATE_RENDER_DESCRIPTION`, `GATE_ANSWER_DESCRIPTION`, `CHAIN_RUN_DESCRIPTION` from `/home/jsagi/Theo/src/mcp/operational/*.ts` **pinned to Theo commit `83a1ce2`**, and diff each against the plugin's own live registration string. Report IDENTICAL / DIFFERS per constant with the first divergence offset. The test must SKIP (not fail) when the Theo checkout is absent, because Theo is out of repo and CI has no copy. | integration | `node tests/test-276-theo-description-parity.cjs` | Wave 0 |

**Verification posture note for TOOLHON-12.** This is a coordination signal, not a gate. It must never block a plugin commit, because the plugin cannot fix Theo's file from this repo (Theo D-04 discipline: coordinated, not executed cross-repo). Recommended output shape: a report line the planner reads, mirroring `check-tool-honesty --report`, plus a non-zero exit only under an explicit `--strict` flag nothing wires by default.

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

**Second-pass additions (Layer 2 and Theo):**

- [ ] `tests/test-276-busy-timeout-propagation.cjs` - covers TOOLHON-09
- [ ] `tests/test-276-spine-events-typed-reason.cjs` - covers TOOLHON-10, TOOLHON-11
- [ ] `tests/test-276-theo-description-parity.cjs` - covers TOOLHON-12, skip-when-absent
- [ ] `tests/fixtures/tool-honesty/276-dispositions.json` - the expected-disposition ledger TOOLHON-02 diffs against
- [ ] `tests/helpers/held-write-lock.cjs` - the shared held-exclusive-write-lock fixture both TOOLHON-09 and TOOLHON-10 need. **Build this once and share it**; two independent lock fixtures would be exactly the propagation gap this phase exists to close, reproduced inside its own test suite.

No framework install needed. Node v22.23.1 is above the v22.16.0 floor at which `DatabaseSync`'s `timeout` option starts working, so the TOOLHON-09 test is meaningful on this machine. **On a runtime between v22.13 and v22.15 the option is silently ignored** (CLAUDE.md stack table), so the test must assert the elapsed-time floor rather than merely that no throw occurred, or it would pass vacuously on such a runtime.

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

---
---

# SECOND PASS: Layer 2 (substrate) and Theo Cross-Check

**Appended 2026-09-03** after the navigator broadened Phase 276 from "MCP Tool Honesty - Triage and Close" to "Same-Disease Consolidation - MCP + Local-Graph False-Success Deep Fixes" (`.planning/ROADMAP.md:765`). **Everything above this line stands unchanged, including the D-1 finding**, which remains the phase's highest-value single item. This pass adds the same file:line grounding for Layer 2 and for the Theo forward-compatibility work.

## What the broadened scope changes

| | First pass (narrow scope) | Second pass (broadened scope) |
|---|---|---|
| Layers | 1 (MCP descriptions) | 2 (MCP descriptions + local-graph substrate) |
| Finding sources | `check-tool-honesty.cjs` only | plus Phase 273's unfixed Criticals C4/C5, which the checker structurally cannot reach |
| Theo | named as an out-of-repo recommendation | plus a REQUIRED in-repo cross-check of 5 absorbed tools and 3 flip-day items |
| Dependency line | refuted by this research | **already corrected in the ROADMAP** by the navigator, citing this research's reasoning |

**The unifying thesis is now explicit in the ROADMAP and should drive the plan's structure:** Layer 1 and Layer 2 are the same disease one layer apart. Layer 1 is "a tool says it wrote and did not." Layer 2 is "the substrate says there is no database when there is one, or reports a write succeeded that was discarded." Both are instances of the standing WATCH item `feedback_false_success_silent_skip_gates_academy_testers.md`, OPEN since 2026-07-14.

**One correction to the ROADMAP's own Layer 1 text, carried forward from the first pass:** it still says "the 9 findings." The measured count is **10** (1 HIGH + 8 MEDIUM + 1 UNKNOWN), and **24** once D-1 is fixed. See the first pass for the measurement.

---

## Layer 2, C4: the `DatabaseSync` opener census

### Why Phase 273 did not fix this, quoted

The deferral was **deliberate and reasoned, not dropped**. `.planning/phases/273-sqlite-graph-chokepoint-hardening-writeedge-silent-failure-a/273-CONTEXT.md`, decision **D-02**, verbatim:

> "**D-02:** Full propagation of the same fix pattern to its ~20 sibling openers (C4's busy-timeout gap), the other 8 `BEGIN` sites lacking the nested-transaction guard (M6), the 3 migrations with unguarded `ROLLBACK` (M7), and the 33+ call sites not yet consuming typed errors (C5/M8) is explicitly OUT of this phase's scope -- **registered as a fast-follow phase, not silently dropped.** Rationale: the two-fix core is landable and high-value on its own; full propagation is roadmap-scale work in its own right and would make this phase sprawl."

And the phase's own domain statement (`273-CONTEXT.md:18-20`):

> "Full propagation of every good fix to every sibling site (C4's ~20 openers, M5-M8's transaction/retry/runtime-floor issues) is explicitly a fast-follow, not this phase's scope."

**Phase 276 IS the fast-follow phase D-02 registered.** The planner should say so in the plan objective; it converts "two Criticals were left unfixed" into "a named, scheduled commitment is being honored," which is a materially different and more accurate framing.

`273-deferred-items.md` contains only one entry, an unrelated pre-existing test-path bug. C4/C5 were never in it because they were never in scope to begin with; the deferral lives in CONTEXT D-02, which is the right place.

**One additional debt D-02 hands to this phase, easy to miss:** `273-CONTEXT.md` D-05 also defers the `docs/architecture/SUBSTRATE-BASELINE.md` number update here, on the reasoning that "that phase's C4/M5-M8 work is what can actually move the count; updating the number here would either lock in unreduced debt or falsely credit this phase's fixes for a change they structurally cannot produce." Measured now: the doc's prose still says **195** at `docs/architecture/SUBSTRATE-BASELINE.md:26` and `:285`, while its own later re-measurements record **208** (`:297`) and then **205** (`:323`). Three numbers in one document. This is icm-architect's named anti-pattern ("schema documents that mandate names the actual files stopped using") in numeric form, and it is inherited work, not new scope.

### The census: 32 production sites across 27 files

`grep -rln "new DatabaseSync(" lib/ scripts/` returns **35 files**, matching the navigator's measurement. Of those, 3 are excluded by inspection: `lib/wiki/editor-src/node_modules/@types/node/sqlite.d.ts` is a vendored type stub with 8 doc-comment occurrences, and the rest of the excluded set are `*.test.cjs` files. That leaves **32 production call sites**.

**The load-bearing classification is not "which have `timeout`" but "which DATABASE do they open."** A busy timeout only matters where two writers can contend for the same file. Grouping by that:

#### Group A: room.db, READ-WRITE, no timeout - the real C4 exposure (7 sites, 6 files)

| # | Site | Database | Fix shape |
|---|------|----------|-----------|
| A1 | `lib/core/lazygraph-ops.cjs:434` (`openGraph`, `dbPath = <room>/.mindrian/room.db`, `:427-429`) | room.db | **Propagate the OPENER.** ~38 call sites, the most-used opener in the repo. |
| A2 | `lib/hmi/selector-telemetry.cjs:235` (`dbPath` built at `:228`) | room.db | propagate the option, or the opener |
| A3 | `lib/hmi/shape-f0-renderer.cjs:116` (`dbPath` at `:112`) | room.db | propagate the option |
| A4 | `lib/hmi/shape-f6-plan-review-renderer.cjs:229` (`dbPath` at `:224`) | room.db | propagate the option |
| A5 | `lib/hmi/shape-f6-plan-review-renderer.cjs:283` | room.db | propagate the option |
| A6 | `lib/core/venture-shape-nudge.cjs:97` | room.db (read-intent, opened read-write) | propagate the option, or switch to the read-only door |
| A7 | `scripts/dogfood-derive.cjs:121`, `scripts/dogfood-emit.cjs:39`, `scripts/sync-rooms-graph:243`, `scripts/auto-explore-fingerprint.cjs:105` and `:135`, `scripts/preflight-tension-surface.cjs:167` and `:346` | room.db (dev/ops scripts) | lower priority; propagate the option |

#### Group B: a DIFFERENT database, read-write, no timeout (4 sites)

| # | Site | Database | Note |
|---|------|----------|------|
| B1 | `lib/core/cross-room-store.cjs:68` (`withStore`, `storeDbPath(roomsHome)`) | `<roomsHome>/.rooms/<store>.db` | **NOT room.db.** `openRoomDb` is structurally wrong here (it takes a `roomDir` and runs 13 CREATE TABLEs plus 5 room migrations). Fix = propagate the OPTION only. The `withStore` wrapper "silently swallows lock contention into a fallback value" (`:59-61` comment confirms open/close-per-call with a `fallback` return), which is why the reviewer named it. |
| B2 | `lib/workflow/cross-room-umbilical-closer.cjs:83` (`withRejectionStore`) | `<roomsHome>/.rooms/<rejection>.db` | identical shape to B1, explicitly "mirroring cross-room-store's discipline" (`:75-76`). Same fix. |
| B3 | `lib/core/breakthrough/review-queue.cjs:74` | `<roomsHome>/.rooms/breakthrough-review-queue.db` | not room.db; option only |
| B4 | `lib/core/breakthrough/review-queue.cjs:80` | `:memory:` | no-op; in-memory cannot contend |

#### Group C: read-only opens - out of C4 scope by construction (7 sites)

`lib/core/session-presence.cjs:291`, `lib/core/coverage-rollup.cjs:93`, `lib/core/graph-derivation.cjs:507`, `lib/core/navigation/spine-events.cjs:439` (all `'file:' + path + '?mode=ro'`), plus `lib/core/chat-context-builder.cjs:134`, `lib/core/proactive-intelligence.cjs:141`, `scripts/serve-dashboard-live:357`, `scripts/scout-cadence-guard.cjs:164`, `scripts/check-graph-export-typemap.cjs:60` (all `{ readOnly: true }`).

**WAL readers never block writers**, which `room-db.cjs:251` states explicitly ("a longer wait, never a new failure mode; WAL readers never block writers"). A busy timeout on a read-only handle buys nothing. **Recommend excluding Group C from C4 with that reason stated**, rather than bolting a no-op option onto 9 sites to make a count look complete. That would be exactly the cosmetic-compliance failure this phase exists to avoid.

#### Group D: `:memory:` and version probes - no-op (4 sites)

`lib/core/eureka/tri-modal-index.cjs:254`, `lib/core/doctor/class-s-eureka-smoke.cjs:119` and `:122`, `scripts/doctor.cjs:2850`.

#### Group E: the one correct site

`lib/core/room-db.cjs:259-260` - both construction branches pass `timeout: 5000`, added by Phase 218-02 D-05. The comment at `:242-251` explains why, and `:252-257` explains why the construction and the three PRAGMA execs are wrapped together (Phase 236 observed that constructing a garbage-bytes file SUCCEEDS and corruption only surfaces at `PRAGMA journal_mode = WAL`).

### "Propagate the option" or "propagate the opener"? The evidence

**The question the navigator asked is the right one, and the answer differs per group.** Reading `room-db.cjs`'s opener contract (`:235-333`) settles it.

`openRoomDb(roomDir, opts)` does far more than construct a handle. In order: `auditBypassIfNeeded` (`:237`), `mkdirSync` the `.mindrian` dir (`:243`), construct with `timeout: 5000` (`:259-260`), three PRAGMA execs (`:261-265`), typed-error classification of any open failure with a handle-close-before-throw so a failed open never leaks a lock (`:266-275`), then a SEPARATE try wrapping the full migration chain: `lazygraph.initSchema`, `memory.initMemorySchema`, Phase 109 provenance, Phase 109 session_focus, Phase 160-04 bitemporal, Phase 222-01 ranker_weights, Phase 224-01 edge review_status (`:277-310`).

That has three consequences the planner must weigh:

1. **For Group A (room.db, read-write), "propagate the opener" is the RIGHT answer and it is also the bigger fix.** It buys the timeout, the typed errors, AND schema consistency. `lazygraph-ops.openGraph` (A1) is precisely the opener whose schema divergence from `room-db.cjs` was Phase 273's **C2** and **M12** ("two competing schema authorities for `nodes`/`edges` depending on which opener touches a room.db first", `ROADMAP.md:1020`). Routing A1 through `openRoomDb` would close C4, M12, and the residual half of C2 in one move.
2. **But it is NOT a drop-in, and the plan must not assume it is.** `openGraph` is `async` and returns `{ db, conn }` (`lazygraph-ops.cjs:424-426`); `openRoomDb` is synchronous and returns a bare handle. **38 call sites** depend on the current shape. `room-db.cjs:31` already requires `lazygraph-ops.cjs` at module top level, which `273-CONTEXT.md` records as making a migration-side fix circular. And `openRoomDb` runs a 7-step migration chain on EVERY open, which `tool-router.cjs:594-603` documents as the exact reason a status-line read must never use it ("a status line must never be able to trigger a schema migration as a side effect of merely being READ").
3. **For Groups B, C, D, "propagate the opener" is structurally wrong.** `openRoomDb` takes a `roomDir` and builds `<roomDir>/.mindrian/room.db`. It cannot open `<roomsHome>/.rooms/*.db` or `:memory:` at all.

**Recommended split, and the planner should state it as a decision rather than let it emerge:**

| Group | Fix | Rationale |
|-------|-----|-----------|
| A1 (`lazygraph-ops.openGraph`) | **Propagate the OPENER**, as its own plan with a 38-call-site migration and a shape-compatibility shim | Closes C4 + M12 + C2's residue together. Highest value, highest risk, deserves isolation. |
| A2-A7 | **Propagate the OPTION** (`{ timeout: 5000 }`) | Small, safe, mechanical. Several are read-intent sites where the read-only door would be even better. |
| B1-B3 | **Propagate the OPTION only** | Different database; the opener does not apply. |
| B4, C, D | **Explicitly excluded, with the reason recorded in the plan** | In-memory cannot contend; WAL readers never block writers. Do not pad the count. |

**Guard against a cosmetic fix.** Adding `{ timeout: 5000 }` to 32 constructors and declaring C4 closed would satisfy a grep and change almost nothing, because most of those sites cannot contend. The honest measure of C4 is **"can a contended write on room.db now wait instead of failing in 0ms,"** which is what TOOLHON-09's held-lock test asserts.

---

## Layer 2, C5: the typed-error propagation gap

### The defect, at file:line

`lib/core/navigation/spine-events.cjs`, `_emit` (`:133-145`):

```js
function _emit(roomDir, eventType, payload) {
  if (!_hasRoomDb(roomDir)) {
    return { ok: false, reason: 'no_room_db' };      // :134-136  CORRECT
  }
  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (_e) {
    return { ok: false, reason: 'no_room_db' };      // :140-142  WRONG
  }
```

`_hasRoomDb` (`:114-123`) has ALREADY proven the file exists via `fs.statSync(...).isFile()`. So by the time control reaches `:141`, "no room db" is a statement the code has just disproven. The only two errors `openRoomDb` can throw at that point are `RoomDbBusyError` and `RoomDbBrokenError` (or an unclassifiable stranger it re-throws as itself, `room-db.cjs:272-275`). **None of them means "no database."** The catch binds `_e` and discards it entirely.

`_emitWithOperatorEdge` (`:214-223`) is a byte-for-byte repeat of the same four lines. **Two sites, one bug, which is itself the propagation pattern in miniature.**

### Why this is the exact failure GRAPHDB-02 was built to prevent

`room-db.cjs:148-157`, the `RoomDbBusyError` doc comment, names this outcome as the thing it exists to stop:

> "It is deliberately distinct from `RoomDbBrokenError` (nothing is damaged; waiting fixes it) and deliberately distinct from 'no room db' / cold start (the room HAS history, it is just unreachable this instant). **Treating a busy room as a cold start is exactly the data-loss path GRAPHDB-02 exists to close.**"

And `RoomDbBrokenError` (`:168-175`):

> "Also distinct from 'no room db' / cold start: **a broken room has history that must not be silently overwritten by a fresh start.**"

The typed errors were built. `spine-events.cjs` throws them away.

### The "2 of 35+ call sites that consume the typed errors" - located

Grepping `RoomDbBusyError|RoomDbBrokenError` across `lib/`, `scripts/`, `bin/` excluding tests returns exactly two consumers outside `room-db.cjs` itself:

**Consumer 1 - `lib/core/graph-refine-loop.cjs:126-136`:**
```js
const rdb = _roomDb();
try {
  db = rdb.openRoomDb(roomDir);
  owned = true;
} catch (e) {
  if (e instanceof rdb.RoomDbBusyError || e instanceof rdb.RoomDbBrokenError) throw e;
  db = null;
}
```
Note the lazy-require indirection at `:29-44` (`_roomDb()` caches the module and re-exports the two classes), which exists so `instanceof` compares against the same module instance.

**Consumer 2 - `lib/core/graph-derivation.cjs:263-268`**, using the direct top-level import from `:65`:
```js
try {
  db = openRoomDb(roomDir);
} catch (e) {
  if (e instanceof RoomDbBusyError || e instanceof RoomDbBrokenError) throw e;
  db = null;
}
```

**The consuming pattern, stated so the planner can propagate it:** *narrow the swallow.* Re-throw the two typed classes; keep the pre-existing `db = null` for every other error so a genuine cold start stays a cold start. Both sites carry the identical justification comment (`graph-derivation.cjs:258-262`, `graph-refine-loop.cjs:125-131`): "this site adds no classification logic, it only stops swallowing the two typed classes... strictly narrower than the previous behavior, never wider."

**One caution the planner must carry.** `spine-events.cjs` cannot simply re-throw. Its whole contract is a `{ok, reason}` return - its own header states it "returns `{ ok:false, reason:'no_room_db' }` when `<roomDir>/.mindrian/room.db` [is absent]" (`:24`), and every caller is written against that. So C5's fix is the **return-shape variant** of the same pattern: classify in the catch and return a DISTINCT reason, rather than re-throw. Recommended reasons, matching the existing snake_case convention: `room_db_busy` and `room_db_broken`, with the unclassifiable stranger keeping `no_room_db` or, better, a third `room_db_open_failed`.

**A second caution: `err.name`, not only `instanceof`.** `room-db.cjs:158-166` sets `this.name` explicitly and says why: "so `err.name` still discriminates across a module-instance boundary, where `instanceof` can fail on a duplicated require." `spine-events.cjs` reaches `room-db.cjs` through `roomDbMod`, and this repo has already been bitten by duplicated-require identity. **Check `err.name` first, `instanceof` second.**

### Who consumes `reason` today, and what they should see instead

`no_room_db` is **produced** at 27 sites and, measurably, **branched on** at zero. A grep for `=== 'no_room_db'` across `lib/`, `scripts/`, `bin/`, `hooks/` returns **no matches**. That is an important, slightly deflating finding and it should be reported honestly rather than dressed up:

- **The good news:** no caller currently makes a wrong decision by string-matching the reason, so adding new reason values breaks nothing. The fix is low-risk.
- **The real damage is upstream of any branch.** `_emit` returns `{ok: false}`. Every caller sees a falsy result and treats the event as not logged. On a busy room that is a **silently dropped spine event** - the `memory_event` row that CLAUDE.md says is the local mind's record of what happened simply never exists, and nothing anywhere reports that it should have. The reason string is what a human or a debug session reads afterward, and today it says the wrong thing.
- **The F-selector concern named in Phase 273 is real but indirect.** `ROADMAP.md:1016`: "A momentarily-busy room reads as an empty cold-start room to the F-selector." The path is not a `reason` branch; it is `getCurrentJTBD` (`spine-events.cjs:283`) and `getCurrentOperator` (`:315`) returning nothing on a busy open, so the selector sees a room with no JTBD and no operator, which is indistinguishable from cold start. **The planner should verify those two functions' own catch behavior as part of C5**; they are in the same file and were not named in the ROADMAP text.

**Recommended scope for C5:** fix the two `_emit` sites, verify and fix `getCurrentJTBD`/`getCurrentOperator` if they share the swallow, and add the enumeration test (TOOLHON-11) so the 27 production sites cannot silently regrow the gap.

---

## Layer 2, M8: `RoomDbBusyError`'s retry contract - explicit IN/OUT call

**Where the contract is documented:** `lib/core/room-db.cjs:150-153`, in the `RoomDbBusyError` header comment:

> "The room exists and is intact, but another connection holds the write lock right now. **A caller catches this and RETRIES, backs off, or tells the user to close the other session.**"

**Confirmed zero implementations.** Grepping `RoomDbBusyError` across `lib/`, `scripts/`, `bin/`, `hooks/` and filtering for `retry|backoff|sleep|attempt` returns **no matches**. The only two consumers (`graph-refine-loop.cjs:134`, `graph-derivation.cjs:266`) re-throw; neither retries, backs off, or surfaces a close-the-other-session message. The word "RETRIES" is capitalized in a doc comment and honored nowhere.

**Recommendation: IN, but as the smallest possible piece.**

**Why in.** It is the same disease by the strictest reading: a documented contract that nothing honors is a claim the code does not deliver, which is exactly what Layer 1 is about. The ROADMAP already flags it as "arguably the same disease... the planner should make an explicit in/out call on M8 rather than silently ignoring it." And there is a cheap dependency: **C4's `timeout: 5000` propagation IS a retry mechanism**, implemented inside SQLite rather than in JS. Once Group A carries the timeout, most contention resolves before a `RoomDbBusyError` is ever constructed, which materially shrinks what a JS-level retry would need to do.

**Why the smallest piece.** Building a general retry/backoff wrapper is real design work (how many attempts, what jitter, does it apply to reads, what does a caller see on exhaustion) and would compete with C4/C5 for plan capacity.

**Recommended minimal M8 disposition, pick ONE:**
- **Option 1 (preferred, near-zero cost):** correct the comment to describe what the code actually offers. `openRoomDb` already waits up to 5s via SQLite's own busy handler; the honest sentence is "a caller that reaches this has already waited out the 5s busy window, so retrying immediately will not help - surface it or tell the user to close the other session." That converts a false promise into a true statement, which is the phase's whole thesis applied to a comment. **This is the same move as F-1 and F-9: fix the claim, not the code, when the code is right.**
- **Option 2 (if plan capacity allows):** add one bounded retry helper in `room-db.cjs` and adopt it at the two existing consumers only. Do not sweep it repo-wide in this phase.

**Do NOT** leave M8 untouched, because the ROADMAP explicitly asks for a stated call, and "no decision" is the one outcome it rules out.

---

## icm-architect consult (MANDATORY per CLAUDE.md, applied and reported honestly)

Read: `~/.claude/skills/icm-architect/SKILL.md` (the ten invariants, the six forms, the walk test, the guardrails). Its four references were noted but not fully read: `core.md`, `forms.md`, `system-map.md`, `reference-integrity.md`.

### What it says plainly: it has nothing directly on this

**icm-architect is a workspace-structure skill.** Its subject is folder architecture as agent orchestration (Van Clief & McDermott, arXiv:2603.16021). It has **zero** material on SQLite busy timeouts, typed error propagation, or constructor-option plumbing. Stating that plainly rather than stretching it, exactly as its own honesty posture and the RCA's langtalks entry both model. **Anyone claiming icm-architect "validates" the C4/C5 fix shape at the code level would be manufacturing grounding.**

### What genuinely transfers: four items, cited

1. **The anti-pattern list contains this phase's own promotion bar, and Phase 276 clears it.** SKILL.md Guardrails: *"patterns declared top-down (one team complaining is a gripe - the same shape appearing three independent times is structure)."* Phase 276 has the same false-success shape from **five independent sources**: the `rooms-open` RCA (2026-07-27), the `meeting/file-meeting` RCA (2026-09-03), the `check-tool-honesty` sweep, Phase 273's code-review pass, and Theo's own independently-discovered "false failure" in `delegate.ts`. That is well past the bar. **This is the strongest single justification for consolidating rather than scattering, and it comes from the mandated consult.**

2. **The `SUBSTRATE-BASELINE.md` number drift is a named anti-pattern.** SKILL.md Guardrails: *"schema documents that mandate names the actual files stopped using (update the schema or the files - pick one)."* The doc says 195 at `:26` and `:285`, 208 at `:297`, 205 at `:323`. Three numbers, one document. Invariant 9 adds the fix direction: *"Generated indexes (file maps, logs) are rebuilt by script, never hand-edited."* The baseline should be **regenerated from `node scripts/check-substrate.cjs --baseline`** as part of this phase, not hand-corrected to whichever number is currently right. Phase 273 D-05 already assigned this here.

3. **The walk test's move-safety clause applies directly to the A1 opener re-route.** SKILL.md walk test: *"After a restructure: does every reference that existed before the move still resolve? A moved file that something still points at is a break, not a tidy-up."* Re-routing `lazygraph-ops.openGraph` through `openRoomDb` is a move in exactly this sense: **38 call sites point at a function whose async-ness and `{db, conn}` return shape would change.** The skill's `references/reference-integrity.md` is its "move-safety gate: what points at a file, case-folded destinations, copy-verify-remove" and is the right read before that specific plan is written. **Recommend the planner load it for the A1 plan only**, not for the whole phase.

4. **Invariant 5 (factory vs product) reinforces the "propagate the opener" preference for Group A.** The opener contract - timeout, PRAGMAs, typed errors, migration chain - is *factory* material: stable, reusable, identical regardless of caller. Having two openers with divergent schema authority (Phase 273's M12) is the invariant's failure mode. This is the same reasoning the RCA already applied to the Claimify protocol living duplicated-by-omission across two surfaces (`.planning/debug/meeting-file-meeting-false-success.md:122`).

**Net:** the consult contributes a real promotion-bar justification, a named anti-pattern for the baseline doc, a concrete pre-read for the riskiest plan, and one architectural preference. It contributes nothing to the code-level fix mechanics, and that is stated rather than papered over.

---

## Theo Cross-Check

All read-only against `/home/jsagi/Theo`, **pinned to commit `83a1ce2`** ("phase-11: ship 11-MOS-LEARNING.md and close the CALIBRATE requirement family").

### B1: which of the 24 findings land on a Theo-absorbed tool

The D-1 fix was applied **in analysis only** (a patched copy in the scratchpad; the repo's `scripts/check-tool-honesty.cjs` is untouched, and landing the fix is the phase's first plan). Running the patched checker and intersecting the 24 non-OK rows against Theo's five absorbed tools:

```
non-OK total 24
tools with findings: room_content, room_graph, export, orchestration, context_assemble, gate_render
THEO-ABSORBED tools with findings: gate_render
```

**Exactly one hit: `gate_render` (finding F-9, MEDIUM).** The other four absorbed tools are clean on this detector:

| Theo-absorbed tool | Plugin verdict | Reason |
|---|---|---|
| `room_bind.(default)` | OK | a write primitive is reachable |
| `graph_write.(default)` | OK | a write primitive is reachable |
| `gate_answer.(default)` | OK | a write primitive is reachable |
| `chain_run.(default)` | OK | no persistence claim found |
| **`gate_render.(default)`** | **MEDIUM** | weak tool-scoped claim, no reachable write |

That is a clean, small coordination surface: **one mirror task, not five.**

### B1a: the five description constants, diffed and measured

Each constant located and extracted, then compared byte-for-byte against the plugin's live registration string:

| Tool | Theo constant | Theo file:line | Plugin site | Length (plugin / Theo) | Result |
|---|---|---|---|---|---|
| `room_bind` | `ROOM_BIND_DESCRIPTION` | `src/mcp/operational/room-bind.ts:101` | `lib/mcp/tool-router.cjs:1696` | 254 / 254 | **IDENTICAL** |
| `graph_write` | `GRAPH_WRITE_DESCRIPTION` | `src/mcp/operational/graph-write.ts:103` | `lib/mcp/tools/graph.cjs:219` | 157 / 157 | **IDENTICAL** |
| `gate_render` | `GATE_RENDER_DESCRIPTION` | `src/mcp/operational/gate-render.ts:89` | `lib/mcp/tools/gate.cjs:113` | 323 / 323 | **IDENTICAL** |
| `gate_answer` | `GATE_ANSWER_DESCRIPTION` | `src/mcp/operational/gate-answer.ts:105` | `lib/mcp/tools/gate.cjs:170` | 1462 / 1152 | **ALREADY DIVERGED** |
| `chain_run` | `CHAIN_RUN_DESCRIPTION` | `src/mcp/operational/chain-run.ts:90` | `lib/mcp/tools/chain.cjs` | 1113 / 1006 | **ALREADY DIVERGED** |

**The `gate_answer` divergence is real, already live, and nobody has noticed.** First divergence at character 585. Both sides read "...js (Part 9) -- never a direct DB write." and then split:

- **Plugin continues:** "An approve verdict ALSO writes a typed decision node with SOURCED_FROM provenance edges to the card's subject/evidence node ids, plus a USES_FRAMEWORK edge when the gate came from a chain halt with an active framework; the node is promoted to confirmed via navigation.confirmNode, recording the human APPROVE."
- **Theo continues:** "When the gate_id was minted by a chain_run halt at a material step..."

Confirmed independently: `grep -c "SOURCED_FROM\|USES_FRAMEWORK" src/mcp/operational/gate-answer.ts` returns **0**. That clause was added to the plugin by quick 260903-i2x (`2c8dfddf`, the T2 node-writing half, this same session). **Theo's catalog currently under-describes what `gate_answer` actually does after the flip**, which is the benign direction but is still a description-vs-behavior gap, and it proves the drift channel is live rather than theoretical.

*(Extraction caveat, reported rather than hidden: the `chain_run` reconstruction passes through an escaped quote that a regex-based extractor handles imperfectly, so the 1113/1006 length delta is real but the exact divergence offset for `chain_run` is not trustworthy from this pass. TOOLHON-12's test should extract via a TypeScript-aware path or by importing the compiled module, not a regex. Naming this is itself the point: a parity test built on a lossy extractor would report green over a real divergence, which is `05-REVIEW CR-01`'s exact failure.)*

### B1b: resolving the `minted` question in Theo's light - recommendation reversed from the first pass

The first pass flagged that `STRONG_VERBS` (`check-tool-honesty.cjs:855-859`) contains `mint`/`mints` but not `minted`, and that adding the inflection would flip `gate_render` to HIGH RISK. The navigator's steer, and it is the right call, is to **correct the description rather than touch the verb vocabulary**. The Theo evidence makes the case decisive:

1. **The claim is genuinely imprecise, not merely tripping a heuristic.** `gate.cjs:113` says "Returns a minted gate_id that gate_answer must reference to ratify." A reader has no way to know the mint is a process-lifetime in-memory Map entry (`_mintLiveGate` at `gate.cjs:64-70` delegates to `gateLedger.mintGate`, and the block comment at `:45-63` describes it as "a small in-memory, single-use live-gate ledger"). "Minted" reads as durable. **A gate_id does not survive a server restart, and nothing says so.**
2. **Widening `STRONG_VERBS` would be the wrong lever twice over.** It would fire on every legitimate use of "minted" across the surface, and it would treat a vocabulary change as a substitute for saying the true thing. The phase's own rule is fix the claim, not the detector, when the code is right.
3. **Theo's copy is byte-identical, so the fix must be mirrored or Theo ships the imprecise text forever.**

**Recommended disposition for F-9, updated:** rewrite the final sentence to something like *"Returns a gate_id minted into this server process's in-memory ledger, which `gate_answer` must reference to ratify; nothing is persisted and the id does not survive a restart."* Then register the **one Theo mirror task** against `GATE_RENDER_DESCRIPTION` (`src/mcp/operational/gate-render.ts:89-93`), coordinated per Theo's D-04 discipline, never executed from this repo.

**Bonus effect worth naming:** that sentence contains "nothing is persisted," which is close to `NEGATION_PATTERNS` territory (`check-tool-honesty.cjs:865-872`). It would not currently match any of the six patterns; the planner may want to add `/\bnothing\s+is\s+persisted\b/` alongside the existing `/\bnothing\s+is\s+written\b/`, which is a one-line, well-precedented change rather than a verb-vocabulary widening.

### B2: the three flip-day items outside the checker's scan - IN/OUT calls

The checker's declared scan set is `lib/mcp/tool-router.cjs` + `lib/mcp/tools/*.cjs` + `lib/mcp/contract-version.cjs` (`check-tool-honesty.cjs:1057-1074`). All three items below sit outside it, which is precisely why they need a manual call.

#### (a) `mode_signals` - the Brain shim's DirectiveEnvelope promise. **Recommendation: IN, one-line description fix.**

- **The consuming code:** `bin/mindrian-brain-mcp-client.cjs:198`, inside the `brain_ask` handler: `const signals = (raw && typeof raw === 'object' && raw.mode_signals) ? raw.mode_signals : {};` then `return asContent(wrapDirective(raw, signals));`
- **The description that promises it:** `bin/mindrian-brain-mcp-client.cjs:151`: *"...Returns a DirectiveEnvelope (default mode: GUIDED) carrying the directive content..."*
- **The honest reading, and a correction to the ROADMAP's framing.** The description does **not** literally contain the string `mode_signals`; it promises a DirectiveEnvelope with a default mode. Theo's `09-MOS-LEARNING.md` says "`mode_signals` no longer arrives... The tool description text that promises it is now wrong." The mismatch is real but indirect: after the flip `raw.mode_signals` is always absent, `signals` is always `{}`, and the envelope's mode degrades to whatever `wrapDirective` defaults to. **The description keeps promising a mode-carrying envelope while the mode signal is structurally gone.**
- **Why IN:** it is a description-vs-behavior mismatch in the plugin's own file, it is exactly this phase's subject, and it costs one sentence. **Why it is cheap and safe:** the fix is honest disclosure, not behavior change. The line already degrades gracefully (`? raw.mode_signals : {}`), so nothing breaks either way.
- **Scope guard the planner must set:** fix the description only. Do NOT start the Brain-shim flip adaptation here; that is Phase 267/269's named 7-file list.

#### (b) `enrichCausalEdges` / `hatAwareRecommend` / `suggestValidationSteps` honest empties. **Recommendation: OUT of the code-fix scope, IN as a one-paragraph recorded finding.**

- **Definitions:** `lib/core/brain-client.cjs:1183` (`enrichCausalEdges`), `:1279` (`hatAwareRecommend`), `:1415` (`suggestValidationSteps`), all exported at `:2197-2199`.
- **The question asked was "do any callers render an empty as 'no findings'?" The measured answer is no, for the callers that exist.**
  - `suggestValidationSteps` has exactly one caller, `lib/core/opportunity-ops.cjs:1359`, inside `enrichOpportunity`. Its empty handling (`:1360-1362`) is `if (!result || !result.steps || result.steps.length === 0) return { enriched: false, steps: 0 };` - it returns an explicit **not-enriched** signal and **emits no markdown section at all**. The "## Suggested Validation" heading (`:1366`) is only reached on a non-empty result. **Structurally cannot render an empty as a finding.**
  - `hatAwareRecommend` has exactly one caller outside `brain-client.cjs`: `commands/hat-briefing.md:139`, which pipes the raw JSON to stdout for inspection. No rendering layer.
  - `enrichCausalEdges` has **zero** production callers. The only two references outside its own definition are prose: `lib/brain/ROOM.md:31` and a comment at `lib/brain/chain-recommender.cjs:46`, both describing a Phase 5 dependency, neither a call.
- **Why OUT:** there is no defect to fix. Reporting one would be manufacturing work, which is the mirror-image dishonesty of the one this phase exists to correct.
- **Why partly IN:** the risk is *forward-looking* and worth one recorded paragraph. `enrichCausalEdges` having zero callers means the first future caller inherits an un-audited empty-vs-absent contract at the exact moment the flip makes empties the common case. Record it; do not build for it.

#### (c) `graph_write`'s stale-version check failing open on a missing node. **Recommendation: IN, one-clause description addition. This is the strongest of the three.**

- **The behavior, traced end to end:**
  - `lib/mcp/tools/graph.cjs:150-154` calls `navigation.checkLostUpdate(db, p.sourceId, p.readVersion)` and returns `lost_update_conflict` only when `cas.conflict` is true.
  - `lib/core/navigation/reconcile-guard.cjs:77` runs `SELECT last_modified_at FROM nodes WHERE id = ?`. **On a missing node the row is undefined, so `current` becomes `null`** (`:78-80`).
  - `checkReconcile` (`:37-46`) then hits its explicit guard: *"NULL/absent on EITHER side -> no reliable CAS token -> no claim (Pitfall 1)"* and returns `{ status: 'no-claim' }`.
  - `conflict` is therefore `false`, and the write proceeds as if the CAS check passed.
  - `:82-85` fails open a second time, on a guard read error, with the comment *"Fail OPEN: a guard read error degrades to the normal write, never a lockout."*
- **The behavior is deliberate and defensible.** Theo's `05-MOS-LEARNING.md` states it: *"fails open on a missing node, deliberately... Do not read a pass here as proof the node existed."* The code says the same at `:69-70` and `:83-84`. **The defect is not the fail-open; it is that the description does not disclose it.**
- **What the description currently claims.** `lib/mcp/tools/graph.cjs:226-227`: *"Optional CAS token (last_modified_at) from a prior read of source_id; **a lost update is rejected as a conflict instead of silently clobbering**."* A caller supplying a `read_version` and receiving no conflict reasonably concludes the node existed and was unchanged. Neither is guaranteed. **This is a documented false-pass, which is the same disease as F-1 with a smaller blast radius.**
- **Why IN:** it is a one-clause fix inside a file the checker already scans, it needs no behavior change, and Theo's `GRAPH_WRITE_DESCRIPTION` is byte-identical today, so fixing it now means the mirror task is registered before the flip rather than after.
- **Note for the planner:** this lands on the `read_version` **parameter** `.describe()` string, not the tool description. `check-tool-honesty.cjs` reads only the 2nd positional argument to `server.tool(` (`scanAll:1108-1111`) and never inspects parameter describes, so the checker will not verify this fix. It needs its own assertion, and this is itself a small detector-coverage finding worth recording alongside B-1..B-5.

### B3: does the methodology port to Theo's registrars?

**One paragraph, for an out-of-repo SEED recommendation, not a build.**

**Not without structural change, and the gap is bigger than a path swap.** Theo registers through two wrappers over `server.registerTool` - `registerContentTool` (`src/mcp/register-content-tool.ts:135`, with a **required** `description: string` config field at `:106` and `inputSchema: sealed` at `:151-152`) and `registerOperationalTool` - used at **23** call sites in `src/mcp/content/*.ts` and **5** in `src/mcp/operational/*.ts`, confirming the ROADMAP's corrected count of **28**, not "~27". Three structural mismatches follow. **First, discovery:** `findServerToolCalls` matches `/server\.tool\s*\(/` (`check-tool-honesty.cjs:478-490`) and `scanAll` reads four POSITIONAL arguments (`:1106-1113`); Theo's shape is `registerContentTool(server, { name, description, inputSchema }, cb)`, so a direct run scans **zero tools and reports OK** - a false success inside a false-success detector, which is exactly the outcome to warn the Theo side about. **Second, language:** `maskNonCode` (`:170-220`) handles JS strings, comments and regex literals but knows nothing of TypeScript type annotations, generics (`registerContentTool<OutputArgs, InputArgs>`), or `as const`; angle brackets are not in `scanBalanced`'s pair map (`:227`), so generic call sites would confuse the forward scanner. **Third, and most consequential, the write-primitive vocabulary has no analog:** `resolveWritePrimitives` (`:370-409`) derives its names by `require()`ing three CJS modules and reading `module.exports`, which cannot work against TypeScript sources, and Theo's writes go through `delegate.ts` to the plugin's handlers at call time rather than through a local `navigation.cjs`, so the whole depth-1 reachability model would need rebuilding around the delegation boundary. **The honest SEED recommendation is therefore "port the METHODOLOGY, not the script"** - the six-stage architecture, the claim-tier vocabulary with its negation and hyphenated-token guards, the ALLOWED_UNVERIFIED discipline, and above all the fix-the-detector-never-allowlist rule that took the first sweep from 34 to 1. A TypeScript implementation should use the compiler's own AST (`ts.createSourceFile`), which removes stages A through C entirely and would make Theo's version **shorter** than the plugin's, not longer. Cite this phase, note that the plugin's own detector shipped with a dead switch parser (D-1) as the cautionary case for AST-over-regex, and file it via Theo's `/gsd-capture` before `09-12` authorizes the flip.

---

## Updated Phase Requirements (TOOLHON-01..14)

Supersedes the eight-ID table in the first pass. Same minting precedent (PYPORT-/CHOKE-/ANCHOR-): phase-local working IDs, registered to `.planning/REQUIREMENTS.md` at phase close by the final plan.

| ID | Layer | Description |
|----|-------|-------------|
| TOOLHON-01 | Detector | The `switch (command)` branch splitter actually splits branches; `room_state`/`room_content`/`room_graph` report per-command reachability. Proven by a test observed FAILING against the pre-fix script. |
| TOOLHON-02 | L1 | Every finding in the post-fix sweep carries a recorded disposition, verified against a checked-in ledger by re-run output rather than by assertion. |
| TOOLHON-03 | L1 | `orchestration.scout`'s description asserts no write the MCP handler cannot perform; the `scout*` family self-discloses in-band. |
| TOOLHON-04 | L1 | `room_content`'s description names only commands that reach a write; the `new-project`/`setup`/`update` group carries the NOT-EXECUTED banner. |
| TOOLHON-05 | Detector | Every known detector boundary (argument-gated writes, barrel re-exports, subprocess writes, unrecognized dispatch shapes, write-primitive semantics, **parameter-describe strings**) is enumerated in the script header and either asserted or explicitly documented. |
| TOOLHON-06 | Detector | `ALLOWED_UNVERIFIED`'s entry contract is enforced by a test, not by a comment; the MEDIUM/UNKNOWN suppression question is answered explicitly. |
| TOOLHON-07 | L1 | The `meeting` Tri-Polar parity gap has an explicit recorded disposition and the RCA reflects it. |
| TOOLHON-08 | Meta | The ROADMAP's "9 findings" count is reconciled with the measured 10 / post-fix 24. *(The stale `Depends on: Phase 275` line is already corrected by the navigator; verify only.)* |
| **TOOLHON-09** | **L2 (C4)** | The busy timeout is propagated to every read-write opener that can genuinely contend, with the excluded groups (read-only, `:memory:`, non-room.db) named and reasoned in the plan rather than silently skipped. Proven under a held write lock with an elapsed-time floor. |
| **TOOLHON-10** | **L2 (C5)** | `spine-events.cjs`'s `_emit` and `_emitWithOperatorEdge` report a distinct typed reason for a busy or broken room.db instead of `no_room_db`, discriminating on `err.name` first. `getCurrentJTBD`/`getCurrentOperator` are verified for the same swallow. |
| **TOOLHON-11** | **L2 (C5)** | Every production site that produces `no_room_db` is enumerated at run time and either genuinely means it or has been migrated, so the propagation gap cannot silently regrow. |
| **TOOLHON-12** | **Theo** | The five absorbed-tool description constants are diffed against the plugin's, pinned to Theo commit `83a1ce2`, reported as a non-blocking coordination signal that skips when Theo is absent. The one live finding (`gate_render`) has a registered Theo mirror task. |
| **TOOLHON-13** | **Theo / L1** | The three flip-day items get their explicit in/out call: `mode_signals` description (IN), the honest-empty trio (OUT of code fix, IN as a recorded finding), `graph_write`'s CAS fail-open disclosure (IN). |
| **TOOLHON-14** | **L2 (M8 + inherited)** | M8's retry contract is either made true or made honest, with the choice stated. `docs/architecture/SUBSTRATE-BASELINE.md` is regenerated by script rather than hand-corrected, resolving the 195/208/205 three-number drift Phase 273 D-05 deferred here. |

**Recommended wave shape** (the planner owns the final call; this is the dependency reasoning, not a plan):

- **Wave 0** - test scaffolding: `run-all-276.sh`, the RED switch-branch test, the shared held-write-lock helper, the disposition ledger.
- **Wave 1** - TOOLHON-01 (the detector fix). **Everything in Layer 1 depends on this**; triaging before it runs closes the wrong list.
- **Wave 2** - Layer 1 dispositions (TOOLHON-02..07) and Layer 2 (TOOLHON-09..11) in parallel. They touch disjoint files (`lib/mcp/**` vs `lib/core/**`) and share no state.
- **Wave 3** - Theo coordination (TOOLHON-12, TOOLHON-13) plus the tail (TOOLHON-08, TOOLHON-14). TOOLHON-12 must run **after** the `gate_render` description lands, or it diffs against text that is about to change.

---

## Second-Pass Assumptions Log

Appends to the first pass's A1-A7.

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A8 | Group C (read-only opens) is genuinely out of C4 scope because WAL readers never block writers. | C4 census | Low. Grounded in `room-db.cjs:251`'s own statement. If wrong, 9 more sites need the option, which is mechanical. |
| A9 | Re-routing `lazygraph-ops.openGraph` through `openRoomDb` is high-value but high-risk and deserves its own plan. | C4 fix shape | The 38-call-site count and the async/`{db,conn}` shape mismatch are verified; the risk assessment is judgment. **Navigator may prefer option-only everywhere, which is smaller and closes less.** |
| A10 | Zero callers branch on `reason === 'no_room_db'`, so adding new reason values is low-risk. | C5 | Verified by grep across `lib/`, `scripts/`, `bin/`, `hooks/`. A dynamic string comparison or a hook shell script comparing JSON text would evade the grep. |
| A11 | `getCurrentJTBD`/`getCurrentOperator` share the same swallow as `_emit`. | C5 scope | **Not verified.** Their catch bodies were not read this pass. Flagged as a planner task, not asserted. |
| A12 | M8 is best resolved by correcting the comment (Option 1). | M8 | Judgment. The navigator may want a real retry helper. Either satisfies the ROADMAP's demand for a stated call. |
| A13 | The `chain_run` 1113/1006 length delta is real, but the exact divergence offset is not trustworthy from this pass's regex extractor. | Theo B1a | Stated as a caveat, not a finding. The `gate_answer` divergence IS trustworthy (independently confirmed by a zero-count grep for `SOURCED_FROM`). |
| A14 | Theo commit `83a1ce2` is the right pin. | Theo | It is HEAD of the Theo checkout as read on 2026-09-03. Theo is actively developed; re-pin at plan time. |
| A15 | The `mode_signals` mismatch is indirect (the description promises a mode-carrying envelope, not the literal field). | Flip-day (a) | Verified: the string `mode_signals` does not appear in the description at `:151`. This slightly narrows the ROADMAP's claim, which said "the tool description text that promises it." Reported as a correction, not a contradiction. |

---

## Second-Pass Sources

All read or executed 2026-09-03. Additive to the first pass's list.

**Plugin repo:**
- `lib/core/room-db.cjs` (:145-333, the typed errors, `classifyOpenFailure`, the full `openRoomDb` contract)
- `lib/core/navigation/spine-events.cjs` (:100-150, :198-232, :283-330, :431-445)
- `lib/core/navigation/reconcile-guard.cjs` (:37-92)
- `lib/core/graph-refine-loop.cjs` (:29-44, :125-136), `lib/core/graph-derivation.cjs` (:65, :258-272, :499-510)
- `lib/core/lazygraph-ops.cjs` (:422-436), `lib/core/cross-room-store.cjs` (:56-70), `lib/workflow/cross-room-umbilical-closer.cjs` (:75-84), `lib/core/breakthrough/review-queue.cjs` (:62-80)
- `lib/hmi/selector-telemetry.cjs` (:223-237), `lib/hmi/shape-f0-renderer.cjs` (:104-118), `lib/hmi/shape-f6-plan-review-renderer.cjs` (:221-230)
- `lib/core/venture-shape-nudge.cjs` (:82-99), `lib/core/chat-context-builder.cjs` (:126-135), `lib/core/proactive-intelligence.cjs` (:133-142), `lib/core/session-presence.cjs` (:283-292), `lib/core/coverage-rollup.cjs` (:85-94)
- `bin/mindrian-brain-mcp-client.cjs` (:147-215)
- `lib/core/brain-client.cjs` (:1183, :1279, :1415, :2197-2199), `lib/core/opportunity-ops.cjs` (:1352-1375)
- `lib/mcp/tools/graph.cjs` (:141-155, :217-251)
- `docs/architecture/SUBSTRATE-BASELINE.md` (:26, :285, :297, :308, :323)
- `.planning/phases/273-sqlite-graph-chokepoint-hardening-writeedge-silent-failure-a/273-CONTEXT.md` (domain :10-20, D-01..D-05 :45-90, :215), `273-RESEARCH.md` (:23, :57, :70, :418, :766), `deferred-items.md` (full)
- `.planning/ROADMAP.md` Phase 276 as rewritten (:765-830)

**Theo (`/home/jsagi/Theo`, read-only, commit `83a1ce2`):**
- `src/mcp/operational/{room-bind,graph-write,gate-render,gate-answer,chain-run}.ts` (the five `*_DESCRIPTION` constants and surrounding comments)
- `src/mcp/register-content-tool.ts` (:98-152), `src/mcp/register-graph-tool.ts` (:16-56)
- `src/mcp/content/` and `src/mcp/operational/` directory listings and registrar call counts (23 + 5 = 28)

**Skill:**
- `~/.claude/skills/icm-architect/SKILL.md` (ten invariants, six forms, walk test, guardrails, references index)

**Measured runs:**
- `grep -rln "new DatabaseSync(" lib/ scripts/` = 35 files; 32 production sites after excluding `*.test.cjs` and the vendored `sqlite.d.ts`
- `grep -rn "RoomDbBusyError|RoomDbBrokenError"` excluding tests = 2 consumers outside `room-db.cjs`
- `grep -rn "=== 'no_room_db'"` across `lib/ scripts/ bin/ hooks/` = **0 matches**; 27 production sites produce it
- retry-implementation grep (`RoomDbBusyError` filtered by `retry|backoff|sleep|attempt`) = **0 matches**
- patched-checker run intersected with Theo's five absorbed tools = 24 non-OK, exactly 1 on a Theo tool (`gate_render`)
- five-constant byte diff: 3 IDENTICAL, 2 already diverged
- `grep -c "SOURCED_FROM\|USES_FRAMEWORK" Theo/src/mcp/operational/gate-answer.ts` = **0**

**Second-pass confidence:** HIGH for the C4 census, the C5 defect and its two consumers, the M8 zero-implementation finding, the Theo 24-to-5 intersection, and the five-constant diff (all executed). MEDIUM for the C4 fix-shape recommendation (A9, a judgment on risk) and the M8 disposition (A12). The one explicitly unverified item is A11 (`getCurrentJTBD`/`getCurrentOperator`), flagged rather than assumed.
