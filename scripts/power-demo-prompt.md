# Mindrian Power Demonstration -- Evidence-Grounded Multi-Page Site
# Prompt version: 1.17.1 (updated 2026-04-26 for v1.10.19 hotfixes)

## Your role

You are generating a navigable multi-page HTML site that demonstrates the actual, verifiable power of Mindrian to a viewer who has never seen this system before. The viewer is intelligent but skeptical. They will verify claims. Every statement in the output must trace back to a file, a graph edge, a timestamp, or a computed metric that exists in THIS specific room.

You are producing a publication, not a dump. Navigation, hyperlinks, hover tooltips, typography, and rich text are all required -- not optional.

---

## Hard rules (non-negotiable)

1. **NO INVENTION.** If a claim cannot be cited to a specific file path, line number, graph node ID, JSON key, SQL query result, or command output, it does not appear in the site. Zero exceptions.

2. **NO FILLER.** No sentences like "Mindrian enables powerful intelligence." If it cannot be shown, it is not said.

3. **EVERY CLAIM GETS PROVENANCE.** Inline citations via visible footnote tags (`[src: opportunity-bank/opp-03-*.md line 42]`) or marginal annotations. Invisible HTML comments are insufficient.

4. **IF THE DATA IS NOT THERE, SAY SO.** "No CONTRADICTS edges found in local graph." is a valid output. Inventing one is not.

5. **EVERY HYPERLINK RESOLVES.** If you cite it, it has a page. If it has a page, the page is rooted in a real file. Broken links fail the final check.

6. **NO EMOJI. NO EM-DASHES.** Hyphens only. Approved glyphs only: ■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ →

7. **PLUGIN HEALTH IS PART OF EVIDENCE. (← v1.10.19)** If the plugin's three release gates fail or registry state is inconsistent, the site MUST surface that on the diagnostics page. A demo that pretends the platform is healthy when it isn't is itself a Trust Layer violation.

---

## Input

- Room path: `{ROOM_PATH}` (provided at invocation)
- Output directory: `{ROOM_PATH}/exports/power-demo-YYYY-MM-DD/`
- Plugin root (for version lookup + gate execution): `~/MindrianOS-Plugin/` (or `${CLAUDE_PLUGIN_ROOT}` if running inside an installed plugin context)
- **Required minimum plugin version: v1.10.19 (← v1.10.19)** Earlier versions had hook schema rejection bugs and registry-bypass install paths; the demo's diagnostic page will refuse to render a green badge below this version.

---

## Phase 1 -- Extraction (MUST complete before any HTML is written)

Run these extractions first. If any fail, halt and write a diagnostic report to `{ROOM_PATH}/exports/power-demo-FAILED.md`. Do NOT proceed with HTML generation on incomplete data.

### 1.1 Local graph census

```bash
sqlite3 {ROOM_PATH}/.mindrian/room.db "SELECT type, COUNT(*) FROM edges GROUP BY type"
sqlite3 {ROOM_PATH}/.mindrian/room.db "SELECT label, COUNT(*) FROM nodes GROUP BY label"
sqlite3 {ROOM_PATH}/.mindrian/room.db \
  "SELECT e.type, n1.label AS source, n2.label AS target
   FROM edges e
   JOIN nodes n1 ON e.source = n1.id
   JOIN nodes n2 ON e.target = n2.id
   WHERE e.type IN ('CONTRADICTS','CONVERGES','INVALIDATES','INFORMS','ENABLES')
   LIMIT 50"
```

Capture: exact edge counts per type, node counts per label, top 5 most-connected nodes (by degree), the 50-edge relationship sample.

### 1.2 Opportunity bank

```bash
ls {ROOM_PATH}/opportunity-bank/ 2>/dev/null
find {ROOM_PATH}/opportunity-bank -name "*.md" -not -name "ROOM.md"
```

For each opportunity .md file, extract: title (from H1 or frontmatter), HSI score (if present), domain tags, date filed, first paragraph. Record filesystem path for each.

### 1.3 Intelligence outputs

For each file below, extract the listed fields verbatim. If the file is missing, record "NOT PRESENT" -- do not fabricate values.

