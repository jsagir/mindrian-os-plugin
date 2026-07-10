# Phase 216: Eureka User-Facing Command (eureka-user-command) - Research

**Researched:** 2026-07-10
**Domain:** Command authoring / connector wiring / CIRS + HITL-shape gates / 4-zone UI rendering (pure composition, zero new engine)
**Confidence:** HIGH (everything is in-repo and read end-to-end; the one MEDIUM area is the small-room substrate decision, which is a design choice, not an unknown)

## Summary

This phase wraps the already-shipped Eureka Portfolio-Scale engine (`scripts/eureka-portfolio-report.cjs` + the four `lib/core/eureka/*.cjs` Wave-1 modules on the reused Phase 211 tri-modal spine) as a real `/mos:` command a navigator can type in a normal session against the CURRENT ACTIVE ROOM. There is **no new engine** to build (Canon Part 7). The work is: (1) author `commands/eureka.md` with the exact frontmatter the two born-wired gates demand, (2) author a thin `scripts/eureka-command.cjs` dispatcher that resolves the active room and shells the existing runner (the `commands/whitespace.md` -> `scripts/whitespace-command.cjs` pattern, verbatim), (3) render the runner's JSON output through the 4-zone UI ruling system, (4) add the command to `data/help-groups.json`, `data/hitl-shape-backfill.json`-equivalent declaration (it declares inline), and let the connector + shape + registration + help + skill-mirror gates pass, (5) ship an offline hermetic test on the `run-all-215` pattern.

**The single load-bearing open question** is the pair substrate. The runner's DEFAULT `--pairs graph` mode scores ONLY the cited `CONVERGES` edges of a two-CSV idea-graph JSON (`evals/eureka/jhtv-idea-graph.json`) that a normal room does not have. A normal MindrianOS room has only `room.db` (nodes + typed edges), no CSV-derived idea-graph. Investigated in full (Thing #3): `--pairs full` mode enumerates cross-boundary pairs directly from `room.db` nodes and `techFor()` synthesizes minimal techs, so the runner CAN run on a normal room in full mode - BUT `loadGraph()` still hard-throws on a missing `--graph` file, and the two DISTINCTIVE portfolio features (the weak-signal TAIL and the `validated_demand` dimension) DEGENERATE to nothing because they depend on idea-graph-derived signals (`pair_count`/`edge_count` degree and C-number recency) that a normal room lacks. The tail also needs `MIN_COHORT=30` techs, which a typical small room (tens of nodes) is below, so the tail returns `insufficient_structure` and never fires. The elegant fix is a room-native substrate adapter (pairs from room graph edges, attention = node degree, growth = `created_at` recency), which is composition/adapter code, not a new engine.

**Primary recommendation:** Author `/mos:eureka` as a thin dispatcher over the SHIPPED runner. For v1 on a normal room, run `--pairs full` and add a room-native `loadGraph` fallback (empty-graph tolerance + `created_at`/degree substrate adapter) so the tail and demand axes are meaningful; declare `hitl_shape: F.8` (unordered basket of opportunity candidates, matching `opportunities`/`find-connections`/`whitespace`/`find-analogies`); keep it report-only (no banking) for v1 per Canon Part 9; render through Shape E (Action Report) in the 4-zone anatomy.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists yet (`has_context: false`). The binding constraints come from the phase goal + CLAUDE.md Canon Compliance Core and are treated as locked:

### Locked Decisions (constitutional, from phase goal + CLAUDE.md)
- **Zero new engine (Canon Part 7 - Reuse Before Build).** Search the 25 methodology commands first; justify any surface against them. This is pure wiring/composition.
- **Part 11 (CIRS / Invocation Constitution).** The new command is born WIRED or EXCLUDED; must be enumerable by `scripts/build-connector-registry.cjs`; must carry a declared `hitl_shape` + `hitl_why` checked by `scripts/check-shape-declaration.cjs`.
- **Part 8 (Graph Boundary).** The engine makes zero network calls (except the one-time model-weight fetch by model id, no user bytes). The wrapper MUST NOT introduce egress.
- **Part 9 (Memory Locality).** The engine writes only derived `eureka_*` SQLite tables + report FILES. No room-graph / `memory_event` writes today. Banking accepted Opportunity Statements is a DECISION for discuss-phase (recommend: report-only for v1).
- **UI: the 4-zone ruling system** (`skills/ui-system/SKILL.md`) - Header / Content Body / Intelligence Strip / Action Footer; 12-glyph vocabulary (`■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ →`); **NO EMOJI**; no bespoke selector (fire AskUserQuestion, never draw the box).
- **No em-dashes anywhere; hyphens only. CJS only, no TypeScript. `process.argv` switch-case router, no Commander/yargs.**

### Claude's Discretion (recommend + confirm at discuss-phase)
- Command name (`/mos:eureka` proposed; TBD).
- Small-room pair substrate: full-mode + room-native adapter vs. run the simpler 211 `eureka-room-report.cjs` instead (see Open Questions).
- Whether v1 banks Opportunity Statements (recommend: no).
- `serves_jtbd` tags and help-groups family placement.

