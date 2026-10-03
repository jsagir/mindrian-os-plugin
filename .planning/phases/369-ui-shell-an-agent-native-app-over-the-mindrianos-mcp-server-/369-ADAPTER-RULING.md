# 369 Adapter Ruling: A1 (how the Claude adapter receives selected context and returns a proposal)

Phase 369, plan 14, D-14. Recorded 2026-10-03.

## The question (Assumption A1)

RESEARCH Assumption A1 (LOW confidence): spawning `claude -p` from the shell server, on the user's own machine, under the user's own Claude Code login, had not been checked against Anthropic's commercial terms. The 2026-09-20 localhost-workspace review (line 87) asks for exactly that check. SEED-067 forbids a second model key and any subscription passthrough. The adapter never writes the room and never approves anything in either option; a gate is always minted on the person's own browser session.

## The two options put to the navigator

| Option id | In plain words | For | Against |
|-----------|----------------|-----|---------|
| `headless-claude` | The shell runs one bounded, non-interactive, read-only `claude -p` call on the person's behalf. | Selected node reaches Claude in one hop; cleanest D-14 proof. | Needs the commercial-terms check to come back clean; every call spends the person's own usage. |
| `room-proposal` (recommended) | No spawn. The person asks Larry in their own Claude Code; Larry files a proposed claim with `claim_write`; the shell's change feed shows it; the shell raises the gate on the browser session. | No terms question at all; no second process, no second key. | The selected context reaches Claude by the person pasting one reference line the shell shows; weaker on the bake-off's "selected state reaches Claude" measure. |

## The ruling

- **Asked via:** AskUserQuestion, navigator, 2026-10-03.
- **Reply, verbatim:** `room-proposal (Recommended)`
- **Chosen option:** `room-proposal`.

## What this fixes

1. The shell never spawns `claude` (or any child process) for the adapter. No `headless-claude` code, no fake binary, no `--allowedTools` argv exist in this plan; `buildArgv` and `headlessClaudeProposalSource` are NOT built. If the navigator later wants the headless path, that is a new ruling and a new plan, after the terms check is actually done.
2. Proposals arrive through the room. The adapter module `ui/shared/src/claude-adapter.ts` exports `roomProposalSource({ pool })` and `copyReference(selectedNodeId, question)`. It reads only, through the adapter's OWN MCP session (`pool.adapterCall`, never the human's session), and maps the newest proposed claim about the selected node to a `Proposal`.
3. The adapter never writes: no write tool name appears in the module (static arm in the test), and it never mints, renders or answers a gate. Only a human-originated call answers a gate (D-15, plan 21).
4. How the shell finds "the proposal about this node": the reference line from `copyReference` tells Larry to name the node id in the claim text it files; the adapter lists proposed claims whose text mentions that id (`claim_read` with `query`), takes the newest, reads it by id, and reads its outbound provenance through `graph_query`.
5. The recommendation is derived from the room's own record, not from a model: a claim whose standing is `located_source` or `source_edge` recommends `approve`; any other standing recommends `hold` (needs evidence). Verdict options are always approve, hold, reject.

## F7 note

The registerCapability kernel is absent from `lib/` (searched 2026-10-02) and Phases 212/213 are not live ROADMAP cards. The adapter is registered through the existing action layer as the agent-exposed `proposeDecision` action (plan 32). The F7 todo (`.planning/todos/pending/2026-07-08-f7-rescope-212-213-against-registercapability.md`) remains unresolved; this plan does not hand-build around it and does not move the todo.

## SEED-067 note

No second model key. No subscription passthrough. No agent-native model loop (an agent running a model loop inside the shell needs its own separate navigator ruling, D-14). Under `room-proposal` the only model in the loop is the person's own Claude Code session, which they started themselves.

## Note on "filed by larry"

The plan wording said the adapter reads claims "filed with created_by larry". `claim_write` stamps `created_by = 'system'` on every claim it files (`lib/core/navigation/typed-claim.cjs`), and `claim_read` does not return the field, so the filer cannot be read back and is not used as a filter. The adapter's filter is: type claim, `review_status` proposed (a confirmed or rejected claim is a decision already made, not a proposal), text mentions the selected node id, and not the selected node itself.
