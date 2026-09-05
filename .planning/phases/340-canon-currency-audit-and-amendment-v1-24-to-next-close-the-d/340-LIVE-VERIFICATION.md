# Phase 340 Live Verification (Wave 0)

**Verified:** 2026-09-05

Every command below was run today, from `/home/jsagi/dev/MindrianOS-Plugin` (WORKSPACE GUARD
confirmed via `pwd` before the battery started - never `~/.claude/plugins/mindrian-os/`), against
the checked-out repo. Each finding is tagged against its 340-RESEARCH.md claim: CONFIRMED (same
value as research), MOVED (different value, both recorded), or CONTRADICTED (research claim was
wrong). Command output is recorded literally, not paraphrased. House rule: hyphens only, no
em-dashes.

---

## Wave B inputs (Part 4, Part 9, Appendix B)

### 1. Live `ALLOWED_EDGE_TYPES` (Part 4)

Command:
```
node -e "const e=require('./lib/core/navigation/edges.cjs'); const a=[...e.ALLOWED_EDGE_TYPES].sort(); console.log(a.length); console.log(a.join('\n'))"
```

Literal output:
```
44
AFFILIATED_WITH
ATTRIBUTED_TO
AUTHORED_BY
COMPETES_WITH
CONCERNS
CONTRADICTS
CONVERGES
DECOMPOSED_INTO
DEFERRED
DERIVED_FROM
DESCRIBES
DISCOVERED
ELEVATES_TO
ENABLES
FEEDS_INTO
FILED_AS_DECISION
FOLLOWS_FROM
INFORMS
INSTANTIATES
INVALIDATES
MAPS_TO_SECTION
NESTED_WITHIN
NOT_REMEMBERED_BECAUSE
OPERATOR_TRANSITION
PART_OF
PIVOTED
REFINES
REJECTED
REJECTED_BECAUSE
RELATED_TO
REMEMBERED_AS
ROOT_CAUSES
SELECTED_REACH
SHARES_JOB
SOURCED_FROM
STATES
SUPERSEDES
SUPPLIES_TO
SUPPORTS
TAGGED_WITH
UMBILICAL_TO
USES_COMPONENT
USES_FRAMEWORK
VALIDATES
```

**CONFIRMED** against 340-RESEARCH.md's "44 edge types" claim - length and membership unchanged
since research ran.

Cross-check: Part 4's prose (`docs/MINDRIAN-CANON.md:217`) names exactly 29 types across its five
listed categories (decision-and-cascade: INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES,
DEFERRED, REJECTED, REJECTED_BECAUSE, FOLLOWS_FROM, SUPERSEDES, DERIVED_FROM, FILED_AS_DECISION,
OPERATOR_TRANSITION; structural/lineage: AFFILIATED_WITH, FEEDS_INTO, VALIDATES, STATES, SUPPORTS,
DESCRIBES, NESTED_WITHIN; dial-decision: PIVOTED, SELECTED_REACH; Knowledge-rung: REFINES,
ROOT_CAUSES, INSTANTIATES; domain-taxonomy: DECOMPOSED_INTO, PART_OF, TAGGED_WITH, RELATED_TO).
44 minus 29 = 15, matching the candidate-gap count below exactly. No new edge type has been added
since research ran that is already cited in Part 4's prose (the 29-name list is unchanged).

### 2. Per-type absence check (the 15 candidate gap types)

Command run once per type: `grep -c "<TYPE>" docs/MINDRIAN-CANON.md`

| Type | Count | Verdict |
|------|-------|---------|
| `ATTRIBUTED_TO` | 0 | GAP - confirmed absent, real candidate for Part 4 reconciliation |
| `AUTHORED_BY` | 0 | GAP - confirmed absent |
| `COMPETES_WITH` | 0 | GAP - confirmed absent |
| `CONCERNS` | 0 | GAP - confirmed absent |
| `DISCOVERED` | 0 | GAP - confirmed absent |
| `ELEVATES_TO` | 0 | GAP - confirmed absent |
| `MAPS_TO_SECTION` | 0 | GAP - confirmed absent |
| `NOT_REMEMBERED_BECAUSE` | 0 | GAP - confirmed absent |
| `REMEMBERED_AS` | 0 | GAP - confirmed absent |
| `SHARES_JOB` | 0 | GAP - confirmed absent |
| `SOURCED_FROM` | 0 | GAP - confirmed absent (see also item 7 below - Wave A input) |
| `SUPPLIES_TO` | 0 | GAP - confirmed absent |
| `UMBILICAL_TO` | 0 | GAP - confirmed absent |
| `USES_COMPONENT` | 0 | GAP - confirmed absent |
| `USES_FRAMEWORK` | 0 | GAP - confirmed absent |

