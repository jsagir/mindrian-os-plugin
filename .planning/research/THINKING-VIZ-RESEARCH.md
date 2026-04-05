# Thinking Visualization Research: Terminal Reasoning Traces for MindrianOS

**Domain:** CLI AI assistant reasoning visualization
**Researched:** 2026-03-25
**Overall confidence:** MEDIUM-HIGH
**Mode:** Ecosystem + Feasibility

---

## Executive Summary

Making Larry's reasoning visible in the terminal is a design problem at the intersection of three constraints: (1) Claude Code's markdown renderer has known bugs with ANSI escape code alignment, (2) the output must work across CLI, Desktop, and Cowork surfaces, and (3) the audience is non-technical teams who need clarity, not debug logs.

The good news: Claude Code **does** render markdown -- headers, bold, italic, lists, code blocks, and tables all work. The bad news: rendering is occasionally glitchy (bold misalignment, table spacing issues on Windows). The practical answer: **use plain markdown with strategic Unicode symbols as the primary visual language**, not ANSI escape codes or box-drawing characters. This approach works on all three surfaces and degrades gracefully.

The recommended pattern is a **"Thinking Trace"** -- a structured markdown block that shows Larry's reasoning as a visual flow, using indentation, Unicode markers, and progressive headers. It should feel like a mentor showing their work on a whiteboard, not a system log. The trace adapts to mode: in Investigative mode it shows the question chain being constructed; in Insight mode it shows the evidence-to-conclusion path.

Industry patterns from 2025-2026 show a strong trend toward **observable reasoning** -- making AI thinking visible is now considered a critical UX feature, not a debug tool. The Vercel AI SDK's ChainOfThought component, various agentic design pattern libraries, and tools like Rich (Python) all point the same direction: progressive disclosure with confidence indicators.

---

## Part 1: What Works in Claude Code's Terminal

### Confirmed Working (HIGH confidence -- tested in production)

| Element | Syntax | Renders As | Reliability |
|---------|--------|-----------|-------------|
| **Headers** | `# ## ###` | Larger/bold text | Stable |
| **Bold** | `**text**` | Bold ANSI | Mostly stable, occasional misalignment |
| **Italic** | `*text*` | Italic ANSI | Stable |
| **Code blocks** | Triple backtick | Highlighted block | Stable (minor leading-space bug) |
| **Inline code** | Single backtick | Highlighted span | Stable |
| **Unordered lists** | `- item` | Bulleted list | Stable |
| **Ordered lists** | `1. item` | Numbered list | Fixed in recent versions |
| **Tables** | Pipe syntax | Formatted table | Works but spacing can shift on Windows |
| **Blockquotes** | `> text` | Indented/styled | Stable |
| **Horizontal rules** | `---` | Visual separator | Stable |
| **Links** | `[text](url)` | Clickable in some terminals | Variable |

### Known Issues (HIGH confidence -- documented bugs)

- **Bold misalignment**: ANSI escape codes can attach to wrong characters during streaming. Workaround: keep bold spans short (1-3 words).
- **Table corruption on Windows Terminal**: `\r\n` line endings cause column shifts. Fixed in recent Claude Code versions but still surfaces.
- **Code block indentation**: Leading spaces get added. Not critical for visualization but affects copy-paste.
- **CPU spin on large output**: Sessions with >100K tokens can cause renderer lag. Keep thinking traces compact.

### What Does NOT Work

| Element | Why Not | Alternative |
|---------|---------|-------------|
| **Raw ANSI escape codes** | Claude generates markdown, not raw ANSI. Cannot inject `\033[31m` directly. | Use markdown bold/italic/headers |
| **Box-drawing characters** (U+2500 block) | Render inconsistently across terminals. Width calculation breaks monospace grid. | Use markdown indentation + simple Unicode |
| **Color coding** | No direct color control in Claude's output. Colors come from markdown renderer's theme. | Use semantic markers (headers = one color, code = another, bold = emphasis) |
| **Interactive/live rendering** | Claude outputs streaming text, not a TUI. No `rich.Live()` or `ink` React components. | Progressive disclosure via conversation turns |
| **Animated spinners** | Claude's output is append-only text. | Use static progress markers |

### The Cross-Surface Reality

| Feature | CLI | Desktop | Cowork |
|---------|-----|---------|--------|
| Markdown rendering | YES (with bugs) | YES (clean) | YES (clean) |
| Unicode symbols | YES | YES | YES |
| Code blocks | YES | YES | YES |
| Tables | YES (fragile) | YES | YES |
| Box-drawing chars | Risky | Risky | Risky |
| ANSI colors | Theme-dependent | NO | NO |