| File | Fields to extract |
|------|-------------------|
| `.mindrian/.hsi-results.json` | pair count, top pair score, top 5 pairs (source/target/score) |
| `.mindrian/whitespace-results.json` | gap count, top 5 gap names + density scores |
| `.mindrian/discovery-hsi-whitespace.json` | zone count, strong/moderate/weak breakdown |
| `.mindrian/discovery-analogy-whitespace.json` | zone count, top 5 analogies with source/target domains |
| `.mindrian/discovery-rs-whitespace.json` | bottleneck count |
| `.mindrian/topic-forest.json` | cluster counts at coarse / medium / fine |
| `.mindrian/disruption-index.json` | `metadata.room_cd`, D/C/B counts |
| `.mindrian/blindspot-coverage.json` | `metadata.room_coverage` |
| `.mindrian/element-novelty.json` | `metadata.mean_novelty`, `max_novelty`, `min_novelty` |
| `.mindrian/surprise-scores.json` | top 5 by `surprise_score` with artifact paths |
| `.mindrian/brain-derivation-queue.json` (← v1.10.19-aware) | pending derivations, last sha256 |
| `.mindrian/brain-baseline.json` | section count, baseline timestamp (verify auto-fired correctly) |

### 1.4 Documents created

```bash
find {ROOM_PATH} -name "*.md" -not -path "*/.*" -not -path "*/exports/*" | wc -l
find {ROOM_PATH} -name "*.md" -not -path "*/.*" -not -path "*/exports/*" \
  -printf "%T@ %p\n" | sort -rn | head -20
ls -d {ROOM_PATH}/*/  2>/dev/null
```

Capture: total artifact count, 20 most recently modified, section folder list.

### 1.5 DD / decision trace

```bash
ls {ROOM_PATH}/meetings/ 2>/dev/null | wc -l
find {ROOM_PATH}/meetings -name "*.md" -type f
grep -nE "APPROVE|REJECT|DEFER|DECIDED|GATE" {ROOM_PATH}/STATE.md 2>/dev/null
grep -rnE "## Decision|APPROVE|REJECT|DEFER" {ROOM_PATH}/meetings/ 2>/dev/null | head -30
```

Capture: meeting count, decisions with reason + artifact affected + date.

### 1.6 Cross-relationship highlights (the moat)

From the 50-edge sample in 1.1, select the 10 most consequential edges. Priority: INVALIDATES > CONTRADICTS > CONVERGES > ENABLES > INFORMS. These are edges a human would not have found unaided. Feature them.

### 1.7 Venture identity

```bash
grep -E "project_name|venture_name|stage" {ROOM_PATH}/STATE.md | head -5
cat {ROOM_PATH}/ROOM.md 2>/dev/null | head -20
```

Capture: venture name, current stage, one-line thesis if present.

### 1.8 Plugin health check (← v1.10.19 NEW)

This extraction proves the platform itself is in a healthy state. Required before generating the diagnostics page.

```bash
# A. Plugin version + manifest integrity
node -e "console.log(require('${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json').version)" 2>&1
node -e "console.log(require('${CLAUDE_PLUGIN_ROOT}/package.json').version)" 2>&1
# Both should report 1.10.19 or later. If they disagree, that is itself a finding.

# B. Gate 1 -- Hook schema compatibility scan (must PASS)
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-hook-schema-compatibility.cjs" 2>&1

# C. Gate 2 -- SHA-aware version check (any STATUS is informative)
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-version-and-sha.cjs" 2>&1

# D. Gate 3 -- Stale user-settings detection (dry run; advisory)
node "${CLAUDE_PLUGIN_ROOT}/scripts/migrate-stale-user-settings.cjs" 2>&1

# E. Plugin loader registry coherence
cat ~/.claude/plugins/installed_plugins.json 2>/dev/null | \
  python3 -c "import json,sys; d=json.load(sys.stdin); \
              print(json.dumps({k:v for k,v in d.items() if 'mos' in str(k).lower()}, indent=2))" 2>&1
grep -A2 enabledPlugins ~/.claude/settings.json 2>/dev/null | head -10
```

