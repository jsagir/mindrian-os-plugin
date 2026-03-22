# Phase 3: Pipeline Chaining and Proactive Intelligence - Research

**Researched:** 2026-03-22
**Domain:** Methodology pipeline orchestration + proactive Room intelligence (gap/contradiction/convergence detection)
**Confidence:** HIGH

## Summary

Phase 3 builds two tightly coupled capabilities on top of the 26 methodology commands delivered in Phase 2: (1) pipeline chaining -- multi-step methodology sequences where each framework's output feeds the next as structured input, and (2) proactive Room intelligence -- gap detection, contradiction alerts, and convergence signals.

The infrastructure is well-prepared. The `pipelines/` directory exists but is empty. The `skills/room-proactive/` directory exists with only a SKILL.md placeholder (currently empty file). Every methodology reference already has a `Cross-References` section listing 3-4 natural successor commands. The `diagnose` command already produces a "Recommended Methodology Sequence" artifact with priority-ranked commands -- this is effectively a proto-pipeline. The `compute-state` script already detects empty Room sections (gap detection) and cross-references between entries. The `classify-insight` script handles keyword-based artifact classification. All 26 commands produce artifacts with consistent YAML frontmatter (`methodology`, `created`, `depth`, `problem_type`, `venture_stage`, `room_section`).

**Primary recommendation:** Build pipeline stage contracts as numbered markdown files in `pipelines/` that define input extraction rules, stage-specific prompts, and output templates. The proactive skill should operate as a SessionStart analysis layer that reads Room state and surfaces findings with confidence scores, gated by a noise threshold.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | Pipeline stage contracts (numbered markdown files) define multi-step methodology workflows | Stage contract format defined below; each stage is a markdown file with input schema, transformation instructions, and output template |
| PIPE-02 | Output of one pipeline becomes structured input to the next (Week 7 chaining pattern) | Artifact YAML frontmatter provides structured metadata; artifact body sections provide extractable content via section headers |
| PIPE-03 | User can run at least 2-3 key pipeline sequences end-to-end | Two sequences defined: Discovery Pipeline (explore-domains -> think-hats -> analyze-needs) and Thesis Pipeline (structure-argument -> challenge-assumptions -> build-thesis) |
| PIPE-04 | Pipeline execution produces inspectable artifacts at each stage filed to Room sections | Each stage produces its own artifact using its methodology's existing template, with pipeline provenance added to frontmatter |
| PROA-01 | Room proactive skill detects gaps in Data Room sections and surfaces suggestions | compute-state already identifies empty sections; proactive skill adds semantic gap detection (e.g., "market-analysis has entries but no customer evidence") |
| PROA-02 | Room proactive skill detects contradictions between Room sections | Cross-section analysis comparing claims in different Room entries (e.g., "problem-definition says B2B but business-model targets consumers") |
| PROA-03 | Room proactive skill detects convergence signals | Multiple frameworks pointing to same insight detected by comparing key claims/themes across Room entries |
| PROA-04 | Proactive suggestions include confidence scores and are gated to prevent noise | Three-tier confidence (HIGH/MEDIUM/LOW) with configurable threshold; only HIGH shown by default |
</phase_requirements>

## Standard Stack

### Core

This phase adds no new libraries or external dependencies. Everything is markdown files, bash scripts, and Claude skill instructions -- consistent with the zero-dependency Tier 0 architecture.

| Component | Format | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| Pipeline stage contracts | Numbered `.md` files in `pipelines/{chain-name}/` | Define multi-step methodology workflows | Matches established thin-command pattern; markdown is the universal format |
| room-proactive SKILL.md | Skill markdown | Proactive intelligence instructions for Claude | Follows existing skill pattern (larry-personality, room-passive) |
| Proactive analysis script | Bash in `scripts/` | Compute gaps, contradictions, convergence from Room state | Follows compute-state pattern; fast, deterministic |

### Supporting

| Component | Format | Purpose | When to Use |
|-----------|--------|---------|-------------|
| Pipeline runner command | `commands/pipeline.md` | `/mindrian-os:pipeline` slash command to start/resume pipelines | User-facing entry point |
| Pipeline reference | `references/pipeline/` directory | Chain definitions, stage contracts, input/output schemas | Loaded on demand by pipeline command |
| Proactive findings cache | `room/.proactive-cache.md` | Persisted analysis results to avoid recomputation | Written by proactive analysis, read by SessionStart |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Markdown stage contracts | JSON/YAML pipeline definitions | Markdown is readable by Claude and humans; JSON would need parsing. Markdown wins for this context. |
| Bash proactive script | Pure skill instructions (Claude analyzes Room live) | Bash pre-computation is faster and deterministic; Claude analysis adds depth for uncertain cases. Use both: bash for fast detection, skill for interpretation. |
| Single `/mindrian-os:pipeline` command | Separate commands per chain | Single command with chain selection is cleaner; avoids polluting the command namespace with 5+ pipeline variants |

