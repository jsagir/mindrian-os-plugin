# Phase 370: Review contract for /mos:grade and /mos:deep-grade - Research

**Researched:** 2026-11-08
**Domain:** Output contract plus deterministic code check for written student- and faculty-facing reviews (markdown artifacts), inside the existing plugin (CJS core, hooks, MCP filing door, doctor gate).
**Confidence:** HIGH for repo facts (file:line read in this session); MEDIUM for the recommended design; LOW for anything about what Brain/Theo returns (no Brain call was made, by order).

No Brain call, no Theo call, no network was used. Every fact below comes from repo files read in this session or from commands run in the worktree `/home/jsagi/dev/MindrianOS-Plugin-release` (HEAD `62e2a4ec9`, branch `main`).

<user_constraints>
## User Constraints

No `370-CONTEXT.md` exists (`ls` of the phase dir shows only `370-INPUT.md`). The locked inputs below are copied from the Phase 370 entry in `.planning/ROADMAP.md` (line 1992 onward), `370-INPUT.md`, and SEED-102. Treat them as locked (navigator ruling 2026-10-01 relayed by the Theo session; promotion 2026-10-02).

### Locked Decisions (verbatim from ROADMAP Phase 370 Goal and Deliverables)
- Goal: "Every student- or faculty-facing review the plugin writes has one fixed shape and zero internal vocabulary, and a code check (never a model judgment) fails the output when the reader-facing body carries an internal name."
- Shape, in order: Executive Summary; Reality Check; Faculty Questions (challenge questions); Expert Conversations (practitioner pushback); Research Validation + Reframe; Strategic Challenge (one consolidated big question plus reflection questions); cross-domain ideas at most 2, extras under an optional "For advanced students" note.
- "Never a tool-analysis or methodology-score-by-tool section; never 'improvement recommendations mapped to agents'."
- "Methods named only as taught in the course (Meadows' leverage points, causal loops, stocks and flows); any other term defined in-line in plain words or cut."
- "Executive summary first, then 3 to 5 key revision points; bullets and bold for takeaways."
- Deliverable 1: the contract as data in the existing grading reference home (reuse before build, Canon Part 7), read by `commands/grade.md`, `commands/deep-grade.md` and `agents/grading.md`.
- Deliverable 2: the denylist check beside the existing output lints, never a second linter framework, applied to the reader-facing BODY only (frontmatter and provenance keep handles), failing the output on any `*Agent` class name, MCP, Neo4j, Brain, `/mos:`, Theo, graph or database names.
- Deliverable 3: Tri-Polar. The contract and the check hold on CLI, Desktop and Cowork outputs alike.
- Deliverable 4: no real student names in the repo; fixtures use pseudonyms.
- Deliverable 5: acceptance rubric is the Lawrence review standard (short, executive summary first, taught terms only, no tool or agent names, no tool-analysis section); one before/after fixture review passes it, and the pre-fix fixture fails the check.

### Claude's Discretion
- Everything the ROADMAP leaves open: module name and location, contract file format, hook point(s), doctor severity, fixture design, test layout. Research recommends below; items needing the owner are in "Open Questions".

### Deferred Ideas (OUT OF SCOPE)
- Academy feedback (MindrianV2) and Theo MOS-LEARNING docs: "separate tracks, not this phase" (ROADMAP line for Phase 370 Depends-on; 370-INPUT.md).
</user_constraints>

<phase_requirements>
## Phase Requirements

ROADMAP says "Requirements: TBD (minted at plan time)". No IDs were supplied. Working names for the planner to mint (precedent: Phase 270 MEMOP-xx minted at plan time):

| Working ID | Description | Research Support |
|----|-------------|------------------|
| RC-01 | Contract as data (shape, forbidden sections, term classes, limits) in one file | Standard Stack, Pattern 1 |
| RC-02 | Fixed-shape render in grade, deep-grade and the grading agent | Leak Sources, Pattern 2 |
| RC-03 | Code check: denylist generated from disk, body only | Pattern 3, Denylist |
| RC-04 | Hook points: MCP filing door, CLI write hook, doctor gate | Hook Points |
| RC-05 | Tri-Polar parity | Tri-Polar table |
| RC-06 | Fixtures with pseudonyms; pre-fix fails, post-fix passes | Validation Architecture |
| RC-07 | Lawrence standard rubric as acceptance | Validation Architecture |
</phase_requirements>

## Summary

The leak is real in the repo today, but not as the class names the paper author saw. A repo-wide grep for `SystemArchetypeAgent`, `LeveragePointAgent`, `IntersectionOpportunityFinderAgent`, `Network Analysis MCP` and `INTERSECTIONAL SYSTEMS ANALYSIS` returns zero hits [VERIFIED: grep over the worktree, excluding node_modules and .git]. Those names came from another pipeline (origin [ASSUMED]: the June 2025 Academy or V2 grader). What the plugin does carry is its own machinery vocabulary inside the OUTPUT TEMPLATES the model is told to copy: `Assessor: Grading Agent` (agents/grading.md:162), a Calibration Note that names the "Assessment Thinking Chain" (agents/grading.md:204), a per-section table with a `REASONING.md` column and a `REASONING.md Health` block (commands/grade.md:189-217), and `/mos:` command pointers in the wrap-up steps (commands/deep-grade.md:187, commands/grade.md:258). The Grading Agent also reads raw Brain tool output (`directive.guided`, `next_gate.options`, GradedSubmission nodes; agents/grading.md:35,45-56), which is an unmeasured second leak path.

The existing detectors do not catch this. Measured in this session: `findMachineryNarration` (lib/hmi/larry-reply-checks.cjs:564) run on the sentence "SystemArchetypeAgent ... Assessor: Grading Agent ... NEO4J DATABASE ... Network Analysis MCP ... Ask Theo ... /mos:challenge-assumptions ... The graph shows a loop" returned only `MCP` and `database`. It misses `*Agent`, "Grading Agent", Neo4j, `/mos:` (counted only at 3 or more inside `detectFrameworkDump`), and Theo (allowed by design, rule R-20, line 559). It also runs on the output templates in agents/grading.md and references/methodology/grade.md and finds nothing. `lib/core/tone-filter.cjs` is not a failing check at all: it rewrites text, is gated to professor/researcher/sensitive domains, and is referenced only by `tests/test-205-decision-axes.cjs` (grep over the tree), so it is on no production write path. The 370-INPUT.md suggestion to "extend tone-filter" should be replaced: the right reuse anchor is the never-say machinery in `lib/hmi/larry-reply-checks.cjs` (its data readers, `NEVER_SAY_TERMS`, `findDashes`, `findIdLeak`, verdict shape), used in a new thin deliverable-mode function, not a new framework.

