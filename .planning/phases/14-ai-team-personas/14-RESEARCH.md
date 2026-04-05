# Phase 14: AI Team Personas - Research

**Researched:** 2026-03-25
**Domain:** AI persona generation from room intelligence, De Bono Six Thinking Hats mapping, dual-delivery CLI+MCP
**Confidence:** HIGH

## Summary

Phase 14 generates domain expert personas from room state and maps them to De Bono's Six Thinking Hats framework. The architecture is straightforward: a new `lib/core/persona-ops.cjs` module reads the room (STATE.md + section content), extracts domain signals (venture domain, team composition, market focus, financial stage), and generates structured persona markdown files in `room/personas/`. Each persona is a constrained perspective lens -- NOT an expert advisor -- that Larry can adopt temporarily for multi-perspective analysis. Every persona output includes a disclaimer.

The existing codebase provides all the infrastructure needed. The section registry already includes `personas` as a known extended section with color `#6C3483`. The `think-hats.md` command and `references/methodology/think-hats.md` reference provide the De Bono framework structure. The pattern from `opportunity-ops.cjs` (YAML frontmatter parsing, room scanning, dual-delivery via mindrian-tools.cjs + tool-router.cjs) is the exact template for persona-ops.cjs. No new npm dependencies are needed. No new Bash scripts are needed -- persona generation is pure Node.js string assembly from room data.

**Primary recommendation:** Build persona-ops.cjs following the opportunity-ops.cjs pattern exactly. Personas are markdown files with YAML frontmatter, generated from room state, stored in `room/personas/`. Larry invokes them by reading the persona file and adopting that perspective. The think-hats command remains separate (interactive methodology session) while personas are persistent perspective lenses available on demand.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERS-01 | Domain expert personas generated from room intelligence as structured markdown in team/ folder | persona-ops.cjs generates personas from STATE.md + section content; stored as `room/personas/{hat-color}-{domain}.md` with YAML frontmatter (hat, domain, perspective, generated_from, disclaimer) |
| PERS-02 | Six Thinking Hats mapped to generated personas -- each argues from a specific perspective | Each persona maps to exactly one De Bono hat; persona generation extracts domain signals from room state and assigns hat-aligned perspective instructions |
| PERS-03 | Larry can invoke personas for multi-perspective analysis on any room artifact | `commands/persona.md` provides `/mos:persona` command; MCP `team_persona` tool added to data_room router; Larry reads persona file + target artifact and produces analysis from that perspective |
| PERS-04 | Personas labeled as "perspective lenses" with disclaimers, never positioned as expert advisors | Every persona file includes `disclaimer` field in frontmatter; every persona output prepends the disclaimer; personas named by hat color + domain, never given human names |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path) | 18+ | File I/O for persona generation and storage | Zero-dependency mandate from Phase 10; matches all existing core modules |
| `lib/core/section-registry.cjs` | existing | Section discovery, personas already registered | `EXTENDED_SECTION_META` has `'personas': { label: 'PERSONAS', color: '#6C3483' }` |
| `lib/core/index.cjs` | existing | `safeReadFile`, `output`, `error` helpers | Shared output pattern used by all core modules |
| `references/methodology/think-hats.md` | existing | De Bono hat definitions, rotation logic, tension mapping | Already defines all 6 hats with colors, purposes, and Larry triggers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `opportunity-ops.cjs` | existing | Pattern reference for YAML frontmatter, room scanning, dual delivery | Copy the `parseFrontmatter` + `listOpportunities` + `fileOpportunity` patterns for persona equivalents |
| `lib/mcp/tool-router.cjs` | existing | MCP tool registration for persona commands | Add persona commands to DATA_ROOM_COMMANDS array |
| `bin/mindrian-tools.cjs` | existing | CLI entry point routing | Add `persona` command group with `generate`, `list`, `invoke`, `analyze` subcommands |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Generating personas as markdown files | Generating on-the-fly each invocation | Persisted files let users review/edit persona definitions; on-the-fly means no user visibility into what Larry is "wearing" |
| Hat-color naming (`white-market-analyst.md`) | Human names (`sarah-cfo.md`) | Human names create anthropomorphization trust bias (Pitfall 7); hat-color naming reinforces "perspective lens" framing |
| Storing in `room/personas/` | Storing in `room/team/` | REQUIREMENTS.md says "team/ folder" but team/ is a STRUCTURAL_DIR (excluded from sections) used for meeting speaker profiles; personas need section treatment for compute-state/analyze-room integration. Use `room/personas/` as the storage location. |

