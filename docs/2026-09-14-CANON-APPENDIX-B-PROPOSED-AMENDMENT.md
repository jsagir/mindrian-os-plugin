---
title: "Proposed Canon Appendix B Amendment: L0 and L4 File Citations"
date: 2026-09-14
status: handoff draft, zero Canon bytes landed by this document
addressed_to: Phase 340 (Canon Currency Audit and Amendment)
authored_by: Phase 344 (the layer contract: name, describe, and pin every engineering layer)
---

# Proposed Canon Appendix B Amendment: L0 and L4 File Citations

This document is a handoff, not an amendment. It proposes exact wording for Phase 340 to
lift byte-for-byte into `docs/MINDRIAN-CANON.md` Appendix B, behind Phase 340's own
navigator sign-off ceremony. Phase 344 lands zero Canon bytes here.

---

## 1. What is being proposed and why

Appendix B maps each ICM layer to a Canon Part, but not to a file; the file mapping lives
only in the "Implementing mechanisms (Phase 275)" prose paragraph beneath the table, and
that paragraph covers Layer 1 through Layer 3 only. The paragraph states outright, in its
own closing sentence, that "Layers 0 and 4 carry no new citation here; the five
Layer-to-Part mappings above stay byte-identical." Promoting Appendix B to the single
canonical ICM L0 through L4 statement for the whole repo (WD-1, ruled 2026-09-14) therefore
requires closing exactly that named gap: adding an L0 file citation and an L4 file citation
to the same paragraph, in the same voice the existing three sentences already use.

## 2. The literal proposed wording

Two new sentences, appended to the end of the existing "Implementing mechanisms (Phase 275)"
paragraph, immediately before its current closing sentence. No change to the ICM Layer /
Layer Role / Canon Part table header is required; the table's five rows already state the
Layer-to-Part mapping completely, and this amendment does not touch them.

```
Layer 0 - Identity's per-directory `ROOM.md` identity file is scaffolded at room-birth time
by `lib/core/room-skeleton-scaffold.cjs`. Layer 4 - Artifacts' room entries, the filed
artifacts with their validity status and cross-references, are filed through
`lib/mcp/tools/views.cjs`'s `artifact_file` (a typed claim plus `SOURCED_FROM` provenance).
```

The paragraph's existing closing sentence ("Layers 0 and 4 carry no new citation here; the
five Layer-to-Part mappings above stay byte-identical.") is now false once the two sentences
above land, and Phase 340 must delete or rewrite it in the same edit rather than leave a
contradiction sitting next to its own correction.

L0 is cited to `lib/core/room-skeleton-scaffold.cjs` (the same file the existing Layer 2
sentence already cites for `writeSectionContracts`, so this reuses a name already trusted in
this paragraph rather than introducing a new one). L4 is cited to `lib/mcp/tools/views.cjs`'s
`artifact_file`, the shipped filing tool that writes a typed claim with `SOURCED_FROM`
provenance, the load-bearing shape Appendix C's own Glossary entry for "Canonical breach"
already assumes exists.

## 3. Why Phase 344 is not landing it

`ROADMAP.md`'s Phase 340 entry registers this exact gap as its own sub-scope 4, EXTENDED ICM
SCHEMA: "Phase 275's SECTION_NAMES 8-to-11 extension plus its L1/L2/L3 per-section mechanisms
... should be checked against Part 9's ICM Layer 0-4 doctrine (Appendix B) for currency."
Phase 340's own Amendment Wave B (340-03-PLAN.md, Appendix D entry 39, canon v1.26) already
acted on part of that sub-scope: it added the L1 through L3 citations that now sit in the
Implementing mechanisms paragraph. That same wave's own text is explicit that L0 and L4 were
deliberately left out ("Layers 0 and 4 carry no new citation here"), not overlooked.

