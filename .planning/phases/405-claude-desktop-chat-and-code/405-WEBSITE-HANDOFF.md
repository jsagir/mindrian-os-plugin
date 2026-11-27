---
phase: 405
kind: website-handoff
target_repo: ~/dev/mindrian-website (branch book-site)
date: 2026-11-27
owner_ruling: "OR-3 of 405-CONTEXT.md: the website changes its surface and install wording to match"
run_as: "/gsd-quick in ~/dev/mindrian-website (GSD owns website work)"
---

# Website hand-off: the Claude surface model changed

## What changed (plain words)

Anthropic merged chat and Cowork into one Claude (support article 16761823; rollout from 2026-09-16 on Pro, Max and Ultra; Enterprise GA 2026-10-23; Team GA 2026-11-12). That conversation runs in Anthropic's cloud. It reaches the user's own computer (files, local tools, the MindrianOS room) only through the open Claude Desktop app. Claude Desktop also has a Code tab, which is Claude Code inside Desktop.

So "Claude Code, Claude Desktop and Cowork" is no longer three products. The website must say three places instead:

1. **Claude Code (terminal)**: everything.
2. **Claude Desktop, Code tab (local session)**: everything; same as the terminal.
3. **Claude Desktop chat (formerly chat and Cowork)**: Larry's skills and commands; the room tools only while Desktop is open on that computer; no automatic hooks.

Cloud-only places (claude.ai on the web, the phone, Code-tab cloud sessions, new Projects cloud threads) do not see the user's room.

Evidence with every source and date: `~/dev/MindrianOS-Plugin-release/.planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md`. The plugin-side doctrine doc lands as `docs/CLAUDE-SURFACE-MODEL.md` (quick 261127-hdl).

## Where the website says the old model (found 2026-11-27, read only)

55 user-facing files under `site/`, `website/`, `PRODUCT.md`, `CLAUDE.md` mention Cowork. The ones that matter most:

- `website/src/app/api/help/system-prompt.ts` lines 148, 194, 215, 219, 226 (the help bot's surface and install answers)
- `website/src/app/docs/install/page.tsx` (the "Desktop and Cowork" block, `DESKTOP_COWORK_PROMPT`)
- `website/src/lib/desktop-cowork-install*` (the install prompt source)
- `website/src/app/docs/surfaces/page.tsx` (the surfaces page)

## Ask

1. Rewrite the surface and install wording to the three places above. Keep "formerly Cowork" once, so returning users recognise it.
2. The help bot must answer "does it work in Desktop chat?" honestly: skills yes, room tools only with Desktop open, no hooks.
3. Do not promise anything Phase 405 has not shipped. Phase 405 (MindrianOS on the Desktop platform) is in design. Re-check the wording when 405 is released. A main commit is not live until it is released.
4. Run the site's own checks and the version fact check after the edit.

## Not in scope

No plugin code. No claim about hooks in Desktop chat (they do not run there for personal accounts).
