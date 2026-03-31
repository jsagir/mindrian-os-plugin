# MindrianOS Onboarding System

**Date:** 2026-03-31
**Status:** Approved (v2 - expanded with deep context building)
**Version target:** 1.6.0

## Problem

Users who install or update MindrianOS land on a cold-start screen with a command list. There is no guided introduction to what MindrianOS is, what it can do for THEM specifically, or how to get started. Power users figure it out; everyone else bounces.

More importantly: Larry knows nothing about the user. Every conversation starts from zero. The onboarding is the opportunity to build a deep context foundation that makes every subsequent interaction smarter.

## Principle: MindrianOS is Infrastructure

MindrianOS is not a venture tool. It is infrastructure for structured thinking applied to any domain. Users include:

- Founders exploring venture ideas
- Consultants managing client engagements
- Researchers organizing literature and findings
- Teams filing meeting intelligence
- Students working through methodology assignments
- Analysts building competitive landscapes
- Anyone navigating a wicked problem

The onboarding MUST NOT assume the user is a founder. It must discover who the user is, what domain they work in, and what they need -- then tailor accordingly.

## Trigger Logic

| Scenario | Detection | Behavior |
|----------|-----------|----------|
| First install | No `~/.mindrian-onboarded` marker file | Banner + full interactive onboarding |
| After update | Marker version < current plugin version | Banner + "What's new" + core features reminder |
| Manual (full) | `/mos:onboard` | Full interactive walkthrough |
| Manual (changelog) | `/mos:onboard whats-new` | Version-aware changelog as capabilities |

### Marker File: `~/.mindrian-onboarded`

```
1.5.1
2026-03-31
```

- Line 1: last version user completed or skipped onboarding for
- Line 2: date
- Written after onboarding completes OR is skipped
- Location: `~/.mindrian-onboarded` (home dir, persists across projects)

### Skip Mechanism

Every step offers skip. Skipping is never penalized. The user can always run `/mos:onboard` later. But Larry should make clear that the deep context steps have massive payoff:

> "You can skip this, but 5 minutes here saves hours later. Everything I do gets sharper when I know who I'm working with."

## Interactive Walkthrough Flow (7 Steps)

All text is in Larry's voice. Conversational, direct, no filler. Signature openers ("Very simply...", "Here's the thing..."). No emoji. No "I'd be happy to help."

### Step 0: Banner

Show the De Stijl Mondrian banner (already implemented). Sets the visual tone.

### Step 1: Who Are You? (Deep Context Building)

This is the highest-value step. Larry gets to know the user through conversation and optional document/research input.

**Approach A: Conversational Q&A**
Larry asks 3-5 focused questions, one at a time:
- "What's your role? What do you do day to day?"
- "What are you working on right now? What's the project or problem?"
- "What domain or industry? Any subdomain specialization?"
- "How technical are you? (This helps me calibrate my explanations.)"
- "What's your goal with MindrianOS? What outcome would make this worth your time?"

**Approach B: Document Input (optional, higher payoff)**
> "Want to speed this up? Paste your LinkedIn bio, CV summary, or a paragraph about yourself. I'll extract everything I need in one shot."

Larry parses the pasted text and extracts: role, domain, expertise areas, current focus, technical level.

**Approach C: Web Research (optional, consent required)**
> "If you share your name and LinkedIn, I can do a quick background research to understand your work better. This is optional -- I'll show you what I find before using it."

Larry uses web search/fetch to gather public information, presents findings, user confirms or corrects.

**Output: USER.md**
All three approaches produce a `USER.md` file in the room (or in `~/.mindrian-user.md` if no room yet) with structured profile data:

```markdown
# User Profile

**Name:** [name]
**Role:** [role]
**Domain:** [domain]
**Subdomain:** [subdomain specialization]
**Technical Level:** [beginner/intermediate/advanced]
**Current Focus:** [what they're working on]
**Goal with MindrianOS:** [stated objective]
**Expertise Areas:** [list]
**Context Source:** [Q&A / document / research]
**Created:** [date]
```

