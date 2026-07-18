---
kind: seed
status: open
severity: high
created: 2026-07-18
canon_parts: [8, 10, 11, 12]
related: [SEED-062 (the engine gap -- the finding this seed answers differently), SEED-063 (OpenCode fork -- now a TIER-1 enhancement rather than the strategy), SEED-065 (the MCP ceiling -- the constraint this seed accepts and tiers around), SEED-067 (BYO-key/BYO-sub -- largely dissolved by this seed)]
proving_case: "Two facts verified independently on 2026-07-18, from different vendors, in different languages, by different research passes: OpenCode reads Claude-Code-format SKILL.md from .claude/skills/ natively (packages/opencode/src/skill/index.ts, CLAUDE_EXTERNAL_DIR = '.claude'); Grok Build reads Claude Code marketplaces, plugins, skills, MCPs, agents, hooks and CLAUDE.md with 'zero configuration needed' (docs.x.ai/build). Two competing harnesses from rival companies independently adopted the same skill format. MindrianOS's ~132,000 lines of methodology are already written in it."
source: "navigator question 2026-07-18: 'think outside the box, how can Mindrian break free?' -- asked after a full day of harness comparison. The observation that every option generated that day (Claude Code, Agent SDK, Grok Build, OpenCode, MCP-maximal) was the SAME option -- 'pick which agent loop hosts us' -- and the box was the assumption that MindrianOS must be hosted at all. Navigator selected this direction."
---

# SEED-068: Be infrastructure, not an application

## What's actually open

A strategic reframe, and the architecture that follows from it.

**Stop asking which engine runs MindrianOS. Become the thing every engine reaches for.**

**Trigger:** immediate as a direction; the packaging work is the next build decision.

## The reframe

Every option generated during the 2026-07-18 host-runtime research -- Claude Code, the
Claude Agent SDK, Grok Build, OpenCode, MCP-maximal -- was the same option wearing
different clothes: *pick which agent loop hosts us*. A day was spent comparing cages.

**The box was the assumption that MindrianOS must be hosted at all.**

What the research actually established, read differently:

- OpenCode reads `.claude/skills/**/SKILL.md` natively.
- Grok Build reads Claude Code skills, plugins, agents, hooks, MCP configs and
  `CLAUDE.md` with **zero configuration**.

Two competing harnesses, rival companies, different languages, both independently chose
to speak the same format. **The Claude Code skill format has become a de facto standard**,
and MindrianOS's 132K lines of methodology are already written in it.

Therefore: ship as a **skills package + MCP server** that installs into any compliant
host. No fork. No 844K lines of someone else's Rust. No governance bet on a single
vendor. **Whoever wins the harness war, MindrianOS wins, because it is not in the war.**

## HOST MATRIX 2026-07-18 -- verified, and it inverts the original tier model

Eleven hosts surveyed against primary sources the same day this seed was written. Two of
three research passes returned; the vendor-CLI pass (Gemini CLI, Codex CLI, Qwen Code)
was still outstanding at time of writing.

