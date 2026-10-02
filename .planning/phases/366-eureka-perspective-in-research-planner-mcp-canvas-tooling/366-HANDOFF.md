---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
artifact: phase handoff (what shipped, rulings, follow-ons, the Theo-side request)
written_by: 366-24 Task 3
date: 2026-10-02
---

# Phase 366 handoff: Eureka as a perspective of the research planner, MCP canvas tooling

Research trail: `.planning/research/2026-10-02-eureka-366-spike-and-close-out.md` (this repo),
`~/MindrianRooms/rethinking-mindrianos/research/2026-10-02-eureka-366-spike-and-close-out.md` and
`~/MindrianOS/research/2026-10-02-eureka-366-spike-and-close-out.md` (byte-identical copies; each
links back to this file). It follows `2026-10-01-eureka-rethink-perspective-and-mcp-canvas.md`.

Phase 366 is closed on `main`. It is NOT live for any user until `scripts/release.sh` cuts a version
and users update, and the next cut will refuse at RULE 5 place 9 until the canon snapshot is stamped
(see follow-on F1).

## In one paragraph

Eureka stopped being an engine. `/mos:eureka` is now the quick-run door of the research planner's
Eureka perspective, one of six perspectives (eureka, rs, hsi, whitespace, analogies, connections)
that share one interface, one substrate, one offline recall contract and one filer. The standalone
runner is deleted. Things in a room get a canon framework handle as a real graph edge, a room word
that does not resolve can be released to Theo one term at a time on the navigator's yes, every
egress is a declared line, and the shared search machinery moved to `lib/core/semantic-index/`. A
pre-registered spike found no new recall or judge arm that beats the old engines, so nothing was
adopted and the old RS and HSI engines stay live.

## What shipped, per decision

| Decision | What shipped | Plans |
|---|---|---|
| D-01 | `/mos:eureka` keeps the name; the door is `[run\|enable]` on the perspective path. | 366-03, 366-22 |
| D-02 | Alias first (366-03), then the navigator ruled `runner: retire`; the runner files are deleted, every runner test migrated or retired with a reason, and the MCP `eureka-run/status/report` names answer a pointer only. | 366-03, 366-20, 366-21, 366-25, 366-26, 366-27, 366-22 |
| D-03 | The ambient Eureka producer is the perspective's own read-only recall and only offers a plan-only card (no judge, no stamp, no fetch, no filing). | 366-07 |
| D-04 | One filer: a supported pair files a `cross_domain_transfer` candidate through the planner's `filing-stamped.cjs` with DERIVED_FROM to both things and the 355 stamp. | 366-02 |
| D-05 | The spike: bar committed first, indexed fixture copies, all arms run, the navigator's blind gold (14 items), a record that recomputes byte for byte, six rulings. | 366-01, 366-18, 366-19, 366-20 |
| D-06 | All five perspectives on the same shape (templates and lenses, one interface and registry, RS/HSI/whitespace/analogies/connections modules); the reference-only router stubs point at `perspective_recall`. | 366-04, 366-08, 366-13, 366-14, 366-15, 366-16 |
| D-07 | `research_run` ops `perspective_recall/candidates/judge` with a `perspective` enum; `eureka_*` ops are deprecated aliases; CLI `perspective-recall/judge`; tool count 45. | 366-12 |
| D-08 | RS and HSI re-derived from the local graph (no embeddings) with a graph direction variant; the spike re-measured them; `rs-engine` / `hsi-engine` stay live by ruling. | 366-13, 366-20 |
| D-09 | Analogies (SAPPhIRE filled at the statement stage) and connections (the Theo lateral path as an audited, granted planner lane, never in recall); all six recalls proven offline. | 366-14, 366-15, 366-16 |
| D-10 | A thing gets its canon handle at birth (`artifact_file`, the indexer) through one resolver, plus the doctor backfill. | 366-05, 366-09, 366-10 |
| D-11 | Graph-native handle: a `framework:<slug>` node minted before every `USES_FRAMEWORK` edge, through the navigation chokepoint. | 366-05, 366-09 |
| D-12 | Canon coverage counts in the integrity organ, reported by doctor, named in SENS-19's `watched_by`, outside its firing sum. | 366-10 |
| D-13 | Gated, intent-led per-term release: the Part 8 guard `navigator_released` arm, the release card and single-use gate, the closed audit row, one approved live round trip (a miss). Part (c), the intent-led resolver, is NOT built: it is filed below as the Theo-side request. | 366-11 (MCP route: quick 261002-cud), 366-24 |
| D-14 | `<room>/references/canon-translations.md`: ratified-only, path-contained, read after the exact checks; proposed rows wait for the navigator. | 366-05, 366-11 |
| D-15 | A side with no handle stamps `unverified / not_called / handle_unresolved` with Theo asked zero times, and the F.8 card offers the release. | 366-05, 366-11 |
| D-16 | `/mos:doctor --fix` `canon-backfill` walks every registered room, idempotent, counts per room. | 366-10 |
| D-17 | Delivered as the LAGGING release gate (RULE 5 place 9: `release.sh` refuses a cut when `data/framework-names.json`'s Theo stamp lags) plus the documented refresh command `node scripts/refresh-framework-names.cjs --live`, per navigator ruling 2026-10-01. The leading edge (calling that command automatically after Theo's re-emit) is NOT wired; it is follow-on F2. | 366-06 |