The only place all three surfaces converge on a file write is the MCP filing door `fileArtifact` (lib/mcp/tools/views.cjs:174), which already has pre-write refusals (`path_escape`, `invalid_filename`, `job_mismatch`) returning `{ok:false, reason}`. CLI sessions can also write with the plain Write tool, where a PreToolUse hook (exit 2 blocks; precedent scripts/write-scope-check.cjs:348) can enforce. The doctor `coverage-gate` organ (scripts/doctor.cjs:1221-1290) is where a static, fixture-based gate belongs. Hooks fire on the CLI only (Tri-Polar table in CLAUDE.md), so the MCP door plus a command-level pre-file check carry Desktop and Cowork.

**Primary recommendation:** Add one data file (`data/review-contract.json`) and one pure CJS module (`lib/core/review-contract.cjs`) that generates the denylist from disk at run time and checks `body only`; call it from three places (the command pre-file step via a small CLI wrapper, `fileArtifact` for MCP, a narrowly scoped PreToolUse hook for CLI direct writes) plus one doctor gate that lints the output templates and runs the pre-fix and post-fix fixtures. Split the grading output into an internal working record (handles allowed, frontmatter or returned to the orchestrator) and a rendered reader-facing body (fixed shape). Do not add a command, agent, skill or MCP tool.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contract definition (shape, forbidden sections, term classes) | Plugin data (`data/`, `references/methodology/`) | - | Data, read by prompts (Desktop `grade-venture` prompt loads `references/methodology/grade.md`, lib/mcp/prompts.cjs:203-211) and by code |
| Denylist generation | Shared core (`lib/core`) | - | Pure function over repo files; no network (Part 8); same code on all surfaces |
| Rendering the reader-facing body | Model (Larry wrap in the command) | Grading agent returns a record only | Prose generation is the model's job; the code only verifies |
| Enforcement at write time (MCP) | MCP server `fileArtifact` | - | Single door for Desktop, Cowork and foreign hosts |
| Enforcement at write time (CLI) | PreToolUse hook | Command pre-file check | Hooks fire on CLI only [CITED: CLAUDE.md Tri-Polar table] |
| Release-time guarantee | Doctor `coverage-gate` | Phase test runner | Deterministic fixtures and template lint; blocks a release that reintroduces a leak |
| Taught-terms rule | Rubric (eval/human) | Advisory code warning | A code check cannot prove "defined in plain words" (see Pitfall 6) |

## Standard Stack

No external packages. Node built-ins and repo modules only.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js CJS (`node:fs`, `node:path`) | Node >=22.18.0 required by CLAUDE.md; installed here: v22.23.1 [VERIFIED: `node --version`] | The check module and CLI wrapper | Repo rule: hooks and MCP server stay `.cjs`; CLI parsing by switch-case, no Commander (CLAUDE.md Conventions) |
| `lib/hmi/larry-reply-checks.cjs` | in repo, 740 lines | Reuse `findDashes`, `findIdLeak`, `findUndefinedFirstUse`, the verdict shape `{ok,hits,detail}`, the never-say term list `NEVER_SAY_TERMS` | Part 7: existing never-say machinery; 143 passing assertions on the baseline run [VERIFIED: `node tests/test-3696-reply-checks.cjs`] |
| `data/mcp-tool-connectors.json`, `data/command-registry.json`, `agents/*.md` | in repo | Sources of the generated denylist | Disk is the source of truth; the same readers `toolIds()` (larry-reply-checks.cjs:117-125) already use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `scripts/build-skill-mirrors.cjs` | in repo | Regenerates `skills/grade/SKILL.md` and `skills/deep-grade/SKILL.md` from `commands/` | After every edit to the two commands; `--check` passes today (112 mirrors match) [VERIFIED] |
| `scripts/doctor.cjs` `coverage-gate` | in repo | Add one `gates[]` entry | For the static gate (pattern at scripts/doctor.cjs:1230-1290) |
| Plain node test scripts + `tests/run-all-NNN.sh` glob runner | in repo | Tests | Pattern: `tests/run-all-265.sh` (glob discovery, found-eq-0 guard, no-em-dash fence) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New module `lib/core/review-contract.cjs` reusing larry-reply-checks | Add a deliverable-mode function inside larry-reply-checks.cjs | That file is the chat-voice shadow checker with its own 143-assertion test and chat exemptions (Theo allowed, userText exemption). Mixing deliverable rules into it couples two contracts. Keep separate, import from it. |
| Extend `tone-filter.cjs` (370-INPUT.md note) | - | Rejected: it rewrites, never fails, is audience-gated, and is unwired in production. A fail-closed check cannot be built on a rewriting filter. |
| New MCP tool `review_contract_check` | `artifact_file` refusal carries the check | A new tool adds tool-surface weight (doctor point `mcp-surface-tool-count`, scripts/doctor.cjs:2083) and a Part 11 declaration. The existing door already refuses writes. |

**Installation:** none.

**Version verification:** not applicable (no packages).

## Package Legitimacy Audit

No external packages are installed or recommended. Slopcheck not needed.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Student room (sections, REASONING.md, BRAIN.md ...)
        |
        v
/mos:grade  or  /mos:deep-grade  (orchestrator = Larry)
        |  (Brain calls are generic methodology only; Part 8)
        v
Grading agent / per-component agents  --->  INTERNAL RECORD
   (scores, evidence, gaps, calibration)     (handles allowed; never filed as body;
        |                                      provenance goes to frontmatter)
        v
Larry renders the READER-FACING BODY from the contract
   fixed order: Executive Summary (+3-5 key revision points) | Reality Check |
   Faculty Questions | Expert Conversations | Research Validation + Reframe |
   Strategic Challenge | [optional] For advanced students
        |
        v
