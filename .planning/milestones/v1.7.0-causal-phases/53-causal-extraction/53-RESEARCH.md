# Phase 53: Causal Extraction - Research

**Researched:** 2026-04-03
**Domain:** LLM-driven structured extraction, KuzuDB CRUD, CJS bridge pattern, command authoring
**Confidence:** HIGH

## Summary

Phase 53 adds the extraction pipeline that turns room artifact text into structured CausalClaim nodes in KuzuDB. The entire data flow is: user runs `/mos:causal extract` on an artifact, Larry reads the artifact and identifies causal statements, presents them as a confirmation table, user accepts/edits/rejects, confirmed claims get written as JSON to `.causal-extract.json`, then the CJS bridge (`causal-to-kuzu.cjs`) writes CausalClaim nodes + EXTRACTED_FROM edges to KuzuDB.

All building blocks exist. Phase 52 already created the CausalClaim node table (12 properties) and EXTRACTED_FROM edge table in `lazygraph-ops.cjs`. The `hsi-to-kuzu.cjs` bridge script provides the exact pattern to follow. The `root-cause.md` and `graph.md` commands show the command structure. The primary new work is: (1) two CRUD functions in lazygraph-ops.cjs, (2) a new CJS bridge script, (3) the `/mos:causal` command markdown, and (4) a test script.

**Primary recommendation:** Follow the existing patterns exactly -- `createAnalogyEdge()` pattern for CRUD, `hsi-to-kuzu.cjs` pattern for bridge, `root-cause.md` pattern for command, `test-phase-27-kuzu-schema.sh` pattern for tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Extraction is command-driven via `/mos:causal extract`, not automatic. User controls when extraction runs.
- **D-02:** Three Gaps enforcement: every claim MUST have explicit mechanism and falsifiable prediction. Claims missing either are flagged as "incomplete" and not written to KuzuDB until completed.
- **D-03:** Max 5 claims per artifact to prevent graph pollution.
- **D-04:** Confidence scored by extraction method: observed=0.7, asserted=0.5, inferred=0.3.
- **D-05:** Larry proposes claims in a table, user confirms/edits/rejects before writing to KuzuDB. No automated extraction without human review.
- **D-06:** Rejected claims are noted but not stored. Reason for rejection captured if provided (Decision 13: rejection is data).
- **D-07:** Extracted claims presented as inline table: cause | mechanism | effect | confidence | domain. User can accept all, accept individual, edit, or reject.
- **D-08:** 7 domains: materials, business, competitive, financial, team, legal, general. Larry classifies based on artifact section and content.
- **D-09:** Follow existing Python-JSON-CJS pattern. Larry extracts claims as JSON, CJS bridge (causal-to-kuzu.cjs) writes confirmed claims to KuzuDB.

### Claude's Discretion
- Exact extraction prompting strategy (how Larry identifies causal statements in text)
- How to handle ambiguous causation ("after X, Y happened" vs "X caused Y")
- Presentation formatting details within the table structure

### Deferred Ideas (OUT OF SCOPE)
- Automatic extraction in post-write hook (Phase 55)
- Batch extraction across all room artifacts (future)
- Cross-artifact causal claim merging
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTRACT-01 | Larry can extract cause/mechanism/effect triples from room artifacts via /mos:causal extract | Command pattern from root-cause.md + graph.md; CRUD from createAnalogyEdge() pattern |
| EXTRACT-02 | Every extracted claim links to its source artifact via EXTRACTED_FROM edge (provenance) | EXTRACTED_FROM table exists in schema; createExtractedFromEdge() follows createAnalogyEdge() pattern |
| EXTRACT-03 | Confidence scoring varies by extraction method: observed=0.7, asserted=0.5, inferred=0.3 | Mapped to extraction_method property on CausalClaim; bridge sets confidence based on method |
| EXTRACT-04 | Domain classification: materials, business, competitive, financial, team, legal, general | Set in CausalClaim.domain property; Larry classifies in extraction prompt |
| EXTRACT-05 | Max 5 claims per artifact to prevent graph pollution | Enforced in command prompt instructions + bridge script validation |
| EXTRACT-06 | Three Gaps enforcement: every claim requires explicit mechanism and falsifiable prediction | Enforced in command prompt (Larry flags incomplete) + bridge script rejects empty mechanism/prediction |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **CJS is sole KuzuDB writer** -- Python/Larry output JSON, CJS writes to graph. Never add kuzu to Python.
- **Three surfaces** -- CLI, Desktop, Cowork. Command must work across all three.
- **Tier 0 functional** -- extraction works without Brain or Pinecone. Brain enriches but never gates.
- **No TypeScript** -- plain CJS with JSDoc if needed.
- **No em-dashes** -- use hyphens instead.
- **ICM-native** -- folder structure IS the orchestration.
- **MWP moat deepening** -- every feature must deepen integration of 7 MWP layers.
- **Release process** -- CHANGELOG.md + plugin.json version bump required for user-facing changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| kuzu (npm) | 0.11.3 | KuzuDB embedded graph database | Already installed, sole graph store |
| Node.js CJS | >=18 | Bridge scripts, CRUD functions | Established pattern (hsi-to-kuzu.cjs, lazygraph-ops.cjs) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (builtin) | -- | Generate CausalClaim IDs | Already used in lazygraph-ops.cjs for content hashing |
| fs/path (builtin) | -- | Read/write .causal-extract.json | Standard JSON bridge I/O |