**The premise upgraded.** `SKILL.md` is not a de facto convention -- it is an **open
standard** (agentskills.io: *"originally developed by Anthropic, released as an open
standard"*). **Every host surveyed ingests it natively WITH genuine progressive
disclosure.** The feared eager-load of 124 files happens on none of them.

**Tier 0 passes universally.** Differentiation moved entirely to the hook and
persona/card channels.

| Host | SKILL.md | Reads `.claude/skills/` | Hooks | Blocks turn-END | MCP `instructions` | Elicitation | Verdict |
|---|---|---|---|---|---|---|---|
| **VS Code / Copilot** | ✅ | ✅ | ✅ 8 events, **reads `.claude/settings.json`** | ✅ `Stop`, exit 2 | ✅ listed (semantics undocumented) | ✅ since 1.102 | **TIER 1** |
| **Cursor** | ✅ | ✅ | ✅ **21 events**, `beforeSubmitPrompt` | ⚠️ via `followup_message` | ❓ UNVERIFIED | ✅ (rendering unverified) | **TIER 1** |
| **Goose** | ✅ | ✅ | ✅ 11 events | ✅ `Stop`, exit 2, loop-capped | ✅ **honoured + templated** | ✅ form + URL | **TIER 1** |
| **Cline** | ✅ | ✅ | ✅ 8 file-based | ⚠️ `TaskComplete` "coming soon" | ❌ unimplemented | ❌ | **TIER 1** |
| **Windsurf / Devin** | ✅ | ✅ opt-in | ✅ 12 events | ⚠️ `post_cascade_response` | ❌ | ❌ | **TIER 1** |
| **Continue** | ✅ | ✅ | ✅ **17 events**, CC-schema-compatible | ✅ | ❌ dropped | ❌ (`capabilities:{}`) | **TIER 1, deprioritise** |
| **Zed** | ✅ | ❌ `.agents/` only | ❌ **none** | ❌ | ❌ **provably dropped** | ❌ | **TIER 0** |
| **Aider** | ❌ | ❌ | ❌ | ❌ | -- no MCP client at all | -- | **UNSUPPORTED** |
| OpenCode | ✅ | ✅ | ✅ (no turn-end; SEED-063 adds it) | ➕ addable | ✅ | ❌ commented out | **TIER 1 w/ plugin** |
| Grok Build | ✅ | ✅ zero-config | ✅ 17 events, exit 2 | ✅ `Stop` | UNVERIFIED | UNVERIFIED | **TIER 1** |

### THE INVERSION -- the original tier model in this seed was backwards

It assumed skills+MCP were the universal layer and hooks the rare enhancement.
**The opposite is true:**

- **Skills: universal.** Every host, zero conversion cost.
- **Blocking hooks: common.** 8 of 10 hosts. VS Code reads our `.claude/settings.json`
  directly; Continue explicitly targets Claude Code hook-schema compatibility
  (*"any hook written for `claude` works with `cn` out of the box"*).
- **MCP `instructions` (persona): RARE.** Confirmed only on Goose and (listed) VS Code.
  Provably discarded by Zed. Unimplemented on Cline and Continue.
- **MCP elicitation (cards): RARE.** Goose, VS Code, Cursor(?) only.

### Two architectural consequences -- treat as binding

1. **NEVER route persona through `InitializeResult.instructions`.** It is the least
   portable channel surveyed. **Persona ships as a SKILL** -- the one channel with
   universal support and documented semantics. `instructions` and elicitation are
   per-host *enhancements*, never dependencies. (This supersedes the SEED-065 guidance to
   lean on `instructions` + tool descriptions; tool descriptions remain a good universal
   voice channel, `instructions` does not.)
2. **Enforce governance SERVER-SIDE, in the MCP tool handlers.** Client hooks exist on
   most hosts but are Preview on VS Code, differently shaped on each, and absent on Zed.
   Only the `.claude/settings.json` path is portable, and only to VS Code.

### Reach -- the trade is far better than this seed originally assumed

This seed was written expecting to trade depth for reach. **Both of the hosts that
constitute the market are TIER 1:**

- **VS Code / GitHub Copilot -- 75.9% of developers** (Stack Overflow 2025, n=26,143),
  180M+ GitHub accounts. Everything ships unchanged, including hooks.
- **Cursor -- ~$2B annualised, 64% of the Fortune 500**, and **Plugins**: skills + MCP +
  hooks as ONE installable marketplace unit. This is the distribution primitive the
  infrastructure play needs.

### Build order

1. **VS Code / Copilot** and **Cursor** -- the market, both Tier 1, both keep Larry intact.
2. **Goose** -- the only host carrying *every* channel including `instructions` and
   elicitation. Block-backed, pushed daily. The reference implementation for full fidelity.
3. **Cline** -- 4.7M VS Code installs, skills+hooks work, persona degrades to a skill.
   **PR #11131 implements `instructions` and is still OPEN, needing only a rebase** --
   an upstream contribution upgrades this host cheaply (see correction below).
4. **Grok Build / OpenCode** -- Tier 1; OpenCode needs SEED-063's plugin for turn-end.
5. **Zed** -- ~a day (copy to `.agents/skills/`). Ship because it is cheap, not because
   it moves revenue. **Hard constraint: 50KB total catalog budget for all
   names+descriptions, overflow silently dropped. At 124 skills that is ~400 bytes each
   -- MEASURE BEFORE SHIPPING.**
6. **Continue** -- package for, do not invest in. Acquired by Cursor; four consecutive
   zero-commit weeks; best features CLI-only and undocumented.
7. **Aider** -- skip. No MCP client at all; no progressive disclosure.

### Corrections to earlier claims in this research

- **Cline did NOT "explicitly decline" `instructions`.** The issue was closed
  `not_planned` **by a stale bot** with no human position taken; the PR was closed **by
  its own author** for refactor drift, not rejection. PR #11131 remains open. **There is
  zero recorded opposition** -- upstreaming is viable.
- **Windsurf is now Devin Desktop** (`docs.windsurf.com` 307-redirects to
  `docs.devin.ai/desktop`; v3.0.12, June 2026). Cognition-owned. No substantiable seat or
  ARR figure -- verify the install base before spending roadmap on it.
- The IDE research pass returned **one materially wrong verdict** (VS Code hooks) that it
  caught and corrected on a second pass. Remaining UNVERIFIED cells -- Cursor's
  `instructions` support, elicitation *rendering fidelity* on Cursor and VS Code -- should
  be treated as genuinely open, not probably-fine.

---

## The architecture -- two tiers, honest degradation

```
TIER 0  UNIVERSAL        skills (124 SKILL.md) + MCP server (~30 tools)
                         works on every Claude-Code-format-compatible host
                         Claude Code / OpenCode / Grok Build / next-thing

TIER 1  HOOK-CAPABLE     + proactive surfacing, Stop gate, contradiction push
                         Claude Code  -- 84 hook entries, today
                         Grok Build   -- 17 events, exit-code-2, native
                         OpenCode     -- small plugin (SEED-063 becomes an
                                         ENHANCEMENT, not the strategy)
```

This resolves the SEED-065 ceiling rather than surrendering to it. Larry does not die --
**he tiers.** The core ships everywhere; the teaching layer ships where the host can
carry it; below that the product **degrades honestly** and says what is unavailable.
That is the same discipline the gate ladder already encodes in `renderViaText`, and the
same no-silent-skip rule the skill-optimization work uses.

**SEED-063 is not cancelled.** It is demoted from "the strategy" to "the Tier-1 adapter
for one host" -- and it stays valuable precisely because OpenCode is the host where we
would otherwise have the weakest hook story.

## Consequence: the BYO-key / BYO-sub problem largely dissolves

SEED-067's dilemma assumed MindrianOS would own the inference. **As infrastructure, it
does not.** The host runs the conversation; the host makes the model calls; the user is
already paying their host. **MindrianOS never touches an API key for the main loop.**

What survives from SEED-067: the narrow direct `api.anthropic.com` classifier calls
(SEED-062) still need a key or a heuristic fallback, and the **capability floor** is now
**two-dimensional** -- model capability AND host tier. Detect both; state both; degrade
honestly on both axes.

## The hard problem is commercial, not technical

**Skills are markdown. Markdown is copyable.** If the product is 124 `SKILL.md` files in
a package, what exactly is being sold?

**The enforcement point must move to the MCP server.** Skills are the visible surface;
the server -- holding the room graph, the memory layers, the gate ladder, the reach
engine, the Brain wire -- is the defensible one. Entitlement, licensing, and the
genuinely proprietary logic live server-side. The skills become the shopfront, not the
goods.

**Get this boundary wrong and the methodology is open-sourced by accident.**

Open sub-questions this raises, all unresolved:
1. Which methodology content must live *behind* the MCP server rather than in a skill
   file? (Probably: anything that consults the graph, scores, ranks, or grades.)
2. What is the entitlement mechanism, and does it work offline / self-hosted?
3. Does Tier 0 become a free tier that pulls users toward a paid Tier 1, or is Tier 0
   itself licensed?
4. Per-seat, per-org, or per-room pricing -- and how is that even counted when the host
   is not ours?

## What this costs, stated plainly

- **Depth on hosts we do not control.** Persona injection is ~50/50 (SEED-065); on a
  Tier-0-only host, Larry is a very good tool library with a voice in the tool
  descriptions, not a teaching partner.
- **Tool descriptions become load-bearing product copy.** SEED-065 established they are
  the only universally honoured persona channel. They must be written as instructions,
  not labels -- this is a real authoring discipline, not documentation hygiene.
- **N thin adapters over one core.** Packaging differs per host (Claude Code plugin,
  OpenCode plugin, Grok Build plugin). Small each, but N of them, forever.
- **Discovery.** An application has a product page. Infrastructure has to be installed,
  and someone has to want to install it.

## Do NOT

- Read this as cancelling SEED-063. It reframes it as a Tier-1 adapter.
- Ship Tier 0 without a declared capability floor on BOTH axes (model and host tier).
- Put anything genuinely proprietary in a `SKILL.md`. That file is a copyable text file
  on the user's disk, on every host, forever.
- Assume the skill format will stay stable because two vendors adopted it. Track drift;
  it is a de facto standard, not a governed one.
