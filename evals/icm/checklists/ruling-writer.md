# Ruling writer checklist

Writer graded: the ruling document generator, `lib/core/room-skeleton-scaffold.cjs::writeSectionContracts`
(rewritten in Plan 02 to splice a six-part generated block above preserved authored prose;
353-02-SUMMARY.md).

## Item 1: the six parts are present, in order

- kind: code
- contract: `writeSectionContracts`'s generated block (Job; Methodology sequence; Writing rules;
  Gates; Checks; Commands that write here), spliced between the `mos:ruling:begin`/`mos:ruling:end`
  markers.
- check: parse the generated CONTEXT.md, assert all six numbered headings are present and in the
  documented order.
- crosses the wire: nothing. Local file parse, zero network.

## Item 2: the frontmatter carries the four generated keys

- kind: code
- contract: the ruling document's frontmatter schema arm in `lib/core/frontmatter-schemas.cjs`
  (`icm_layer`, `job_id`, `ruling_fingerprint`, `generated_at`).
- check: `gray-matter` parse of the landed CONTEXT.md carries all four keys with the correct
  types (`icm_layer` a number, `job_id` a known canon job, `ruling_fingerprint` a sha256 hex
  string, `generated_at` an ISO timestamp).
- crosses the wire: nothing. Local frontmatter parse, zero network.

## Item 3: ruling_fingerprint recomputes

- kind: code
- contract: `writeSectionContracts`'s fingerprint recompute (over the canon row + ledger row +
  writer-contract version, per the plan's target frontmatter shape).
- check: recompute the fingerprint from the same three inputs the generator reads and assert it
  equals the frontmatter's `ruling_fingerprint`, and that a second generation on an unchanged
  input tree is byte-identical (a true no-op).
- crosses the wire: nothing. Local hash recompute, zero network.

## Item 4: authored prose below the end marker is byte-preserved

- kind: code
- contract: R-353-L, the amended `tests/test-275-section-schema.cjs` assertion (every byte below
  `mos:ruling:end` matches the corresponding region of the section's authored template).
- check: byte-compare the region below `<!-- mos:ruling:end -->` in the landed CONTEXT.md against
  the same region in `templates/room-skeleton/section-contracts/<slug>.md`.
- crosses the wire: nothing. Local byte comparison, zero network.

## Item 5: the methodology sequence fits the section's job

- kind: jev
- contract: the generated Part 2 (Methodology sequence), sourced from
  `data/section-command-ledger.json`'s row for the section's `job_id`.
- what crosses the wire (one line, exhaustive): the section's job name, its one-line JTBD
  statement, and the ordered list of framework names the sequence names -- room content never
  crosses, and neither does any command's full description or any artifact body.
- check: a Jev Score question asks whether the named framework sequence is a plausible first-move
  order for a section doing that job; room content plays no part in the question or the answer.