### Deferred Ideas (OUT OF SCOPE)
- Banking Opportunity Statements as graph nodes via `navigation.cjs` (a governed Part 9 write path - a later phase's wiring; the runner already leaves the seam read-only).
- DG-1 Burt structural-hole brokerage in the tail (dormant `--brokerage` seam; waits on Phase 212.5).
- Per-tech DEEP FUSION analysis (the report `next_steps` RECOMMEND it, never trigger it - A4 posture).

## Phase Requirements

`.planning/REQUIREMENTS.md` does not exist and the roadmap lists Phase 216 Requirements as **TBD (set by /gsd-plan-phase 216)**. No requirement IDs were provided to this research. The planner should mint the requirement set from the phase goal; the research below maps to the implied requirements (born-wired command, HITL declaration, room-native substrate, 4-zone render, offline test).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve the active room dir | CLI dispatcher (`scripts/eureka-command.cjs`) | `lib/core/resolve-active-room.cjs` / `scripts/resolve-room` | Single resolver already exists; the command must NOT re-guess (SEED-034 four-guessers lesson) |
| Score pairs / rank / tail / statements | Engine (`scripts/eureka-portfolio-report.cjs` + `lib/core/eureka/*`) | - | Shipped, frozen, reused verbatim (Part 7) |
| Pair substrate for a normal room | Dispatcher adapter (new, thin) | `room.db` nodes + edges tables | The idea-graph is a JHU-fixture artifact; a normal room needs a room-native substitute |
| Render results | UI layer (command body prose + Shape E render) | `skills/ui-system/SKILL.md` contract | 4-zone anatomy, no command invents its own format |
| Decision-gate fork (which candidate to act on) | Command frontmatter `hitl_shape: F.8` + AskUserQuestion | `lib/hmi/selector-dispatcher.cjs` | Born-declared shape (R16); fire the card, never draw the box |
| Born-wired enumeration | `commands/eureka.md` `connector:` block | `scripts/build-connector-registry.cjs` | CIRS R1/R2 - born wired or excluded |

## Standard Stack

**No new packages.** This phase installs nothing (Canon Part 7). It reuses only shipped in-repo modules and two already-vendored deps:

### Core (all shipped, reused verbatim)
| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `scripts/eureka-portfolio-report.cjs` | The composed portfolio runner (AHP + 3-dim + tail + Opportunity Statements) | The engine this phase wraps; frozen after Phase 215 |
| `scripts/eureka-room-report.cjs` | The Phase 211 room runner (ranked differential on a normal room.db, NO idea-graph needed) | The already-room-native alternative substrate (see Open Questions) |
| `lib/core/eureka/ahp-weights.cjs` | `loadAhpConfig()`, `composeScore()` - 3x3 Saaty criterion weights + CR gate | Composed by the runner |
| `lib/core/eureka/portfolio-dimensions.cjs` | `scoreTechDimensions`, `scorePairDimensions`, `weakDimensions`, `complementary`, `percentileRank` | Composed by the runner |
| `lib/core/eureka/tail-quadrant.cjs` | `classifyTail()` - low-attention/high-growth quadrant + degeneracy guards | Composed by the runner |
| `lib/core/eureka/opportunity-statement.cjs` | `buildOpportunityStatement()` - canonical statement shape + honest critic gate | Composed by the runner |
| `lib/core/eureka/tri-modal-index.cjs` | `indexNodes`, `nodeText` - FTS5 + sqlite-vec + RRF | The 211 spine |
| `lib/core/eureka/embedding-spine.cjs` | encoder (`MongoDB/mdbr-leaf-ir`, 384-dim) + `encoderProvenance()` | Local embeddings |
| `lib/core/resolve-active-room.cjs` | `resolveActiveRoom()` / `resolveActiveRoomDir()` - the ONE active-room resolver | The single door; do not re-guess |
| `scripts/resolve-room` (bash) | Room path resolver for command bodies (the whitespace pattern) | Keystone script; the pattern every Bash command uses |

### Already-vendored deps (no install)
| Dep | Version | Status | Notes |
|-----|---------|--------|-------|
| `@huggingface/transformers` | ^4.2.0 | PRESENT (vendored in `node_modules/`, gitignored but shipped) | transformers.js; loads `MongoDB/mdbr-leaf-ir` [VERIFIED: `node -e require.resolve` PRESENT] |
| `sqlite-vec` | ^0.1.9 | PRESENT | vec0 vector leg; CJS-cosine fallback if absent [VERIFIED: `require.resolve` PRESENT] |

**Installation:** none. `git grep` confirms both deps already in `package.json` and resolvable.

## Package Legitimacy Audit

**N/A - this phase installs zero external packages** (Canon Part 7, "reuse before build"). No `npm install`, no `pip install`. Every dependency is an in-repo `lib/`/`scripts/` module or an already-vendored dep whose legitimacy was cleared at Phase 211-01's deps-legitimacy gate. slopcheck is therefore not run; there is nothing new to verify.

## Architecture Patterns

### System Architecture Diagram

```
navigator types /mos:eureka [in a normal session, any surface]
        |
        v
commands/eureka.md  (frontmatter: connector born-wired + hitl_shape:F.8 + serves_jtbd + body_shape)
        |  body prose instructs Larry to:
        v
  [1] resolve active room -----> scripts/resolve-room  OR  node lib/core/resolve-active-room.cjs
        |                          (returns ROOM_DIR abs path, exit 1 = no room -> 3-line error)
        v
  [2] node scripts/eureka-command.cjs ROOM_DIR [subcmd]   (NEW thin dispatcher)
        |
        |-- resolve substrate:  room.db has NO idea-graph
        |      |
        |      +-- v1 path: --pairs full  + room-native loadGraph fallback (empty-graph tolerant;
        |      |             attention=node degree, growth=created_at recency)
        |      |
        |      +-- (alt) delegate to scripts/eureka-room-report.cjs (211, already room-native,
        |                 but NO tail / NO AHP 3-dim / NO Opportunity Statements)
        v
  [3] scripts/eureka-portfolio-report.cjs main()   (SHIPPED, frozen, Part 7 reuse)
        |    openRoomDb -> tri-modal indexNodes -> loadIndexVectors -> enumerate pairs
        |    -> scoreMeasured -> AHP composeScore -> classifyTail -> buildOpportunityStatement
        |    writes: derived eureka_* tables (Part 9) + <out>.md + <out>.json (report FILES only)
        v
  [4] read the JSON sibling -> render through skills/ui-system 4-zone Shape E:
        Zone 1 Header (room/section/stage) | Zone 2 ranked table + tail + statements
        Zone 3 Intelligence Strip (max 3 HIGH/MED signals) | Zone 4 Action Footer (2-3 /mos: cmds)
        |
        v
  [5] at the close, IF a genuine fork (act on a candidate?) -> FIRE AskUserQuestion (F.8),
        never draw the box.  Report-only for v1: no graph writes.
```

Data flow only; file-to-responsibility mapping is the Component Responsibilities table above.

### Recommended Project Structure (files this phase touches)
```
commands/
  eureka.md                         # NEW - the born-wired command surface
scripts/
  eureka-command.cjs                # NEW - thin dispatcher: resolve room -> run engine -> shape JSON
  eureka-portfolio-report.cjs       # REUSED (may need a small room-native loadGraph fallback)
skills/
  eureka/SKILL.md                   # GENERATED by build-skill-mirrors.cjs --write (byte-mirror)
data/
  help-groups.json                  # EDIT - add /mos:eureka to one of the 11 families
  connector-registry.json           # REGENERATED by build-connector-registry.cjs
tests/
  test-216-eureka-command.cjs       # NEW - offline hermetic e2e (fixture room, stub encoder)
  run-all-216.sh                    # NEW - the phase gate aggregator (run-all-215 pattern)
```

### Pattern 1: Command -> resolve-room -> CJS dispatcher (the whitespace pattern, verbatim)
**What:** A Bash-tooled command body resolves ROOM_DIR then shells a `scripts/<name>-command.cjs`.
**When to use:** Any command that runs a script against the active room.
**Example (from `commands/whitespace.md`, the closest structural analog):**
```
# resolve the room dir
bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-room"     # -> ROOM_DIR on stdout, exit 1 = no room
# run the dispatcher
node "${CLAUDE_PLUGIN_ROOT}/scripts/whitespace-command.cjs" ROOM_DIR map
# (fall back to ./scripts/... when CLAUDE_PLUGIN_ROOT is unset)
```
The runner's `--db` flag takes exactly a room DIRECTORY (it appends `/.mindrian/room.db` internally), which is what `resolve-room` / `resolveActiveRoomDir()` return. No adaptation needed there.

### Pattern 2: The minimal correct born-wired + shape-declared frontmatter
**What:** The exact fields the two gates (`build-connector-registry.cjs --check` and `check-shape-declaration.cjs --check`) require. Distilled from `opportunities.md`, `find-connections.md`, `whitespace.md`, `find-analogies.md`.
**Example (recommended `commands/eureka.md` frontmatter):**
```yaml
---
name: eureka
description: Surface cross-domain opportunity candidates from your room at portfolio scale
help_jtbd: "Rank cross-domain opportunity pairs and surface the weak-signal tail."   # REQUIRED (help-coverage gate)
body_shape: E (Action Report)                # LAYOUT axis (orthogonal to hitl_shape)
hitl_shape: "F.8"                            # SELECTOR axis - unordered basket (R16 gate)
hitl_why: "Ranked opportunity candidates are surfaced as an independent any-order set to review and act on in any order."
serves_jtbd: ["connect-domains", "explore"]  # from the 13-entry taxonomy (see below)
teaching: "When you want to see where your room's ideas cross-pollinate into fundable opportunities, /mos:eureka ranks cross-domain pairs and flags the weak-signal tail the top-N sort buries."
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion            # REQUIRED when hitl_shape is set + allowed-tools is restrictive (predicate 8)
# --- connector frontmatter (born-wired, CIRS R1) ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]   # SENS-06 = whitespace/gap sensor family; pick per sensor doctrine
  reach_id: context_block      # MUST be one of the 6 frozen: context_block|contradiction|cross_room|brain_consult|deep_research|hats
  sub_mode: eureka-portfolio   # MUST be UNIQUE across (sensor, reach_id, sub_mode) - "eureka-portfolio" is free (verified)
  framework: null              # null OR a name in data/framework-names.json - do NOT invent a framework
  posture: hold                # one of the 3 frozen: push_forward|hold|pull_back
  hierarchy_rank: 3
  filing: none                 # report-only v1 (no banking); "fileEvidenceWithReadback" if v1 banks
  plan_gated: false
  web_scope: null
  surface: F.1
---
```
Plus the body MUST contain the canonical `<!-- mos:firing-block v2 -->` stamp OR literally mention `AskUserQuestion` (predicate 7, `check-shape-declaration.cjs`). All four analog commands carry the v2 firing block verbatim - copy it.

### Anti-Patterns to Avoid
- **Re-guessing the active room.** Do NOT write a fifth room resolver. Use `scripts/resolve-room` or `resolveActiveRoomDir()`. (SEED-034 lesson, cited in `resolve-active-room.cjs`.)
- **Drawing the selector as an ASCII box.** No `■ ... [1][2][3]` block. Fire AskUserQuestion or fall through to prose (SEED-021 / R15 render coverage).
- **Inventing a 7th `reach_id` or a framework name.** `reach_id` is a closed 6-set; `framework` must resolve through `commandsForFramework()` or be `null`.
- **Hardcoding the surface count / family counts.** Both gates enumerate from disk; help-groups is read at run time.
- **Emitting the report with the JHU idea-graph default.** `DEFAULT_GRAPH='evals/eureka/jhtv-idea-graph.json'` is a fixture; the command must NOT default to it on a user's machine (it may not exist, and it is someone else's data).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active-room resolution | A new registry parser | `resolve-active-room.cjs` / `scripts/resolve-room` | Four-guessers incident; one door only |
| Pair scoring / ranking / tail / statements | Any new scoring math | `scripts/eureka-portfolio-report.cjs` main() | The whole engine ships; Part 7 |
| Selector / decision gate | A bespoke numbered menu | AskUserQuestion via the firing block | SEED-021; the box without the card is a render-coverage violation |
| Frontmatter parsing for the gates | A YAML lib | (nothing - the gates parse it) | Just author correct frontmatter; the gates use their own subset parser |
| Skill mirror | A hand-written `skills/eureka/SKILL.md` | `node scripts/build-skill-mirrors.cjs --write` | Byte-mirror generator; a hand mirror drifts |
| Report rendering primitives | A new table/box renderer | `skills/ui-system/SKILL.md` Shape E contract | No command invents its own format |