**Installation:**
```bash
# No new dependencies -- pure Node.js built-ins
```

## Architecture Patterns

### Recommended Project Structure
```
lib/core/persona-ops.cjs           # Core persona operations (generate, list, invoke)
commands/persona.md                 # /mos:persona command (CLI surface)
agents/persona-analyst.md           # Larry's persona invocation instructions
references/personas/                # Persona generation templates
  persona-template.md               # YAML frontmatter template for generated personas
  hat-perspectives.md               # Hat-to-domain mapping rules
room/personas/                      # Generated persona files (user's room)
  white-{domain}.md                 # Facts & Data perspective
  red-{domain}.md                   # Emotions & Intuition perspective
  black-{domain}.md                 # Risks & Dangers perspective
  yellow-{domain}.md                # Benefits & Opportunities perspective
  green-{domain}.md                 # Creativity & Alternatives perspective
  blue-{domain}.md                  # Process & Meta perspective
  STATE.md                          # Persona section state (generation date, room hash)
```

### Pattern 1: Persona Generation from Room State
**What:** Read room STATE.md + section content, extract domain signals, generate 6 hat-aligned persona files
**When to use:** When room has content in 2+ sections (otherwise personas are too generic to be useful)

```javascript
// Source: Pattern from opportunity-ops.cjs adapted for personas
function generatePersonas(roomDir) {
  const resolved = path.resolve(roomDir);
  const stateContent = safeReadFile(path.join(resolved, 'STATE.md'));
  if (!stateContent) return { error: 'No room STATE.md found' };

  // Extract domain signals from room sections
  const signals = extractDomainSignals(resolved);
  if (signals.sectionCount < 2) {
    return { error: 'Room needs content in 2+ sections for meaningful personas', sections: signals.sectionCount };
  }

  // Generate one persona per hat
  const hats = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
  const personasDir = path.join(resolved, 'personas');
  fs.mkdirSync(personasDir, { recursive: true });

  const generated = [];
  for (const hat of hats) {
    const persona = buildPersona(hat, signals);
    const filename = `${hat}-${signals.primaryDomain}.md`;
    fs.writeFileSync(path.join(personasDir, filename), persona, 'utf-8');
    generated.push(filename);
  }

  return { generated, domain: signals.primaryDomain, sections_used: signals.sectionCount };
}
```

### Pattern 2: Persona Invocation (Larry Adopts a Perspective)
**What:** Larry reads a persona file + target artifact and produces analysis from that hat's perspective
**When to use:** User asks for multi-perspective analysis on any room artifact

```javascript
// Source: Conceptual pattern for persona invocation
function invokePersona(roomDir, hatColor, artifactPath) {
  const resolved = path.resolve(roomDir);
  const personasDir = path.join(resolved, 'personas');

  // Find persona file matching hat color
  const files = fs.readdirSync(personasDir).filter(f => f.startsWith(hatColor + '-'));
  if (files.length === 0) return { error: `No ${hatColor} hat persona generated. Run persona generate first.` };

  const personaContent = safeReadFile(path.join(personasDir, files[0]));
  const artifactContent = artifactPath ? safeReadFile(path.resolve(artifactPath)) : null;

  return {
    persona: personaContent,
    artifact: artifactContent,
    hat: hatColor,
    // Larry receives this and produces analysis from the persona's perspective
  };
}
```

