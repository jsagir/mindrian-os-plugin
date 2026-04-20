---
name: ui-system
description: >
  CLI UI Ruling System. Governs ALL MindrianOS terminal output -- 4-zone anatomy,
  5 body shapes, 12 glyphs, 5 colors, session start contract, cross-surface
  adaptation. Auto-loaded on every session. No command invents its own format.
---

# UI Ruling System

Every `/mos:` command and Larry response follows this ruling system. No exceptions. Works alongside `larry-personality` (voice), `room-passive` (STATE.md), and `room-proactive` (signals).

## 1. Four-Zone Output Anatomy

Every output has exactly 4 zones in fixed order. No reordering. No invention.

**Zone 1: Header Panel** -- room context, venture stage, section name.
- Standard: `-- Room Name -- section -- Stage --` (box chars on CLI: `|-`)
- Compact (>30 lines or <60 cols): single-line dashes
- Room name always first (canary for multi-room context safety)
- No room: `-- MindrianOS -- no room --`
- Multi-room: use registry's active room `venture_name` or slug

**Zone 2: Content Body** -- payload per body shape (Section 2). No chrome.

**Zone 3: Intelligence Strip** -- signals from room-proactive. Only HIGH/MEDIUM. Max 3.
- Each signal: glyph + one-line description, indented 2 spaces
- `!` contradictions/warnings, `[ ]` gaps, `lightning` convergence
- Omit entirely if no signals. Never show during methodology sessions.

**Zone 4: Action Footer** -- NEVER omitted. 2-3 grounded `/mos:` commands.
- `>` primary (exactly one), `>` alternatives (1-2)
- Each: glyph + command (cyan) + brief description (gray)
- Must be real commands grounded in current state. Never suggest what user just ran.

**Density:** >30 lines: compact header, max 2 signals. <10 lines: no padding.

## 2. Five Body Shapes

### Shape A: Mondrian Board
**Used by:** `/mos:status`, `/mos:diagnose`, `/mos:radar`, `/mos:admin`
Progress bars per section. 10-char: `filled` fill, `dot` empty. Section names left-aligned padded. Entry count + MINTO health (`checkmark`/`dot`/`--`). Summary line at bottom.

### Shape B: Semantic Tree
**Used by:** `/mos:tree`, `/mos:room` (no args), `/mos:rooms`, `/mos:suggest-next`, `/mos:help`, `/mos:funding`, `/mos:opportunities`
Folder tree with state glyphs. `down-arrow` expanded, `>` collapsed+content, `>` collapsed+empty. `branch`/`last-branch` siblings. Artifact status: `checkmark` complete, `dot` draft. Entry counts inline.

### Shape C: Room Card
**Used by:** `/mos:room [section]`, `/mos:grade`, `/mos:deep-grade`, `/mos:research`, `/mos:validate`, `/mos:reason`, `/mos:persona`
Governing thought (quoted), entries list (status+name+date+depth), graph edges (type+target+count), MINTO health assessment. Floating signal badge if HIGH contradiction/convergence.

### Shape D: Document View
**Used by:** `/mos:open [artifact]`, `/mos:query`
Frontmatter as key-value pairs (no YAML markers). Full content (markdown preserved). Edges at bottom. Footer suggests following edges.

### Shape E: Action Report
**Used by:** `/mos:act`, `/mos:file-meeting`, `/mos:pipeline`, `/mos:export`, `/mos:setup`, `/mos:new-project`, `/mos:update`, `/mos:wiki`
Action + source at top. Changes: section + `[before -> after]` + description. New edges listed. Summary totals. Signals from changes in Zone 3.

**Methodology commands** use no shape for conversational output. Filing confirmation uses Shape E.

### Shape F: Selector Block (AskUserQuestion family)

Shape F is the interactive selector family. It is the ruling-system implementation of the tri-context Decision Gate (see `docs/MINDRIAN-CANON.md` Part 3). Every command with a genuine fork renders its choice through one of five F sub-shapes. No command invents a bespoke selector.

All five sub-shapes share a common envelope:
- Header = Zone 1 header + decision-gate marker (`filled-square`).
- Three-context strip below header: LOCAL / BRAIN / SIGNAL (`down-triangle` per context).
- Prompt line (`right-triangle-filled`) asks the actual question.
- Options list uses keyboard shortcuts identical across sub-shapes: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to open inspect panel, Esc to cancel.
- Free-Text slot is ALWAYS the last option. The navigator can always escape the vocabulary.
- RECOMMENDED marker appears on at most one option, only when Brain confidence >= 0.7 (Phase 88.2 invariant). In Mode B (Local Only), no option is marked.

The ten canonical verbs (from canon Part 3) are: Run Methodology / Reformulate / Spawn Sub-Agent / Navigate Graph / Devil's Advocate / Scenario Plan / Synthesize / Bank Opportunity / Defer / Free-Text. Each sub-shape below draws from this vocabulary.

#### Shape F.1 - Next Move