CHECK  review-contract.checkReview(draft)   (pure, local, no network)
   split frontmatter / body -> shape check -> generated denylist scan on body
        |                 \
     ok |                  \ violations (class + line only, never the text)
        v                   v
   file the artifact      rewrite and re-check (bounded), then honest refusal
        |
        +--> MCP door: fileArtifact refuses with review_contract_violation   (Desktop, Cowork, foreign hosts)
        +--> CLI: PreToolUse hook on direct Write to a review artifact        (CLI only)
        +--> release: doctor coverage-gate lints the templates + runs fixtures
```

### Recommended Project Structure
```
data/review-contract.json              # the contract as data (order, headings, forbidden headings, limits, term tiers)
lib/core/review-contract.cjs           # buildDenylist(), splitArtifact(), checkReview(), loadContract()
scripts/check-review-contract.cjs      # CLI: <file> | - (stdin) | --check (static gate for doctor)
scripts/review-contract-hook.cjs       # PreToolUse Write|Edit|MultiEdit, narrow scope (optional, see Hook Points)
references/methodology/grade.md        # human-readable "Review contract" section (the grading reference home)
tests/test-370-*.cjs  tests/run-all-370.sh
tests/fixtures/370/                    # pre-fix.md, post-fix.md, one fixture per rule (pseudonyms)
```
Placement of the JSON in `data/` follows the other contract files there (`hitl-shape-declaration-schema.json`, `claim-state-vocabulary.json`) [VERIFIED: `ls data`]. The ROADMAP says "in the existing grading reference home"; the reference home is `references/methodology/grade.md`, which Desktop loads. Keep the prose contract there and pin it to the JSON with a drift test (pattern: tests/test-265-deep-grade-rubric.cjs).

### Pattern 1: Contract as data
**What:** one JSON, versioned (`"review_contract": 1`), listing: ordered required sections (id, exact heading), optional trailing "For advanced students", forbidden heading patterns (tool analysis, score by tool, "mapped to agents"), limits (key revision points min and max, cross-domain max), term tiers (below). Limits that the owner has not set are absent from the file until the owner sets them (see Open Questions O2). Numbers 3 to 5 and 2 come from the ROADMAP text; no word cap is invented.
**When to use:** read by the check, by the drift test, and quoted in `references/methodology/grade.md`.

### Pattern 2: Two layers, one render
**What:** the grading agent keeps its working structure (the pinned rubric table and names; tests/test-265-deep-grade-rubric.cjs arms 2 and 3 parse the agent's `### Rubric Scores` table and the deep-grade rubric sentence). Larry renders a separate reader-facing body. Provenance (agent handle, calibration source and date, model, contract version, `methodology: grade`) goes in frontmatter only.
**Why:** keeps the 265 rubric tripwire green and gives the check a clean boundary. Body = everything after the closing frontmatter fence. No exempt zones inside the body, and no fenced-code exemption (a leak inside a code fence is still a leak; this differs on purpose from `stripFences` in larry-reply-checks.cjs:185).

### Pattern 3: Generated, tiered denylist
See "Denylist" below.

### Anti-Patterns to Avoid
- **A hidden `<!-- internal -->` region inside the body.** It becomes the loophole every model uses. Internal data lives in frontmatter or in the returned record.
- **A hand-listed set of agent names.** The offending class names are not even on disk; use a class regex plus names generated from `agents/*.md`.
- **Judging with the model.** The pass/fail is the exit code of the module, never a model opinion (ROADMAP: "never a model judgment").
- **Echoing the body in violation output or logs.** Return class, rule id and line number only (precedent: scripts/check-voice-style.cjs header, "No row carries reply text").
- **A second linter framework.** One pure function, the larry-reply-checks verdict shape, one CLI wrapper.

## Where Internal Vocabulary Can Leak Today (real sources, file:line)

| # | Source | Leaking text | Reaches reader how |
|---|--------|--------------|--------------------|
| L1 | agents/grading.md:162 | `Assessor: Grading Agent (calibrated against 6 graded submissions)` in the mandatory output template (lines 157-205) | Copied into the filed artifact |
| L2 | agents/grading.md:204 | `Assessment Thinking Chain: Minto (structure) -> Beautiful Question ...` in the Calibration Note template | Copied into the artifact |
| L3 | agents/grading.md:35,50-56 | "Brain's real graded submissions (GradedSubmission nodes)", `directive.guided`, `next_gate.options`, three `brain_ask` calls | Raw tool vocabulary the model may paraphrase into the review (unmeasured; origin of Brain text is outside this repo) |
| L4 | agents/grading.md:31,134,149,212 | "Larry's Brain", "graded submissions in the Brain", "A- Dental Healthcare submission did X", "cite specific calibration submissions from Brain" | Calibration comparisons name Brain and other students' projects |
| L5 | agents/grading.md:171-178 and :194-199 | Rubric table with weights, Sci-Fi Connection, Visual Synthesis prompt | Not in the contract shape; the paper author kept six other sections |
| L6 | commands/grade.md:189-203 and :214-217 | `REASONING.md` column and a `REASONING.md Health` block (Valid/Stale/Missing) in the `--full` report template | Internal file name and health state in the report |
| L7 | commands/grade.md:146-160, commands/deep-grade.md:135-148 | Status block "Agent 1: problem-definition [running]" ... "Calibration anchors: pulled once in Phase 0" | Chat progress text, not the artifact; keep it out of the filed body |
| L8 | commands/deep-grade.md:174, commands/grade.md:187, agents/grading.md:151,164 | `Professor Aronhime's Perspective` section (a real surname in a tracked repo) | Section is not in the contract shape; see O4 |
| L9 | commands/deep-grade.md:187, commands/grade.md:258 | "recommend the specific `/mos:` command", "stress-test it with /mos:challenge-assumptions" | `/mos:` in Larry's wrap; fine in chat, forbidden in the filed body |
| L10 | references/methodology/grade.md:143-187 (template), :169 ("Mindrian Thinking"), :189 ("Homework") | Artifact template with component names such as "Mindrian Thinking" and a P0 rule that the scoring table MUST appear (grade.md:145, commands/grade.md:250) | The template is the Desktop prompt body (lib/mcp/prompts.cjs:203-211) |
| L11 | commands/deep-grade.md:5 and :11 (frontmatter `help_jtbd`, `teaching`) | "Brain-enriched, 100+ student calibration" | Command-picker copy, not a review. Adjacent, out of scope for this phase's check; mention to the owner |
| L12 | Filing path inconsistency | `produces: "room/**/grades/*"` (grade.md:16) vs "File this to problem-definition?" (grade.md:227,250); deep-grade files to `room/competitive-analysis/` (deep-grade.md:198, grading.md:207) | A path-based hook would miss real artifacts; classify by frontmatter (see Hook Points) |

