# Canon Recalibration Proposal — Three-Pillar Synthesis

> **Status: PROPOSAL. Not a committed canon entry. No canon file modified.**
> Drafted 2026-06-25 from a verify→refute→synthesize workflow (7 agents).
> Provenance: workflow `wf_da2aeb68-6a0`. Source critique = the 3-pillar Minto
> pyramid (outcome / graph / prose). Every numeric claim is tagged by how it was
> checked; the headline population numbers are **projection-verified or
> admin-gated, never graph-verified** (raw Cypher requires an admin key this run).

---

## 0. Admin-gate limitation (read first — it scopes everything below)

Every numeric claim is tagged by how it was checked:

- **graph-verified** — confirmed against the live Brain via Cypher. **NONE of the dramatic population numbers reach this bar.** Raw `brain_query` is admin-gated (`"Raw Cypher query access requires admin key"`); `brain_ask` returns only GUIDED methodology directives, never graph stats.
- **projection-verified** — confirmed against the sanctioned LOCAL read-models (`data/brain-orchestration-projection.json`, `data/connector-registry.json`, `data/framework-names.json`). These are DERIVED unions, not a Brain census.
- **canon-verified** — confirmed verbatim against `docs/MINDRIAN-CANON.md` / `CANON-PHASE-MAP.md` (lines 216-227, 382-386, 443-468 re-read this run).
- **external-verified** — confirmed against a published primary source.

The headline numbers that motivated all three pillars — 176 frameworks, 76/56/51/8 dark split, 203 chain edges, 264 DictionaryTerm, 748-vs-761 — are **NOT graph-verified**. They are projection-verified at two orders of magnitude smaller, or admin-gated and unreachable this run. **No external-facing artifact may state any of them as established fact.** This limitation gates the sequencing in §3.

---

## 1. APEX — the one governing recalibration

> **The canon measures and quotes itself with the wrong instruments, and it knows the user-outcome instrument is missing. Install a TRANSFER-and-provenance discipline: (a) any commit-class user-outcome claim must carry an Operational transfer measurement, not an engagement/confidence proxy; (b) coverage and corpus counts must be generated from a single dated, admin-stamped read, never hand-typed — and the same dark-capability sweep that zeroed the plumbing must be re-sourced to run over the live framework population, not the command-derived union.**
>
> **All three pillar DIAGNOSES survive. Only ONE of three HEADLINES survives verbatim (Pillar 2). Pillar 1's headline does NOT survive (the "freeze" clause is refuted by the canon's own ledger; "retire Hooked" is largely moot). Pillar 3's headline survives as DIAGNOSIS but its prescribed FIX (one local stats artifact) is structurally insufficient against an admin-gated, self-contradicting remote corpus.**

The apex is deliberately softened from any single headline because the refutation pass killed the most aggressive verb in each. What stands across all three is one shape: **the canon's self-measurement is instrument-wrong, and the cure is generate-from-a-dated-read + measure-transfer-not-engagement, NOT freeze-and-retire.**

---

## 2. The three pillars

### PILLAR 1 — Outcome Layer (evidence tier at the commit point)

**What HELD (canon- and external-verified):**
- Part 5 forbids None-tier near a commit. Verbatim, line 225: *"Near a commit decision (funding, hiring, public launch), the gate demands Academic or Operational."* (canon-verified)
- Part 10's user-outcome claim was measured at **Hooked Variable Reward 0.0/10 and 0/5 empathy**, ratified 2026-06-17 by explicit override, recorded *"truthfully and without euphemism"* at lines 384-386. (canon-verified)
- Microsoft/CMU CHI 2025, **N=319**: higher GenAI confidence → **LESS** critical thinking. (external-verified)
- LearnLM UK RCT (arXiv 2512.23633), 165 students: **+5.5pp** novel-problem transfer, 66.2% vs 60.7%. (external-verified)

