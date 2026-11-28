---
status: applied
date: 2026-11-27
phase: 404
amends: .claude/includes/decisions.md rows 1, 5, 8 and 18; CLAUDE.md at 2 places; skills/larry-personality/SKILL.md
ruling_source: owner ruling OR-30 (404-CONTEXT.md and 405-CONTEXT.md, Phase 404 and Phase 405 planning)
engineering_status: The code holds the label constant OWN_TEXT_LABEL in lib/core/framework-recipe/steps.cjs; the pilot rewrites are slice S5.
---

# Amendment 2026-11-27: Decision 8, run and label

This record explains the change to Decision 8 and its related text. It copies the old text and the added text from the source files. It also states what stays in force.

## The ruling

Owner ruling OR-30 has the card answer: "Run from own text, say so". The owner ruled that each methodology skill has its own method text. When Theo provides usable steps, Larry uses those steps. When Theo cannot be reached, gives no usable steps, or differs from the PWS source, the skill runs from its own text and states that source in one fixed line. The rule is run and label. The label is mandatory. The PWS source wins when it differs from Theo. Part 8 stays in force.

## The old text that stays

The following text is copied from the files before the Task 2 edit. It does not include the added sentence.

`.claude/includes/decisions.md`, row 1:

> | 1 | One-command install; the Brain is part of what installs, and the key gates installing and updating rather than each query. | Larry's methodology comes from the Brain and says so; the entitlement is checked at install and update time, so a keyless session gets an honest refusal and a visible path to a key at that moment, never an imitation; once an install is entitled, methodology queries carry no separate per-query key check. |

`.claude/includes/decisions.md`, row 5:

> | 5 | Brain as remote MCP | IP never distributed; users get intelligence, not data. The Brain is remote by design, not optional by default; a keyless session gets an honest refusal, never a silent local substitute. Per-query Brain keys are gone: the entitlement moved to install and update time, and moving the check does not make the Brain local or optional. |

`.claude/includes/decisions.md`, row 8:

> | 8 | Honest refusal everywhere | A Brain failure or readiness miss surfaces in-turn and auto-queues enrichment; no surface conceals a failure or serves methodology the graph did not give. |

`CLAUDE.md`, first old sentence:

> A commercial Claude Code + Cowork plugin. One command installs it (`claude plugin install mindrian-os@mindrian-marketplace`); the Brain is part of what installs -- a fresh install registers silently and Larry starts talking with graph-grounded methodology, no key ceremony required. A keyless or unreachable session gets an honest refusal, never a silent imitation. Two OPTIONAL and unrelated extras, kept apart here because conflating them has already cost a session: the **user's own room graph** can use Neo4j Aura (free tier, the user's data, their instance), and a **manual Brain key** is the override path for an operator identity, a paid tier, or troubleshooting silent registration. Full description in the Project section below.

`CLAUDE.md`, second old sentence:

> A commercial Claude Code + Cowork plugin delivering Mindrian's PWS (Personal Wisdom System) methodology as installable skills, commands, agents, and hooks. One-command install gives the user Larry (the AI teaching personality) plus a structured Data Room that captures insights and surfaces gaps, contradictions, and convergence; it runs on Claude's native capabilities and connects to the remote Brain by default (silent registration on first use) for methodology -- a keyless or unreachable session refuses honestly instead of improvising.

`skills/larry-personality/SKILL.md`, old paragraph:

> This is NOT `### No fake recall` above (that governs claims about what Larry remembers) and it is NOT the visible refusal rail in `lib/core/refusal-messaging.cjs` (that is the HARD case, where the Brain cannot serve at all and the turn becomes a stated refusal). This is the middle case: the answer lands, but it lands thin, and Larry says so in one clause.

## The added text

The following text is copied from the edited files at HEAD.

`.claude/includes/decisions.md`, row 18:

> | 18 | Run and label (owner ruling OR-30, 2026-11-27) | A methodology skill that has its own method text runs from that text when Theo gives no usable steps, when Theo cannot be reached, or when the PWS source and Theo differ. It says so in one fixed line: "These steps come from the MindrianOS method text, not from Theo this time." It never refuses for that reason and never plays the text without the line. Rows 1, 5 and 8 still hold for every other Brain call. Part 8 does not change. |

The added sentence in each of rows 1, 5 and 8 is:

> A methodology skill that has its own method text is the one case that runs in place of a refusal, with a fixed line that names the source (row 18).

The added sentence at both locations in `CLAUDE.md` is:

> A methodology skill that has its own method text still runs then, and says in one fixed line that the steps are not from Theo this time (decision 18).

The added sentence in `skills/larry-personality/SKILL.md` is:

> For a method that has its own text the turn does not end at the refusal: the method runs from its own text with the fixed own-text line (decision 18).

## What did NOT change

Rule RL2 keeps the typed refusal for the 6 other shim tools. The Part 8 refusal remains `egress_blocked`. Rule RL5 keeps the ban on silent imitation, the mandatory label, and the PWS source rule. No file under `lib`, `scripts` or `hooks` changed for this amendment. The code constant already holds the label. The pilot rewrites belong to slice S5.

## The owner read (item O9)

The orchestrator applied owner item O9, the read of the sentences, under owner ruling OR-61 item 3 on 2026-11-28. The owner can overrule that application.

## Pins

`tests/test-404-run-and-label-canon.cjs` compares the quoted label in row 18 with `OWN_TEXT_LABEL`. `tests/test-250-amendment-unit.cjs` and `tests/269-doctrine-reconcile.test.cjs` still pass with no edit. Exception E1 of 406-P2 re-pinned `SKILL_OUTSIDE_ITEM5` in `tests/test-359-prose-budget.cjs`.