Existing detectors against these (measured): `findMachineryNarration` on the fenced output templates in agents/grading.md and references/methodology/grade.md returned no hits [VERIFIED: probe run in session]. The templates therefore pass today's lint while teaching the model to write `Grading Agent`.

Git note: the ROADMAP says zero commits touched the three grade files since 2026-10-01. That is no longer exact: `12f26104c` (2026-11-05, "fix(383-08)") changed one line of `agents/grading.md` (a literal figure became `{score}/{percentile}` placeholders) [VERIFIED: `git log`, `git show`]. It does not touch the contract surface, but the trigger text in SEED-102 should be read with that in mind.

## Fixed Shape (recommended)

In order, reader-facing body only (headings are exact strings from the contract file):

1. **Executive Summary** - short paragraph, then **3 to 5 key revision points** as bullets with bold takeaways (ROADMAP: "executive summary first, then 3 to 5 key revision points").
2. **Reality Check** - validated / assumed / fantasy classification in plain words (this is what grade.md "Phase 3" already does: references/methodology/grade.md "Reality Check" block).
3. **Faculty Questions** - challenge questions a professor would ask.
4. **Expert Conversations** - practitioner pushback, written as what a practitioner would say.
5. **Research Validation + Reframe**.
6. **Strategic Challenge** - one consolidated big question plus reflection questions.
7. Optional last: **For advanced students** - extras, cross-domain ideas beyond the first 2.

Forbidden by contract: any heading matching tool analysis, methodology score by tool, "improvement recommendations mapped to agents", a Sci-Fi section, a Visual Synthesis prompt, a REASONING.md health block, a rubric weights table by default (see O1).

The structural check is mechanical: `##` headings must equal the ordered list (the optional note only last), the key-revision-point bullets are counted under the Executive Summary, cross-domain items outside the advanced note are counted, forbidden heading patterns fail. "Short" is checked only if the owner sets a cap (O2).

## Denylist: source of truth and generation

Rule: nothing enumerable is hand-listed. `buildDenylist({repoRoot})` runs at check time (cached per process), returns tiers, and takes `repoRoot` as a parameter so a test can point it at a temp tree and watch the list grow.

| Tier | Class | Generated from | Notes |
|------|-------|----------------|-------|
| H1 | Agent class names | Regex `\b[A-Z][A-Za-z0-9]*Agent\b` (catches `SystemArchetypeAgent`, not on disk) plus, for each `agents/*.md` frontmatter `name:`, the kebab form, the PascalCase form and the Title Case + " Agent" form (e.g. "Grading Agent") | Agent files on disk: 17 at research time [VERIFIED: `ls agents`]; do not freeze the count |
| H2 | Commands | Literal `/mos:` plus `mos:<name>` for every `commands[].command` in `data/command-registry.json` (113 entries at research time [VERIFIED]) | Bare words such as "grade" are NOT matched; only the prefixed form |
| H3 | Tool and connector ids | `data/mcp-tool-connectors.json` `connectors[].surface` with `mcp:` stripped (62 entries at research time [VERIFIED]), `mcp__*`, `brain_*`, connector `sub_mode` and `reach_id` values from `data/connector-registry.json` | Same reader as `toolIds()` at larry-reply-checks.cjs:117-125 |
| H4 | Paths and ids | Reuse patterns from `findMachineryNarration` (lines 592-596: `scripts|lib|agents|skills|hooks|references|data|.planning/...`, `*.cjs`, run, leaf, lane, shape ids) via `findIdLeak` (line 527) | `REASONING.md`, `BRAIN.md`, `STATE.md` file names go here as generated from the room-file naming constants if one exists, else in the contract JSON with a `why` |
| E1 | Named backends and products | Contract JSON `internal_terms`: MCP, Neo4j, Memgraph, Brain, Theo, SQLite, room.db, Cypher, "knowledge graph", "graph database", "Tier 0" | The only hand-kept part, because these name concepts, not files. Each entry carries a `why`. A drift test asserts the list is a superset of the matching entries of `NEVER_SAY_TERMS` (larry-reply-checks.cjs:60-64), minus the chat-only exemption "Theo" |
| E2 | Soft nouns | "database", "server", "graph" (bare), "hook", "index" | Plain English words; see Pitfall 3 and O3. Recommend: forbid E2 only in the compound forms above; bare "database" and "server" fail unless the word occurs in the student-authored source |

Exemption rule (recommended, [ASSUMED] pending O3): tiers H1-H4 are never exempt. Tiers E1 and E2 terms are allowed iff the same term occurs in the student-authored source text passed in by the caller (the chat check has a precedent: `userNamed`, larry-reply-checks.cjs:550). The source text must exclude `BRAIN.md`, `STATE.md` and `REASONING.md`, which contain Brain vocabulary themselves (brain-md schema is under lib/core/brain-md-schema.cjs).

## Hook Points (where the check runs)

