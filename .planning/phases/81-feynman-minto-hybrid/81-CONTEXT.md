---
phase: "81"
name: "Feynman-MINTO Hybrid (MINTO generation via Feynman engine)"
milestone: "v1.10.2"
status: discussed
created: 2026-04-13
revised: 2026-04-14
authority: Feynman engine skill, Minto Pyramid Principle, user directive 2026-04-13, user reframe 2026-04-14
supersedes: AAAK-in-MINTO proposal from earlier in the 2026-04-13 session
---

# Phase 81: Feynman-MINTO Hybrid

## REVISION 2 (2026-04-14) -- READ FIRST

The original Revision 1 of this document (and the archived research + plans in `_superseded/`) made an architectural mistake: it assumed `/mos:reason` would invoke Claude from inside a CJS script via a direct Anthropic Messages API call using an `ANTHROPIC_API_KEY` env var. The user corrected this by asking the obvious question: **"ANTHROPIC_API_KEY but they run in an llm! why key?"**

The correction: `/mos:reason` is a slash command. Slash commands run **inside the user's existing Claude session**. Claude IS the LLM. Paying a second API provider to re-invoke Claude from a child process, while Claude is already sitting there running the command, is wrong. It bends CLAUDE.md Decision #1 (one-command install) for no reason, creates a second billing relationship for no reason, and manufactures a cost-budget problem that does not actually exist.

**Revision 2 architecture (the correct one):**

1. `/mos:reason` is a slash command markdown file in `commands/mos-reason.md`. It is a prompt, not a script.
2. When the user types `/mos:reason`, Claude (the host session) reads the prompt, which instructs Claude to: walk the active room's sections, read each section's artifacts, run Feynman stages 1/2/4/5 natively in its own context, and emit structured narrative JSON for each section.
3. Claude then calls the structural helper script (`scripts/vault-section-minto-generator.cjs`) with the narrative JSON, and the helper produces the final MINTO.md file by combining deterministic structural parts (MECE tree, cross-refs, sources, navigation, frontmatter) with the Claude-produced narrative.
4. **Zero external API calls.** Zero `ANTHROPIC_API_KEY`. Zero per-run cost budget. Zero monthly cap. Zero `lib/memory/llm-call.cjs`. Zero `lib/memory/budget-ops.cjs`. Zero `__test_fetch_shim.cjs`. Zero fabric of machinery that only exists because the wrong model was assumed.
5. The cost to the user is **whatever their existing Claude session already costs them for any other slash command.** Same meter they already pay, no new meter.
6. **Decision #1 (one-command install) is fully preserved for tier-1.** The user does not need to set any env var, does not need to bring their own API key, does not need to accept a paid upgrade. If they have Claude Code, they have tier-1 Feynman-MINTO.

**Tier-0 fallback still exists but is narrower.** Tier-0 is for contexts where no Claude session is in the loop: bare-shell `node scripts/vault-section-minto-generator.cjs` invocations, cron jobs, Cowork scheduled tasks with no interactive agent, debugging. In those contexts, the generator detects "no narrative JSON provided" and falls through to the pre-81 deterministic path plus AAAK footer. The trigger is no longer "LLM unreachable or budget exceeded." The trigger is "no Claude in the loop."

**What survives from Revision 1:**
- The reframe that MINTO is born compressed via Feynman, not compressed after the fact via AAAK
- The D-1 table split between deterministic structural parts and Feynman narrative parts
- D-2 (stages 3 and 6 are human review gates, skipped in automation)
- D-4 (AAAK stays committed as the tier-0 fallback primitive, 21/21 tests green, not modified)
- D-6 (migration via `/mos:reason --regenerate-all` with backup)
- D-8 in spirit (Feynman prompts become library code as single source of truth)
- The requirement that the pre-81 deterministic generator path remains byte-equivalent when tier-0 activates
- Ships as v1.10.2 with the semver deviation documented in CHANGELOG
- Nothing under `lib/memory/aaak-compress.cjs` or `~/.claude/skills/feynman-engine/` is modified