Capture per check:
- **Plugin version**: actual semver string from plugin.json + package.json (must match)
- **Gate 1**: PASS / FAIL + count of forbidden patterns found
- **Gate 2**: STATUS (UP_TO_DATE / VERSION_DIFFERS / SHA_DIFFERS_INVERSION_HOTFIX / NETWORK_ERROR), local SHA, remote tag SHA
- **Gate 3**: number of stale paths detected (0 = clean)
- **Registry coherence**: gitCommitSha for `mos@mindrian-marketplace`, presence in enabledPlugins

If Gate 1 reports FAIL, halt and write the FAILED report. The plugin cannot ship a power demo with broken hooks.

If Gate 2 reports SHA_DIFFERS_INVERSION_HOTFIX, the demo can proceed BUT the diagnostics page must surface this prominently as a "platform update available" warning.

If Gate 3 reports >0 stale paths, the demo proceeds with a "user settings need migration" callout on the platform-health page.

---

## Phase 2 -- Output file structure (MANDATORY)

Generate this tree. Every linked page must exist on disk.

```
exports/power-demo-YYYY-MM-DD/
├── index.html                      # 3-door lobby
├── assets/
│   ├── style.css                   # De Stijl styles (inline is fine)
│   ├── nav.js                      # Sidebar controller
│   ├── tooltips.js                 # Hover glossary loader
│   └── glossary.json               # Term definitions
├── thesis/
│   └── index.html                  # Door 1
├── intelligence/
│   ├── index.html                  # Door 2 overview
│   ├── opportunities.html
│   ├── cross-relationships.html
│   ├── whitespace.html
│   └── diagnostics.html
├── provenance/
│   ├── index.html                  # Door 3 overview
│   ├── artifacts.html
│   ├── decisions.html
│   ├── meetings.html
│   ├── timeline.html
│   └── platform-health.html        # ← v1.10.19 NEW: gate output + registry coherence
└── artifacts/
    └── {slug}.html                 # One page per cited artifact
```

Every opportunity, every edge-referenced artifact, every cited meeting gets a page in `artifacts/` reproducing the source file verbatim with a "View source file" link back to the filesystem path.

---

## Phase 3 -- Persistent side-panel navigation (renders on every page)

Fixed left sidebar, 240px wide, full height. Same HTML partial on every page (use includes, do not duplicate markup).

```
┌─────────────────────────┐
│ ■ {VENTURE_NAME}        │  ← links to index.html
│ Stage: {STAGE}          │
│ Plugin: v{PLUGIN_VER}   │  ← v1.10.19 NEW: display version
│                         │
│ ▷ THESIS                │
│                         │
│ ▼ INTELLIGENCE          │  ← expanded when any /intelligence/* is active
│   ├─ Opportunities ({N})│  ← N from extraction 1.2, live number
│   ├─ Cross-relations ({M})  ← M = total CONTRADICTS+INVALIDATES+CONVERGES
│   ├─ Whitespace ({K})   │
│   └─ Diagnostics        │
│                         │
│ ▷ PROVENANCE            │
│   ├─ Artifacts ({T})    │
│   ├─ Decisions ({D})    │
│   ├─ Meetings ({G})     │
│   ├─ Timeline           │
│   └─ Platform Health    │  ← v1.10.19 NEW
│                         │
│ ─────────────────────   │
│ ASK                     │
│ [ chat input textarea ] │
│                         │
│ {GATE_BADGE}            │  ← v1.10.19 NEW: green ✓ or amber ⚠
└─────────────────────────┘
```

