# Subagent Dispatch Grants

One page. Request, review, record, enforce. Source of truth: `data/subagent-dispatch-grants.json`.

## 1. What the token buys

`allowed-tools` is a **pre-approval** list, not a restriction list. Listing `Task` or `Agent`
in a command's `allowed-tools` frontmatter removes the per-spawn permission prompt for
dispatching subagents during the invoking turn; the grant clears on the next user message. It
does not add a capability the command lacked -- Claude Code already lets any turn spawn
subagents through the normal permission flow -- it only removes the prompt. Per the phase
research's Security Domain ASVS V4 row, this is still a genuine access-control change and must
be treated as a reviewed privilege grant, not a convenience edit.

## 2. The two spellings

`commands/deep-grade.md` declares `Agent`. Every Phase 265 grant declares `Task`. Both names
resolve to the same pre-approval mechanism in Claude Code's frontmatter contract; the tripwire
(section 4) enforces both identically, so a command cannot dodge review by picking the other
spelling. Reconciling the two spellings to one is deliberately NOT done here -- that is a
separate change with its own blast radius across every command that carries either token. It is
named as a capability-ledger candidate; plan 265-23 owns the ledger rows that will track it, not
this plan.

## 3. How to get a grant

Four steps. Steps 3 and 4 deliberately land in DIFFERENT plans so several fan-out plans can ship
in the same wave without contending for this one file.

1. State the dispatch shape (what one subagent does) and the fan bound (the resolver or literal
   cap that limits how many run at once).
2. Get the navigator's review.
3. Add a row to `data/subagent-dispatch-grants.json` with `status: "pending"`.
4. The plan that ships the actual dispatch instructions adds ONLY the `allowed-tools` entry (plus
   its adjacent comment containing the substring `pre-approval`) to the command file. A single
   later ratification plan then flips every built row's `status` to `"granted"` in one write.

A row that is `pending` while its command file already declares the token is reported as
`unratified` by the tripwire. That is the expected mid-phase state between a fan-out plan
shipping and the ratification plan running -- it is a hard failure only when the phase gate sets
`TEST_265_GRANTS_STRICT=1`.

## 4. How it is enforced

`tests/test-265-swarm-task-grant.cjs` reads the registry and runs three arms: no command
declares `Task` or `Agent` without a matching registry row (no silent widening); a `granted`
row's command must actually declare the token, and `TEST_265_GRANTS_STRICT=1` (the phase gate's
setting) fails a built-but-`unratified` grant; and every row carries all nine required keys,
including a `reviewed_by` that names an actual person rather than an agent identity.

One thing the registry deliberately does NOT do: it does not bound runtime concurrency. The
platform-wide cap of 20 concurrent subagents (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`) and each
command's own `fan_bound` (`planDispatch`, `resolveFanoutCap` / `FUTURES_FANOUT_CAP`, or a
literal number) do that. The registry governs who may dispatch at all, not how many run at once.