All 15 types return count 0. **None is "DROP - already cited"** - every one of the 15 candidate
types 340-RESEARCH.md named is still a live, uncited gap today. **CONFIRMED**, byte-for-byte
matching 340-RESEARCH.md's Part 4 finding.

### 3. `insertNode(` call-site counts (both scopes)

Commands and literal output:
```
$ grep -rn "insertNode(" lib/ | wc -l
112
$ grep -rl "insertNode(" lib/ | wc -l
35
$ grep -rn "insertNode(" lib/core/ | wc -l
82
$ grep -rl "insertNode(" lib/core/ | wc -l
27
```

**MOVED** against 340-RESEARCH.md's "80 sites / 26 files scanning `lib/core/` only" claim. Today's
`lib/core/`-scoped numbers are 82 sites / 27 files (research's own text already flagged this
chokepoint as "still actively accreting callers" two days after the prior 16+18 handoff figure, so
continued growth is expected, not a data error). The full `lib/` scope (not previously reported by
research at all) is 112 sites / 35 files - the Canon prose for D-01 should state explicitly which
scope its number describes, per the plan's own instruction. **Recommendation for wave B: cite
BOTH numbers with their scope labelled** (`lib/core/`: 82 sites / 27 files; all of `lib/`: 112
sites / 35 files), and treat either as "growing," never a frozen count.

### 4. `ALLOWED_EPISTEMIC_TYPES` (node-insert.cjs)

Command: `grep -n "ALLOWED_EPISTEMIC_TYPES" lib/core/node-insert.cjs` then Read of the array
(lines 113-117):
```javascript
const ALLOWED_EPISTEMIC_TYPES = Object.freeze(new Set([
  'observation', 'extracted_fact', 'derived_fact', 'model_derived_assertion',
  'interpretation', 'hypothesis', 'assumption', 'conclusion',
  'recommendation', 'decision',
]));
```

Member list (10 members, exact order): `observation`, `extracted_fact`, `derived_fact`,
`model_derived_assertion`, `interpretation`, `hypothesis`, `assumption`, `conclusion`,
`recommendation`, `decision`.

**CONFIRMED** against 340-RESEARCH.md's "10 members" claim - identical list, identical count.

### 5. Coverage exclusions (node-insert.cjs header)

Command: `grep -n "memory-events.cjs\|rs-sqlite-mirror.cjs" lib/core/node-insert.cjs`

Literal output:
```
7: * (`lib/core/navigation/memory-events.cjs` append-only bookkeeping dedupe,
8: * `lib/core/rs-sqlite-mirror.cjs` bulk-write hot path) routes through here.
80: * exclusions): `lib/core/navigation/memory-events.cjs:772` (append-only
82: * `lib/core/rs-sqlite-mirror.cjs:407` (bulk-write hot path; a per-row
199: * exclusions): nodes written by lib/core/navigation/memory-events.cjs and
200: * lib/core/rs-sqlite-mirror.cjs carry NO validated epistemic_type.
```

**CONFIRMED** - both named exclusions (`lib/core/navigation/memory-events.cjs`,
`lib/core/rs-sqlite-mirror.cjs`) are still documented in the file's own header, with exact line
citations (7-8, 80, 82, 199-200) available for D-01's prose if line-level citation is wanted.

### 6. Current line numbers (STATEMENT substitution, L2 CONTEXT.md writer, L3 references/ factory)