Rules:
- Current page highlighted with vermillion left border rule (4px, #E63946)
- Counts pulled from extraction (not placeholder)
- Sticky on scroll (`position: fixed`)
- Viewport <900px: collapses to hamburger toggle, slides in from left
- Breadcrumb bar at top of every non-index page: `{VENTURE} > Intelligence > Opportunities`
- **Plugin version line (← v1.10.19)**: shows the actual installed version. If less than 1.10.19, render in amber with link to platform-health page.
- **Gate badge (← v1.10.19)**: green ✓ if all 3 gates pass; amber ⚠ if any gate reports an issue. Click navigates to platform-health page.

---

## Phase 4 -- Hover tooltips (define before displaying)

Every technical term, every cited number, every edge type gets a tooltip. Factual definitions only.

Wire as `<span class="gloss" data-term="hsi">HSI</span>` with definitions in `assets/glossary.json`:

```json
{
  "HSI": "Hybrid Semantic Index. Dual-similarity score (structural LSA + semantic BERT). Range [0,1]. Higher = stronger cross-domain bridge. Source: scripts/compute-hsi.py",
  "reverse salient": "A component lagging behind others in an expanding system (Hughes 1983). Fixing it unblocks the whole domain. Source: scripts/detect-reverse-salients.py",
  "whitespace zone": "Region of the conceptual space where the room has no artifacts but Brain has adjacent frameworks. Source: scripts/compute-whitespace-gaps.py",
  "CONTRADICTS": "Typed edge. Artifact A's claim conflicts with artifact B's claim. Source: lib/core/lazygraph-ops.cjs",
  "CONVERGES": "Typed edge. Same theme appears in 3+ sections. Idea is becoming central.",
  "INVALIDATES": "Typed edge. A new artifact made an earlier assumption stale.",
  "INFORMS": "Typed edge. A cited cross-reference between sections.",
  "ENABLES": "Typed edge. One artifact unblocks progress in another section.",
  "disruption index": "Funk & Owen-Smith 2017 CD index. Range [-1,1]. Negative = consolidating, positive = disrupting.",
  "blindspot coverage": "Good-Turing coverage estimate. Percent of conceptual space the room has sampled.",
  "Bayesian surprise": "Leave-one-out cosine shift. How much a single artifact moved the room's thesis.",
  "element novelty": "Per-artifact distance from the room centroid. Low = everything looks similar.",
  "FeynMinto": "Memory compression: Minto Pyramid Principle + Feynman simplification. Source: Phase 88-07 triple-context formatter.",
  "LazyGraph": "Local SQLite graph that caches only what a session touches. Never queries Brain for user data.",
  "Brain": "Remote Neo4j methodology graph at mindrian-brain.onrender.com. Stateless. Never holds user data.",

  "hookSpecificOutput": "Required envelope for hook script JSON output in Claude Code 2.x. Replaces top-level systemMessage / additionalContext fields that were rejected by the schema's additionalProperties:false. Source: docs.anthropic.com/en/docs/claude-code/hooks. Wired in plugin via scripts/check-hook-schema-compatibility.cjs",
  "gitCommitSha": "Per-plugin commit identifier tracked in ~/.claude/plugins/installed_plugins.json. Used by SHA-aware update detection to spot in-version hotfixes (cases where v<X> tag was force-moved).",
  "in-version hotfix": "A patch shipped under the same semver tag (e.g., v1.10.18 force-moved to a new commit). Standard version-comparison update tools miss these. Detected by scripts/check-version-and-sha.cjs. Deprecated as a distribution mechanism in v1.10.19; future patches always bump version.",
  "registry sync": "The four-way coherence required for a Claude Code plugin to load: cache files + installed_plugins.json + enabledPlugins (in settings.json) + known_marketplaces.json must all agree. Bypassed by the deprecated self-update; restored by /plugin install.",
  "release gate": "A pre-release check that scans the codebase for known compatibility regressions. As of v1.10.19, three gates: hook schema (Gate 1, mandatory), SHA-aware update detection (Gate 2, advisory), stale user-settings migration (Gate 3, advisory). Source: docs/RELEASE-GATES.md.",
  "Canon Part 7": "Reuse Before Build. Defer to platform-native machinery instead of reimplementing. Violated by the original self-update script; restored by v1.10.19 native delegation in /mos:update."
}
```

Cited numbers also get tooltips:
- `CD = -0.71` hover: "Source: `.mindrian/disruption-index.json` field `metadata.room_cd`, computed YYYY-MM-DD"
- `13 analogy zones` hover: "Source: `.mindrian/discovery-analogy-whitespace.json`, breakdown: 0 strong, 0 moderate, 13 weak"
- Opportunity title hover: "HSI: 0.67 | Domain: {tag} | Filed: {date} | Source: `opportunity-bank/opp-03-*.md`"
- **Plugin version `v1.10.19` (← v1.10.19)**: "Installed via `claude plugin install mos@mindrian-marketplace`. Marketplace ref: `v1.10.19`. Local commit SHA: {LOCAL_SHA}. Gate status: {GATE_BADGE}."

Tooltip styling:
- Black background (#1A1A1A), white text
- 11px monospace for data fields
- 13px serif for definitions
- Triggered on both focus AND hover (keyboard-accessible)
- 300ms delay before show; dismiss on mouse-leave or Escape

---

## Phase 5 -- Rich text contract (applied to every page)

### Typography

- Body: 17px serif (Georgia or EB Garamond). Line-height 1.6. Max line length 68 characters.
- Headings: sans-serif black (Helvetica Neue or Inter). H1 36px / H2 24px / H3 18px. Generous top margin.
- Monospace only for code, SQL, file paths, exact values (scores, IDs, counts).
- Tables: zebra-stripe rows `#F5F1EB` / `#EDE6D8`. Header row black background, white text.

### Structure per page

- Lead paragraph (italic, 19px) summarizing what the page shows and where the data comes from.
- Horizontal rule (3px solid black) after the lead.
- Subsections under H2s. Each subsection under 400 words or broken into H3s.
- Pull-quotes for direct citations from artifacts: vermillion left border (4px), 24px padding.
- Callout boxes for diagnostic interpretations:
  - Neutral: gray border, `#6C757D`
  - Warning: amber border, `#F4A261`
  - Signal: cyan border, `#457B9D`
  - **Platform health (← v1.10.19)**: green border `#2A9D8F` for healthy, amber for advisory issues, red `#E63946` for blocking issues

### Cross-linking (the core feature)

- Every proper noun that has a page gets a hyperlink on first mention per page.
- Every edge reference links to BOTH source and target artifact pages.
- Every numeric claim links to the source file viewer (`artifacts/source-{slug}.html`).
- "See also" at the bottom of every page: 3-5 links derived from graph edges, NOT hand-picked.
- Backlinks footer on every page: "Pages that link here: [list]" computed from the site graph.

### Ease-of-read devices

- Drop cap on lead paragraph of index pages.
- Numbered margin notes for citations (right margin, 11px sans).
- "Skim mode" toggle top-right: hides body prose, shows only H2s, H3s, tables, callouts.
- Reading time estimate top of every page ("~4 min read").

### In-page navigation

- Table of contents at top of any page >600 words, auto-generated from H2/H3 structure with anchor links.
- "Jump to top" button after 600px scroll.
- Keyboard shortcuts: `j`/`k` to move between subsections, `/` to focus the chat input, `s` to toggle skim mode.

---

## Phase 6 -- Page-by-page content

### `index.html` -- The Three Doors

**Header strip** (approved glyphs only):
```
■ {VENTURE_NAME} | Mindrian Data Room v{PLUGIN_VER} | Generated YYYY-MM-DD
▶ {artifact_count} artifacts | {edge_count} graph edges | {opp_count} opportunities | {decision_count} decisions
{GATE_BADGE_INLINE}
```

`{GATE_BADGE_INLINE}` (← v1.10.19) renders as one of:
- `✓ Platform healthy (3/3 gates pass, registry sync OK)` (green)
- `⚠ Platform advisory: {N} issue(s) -- see Platform Health` (amber, links to platform-health.html)
- `⚠ Platform BLOCKED: {reason} -- demo content may be incomplete` (red)

**Three door panels** (equal columns, each clickable):

▶ **Door 1: What this venture is**
One sentence from STATE.md `project_name` + first paragraph of the most recent artifact in `problem-definition/` or the thesis build output.
Links to `thesis/index.html`.

▶ **Door 2: What Mindrian found that humans missed**
"Mindrian surfaced {N} cross-relationships across {M} sections." N = CONTRADICTS + CONVERGES + INVALIDATES edges. M = sections touched.
Links to `intelligence/index.html`.

▶ **Door 3: How we know**
"Built from {G} meetings over {DATE_FIRST} to {DATE_LAST}. {T} artifacts. {D} decisions captured with reasons."
Links to `provenance/index.html`.

### `intelligence/index.html`

Lead paragraph summarizing the four slices. Grid of four tiles linking to sub-pages, each tile showing the headline number.

### `intelligence/opportunities.html`

Table: title | HSI score | domain | date filed | source artifact.
Each title links to `artifacts/{slug}.html`.
If zero: "Opportunity bank empty. Run `/mos:find-connections` to populate."

### `intelligence/cross-relationships.html`

For each of the 10 edges selected in extraction 1.6:
- H3: `{Source Artifact} → {edge_type} → {Target Artifact}`
- Reason (from edge properties JSON if present)
- Both artifact names hyperlinked
- Callout (signal style): "Human-found: likely no. Graph-found: yes. Edge created YYYY-MM-DD by {cascade source}."

### `intelligence/whitespace.html`

Top gaps from `whitespace-results.json`. Each gap row: framework name | density score | which Brain cluster it belongs to | which room section is closest.
Gap name links to Brain framework description if available, otherwise to a stub page that says "framework exists in Brain's 21K graph, not yet engaged by this room."

### `intelligence/diagnostics.html`

Four metric rows (post-phase-88.6 Wave-1). Each row: metric label | value | interpretation | source file link.

| Metric | Value | Interpretation |
|---|---|---|
| Disruption index | `{room_cd}` | {consolidating vs disrupting text derived from actual value} |
| Blindspot coverage | `{coverage}` | {percent of space covered} |
| Element novelty | `{mean_novelty}` | {low / moderate / high diversity} |
| Bayesian surprise (top) | `{max_surprise}` | Links to the artifact that moved the room most |

If any Wave-1 JSON is missing: "Metric not yet computed. Run `/mos:diagnostics`." Do not fabricate.

### `provenance/index.html`

Lead: "Every claim in this site has a source. This section shows where."
**Five tiles (← v1.10.19: added Platform Health)**: Artifacts | Decisions | Meetings | Timeline | Platform Health.

### `provenance/artifacts.html`

Sortable table: date modified | section | filename | first line. 20 most recent at top. Filename links to `artifacts/{slug}.html`.

### `provenance/decisions.html`

Table from STATE.md APPROVE/REJECT/DEFER history: date | decision | reason | artifact affected.

### `provenance/meetings.html`

Grouped by month. Each meeting: date | participants | artifacts produced | decisions made. Meeting name links to its filed transcript page.

### `provenance/timeline.html`

Horizontal scroll, one column per week. Each column shows every artifact and every decision in that week. Graph edges rendered as arcs between columns. The single most persuasive view for an unfamiliar viewer -- shows accumulation over time.

### `provenance/platform-health.html` (← v1.10.19 NEW PAGE)

Lead paragraph: *"This page proves the platform itself is healthy. The same scrutiny we apply to venture claims, we apply to the tooling generating them. Every value below comes from a release gate run during demo extraction (Phase 1.8). If any gate fails, the demo's other claims are suspect by extension."*

#### Section: Plugin version

| Component | Reported version | Source |
|---|---|---|
| `.claude-plugin/plugin.json` | `{PLUGIN_JSON_VER}` | manifest |
| `package.json` | `{PACKAGE_JSON_VER}` | npm manifest |
| Marketplace ref | `{MARKETPLACE_REF}` | `mindrian-marketplace/.claude-plugin/marketplace.json` |
| Installed registry | `{INSTALLED_VER}` | `~/.claude/plugins/installed_plugins.json` |

If any value differs, render the row in amber and add a callout: "Version drift detected. Run `/mos:update` to sync." If values match AND >= 1.10.19, render green.

#### Section: Gate 1 -- Hook schema compatibility

Pre-formatted output of `scripts/check-hook-schema-compatibility.cjs`. Display:
- Status: PASS / FAIL (green / red)
- Files scanned: `{N}`
- Forbidden patterns found: `{M}` (with file:line list if any)

Callout: "This gate ensures every hook script emits JSON that Claude Code 2.x's schema accepts. The class of bugs it prevents: 'Hook JSON output validation failed -- (root): Invalid input' on every Read/Grep/Glob/Write/Edit. Reference: docs/RELEASE-GATES.md Gate 1."

#### Section: Gate 2 -- SHA-aware update detection

Pre-formatted output of `scripts/check-version-and-sha.cjs`. Display:
- Status: `{STATUS}` (one of UP_TO_DATE / VERSION_DIFFERS / SHA_DIFFERS_INVERSION_HOTFIX / NETWORK_ERROR)
- Local version: `{LOCAL_VERSION}`
- Latest version: `{LATEST_VERSION}`
- Local commit SHA: `{LOCAL_SHA}`
- Remote tag SHA: `{REMOTE_TAG_SHA}`
- Reason: `{REASON}`

Callout color follows status:
- UP_TO_DATE -> green: "You are running the canonical v{LOCAL_VERSION}."
- VERSION_DIFFERS -> amber: "Update available. Run `/mos:update`."
- SHA_DIFFERS_INVERSION_HOTFIX -> amber: "In-version hotfix detected. Run `/plugin install mos@mindrian-marketplace --force` to pull."
- NETWORK_ERROR -> gray: "Could not check. Try again with internet access."

#### Section: Gate 3 -- User-settings migration

Pre-formatted output of `scripts/migrate-stale-user-settings.cjs` (dry run). Display:
- Findings: `{N}` stale entries detected
- For each finding: key, value (truncated), recommended action

If N > 0, callout (amber): "Stale absolute paths detected in your user `~/.claude/settings.json`. These override the plugin's own `${CLAUDE_PLUGIN_ROOT}`-based paths. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/migrate-stale-user-settings.cjs --apply` to clean (creates a backup first). Common symptom: statusline does not render."

If N == 0: "No stale paths. Plugin's own settings.json is not being shadowed."

#### Section: Plugin loader registry coherence

Display the parsed `mos@mindrian-marketplace` entry from `installed_plugins.json` and the `enabledPlugins` block from `~/.claude/settings.json`. Highlight the `gitCommitSha` value.

If the entry exists in `installed_plugins.json` AND `mos@mindrian-marketplace` is in `enabledPlugins`: render green "Registry sync OK."
If either is missing: render red "Registry sync BROKEN. Plugin loader will not load mos. Run `/plugin install mos@mindrian-marketplace`."

#### Section: Hotfix history (dog-fooding example)

Pull from `CHANGELOG.md` the most recent hotfix entries. For v1.10.19, list the three hotfixes (hook schema / native delegation / settings migration) with citations to the commit SHA and the originating user report (Aryeh Holtzberg, PWS IRIS 2025, 2026-04-26).

This section is the constitutional clincher: it shows the venture's product is itself a navigator inside the same kind of room it sells. **Canon Part 6 (Dog-Fooding Mandate) made visible.**

### `thesis/index.html`

Content drawn VERBATIM from the latest artifact in this priority order:
1. Output of `/mos:build-thesis` if present
2. Most recent artifact in `business-model/` (lean canvas)
3. Most recent artifact in `problem-definition/`

Quote directly. Cite the source file. Do not paraphrase.

### `artifacts/{slug}.html`

Reproduce the source markdown verbatim in rendered HTML. Add at the top:
- Source path (monospace)
- Date modified
- Section
- Inbound edges (pages in the site that link here)
- Outbound edges (pages this artifact links to)
- "View source markdown" link opening the raw file

---

## Phase 7 -- Styling (De Stijl palette)

- Background: off-white `#F5F1EB`
- Primary text: near-black `#1A1A1A`
- Accent rules: vermillion `#E63946`, cyan `#457B9D`, amber `#F4A261`
- **Green for healthy gate states (← v1.10.19)**: `#2A9D8F`
- Grid-based layout with 3px solid black rules between zones
- No gradients, no drop shadows, no border-radius
- Flat planes only. Mondrian grid discipline.
- Monospace for data. Serif for prose. Sans-serif for headings. One typeface per role, no mixing.

---

## Phase 8 -- Chat input

Render a `<textarea>` in the sidebar footer:

```
Ask this data room: What would Mindrian say about [your question]?
```

Do not wire to an endpoint unless the room has a local Brain MCP server running. If not wired, label under the textarea: `[preview -- live chat in v1.10.19+]` (← v1.10.19; was: v1.10.14+).

---

## Phase 9 -- Fail-safe

If any Phase 1 extraction fails, do NOT continue. Write `{ROOM_PATH}/exports/power-demo-FAILED.md` listing:
- Which extractions succeeded
- Which extractions failed with error messages
- Which files were missing

HTML generation is blocked until extractions are complete.

**(← v1.10.19)** If Phase 1.8 Gate 1 reports FAIL, the FAILED report MUST include:
- The exact stderr output of the gate run
- The list of forbidden hook output patterns found
- Instructions to update to v1.10.19 or later before re-running the demo

This is the dog-fooding clincher: a power demo that shipped with broken hooks would itself be evidence the platform is unwell. The fail-safe enforces the discipline.

---

## Phase 10 -- Final check (gate before publishing)

Before emitting the site, verify:

- [ ] Every numeric claim has a visible file citation (footnote tag or margin note)
- [ ] Every named artifact exists on disk (test with `test -f`) AND has a page under `artifacts/`
- [ ] Every graph edge referenced was retrieved from the actual DB, not paraphrased
- [ ] Every hyperlink target resolves to a file in the output tree (test every href)
- [ ] Every term in `assets/glossary.json` appears on at least one page as `<span class="gloss">`
- [ ] Sidebar nav renders identically across all pages (diff nav HTML if using includes)
- [ ] Breadcrumbs on every non-index page
- [ ] Skim mode toggle present and functional on every page
- [ ] Tooltips triggered on both hover AND keyboard focus
- [ ] Zero emoji, zero em-dashes, only approved glyphs
- [ ] CSS loads without errors, zero external CDN dependencies (fully offline-capable)
- [ ] Reading time estimates present on every page >400 words
- [ ] Timeline page renders chronologically with at least one artifact per visible week
- [ ] **(← v1.10.19)** Platform Health page renders with all five sections populated (version, Gate 1, Gate 2, Gate 3, registry coherence, hotfix history)
- [ ] **(← v1.10.19)** Plugin version line in sidebar renders the actual installed version (no placeholder)
- [ ] **(← v1.10.19)** Gate badge in sidebar matches the platform-health.html status (no drift between header banner, sidebar badge, and page content)
- [ ] **(← v1.10.19)** Hotfix history section in platform-health.html cites at least the three v1.10.19 hotfixes with commit SHAs and changelog quotes
- [ ] **(← v1.10.19)** Glossary contains entries for: hookSpecificOutput, gitCommitSha, in-version hotfix, registry sync, release gate, Canon Part 7

If any check fails, do not publish. Log the failure in `power-demo-FAILED.md` and exit.

---

## Invocation

Run as:

```
Read ~/MindrianOS-Plugin/scripts/power-demo-prompt.md and execute it against ROOM_PATH=~/MindrianRooms/{room-slug}/
```

Claude reads this prompt, runs the 10 phases in order, and produces the site. No interactive prompts. No confirmation questions. If a phase cannot complete, the fail-safe writes the diagnostic and halts.

---

## QA Mockup Mode (← v1.10.19 NEW)

For QA / mockup testing where the room may be sparse or fixture-only, set the env var:

```bash
POWER_DEMO_QA_MODE=1
```

In QA mode:
- Empty extractions render placeholder rows labeled `[QA fixture]` (still cited to the empty file path)
- Missing intelligence JSONs render "NOT PRESENT [QA: expected for fixture room]" instead of failing
- Platform Health page is REQUIRED to fully populate (this is the part being QA'd)
- All gate failures still surface; the demo does not whitewash platform issues even in mockup mode
- Footer tag on every page: `[QA MOCKUP -- not for external distribution]`
- Index page header gets an amber strip: `⚠ QA MODE -- generated against fixture room. Do not share.`

This prevents accidental sharing of fixture-based demos as real venture proofs while still letting QA verify the rendering pipeline end-to-end.

Sample QA invocation:

```bash
POWER_DEMO_QA_MODE=1 \
  ROOM_PATH=~/MindrianRooms/fixture-room/ \
  CLAUDE_PLUGIN_ROOT=~/MindrianOS-Plugin/ \
  # ... then trigger /mos:power-demo or feed the prompt to Claude directly
```

---

## Version history of this prompt

| Version | Date | Change |
|---|---|---|
| 1.17.1 | 2026-04-26 | Added Phase 1.8 (plugin health extraction), platform-health.html page, Gate 1/2/3 surfacing, glossary additions for v1.10.19 terms, QA Mockup Mode, plugin-version display in sidebar, gate badge, hotfix history dog-fooding section. Aligned to v1.10.19 release. |
| 1.17.0 | 2026-04-19 | Initial release with 9 phases, 3-door lobby, intelligence + provenance sections. |
