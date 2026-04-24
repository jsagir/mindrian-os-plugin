# /mos:power-demo -- Reusable Power Demonstration Prompt

**Version:** 1.17.0 (post-phase-90 -- brain-derivation-layer aware)
**Predecessor:** 1.0 (Ador IP Credit Test session, 2026-04-24)

**What changed in 1.17.0:**

- Extraction now reads per-section `BRAIN.md` files produced by phase 90 brain-derivation-layer.
- New intelligence sub-page: `/intelligence/brain-derived.html` surfacing the derivation loop.
- Provenance timeline renders governing_thought sha256 evolution (the learning signal).
- ReverseSalientAgent outputs (phase 89-07) rendered alongside opportunity bank.
- Mode C hybrid RS pairs (`room_artifact` + `external_doc` structs from phase 89-05) surfaced on cross-relationships page.
- llms.txt canonical arc updated to mention the brain-derivation layer as part of the intellectual-evolution story.
- Graceful degradation preserved: rooms without phase-90 artifacts render the pre-90 experience with a single callout.

**Purpose.** Generate a Vercel-deployable multi-page HTML hub that demonstrates the full layered intelligence of MindrianOS against any single room. Output is AI-readable AND human-readable. Every claim on the site traces to a file, a graph edge, a computed metric, or a derivation hash in the underlying room. Nothing is invented for narrative.

**Invocation.** Claude reads this prompt and runs the ten phases in order. No interactive questions. Fail-safe halts if any extraction fails. The only input is the room path.

```bash
# User invokes with a single line:
Read ~/MindrianOS-Plugin/scripts/power-demo-prompt.md and execute against ROOM_PATH=~/MindrianRooms/{slug}/
```

---

## HARD RULES (non-negotiable)

1. **NO INVENTION.** Every numeric claim, every relationship, every opportunity name, every governing_thought citation must trace to a specific file path, SQL query result, JSON key, sha256 hash, or command output. Zero exceptions.
2. **NO FILLER.** No sentences like "Mindrian enables powerful intelligence." If it cannot be shown, it is not said.
3. **GRACEFUL DEGRADATION.** If a room has no opportunities, the opportunities page says "Opportunity bank empty. Run /mos:find-connections to populate." It does NOT invent opportunities. Same for scenarios, thesis, whitespace, BRAIN.md, brain-derivation queue.
4. **EVERY HYPERLINK RESOLVES.** If you cite a page, that page exists on disk. If a page cites a source file, the source file exists.
5. **NO EMOJI. NO EM-DASHES.** Hyphens only. Approved glyphs: &#9632; &#9660; &#9654; &#9655; &#9500;&#9472; &#9492;&#9472; &#10003; &#8226; &#9888; &#9889; &#11036; &rarr;
6. **EVERY PAGE HAS THE AI-NARRATOR META.** JSON-LD + OG tags + `<link rel="alternate" type="text/markdown" href="./llms.txt">`. If any page lacks these, the final check fails.
7. **FAIL FAST.** If Phase 1 extraction fails, write a diagnostic to `exports/power-demo-FAILED.md` and halt. Do not proceed with partial data.
8. **BRAIN BOUNDARY (CANON PART 8).** Brain-derived content is consumed; user-specific bytes never egress. If any extraction or page would require sending LOCAL artifacts to Brain, STOP.

---

## INPUTS

- `ROOM_PATH` -- absolute path to the room (provided at invocation).
- `OUTPUT_DIR` -- `{ROOM_PATH}/exports/power-demo-YYYY-MM-DD/` where YYYY-MM-DD is today's UTC date.
- `PLUGIN_ROOT` -- `~/.claude/plugins/mindrian-os/` (for script and template references).

Resolve dynamically:

- `ROOM_NAME` -- last path segment of ROOM_PATH
- `VENTURE_NAME` -- from `{ROOM_PATH}/STATE.md` frontmatter (field `venture_name` or `project_name`), fallback to ROOM_NAME
- `VENTURE_STAGE` -- from `{ROOM_PATH}/STATE.md` frontmatter, fallback to "Unknown"
- `GRAPH_DB` -- `{ROOM_PATH}/.room-graph/graph.db` if present, otherwise `{ROOM_PATH}/.mindrian/room.db` if present, otherwise null (skip graph-dependent pages with degradation note)
- `BRAIN_DERIVATION_AVAILABLE` -- true if `{ROOM_PATH}/.mindrian/brain-derivation-queue.json` exists OR any section folder contains `BRAIN.md`. Drives post-phase-90 page rendering.

---

## PHASE 0: Pre-flight validation

Verify before any generation:

```bash
test -d "$ROOM_PATH" || die "Room path does not exist"
test -f "$ROOM_PATH/STATE.md" || warn "No STATE.md; derived fields will be limited"
mkdir -p "$OUTPUT_DIR"/{assets,intelligence,provenance,thesis,scenarios,graph,deck,artifacts}
```

