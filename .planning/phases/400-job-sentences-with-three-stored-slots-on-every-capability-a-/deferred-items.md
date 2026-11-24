# Phase 400 deferred items

## From plan 400-03 (2026-11-24)

1. Stale line pointers in 65 command frontmatter comments.
   - The comments have the form `first delivery at commands/<name>.md:<line>` (Phase 267.3 ruling record).
   - The 4 job lines of plans 400-02 and 400-03 sit in frontmatter, above every cited line, so each cited line number is now 4 lower than the real line.
   - Only tests/test-389-session-report.cjs reads a pointer; plan 400-03 made it compare the file without the job lines.
   - Not fixed: a fix edits 65 command files beyond the 4 job lines. Owner of the fix: a later quick task or Phase 401.

2. Job lines after a `# ---` comment line (400.1 research F1, Phase 401 owns it).
   - In all 17 agents and the 12 standalone skills, the job lines sit after the first `# ---` comment inside frontmatter, except agents/research.md and agents/reverse-salient-agent.md.
   - When the host ends frontmatter at that comment, the host does not see the job keys as frontmatter, and the lines load as body text.
   - Plan 400-03 added no new `---` line.