### Step 2: Domain & Subdomain Intelligence

Based on Step 1, Larry does an initial domain analysis. This happens automatically after Step 1 (no user action needed beyond confirming).

- Identifies the primary domain and 2-3 subdomain branches
- Maps key frameworks relevant to this domain (from Brain if connected, from Larry's knowledge otherwise)
- Suggests which room sections will be most relevant
- Identifies potential methodology matches (e.g., "For policy work, Minto pyramids and stakeholder mapping are your bread and butter")

**Output:** Brief domain briefing presented to user. If a room exists or is created, this seeds initial intelligence.

### Step 3: Incentives & Clarification

Questioning phase to understand motivations, constraints, and success criteria:

- "What does success look like for this project? What's the one thing that would make you say 'this worked'?"
- "Who are the stakeholders? Who needs to be convinced, informed, or consulted?"
- "What's the timeline? Is this exploratory or is there a deadline?"
- "What have you tried before? What didn't work?"

These answers feed into the room's problem-definition section and sharpen every future Larry interaction.

**Output:** Enriches USER.md with incentives section. If room exists, seeds problem-definition/ with initial framing.

### Step 4: Tailored Tool Tour

NOW Larry presents the tool tour -- but contextual to everything learned in Steps 1-3. Instead of generic paths, Larry recommends THE specific workflow for THIS user.

> "Based on what you've told me -- you're a [role] working on [domain], trying to [goal] -- here's exactly how I'd use MindrianOS:"

Then presents 3-5 commands as a workflow sequence, personalized to the user's context.

If Steps 1-3 were skipped, falls back to the 7-option intent discovery:

1. I have an idea or venture to explore
2. I need to organize research or analysis
3. I want to file and analyze meetings
4. I'm building a case for stakeholders (investors, board, clients)
5. I'm managing a complex project with many moving parts
6. Just show me around
7. Skip -- I'll figure it out

### Step 5: What's New (update flow only)

Parsed from CHANGELOG.md. Larry reads the current version's entries and frames them as capabilities, not technical changes.

> "Since you last checked in, here's what I learned to do:"

Also includes a core features reminder grouped by workflow.

### Step 6: Wrap + Suggested First Action

Based on everything learned:
> "That's the foundation. Based on what you need, I'd start with [specific command]. Want me to launch it now?"

Options:
1. Start [contextual first command]
2. Show me the full command list
3. I'm good -- just drop me at the prompt

## Files to Create/Modify

| File | Type | Purpose |
|------|------|---------|
| `commands/onboard.md` | New | `/mos:onboard` command definition -- full interactive walkthrough |
| `scripts/check-onboard` | New | Check marker file, return FIRST_INSTALL / UPDATE / CURRENT |
| `scripts/session-start` | Modify | Call check-onboard, inject onboarding context on first install/update |
| `~/.mindrian-onboarded` | Runtime | Marker file written after onboarding |

## Voice Rules (Larry)

- Conversational, never mechanical
- Signature openers: "Very simply...", "Here's the thing...", "One thing I've learned..."
- No emoji, no "I'd be happy to help", no "Great question!"
- Lead with data, not commentary
- Frame everything as capabilities, not features
- Respect the user's time -- every word earns its place
- Make the deep context steps feel VALUABLE, not bureaucratic

## Success Criteria

- First-time user understands what MindrianOS does within 60 seconds
- User can start their first meaningful action within 2 minutes
- Onboarding adapts to at least 5 distinct user types
- Skip is always one action away
- Deep context steps build USER.md that persists across sessions
- Domain analysis provides immediate value (not just "we'll use this later")
- Incentives questioning produces actionable problem framing
- Update flow reminds of core tools AND shows what's new
- Larry's voice is consistent throughout
- The full onboarding (Steps 1-6) takes under 10 minutes
- The skip path (Steps 0 + 4 + 6) takes under 2 minutes
