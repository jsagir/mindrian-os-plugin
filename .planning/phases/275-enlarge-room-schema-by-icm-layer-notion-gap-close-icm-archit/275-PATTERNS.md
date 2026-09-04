# Phase 275: Enlarge Room Schema by ICM Layer - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 9 (files named in CONTEXT.md) + 3 new file classes (L2 CONTEXT.md contracts, L3 references/ folder, migration script)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/core/room-skeleton-scaffold.cjs` (extend `SECTION_NAMES`/`SECTION_METADATA`) | config/scaffold | CRUD (idempotent file-write) | itself, prior extension at Phase 155-05 (`resolveBlueprint`) | exact (same file, same frozen-table-extension move) |
| `lib/core/section-registry.cjs` (promote `opportunity-bank`/`funding` from `EXTENDED_SECTION_META` into `CORE_SECTIONS`) | config/registry | CRUD (lookup table) | itself | exact |
| `data/room-blueprints.json` (retarget dead citations, add `strategy` section to families) | config/data | CRUD (validated JSON) | itself, validated by `scripts/check-room-blueprints.cjs` | exact |
| `data/command-registry.json` (fix `domain-explorer`, `scenario-analysis`, `trending-to-absurd`, `analyze-needs` citations) | config/data | transform (citation correction, not creation) | itself | exact |
| `lib/core/frontmatter-schemas.cjs` (confirm no `value_proposition` field added; document new `STATEMENT`/nested funding+opportunity-bank schema fields if built) | validator/config | request-response (pure validate function) | itself | exact |
| `commands/opportunities.md` | route/command | request-response | `commands/funding.md` (sibling, same pipeline) | exact |
| `commands/funding.md` | route/command | request-response, CRUD (stage machine) | `commands/opportunities.md` | exact |
| `tests/test-blueprint-scaffold.cjs` (extend for 11-section schema) | test | CRUD fixture assertions | itself (Phase 155-05 TDD-RED precedent) | exact |
| `scripts/check-room-blueprints.cjs` (bump `EXPECTED_FAMILY_COUNT`/section-slug set if families change) | utility/CI-check | batch (validate-on-demand) | itself | exact |
| NEW: per-room L3 `references/`or `_shared/` folder | config/reference | file-I/O (static per-room reference data) | icm-architect's `_shared/` convention (`~/.claude/skills/icm-architect/assets/templates/CLAUDE.md`) + this repo's `IDENTITY_DIRECTORIES` table pattern in `room-skeleton-scaffold.cjs` | role-match (icm-architect names the folder; this repo's ROOM.md-per-directory writer is the mechanism to reuse) |
| NEW: per-section `STATEMENT` field (L1) | model/frontmatter | CRUD (frontmatter key) | `ROOM.md.section.tmpl` (`STAGE_RELEVANCE_LIST`/`DEFAULT_METHODOLOGIES_LIST` substitution keys already in that template) | exact (same substitution mechanism, one more key) |
| NEW: per-section `CONTEXT.md` contract file (L2) | config/contract | file-I/O (static, human-authored-once, machine-scaffolded skeleton) | icm-architect's `assets/templates/CONTEXT.md` + `stage-CONTEXT.md` (Inputs/Process/Outputs/Human-check table) | exact (this is literally the reference implementation the seed cites) |
| NEW: migration script for existing rooms (8-section -> 11-section schema, non-frozen `opportunity-bank` slug reconciliation) | migration | batch, idempotent | `scripts/migrate-minto-schema-v88.cjs` | exact |

## Pattern Assignments

### `lib/core/room-skeleton-scaffold.cjs` (config/scaffold, CRUD)

**Analog:** itself — the file already documents its own extension contract.

**The FROZEN TABLE CONTRACT** (lines 350-354):
```javascript
// Phase 155-05: uses sectionList (from blueprintFamily or frozen SECTION_NAMES).
// FROZEN TABLE CONTRACT: SECTION_NAMES + SECTION_METADATA are never modified.
// sectionList is either SECTION_NAMES itself (no-family / unknown-family path)
// or a validated subset of SECTION_NAMES from the blueprint family. Zero
// behavior change for callers that do not pass blueprintFamily.
```
This comment is aspirational, not literal — the table WAS extended once already (Phase 179-04 added the `hypothesis` family; `EXPECTED_FAMILY_COUNT` moved from 8 to 9 per `scripts/check-room-blueprints.cjs` header comment: *"Phase 155-05 froze 8; Phase 179-04 moved it to 9"*). **This is the direct precedent for growing `SECTION_NAMES` 8 -> 11**: the table is "frozen" in the sense of "never silently drift," not "immutable forever" — a deliberate, documented, versioned extension is the established move, not a violation.

**Section entry shape to copy** (lines 36-55):
```javascript
const SECTION_NAMES = Object.freeze([
  'problem-definition', 'market-analysis', 'solution-design', 'business-model',
  'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model',
]);

const SECTION_METADATA = Object.freeze({
  'problem-definition': { purpose: '...', stage_relevance: [...], default_methodologies: [...] },
  // ...
});
```
Add `opportunity-bank`, `funding`, `strategy` following this exact object shape. Note the currently-dead `scenario-analysis` citations in `market-analysis`, `business-model`, `financial-model`'s `default_methodologies` arrays (lines 50, 51, 55) — per CONTEXT.md decision, retarget these to `strategy`'s new `default_methodologies`, do not patch in place.

**Existing silent-skip this phase reverses** (line 240):
```javascript
// Filter out any section slugs that are NOT in the SECTION_NAMES frozen table
// (e.g. "opportunity-bank" is not a scaffold section; skip it silently).
```
This comment and the `frozenSet.has(s)` filter at line 243 are the exact mechanism that currently drops `opportunity-bank` from blueprint families at scaffold time (`data/room-blueprints.json` already lists it in 5 families per CONTEXT.md). Once `opportunity-bank` joins `SECTION_NAMES`, this filter naturally stops dropping it — no filter-logic change needed, only the table growth.

**Template substitution site to extend for L1 `STATEMENT`** (lines 374-380):
```javascript
const sectionSubs = {
  SECTION_NAME: section,
  SECTION_NAME_TITLE_CASE: titleCase,
  SECTION_PURPOSE: meta.purpose,
  STAGE_RELEVANCE_LIST: meta.stage_relevance.map(s => '  - ' + s).join('\n'),
  DEFAULT_METHODOLOGIES_LIST: methodologiesList,
};
const sectionContent = renderTemplate(sectionTpl, sectionSubs);
```
If `STATEMENT` is implemented as a frontmatter key (one of the two Claude's-Discretion options), add a `STATEMENT` key here fed from a new `meta.statement` field in `SECTION_METADATA`, and add the matching `{{STATEMENT}}` placeholder to `templates/room-skeleton/ROOM.md.section.tmpl` (not read in this pass, but its substitution key list is directly enumerable from this call site).

**Error handling / atomic write pattern** (lines 381-386):
```javascript
if (atomicWrite(sectionRoomMd, sectionContent)) {
  result.sections_created.push(section);
} else {
  result.errors.push('section_write_failed:' + section);
}
```
Reuse verbatim for any new L2 `CONTEXT.md`-per-section writer and L3 `references/` writer — same `atomicWrite` + `result.errors.push` shape, same idempotent existence check (`if (!fs.existsSync(...))`) guarding every write in this file (lines 321, 336, 360, 399).

---

### `lib/core/section-registry.cjs` (config/registry, CRUD)

**Analog:** itself.

**Promotion pattern** (lines 15-32):
```javascript
const CORE_SECTIONS = {
  'problem-definition':    { label: 'PROBLEM DEFINITION',    color: '#A63D2F' },
  // ...8 entries...
};

const EXTENDED_SECTION_META = {
  'opportunity-bank': { label: 'OPPORTUNITY BANK', color: '#8B6914' },
  'funding':          { label: 'FUNDING',          color: '#1A5276' },
  'personas':         { label: 'PERSONAS',         color: '#6C3483' },
};
```
`opportunity-bank` and `funding` ALREADY have registered color/label here — this phase's job is moving those two object literals from `EXTENDED_SECTION_META` into `CORE_SECTIONS` (copy-paste, not new authoring) and adding a new `strategy` entry to `CORE_SECTIONS` with a new De Stijl color not already in use (existing palette: `#A63D2F`, `#C8A43C`, `#5C5A56`, `#2D6B4A`, `#B5602A`, `#1E3A6E`, `#6B4E8B`, `#2A6B5E`, `#8B6914`, `#1A5276`, `#6C3483`).

**`STRUCTURAL_DIRS` non-change confirmation** (line 39):
```javascript
const STRUCTURAL_DIRS = ['meetings', 'team'];
```
CONTEXT.md confirms `meetings` needs NO schema change — this line is already correct, cited as evidence, not a file to touch.

---

### `data/room-blueprints.json` (config/data, CRUD validated JSON)

**Analog:** itself, family-entry shape (lines 4-19):
```json
"exploration": {
  "description": "...",
  "arrival_assets": ["domain-or-interest", "cv-upload"],
  "sections": ["problem-definition", "opportunity-bank", "market-analysis", "competitive-analysis"],
  "_sections_note": "domain-decomposition is not a frozen slug; substituted problem-definition... opportunity-bank substituted for the domain-decomposition sub-sections per BIRTH-FLOW-BRIEF.md Section 3.",
  "default_methodologies": ["explore-domains", "beautiful-question", "map-unknowns"]
}
```
This is the exact grain CONTEXT.md's L3 promotion targets: `default_methodologies` at family-grain already lives here, side by side with `_sections_note` explaining substitutions. The new L3 `references/` file must document the reconciliation rule between this family-grain `default_methodologies` and `SECTION_METADATA`'s per-section grain "which wins when they name different methodologies for the same section" — this file's own `_sections_note` convention (a free-text `_`-prefixed explanatory key sitting beside the structured data) is the established way to document exactly that kind of reconciliation note in-place.

Validation gate this must keep green: `scripts/check-room-blueprints.cjs` (see below).

---

### `scripts/check-room-blueprints.cjs` (utility/CI-check, batch)

**Analog:** itself — the versioned-count-bump precedent for `EXPECTED_FAMILY_COUNT` (lines 8-9, 33-44):
```javascript
/*
 * Validates data/room-blueprints.json against three invariants:
 *   (1) exactly EXPECTED_FAMILY_COUNT blueprint families present (no drift, no
 *       extras). Phase 155-05 froze 8; Phase 179-04 moved it to 9 (the
 *       hypothesis Door 3 family).
 */
const EXPECTED_FAMILIES = new Set([
  'exploration', 'solution-first', 'problem-first', 'business-first',
  'portfolio', 'venture', 'program', 'case-study',
  // Phase 179-04: the hypothesis-driven Door 3 family (data, not a frozen-set
  // move per Canon Part 11). LOCKED section set per CONTEXT decision 3.
  'hypothesis',
]);
const EXPECTED_FAMILY_COUNT = 9;
```
```javascript
function loadValidSectionSlugs() {
  try {
    const scaffold = require(SCAFFOLD_PATH);
    if (Array.isArray(scaffold.SECTION_NAMES) && scaffold.SECTION_NAMES.length > 0) {
      return new Set(scaffold.SECTION_NAMES);
    }
  } catch (_e) { /* fallback hardcoded set */ }
```
This is the exact CI seam that will need a comment update mirroring the Phase-179-04 style ("Phase 275 grew SECTION_NAMES 8 -> 11, added opportunity-bank/funding/strategy") if `EXPECTED_FAMILY_COUNT` or the section-slug validation logic needs touching (it likely does not, since it reads `SECTION_NAMES` live via `require()`, not a hardcoded copy — only the fallback hardcoded set, if present further down, needs updating).

---

### `commands/opportunities.md` / `commands/funding.md` (route/command, request-response + CRUD stage machine)

**Analog:** each other — same pipeline, same command frontmatter shape.

**Frontmatter contract** (both files, lines 1-27):
```yaml
---
name: funding
description: Track grant opportunities through their lifecycle
help_jtbd: "See the grants and funding paths matching your room."
argument-hint: "[list|add|update]"
body_shape: B (Semantic Tree)
hitl_shape: "F.8"
hitl_why: "Grant-lifecycle candidates are surfaced as an independent set the navigator triages in any order."
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["prepare-pitch", "decide-pursue"]
teaching: "..."
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-07]
  reach_id: context_block
  sub_mode: funding
  framework: null
  posture: hold
  hierarchy_rank: 37
  filing: none
  plan_gated: false
  web_scope: null
---
```
Any command-file edits (citation retargeting) must preserve this frontmatter block byte-for-byte except the specific fields being changed; `connector.*` fields are governed by Part 11 (born-wired) and should not be hand-edited without `scripts/build-connector-registry.cjs --check` passing.

**Pipeline cross-reference pattern already present** (`commands/funding.md`):
```markdown
### `create [opportunity-slug]`
Promote an opportunity from opportunity-bank to the funding pipeline. Creates a per-opportunity
folder at `room/funding/{slug}/` with initial stage **Discovered**.
...
The funding entry cross-references its source via `[[opportunity-bank/{source}]]` wikilink,
creating a graph edge back to the discovery.
```
This IS the pipeline-relationship documentation CONTEXT.md requires both sections' L2 `CONTEXT.md` to name explicitly — copy this prose's factual content (funding reads from opportunity-bank via `/mos:funding create`, wikilink-based cross-reference) directly into both new `CONTEXT.md` contract files rather than re-deriving it.

**Stage machine to copy into the new L3 nested-schema reference** (`commands/funding.md`, "advance" subcommand):
```
Discovered  -->  Researched  -->  Applying  -->  Submitted
```
"No skipping stages. No going backward. Each transition is recorded in `transition_history`." — this is the exact `Stage` sub-schema CONTEXT.md names (sequential, enforced, no skip/backward). The `Outcome` axis (`awarded`/`rejected`/`withdrawn`) is NOT documented in the command file read here — check `lib/core/` for a funding-outcome writer if the L3 reference needs to cite the enforcement code, not just this prose.

**Opportunity Knight-position sub-schema** (`commands/opportunities.md`):
```
Every opportunity carries a Knight position (risk vs uncertainty vs mixed) and a confidence
score. Risk = known problem with quantifiable odds. Uncertainty = unknown problem requiring
exploration. Mixed = contradiction that could go either way.
```
Copy verbatim into the L3 reference's `opportunity-bank` nested sub-schema section.

---

### NEW: per-section `CONTEXT.md` contract file (L2)

**Analog:** `~/.claude/skills/icm-architect/assets/templates/CONTEXT.md` and `stage-CONTEXT.md` (the exact reference implementation SEED-084 names as the organizing principle).

**Pipeline-level CONTEXT.md shape** (`assets/templates/CONTEXT.md`):
```markdown
# {Workspace name} — the pipeline

The flow in one line: {plan it, make it, check it, ship it — in your workspace's words}.

| Stage | Job | Input | Output | Human check |
|---|---|---|---|---|
| `01_{name}` | {five words} | {what it reads} | `output/{file}` | {what a person verifies} |

Factory (stable, every run): `_shared/{voice.md, rules.md, …}`
Product (new each run): each stage's `output/`
```

**Per-stage/per-section CONTEXT.md shape** (`assets/templates/stage-CONTEXT.md`) — this is the direct analog for a per-section (not per-pipeline) contract file:
```markdown
# {NN}_{stage-name} — {the job in five words}

One job: {the single thing this stage does}.

## Inputs
- Working (this run): ../{prev-stage-folder}/output/{file} — the previous folder's real name
- Reference (every run): ../../_shared/{rules-file}.md
- Reference (every run): references/{stage-specific-guide}.md

Do NOT load: {anything an eager agent would wrongly pull in}.

## Process
1. {Read the inputs.}
2. {Transform, following the reference constraints.}
3. {Hard limits worth restating: length, count, format.}

## Outputs
- {artifact}.md → output/

## Human check
{One concrete act: read it aloud / verify the numbers against X / confirm the order survived.}
```
Map this directly onto CONTEXT.md's L2 spec: "what this section reads, does, writes, and what a human checks" is byte-identical in structure to `## Inputs` / `## Process` / `## Outputs` / `## Human check`. For `opportunity-bank` and `funding`, the "Inputs" section must state the pipeline relationship explicitly (per CONTEXT.md's own instruction), following the exact prose pattern already in `commands/funding.md`'s "create" subcommand section quoted above. For `solution-design`, the "Human check" section must include the moat/defensibility cross-link to `competitive-analysis`, citing `.claude/includes/moat.md`'s doctrine verbatim: *"the graph that knows WHEN to use WHICH prompt... is the moat."*

Do NOT copy the pipeline-numbered-folder mechanics (`01_`, `output/`, `_shared/`) literally — those are icm-architect's generic multi-stage-factory vocabulary; this repo's section folders are not numbered pipeline stages. Adapt only the CONTEXT.md structural shape (Inputs/Process/Outputs/Human-check), not the folder-naming convention.

---

### NEW: per-room L3 `references/`/`_shared/` folder

**Analog:** icm-architect's `_shared/` factory-layer convention (`~/.claude/skills/icm-architect/assets/templates/CLAUDE.md`):
```markdown
## Where things live

| Folder | What it holds |
|---|---|
| `stages/` | the pipeline, in execution order |
| `_shared/` | factory: rules and reference that never change per run |
```
Combined with this repo's own `IDENTITY_DIRECTORIES` writer mechanism in `room-skeleton-scaffold.cjs` (lines 61-67 + the identity-file write loop at lines 393-413) as the concrete implementation pattern:
```javascript
const IDENTITY_DIRECTORIES = Object.freeze({
  'team':         { directory_type: 'team',          purpose: '...' },
  'assets':       { directory_type: 'assets',        purpose: '...' },
  // ...
});
// ...
for (const dirName of Object.keys(IDENTITY_DIRECTORIES)) {
  const dirPath = path.join(roomDir, dirName);
  const identityRoomMd = path.join(dirPath, 'ROOM.md');
  if (!fs.existsSync(identityRoomMd)) { /* render + atomicWrite */ }
}
```
The new `references/` (or `_shared/`) folder should be added as a NEW entry in `IDENTITY_DIRECTORIES` (directory_type: `'references'`, purpose describing it as the L3 venture_stage/default_methodologies/stage_relevance/command-citation store), reusing the exact same write loop — this is a one-line table addition plus one new static content file (the L3 reference JSON/MD itself), not a new writer function.

---

### NEW: migration script for existing rooms (8-section -> 11-section, opportunity-bank slug reconciliation)

**Analog:** `scripts/migrate-minto-schema-v88.cjs` — the strongest available precedent for "backfill a schema change onto existing room content, idempotently."

**CLI/usage contract** (lines 1-40):
```javascript
/*
 * Phase 88-00 Task 2: idempotent migration of existing Phase 81 Feynman-MINTO
 * files to the v88 schema.
 *
 * Backfills five new frontmatter fields on every MINTO.md under a room tree...
 * Files that already have all five fields are detected and skipped; running
 * the script twice on the same room produces byte-identical output. Atomic
 * write (openSync 'wx' tmp + fsync + rename) matches the Phase 87-02 pattern.
 *
 * Usage:
 *   node scripts/migrate-minto-schema-v88.cjs <roomDir> [--dry-run]
 *   node scripts/migrate-minto-schema-v88.cjs --help
 *
 * Exit codes: 0 = success, 1 = usage error, 2 = runtime error.
 */
'use strict';
const argv = process.argv.slice(2);
const DRY_RUN = argv.indexOf('--dry-run') !== -1;
let ROOM_DIR;
if (positional.length >= 1) {
  ROOM_DIR = path.resolve(positional[0]);
} else {
  ROOM_DIR = findRoomRoot(process.cwd()) || process.cwd();
}
```
Copy this shape directly for the Phase 275 migration: `--dry-run` flag, idempotency-by-field-detection ("already migrated" skip check), the `.room-root` walker fallback (`findRoomRoot`), atomic-write reuse, and the same 0/1/2 exit-code convention. The specific migration content differs (adding `opportunity-bank`/`funding`/`strategy` section directories + ROOM.md files to existing rooms, reconciling any room that ALREADY used `opportunity-bank` as an ad-hoc non-frozen slug per CONTEXT.md's Claude's-Discretion item) but the script skeleton, flag surface, and idempotency-detection strategy should be lifted wholesale from this file.

**Idempotency-detection pattern to replicate** — read the `V88_FIELDS` check further in the file (not fully re-read here, but named at line 80: `const V88_FIELDS = [...]`) — the migration checks for presence of ALL target fields before deciding a file needs migration; the Phase 275 migration should do the analogous check (does `room/opportunity-bank/ROOM.md` already exist with the new schema's `section` frontmatter key) before writing.

## Shared Patterns

### Atomic file writes
**Source:** `lib/core/room-skeleton-scaffold.cjs` (`atomicWrite`, referenced throughout; underlying tmp+rename implementation not re-read this pass but its call sites are consistent: `if (atomicWrite(path, content)) { result.X = true } else { result.errors.push('X_failed') }`)
**Apply to:** every new file-writer in this phase (per-section `CONTEXT.md` writer, L3 `references/` writer, `STATEMENT` field writer, migration script)

### Idempotent existence-check-before-write
**Source:** `room-skeleton-scaffold.cjs` lines 321, 336, 360, 399 (`if (!fs.existsSync(targetPath))`)
**Apply to:** all new scaffold writers — never overwrite human-authored content, matching this repo's stated Canon Part 9 "files preserve meaning" invariant (file header comment, lines 9-13).

### Frozen-table extension is versioned, not truly immutable
**Source:** `scripts/check-room-blueprints.cjs` header comment: *"Phase 155-05 froze 8; Phase 179-04 moved it to 9."*
**Apply to:** the `SECTION_NAMES`/`SECTION_METADATA` 8->11 growth and the `EXPECTED_FAMILY_COUNT` bump if new blueprint families are touched — comment style: `// Phase 275: grew SECTION_NAMES 8 -> 11 (opportunity-bank, funding, strategy); see 275-CONTEXT.md`.

### Command-registry citation correctness
**Source:** `data/command-registry.json`'s `produces` field is the ground-truth signal (per CONTEXT.md's canonical_refs) — cross-checked against actual command file behavior (`commands/opportunities.md`'s `trending-to-absurd` producing to `room/opportunity-bank/trending-to-absurd/*`, confirmed live at `data/command-registry.json:1919`).
**Apply to:** the 4 citation fixes (`domain-explorer` removal, `scenario-analysis` retarget, `trending-to-absurd` refile, `analyze-needs` refile) — verify each against `produces` before editing, not against SEED-084's addenda alone (CONTEXT.md explicitly warns SEED-084's tiering may be stale).

### Pipeline cross-reference via wikilink
**Source:** `commands/funding.md`: `[[opportunity-bank/{source}]]` wikilink pattern, graph edge on write.
**Apply to:** any new L2 `CONTEXT.md` documentation of the opportunity-bank -> funding relationship; do not invent new cross-reference syntax.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `templates/room-skeleton/ROOM.md.section.tmpl` (not read this pass, but implicated by the `STATEMENT` substitution-key addition) | template | file-I/O | Not explicitly named in CONTEXT.md's file list but will need a `{{STATEMENT}}` placeholder if the frontmatter-key discretion option is chosen; read it directly at plan time, it is small (verify via `readTemplate('ROOM.md.section.tmpl')` call site at `room-skeleton-scaffold.cjs:355`). |
| Dilutive/equity funding tracking (if built) | model/service | CRUD | Explicitly zero existing code anywhere in this repo per CONTEXT.md's own grep confirmation ("zero hits for equity/VC/loan/crowdfund/angel"); if Claude's Discretion chooses to build it this phase, there is no in-repo analog — would need to mirror the non-dilutive `funding` stage-machine shape from `commands/funding.md` as the closest available shape, not a true analog. |

## Metadata

**Analog search scope:** `lib/core/`, `data/`, `commands/`, `scripts/`, `tests/`, `~/.claude/skills/icm-architect/assets/templates/`
**Files scanned:** `room-skeleton-scaffold.cjs`, `section-registry.cjs`, `frontmatter-schemas.cjs`, `room-blueprints.json`, `command-registry.json` (grep only, targeted), `check-room-blueprints.cjs`, `test-blueprint-scaffold.cjs`, `commands/opportunities.md`, `commands/funding.md`, `migrate-minto-schema-v88.cjs`, icm-architect's `CONTEXT.md`/`stage-CONTEXT.md`/`CLAUDE.md` templates
**Pattern extraction date:** 2026-09-04
