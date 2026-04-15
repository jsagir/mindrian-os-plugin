---
name: MOSDeckEngine
description: >
  Use when translating complex engineering, technical, or scientific concepts into
  clear investor-grade presentation decks. Runs a 6-stage Feynman first-principles
  pipeline: reduce to essence, translate to plain language, expose confusion, build
  mental models, simplify until it breaks, teach it back. Outputs YC-quality slides.
  Triggers: pitch deck, explain complex concept, simplify for investors, technical
  storytelling, demo day, fundraising deck.
---

# Feynman Engine -- Complexity to Clarity Pipeline

Transform complex engineering concepts into YC-quality presentation decks through
Richard Feynman's first-principles decomposition method.

## The Problem

The Curse of Knowledge. Technical founders cannot unsee their own complexity.
They drown investors in architecture diagrams, system specs, and jargon.
This skill is the antidote.

## When to Use

- Preparing a pitch deck from technical material
- Explaining a complex system to non-technical stakeholders
- Translating engineering architecture into investor language
- Simplifying a whitepaper or technical document for a presentation
- Any time someone says "make this simple" about something that is not

## When NOT to Use

- Writing technical documentation for engineers (keep the complexity)
- Internal architecture reviews (wrong audience)
- Academic papers (different communication standard)

## Input

Accept any of these:
- **Live conversation** -- explain the concept, the pipeline runs interactively
- **Pasted text** -- whitepaper excerpt, technical doc, architecture description
- **File path** -- reads a document and processes it

## The Pipeline

Six stages, run sequentially. Each stage produces a visible artifact the user
reviews before the next stage fires. This is interactive, not autonomous.

```
Complex Concept
    |
    v
[1. REDUCE TO ESSENCE]     -- Strip to fundamental truths
    |
    v
[2. TRANSLATE]              -- Rewrite for smart generalists
    |
    v
[3. EXPOSE CONFUSION]      -- Find and fix hidden gaps (may loop 2-3x)
    |
    v
[4. BUILD MENTAL MODELS]   -- Create 2-3 powerful analogies
    |
    v
[5. SIMPLIFY UNTIL BREAKS] -- Find the sweet spot boundary
    |
    v
[6. TEACH IT BACK]         -- Quality gate: does it stand alone?
    |
    v
YC-Quality Deck
```

---

## Stage 1: REDUCE TO ESSENCE

**Goal:** Strip the concept to irreducible fundamental truths.

**Run this prompt against the input:**

> Remove all jargon, assumptions, and surface-level explanations from this concept.
> Break it into its most fundamental truths -- pieces that cannot be simplified
> further without losing meaning. Show how they connect logically. Identify what
> is ESSENTIAL vs what is DECORATIVE.

**Produce:**
- Bullet list of irreducible truths (max 5-7)
- Connection map showing how pieces relate
- One-paragraph essence summary (3-4 sentences max)

**Challenge the user:** "That's not a fundamental truth -- that's an implementation
detail. What's underneath it?"

**Gate:** Ask "Does this capture the real core? What did I miss?" -- wait for response.

---

## Stage 2: TRANSLATE TO PLAIN LANGUAGE

**Goal:** Convert the essence into language a non-technical investor absorbs on first read.

**Run this prompt against Stage 1 output:**

> Rewrite using simple words, short sentences, everyday language. Replace abstract
> terms with concrete descriptions. Target: a smart generalist who sees 1,000
> pitches a year. No academic tone. Conversational clarity that feels obvious
> on first read.

**Produce:**
- The "elevator version" (30 seconds, 3-4 sentences)
- Glossary of unavoidable terms, rewritten simply
- The "12-year-old version" (stripped to absolute minimum, still true)

**Challenge:** "If you need the word 'leverages' to explain this, you don't
understand it yet."

**Gate:** Ask "Read the 12-year-old version. Does it still feel true?" -- wait for response.

---

## Stage 3: EXPOSE CONFUSION

**Goal:** Ruthlessly find hidden weakness in the simplified version.

**Run this prompt against Stage 2 output:**

> Examine every sentence for vagueness, skipped steps, or buried assumptions.
> Pinpoint exactly where the explanation breaks and WHY. Turn every weak spot
> into a specific question that forces deeper thinking. Do NOT accept partial
> understanding.

**Produce:**
- Numbered gap list with severity (CRITICAL / MODERATE / MINOR)
- Root cause of each gap
- Priority questions that must be answered
- Investor impact: which gaps lose a YC partner in 3 seconds?

**Challenge:** "Paragraph two -- you jumped from problem to solution without
explaining why THIS solution. An investor notices that in 3 seconds."

**Gate:** This stage LOOPS. Fix critical gaps, re-expose, repeat until clean.
Expect 2-3 iterations. Only proceed when no CRITICAL gaps remain.

---

## Stage 4: BUILD MENTAL MODELS

**Goal:** Create analogies that make the concept instantly graspable.

**Run this prompt against the gap-fixed output:**

> Design 2-3 powerful analogies that map this concept to familiar experiences.
> Each model must preserve the STRUCTURE of the original idea while making it
> intuitive. Map each analogy element to the real element. Identify where each
> analogy breaks down.

**Produce:**
- 2-3 mental models with explicit mapping (analogy -> reality)
- Limitations of each (where it stops being accurate)
- Recommendation: best for 3-minute vs 30-minute explanation

**Challenge:** "The best analogy isn't clever -- it's obvious. When someone
hears it, they should think 'of course.'"

**Gate:** Ask "Which analogy resonates most? We'll lead the deck with that one."
-- wait for response.

---

## Stage 5: SIMPLIFY UNTIL IT BREAKS

**Goal:** Find the exact boundary between useful simplification and distortion.

**Run this prompt against the chosen model:**

