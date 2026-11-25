# Website handoff: the Larry pin in the get-mindrian skill (quick 261125-rtc)

For the website session. This file covers the plugin and the marketplace only. No file of the website repo was changed by the session that wrote this: its working tree held uncommitted work, and its copy is claim-gated.

## (a) What needs no change on the website

- The setup sentence (`AGENT_SENTENCE`, claim C-83) and `SETUP_SOURCE_URL` name the raw address of the skill. The address did not move. The site keeps no copy of the procedure (/install.md redirects to the address), so the new procedure is what an agent reads from the moment of the marketplace push.
- Marketplace commit: ff0cfaf on master, pushed 2026-11-25. Checked the same day: the raw address serves the text "Larry pin".
- sha256 of the served files: SKILL.md 6fda8ad9f77418ad7c1b8576edb921404365f8f71d796035dfe4e619d06c5f9f; references/commands.md fe160e282f95f24deaf8169309db605b64e47cc40a5b76f14437e13c117e0033; references/troubleshooting.md d6e55becd0b7b0a266ce8f6a0ce79e1fc9f5fcdb6c8e67d53f97b646a3116f11.

## (b) What the install now does that the site copy does not say

1. The install writes one more setting: `"agent": "mos:larry-extended"` in `<rooms folder>/.claude/settings.json`, after it shows the change and gets a yes. Nothing outside the rooms folder changes. One command takes it out again (`undo`).
2. The check a person can see, after the restart: a reply opens with one colored square and `Larry | MindrianOS`.

## (c) Proposed copy for /docs/install (each line needs a claim; needles are verbatim from SKILL.md at ff0cfaf)

- Done state, a fourth step after `/mos:onboard`: "Larry answers. His reply opens with a colored square and `Larry | MindrianOS`."
  Needle: "every Larry reply opens with one colored square (🟦 🟥 🟨 ⬛ or ⬜) and the label `Larry | MindrianOS`"
- Trust line, one added sentence: "It also asks before it sets Larry as the agent of your rooms folder, and it changes nothing outside that folder."
  Needle: "Your other folders and your own Claude Code settings stay as they are, and one command takes it out again."
- Help line, one row: "Claude answers without Larry? Start Claude Code in your rooms folder, or run `claude --agent mos:larry-extended`."
  Needle: "`claude --agent mos:larry-extended` starts Larry for that one session, whatever the settings say."

## (d) Not verified

- What the live site serves today. `curl` to mindrian-os.com failed from this machine (no HTTP answer), and a search-tool read of /docs/install returned a page with the `npx @mindrian_os/cli` steps and no setup sentence. The website branch `book-site` was 519 commits ahead of its remote. So the chooser page that carries the setup sentence may not be deployed.
- The Desktop path. The skill change touches route A (Claude Code in a terminal) only.

## (e) The plugin side

- Main commit 2086ed966 (local main, not pushed, in the beta.88 CHANGELOG): the forced output style carries a runtime core, so MindrianOS operates when the Larry agent does not load. It reaches users with the beta.88 cut.