| # | Hook | Surface | Mechanism | Evidence |
|---|------|---------|-----------|----------|
| 1 | **Command pre-file step** | all (needs Bash on CLI) | The two commands tell Larry: draft to a temp file, run `node "<anchored>/scripts/check-review-contract.cjs" <draft>`; exit 1 prints violation classes; rewrite and re-run (bounded; the planner picks the bound), then honest refusal that names classes and files nothing | Commands already allow Bash (grade.md:25-31, deep-grade.md:22-27); honest refusal is Decision 8 in `.claude/includes/decisions.md` |
| 2 | **MCP filing door** | Desktop, Cowork, foreign hosts, CLI via MCP | In `fileArtifact` (lib/mcp/tools/views.cjs:174), after `invalid_filename` and before `fs.mkdirSync`/`writeFileContained` (views.cjs:~220-226), run the check when the content is a review artifact; return `{ok:false, reason:'review_contract_violation', violations:[...]}` | Same shape as the existing refusals at views.cjs:185-196 |
| 3 | **CLI PreToolUse hook (optional)** | CLI only | A new `PreToolUse Write|Edit|MultiEdit` entry in hooks/hooks.json running a narrow script; exit 2 + stderr blocks (precedent scripts/write-scope-check.cjs:348, "Exit 2 to block"). Scope strictly to review artifacts by frontmatter `methodology: grade|deep-grade` or `review_contract:` key; fail-open on any parse failure (write-scope-check header: "A false block is worse than a false allow") | hooks.json currently has `PreToolUse Write|Edit|MultiEdit` -> write-scope-check [VERIFIED]. Adding an entry touches `data/hooks-markers.json` and the hook-schema checks; the planner must run them |
| 4 | **Doctor gate** | release | Add `{ id: 'review-contract', script: 'check-review-contract.cjs' }` to `gates[]` in the `coverage-gate` point (scripts/doctor.cjs:1230-1290). The script's `--check` (a) lints every fenced output template in the three grade files and the reference template with the same denylist, (b) runs the fixtures (pre-fix must fail, post-fix must pass), (c) verifies the JSON contract matches the reference prose | Recommended severity: blocker, because it is deterministic and offline. Siblings `shape-declaration` and `tool-honesty` are advisory only because they are noisy; this one is fixture-based [ASSUMED: owner may want advisory first; O6] |

Do not hook the existing Stop-hook voice check: `check-voice-style.cjs` is LOG ONLY by design (header: "NEVER blocks"). It can keep logging the chat reply; it is not the enforcement point.

Hook 3 is optional. Hooks 1, 2, 4 cover all three surfaces; hook 3 closes the CLI gap where a model uses the Write tool directly and skips hook 1. Because the 369.6 voice work chose a shadow-first ladder for chat checks (check-voice-style.cjs header), the owner may prefer hook 3 in log-only mode first (O6).

## Tri-Polar

| Surface | How the contract and check hold | Gap |
|---------|----------------------------------|-----|
| Claude Code CLI | Hook 1 (Bash script), hook 3 (PreToolUse), doctor gate | None expected |
| Claude Desktop | Contract text reaches the model through the `grade-venture` MCP prompt, which loads `references/methodology/grade.md` (lib/mcp/prompts.cjs:203-211). Enforcement through hook 2 (`artifact_file` refusal) | The `deep` branch loads `references/methodology/deep-grade.md`, which does not exist [VERIFIED: `ls references/methodology`], so it falls back to `grade.md`. Do not rely on a deep-grade reference file; keep the contract in `grade.md` |
| Cowork | Same MCP door (hook 2); shared room, so the refusal protects the shared artifact | Hooks do not fire here [CITED: CLAUDE.md Tri-Polar table]; Desktop hook behavior was not verified [ASSUMED] |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontmatter split | A new parser | The same fence rule as `splitFrontmatterAndBody` (lib/memory/validators/brain-md-invariants.cjs:152) or a 10-line fence split with a unit test | Several parsers exist already (grep found 9+); do not add a differently-behaving one without a test for BOM and CRLF |
| Dash rule | A new regex | `findDashes` from larry-reply-checks.cjs | Already tested; keeps one definition of "no em-dashes" |
| Id and path leak patterns | New regexes | `findIdLeak` (line 527) and the path/id rows of `findMachineryNarration` (lines 592-596) | Same never-say list the chat contract uses |
| Tool id list | A literal list | `data/mcp-tool-connectors.json` (generated registry) | It is regenerated by the build; a literal list drifts |
| Skill mirrors | Hand-editing `skills/grade/SKILL.md` | `node scripts/build-skill-mirrors.cjs` | The mirror is generated; the doctor `skill-mirrors` gate is a blocker |
| A new command or agent | `/mos:review-check` etc. | The existing two commands | Part 7 and Part 11: a new invocable surface needs born-wired and HITL declarations; none is needed |

**Key insight:** the failure is a vocabulary boundary, not a style problem. Style rules are judged by a model; a boundary can be enforced by a pure function over a list the repo already generates.

## Common Pitfalls

### Pitfall 1: The 265 rubric tripwire
**What goes wrong:** removing or renaming the agent's `### Rubric Scores` table, the five component names or the "calibrate once before dispatch" order breaks `tests/test-265-deep-grade-rubric.cjs` (8 passed, 0 failed on baseline [VERIFIED]). It parses the agent table, the deep-grade rubric sentence, the weight sum (100), `consolidatePanel`, "disputes above the percentage", zero `run_in_background`, and `brain_grade_calibrate` before the "Dispatching" block.
**How to avoid:** Pattern 2 (two layers). Keep the internal record; add the render step; update the test only where a pinned string genuinely moves, with a note.

### Pitfall 2: The sourced-figures sweep
**What goes wrong:** `tests/test-383-sourced-number.cjs` sweeps agents and commands for literal figures. The agent's calibration anchors and Calibration Note carry literal scores and ranges (agents/grading.md:64-71, :202-203). Baseline: 2 pass, 1 FAIL (U1: one unsourced figure in one file), 1 PENDING [VERIFIED]. That failure is pre-existing and not caused by this phase; do not "fix" it here, record it as baseline.
**How to avoid:** new text uses placeholders (`{score}`), as `12f26104c` did.

### Pitfall 3: False positives on student topics
**What goes wrong:** a student's venture is about a database, a brain-computer interface or an MCP server; the strict denylist fails a correct review.
**How to avoid:** the E1/E2 source exemption above. Compute the source text from student-authored sections only; exclude `BRAIN.md`, `STATE.md`, `REASONING.md`.

### Pitfall 4: The Brain text path
**What goes wrong:** the model paraphrases `directive.guided` or `next_gate.options` into the review, pulling Brain vocabulary through (L3). Only the code check stops it; the prose rule alone is the failure the paper author saw.
**How to avoid:** the check is mandatory at the filing door; add the instruction "write from the student's room, not from tool output" in the render step; no Brain call is made by the check (Part 8).

### Pitfall 5: Path-anchoring gate on new citations
**What goes wrong:** a bare `references/` or `data/` path in a command breaks the plugin-path anchoring done in `598fdb7c5` and `9d2b5e43b` (anchored `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}` form, visible in skills/grade/SKILL.md:70,114,172,228-230) [VERIFIED: file read; script `scripts/check-plugin-path-anchoring.cjs` exists, not run].
**How to avoid:** copy the anchored form exactly; run `node scripts/check-plugin-path-anchoring.cjs` after editing.