Commands and literal output:
```
$ grep -n "STATEMENT" lib/core/room-skeleton-scaffold.cjs
578:          STATEMENT: meta.statement || meta.purpose,
579:          STATEMENT_YAML: escapeYamlDoubleQuoted(meta.statement || meta.purpose),
(plus unrelated comment hits at 449, 567, 573, 575 - not the substitution site itself)

$ grep -n "CONTEXT.md" lib/core/room-skeleton-scaffold.cjs
(writeSectionContracts function, lines 313-356; targetPath write at line 356:
    const targetPath = path.join(roomDir, slug, 'CONTEXT.md');)

$ grep -n "references" lib/core/section-registry.cjs
39: * Directories that are structural (not sections). `references` (Phase 275,
44:const STRUCTURAL_DIRS = ['meetings', 'team', 'references'];
```

Additional Read confirms `writeReferenceDocs` (the L3 references/ factory writer) begins at line
381 in `lib/core/room-skeleton-scaffold.cjs`, with its doc-comment spanning to approximately
line 404.

**CONFIRMED** for the STATEMENT substitution: lines 578-579 are byte-identical to
340-RESEARCH.md's cited 578-579 - no drift.

**CONFIRMED (same function, near-identical range)** for the L2 CONTEXT.md writer:
`writeSectionContracts` spans lines 313-356 today versus research's cited 316-356 - a 3-line
shift at the function's own doc-comment start, not the write site itself (the write site,
`targetPath = ... 'CONTEXT.md'`, sits at line 356 in both).

**CONFIRMED (same function, near-identical range)** for the L3 references/ factory:
`writeReferenceDocs` begins at line 381 today versus research's cited 385-399 - a small shift
inside the same doc-comment block. Today's citation for D-02's Appendix B prose should read
`lib/core/room-skeleton-scaffold.cjs:381+` (function start) rather than reusing research's exact
385-399 span verbatim, since line numbers drift as this file grows.

---

## Wave A inputs (Part 12 Sourced Claims)

### 7. `SOURCED_FROM` runtime writer (closes 340-RESEARCH.md Open Question 2)

Command: `grep -rn "SOURCED_FROM" lib/ scripts/`

Key literal hits (full grep produced 20 lines total; the ones establishing a REAL writer and REAL
consumers are excerpted here):
```
lib/core/navigation/reasoning-write.cjs:185:      edge_type: 'SOURCED_FROM',
lib/mcp/tools/gate.cjs:170: ... An approve verdict ALSO writes a typed decision node with
  SOURCED_FROM provenance edges to the card's subject/evidence node ids, plus a USES_FRAMEWORK
  edge when the gate came from a chain halt with an active framework ...
lib/mcp/tools/views.cjs:318: ... Also writes a typed claim node (epistemic_type defaults to
  'conclusion') plus SOURCED_FROM provenance edges to evidence_node_ids, through the SAME shared
  writer gate_answer's approve branch uses.
lib/mcp/tool-router.cjs:1488: // carries the SOURCED_FROM provenance target gate_answer's own ...
scripts/vault-section-minto-generator.cjs:421: WHERE e.type IN ('SOURCED_FROM','DERIVED_FROM')
```

Also present: extensive design-intent comments in `lib/core/navigation/edges.cjs` (lines 807-869,
998, 1005) discussing `SOURCED_FROM` as the provenance edge, including one comment noting an
EARLIER state where it was "DESIGNED and FILED but NOT implemented" - that earlier state is now
superseded by the live writer confirmed above.

**One unambiguous sentence:** `SOURCED_FROM` DOES have a confirmed real runtime writer -
`lib/core/navigation/reasoning-write.cjs` (line 185, `edge_type: 'SOURCED_FROM'`), consumed by
`lib/mcp/tools/gate.cjs`'s `gate_answer` approve branch and by `lib/mcp/tools/views.cjs`'s
`artifact_file` tool, both routing through the same shared writer.

**CONFIRMED** against 340-RESEARCH.md Open Question 2 and the planner's pre-check cited in the
plan's own action text - wave A may cite `SOURCED_FROM` and its writer with confidence.

### 8. Doctrine gap counts (Sourced Claims doctrine still absent)

Commands and literal output:
```
$ grep -c -i "sourced\|hedge\|fabricat" docs/MINDRIAN-CANON.md
7
$ grep -c -i "sourced\|hedge\|fabricat" agents/larry-extended.md
2
```

