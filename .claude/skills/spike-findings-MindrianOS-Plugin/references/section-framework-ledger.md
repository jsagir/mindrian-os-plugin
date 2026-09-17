# Section Framework Ledger (Jev ranker over Theo's canonical frameworks)

## Requirements

- Shipped as DATA, never as a runtime call: score every (section x problem_type x stage)
  combination once, at dev time or in Theo's re-emission (`theo-resync` fires on every
  release), and ship the ranking as registry data. Users keyless, no vendor in their loop.
- IP egress ruling (navigator, 2026-09-17): what may cross to TypeSafe about a framework
  is its name, a JTBD statement (rendered from the Brain's closed job vocabulary on
  `jtbd_anchor`) and a glossary line (`definition`, else the first sentence of the
  description capped at 140 chars). Full Theo descriptions never cross unless the
  navigator runs it himself (`SPIKE_DESC=full`).
- Theo reads go through `lib/core/brain-client.cjs::query(cypher, params)` with FIXED
  query text and `$params`; never string-assembled Cypher (substrate rule m4 refuses the
  commit) and never a second wire.
- Content prerequisite: the ranking is only trustworthy where the candidate frameworks
  have real descriptions. Measured 2026-09-17: 305 of 410 canonical Framework nodes
  carry a stub or empty `description`, 280 lack `jtbd_anchor`, 400 lack `definition`.
  Backfill before trusting the ledger outside problem-definition and team-execution.

## How to Build It

1. Pull the working set from Theo (from `sources/002-jev-section-framework-ranker/rank.cjs`
   `pullTheoFrameworks`): bucket by lower-cased first character with a parameterized,
   function-wrapped predicate, and filter aliases and explicit non-canonicals:

   ```cypher
   MATCH (f:Framework)
   WHERE toLower(left(f.name, $n)) = $prefix
     AND coalesce(f.alias_of, '') = '' AND coalesce(f.canonical, true) <> false
   RETURN f.name AS name, toString(coalesce(f.description, '')) AS description,
          toString(coalesce(f.jtbd_anchor, '')) AS jtbd_anchor,
          toString(coalesce(f.definition, '')) AS definition
   ORDER BY name LIMIT 100
   ```

   36 buckets (0-9, a-z) plus a catch-all `NOT toLower(left(f.name, 1)) IN $alnum`; split
   a bucket on the second character if it ever returns the ROW_CAP notice. 410 rows in
   ~48 s. Largest bucket seen: 47.

2. Compose what crosses per framework (`describe()` in ruling mode):
   `{ jtbd: JTBD_MAP[f.jtbd_anchor] || f.jtbd_anchor, glossary: f.definition || firstSentence(f.description, 140) }`.
   `JTBD_MAP` renders the Brain's job vocabulary (`select_methodology`, `suggest_next_move`,
   `detect_contradiction`, `summarize_neighborhood`, `classify_room_budding`,
   `rank_assumptions`, `generate_feynman_explanation`, `strengthen_minto`,
   `prepare_investor_brief`, `opportunity_react`, `opportunity_reflect`, `opportunity_rank`)
   as one-line jobs; `REVIEW_REQUIRED` renders empty.

3. Score in batches of 20 per call, one Score question per framework over a shared state
   `{ section, problem_type, stage, candidates: { f0: {name, description}, ... } }`, with
   the three-level rubric:
   - poor fit as a first move: premature, off-section, or answers a question this stage is not asking
   - partial fit: useful as a later or supporting move once the first move has landed
   - strong fit: a right first move for exactly this section, problem type and stage
   Instruct "judge fit-as-first-move, not general usefulness; a famous framework can be a
   poor first move here". Concurrency 4. Batched and per-pair variants agree at Spearman
   0.78-0.84, so the batch is the shape.

4. Emit per scenario: ranked list with `score`, `confidence`, `in_index` (is the framework
   in `data/connector-registry.json` `framework_index`), `stub` (description missing).
   Gate consumers on confidence per seat; drop items under a floor the section owner sets.

5. Render for the eye with `report.cjs` (De Stijl, inline, no CDN) when a human must
   judge a scenario; the hand-labeled fixture in `fixture.json` is the grading set (26
   usable labels, written before any call).

## What to Avoid

- Do not ask Theo for more than 100 rows: ROW_CAP=100 returns `{text: "ROW_CAP: ..."}`
  with ZERO rows while the message says it returned 100.
- Do not paginate with `SKIP` or with a range on `f.name`: `Skip`, `Distinct` and
  `NodeUniqueIndexSeekByRange` are PLAN_REJECTED by Theo's read allow-list; `OR ... IS
  NULL` plans a `Distinct`. A function-wrapped predicate plans NodeByLabelScan + Filter
  and passes.
- Do not rank by graph degree (number of `/mos:` commands declaring the framework): it
  scored Spearman 0.06-0.13 against hand labels; Jev scored 0.59 / 0.63 / 0.82 / 0.19.
- Do not feed names only: "Well-Defined Problem Framework" ranked first for ill-defined
  scenarios from its name. Name-based misreads are a content problem.
- Do not expect stubs to self-flag: confidence did NOT drop on stub-description items
  (0.42-0.62 vs 0.42-0.51). Carry the `stub` bit explicitly.
- Do not look for "Mullins Model" by that name; the canonical node is aliased
  ("John Mullins Framework").

## Constraints

- 452 Framework nodes in Theo, 410 canonical after the alias / non-canonical filter.
- 9-10 of every scenario's top 12 are frameworks the 27-name `framework_index` cannot
  offer at all; the index is a tenth of what the graph knows.
- Cost for 4 scenarios x 410 frameworks in both variants: 430k input tokens, about $0.018
  at the vendor-claimed rate; a full ledger of ~240 combinations extrapolates to about $1.
- Room-structure decision (per-section ICM file vs one registry projection) is not made;
  it routes through the `icm-architect` consult per the standing rule.

## Origin

Synthesized from spikes: 002.
Source files available in: sources/002-jev-section-framework-ranker/