**What dies from Revision 1:**
- D-3 tier chain as drawn (redraw below: trigger is "no Claude session" not "LLM unreachable or budget exceeded")
- D-5 cost budget gate (no meter, nothing to gate)
- D-7 LLM path abstraction (no llm-call.cjs at all; the slash command IS the abstraction across CLI/Desktop/Cowork because all three surfaces run slash commands natively)
- `lib/memory/llm-call.cjs` (removed from scope)
- `lib/memory/budget-ops.cjs` (removed from scope)
- `lib/memory/__test_fetch_shim.cjs` (removed from scope)
- `/mos:budget` command (removed from scope, no meter to report)
- FEYNMINTO-05 (per-run budget) and FEYNMINTO-06 (monthly cap) retire
- FEYNMINTO-10 rewrites from "llm-call.cjs abstracts" to "slash command protocol works natively on all three surfaces because slash commands are how all three surfaces invoke Claude"

**Revision 2 locked decisions** (supersede D-1/D-3/D-5/D-6/D-7, replace D-8):

### R-1: Split generator into plan phase and write phase

The CJS helper `scripts/vault-section-minto-generator.cjs` is split into two subcommands:

- `--plan <section>` reads the section folder, walks artifacts, emits JSON payload describing what needs narrative generation: `{section_path, section_name, artifacts: [{path, title, excerpt}], target_minto_path, structural: {frontmatter, mece_tree, cross_refs, sources, navigation}}`. Pure deterministic file I/O, zero LLM.
- `--write <section> --narrative <json-file-path>` takes the structural payload from plan phase plus a narrative JSON file produced by Claude and writes the final MINTO.md by merging the two. Pure deterministic assembly, zero LLM.

Both subcommands are tested with node built-in assert. Given a fixture section folder and a fixture narrative JSON, the write phase produces a byte-stable MINTO.md (modulo date stamps which are either frozen in tests or asserted with regex).

### R-2: Slash command is the orchestrator

`commands/mos-reason.md` is rewritten as a structured prompt that tells Claude:
1. Identify target sections (all sections if no arg, one section if `--section` flag, empty sections excluded)
2. For each section, run `vault-section-minto-generator.cjs --plan <section>` via bash, capture the JSON payload
3. Read the artifacts from the payload (or just the excerpts if the payload includes them)
4. Produce a narrative JSON object conforming to the R-3 schema, using Feynman stages 1/2/4/5 in Claude's own reasoning (no external tools, no API calls)
5. Write the narrative JSON to a temp file
6. Run `vault-section-minto-generator.cjs --write <section> --narrative <tempfile>` to produce the final MINTO.md
7. Clean up the temp file
8. Report back to the user with old-size vs new-size and a one-line summary per section

The slash command markdown includes the Feynman prompt templates inline (or references `lib/memory/feynman-prompts.cjs` which is loaded via `@include` or copied at build time). Claude reads the prompts as part of the slash command body and applies them in-context.

### R-3: Narrative JSON schema (single source of truth)

Every narrative JSON file conforms to:

```
{
  "section": "problem-definition",
  "essence": "one sentence, max 200 chars, irreducible truth",
  "plain_language": "two sentences, max 400 chars total, elevator version",
  "governing_thought": "one sentence, max 250 chars, Minto-style top-of-pyramid claim",
  "mental_model": {
    "analogy": "one sentence naming the analogy",
    "mapping": "two to four sentences mapping source domain to target",
    "limits": "one sentence on where the analogy breaks"
  },
  "sweet_spot": "two to four sentences, the understanding you want readers to leave with",
  "key_claims": ["claim 1 in plain language", "claim 2", "claim 3", "up to 5 total"]
}
```

- Stages 3 and 6 are not in the schema. They are human review gates per D-2, skipped.
- The schema is enforced by a deterministic validator in `lib/memory/narrative-schema.cjs` with node built-in assert tests.
- The write phase rejects a narrative JSON that fails validation and falls through to tier-0 with a warning.
- No em-dashes allowed in any string field (validator enforces).

### R-4: Tier-0 fallback (redrawn)

