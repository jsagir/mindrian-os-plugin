# 298 Advisor: what the navigator sees when Larry asks to remember (F.8 governance basket at turn close)

Tier: minimal_decisive. Read-only research; no code edited.

| Option | Pros | Cons | Complexity | Recommendation |
|--------|------|------|------------|----------------|
| **A. Ship the 189-02 basket as-is: handle-only rows, 0.70 pre-check, silent close** (label = `candidate_id`, `lib/core/memory/governance-candidate-raiser.cjs:8-18`; pre-check display-only at `PRE_CHECK_THRESHOLD = 0.70`, `lib/hmi/shape-f8-renderer.cjs:42-44, 95-103`; `footer: null`, renderer.cjs:122; "never narrated", spec section 10 line 196) | Zero new code, every scalar frozen and tested, Part 12 silence already declared, no body can leak on any rung | Navigator cannot govern a claim they cannot read (Part 9 role 4, Canon line 344); the raiser's "Part 8: no body renders" (raiser.cjs:18) misreads Part 8, which fences Brain egress, while the card renders locally with zero Brain tokens (`lib/mcp/gate-render.cjs:39, 346-377`); D4 acceptance (298-SPEC line 85) would pass on a card nobody can act on | 0 files -- Risk: blind toggles, basket becomes a rubber stamp | Not recommended |
| **B. Readable rows on the superset card, same 0.70 pre-check, same silence** (label = claim `text` truncated; `description` = `knowledge_type -> target_section, conf 0.xx, from <source_path>`; folded onto the F.8 envelope via `superset_options`, gate-render.cjs:64-91, 355-361; pre-check unchanged, reading `n.confidence`, `lib/core/navigation/governance.cjs:15-18, 55`; Larry says nothing after confirm, post-confirm re-enters `decide()` so the next line is a next-move offer, SEED-040 line 33) | Navigator reads what they confirm; DIKW kind comes free from `KNOWLEDGE_TYPES` in props (`lib/core/navigation/typed-claim.cjs:53-55`) and maps to `epistemic_type` at write (typed-claim.cjs:72-79); section comes from the raiser's `target_section` fill (raiser.cjs:42-56); no new scalar, shape, or edge; the black-square gate glyph on the card turn is Larry's only mark | Elicitation rung is label-only (gate-render.cjs:9-17) so the label must carry the claim text; `MAX_TOGGLE_N = 4` pages past four candidates (renderer.cjs:37-40, 88-93); "source turn" is not a column (only `source_path` is selected, governance.cjs:55), so show section path, not a turn number | 2 files + tests (`governance.cjs` SELECT adds `n.properties`; raiser maps text/kind/section into label + description) -- Risk: truncation length, elicitation degradation, Part 8 review that the card never enters a `brain_*` call | **Recommended** |

**Rationale:** Pre-check at 0.70 and the silent close are already decided by shipped code and by D4's own text, so the only live choice is whether the row is readable; a handle-only row defeats Part 9's reason for the gate, since a human confirming a truth claim must see the claim, its DIKW kind, and where it files. Option B gets there through the superset card's existing `description` field with no new shape, scalar, or edge, and keeps Larry silent afterward because the F.8 card plus the `decide()` next-move offer is the navigator's surface, exactly as SEED-040 frames it.

## Decisions this settles (a / b / c)

- (a) Row fields: claim text as label; description carries DIKW `knowledge_type`, `target_section`, confidence, and `source_path`. No turn number (not a column).
- (b) Pre-check: confidence >= 0.70, display-only, already shipped; no new scalar.
- (c) Larry stays silent after confirm; the card is the surface, then `decide()` offers the next move.

## Files read (under /home/jsagi/dev/MindrianOS-Plugin/)

- `lib/mcp/gate-render.cjs` lines 1-120, 280-483
- `lib/hmi/shape-f8-renderer.cjs` lines 36-150
- `lib/core/memory/governance-candidate-raiser.cjs` lines 1-30, grep 32-110
- `lib/core/memory/governance-candidate.cjs` grep 16-89
- `lib/core/navigation/governance.cjs` lines 1-77
- `lib/core/navigation/typed-claim.cjs` lines 45-90
- `lib/core/navigation/edges.cjs` lines 625-680
- `lib/core/node-insert.cjs` lines 100-124
- `.planning/seeds/SEED-040-hitl-memory-governance.md` (full)
- `docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md` lines 180-205
- `.planning/phases/298-*/298-SPEC.md` lines 50-62, 80-90
- `docs/MINDRIAN-CANON.md` lines 344, 350, 717, 742 (grep)
