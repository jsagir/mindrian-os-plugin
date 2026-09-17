# Claim filer checklist

Writer graded: the filing gate and its anchor-edge mint, wired into `artifact_file`
(`lib/mcp/tools/views.cjs::fileArtifact`) and `claim_write` (`lib/mcp/tools/claim.cjs`), backed by
`lib/core/navigation/section-gate.cjs::evaluateFilingGate` and
`lib/core/navigation/jtbd-anchor.cjs::mintJtbdAnchor` (353-02-SUMMARY.md).

## Item 1: the anchor edge is present

- kind: code
- contract: `jtbd-anchor.cjs::mintJtbdAnchor`/`JTBD_ANCHOR_ID`, the mint-then-edge ordering, and
  the `SOURCED_FROM` edge write (WD-353-2 resolved, R-353-J).
- check: after filing a claim or artifact on a fixture room, a `SOURCED_FROM` edge exists from
  the new node to a `jtbd:<job_id>` node (type `'jtbd'`, never `'claim'`).
- crosses the wire: nothing. Local SQL read via the navigation door, zero network.

## Item 2: serves_jtbd was honored or the mismatch was disclosed

- kind: code
- contract: `section-gate.cjs::evaluateFilingGate`, `GATE_MODES` (`flag` default lands a disclosed
  `job_mismatch` on the existing `mcp_client_event_logged` memory event; `strict` refuses before
  any write).
- check: when a claim's declared `serves_jtbd` disagrees with the section's `job_id` and no
  declared cross-section reason is present, the write still lands under `flag` mode AND a
  `job_mismatch`-labeled memory event was logged; under `strict` mode the write is refused before
  any byte lands.
- crosses the wire: nothing. Local SQL write via the navigation door, zero network.

## Item 3: the epistemic_type chosen is plausible for the claim shape

- kind: jev
- what crosses the wire (one line, exhaustive): the claim's chosen `epistemic_type` enum value (one
  of the ten `ALLOWED_EPISTEMIC_TYPES` members) and a structural summary of the claim's SHAPE
  (word count bucket, whether it names a number, whether it names a date) -- the claim TEXT itself
  never crosses, only the enum and the shape summary.
- check: a Jev Score question asks whether the chosen epistemic type is a plausible fit for a
  claim of that shape (for example, an `observation` claim naming a specific number is a more
  plausible fit than an `assumption` claim naming the same number).
