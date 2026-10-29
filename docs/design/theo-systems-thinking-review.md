# Theo Systems-Thinking Review: Opportunity Scout Architecture

**Status:** design review of a proposed architecture, not a runtime evaluation.

## Method and evidence boundary

Theo's Systems Thinking guide v1.0.0 returned four steps: map causal loops; map stocks, flows, and delays; locate nested levels; identify leverage points. The guide identifies the source as a PWS-Book adaptation (`week 06 systems problems / FRAMEWORK`), not a live graph result. Theo's tools explicitly do not receive case details or evaluate artifacts. This review applies Theo's retrieved method to the visible architecture and repository-grounded design notes; the case material remained in the host.

Labels below distinguish **observed** tool or repository behavior from **proposed** architecture and **hypotheses** that need a pilot.

## Overall assessment

The architecture now has the right system shape: MindrianOS owns scope, permissions, local state, and execution; the ICM run gathers and prepares evidence; selected engines analyze that evidence; a framework check precedes candidate capture; and users decide what enters deeper investigation. The portfolio is an accumulating cross-room opportunity system, not a one-room report.

The critical dependency is the Theo control loop. **Observed:** the available Theo Context tools return method steps and review criteria; they do not inspect room artifacts, evaluate engine outputs, trigger another run, or persist progress. **Proposed:** the MindrianOS host holds the case context, applies Theo's criteria locally, and routes a bounded follow-up. A direct Theo artifact-review service would be a separate integration with its own approval and data boundary. Until one of those paths is implemented, “Theo monitors” describes a target role, not an available runtime capability.

## 1. Causal loops

These loops describe the proposed system; the causal links have not yet been measured in product use.

### Reinforcing loop: provenance can make the portfolio more useful

`stable source links → faster candidate review → more useful candidates retained → better cross-room context for future scans → more candidates with traceable support`

This loop only helps if later scans preserve the original source chain. Reusing an earlier model-generated summary as if it were independent evidence creates a second reinforcing loop: an unsupported claim can be repeated by more engines and look increasingly credible. Keep source claims, engine interpretations, and user decisions as different record types. Engine agreement is not source corroboration.

### Balancing loop: human review capacity limits useful accumulation

`more engine output → larger unreviewed inbox → longer review delay → more stale or low-attention candidates → less useful triage`

User triage removes items from the inbox, but review capacity is finite. More generation can increase backlog without increasing decision usefulness. The design should track inbox size, oldest candidate age, time to disposition, and deep-dive conversion, then cap or prioritize scans when review debt grows.

### Reinforcing cost loop: monitoring and reruns

`framework check finds a gap → more evidence or an engine rerun → more artifacts to inspect → more possible gaps`

This can improve coverage, or create a loop with rising cost and no stopping point. Every run needs a bounded follow-up policy: a maximum number of iterations, time/cost budget, explicit acceptance criteria, and a clear `needs-human-review` stop state. A missing criterion should generate a targeted action, not automatically restart the whole engine suite.

### Useful learning loop, not yet automatic

`user disposition + later experiment outcome → recorded reason and result → future routing or ranking changes`

The loop exists only if the system stores structured reasons and a later component actually uses them. Recording a rejection does not by itself make the engines learn. Until that feedback path is implemented and evaluated, describe the portfolio as retaining history, not learning automatically.

## 2. Stocks, flows, and delays

Keep these as separate stocks with distinct units and owners:

| Stock | Unit | Main inflow | Main outflow | System concern |
|---|---|---|---|---|
| Unprepared room material | source artifact | import or room update | prepared, excluded, or deleted | Scope and permission must remain attached. |
| Prepared evidence inventory | traceable source item/span | parse, normalization, source mapping | superseded, removed, or stale | A vector alone is not evidence; stable source references are required. |
| Candidate inbox | distinct unreviewed candidate card | monitored engine result or approved remote return | merge, deep-dive, park, reject, stale | This is the main accumulation pressure point. |
| Claims and evidence | claim-to-source relation | room source, approved research, reviewer input | superseded or stale | Keep support, contradiction, and inference visible. |
| Open assumptions and questions | unresolved item | candidate analysis or Theo check | verified, falsified, accepted as constraint, deferred | Do not silently convert unknowns into facts. |
| Human review capacity | available reviewer-hours or items per period | reviewer availability | triage and specialist assessment | Treat as a constrained capacity, not an unlimited final step. |
| Active deep dives | selected opportunity investigation | user promotes an inbox item | decision, test, pause, or close | Keep this separate from candidate volume. |
| Reusable findings | context-qualified finding with provenance and date | completed review or experiment | stale, superseded, or invalidated | Reuse only within its stated context and evidence boundary. |

