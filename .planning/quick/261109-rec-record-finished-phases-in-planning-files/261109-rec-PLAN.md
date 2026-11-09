---
quick_id: 261109-rec
date: 2026-11-09
type: docs
files_modified:
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
---

# Quick 261109-rec: record finished phases in the planning files

Goal: record finished work for Phases 389, 374, 370 and 391 in STATE.md, ROADMAP.md and REQUIREMENTS.md by hand with the Edit tool.

Limits:

- Do not run any gsd-tools state, roadmap, requirements or phase write command.
- Edit only the checkbox lines, the Plans lines of the four phases and the quick tasks table rows.
- Verify each fact against the phase folders and git log before writing it. Do not write a fact that cannot be verified.
- Never push, tag, bump or release. Do not touch CHANGELOG.md.

Tasks:

1. Verify the facts (summaries, closeout, commit ids, requirement rows).
2. Tick the REQUIREMENTS rows that a summary shows done. Leave ADAPT374-02 and ADAPT374-06 open.
3. Update the ROADMAP Plans lines and plan checkboxes of Phases 389, 374, 370 and 391.
4. Add the quick tasks table rows for rec, s67 and rdr.
5. Read the full diff, then commit only these files plus this PLAN and SUMMARY.
