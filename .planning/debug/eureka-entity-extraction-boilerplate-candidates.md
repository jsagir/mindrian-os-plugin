---
status: gathering
kind: rca
trigger: "eureka-entity-extraction-boilerplate-candidates"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8, 9]
---

## Current Focus

Relayed finding, not yet reproduced by this session. Next step: reproduce the embedded-mode
scan on a populated room and inspect the entity-extraction output BEFORE the AHP scorer, to
confirm that frontmatter and stub-file tokens dominate the candidate entity set.

## Meta

- Filed: 2026-09-17 by the Jev spike session, relaying jsagi-5e (Larry, working the `axiom` room) via jsagi-40.
- Source-of-Truth Preamble:
  - CODE claims read against: not yet read; relayed observation only. Re-verify against `origin/main` HEAD before any finding lands (tag `needs-source-reverify`).
  - WIRE claims probe against: local Eureka engine in embedded mode (MongoDB/mdbr-leaf-ir encoder, sqlite-vec backend) on plugin `2.0.0-beta.41` (reporter-confirmed 2026-09-17 via jsagi-40).
  - Date of audit: 2026-09-17.
  - Reporter's `status.json` (embedded run): `state: done`, `started_at: 2026-09-17T06:44:02.700Z`, `finished_at: 2026-09-17T06:44:40.766Z` (38 s for 176,871 scored pairs), `pid: 1706125`, `out: ~/MindrianRooms/axiom/.mindrian/eureka/portfolio-report.md`, `json: ~/MindrianRooms/axiom/.mindrian/eureka/portfolio-report.json`.
  - Reporter (jsagi-5e) offers `portfolio-report.json` and the reasoning-mode `pairs/mappings/answers.json` on request; ask for the top-25 entity rows with their source file paths first, since that is the direct test of the frontmatter/stub hypothesis.
- Classification: NEW FAILURE (not in the two 2026-09-17 mentor reports; adjacent to Spike 004, which tested the critic on clean packets and found the critic itself correct).

## Problem Statement

The Eureka engine's candidate-pair generation feeds the AHP scorer and the critic with
"entities" extracted from room markdown boilerplate (persona name, frontmatter status
words, literal strings from empty per-section BRAIN.md stubs) instead of the concepts in
the room's real artifacts, so every critiqued candidate fails `entity_nonspecific` or
`domain_swap_invariant` and the scan reports nothing on a room with real content.

## Symptoms

- Room `axiom`, 69 artifacts across 14 sections.
- Run 1 (reasoning mode, no local encoder): sampler pulled 1 entry per section (12 of 65
  artifacts); 7 of those were empty per-section BRAIN.md stubs. 1 of 25 candidate pairs had
  real content on both sides; it failed the transferability rubric.
- Run 2 (embedded mode after `/mos:eureka enable`): TRUE embedded mode confirmed, no
  degrade; 1013 graph nodes, 1208 typed edges, 176,871 pairs scored. Top "entities":
  "Larry", "Seeded", "Working", "Key Decision", "Five", "Current", "BRAIN". None of the 65
  real artifacts (named competitor analyses, buyer personas, a ratified decision node)
  reached the top 25. All 25 critiqued candidates failed `entity_nonspecific` or
  `domain_swap_invariant`. Weak-signal tail flagged `suspect_noise` (attention and growth
  scores collapsed to two repeated values across ~200 items).
- Reporter's files, room `axiom`: `.mindrian/eureka/portfolio-report.{json,md,html}`,
  `.mindrian/eureka/status.json` (embedded run); `.mindrian/eureka/reasoning/{pairs,mappings,answers}.json`
  (reasoning run). Write-up: `~/MindrianRooms/axiom/strategy/eureka-scan-outcome-2026-09-17.md`.

## Scope and Impact

- Surface: CLI (`/mos:eureka`), both reasoning and embedded modes.
- Impact: the engine produces zero usable candidates on a populated room; the critic and
  scorer spend their budget on noise. Every downstream Eureka artifact on such a room is
  empty or misleading.
- Not affected (per Spike 004, 2026-09-17): `criticRule` / `verdictFromRubric` on a
  well-formed packet.

## Eliminated

- Encoder / embedded-mode degrade: reporter confirmed true embedded mode, no degrade.
- Scoring math and critic: reporter's diagnosis and Spike 004 agree they ruled correctly on
  the input they were given.

## Evidence

- 2026-09-17: relayed observation (jsagi-5e via jsagi-40). Top-25 entity list and the
  all-fail critic outcome as listed under Symptoms. Not yet reproduced here.

## Technical Root Cause

Hypothesis, unverified: the entity extractor tokenizes whole markdown files including YAML
frontmatter and the shipped stub templates, and either (a) does not strip frontmatter keys
and values (`status: Working`, `Seeded`, persona name) or (b) samples per-section files
without weighting by artifact substance, so empty BRAIN.md stubs contribute as much as a
competitor analysis. Candidate location: the entity-extraction and sampler stages of the
Eureka pipeline (`lib/eureka/` or `scripts/eureka-*`); exact file and function to be
named after reading.

## Required Code Changes

To be filled after root cause is verified. Expected shape: strip frontmatter and the known
stub-template strings before extraction; exclude files under a substance floor (or
identical to the shipped stub) from sampling; add a stop-list for persona and status
vocabulary; surface an `entity_source_share` diagnostic in `status.json` so boilerplate
dominance is visible.

## Tests to Add or Update

- A fixture room with N real artifacts plus M empty BRAIN.md stubs: the top-K entity list
  must contain zero frontmatter/status tokens and at least one concept from each real
  artifact class.
- A regression that feeds the extractor a stub file and asserts an empty entity set.

## Non-Code Follow-ups

- Ask the reporter for the plugin version and for `status.json` so the Source-of-Truth
  Preamble can be completed.
- Cross-link this RCA from the `axiom` room write-up once resolved.

## Resolution

Open.
