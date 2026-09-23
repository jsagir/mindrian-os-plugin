# B1 and B2 implementation research

Date: 2026-09-23

This document resolves the two labels used in the NATO slide discussion. They
are not the repository's Ignite birth gates also named B1 and B2.

## B1: verification record and room portrait

The requested capability is: a claim keeps a local, inspectable record of what
was checked against, how it was checked, when, by whom, and with what result.
The record must remain separate from truth promotion. A checked claim is not an
automatically confirmed claim.

The current substrate already provides the right write door:

- `lib/core/navigation/typed-claim.cjs` is the claim-node writer.
- Claim properties are additive JSON, so this does not require a migration.
- Claims enter as `review_status: proposed`; the human gate is separate.
- `lib/core/navigation/edges.cjs` already accepts `SOURCED_FROM`, `SUPPORTS`,
  `CONTRADICTS`, and `REFINES`.
- Existing `evidence_tier` records describe source class, not the act of
  checking. They cannot be used as a substitute for B1.

The first B1 slice therefore adds a dedicated verification record to the claim
properties and a local portrait reader. The record is a bounded event, not a
truth score:

```json
{
  "verification": {
    "status": "unchecked | checked | disputed | inconclusive",
    "records": [
      {
        "against_id": "node or artifact handle",
        "against_kind": "artifact | source | observation | person | experiment",
        "method": "read | compare | observe | test | ask",
        "result": "supports | contradicts | inconclusive",
        "checked_by": "user | system",
        "checked_at": "ISO timestamp",
        "note_handle": "optional artifact handle"
      }
    ]
  }
}
```

Only generic handles and enum/scalar metadata belong in the graph. Free-form
notes remain artifacts and are referenced by `note_handle`. The portrait reads
claims and reports counts by verification state and result. It must also report
how many claims have no record. It must never convert those counts into a
quality score or confirm a claim.

## B2: frame provenance and frame change

The current checkout does have a first-class `frame` node writer in
`lib/core/navigation/typed-frame.cjs`, contrary to the pasted transcript's
claim that no Frame node exists. It currently records composition only:
members and a topic handle. It does not record where the governing question
came from, preserve frame versions, or classify a change as refinement versus
relocation.

The current substrate also computes governing-thought hashes and reports
staleness. That is a useful change trigger, but it is not frame provenance and
has no pre-answer consumer.

The first B2 slice extends the existing frame node with provenance metadata and
adds a reader that compares successive frame versions. Required origin values
are `chosen`, `tasking`, `prompt`, and `inherited`. A frame version carries the
governing-thought hash and an optional predecessor hash. A change is explicit:

- `refines`: the user supplied a bounded account of what the previous question
  got wrong, stored as an artifact handle.
- `relocates`: no such account was filed. Both frames remain visible.

The pre-answer interaction gate is a later B2 slice because answer producers
are spread across several paths. No slide may claim that gate until that
consumer is wired and tested.

## Build order

1. B1 data contract, claim writer support, portrait reader, and focused tests.
2. B2 frame provenance fields, version reader, change classification, and
   focused tests.
3. Wire B1 into the claim and gate surfaces, and expose the portrait locally.
4. Wire B2 into the governing-thought write path before answer generation.
5. Run the system review and update NATO slide language from verified behavior.

The first two slices are additive and local. They can be reviewed without
changing the human confirmation gate or Brain egress rules.