Purpose: Default selector after any discuss chunk. The most-used shape.

When to use: End of team discussion, end of methodology session, any insight checkpoint where the navigator must pick the next verb.

Header format:
```
[filled-square] [CONTEXT] - NEXT MOVE             - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Choose next move:
```

Options: 3-5 drawn from the canonical ten verbs. Free-Text is always the last option.

Verb constraints: Any of the ten canonical verbs is permitted. Typical slate = Run Methodology / Navigate Graph / Devil's Advocate / Bank Opportunity / Free-Text.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: append to STATE.md Decisions section with timestamp + chosen verb + context snapshot. A typed edge is added to the local graph: (navigator) -[CHOSE {verb}]-> (current-artifact).

#### Shape F.2 - Path Control

Purpose: When the navigator is choosing structure, not content. Plan / Replan variants. Ties to Claude Code Plan Mode.

When to use: Entering a methodology chain, transitioning between pipeline stages, user signals they want to step back and re-plan instead of continuing tactical work.

Header format:
```
[filled-square] [CONTEXT] - PATH CONTROL          - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Choose path:
```

Options: 3-5. Free-Text is always the last option.

Verb constraints: Drawn from Run Methodology / Reformulate / Scenario Plan / Defer / Free-Text. Path Control does not typically surface Navigate Graph or Bank Opportunity (those are tactical, not structural).

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: update STATE.md Current Position.Plan field with the chosen plan name. A typed edge is added: (navigator) -[CHOSE_PATH {plan}]-> (phase-node).

#### Shape F.3 - Rabbit-Hole Depth

Purpose: Before deep-diving. Sets how far the navigator wants to chase a branch.

When to use: User has chosen to explore a specific topic, artifact, or contradiction. Shape F.3 gates how much energy to spend before returning.

Header format:
```
[filled-square] [CONTEXT] - DEPTH                 - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] How deep?
```

Options: exactly 5 (fixed vocabulary, NOT drawn from the ten verbs): Shallow / Medium / Deep / Extreme / Back. Free-Text is not offered in F.3 - depth is a closed axis. Back returns to the previous shape.

Verb constraints: F.3 is the one sub-shape whose option set is NOT the canonical verb vocabulary. It is a depth scalar. The verb that follows F.3 is chosen by the calling command.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: a TodoWrite row is created with a depth tag (`depth:shallow`, `depth:medium`, `depth:deep`, `depth:extreme`). The row owns the subsequent exploration work. No STATE.md Decisions entry until the exploration completes.

#### Shape F.4 - Insight Extraction

Purpose: When a branch has enough material. Close-out selector for a discuss chunk.

When to use: The navigator has been exploring a topic and the material is rich enough to harvest. F.4 decides what artifact (if any) to produce.

Header format:
```
[filled-square] [CONTEXT] - INSIGHTS              - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Extract what?
```

Options: exactly 5 (fixed vocabulary): Key insights / + contradictions / + actions / Create artifact draft / Back. Free-Text is not offered in F.4 - extraction scope is a closed ladder. Back returns to the previous shape.

Verb constraints: F.4 wraps the canonical verb Synthesize. Options are progressive scopes of what the Synthesize verb will produce. Create artifact draft is the handoff verb into Shape E (Action Report) downstream.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: append a synthesis note to STATE.md Accumulated Context. If "Create artifact draft" is selected, additionally create a TodoWrite row for drafting. A typed edge is added: (navigator) -[SYNTHESIZED {scope}]-> (discuss-chunk).

#### Shape F.5 - Branch Resolution

Purpose: When multiple paths exist. The navigator is returning from parallel exploration and must decide how branches converge.

When to use: User has explored two or more branches (via Scenario Plan, Compare Ventures, or manual fork). F.5 decides whether to continue one, merge them, compare them formally, park one for later, or drop one.

Header format:
```
[filled-square] [CONTEXT] - BRANCH                - decision gate
[down-triangle] LOCAL   / BRAIN   / SIGNAL
[right-triangle-filled] Resolve branch:
```

Options: 3-5 drawn from: Continue / Merge / Compare / Park / Drop. Free-Text is always the last option. Typical slate = Continue / Merge / Compare / Park / Free-Text.

Verb constraints: F.5 is specialized to branch-resolution semantics. Continue maps to Run Methodology on the chosen branch. Merge maps to Synthesize across branches. Compare maps to Scenario Plan in compare mode. Park maps to Defer. Drop is the terminal Reject-with-reason path.

Keyboard: up-arrow / down-arrow (or J / K) to navigate, Enter to select, `?` to inspect, Esc to cancel.

State-update hook: append to STATE.md Decisions section naming the resolved branch and the resolution verb. A typed edge is added: (branch-root) -[RESOLVED {verb}]-> (target). Parked branches additionally create a milestone-audit TodoWrite row.

## 3. Symbol Vocabulary

12 glyphs. One meaning each. No overloading.

