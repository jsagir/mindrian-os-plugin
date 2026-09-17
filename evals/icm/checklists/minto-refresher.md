# MINTO refresher checklist

Writer graded: the section's MINTO.md governing-thought slot, written by the decision-capture
pipeline (`lib/core/decision-capture.cjs::atomicRewriteMintoWithDecisionLog`) and validated by
`lib/core/feynman-minto-invariants.cjs` (the `governing_thought` CRITICAL-severity invariant:
"governing_thought is the Minto governing thought itself, so its absence is a structural breach
of the section's reasoning contract"). The template placeholder text this checklist checks
against is the literal body `templates/room-skeleton/MINTO.md.tmpl` ships under `## Governing
Thought`.

## Item 1: the governing thought is present and non-template

- kind: code
- contract: `feynman-minto-invariants.cjs`'s `governing_thought` required-field check, plus the
  literal placeholder text in `templates/room-skeleton/MINTO.md.tmpl`
  (`*(empty; will be populated when the first /mos:* methodology fires or when Larry synthesizes
  from the auto-explore finding)*`).
- check: the section's MINTO.md `## Governing Thought` body is non-empty AND does not equal (or
  contain) the shipped template placeholder string.
- crosses the wire: nothing. Local file read and string comparison, zero network.

## Item 2: the governing thought summarizes the section's artifacts

- kind: jev
- what crosses the wire (one line, exhaustive): the section slug, the governing-thought TEXT
  itself (the one item in this whole eval suite where a writer's own output text crosses, because
  the governing thought is by design a synthesis meant to be read, never room evidence prose) and
  a list of the section's artifact TITLES only -- no artifact body, no claim text, no meeting
  transcript.
- check: a Jev Noul question asks whether the governing thought plausibly summarizes a section
  holding those artifact titles, given the section's job.
- note: this is the one checklist in this suite whose `jev` item crosses writer-output text
  rather than pure structure, because the governing thought IS the writer's product being graded,
  not room content the writer merely touched; the artifact list stays titles-only to keep every
  other byte at the Part 8 ceiling.
