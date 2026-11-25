# EGM mechanisms: wide fan-out from a small instruction surface

Date: 2026-11-24
Subject: Elephant-Goldfish Model (EGM) plugin, version 0.1.1, Apache-2.0, Google LLC.
Local install read: `~/.claude/plugins/cache/egm/egm/0.1.1/` (abbreviated `EGM/` below).
Purpose: find the mechanisms that MindrianOS can copy.
Written by the EGM research subagent; saved here by the main session (the subagent's write outside the worktree was refused by the worktree path guard).

Sources and status:
- Local install: read. All 8 `SKILL.md` files (2,331 lines, PROVEN by `wc -l`), all 10 canonical personas in `EGM/agents/` (672 lines, PROVEN), all 10 Claude adapters in `EGM/.claude-plugin/agents/` (177 lines), resources, `docs/claude.md`, `docs/harnesses.md`, `TESTING.md`, `AGENTS.md`, manifests, test files.
- Upstream `docs/designs/architecture.md` (GitHub): fetched. Content matches the local copy dated 2026-06-06. The other upstream design files were read from the local copy in `EGM/docs/designs/` (20 files), not fetched again.
- Essay on Medium: WebFetch returned HTTP 403. A Tavily extract returned partial text (Elephant and Goldfish definitions, the "Feed the Elephant; test it against the Goldfish" rule, the Step 6 Critic prompt). The full essay was not read.

All line numbers refer to the local install unless marked otherwise.

---

## Short answer

EGM gets about 20 fresh-context reviewer runs per full review from about 3,000 lines of instructions. It does this with five ideas:

1. One persona file serves many jobs. Each reviewer has a `Mode` switch (BRAINSTORM or REVIEW), so 7 persona files cover 7 brainstorm lenses and 5 review stages.
2. Rubrics live outside the personas. A skill passes a mapping of reviewer to rubric (`Standards`), so the same reviewer audits against different standards at different stages.
3. One generic loop skill (`egm-review-loop`) does all dispatch, dedup, retry and convergence. The stage skill (`egm-review`) is mostly a table of "which reviewers, which range, which report file".
4. One synthesizer agent sits between the main thread and the swarm, so raw reviewer output never enters the main context.
5. Nothing loads at session start. Every skill sets `disable-model-invocation: true`, and agent descriptions are one line each.

The surface is not fully deduplicated. A 40 to 52 line anti-sycophancy block is copied into 3 skills (section 1). MindrianOS should copy the good parts and fix that one.

---

## 1. Layering

### What lives where

| Layer | Path | Job | Size |
| --- | --- | --- | --- |
| Skills (orchestration) | `EGM/skills/*/SKILL.md` | Workflow, gates, which reviewers run, where reports go | 8 files, 2,331 lines |
| Canonical personas (one lens each) | `EGM/agents/*.md` | Role, audit vectors, output format, Mode branches | 10 files, 672 lines |
| Claude adapters | `EGM/.claude-plugin/agents/*.md` | Claude tools, model, context isolation; then "read the canonical persona" | 10 files, 177 lines |
| Shared rubrics | `EGM/resources/document_standards/*.md` | What "good" means for each stage | 5 files, 203 lines |
| Shared behaviour rules | `EGM/resources/execution_instructions.md` | Design-only scope, one question at a time, contradiction audit | 37 lines |
| Harness guides | `EGM/docs/claude.md`, `docs/harnesses.md`, `docs/codex.md` | Host-specific mechanics, read on demand | 187, 185, 133 lines |
| Skill-local references | `skills/egm-draft/references/design_doc.md`, `skills/egm-bootstrap/references/*` | Templates and schemas, read only when needed | 177, 68, 20 lines |

`EGM/resources/README.md:1-4` states the rule: these files are "the authoritative instructions and rubrics"; update the rules there and link to them; do not keep separate summaries.

`EGM/docs/designs/architecture.md:58-84` names the same four layers: skills, personas, document standards, living docs.

### How shared rules are referenced instead of repeated

- Rubrics by short name. `egm-review-loop/SKILL.md:74-76` maps a standard short name such as `feature-spec-standard` to `resources/document_standards/{name}.md`. Reviewer short names map to `agents/{name}.md` (lines 69-73). A name with a slash is a custom path (lines 77-78). The calling skill passes only names: `egm-review/SKILL.md:373-376` and `:400-405`.
- Personas by path. A Claude adapter body is 7 lines that say read `${CLAUDE_PLUGIN_ROOT}/agents/<name>.md` and follow it (`EGM/.claude-plugin/agents/comprehension.md:11-17`). The persona text exists once.
- Host mechanics by pointer. Every skill opens with a 2-line pointer: in Claude Code, read `docs/claude.md` first (for example `egm-review/SKILL.md:14-15`). Host details (nesting depth, Skill tool refusal, permission rules) live only in `docs/claude.md`.
- Behaviour rules by pointer, once. `egm-draft/SKILL.md:22-23` says to read and apply `resources/execution_instructions.md`.

### Repeated blocks (count)

| Block | Size | Copies | Where |
| --- | --- | --- | --- |
| Harness-guide pointer | 2 lines | 8 | Every `SKILL.md`, lines 11 to 17 |
| "Delegation" paragraph (how to spawn a Goldfish, fallback, stop if no subagent tool) | 8 to 10 lines | 4 | `egm-review:19-28`, `egm-review-loop:34-44`, `egm-brainstorm:27-36`, `egm-bootstrap:28-35` |
| "Execution Constraints (CRITICAL)" anti-sycophancy list | 40 to 52 lines | 3 | `egm-review:30-69`, `egm-draft:20-72`, `egm-brainstorm:38-89` |
| "Core Mandates (Universal Goldfish Context)" (read-only, stateless, no chitchat) | 7 lines | 8 | All 8 reviewer personas, lines 7-13 |
| "Failed Reviewers" rule (retry once, then `not run`, never count as zero findings) | 3 to 5 lines | 3 | `egm-review-loop:140-144`, `agents/synthesizer.md:31` and `:41` |
| Claude adapter body | 7 lines | 8 | `.claude-plugin/agents/*.md`; only name, description and path differ (PROVEN by `diff`) |
| Severity scale "Blocker, Major, Nit" | 1 line | about 20 | Every persona output section, review-loop, synthesizer |

Finding: the largest repeat is the anti-sycophancy list, about 140 lines in total across 3 skills. `egm-draft` both points to `execution_instructions.md` and keeps its own copy. `egm-review` does not point to it at all. The single-source rule is applied to rubrics and personas, not fully to behaviour rules. The 7-line persona mandate repeat is deliberate: each Goldfish reads only its own file, so a shared header would cost an extra read in every reviewer.

Lesson for MindrianOS: repeat a rule only when the reader is a fresh-context agent that will not read a second file. For skills that run in the main thread, point to one file.

---

## 2. Fan-out

### Presets select a pipeline, not individual reviewers

`egm-review/SKILL.md:121-177` offers 4 presets in one single-select gate:
- Interactive: Stages 5, 6, 7, 8, 9 with a human checkpoint after each.
- Consolidated (uninterrupted): Stages 5 to 9 with no checkpoints, then one `consolidated_review_report.md`.
- Feature spec only: Stages 5 to 8; skip the split discovery; halt before Stage 9.
- Implementation plan only: split discovery, then Stage 9 only.

A `Step` argument bypasses the gate (`:76-78`, `:124-127`). Multi-select is forbidden "to protect topological dependencies" (`:138-140`).

### The stage table (who reviews what)

From `egm-review/SKILL.md:282-303`:

| Stage | Dispatch | Reviewers | Range | Report |
| --- | --- | --- | --- | --- |
| 5 Initial Zoom Out | synthesizer or direct | `egm-zoom-out`, `egm-inventive-catalyst` (parallel) | full file | `zoom_out_report.md` |
| 6 Comprehension | direct only, never synthesizer | `egm-comprehension` | FeatureRange and DetailedRange | `comprehension_report.md` |
| 7 Critic | `egm-review-loop` | `egm-design`, `egm-structural`, `egm-style` | FeatureRange | `critic_report.md` |
| 8 Intermediate Zoom Out | synthesizer or direct | `egm-zoom-out` (Stage 5 report as input) | full file | `intermediate_zoom_out_report.md` |
| 9 Implementation Readiness | `egm-review-loop` | `egm-implementation-readiness`, `egm-codebase-details`, `egm-style` | DetailedRange | `implementation_readiness_report.md` |

Stage 6 bypasses the synthesizer on purpose: the synthesizer keeps only findings, but the author must see the paraphrase (`:351-356`).

The range split is computed, not asked: the skill finds the `## Detailed Implementation Plan` header (or synonyms) and sets `FeatureRange` and `DetailedRange` (`:179-207`).

### The review loop (generic engine)

`egm-review-loop/SKILL.md` takes 5 inputs: `TargetFile`, `SemanticTarget`, `Reviewers`, `Standards`, `GoldfishContext` (`:46-63`). Each round:
1. Re-read the file and re-locate the target by its stable header string (`:107-113`).
2. Spawn the swarm: hierarchical (synthesizer) or flat (direct) (`:115-133`).
3. Flatten findings; give each a stable id `<reviewer>-<round>-<n>` (`:136-139`).
4. Retry a failed reviewer once; then record `not run`; never count it as zero findings (`:140-144`).
5. Hand the list to `egm-resolve` in the main thread (`:146-155`).
6. Convergence (`:157-181`): a settled finding is not re-opened; a fixed finding that comes back is re-opened; a round is clean when no unsettled Blocker or Major remains and every reviewer ran; converged means 2 clean rounds in a row; cap 5 rounds; churn stops the loop and asks the human.

The reason for the 2-clean-rounds rule (`:159-160`): fresh reviewers "sample differently each round".

### Parallel versus sequential

- Stages run in sequence; reviewers inside a stage run in parallel (`docs/claude.md:44-47`).
- Brainstorm runs 7 lenses in parallel "to prevent sequential bias" (`egm-brainstorm/SKILL.md:54-56`).
- Bootstrap runs workers in parallel with no concurrency limit, after a human gate at more than 15 directories (`egm-bootstrap/SKILL.md:65-68`, `:113-125`, `:192-201`).
- The synthesizer may run 2 independent instances (A and B) of each reviewer to raise recall (`agents/synthesizer.md:40`; `docs/designs/synthesizer.md:64`).

### Nesting depth

Maximum 3 levels: main thread (Elephant), synthesizer, reviewers (`docs/claude.md:39-43`). Cowork subagents cannot spawn subagents, so the main thread dispatches directly. Every orchestration skill carries that fallback (for example `egm-review/SKILL.md:26-27`).

### How results merge

- Synthesizer (`agents/synthesizer.md:36-66`): group by severity, dedup, normalize line references, one report with a "Reviewer Status" table, one short message back with status, counts and the path. Rationale: 6 to 12 parallel reviewers in the root session flood the main context (`docs/designs/synthesizer.md:22-25`).
- Cross-stage (uninterrupted preset): consolidate all stage reports into prioritized actions with a traceability matrix (`egm-review/SKILL.md:304-311`).
- Bootstrap workers return JSON matching `skills/egm-bootstrap/references/worker-return.schema.json`, not prose.

### Where the human gate fits

- Before fan-out: brainstorm forbids spawning until the human picks "Review with Goldfishes" (`egm-brainstorm/SKILL.md:127-158`). Bootstrap asks before large swarms (`:113-125`).
- Between stages: a 3 or 4 option gate (proceed, resolve with agent, edit manually, pause) (`egm-review/SKILL.md:229-278`). Maximum 1 re-audit per stage (`:271-275`).
- At resolution: `egm-resolve` sorts each finding into CONTEST, ESCALATE, PROPOSE FIX, DECLINE (`egm-resolve/SKILL.md:54-67`). A contest must cite evidence the reviewer could read; do not contest a comprehension gap; do not change a severity (`:69-82`).
- Gate form: one question, sole tool call, no "(Recommended)" prefix (`egm-review/SKILL.md:65-69`, `:132-142`).

---

## 3. Agent design

- Mode parameter: each persona branches on `Mode: BRAINSTORM` versus `Mode: REVIEW` (for example `agents/zoom_out.md:33-74`; `agents/comprehension.md:26-41`). 7 persona files cover 7 brainstorm lenses and 5 review stages.
- One lens per agent with 3 to 6 named audit vectors (for example `agents/zoom_out.md:49-55`). The inventive catalyst must output "No false compromise detected" instead of inventing a contradiction (`agents/inventive_catalyst.md:62`, `:69`).
- Read-only tools: reviewer adapters declare `tools: [Read, Grep, Glob]` (`.claude-plugin/agents/comprehension.md:5`). The synthesizer gets `[Agent, Read, Grep, Glob, Write]`. Write limits are prose only (`docs/claude.md:144-147`).
- `omitClaudeMd: true` on reviewer adapters (`.claude-plugin/agents/comprehension.md:8`); it drops user, project and local instruction files; context and tool isolation, not filesystem isolation (`docs/claude.md:162-166`); needs Claude Code 2.1.271 or later.
- `model: inherit` on every adapter.
- No persistent memory, no fork, no resume; pass only task, target, persona and standard paths (`docs/claude.md:131-141`).
- Fail closed: if a required file cannot be read, report an incomplete review, not a verdict (`.claude-plugin/agents/comprehension.md:16-17`).
- Output: fixed fields per finding, severity Blocker, Major, Nit. The comprehension reviewer paraphrases first; a wrong paraphrase is a finding (`agents/comprehension.md:37`, `:56-57`). Lite uses a binary LGTM contract (`egm-lite/SKILL.md:202-219`).
- Tests lock the adapter settings (`tests/unit/test_harnesses.py:165-200`).

---

## 4. Research steps: how sources become GoldfishContext

- `GoldfishContext` is an explicit reading list (`egm-review/SKILL.md:74-75`; `egm-review-loop/SKILL.md:56-63`).
- The link scan runs once, after the preset is chosen (`egm-review/SKILL.md:101-104`).
- Link harvest (`:104-119`): links inside the working directory are added automatically; outside links and URLs need human approval; headless runs leave them out and say so.
- URLs become saved files, because reviewers cannot open URLs (`:112-117`; `docs/claude.md:158-160`).
- Every stage except Stage 6 gets the context; Stage 6 reads the document alone.
- Lite injects the checklist into the reviewer prompt and strips history; diff reviews omit authorial justification (`egm-lite/SKILL.md:202-205`, `:295-312`).

The reviewer gets source material only as files on disk, chosen by rule, with human approval for anything that leaves the workspace.

---

## 5. Context economy

- All 8 skills set `disable-model-invocation: true`; they are absent from automatic discovery and the Skill tool refuses them; one skill runs another by reading its SKILL.md (`docs/claude.md:20-25`).
- The 10 adapter descriptions total 675 bytes.
- Everything else loads on demand.
- Size guard: `tests/unit/test_skill_load_limits.py:13-21` fails any skill body over 24,000 bytes ("move details into an explicitly read reference").
- Main-thread protection: one synthesizer message, reports to files, no chat dumps (`architecture.md:171-185`).

Contrast (PROVEN in this worktree at commit 596789656): 6 of 125 MindrianOS skills set `disable-model-invocation: true`; the other 119 put about 13.4 KB of description text into every session (awk byte count). 2 of 17 agents mention `omitClaudeMd` (the surface audit found both hits are comments; 0 set it). 2 of 17 agents have no `tools:` line.

---

## 6. Testing

- `test_scenarios.yaml` next to each skill, 71 scenarios, all `eval_type: "deterministic"`, assertion types `required_pattern` (125), `forbidden_pattern` (43), `contains` (5), `not_contains` (1).
- No runner in the repository executes these scenarios against a model (PROVEN by search). Only `tests/unit/test_scenario_coverage.py:23-40` checks that the files exist.
- `TEST.md` per skill is a manual checklist.
- Offline unit tests: frontmatter schema, links, manifest drift, adapter tool lists, packaging, size limit, scratch paths.
- Live opt-in probes (`EGM_CLAUDE_LIVE=1`) inspect the child transcript to prove isolation (`tests/integration/test_claude.py:28-60`).
- Execution records per harness in `TESTING.md:137-152`; stated verification limits at `:170-185` and `docs/harnesses.md:332-346`.

---

## 7. Harness portability

- One canonical set (`skills/`, `agents/`, `resources/`) for every host (`docs/harnesses.md:3-5`, `:249-252`).
- Thin per-host adapters and manifests (`:254-272`); generic verbs in skills (`:275-292`).
- Capability fallbacks: no nesting means direct dispatch; no subagent tool means stop, because "a review in the same context is not a Goldfish review" (`egm-review/SKILL.md:26-28`).
- Root `plugin.json` is the identity source; tests reject manifest drift.

---

## 8. Ranked mechanisms for MindrianOS to copy

Theo answers "in what order" (framework steps); the Gemini Decision advisor answers "which ones now" (labels-only shortlist keyed on the job).

| Rank | Mechanism | EGM evidence | Expected effect | Theo / advisor mapping |
| --- | --- | --- | --- | --- |
| 1 | Turn off auto-invocation for orchestration skills | all 8 skills; `docs/claude.md:20-25` | Removes most of the about 13.4 KB of descriptions loaded each session | Advisor shortlist replaces auto-discovery: it names the next skill; the main thread reads that file |
| 2 | Generic review-loop engine plus thin stage tables | `egm-review-loop/SKILL.md:46-181`; `egm-review/SKILL.md:282-303` | Many review, grade and critique skills become rows on one engine | Theo: stage order from framework steps. Advisor: reviewer selection per stage |
| 3 | Persona plus `Mode` plus external rubric (`Standards`) | `agents/zoom_out.md:33-74`; `egm-review-loop/SKILL.md:69-78` | One lens file serves ideation and review | Theo supplies the step criteria as the `Standards` value |
| 4 | Fresh-context reviewer adapters: Read/Grep/Glob, model inherit, omitClaudeMd, no memory | `.claude-plugin/agents/comprehension.md:1-17`; `tests/unit/test_harnesses.py:165-179` | Reviewers do not see Larry, room history or CLAUDE.md | Neither enters a Goldfish prompt |
| 5 | Synthesizer middle layer | `agents/synthesizer.md:36-72` | Raw reviewer output never enters the main thread | Advisor can size the swarm |
| 6 | Explicit GoldfishContext by rule; URLs saved as files; human approval outside the workspace | `egm-review/SKILL.md:101-119` | Independence and Canon Part 8 safety | Theo step sources may be saved as files; room content only by explicit list |
| 7 | Convergence rules: ids, settled vs fixed, 2 clean rounds, cap 5, churn stop, retry once | `egm-review-loop/SKILL.md:136-181` | No wasted rounds, no false zero findings | Engine rule |
| 8 | Resolver discipline: CONTEST needs evidence the reviewer could read; ESCALATE | `egm-resolve/SKILL.md:54-82` | The Elephant cannot argue findings away | ESCALATE maps to the gate card |
| 9 | Paraphrase-first naive reader; binary LGTM | `agents/comprehension.md:37`; `egm-lite/SKILL.md:202-219` | Finds documents whose parts do not connect | |
| 10 | Stages sequential, reviewers parallel; single-select presets | `docs/claude.md:44-47` | Correct dependencies | Theo: a preset is a Theo chain. Advisor: top label becomes option 0 |
| 11 | One shared-rules file, pointed to once | `resources/README.md:1-4` | Smaller surface | |
| 12 | Size test per skill body | `tests/unit/test_skill_load_limits.py:13-21` | Keeps skills small | |
| 13 | Structured worker returns (JSON schema) | `egm-bootstrap/SKILL.md:36-45` | Machine merge instead of prose merge | |
| 14 | Canonical files plus thin per-host adapters | `docs/harnesses.md:239-292` | One source for CLI, Desktop and Cowork | |
| 15 | Behaviour scenarios per skill plus a live isolation probe | `skills/*/test_scenarios.yaml`; `tests/integration/test_claude.py:28-60` | A testable contract per skill; run them through Jev (EGM has no runner) | Theo order and advisor shortlist can be asserted as scenarios |

### What not to copy

- The anti-sycophancy block copied into 3 skills. Use one pointer.
- Unbounded parallel spawning (`egm-bootstrap/SKILL.md:198-199`). Keep a cap or a cost gate.
- Prose-only write limits; enforce write paths in the parent session.
- Scenario files with no runner. Connect them to an eval.

Attribution: EGM is Copyright 2026 Google LLC, Apache-2.0. Only short phrases are quoted. No files were copied.
