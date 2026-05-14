<div align="center">
  <img src="https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg" alt="MindrianOS" width="160" />

  # MindrianOS

  **The thinking partner for problems worth solving.**

  Powered by PWS, a well-tested, pedagogically-built innovation methodology by
  [Prof. Lawrence Aronhime](https://www.linkedin.com/in/lawrence-aronhime-8363894/).
  Built by [Jonathan Sagir](https://www.linkedin.com/in/jonathansagir/).

  [![Version](https://img.shields.io/badge/v1.13.0-The_Closed_Loop-blue)](CHANGELOG.md)
  [![License](https://img.shields.io/badge/license-BSL_1.1-orange)](LICENSE)
  [![Works on](https://img.shields.io/badge/works_on-CLI_+_Desktop_+_Cowork-brightgreen)](#three-surfaces)

  [Website](https://mindrianos-jsagirs-projects.vercel.app) |
  [Marketplace](https://github.com/jsagir/mindrian-marketplace) |
  [Brain Access](https://mindrianos-jsagirs-projects.vercel.app/brain-access)

</div>

---

## The job

You are working on something that matters. A venture. A research direction. A grant. A pivot. The problem you are trying to solve is real, but it is undefined, and you keep getting lost in it. You take notes, but the notes pile up. You have meetings, but you forget what was said two weeks ago. You make decisions, but you cannot remember why.

The hard part is not writing things down. The hard part is seeing what you cannot see: the contradiction between yesterday's strategy and today's market signal, the assumption that quietly went stale, the connection between two meetings that nobody noticed.

MindrianOS is built for that. It is the thinking partner that walks beside you while you walk through the wicked problem.

---

## How it works

You install the plugin. You start talking. The rest takes care of itself.

**Larry is the thinking partner.** Larry is the AI personality you talk to. Larry asks questions, suggests the right methodology for where you are, and quietly files what you say.

**The Data Room is your venture made legible.** Every conversation, every meeting, every decision lands in a folder structure organized by venture stage: the problem, the market, the solution, the team, the money, the IP, the meetings, the opportunities. You can open it in your file manager. You own it.

**The intelligence layer surfaces what you cannot see.** Every time you add something to the room, the system scans the rest and tells you what just changed. What contradicts what. What connects to what. What is now missing. What you stopped checking weeks ago.

**Your decisions teach the system.** When the system surfaces something, you decide: APPROVE (it cascades), REJECT (and tell the system why), or DEFER. Your reason becomes part of the room's memory. The next scan is smarter.

**The Brain orchestrates the method.** The Brain orchestrates a pedagogically-built, well-tested curated method for innovation against your current context, surfacing connections, contradictions, and gaps no single mind can hold. Connecting it makes Larry sharper. Not connecting it is fine; the system still teaches you. Either way, your venture data stays on your machine. The Brain only answers methodology questions, never sees your notes.

---

## What you actually do in a session

You talk. You type a few commands when you know the shortcut. You let Larry teach you the methodology when you do not.

```bash
/mos:new-project          # tell Larry what you are exploring
/mos:beautiful-question   # reframe the problem before solving it
/mos:analyze-needs        # who has this problem, how badly, what they have tried
/mos:lean-canvas          # one-page business model
/mos:file-meeting         # paste a transcript, Larry files it and surfaces what changed
/mos:opportunities        # what grants match this room right now
/mos:query "what is the weakest assumption in my financial model?"
/mos:grade                # honest assessment, calibrated against real ventures
```

You do not have to memorize these. Just describe what you are trying to do; Larry routes you.

---

## What v1.13.0 changed

This release is called **The Closed Loop**. Before this version, MindrianOS could file your work and surface intelligence, but the loop did not always close: you would say something, the system would react, and then nothing would carry forward to the next session.

In v1.13.0, the loop closes:
- **Larry leads turn one.** The first thing you see is a conversation, not a command menu.
- **The first file you write triggers a background scan.** You will see findings on your next turn: whitespace, contradictions, cross-domain analogies you could borrow from.
- **Contradictions persist across sessions.** Larry remembers what was unresolved and brings it back when relevant.
- **Every conversation produces a real artifact.** A first session leaves you with a populated room, not an empty wizard.
- **Your decisions are graph data.** The room learns from your approvals, your rejections, and the reasons you give.

It is currently shipping as a release candidate (`v1.13.0-beta.13`). Final `v1.13.0` is imminent.

---

## Why this gets better the longer you use it

MindrianOS is a thinking tool that compounds. Most tools get messier the more you put in -- the search ranks worse, the folder gets bigger, the AI forgets what you told it last session. MindrianOS goes the other way.

Here is the mechanism, in plain words: every conversation you have with Larry, every meeting you file, every decision you make and reason you give becomes part of your room. The room is searchable, structured, and remembered across sessions. Every NEW thing you add gets compared against everything already there.

Day one, you have a folder.

Day thirty, you have a folder that catches the contradiction between yesterday's strategy call and last week's customer interview, because nothing about either was forgotten. Larry brings back the assumption you made in week two when you are about to make a decision in week eight that depends on it. The room finds the connection between two meetings that happened a month apart that nobody remembers being related.

The mechanism is not magic. It is just: nothing forgets, everything compares, and your own past work works for you. The longer you stay, the more the room knows, the more the room can show you what you cannot see on your own.

---

## Install

### npm (one line, recommended)

```bash
npx @mindrian_os/install
```

### Plugin marketplace

```bash
claude plugin marketplace add jsagir/mindrian-marketplace
claude plugin install mos@mindrian-marketplace
```

### Shell

```bash
curl -sL https://raw.githubusercontent.com/jsagir/mindrian-os-plugin/main/install.sh | bash
```

Restart Claude Code. Larry starts talking.

### Update or repair an install

```bash
mindrian-os update           # marketplace + plugin update
mindrian-os doctor --all     # diagnose drift, suggest fixes
```

### A note on install prompts

Claude Code asks you to approve each shell command during install. 10+ prompts is normal. Pick "always allow" the first time you see one you are happy approving; the rest will not re-prompt.

---

## Three surfaces

MindrianOS works wherever Claude works. One plugin, three places.

| Surface | What it gives you |
|---------|-------------------|
| **Claude Code CLI** | Full power. Hooks fire, scripts run, the room is on disk, Larry teaches with visible structure. |
| **Claude Desktop** | Same Larry, conversational. The Data Room shows up as inline MCP Apps (dashboard, wiki, knowledge graph). |
| **Cowork** | Same plugin, shared room. Daily briefings, persistent perspectives, multi-user. |

---

## The privacy line

MindrianOS reads your workspace and writes only to your rooms (default: `~/MindrianRooms/`) and to session state (`./.mindrian/`). It does not write to the Brain server. Brain queries carry methodology questions only, never your notes, never your decisions, never your meetings.

If you want zero permission prompts during a session: `claude --dangerously-skip-permissions`. The read/write surface is bounded to your workspace and your rooms, so this is a reasonable choice for a methodology workflow. If you would rather be granular, paste the matcher set from [`docs/settings-template.json`](docs/settings-template.json) into `~/.claude/settings.json`.

---

## Why PWS, why Larry

PWS (Problems Worth Solving) is a well-tested, pedagogically-built innovation methodology by Prof. Lawrence Aronhime. It is not a checklist. It is a way of thinking about ventures as wicked problems that need to be reframed before they can be solved, and that demand a working memory because nobody can hold the whole thing in their head.

Larry is the personality that delivers PWS in your terminal. The teaching is intrinsic; you do not have to know the framework names. Larry asks the question, suggests the move, and shows the chain. You decide.

---

## Links

- **Website**: [mindrianos-jsagirs-projects.vercel.app](https://mindrianos-jsagirs-projects.vercel.app)
- **Marketplace**: [github.com/jsagir/mindrian-marketplace](https://github.com/jsagir/mindrian-marketplace)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Brain Access**: [Request API Key](https://mindrianos-jsagirs-projects.vercel.app/brain-access)
- **PWS, Prof. Lawrence Aronhime**: [LinkedIn](https://www.linkedin.com/in/lawrence-aronhime-8363894/)
- **Jonathan Sagir**: [LinkedIn](https://www.linkedin.com/in/jonathansagir/)

---

## License

Source-available (BSL 1.1), not open source. Copyright Jonathan Sagir and PWS / Mindrian.