### Pattern 3: Multi-Perspective Analysis (All Hats on One Artifact)
**What:** Run all 6 personas against a single artifact, producing a tension map
**When to use:** Deep analysis of a critical room artifact (pitch deck section, financial model assumption, etc.)

```javascript
// Source: Mirrors think-hats Phase 3 tension map pattern
function analyzeAllPerspectives(roomDir, artifactPath) {
  const hats = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
  const perspectives = {};
  for (const hat of hats) {
    perspectives[hat] = invokePersona(roomDir, hat, artifactPath);
  }
  return {
    perspectives,
    artifact: artifactPath,
    // Larry produces tension map: where do perspectives disagree?
  };
}
```

### Anti-Patterns to Avoid
- **Human names for personas:** Creates anthropomorphization bias. Use `black-market-analyst` not `Sarah the CFO`. Hat-color naming reinforces the "perspective lens" framing.
- **Personas as autonomous agents:** Personas are files Larry reads, not background processes. They have no memory, no state beyond the room, no independent actions.
- **Personas for knowledge retrieval:** PRISM research (arXiv 2603.18507) proves personas DAMAGE accuracy on factual recall. Use personas for analysis/synthesis/challenge only. Larry handles facts.
- **Generating personas on empty rooms:** 0-1 section content produces generic, useless personas. Require 2+ populated sections before generation.
- **Persona-specific memory:** Personas are regenerated from current room state each time. The room IS the memory. No per-persona conversation history.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom YAML parser | `parseFrontmatter()` from opportunity-ops.cjs | Already handles scalars, lists, nested objects; tested in Phase 13 |
| Room section scanning | Custom directory walker | `discoverSections()` from section-registry.cjs | Already handles core/extended classification, structural dir exclusion |
| CLI command routing | Custom arg parser | mindrian-tools.cjs switch-case pattern | Proven across 35+ subcommands; add `persona` case block |
| MCP tool registration | Custom tool handler | tool-router.cjs DATA_ROOM_COMMANDS pattern | Add persona commands to existing array; Zod schemas already modeled |
| De Bono hat definitions | Inline hat data | `references/methodology/think-hats.md` | Already has all 6 hats with colors, purposes, triggers, phases |
| Larry personality injection | Custom personality loader | `lib/mcp/larry-context.cjs` | Already loads voice-dna, lexicon, assessment-philosophy for MCP |

**Key insight:** Phase 14 is primarily a content generation and file management feature, not a new system. Every infrastructure component already exists. The work is: (1) extract domain signals from room state, (2) generate persona markdown files using hat templates, (3) wire CLI+MCP routing, (4) teach Larry when and how to invoke personas.

## Common Pitfalls

### Pitfall 1: Hallucinated Expert Advice Users Trust
**What goes wrong:** A "Financial Perspective" persona confidently generates projections with no grounding in actual financial data. Users cite persona outputs in investor meetings.
**Why it happens:** Adding a hat/role frame creates perceived credibility even when outputs are identical to non-persona outputs. Hallucination rates: legal 18.7%, financial 15.6%.
**How to avoid:** (1) Name by hat color, never by expert title. (2) Every persona output starts with disclaimer: "This is a perspective lens generated from your room data -- not professional advice." (3) Personas ONLY synthesize from room data -- they reference what exists in the room, never generate new domain facts. (4) Limit to perspectives and questions, never recommendations or projections.
**Warning signs:** Persona output contains specific numbers, legal citations, or regulatory claims not traceable to a room artifact.

### Pitfall 2: Personas That Duplicate think-hats
**What goes wrong:** `/mos:persona` becomes a clone of `/mos:think-hats` with extra steps. Users confused about when to use which.
**Why it happens:** Both use De Bono's Six Hats. The distinction is not obvious without clear framing.
**How to avoid:** think-hats is an INTERACTIVE METHODOLOGY SESSION (walk through all 6 hats in sequence, build tension map, produce artifact). Personas are PERSISTENT PERSPECTIVE LENSES (pre-generated from room state, invoked on demand for specific artifacts). think-hats teaches thinking; personas apply pre-built perspectives. The command documentation must make this distinction crystal clear.
**Warning signs:** Users ask "What's the difference between think-hats and persona?"