## Architecture Patterns

### Recommended Project Structure

```
MindrianOS-Plugin/
├── pipelines/
│   ├── discovery/              # Discovery Pipeline chain
│   │   ├── 01-explore-domains.md   # Stage 1 contract
│   │   ├── 02-think-hats.md        # Stage 2 contract
│   │   ├── 03-analyze-needs.md     # Stage 3 contract
│   │   └── CHAIN.md                # Chain metadata and overview
│   └── thesis/                 # Thesis Pipeline chain
│       ├── 01-structure-argument.md
│       ├── 02-challenge-assumptions.md
│       ├── 03-build-thesis.md
│       └── CHAIN.md
├── commands/
│   └── pipeline.md             # /mindrian-os:pipeline command
├── skills/
│   └── room-proactive/
│       └── SKILL.md            # Proactive intelligence skill (populated)
├── scripts/
│   └── analyze-room             # Proactive analysis script
└── references/
    └── pipeline/
        └── chains-index.md      # Available chains and their descriptions
```

### Pattern 1: Pipeline Stage Contract Format

**What:** Each stage file defines what input it needs from the previous stage, how to transform it, and what output it produces.
**When to use:** Every pipeline stage.

```markdown
---
stage: 1
methodology: explore-domains
chain: discovery
input_from: null  # First stage -- no prior input
output_to: think-hats
room_section: problem-definition
---

# Stage 1: Domain Explorer

## Input Extraction
(First stage -- uses user's topic/problem description directly)

## Stage Instructions
Run /mindrian-os:explore-domains with the user's topic.
Focus the session on producing:
- Domain Statement (1 sentence)
- Top 3 intersectional collisions ranked by surprise level
- IKA scores with evidence

## Output Contract
The following sections from the artifact feed into the next stage:

### For Stage 2 (think-hats):
- **Domain Statement** -> becomes the topic for Six Thinking Hats exploration
- **Top collision territory** -> becomes the specific challenge to examine from 6 perspectives
- **IKA weak spots** -> become specific areas for Black Hat (risk) analysis
```

### Pattern 2: Chain Metadata (CHAIN.md)

**What:** Each pipeline directory has a CHAIN.md defining the chain's purpose, when to use it, and the stage sequence.
**When to use:** Every pipeline chain.

```markdown
---
name: discovery
display_name: Discovery Pipeline
description: From domain territory to customer needs -- explore, challenge, validate
stages: 3
estimated_time: 45-90min
venture_stages: [Pre-Opportunity, Discovery]
problem_types: [undefined-complex, undefined-complicated, ill-defined-complex]
---

# Discovery Pipeline

## When to Use
User has a vague idea or domain interest and needs to move from "I think this is interesting" to "here's who has the problem and what they need."

## Stage Sequence
1. **explore-domains** -> Map the territory, find intersections, score IKA
2. **think-hats** -> Examine the top domain from 6 perspectives
3. **analyze-needs** -> Identify specific jobs-to-be-done for the customer segment

## What It Produces
After all 3 stages, the Room will have:
- problem-definition: Domain Explorer artifact with territory map
- solution-design: Six Hats analysis with perspective tensions
- market-analysis: JTBD artifact with customer job priorities

## Chain Provenance
Each artifact includes `pipeline: discovery` and `stage: N` in frontmatter,
creating an inspectable provenance chain.
```

### Pattern 3: Pipeline-Augmented Artifact Frontmatter

**What:** Pipeline artifacts extend the standard methodology frontmatter with pipeline provenance.
**When to use:** Any artifact produced during pipeline execution.

```yaml
---
methodology: think-hats
created: 2026-03-25
depth: deep
problem_type: undefined/complex
venture_stage: Discovery
room_section: solution-design
pipeline: discovery
pipeline_stage: 2
pipeline_input: "Domain Statement: 'Predictive maintenance for aging municipal water systems'"
---
```

### Pattern 4: Proactive Intelligence -- Three Detectors