```
/mos:reason invoked (inside Claude session)
       |
       v
  Claude runs the slash command, produces narrative JSON
       |
       v
  write phase writes MINTO.md using structural + narrative
  (tier-1, zero external cost)

--- OR ---

scripts/vault-section-minto-generator.cjs invoked directly
from bare shell or cron (no Claude session in the loop)
       |
       v
  generator detects absence of --narrative flag
       |
       v
  pre-81 deterministic generation + AAAK footer
  (tier-0, zero cost, brittle quality, working code path)
```

Tier-0 detection is a simple flag check. There is no API call to time out, no budget to exceed, no key to be missing. The trigger is explicit: Claude passed narrative = tier-1, no narrative passed = tier-0.

### R-5: Feynman prompts as library constants

`lib/memory/feynman-prompts.cjs` holds the four stage prompts as exported string constants:

```
STAGE_1_ESSENCE        // prompt for reducing input to irreducible truth
STAGE_2_PLAIN_LANGUAGE // prompt for translating jargon to plain English
STAGE_4_MENTAL_MODEL   // prompt for building analogy-based mental model
STAGE_5_SWEET_SPOT     // prompt for finding the simplification that stops short of breaking
```

These are consumed by:
- `commands/mos-reason.md` which embeds them in the slash command body (either inlined or via `@include`)
- Tests that validate the prompts are well-formed (no em-dashes, contain expected placeholders, bounded length)
- Future v3.0 MCP server tool `generate_minto` which uses the same prompts via MCP Sampling

The Feynman engine skill at `~/.claude/skills/feynman-engine/` is NOT modified. The prompts in `feynman-prompts.cjs` are the automation-tightened versions (return parseable JSON, no interactive gates) derived from but distinct from the skill's human-facing versions.

### R-6: /mos:budget command is removed from scope

There is no meter. There is no budget. There is no cap. `/mos:budget` as specified in Revision 1 is deleted from the plan. If users want visibility into Claude session costs, that is Claude Code's own `/cost` command, not a MindrianOS responsibility.

## Revised Plan Decomposition (4 plans, not 5)

1. **81-01 Foundation.** Split `scripts/vault-section-minto-generator.cjs` into `--plan` and `--write` subcommands. Create `lib/memory/feynman-prompts.cjs` with the four prompt templates as string constants. Create `lib/memory/narrative-schema.cjs` with the R-3 schema validator. Tests for plan subcommand (given fixture section, emits well-formed JSON payload), write subcommand (given structural + narrative, produces valid MINTO.md), prompt templates (well-formed, no em-dashes, bounded), schema validator (accepts valid, rejects invalid including em-dashes). The pre-81 deterministic generator code path is preserved verbatim as the fallback inside the new subcommand structure. Zero new runtime dependencies.

2. **81-02 Slash command orchestrator.** Rewrite `commands/mos-reason.md` as the structured prompt orchestrator per R-2. Include (or `@include`) the Feynman prompts from `feynman-prompts.cjs`. Commit 3 fixture narrative JSON files at `test-fixtures/feynman/narratives/` corresponding to 3 fixture sections (small, medium, large) with known-good Claude-produced output. Integration test: load a fixture section, load its fixture narrative, run write phase, assert resulting MINTO.md conforms to the Feynman-MINTO schema (structural parts present, narrative parts present, under 1500 tokens, no em-dashes). No live Claude calls in tests because the narratives are pre-recorded fixtures; Claude-produced narrative generation is validated at slash-command runtime, not at unit-test time.

3. **81-03 Generator rewrite + tier-0 fallback.** Wire the full generator rewrite with tier-0 detection per R-4. Integration tests: (a) narrative JSON provided, tier-1 path produces valid MINTO.md, (b) no narrative JSON, tier-0 path produces valid deterministic MINTO.md plus AAAK footer, (c) invalid narrative JSON (schema violation) falls through to tier-0 with a warning. Regression test: frozen expected-tier0-baseline.md snapshot committed at start of this plan; assert tier-0 output matches byte-for-byte (modulo date stamps). Pre-81 generator logic is not modified, only wrapped in the new subcommand structure.