The principal flow is:

`authorized scope → gather and prepare → Theo framework plan → selected engines on prepared evidence → host applies Theo's checks → bounded evidence follow-up if needed → unreviewed candidate inbox → user disposition → deep dive / test / archive`

Delays likely to govern end-to-end usefulness are source preparation, external-query approval and retrieval, engine runtime, host-side framework review, and human triage. The architecture should expose these as stage timestamps and explicit waiting states. A provider failure, missing encoder, or missing permission must not be presented as “no opportunity found.”

## 3. Nested system levels and boundaries

- **Portfolio level:** accumulates candidate opportunities across rooms and preserves relationships and decisions.
- **Scout-run level:** one bounded ICM pipeline with an immutable scope and data snapshot.
- **Evidence level:** room artifacts, derived spans, approved external sources, and provenance.
- **Capability level:** selected engine/runtime jobs that analyze the gathered evidence; each returns versioned, typed output.
- **Framework-control level:** Theo supplies the method and review criteria; the MindrianOS host applies them and decides whether a bounded next step is warranted.
- **Human decision level:** user confirms scope, approves outbound research, triages candidates, and commits to deeper work or experiments.
- **Optional remote level:** paid Sprite service runs only on explicitly approved capsules under a separate tenant and egress policy.

The boundary between Theo guidance and case evaluation is the key architectural seam. Keep private room context in MindrianOS by default. A local host can apply retrieved Theo criteria without sending case content to Theo. If the product instead requires Theo itself to inspect artifacts, specify exactly what is transmitted, under which approval, what is retained, and how users can pause, export, or delete it.

## 4. Leverage points and recommended changes

1. **Make the stage contract executable and inspectable.** For each framework step, define required inputs, expected artifacts, checks, evidence labels, failure states, and stop conditions. Preserve the selected framework/version and rationale with every run.
2. **Keep framework retrieval distinct from framework application.** Record whether Theo returned guidance, whether the host applied it, what passed or failed, and whether another step was requested. Do not report a Theo review unless the case evidence was actually checked against the criteria.
3. **Enforce the evidence boundary.** Every candidate claim should resolve to source artifacts or explicitly say it is a model hypothesis. Engine outputs must not become independent evidence merely because another engine repeats them.
4. **Bound the follow-up loop.** Add run budgets, maximum follow-up hops, clear exit criteria, and a human escalation state. More evidence is useful only while it can change the decision.
5. **Manage the portfolio as a queue.** Track candidate age and review capacity. Prioritize or pause scanning when the unreviewed inbox grows faster than people can assess it.
6. **Separate outcomes from “learning.”** Record rejection reasons and experiment outcomes now; add adaptive routing only when a defined component consumes that feedback and a pilot shows improvement.

## First system experiment

Use one authorized room snapshot and one user-defined opportunity objective. Record the baseline time and manual steps needed to reach a useful next decision. Run the proposed sequence with one framework plan, a small selected set of engines, source-linked outputs, and one capped follow-up opportunity. The MindrianOS host—not the current Theo Context service—applies the retrieved criteria locally.

Measure: whether the user completes the workflow without a developer; whether every candidate source link resolves; time from scope confirmation to user disposition; number of follow-up runs; and whether the user chooses a candidate for deep dive or test. Review false positives and missed opportunities against the original room evidence. Do not expand the scan cadence until the user can reliably review the resulting inbox.

## Diagram correction made

The earlier drawing showed engine results flowing directly into the portfolio, which bypassed the proposed Theo/framework quality check. The revised Excalidraw flow routes engine results through the monitoring/candidate-capture stage before they enter the unreviewed portfolio inbox. The diagram also marks the direct Theo supervision role as a proposed integration and distinguishes Theo's current guidance tools from the MindrianOS host's case-specific review.
