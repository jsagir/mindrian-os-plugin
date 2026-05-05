---
type: tester-email-template
phase: 115
dispatch_window: 48-hour async reply
tester_count: 5
tester_slugs: [lawrence-aronhime, justin-stitzlein, aryeh-holtzberg, adam-peters, shmuel-schuman]
canon: Part 5 (Practitioner-tier evidence at validation week; upgraded to Operational-tier at 30-day re-audit per D-19)
created: 2026-05-05
---

# Phase 115 Validation Email -- 5-Tester Owned-Emotion Probe

> **HARD RULE (per user memory feedback_email_alignment_ltr):** every email LTR + left-aligned. `<body dir="ltr" style="text-align:left">`. No `align="center"` on outer wrapper. No `text-align:center` on content.
> **HARD RULE (per user memory feedback_no_emdashes):** hyphens only, no em-dashes.
> **HARD RULE (per user memory feedback_gmail_mcp_drafts):** if drafting via Gmail MCP, the `id` returned is the MCP internal handle, not the Gmail draft ID. Use `list_drafts` to confirm Gmail ID before reporting back.

## To (BCC the cohort, do NOT include all 5 in TO line)

To: jsagir@gmail.com
BCC: aronhime@jhu.edu, justin.stitzlein@colorado.edu, aryeholtzberg@gmail.com, apeters912@gmail.com, Shmuelschuman@gmail.com

## Subject

Quick read -- five minutes, one feeling

## Body (plain-text + matching HTML)

Hi [first-name],

Quick favor. We are validating one piece of MindrianOS copy and your read matters.

The question, verbatim:

> Think about the last time you felt stuck on a decision about your venture -- a decision where you couldn't even name what was blocking you. When was it? What did you do? What would have helped?

Four quick questions, one or two lines each:

1. Vivid recent memory? (Y / N -- was the feeling concrete enough that a specific recent moment came to mind?)
2. How recent? (days, weeks, months -- rough estimate is fine)
3. Was your current solution adequate? (advisor / co-founder / journal / "I just ruminated" -- pick one or describe)
4. Anything else you want to add about that moment? (free-text, optional)

48-hour reply window. No call needed. Reply-all not necessary; you can reply just to me.

Thanks,
Jonathan

---

## Synthesis target

After all 5 reply, fill in `tests/fixtures/115-tester-rubric.md` (5x4 table). Validation lands AT 4-of-5 with vivid recent memory (D-20 hard threshold). Below 4-of-5: trigger `tests/manual/115-rollback-procedure.md`.

## Canon Part 8 reminder

Tester replies file LOCAL to `docs/testers/{slug}/replies/2026-MM-DD-115-validation-reply.md`. Reply content NEVER egresses to Brain. Phase 121 telemetry emits ONLY `{vivid_memory: bool, recency_days: int, current_solution_adequate: bool, tester_id_hash: sha256}` -- no substrings.