### Pitfall 6: "Taught terms only" is not machine-checkable
**What goes wrong:** the code cannot know which methods a given course taught or whether a term was "defined in plain words". `data/framework-names.json` holds 426 Brain framework names (stamp 2026-11-07), far more than any course teaches [VERIFIED].
**How to avoid:** the code check enforces the deterministic parts (names, shape, counts). For taught terms use an advisory warning through `findUndefinedFirstUse` (larry-reply-checks.cjs:491, heuristic) over a "taught" list the owner owns (O5), and the Lawrence rubric as the human/eval acceptance, never as a pass/fail claim by code.

### Pitfall 7: Filing location drift
**What goes wrong:** artifacts land in `problem-definition/`, `competitive-analysis/` or `grades/` depending on which text the model follows (L12); a path-based hook misses them.
**How to avoid:** classify by frontmatter (`methodology` or `review_contract`), and make both commands and the agent name one filing location in the same plan.

### Pitfall 8: Mirror and registry gates after command edits
**What goes wrong:** editing `commands/grade.md` without regenerating `skills/grade/SKILL.md` fails the `skill-mirrors` blocker. Frontmatter edits can drift `data/command-registry.json`.
**How to avoid:** keep frontmatter untouched (the `hitl_shape: F.8`, `connector` blocks stay as is); run `node scripts/build-skill-mirrors.cjs`, then `node scripts/build-connector-registry.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/check-shape-declaration.cjs --check`.

## Code Examples

### Check API (shape only; implement in the plan)
```js
// lib/core/review-contract.cjs  (pure, local, no network, no body in output)
// checkReview(text, { repoRoot, sourceText }) ->
//   { ok: boolean,
//     violations: [{ rule, tier, line }],   // rule ids: internal_name, shape_order,
//                                           // forbidden_section, missing_section,
//                                           // revision_points_count, cross_domain_count,
//                                           // length, em_dash. NEVER the matched text.
//     contract_version: 1 }
```