4. **81-04 Migration + release.** `/mos:reason --regenerate-all` command flag that walks every MINTO.md in the active room, backs up to `.migration-backup/YYYY-MM-DD/`, regenerates via the new hybrid generator, writes a report of old-size vs new-size and tier used per section. Add CLAUDE.md Decision #17 documenting the Revision 2 architecture (slash-command-as-orchestrator, no external API, no budget machinery). Update `.planning/REQUIREMENTS.md` with the revised FEYNMINTO-01 to FEYNMINTO-10 (see below). CHANGELOG [1.10.2] entry documenting: why v1.10.1 was skipped, the slash-command orchestrator architecture, why there is no API key or cost budget, the migration path for existing MINTOs, the semver deviation (should have been 1.11.0 per semver rules, shipped as 1.10.2 per user directive), and a forward pointer to v3.0 MCP Sampling as the mechanism that will bring Feynman-MINTO to headless MCP tool invocations without a Claude session present. Version bump in `plugin.json` and `package.json` to 1.10.2. Execute the 5-gate release: CHANGELOG, plugin.json, package.json, git tag v1.10.2, marketplace.json `source.ref` pinned to v1.10.2. Integration test: regenerate a fixture room end-to-end, verify backup created, new format valid, no data loss, report file generated.

## Revised Requirements (supersede Revision 1 requirements)

- **FEYNMINTO-01:** `/mos:reason` produces MINTO files under 1500 tokens when Claude produces narrative (structural assertion on fixture output, not a live measurement).
- **FEYNMINTO-02:** Structural parts of MINTO remain deterministic and free, produced by the `--plan` and `--write` subcommands with zero external calls.
- **FEYNMINTO-03:** Feynman stages 1, 2, 4, 5 are applied by Claude in-session per the slash command orchestrator; prompts are stored as library constants in `lib/memory/feynman-prompts.cjs` and referenced by `commands/mos-reason.md`.
- **FEYNMINTO-04:** Tier-0 fallback activates when `--narrative` is absent (no Claude session in the loop) and produces deterministic MINTO plus AAAK footer via `lib/memory/aaak-compress.cjs`.
- **FEYNMINTO-05:** (RETIRED) no meter, no budget.
- **FEYNMINTO-06:** (RETIRED) no meter, no cap.
- **FEYNMINTO-07:** `/mos:reason --regenerate-all` migrates pre-81 MINTOs to post-81 format with backup to `.migration-backup/YYYY-MM-DD/` and a report file.
- **FEYNMINTO-08:** Pre-81 deterministic generator path preserved byte-equivalent as tier-0 fallback (frozen snapshot regression test).
- **FEYNMINTO-09:** Feynman prompts live in `lib/memory/feynman-prompts.cjs` as the single source of truth for both the slash command orchestrator and future v3.0 MCP Sampling tool.
- **FEYNMINTO-10:** Slash command orchestrator works natively on CLI, Desktop, and Cowork surfaces because all three run slash commands in the same Claude session model. No surface-specific code. No LLM path abstraction needed because the slash command IS the path.

## Non-Goals (unchanged from Revision 1)

- No cross-tool memory (MemPalace was a separate conversation, parked).
- No MCP server refactor (v3.0 work is separate, see PROJECT.md v3.0 backlog for the MCP Sampling migration entry).
- No Brain dependency.
- No vector search, embeddings, or ChromaDB.
- No `/mos:recall` implementation.

## Forward pointer to v3.0

When the MindrianOS MCP server ships in v3.0, it will expose a `generate_minto` tool that uses the same `lib/memory/feynman-prompts.cjs` constants via MCP Sampling (`sampling/createMessage`). At that point, headless MCP invocations (no Claude session present) also get tier-1 Feynman-MINTO without needing a Claude session in the loop. This is documented as a first-class v3.0 scope item in `.planning/PROJECT.md` under the "v3.0 Backlog" section. Phase 81 does not build this; it simply designs the prompt constants so v3.0 can reuse them without refactor.

---

## SUPERSEDED BELOW (Revision 1, retained for trace)

The content below this line was written on 2026-04-13 under the incorrect assumption that `/mos:reason` would call the Anthropic Messages API directly from a CJS script using an env-var API key. User reframe 2026-04-14 superseded this. See REVISION 2 above for the correct architecture. The content below is preserved so future readers can see the mistake and how it was caught.

---

## Phase Goal

