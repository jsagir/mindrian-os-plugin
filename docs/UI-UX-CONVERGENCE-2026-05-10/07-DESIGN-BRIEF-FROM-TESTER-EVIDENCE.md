---
type: design-brief
created: 2026-05-10
source: docs/testers/ (REGISTRY, gary-laben FEEDBACK + PERSONA, outbox notes, Phase 94 tester-driven-fixer, Phase 115 owned-emotion) + the JTBD analysis (02)
audience: MindrianOS design team
---

# Design Brief -- From Tester Evidence

**Headline:** the testers have barely said a word about how MindrianOS *looks*. Every pain they've voiced is a *legibility* pain -- "which context am I in," "what's running on my machine," "I set a preference and nothing changed," "the empty room won't guide me," "the picker is bolted-on." The design brief that comes out of real evidence isn't "make it prettier." It's "make the system legible."

## The JTBD (from the product's own spec)

- **Emotional job:** *"I'm a founder stuck on a decision I can't name. Help me find the shape of it."* (Phase 115 owned emotion -- splash, first-touch, tester-screening criteria all point here.)
- **Functional job (CLAUDE.md):** *"Reduce the time between insight and validated decision across every dimension of the venture simultaneously."*

Every UI/UX decision is judged against those two.

## What the testers actually said

| Pain | Who | Verbatim signal | What it's really about |
|---|---|---|---|
| **"Which room am I in?"** | Lawrence Aronhime (heavy daily, multi-room) | Statusline showed the wrong active room -- he called it the "core power" bug. Then: typed "8" to pick a room with two loaded, got the wrong one. | Multi-room context safety. The room name is the canary and the canary lied. |
| **"What's running on my machine?"** | Gary Laben (cautious, reads system output) | "I think it's concerned the Mindrian will run for every Claude project I open, not just those associated with Mindrian?" | Scope transparency. He wants to *see* what surface MindrianOS occupies. |
| **"I set my job and nothing changed."** | (designed-for, NEXT-ui-improvements + Phase 104) | Setting a JTBD today only moves the operator/memory layer; 80+ commands ignore it until Phase 104. | The system asked for the job, then didn't act on it. Trust leak. |
| **"The room is empty and it won't help me."** | Lawrence (P1 blocker open since 2026-03-31) | `/mos:wiki` + wikilinks on an empty room -> no useful diagnostic, just emptiness. | Cold-start / empty-state design. The hardest moment to design, the most neglected. |
| **"The picker is bolted-on."** | (NEXT-ui-improvements update) | "the generic Claude Code AskUserQuestion" instead of the De Stijl vocabulary. | The one interactive primitive every choice routes through doesn't feel native. |
| **"Turn 1 didn't meet me where I am."** | (Phase 115 rationale) | "I'm Larry. What are you working on?" -> too open for someone with a specific stuck feeling. Fix: "What decision is stuck?" | First-touch copy. Name the emotion, don't ask a blank question. |
| **Stray glyphs / em-dashes** | QA sweep + the founder's no-em-dash rule | `✗` (U+2717) crept into 7 command files -- not in the canonical 12-glyph set; em-dashes in `wiki.md`. Both fixed in v1.11.x. | The glyph vocabulary isn't actually enforced. It drifts. |
| **"What's driving Larry's behavior?"** | Justin / Aryeh (beta opt-in) | Tester notes flag "Navigation Engine not yet wired -- skill activation remains legacy file-state behavior." | Predictability of the system's own routing. (= the activation gap, `09`.) |

Not in the testers folder, anywhere: a complaint about color, layout, typography, the dashboard's look, or "it's ugly." **Don't gold-plate the aesthetics; the users are hurting on legibility.**

## Mapping the pains onto the design decisions (see `06` for the 10 forks)

- **The Decision Gate / picker (Decision 6) takes the most user pain** -- "the picker is bolted-on" (native rendering) + "I told it my job and nothing changed" (the picker's option set must reflect the active JTBD) -- and it has a roadmap hole (C6): the first tester on Desktop gets an undesigned conversational rendering. **#1 design priority.**
- **"Which room am I in?" forces Decision 7 + the statusline contradictions (C1, C5).** On CLI the room name lives in the statusline (the surface Lawrence stares at, the one that lied). On Desktop there is *no statusline* -- the "prose state echo" is barely designed. A multi-room user on Desktop has no canary at all. **Design the room-identity surface for all three surfaces as one coherent thing; resolve the statusline carve-outs.**
- **The empty-state blocker is a cold-start design problem and it's invisible in every spec.** The owned-emotion user arrives empty *by definition*. The empty room is the *primary* state, not an edge case. `/mos:wiki` on it is a dead end. v1.14.0's 104-01 (resolve-room + Larry-voice empty-state messages) is the fix -- ship it first.
- **"What's running on my machine?" -- consider a scope-visibility surface** (a one-line "MindrianOS active in: [scope]" indicator). Ties to the transparency value (Canon Part 8 graph boundary); Gary's persona note predicts it "will probably resonate when explained." Make it *visible*, not just explainable.
- **Stray glyphs -> Decision 8.** A QA sweep had to hunt `✗` across 7 files because it isn't in the canonical 12. Confirm the set is *complete*, ship SVG versions, add a linter so it stops drifting into command files.
- **No tester evidence yet -- don't over-invest:** one-vs-two visual systems (1), De Stijl literalness (2), red-link colors (5), motion (9), dashboard redesign (10). The only thread is Gary's "recommend to the board" hypothesis -> design the **SnapshotHub export** for that audience; let the rest wait.

## Priority order for the design team

1. **Decision Gate / picker for all three surfaces** -- two real pains converge here + a roadmap hole. Highest leverage.
2. **Room-identity surface across CLI / Desktop / Cowork** -- Lawrence's loudest bug; the Desktop version doesn't exist. Resolve the statusline carve-outs while you're in there.
3. **The empty room as the primary screen** -- the owned-emotion user arrives empty; the wiki dead-ends today.
4. **Make the active JTBD visible in the picker's option set** -- "I told it my job and nothing changed" is a trust leak; the UI must *show* the job changed things.
5. **Lock and enforce the 12-glyph vocabulary** -- confirm completeness, ship SVGs, add a linter.
6. **Park the aesthetics decisions** until a tester hits them -- except SnapshotHub ("credible to outsiders").