| Glyph | Meaning |
|-------|---------|
| `filled-square` | Progress fill (Shape A) |
| `down-triangle` | Expanded node (Shape B) |
| `right-triangle-filled` | Collapsed+content / primary action |
| `right-triangle-empty` | Collapsed+empty / alternative action |
| `branch` | Not-last sibling |
| `last-branch` | Last sibling |
| `checkmark` | Complete |
| `bullet` | Draft/partial |
| `warning` | Contradiction/warning |
| `lightning` | Convergence |
| `empty-square` | Gap |
| `arrow` | Inline suggestion |

**NO EMOJI. EVER.**

Carve-out (2026-04-14, user directive): the Claude Code statusline rendered by `scripts/context-monitor` is **excepted** from this rule. The statusline is a passive signal surface rendered by the host terminal, not a MindrianOS command output body, and the user has authorized emoji use there specifically. Every other surface (slash-command output, artifact generation, MINTO.md files, CHANGELOG entries, reports, dashboard HTML bodies, PDF exports, printed logs) must continue to honor the no-emoji rule without exception. If you are reading this and about to add emoji to any surface other than `scripts/context-monitor`, stop.

## 4. Color Contract

5 ANSI colors with fixed meaning. Color is NEVER decoration.

| Color | Meaning |
|-------|---------|
| Green `\033[32m` | Success, active, complete |
| Cyan `\033[36m` | Commands, paths, links |
| Yellow `\033[33m` | Warnings, caution |
| Red `\033[31m` | Errors only |
| Gray `\033[90m` | Meta info, timestamps, hints |

Bold for emphasis. Default/white for content. Never combine colors on one token. Red = errors only (warnings = yellow).

## 5. Session Start Contract

Three variants based on room state:

**Cold Start (no room found):** Brief. Header shows MindrianOS/no room. Mention that rooms will be created at ~/MindrianRooms/. Primary: `/mos:new-project`. Alt: conversational start.

**Warm Start (room, no signals):** "Reading the Room" trace (blockquote). Show room path as ~/MindrianRooms/[name]/. Stats: active sections, entries, last activity. Strongest/weakest callouts. Grounded actions.

**Warm Start + Signals (room + HIGH/MEDIUM):** Same trace + max 2 signals. Room path shown in header as ~/MindrianRooms/[name]/. Prioritize 1 contradiction + 1 convergence. First action addresses top signal. Never repeat same signal consecutive sessions unless changed.

## 6. CLI Voice Rules

Larry in terminal: terse, structural, confident, action-oriented.

**Banned:** "Great question!", "I'd be happy to help", "It's important to note", "Let me explain", sentences starting with "I", "Here's what I found", "I think/believe", "Please note that", "As mentioned earlier"

**Allowed:** Direct statements, imperatives, evidence-first, observations. Lead with data. One insight per line. Confidence without hedging. Capitalize methodology names.

## 7. Error Handling

Three-line pattern:
- Line 1: `x` (red) + what failed
- Line 2: `Why:` (indented) + specific reason
- Line 3: `Fix:` (indented) + one resolving command (cyan)

Never show stack traces, raw errors, JSON, or >3 lines. Multiple failures: show first only.

## 8. Help System

`/mos:help`: Commands grouped by flow (Getting Started, Working, Reviewing, Brain+Intelligence, Export+Admin). Tree format.

`/mos:help [cmd]`: tldr-style. 1 description line + max 3 examples. Not a man page.

## 9. Cross-Surface Adaptation

CLI is master template. Desktop degrades: no box chars (use bold headers), no progress bars (use text), no tree symbols (use bullets), no ANSI color (use markdown). Cowork matches CLI. Signal glyphs and action footer work everywhere.

Width: 80 cols default, never expand beyond. <60 cols: compact headers, collapse trees, 1 signal max.

## 10. Dual Context: STATE.md + MINTO.md

Every section gets STATE.md (quantitative: counts, gaps, timestamps) and MINTO.md (qualitative: governing thought, arguments, evidence, MECE check).

MINTO health in commands: `checkmark` = governing thought + 2+ argued, `dot` = partial, `--` = missing.

Routing priority: Broken MINTO + many entries -> "needs reasoning" (`/mos:structure-argument`). Solid MINTO + few entries -> "needs evidence". Empty both -> gap exploration. Solid both -> cross-referencing/grading.

## Quick Reference

```
ZONES:     Header | Body | Signals | Footer
SHAPES:    A=Board  B=Tree  C=Card  D=Doc  E=Report
GLYPHS:    filled down-tri right-tri-f right-tri-e branch last-branch check dot warn lightning empty-sq arrow
COLORS:    Green=success  Cyan=commands  Yellow=warn  Red=error  Gray=meta
GREETING:  Cold | Warm | Warm+Signals (max 2)
ERRORS:    x What / Why: reason / Fix: /mos:command
HELP:      1 line + 3 examples, grouped by flow
WIDTH:     80 cols default, never expand
NO EMOJI:  Ever.
```
