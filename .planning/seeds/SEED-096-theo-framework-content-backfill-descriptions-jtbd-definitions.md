---
id: SEED-096
status: dormant
planted: 2026-09-17
planted_during: quick tasks after Phase 349 (Jev spikes 001-004)
trigger_when: next Theo content phase, or before SEED-095 (section framework ledger) is planned
scope: large
---

# SEED-096: Theo framework content backfill - descriptions, JTBD anchors and definitions on the canonical Framework nodes

## Why This Matters

Measured 2026-09-17 through the governed client: of 410 canonical Framework nodes in
Theo (452 minus aliases and explicit non-canonicals), 305 carry a stub or empty
`description` ("PWS methodology framework: X" or nothing), 280 lack a `jtbd_anchor`,
and 400 lack a `definition`. Mullins, S-Curve, PEST and Root Cause are among the stubs.
The mentor report asked to "fill how_use and common_mistakes on TRIZ, SAPPhIRE and
analogy"; it is a 305-node problem, not three.

Every consumer that ranks or explains frameworks (the section ledger, `brain_ask`
grounding rows, `recommend_chain`, Larry's own framework delivery) is bounded by this.
Spike 002 was weak exactly on the sections whose right frameworks are stubs.

## When to Surface

**Trigger:** the next Theo content phase, or before SEED-095 is planned. This is Theo-side
work (repo `~/Theo`, its own GSD); the plugin's part is the parity check that the
backfilled fields reach the plugin's contract.

## Scope Estimate

**Large**: a content pipeline (source the descriptions from the book chapters and
methodology chunks Theo already holds; assign `jtbd_anchor` from the closed job
vocabulary; write one-line `definition` per framework), a review gate (human-confirmed
per Canon Part 9), and a regression census (stub share reported by `theo_health` or a
CI probe so it cannot silently regrow).

## Breadcrumbs

- `.planning/spikes/002-jev-section-framework-ranker/theo-frameworks.json` (the pulled working set with `stub`, `jtbd_anchor`, `definition` flags; Brain content, dev repo only)
- `.planning/spikes/002-jev-section-framework-ranker/README.md` (field-presence counts, alias findings)
- `lib/core/brain-client.cjs` `SHIPPED_JOBS` (the closed job vocabulary `jtbd_anchor` draws from)
- Theo: `~/Theo/src/mcp/content/` (tool registrations), `.theo-graph/` (emission)
- Rooms: `~/MindrianRooms/rethinking-mindrianos/research/2026-09-17-jev-typesafe-spikes-001-004-findings.md`

## Notes

Also found during the pull: `jtbd_anchor` is a job id, not a sentence; "Mullins Model" is
not canonical under that name (alias "John Mullins Framework"); Theo's read allow-list
rejects `Skip`, `Distinct`, `NodeUniqueIndexSeekByRange`, and ROW_CAP=100 returns zero rows
with a message claiming 100. The last item is a Theo contract bug worth its own fix.
