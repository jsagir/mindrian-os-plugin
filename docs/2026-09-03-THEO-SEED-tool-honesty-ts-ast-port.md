# Theo SEED: tool-honesty coordination surface, measured, plus the TS-AST port recommendation

Filed from MindrianOS-Plugin phase 276 (`276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs`),
plan 276-13. This is a coordination artifact in THIS repo, not a write to `/home/jsagi/Theo`.
Theo D-04 governs: coordinated, never executed cross-repo. Whoever works in the Theo checkout
carries this into that repo's own `/gsd-capture`, run from that repo. Nothing under
`/home/jsagi/Theo` was created, edited, or deleted producing this document; `git -C /home/jsagi/Theo
status --porcelain` was asserted unchanged before and after every read in this plan.

Measured against Theo checkout HEAD `dfb44b2` (full: `dfb44b297b790b6b807b566d82f7d2389eb1da42`).
The research document that first scoped this coordination surface pinned `83a1ce2`; Theo moved
past that pin between plan 276-04 (which measured at `83a1ce2` exactly) and this plan running.
That is expected news for an actively developed repo, not a failure (RESEARCH assumption A14) --
it is named here rather than silently re-used from a stale document.

## Section 1: the owed mirror task (actionable, do this first)

Theo's `GATE_RENDER_DESCRIPTION` at `src/mcp/operational/gate-render.ts:89-93` should adopt the
plugin's corrected final sentence, quoted verbatim from `lib/mcp/tools/gate.cjs` as landed by plan
276-11 (commit `02468fcb`):

> "Returns a gate_id minted into this server process's in-memory ledger, which gate_answer must
> reference to ratify; nothing is persisted and the id does not survive a restart."

The full plugin description this sentence sits inside, also quoted verbatim, so the mirror is a
whole-constant replacement rather than a partial patch:

> "Render the Mindrian gate superset card (options + per-option descriptions + ranks + previews +
> single/multi-select) via the capability-detected 3-rung renderer ladder: MCP elicitation, Claude
> Code AskUserQuestion thin adapter, or headless structured text. Returns a gate_id minted into this
> server process's in-memory ledger, which gate_answer must reference to ratify; nothing is
> persisted and the id does not survive a restart."

Measured live in this plan: `GATE_RENDER_DESCRIPTION` [gate_render] DIFFERS at offset 266 (plugin
429 bytes / theo 323 bytes). Theo's copy still carries the pre-276-11 text ("Returns a minted
gate_id that gate_answer must reference to ratify.") -- it has not moved since plan 276-11 measured
the same 266/429/323 shape.

The reason, in one line: an in-memory gate-ledger mint is not persistence, and "minted" alone reads
as durable to any caller. D-276-3 is the authority for the fix shape (a description correction, not
widening `STRONG_VERBS` to catch the inflection `minted`) and D-276-6 is the authority for the
Theo-side handling (of the findings, only `gate_render` lands on a Theo-absorbed tool; the
five-constant byte-diff is a skip-when-absent, non-blocking coordination signal, never a gate).

This is COORDINATED, not executed from this repo. Theo D-04 governs cross-repo changes the same
way D-276-6 governs this repo's obligation: name the exact change, name the exact site, and stop.
The plugin cannot and must not push this change into `/home/jsagi/Theo` -- doing so would violate
the read-only boundary this plan operated under end to end (`git -C /home/jsagi/Theo status
--porcelain` confirmed byte-identical before and after every task in this plan).

## Section 2: the pre-existing divergences, measured rather than assumed

Two constants were flagged as possibly pre-existing divergences by earlier research. Measured
fresh in this plan (Task 1, against Theo HEAD `dfb44b2`), one is real and one has resolved itself
since the research was written. Both are reported here rather than left undiscovered, per this
plan's own must-have truths.

### `gate_answer`: DIFFERS, PRE-EXISTING, confirmed by an independent zero-count grep

Measured: `GATE_ANSWER_DESCRIPTION` [gate_answer] DIFFERS at offset 585 (plugin 1462 bytes / theo
1152 bytes). This is unchanged from plan 276-04's original measurement at Theo `83a1ce2` and plan
276-11's re-measurement after its own unrelated fixes -- the number has not moved across three
separate measurement points spanning a Theo HEAD advance, which is itself evidence the divergence
is real and stable, not measurement noise.

