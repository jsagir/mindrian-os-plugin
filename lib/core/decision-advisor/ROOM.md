# lib/core/decision-advisor/

Phase 399 (decision-model advisor keyed on the job to be done). ICM Layer 0 identity for this folder.

What this folder is: the provider-neutral adapter and the labels-only validator for a decision model that ADVISES which command fits a job. Pure library code.

Rules this folder holds:
- The advisor advises and the host judges (D-02). Advisor output is evidence, never instruction. Unsure means abstain.
- Labels only (D-03). A request carries job ids, their vocabulary summaries, definition levels, command names with their registry teaching text, and fixed question templates. Anything else is refused, never stripped.
- No network in this folder. No file here opens a connection, names a vendor host, or reads a key. The transport is a dev-time script outside lib/, behind the egress policy.
- No second selector. The shortlist feeds the one existing selector; nothing here picks a command for the user.

Contents:
- `adapter.cjs` - neutral request render, chunking, and `askDecisionModel()` over an injected transport.
- `labels-only.cjs` - the closed label catalog and the validator for the request and the provider body.
- `providers/gemini.cjs` - body builder and response parser for the Gemini Decision shape (pure).
- `providers/jev.cjs` - body builder and response parser for the Jev-compatible shape (pure).
- `shortlist.cjs` - the per-turn lookup over the precomputed table; `present.cjs` - the navigator-safe shape with no number.
- `domain.cjs` - Phase 400 (CY-05): the room's cause and effect domain applied to a shortlist (pure, reads only the registry and the domain file). Only methodology commands whose move type is the domain's move count as a fit (F-05). It reorders only inside the strong band, keeps a top tie as a tie, and never changes a band or a value. Chaotic gives an honest no strong pick; disorder keeps the shortlist and adds the slicing note for the host model (O-03). An unknown domain changes nothing: the lookup gives the Phase 399 result.

Tests: `tests/test-399-adapter.cjs`, `tests/test-399-advisor-fence.cjs`, `tests/test-400-advisor-domain.cjs`.
Canon: Part 8 (labels only leave the machine), Part 7 (reuse before build), Part 9 (memory locality).
