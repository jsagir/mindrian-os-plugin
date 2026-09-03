# Note: Theo Forward-Compatibility for the Part 8 Enforcement Locus (Phase 257)

**Phase:** 257-part-8-enforcement-locus-host-independent-egress-guard
**Date:** 2026-09-02
**Status:** written note, not code, per the `docs/254-NOTE-*` and `docs/262-NOTE-*` precedent.
This document does NOT touch Theo's repository. Every claim below is sourced to a specific
Theo-side file, read directly during this session, so the cutover phase can re-derive rather
than re-discover them.

D-08 (navigator ruling, 2026-09-02) required this note to cover T-1, T-2 and T-3. All three
follow.

---

## T-1: the matcher goes dark on flip day

`hooks/hooks.json`'s `PreToolUse` matcher (line 236) and `PostToolUse` matcher (line 338) are
both the identical alternation:

```
mcp__(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*
```

Theo's tools are namespaced `mcp__theo__*`. That prefix is not in the alternation and will not
match either matcher.

When `pws-brain-mcp` cuts over to Theo (Theo's own Phase 9, "Brain-Contract Cutover"), the
defence-in-depth hook layer -- `scripts/part8-egress-guard-hook.cjs` on `PreToolUse`,
`scripts/brain-response-sanitize-hook.cjs` on `PostToolUse` -- disappears with no error and no
announcement. Nothing crashes; the hook simply stops firing for Brain traffic because the tool
names no longer match. This is the same class of silent-degradation failure Phase 239's
BRAIN-01 liveness gate was built to catch, arriving through a different door.

The matcher edit belongs to the cutover phase, not to 257. This phase does not edit
`hooks/hooks.json`. Naming the file and the exact literal here lets a future reader re-derive
the current state rather than trust a copy that could drift.

---

## T-2: catalog consolidation defeats name-based enforcement, and the convergence

Theo's own doctrine draws the Part 8 line INSIDE its catalog, not around it. From
`/home/jsagi/Theo/CLAUDE.md` (re-read this session, "Part 8 now draws a line inside Theo's own
catalog, not around it" section, line 249 onward): content/methodology tools (the former
`pws-brain-mcp` surface -- `classify_problem_type`, `find_frameworks_for_problem_type`, and the
rest) receive generic handles only. Operational tools (the absorbed `mindrian-os` surface --
`room_bind`, `graph_write`, and the rest) legitimately receive room content. Both classes share
one server name, `mcp__theo__*`.

A regex over `mcp__theo__*` cannot distinguish the two classes. Any future name-based hook would
either block legitimate `graph_write` calls (false positive, breaks operational functionality)
or allow content-tool leaks through (false negative, exactly the breach Part 8 exists to
prevent). Name-based matching is structurally unable to serve both goals at once once the
catalog is consolidated like this.

The only viable locus is Theo's own `registerContentTool` (`/home/jsagi/Theo/src/mcp/
register-content-tool.ts`) -- a single-place, per-tool-class registrar that already knows which
tools are content tools at registration time, independent of the server-wide tool-name prefix.

State the convergence plainly, because it is the most transferable thing this phase produces:
**enforcement belongs at a chokepoint the code owns, not at a name pattern a host matches.**
That is the identical conclusion `docs/257-NOTE-part8-enforcement-locus-rulings.md` reaches for
MindrianOS in its Section 1 (the client-side `callTool` belt is the locus that can satisfy
Part 8's literal text, not a host-level hook matcher, which is defence-in-depth at best). Same
answer, two independently-arrived-at codebases.

---

## T-3: the window is open now

Theo is registered in `~/.claude.json` as a local stdio server:

```json
"theo": { "type": "stdio", "command": "node", "args": ["/home/jsagi/Theo/dist/index.js"] }
```

Per `docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md` (re-checked this
session, line 47): Theo's own Phase 9 ("Brain-Contract Cutover") is at 10 of 12 plans, wave 4
closed. Theo's team found a new, more fundamental blocker on 2026-08-31: **Theo has no remote
hosting story.** `src/index.ts` hardcodes stdio-only transport; the only live registration
anywhere is a local child-process spawn on Theo's own dev machine. Phase 08.4 ("Remote hosting
for Theo's MCP server") is registered in Theo's own ROADMAP with 7 plans, zero executed, and
Theo's remaining Phase 9 plans (09-11, 09-12) are explicitly gated on it.

While that gap stands, a client-side `classify()` inserted at `registerContentTool` is viable
today and would be structurally correct -- the same locus T-2 already names as the only one
that can distinguish content tools from operational tools. When Theo goes remote (Phase 08.4
lands and a future phase points `pws-brain-mcp` at it), that window closes the same way it
closed for the current Brain: once traffic leaves over HTTPS to a third-party-hosted process,
the far-side-cannot-prevent-RECEIPT argument from `257-NOTE-part8-enforcement-locus-rulings.md`
Section 1 applies to Theo exactly as it applies to `ProblemsWorthSolving-Brain` today.

---

## What Theo has that MindrianOS does not, and what it does not have

**What Theo has:** `src/mcp/register-content-tool.ts`, GUARD-01 (re-read this session, lines
2-40 and 143-144). Every content tool declares an `inputShape`, never a schema, and this one
registrar is the only place in Theo that converts a shape into a schema, always via
`z.strictObject(config.inputShape)`. Its docblock records a measurement against SDK 1.30.0 /
zod 4.4.3: a call carrying `{framework:'x', roomSecret:'LEAK'}` against a plain (non-strict)
shape was accepted, and the handler received `{framework:'x'}` -- the extra key silently
dropped, nothing logged, nothing rejected, an ordinary success returned to the caller. GUARD-01
exists to close exactly that failure: `z.strictObject` rejects undeclared keys before the
handler ever runs (the MCP SDK's `validateToolInput` runs before `executeToolHandler`).

That closes a leak class the MindrianOS belt does NOT close today: smuggling an undeclared key
past a plain (non-strict) zod shape. Plan 08 of this phase closes it here, in this repo, after
confirming this repo's own `server.tool()` registrations in
`bin/mindrian-brain-mcp-client.cjs` use plain object-literal shapes rather than
`z.strictObject`, against this repo's actual pins (`@modelcontextprotocol/sdk ^1.29.0`, `zod
^3.25.76` -- a different major zod line than Theo's measurement, so the gap needed confirming
against this repo's own pins rather than assumed transferable).

**What Theo does NOT have:** any content classification. GUARD-01 rejects undeclared KEYS; it
never inspects the VALUE of a declared key. A question-shaped input carrying user prose --
`{question: "My cofounder Dana Levi wants to pivot"}` -- passes GUARD-01 cleanly and reaches
Memgraph, because `question` is a declared key and GUARD-01 does not look inside it.

Theo's own `CLAUDE.md` admits this in plain text (`/home/jsagi/Theo/CLAUDE.md`, "Schema
direction (first real GSD phase, not yet done)" section, lines 383-385, re-read this session and
matching `257-RESEARCH.md`'s transcription verbatim):

> "Also needed before Theo is trusted for anything beyond read-only consult: an egress/safety
> gate matching the real Brain's Part 8 guard."

So: Theo has an analogous gap to what this phase addresses on the MindrianOS side, explicitly
acknowledged in Theo's own documentation, and not yet built.

---

## Do-not list

This phase does not touch Theo's repository code. This phase does not edit `hooks/hooks.json`'s
matchers (T-1's fix belongs to the cutover phase). This phase does not re-derive the
already-known `brain_query` Theo-shape normalization issue: commit `21fdd7bc` ("normalize
Theo's `{rows, diagnostics}` brain_query shape") appears to address it at
`lib/core/brain-client.cjs` around lines 920-929; the 2026-09-01 handoff owns that item and it
is not this note's concern.

---

## Cross-reference and delivery

Per CLAUDE.md's standing Theo consult rule, every claim above states which Theo file it came
from: `/home/jsagi/Theo/CLAUDE.md` (T-2's catalog-line quote, the Schema-direction admission),
`/home/jsagi/Theo/src/mcp/register-content-tool.ts` (GUARD-01, `z.strictObject`), and
`~/.claude.json` plus `docs/2026-09-01-HANDOFF-phases-272-274-275-plus-theo-flip-coordination.md`
(T-3's hosting-status claim).

Theo's own per-phase `{phase}-MOS-LEARNING.md` files (for example
`/home/jsagi/Theo/09-MOS-LEARNING.md`) are where a Theo-side reader would record the reciprocal
of this note -- the outbound contract from Theo's side naming exactly which MindrianOS-Plugin
files need adaptation before the flip. This note is the MindrianOS-side record; it does not
duplicate that list.

### Freshness and read-only verification

The two quoted Theo lines (T-2's catalog line, the Schema-direction admission) were re-read from
`/home/jsagi/Theo` this session, not copied blind from `257-RESEARCH.md`. Both matched
research's transcription exactly; neither had moved.

`git -C /home/jsagi/Theo status --porcelain` was run during this session and returned:

```
 M src/generated/build-stamp.ts
 M tests/integration/anchor-integrity.test.ts
 M tests/unit/coverage.test.ts
 M tests/unit/mapping-census.test.ts
```

These four modified files are pre-existing local state in Theo's own working tree, unrelated to
and not attributable to this plan -- this session only ever opened Theo-side files with a
read-only tool (`Read`, `grep`) and never wrote to `/home/jsagi/Theo` at any point. No file in
that list is a file this note cites or discusses.