If `STATE.md` missing, proceed but emit a callout on the hub: "State file missing; counts below are directly computed from filesystem."

If `BRAIN_DERIVATION_AVAILABLE` is false, the hub's top strip shows "Brain-derivation layer: not yet active (pre-phase-90 room)". Do not fail. Pages in the brain-derived cluster render their empty-state callouts.

---

## PHASE 1: Extraction (writes `{OUTPUT_DIR}/assets/extract.json`)

Run each of these in sequence. Any failure halts with a diagnostic to `{ROOM_PATH}/exports/power-demo-FAILED.md` listing which extractions succeeded and which failed.

### 1.1 Graph census (skip if no GRAPH_DB)

```sql
SELECT kind, COUNT(*) n FROM nodes GROUP BY kind ORDER BY n DESC;
SELECT rel, COUNT(*) n FROM edges GROUP BY rel ORDER BY n DESC;
SELECT n.kind, n.label, COUNT(e.id) degree
  FROM nodes n LEFT JOIN edges e ON e.src = n.id OR e.dst = n.id
  GROUP BY n.id ORDER BY degree DESC LIMIT 20;

-- All nodes and edges for the interactive graph page
SELECT kind, key, label FROM nodes;
SELECT e.rel, s.kind src_kind, s.key src_key, s.label src_label,
                t.kind dst_kind, t.key dst_key, t.label dst_label
  FROM edges e JOIN nodes s ON e.src = s.id JOIN nodes t ON e.dst = t.id;
```

Record: per-kind node counts, per-rel edge counts, top 20 most-connected nodes, full node/edge arrays for visualization.

### 1.2 Opportunity bank (if exists)

```bash
find "$ROOM_PATH/opportunity-bank" -maxdepth 1 -name "opp-*.md" | sort
```

For each file: extract frontmatter YAML, H1 title, first paragraph. Record path and parsed fields.

If no opportunity-bank/ directory, record `opportunities: []`.

### 1.3 Intelligence outputs (graceful NOT_PRESENT)

For each path below, extract listed fields. If missing, record `{"NOT_PRESENT": true}`.

| File | Fields |
|------|--------|
| `.mindrian/whitespace-results.json` | metadata, gap count, top 10 gaps by strategic_rank, novelty score distribution |
| `.mindrian/discovery-hsi-whitespace.json` | zone count, strong/moderate/weak breakdown |
| `.mindrian/discovery-analogy-whitespace.json` | zone count, top 5 analogies |
| `.mindrian/discovery-rs-whitespace.json` | bottleneck count |
| `.mindrian/disruption-index.json` | metadata.room_cd, D/C/B counts |
| `.mindrian/blindspot-coverage.json` | metadata.room_coverage |
| `.mindrian/element-novelty.json` | metadata.mean_novelty, max, min |
| `.mindrian/surprise-scores.json` | top 5 by surprise_score |
| `.mindrian/topic-forest.json` | cluster counts at coarse/medium/fine |

### 1.4 Artifact inventory

```bash
find "$ROOM_PATH" -name "*.md" \
  -not -path "*/.*" -not -path "*/exports/*" -not -path "*/node_modules/*"
```

For each: relative path, mtime, first non-heading line (preview). Sort by mtime desc. Record count and top 20 most recent.

### 1.5 Section folders

```bash
find "$ROOM_PATH" -maxdepth 1 -mindepth 1 -type d \
  -not -name ".*" -not -name "exports" -not -name "assets" -not -name "team"
```

List visible section folders.

### 1.6 DD / decision trace

```bash
grep -nE "APPROVE|REJECT|DEFER|DECIDED|GATE" "$ROOM_PATH/STATE.md" 2>/dev/null
find "$ROOM_PATH/meetings" -name "*.md" 2>/dev/null
```

Extract decisions with reason and date where available.

### 1.7 Thesis / scenarios / key narrative artifacts

Check existence of:

- `{ROOM_PATH}/financial-model/investment-thesis.md` OR most recent in financial-model/
- `{ROOM_PATH}/market-analysis/scenario-plan-*.md`
- `{ROOM_PATH}/problem-definition/ROOM.md`

Record paths of any that exist. These will drive the thesis, scenarios, and problem-framing pages.

### 1.8 Venture identity

From STATE.md head: venture_name, venture_stage, total_entries. From top-level ROOM.md if exists: one-line purpose.

### 1.9 BRAIN-DERIVED content per section (NEW in 1.17.0 -- phase 90)

```bash
find "$ROOM_PATH" -maxdepth 3 -name "BRAIN.md" -not -path "*/exports/*" -not -path "*/.*"
```

For each `BRAIN.md` found:
- section path (parent folder)
- governing_thought sha256 from frontmatter (if present) or compute from file body
- derivation timestamp (mtime)
- whether it follows Feynman-MINTO structure (heuristic: presence of MINTO opening + Feynman simplification marker)
- file size in bytes (proxy for enrichment depth)

