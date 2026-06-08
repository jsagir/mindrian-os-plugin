# Keyboard-TUI Capability Cockpit - Research

**Date:** 2026-06-08
**Author:** Larry (research pass, Tavily-sourced)
**Status:** Research complete - feeds a future phase spec
**Trigger:** Navigator (Jonathan) feedback on the shipped Phase 143.1 dial-TUI: the suggestion surface (a) doesn't invoke the real intelligence engines, (b) isn't a real keyboard-driven TUI (arrows / checkboxes / left-right toggles / layered choices), (c) caps at 3 ideas ("need more"), (d) has no unique De Stijl identity, (e) doesn't expose Larry's Ask-Tell dial as a keyboard action.

Related shipped work: `.planning/phases/143.1-dial-tui-capability-selector/` (D3 selector, renders through `AskUserQuestion` / Shape F.1).

---

## 0. Executive finding (the one that matters)

**The keyboard arrow/checkbox/toggle TUI cannot run INSIDE a Claude Code agent turn.** It is a hard harness boundary, not a design oversight.

- An interactive TUI needs a TTY in **raw mode** (`stdin.setRawMode(true)`) to read arrow keys, space-to-check, left/right toggles byte-by-byte.
- Claude Code's **Bash tool runs commands in a non-interactive, non-TTY, captured-stdout session.** There is no live interactive stdin passthrough to a spawned process.
- Therefore an agent **cannot** spawn an Ink/blessed TUI mid-conversation and have the navigator drive it with the keyboard.
- The ONLY interactive primitive available inside the agent turn is **`AskUserQuestion`** (the menu). This is precisely why Phase 143.1 rendered through it and the navigator navigated by typing "1, 2".

This reframes the whole build: the literal keyboard cockpit must be a **separate process the user launches in their own terminal**, OR we accept the in-conversation menu primitive and win on depth instead.

### Evidence
- Reddit r/ClaudeAI "Claude code can't run interactive code itself?": *"I understand the technical reasons why this happens (no TTY, batch execution environment)."*
- Claude Code Windows install error: *"Raw mode is not supported on the current process.stdin"* (raw mode is exactly what arrow-key TUIs require).
- Node.js TTY docs: `process.stdout.isTTY` is `false` when piped / non-interactive; `setRawMode` only exists on a real `tty.ReadStream`.
- Bash tool API docs (platform.claude.com): the tool wraps a `subprocess.Popen(["/bin/bash"], stdin=PIPE, stdout=PIPE, ...)` with output captured on a timeout - a batch capture model, not an interactive TTY.
- StackOverflow "How do shells handle TTY": a child spawned without `stdio:'inherit'` reports `isTTY` false/undefined; only `stdio:'inherit'` passes the TTY down. The agent Bash tool does not give the spawned child an inherited interactive TTY tied to the user's keyboard.

---

## 1. TUI library landscape (Node.js, 2025/2026)

| Library | Stars | Maintained | Model | Verdict |
|---|---|---|---|---|
| **Ink** (`vadimdemedes/ink`) | 38.7k | **Yes (v7, updated days ago)** | React renderer for terminal (JSX, hooks) | **WINNER** - and Claude Code itself is built on it |
| blessed (`chjj/blessed`) | 11.8k | No (~11 yrs stale) | ncurses-like widget DOM (checkbox, radioset, list) | Richest widgets, but dead |
| neo-blessed / `@unblessed/core` | low | Partial / alpha | blessed revival, TS rewrite | Watch, not yet production |
| terminal-kit | 3.3k | Stale (~1 yr) | Imperative terminal control | Middle ground, no |
| react-blessed | 4.5k | No (5 yrs) | React over blessed | No |
| charsm | low | New | WASM port of Charm Lipgloss (styling) | Styling aid only |

