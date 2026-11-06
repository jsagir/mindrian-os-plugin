# Phase 384 - leads relayed from the owner's parallel session (hypotheses; none verified or timed here)

Source: cross-session messages from `jsagi-cc`, 2026-11-06. Read-only findings. Treat as inputs to Wave 2 planning, never as results.

1. **Hook count.** `hooks/hooks.json` wires about 40 to 41 command hooks (SessionStart 9, PostToolUse 9, UserPromptSubmit 7, Stop 5, PreToolUse 4, six other events 1 each). The 7 UserPromptSubmit hooks run on every message. They were NOT timed by that session. Time them with the plan 384-12 tooling before any trimming or merging.
2. **Direct-MCP hook lever.** Claude Code 2.1.118 added a hook type that calls an MCP tool directly (`mcp_tool`). It could remove the Node proxy process behind "hook timed out" failures. Not adopted; unverified. A candidate lever for the hook fan-out findings (S1, S2); needs a host-behaviour check, the Part 11 registries and a parity test before any use.
3. **Capability radar** (`references/capability-radar`) was last fetched 2026-10-02 (covers Claude Code up to 2.1.287); ledger rows dormant and untriaged. The fetch writes to the tree: the owner decides who runs it (recommended: a quick task, on the owner's word).
4. **Doctor acceptance takes about 68 s** on this machine (measured by the 387 executor: old code median 67.7 s, current 68.9 s). It exceeds the 60 s timeout of `tests/test-244-doctor-fts-health.cjs` (a known red that predates the work). Candidate for the Q3 60 s doctor limit discussion and the doctor-all findings.