No new dependencies required. Everything uses existing stack.

## Architecture Patterns

### Recommended File Structure

```
lib/core/lazygraph-ops.cjs          # ADD: createCausalClaim(), createExtractedFromEdge()
scripts/causal-to-kuzu.cjs          # NEW: CJS bridge reading .causal-extract.json
commands/causal.md                   # NEW: /mos:causal command (extract subcommand)
tests/test-phase-53-causal-extract.sh # NEW: Test script
```

### Pattern 1: CRUD Functions in lazygraph-ops.cjs

**What:** Add `createCausalClaim()` and `createExtractedFromEdge()` following the exact pattern of `createAnalogyEdge()` (lines 512-534).

**When to use:** Every time a confirmed causal claim needs to be written to KuzuDB.

**Example (derived from createAnalogyEdge pattern):**

```javascript
/**
 * Create a CausalClaim node in KuzuDB.
 * @param {object} conn - KuzuDB Connection
 * @param {object} claim - Claim properties
 * @returns {Promise<boolean>}
 */
async function createCausalClaim(conn, claim) {
  const id = esc(claim.id);
  const cause = esc(claim.cause || '');
  const mechanism = esc(claim.mechanism || '');
  const effect = esc(claim.effect || '');
  const confidence = claim.confidence || 0.5;
  const evidence = esc(JSON.stringify(claim.evidence || []));
  const sourceArtifact = esc(claim.source_artifact || '');
  const domain = esc(claim.domain || 'general');
  const prediction = esc(claim.falsifiable_prediction || '');
  const novelty = claim.novelty_score || 0.0;
  const method = esc(claim.extraction_method || 'inferred');
  const created = esc(claim.created || new Date().toISOString().slice(0, 10));

  await conn.query(
    `MERGE (c:CausalClaim {id: '${id}'})
     ON CREATE SET c.cause = '${cause}',
                   c.mechanism = '${mechanism}',
                   c.effect = '${effect}',
                   c.confidence = ${confidence},
                   c.evidence = '${evidence}',
                   c.source_artifact = '${sourceArtifact}',
                   c.domain = '${domain}',
                   c.falsifiable_prediction = '${prediction}',
                   c.novelty_score = ${novelty},
                   c.extraction_method = '${method}',
                   c.created = '${created}'
     ON MATCH SET c.cause = '${cause}',
                  c.mechanism = '${mechanism}',
                  c.effect = '${effect}',
                  c.confidence = ${confidence},
                  c.evidence = '${evidence}',
                  c.source_artifact = '${sourceArtifact}',
                  c.domain = '${domain}',
                  c.falsifiable_prediction = '${prediction}',
                  c.novelty_score = ${novelty},
                  c.extraction_method = '${method}',
                  c.created = '${created}'`
  );
  return true;
}

/**
 * Create an EXTRACTED_FROM edge linking CausalClaim to source Artifact.
 * @param {object} conn - KuzuDB Connection
 * @param {string} claimId - CausalClaim ID
 * @param {string} artifactId - Artifact ID
 * @returns {Promise<boolean>}
 */
async function createExtractedFromEdge(conn, claimId, artifactId) {
  await conn.query(
    `MATCH (c:CausalClaim {id: '${esc(claimId)}'}), (a:Artifact {id: '${esc(artifactId)}'})
     MERGE (c)-[:EXTRACTED_FROM]->(a)`
  );
  return true;
}
```