### Existing reuse anchors (read, do not copy)
```js
// Source: lib/hmi/larry-reply-checks.cjs:117-125 (tool ids generated from data at run time)
function toolIds() { /* reads data/mcp-tool-connectors.json, strips 'mcp:' */ }
// Source: lib/hmi/larry-reply-checks.cjs:243 (verdict shape reused by the new module)
function verdict(ok, hits, detail) { /* { ok, hits, detail } */ }
// Source: lib/mcp/tools/views.cjs:185-196 (pre-write refusal shape the new refusal copies)
return { ok: false, reason: 'path_escape', section: p.section || null };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chat-only never-say rule ("never mention databases or architecture unprompted") judged by prose and a shadow Stop hook | Code check on the written deliverable, fail-closed | This phase | Closes the gap the paper author hit: written output, not chat |
| Seven-section grading rubric in the agent | Five components, reconciled in Phase 265 (agents/grading.md:73-102) | 2026-08-27 | The internal record stays five-component; do not reopen |
| Voice rules as LOG ONLY rung 2 (check-voice-style.cjs) | Review contract as an enforcing gate for one artifact class | This phase | Enforcement scope is narrow (review artifacts) to avoid the false-block risk named in write-scope-check |

**Deprecated/outdated:** the 370-INPUT.md note to extend `tone-filter.cjs`; it is a rewriting, unwired filter. The ROADMAP candidate "Part 8 egress-guard pattern" is relevant only as a deny-pattern style precedent (lib/core/part8-egress-guard.cjs, 1762 lines); the check does not egress anything and should not import it.

## Part 7, Part 8, Part 11, Part 12 Consequences

- **Part 7 (reuse before build).** Reuse: larry-reply-checks data readers, `NEVER_SAY_TERMS`, `findDashes`, `findIdLeak`, verdict shape; the `fileArtifact` refusal pattern; the doctor `coverage-gate` `gates[]` pattern; `build-skill-mirrors`; the `tests/run-all-NNN.sh` runner. Net-new: one data file, one module, one CLI wrapper, optionally one hook script. Justification against the surface enumeration (commands, agents, pipelines, skills): no existing surface performs a fail-closed deliverable check; the nearest (voice check, tone filter) were measured above and rejected for stated reasons.
- **Part 8 (graph boundary).** The check is local and makes no Brain call. The grading agent's Brain calls stay generic (agents/grading.md:45-56 ask for calibration anchors and rubric structure, no room text). The new module must not import `brain-client.cjs`. Violation output carries rule ids and line numbers only. Fixtures use pseudonyms and synthetic text. The check forbidding "Brain" in the body is consistent with, and not a substitute for, Part 8.
- **Part 11 (invocation constitution).** No new command, agent, pipeline or skill, so no new born-wired or HITL declaration. Editing the two commands keeps frontmatter (`hitl_shape: F.8`, connector block) byte-stable. The mirror, connector, projection, render and shape gates must stay green after the edit. A new script is not one of the four invocable classes. A new hook entry triggers hook-marker and schema checks; a new MCP tool is avoided on purpose (tool-surface count point). The retry loop is not a Decision-Gate fork; the existing filing question ("File this to problem-definition?") stays as the gate.
- **Part 12 (pedagogy, invisibility).** Part 12 says default to withholding grades and compliments (CLAUDE.md). The contract shape contains no grade and no score table, while `commands/grade.md:250` and `references/methodology/grade.md:145` say the scoring table MUST appear in EVERY output. These two rules collide for the reader-facing body. This is O1 and needs an owner ruling before planning the render step.

## Runtime State Inventory

Not a rename or migration phase. Omitted per instructions. One note: existing filed grade artifacts in users' rooms are not rewritten; the check applies to new filings only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | module, CLI, tests | yes | v22.23.1 (floor 22.18.0) | - |
| Plugin test runner (`bash tests/run-all-NNN.sh`) | phase tests | yes (pattern exists: tests/run-all-265.sh) | - | - |
| Brain / Theo / network | not needed | not used | - | - |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with pass/fail counters; bash glob runner (repo convention, tests/test-265-deep-grade-rubric.cjs, tests/test-3696-reply-checks.cjs) |
| Config file | none; `tests/run-all-370.sh` to create (copy the glob + found-eq-0 guard + no-em-dash fence from tests/run-all-265.sh) |
| Quick run command | `node tests/test-370-review-contract.cjs` |
| Full suite command | `bash tests/run-all-370.sh` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RC-01 | Contract JSON schema valid; order and heading strings match the reference prose | unit + drift | `node tests/test-370-contract-schema.cjs` | Wave 0 |
| RC-03 | Denylist is generated from disk: add a temp `agents/x-y.md` in a temp `repoRoot`, the list gains `XY`/`x-y`/"X Y Agent"; remove it, list shrinks | unit | `node tests/test-370-denylist-from-disk.cjs` | Wave 0 |
| RC-03 | Each tier catches its class: `SystemArchetypeAgent`, "Grading Agent", `/mos:grade`, `brain_ask`, `mcp__x__y`, Neo4j, MCP, Brain, Theo, `lib/core/x.cjs`; frontmatter handles do NOT fail; body does | unit | `node tests/test-370-check-rules.cjs` | Wave 0 |
| RC-03 | Source exemption: "database" allowed only if present in student source; H tiers never exempt | unit | same file | Wave 0 |
| RC-02 | Shape: wrong order, missing section, extra heading, forbidden "tool analysis" heading, 2 vs 3 cross-domain items, 2 vs 6 revision points | unit | same file | Wave 0 |
| RC-04 | `fileArtifact` refuses a violating review with `review_contract_violation` and writes no file; a clean review files; a non-review artifact is untouched | integration (temp room) | `node tests/test-370-filedoor.cjs` | Wave 0 |
| RC-04 | Hook: stdin payload for a violating review exits 2; clean exits 0; malformed payload exits 0 (fail-open); non-review path exits 0 | unit | `node tests/test-370-hook.cjs` | Wave 0 |
| RC-04 | No body text in any violation output or log | unit | `node tests/test-370-no-body-echo.cjs` | Wave 0 |
| RC-06 | Pre-fix fixture FAILS the check; post-fix fixture PASSES | fixture | `node tests/test-370-fixtures.cjs` | Wave 0 |
| RC-02 | Output templates in agents/grading.md, commands/grade.md, commands/deep-grade.md and references/methodology/grade.md carry no denylist term (static template lint) | static | `node scripts/check-review-contract.cjs --check` | Wave 0 |
| RC-05 | Tri-Polar: the same module result through CLI wrapper, MCP door and hook for one fixture | integration | `node tests/test-370-tripolar.cjs` | Wave 0 |
| RC-07 | Lawrence rubric on the post-fix fixture: human or eval-scored checklist (short, summary first, taught terms, no names, no tool-analysis). Code asserts only the deterministic subset | manual + eval | recorded in the phase VERIFICATION | Wave 0 |
| (guard) | Skill mirrors in sync | static | `node scripts/build-skill-mirrors.cjs --check` | exists |
| (guard) | Rubric tripwire stays green | existing | `node tests/test-265-deep-grade-rubric.cjs` | exists |
| (guard) | Chat reply checks stay green | existing | `node tests/test-3696-reply-checks.cjs` | exists |
| (guard) | Figures sweep: baseline 1 pre-existing FAIL (U1), must not grow | existing | `node tests/test-383-sourced-number.cjs` | exists |

### Sampling Rate
- **Per task commit:** `node tests/test-370-review-contract.cjs` (aggregate of the unit tests) plus the three guard tests.
- **Per wave merge:** `bash tests/run-all-370.sh`.
- **Phase gate:** `bash tests/run-all-370.sh`, `node scripts/doctor.cjs --acceptance`, `node scripts/build-skill-mirrors.cjs --check` green (and the 383 U1 baseline unchanged) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/test-370-*.cjs` (list above), `tests/run-all-370.sh`
- [ ] `tests/fixtures/370/pre-fix.md` (reproduces the failure: nine sections, tool-analysis section, class names, "Network Analysis MCP", Neo4j heading, Theo mention, `/mos:` pointer), `post-fix.md`, and one minimal fixture per rule
- [ ] Fixture authoring rule: pseudonymous team names, synthetic venture content, no names from the Week 6 thread (hard rule, feedback_no_real_names_in_repo; Lawrence standard memory)

## Security Domain

