# Spike Manifest

## Idea

Use TypeSafe's Jev (a System One model: typed choice / score / noul answers with calibrated
probabilities and a confidence value, no text generation) as the ranker for MindrianOS
decisions that are made over STRUCTURE, never over room content. Candidate seats, from the
2026-09-17 Theo-relationship review: the per-section framework ledger (rank Theo's candidate
frameworks for a room section by fit, not graph degree), the eureka_critic verdict (already a
quantized-scalar + closed-enum payload), and next_gate option ordering. Explicitly NOT a seat:
the Part 8 egress guard (a remote model deciding whether bytes may leave the machine is itself
the bytes leaving the machine; classify() stays pure local by Canon Part 8 D-01).

## Requirements

- Canon Part 8 holds for every call: state carries generic methodology handles only
  (framework names, section slugs, problem-type and stage enums, quantized scalars). Zero room
  content, zero user text, zero artifact ids.
- Key lives in `~/.secrets/typesafe.env` (mode 600) as `TYPESAFE_API_KEY=`; never hardcoded,
  never printed, never committed. `MAIN.env` is globally git-ignored on this machine.
- Spike code is CJS, zero npm deps, native `fetch` (Node 22). The SDK is a real-build choice,
  not a spike dependency.
- Any future in-hook use is async and best-effort with backoff; a Jev outage can never block a
  turn (the same rule the Brain route already follows).
- Vendor speed and cost figures are unverified until a spike measures them; the spike numbers
  are the only ones quoted.
- Dependency shape (navigator ruling 2026-09-17): users never carry a Jev dependency or key.
  Finite input spaces (the section ledger: sections x problem types x stages x frameworks) are
  scored once at dev time or in Theo's re-emission and SHIPPED AS DATA. Per-user inputs that
  are already Part-8-clean (the eureka critic payload) route plugin -> Theo -> Jev with Theo
  holding the one key, the same keyless shape users already have with Theo. Jev never runs in a
  hook on a user's machine.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | jev-liveness-cost | standard | Given the key, when one systemOne call with 3 mixed questions over generic handles fires, then HTTP 200, typed answers, measured wall time and token usage; plus auth failure, validation failure, repeatability, no-match mass | VALIDATED (warm 233-305 ms, cold 731-893 ms; 507/105 tokens; drift 0.01; 401 bad key; 400 not 422 on invalid; no-match 0.95 on no-fit) | [typesafe, jev, liveness, cost, part8] |
| 002 | jev-section-framework-ranker | standard | Given a section + problem type + stage and N candidate frameworks (generic one-liners from command-registry), when one Score per candidate is asked, then the ranking tracks a hand-labeled fit set better than graph-degree order and confidence separates clear from unclear cases | PENDING | [typesafe, jev, ledger, ranking, part8] |
| 003 | jev-hook-latency-budget | standard | Given the 2000 ms hook budgets in hooks.json, when 20 calls run through an async best-effort wrapper with backoff, then p50/p95 wall time vs budget and 429/529 behavior are known | PENDING | [typesafe, jev, latency, hooks] |
| 004 | jev-eureka-critic-parity | standard | Given eureka_critic's quantized-scalar + enum payload, when Jev picks one of the 4 verdicts, then agreement rate vs criticRule on the fixture set and confidence per case are known | PENDING | [typesafe, jev, eureka, parity, part8] |