**Source:** Derived from `createAnalogyEdge()` at lines 512-534 of lazygraph-ops.cjs. [HIGH confidence -- direct code inspection]

### Pattern 2: CJS Bridge Script (causal-to-kuzu.cjs)

**What:** Standalone CJS script that reads `.causal-extract.json` from room directory and writes confirmed claims to KuzuDB.

**When to use:** After Larry extracts claims and user confirms them. Larry writes the JSON file, then the bridge is called.

**Follow exactly:** `hsi-to-kuzu.cjs` pattern (lines 1-171):
1. Read room dir from `process.argv[2]`
2. Check if `.causal-extract.json` exists, exit silently if not
3. Parse JSON
4. Open graph via `openGraph(roomDir)`
5. Loop through claims, call `createCausalClaim()` + `createExtractedFromEdge()` for each
6. Close graph, report counts to stderr

### Pattern 3: Command Structure (causal.md)

**What:** New `/mos:causal` command with `extract` subcommand.

**When to use:** User invokes `/mos:causal extract <artifact-path>`.

**Follow:** `root-cause.md` and `graph.md` patterns:
- YAML frontmatter: name, description, allowed-tools (Read, Write, Bash, Glob)
- Setup section: read references and room state
- Session flow: extract, present table, confirm, write
- When complete: call bridge script

### Pattern 4: .causal-extract.json Schema

**What:** JSON intermediate file that Larry writes after user confirmation.

```json
{
  "source_artifact": "problem-definition/market-pain",
  "extracted_at": "2026-04-03",
  "claims": [
    {
      "id": "causal-a1b2c3d4",
      "cause": "Equipment downtime averaging 12 hours per incident",
      "mechanism": "Uncoated surfaces degrade under thermal cycling, requiring shutdown for replacement",
      "effect": "Production losses of $50K per incident drive demand for protective coatings",
      "confidence": 0.7,
      "extraction_method": "observed",
      "domain": "materials",
      "falsifiable_prediction": "If downtime drops below 4 hours with new coating, coating demand in this segment should decrease",
      "evidence": ["problem-definition/market-pain"]
    }
  ],
  "rejected": [
    {
      "cause": "Market is growing",
      "effect": "Company will succeed",
      "rejection_reason": "Too vague, no specific mechanism"
    }
  ]
}
```

**Key design decisions:**
- Claim IDs: `causal-` prefix + 8 hex chars from `crypto.randomBytes(4).toString('hex')`
- `rejected` array captures D-06 (rejection is data) without writing to KuzuDB
- `evidence` array defaults to `[source_artifact]`

### Anti-Patterns to Avoid

- **Direct KuzuDB writes from Larry/Python:** Always go through CJS bridge. Larry writes JSON only.
- **Auto-extraction without confirmation:** D-05 is locked. Larry proposes, user confirms. Period.
- **More than 5 claims per artifact:** D-03 caps at 5. The command prompt must enforce this.
- **Claims without mechanism or prediction:** D-02 requires both. Bridge script must validate and reject incomplete claims.
- **Generic mechanisms:** "It causes it" is not a mechanism. The extraction prompt must demand specificity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KuzuDB CRUD | Raw Cypher in every script | `createCausalClaim()` in lazygraph-ops.cjs | Central CRUD avoids Cypher duplication, ensures consistent escaping |
| JSON bridge I/O | Custom file handling per script | Follow hsi-to-kuzu.cjs open-use-close pattern | Proven pattern, handles segfault-on-exit gracefully |
| Claim ID generation | UUIDs or sequential counters | `crypto.randomBytes(4).toString('hex')` with `causal-` prefix | Matches existing content hash pattern, short enough for display |
| Causal keyword detection | NLP library (spaCy, compromise) | LLM extraction in command prompt | Larry IS the NLP engine. Adding dependencies violates Tier 0 rule |

**Key insight:** The entire extraction intelligence lives in the command prompt, not in code. Code handles CRUD and validation only.

## Common Pitfalls