**Conclusion:** Target **pure markdown + Unicode symbols**. This is the only format that works reliably across all three surfaces.

---

## Part 2: Industry Patterns for Reasoning Visualization

### Pattern 1: Progressive Disclosure Trace (Vercel AI SDK / Agentic Design)

Show a summary first, expand on demand. In terminal context: show the conclusion with a compact trace, offer to elaborate.

```
Larry's Approach:
  Problem type --> Ill-defined, complicated
  Stage --------> Discovery
  Framework -----> Root Cause Analysis (best fit)
  Also consider -> Map Unknowns, Analyze Systems

"Here's why Root Cause fits: you described symptoms but not causes.
 That's the signature of an ill-defined problem. Let me dig in..."
```

**Confidence:** HIGH -- this pattern appears in every major agentic UI framework.

### Pattern 2: Decision Tree / Routing Visualization

Show the path through decision logic. Common in observability tools (LangSmith, Braintrust).

```
Routing:
  "customers aren't buying"
    --> symptom described, cause unknown = Ill-Defined
    --> multiple possible causes = Complicated
    --> Ill-Defined x Complicated = Root Cause cluster

  Selected: /mindrian-os:root-cause
  Runner-up: /mindrian-os:analyze-needs
  Also fits: /mindrian-os:map-unknowns
```

**Confidence:** HIGH -- direct mapping to MindrianOS's diagnose flow.

### Pattern 3: Evidence-to-Conclusion Chain (Braintrust/LangSmith Traces)

Show the reasoning links explicitly. Used in observability dashboards but adaptable to text.

```
Evidence chain:
  1. User said: "customers aren't buying but I don't know why"
     --> Signal: symptom without cause
  2. Venture stage: Discovery (from room/STATE.md)
     --> Constraint: early-stage, limited data
  3. Brain query: similar patterns found
     --> 85% of ventures at this stage benefited from Root Cause
  4. Conclusion: Root Cause Analysis, then Analyze Needs
```

**Confidence:** MEDIUM -- works well for Insight mode, may be too verbose for Investigative.

### Pattern 4: Confidence + Source Attribution

Show how certain Larry is about each recommendation. From the agentic design patterns literature on Confidence Visualization Patterns.

```
Recommendations (by fit):
  /mindrian-os:root-cause ......... Strong fit (signals match 4/5)
  /mindrian-os:analyze-needs ...... Good fit (signals match 3/5)
  /mindrian-os:map-unknowns ....... Moderate fit (useful but secondary)
```

**Confidence:** HIGH -- maps directly to the Brain's confidence scores.

### Pattern 5: Mentor's Whiteboard (Unique to MindrianOS)

This is the original pattern. Not found in existing tools -- designed for Larry's teaching personality. The trace should feel like a professor drawing on a whiteboard while explaining their reasoning.

```
Let me think through this with you.

You said: "We're losing customers but surveys say they're happy."

That's interesting -- the data contradicts the behavior. When that
happens, it usually means one of two things:

  1. The survey is measuring the wrong thing (satisfaction != retention)
  2. There's a switching trigger that has nothing to do with satisfaction

     What I'd explore first:
     /mindrian-os:root-cause --> find the real driver
       then
     /mindrian-os:analyze-needs --> check if JTBD shifted

The reason I'm not recommending trends analysis: your problem is
internal, not market-driven. Let's look inward first.
```

**Confidence:** This is a DESIGN recommendation, not an observed pattern. HIGH confidence it fits Larry's personality.

---

## Part 3: Safe Unicode Symbols for Terminal Markers

### Recommended Symbol Set (Cross-platform safe)

These render correctly in virtually all modern terminals, Claude Desktop, and web renderers:

**Arrows and Flow:**
- `-->` (ASCII arrow) -- safest, universal
- `=>` (fat arrow) -- universal
- `->` (thin arrow) -- universal

**Status and Classification:**
- `[x]` / `[ ]` -- checkbox (universal, rendered by some markdown engines)
- `*` -- bullet (universal)
- `#` -- numbered priority (universal)

**Semantic Markers (use sparingly, as text prefixes):**
- `SIGNAL:` -- what Larry detected
- `ROUTE:` -- where it's going
- `BECAUSE:` -- reasoning link
- `BRAIN:` -- when Brain MCP contributed
- `ROOM:` -- when room state influenced the decision

**Avoid These Unicode Symbols:**
- Box-drawing characters (U+2500-U+257F) -- width calculation breaks monospace
- Full-width emoji (many are double-width, break alignment)
- Colored emoji (render as text glyphs in some terminals)
- Zero-width joiners or combining characters

