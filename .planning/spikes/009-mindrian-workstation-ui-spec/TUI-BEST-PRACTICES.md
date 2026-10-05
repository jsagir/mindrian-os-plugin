# Terminal UI best practices, researched for the Mindrian workstation

Researched 2026-10-06 with Tavily (5 searches, 2 page extractions). Source weight is stated per
row: FIRST-PARTY = a maintained standard or official docs; COMMUNITY = a practitioner write-up
or a skill file written for coding agents (useful, not authoritative); ADJACENT = a different
field (driving displays) used only as an analogy. Nothing here has been run in a Claude Code
mod yet.

## What the best terminal apps and guides agree on

| # | Practice | Source (weight) |
|---|---|---|
| 1 | Keep keys visible: a footer that shows only what you can do right now, a `?` overlay for the full list, deeper docs on demand. "Undiscoverable keybindings" is the most-cited failure. | hyperb1iss tui-design (COMMUNITY); bwplotka on lazygit (COMMUNITY) |
| 2 | Show where you are the moment the app opens. Lazygit's value, in one reviewer's words: you "immediately know where you are and where things are", with no extra commands. | bwplotka.dev/2025/lazygit (COMMUNITY) |
| 3 | Use the words of the person's own domain, not the tool's. Lazygit sticks to native git terms, which lowers the learning curve, and teaches as you go. | bwplotka.dev (COMMUNITY) |
| 4 | Never carry meaning by color alone. Pair it with a word ("Success", "Error"). Use the basic 16 colors as the foundation because people can remap them; richer color enhances, it never creates the hierarchy. | Fuchsia CLI guidelines (FIRST-PARTY); PatternFly CLI handbook (FIRST-PARTY); hyperb1iss (COMMUNITY) |
| 5 | Honor `NO_COLOR` (any non-empty value), `TERM=dumb`, and a non-terminal output. Use color with intention: if everything is a different color, color means nothing. | no-color.org, clig.dev (FIRST-PARTY) |
| 6 | Hierarchy without color: bold for headers and the active item, dim for secondary detail, reverse video for selection (it always works), roughly 80 percent of text in the default style, accents only on things you can act on. | hyperb1iss (COMMUNITY) |
| 7 | Name colors by job ("emphasis", "muted", "selected", "warning") and map them through one theme; never hardcode a color value inside a widget. | hyperb1iss (COMMUNITY); vue-tui docs (COMMUNITY) |
| 8 | Responsive: set a floor (80 columns by 24 rows is the usual one), then collapse the least important panels first, switch to a single panel below a breakpoint, and show a plain "make this window bigger" note under the floor. Test at 80x24, 120x40 and 200x60. | hyperb1iss (COMMUNITY); Ratatui layout docs (FIRST-PARTY for constraint layouts) |
| 9 | Focus: only one thing takes keys; the focused thing is visibly different; unfocused panels dim; Esc goes back; Tab moves on; a dialog traps focus. | hyperb1iss; vue-tui; GitHub TUIKit (COMMUNITY) |
| 10 | Match friction to risk: reversible actions just happen with a brief confirmation; a moderate action asks inline; a severe one asks you to type the name. Toasts last 3 to 5 seconds. | hyperb1iss (COMMUNITY) |
| 11 | Feedback within about 100 ms; never block the screen while work runs. | hyperb1iss (COMMUNITY) |
| 12 | One job per view; "Esc means back" is understood everywhere. Show the commands at the bottom so memory is never a prerequisite. | Medium todo-app case study (COMMUNITY) |
| 13 | Over-decorated chrome is an anti-pattern: "borders and colors serve content, not ego. The content is the interface." Make "feels busy" countable (a clutter audit). | hyperb1iss; gfargo tui-design-skill (COMMUNITY) |
| 14 | Screen readers read text in a line: give every icon, color and bar a text alternative, hide purely decorative art, avoid animated spinners, keep a plain mode. | GitHub TUIKit foundations (FIRST-PARTY for that product); Seirdy; AFixt (COMMUNITY) |
| 15 | A glanceable display is about attention, not capacity: the question is how limited attention is allocated. Put the highest priority information first, use motion only as short emphasis, and do not let a display compete with the main task. | MDPI 2026 study on driving heads-up displays (ADJACENT, analogy only) |
| 16 | Keep status bars thin: one practitioner moves detail out of the bar because he does not want to clutter it while working. | Tmux from Scratch video (COMMUNITY) |

## What a Claude Code mod does NOT own

Full-screen apps must manage the alternate screen, restore the terminal after a crash, handle
window resize and suspend, and avoid flicker. In a mod the host owns all of that. A mod owns
only: layout inside the cells it is given, the words, the colors, the key table, focus, and what
it shows when data is missing. That keeps the checklist short.

## What this changes in the Mindrian spec (plain-English terms only on screen)

1. **Simplicity budget.** The default band answers three questions: where am I, what is this for,
   what is waiting on me. Everything else is one deliberate step away (row 2 and 3, or the pane).
2. **A hint line that follows you.** The band or pane footer shows only the keys that work right
   now, with a `?` for the full list. Three tiers: always visible, `?`, and "explain this".
3. **Color is a helper, words do the work.** Every colored block also says what it is. The band
   must read correctly in plain text and under `NO_COLOR`. Semantic names in the code (where,
   waiting, problem, frame, reading); the palette file supplies the values; no value in the widget.
4. **Plain domain words.** Folders, evidence, decisions, next step. No method names on screen.
5. **Risk-matched decisions.** A decision card that records an approval is a moderate action: it
   states the consequence in one line before it commits. Defer and "show me more" are reversible
   and just happen.
6. **Floor and collapse.** The band's own limit is half the terminal rows (verified in spike 008),
   so at 24 rows it never exceeds 12 rows including the prompt. Define the collapse order and
   test at 80x24, 120x40 and 200x60. Under the floor, say so in a plain sentence.
7. **Clutter audit.** Count the distinct elements in the default view and set a ceiling in the
   spec; anything that only an expert understands moves behind "Show details".
8. **Text alternatives.** The logo cell has a text name; bars have words ("62 percent used").
   No animation in the band; the only motion allowed is a short emphasis when a decision arrives.

## Open items

- These guides are mostly community-written. Where a rule matters (colors, minimum size,
  confirmation friction), the spike should test it in a real terminal, not just cite it.
- Windows Terminal and WSL rendering (Unicode blocks for the logo) is flagged by several guides
  as a risk; the user runs WSL, so test there first.

## Sources

- https://clig.dev, https://no-color.org, https://fuchsia.dev/fuchsia-src/development/api/cli
- https://www.patternfly.org/content-design/writing-guides/cli-handbook
- https://github.com/github/TUIKit/blob/main/docs/foundations.md
- https://ratatui.rs/concepts/layout
- https://lobehub.com/skills/hyperb1iss-hyperskills-tui-design
- https://github.com/gfargo/tui-design-skill, https://github.com/Simon-He95/vue-tui/blob/main/docs/terminal-ui-best-practices.md
- https://bwplotka.dev/2025/lazygit, https://seirdy.one/posts/2022/06/10/cli-best-practices
- https://www.mdpi.com/2076-3417/16/6/2682 (adjacent field, analogy only)