### Why Ink wins
- **Same stack as Claude Code.** Per multiple sources (LinkedIn/Roopak Nijhara, HN #46902411, dev.to "I studied Claude Code's leaked source"), Claude Code is a React app rendered to the terminal **via Ink**: React builds a scene graph -> layout -> rasterize to a 2D buffer -> diff vs previous frame -> minimal ANSI within a ~16ms budget. "A small game engine running React in your terminal."
- **Keyboard primitives are first-class:**
  - `useInput((input, key) => ...)` exposes `key.upArrow / downArrow / leftArrow / rightArrow / tab / return / space` etc.
  - `useFocusManager()` -> `focusNext()` / `focusPrevious()` (Tab / Shift+Tab) for layered focus.
  - `@inkjs/ui` ships ready-made `Select`, **MultiSelect** (checkboxes), `Spinner`, `ProgressBar`.
- **De Stijl is native:** `<Box backgroundColor="red"|"yellow"|"blue">` paints literal Mondrian color-block cells; `borderStyle` + black rules give the grid. Color-as-state is achievable without a custom renderer.
- Ecosystem: `@inkjs/ui`, `create-ink-app`, Pastel (framework layer). Also `@claude-code-kit/*` (a toolkit extracted from Claude Code's Ink renderer with Dialog/Tabs/FuzzyPicker) as a reference.

### The raw-mode lifecycle (the gotcha)
From developerlife.com Ink handbook: once `useInput()` is active the process listens on `process.stdin` in raw mode (this also keeps the process alive). **This works only when launched in a real interactive terminal** - i.e., the user's own shell - NOT when spawned by the agent Bash tool.

---

## 2. How GSD actually does it (the navigator asked)

GSD = "Get Shit Done" (`gsd-build/get-shit-done`, ~23k stars). Docs: gsd-build-get-shit-done.mintlify.app; ccforeveryone.com/gsd; codecentric anatomy writeup.

**GSD builds NO custom TUI.** It is "~50 Markdown files, a Node.js CLI helper, and a few hooks" - 29 skills, 12 agents, 2 hooks - "relies entirely on native Claude Code features. No proprietary runtime." Its "interactive" verify-work step is plain numbered Q&A through the normal agent loop:

```
[1/3] Can you require the middleware and pass it to an Express route? > yes
[2/3] Does a request with a valid signature return 200? > yes
[3/3] ... > no - I'm getting a 500 instead
```

**Lesson (validates the prior diagnosis): GSD feels premium because of DEPTH BEHIND THE MENU - parallel research agents, scored decision matrices, atomic plans, goal-backward verification - NOT because of a fancier widget.** The menu primitive is the same one MindrianOS already uses. The moat is the engine, not the cockpit.

This is the direct answer to the navigator's "I don't see it using Mindrian as much as I want": MindrianOS borrowed Claude's menu primitive (same as GSD) but wired *plumbing* behind it (Context Block, Brain consult) where GSD wired *machinery*. Fix the depth, not the widget.

---

## 3. The fork (two real build paths)

### Path A - Standalone Ink binary (the literal cockpit)
A real command the navigator launches in their **own terminal** (e.g. `mindrian next` / `mos dial`). There it owns a true TTY, so the full vision works:
- arrows to move, space to check (block), left/right to toggle depth/scope
- Ask-Tell slider as a top bar (`< >` keys)
- De Stijl color blocks via Ink `backgroundColor`
- composes a chain, writes it to `room.db` (typed edges via `navigation.cjs`), agent picks it up next turn
- **Only** way to get the literal keyboard cockpit. Claude Code itself proves Ink runs in a real terminal.
- Cost: separate binary; the user must leave the conversation to drive it; bigger build for the part GSD proves is least load-bearing.

### Path B - In-conversation, honest about limits (depth-first)
Stay inside Larry's turn:
- `AskUserQuestion` with **`multiSelect: true`** = real checkboxes ("check this and that")
- a static De Stijl panel rendered above for identity (Mondrian grid as printed output)
- the five real intelligence engines + Hats + File behind it, JTBD-ranked
- Ask-Tell expressed as a posture option / framing, not a live slider
- No arrows, no live left-right toggle - but ships inside the flow Larry already owns
- Wins on GSD's lesson: the value is the depth, which Path B delivers fully

### Recommendation
**B first, A as fast-follow.** Path B puts the intelligence, identity, and multi-select into the navigator's hands now, where the value lives. Path A is the beautiful cockpit but addresses the part (the widget) that GSD proves is not the moat.

---

## 4. The four pillars (navigator's locked requirements)

1. **Intelligence re-wire** - the 5 reaches become real engines, JTBD-ranked, no 3-cap:
   reverse-salient (`find-bottlenecks` + `rs-fetch`), whitespace, find-analogies (SAPPhIRE+TRIZ), find-connections, dominant-designs. Plus **File these findings** always present.
2. **Keyboard TUI** - arrows / block-check / depth toggle / compose a chain (Path A) or multiSelect (Path B).
3. **Mondrian identity** - grid is the frame, color is the state; no two rows read the same.
4. **Ask-Tell as a key** - slide Larry's posture (challenge <-> deliver); governs the framing of whatever fires.

Plus the deeper sub-pipeline:
5. **Hats with research-built personas** - context -> research-grounded personas -> personas cast into De Bono hats -> deliberation. Heavy/research-backed, so it rides as a flagged "go deep" track; personas cached per room, rebuilt on demand (not every run).

---

## 5. The "only 3, need more" cap

`MAX_K=3` is an artifact of keeping the `AskUserQuestion` text menu readable - it is not a doctrine. In a standalone Ink TUI (Path A) there is no reason to cap: show all 5 engines + Hats + File (7 moves). In Path B, `AskUserQuestion` multiSelect can present all of them as checkboxes. Either way the structural cause of the "only 3" complaint is the text-menu primitive, which both paths remove.

---

## 6. Open questions for the spec
- Path B now + Path A fast-follow, or commit straight to Path A?
- Hats personas: confirm cache-per-room + rebuild-on-demand (vs rebuild-fresh every run).
- Hats: 6th ranked reach, or its own "go deep" track the dial points to?
- Keep dominant-designs in the five (navigator listed it twice = locked), or ever swap for a more divergent move? (Currently: keep.)

---

## 8. GSD deep-dive (navigator's own research, 2026-06-08)

Navigator (Jonathan) ran an independent, deeper GSD pass. Key facts and - more important - the strategic read for OUR cockpit.

### Current scale (supersedes the March 23k figure above)
- **64,000+ GitHub stars** (June 2026), 5,000+ forks, 138+ contributors, 57+ releases since Dec 2025. 14+ runtimes (Claude Code, OpenCode, Gemini CLI, Codex, Cursor, Windsurf, Copilot, Cline, Augment, Trae, Qwen, CodeBuddy).
- Install: `npx get-shit-done-cc@latest`; `--minimal` flag drops cold-start overhead ~12K -> ~700 tokens (94%).

### Confirms the executive finding (again)
GSD is "a **slash-command layer injected into your existing terminal**", explicitly **not a standalone TUI**. 64k stars, zero custom widgets. The moat is context engineering, not interaction chrome. Our Path-B "depth-first" recommendation is the same bet GSD made and won.

### The ONE GSD feature that is a direct blueprint for us: `/gsd:progress`
> `/gsd:progress` - "Shows full status, recent work, **routes to next action (Routes A-F)**."

This is GSD's **state-aware next-action router** - structurally the exact thing MindrianOS's suggestion engine wants to be: read room/project state, then route the navigator to the right next move. GSD does it as a deterministic A-F route table behind a plain menu. **That is the pattern to steal for the intelligence re-wire**: a JTBD-state -> ranked-reach router (reverse-salient / whitespace / analogies / connections / dominant-designs / Hats / File) is our "Routes A-F", just with PWS engines as the destinations. MindrianOS already has the ranker (`lib/workflow/f-selector-ranker.cjs`); the gap is the routing *table* points at plumbing, not engines.

### Depth-behind-the-menu, itemized (what makes GSD feel premium)
The machinery the navigator should match, none of which is a widget:
- **Fresh 200k context per atomic task** (orchestrator stays at 30-40% utilization) - context-rot defense.
- **Plan-checker validates 8 dimensions**, loops up to 3x until plans pass (requirements, atomicity, dependency order, file org, verify steps, tech decisions, clarity, Nyquist coverage).
- **Nyquist validation**: maps automated test coverage to *every requirement before code is written* (`VALIDATION.md`); plans with unverifiable tasks are **rejected**.
- **Parallel research agents** (4: stack/features/architecture/pitfalls) feed the planner.
- **Wave execution** by dependency analysis; **atomic git commit per task**.

### Model profiles - directly relevant to the Hats heavy track
GSD's `config.json` `model_profile` (quality / balanced / budget) sets per-agent models (Planner Opus->Sonnet, Researcher Opus->Sonnet->Haiku, etc.). **Lift this for the Hats research-persona track**: persona research is the expensive move (research agents), so a profile knob (or a cheaper model for persona-building, premium for the deliberation) is the cost-control answer to "rebuild fresh vs cache". Reinforces: cache personas per room, rebuild on demand, and let a profile decide model tier.

### Net strategic implication
1. **Don't build a TUI to compete with GSD** - GSD proves the widget is not the moat at 64k stars.
2. **Build the router + the engines behind the menu** - mirror `/gsd:progress` Routes A-F with PWS intelligence as the destinations. That is the "use Mindrian more" the navigator asked for.
3. **Borrow the rigor**: a plan-checker-style gate and Nyquist-style "every reach must produce a verifiable artifact" would give the suggestion engine GSD-grade trustworthiness.
4. **Keep the keyboard cockpit (Path A) as the experiential layer on top** - identity + delight - but sequence it after the engine, not before.

Navigator's sources: augmentcode.com/learn/gsd-58k-stars-claude-code; skillsllm.com/skill/get-shit-done; github.com/gsd-build/get-shit-done; opentools.ai/tools/get-shit-done; libraries.io/npm/get-shit-done-reflect-cc; note.com/genaird; reddit r/ClaudeCode 1qf6vcc.

---

## 9. Open-source prompt-component arsenal (weaponization map)

Navigator's second research pass: a full taxonomy of raw-mode keyboard prompt components across JS/Python/Go/Rust. A "raw-mode keyboard interceptor" - terminal takes ownership of stdin and renders its own highlight loop. **Same TTY constraint as Section 0: every one of these needs a real interactive terminal, so they belong to Path A (standalone binary), NOT in-conversation.**

### Component taxonomy (what we actually need)
| Component | Behavior | Maps to pillar |
|---|---|---|
| Multi-Select / Checkbox | `↑↓` nav, `Space` toggle `[✓]`, `Enter` submit array | pillar 2 (check this and that) |
| Ordered checkbox | returns items **in the order checked** | **pillar 2 - "build next steps" / compose a chain** |
| Group multi-select | grouped/sectioned multi-pick | **"layer of choices"** |
| Confirm (`←/→` toggle) | boolean via left/right | **Ask-Tell slider feel (pillar 4)** |
| Raw / selectKey (`1-9`) | instant pick by number | matches Larry's "1,2" typing, formalized |
| Spinner / tasks | async status while engines run | the "research agents launched" moment |

### Universal keybindings to honor
`↑/k` `↓/j` move - `Space` toggle - `Enter` submit - `A` all - `I` invert - `Tab/Shift+Tab` field - `←/→` confirm toggle - `g/G` first/last - `1-9` raw pick - `Esc/Ctrl+C` cancel-gracefully.

### The weapons (ranked for Mindrian)
1. **`inquirer-ordered-checkbox`** (`@kyou-izumi/inquirer-ordered-checkbox`) - **THE find.** Returns selections *in the order the user checked them*. That is literally the "build next steps" pillar: check reverse-salient, then whitespace, then file -> get `['rs','whitespace','file']` as an ordered pipeline. Do not hand-roll chain composition; this returns it.
2. **`@clack/prompts`** (v0.11, ~80% smaller, modern) - `multiselect`, **`groupMultiselect`** (= the "layer of choices"), `confirm` (`←/→` = Ask-Tell feel), `selectKey`, `spinner`, `tasks`, `note`. This is what GSD-class installers use. Beautiful, TS-native, minimal. **Primary recommendation for the Path A binary.**
3. **`@inquirer/prompts`** (`@inquirer/checkbox` v4.2.2) - more options, **customizable shortcuts** (`shortcuts: {all:'a', invert:'i'}`), `Separator`. Use if we need fine shortcut control.
4. **`@claude-code-kit/ui` + `@claude-code-kit/ink-renderer`** - extracted from Claude Code's own leaked Ink renderer (custom reconciler, pure-TS Yoga flexbox, full ANSI/CSI/DEC/OSC parser, ~140 components / ~85 hooks). Components: `REPL`, `Select`, `PromptInput`, `Spinner`, 21+ more. **Use this when we want maximum visual fidelity / pixel-exact De Stijl control** - build on the exact engine Claude Code uses.
5. Cross-language fallbacks (not our stack, logged for completeness): Python `InquirerPy` / `questionary`; Go `Bubble Tea` + `bubbletea-multiselect`; Rust `cliclack`. MindrianOS is Node/CJS, so JS libs win.

### Weaponization verdict
- **Path A binary** = `@clack/prompts` for the shell (groupMultiselect + confirm + selectKey + spinner) + **`inquirer-ordered-checkbox` for the chain-compose step** + Ink/`backgroundColor` (or `@claude-code-kit`) for the De Stijl color-block skin.
- **In-conversation (Path B)** = stays `AskUserQuestion` multiSelect (no library can beat the TTY wall here).
- Do NOT build a checkbox/ordering engine from scratch. The order-preserving checkbox and grouped multiselect already exist; wrap them and feed the JTBD-ranked reaches in.

### Naming (the F.1 selector needs a user-facing name)
Internal names (`Shape F.1`, `F.1 selector`, `Decision Gate`) are engineer-speak. The user-facing surface needs a Mindrian + JTBD name. Candidates under decision (see conversation): **Next Move** (JTBD-direct), **The Crossroads** (decision-point), **The Console** (drivable cockpit), **The Compass** (navigator bearing). Pending navigator pick.

---

## 10. Five-lens synthesis - the component-utilization design (fan-out, 2026-06-08)

Five parallel agents (user/JTBD, component-to-moment, De Stijl, making-a-point, surface-audit) each held one lens. They converged independently. The spine:

### The master matrix - right component, right user, right moment, right De Stijl, the point
| Component | Right user(s) | Right moment / operator | Right way (interaction) | De Stijl (color = state) | The point it makes |
|---|---|---|---|---|---|
| **Select (one)** | Founder, Student, Operator (focus-seekers) | "I'm stuck -> pick a move" (mode_a, score >=0.70); BUILD_ROOM destination; DECISION_GATE verb | cursor = the RED block moving; YELLOW = recommended until landed-on | RED cell = cursor/selected; YELLOW = recommended; right zone = confidence dial | "Focus. You can't do everything. Commit." Exclusion IS the lesson. |
| **Multi-select** | Researcher, Mentor (gatherers) | EXPLORE_CAPTURE ("check threads to file"); File findings (batch) | Space toggle, Enter array; trailing Confirm to commit | RED = checked, WHITE = available; checkmark rides inside the red cell | "These aren't rivals - the layers coexist." Breadth where breadth is true. |
| **Ordered checkbox** | Operator, Investor, Domain Expert (planners) | "Compose a chain: rs -> whitespace -> file" (METHODOLOGY) | returns items IN CHECK-ORDER; right-hand chain rail grows | RED cell + **black ordinal** (1,2,3) = the sequence; chain rail = stacked red blocks | "The ORDER of your thinking is the point." Sequence encodes causality. |
| **Group multi-select** | Investor, Domain Expert, Mentor | Layered capture; the Hats "go deep" track | Tab between groups (compartments), Space within | each group = a black-ruled board; BLUE header = deep track; split header = partial | "Your choice lives in a structure - see the layers as you pick." |
| **Raw select (1-9)** | Operator (power), returning users | Onboarding lanes; TELL-lean turns; the "1,2" idiom | press number, instant; no navigation | black digit in white keycap; YELLOW keycap = recommended | "You already know. Go. No ceremony." Speed = respect. |
| **Confirm (left/right)** | All, at commit | Destructive/committing action; **Ask-Tell posture slider** | left/right slides the RED block across the seam | RED = active side, WHITE = inactive; BLUE pole = challenge/deep | "A real decision has two sides - even NOT doing it is a decision." |
| **Text input** | Student, anyone the menu fails | JUST_TALK (free text only); REJECT-reason; Free-Text-always-last | open prose; Larry interprets/routes | white cell + RED focus gutter; anchors the white-space base | "No menu fits this - say it your way." Where the reframe lives. |
| **Spinner / tasks** | All | While engines run (rs/whitespace/research/Brain) | non-interactive status; names what's running | cells fill BLUE = running -> RED+checkmark done; white = pending | "Real math is running. This is worth the wait." The moat made audible. |

### Cross-cutting conclusions (all five lenses agree)
1. **The surface serves two opposite postures at once.** Founder/Student/Operator want ONE recommended move + fast pick; Researcher/Investor/Mentor/Domain-Expert want to browse, compare, weigh with evidence tiers visible. This is the Ask-Tell dial - inherit it, don't pick a fixed verbosity. The ranker (`f-selector-ranker.cjs`) already emits both (`jtbd_label` + investment-scaled `why`).
2. **The component IS the dial made physical.** ASK-lean (turns 1-3) -> Text / Select / Group (force reflection). TELL-lean (turn 8+) -> Raw 1-9 / Confirm / Ordered (move fast). A navigator should read the dial position from the *shape* of the prompt before reading a word. Moving the dial should visibly swap the component shape - "you've earned the fast lane."
3. **A hard recommendation must be earned or it backfires.** The skeptical half distrusts an unbacked RECOMMENDED. The frozen 0.70 gate (Mode A only; zero markers in Mode B / cold room) is load-bearing for credibility - honor the absence, never fake a default pick.
4. **Rejection is data, and it's the mechanic that serves the skeptics.** Researcher/Investor/Mentor/Domain-Expert reject for a living. REJECT-with-reason must be trivially low-friction (a Text capture on the no). Silent click-away rejection is the system's failure mode (`recordSelectorMiss` already exists).
5. **The real output is never the widget - it's the typed edge.** Every persona's choice ends as a `SELECTED_REACH`/decision edge through `navigation.cjs`. GSD's lesson and the user lens agree: depth-behind-the-menu serves all seven personas; a fancier widget serves only Operator + Domain-Expert. Build the engine first.

### De Stijl: one state-map, two substrates (named seams)
Single source of truth: **RED = selected, YELLOW = recommended, BLUE = deep/running, WHITE = available, BLACK = frame.** CLI realizes it via glyph + position + 5-color foreground; Ink realizes it via painted `backgroundColor` cells (the "second channel" the ANSI terminal could only gesture at). Three palette collisions, each resolved by the existing **surface-routing carve-out** (pick palette by surface, not JTBD):
- **Red-collision** (CLI red = error vs Mondrian red = selected): on CLI selection is never red (carried by `▶`+position); on Ink errors are a black-hatched cell, never red.
- **Green-absence** (no green in Mondrian primaries): success = green on CLI, locked-in RED + checkmark on Ink.
- **Blue-absence** (no blue on CLI): cyan stands in for deep/heavy.
Action: codify these three in `skills/ui-system/SKILL.md` Section 4 as a named carve-out block (same pattern as the no-emoji/statusline exception).

### Feasibility (surface audit) - lower than expected
- The selector family is **already shipped**: F.0 (gate/confirm), F.1 ("Next Move", the default), F.2-F.6, and **F.7 = the dial-TUI (90% built)**. All render through `AskUserQuestion`; **zero** inquirer/clack/ink/blessed/readline/setRawMode in the repo today.
- `renderShapeF1()`, the frozen 0.70/0.15 gate, `f-selector-ranker.cjs` (MAX_K=3), `dial-reach-orchestrator.cjs` (DIAL_REACH_K=5), `dial-label-composer.cjs`, and `dial-close-reach.cjs` (4-outcome write through `navigation.cjs`) are all reusable verbatim.
- Retrofit map: **Select / Confirm = reuse F.1 / F.0** (lowest cost). **Multi-select, Ordered checkbox, Group multi-select = net-new** (wrap `inquirer-ordered-checkbox` + `@clack groupMultiselect` on Path A). The dial core is a pure wrapper away from a TUI widget.
- No-break path: add an optional `{tui:true}` render flag; `AskUserQuestion` stays the default fallback; all writes stay local through `navigation.cjs` (zero Brain egress).

### Naming resolved-by-evidence
The audit shows F.1 is **already internally called "Next Move"** (`shape-f1-renderer.cjs`). The user-facing name **Next Move** therefore has roots in the code, is JTBD-direct ("what do I do next"), and survives being said out loud. Recommend adopting **Next Move** as the user-facing name for the selector surface; reserve a distinct name only if the keyboard cockpit (Path A) ships as its own product. (Navigator to confirm.)

### Recommended build ordering (engine-first, per GSD's lesson)
1. **Re-point the reaches** to the five real engines + Hats + File, JTBD-ranked (in-conversation, `AskUserQuestion` multiSelect). This is "use Mindrian more."
2. **Component-by-moment routing** - wire the operator -> component map (Select at gates, multi-select at capture, free-text in JUST_TALK), with the Ask-Tell dial selecting the component shape.
3. **Reject-with-reason + spinner-over-real-compute** - the credibility + honesty layer.
4. **Path A keyboard cockpit** - Ink + `@clack/prompts` + `inquirer-ordered-checkbox`, De Stijl color-blocks, as the experiential skin, LAST.

---

## 11. Room-structure TUI - "The Map" (fan-out agent, 2026-06-08)

A Lazygit-style room navigator: left = section tree, right = section detail, third = graph neighborhood. Reads exclusively through `lib/core/navigation.cjs` (Canon Part 9 chokepoint). Working name **The Map** (North Star: "Mindrian is compass and map for the wicked navigator"); the selector that fires off it is **Next Move** (Shape F.1).

### Information architecture (every field grounded)
| Panel / element | Data source (file:function) | Field |
|---|---|---|
| Section tree node | folder-memory via `scripts/mos-status.cjs`; ROOM.md identity | slug + governing thought |
| Section health glyph | `commands/status.md` `reasoning_health_score` | check >=0.7 / warn 0.4-0.7 / low <0.4 / -- |
| Governing thought | `room-home.cjs:getCurrentThesis`; per-section MINTO | quoted thesis |
| Confirmed facts | `room-home.cjs:getConfirmedFacts` | claim/decision/opportunity, confirmed/validated |
| Risky assumptions | `room-home.cjs:getRiskyAssumptions` | needs_evidence, conf ASC |
| Evidence by tier | `room-home.cjs:getEvidenceByTier` | academic/operational/practitioner/none (Part 5) |
| Contradictions | `insights.cjs:findContradictions` | CONTRADICTS edges + explanation |
| Open questions / unsupported | `insights.cjs:findOpenQuestions/findUnsupportedClaims` | nodes lacking SUPPORTS/EVIDENCES |
| Graph neighborhood | `neighborhood.cjs:getNeighborhood` | edgeTypeIn, depth, score, edgePath |
| Active focus marker | `focus.cjs:getActiveFocus` | the `▶` cursor anchor |
| Per-turn seed | `room-context.cjs:getRoomContext._meta.seedNodeId` | where the conversation is "near" (Path B auto-positions cursor) |

Edge ranking (frozen, `neighborhood.cjs:29-44`): CONTRADICTS/INVALIDATES 1.0, DEPENDS_ON/ASSUMES 0.9, SUPPORTS/EVIDENCES 0.8, INFORMS/ENABLES 0.6, CONVERGES/MENTIONS_ENTITY 0.4.

### Interaction model
Three panels, Tab cycles focus. Keys: `↑↓/jk` move, `←→/hl` collapse/expand, `Enter` drill/`setFocus` (writes `focus_changed` event), `g` graph neighborhood, `e` follow edge, `c` next contradiction, `?` inspect provenance, `Space` add node to a Next Move chain (ordered-checkbox), `Esc` cancel. The cursor position IS the persisted focus anchor - the TUI is a *view* over the focus chokepoint, not a new state store. Looking always ends in a Decision Gate (Free-Text last).

### De Stijl
Reuses the Section-10 color-state map (RED=selected/needs-attention, YELLOW=recommended/in-progress, BLUE=deep/running, WHITE=available, BLACK=frame). Tree health-to-color: `reasoning_health_score < 0.4` or many-entries+broken-MINTO -> RED; mid -> YELLOW; computing -> BLUE; solid -> WHITE + green check. Realizes the `SKILL.md §10` routing-priority as color.

### Mock A - tree + detail (80-col, the CLI master / Path B output)
```
|- my-venture -- The Map -- IDP / Wicked ------------------------------------|
| SECTIONS              | market-analysis                                     |
|                       |   "TAM of $12B is bottom-up defensible"   ✓ 0.82    |
| ▼ market-analysis  ✓  |                                                     |
|   ▶ problem-defn   ⚠  | CONFIRMED FACTS (3)                                  |
|   ▷ solution       -- |   ✓ claim   Hospital IT integration is the wedge    |
|   ▶ business-model ⚠  |   ✓ decision  Pilot with 2 academic centers first  |
|   ▷ competitive    -- | RISKY ASSUMPTIONS (2)   [needs_evidence]            |
|                       |   ⚠ Buyers switch vendors mid-contract       0.30   |
| 7 sec · 4 filled      | EDGES  SUPPORTS 4  CONTRADICTS 1  DEPENDS_ON 3      |
| health 0.55           | EVIDENCE  acad 1 · oper 2 · prac 4 · none 6   ⚠     |
|-----------------------+-----------------------------------------------------|
| ▼ LOCAL / BRAIN / SIGNAL          [■ GATE]  focus: section:market-analysis  |
| ▶ 1. Navigate Graph (walk CONTRADICTS) [g]  2. Run Methodology  3. Free-Text|
|----------------------------------------------------------------------------|
```
(Graph-neighborhood mock + detail-drilldown mock retained in the agent transcript; chain rail at bottom = ordered-checkbox compose, Path A.)

### Reuse map (Canon Part 7 - ~90% repoint, not net-new)
- `/mos:status` -> becomes the **section tree** (left). `/mos:room [section]` (Shape C) -> **detail panel** (right). `room-graph`/`/mos:graph` -> **graph neighborhood** (driven by `getNeighborhood`). `room-dashboard` (HTML) -> stays the browser sibling (same room.db). `/mos:wiki` -> reached via Enter-into-artifact. `/mos:suggest-next` + dial F.7 -> the **bottom selector** of every Map view. Net-new = only the panel-composition view layer + (Path A) the Ink binary. Zero new SQL, zero new node types, zero Brain egress.

---

## 12. /mos:help + per-command visual system (fan-out agent, 2026-06-08)

### /mos:help as a Group Multi-Select
Current (`commands/help.md` + `data/help-groups.json`): 4 lanes (start/methodology/explore/view) as parallel `AskUserQuestion` tabs, commands as options. Upgrade = re-cast as the **Group Multi-Select archetype** ("your choice lives in a structure; see the layers as you pick"). `help-groups.json` already carries 11 groups each with a `lane:` and a `glyph:` (`▶ ? □ ◆ ⚡ ▸ ✓ ↓ ↗ ⬡ ⚙`). Three deltas: (1) color-as-lane + glyph-as-group; (2) a recommended command per lane, marked `▶` only at Brain conf >=0.7 (Mode A), `▷` otherwise; (3) Free-Text always last -> routes to `/mos:mos`.

### Per-command visual taxonomy - 7 interaction archetypes
Two existing orthogonal axes: `body_shape:` (A/B/C/D/E/methodology = layout) and Shape F.x (the selector). An archetype pins {component × F-sub-shape × De Stijl}:

| # | Archetype | TUI component | body_shape | Selector | Commands (from help-groups.json) |
|---|---|---|---|---|---|
| A1 | Single-pick methodology run | **Select** (focus) | methodology | F.1 | beautiful-question, root-cause, lean-canvas, think-hats, find-analogies, find-connections, find-bottlenecks, dominant-designs, scenario-plan, mullins, build-thesis, structure-argument... |
| A2 | Multi-select capture | **Multi-select** | C | F.4 | validate, whitespace, opportunities, funding, persona, hat-briefing, memory |
| A3 | Compose-a-chain pipeline | **Ordered checkbox** | E | F.2 | pipeline, act --chain, mva-brief, mva-option |
| A4 | Confirm / destructive / posture | **Confirm (←/→)** | carrier | F.0 (+reason edge) | export, update, vault, snapshot, publish, reanalyze, doctor, setup |
| A5 | Browse / navigate structure | **Raw 1-9 / Select** | B or D | F.1 | rooms, room, status, graph, wiki, suggest-next, jtbd, operator, models, diagnose |
| A6 | Long-running with spinner | **Spinner / tasks** | E | F.4 | research, rs-fetch, rs-thesis, scout, brain-derive, deep-grade, grade, file-meeting, build-knowledge |
| A7 | Generate / open artifact | **Select -> open** | E or D | F.5 | dashboard, present, visualize, scheduled-tasks, new-project, onboard |

Anchors proving it's real: `/mos:act` already `body_shape: E`+`serves_jtbd:[plan-execution]` (A3); `lean-canvas`/`challenge-assumptions` already `body_shape: methodology` (A1); `rooms` already `body_shape: B` (A5); `export` already `disable-model-invocation:true` (the A4 signal).

### Rollout rule (reuses the Phase 121.5 body_shape-sweep + Phase 122 registry pattern)
1. **Declare** one frontmatter field: `interaction_archetype: A1..A7`.
2. **Resolve** via a new `lib/hmi/archetype-map.json` (mirrors `jtbd-taxonomy.json`) -> AskUserQuestion shape + De Stijl recipe; `lib/hmi/selector-dispatcher.cjs` picks the component automatically (no bespoke widgets - SEED-020).
3. **Default + degrade**: absent field falls back to `body_shape` (B->A5, C->A2, E->A6/A7, methodology->A1); non-TTY degrades to printed De Stijl card.
4. **Enforce**: a `--check` tripwire (clone of `build-command-registry.cjs --check`) fails the build on archetype/body_shape conflict. Path A consumes the same field later - declared once, serves both substrates.

---

## 13. Hebrew / RTL architecture (fan-out agent + Tavily bidi, 2026-06-08)

**Current state = no RTL + one anti-feature.** `lib/core/mva-progressive-renderer.cjs` / `mva-deck-builder.cjs` hardcode a refusal: *"MindrianOS does not yet support Hebrew in v1.13.0."* Every other surface is silently LTR-only: `render-v2.cjs` pads by `.length` (bidi-blind); all HTML templates are `lang="en"` with no `dir`. (Live proof of need: `~/MindrianRooms/mindrianOS/meetings/2026-06-08-tester-onboarding-session/recap-install-guide-he.html` - a Hebrew install recap already shipping.)

### Why terminal Hebrew is hard (Tavily + W3C/ICU/UAX#9)
1. **Logical vs visual order** - stored logical, must display reversed. Browsers run the Unicode Bidi Algorithm (UAX #9) automatically; **terminals do not**, and each terminal does something different. 2. **Mixed-direction lines** - `Section: בעיה (3)` has 3 direction runs; neutral punctuation/digits flip to the wrong side. Our glyph-prefixed rows (`▶ 1. <hebrew>`) are the worst case. 3. **Column math breaks** - `.padEnd` on UTF-16 `.length` != display columns once niqqud (zero-width) appears. 4. **Box-drawing fights RTL** - the frame "jumps" to the wrong side. **Conclusion: the TUI must NOT attempt visual RTL** - stay LTR-structural, bidi-isolate Hebrew runs.

### Surface-by-surface strategy
| Surface | Renderer | Strategy |
|---|---|---|
| CLI / TUI | terminal (not ours) | **LTR-structural, RTL-content isolated** via Unicode isolates `U+2066 LRI`/`U+2067 RTI`/`U+2069 PDI`; pad by display-width not `.length` |
| HTML wiki/dashboard | ours (browser) | **Real RTL**: `<html dir="rtl">` / `dir="auto"`, CSS logical properties |
| Decks | ours (browser) | **Real RTL per-slide**; bilingual recap.html stays IRIS canon |
| Emails | mail clients | **LTR shell, RTL content blocks** (honors `feedback_email_alignment_ltr`: never center) |
| Room markdown | stored data | **Store logical order, never reorder at rest**; reorder only at render (`feedback_appendix_content`) |

### Bundle abilities to ship: a new `lib/render/bidi.cjs`
- `displayWidth(str)` (grapheme/EAW-aware, native via Intl.Segmenter) - replaces every `.length` in column math.
- `isolate(str)` (wrap runs in LRI/RTI/FSI...PDI, native) - the core TUI lever.
- `hasRTL/detectDir` (first-strong, `֐-׿`, native).
- `padDisplay(str,n,side)` (direction+width-correct pad).
- A `--lang he` / `MINDRIAN_LANG` + per-room `lang:` front-matter flipping a `directionContext`.
- HTML: `dir="auto"` + CSS logical properties (`text-align:start`, `margin-inline-*`).
- A full bidi library (`bidi-js`, pure JS) only behind a future PDF/print path; CLI (isolates) + HTML (browser) do NOT need it.
- **Retire the `HEBREW_REFUSAL`** in the MVA renderers - the single most visible RTL bug.

### De Stijl + RTL
Color is **semantic, never remapped** - red stays "error/selected" in Hebrew. Mirror **reading flow** (inline-start/inline-end via CSS logical props) not the color contract. A mirrored Mondrian is still a Mondrian; a recolored one is off-brand. CLI caveat: the 80-col frame does NOT mirror (terminals can't portably) - only content runs get isolated; full De Stijl mirroring is HTML-only.

### Anti-patterns
Never reorder code/paths/URLs/Cypher (force `dir=ltr`/isolate even inside RTL docs); never center; never reorder stored data; never compute layout on `.length`; never trust terminal bidi (make output correct with isolates so it degrades gracefully); keep `dir="auto"` honest (use explicit `dir="rtl"` when `lang:` known).

---

## 14. Tester interaction evidence (located 2026-06-08 - to mine)

The navigator asked to mine real tester interaction to ground the TUI value claim. Located sources (room: mindrianOS):
- **`~/MindrianRooms/mindrianOS/meetings/2026-06-08-tester-onboarding-session/2026-06-08-tester-onboarding-session.md`** (71KB) - **this IS the Lawrence/Jonathan live product-test transcript** that triggered this whole research thread. It is the primary evidence: Larry reaching intelligence ONLY when told the magic words ("find analogies", "use HATS"), navigating by typing "1, 2", asking for tabs/slider/breakthrough. Every pillar in this doc is grounded in it.
- `~/MindrianRooms/mindrianOS/meetings/2026-06-02-intern-qa-session-01/` - QA session.
- `~/MindrianRooms/mindrianOS/meetings/2026-04-19-jonathan-lawrence-v3-product-session/`.
- `~/MindrianRooms/mindrianOS/.private/transcripts/` - transcript store.
- `~/MindrianRooms/mindrianOS/MEETINGS-INTELLIGENCE.md` - rolled-up meeting intelligence.
- Hebrew artifact: `.../2026-06-08-tester-onboarding-session/recap-install-guide-he.html` - confirms the RTL need is live, not hypothetical.

**Pending next pass:** a structured read of these to extract concrete "where a TUI would have helped" moments (count of times Larry was coached to a command he couldn't find; moments he typed a number; moments he wanted to compose/order; moments De Stijl/identity mattered). Feed those counts into the phase spec as the evidence base.

---

## 15. Roadmap + GSD phase mapping (so nothing is lost)

The dial cluster is **Phases 140-147** (ROADMAP.md): 140 sentinel-hardening, 141 retrieval-spine + capability-dial doctrine (the 5 reaches), 142 local-intelligence wiring, 143 insight sensors (7-row), 143.1 dial-TUI selector (F.7, SHIPPED), 143.2 Larry-operates, 143.3 connector-spine + intelligence-orchestrator, 143.4 discover-onboarding, 144 engine-flip, 145 scheduled sensors, 146 loop-fires gate, 147 phase-map-drift tripwire. Frontier ends at 147 + Backlog. **All work in this doc slots at 148+.**

### Builds on (PAST phases - reuse, Canon Part 7)
- **88.2** - F.0-F.6 shape family + `renderShapeF1()` + `appendAskUserQuestionTrailer()` (the selector spine).
- **101** - F.6 JTBD-aware Next Move variant.
- **121.5** - the `body_shape` sweep + selector-coverage audit (the rollout pattern for §12's `interaction_archetype`).
- **122** - command-registry + `--check` tripwire (the enforcement pattern).
- **124** - timeline-renderer pattern (pure renderer reads only via navigation.cjs; the MEMDIAL/Map render pattern).
- **125** - the ranker D4 score + D9 investment-aware `why` (`f-selector-ranker.cjs`).
- **141** - the capability-dial DOCTRINE (5 reaches) - §1 re-wire repoints these to real engines.
- **143.1** - the dial-TUI F.7 (90% of the selector core: orchestrator, frozen 0.70/0.15 gate, label composer, `closeReach()` 4-outcome write). The single biggest reuse.
- **143.3** - connector-spine + intelligence-orchestrator (routes to the real engines).

### Learns from (GSD - past & future)
- **GSD `/gsd:progress` "Routes A-F"** = the state-aware next-action ROUTER blueprint for §1 (read state -> route to the right move). MindrianOS already owns the ranker; only the route table points at plumbing.
- **GSD plan-checker (8 dimensions, loops 3x)** + **Nyquist gate** ("every requirement verifiable before code") = the rigor to borrow for a "every reach must produce a verifiable filed artifact" gate.
- **GSD model profiles** (quality/balanced/budget per-agent) = the cost-control knob for the Hats research-persona heavy track (cache per room, cheaper model for persona-build, premium for deliberation).
- **GSD proves the widget is not the moat** (64k stars, zero custom TUI) -> engine-first ordering below.

### Proposed FUTURE phases (148+, for navigator ratification - NOT yet committed)
| Phase | Title | Pillar | Path |
|---|---|---|---|
| **148** | Intelligence re-wire | 5 engines + Hats + File, JTBD-ranked; route table mirrors GSD Routes A-F | B (in-conv) |
| **149** | Component-by-moment routing | `interaction_archetype` field + `archetype-map.json` + dispatcher; Ask-Tell selects component | B |
| **150** | Credibility + honesty layer | reject-with-reason first-class; spinner only over real compute; earned-recommendation gate | B |
| **151** | Room-structure TUI "The Map" | section tree + detail + graph neighborhood; printed first, then keyboard | B -> A |
| **152** | /mos:help + per-command visual | group multi-select help; archetype rollout across ~80 commands | B |
| **153** | Hebrew / RTL bundle | `lib/render/bidi.cjs`; isolates + display-width; retire HEBREW_REFUSAL; HTML dir=rtl | all surfaces |
| **154** | Path A keyboard cockpit | Ink + @clack/prompts + inquirer-ordered-checkbox; De Stijl color-blocks; standalone binary | A |

**Ordering rationale (GSD's lesson):** engine-first. 148-150 deliver the intelligence + credibility inside the conversation where the value lives; 151-152 give it a navigable spatial + help home; 153 makes it bilingual; 154 is the experiential cockpit LAST. The widget is the skin, not the moat.

### Hard constraints carried into every future phase
- The TTY wall (§0): arrow-key TUI is Path A standalone-binary only; in-conversation stays `AskUserQuestion` (multiSelect).
- Zero Brain egress (Canon Part 8): all selector/TUI writes local through `navigation.cjs`.
- Frozen contracts: MAX_K=3 (chooser), DIAL_REACH_K=5, the 0.70/0.15 gate, Free-Text-always-last, the 12-glyph / 5-color UI Ruling System (+ the 3 named De Stijl palette carve-outs in §10).
- No bespoke widgets (SEED-020): every selector resolves from the F-family via the dispatcher.

---

## 7. Sources (Tavily, 2026-06-08)
- Ink GitHub - github.com/vadimdemedes/ink (useInput, useFocusManager, MultiSelect, screen-reader)
- "Building Terminal Interfaces with Node.js" - blog.openreplay.com (Ink vs neo-blessed; Node 22 raw-mode primitives)
- blessed GitHub - github.com/chjj/blessed (Checkbox/RadioSet/List widgets)
- npm trends: blessed vs ink vs ncurses vs react-blessed vs terminal-kit (stars/maintenance)
- @unblessed/core - npm (blessed TS rewrite, alpha)
- "React Powers Claude Code Terminal App" - LinkedIn / Roopak Nijhara (Claude Code = React via Ink; rendering pipeline)
- HN #46902411 - Claude Code is a React app via Ink
- "I studied Claude Code's leaked source and built a terminal UI toolkit" - dev.to/minnzen (@claude-code-kit)
- developerlife.com - Ink v3 advanced components (useInput raw-mode lifecycle)
- StackOverflow 17470554 - capturing arrow keys in Node (raw mode + escape sequences)
- StackOverflow 76146133 - shells & TTY (stdio:'inherit' passes TTY; piped = non-interactive)
- Node.js TTY docs - nodejs.org/api/tty.html (isTTY, setRawMode)
- Bash tool - platform.claude.com/docs (subprocess capture model)
- Reddit r/ClaudeAI 1n8odeu - "Claude code can't run interactive code itself" (no TTY, batch execution)
- GSD docs - gsd-build-get-shit-done.mintlify.app; github.com/gsd-build/get-shit-done; ccforeveryone.com/gsd; codecentric anatomy of GSD workflows; thenewstack.io GSD writeup

### RTL / bidi sources (added 2026-06-08)
- Unicode Bidirectional Algorithm (UAX #9) basics - w3.org/International/articles/inline-bidi-markup/uba-basics (logical vs visual order, neutrals, numbers)
- ICU BiDi - unicode-org.github.io/icu/userguide/transforms/bidi.html + ICU4J Bidi apidoc (reorder modes, logical-to-visual)
- "Why is software support for Bidirectional text so poor?" - StackOverflow 124002 (don't break strings; a stray `-` mangles bidi)
- LVGL Hebrew/BiDi support - lvgl.io/blog/announcement-hebrew-bidi-support (custom UBA impl, Culmus fonts)
- Node TTY raw-mode + arrow escapes - StackOverflow 17470554; nodejs.org/api/tty.html
- Ink RTL: no native RTL; `useInput`/`useFocusManager`/`Spacer`/`backgroundColor` - github.com/vadimdemedes/ink, vadimdemedes.com/posts/ink-3, developerlife.com Ink v3
- nano-devel RTL terminal thread - lists.nongnu.org (terminals do not run UBA)
- IBM HOD bidi help - logical vs visual file types, symmetric swap (enterprise bidi precedent)

### Canon binding note (per CANON-PHASE-MAP.md forward-compatibility rule)
Every proposed phase 148-154 (§15) MUST declare `canon_parts:` frontmatter before plan approval, and update CANON-PHASE-MAP.md in the same commit. Expected canon_parts: Part 3 (Decision Gate / Shape F), Part 4 (every choice = typed edge), Part 7 (reuse before build), Part 8 (zero Brain egress), Part 9 (writes through navigation.cjs), Part 10 (conversation as product). The map also warns: key obligations on phase SLUG, not number (the Phase 92 collision). Use slugs: `intelligence-rewire`, `component-by-moment-routing`, `credibility-honesty-layer`, `room-structure-tui-the-map`, `help-and-per-command-visual`, `hebrew-rtl-bundle`, `path-a-keyboard-cockpit`.