### Why ASCII > Unicode for MindrianOS

The audience includes non-technical teams on Windows, Mac, and Linux. They may use:
- Windows Terminal (emoji support inconsistent)
- WSL terminals (font-dependent)
- VS Code integrated terminal (generally good)
- macOS Terminal.app (good Unicode, bad emoji width)
- iTerm2 (excellent)
- Claude Desktop app (web renderer, excellent)

ASCII arrows (`-->`, `=>`) and markdown formatting (`**bold**`, `# headers`, `> quotes`) are the ONLY visual elements guaranteed to work everywhere. Use them as the primary visual language.

---

## Part 4: The MindrianOS Thinking Trace Format

### Design Principles

1. **Mentor, not debugger.** The trace shows reasoning like a professor thinking aloud, not like a system log.
2. **Mode-adaptive.** Investigative mode shows question construction. Insight mode shows evidence chains.
3. **Progressive.** Summary first, details available. Never dump the full trace unprompted.
4. **Markdown-native.** Works on CLI, Desktop, and Cowork without modification.
5. **Compact.** 4-8 lines for the trace, not 40. Larry is concise.

### Format: The Routing Trace (for diagnose, suggest-next, help)

When Larry routes to a methodology, show the routing logic:

```markdown
**Larry's read:**
> Problem type: symptoms without causes (your customers leave but say they're happy)
> Stage: Discovery -- limited data, lots of assumptions
> Best fit: Root Cause Analysis --> then Analyze Needs

The contradiction between satisfaction scores and churn is the clue.
When behavior and surveys disagree, the survey is usually wrong.
Let me help you find what it's actually measuring...
```

### Format: The Framework Trace (for methodology sessions)

When Larry applies a framework, show which framework and why:

```markdown
**Applying:** Six Thinking Hats to your pricing decision

> Why this framework: You have 4 stakeholders with different priorities.
> Hats let each perspective speak without the others drowning it out.

Starting with the White Hat -- just the facts. What do we actually know
about your customers' willingness to pay? No opinions yet, just data.
```

### Format: The Brain Trace (when Brain MCP is connected)

When the Brain contributes, show the graph insight:

```markdown
**Brain insight:**
> Graph found: Root Cause FEEDS_INTO Analyze Needs (0.85 confidence)
> Pattern match: 3 similar ventures at Discovery stage used this sequence
> Additional: Map Unknowns CO_OCCURS with Root Cause in 67% of cases

This sequence isn't just my recommendation -- it's what actually worked
for ventures facing the same kind of contradiction you're describing.
```

### Format: The Cross-Reference Trace (for room filing)

When filing triggers cross-references, show what the scan found:

```markdown
**Cross-reference scan:**
> This insight CONTRADICTS: assumption in financial-model/revenue-projections.md
> This insight INFORMS: problem-definition/customer-segments.md
> Convergence detected: 3 sections now reference "switching triggers"

Your revenue model assumes 85% retention. But if the switching trigger
is what I think it is, that number needs revisiting. Want me to pull up
the financial model so we can check?
```

### Mode Adaptation

**Investigative mode** -- trace is minimal or absent. Larry asks questions without revealing machinery:

```markdown
"Before we pick the right tool, tell me what's happening.
When you say customers are leaving -- is that a sudden cliff or a slow leak?"
```

No trace shown. The reasoning is invisible. Larry uses frameworks to GENERATE questions but never shows the framework.

**Blend mode** -- trace appears as a brief aside:

```markdown
"Based on what you've described, there's a pattern here I've seen before.

> **Pattern:** satisfaction != retention. The survey measures one thing,
> behavior reveals another.

Let me apply Root Cause thinking to this. The question isn't why they
leave -- it's what triggers the decision to look elsewhere."
```

**Insight mode** -- full trace is appropriate:

```markdown
**Here's my read on this:**

> Evidence: satisfaction scores stable, churn accelerating
> Signal: behavioral contradiction (says happy, acts unhappy)
> Root cause hypothesis: switching trigger unrelated to satisfaction
> Framework: Root Cause Analysis --> JTBD reframe

Three things are happening simultaneously...
[full insight delivery follows]
```

---

## Part 5: Implementation Approach

### Option A: Inline in Skill/Command Files (RECOMMENDED)

Add trace formatting instructions directly to skill and command markdown files. This is the simplest approach and requires no infrastructure changes.

**In `skills/larry-personality/SKILL.md`**, add a "Thinking Trace" section:

