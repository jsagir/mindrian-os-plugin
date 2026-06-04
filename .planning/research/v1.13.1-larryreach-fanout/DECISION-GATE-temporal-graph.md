# Decision Gate v2 -- Temporal Graph + Context Assembly

**Recommended:** Option A -- Close the local loop (getRoomContext fusion)

## Option A -- Close the local loop (getRoomContext fusion)

**Effort:** M

**Scope:** Build the local in-process getRoomContext() that fuses Leg A (getRoomHomeView RAW summaries), Leg B (getSessionHistory fragments, windowed), Leg C (getNeighborhood graph-ranking, FTS5 only if it underperforms), seeded by the last ~2 turns. Reuse room-home.cjs safeShape RAW path; explicitly do NOT import packet.cjs projectText/hashText. Wire it as the retrieval seed so the per-turn loop stops forwarding userText:null. Commit the uncommitted Capability Dial section in the same PR and fix the line-53 ReferenceError as a tagged-along one-liner.

**Unlocks:** Closes R1, the compounding moat loop -- the single highest-leverage intervention. Makes 'do you remember X' actually retrieve X-relevant nodes. Stays 100% local, zero Part 8 exposure (raw prose never egresses). Ships the When-to-Reach policy from working-tree limbo into HEAD. Realizes the TRIZ space-separation resolution.

**Risk:** Latency against the 1200ms NAV timeout if Leg C uses heavy indexing; mitigated by graph-ranking-first. FTS5 decision (KU#1) may expand scope. Must NOT accidentally reuse the egress hashing path (would hash away Larry's own context).

---

## Option B -- Fix the edge history structure (bi-temporal Stage-1 + Stage-2)

**Effort:** L

**Scope:** Add valid_from/valid_to/superseded_by to edges via the phase-109 additive ALTER template (Stage-1, trivial/idempotent), add the partial index WHERE valid_to IS NULL, then do the Stage-2 surrogate-PK rebuild (use the edgeId writeEdge already mints at :215) and change writeEdge ON CONFLICT from DO UPDATE-overwrite to close-old-then-insert-new. Make readers validity-window-aware.

**Unlocks:** Stops R3, the silent history-destroying flow. Makes as-of edge queries possible. Foundation for any future Zep-style bi-temporal model and for not losing edge history on re-assertion.

**Risk:** Stage-2 is a 12-step table rebuild touching the rs_discoveries VIEW + triggers (UU#5) -- highest data-corruption surface in the whole brief. No reader needs it yet, so it delivers latent capability not visible product value. Stage-1 alone is necessary-but-insufficient (re-assertion still clobbers).

---

## Option C -- Reap the leaks + harden the boundary

**Effort:** M

**Scope:** Drain graph-edge-pending.log into real room.db HAS_JTBD edges (close B2); migrate jtbd-history.json into the Part 9 SQLite spine with a user-id column; delete-or-resurrect the orphaned facts table; land the named check-brain-boundary.cjs PR gate (today only a spec); add the --check-sendpacket guard to the installer template.

**Unlocks:** Removes correctness hazards (multi-user shared-$HOME write interleaving, undrained log inflation), aligns RECALL with Canon Part 9, consolidates 6 scattered Part-8 surrogates into one repo-level gate, makes contributor clones consistent.

**Risk:** Lowest leverage of the three -- it is hygiene, not moat. Touches the most files for the least visible user value. The facts-table decision and the spine migration both need the shared-$HOME model confirmed first (KU#4).

---