### Pitfall 3: Generic Personas from Thin Rooms
**What goes wrong:** User generates personas with only problem-definition filled. All 6 personas say generic things about "the problem" with no venture-specific insight.
**Why it happens:** Persona quality is proportional to room content richness. Empty sections = empty perspectives.
**How to avoid:** Enforce minimum 2 populated sections before generation. Show user which sections contribute to persona quality. Include `sections_used` in generation output so user knows the input quality.
**Warning signs:** All 6 persona files contain near-identical content. No section-specific references in persona text.

### Pitfall 4: Brain Dependency Creep
**What goes wrong:** Persona generation calls Brain MCP for framework connections, making Tier 0 personas useless.
**Why it happens:** Developer always has Brain connected. Tier 0 degradation is invisible.
**How to avoid:** Build and test persona generation entirely from local room state (Tier 0) first. Brain enrichment is an optional enhancement: "Brain says this connects to [framework]." Never a requirement.
**Warning signs:** Persona generation errors or produces empty output when Brain is disconnected.

## Code Examples

### Persona File Format (Generated Output)

```markdown
---
hat: black
hat_label: Risks & Dangers
domain: health-tech-marketplace
perspective: Identify what kills this venture, what fails, what's the worst case
generated_from:
  - problem-definition
  - market-analysis
  - competitive-analysis
  - financial-model
generated_date: 2026-03-25
room_hash: a3f7b2c
disclaimer: "This is a perspective lens generated from your room data. It is NOT professional advice. Validate all insights with qualified professionals."
---

# Black Hat -- Risks & Dangers Perspective

## Who I Am

I examine your health-tech marketplace venture through the lens of risks, dangers, and critical failures. I argue from the pessimist's position -- not to discourage, but to stress-test.

## What I See In Your Room

### From Problem Definition
Your problem statement claims [specific content from room]. The risk: [perspective on that content].

### From Market Analysis
Your market sizing assumes [specific content]. The danger: [perspective].

### From Competitive Analysis
You've identified [N] competitors. What you're missing: [perspective].

### From Financial Model
Your revenue projections show [specific content]. The worst case: [perspective].

## My Questions For You

1. [Specific question grounded in room data]
2. [Specific question grounded in room data]
3. [Specific question grounded in room data]

## Where I Disagree With Other Hats

- **vs Yellow (Benefits):** [anticipated tension]
- **vs Green (Creativity):** [anticipated tension]

---
*This is a perspective lens, not expert analysis. Generated from room state on 2026-03-25.*
```

### Domain Signal Extraction

```javascript
// Source: Pattern adapted from existing room scanning in analyze-room script
function extractDomainSignals(roomDir) {
  const state = safeReadFile(path.join(roomDir, 'STATE.md')) || '';
  const sections = discoverSections(roomDir);
  const signals = {
    primaryDomain: 'venture', // default fallback
    sectionCount: sections.all.length,
    populatedSections: [],
    keyTerms: [],
    ventureStage: 'unknown',
  };

  // Extract domain from problem-definition (most authoritative)
  const problemDir = path.join(roomDir, 'problem-definition');
  if (fs.existsSync(problemDir)) {
    const files = fs.readdirSync(problemDir).filter(f => f.endsWith('.md') && f !== 'STATE.md');
    if (files.length > 0) {
      signals.populatedSections.push('problem-definition');
      // Extract domain keywords from first artifact
      const content = safeReadFile(path.join(problemDir, files[0])) || '';
      signals.keyTerms = extractKeyTerms(content);
      signals.primaryDomain = deriveDomain(signals.keyTerms);
    }
  }

  // Scan each section for content signals
  for (const name of sections.all) {
    const sectionDir = path.join(roomDir, name);
    const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md') && f !== 'STATE.md');
    if (files.length > 0 && !signals.populatedSections.includes(name)) {
      signals.populatedSections.push(name);
    }
  }

  // Extract venture stage from STATE.md
  const stageMatch = state.match(/Stage:\s*(.+)/i);
  if (stageMatch) signals.ventureStage = stageMatch[1].trim();

  return signals;
}
```