**What FAILED / was UNVERIFIABLE:**
- **The headline does NOT survive.** "Freeze new amendments" is **refuted by the canon's own ledger**: SEVEN navigator-LOCKED amendments shipped AFTER Part 10's ratification (Appendix D entries 21-27, v1.10→v1.16, 2026-06-17→2026-06-24). Amendments accelerated, not froze. (canon-verified) Every one is a frozen-edge/node-vocabulary move, NONE a Part-10-class user-outcome claim — a freeze cures nothing it touches.
- "Retire the Hooked gate" is **largely moot** — already overridden, never re-run, debt named in-canon.
- LearnLM's 5.5pp comparator is **human-only tutoring**, not pure answer-giving (vs static hints ~10pp) — marked **partial**. A transfer meter needs a DEFINED baseline before it is a hard gate.

**Recommended amendment (survivor — Part A only):**
- Amend **Part 5**: any USER-OUTCOME claim at a commit-class ratification must carry an **Operational transfer measurement** (does the navigator solve a NOVEL problem better after?), not an engagement/confidence proxy. Ground in CHI 2025 + LearnLM.
- Amend **Part 10 provenance**: swap the deferred v1.14.0 instrument from the Hooked composite to a **transfer meter with a defined baseline**.
- **DROP the freeze. DROP "retire" as a fresh action.** Keep only: *no FUTURE Part is ratified as "validated" on an engagement proxy near a commit until its transfer number exists.* Part 10's gap stays the named debt it already is.

---

### PILLAR 2 — Graph / Knowledge Layer (CIRS framework-coverage + chain moat)

