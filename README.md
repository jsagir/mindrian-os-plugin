<div align="center">
  <img src="https://mindrianos-jsagirs-projects.vercel.app/logo_dark.svg" alt="MindrianOS" width="200" />

  # MindrianOS

  **When you are walking through a problem worth solving and you cannot yet name what is missing, MindrianOS is the thinking partner that walks beside you.**

  Powered by PWS (Problems Worth Solving), an innovation methodology built and tested through 20 years of teaching by Prof. Lawrence Aronhime.
  Engineered by Jonathan Sagir.

  [![Version](https://img.shields.io/badge/v1.13.0-The_Closed_Loop-1E3A6E)](CHANGELOG.md)
  [![License](https://img.shields.io/badge/license-BSL_1.1-C8A43C)](LICENSE)
  [![Works on](https://img.shields.io/badge/CLI_+_Desktop_+_Cowork-2D6B4A)](#three-surfaces)

  [Website](https://mindrianos-jsagirs-projects.vercel.app) ·
  [Marketplace](https://github.com/jsagir/mindrian-marketplace) ·
  [Brain Access](https://mindrianos-jsagirs-projects.vercel.app/brain-access)
</div>

---

## The answer first

> When you talk to Larry about what you are working on, MindrianOS turns the conversation into a structured room, remembers your decisions across sessions, and surfaces the contradictions you would otherwise miss.

You do not learn a tool. You talk. The room takes shape underneath the conversation. Whatever you said yesterday is still working for you today.

---

## How it works (in three pieces)

### Larry is the thinking partner

Larry is the AI you talk to. Larry asks the questions that reframe the problem before you try to solve it, suggests the method that fits where you are, and files what you say into your room without making you stop to organize. You do not have to know the framework names. You describe what you are doing. Larry routes you.

### The Data Room is your venture made legible

Every conversation, every meeting, every decision lands in a folder structure organized by venture stage: the problem, the market, the solution, the team, the money, the IP, the meetings, the opportunities. You open it in your file manager. You back it up like any other folder. You own it.

### The room surfaces what you cannot see

Every time you add something new, the system compares it against everything already there. Larry tells you what just changed. What contradicts what. What connects to what. What is now missing. What you stopped checking weeks ago.

You decide: APPROVE, REJECT (with a reason), or DEFER. The reason becomes part of the room. The next scan is smarter.

---

## What v1.13.0 changed (The Closed Loop)

Before this release, MindrianOS could file your work and surface intelligence, but the loop did not always close. You would say something, the system would react, and nothing carried forward. v1.13.0 closes the loop:

- **Larry leads turn one.** The first thing you see is a conversation, not a command menu.
- **Your first sentence becomes a room.** Type a venture sentence, get a 30-second brief and a populated room before you have to commit anything else.
- **Tensions persist across sessions.** Larry remembers what was unresolved and brings it back when relevant.
- **Every conversation produces an artifact.** A first session leaves you with a real room, not an empty wizard.
- **Decisions teach the system.** Your approvals, your rejections, your reasons become part of the room's working memory.

Currently shipping as `v1.13.0-beta.19`. Final `v1.13.0` is imminent.

---

## What you do in a session

Talk. Type a command when you know the shortcut. Let Larry teach you when you do not.

```bash
/mos:new-project          # tell Larry what you are exploring
/mos:beautiful-question   # reframe the problem before solving it
/mos:analyze-needs        # who has this problem, how badly, what they have tried
/mos:lean-canvas          # one-page business model
/mos:file-meeting         # paste a transcript, Larry files it
/mos:opportunities        # what grants match this room right now
/mos:query "what is the weakest assumption in my financial model?"
/mos:grade                # honest assessment against real ventures
```

You do not have to memorize these. Describe what you are trying to do. Larry routes you.

---

## Why the room compounds

Most tools get messier the more you put in. Search ranks worse. Folders bloat. The AI forgets what you told it last session. MindrianOS goes the other way.

The mechanism is plain. Everything you say to Larry, every meeting you file, every decision you make and reason you give becomes part of your room. The room is searchable, structured, and remembered. Every NEW entry compares against everything already there.

Day one, you have a folder.

Day thirty, you have a folder that catches the contradiction between yesterday's strategy call and last week's customer interview, because nothing about either was forgotten. Larry brings back the assumption you made in week two when you are about to make a decision in week eight that depends on it. The room finds the connection between two meetings that happened a month apart that nobody remembers being related.

Nothing forgets. Everything compares. Your own past work works for you.

---

## Install

### npm (one line, recommended)

```bash
npx @mindrian_os/cli
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

A note on install prompts: Claude Code asks you to approve each shell command. 10+ prompts is normal. Pick "always allow" the first time you see one you are happy with; the rest will not re-prompt.

---

## Three surfaces

MindrianOS works wherever Claude works.

| Surface | What it gives you |
|---------|-------------------|
| **Claude Code CLI** | Full power. Hooks fire, scripts run, the room is on disk, Larry teaches with visible structure. |
| **Claude Desktop** | Same Larry, conversational. The Data Room shows up as inline panels (dashboard, wiki, knowledge graph). |
| **Cowork** | Same plugin, shared room. Daily briefings, persistent perspectives, multi-user. |

---

## The privacy line

MindrianOS reads your workspace and writes only to your rooms (default: `~/MindrianRooms/`) and to session state (`./.mindrian/`). It does not push anything to the Brain. Brain queries carry methodology questions only, never your notes, never your decisions, never your meetings.

For zero permission prompts during a session: `claude --dangerously-skip-permissions`. The read/write surface is bounded to your workspace and your rooms. For granular control, copy the matcher set from [`docs/settings-template.json`](docs/settings-template.json) into `~/.claude/settings.json`.

---

## Why PWS, why Larry

PWS (Problems Worth Solving) is not a checklist. It is a way of thinking about ventures as wicked problems that need to be reframed before they can be solved, and that demand a working memory because nobody can hold the whole thing in their head.

Larry is the personality that delivers PWS in your terminal. The teaching is intrinsic. You do not have to know the framework names. Larry asks the question, suggests the move, shows the chain. You decide.

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