### Pitfall 1: LLM Hallucinated Claims (from PITFALLS-causal.md, Pitfall 2)
**What goes wrong:** Larry extracts cause-effect relationships not present in source text. "Market is growing" becomes "Market growth CAUSES competitive advantage."
**Why it happens:** LLMs generate plausible causal chains from correlation or juxtaposition.
**How to avoid:** Three Gaps enforcement in prompt: every claim needs explicit cause text, mechanism text, and effect text extracted from the source. If mechanism is inferred (not in text), mark as `extraction_method: 'inferred'` with confidence 0.3.
**Warning signs:** Claims where mechanism is generic ("through market forces") or absent.

### Pitfall 2: Over-Extracting Claims (from PITFALLS-causal.md, Pitfall 6)
**What goes wrong:** Every sentence becomes a causal claim. 10 artifacts produce 200 claims. Graph becomes noise.
**How to avoid:** D-03 caps at 5 per artifact. Prompt instructs Larry to extract only EXPLICIT causal statements containing "because," "causes," "leads to," "results in," "enables," "prevents." Require minimum mechanism specificity.
**Warning signs:** Artifacts generating exactly 5 claims every time (Larry filling quota vs. being selective).

### Pitfall 3: Orphan CausalClaim Nodes (from PITFALLS-causal.md, Pitfall 5)
**What goes wrong:** CausalClaim created but EXTRACTED_FROM edge missing. Provenance queries return nothing.
**How to avoid:** Bridge script must atomically create both node AND edge. Never create a CausalClaim without its EXTRACTED_FROM edge. The bridge should verify the source Artifact node exists before writing.
**Warning signs:** `graphStats()` shows CausalClaim count > EXTRACTED_FROM edge count.

### Pitfall 4: Cypher Injection via User-Edited Claims
**What goes wrong:** User edits a claim to include single quotes or special characters. The `esc()` function in lazygraph-ops.cjs only escapes single quotes.
**How to avoid:** The existing `esc()` function handles single quotes. Also truncate cause/effect to 200 chars and mechanism to 300 chars as documented in schema. Validate in bridge script before writing.
**Warning signs:** Bridge script crashes on user-edited claims with special characters.

### Pitfall 5: KuzuDB Segfault on Exit
**What goes wrong:** KuzuDB 0.11.3 segfaults during Node.js process exit after `db.close()`. Test scripts see non-zero exit code despite correct behavior.
**How to avoid:** Tests check output correctness via grep, not exit code. Use `|| true` after node command. Already solved in test-phase-27-kuzu-schema.sh pattern.
**Warning signs:** Tests failing with segfault despite correct output.

## Code Examples

### Example 1: Bridge Script Core Loop

```javascript
// Source: derived from hsi-to-kuzu.cjs lines 80-110
const { openGraph, closeGraph, createCausalClaim, createExtractedFromEdge } = require('../lib/core/lazygraph-ops.cjs');

// ... read .causal-extract.json ...

let claimCount = 0;
for (const claim of data.claims) {
  // Validate Three Gaps (EXTRACT-06)
  if (!claim.mechanism || !claim.falsifiable_prediction) {
    process.stderr.write(`Skipping incomplete claim ${claim.id}: missing mechanism or prediction\n`);
    continue;
  }
  // Enforce max 5 (EXTRACT-05)
  if (claimCount >= 5) {
    process.stderr.write(`Max 5 claims per artifact reached, skipping remaining\n`);
    break;
  }
  // Set confidence by method (EXTRACT-03)
  const confidenceMap = { observed: 0.7, asserted: 0.5, inferred: 0.3 };
  claim.confidence = confidenceMap[claim.extraction_method] || 0.5;

  try {
    await createCausalClaim(conn, claim);
    await createExtractedFromEdge(conn, claim.id, claim.source_artifact);
    claimCount++;
  } catch (e) {
    process.stderr.write(`Failed to write claim ${claim.id}: ${e.message}\n`);
  }
}
```

### Example 2: Command Extraction Prompt Strategy

```markdown
## Extraction Instructions

Read the artifact at the specified path. Identify EXPLICIT causal statements.

Look for these patterns:
- "X causes Y" / "X leads to Y" / "X results in Y"
- "Because of X, Y happens"
- "X enables Y" / "X prevents Y"
- "When X, then Y (because Z)"

For each causal statement found:
1. **Cause** -- what produces the effect (quote or paraphrase from text, max 200 chars)
2. **Mechanism** -- HOW the cause produces the effect (must be specific, not generic)
3. **Effect** -- what happens as a result (quote or paraphrase, max 200 chars)
4. **Extraction method** -- observed (data-backed), asserted (author states), inferred (you deduced)
5. **Domain** -- classify: materials | business | competitive | financial | team | legal | general
6. **Falsifiable prediction** -- what testable prediction would disprove this claim?

Rules:
- Maximum 5 claims per artifact. Be selective, not exhaustive.
- If mechanism is unclear, mark as "inferred" (confidence 0.3).
- Correlation is NOT causation. "After X, Y happened" is NOT a causal claim unless mechanism is stated.
- Every claim MUST have a non-empty mechanism and falsifiable prediction (Three Gaps).
```