```markdown
## Thinking Trace Format

When you reason through methodology selection, problem classification,
or framework chaining, make your reasoning visible using this format:

**Larry's read:**
> [Problem classification in plain language]
> [Stage and context from room]
> [Selected approach and why]

Keep traces to 3-5 lines inside the blockquote. The trace appears
BETWEEN your conversational response, not as a separate section.

### When to Show a Trace
- Routing decisions (diagnose, suggest-next, help)
- Framework selection (any methodology command)
- Brain-informed recommendations (when Brain MCP is active)
- Cross-reference discoveries (room filing)

### When NOT to Show a Trace
- Investigative mode (turns 1-3 of conversation)
- Simple factual responses
- Follow-up questions
- The user hasn't asked anything that requires methodology reasoning
```

**In each command file** (e.g., `commands/diagnose.md`), add trace instructions to the output section:

```markdown
## Thinking Trace

After classification, show your routing logic:

**Larry's read:**
> Problem type: [description, not label]
> Stage: [venture stage from room or inferred]
> Best fit: [command] --> [reason in 1 sentence]

Then transition to conversational delivery.
```

### Option B: Output Style (Alternative)

Create a custom output style at `.claude/output-styles/larry-thinking.md` that instructs Claude to show reasoning traces. This affects ALL output, not just methodology commands.

**Pros:** Single configuration point. Affects all responses uniformly.
**Cons:** May be too aggressive -- not every response needs a trace. Output styles replace Claude Code's default system prompt sections, which may conflict with coding tasks.

**Verdict:** Use Option A for targeted methodology traces. Reserve Option B for a future "verbose Larry" mode if users request it.

### Option C: Dedicated Trace Template

Create `templates/thinking-trace.md` with the trace format, and have commands reference it. This centralizes the format definition.

```markdown
<!-- templates/thinking-trace.md -->
## Trace Format Reference

Commands that perform reasoning should render a trace block:

**[Trace Type]:**
> Line 1: What was detected/classified
> Line 2: Context (stage, room state, Brain data)
> Line 3: Decision and reasoning

Trace types:
- **Larry's read:** -- routing and classification
- **Applying:** -- framework selection
- **Brain insight:** -- graph-informed recommendation
- **Cross-reference scan:** -- room filing discoveries
- **Pattern match:** -- when Brain finds similar ventures
```

**Verdict:** Good complement to Option A. Create the template, reference it from commands.

### Recommended Implementation Plan

1. **Create** `templates/thinking-trace.md` with the canonical trace format
2. **Add** trace instructions to `skills/larry-personality/SKILL.md`
3. **Update** `commands/diagnose.md` with trace output format
4. **Update** `commands/suggest-next.md` with Brain trace format
5. **Update** methodology command references to include framework trace
6. **Add** cross-reference trace format to `skills/room-proactive/` (for filing)
7. **Test** on all three surfaces (CLI, Desktop, Cowork)

---

## Part 6: What Doesn't Work (Anti-Patterns)

### Anti-Pattern 1: ASCII Art Boxes

```
+-----------------------------------+
|  Problem: Ill-Defined             |
|  Stage: Discovery                 |
|  Route: Root Cause Analysis       |
+-----------------------------------+
```

**Why it fails:** Looks like a system log. Breaks the mentor metaphor. Width-sensitive (breaks on narrow terminals). Not rendered by markdown engines.

### Anti-Pattern 2: Unicode Box Drawing

```
+--[ Problem Classification ]------+
|                                   |
|   Definition: Ill-Defined         |
|   Complexity: Complicated         |
|                                   |
+---[ Route ]-----[ Root Cause ]---+
```

**Why it fails:** Width calculation breaks across terminals. U+2500 block characters are inconsistent. Looks technical, not pedagogical.

### Anti-Pattern 3: Emoji-Heavy Status

```
Brain connected
Problem classified: ill-defined
Routing to: root-cause
Filing to: problem-definition
```

**Why it fails:** Emoji rendering is the most inconsistent element across terminals. Double-width characters break alignment. Looks like a Slack bot, not a professor.

### Anti-Pattern 4: Full Debug Trace

```
[DEBUG] Loaded room/STATE.md
[DEBUG] Stage: discovery, frameworks: [beautiful-question]
[DEBUG] Classification: ill-defined x complicated
[DEBUG] Brain query: brain_framework_chain(ill-defined, [beautiful-question])
[DEBUG] Results: root-cause (0.85), analyze-needs (0.72), map-unknowns (0.67)
[DEBUG] Selected: root-cause
[ROUTE] --> /mindrian-os:root-cause
```

**Why it fails:** This is a system log. Users are non-technical teams. They don't want to see internal state -- they want to see Larry's reasoning in human terms.

