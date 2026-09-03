# Note: Part 8 Enforcement Locus Rulings (Phase 257)

**Phase:** 257-part-8-enforcement-locus-host-independent-egress-guard
**Date:** 2026-09-02
**Status:** navigator rulings, ratified, not proposals. D-01 and D-02 were decided live during
the 2026-09-02 context-gathering session via `AskUserQuestion` (`workflow.skip_discuss` is
`true` for this repo, so there was no separate discuss-phase run) and are recorded here for
the record, not re-argued.

This document does NOT amend `docs/MINDRIAN-CANON.md`. The `LOCAL data -> BRAIN: NO` invariant
is unchanged by everything in it. See the "Container decision" section at the end for why this
is a standalone phase doc rather than a Canon edit.

---

## Section 1: The far-side ruling (D-01)

**Ruling: LOCAL-ONLY, documented. No far-side guard is built.**

### The pragmatic finding

`mcp-server-brain/` in this repo is the DEAD Neo4j-plus-Pinecone `mindrian-brain` service. A
guard placed there would guard nothing. The evidence, all verified this session and the
research session before it:

| Signal | Value |
|---|---|
| `mcp-server-brain/package.json` name | `mindrian-brain-mcp` |
| `mcp-server-brain/package.json` deps | `neo4j-driver ^5.28`, `@pinecone-database/pinecone ^5.1` |
| `mcp-server-brain/render.yaml` service name | `mindrian-brain` |
| `grep -ril memgraph mcp-server-brain/` | zero hits |
| Last substantive commit touching it | `2dfa52a4`, era 127.x |
| CLAUDE.md stack table | "Memgraph + Brain MCP ... cutover from Neo4j Aura landed 2026-07-22"; "Pinecone is RETIRED" |
| 2026-08-11 operator runbook | names `mindrian-brain` "confirmed dead spend," instructs suspension |

### The structural finding

The live far side is `ProblemsWorthSolving-Brain`, a different repository: ESM (`"type":
"module"`, entry `src/server.mjs`), Memgraph-backed. `lib/core/part8-egress-guard.cjs` is
CommonJS, so it cannot simply be `require()`d across the boundary. Vendoring the classifier
into that repo would create two copies of the same logic with no shared test -- Canon Part 7
(Reuse Before Build) argues against exactly this shape, and D-01 explicitly rejected it as an
option.

Which artifact actually provisions the live Render service at
`pws-brain-mcp.onrender.com` is MEDIUM confidence, not certain: it is inferred from that
repo's `render.yaml` naming `BRAIN_HTTP_PUBLIC_HOST` as `pws-brain-mcp.onrender.com` plus this
repo's own CLAUDE.md statement that the Brain lives in `jsagir/ProblemsWorthSolving-Brain`, but
the `render.yaml` itself is labeled "PHASE-A DRAFT: nothing is provisioned from this file yet,"
so the deployed service may have been provisioned by hand rather than from that exact file. If
this ever matters for cross-repo work, confirm with the operator first.

### The principled finding (load-bearing)

Part 8's text states that the Brain must never RECEIVE user content. A far-side classifier runs
on the far side of a TLS connection: by the time it inspects anything, the process hosting it
has already RECEIVED the bytes. Such a check can refuse to STORE or QUERY on what it sees, but
it structurally cannot prevent RECEIPT -- receipt already happened. Only a check that runs
before the socket opens, on the client side, can satisfy the literal text of "must never
RECEIVE."

This is the load-bearing half of D-01: the client-side locus (`lib/core/brain-client.cjs`'s
`callTool` belt, `lib/core/part8-egress-guard.cjs`'s `classify()`) is not merely the convenient
place to enforce Part 8; given the "never RECEIVE" wording, it is the only place that CAN
enforce it in the literal sense. A far-side guard, even if built, would be defence-in-depth on
top of use, not a substitute for the client-side belt.

Whether the Canon's authors meant "RECEIVE" as "arrive at the process" (favoring the
client-side-only reading above) or as "be stored and queried" (which would make a far-side
guard a legitimate, sufficient alternative) is itself a Canon-interpretation question. It is
not resolved here; it is listed in Section 4 below as flagged, not decided, and belongs to a
Canon Custodian.

---

## Section 2: The direct-HTTP ruling (D-02)

**Ruling: ACCEPT AND DOCUMENT.** The `pws-brain-mcp` direct-HTTPS registration stays as-is this
phase.

### The registration

`~/.claude.json` registers `pws-brain-mcp` at project scope:

```json
{ "type": "http", "url": "https://pws-brain-mcp.onrender.com/mcp", "headers": { "Authorization": "<redacted>" } }
```

The Authorization header value is never printed here or anywhere else this note touches.