**Key insight:** This phase is 90% authoring correct frontmatter + a ~100-line dispatcher that resolves the room and shells an existing binary. The temptation to "improve" the engine or the substrate is the trap - the only genuinely new code is the room-native substrate adapter, and even that should live in the dispatcher/runner as a thin fallback, not a new module.

## Runtime State Inventory

This is a greenfield command-addition, not a rename/refactor. The relevant "state" is what a NORMAL room already carries that the engine can consume:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `room.db` at `<ROOM_DIR>/.mindrian/room.db`; `nodes(id,type,properties,source_path,created_by,created_at,last_seen_at)` + `edges(source,target,type,properties)` [VERIFIED: `phase-160-nodes-bitemporal.test.cjs` schema + `test-215-portfolio-report.cjs` INSERT]. The engine writes derived `eureka_*` tables here (Part 9 clean). | Dispatcher opens via `openRoomDb`; a room-native substrate reads `edges` (pairs/degree) + `nodes.created_at` (recency) |
| Live service config | None - fully local, no external service | None |
| OS-registered state | None | None |
| Secrets/env vars | `MINDRIAN_ROOMS_HOME`, `CLAUDE_ACTIVE_ROOM`, `CLAUDE_PLUGIN_ROOT`, `MINDRIAN_EMBED_BATCH` (default 32), `MINDRIAN_EMBED_DIM`/`MINDRIAN_EMBED_MODEL` (optional) | Dispatcher must honor `CLAUDE_PLUGIN_ROOT` for absolute paths (whitespace pattern) |
| Build artifacts | The vendored `node_modules/@huggingface/transformers` (gitignored, shipped); the `MongoDB/mdbr-leaf-ir` model weights cached after first run | First run fetches weights by model id (Part 8 clean); offline -> `encoder_unavailable` graceful degrade or `--offline` stub |