Also capture the brain-derivation queue state if present:

```bash
cat "$ROOM_PATH/.mindrian/brain-derivation-queue.json" 2>/dev/null
cat "$ROOM_PATH/.mindrian/brain-derivation-log.json" 2>/dev/null
```

Record: queue depth, last processed entry timestamp, last 10 processed entries (section + sha256 transition + reason + duration).

**Critical (Canon Part 8 audit):** Confirm the queue entries contain ONLY section name, sha256 hashes, ISO timestamp, and reason string. If ANY entry contains raw user text, artifact excerpts, or identifying strings beyond the canonical schema, halt with a Brain-boundary violation diagnostic.

### 1.10 ReverseSalient agent output (NEW in 1.17.0 -- phase 89-07)

```bash
find "$ROOM_PATH/.mindrian" -name "rs-agent-*.json" 2>/dev/null
find "$ROOM_PATH" -name "rs-findings-*.md" 2>/dev/null
```

For each RS-agent output: mode (bypass/warm-cold/hybrid per phase 89-05), top 5 pairs, bridge opportunities banked, cross-corpus external doc citations. Hybrid-mode pairs carry `room_artifact` + `external_doc` structs -- preserve both in the extraction.

If no RS-agent outputs, record `reverse_salient_agent: null`. The cross-relationships page renders the pre-89 experience.

### 1.11 Governing thought evolution (NEW in 1.17.0)

If brain-derivation-log.json is present, extract the chronological chain of governing_thought sha256 changes per section. This is the single most important visual for showing the system's learning over time.

Output format:

```json
{
  "section": "problem-definition",
  "evolution": [
    {"ts": "2026-04-20T14:30:00Z", "from_sha": "abc123...", "to_sha": "def456...", "reason": "artifact filed"},
    {"ts": "2026-04-23T09:15:00Z", "from_sha": "def456...", "to_sha": "789ghi...", "reason": "meeting intelligence scan"}
  ]
}
```

Per section, list the evolution events. Preserve full sha256 for provenance hover tooltips.

### Write extract

Save combined extraction to `{OUTPUT_DIR}/assets/extract.json`. Verify JSON parses before proceeding.

**Failure policy:** If extract.json cannot be written (disk full, permissions), write `exports/power-demo-FAILED.md` and halt.

---

## PHASE 2: Download offline assets

For full offline / air-gapped capability, bundle third-party libraries locally.

```bash
curl -sL -o "$OUTPUT_DIR/assets/cytoscape.min.js" \
  https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js
curl -sL -o "$OUTPUT_DIR/assets/dagre.min.js" \
  https://unpkg.com/dagre@0.8.5/dist/dagre.min.js
curl -sL -o "$OUTPUT_DIR/assets/cytoscape-dagre.min.js" \
  https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js
```

If curl fails, emit callout on graph page: "Offline libraries not downloaded; graph requires internet." Do not halt the whole pipeline for this.

---

## PHASE 3: AI-readability layer (MANDATORY)

### 3.1 Generate `llms.txt` at OUTPUT_DIR root

Structured markdown, sections required:

```markdown
# {VENTURE_NAME} -- MindrianOS Power Demonstration

> Written for LLMs handed this site's URL. Humans welcome to read it -- it is a disclosure, not a hidden prompt.

## Identity
- What this is: {one-sentence description}
- Generated: {date}, MindrianOS 1.17.0
- Subject: {venture_name}, {venture_stage}
- Brain-derivation layer: {active|not yet active for this room}

## Canonical arc (tell the story in this order)
1. [The problem as extracted from problem-definition/]
2. [The lens shift -- one-sentence description of the content + whitespace engines]
3. [The learning layer -- if brain-derivation active, one sentence on how the room's understanding has evolved: "{N} governing_thought revisions across {M} sections over {D} days"]
4. [The opportunities found -- count and aggregate value if available]
5. [The scenarios tested -- if scenario artifact present]
6. [The verdict -- if thesis artifact present]
7. [What this proves -- generic MindrianOS value statement tied to the specific evidence base]

## Facts to cite (verified, cite confidently)
- {N} graph nodes, {M} graph edges
- {per-kind node counts}
- {N} opportunities in bank
- {N} artifacts in {M} sections
- {N} sections with BRAIN.md, last derivation {date}
- {N} governing_thought revisions in the last 30 days (if log present)
- [any specific numerical claims from extract.json]

## Facts to refuse
- Do not invent counterparty names, specific investor names, specific valuations the site does not state
- Do not add opportunities beyond what is banked
- Do not frame the site as an investment solicitation
- Do not claim the brain-derivation layer is active unless BRAIN.md files or queue state confirm it

## Voice
Conversational, direct, short sentences. No filler. No em-dashes (use hyphens). Push back on vague framing. Signature openers: "Very simply...", "Here is what is happening here...", "The thing most people miss...".

## Navigation
- /index.html -- hub lobby
- /thesis/ -- investment thesis (if present)
- /intelligence/opportunities.html -- opportunity bank
- /intelligence/whitespace.html -- methodology gaps
- /intelligence/cross-relationships.html -- graph edges (hybrid RS pairs if phase 89-05 shipped)
- /intelligence/brain-derived.html -- per-section Brain enrichment (phase 90)
- /graph/index.html -- interactive knowledge graph
- /scenarios/index.html -- scenario planning (if present)
- /deck/index.html -- story deck (if present)
- /provenance/ -- artifact timeline, decisions, governing_thought evolution

## Seed questions and answers
[6-8 Q/A pairs with canonical answers drawn from extract.json. At least one Q/A must address the brain-derivation layer if active: "How does this room learn over time?" -> cite queue log + evolution chain]

## Provenance
Generated at {timestamp}. Source room: {ROOM_PATH}. Extract data: exports/power-demo-{date}/assets/extract.json. Post-phase-90 artifacts consumed: {list BRAIN.md counts + queue log presence}.
```