Every prior Canon amendment (Appendix D entries 1 through 40, without exception) required
navigator sign-off on the literal text before any Canon byte landed. Phase 340 already owns
the ceremony, the requirement ids (CANON-01 through CANON-10), and the Appendix D
entry-numbering sequence for this exact document. Two phases cannot both own one Canon
edit without one of them silently duplicating or contradicting the other's ceremony, so
Phase 344 drafts the wording here and Phase 344 changes zero bytes in
`docs/MINDRIAN-CANON.md`.

**Honest note on Phase 340's current state.** `ROADMAP.md` records Phase 340 as closed,
5 of 5 plans complete, as of this writing. Wave B's own citation gap (L0 and L4 left
uncited, by its own stated design) was not reopened by a later Phase 340 plan; no Phase 340
plan currently pending would land this wording. That does not change the ownership rule
above; it means the two new sentences in section 2 are queued as Phase 340's own
unfinished sub-scope-4 item, to be landed either by a fresh Phase 340 continuation plan or
by a later phase the navigator designates, behind the same sign-off ceremony every other
Canon edit has required. Phase 344 does not reopen Phase 340 to land it; naming the gap and
handing over the exact text is the full extent of this document's job.

## 4. A second, separable Canon question to bundle into the same sign-off

`docs/LAYER-DECLARATION-CONTRACT.md` records WD-8 (ruled 2026-09-14): whether `layer:`
becomes a fourth Canon Part 11 born-clause, alongside R1 (born WIRED or EXCLUDED) and R16
(born declared-shape), or stays a repo contract with its own harness rung. The case for
promotion: Part 11 already carries two structurally identical born-clauses governing a
frontmatter fact every invocable surface must declare, `layer:` is the same shape of fact
(a closed vocabulary, a fail-closed default, a gate script), and leaving a third,
functionally equivalent mandate outside the Canon while its two siblings sit inside it
is the kind of drift Phase 340 itself exists to close. The alternative: `layer:` stays
governed entirely by `docs/LAYER-DECLARATION-CONTRACT.md` as a repo contract with an
advisory harness rung (`scripts/check-layer-declaration.cjs`, shipped in 344-02), never
promoted to constitutional text, on the grounds that a repo contract can amend itself in
one commit while a Canon promotion requires the full sign-off ceremony for a mandate that
is still only weeks old and unproven at scale. Bundling this question into the same
navigator sign-off that lands section 2's wording is cheaper than a second, separate
ceremony for one more sentence in Part 11.

## 5. Acceptance for the receiving phase

When Phase 340 (or its designated successor) lands this amendment, it must be able to
assert:

- `docs/MINDRIAN-CANON.md`'s Appendix B "Implementing mechanisms (Phase 275)" paragraph
  names a file for Layer 0 and a file for Layer 4, in the same sentence style as its
  existing Layer 1 through Layer 3 sentences.
- The paragraph's closing sentence no longer states that Layers 0 and 4 carry no citation,
  since that sentence is now false.
- The five-row ICM Layer / Layer Role / Canon Part table above the paragraph is
  byte-identical to its pre-amendment form (this amendment adds prose, it does not touch
  the table).
- A new Appendix D entry records the amendment, dated, with the navigator's sign-off, per
  every prior entry's own precedent.
- The WD-8 born-clause question (section 4) is resolved one way or the other in the same
  ceremony, with its own dated Appendix D line if promoted, or a dated note in
  `docs/LAYER-DECLARATION-CONTRACT.md`'s decision ledger if it stays a repo contract.
- `git status --short docs/MINDRIAN-CANON.md` was empty at every point before this
  amendment's own commit landed it.

## 6. Where this handoff is tracked

`.planning/` is gitignored in this repo and does not travel between machines; a handoff can
only reach Phase 340 through a tracked file. This document is that tracked file. Plan
344-09 (this phase's close-out plan) will add a one-line pointer to this document in
`docs/OPEN-HANDOFFS.md`, the standing tracked handoff log, rather than editing Phase 340's
own closed `ROADMAP.md` entry, since Phase 340's entry is a completed historical record and
this document does not disturb it. That pointer is a stated commitment here, to be executed
at 344-09 time.