**What:** The room-proactive skill runs three analysis modes.
**When to use:** SessionStart and on-demand via status command.

**Detector 1 -- Gap Detection:**
- Read Room STATE.md (computed by existing compute-state script)
- Identify empty sections (already done by compute-state)
- Add semantic gaps: sections with entries that lack specific content types
- Example: "market-analysis has trend analysis but no customer evidence -- consider /mindrian-os:analyze-needs"

**Detector 2 -- Contradiction Detection:**
- Compare claims across Room entries by scanning for assertion patterns
- Flag when entries in different sections make incompatible claims
- Example: "problem-definition says 'B2B enterprise' but lean-canvas targets 'individual consumers'"

**Detector 3 -- Convergence Detection:**
- Identify when multiple frameworks point to the same insight
- Scan for repeated themes, names, domains, or conclusions across Room entries
- Example: "3 frameworks (Domain Explorer, JTBD, Six Hats) all point to 'water infrastructure aging' -- this convergence suggests strong problem signal"

### Pattern 5: Proactive Noise Gating

**What:** Confidence scoring and display thresholds prevent overwhelming the user.
**When to use:** All proactive suggestions.

```
Confidence scoring:
- HIGH (show always): Direct evidence from Room entries, structural gap (empty section)
- MEDIUM (show on request): Inferred from partial evidence, keyword overlap
- LOW (suppress by default): Weak signal, single-source inference

Display rules:
- SessionStart greeting: Show at most 2 HIGH-confidence findings
- /mindrian-os:status: Show all HIGH + MEDIUM findings
- /mindrian-os:room --insights: Show all findings including LOW
- Never interrupt a methodology session with proactive findings
```

### Anti-Patterns to Avoid

- **Pipeline as rigid workflow:** Pipelines are SUGGESTED sequences, not mandatory. Users can skip stages, reorder, or exit at any point. The pipeline command should make this clear.
- **Silent artifact modification:** Pipeline stages must NEVER modify previous stage artifacts. Each stage creates its own artifact. Provenance chain is read-only.
- **Proactive noise flooding:** The #1 risk is overwhelming users with low-value alerts. Default to suppression. Only HIGH-confidence findings surface in greeting.
- **Duplicate compute-state logic:** The proactive script should CALL compute-state and augment its output, not duplicate the section-scanning logic.
- **Pipeline-only methodology access:** All methodologies must remain independently invocable. Pipeline is an orchestration layer on top, never a gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact parsing | Custom markdown parser | Section header extraction via grep/awk in bash | Artifacts follow consistent markdown structure; regex on `## Section Name` is reliable and fast |
| State computation | New state system | Existing `compute-state` script + augmentation | Already handles section counting, venture stage inference, cross-references |
| Classification | New classification system | Existing `classify-insight` script | Already handles keyword-based room section routing |
| Chain recommendation | Complex routing engine | Static CHAIN.md files + diagnose command routing | Diagnose already produces "Recommended Methodology Sequence"; pipelines formalize this |

**Key insight:** Most of the infrastructure for Phase 3 already exists in embryonic form. compute-state does gap detection. diagnose does chain recommendation. Cross-References in methodology files define the chain graph. Phase 3 formalizes and operationalizes what is already implicit.

## Common Pitfalls

### Pitfall 1: Over-Engineering the Pipeline Engine
**What goes wrong:** Building a complex state machine or orchestration engine when the pipeline is really just "run methodology A, extract output, feed to methodology B."
**Why it happens:** Pipeline terminology suggests complex workflow engines.
**How to avoid:** Each pipeline stage is a methodology command invocation with pre-loaded context from the previous stage. The "engine" is Larry reading the stage contract and following its instructions. No state machine needed.
**Warning signs:** If you're writing code to manage pipeline state transitions, you've over-engineered it.

### Pitfall 2: Breaking Methodology Independence
**What goes wrong:** Making methodologies behave differently inside vs outside pipelines, or requiring pipeline context to function.
**Why it happens:** Adding pipeline-specific logic to methodology commands.
**How to avoid:** Pipeline stages wrap methodology commands with input extraction instructions. The methodology command itself does not know it is in a pipeline. The stage contract tells Larry what to extract and inject.
**Warning signs:** If you're modifying existing command files or reference files to add pipeline awareness.