### mindrian-tools.cjs Routing Addition

```javascript
// Source: Pattern from existing opportunity command group in mindrian-tools.cjs
case 'persona': {
  switch (subcommand) {
    case 'generate': {
      const result = personaOps.generatePersonas(roomDir);
      output(result, raw, JSON.stringify(result));
      break;
    }
    case 'list': {
      const result = personaOps.listPersonas(roomDir);
      output(result, raw, JSON.stringify(result));
      break;
    }
    case 'invoke': {
      const hatColor = argv[3];
      const artifactPath = argv[4];
      const result = personaOps.invokePersona(roomDir, hatColor, artifactPath);
      output(result, raw, JSON.stringify(result));
      break;
    }
    case 'analyze': {
      const artifactPath = argv[3];
      const result = personaOps.analyzeAllPerspectives(roomDir, artifactPath);
      output(result, raw, JSON.stringify(result));
      break;
    }
    default:
      error(`Unknown persona subcommand: ${subcommand}\n\n${USAGE}`);
  }
  break;
}
```

### MCP Tool Router Addition

```javascript
// Source: Pattern from DATA_ROOM_COMMANDS in tool-router.cjs
const DATA_ROOM_COMMANDS = [
  'status', 'list-sections', 'analyze', 'compute-state', 'get-state',
  'new-project', 'setup', 'update', 'help', 'suggest-next',
  'scan-opportunities', 'list-opportunities', 'file-opportunity',
  'list-funding', 'create-funding', 'update-funding-stage',
  // Phase 14: Persona commands
  'generate-personas', 'list-personas', 'invoke-persona', 'analyze-perspectives'
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic role prompts ("You are a CFO") | Data-generated personas from actual project content | PRISM (2026-03), PersonaCite (2026-01) | Generic roles produce canned advice; data-generated personas produce venture-specific insights |
| Personas for all tasks | Selective activation (analysis/synthesis only) | PRISM (2026-03) | Personas DAMAGE accuracy on knowledge retrieval tasks; must route intelligently |
| Independent personas (each works alone) | Coherence cascade (sequential, each reads prior) | Mandal (2026-03) | Independent personas contradict each other; dependency chain creates coherent multi-perspective analysis |
| Expert advisor framing | Perspective lens framing | Community consensus (2025-2026) | Expert framing creates false credibility and legal liability; lens framing sets correct expectations |

**Deprecated/outdated:**
- Persona memory across sessions: Room IS the memory. Per-persona state creates drift.
- Autonomous persona agents: Overhead without value. Larry orchestrates; personas are data files.
- Named expert personas ("Sarah the CFO"): Anthropomorphization creates over-trust. Hat-color naming is safer.

## Open Questions

1. **Storage location: `room/personas/` vs `room/team/`**
   - What we know: REQUIREMENTS.md says "team/ folder." But `team/` is a `STRUCTURAL_DIR` in section-registry.cjs (excluded from section discovery). Personas need section treatment for compute-state and analyze-room integration.
   - What's unclear: Whether the requirement means literally `team/` or just "the team-related area of the room."
   - Recommendation: Use `room/personas/` (already registered as an extended section). Add a note in the persona command that personas complement the team/ speaker profiles but are stored separately. If the user explicitly wants `team/`, we'd need to either remove `team` from STRUCTURAL_DIRS or add special handling.

2. **Persona regeneration trigger**
   - What we know: Personas should reflect current room state. Room state changes after every methodology session and meeting filing.
   - What's unclear: Should personas auto-regenerate on session-start? Or only on explicit `persona generate` command?
   - Recommendation: Explicit generation only. Auto-regeneration on session-start adds latency and noise. Larry can suggest "Your room has changed since personas were generated -- want to refresh?" based on `room_hash` comparison.

3. **Coherence cascade (multi-persona chaining)**
   - What we know: Mandal (2026) shows sequential persona invocation with dependency (each reads prior) produces better coherence.
   - What's unclear: Whether to implement the full cascade in Phase 14 or defer to a follow-up.
   - Recommendation: Implement `analyze-perspectives` (all 6 hats on one artifact) in Phase 14. Full cascade with dependency ordering is a natural Phase 14.x enhancement if users find single-hat invocation too narrow.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash test scripts (test-*.sh) with assertion counting |
| Config file | `tests/run-all.sh` (test runner) |
| Quick run command | `bash tests/test-phase-14.sh` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-01 | Personas generated as structured markdown in personas/ | unit | `bash tests/test-phase-14.sh` (assert file creation, frontmatter parsing) | Wave 0 |
| PERS-02 | Each persona maps to a De Bono hat | unit | `bash tests/test-phase-14.sh` (assert 6 files with correct hat frontmatter) | Wave 0 |
| PERS-03 | Larry can invoke persona for analysis | integration | `node bin/mindrian-tools.cjs persona invoke ./room black` (assert returns persona + artifact content) | Wave 0 |
| PERS-04 | Disclaimer present in every persona | unit | `bash tests/test-phase-14.sh` (grep disclaimer in each generated file) | Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/test-phase-14.sh`
- **Per wave merge:** `bash tests/run-all.sh`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test-phase-14.sh` -- covers PERS-01 through PERS-04
- [ ] `tests/fixtures/sample-room-personas/` -- test room with 3+ populated sections for persona generation testing
- [ ] `tests/golden/persona-black-sample.md` -- golden file for persona output validation

## Sources

### Primary (HIGH confidence)
- Existing codebase: `lib/core/opportunity-ops.cjs` -- proven pattern for new room section operations (YAML frontmatter, filing, listing, dual delivery)
- Existing codebase: `lib/core/section-registry.cjs` line 33 -- `personas` already registered as extended section
- Existing codebase: `references/methodology/think-hats.md` -- complete De Bono Six Hats reference with phases, triggers, artifact template
- Existing codebase: `commands/think-hats.md` -- interactive methodology command (personas must complement, not replace)
- Existing codebase: `bin/mindrian-tools.cjs` -- CLI routing pattern for adding `persona` command group
- Existing codebase: `lib/mcp/tool-router.cjs` -- MCP tool registration pattern for adding persona commands

### Secondary (MEDIUM confidence)
- [PRISM: Expert Personas (arXiv 2603.18507)](https://arxiv.org/html/2603.18507) -- personas improve alignment but damage accuracy on knowledge retrieval
- [Mandal (2026): Role-Based Agent Personas](https://www.sagarmandal.com/2026/03/15/agentic-engineering-part-3-role-based-agent-personas-why-specialization-beats-generalization/) -- coherence cascade pattern, sequential dependency
- [PersonaCite (arXiv 2601.22288)](https://arxiv.org/html/2601.22288v1) -- data-generated personas outperform templates

### Tertiary (LOW confidence)
- [AI Hallucination Statistics 2026](https://suprmind.ai/hub/insights/ai-hallucination-statistics-research-report-2026/) -- domain-specific hallucination rates (survey, not peer-reviewed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All infrastructure exists in codebase. Zero new dependencies. Pattern is copy-from-Phase-13.
- Architecture: HIGH -- Room section pattern proven across 10+ sections. Section registry pre-configured. CLI and MCP routing patterns established.
- Pitfalls: MEDIUM -- Hallucination risk data from survey (not peer-reviewed). Anthropomorphization risk well-documented in multiple sources. Generic persona risk observed empirically but not formally studied.

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain -- no external API dependencies, no evolving specs)