### Anti-Pattern 5: Tree Diagrams

```
Problem
  |-- Undefined
  |-- Ill-Defined  <-- HERE
  |     |-- Simple
  |     |-- Complicated  <-- HERE
  |     |-- Complex
  |     +-- Wicked
  +-- Well-Defined
```

**Why it fails:** Shows classification taxonomy, not reasoning. Tells the user WHAT was classified, not WHY. Also fragile in narrow terminals.

---

## Part 7: Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Claude Code markdown rendering | HIGH | Documented in official docs + verified via bug reports |
| Unicode cross-platform safety | HIGH | Well-established patterns, tested across terminals |
| Blockquote-based trace format | HIGH | Uses only standard markdown, works on all surfaces |
| Mode-adaptive traces | MEDIUM | Design recommendation, needs user testing |
| Brain trace format | MEDIUM | Depends on Brain MCP response structure (not yet tested) |
| Output style approach | MEDIUM | Documented feature, but interaction with skills/commands untested |
| Non-technical audience reception | LOW | No user testing data. Format designed by inference from Larry's voice. |

---

## Part 8: Open Questions

1. **How verbose should traces be by default?** The 3-5 line blockquote is a hypothesis. Real users may want more or less. Needs A/B testing with actual venture teams.

2. **Should traces be opt-in?** A `/mindrian-os:config verbose-thinking on` toggle would let users control trace visibility. Worth building if early feedback suggests some users find traces distracting.

3. **How does the trace interact with Brain latency?** Brain MCP queries add network latency. If the trace appears AFTER the Brain query completes, there's a visible pause. If it appears incrementally, the format needs to support streaming updates (which Claude Code does naturally via streaming).

4. **Desktop rendering of blockquotes.** Claude Desktop renders blockquotes with a left border bar. This actually HELPS the trace stand out visually. Verify this still works with the current Desktop renderer.

5. **Cowork multi-user traces.** In Cowork, multiple users see the same output. Does the trace confuse team members who didn't ask the question? May need to prefix traces with the user context.

---

## Sources

### Official Documentation
- [Claude Code Output Styles](https://code.claude.com/docs/en/output-styles) -- how custom output styles work, markdown file format, system prompt modification
- [Box Drawing Characters - Wikipedia](https://en.wikipedia.org/wiki/Box-drawing_character) -- reference for Unicode box-drawing block

### Claude Code Rendering Issues
- [Markdown renderer support request (Issue #13600)](https://github.com/anthropics/claude-code/issues/13600) -- feature request for full markdown rendering
- [Terminal rendering bugs: inconsistent bolding (Issue #20126)](https://github.com/anthropics/claude-code/issues/20126) -- ANSI escape code misalignment
- [Markdown formatting misalignment (Issue #20827)](https://github.com/anthropics/claude-code/issues/20827) -- streaming chunk boundary issue
- [Text truncation on Windows Terminal (Issue #18640)](https://github.com/anthropics/claude-code/issues/18640) -- Windows-specific rendering corruption

### Agentic Design Patterns
- [UI/UX & Human-AI Interaction - Agentic Design Patterns](https://agentic-design.ai/patterns/ui-ux-patterns) -- Progressive Disclosure, Confidence Visualization, Visual Reasoning patterns
- [AI Agents UI Design Trends (Fuselab Creative)](https://fuselabcreative.com/ui-design-for-ai-agents/) -- observable thinking as critical UX feature

### Terminal Unicode
- [Unicode Basic Symbols for CLI (GitHub Gist)](https://gist.github.com/realAscot/2c196782e07a7112f99c6d0800188f27) -- terminal-safe symbol reference
- [State of Terminal Emulators 2025](https://www.jeffquast.com/post/state-of-terminal-emulation-2025/) -- Unicode rendering challenges across terminals

### Libraries (Reference, not dependencies)
- [Rich (Python) - Progress and Layout](https://rich.readthedocs.io/en/latest/progress.html) -- patterns for structured terminal output
- [Ink (React) - Terminal UI](https://github.com/vadimdemedes/ink) -- component-based terminal rendering
- [Awesome Claude Code Output Styles](https://github.com/hesreallyhim/awesome-claude-code-output-styles-that-i-really-like) -- community output style examples

### CLI AI Tools
- [Top 5 CLI Coding Agents 2026 (DEV Community)](https://dev.to/lightningdev123/top-5-cli-coding-agents-in-2026-3pia) -- landscape of CLI AI tools
- [Vercel AI SDK Chain of Thought Component](https://ai-sdk.dev/elements/components/chain-of-thought) -- progressive reasoning display pattern