> Take the best explanation and simplify it further, step by step. At each level,
> check: is the meaning still preserved? Push until further reduction WOULD
> distort the truth. Identify the exact boundary and explain why it exists.

**Produce:**
- Simplification ladder (4-5 rungs from detailed to ultra-simple)
- The breaking point: what cannot be simplified further and why
- The sweet spot: simplest version that is still TRUE

**Challenge:** "We just crossed the line. That last simplification turned your
distributed ledger into 'a shared spreadsheet' -- and that's wrong in a way
that matters. Step back one."

**Gate:** Ask "This is your presentation language. Sound right?" -- wait for response.

---

## Stage 6: TEACH IT BACK (Quality Gate)

**Goal:** Validate the final version stands alone without external context.

**Run this prompt against the sweet-spot version:**

> Present this concept from scratch. Start from basics, build up logically.
> Target: smart generalists. Evaluate for clarity, completeness, logical flow,
> persuasiveness. The listener should be able to explain this to someone else.

**Produce:**
- Polished teach-back version (this becomes the deck narrative)
- Remaining weakness (if any)
- Confidence rating: LOW / MEDIUM / HIGH / YC-READY

**Challenge:** "Read this out loud. If you stumble anywhere, that's where the
investor zones out."

**Final gate:** Only proceed to deck generation if confidence is HIGH or YC-READY.
If MEDIUM, loop back to the weakest stage. If LOW, restart from Stage 3.

---

## Deck Generation

After all 6 stages pass, generate a presentation deck.

### Slide Architecture (10-12 slides)

| # | Slide | Content Source |
|---|-------|---------------|
| 1 | Title | Essence summary (Stage 1) |
| 2 | The Problem | First-principles WHY this matters (Stage 1) |
| 3 | The Insight | The "aha" from Stage 5's sweet spot |
| 4 | The Solution | Plain language (Stage 2) + best analogy (Stage 4) |
| 5 | How It Works | Mental model DIAGRAM -- not technical architecture |
| 6 | Why Now | Simplified causal chain from Stage 1 fundamentals |
| 7 | Market | Numbers with Stage 2 plain language context |
| 8 | Business Model | One sentence + one visual |
| 9 | Traction | Evidence that validates the simplified story |
| 10 | Team | Why THIS team for THIS simplified problem |
| 11 | The Ask | What money buys, in sweet-spot language |

### Design Principles

- **One idea per slide.** Two sentences = two slides.
- **Headline carries the Feynman message.** Supporting text adds one layer of detail.
- **Diagrams over bullets.** Mental models from Stage 4 become visuals.
- **Whitespace is confidence.** Crowded slides signal unclear thinking.

### Visual Specifications

Generate as responsive HTML presentation:
- 16:9 aspect ratio with mobile/tablet breakpoints
- Keyboard navigation (arrows, space, home, end)
- Clean, minimal design -- investor-grade, not conference-talk flashy

**Color palette (professional, high-contrast):**
- Background: #FAFAFA (light) or #0A0A0A (dark)
- Primary text: #1A1A1A (light) or #F5F5F5 (dark)
- Accent: one bold color that matches the venture's energy
- Data/highlight: one complementary color

**Typography:**
- Headings: bold sans-serif (Inter, Helvetica Neue, or system)
- Body: regular sans-serif, 18px+ for readability at distance
- Data: monospace for numbers and metrics

**If ui-ux-pro-max skill is available**, use it for richer design intelligence:
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "investor pitch deck minimal professional" --design-system
```

### Output

Save deck as HTML file. Report location to user.

---

## Adapting to Context

### With MindrianOS Data Room
- Pull technical content from room sections automatically
- File the Feynman analysis as a room artifact
- Cross-reference simplified concepts with existing room entries
- Use De Stijl design system for deck visuals

### Without MindrianOS (Standalone)
- Accept input via conversation or pasted text
- Output deck to current working directory
- No filing, no room integration
- Still runs the full 6-stage pipeline at identical quality

### With Brain Connection (MindrianOS + Brain)
- Query Brain for cross-domain analogies (Stage 4 enrichment)
- Pull SUCCESs Framework patterns for stickiness testing
- Use Minto Pyramid from Brain for SCQA structure validation
- Surface Golden Circle framing for the "Why Now" slide

---

## Common Patterns

### Technical Architecture -> Investor Deck
Input: "We built a distributed event-sourced system with CQRS and saga orchestration"
Stage 1 essence: "We built a system where every change is recorded, decisions are separated from data storage, and complex multi-step processes complete reliably even if parts fail"
Stage 5 sweet spot: "Think of it like a flight recorder for your business -- every decision is tracked, nothing gets lost, and the system heals itself"

### Research Paper -> Demo Day Pitch
Input: 3,000-word technical paper with citations
Stage 2 elevator: 4 sentences, zero jargon
Stage 4 analogy: maps to something every YC partner has experienced
Stage 6 teach-back: the partner could explain it to their colleagues

### Complex Algorithm -> Board Presentation
Input: ML model with attention mechanisms and transformer architecture
Stage 5 breaking point: "AI that reads" (too simple -- loses the mechanism that matters)
Stage 5 sweet spot: "AI that reads every document simultaneously and finds what connects them" (simplified but structurally true)

---

## Quality Standards

A Feynman-processed deck meets ALL of these:

- [ ] No jargon survives without a plain-language companion
- [ ] Every slide passes the "say it out loud" test
- [ ] At least one mental model that a non-expert remembers a week later
- [ ] The 12-year-old version is true (not just simple)
- [ ] Stage 3 found and fixed at least 2 gaps (if it found zero, the analysis was weak)
- [ ] The sweet spot is identified -- not the simplest version, but the simplest TRUE version
- [ ] Deck tells a story, not a feature list