Independently confirmed cause (not inherited from research): `grep -c "SOURCED_FROM\|USES_FRAMEWORK"
/home/jsagi/Theo/src/mcp/operational/gate-answer.ts` returns `0`. The plugin's description gained a
clause naming the `SOURCED_FROM` and `USES_FRAMEWORK` provenance-edge writes in commit `2c8dfddf`
(quick 260903-i2x, the T2 node-writing half, this same session) -- the exact text: "An approve
verdict ALSO writes a typed decision node with SOURCED_FROM provenance edges to the card's
subject/evidence node ids, plus a USES_FRAMEWORK edge when the gate came from a chain halt with an
active framework; the node is promoted to confirmed via navigation.confirmNode, recording the human
APPROVE." Theo's copy at `src/mcp/operational/gate-answer.ts:105-119` predates that commit and has
no trace of either edge-type name.

The useful thing stated plainly: Theo's catalog currently UNDER-describes what `gate_answer`
actually does after the flip. That is the benign direction -- Theo's description is not claiming
something the code no longer does, it is silent about something the code now additionally does --
but it is still a description-versus-behavior gap, and it proves the drift channel identified in
Section 3 is live rather than theoretical. This divergence is NOT registered as a mirror task by
this plan; it is reported per the plan's own scope (report, don't execute a second mirror beyond
the one `gate_render` task named in Section 1), and is available for whichever later coordination
pass wants to pick it up.

### `chain_run`: measured IDENTICAL today, correcting an earlier research claim

`276-RESEARCH.md` originally claimed `chain_run` had diverged (1113 plugin bytes against 1006 Theo
bytes). Plan 276-04 measured this claim directly and found it false at the time (1113 bytes both
sides, zero divergence), a correction to the research document rather than a silent
reconciliation. This plan's own fresh measurement against Theo HEAD `dfb44b2` confirms the
correction still holds: `CHAIN_RUN_DESCRIPTION` [chain_run] IDENTICAL (1113 bytes both sides).
Reported here as reality rather than the plan's own stated expectation (which, following the
research's uncorrected prose, predicted a DIFFERS row) -- the measured shape wins over the assumed
one, per this plan's own governing rule.

No `EXTRACTION_FAILED` row occurred in this run; both `dist/` and the extraction primitive resolved
cleanly for all five constants (theo source: `dist (dist/mcp/operational/*.js)` for every row).

## Section 3: the methodology port, a SEED for Theo's own `/gsd-capture`

**A direct run of `scripts/check-tool-honesty.cjs` against Theo scans zero tools and reports OK.**
That is a false success inside a false-success detector, and it is the single most important
sentence in this document. Anyone tempted to point the plugin's own checker at the Theo checkout
as a shortcut needs to read this warning before doing that, because the checker would silently
report a clean bill of health while examining zero tools, not a real absence of findings.

Navigator-approved framing: this is a SEED to be filed via Theo's own `/gsd-capture`, from that
repo, by whoever works there -- before Theo's plan `09-12` authorizes the Brain-contract flip.
Theo's `09-MOS-LEARNING.md` already rules the flip NOT READY on content grounds independent of
this SEED; this SEED is about detector coverage on the code side, a separate and parallel
readiness question.

### Three structural mismatches, each with the plugin-side file and current line

**Discovery.** `findServerToolCalls` (`scripts/check-tool-honesty.cjs:557-569`) matches
`/server\.tool\s*\(/g`, and `scanAll` (`:1412` onward, the four-way destructure at `:1437`,
`const [nameArg, descArg, schemaArg, handlerArg] = args;`) reads exactly four POSITIONAL
arguments. Theo's shape is `registerContentTool(server, { name, description, inputSchema }, cb)`
at 23 call sites under `src/mcp/content/*.ts`, plus `registerOperationalTool` at 5 call sites
under `src/mcp/operational/*.ts` -- confirmed by a live count in this plan, not inherited: 23 + 5
= 28. Theo's real tool count is 28, not "roughly 27" or "roughly 34" (34 is `mindrian-os`'s own
current operational-tool count, a different number entirely). A config-object key lookup is
needed at the discovery stage, not a path change -- the four-positional-argument assumption is
load-bearing throughout `scanAll` and would need to become a name/description/inputSchema lookup
on the second positional argument's object literal instead.

