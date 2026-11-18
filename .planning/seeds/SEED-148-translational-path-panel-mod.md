---
id: SEED-148
status: dormant
planted: 2026-11-18
planted_during: work/part8-shape-packet (owner design session, panel UI/UX)
trigger_when: the next milestone that touches the panel mod (369.26 workspace mod, 380 mos-face), the Data Room structure, or the researcher / TTO audience; or when the owner answers D1-D4 on the discovery audit page
scope: large
---

# SEED-148: The translational-path panel, built as a mod

The panel becomes the product's experience; the terminal stays the runtime. Generative UI from one Vercel json-render catalog, first surface the Claude Desktop Code tab mod pane, Data Room restructured into eight stations. Owner-approved 2026-11-18.

## Why This Matters

- The audience is the translational scientist (one or a few rooms) and the TTO / IP portfolio manager (many rooms) (owner ruling 2026-11-18).
- Discovery evidence: Noga Yerushalmi's hands-on beta.87 session (2026-11-16, room noga-mventures). She "would not have reached this with Claude, and not without you" (2:20:25). The value is the steered method; the founder did the steering by hand. Her friction is readability and orientation: options not understood (1:13:29), two asks one answer (1:42:43), trees confuse, work linearly (1:52:20), state unclear (1:12:51), vision problem (44:49), drift twice (1:17:54, 1:26:05), "where is the Word document?" (2:44:40), "how do I get back?" (2:28:25).
- Her introduction to Merck Healthcare's new global AI unit depends on a case that wows; she retires around March to April. The test window is short.

## What to build (version one)

Do first: open-questions tracker; working / waiting / done status; large type, high contrast, no terminal noise.
Next: job card with intent-sync drift catch (the JTBD lives in the local graph and on Theo; show agreement, turn yellow on drift, ask once); plain options that say where they lead; handover shelf with Word and PDF plus a questions-and-answers digest; filing tray (F.8, proposed only); ask-before-web-search card; record of contribution (for inventorship).
Every F.0-F.9 decision shape renders as a panel component, never as terminal text.
Data Room: eight stations (1 The question, 2 What is known, 3 The idea, 4 Does it hold, 5 Who owns it, 6 Who needs it, 7 The way out, 8 Handover); opportunity bank as a side shelf.
Look: the PwS book product system (theo-context docs/PWS-BOOK-PRODUCT-SYSTEM.md, Clay University reference), not Canon v5.
Out of version one: portfolio board (hypothesis H6 untested), browser twin, on-prem, discovery engine.

## Gate

Hypothesis H1: a translational scientist reaches a deliverable she would send, with no one at the keyboard, once the steering is on screen. Test: Noga plus two scientists, one 90-minute session each, founder silent. If no one finishes with a sendable document, the product becomes a guided service and this plan changes.

## Feasibility (checked 2026-11-18, Claude Code 2.1.326)

PROVEN in the engine's own test kit (`claude plugin test`, 3 of 3 pass), spike at ~/dev/mindrian-panel-spike:
- @json-render/core 0.23.1 + zod 4.3.6, bundled by esbuild into one ESM file (520 KB, no Node or DOM globals), loads inside a mod, validates a spec and catalog props, and draws on the terminal and desktop surfaces.
- A decision card moves into the panel: a `tool.call` hook on AskUserQuestion holds the call, the pane draws the question and options, a press returns `{ questions, answers }` to the model. The same mechanism serves "ask before web search".
- Text size tokens (caption to title) and weights are accepted on both surfaces.

FROM THE API DOCS, not yet run live:
- The Desktop app has Box, Text, Button, Input, Select, Svg, Link, Code, Markdown, Progress, Client, Shader; panes dock or open as a widget there.
- Room data: `$.mcp.call` to the mindrian-os server (gate_list, room_changes, question_read), `$.fs.read`, `$.process.run`.
- Status from `turn.start` / `turn.complete`; open questions from `prompt.submit` plus `$.store`; drift from `$.model.classify`.

RISKS:
1. Word / PDF export: a mod has no Node. Route it through the plugin's MCP server (Node) with a pure-JS docx library; do not depend on pandoc or Python on the user's Windows machine (Python broke in the session, 55:09).
2. Drift checks cost model calls; she hit 90% of a five-hour limit (2:45:22). Run them on turn completion with a small model, not every keystroke.
3. Visuals: a pane cannot host HTML or an iframe. Maps must become Svg (up to 131,072 characters) or open outside via Link.
4. Remote Control and phones draw no panes (anthropics/claude-code#105772). Version one is the local Desktop or terminal session only.
5. Live session state should use `$.state` / `$.store`, not module variables (a reload resets them). The spike used a module variable.
6. The real mods docking width and the Windows Desktop path are not yet seen live (369.26 render check still pending).

## Breadcrumbs

- Discovery audit (product-engineering propose): https://claude.ai/artifact/QTh5efpxfrDmpUuBESMUr8
- Mockup canvas: https://claude.ai/artifact/VcnhtzR6p4Ve5o6KfxMThr
- Directive D1-D13 and stations: owner memory feedback_uiux_directive_translational_path.md; panel decision: project_panel_ui_jsonrender_two_faces_2026_11_18.md
- Existing work: .planning/phases/369.26-mindrian-workspace-mod-an-orientation-band-and-docked-review/ (ui/mindrian-workspace-mod, render check human_needed); .planning/phases/380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7/
- Spike: ~/dev/mindrian-panel-spike (mod/ and entry.js)
- Research: code.claude.com/docs/en/plugins/mods; json-render github.com/vercel-labs/json-render; microsoft/terminal#8389 (no kitty images in Windows Terminal)

## Notes

Open owner decisions D1-D4 (who tests first, where it runs, confidential data, which demo case) are on the audit page. Build order once triggered: run the pending 369.26 render check, then the catalog and mod renderer, then the version-one parts, then the H1 test.