### Example 3: User Confirmation Table Format

```
Extracted 3 causal claims from problem-definition/market-pain.md:

| # | Cause | Mechanism | Effect | Conf | Domain |
|---|-------|-----------|--------|------|--------|
| 1 | Equipment downtime 12h/incident | Uncoated surfaces degrade under thermal cycling | $50K production loss per incident | 0.7 | materials |
| 2 | Competitor pricing at $200/sqft | Below-cost pricing to capture market share | Margin pressure on existing players | 0.5 | competitive |
| 3 | FDA approval timeline 18 months | Regulatory review requires 3 rounds of testing data | Market entry delayed, competitor advantage | 0.3 | legal |

Actions:
- Accept all: write all 3 claims to your knowledge graph
- Accept #1,#3: write specific claims (comma-separated numbers)
- Edit #2: modify a claim before accepting
- Reject #2: remove from list (provide reason to improve future extraction)
- Reject all: discard extraction
```

### Example 4: Calling Bridge from Command

```bash
# After user confirms, Larry writes .causal-extract.json then calls bridge
node "${CLAUDE_PLUGIN_ROOT}/scripts/causal-to-kuzu.cjs" "room/"
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash test scripts (test-*.sh pattern) |
| Config file | tests/run-all.sh (runner) |
| Quick run command | `bash tests/test-phase-53-causal-extract.sh` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXTRACT-01 | createCausalClaim() writes node to KuzuDB | unit | `bash tests/test-phase-53-causal-extract.sh` | Wave 0 |
| EXTRACT-02 | createExtractedFromEdge() writes EXTRACTED_FROM edge | unit | same test script | Wave 0 |
| EXTRACT-03 | Confidence set by extraction method (0.7/0.5/0.3) | unit | same test script | Wave 0 |
| EXTRACT-04 | Domain stored correctly on CausalClaim node | unit | same test script | Wave 0 |
| EXTRACT-05 | Bridge rejects >5 claims per artifact | unit | same test script | Wave 0 |
| EXTRACT-06 | Bridge rejects claims missing mechanism or prediction | unit | same test script | Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/test-phase-53-causal-extract.sh`
- **Per wave merge:** `bash tests/run-all.sh`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test-phase-53-causal-extract.sh` -- covers EXTRACT-01 through EXTRACT-06
- [ ] `tests/fixtures/test-room-causal/` -- fixture room with sample artifacts for extraction testing

## Sources

### Primary (HIGH confidence)
- `lib/core/lazygraph-ops.cjs` -- direct code inspection of CausalClaim schema (line 121-148), CRUD patterns (createAnalogyEdge lines 512-534), graphStats CausalClaim support (lines 417-458)
- `scripts/hsi-to-kuzu.cjs` -- direct code inspection of CJS bridge pattern (171 lines)
- `commands/root-cause.md` -- direct inspection of command structure with frontmatter
- `commands/graph.md` -- direct inspection of KuzuDB query command pattern with inline node scripts
- `docs/lazygraph-schema.md` -- CausalClaim schema documentation (12 properties, EXTRACTED_FROM edge)
- `tests/test-phase-27-kuzu-schema.sh` -- test pattern for KuzuDB schema testing (246 lines)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE-causal.md` -- data flow architecture, component boundaries
- `.planning/research/PITFALLS-causal.md` -- 10 pitfalls with prevention strategies
- `references/brain/query-patterns.md` -- Patterns 11-13 for causal framework selection (Brain enrichment context)

### Tertiary (LOW confidence)
- None -- all findings verified from direct code inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code patterns
- Architecture: HIGH -- direct derivation from hsi-to-kuzu.cjs and createAnalogyEdge patterns
- Pitfalls: HIGH -- documented in PITFALLS-causal.md and verified against actual code
- Command structure: HIGH -- direct inspection of root-cause.md and graph.md

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- no external dependency changes expected)
