---
type: tester-email-style-guide
status: canonical
created: 2026-05-02
updated: 2026-05-02
authority: jsagir@gmail.com
---

# Tester Email Style Guide

**Single rule: every release announcement to testers follows this guide. No exceptions.**

The voice was set by the v1.11.0 announcement (the "banana ripener" letter). The v1.12.4 announcement extends it. This document codifies the pattern so future releases ship consistent, gratitude-anchored, plain-English announcements.

---

## The non-negotiables

These appear in EVERY tester announcement:

1. **Install link at the very top.** First line of the email body. `https://mindrianos-install-site.vercel.app/` — pre-banner, before the subject splash. New testers might be CC'd; they should know how to install before they read anything else.

2. **Subject line pattern:** `/mos:vX.Y.Z — [headline] — [evocative tagline]`
   - `/mos:v1.11.0 | A Big Update`
   - `/mos:v1.12.4 — Big Update — The Banana Finished Ripening`
   - The tagline is metaphor or one-line promise, NOT a feature list.

3. **Tagline block (4 lines, italic, on its own).** Pattern:
   > vX.Y.Z shipped through MindrianOS's own release pipeline.
   > The plugin uses its own canon to ship itself.
   > Dog-fooding is not a feature.
   > It is the honesty test.

4. **"To my testers" thank-you, BEFORE Section 01.** Always:
   - "Across three continents."
   - Always names at least 2 testers by first name with a specific gratitude (e.g. "Adam, your 'banana ripener' line is still..." / "Lawrence, every release ships better because you push first").
   - Always the line: "You are why this release ships sane. Your bug reports become the canon."
   - Closes with: "Thank you. Truly."

5. **Eight numbered sections with consistent labels:**
   - Section 01 — What MindrianOS still is (timeless framing — banana ripener, wicked navigator, two things it gives you)
   - Section 02 — What just changed (the new release, framed as engines or themes)
   - Section 03 — What it can do (five things, plain words)
   - Section 04 — Why you should care (the inversion: "most software answers your questions...")
   - Section 05 — What just shipped in vX.Y.Z (the technical inventory, named in plain English)
   - Section 06 — Action / How to upgrade (two-command pattern + /mos:explain-decision callout)
   - Section 07 — Info / Fresh install (install link + claude plugin install + /mos:onboard)
   - Section 08 — Why MindrianOS exists (the 3 "because" clauses + "argument, structured")

6. **Closing structure (in order):**
   - "TRY THIS" — one concrete action the tester can take in 10 minutes
   - "WITH GRATITUDE" — "To the people who make this dream a reality. You! 🫵"
   - "Sixteen testers. Three continents. One canon." (update the count if it changes; the structure is fixed)
   - "— Jonathan Sagir" sign-off
   - Footer with: full release notes link + install link + the dog-fooding tagline (repeated)