### Pitfall 3: Proactive Intelligence That Cries Wolf
**What goes wrong:** Every session greets the user with 5+ suggestions, most obvious or irrelevant.
**Why it happens:** Easy to detect gaps (empty sections are obvious) but hard to assess relevance.
**How to avoid:** Gate aggressively. Show at most 2 findings in greeting. Use venture stage to filter relevance -- don't suggest financial-model work to a Pre-Opportunity user.
**Warning signs:** If the proactive greeting is longer than 3 lines, it is too noisy.

### Pitfall 4: Contradiction Detection False Positives
**What goes wrong:** Flagging natural evolution as contradiction (e.g., early "B2C" pivot to "B2B" is not a contradiction, it is progress).
**Why it happens:** Comparing entries without temporal context.
**How to avoid:** Include artifact dates in contradiction analysis. Recent entries override earlier ones. Only flag contradictions between entries from the same time period or between entries that both claim to be current.
**Warning signs:** If the system flags more than 1 contradiction per 10 Room entries, sensitivity is too high.

### Pitfall 5: Pipelines That Feel Like Railroads
**What goes wrong:** User feels forced through a rigid sequence with no escape.
**Why it happens:** Pipeline framing implies mandatory progression.
**How to avoid:** Every stage ends with options: "Continue to Stage 2?", "Take a detour?", "Stop here?" Larry should explicitly name what the pipeline suggests AND offer alternatives.
**Warning signs:** If there is no way to exit a pipeline mid-flow, the design is wrong.

## Code Examples

### Pipeline Command Structure

```markdown
---
name: pipeline
description: Run a multi-step methodology sequence -- frameworks chain output to input
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
disable-model-invocation: true
---

# /mindrian-os:pipeline

You are Larry. This command orchestrates multi-step methodology chains.

## Setup

1. Read `references/pipeline/chains-index.md` for available pipelines
2. Read `room/STATE.md` for venture context
3. Read `references/methodology/problem-types.md` for routing awareness

## Session Flow

If user specifies a pipeline: Load `pipelines/{name}/CHAIN.md` and start Stage 1.
If user does not specify: Recommend based on venture stage and room state.

For each stage:
1. Read the stage contract `pipelines/{chain}/{NN}-{methodology}.md`
2. Extract input from previous stage's artifact (if not Stage 1)
3. Present the extracted input to the user: "From your {previous} work, I'm bringing forward: {extracted data}"
4. Run the methodology command with the extracted context pre-loaded
5. When the methodology produces its artifact, add pipeline provenance to frontmatter
6. Ask: "Stage {N} complete. Continue to {next stage name}? Or take a different path?"

## When Complete

Summarize the full chain: what was produced, where it was filed, and what the provenance chain shows.
Suggest next steps based on what the pipeline revealed.
```

### Proactive Room Skill (room-proactive/SKILL.md)

```markdown
---
name: room-proactive
description: >
  Proactive Data Room intelligence. Surfaces gaps, contradictions, and
  convergence signals. Active when room/ exists with entries.
---

# Room Proactive -- Gap, Contradiction, and Convergence Detection

## When to Activate

- SessionStart: Run lightweight analysis, surface at most 2 HIGH-confidence findings
- /mindrian-os:status: Include all HIGH + MEDIUM findings in status output
- /mindrian-os:room --insights: Full analysis including LOW confidence

## Gap Detection

Beyond empty sections (already detected by compute-state), detect semantic gaps:
- Section has entries but all from same methodology (single-lens analysis)
- Section has entries but none with evidence/validation
- Adjacent sections have entries but connecting section is empty
  (e.g., problem-definition and solution-design filled, but market-analysis empty)

Phrase gaps as opportunities: "Your market-analysis room has trend data but no customer
evidence -- consider /mindrian-os:analyze-needs to ground the trends in real needs."

## Contradiction Detection

Scan Room entries for incompatible claims across sections:
- Compare target customer descriptions across entries
- Compare market size assertions across entries
- Compare problem definitions across entries
- Compare timing assumptions across entries

Phrase contradictions as tensions: "Your Domain Explorer says 'enterprise IT' but your
Lean Canvas targets 'individual developers' -- worth reconciling which customer you're
really serving."

IMPORTANT: Only flag contradictions between entries from similar time periods.
Natural pivots (earlier entry says X, recent entry says Y) are progress, not contradictions.

## Convergence Detection

Identify when multiple frameworks reach similar conclusions:
- Same domain/topic mentioned in 3+ artifacts
- Same customer segment identified by different methodologies
- Same risk flagged by multiple analyses
- Same opportunity identified from different angles

Phrase convergence as signal strength: "Three of your frameworks (Domain Explorer, JTBD,
Six Hats) independently identified 'aging water infrastructure' -- this convergence
suggests a strong problem signal worth pursuing."

## Confidence Scoring

| Level | Criteria | Display |
|-------|----------|---------|
| HIGH | Direct structural evidence, 3+ supporting entries | Show in greeting |
| MEDIUM | 2 supporting entries, keyword overlap | Show in status |
| LOW | Single entry inference, weak keyword match | Show only on request |

## Noise Gate

- SessionStart: MAX 2 findings. Prioritize: 1 gap + 1 convergence (or contradiction).
- Never interrupt a methodology session with proactive findings.
- If venture stage is Pre-Opportunity, suppress financial-model and legal-ip gap alerts.
- If venture stage is Investment, elevate gap alerts for empty sections.
```