There is no local plugin code anywhere in this path: no shim, no `brain-client.cjs`, no belt,
no `classify()` call. The model issues `mcp__pws-brain-mcp__<tool>`, the host opens an HTTPS
connection, and bytes leave the machine directly.

This registration is a per-machine operator entry in `~/.claude.json`. It is NOT shipped by the
plugin, is not tracked in this repo's git history, and a code change in this repo cannot reach
it or remove it.

### The four-path coverage table

Derived from the four-path architecture in `257-RESEARCH.md`'s "Architecture Patterns" section.

| Path | Route | In-code belt | Host hook |
|---|---|---|---|
| P1 | Claude Code CLI, `mcp__mindrian-brain__*` via the stdio shim (`bin/mindrian-brain-mcp-client.cjs` -> `brain-client.cjs::callTool`) | YES | yes |
| P2 | `mindrian-os` handlers via `brain-router.cjs` / `sensors.cjs` (`suggest_next`, orchestration) | YES | no (tool name is `suggest_next`, does not match the hook's matcher) |
| P3 | `pws-brain-mcp` direct HTTPS (this operator's own CLI config; the same path Desktop and Cowork use) | NO | yes, and possibly over-blocking (see below) |
| P4 | Theo, after the future cutover (`mcp__theo__*`) | NO | NO (tool name will not match the hook's matcher either) |

**Conclusion, stated in the exact terms a reader needs: on two of the three product surfaces
(P3/Desktop+Cowork, and P4/future-Theo), Canon Part 8 has no in-code enforcement at all today.**

### What this phase covered and what it deliberately did not

This phase (257) covers: G1 (an `egress_blocked` block on `brain_ask` no longer renders as a
plausible empty answer), G3 (`egress_disclosure` now survives `wrapDirective()` for `brain_ask`,
matching the other three tools), the record correction on the false "never touches
brain-client.cjs" parenthetical, and this pair of rulings.

This phase deliberately does NOT cover: building a far-side guard (D-01, rejected on the
principled grounds above), deprecating or rerouting the `pws-brain-mcp` direct-HTTP
registration (D-02, this section), or the G2 conflation fix (Section 3 below). **This is the
exact statement the Plan 09 Canon Custodian checkpoint reads back before the phase closes.**

### The open RCA, cited not investigated

The one hook standing at P3 carries an open, unfixed, high-severity RCA:
`.planning/debug/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md`. Its metadata:
`status: gathering`, `severity: high`, `filed: 2026-08-27`. Three `pws-brain-mcp` calls in a
real venture room (`noga-mventures`), two distinct argument strings and one different tool, were
all blocked with an identical "this may leak unknown" F.1 card; reformulating the query text did
not change the outcome. The file's own `next_action` ("open via `/gsd:debug` in
MindrianOS-Plugin") has never been performed. **This phase does NOT investigate or fix this
RCA.** Its contents beyond these facts are not read into this note.

### The deferred item

Deprecating or rerouting the direct-HTTP registration is a larger, separate phase, rejected for
257 by D-02. A future phase taking this up would need to establish two things first:

1. Whether the operator relies on the direct-HTTP path for admin-tier work the guarded stdio
   shim cannot currently do (for example `brain_write`, `text2cypher`-class operations).
2. Whether Desktop and Cowork can be pointed at a guarded path at all, given they reach the
   Brain over MCP-over-HTTP by design and have no host-hook surface of their own.

---

## Section 3: G2 flagged, not fixed (D-05)

`brain_query` conflates a Part 8 block with a transport outage. `query()` returns `null` on a
block verdict at `lib/core/brain-client.cjs:884`, before `callTool` runs, so `callTool`'s
richer `{error:'egress_blocked', ...}` sentinel never gets a chance to be built. The shim then
maps that `null` to `refusalResponse('unreachable', ...)` -- the model is told the Brain is
unreachable when in fact the boundary refused.

**`query()`'s `null`-return contract is NOT changed this phase.** Roughly 82 degradation tests
key on that contract, per the note at `lib/core/brain-client.cjs:640-643` -- this is high blast
radius work, explicitly out of scope for 257 (D-05).

A future fix would have to choose between two shapes: giving `query()` a sentinel return (the
contract change, high blast radius) or a shim-side pre-check that is disclosure-only and does
not touch `query()`'s own contract. Neither is built here.

Plan 07's invariant test in this phase deliberately PINS the current conflation so it cannot
regress silently -- the pin documents the known gap, it does not close it.

---

## Section 4: Adjacent, flagged and NOT fixed

Each item below is named with a citation. None of them is investigated or resolved by this
phase.

1. **The open RCA** on the hook over-blocking `pws-brain-mcp` unconditionally:
   `.planning/debug/part8-egress-guard-blocks-pws-brain-mcp-unconditionally.md`, `status:
   gathering`, `severity: high`, filed 2026-08-27. See Section 2 above for the fuller citation.

2. **The Canon-interpretation question** on the meaning of "RECEIVE": whether Part 8 means
   "arrive at the process" (client-side-only enforcement is structurally required) or "be
   stored and queried" (a far-side guard would be a legitimate alternative). This fully
   determines the far-side ruling in Section 1 and is a question for a Canon Custodian, not
   this phase.

3. **D-239-05-01**, at `.planning/phases/239-brain-access-surface/deferred-items.md`. Filed
   2026-07-30, status OPEN. The question: should `hatAwareRecommend()` /
   `suggestValidationSteps()` send user domain text to a methodology graph at all, or should the
   Brain-bound payload be redesigned as a generic methodology handle instead of raw domain text?
   The measured interaction this phase must note and must not resolve: ordinary, entirely
   legitimate methodology traffic classifies `ambiguous` routinely (a benign domain like
   `'general'` classifies `ambiguous`, and this phase's own research reproduced the same class
   against `brain_search` and `brain_write` payloads). This means the `ambiguous`-verdict
   `egress_disclosure` this phase's G3 fix carries through `wrapDirective()` will fire OFTEN on
   `brain_ask`, not rarely, and must read as quiet and typed, never as an alarm.

4. **The missing canonical `brain-boundary-scan` script.** `docs/MINDRIAN-CANON.md:301` requires
   every PR touching `mcp-server-brain/`, `lib/core/brain-*`, or any Brain-querying MCP tool to
   "pass the brain-boundary-scan check." No script by that exact name exists anywhere in this
   repo. The closest real implementation is `scripts/doctor.cjs`'s Class O check,
   `agentshield-all-surfaces-clean`, which delegates to `lib/core/security/agentshield-scanner.cjs
   ::scanSurface('brain_egress', ...)`, which in turn delegates byte-identical to the already
   -shipped `part8-egress-guard.classify()`. This check is reachable via `node scripts/doctor.cjs
   --acceptance`; it is NOT wired into pre-commit and is not a distinct `verify-release` section.
   A future phase should either name the doctor Class O check as the canonical implementation in
   the Canon text, or build the missing script under its own name. Neither is done here.

5. **The staleness of `mcp-server-brain/`.** It actively misleads at least three separate
   planning documents (this phase's own originating ROADMAP entry among them) into treating it
   as a live target. `257-RESEARCH.md`'s cheap suggestion -- adding a `DEPRECATED.md` inside
   `mcp-server-brain/` pointing at the real live far side -- is recorded here as a nice-to-have
   this phase did not do.

---

## Section 5: Tri-Polar effect

**Claude Code CLI.** This phase's G1/G3 fixes land on `bin/mindrian-brain-mcp-client.cjs`, the
stdio shim used by P1 (`mcp__mindrian-brain__*`). A CLI session on the shimmed path now gets an
honest, typed refusal on a block instead of a plausible-looking empty answer, and gets the
`egress_disclosure` field on `brain_ask` the same way it already gets it on the other three
tools. A CLI session using the operator's own `pws-brain-mcp` direct-HTTP registration (P3)
sees none of this -- that path has no shim to fix, only the hook, which this phase does not
touch.

**Claude Desktop.** Reaches the Brain exclusively via P3, direct HTTPS, with zero in-code belt
and zero host-hook surface (Desktop has no PreToolUse hook mechanism). Nothing in this phase
changes what a Desktop session experiences on a block; the gap documented in Section 2 is fully
live there today, unaddressed, and this phase's rulings are the honest record of that fact
rather than a fix for it.

**Cowork.** Same as Desktop: P3, direct HTTPS, zero in-code belt, no hook surface. Same
statement applies.

---

## Container decision (Claude's Discretion, exercised and stated)

`257-CONTEXT.md` leaves the container for D-01's documentation open between amending
`docs/MINDRIAN-CANON.md` Part 8 and a standalone phase doc. This plan chose a STANDALONE PHASE
DOC (this file), following the `docs/254-NOTE-*` and `docs/262-NOTE-*` precedent, and did NOT
edit `docs/MINDRIAN-CANON.md`.

Reason: amending the Canon in this repo is a machinery event, not a paragraph edit. The
existing Part 8 amendment on record (the orchestration-projection section) came with an
Appendix D entry, a header Version bump, and a `docs/CANON-PHASE-MAP.md` ledger row -- the map
shows navigator-gated amendments reserved for frozen-property additions. D-01 and D-02 are
RULINGS ABOUT ENFORCEMENT LOCUS, not doctrine changes: the `LOCAL data -> BRAIN: NO` invariant
is untouched by both. Invoking the amendment machinery here would inflate the phase and imply a
doctrine change that did not happen. This note is made discoverable instead through Plan 03's
corrected census comment and handoff correction block, both of which point at this note by
filename.