**Language.** `maskNonCode` (`scripts/check-tool-honesty.cjs:249` onward) handles JS strings,
comments, and regex literals, and knows nothing of TypeScript type annotations, generics such as
`registerContentTool<OutputArgs, InputArgs>`, or `as const`. Confirmed live against
`src/mcp/register-content-tool.ts:135`: `export function registerContentTool<OutputArgs extends
ZodRawShapeCompat | AnySchema = ZodRawShapeCompat,>(...)` is exactly this generic shape. Angle
brackets are not in `scanBalanced`'s pair map (`scripts/check-tool-honesty.cjs:306`: `{ '(': ')',
'{': '}', '[': ']' }`, no `<`/`>` entry), so a generic call site would confuse the forward
balanced-bracket scanner the moment a type parameter list appears before the argument list.

**Write-primitive vocabulary, the most consequential.** `resolveWritePrimitives`
(`scripts/check-tool-honesty.cjs:449-488`) derives its names by `require()`-ing three CJS modules
(`lib/core/navigation.cjs`, `lib/core/navigation/edges.cjs`, `lib/core/node-insert.cjs`) and
reading `Object.keys(mod)` off each, which structurally cannot work against TypeScript sources --
there is no `require()`-able CJS module on Theo's side exporting the write primitives to
enumerate. Compounding this: Theo's writes go through `src/mcp/operational/delegate.ts` to the
plugin's own handlers AT CALL TIME rather than through a local `navigation.cjs`-equivalent, so the
whole depth-1 reachability model this stage builds would need rebuilding around the delegation
boundary rather than around a local write-primitive name list.

### The recommendation: port the METHODOLOGY, not the script

Name what transfers, because it is real and worth carrying across: the six-stage architecture
(mask, balance, discover, split branches, classify claim tier, resolve reachability), the
claim-tier vocabulary with its negation-window and hyphenated-token guards (the exact guards that
turned "rooms-archive" from a false HIGH RISK into a correct OK, and "nothing is persisted" into a
correct global cancellation), the `ALLOWED_UNVERIFIED` discipline (never-suppressible for
MEDIUM/UNKNOWN, D-276-2), and above all the fix-the-detector-never-allowlist rule that took this
phase's own first sweep from 10 findings to a corrected 24 (`276-06-SUMMARY.md`: 36/130 tools and
branches unchanged both before and after, HIGH_RISK 1 to 5, MEDIUM 8 to 18, UNKNOWN 1 to 1, total
non-OK 10 to 24) by fixing a dead `switch (command)` branch splitter rather than by widening a
suppression list.

Recommend `ts.createSourceFile` -- TypeScript's own compiler API, producing a real AST -- which
removes stages A through C entirely (no hand-rolled `maskNonCode`/`scanBalanced`/
`splitTopLevelArgs` forward scanner is needed once a real parser is available) and would make
Theo's version SHORTER than the plugin's, not longer, despite covering a strictly harder language
surface (generics, type annotations, `as const`).

### The cautionary case: this phase's own detector already lived this failure once

The plugin's own detector shipped with a dead switch-branch parser for exactly the reason a
regex-over-source approach is failure-prone: `splitBranches` ran `/\bcase\s+/` over text where
string literals had already been masked to spaces, so `\s+` silently swallowed every case value
and rejected every branch label, and the bug went unnoticed through several live sweeps until this
phase's own research measured it directly (D-1, `276-06-SUMMARY.md`). The measured before-and-after
is the concrete proof a regex-over-source detector can silently stop detecting while continuing to
report a clean, plausible-looking result: 10 findings before the fix, 24 findings after, with tool
and branch discovery totals (36 tools, 130 branches) completely unchanged across the fix -- proving
the fix changed classification accuracy, not discovery coverage, which is precisely the shape of a
detector that was silently under-scanning its own input the whole time. A TypeScript AST removes
the entire class of bug D-1 represents, because there is no hand-rolled scanner left to have a bug
in.

Theo's own precedent for the identical shape, cited so the Theo-side reader recognizes the class:
its own chokepoint-audit rule 5 "reported green over a live violation of the invariant it exists to
protect" (Theo `05-REVIEW CR-01`), and `delegate.ts` independently names "a FALSE FAILURE, the
mirror image of the false-success class this project tracks." Theo already has the vocabulary for
this disease under its own name; it has zero mention of `check-tool-honesty` anywhere in its own
repo today.

## Section 4: cross-links

- Phase directory (this repo): `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/`
- Theo cross-check research: `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-RESEARCH.md`, section "Theo Cross-Check" (subsections B1, B1a, B1b, B2, B3)
- The standing signal: `tests/test-276-theo-description-parity.cjs`, non-blocking by design, skips loudly and exits 0 when the Theo checkout is absent (Theo D-04: coordinated, not executed cross-repo). Run `node tests/test-276-theo-description-parity.cjs --strict` to make the same signal exit non-zero for local, deliberate use -- nothing wires `--strict` by default, and nothing should, per T-276-14's disposition.
- The decision ledger: `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-DECISIONS.md`, entries D-276-3 and D-276-6.
- Prior measurement plans: `276-04-SUMMARY.md` (first Theo parity measurement, pinned to `83a1ce2`), `276-11-SUMMARY.md` (the `gate_render` fix that opened the DIFFERS this document's Section 1 reports, and the Theo mirror-task registration this document fulfills).

---
*Filed by phase 276 plan 276-13. Coordination artifact only; nothing under `/home/jsagi/Theo` was written.*