Also shipped without its own decision number: the phase aggregator `tests/run-all-366.sh` and its
release suite gate (366-01, 366-06), the declared egress policy `data/egress-policy.json` with
`--offline` (366-17, Claude's Discretion defaults kept by the rulings), the semantic-index split
behind a reference-integrity gate (366-23, ADR-E12), and the folded todos (366-24).

## The spike record, in short

Bar (committed before any arm ran): adopt an arm only if its Wilson 95% lower bound exceeds 0.448 on
each of 3 repeats. 0.448 is the RS/HSI engine-output baseline from Phase 355 (43 of 96), not a
Eureka baseline (Eureka was `substrate_unavailable` on the bare fixtures).

| Arm | Useful / shown (each repeat) | Wilson 95% | Clears |
|---|---|---|---|
| eureka-graph-lexical | 3 / 7 | [0.158, 0.750] | no |
| hsi-graph | 4 / 7 (the HSI slice is 27 / 47 = 0.575) | [0.251, 0.842] | no |
| rs-graph | 0 shown (the RS slice is 16 / 49 = 0.327) | none | no |
| eureka-graph-lexical-vector | 96 shown, unlabeled | UNMEASURED by ruling | no |

Judges: stage-a passes all 7; jev passed 0, 1, 0 across repeats; claude passed the same single pair
each repeat (useful, already known); claude-then-jev passed 0. None clears. Direction (hsi-graph):
right on 5 of 7. Label consistency: 6 of 7. Floor rows stay `disclosed` with the reason recorded.

## Navigator rulings (366-SPIKE-RULINGS.md, 2026-10-02, verbatim answer "Accept all six (Recommended)")

`judge: stage-a`, `recall: graph-lexical` (vector OFF), `engines: keep`, `runner: retire`,
`jev-runtime: dev-time`, `haiku: separate-producer`. No egress default changed, so
`data/egress-policy.json` was not touched at close.

## The Theo-side request (D-13 c)

Filed as `.planning/todos/pending/2026-10-01-theo-intent-led-canon-resolver.md`. In short: Theo should
expose a resolver (a new tool, or a widened `normalize_framework_name`) that takes
`{ raw, intent, section, perspective }` (the released word, the room's JTBD handle, the section slug,
the perspective id; generic handles only, no room content) and resolves by intent and context to a
canon name, never fuzzy on the name alone. The plugin already builds, guard-classifies (allow
`navigator_released` with the gate receipt) and audits that envelope, and sends `{ raw }` today
because Theo's schema is a `z.strictObject` with the single key `raw`. When Theo accepts the
envelope, the plugin needs no guard change, only a transport switch in
`lib/core/research-planner/canon-release.cjs` (`releaseTerm`). This repo did not edit anything in
the Theo workspace.

## Follow-ons

F1. **Release blocker: stamp the canon snapshot.** `data/framework-names.json` carries no
`theo_stamp` (366-06 did not run `--live`; Part 8 posture), so the next `release.sh` cut refuses at
place 9 ("never been stamped") until `node scripts/refresh-framework-names.cjs --live` runs after
Theo's re-emit for that version and the snapshot is committed, or `--no-canon-snapshot-check` is
passed (audited). EPV366-21 stays open on this.

F2. **Wire the D-17 leading edge into the Phase 349 dispatch step**: call
`node scripts/refresh-framework-names.cjs --live` automatically after Theo's re-emit, per the
navigator ruling of 2026-10-01. Today the lagging gate plus the documented command is the delivered
form.

F3. **The rs-engine / hsi-engine fate.** Ruled `engines: keep`. Moving ambient find-bottlenecks, the
hsi producers and the command doors to the graph perspectives needs a larger spike re-run: a larger
substrate so the graph arms reach an n comparable to the baseline's 96, and a distinct recall tag
per arm (366-19 deviation 1).

F4. **The command doors** `/mos:find-bottlenecks`, `/mos:whitespace`, `/mos:find-analogies` and
`/mos:find-connections` stay on their current engines under that ruling. The MCP reference-only
stubs already point at `perspective_recall` (366-16); the doors move only if F3's re-run moves them.

F5. **Phase 367: a section column on `artifact_file` claims**, so the canon handle at birth (D-10)
and the release envelope's `section` read from the claim instead of being derived.

F6. **Phase 368: the spawner guards.** No 368 runner-side guard was retired with the runner
(checked at 366-22); 368 owns its guards on the perspective path.

F7. **Phase 364 reuses the perspective shape** (`perspectives/index.cjs`, `shared.cjs`, the
interface in `lib/core/research-planner/CONTEXT.md`) rather than a new engine.

F8. **The Theo-side intent-led resolver** (above; the todo is the tracking item).

F9. **The shared_entity recall lane cannot fire from extractor output** (366-25 finding).
`scripts/entity-extract.cjs` writes DESCRIBES edges only to `memory_artifact` nodes, and
eureka-recall's `buildSubstrate` treats `memory_artifact` as a non-thing, so lane 1 is empty on
extractor-built rooms and recall rides the lexical and icm_declared lanes. Fix belongs to whoever
owns the extractor-to-perspective contract: link entities to the file's Artifact or claim node, or
map a memory_artifact DESCRIBES edge onto the thing sourced from the same file.

F10. **`disclosureLine('eureka')` is rendered by nothing live** (366-27). Decide whether the
perspective's prose or evidence card carries the eureka disclosure line, or retire the 'eureka'
entry from the floor-disclosure table.

F11. **The `cross_connection_stamped` memory_event has no producer** since 366-22. The comment in
`lib/core/navigation/memory-events.cjs` now says so (366-24); the allowlist entry stays (pinned by
test-355-filing). Decide: retire the type, or have filing-stamped / ambient-run write it.

F12. **Eleven test-only modules in `lib/core/eureka/`** (the 366-23 production orphan set: ahp-weights,
candidate-exclusion, opportunity-statement, portfolio-dimensions, reasoning-mode,
room-native-substrate, tail-quadrant, report-html, compression-meter, eureka-offer,
lateral-engine-adapter). Their only importers are tests. A follow-on retirement moves or deletes
them with their tests and their path-keyed ledger rows (listed in 366-23-SUMMARY.md).

F13. **`tests/fixtures/355/eureka-ranking-pin.json` kept as a frozen record.** Its test retired in
366-27 and no code reads it, but it is still cited as the D-47 pin by the report text that
`scripts/measure-355-hit-rate.cjs` emits and by comments in `lib/core/rs-differential-scorer.cjs`
and `lib/core/eureka/portfolio-dimensions.cjs`. Deleting it would leave those citations dangling;
retire it together with F12 (portfolio-dimensions) and a reworded report line.

F14. **dist bundles still carry the old door text** (`dist/zed/.agents/skills/eureka/SKILL.md`, the
`--legacy` section). They regenerate at release (`node scripts/build-dist-bundles.cjs`); not edited
by hand.

F15. **Owed from 366-11 and quick 261002-cud:** an MCP confirm route for `canon_confirm` items (CLI
only today); `op grant_request` on an egress-off plan answers `plan_not_ready` /
`egress_line_off`; the plan review card's "overturn a line" affordance; the gate-ledger
consume-before-session-check (Phase 289); a navigator ruling if the MCP release should be live by
default; the Theo replay fixture is the minimal classified answer, not a byte-exact capture.

F16. **The generic-Theo false block is not fixed** (SEED-019, SEED-106 item 1):
`part8-egress-guard-hook.cjs` still blocks plain generic `brain_ask` words (`freeform_unmatched`)
and framework-only `framework_chain_slice` calls (`unknown`). The `navigator_released` arm neither
depends on nor repairs it.

F17. **Deck slide count re-deferred** (folded todo,
`.planning/todos/pending/2026-07-29-deck-generation-ignores-explicit-slide-count-on-first-pass.md`):
the fix needs the engine's slide architecture, the deck door and the renderer together.

Pre-existing reds carried (not caused by Phase 366; owners named in `deferred-items.md`): the 355
direction-agreement leg H (KNOWN in run-all-366), test-310 release step 5.5 (`DRY_RUN` unbound),
test-release-bump-algebra F/H/I, test-doctor-doc-parity `--none`, the strict shape-declaration leg
of run-all-216, the two git-porcelain legs of run-all-343 on a dirty tree, and the 272 cache probe.

## Requirements at close

See `.planning/REQUIREMENTS.md` (EPV366 family) and `366-24-SUMMARY.md` for the per-row proof.
Suite results at close are in `366-24-SUMMARY.md`.