`security_enforcement` is not set to false in `.planning/config.json` (only `nyquist_validation: true` found by grep), so this section applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | yes (writes into a room) | Reuse `safeResolveSection` and realpath containment already inside `fileArtifact` (views.cjs:176-200); the check runs before the write and adds no new path logic |
| V5 Input Validation | yes | Body is untrusted model output. Pure string processing, regexes with no nested quantifiers; the draft size is already capped by the MCP schema (`content` max 200000, views.cjs:~470) |
| V6 Cryptography | no | - |
| V7 Logging | yes | Violation records hold rule id, tier and line only, never body text (precedent check-voice-style.cjs) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Regex denial of service from a generated denylist alternation | Denial of service | Escape every generated term (`escapeRegex`, larry-reply-checks.cjs:127), build one alternation per tier, cap input length, test with a long adversarial body |
| Model evades by case, spacing or unicode lookalikes ("Neo 4j", zero-width characters) | Tampering | Normalize (NFKC, strip zero-width, collapse spaces) before the scan; add fixtures for each |
| Hook false block stalls a user | Denial of service | Narrow scope to review artifacts; fail-open on parse errors (write-scope-check precedent) |
| Body echoed into logs leaks student content | Information disclosure | No body in output or logs; tests assert it |
| Brain vocabulary or student content crossing the boundary | Information disclosure (Part 8) | Local-only module; no `brain-client` import; no Brain call in the check |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The class names in the paper author's review came from another pipeline (Academy or V2 grader), not from this plugin | Summary | If a Brain response in production carries such names, the plugin leak is larger than the templates; only the code check (hook 2) would catch it. No Brain call was allowed, so this is unmeasured |
| A2 | Tier E1/E2 source exemption (allow a soft term when the student's own text uses it) is acceptable | Denylist | Too lax: a student mentions "database" once and the model narrates the platform database. Too strict without it: correct reviews of database or MCP ventures fail (O3) |
| A3 | Doctor gate severity should be a blocker | Hook Points | A false positive blocks a release; owner may prefer advisory first (O6) |
| A4 | Hooks do not fire on Desktop or Cowork, so the MCP door is the only portable enforcement | Tri-Polar | If Desktop hooks fire, hook 3 gives extra cover; no harm |
| A5 | A bounded rewrite-and-recheck loop is acceptable UX, ending in an honest refusal that files nothing | Hook Points | Owner may want the failing draft filed as a labelled draft instead |
| A6 | Classifying review artifacts by frontmatter (`methodology` or `review_contract`) is reliable enough; the model sometimes omits frontmatter | Pitfall 7 | A review without frontmatter escapes hooks 2 and 3; the command pre-file step (hook 1) and a filename convention must back it up |
| A7 | "Professor Aronhime's Perspective" is dropped from the reader-facing shape because the paper author's kept sections do not include it | Leak Sources L8 | If the owner wants a persona quote kept, the contract needs a section for it and a name rule (O4) |

## Open Questions (owner decisions)

1. **O1 - Score table and grade in the reader-facing body.** `commands/grade.md:250` and `references/methodology/grade.md:145` say the scoring table MUST appear in EVERY output. Part 12 says withhold grades by default, and the contract shape lists no table. Does the student-facing review show a letter grade, a component table, or neither (score kept in frontmatter and chat)? Recommendation: neither in the body; scores live in the internal record and frontmatter; Larry may show them in chat on request. Needs ruling because it overrides a P0 constraint.
2. **O2 - Length cap and counts.** "Still too long" has no number. Set a word cap for the body, the count of reflection questions in the Strategic Challenge, and where the first 2 cross-domain ideas sit (inside Research Validation + Reframe or after Strategic Challenge). Until set, the check enforces none of them (no invented numbers).
3. **O3 - Soft-term policy.** Confirm the E1/E2 exemption, and whether bare "graph" and "database" are forbidden or only the compound forms.
4. **O4 - Persona quote and cross-student comparisons.** The current output has "Professor Aronhime's Perspective" (a real surname; memory rules say no individual's name on PWS in public and no real names in tracked repos) and calibration comparisons that name other students' projects ("Dental Healthcare submission did X", agents/grading.md:149). In a student-facing review the second item discloses another cohort's work. Keep, anonymize, or drop?
5. **O5 - Taught-terms list.** Who owns the list of terms taught in the course, and where does it live? Until it exists, taught-terms stays an advisory warning plus the human rubric.
6. **O6 - Severity.** Doctor gate blocker or advisory first. CLI hook (hook 3) enforcing now, or log-only first as the 369.6 ladder did for chat checks.
7. **O7 - Scope boundary.** The ROADMAP names only grade and deep-grade. `grade-grant` (skills/grade-grant), `grant-reviewer`, `vault-section-reviewer` and `chain-step-reviewer` agents also write reviews. Confirm they are out of scope for this phase (recommendation: out; the contract data file can name future `applies_to` entries).
8. **O8 - One filing location.** Choose `grades/` or the section targets now used (`problem-definition`, `competitive-analysis`) and update `produces:` consistently.
9. **O9 - `--full` report.** The 8-section table with REASONING.md state (commands/grade.md:189-217) conflicts with the fixed shape. Replace it with the contract shape per section roll-up, or keep it as chat-only progress output?

## Sources

### Primary (HIGH confidence, repo files read in this session)
- `.planning/ROADMAP.md` lines 1992-2003 (Phase 370), `.planning/phases/370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude/370-INPUT.md`, `.planning/seeds/SEED-102-review-contract-grade-deep-grade.md`
- `commands/grade.md`, `commands/deep-grade.md`, `agents/grading.md`, `skills/grade/SKILL.md`, `skills/deep-grade/SKILL.md`, `references/methodology/grade.md`
- `lib/hmi/larry-reply-checks.cjs` (lines 1-135, 380-740), `lib/core/tone-filter.cjs`, `lib/mcp/tools/views.cjs` (1-30, 150-300, 454-500), `lib/mcp/prompts.cjs` (176-215), `scripts/write-scope-check.cjs`, `scripts/check-voice-style.cjs`, `scripts/doctor.cjs` (1215-1300), `scripts/build-skill-mirrors.cjs`, `hooks/hooks.json`
- `tests/test-265-deep-grade-rubric.cjs`, `tests/test-3696-reply-checks.cjs`, `tests/test-383-sourced-number.cjs` (baselines run), `tests/run-all-265.sh`
- Project `CLAUDE.md` and `.claude/includes/*.md` (Canon Parts 3, 7, 8, 9, 11, 12; Tri-Polar; conventions; decisions)
- Memory: `feedback_lawrence_review_standard.md` (the Lawrence review standard, verbatim list)

### Secondary (MEDIUM confidence)
- Probe runs of `findMachineryNarration` on a synthetic sentence and on the output templates (scratchpad scripts, not committed)

### Tertiary (LOW confidence)
- None used. No web search, no Brain, no Theo call.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no packages; every reuse anchor read in source.
- Architecture: MEDIUM - hook placement and tiering are design recommendations; MCP door and doctor pattern verified in source.
- Leak sources: HIGH for templates (file:line); LOW for Brain response content (unmeasured by order).
- Pitfalls: HIGH for the three pinned tests (run); MEDIUM for the path-anchoring gate (script exists, not run).

**Baselines recorded:** `test-265-deep-grade-rubric` 8 passed 0 failed; `test-3696-reply-checks` 143 passed 0 failed; `test-383-sourced-number` 2 passed 1 FAILED (U1, pre-existing) 1 pending; `build-skill-mirrors --check` OK.

**Project Constraints (from CLAUDE.md) honored:** GSD-only edits; no em-dashes; Feynman prose; hooks and MCP server stay `.cjs`; TypeScript only if erasable and out of any hook path (this phase uses `.cjs`); Part 8 no Brain call; Part 7 reuse measured; Part 11 no new invocable surface; Tri-Polar table filled; `.planning/` is gitignored and force-tracked, so a commit needs `git add -f`; two-session collision rule (commit with `--only`). Rethinking-room compositing: this phase touches grading (user-facing), not MindrianOS architecture, so room filing is the planner's call.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08 (stable repo surfaces; re-check `git log` on the three grade files and `data/` generators before planning if the date passes)
