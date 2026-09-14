# Loop versus graph: the six signals

Phase 343 item 4's deliverable (CENSUS-14), named but not built by
`docs/LAYER-CONTRACT.md` section 4: the operating rule that sits under the
GRAPH rung. This document does not restate that rung's definition or its
core question; it points at them and answers the narrower question they
leave open.

## 1. The question this answers

When should `chain_resolve` compose a chain of frameworks, and when should
it just run a single one. The answer is not a preference call made in the
moment; it is six readable signals, checked before the chain is composed,
not after. Getting it wrong in either direction is expensive: a chain where
a loop would do adds coordination cost and blast radius for nothing (more
steps, more shared state, more surface for a partial failure to corrupt),
and a loop where a chain is needed means one agent silently doing work that
no independent node ever reviews.

## 2. The six signals

Each signal below states the loop answer, the graph answer, and one
MindrianOS example drawn from a real surface (never invented). They are
read in this order, matching `docs/LAYER-CONTRACT.md` section 4's own
naming order.

### Task shape

Loop: one agent runs one bounded cycle to a stopping condition and files a
single artifact. Graph: the work is a sequence or fan-out of steps over
shared state, no single step of which is the whole job. Example: one
`/mos:discover` run is a loop (Larry-led conversation, one filed Discovery
Brief); `/mos:pipeline`, `/mos:act` (best-pick, chain, swarm), and `bono`'s
governed swarm (`lib/core/bono/*`) are graphs because each composes more
than one command's worth of work into one outcome.

### Parallelism

Loop: strictly sequential, one agent, no fan-out. Graph: more than one
worker can run over the same shared state at once, or a step's output
feeds more than one downstream consumer. Example: the five-perspective
meeting fan-out at `commands/file-meeting.md:348-443`, dispatching
`agents/meeting-perspective-extractor.md` five times over the same
transcript, is a graph precisely because the five extractions happen in
parallel over one shared input.

### Tools per step

Loop: the one agent keeps the same tool grant for the whole run. Graph:
different steps carry different, narrower tool grants, because each step
does a different job and should not inherit the whole chain's reach.
Example: `agents/meeting-perspective-extractor.md` is a read-only tool
grant, no MCP, no Write, deliberately narrower than the orchestrating
command's own grant, because its one job is extraction, not filing.

### Auditable roles

Loop: the agent that did the work is also the thing that checks it, via
the artifact it files. Graph: the role that produced a step's output is a
different node from the role that reviews it. Example: `chain_run` never
lets the agent that executed a step also approve it; the gate ledger
(`gate_render` / `gate_answer`) is a separate role from every worker agent
in `agents/*.md`.

### Fault isolation

Loop: a failure is contained to the one run; it never reaches shared
state other steps depend on. Graph: a failure at one step must not
silently propagate into the next one's inputs. Example:
`lib/core/chain-executor.cjs`'s `runChain` halts the WHOLE chain at the
first material step rather than letting an unreviewed step's output flow
downstream, which is fault isolation enforced by halting, not by trusting
each step to fail safely on its own.

### Who verifies

Loop: the agent can check its own output; the filed artifact is its own
validator, gated by `stop_gate_check`. Graph: an independent reviewer node
must check the step before it runs or before its output is trusted.
Example: `chain_run` executes the `autonomous_safe` prefix and halts at
the first material step, minting a gate id instead of executing it
unattended -- the exact behaviour section 3 cites below.

## 3. The rule

A step is material exactly when it needs the independent reviewer, and the
reviewer node is the navigator at the gate. This is cited to shipped
behaviour, not asserted: `chain_run` (`lib/mcp/tools/chain.cjs`) wraps the
shipped `lib/core/chain-executor.cjs::runChain`, runs the `autonomous_safe`
prefix, and HALTS at the first material step, minting a gate id into the
shared gate ledger instead of executing it unattended -- posture is
resolved from the one shared autonomy authority in `lib/core/recipe-maps.cjs`
(`postureForCommand`, a layered joiner with a withhold-by-default posture)
and never re-derived by the chain executor itself. Resuming a halted step
runs through `gate_answer`, the one documented resume verb; the gate ledger
entry is single-use, so whichever caller consumes it first is the only one
that ever executes the step.

The corollary, in one line: true self-review means a different node, so the
reviewer is never the node that did the work. A step that is
`autonomous_safe` skips the gate because the registry already declared it
safe to self-check; a material step gets an independent reviewer by
construction, not by request.

## 4. How to read the signals together

The six signals are not a scorecard and not a sum. Any ONE of them going
graph-shaped is enough on its own when it is the who-verifies signal,
because who-verifies is the signal the material-step definition keys on
directly (section 3) -- the other five (task shape, parallelism, tools per
step, auditable roles, fault isolation) are what tell you whether a chain
is worth its own coordination cost once you are already composing one, not
what decides whether to compose one in the first place. Start with the
loop; compose a graph only when who-verifies fires, and let the other five
signals confirm the shape rather than override the decision. This document
produces no score, for the same reason `docs/COUNTER-METRIC-DOCTRINE.md`
refuses one: a single number invites exactly the optimization the rule
exists to catch, a value maximized in isolation and disconnected from what
it was meant to represent.

## 5. Grounding and assumptions

Grounded via a real langtalks-graph-expert tool call (`relationship_path`),
recorded in
`.planning/phases/343-the-room-graph-audit-node-and-the-counter-metric-rule-graph-/343-LANGTALKS-CONSULT.md`
row "counter-metric -> loop-vs-graph signals": 2 hops via Graph engineering
(`compares_to` Loop versus graph signals). Confidence: EXTRACTED. The
row's own implication: the six signals and the counter-metric are siblings
under graph engineering, and the help family map (this plan) documents
both.

ASSUMPTION (dated 2026-09-14): every row in that consult, including the one
grounding this document, is a real tool call made AFTER the graph-engineering
note ingest (quick 260914-hqq) landed in the langtalks corpus the same day.
Before that ingest, "graph engineering" as its own indexed concept was not
in the corpus at all. This document's grounding therefore rests on one
freshly-ingested note, not on a broader graph-engineering literature
extraction; a future, wider extraction may sharpen or revise the six
signals as written here, and until it lands this is carried as a named
assumption, not treated as settled corpus consensus.