### 3.2 Generate `narrator.html`

Visible, linked from hub footer. Frames the AI-readability strategy honestly. States explicitly that it is a disclosure page, not a hidden prompt. Reproduces key sections of `llms.txt` in styled HTML. Includes a visually prominent callout:

> **"This page exists because sites served to LLMs tend to get hallucinated into nonsense unless the canonical narrative is written down somewhere the LLM can reliably read. Rather than hide that behind clever HTML tricks, we wrote it plainly."**

Additional 1.17.0 section: "How this room learns" -- one paragraph describing the brain-derivation layer if active, citing queue depth + recent evolution events. If not active, the section explicitly says "this room predates the brain-derivation layer; learning signal is inferred from artifact mtime only."

### 3.3 Inject into every page's `<head>`

Every generated page must carry:

```html
<link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM canonical narrative" />
<link rel="canonical" href="{this-page-absolute-url}" />

<script type="application/ld+json">
  {"@context": "https://schema.org", "@type": "TechArticle",
   "headline": "{VENTURE_NAME} -- {page-specific}",
   "description": "{page-specific}",
   "datePublished": "{date}",
   "author": {"@type": "Organization", "name": "MindrianOS 1.17.0"}}
</script>

<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:type" content="article" />
<meta name="description" content="..." />
```

---

## PHASE 4: Shared assets

### 4.1 `assets/style.css` -- De Stijl palette

Palette (non-negotiable):
- `--bg: #F5F1EB;` off-white
- `--fg: #1A1A1A;` near-black
- `--red: #E63946;` vermillion accent
- `--blue: #1D3557;` deep blue
- `--blue-light: #457B9D;` cyan accent
- `--yellow: #F4C430;` warning/highlight
- `--amber: #F4A261;` warm accent
- `--muted: #6C757D;` subdued gray

Typography:
- Body: Georgia serif, 17px, line-height 1.6, max-width 68ch
- Headings: Inter / Helvetica Neue sans-serif, 900 weight
- Mono: JetBrains Mono / SF Mono for code, paths, numeric values, sha256 hashes

Layout: sidebar 260px fixed left + main content. Cards use Mondrian grid (4px gaps on black background). No gradients, no shadows, no border-radius. Flat planes only.