**MOVED** against 340-RESEARCH.md's "zero mentions... anywhere in Part 12's current text" framing
- that claim was scoped to Part 12 specifically and remains true (Part 12's own text, canon line
652, contains one "hedged" hit for the EXISTING elevation-tone doctrine, which is about confidence
framing, not source-existence, exactly as research described). The whole-document grep here
(scope: entire Canon, not just Part 12) returns 7 hits, all traced and none is a Sourced Claims
Doctrine mention:

- Line 652 (Part 12, existing): "delivered hedged, cautious, evidence-backed" - confidence-tone
  doctrine, not source-existence doctrine.
- Lines 799, 801, 803, 805, 807, 809 (Appendix D entries 32-37): each contains "no two-gauge
  reading was taken or fabricated" / "not fabricated here" - a truthful self-disclosure about a
  DEFERRED METRIC, not language about claim provenance.

`agents/larry-extended.md`'s 2 hits: line 69 ("You fabricate no autonomous_safe tag") and line 102
("Elevation has three DIRECTIONS, all hedged...") - both pre-existing doctrine unrelated to Sourced
Claims.

**One unambiguous sentence:** the Sourced Claims Doctrine gap SEED-086 names is still fully open in
both files - zero existing text in either file addresses "a claim with no source at all, wrapped in
a hedge word that gets treated as pre-cleared," despite both files containing unrelated hits for
"hedge"/"fabricat" that a naive single-keyword grep could mistake for doctrine coverage.

---

## Wave C inputs (Appendix C, Part 2, Part 7, Part 11, CLAUDE.md)

### 9. Brain origin resolver (brain-client.cjs)

Command: `grep -n "BRAIN_URL\|THEO_ORIGINS\|getBrainUrl" lib/core/brain-client.cjs`

Key literal lines:
```
40:const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://theo-mcp.onrender.com';
1204:function getBrainUrl() {
1205:  return BRAIN_URL;
1819:const THEO_ORIGINS = Object.freeze(['https://theo-mcp.onrender.com']);
```

**CONFIRMED** against 340-RESEARCH.md - live default origin is `https://theo-mcp.onrender.com`,
`getBrainUrl()` (line 1204-1206) is the single resolver, `THEO_ORIGINS` (line 1819) is a frozen
allow-list containing only that one origin. No drift since research ran.

### 10. Canon Brain/Theo mentions

Commands and literal output:
```
$ grep -n "pws-brain-mcp.onrender.com" docs/MINDRIAN-CANON.md
728:- Brain - the remote methodology repository (pws-brain-mcp.onrender.com). Strategic thinking tools only. Never a store for user data.
$ grep -c -i "theo" docs/MINDRIAN-CANON.md
0
```

**CONFIRMED** - Appendix C's Glossary entry (line 728) still names the stale
`pws-brain-mcp.onrender.com` origin, and the Canon contains zero mentions of "Theo" anywhere.
Unchanged since research ran.

### 11. "25 methodology" and Pinecone citations, classified PRESCRIPTIVE vs DESCRIPTIVE/HISTORICAL

Commands and literal output:
```
$ grep -n "25 methodology" docs/MINDRIAN-CANON.md CLAUDE.md
CLAUDE.md:73:- **Part 7 - Reuse Before Build.** Search the 25 methodology commands first and justify any net-new surface against them, since duplicating an existing command is the more common failure mode than missing a genuine gap. Deep dive: docs/MINDRIAN-CANON.md (Part 7).
CLAUDE.md:109:**Core Value:** Run the full PWS methodology (25 methodology bots, structured pipelines, and an intelligent Data Room) inside Claude Code with zero infrastructure to host or manage yourself -- the plugin runs serverless, and the remote Brain is required for methodology, registering silently on first use, guided by the same teaching intelligence that powers the classroom.
CLAUDE.md:159:- Reuse before build: search the 25 methodology commands first; every feature works on all three surfaces.
docs/MINDRIAN-CANON.md:256:Before building a new command, skill, agent, or hook, the builder must search the 25 methodology commands first. Most features are existing features repointed.

$ grep -n "Pinecone" docs/MINDRIAN-CANON.md
40:  CROSS-DOMAIN MATCH  against Pinecone embeddings (12,401 methodology nodes in Brain's semantic index). Cross-domain analogies surface where embedding similarity crosses threshold but source domains differ. Every match is a candidate Opportunity Bank ADD with HSI score. Command-level wrappers: /mos:find-bottlenecks, /mos:find-connections, /mos:find-analogies, /mos:score-innovation.
48:- Pinecone 12,401 embeddings (Brain semantic search infrastructure)
757:11. **User correction 10: "Engine 1 is Act 1, code-driven via embeddings + HSI."**... Powered by existing Python scripts (sentence-transformers + LSA) and Pinecone embeddings (12,401 methodology nodes)...
761:13. **Corpus figures corrected (2026-05-20).**... Pinecone `pws-brain`: 12,401 vectors at 1024-dim multilingual-e5-large (was "1,427")...
767:16. **Corpus figures corrected (2026-06-11).**... Pinecone `pws-brain`: 12,413 vectors at 1024-dim across five namespaces...
```