Every MINTO.md is born compressed. `/mos:reason` uses the Feynman engine to produce the NARRATIVE content of MINTO files (governing thought, essence, mental model, key claims) while keeping the structural parts (MECE tree, cross-references, navigation, sources) deterministic and free. The resulting MINTO is ~1000 tokens instead of ~5000, natively readable, natively memorable, and small enough that cross-session retrieval does not need a separate compression layer.

**One-line version:** MINTO stops being a form to fill. It becomes a page to read.

## Ships as: v1.10.2

- v1.10.0 was shipped on 2026-04-13 (Obsidian vault import).
- v1.10.1 is **skipped entirely**. It was going to be "AAAK compression as MINTO footer" but that proposal was superseded during the same session after the user reframed the problem: "maybe the MINTO needs to be produced by Feynman to be cheaper". The correct architecture compresses at generation time, not via a second pass.
- v1.10.2 is this phase. Feynman-MINTO as the default MINTO generator. AAAK retained as tier-0 offline fallback only.
- Semver note: technically this is a MINOR bump (new feature), so 1.11.0 would be correct by semver rules. The user explicitly chose 1.10.2 as a patch-style release to ship it faster without the ceremonial weight of a minor bump. Document the deviation in CHANGELOG.

## Authority

1. **Feynman Engine skill** (`/home/jsagi/.claude/skills/feynman-engine`) defines the 6-stage pipeline: reduce to essence, translate to plain language, expose confusion, build mental models, simplify until breaks, teach it back. Phase 81 uses stages 1, 2, 4, 5 for automated content generation. Stages 3 and 6 are interactive human-review gates, not appropriate for automated MINTO generation.
2. **Minto Pyramid Principle** (Minto 1978) defines the hierarchical argument structure: governing thought -> sub-claims -> evidence. MINTO.md files already encode this.
3. **User directive (2026-04-13):** "Maybe the MINTO needs to be produced by Feynman to be cheaper." And: "Like a MINTO Feynman hybrid?" And: "Skip AAAK entirely, build Feynman-MINTO." And: "Make it 1.10.2."
4. **CLAUDE.md Decision #8** (Tier 0 fully functional, no dependencies): the Feynman-MINTO path is tier-1 (LLM-required). When LLM is unavailable, the generator falls back to the pre-81 deterministic MINTO path. Decision #8 is preserved by the tier fallback, not violated.
5. **AAAK compression work from earlier in this session** (`lib/memory/aaak-compress.cjs`, 21/21 tests green) is retained as a reference library for the tier-0 fallback path. It is NOT the default. It is what the generator falls back to when LLM is unreachable or when a per-run cost gate trips.

## The Problem Being Solved

Current MINTO.md files are ~5000 tokens. Users skim them, they don't read them. Cross-session memory is a headache because:
1. Loading 30 MINTOs into context to search across rooms costs 150k tokens. Does not fit.
2. MINTO content is structured but jargon-heavy. Humans don't remember forms.
3. No separate compression layer exists (AAAK was proposed, rejected in favor of this reframe).
4. `/mos:reason` produces structural skeletons with placeholder content ("Problem Definition synthesizes N artifacts into a coherent argument for this section of the venture.") — technically correct, content-free, forgettable.

The Feynman-MINTO hybrid produces MINTO files that:
1. Are ~1000 tokens each (5x smaller, 30 fit in 30k tokens).
2. Read like essays, not forms.
3. Preserve argument structure (Minto) and preserve concept understanding (Feynman).
4. Require no secondary compression pass.
5. Contain actual insight, not placeholder prose.

## Locked Architectural Decisions

### D-1: MINTO structure is hybrid of deterministic + Feynman-generated

