---
id: SEED-114
title: "A human-only route for gate_answer on the CLI and Desktop (the AskUserQuestion click reaches the ledger without the model in between)"
status: seeded
filed: 2026-10-04
source: navigator ruling on CR-02 of the Phase 369 code review (369-REVIEW.md, 369-REVIEW-FIX.md option 1), 2026-10-04
promotes_to: a phase after 369.1, once the answered_via marker (option 2, a quick) has shipped and been measured
depends_on: Phase 369 (the browser's nonce-bound human-only path is the model), Phase 289 (session-scoped ledger, consume-after-checks)
---

# SEED-114: A human-only route for gate_answer

## The finding (CR-02)

An MCP `gate_answer` has no human principal. On the CLI and on Desktop the human step is the AskUserQuestion click, but the model relays the chosen option into `gate_answer`, so any MCP session can mint a gate and answer it, and the approve is attributed to the navigator through `resolveByUser` and `confirmNode`. Stateless 2026-era requests share one `no-session:<pid>` ledger key. The browser workspace (Phase 369) is the first surface with a real proof of a click: a single-use render nonce bound to the browser session that was shown the gate, a cookie and a CSRF header, refused before any write when absent.

## The ruling (2026-10-04)

Option 2 now: every `gate_answer` records `answered_via` (browser click with nonce, or MCP call relayed by the model) with honest attribution, and the decision node says which. Filed as a /gsd-quick after the 369 and 369.1 closes.

Option 1 later: this seed. A loopback route by which the card click on Claude Code or Desktop reaches the ledger without the model composing the call (candidates: the host's elicitation or AskUserQuestion result delivered to a local human-only endpoint the server opens for the session, with a nonce minted at render, the way the shell does it; or a signed answer token the host returns that the model cannot forge). The residual named in 369-SESSION-CONTRACT.md (a same-user process forging the three navigation headers inside the 60 s start window) belongs to the same design.

## What would settle it

- A RED-first test in which a model-composed `gate_answer` for a human-only gate is refused, and the card click ratifies.
- The CLI card path (289's "Normal card on CLI") kept intact; elicitation on non-Claude hosts considered.
- Canon Part 9 wording: only a human confirms a truth claim; the route is how the claim is proven, not a new policy.
