# Phase 94 -- Deferred Items

Out-of-scope discoveries logged during plan execution. Each item documents what was found, why it was deferred (out of plan scope), and which future plan should address it.

## 2026-04-29 -- Plan 94-08 discovery: 2 additional U+2717 occurrences in commands/room.md

**Found during:** Plan 94-08 final verification (broader `commands/*.md` sweep gate).

**Discovery:**
```
$ grep -nP "[\x{2717}]" commands/*.md
commands/room.md:146:✗ Section not found: [section-name]
commands/room.md:226:  ✗ Room already exists: [path]
```

**Why deferred:**
- Plan 94-08's `files_modified` frontmatter explicitly listed only `commands/admin.md` and `commands/help.md`.
- Plan 94-08's QA handoff (Section 3 FIX-7) evidence enumerated exactly 5 occurrences across only those two files; commands/room.md was not in scope.
- Parallel-execution instructions for Plan 94-08 mandated: "Touch ONLY commands/admin.md and commands/help.md (and SUMMARY.md)."
- Per executor SCOPE BOUNDARY: "Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing... in unrelated files are out of scope. Log out-of-scope discoveries to deferred-items.md."

**Recommended remediation:**
A small follow-on fix in v1.11.3 (or a tiny addendum plan 94-08b in v1.11.2 if scope allows). The fix is mechanically identical to 94-08: two-char replacements (`✗` -> `x`) on commands/room.md lines 146 and 226. Same canonical glyph rationale (skills/ui-system/SKILL.md Section 7 -- ASCII `x` is the error-line glyph).

**QA-handoff Section 3 FIX-7 acceptance gate (broader interpretation):** Plan 94-08 satisfies the literal acceptance (`grep -P "[\x{2717}]" commands/admin.md commands/help.md` returns no matches). The broader acceptance (`grep -lP "[\x{2717}]" commands/*.md` returns no files) requires this deferred fix to ship alongside.

**Status:** OPEN -- assign to v1.11.3 backlog or 94-08b addendum.