NEW in 1.17.0: `.brain-derived` card class renders with a subtle cyan left-rule (3px #457B9D) to visually distinguish Brain-enriched content from LOCAL-only content. Every brain-derived claim is marked.

### 4.2 `assets/glossary.json`

Terms that appear in the site, with definitions. Minimum coverage:

- MindrianOS, PWS, Brain, local graph
- Opportunity Engine, Whitespace Engine, HSI
- Typed edge names (CONTRADICTS, CONVERGES, INVALIDATES, INFORMS, ENABLES, CITES_EVIDENCE)
- CONDITIONAL verdict, strategic floor, scenario planning
- Reverse salient, Mode A/B/C (bypass/warm-cold/hybrid per phase 89-05)
- Governing thought, brain-derivation layer, derivation queue (NEW in 1.17.0)
- Feynman-MINTO (memory compression)
- sha256 (cryptographic fingerprint for change detection)

Extend per-room if specific terms appear in extract.json.

### 4.3 `assets/sidebar.html`

Partial HTML loaded by JavaScript on every page. Contains:
- Venture mark + stage tag
- Gateway links (The Story, Intelligence, Provenance)
- Live counts from extract.json (opportunity count, edge count, artifact count)
- NEW in 1.17.0: "Brain-derivation" mini-panel showing {N} sections derived, queue depth, last derivation timestamp -- or "not active" callout
- MindrianOS version + generation date footer

### 4.4 `assets/nav.js`

Vanilla JS that: injects sidebar, sets active nav based on `body data-page`, loads glossary, wires hover-and-focus tooltips on `<span class="gloss">`. Tooltip content for governing_thought hashes shows the full sha256 and the transition log entry.

---

## PHASE 5: Hub lobby (`index.html`)

The entry point. Four cards as the Strategic Path (adjust based on what's present):

1. **Gateway 1 -- The Verdict** links to `/thesis/index.html` (if thesis exists) or `/intelligence/opportunities.html` (fallback)
2. **Gateway 2 -- The Discoveries** links to `/intelligence/opportunities.html`
3. **Gateway 3 -- The Futures** links to `/scenarios/index.html` (if scenario artifact exists; otherwise replace with `/intelligence/whitespace.html` and re-label "The Gaps")
4. **Gateway 4 -- The Map** links to `/graph/index.html`

Plus:
- Stat strip at top: 8-12 numeric tiles sourced from extract.json. In 1.17.0, include two brain-derivation tiles when active: "{N} sections derived" + "{K} governing-thought revisions".
- Two-engine panel: describes Opportunity Engine vs Whitespace Engine with live counts
- NEW in 1.17.0: "Learning Layer" panel below the engines, describes the brain-derivation loop with queue depth + last derivation timestamp. Links to `/intelligence/brain-derived.html`. If layer not active, render as "Brain-derivation layer: pre-phase-90 room. Upgrade path available." with a subdued visual treatment.
- Footer: provenance, disclaimer, AI-reader disclosure linking to `/narrator.html` and `/llms.txt`

Graceful degradation: if fewer than 4 non-empty gateways are available, lay out 2 or 3 cards with honest labels. Do not invent pages.

---

## PHASE 6: Intelligence pages

### `/intelligence/index.html`

Five-card grid in 1.17.0: Opportunities | Whitespace | Cross-Relationships | Diagnostics | Brain-Derived.

If Brain-derivation not active, render the fifth card as an empty-state with upgrade path.

### `/intelligence/opportunities.html`

- Stat strip: opportunity count, Tranche-1-flagged count, aggregate value range if available, total CITES_EVIDENCE edges
- Two sections: "Content Engine" (opps from graph-based detection) and "Whitespace Engine" (opps from methodology-gap detection) if applicable to the room
- NEW in 1.17.0: "ReverseSalient Agent" section if `rs-agent-*.json` was extracted in Phase 1.10. Lists bridge opportunities banked by the agent with their mode (bypass/warm-cold/hybrid). Hybrid-mode opps display their external_doc citation inline.
- Grid of tiles: one per opportunity, linking to `/artifacts/{slug}.html`
- Each tile: id tag, title, confidence, value range, strategic rank (if present), TRANCHE_1 flag (if present), mode badge (if RS-agent-sourced)
- If empty: callout "Opportunity bank empty. Run /mos:find-connections to populate."

### `/intelligence/whitespace.html`

- Top 10 methodology gaps from `.mindrian/whitespace-results.json` as a table
- Columns: framework | strategic rank | density score | knn density | nearest room artifacts
- Callout explaining the meta-finding (is the corpus tightly clustered or diverse?)
- Links from whitespace-promoted opportunities to their artifact pages
- If whitespace-results.json is NOT_PRESENT: callout "Whitespace analysis not yet run. Run /mos:whitespace map to populate."

### `/intelligence/cross-relationships.html`

- Edge inventory table grouped by rel type (from Phase 1.1)
- Top 10 most consequential edges (prioritize CITES_EVIDENCE, INVALIDATES, CONTRADICTS, CONVERGES if those exist)
- SQL query examples in a mono pull-quote
- NEW in 1.17.0: "Cross-corpus hybrid pairs" section if RS-agent ran in Mode C (phase 89-05). Render as a two-column table: room_artifact label + external_doc citation + similarity score + pair-discovery timestamp. Each row links to both the internal artifact page and the external doc URL.
- Link to interactive graph

### `/intelligence/diagnostics.html`

Metric rows for each Wave-1 algorithm output. If source JSON is NOT_PRESENT, show `NOT PRESENT` with recovery command. Never fabricate.

### `/intelligence/brain-derived.html` (NEW in 1.17.0)

The defining page of the 1.17.0 upgrade. Surfaces the brain-derivation layer as a first-class capability.

Layout:

- **Header strip:** "{N} sections with BRAIN.md | queue depth: {D} | last derivation: {ts}"
- **Section matrix:** one row per section, columns: section name | BRAIN.md size bytes | governing_thought sha256 (monospace, hover shows full hash) | last derivation timestamp | revision count in last 30 days | link to rendered BRAIN.md
- **Recent derivations timeline:** last 10 processed queue entries in descending order. Each entry: section | from_sha -> to_sha (truncated, hover for full) | reason | duration ms
- **Canon Part 8 audit panel:** green check if queue content audit passed (schema-only, no user strings), red alert if violation detected. Cite the Phase 1.9 audit result.
- **Learning arc callout:** "This room has undergone {K} governing-thought revisions across {N} sections since derivation began. Each revision is a formal snapshot of the system's current best understanding, distilled via Feynman-MINTO, enriched by Brain without leaking user data."
- **View BRAIN.md per section:** clicking a row opens `/artifacts/brain-{section-slug}.html` rendering the BRAIN.md verbatim with governing_thought hash prominent at top.

If `BRAIN_DERIVATION_AVAILABLE` is false, the entire page renders as a single callout: "This room predates the brain-derivation layer (phase 90). The learning signal shown elsewhere on this site is inferred from artifact mtime only. To activate: upgrade MindrianOS to 1.17.0+ and run /mos:brain-derive on an active section."

---

## PHASE 7: Graph visualization (`/graph/index.html`)

Interactive Cytoscape.js page. All nodes and edges from extract.json rendered as a force-directed graph.

Required features:
- Node shape by kind (opportunities as diamonds, methodology nodes as hexagons, others as circles)
- Node color by kind (consistent palette mapped in JS)
- Edge color by rel type
- Click node: highlight neighborhood, fade rest, show detail panel with kind + label + connected node list
- Layout toggles: concentric (opportunities at periphery), dagre (hierarchical), cose (spring)
- Kind filters: toggle visibility per node kind
- NEW in 1.17.0: "Brain-derived overlay" toggle. When on, sections with active BRAIN.md glow with a cyan ring (#457B9D). Node hover shows derivation timestamp and governing_thought hash.
- Legend in corner
- Fit-to-viewport button

Under the graph: explainer list describing what each node kind represents in this specific room.

---

## PHASE 8: Narrative pages

### `/thesis/index.html`

If `financial-model/investment-thesis.md` exists, render its content verbatim (markdown to HTML). Add source citation at top: path + date modified. Add "View source markdown" link.

NEW in 1.17.0: If a BRAIN.md exists for the financial-model section, render a cyan-ruled sidebar on the thesis page showing the Brain-derived enrichment. Label: "What Brain adds to this thesis". This is the clearest demonstration of the derivation layer for a skeptical viewer.

If no thesis artifact, show a placeholder page: "No investment thesis yet. Run /mos:build-thesis to generate one."

### `/scenarios/index.html`

If any `market-analysis/scenario-plan-*.md` exists, render its content. Include the 2x2 visualization if axes are detectable from frontmatter.

1.17.0 addition: Pull the market-analysis BRAIN.md if present as a sidebar enrichment.

If none, placeholder: "No scenario plan yet. Run /mos:scenario-plan to generate four futures."

### `/deck/index.html`

If a pre-existing deck HTML file exists in `assets/presentation/` or `exports/`, link to it or iframe-embed it.

If none, placeholder with instruction to run `/mos:MOSDeckEngine`.

---

## PHASE 9: Provenance pages and artifact reproductions

### `/provenance/index.html`

Five-tile hub in 1.17.0: Artifacts | Decisions | Meetings | Timeline | Thought Evolution.

### `/provenance/artifacts.html`

Sortable table from extract.json artifact inventory: date modified | section | filename | preview. 20 most recent at top. Filename links to `/artifacts/{slug}.html`.

### `/provenance/decisions.html`

Decision log from extract.json 1.6. If empty: "No decisions captured yet."

### `/provenance/timeline.html`

Chronological view, one column per week if possible. Artifacts and decisions placed in their week.

NEW in 1.17.0: Governing-thought revisions from Phase 1.11 extraction render as diamond markers above the week columns, colored cyan. Hover shows section + sha256 transition + reason. Clicking a marker opens the `brain-{section-slug}.html` snapshot at that timestamp (if snapshot history is retained; otherwise links to the current BRAIN.md with a note about the historical hash).

### `/provenance/thought-evolution.html` (NEW in 1.17.0)

Dedicated page for the governing_thought evolution chain.

Layout:
- One block per section that has evolution events.
- Within each block, a vertical timeline: each node is a governing_thought hash, connected by labeled arrows describing the reason for transition ("artifact filed", "meeting intelligence scan", "cascade contradiction resolved").
- Per node: timestamp + full sha256 (monospace, copyable) + link to the BRAIN.md state at that revision.
- Footer callout: "The chain above is the formal record of this room's understanding evolving. Every transition is a hash change computed by the brain-derivation layer. Brain was consulted; no user content left the room."

If no evolution log exists, the page renders the empty-state callout with the upgrade path.

### `/artifacts/{slug}.html` (one per opportunity and per key artifact)

Reproduce the source markdown as rendered HTML. Header metadata:
- Source path (mono)
- Date modified
- Section
- Inbound edges (pages that link here)
- Outbound edges (from the artifact's own links)
- "View source markdown" link

Generate one page per opportunity in the bank + one per key cited artifact in the thesis / scenarios.

NEW in 1.17.0: For each section that has a BRAIN.md, generate `/artifacts/brain-{section-slug}.html` rendering the BRAIN.md verbatim. Header shows governing_thought hash prominently + derivation timestamp + Feynman-MINTO structural markers detected.

---

## PHASE 10: Vercel deployment prep + final verification

### 10.1 `vercel.json` at OUTPUT_DIR root

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {"source": "/(.*)", "headers": [
      {"key": "X-Content-Type-Options", "value": "nosniff"},
      {"key": "X-Frame-Options", "value": "SAMEORIGIN"},
      {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"}
    ]},
    {"source": "/llms.txt", "headers": [{"key": "Content-Type", "value": "text/markdown; charset=utf-8"}]}
  ]
}
```

### 10.2 `README.md` at OUTPUT_DIR root

Deployment instructions:

```markdown
# Deploy this hub to Vercel

    cd {OUTPUT_DIR}
    vercel --prod

Output is a public URL that can be sent in an email draft or a Slack message. Share the URL alongside `/narrator.html` URL if the recipient is likely to paste into an LLM.
```

### 10.3 Final verification gate

Before reporting success, verify:

- [ ] `exports/power-demo-{date}/index.html` exists
- [ ] `exports/power-demo-{date}/llms.txt` exists and contains the canonical arc (including learning-layer sentence if active)
- [ ] `exports/power-demo-{date}/narrator.html` exists and is linked from index footer
- [ ] Every `<a href>` in every generated HTML file either resolves to a file in OUTPUT_DIR or is an external URL marked as external
- [ ] Every page has JSON-LD, OG meta tags, and the `llms.txt` alternate link
- [ ] MindrianOS version in all JSON-LD blocks is `1.17.0`, not `1.17` or earlier
- [ ] No emoji, no em-dashes anywhere in the output
- [ ] Only approved glyphs used
- [ ] Every numeric claim on index.html traces to extract.json
- [ ] Graph page renders the full node set AND has offline cytoscape.js bundled (or a callout explaining offline mode)
- [ ] No "lorem ipsum", no "TODO", no placeholder text
- [ ] NEW in 1.17.0: `/intelligence/brain-derived.html` exists. If Brain-derivation active: displays at least one section matrix row. If not active: displays the upgrade-path callout.
- [ ] NEW in 1.17.0: `/provenance/thought-evolution.html` exists with either evolution chain content or empty-state upgrade callout.
- [ ] NEW in 1.17.0: Canon Part 8 audit result visible on `/intelligence/brain-derived.html` (green check OR red alert, not absent).
- [ ] NEW in 1.17.0: Every `<span class="hash">` renders a truncated sha256 with a tooltip showing the full hash.

If any check fails, write a `VERIFICATION-FAILED.md` at OUTPUT_DIR root listing the failures. Do NOT claim success.

---

## PHASE 11: Output summary

Report to user:

```
Power Demo 1.17.0 generated at {OUTPUT_DIR}
  {N} pages generated
  {M} artifacts reproduced
  {K} graph nodes visualized
  AI-narrator layer: llms.txt + narrator.html + {N} JSON-LD blocks
  Brain-derivation: {active|not active} -- {N} sections derived, {K} revisions tracked

Deploy:
  cd {OUTPUT_DIR} && vercel --prod

Shareable narrator URL (once deployed):
  {vercel_url}/narrator
  {vercel_url}/llms.txt

Test locally first:
  cd {OUTPUT_DIR} && python3 -m http.server 8000
  open http://localhost:8000
```

---

## GRACEFUL DEGRADATION RULES

The prompt executes against rooms at every stage of maturity. Handle these cases cleanly:

| Room state | Hub behavior |
|---|---|
| Empty room (no sections, no opportunities) | Hub renders "Room initialized but no methodology artifacts yet. Recommended starting commands: /mos:new-project, /mos:file-meeting." Do not generate sub-pages with placeholder content. |
| No graph DB | Graph page shows: "Local graph not yet built. Run /mos:analyze-room to populate." Hide graph-dependent stat tiles from index. |
| No opportunity bank | Opportunities page shows the empty-state callout. Do not invent opportunities. |
| Some opportunities but no Whitespace engine output | Show opportunities section. Whitespace page shows empty-state callout. |
| Thesis exists, no scenarios | Include thesis gateway. Replace scenarios gateway with whitespace or intelligence tile. |
| Scenarios exist, no thesis | Include scenarios gateway. Replace thesis gateway with "/problem-definition/ summary" page. |
| Artifacts from multiple sessions across long time horizon | Provenance timeline shows activity density. Hub headline reflects the most recent methodology milestone. |
| No BRAIN.md files anywhere | Brain-Derived intelligence card renders empty-state. Hub "Learning Layer" panel reads "pre-phase-90 room". Do not fabricate derivation data. |
| BRAIN.md exists but no queue log | Render Brain-derived page with section matrix only. Skip derivations-timeline widget with "Historical log not retained; current state only". |
| Queue log exists but evolution chain empty | thought-evolution.html renders "Derivation active; no revisions yet." Do not invent revisions. |
| RS-agent output present, Mode C pairs detected | Cross-relationships page renders the hybrid pair section. |
| RS-agent output absent | Cross-relationships page omits the hybrid section entirely. Do not render empty headers. |

---

## ROOM-AGNOSTIC LANGUAGE

Do not hard-code any session-specific language, names, or values anywhere in the generated site. All text must be derived from extract.json or from generic MindrianOS framing. Specifically:

- Do not use specific venture names (Ador, NATlab, Synteris, etc.) unless the room's venture_name contains them
- Do not invent specific inventor names
- Do not inject specific value ranges (e.g. "$32-66M") unless they appear in an actual opportunity frontmatter
- Do not reference specific regulatory bodies (FDA, CE-IVDR) unless they appear in artifact content
- All floor-lift language, verdict language, and narrative arc text must be parameterized by the actual room data

---

## ARTIFACT TEMPLATES (inlined; do not reference external files)

### Hub lobby skeleton

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{VENTURE_NAME} - MindrianOS Power Demonstration</title>
<link rel="stylesheet" href="./assets/style.css">
<link rel="alternate" type="text/markdown" href="./llms.txt">
<link rel="canonical" href="./index.html">
[JSON-LD, OG meta as specified in Phase 3.3]
</head>
<body data-page="index">
<div class="app">
  <div data-sidebar-slot></div>
  <main class="main">
    <div class="bread">{VENTURE_NAME} - Power Demonstration - Generated {DATE}</div>
    <header class="hub-header">
      <div class="rule"></div>
      <h1>{HEADLINE}</h1>
      <p class="sub">{SUB}</p>
    </header>
    [stat strip, gateways, two-engine panel, learning-layer panel, method section, provenance footer]
  </main>
</div>
<script src="./assets/nav.js"></script>
</body></html>
```

### Empty-state callout template

```html
<div class="callout warn">
  <strong>NOT PRESENT</strong>
  {reason}
  <code>{recovery_command}</code>
</div>
```

### Brain-derived card template (NEW in 1.17.0)

```html
<article class="card brain-derived">
  <header>
    <span class="section-label">{section_name}</span>
    <span class="hash" title="{full_sha256}">{sha256_truncated_8}</span>
    <time datetime="{iso_ts}">{relative_time}</time>
  </header>
  <div class="body">
    {brain_md_opening_paragraph}
  </div>
  <footer>
    <a href="/artifacts/brain-{slug}.html">Read full derivation</a>
    <span class="part-8-check">&#10003; Canon Part 8: LOCAL only</span>
  </footer>
</article>
```

---

## MODIFICATIONS AT INVOCATION

The user can pass flags to change behavior:

- `--date YYYY-MM-DD` override the output directory date (for reruns)
- `--no-graph` skip graph visualization (for air-gapped environments)
- `--no-brain-derived` skip the brain-derivation pages even if BRAIN.md present (for pre-90 viewer compatibility demos)
- `--deploy` run `vercel --prod` automatically at the end (requires vercel CLI linked)
- `--gmail-draft` after successful generation, create a Gmail draft email addressed to the user themselves with a placeholder URL

If flags are not provided, use defaults (generate all pages, no auto-deploy).

---

## SUCCESS CRITERIA

This prompt is considered successful when:

1. A recipient can open the hub URL and understand what the room contains in under two minutes of scanning.
2. A recipient can paste the URL into ChatGPT or Claude, ask questions, and receive answers grounded in the site's evidence rather than hallucinations.
3. Every claim on the site can be traced by the recipient back to a room artifact, graph query result, computed metric, or governing_thought hash without requiring the original author to explain.
4. The site survives a skeptical verification pass: random sampling 10 claims and chasing them to their sources finds each one.
5. NEW in 1.17.0: The brain-derivation layer, if active, is visible as a first-class capability in the hub, the intelligence cluster, and the provenance timeline. A skeptical viewer can see the room learning, not just accumulating.
6. NEW in 1.17.0: Canon Part 8 audit (LOCAL only, no user-string egress to Brain) is displayed and passes. Provenance defensibility is not an afterthought.

---

## REFERENCE IMPLEMENTATIONS

- The Ador IP Credit Test (2026-04-24 session) is the canonical reference implementation for the v1.0 architecture.
- The 1.17.0 upgrade reference implementation is the mindrianOS self-room run after phase 90 ships. Use that run to calibrate the Brain-derived visual treatments before exporting to external rooms.

Any deviation from the patterns established in these reference implementations should be deliberate and documented in `exports/power-demo-{date}/DEVIATIONS.md`.