Classification:

| Line | File | Classification | Reasoning |
|------|------|----------------|-----------|
| `CLAUDE.md:73` | CLAUDE.md | PRESCRIPTIVE | Instructs "search... first" - correctness depends on the number |
| `CLAUDE.md:109` | CLAUDE.md | PRESCRIPTIVE-ADJACENT | States the Core Value figure directly ("25 methodology bots") - a factual claim about product surface |
| `CLAUDE.md:159` | CLAUDE.md | PRESCRIPTIVE | Instructs "search... first" - correctness depends on the number |
| `docs/MINDRIAN-CANON.md:256` | Canon Part 7 | PRESCRIPTIVE | "the builder must search the 25 methodology commands first" - a hard gate instruction |
| `docs/MINDRIAN-CANON.md:40` | Canon Part 2 | PRESCRIPTIVE | Names Pinecone as the LIVE current backend of the Engine 1 cross-domain-match capability - not historical, an active architecture claim |
| `docs/MINDRIAN-CANON.md:48` | Canon Part 2 | PRESCRIPTIVE | Same subsection, repeats the live-infrastructure claim |
| `docs/MINDRIAN-CANON.md:757` | Appendix D entry 11 | DESCRIPTIVE/HISTORICAL, **OFF LIMITS** | A dated provenance record of a past user correction (2026-05-xx era) - append-only history, never rewritten |
| `docs/MINDRIAN-CANON.md:761` | Appendix D entry 13 | DESCRIPTIVE/HISTORICAL, **OFF LIMITS** | Explicitly named in the plan as off-limits - "Corpus figures corrected (2026-05-20)," a snapshot of what was true then |
| `docs/MINDRIAN-CANON.md:767` | Appendix D entry 16 | DESCRIPTIVE/HISTORICAL, **OFF LIMITS** | Explicitly named in the plan as off-limits - "Corpus figures corrected (2026-06-11)," a snapshot of what was true then |

**CONFIRMED** against 340-RESEARCH.md's Part 7 finding (the "25 methodology" figure is repeated 4
times total, 3 in CLAUDE.md + 1 in the Canon, all PRESCRIPTIVE) and Part 2 finding (Pinecone still
named as the live backend in lines 40 and 48, both PRESCRIPTIVE; the historical Appendix D entries
11/13/16 are correctly excluded from any wave C edit).

Live commands directory count for context: `ls commands/*.md | wc -l` = 113 (see item 12 below) -
the "25" figure undercounts the real surface by roughly 4.5x, unchanged since research ran.

### 12. Four-glob surface counts

Commands and literal output:
```
$ ls commands/*.md | wc -l
113
$ ls agents/*.md | wc -l
14
$ ls pipelines/*/CHAIN.md | wc -l
4
$ ls skills/*/SKILL.md | wc -l
126
```

**CONFIRMED** against 340-RESEARCH.md's cited figures (113 / 14 / 4 / 126) - identical to what
research recorded, no drift.

### 13. Declaring-versus-exempt split per class, plus `check-shape-declaration.cjs --check`

Commands (run per glob) and literal output:
```
commands/*.md total=113 declaring=113 excluded=28
agents/*.md total=14 declaring=10 excluded=6
pipelines/*/CHAIN.md total=4 declaring=4 excluded=0
skills/*/SKILL.md total=126 declaring=122 excluded=37
```