**What HELD:**
- **The headline survives** (the only one of three, in the verifier's amended form).
- Part 11 R1's unit-of-coverage is the **plumbing**: *"a surface = one command file, one skill SKILL.md, one agent file."* (canon-verified, 445). The framework UN-WIRED gate only enumerates frameworks **already derived from command/connector references** (`build-orchestration-projection.cjs:742,1061-1082`). A Brain `:Framework` no command references **never becomes a projection node; the gate never sees it.** (projection-verified)
- The "round-number" relabel is **unbreakable**: the 18 chain confidences are `[0.6,0.64,0.65,0.66,0.66,0.68,0.68,0.69,0.7,0.71,0.72,0.73,0.74,0.76,0.77,0.78,0.8,0.82]` — only **4 of 18** are 0.05-multiples. R6 verbatim: *"FEEDS_INTO carries curated confidence (v1)... Learned weights are a gated future (SEED-009)"* (canon-verified, 463-468). Correct label: **"weighted/curated, not learned."**

**What FAILED / was UNVERIFIABLE:**
- **The dramatic numbers are admin-gated.** `176/76/56/51/8` and `203/171` appear in **ZERO** source-of-truth. (projection-verified: absent)
- Local read-models show **28 projection frameworks (all 28 OPERATES-wired, CI green 28/28)** and **18 chain edges** — two orders of magnitude smaller. (projection-verified)
- The gap is **REAL**: `framework-names.json` = 105 FEEDS_INTO-linked + **7 `curated_extras`** that *"exist in the Brain but are not yet FEEDS_INTO-linked."* (projection-verified)
- **The fix's precondition is admin-gated**: re-sourcing from the live `:Framework` population needs an admin query or a Phase-137 snapshot.

**Recommended amendment:**
- ADOPT "coverage one layer down" — re-source the gate's enumeration from the **live `:Framework` population**, require each **trigger-wired OR EXCLUDED-with-reason** (R1 two-state discipline lifted from file-grain to framework-graph grain).
- DROP "round-number"; keep **"weighted/curated, not learned."**
- State magnitude as a **DIRECTIONAL gap, admin-gated** — never "43% of 176 are dark" as fact.

---

### PILLAR 3 — Representation / Prose Layer (the surfaces that quote the corpus)

**What HELD (diagnosis — re-confirmed in refutation):**
- Prose surfaces hand-type ≥**five framework counts** (25, 26, 105/112, 275+, 748/761) and **two term counts** (309 vs 313), no canonical source. (projection-/canon-verified)
- **THE LIVE PROOF holds, stronger than stated:** one `brain_search` returns THREE inconsistent count-sets in one response — lawrence.py (`275/309/157`), schema (`761/313/69`), Pinecone (`1,427/124/325`). The Brain returns **309 AND 313, 275 AND 761, 157 AND 69 from one query.** The disease is INSIDE the Brain's own unversioned corpus. (`brain_search`-confirmed; **NOT admin-gated** — strongest reachable evidence in this proposal)
- `data/brain-corpus-stats.json` does **not exist**; the generator does not emit it. "Stop hand-typing" is net-new discipline. (projection-verified)

**What FAILED / was UNVERIFIABLE:**
- **The prescribed FIX (one local stats artifact) is structurally insufficient.** The live graph is admin-gated; a build-time generator CANNOT read authoritative Neo4j counts. `--refresh-names` reads the FEEDS_INTO name slice (105 names), NOT a census. A local file would re-introduce hand-seeding or **freeze one similarity-lottery chunk as canonical** — laundering the contradiction into an authoritative-looking file. A LOCAL file cannot cure a REMOTE self-contradicting corpus.
- Comparator numbers **176, 264, 171 — never confirmed.** Books found as 7/59/69/157, never 176.
- One sub-claim **FAILS outright**: "no curated confidences in a THE-BRAIN.md R6 row" — THE-BRAIN.md has **ZERO R6 rows**; R6 lives in `MINDRIAN-CANON.md:463` and says the OPPOSITE. Mislocated and inverted. (canon-verified)

**Recommended amendment:**
- ADOPT the diagnosis + "stop hand-typing." Emit `data/brain-corpus-stats.json`; make `SKILL.md:31`, `pws-lexicon-full.md:3+499`, `CLAUDE.md`, `docs/THE-BRAIN.md` read from it.
- **THREE guards or it does net harm:** (1) stamp `read_date + source_chunk + admin_unverified`, never ground truth; (2) reject the 176/264/171 framing; (3) it is **necessary-but-insufficient** — pair with a **Brain-corpus reconciliation ticket** fixing the ingested source docs (`lawrence.py` 309/157, `neo4j-schema-navigator` 313/761/69) to a dated read.

---

## 3. Sequencing — which does the most work, and what is admin-gated

**Most work first → least:**

1. **PILLAR 1 Part A FIRST.** The only amendment that is (a) Academic/external-verified at its core, (b) implementable today with **zero admin-graph dependency** (canon-text change to Part 5 + Part 10 provenance), (c) corrects the highest-stakes defect (validating commit-class user-outcome claims on the wrong construct) and forecloses the *next* override. This is the highest-value SURVIVING amendment — the natural "entry 28."

2. **PILLAR 3's diagnosis SECOND**, only as a dated/admin-unverified snapshot + parallel reconciliation ticket. The `brain_search` self-contradiction is the most concretely-verified finding here (no admin key needed). Ship "stop hand-typing" now; the artifact carries the three guards; the corpus reconciliation is the real (partly admin-gated) cure.

3. **PILLAR 2 THIRD — direction adopted now, implementation gated.** The relabel ships immediately and free. "Coverage one layer down" is a correct target but its **precondition is admin-gated** (live `:Framework` enumeration) — a declared-deferred obligation, not same-session code.

**Explicitly gated on admin-graph access we could not get this run:**
- Pillar 1: the actual transfer NUMBER for Part 10 (needs real testers, not just admin).
- Pillar 2: the true dark-framework denominator + the live re-sourced gate (admin Cypher or Phase-137 snapshot).
- Pillar 3: which of 748/761, 309/313, 69/157 is authoritative + the source-doc reconciliation (admin Cypher).

**Honest caveat:** raw Cypher was admin-gated this run, so whether Brain telemetry already approximates a transfer signal (P1) or a coverage census (P2) is unknown. All "no transfer meter exists" / "gate enumerates only the union" findings are **projection-verified, not graph-verified.**

---

## 4. Concrete draft — "Appendix D entry 28" (highest-value survivor: Pillar 1 Part A)

Entries run through 27 / canon v1.16, so this is **entry 28 / v1.17**. Pillars 2 and 3 are NOT warranted as canon-text amendments this run (see after the draft).

> **DRAFT — Appendix D entry 28 (canon v1.16 → v1.17) — NOT YET RATIFIED**
>
> **Part 5 + Part 10 transfer-evidence amendment (canon_parts 5/6/10).** Part 5 gains an outcome-specific evidence requirement; Part 10's Ratification provenance swaps its deferred validation instrument.
>
> **Part 5 addition (after line 227):** *"For a claim that asserts a USER OUTCOME (that the navigator thinks, learns, decides, or performs better) at a commit-class ratification, the Academic/Operational bar is satisfied only by a TRANSFER measurement — evidence that the navigator solves a NOVEL problem better after the interaction than without it — against a DEFINED baseline. An engagement, confidence, retention, or 'thinking-partner' satisfaction proxy does NOT satisfy this bar; published evidence (Lee et al., CHI 2025, N=319: higher AI-confidence associates with LESS critical thinking) shows engagement can run opposite to the outcome. The transfer construct and its baseline are named in the claim's evidence record before ratification."*
>
> **Part 10 Ratification-provenance addition (appended to the 386 block, which is preserved byte-for-byte):** *"Recalibration (2026-06-25 proposal): the deferred v1.14.0 validation instrument is changed from the Hooked re-score (Eyal 2014 composite, an engagement proxy) + the 'thinking partner' empathy audit to a TRANSFER meter — a measured novel-problem-solving delta for navigators who used Larry vs a defined baseline (instrument precedent: LearnLM UK RCT, arXiv 2512.23633, +5.5pp inter-topic transfer over a defined comparator). The Hooked composite measures engagement, not the learning outcome Part 10 claims; the transfer meter measures the claimed outcome directly. This swaps the INSTRUMENT of the existing named debt; it does NOT re-open ratification and does NOT freeze the amendment cadence (entries 21-27 shipped post-ratification and are unaffected). The comparator baseline must be DEFINED before the meter becomes a hard gate (the cited RCT's 5.5pp is vs human-only tutoring, not vs answer-giving)."*
>
> **Governance:** navigator-gated frozen-text addition via the Part 6 dog-fooding canon-amendment-on-itself mechanism, mirroring entries 14/15/18/19/21/22/23. Mints no edge/node/reach type; opens no Brain wire; changes no frozen Part 3 contract. **Explicitly DROPS** the source critique's "freeze new amendments" clause (refuted by the entries 21-27 ledger) and its "retire the Hooked gate" verb (already overridden + named-debt). Map row + canon text change; header 1.16 → 1.17.

---

### Why Pillars 2 and 3 are NOT drafted as canon entries this run

- **Pillar 2** — the surviving relabel ("weighted/curated, not learned") is a **prose correction to descriptive docs, not a constitutional amendment** (R6 already states it correctly in canon, 463-468 — nothing to amend). The "coverage one layer down" half is a real target but its **precondition is admin-gated**; canonizing an obligation whose denominator we cannot enumerate would mint an un-checkable rule. Correct disposition: a **SEED** under Part 11 — `SEED: re-source the framework UN-WIRED gate from the live :Framework population (admin-gated / Phase-137-gated)`.
- **Pillar 3** — the strongest-verified diagnosis here, but the cure is half local-discipline, half admin-gated reconciliation. The local half (`brain-corpus-stats.json` + three guards) is a **code/docs change, not canon text**. The admin half is a **ticket**. Canonizing "stop hand-typing" would be doctrine inflation for a build-generator task. Correct disposition: a **debug/reconciliation ticket** + the guarded artifact, NOT an Appendix D entry.

**Net:** one canon entry warranted this run (entry 28, Pillar 1 Part A). Pillar 2 converts to one Part-11 SEED; Pillar 3 to one reconciliation ticket + a guarded artifact — because their surviving substance is either already-stated-in-canon (R6) or admin-gated below the bar at which a constitutional amendment should be minted.

---

*End of proposal. PROPOSAL ONLY — no canon file was modified. All population numbers are projection-verified or admin-gated, never graph-verified; the only graph-adjacent confirmation is the `brain_search` corpus self-contradiction (Pillar 3), which required no admin key.*