7. **HTML format = De Stijl (mandatory):**
   - Mondrian top + bottom bands (red / yellow / blue / green)
   - Dark canvas (#0D0D0D) + cream text (#F5F0E8)
   - Bebas Neue display headers + Inter body + monospace code
   - Each section: colored left-rule callout (cycle through #A63D2F red, #C8A43C yellow, #1E3A6E blue, #2D6B4A green, #6B4E8B amethyst, #B5602A sienna, #2A6B5E teal)
   - Mondrian dividers between major sections
   - All `dir="ltr"` + `text-align:left` everywhere (HARD RULE — see `feedback_email_alignment_ltr` memory)
   - Code blocks: `#0D0D0D` bg, `#C8A43C` text, monospace, left-aligned
   - Plain-text fallback ALWAYS included (some tester clients strip HTML)

---

## Voice rules

These are the voice fingerprints. Future emails should sound like these emails.

### Plain words. No jargon.

| Internal term | Tester-facing phrase |
|---------------|----------------------|
| Operator state machine | "what mode you're in" / "Larry adapts to what you're doing" |
| JTBD inference | "what you're trying to do" / "the job you're working on" |
| Selector dispatcher | "the menu Larry shows you" |
| Shape F.1..F.5 sub-shapes | "the picker has colored rails and a structured layout" |
| Per-command JTBD declaration | "different /mos: commands surface different menus" |
| Cross-session memory | "remembers across sessions" |
| Cross-room intelligence | "the same problem in two ventures? you'll see the connection" |
| Mode A / Mode B / Tier 0 | "if Brain is up, more polish; if not, still works" |
| Phase numbers | NEVER named in body. Stays in CHANGELOG link. |
| Test counts (368 assertions) | "shipped sane" — the HOW becomes credibility, not a stat dump |
| Canon Part 8 LOCAL-only | "your data stays on your machine" |

**Rule:** if a tester would need to know our terminology to understand a sentence, rewrite it.

### Sentence rhythm

- Short sentences. Two clauses max for most.
- Periods over semicolons.
- Em-dashes are forbidden (project hard rule). Use hyphens or restructure.
- Exception: when explaining a metaphor or a Lawrence-style aphorism, longer sentences are allowed if they earn the length.

### Concrete examples over abstractions

Always include "You say X / Engine fires Y" pairs. Tested phrasing:
- **You say:** "I am stuck on whether to pivot." → **Engine fires:** Devil's Advocate.
- **You say:** "I keep finding the same insight in three meetings." → **Engine fires:** Synthesize.
- **You say:** "I am hunting a bottleneck in customer acquisition." → 80+ commands tune around bottleneck-hunting.

If the release introduces a new behavior, draft an example pair before drafting the announcement.

### The metaphors are load-bearing

Reuse these — they're calibrated:

- **"Banana ripener"** — Adam coined it, named the job. Use whenever explaining what MindrianOS *is*. NEVER replace; only extend (e.g. "the banana finished ripening" for v1.12.4).
- **"Wicked problem"** — Rittel & Webber 1973. The user is walking through one. MindrianOS is the compass and map.
- **"Compass and map for the navigator who is already walking"** — the persona framing.
- **"Larry, a thinking partner who argues with you instead of agreeing"** — Larry's anti-chatbot positioning.
- **"Lagging component"** — Hughes 1983. Named in Reverse Salient sections.
- **"The argument, structured"** — what MindrianOS is when reduced to one phrase.

If tempted to coin a new metaphor, ask: does it survive a 30-day distance? If not, reuse the calibrated set.

### Gratitude is non-negotiable

Every release announcement has gratitude in 3 places:
1. "To my testers" block before Section 01
2. Named testers with specific contributions
3. "WITH GRATITUDE / You! 🫵" closing

Without these the email becomes a corporate update. With these it's a letter from the founder.

---

## BCC protocol

**Pull from `docs/testers/REGISTRY.md` Active testers** (the single source of truth). NEVER hardcode an email list.

Current expansion as of 2026-05-02 (12 BCCs):

| Tester | Email | First-name reference in body? |
|--------|-------|------------------------------|
| Lawrence Aronhime | aronhime@jhu.edu | Always — first reporter |
| Justin Stitzlein | justin.stitzlein@colorado.edu | Sometimes — Wave 1 cohort |
| Aryeh Holtzberg | aryeholtzberg@gmail.com | Sometimes — Wave 1 cohort |
| Adam Peters | apeters912@gmail.com | Always — banana ripener |
| Austin Granmoe | ajgranmoe@gmail.com | When relevant |
| Pam Sheff | pamsheff@gmail.com | When relevant |
| Maydan Wienreb | maydanw@gmail.com | When relevant |
| Amnon Dekel | amnoid@innovate.huji.ac.il | When relevant |
| Laszlo Szemelyi | szemelyi.laszlo@neum.hu | When relevant |
| Jeff Wilner | jwilner8@gmail.com | When relevant |
| Christian Natajaya | christian.natajaya@neopolyai.com | When relevant |
| Taliah Lasry | taliahlasry@gmail.com | When relevant |

**TO field:** always `jsagir@gmail.com` (founder's address). BCC recipients never see each other's emails. Privacy preserved.

### Adding a tester

1. New entry in `docs/testers/REGISTRY.md` Active testers
2. Issue Brain API key per onboarding flow
3. Welcome email at `docs/testers/outbox/YYYY-MM-DD-{slug}-welcome.md` (gitignored — contains live key)
4. Their email joins BCC starting from the next release announcement

### Removing a tester

1. Move row in REGISTRY.md from Active to Released / Extended
2. Remove from BCC starting from next announcement
3. Don't delete history — they earned their attribution

---

## Outbox protocol (every release)

```
1. Wait until release ships and is tagged + pushed
2. Read docs/testers/REGISTRY.md Active testers for current BCC list
3. Compose body following 8-section structure above
4. Apply De Stijl HTML format (mirror v1.12.4 draft 19dea331bb12ca8e structure)
5. Always include plain-text alternative
6. File draft via Gmail MCP create_draft
   - to: ["jsagir@gmail.com"]
   - bcc: [pulled from REGISTRY.md]
   - body: plain text
   - htmlBody: De Stijl HTML
7. List drafts to capture Gmail draft ID
8. File outbox record at docs/testers/outbox/YYYY-MM-DD-vX.Y.Z-update.md with:
   - frontmatter: gmail_draft_id, status: drafted, sent_to, sent_bcc, subject
   - body content reproduced verbatim
   - any deviations from this style guide explicitly noted
9. Commit (safe — update notices contain no secrets)
10. Surface draft to founder for review + send
11. After send: flip frontmatter status: drafted → sent_YYYY-MM-DD
```

---

## What to do when this guide and a release call for different things

**The guide wins.** Voice consistency across releases is more important than any single release feature being maximally explained. If a feature doesn't fit the 8-section structure cleanly, compress it into Section 05 and call it out in 1-2 lines instead of extending the structure.

**Exception:** if the founder explicitly overrides this guide for a specific release ("more technical this time" / "shorter this time" / "thank Lawrence specifically for X"), apply the override and document it in the outbox file's frontmatter as a `style_deviation:` field with reason.

---

## Reference precedents

Two reference implementations for future writers to mirror:

| File | Voice notes |
|------|-------------|
| `docs/testers/outbox/2026-05-02-v1.12.4-bundled-update.md` | First v1.12.4 draft (technical-friendly, names phases) |
| `docs/testers/outbox/2026-05-02-v1.12.4-feynman-draft.md` | Pure user-benefit translation — translation table appended |
| Gmail draft `19dea331bb12ca8e` | The shipped-style v1.12.4 announcement, full 8-section format |
| (inline reference) | The v1.11.0 announcement that set the voice — preserved in this guide's principles |

When unsure: open `19dea331bb12ca8e` in Gmail Drafts and follow its rhythm.

---

## Why this discipline matters

Testers donate their time. The minimum return is treating them with the same calibration we treat our methodology with. A consistent voice across releases means:

1. Testers don't have to re-learn how we communicate every release
2. Trust compounds — they know what an authentic MindrianOS update looks like
3. The "banana ripener / dog-fooding / canon" thread runs unbroken
4. Future releases inherit the gratitude-anchored framing automatically — even if a different person writes them

This is the same Canon Part 7 ("reuse before build") logic applied to communication.