**Nothing found** in "Live service config" and "OS-registered state" - verified: the engine header explicitly states zero network / zero sockets, and the runner writes only local tables + files.

## Common Pitfalls

### Pitfall 1: The default graph substrate is empty on a normal room
**What goes wrong:** `--pairs graph` (the default, and Phase 215's navigator-confirmed CANONICAL acceptance substrate) scores only `CONVERGES` edges loaded from the idea-graph JSON. A normal room has no idea-graph, so `convergesPairs=[]` -> zero pairs -> an empty ranked list + empty statements. The command "works" but shows nothing.
**Why it happens:** The runner was built and accepted against the 2117-node JHU tech-portfolio fixture, whose substrate is a two-CSV idea-graph. `loadGraph()` at `scripts/eureka-portfolio-report.cjs:220` does `fs.readFileSync(graphPath)` and hard-throws if the file is absent.
**How to avoid:** Default the command to `--pairs full` (enumerates room-node cross-boundary pairs directly) AND make `loadGraph` tolerate an absent `--graph` (return empty `techMap`/`convergesPairs`) OR pass a synthesized room-native graph. Never point `--graph` at the JHU fixture.
**Warning signs:** Report shows `CONVERGES pairs loaded: 0`, `Pairs scored: 0`, `_No ranked pairs..._`.

### Pitfall 2: The weak-signal tail silently never fires on a small room
**What goes wrong:** The TAIL (the distinctive "gem nobody's watching" feature, the whole point of Phase 215) requires `MIN_COHORT=30` techs [VERIFIED: `tail-quadrant.cjs:58`]. A typical user room has tens of nodes. Below 30 -> `insufficient_structure: true` -> no tail, ever.
**Why it happens:** Portfolio-scale thresholds calibrated for 2117 techs, applied unchanged to a small room.
**How to avoid:** Two levers, both opts-overridable in `classifyTail(items, {minCohort, attnQ, growthQ, maxTailFraction})`: (a) lower `minCohort` for room scale, and (b) supply real attention/growth axes. For a normal room, `pair_count`/`cnumber` are absent, so `attention` and `growth` both degenerate to 0-percentile - the tail is meaningless even above 30. Substitute `attention = room-graph node degree` and `growth = created_at recency percentile`. This is the room-native substrate adapter. Flag any threshold change as UNCALIBRATED (202-APO tunes later) per the runner's own caveat block.
**Warning signs:** `Tail insufficient_structure: true` on every run; `validated_demand` column all `0.50` (the degenerate percentile tie).

### Pitfall 3: The shape-declaration and connector gates fail closed under `--strict`
**What goes wrong:** A new command with a missing/invalid `hitl_shape`, a non-vocabulary reach_id, a colliding `(sensor,reach_id,sub_mode)` tuple, or a restrictive `allowed-tools` that omits `AskUserQuestion` trips the gates. As of Phase 210 the shape gate is ADVISORY by default (WARN, exit 0), but `--strict` (and the connector gate always) hard-fails; release runs both.
**Why it happens:** The frontmatter is the contract; the gates parse a YAML subset and validate every field.
**How to avoid:** Copy the analog frontmatter exactly (Pattern 2). Verify `sub_mode: eureka-portfolio` is unique [VERIFIED: not in the current sub_mode list]. Include `AskUserQuestion` in `allowed-tools`. Run `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --check --strict` before declaring done.
**Warning signs:** `SHAPE DECLARATION VIOLATION` or a stale/duplicate-tuple error from the connector `--check`.

### Pitfall 4: Forgetting the skill mirror + help-groups + registration
**What goes wrong:** The command registers on macOS/Linux (host auto-discovers `commands/*.md`) but is invisible on the confirmed-affected Windows host unless a `skills/eureka/SKILL.md` mirror exists; and it fails the help-coverage gate if not in `data/help-groups.json`.
**Why it happens:** Four independent gates read `commands/*.md`: registration check, connector registry, help coverage, and the skill-mirror generator.
**How to avoid:** After authoring `commands/eureka.md`, run `node scripts/build-skill-mirrors.cjs --write` (mirror), add the command to one family in `data/help-groups.json`, and ensure `help_jtbd:` is present (help-coverage gate rule (a)). Run `node lib/core/command-registration-check.cjs` (no unbalanced fence, no tab in frontmatter, lowercase-hyphen name).
**Warning signs:** `missing_from_groups`, `missing_description`/`missing help_jtbd`, or a stale skill-mirror `--check` failure at release.

### Pitfall 5: Runtime cost mis fine on small rooms but the encoder can be cold
**What goes wrong:** `--pairs full` is O(n^2). On the 2117-node JHU room full mode took ~25.5 min / 2.07M pairs. A normal room (tens to low hundreds of nodes) yields hundreds to ~10k pairs = seconds. The real latency risk is the FIRST run's one-time model-weight download (`MongoDB/mdbr-leaf-ir`) and cold ONNX load.
**Why it happens:** Pair count is quadratic in node count; the encoder fetches weights on first use.
**How to avoid:** Full mode is the right default at room scale (graph mode has no substrate). Surface a "first run downloads the local model once" notice; on `encoder_unavailable`, degrade to the honest empty report (the runner already does this) or `--offline` structural smoke mode. Add a progress note for rooms with hundreds of nodes.
**Warning signs:** A multi-second stall on first invocation; `encoder_unavailable` in provenance when offline.

## Code Examples

### The runner's CLI contract (what the dispatcher shells)
```bash
# Source: scripts/eureka-portfolio-report.cjs parseArgv() + HELP (lines 92-141)
node scripts/eureka-portfolio-report.cjs \
  --db <ROOM_DIR> \          # room directory -> <ROOM_DIR>/.mindrian/room.db   [default: room]
  --graph <path> \           # cited idea-graph JSON  [default: evals/eureka/jhtv-idea-graph.json <- DO NOT use on a user room]
  --pairs full \             # graph = cited CONVERGES substrate (default); full = 211 cross-boundary over ALL room nodes
  --top 25 \                 # keep top N ranked pairs
  --out <md> --json <json>   # markdown report + JSON sibling (render the JSON)
# exit 0 on success (prints a one-line summary), exit 1 on failure (stderr, single line)
```

### The room-native substrate signals available without an idea-graph
```javascript
// Source: schema from lib/core/migrations/phase-160-nodes-bitemporal.test.cjs
//   nodes(id, type, properties, source_path, created_by, created_at, last_seen_at)
//   edges(source, target, type, properties)
// A room-native loadGraph() substitute can derive:
//   pairs      = SELECT source,target,type FROM edges  (the room's own typed edges, the "cited" substrate)
//   attention  = degree per node = COUNT(*) over edges where node is source|target   (replaces pair_count)
//   growth     = created_at recency percentile                                       (replaces cnumber)
// Feed these into the SAME classifyTail(items,{minCohort,...}) and percentileRank the engine already uses.
```

### The 4-zone render contract the output must follow
```
# Source: skills/ui-system/SKILL.md (Sections 1-3)
Zone 1 Header:   -- <RoomName> -- <section> -- <Stage> --
Zone 2 Body:     Shape E (Action Report): ranked pairs table, then Tail quadrant, then Opportunity Statements
Zone 3 Signals:  max 3 HIGH/MED from room-proactive (omit if none)
Zone 4 Footer:   NEVER omitted; 2-3 grounded /mos: commands, exactly one primary (▶)
Glyphs: only the 12.  NO EMOJI.  Colors: red=error yellow=warn cyan=cmd green=ok gray=meta.
At a genuine fork: FIRE AskUserQuestion (F.8), never render the box.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Developer runs `scripts/eureka-portfolio-report.cjs` by hand with flags | A `/mos:` command a navigator types against the active room | This phase (216) | The whole point |
| Default encoder `Xenova/all-MiniLM-L6-v2` | `MongoDB/mdbr-leaf-ir` (384-dim, Apache) | quick(260706-13z) | Higher-quality embeddings; dim is 384 not 768 |
| Shape gate hard-fails | ADVISORY (WARN) by default; `--strict` restores hard-fail | Phase 210-02 | New command won't block commit on a shape warning, but release `--strict` still can |
| Graph-pairs was one of two candidate acceptance substrates | Graph-pairs is the CANONICAL acceptance substrate; full-catalog is a supplementary non-gating sweep | Phase 215-05 (DG-2 navigator call) | For a NORMAL room the canonical substrate is empty - this is the phase's core tension |

**Deprecated/outdated:** none relevant. The engine is fresh (Phase 215 completed 2026-07-10).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `serves_jtbd: ["connect-domains","explore"]` is the right JTBD tagging | Pattern 2 | Low - help/routing only; discuss-phase can retag |
| A2 | `reach_id: context_block` + `sub_mode: eureka-portfolio` + `SENS-06` is a valid, collision-free connector tuple | Pattern 2 | Medium - a tuple collision fails the connector gate; sub_mode verified free, but the (sensor,reach_id,sub_mode) triple must be re-checked at author time |
| A3 | `F.8` is the correct HITL shape (unordered basket of candidates) | Summary / Pattern 2 | Low - all four analog discovery commands use F.8; strong precedent |
| A4 | Report-only (no banking) is the right v1 posture | User Constraints | Low - matches the engine's current read-only Part 9 posture; a discuss-phase decision |
| A5 | `--pairs full` + a room-native adapter is the right small-room substrate (vs. delegating to `eureka-room-report.cjs`) | Open Questions | HIGH - this is THE design decision; see Q1 |
| A6 | `help-groups` family = `run-a-methodology` or `intelligence-research` | Open Questions | Low - cosmetic grouping |
| A7 | The vendored encoder will load on a fresh user machine after a one-time weight fetch | Environment Availability | Medium - offline users get the graceful `encoder_unavailable` empty report, not a crash |

## Open Questions

1. **Which pair substrate for a normal room? (THE decision.)**
   - What we know: `--pairs graph` (the canonical acceptance substrate) is EMPTY without an idea-graph. `--pairs full` runs room-native but `loadGraph` throws on a missing `--graph`, and the tail + `validated_demand` degenerate. The Phase 211 `eureka-room-report.cjs` is ALREADY room-native (no idea-graph) but produces only a ranked differential - NO AHP 3-dim, NO tail, NO Opportunity Statements.
   - What's unclear: whether v1 should (a) run the 215 portfolio runner in full mode with a room-native `loadGraph` fallback + degree/recency substrate adapter (full features, small new adapter), or (b) delegate to the simpler 211 runner (zero new code, but loses the Opportunity Statements + tail the phase goal explicitly wants), or (c) both - 211 for tiny rooms, 215 full-mode for larger.
   - Recommendation: (a) - add a thin room-native substrate to keep the Opportunity Statements + tail (the distinctive value), and lower/parameterize `MIN_COHORT` with an honest "uncalibrated" caveat. Escalate to discuss-phase as a locked decision.

2. **Does `loadGraph` get a missing-file guard, or does the command write a synthesized graph JSON?**
   - What we know: `loadGraph` hard-throws on a missing file. A minimal change (return empty `{techMap,convergesPairs}` when the path is absent) unblocks full mode.
   - Recommendation: add the guard in `eureka-portfolio-report.cjs` (a 3-line change, still "no new engine") rather than writing a throwaway graph file per run.

3. **Command name.** `/mos:eureka` proposed. Confirm at discuss-phase (the roadmap says name TBD).

4. **Banking (Part 9).** Report-only for v1 is recommended; if banking is wanted, it needs a governed `navigation.cjs` writeEdge path + an F.0 per-statement gate - a larger surface, likely its own phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@huggingface/transformers` | live encoder | ✓ (vendored) | ^4.2.0 | `--offline` stub encoder (structural smoke only) OR `encoder_unavailable` empty report |
| `sqlite-vec` | dense vector leg | ✓ | ^0.1.9 | CJS-cosine fallback (the runner's `vec_backend` handles this) |
| `MongoDB/mdbr-leaf-ir` model weights | live embeddings | ✗ until first fetch | 384-dim | one-time download by model id (Part 8 clean); if truly offline -> graceful degrade |
| `node >= 22.5.0` | CJS shared core | assumed ✓ | - | - |
| `python3` | `scripts/resolve-room` strategy 0 | assumed ✓ | - | `resolveActiveRoomDir()` node path works without python3 |

**Missing dependencies with no fallback:** none - every gap degrades gracefully.
**Missing dependencies with fallback:** the model weights (first-run fetch, then cached; offline -> honest empty report).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain-node assertion scripts (`node tests/test-*.cjs`, hand-rolled `ok()` PASS/FAIL counters) + bash aggregators (`tests/run-all-<phase>.sh`). NO jest/vitest. |
| Config file | none - convention-based (`tests/run-all-<N>.sh`) |
| Quick run command | `node tests/test-216-eureka-command.cjs` |
| Full suite command | `bash tests/run-all-216.sh` |

### Phase Requirements -> Test Map
| Req (implied) | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Command born-wired | connector registry regenerates clean with `/mos:eureka` | gate | `node scripts/build-connector-registry.cjs --check` | ✅ exists |
| Shape declared | `hitl_shape` valid + body wired | gate | `node scripts/check-shape-declaration.cjs --check --strict` | ✅ exists |
| Registers as a command | no fence/tab/name faults | gate | `node lib/core/command-registration-check.cjs` | ✅ exists |
| Help coverage | in a family + has help_jtbd | gate | `node scripts/check-help-coverage.cjs` | ✅ exists |
| Skill mirror in sync | byte-mirror current | gate | `node scripts/build-skill-mirrors.cjs --check` | ✅ exists |
| Render coverage | card-emission routes the single door | gate | `node scripts/check-render-coverage.cjs` | ✅ exists |
| Dispatcher runs offline on a fixture room | resolve -> run -> JSON, zero network | e2e | `node tests/test-216-eureka-command.cjs` | ❌ Wave 0 |
| Engine unregressed | 215/211 still green | regression | `bash tests/run-all-215.sh && bash tests/run-all-211.sh` | ✅ exists |

### Sampling Rate
- **Per task commit:** `node tests/test-216-eureka-command.cjs`
- **Per wave merge:** `bash tests/run-all-216.sh` + the six gate `--check`s
- **Phase gate:** all gates green + `run-all-215`/`run-all-211` unregressed + navigator spot-check of a real-room `/mos:eureka` run (the 215-style human-verify leg)

### Wave 0 Gaps
- [ ] `tests/test-216-eureka-command.cjs` - hermetic e2e: build a fixture room (the `test-215-portfolio-report.cjs` `makeFixtureRoom` pattern: `openRoomDb`, INSERT nodes, stub encoder via `tests/eureka-offline-preload.cjs`), run the dispatcher, assert the JSON shape + a rendered 4-zone body. Zero network.
- [ ] `tests/run-all-216.sh` - the aggregator (copy `run-all-215.sh` structure: `NODE_OPTIONS --require tests/eureka-offline-preload.cjs`, `run`/`run_if` legs).
- [ ] No framework install needed (convention-based node scripts).

## Security Domain

The one binding security concern here is Canon Part 8 (Graph Boundary) - a constitutional egress rule, not a generic web-app threat model.

### Applicable controls

| Concern | Applies | Standard Control |
|---------|---------|-----------------|
| V5 Input validation | yes (light) | The dispatcher takes ROOM_DIR + subcommand only; `resolveActiveRoom` never throws and rejects sealed/archived/missing rooms |
| V6 Cryptography | no | none |
| Egress boundary (Part 8) | yes (PRIMARY) | The wrapper MUST add zero network calls. The engine is already egress-free except the one-time model-weight fetch by model id (no user bytes). Verify the dispatcher contains no URL/socket. |
| Memory locality (Part 9) | yes | v1 writes only derived `eureka_*` tables + report files; NO `nodes`/`edges`/`memory_event` writes without a governed `navigation.cjs` path |

### Threat patterns for this surface
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Wrapper leaks room content to a network judge | Information disclosure | No network in the dispatcher; real-room verification is the HUMAN spot-check, never a remote judge (the 215 rule, restated) |
| Command writes to the room graph unexpectedly | Tampering | Report-only v1; banking is an explicit deferred, gated decision |
| Pointing `--graph` at another room's fixture data | Information disclosure | Never default to `evals/eureka/jhtv-idea-graph.json` on a user machine; use the room-native substrate |

## Sources

### Primary (HIGH confidence - read end to end this session)
- `scripts/eureka-portfolio-report.cjs` - full CLI contract, `loadGraph`, `catalogId`, `techFor`, full/graph pair modes, provenance
- `scripts/eureka-room-report.cjs` (header) - the already-room-native 211 runner
- `scripts/check-shape-declaration.cjs` - the R16 gate predicates (1-9), the closed F.0-F.9 vocabulary, advisory-vs-strict
- `scripts/build-connector-registry.cjs` - the born-wired gate, the 11 connector keys, frozen REACH_IDS/POSTURE_IDS, `(sensor,reach_id,sub_mode)` uniqueness
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` - Form A/B, the closed vocabulary + decision rule
- `skills/ui-system/SKILL.md` - 4-zone anatomy, Shape A-F, 12 glyphs, no-emoji, fire-the-card rule
- `commands/opportunities.md`, `commands/find-connections.md`, `commands/find-analogies.md`, `commands/whitespace.md` - the frontmatter analogs + the resolve-room -> `<name>-command.cjs` pattern
- `lib/core/resolve-active-room.cjs` - the single active-room resolver
- `lib/core/eureka/tail-quadrant.cjs` - `MIN_COHORT=30`, `ATTN_Q=0.25`, `GROWTH_Q=0.75`, `MAX_TAIL_FRACTION=0.25`, opts-overridable
- `tests/run-all-215.sh`, `tests/test-215-portfolio-report.cjs` - the offline hermetic test pattern + fixture-room builder
- `.planning/phases/215-.../215-05-SUMMARY.md` - DG-1/DG-2 verdicts, graph-mode canonical, the join/field-contract bugs
- `.planning/ROADMAP.md` (Phase 211/215/216 sections)
- Verified via tooling: `sub_mode` collision scan, `require.resolve` for both deps, `REACH_IDS`/`POSTURE_IDS`, `serves_jtbd` frequency, `help-groups.json` families, room.db schema

### Secondary (MEDIUM confidence)
- `lib/core/eureka/ahp-weights.cjs`, `portfolio-dimensions.cjs`, `opportunity-statement.cjs` - contracts inferred from the runner's composition calls (read via the runner, not line-by-line)
- `scripts/build-skill-mirrors.cjs`, `lib/core/command-registration-check.cjs`, `scripts/check-render-coverage.cjs` (headers) - gate semantics

### Tertiary (LOW confidence)
- none - this phase is fully in-repo; no web sources needed.

## Metadata

**Confidence breakdown:**
- Standard stack / reuse: HIGH - every module read or verified in-repo; zero new deps
- Frontmatter / gates: HIGH - all four gate scripts read in full; frontmatter distilled from four analogs
- Substrate decision: MEDIUM - the mechanism is fully understood (full mode works, tail degenerates); the CHOICE between adapter vs. 211-delegate is a design call for discuss-phase
- Pitfalls: HIGH - grounded in the runner code + the 215-05 SUMMARY's own scale findings

**Research date:** 2026-07-10
**Valid until:** ~2026-08-10 (30 days; stable in-repo engine, but re-verify the `sub_mode`/connector-tuple freedom and the shape-gate posture at author time - other phases may land commands meanwhile)
