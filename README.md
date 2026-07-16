<div align="center">
  <img src="https://mindrian-os.com/logo_dark.svg" alt="MindrianOS" width="200" />

  # MindrianOS

  **Talk to Larry. The room writes itself.**

  A thinking partner that sits above your AI. You talk through a problem worth solving. Larry finds the real problem before you solve the wrong one, brings the right method at the moment you need it, pushes back when your confidence outruns your evidence, and turns the conversation into a structured room that remembers every decision and catches what you missed.

  Powered by PWS (Problems Worth Solving), an innovation methodology built and tested through 20 years of teaching by Prof. Lawrence Aronhime.
  Engineered by Jonathan Sagir.

  [![Version](https://img.shields.io/badge/version-1.15.3--beta.26-1E3A6E)](CHANGELOG.md)
  [![License](https://img.shields.io/badge/license-BSL_1.1-C8A43C)](LICENSE)
  [![Works on](https://img.shields.io/badge/CLI_+_Desktop_+_Cowork-2D6B4A)](#three-surfaces)

  [Website](https://mindrian-os.com) &middot;
  [Marketplace](https://github.com/jsagir/mindrian-marketplace) &middot;
  [Brain Access](https://mindrian-os.com/brain-access)
</div>

---

## The answer first

> You do not operate MindrianOS. You talk to Larry. Larry is the thinking partner; the room is the receipt. Every conversation reframes the problem before you solve it, sequences the right framework for where you are, pushes back when your confidence outruns your evidence, and leaves behind a structured room that remembers every decision so nothing you learned is lost.

You never learn a tool. You talk. The room takes shape underneath the conversation. Commands exist, but they are internals, and Larry routes you to them when they help. Whatever you said yesterday is still working for you today.

---

## Four jobs it does for you

- **Find the problem.** Larry reframes what you are working on before you try to solve it, so you spend your effort on the real problem, not the first one you saw.
- **Show what you missed.** Every new entry is compared against everything already in the room. Contradictions, gaps, and cross-project connections surface on their own.
- **Build what you could not alone.** The right framework at the right stage, chained intelligently, across more domains than one mind can hold at once.
- **Defend what you decided.** Every decision and the reason behind it becomes working memory you can stand behind weeks later.

---

## How it works (three pieces)

### Larry is the product

Larry is the AI you talk to, and the conversation is the whole surface. Larry asks the questions that reframe the problem before you try to solve it, brings the method that fits where you are, and files what you say into your room without making you stop to organize. You do not have to know any framework names. You describe what you are doing. Larry routes you. There is nothing else to learn.

### The room is the receipt

You talk; the room writes itself. Every conversation, every meeting, every decision lands in a folder structure organized by venture stage: the problem, the market, the solution, the team, the money, the IP, the meetings, the opportunities. You open it in your file manager. You back it up like any other folder. You own it. You never filed a thing.

### The room surfaces what you cannot see

Every time you add something new, the system compares it against everything already there. Larry tells you what just changed, what contradicts what, what connects to what, and what is now missing. You decide: APPROVE, REJECT (with a reason), or DEFER. The reason becomes part of the room. The next scan is smarter. When a scan surfaces an opportunity, it does not stop at a headline: you qualify it at a card, and one explicit Explore turns it into cited deep research filed in your opportunity bank. The web works the same way: paste a URL and, once you approve, the page is filed as a cited source in your room and compared against everything already there. When something breaks mid-research, it tells you exactly what happened and what it tried next, never a silent empty result.

---

## Why not just talk to Claude, ChatGPT, or Gemini directly?

You can. MindrianOS is not instead of them. It is the layer that makes one of them remember, judge, and hold you to your own reasoning.

A raw AI is brilliant for one turn and forgets the next. Ask it the same venture question next week and it relearns you from scratch. It knows every framework but not which one you need right now. And it is agreeable: it will help you build a beautiful deck on a false premise, because it optimizes for a helpful answer, not a true one.

MindrianOS adds the four things a raw model structurally cannot be:

- **It remembers.** Your venture lives in a room that persists across every session. The contradiction you found three weeks ago is still there, still checking today's input.
- **It knows when.** The moat was never the frameworks; anyone can list those. It is knowing which one you need at the stage you are in, and reaching for it the moment you are stuck, so you never have to know its name. When to use which, in what order, is the timing that decades of teaching calibrate.
- **It pushes back.** It blocks you when the evidence is thin and surfaces the conflict between your pricing and your market. A co-founder tells you when you are wrong. A chatbot tells you that you are brilliant.
- **It keeps your data yours.** The teaching that travels is generic methodology. Your specifics never leave your machine. You get smarter-from-the-world intelligence without becoming the product.

The short version: a raw AI is the engine. MindrianOS is the operating system around it. For a one-off question, use the engine. For a venture you carry for months, you want the OS.

---

## Install

Built for people who have never opened a terminal. Full walkthrough at [the install guide](https://mindrian-os.com/docs/install).

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

## What you do in a session

Talk. That is the whole interface. You describe what you are trying to do, and Larry routes you.

The commands below are internals. You never have to memorize them or type them. Larry reaches for them on your behalf. They are here for the times you already know the shortcut and want it.

```bash
/mos:ignite               # the front door: start or excavate a room
/mos:discover             # Larry-led client + product + JTBD discovery
/mos:beautiful-question   # reframe the problem before solving it
/mos:analyze-needs        # who has this problem, how badly, what they have tried
/mos:bono                 # a six-hats research-and-debate team on your question
/mos:map-unknowns         # hunt the claims you are most confident about, and wrong
/mos:file-meeting         # paste a transcript, Larry files it
/mos:research <url>       # paste a link, approve the card, the page becomes cited room knowledge
/mos:opportunities        # what grants match this room right now
/mos:qualify-opportunity  # judge a surfaced opportunity at a card; Explore turns it into research
/mos:graph "what is the weakest assumption in my financial model?"
/mos:grade                # honest assessment against real ventures
```

That is a slice of 111 commands across 124 skills and 9 agents. If you do not know which one to run, that is the normal case. Just talk: Larry reaches for the right one.

---

## Why the room compounds

Most tools get messier the more you put in. Search ranks worse. Folders bloat. The AI forgets what you told it last session. MindrianOS goes the other way.

Think of Larry as a thinking partner who also keeps the minutes, and reads them back to you when this week contradicts last week. Everything you say, every meeting you file, every decision you make and reason you give becomes part of your room. The room is searchable, structured, and remembered, and every new entry compares against everything already there.

Day one, you have a folder. Day thirty, you have a folder that catches the contradiction between yesterday's strategy call and last week's customer interview, brings back the assumption you made in week two when you are about to make a decision in week eight that depends on it, and finds the connection between two meetings a month apart that nobody remembers being related.

Nothing forgets. Everything compares. Your own past work works for you.

---

## Three surfaces

MindrianOS works wherever Claude works. Same Larry, same room, every surface.

| Surface | What it gives you |
|---------|-------------------|
| **Claude Code CLI** | Full power. Hooks fire, scripts run, the room is on disk, Larry teaches with visible structure. |
| **Claude Desktop** | Same Larry, conversational. The Data Room shows up as inline panels (dashboard, wiki, knowledge graph). |
| **Cowork** | Same plugin, shared room. Daily briefings, persistent perspectives, multi-user. |

---

## The Brain (optional)

The Brain is a shared teaching graph that connects your findings across projects. It holds two stores: one for connections, one for meanings. Connecting it makes Larry sharper. Not connecting it is fine; the pedagogy is intrinsic to Larry, so the system still teaches you.

The Brain never sees your room. Brain queries carry methodology questions only, never your notes, never your decisions, never your meetings.

Request access: [mindrian-os.com/brain-access](https://mindrian-os.com/brain-access)

---

## Pricing

Free plugin. It requires a paid Claude plan (Claude Pro, $20/mo, or higher) because it runs on top of Claude. The Brain is an optional add-on.

---

## The privacy line

MindrianOS reads your workspace and writes only to your rooms (default: `~/MindrianRooms/`) and to session state (`./.mindrian/`). It does not push anything to the Brain. Brain queries carry methodology questions only, never your notes, never your decisions, never your meetings.

For zero permission prompts during a session: `claude --dangerously-skip-permissions`. The read/write surface is bounded to your workspace and your rooms. For granular control, copy the matcher set from [`docs/settings-template.json`](docs/settings-template.json) into `~/.claude/settings.json`.

---

## Why PWS, why Larry

PWS (Problems Worth Solving) is not a checklist. It is a way of thinking about ventures as wicked problems that need to be reframed before they can be solved, and that demand a working memory because nobody can hold the whole thing in their head.

Larry is the personality that delivers PWS in your terminal, and the teaching is intrinsic. You do not have to know the framework names. Larry asks the question, suggests the move, shows the chain. You decide.

---

## Links

- **Website**: [mindrian-os.com](https://mindrian-os.com)
- **Marketplace**: [github.com/jsagir/mindrian-marketplace](https://github.com/jsagir/mindrian-marketplace)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Brain Access**: [Request API Key](https://mindrian-os.com/brain-access)
- **PWS, Prof. Lawrence Aronhime**: [LinkedIn](https://www.linkedin.com/in/lawrence-aronhime-8363894/)
- **Jonathan Sagir**: [LinkedIn](https://www.linkedin.com/in/jonathansagir/)

---

Install MindrianOS. Start thinking with Larry.

## License

Source-available (BSL 1.1), not open source. Copyright Jonathan Sagir and PWS / Mindrian.
