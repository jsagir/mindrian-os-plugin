---
seed: enlarge-room-schema-layered-icm-structure-plus-notion-gap-close
kind: illustration, not a shipped file
worked_example_room: launchpad-02 (real room, cited for its content, NOT edited)
status: draft
---

# SEED-084 illustration -- one L2 contract, worked against a real section

**This is an illustration living in the dev repo, not a file that belongs inside
`launchpad-02` or any other live room.** It was briefly, wrongly, written directly
into `launchpad-02/business-model/CONTEXT.md` during the same session that drafted
it -- caught and reverted. Root cause: momentum from "keep building SEED-084"
carried the still-bound room session straight into a live write, without separating
"prototype the plugin's proposed schema" (dev-repo work, this file) from "edit a
real venture's actual data room" (launchpad-02, untouched by this SEED). SEED-084
is MindrianOS-Plugin architecture work; `launchpad-02` is Jonathan's real IIA grant
application room. This file cites the latter's real content as a worked example --
it does not, and should not, write anything back into it.

The content below is otherwise unchanged from the draft: the first concrete
instance of SEED-084's proposed L2 contract layer, shaped to icm-architect's
Inputs/Process/Outputs/Human-check template, with the Human-check populated by the
Feynman-Minto dual test SEED-075 grounded in Theo's `feynman`/`pyramid` chapters.

---

```markdown
---
section: business-model
contract_version: 1
status: draft
per: SEED-084 (enlarge-room-schema-layered-icm-structure-plus-notion-gap-close)
sibling: SEED-076 (room-walk-test-and-pattern-confirmation-threshold)
---

# business-model -- state and defend the program's funding math

One job: show how the program is funded, milestone-gated, and what happens after
support ends -- and defend that argument, not just list the numbers.

## Inputs

- **Working (this run):** dated entry files in this section. None exist yet -- the
  section's real content currently lives inline in `ROOM.md`'s body (89 lines: the
  70/30 split, program targets, milestone table, growth argument), the exact drift
  SEED-076's walk test flagged. Until that content is migrated out to a dated entry
  (e.g. `2026-08-26-funding-case.md`), treat `ROOM.md` below its frontmatter as the
  de facto working content -- do not add more to it.
- **Reference (every run):** the section's own declared `purpose`
  ("How the program funds itself, its milestones, and its scale/continuation path")
  and `default_methodologies` (`structure-argument`, `scenario-analysis`), both
  already in `ROOM.md`'s frontmatter.
- **Do NOT load:** other sections' `ROOM.md`/`MINTO.md` content, unless a
  cross-reference in this section's own entries names it directly.

## Process

1. State the funding math plainly: amounts, the 70/30 split, the source of each
   piece. Numbers a stranger could check, not a paraphrase of them.
2. Name the load-bearing risk explicitly -- the unconfirmed $150K US Embassy
   grant -- and its actual fallback, not just the happy path. If there is no real
   fallback yet, say that, do not imply one.
3. Argue the continuation thesis as a claim with grouped support (existing
   partners, prior-program track record, target-population fit), not a list of
   hopes stated as facts.

## Outputs

- One dated entry file per funding-argument revision (`YYYY-MM-DD-funding-case.md`)
  in this folder. Not further edits to `ROOM.md`'s body -- that stays identity-only
  once the current inline content is migrated out.

## Human check

Two tests, not one -- the Feynman-Minto pairing SEED-075 grounded in Theo's own
`feynman` and `pyramid` chapters (the same test run once on vocabulary, once on
structure):

- **Feynman:** hand the latest entry to someone who has never seen this venture.
  Can they say back, in one sentence, what happens to Cycle 1 if the $150K grant
  falls through? If they can't, the fallback isn't real yet -- go find it, don't
  smooth the prose.
- **Pyramid/MECE:** does `MINTO.md`'s apex claim for this section actually sit on
  three non-overlapping groups -- funding math, milestones, continuation thesis --
  with nothing missing and nothing double-counted? If `MINTO.md` still reads
  "0 artifacts," that's this contract's Inputs step not yet done, not a MINTO bug.
```

## If this template is judged worth generalizing

Copy the shape, not the launchpad-02-specific facts, to a `_templates/` starter
under the SEED-084 implementation (e.g. `assets/templates/section-CONTEXT.md`,
matching icm-architect's own `stage-CONTEXT.md` convention) and drive it through
`lib/core/room-skeleton-scaffold.cjs` / `lib/core/section-registry.cjs` as a real
scaffolding option -- per GSD workflow, not a direct edit, and never by writing
straight into a live room again.