Note on method: "declaring" counts files matching `^hitl_shape:|^hitl_stages:`; "excluded" counts
files matching `^\s*excluded:\s*true` - these two counts are NOT mutually exclusive sets (a file
can match both patterns, which is itself one of the live violations the gate below reports), so
declaring + excluded may exceed total for a class, as seen in commands (113 + 28 > 113) and skills
(122 + 37 > 126).

```
$ node scripts/check-shape-declaration.cjs --check
```
Tail of literal output:
```
WARN: shape-declaration advisory (Phase 210): 53 violation(s) detected; not blocking (run with --strict to restore hard-fail)
[53 individual WARN lines follow, each naming one surface path and its specific conflict -
overwhelmingly "declares hitl_shape AND connector.excluded:true simultaneously" on skill files]
Recovery: run node scripts/backfill-hitl-shape.cjs, or hand-author the missing declaration per
docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason if this skill
reaches no fork.
```
Exit code: `0` (advisory since Phase 210, per Appendix D entry 37 - a non-zero violation count
with exit 0 is EXPECTED, not a failure, exactly as the plan's own action text states).

**MOVED** against 340-RESEARCH.md's flag of "~20+ WARN-level declaration conflicts" - the live,
exact count today is **53 violations**, exit 0. This is materially higher than research's
approximate figure; the underlying cause (the same class of conflict - a skill declaring BOTH a
Decision-Gate-fork shape AND the no-fork exemption simultaneously) is unchanged, but the count has
grown. Wave C should cite 53 as today's number, not research's "~20+" approximation, if this
number is cited at all (Part 11's own doctrine already self-disclaims the count as "never a frozen
scalar... enumerated from disk at run time," so citing an exact number risks re-creating the same
staleness class this phase exists to close - the safer prose keeps the "enumerated from disk"
framing and drops any hardcoded total).

### 14. `docu-optimizer` skill existence (closes 340-RESEARCH.md Open Question 3)

Commands and literal output:
```
$ ls .claude/skills/
agentshield
$ ls .claude/skills/docu-optimizer/SKILL.md
ls: cannot access '.claude/skills/docu-optimizer/SKILL.md': No such file or directory
$ find . -name "SKILL.md" -path "*docu*"
[empty - zero results]
```

**One unambiguous sentence:** `.claude/skills/docu-optimizer/SKILL.md` does NOT exist anywhere in
the tree - `.claude/skills/` contains only `agentshield`, and no `SKILL.md` matching "docu" exists
at any path in the repo.

**CONFIRMED** against 340-RESEARCH.md's planner pre-check finding and closes Open Question 3: the
docu-optimizer skill CLAUDE.md's Project Skills table names does not exist on disk. Wave C's
CLAUDE.md-side fix (correcting the "25 methodology" / Pinecone-adjacent figures) has no
docu-optimizer method to defer to or reuse - the row in CLAUDE.md's Project Skills table naming
this path is itself a currency defect the plan should consider flagging, separate from the Part
7/Part 2 prose fixes.

---

## Pre-existing RED baseline (so no later wave misreads it)

Commands run and PASS/FAIL recorded:

| Test | Result | Notes |
|------|--------|-------|
| `node tests/test-canon-frozen-scalars-floor.cjs` | **PASS** (15 assertions) | Required-green leg, confirmed clean |
| `node tests/test-canon-entry-31-two-gauge-floor.cjs` | **PASS** (56 assertions) | Required-green leg, confirmed clean; version anchor at 1.24 |
| `node tests/test-canon-entry-36-shape-declaration-floor.cjs` | **PASS** (63 assertions) | Required-green leg, confirmed clean; version anchor at 1.24 |
| `node tests/test-195-canon-7-kind-floor.cjs` | **PASS** (11 assertions) | Required-green leg, confirmed clean |
| `node tests/test-canon-crossref-completeness.cjs` | **FAIL** (exit 1) | PRE-EXISTING RED, out of scope (see below) |
| `node tests/test-canon-part-9-ratification.cjs` | **FAIL** (exit 1, 7/9 passed) | PRE-EXISTING RED, out of scope (see below) |

**Failing assertion text, `test-canon-crossref-completeness.cjs`:**
```
FAIL: CANON-PHASE-MAP.md contains Part 9 (proposed) subsection - Missing "### Part 9 (proposed)" H3 heading
FAIL: docs/MINDRIAN-CANON.md is NOT edited to add Part 9 (deferred to Phase 109 release gate) - MINDRIAN-CANON.md was edited to add Part 9 - this is a Phase 108 violation. Part 9 ratification is Phase 109 release gate (CONTEXT D-06).
```

**Failing assertion text, `test-canon-part-9-ratification.cjs`:**
```
FAIL t4_canonVersionBumped: canon header declares Version: 1.4
FAIL t8_mapCanonReferenceV14: map Canon reference header says (v1.4)
test-canon-part-9-ratification: 7/9 passed
```

**Root cause, in writing, confirmed live:** both tests are Phase-108/109-era tests, pinned to
version anchors from BEFORE Part 9 was ratified into the live Canon (they assert the canon header
still says `Version: 1.4` and that Part 9 is NOT yet present as a shipped section - both
assumptions were true at Phase 108/109's own execution time and have since been correctly
superseded by every canon amendment from entry 12 onward, most recently entry 37 bumping the
canon to `Version: 1.24`). These are historical test anchors pinned to a pre-Part-9-ratification
document state; fixing them would mean rewriting what they assert about a past state, which is a
separate concern from this phase's currency-audit-and-amendment scope.

**CONFIRMED** against 340-RESEARCH.md's own pre-check finding and the plan's own framing - both
tests are OUT OF SCOPE for Phase 340 and MUST NOT be registered as required-green legs in
`tests/run-all-340.sh`.

---

## Deltas against 340-RESEARCH.md

| # | Claim in 340-RESEARCH.md | Live re-check result | Verdict |
|---|---------------------------|----------------------|---------|
| 1 | `insertNode(` has "80 sites / 26 files scanning `lib/core/` only" | `lib/core/`: 82 sites / 27 files. All of `lib/`: 112 sites / 35 files (new scope, not previously reported) | MOVED |
| 2 | "~20+ WARN-level declaration conflicts" from `check-shape-declaration.cjs --check` | 53 violations, exit 0 | MOVED |
| 3 | L2 CONTEXT.md writer at lines 316-356 | `writeSectionContracts` spans 313-356 today (3-line shift at doc-comment start; write site itself unchanged at line 356) | MOVED (minor) |
| 4 | L3 references/ factory at lines 385-399 | `writeReferenceDocs` begins at line 381 today (small shift inside the same doc-comment block) | MOVED (minor) |
| 5 | Sourced Claims doctrine "zero mentions... anywhere in Part 12" | Confirmed true for Part 12 specifically; a whole-canon grep for the same keywords returns 7 unrelated hits elsewhere in the document (all traced, none is Sourced Claims doctrine) | CONFIRMED (research's Part-12-scoped claim was accurate; this record adds the whole-document context so no later wave mistakes an unrelated "hedged"/"fabricated" hit for existing doctrine coverage) |

All other findings in 340-RESEARCH.md's "Part-by-Part Currency Findings" section (the 44-member
edge-type set, the 15 candidate gap types, the `ALLOWED_EPISTEMIC_TYPES` 10-member list, the
STATEMENT substitution lines, the coverage exclusions, the `SOURCED_FROM` writer confirmation, the
Brain origin resolver, the canon Brain/Theo mentions, the "25 methodology" and Pinecone citation
counts, the four-glob surface counts, and the docu-optimizer non-existence) are **CONFIRMED**
byte-for-byte or line-for-line identical to what research recorded, with zero drift since
2026-09-05's research pass (same-day re-verification, as expected given the short interval).

---

## Zero-byte-write confirmation

`git status --porcelain` was checked before and after this entire battery. No command in this
record wrote to any of the four protected files:

```
$ git status --porcelain | grep -E "docs/MINDRIAN-CANON.md|docs/CANON-PHASE-MAP.md|^ M CLAUDE.md|agents/larry-extended.md"
NONE - clean
```

Zero bytes written to `docs/MINDRIAN-CANON.md`, `docs/CANON-PHASE-MAP.md`, `CLAUDE.md`, or
`agents/larry-extended.md` by this task, as required.