| MINTO section | Generation method | Cost |
|---|---|---|
| Frontmatter (section, created, room, sources, related, status) | Deterministic (scan folder) | $0 |
| Essence (1-sentence irreducible truth) | **Feynman Stage 1** | 1 LLM call |
| Mental Model (1-2 analogies with mappings) | **Feynman Stage 4** | 1 LLM call |
| Governing Thought (plain-language 2-sentence version) | **Feynman Stage 2** | 1 LLM call |
| Argument Structure (pyramid logic) | **Feynman Stage 5 sweet spot** | 1 LLM call |
| Key Claims (3-5 in plain language) | Derived from argument structure (same call) | (bundled above) |
| MECE Issue Tree | Deterministic (folder walking + heuristic buckets) | $0 |
| Evidence Gaps | Deterministic (gap heuristics from Decision #12) | $0 |
| Cross-References | Deterministic (sibling section detection) | $0 |
| Source Artifacts | Deterministic (file walk) | $0 |
| Navigation | Deterministic (parent room link) | $0 |

**Total LLM cost per `/mos:reason` run:** ~4 LLM calls.

### D-2: Feynman stages 3 and 6 are skipped in automated generation

Stages 3 (Expose Confusion) and 6 (Teach It Back) are iterative and require human review gates per the Feynman engine skill. Phase 81 does NOT run these stages in the automated generator. Users who want full Feynman treatment can run `/mos:feynman` manually against a MINTO after `/mos:reason` completes. The automated pipeline stops at the sweet-spot output (stage 5).

### D-3: Tier fallback chain

```
/mos:reason invoked
       │
       ▼
  LLM available AND budget OK?
       │
    ┌──┴──┐
    │     │
   YES    NO
    │     │
    ▼     ▼
Feynman   Deterministic MINTO + AAAK footer
MINTO     (tier-0 fallback, offline, free)
(tier-1
default)
```

- **Tier-1 (default):** Feynman-MINTO with 4 LLM calls. Costs ~$0.05-0.10 per run. 2-10 seconds wall time.
- **Tier-0 (fallback):** Deterministic MINTO generation (current behavior) + AAAK footer via `lib/memory/aaak-compress.cjs`. Free, offline, deterministic, brittle quality. Used when LLM unreachable, cost budget exceeded, or user explicitly opts out with `--tier-0` flag.

### D-4: AAAK compression library stays committed as the tier-0 fallback primitive

`lib/memory/aaak-compress.cjs` (built earlier in the 2026-04-13 session, 21/21 tests green) is committed to the repo as the tier-0 fallback primitive. It is NOT wired into the MINTO generator by default. It becomes active only when the tier fallback triggers. Keeping it committed means:
- The fallback path has working code to call
- The regex extraction primitive is available to other parts of the system that may need tier-0 compression
- The 21 passing tests protect the primitive against regression
- Jonathan's earlier work in this session is not wasted

### D-5: Cost budget gate

Per-run cost budget: default $0.15 per `/mos:reason` invocation (covers 4 LLM calls at current rates with 50% headroom).

Per-user monthly cap: default $10/month. When exceeded, tier-0 fallback activates for the rest of the month unless user overrides.

Budget tracking in `~/.mindrian/budget.json`. User can see current spend via new `/mos:budget` command (scope: phase 81 or follow-up).

### D-6: Migration strategy for existing MINTO files

Existing MINTO.md files (produced by deterministic generator pre-81) stay in place until regenerated. No auto-migration on upgrade. New `/mos:reason --regenerate-all` command walks every existing MINTO and regenerates under the new format. Backup to `.migration-backup/YYYY-MM-DD/` first.

### D-7: LLM path abstraction

The Feynman stage calls must be abstracted behind a single interface (`lib/memory/llm-call.cjs`) so that:
- When Claude Code plugin context is active, the call uses the host LLM
- When MCP server context is active, the call goes through MCP tool invocation
- When neither is available, the call throws a recoverable error that triggers tier-0 fallback

This preserves the tri-polar design rule (CLI + Desktop + Cowork) from CLAUDE.md.

### D-8: Feynman stage functions become library code

The Feynman engine skill currently exists as a markdown file with prompt templates. Phase 81 extracts the prompts from the skill into callable library functions in `lib/memory/feynman-stages.cjs`:

```
feynmanStage1_essence(text)        -> { essence: string }
feynmanStage2_plainLanguage(text)  -> { plain: string, elevator: string }
feynmanStage4_mentalModel(text)    -> { models: [{ analogy, mapping, limits }] }
feynmanStage5_sweetSpot(text)      -> { sweetSpot: string, ladder: [...] }
```

Each function is a thin wrapper that:
1. Loads the prompt template from the Feynman engine skill
2. Substitutes the input text
3. Calls `llm-call.cjs` to invoke the LLM
4. Parses the response
5. Returns a structured result

This decouples the prompts (which live in the skill for human reference) from the runtime (which uses the library for execution).

## Plan Decomposition (5 plans expected)

1. **81-01 Foundation.** Tier abstractions, `lib/memory/llm-call.cjs` wrapper, `lib/memory/feynman-stages.cjs` skeleton functions (stub mode, no real LLM calls yet), tests, fixture MINTO files for the new format, budget tracking schema.

2. **81-02 Feynman stages 1+2 (essence + plain language).** Real LLM-backed implementations of `feynmanStage1_essence` and `feynmanStage2_plainLanguage`. Unit tests with recorded LLM responses (no live calls in tests). Integration test: give a section with 3 artifacts, get back essence + plain language, assert structure is right.

3. **81-03 Feynman stages 4+5 (mental model + sweet spot).** Real LLM-backed implementations of `feynmanStage4_mentalModel` and `feynmanStage5_sweetSpot`. Unit tests. Integration test: full 4-stage pipeline against a fixture section, output matches the Feynman-MINTO structure spec.

4. **81-04 Generator rewrite + tier fallback.** Modify `scripts/vault-section-minto-generator.cjs` to use the Feynman stages for content and keep structural parts deterministic. Implement tier fallback logic (try tier-1, fall back to tier-0 + AAAK footer on error). Integration test: two runs, one with LLM available, one with LLM forced unavailable, both produce valid MINTOs.

5. **81-05 Commands + migration + release.** `/mos:reason --regenerate-all` migration command. `/mos:budget` command for cost visibility. CHANGELOG [1.10.2] entry. plugin.json + package.json bump to 1.10.2. Decision #17 in CLAUDE.md documenting the Feynman-MINTO architecture. Integration test: regenerate a fixture room from pre-81 format to post-81 format, verify backup created and new format is valid.

## Requirements (new, to be added to REQUIREMENTS.md during plan phase)

- **FEYNMINTO-01:** `/mos:reason` produces MINTO files under 1500 tokens when LLM available
- **FEYNMINTO-02:** Structural parts of MINTO remain deterministic and free
- **FEYNMINTO-03:** Tier-1 path uses Feynman stages 1, 2, 4, 5 via library functions
- **FEYNMINTO-04:** Tier-0 fallback uses deterministic MINTO + AAAK footer when LLM unavailable
- **FEYNMINTO-05:** Per-run cost budget enforced ($0.15 default, configurable)
- **FEYNMINTO-06:** Per-user monthly cap enforced ($10 default, configurable)
- **FEYNMINTO-07:** `/mos:reason --regenerate-all` migrates pre-81 MINTOs to post-81 format with backup
- **FEYNMINTO-08:** Existing deterministic MINTO generator path preserved as tier-0 fallback (no deletion)
- **FEYNMINTO-09:** Feynman stage functions are pure library calls in `lib/memory/feynman-stages.cjs`, not shell-outs to the skill
- **FEYNMINTO-10:** LLM invocation is abstracted via `lib/memory/llm-call.cjs` to support CLI, Desktop, and Cowork surfaces

## What Gets Deleted

Nothing. AAAK stays as fallback. Pre-81 deterministic generator stays as fallback. This phase is additive, not replacive.

## What Gets Renamed or Moved

Nothing in v1.10.2. Naming cleanup (e.g., formalizing the "Feynman-MINTO" terminology across skill files, documentation, user-facing strings) can happen in a follow-up v1.10.3 or be bundled into v1.11.0 beta pipeline work.

## Open Questions for Planner to Resolve

1. **Feynman prompt extraction:** Does the planner extract prompts verbatim from the skill file, or rewrite them as tighter inline-callable versions? The skill's prompts are designed for interactive use with human review. For automation, they may need condensation.

2. **LLM call path in plugin context:** What is the actual mechanism to invoke Claude from inside a CJS script running via `node scripts/...`? Options: (a) shell out to a command that writes to Claude's stdin via the plugin's agent, (b) use the MCP protocol to invoke a Brain-adjacent service, (c) use a local sidecar HTTP endpoint. Planner must pick one and document the chosen mechanism in 81-01.

3. **Cost-free testing strategy:** LLM calls cost money. Tests must not hit production LLM on every run. Options: (a) recorded fixtures (call once, save response, replay in tests), (b) mock LLM service, (c) tag tests with `@live-llm` and skip by default. Planner picks.

4. **Feynman skill changes required?** Does Phase 81 modify the Feynman skill file, or does the skill stay unchanged and Phase 81 just extracts code that references it? Recommend option 2: leave the skill as human-facing reference, extract prompts as library code.

5. **`/mos:budget` command scope:** Minimum viable version shows current spend + cap. Richer version includes per-room breakdown + budget alerts. Which ships in 81-05?

## Upstream Dependencies

- Feynman engine skill must be stable (it is, currently committed in `/home/jsagi/.claude/skills/feynman-engine`)
- LLM access via Claude Code host is required for tier-1 (users who only use CLI via plugin have this automatically; standalone scripts need a path)
- `lib/memory/aaak-compress.cjs` must be committed first (tier-0 fallback dependency)
- `scripts/vault-section-minto-generator.cjs` must be the current structural generator (it is)

## Downstream Consumers

- `/mos:reason` command (existing) routes to the new generator path
- `/mos:recall` command (planned for v1.11.0+) can now load Feynman-MINTOs directly without needing AAAK compression
- Cross-room search is unblocked because Feynman-MINTOs fit in context in bulk
- v1.11.0 release pipeline beta (release.sh, /mos:doctor, etc.) can ship after v1.10.2 without conflict

## Known Non-Goals (explicit)

- **No cross-tool memory.** That was a MemPalace conversation. Phase 81 is purely internal to MindrianOS. Cross-tool is parked.
- **No MCP server refactor.** v3.0 MCP server is separate work. Phase 81 assumes the current plugin architecture.
- **No Brain dependency.** Tier-1 Feynman uses the host LLM (Claude via plugin context), not Brain MCP. Brain enrichment is a possible future enhancement but not in 81.
- **No vector search, no embeddings, no ChromaDB.** Phase 81 relies on the fact that Feynman-MINTOs are small enough that full-text loading replaces semantic search for most use cases. Vector search is a v1.12.0+ concern.
- **No `/mos:recall` implementation.** The retrieval layer that consumes Feynman-MINTOs is v1.11.0+ work. Phase 81 only builds the storage layer.

## Execution Notes for the Planner

- This phase is LLM-heavy and test-brittle because LLM responses are non-deterministic. Invest early in the recorded-fixture pattern so tests are deterministic.
- The tier fallback path is the most important safety feature. Test it hard — force LLM failure in at least 3 different ways (network down, API error, budget exceeded) and verify each falls back cleanly.
- The pre-81 deterministic MINTO generator is the canonical tier-0 output. Do NOT modify it in this phase beyond the fallback wiring. It stays exactly as it was.
- The AAAK library is committed as `lib/memory/aaak-compress.cjs`. Do NOT re-invent compression. Just call it from the tier-0 fallback path.
- CHANGELOG [1.10.2] entry should explicitly document: (a) why v1.10.1 was skipped, (b) the tier-1/tier-0 architecture, (c) the cost model, (d) the migration path for existing MINTOs, (e) the semver deviation (technically should have been 1.11.0, deliberately shipped as 1.10.2 per user directive).

## Status

**DISCUSSED.** Context captured in this file. Next step: `/gsd:plan-phase 81` in a FRESH Claude Code session (strongly recommended — this context is deep).

## Reference

- Feynman engine skill: `~/.claude/skills/feynman-engine`
- Current MINTO generator: `scripts/vault-section-minto-generator.cjs`
- AAAK fallback primitive: `lib/memory/aaak-compress.cjs` (21/21 tests green)
- AAAK test suite: `lib/memory/aaak-compress.test.cjs`
- Prior incident autopsy: `docs/autopsies/2026-04-13-wrong-workspace-incident.md`
- Release pipeline mandate: `.claude/includes/release-process.md`