### Proactive Analysis Script (scripts/analyze-room)

```bash
#!/usr/bin/env bash
# analyze-room -- Proactive Room analysis for gaps, contradictions, convergence
# Augments compute-state output with semantic analysis
# Called by SessionStart hook (via proactive skill) and status command

set -euo pipefail

ROOM_DIR="${1:-.}/room"

if [ ! -d "$ROOM_DIR" ]; then
  echo "NO_ROOM"
  exit 0
fi

# --- GAP DETECTION ---
echo "## Gaps"

SECTIONS="problem-definition market-analysis solution-design business-model competitive-analysis team-execution legal-ip financial-model"

for section in $SECTIONS; do
  section_dir="$ROOM_DIR/$section"
  [ -d "$section_dir" ] || continue

  count=$(find "$section_dir" -maxdepth 1 -name "*.md" ! -name "ROOM.md" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$count" -eq 0 ]; then
    echo "GAP:STRUCTURAL:$section:HIGH:Section is empty"
  elif [ "$count" -eq 1 ]; then
    # Single-lens check: all entries from same methodology?
    methodology=$(head -20 "$section_dir"/*.md 2>/dev/null | grep "^methodology:" | head -1 | cut -d: -f2 | tr -d ' ')
    if [ -n "$methodology" ]; then
      echo "GAP:SEMANTIC:$section:MEDIUM:Only analyzed via $methodology -- consider additional perspectives"
    fi
  fi
done

# --- CONVERGENCE DETECTION ---
echo "## Convergence"

# Extract key themes from all Room entries (top nouns/phrases from ## headers and bold text)
all_entries=$(find "$ROOM_DIR" -name "*.md" ! -name "ROOM.md" ! -name "STATE.md" 2>/dev/null)

if [ -n "$all_entries" ]; then
  # Simple theme extraction: find repeated terms across entries in different sections
  themes=$(echo "$all_entries" | xargs grep -h "^## \|^\*\*" 2>/dev/null | \
    tr '[:upper:]' '[:lower:]' | \
    tr -cs '[:alpha:]' '\n' | \
    sort | uniq -c | sort -rn | \
    awk '$1 >= 3 && length($2) > 4 {print "CONVERGE:" $2 ":" $1 ":MEDIUM:Appears in " $1 " entries"}' | \
    head -5)

  if [ -n "$themes" ]; then
    echo "$themes"
  fi
fi

echo "## End"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual framework chaining (user decides next step) | Cross-References in each methodology suggest next steps | Phase 2 (current) | Users get suggestions but must navigate manually |
| No proactive intelligence | compute-state detects empty sections | Phase 1 (current) | Structural gaps detected but not surfaced proactively |
| diagnose recommends sequence | diagnose produces "Recommended Methodology Sequence" artifact | Phase 2 (current) | Proto-pipeline exists but is not executable |

**What Phase 3 changes:**
- Cross-References become formalized pipeline stage contracts
- compute-state gap detection becomes proactive intelligence with semantic analysis
- diagnose's recommended sequence becomes an executable pipeline command

## Open Questions

1. **Pipeline resumability across sessions**
   - What we know: SessionStart hook loads Room state. Pipeline artifacts have pipeline provenance in frontmatter.
   - What's unclear: Should there be explicit pipeline state tracking (e.g., `room/.pipeline-state.md`) or should Larry infer progress from existing artifacts?
   - Recommendation: Infer from artifacts. If `room/problem-definition/` has an artifact with `pipeline: discovery, pipeline_stage: 1`, Larry knows Stage 1 is complete. No separate state file needed.

2. **Number of pipeline chains to ship**
   - What we know: Requirements say "at least 2-3 key pipeline sequences." Success criteria specify exactly 2.
   - What's unclear: Whether to build exactly 2 or prepare the infrastructure for easy addition.
   - Recommendation: Build exactly 2 (Discovery + Thesis) with the generic pipeline runner. The pattern makes additional chains trivial to add.

3. **Proactive skill loading strategy**
   - What we know: plugin.json currently loads room-passive but not room-proactive.
   - What's unclear: Should room-proactive be auto-loaded (skill in plugin.json) or loaded on demand?
   - Recommendation: Add to plugin.json skills array. The skill file is lightweight (instructions only). The expensive analysis only runs when triggered by hooks.

4. **Interaction between proactive findings and diagnose command**
   - What we know: diagnose recommends methodology sequences. Proactive findings suggest gaps to fill.
   - What's unclear: Should diagnose incorporate proactive findings?
   - Recommendation: Yes. When diagnose runs, it should check proactive cache and factor gap/convergence data into recommendations.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bash integration tests (no external framework needed) |
| Config file | None -- see Wave 0 |
| Quick run command | `bash tests/test-pipeline.sh` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | Pipeline stage contracts exist and have required frontmatter fields | unit | `bash tests/test-pipeline-contracts.sh` | Wave 0 |
| PIPE-02 | Stage N output sections match Stage N+1 input extraction | unit | `bash tests/test-pipeline-chaining.sh` | Wave 0 |
| PIPE-03 | Two pipeline sequences have all stage files | smoke | `bash tests/test-pipeline-completeness.sh` | Wave 0 |
| PIPE-04 | Pipeline artifacts include pipeline provenance in frontmatter | unit | `bash tests/test-pipeline-provenance.sh` | Wave 0 |
| PROA-01 | analyze-room detects empty sections as gaps | unit | `bash tests/test-proactive-gaps.sh` | Wave 0 |
| PROA-02 | Contradiction detection flags incompatible claims | integration | `bash tests/test-proactive-contradictions.sh` | Wave 0 |
| PROA-03 | Convergence detection identifies repeated themes | integration | `bash tests/test-proactive-convergence.sh` | Wave 0 |
| PROA-04 | Noise gating suppresses LOW-confidence findings in greeting | unit | `bash tests/test-proactive-gating.sh` | Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/test-pipeline.sh` (covers PIPE-01 through PIPE-04)
- **Per wave merge:** `bash tests/run-all.sh` (all tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test-pipeline-contracts.sh` -- validates stage contract frontmatter fields
- [ ] `tests/test-pipeline-chaining.sh` -- validates output-to-input mapping between stages
- [ ] `tests/test-pipeline-completeness.sh` -- validates both chain directories have all files
- [ ] `tests/test-pipeline-provenance.sh` -- validates pipeline frontmatter in sample artifacts
- [ ] `tests/test-proactive-gaps.sh` -- creates mock Room, runs analyze-room, checks gap output
- [ ] `tests/test-proactive-contradictions.sh` -- creates mock Room with contradicting entries
- [ ] `tests/test-proactive-convergence.sh` -- creates mock Room with converging themes
- [ ] `tests/test-proactive-gating.sh` -- validates confidence level filtering
- [ ] `tests/run-all.sh` -- runs all test scripts

## Sources

### Primary (HIGH confidence)
- **Project codebase:** All 26 methodology command files, 26 reference files, all scripts, all skills
- **Cross-References sections** in every methodology reference -- defines the implicit chain graph
- **compute-state script** -- existing gap detection and venture stage inference
- **classify-insight script** -- existing keyword-based room classification
- **diagnose reference** -- existing "Recommended Methodology Sequence" artifact template
- **framework-chains.md** -- existing chain patterns by problem type and delivery mode
- **CLAUDE.md** -- architecture, tri-polar design rule, moat analysis
- **pws-week-7-combining-tools.md** -- Lawrence Aronhime's combining frameworks pedagogy

### Secondary (MEDIUM confidence)
- **Plugin architecture patterns** -- extrapolated from Phase 1-2 established patterns (three-file methodology, skill loading, hook routing)

### Tertiary (LOW confidence)
- None -- all findings are grounded in existing codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; builds on established patterns
- Architecture: HIGH -- pipeline and proactive patterns directly extend existing infrastructure
- Pitfalls: HIGH -- identified from actual codebase constraints and UX principles in CLAUDE.md

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable; no external dependencies to change)
