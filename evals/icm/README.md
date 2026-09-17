# evals/icm - fixture grading for the five writers Phase 353 ships

Phase 353 (ICM Section Ruling System) ships five writers: the room-map scaffolder, the
ruling-document writer, the MINTO refresher, the claim filer and the entity extractor. This
directory grades each one against a checklist derived from that writer's OWN shipped contract,
never from a wish list, and never against a real room -- fixture rooms only
(`tests/fixtures/icm-rooms/`).

## The five writers graded here

| Writer | Checklist | Contract cited |
|--------|-----------|-----------------|
| Scaffolder | `checklists/scaffolder.md` | `lib/core/room-map.cjs` (self block + fingerprint) |
| Ruling writer | `checklists/ruling-writer.md` | `lib/core/room-skeleton-scaffold.cjs::writeSectionContracts` |
| MINTO refresher | `checklists/minto-refresher.md` | `lib/core/feynman-minto-invariants.cjs` (the governing_thought invariant) + `templates/room-skeleton/MINTO.md.tmpl` (the template placeholder text) |
| Claim filer | `checklists/claim-filer.md` | `lib/mcp/tools/views.cjs::fileArtifact`, `lib/mcp/tools/claim.cjs`, `lib/core/navigation/section-gate.cjs` |
| Entity extractor | `checklists/entity-extractor.md` | `lib/core/cross-room-aggregator.cjs::safeSlug`/`entityHandle` (the only entity-normalization code shipped at HEAD; there is no separate NLP entity-extraction module in this repo, and this checklist says so plainly rather than inventing one) |

Every checklist item cites the file and function it is derived from. An item that cannot be
traced to a shipped contract does not belong in this directory.

## The fixture-only rule

Every grading run in this directory targets **fixture rooms only** (`tests/fixtures/icm-rooms/`),
never a real room. `scripts/eval-icm-writers.cjs` refuses any `--room` argument that does not
resolve, by path containment, under `tests/fixtures/icm-rooms/`. The reason is D-353-4: the
Jev-graded half of this suite sends structural fields (never room content) to a paid vendor, and
the only way to guarantee a navigator's real venture data can never reach that vendor by accident
is to make the runner structurally incapable of reading anywhere else.

## The vendor half

Every `code` checklist item runs locally, with no key and no network, on every machine. Every
`jev` checklist item runs ONLY when the dev-time key resolves from `~/.secrets/typesafe.env` (or
`TYPESAFE_API_KEY` in the operator's own shell); with no key, the `jev` half SKIPS LOUDLY with a
named reason and the `code` half still completes with a full report. The vendor never runs in a
hook on a user's machine and never runs against a real room (D-353-4, R-353-G).

## The metric for criterion 6

Criterion 6's metric is EXACT AGREEMENT: the fraction of graded `jev` items on which
`scripts/eval-icm-writers.cjs`'s verdict equals the once-authored `evals/icm/claude-judge-baseline.json`
verdict for that same item. Spearman rank correlation is explicitly NOT used here, because a
checklist verdict is categorical (a pass/fail or an enum choice), not a ranked list, and Spearman
measures rank agreement over an ordering that does not exist in this data. `agreement >= 0.8` is
the threshold `tests/test-353-grader-agreement.cjs` and the `icm-ruling-eval-fresh` acceptance
point both assert.

## Files in this directory

- `README.md` - this file.
- `checklists/*.md` - one checklist per writer, five files, each item marked `kind: code` or
  `kind: jev`.
- `cases/turns.json` - the labeled fixture turn set (authored in Plan 01, before any ledger
  existed; read-only here).
- `claude-judge-baseline.json` - the once-authored judge baseline (Task 4), never written by the
  runner.
- `last-run.json` / `last-run.html` - the runner's own output (Task 2), the artifact
  `icm-ruling-eval-fresh` reads instead of calling a vendor.
