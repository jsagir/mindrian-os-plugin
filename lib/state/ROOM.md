---
folder: lib/state
founding_phase: 100
purpose: STATE.md parsing utilities -- shared across phases that read project / room STATE.md
icm_layer: 3
canon_parts: [3, 7]
license: BSL-1.1
---

# lib/state/ -- STATE.md Parsing Utilities

This directory is the home for reusable parsers that read `STATE.md` (project-level
at `.planning/STATE.md` and per-room at `<roomDir>/STATE.md`).

## Files

| File                  | Purpose                                                    | Founded |
| --------------------- | ---------------------------------------------------------- | ------- |
| `state-md-parser.cjs` | Decisions section parser (bullet, numbered, table formats) | 100-02  |

## Why this directory exists

Phase 100's heuristic JTBD classifier needs to read the last 3 decisions from
STATE.md as Stratum 3 input (per Phase 100 CONTEXT D-04). Phase 100 CONTEXT
`code_context` calls out the parser as a side-effect deliverable to keep STATE.md
parsing centralized rather than duplicated across phases (101-106 will all read
the same source).

Anything that reads `## Decisions` or `### Decisions` from a STATE.md file must
import from here, not roll its own regex.

## Pattern

- Pure functions; no I/O. The caller reads the file; the parser parses the string.
- Returns chronological-recent-first arrays.
- Tolerant of bullet, numbered list, and table formats.
- Detects optional `[methodology: /mos:X]` and `[jtbd: <id>]` annotations.
- CJS, zero npm deps, Canon Part 8 LOCAL-only.

## Canon parts

- **Part 3 (Tri-Context Decision Gate):** Decisions are the LOCAL context that
  the gate reads. STATE.md is the durable record; this parser is the canonical
  reader.
- **Part 7 (Reuse Before Build):** centralizing the parser keeps Phases 101-106
  from reinventing it.
