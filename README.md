<div align="center">
  <img src="https://mindrian-os.com/logo_dark.svg" alt="MindrianOS" width="200" />

  # MindrianOS

  **Talk to Larry. The room writes itself.**

  A thinking partner that sits above your AI. You talk through a problem worth solving. Larry finds the real problem before you solve the wrong one, brings the right method at the moment you need it, pushes back when your confidence outruns your evidence, and turns the conversation into a structured room that remembers every decision and catches what you missed.

  Powered by PWS (Problems Worth Solving), an innovation methodology built and tested through 20 years of teaching.
  Engineered by Jonathan Sagir.

  [![Version](https://img.shields.io/badge/version-2.0.0--beta.1-1E3A6E)](CHANGELOG.md)
  [![License](https://img.shields.io/badge/license-BSL_1.1-C8A43C)](LICENSE)
  [![Works on](https://img.shields.io/badge/CLI_+_Desktop_+_Cowork-2D6B4A)](#three-surfaces)

  [Website](https://mindrian-os.com) &middot;
  [Marketplace](https://github.com/jsagir/mindrian-marketplace) &middot;
  [Brain Access](https://mindrian-os.com/brain-access)
</div>

---

## You have a problem worth solving. You are probably solving the wrong one first.

That is the job MindrianOS is hired for. Not "take my notes" and not "chat with an AI." You bring a real problem, a venture, a research question, a decision you cannot get right alone, and Larry's first move is almost always a question that reframes it, because the version of the problem you walked in with is rarely the one worth solving. Finding the right method, catching what you missed, and remembering what you decided all follow from getting that first reframe right.

---

## The loop, in 30 seconds

This is the whole mental model. You do not need more than this to use MindrianOS well.

1. **You talk.** Whatever is in your room right now, the venture, the decision, the meeting you just filed, becomes context.
2. **Your context triggers a question to the Brain**, the methodology graph: 28,325 nodes and 181 frameworks built from 20 years of teaching, holding WHEN to use WHICH method and in WHAT sequence.
3. **Larry joins the answer to your situation.** Not a lecture pulled from a textbook. Your problem, run through real methodology.
4. **You ratify what matters.** Approve it, reject it with a reason, or defer it. Your call becomes part of the room.
5. **The room remembers.** Next time, it is already there, checking today's input against it.

When the graph genuinely has nothing structured for what you asked, Larry says so plainly instead of making something up, and queues the gap for enrichment. He never improvises methodology. See "What an honest refusal looks like" below: that is not an error message, it is the whole point.

---

## Install

Three commands. Full walkthrough at [the install guide](https://mindrian-os.com/docs/install).

```bash
npx @mindrian_os/cli
```

Or, from inside Claude Code:

```bash
claude plugin marketplace add jsagir/mindrian-marketplace
claude plugin install mos@mindrian-marketplace
```

Restart Claude Code. Larry starts talking, and your install quietly registers its own Brain identity in the background: no API key to paste, no account to create first. If you already have a Brain key, it wins and nothing changes.

Two things the field taught us, worth checking before you start:

- You need Claude Pro or Max on your own personal account. A company-managed (SSO or Okta) Claude plan blocks the in-app upgrade prompt; a personal account does not.
- On Windows, the Node.js installer offers an optional "Tools for Native Modules" checkbox. Leave it unchecked. MindrianOS ships no native modules, and checking it triggers a long, unrelated Visual Studio Build Tools install.

Update or repair an install:

```bash
mindrian-os update           # marketplace + plugin update
mindrian-os doctor --all     # diagnose drift, suggest fixes
```

A note on install prompts: Claude Code asks you to approve each shell command. 10+ prompts is normal. Pick "always allow" the first time you see one you are happy with; the rest will not re-prompt.

---

## What talking to Larry feels like

Most of the time it feels like a sharp colleague who happens to know 181 frameworks and has read your whole project. You ask, Larry answers through the loop above, and a graph-grounded answer carries a source line so you know where it came from:

> ■ BRAIN: Jobs to Be Done · framework · readiness 4/4

A conversation turn, Larry thinking out loud with you rather than consulting the graph, carries no source line. The absence is the signal: no line means it is talk, not method.

Sometimes the graph does not have what you need yet, and that is not hidden from you. Here is a real refusal, verbatim:

> The graph doesn't have Jobs to Be Done structured yet (readiness 2/4; missing: examples, edge-cases). I've queued it for enrichment. I can share what the graph does hold on this, marked as partial, or we work without it.

That is a feature, not an outage. A tool that quietly guesses when it does not know is worse than one that tells you and keeps a list. A keyless or unreachable session gets the same treatment: an honest refusal and a visible path forward, never an imitation of an answer it does not have.

---

## The three layers

| Layer | What | Who owns it |
|-------|------|-------------|
| **Plugin** | Skills, commands, agents, and hooks that run the conversation | Open, in this repo |
| **Brain** | The methodology graph: 28,325 nodes, 181 frameworks, 20 years of teaching, served over MCP | Served remotely, never distributed |
| **Room** | Your venture, your decisions, your files | Yours, on your machine, always |

The Brain never sees your room. Every query it answers carries a generic methodology question, never your notes, your decisions, or your meetings.

---

## Why not just talk to Claude, ChatGPT, or Gemini directly?

You can. MindrianOS is not instead of them, it is the layer that makes one of them remember, judge, and hold you to your own reasoning. A raw AI is brilliant for one turn and forgets the next. It knows every framework but not which one you need right now. And it is agreeable: it will help you build a beautiful deck on a false premise, because it optimizes for a helpful answer, not a true one.

MindrianOS adds what a raw model structurally cannot be: it remembers (your room persists across every session), it knows when (decades of teaching calibrate which method fits which stage), it pushes back (a co-founder tells you when you are wrong, a chatbot tells you that you are brilliant), and it keeps your data yours (only generic methodology crosses to the Brain, never your specifics).

---

## Three surfaces

MindrianOS works wherever Claude works. Same Larry, same room, every surface.

| Surface | What it gives you |
|---------|-------------------|
| **Claude Code CLI** | Full power. Hooks fire, scripts run, the room is on disk, Larry teaches with visible structure. |
| **Claude Desktop** | Same Larry, conversational. The Data Room shows up as inline panels (dashboard, wiki, knowledge graph). |
| **Cowork** | Same plugin, shared room. Daily briefings, persistent perspectives, multi-user. |

---

## Commands are internals

Talk. That is the whole interface. Larry reaches for the right command on your behalf; the ones below are here for when you already know the shortcut.

```bash
/mos:ignite               # the front door: start or excavate a room
/mos:discover             # Larry-led client + product + JTBD discovery
/mos:beautiful-question   # reframe the problem before solving it
/mos:file-meeting         # paste a transcript, Larry files it
/mos:graph "what is the weakest assumption in my financial model?"
/mos:grade                # honest assessment against real ventures
```

That is a slice of over a hundred commands across the skills, agents, and pipelines this plugin ships. If you do not know which one to run, that is the normal case. Just talk.

---

## Pricing

Free plugin. It requires a paid Claude plan (Claude Pro, $20/mo, or higher) because it runs on top of Claude. The Brain installs with it, silently registered, at no separate cost.

---

## The privacy line

MindrianOS reads your workspace and writes only to your rooms (default: `~/MindrianRooms/`) and to session state (`./.mindrian/`). It does not push anything to the Brain beyond a generic methodology question: never your notes, never your decisions, never your meetings.

For zero permission prompts during a session: `claude --dangerously-skip-permissions`. The read/write surface is bounded to your workspace and your rooms. For granular control, copy the matcher set from [`docs/settings-template.json`](docs/settings-template.json) into `~/.claude/settings.json`.

---

## Links

- **Website**: [mindrian-os.com](https://mindrian-os.com)
- **Marketplace**: [github.com/jsagir/mindrian-marketplace](https://github.com/jsagir/mindrian-marketplace)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Brain key (override path)**: [Request one](https://mindrian-os.com/brain-access)

---

Install MindrianOS. Start thinking with Larry.

## License

Source-available (BSL 1.1), not open source. Copyright Jonathan Sagir and PWS / Mindrian.
