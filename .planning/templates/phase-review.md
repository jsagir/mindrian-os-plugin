# Phase {N} Review: {Phase Name}

**Date:** {YYYY-MM-DD}
**Reviewer:** {name}
**Phase Status:** {complete | partial | blocked}

---

## Goal Achievement

**Phase Goal:** {one-line goal from ROADMAP.md}

**Achieved:** {yes | partially | no}

**Summary:** {2-3 sentences describing what was accomplished vs. what was planned}

---

## Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| {REQ-ID} | {done | partial | not started | deferred} | {brief note} |

**Coverage:** {N}/{M} requirements completed ({percentage}%)

---

## Quality Assessment

### Code Quality

- [ ] All scripts syntactically valid (no parse errors)
- [ ] No npm dependencies added (unless justified and approved)
- [ ] Follows existing codebase patterns (bash+node, YAML frontmatter, graceful degradation)
- [ ] Error handling: fails gracefully, never blocks room operation
- [ ] Three-surface compatibility verified (CLI, Desktop, Cowork)

### Test Coverage

- [ ] Manual verification performed
- [ ] Edge cases considered (empty room, missing files, no Brain connection)
- [ ] Tier 0 (no dependencies) mode tested

### Documentation

- [ ] Commands documented with YAML frontmatter and usage examples
- [ ] Architecture decisions recorded in STATE.md
- [ ] CHANGELOG.md updated if user-facing changes

---

## Moat Deepening Assessment (MANDATORY)

This section is required for every phase review. A phase that adds surface area without deepening the moat should be flagged.

### MWP Layers Touched

Which of the 7 MWP layers were modified or extended by this phase?

- [ ] Layer 1: Folder Hierarchy
- [ ] Layer 2: Artifact Provenance
- [ ] Layer 3: Cascade Pipeline
- [ ] Layer 4: MINTO Reasoning
- [ ] Layer 5: HSI Innovation Discovery
- [ ] Layer 6: Proactive Intelligence Loop
- [ ] Layer 7: Brain Enrichment

**Layers touched:** {N}/7

### Integration Strengthening

How did this phase strengthen the connections BETWEEN layers?

{Description of how layers now interact more deeply. Example: "Added REASONING_INFORMS edges that connect Layer 4 (MINTO) to Layer 3 (Cascade) - reasoning changes now trigger edge updates."}

### What Became Harder to Replicate

What specific aspect of this phase's work would a competitor have difficulty reproducing?

{Description. Example: "Spectral OM-HMM requires domain-specific calibration of thinking-mode regex patterns against real venture text - not just implementing the math."}

### New Edge Types or Properties

Were any new KuzuDB edge types added or existing edge properties enriched?

- {edge type: description of addition/change}

### Compounding Value

Does this phase create value that compounds with usage?

- [ ] User decisions feed back into the system
- [ ] More data improves accuracy
- [ ] Cross-session patterns become visible
- [ ] Brain intelligence gets richer

### Moat Score

Rate the moat impact of this phase (1-5):

| Score | Meaning |
|-------|---------|
| 1 | Pure surface area (no moat impact) |
| 2 | Minor moat (touches 1 layer, no integration) |
| 3 | Moderate moat (touches 2+ layers, some integration) |
| 4 | Strong moat (deepens integration, harder to replicate) |
| 5 | Critical moat (creates compounding value, research contribution) |

**This phase's moat score:** {1-5}

**Justification:** {why this score}

---

## Issues and Blockers

### Resolved During Phase

- {issue-1: what happened, how it was resolved}

### Deferred

- {issue-1: what it is, why it was deferred, which future phase should address it}

---

## Recommendations for Next Phase

- {recommendation-1}
- {recommendation-2}

---

_Phase review template v1.0 - See docs/MOAT-MANDATE.md for moat assessment guidelines_
