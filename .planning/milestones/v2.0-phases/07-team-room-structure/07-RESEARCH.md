# Phase 7: Team Room Structure - Research

**Researched:** 2026-03-23
**Domain:** Filesystem-based team intelligence layer for the Data Room
**Confidence:** HIGH

## Summary

Phase 7 transforms the Data Room from a topic-organized structure to a people-aware knowledge system. The core work is: (1) extending PROFILE.md with status lifecycle, multiple roles, and computed backlinks; (2) building a full meeting archive package (transcript, summary, speakers, decisions, action-items, metadata.yaml, audio); (3) creating the `scripts/compute-team` script that computes TEAM-STATE.md as a knowledge landscape context tool; (4) updating `commands/new-project.md` to create team/ directory; and (5) wiring cross-links between topic-filed artifacts and speaker profiles via frontmatter-based backlink computation.

The existing codebase already has strong foundations: `scripts/create-speaker-profile` creates ICM nested folder profiles, `scripts/compute-state` already counts meetings and team profiles, `commands/file-meeting.md` already creates meeting archives and files artifacts with speaker attribution. Phase 7 extends these rather than replacing them. The key new component is `scripts/compute-team` -- a bash script that scans the filesystem to produce TEAM-STATE.md with expertise distribution, gap analysis, contribution trends, and team health indicators.

All decisions are locked from CONTEXT.md. The architecture pattern is "topic primary + backlink" meaning artifacts stay in their topic sections, and PROFILE.md Contributions sections are computed on demand. Meeting archives expand from the current simplified structure (transcript, summary, filed-to/) to a full package (adding speakers.md, decisions.md, action-items.md, metadata.yaml, audio copy). TEAM-STATE.md is explicitly a CONTEXT TOOL for Larry, not a tracking dashboard.

**Primary recommendation:** Build in three waves: Wave 1 extends PROFILE.md schema and create-speaker-profile for status/multi-role + updates new-project to create team/; Wave 2 builds the full meeting archive package and attribution frontmatter; Wave 3 builds compute-team and TEAM-STATE.md computation with layered orchestration from compute-state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Topic primary + backlink**: Artifacts live in the topic section (e.g., market-analysis/) with speaker attribution in frontmatter. Speaker's PROFILE.md maintains a computed 'Contributions' section with links back. No duplicate files in speaker's subfolder.
- **Backlinks computed on demand**: PROFILE.md Contributions section is rebuilt by compute-state/compute-team when it scans the room. Always accurate, never stale. Not updated during filing.
- **Full attribution block in frontmatter**: Every filed artifact includes a complete `attribution:` block with speaker, role, profile_path, meeting_date, meeting_id -- complete provenance chain.
- **Full meeting package**: Each meeting folder (room/meetings/YYYY-MM-DD-{name}/) contains: transcript.md, summary.md, speakers.md, decisions.md, action-items.md, metadata.yaml
- **Audio copied into archive**: If user provided audio via --audio, the audio file is copied into the meeting folder. Full self-contained archive.
- **Past meeting lookup via frontmatter search**: Larry greps metadata.yaml across meetings/ for speaker names, topics, decisions. Fast targeted lookups.
- **Meeting name inferred then confirmed**: Larry proposes a name from the meeting's key topic, user confirms or changes.
- **TEAM-STATE.md is a CONTEXT TOOL, NOT TRACKING**: Exists to give Larry rich context about the team's KNOWLEDGE LANDSCAPE. NOT attendance tracking or productivity metrics.
- **Full intelligence depth**: Contribution trends, expertise concentration, gap detection, role distribution, sentiment trends per speaker, agreement/disagreement patterns, influence scoring, team health indicators.
- **Structured markdown tables**: Context-safe, lean format. Readable by humans AND parseable by Larry.
- **Layered computation**: compute-state calls compute-team as a sub-step. Clean separation.
- **Dynamic folder structure**: Start with NO role subfolders in team/. First person of each role creates the folder on demand. No empty folders.
- **Multiple roles allowed**: A person can be both advisor AND investor. PROFILE.md lists all roles. Folder lives under primary role.
- **Status lifecycle (explicit + inferred)**: PROFILE.md frontmatter includes `status: active/inactive/alumni/potential`. compute-team also tracks last_active date from meeting participation.
- **new-project creates team/ only**: No subfolders. Structure grows organically.
- **People evolve**: Roles change, people leave, new people arrive. Team directory must support fluidity without losing historical contributions.

### Claude's Discretion
- Cross-room cascade depth in per-person PROFILE.md
- Silent stakeholder detection approach
- How compute-team handles role conflicts (person in two role folders)
- Exact TEAM-STATE.md section organization

### Deferred Ideas (OUT OF SCOPE)
- **Wiki-style Data Room Dashboard** -- hosted or Obsidian-based wiki view. Future milestone (v3.0).
- **MindrianOS CLI tools consolidation** -- consolidate scripts/ into a single CLI. Needs roadmap discussion.
- **Team contribution analytics** -- visualization, time-series, network analysis. Future phase.
- **Obsidian integration** -- room/ as an Obsidian vault with [[wikilinks]]. Future.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEAM-01 | Room gains a `team/` directory with subfolders: `members/`, `mentors/`, `advisors/` | CONTEXT modifies this: dynamic folder creation. team/ created empty by new-project; role subfolders created on demand by create-speaker-profile. No pre-created subfolders. |
| TEAM-02 | Each person gets their own folder with PROFILE.md and contribution subfolders | Already implemented by create-speaker-profile. Phase 7 extends PROFILE.md with status, roles (plural), computed Contributions backlinks section. |
| TEAM-03 | `/mindrian-os:new-project` creates the team/ structure alongside 8 topic sections | Update new-project.md Step 4 to add `mkdir -p room/team/` with no subfolders. Single line addition. |
| TEAM-04 | When filing meeting segments, artifacts are cross-linked to both topic section AND speaker's person folder | CONTEXT modifies: topic primary + backlink. Artifacts filed ONLY to topic section with full attribution frontmatter. Backlinks computed by compute-team into PROFILE.md Contributions section. No duplicate files. |
| TEAM-05 | `team/TEAM-STATE.md` is computed from filesystem -- who contributes what, expertise distribution, gaps | New `scripts/compute-team` script. Scans team/ profiles + room/ artifacts with speaker attribution. Outputs TEAM-STATE.md as knowledge landscape context. Called by compute-state. |
| ARCH-01 | Each meeting gets its own folder in `room/meetings/YYYY-MM-DD-{name}/` with full package | Extends existing meeting archive from file-meeting (which already creates transcript.md, summary.md, filed-to/). Phase 7 adds: speakers.md, decisions.md, action-items.md, metadata.yaml, audio copy. |
| ARCH-02 | `/mindrian-os:status` shows meeting count and last meeting date | Already partially implemented in compute-state (counts meetings, shows last date). Phase 7 ensures status.md command displays team intelligence too. |
| ARCH-03 | Cross-meeting intelligence: Larry can reference past meetings | Implemented via metadata.yaml grep across meetings/. Larry searches speaker names, topics, decisions in metadata.yaml files for fast lookup. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bash | 5.x | Scripts (compute-team, updated compute-state) | Existing pattern -- all scripts are bash. No new runtime dependencies. |
| YAML frontmatter | N/A | Attribution metadata in every artifact | Established pattern from Phase 6 artifact-template.md |
| Markdown | N/A | PROFILE.md, TEAM-STATE.md, meeting archive files | Entire plugin is markdown-native (ICM architecture) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| grep/find | N/A | Frontmatter scanning for backlink computation | compute-team scans room/ for speaker attribution in frontmatter |
| date | N/A | Activity recency calculation | Status lifecycle inference (last_active computation) |
| cp | N/A | Audio file copy into meeting archive | Only when --audio flag was used in file-meeting |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| grep metadata.yaml for meeting lookup | SQLite index | Overkill for dozens of meetings. Grep scales fine for venture-stage projects. |
| Computed backlinks in PROFILE.md | Symlinks in speaker folders | CONTEXT.md locked "topic primary + backlink" -- no duplicate files. Computation is cleaner than filesystem links. |
| Bash script for compute-team | Node.js/Python script | Breaks the all-bash-scripts pattern. Bash is sufficient for filesystem scanning + markdown generation. |

**Installation:**
```bash
# No new dependencies. All tools are bash builtins or standard Linux utilities.
```

## Architecture Patterns

### Updated Room Structure (Post-Phase 7)

```
room/
├── problem-definition/        # Topic sections (unchanged)
├── market-analysis/
├── solution-design/
├── business-model/
├── competitive-analysis/
├── team-execution/
├── legal-ip/
├── financial-model/
├── team/                      # NEW: people layer (created empty by new-project)
│   ├── TEAM-STATE.md          # Computed by scripts/compute-team
│   ├── mentors/               # Created on demand by create-speaker-profile
│   │   └── lawrence-aronhime/
│   │       ├── PROFILE.md     # Extended with status, roles, computed Contributions
│   │       ├── insights/      # (existing pattern -- but NO duplicates now)
│   │       ├── advice/
│   │       ├── connections/
│   │       └── concerns/
│   ├── founders/              # Created on demand
│   │   └── sarah-chen/
│   │       └── PROFILE.md
│   └── investors/             # Created on demand
│       └── michael-torres/
│           └── PROFILE.md
├── meetings/                  # Meeting archive layer
│   └── 2026-03-15-board-strategy-q1/
│       ├── transcript.md      # Existing (Phase 6)
│       ├── summary.md         # Existing (Phase 6)
│       ├── speakers.md        # NEW: who attended + roles
│       ├── decisions.md       # NEW: extracted decisions
│       ├── action-items.md    # NEW: with owners + deadlines
│       ├── metadata.yaml      # NEW: structured searchable metadata
│       ├── recording.mp3      # NEW: audio copy (if --audio)
│       └── filed-to/          # Existing (Phase 6)
├── meeting-*.md               # Compact root references (existing)
├── STATE.md                   # Extended by compute-state calling compute-team
└── USER.md
```

### Pattern 1: Topic Primary + Computed Backlinks

**What:** Artifacts live ONLY in their topic section. Speaker attribution is in YAML frontmatter. PROFILE.md has a Contributions section that is computed by scanning frontmatter across all room sections.

**When to use:** Every time compute-team runs (called by compute-state).

**Example:**
```markdown
# In room/market-analysis/2026-03-15-enterprise-growth.md (EXISTING, already filed):
---
speaker: Lisa Wong
speaker_role: researcher
profile_path: team/researchers/lisa-wong
meeting_date: 2026-03-15
meeting_id: 2026-03-15-board-strategy-q1
segment_type: insight
confidence: 0.85
---

# In room/team/researchers/lisa-wong/PROFILE.md (COMPUTED by compute-team):
## Contributions

| Date | Section | Type | Artifact |
|------|---------|------|----------|
| 2026-03-15 | market-analysis | insight | [[market-analysis/2026-03-15-enterprise-growth.md]] |
| 2026-03-15 | financial-model | insight | [[financial-model/2026-03-15-cost-projections.md]] |
```

### Pattern 2: Extended PROFILE.md Schema

**What:** PROFILE.md frontmatter gains status lifecycle, multiple roles, and last_active tracking.

**Example:**
```yaml
---
name: Sarah Chen
roles: [founder, team-member]
primary_role: founder
status: active
affiliation: Acme Ventures
first_meeting: 2026-03-10
last_active: 2026-03-20
meetings_attended: 4
created_by: file-meeting
research_status: complete
research_date: 2026-03-10
last_updated: 2026-03-20
---
```

**Key changes from Phase 6 PROFILE.md:**
- `role` (singular) becomes `roles` (list) + `primary_role` (determines folder location)
- `status: active/inactive/alumni/potential` added
- `last_active` added (computed from latest meeting attendance)

### Pattern 3: Full Meeting Archive Package

**What:** Each meeting folder becomes a self-contained archive with all extracted intelligence.

**New files beyond Phase 6:**

```markdown
# speakers.md
---
meeting_id: 2026-03-15-board-strategy-q1
meeting_date: 2026-03-15
---
# Speakers: Board Strategy Session Q1

| Speaker | Role | Segments | Profile |
|---------|------|----------|---------|
| Sarah Chen | founder | 8 | [[team/founders/sarah-chen/PROFILE.md]] |
| Lawrence Aronhime | mentor | 12 | [[team/mentors/lawrence-aronhime/PROFILE.md]] |
```

```markdown
# decisions.md
---
meeting_id: 2026-03-15-board-strategy-q1
---
# Decisions: Board Strategy Session Q1

1. **Focus on enterprise first** -- Sarah Chen (founder)
   Filed to: [[solution-design/2026-03-15-enterprise-focus.md]]
   Impact: market-analysis, business-model, financial-model
```

```markdown
# action-items.md
---
meeting_id: 2026-03-15-board-strategy-q1
---
# Action Items: Board Strategy Session Q1

| Owner | Task | Deadline | Status |
|-------|------|----------|--------|
| David Park | Enterprise pricing deck | 2026-03-22 | open |
```

```yaml
# metadata.yaml
meeting_id: 2026-03-15-board-strategy-q1
meeting_name: Board Strategy Session Q1
meeting_date: 2026-03-15
source: transcript
speakers:
  - name: Sarah Chen
    role: founder
    slug: sarah-chen
  - name: Lawrence Aronhime
    role: mentor
    slug: lawrence-aronhime
topics:
  - enterprise strategy
  - market validation
  - pricing
decisions_count: 2
insights_count: 5
action_items_count: 3
sections_touched:
  - solution-design
  - market-analysis
  - financial-model
has_audio: false
```

### Pattern 4: Layered Computation (compute-state -> compute-team)

**What:** compute-state orchestrates compute-team as a sub-step. compute-team produces TEAM-STATE.md. compute-state incorporates team intelligence into its output.

**Flow:**
```
compute-state runs
  -> scans sections (existing)
  -> calls scripts/compute-team <room_dir>
  -> compute-team scans team/ profiles + room/ frontmatter
  -> compute-team writes room/team/TEAM-STATE.md
  -> compute-state reads TEAM-STATE.md for summary in STATE.md
```

### Pattern 5: TEAM-STATE.md as Knowledge Landscape

**What:** A context document for Larry that maps team knowledge, expertise gaps, and missing perspectives.

**Example structure:**
```markdown
---
computed: 2026-03-20T14:30:00Z
team_size: 6
active_members: 5
roles_represented: [founder, mentor, researcher, investor, advisor]
---
# Team Knowledge Landscape

## Expertise Distribution

| Person | Primary Expertise | Sections Contributed | Last Active |
|--------|------------------|---------------------|-------------|
| Sarah Chen | Product/Strategy | solution-design (8), problem-definition (3) | 2026-03-20 |
| Lawrence Aronhime | Problem Framing | problem-definition (12), market-analysis (5) | 2026-03-18 |

## Knowledge Gaps

| Section | Contributors | Gap Assessment |
|---------|-------------|----------------|
| legal-ip | 0 | CRITICAL: No legal perspective in team |
| financial-model | 1 (Michael Torres) | CONCENTRATION: Single source of financial input |

## Missing Perspectives

- No **customer** voice in the room -- all insights are internal/advisor
- No **domain-expert** beyond the founding team
- **competitive-analysis** relies solely on founder perspective

## Role Distribution

| Role | Count | Members |
|------|-------|---------|
| founder | 2 | Sarah Chen, David Park |
| mentor | 1 | Lawrence Aronhime |
| investor | 1 | Michael Torres |
| researcher | 1 | Lisa Wong |
| advisor | 1 | Rachel Kim |

## Activity Patterns

| Person | Status | Meetings | Last Active | Trend |
|--------|--------|----------|-------------|-------|
| Sarah Chen | active | 8 | 2026-03-20 | consistent |
| Lawrence Aronhime | active | 6 | 2026-03-18 | consistent |
| Michael Torres | active | 2 | 2026-03-10 | declining |

## Agreement/Disagreement Patterns

[Computed from CONTRADICTS/CONVERGES edges in filed artifacts]

## Influence Scoring

[Computed from decision attribution -- who drives decisions vs who informs]
```

### Anti-Patterns to Avoid

- **Duplicate files in speaker folders:** CONTEXT explicitly says topic primary + backlink. NEVER copy artifacts into speaker subfolders. The insights/advice/connections/concerns subfolders in speaker profiles are used ONLY for Phase 6 legacy compatibility -- Phase 7 transitions to computed backlinks in PROFILE.md.
- **Pre-created empty folders:** Dynamic creation only. No `mkdir -p room/team/mentors/ room/team/advisors/` in new-project.
- **TEAM-STATE.md as productivity tracker:** This is a KNOWLEDGE LANDSCAPE tool. Never include metrics like "most productive contributor" or "attendance rate."
- **Moving profiles when roles change:** Profile stays in original role folder. Update `roles` list and `primary_role` in frontmatter. Add note in Context section.
- **Blocking file-meeting on compute-team:** Backlinks are computed on demand (when compute-state/compute-team runs), NOT during the filing pipeline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontmatter parsing in bash | Custom YAML parser | grep/sed for specific fields | YAML is simple enough for field extraction. Full parsing not needed. |
| Meeting metadata search | Database/index | grep across metadata.yaml files | Venture projects have tens of meetings, not thousands. Grep is fast enough. |
| Cross-reference graph | In-memory graph structure | Filesystem scan + frontmatter attribution | The filesystem IS the graph. Each artifact's frontmatter contains the edges. |
| Activity tracking | Custom event log | Compute from meeting dates in metadata.yaml | Meeting participation IS the activity signal. Infer, don't track. |
| Backlink computation | Real-time update system | On-demand scan by compute-team | Computed state is always accurate. No stale cache problem. |

**Key insight:** The filesystem IS the database. YAML frontmatter IS the schema. Grep IS the query engine. This is by design -- the plugin has zero runtime dependencies beyond bash.

## Common Pitfalls

### Pitfall 1: PROFILE.md Frontmatter Breaking Change
**What goes wrong:** Changing `role` (string) to `roles` (list) breaks existing profiles created by Phase 6's create-speaker-profile.
**Why it happens:** Phase 6 profiles have `role: mentor` (singular string). Phase 7 needs `roles: [mentor]` (list).
**How to avoid:** Update create-speaker-profile to write BOTH `role` (for backward compat) and `roles` (list). compute-team reads `roles` first, falls back to `role` as single-element list. Migration is graceful.
**Warning signs:** grep for `^roles:` returns empty but `^role:` returns results.

### Pitfall 2: Circular Computation Dependency
**What goes wrong:** compute-state calls compute-team, compute-team reads STATE.md for venture context.
**Why it happens:** Layered computation creates a potential circular dependency.
**How to avoid:** compute-team NEVER reads STATE.md. It only reads team/ profiles and room/ artifact frontmatter. Venture stage context comes from compute-state passing it as an argument, not from reading STATE.md.
**Warning signs:** compute-team script has `cat room/STATE.md` in it.

### Pitfall 3: Speaker Subfolder Content vs Computed Backlinks
**What goes wrong:** Phase 6 file-meeting already creates copies in speaker subfolders (insights/, advice/, etc.). Phase 7 says "topic primary + no duplicates."
**Why it happens:** CONTEXT.md explicitly says no duplicate files, but existing file-meeting.md Step 4 creates speaker reference copies.
**How to avoid:** Phase 7 must update file-meeting.md Step 4 to STOP creating speaker reference copies. The "Create Speaker Reference Copy" substep gets removed. Backlinks in PROFILE.md replace the need for subfolder copies.
**Warning signs:** Both a file in room/market-analysis/ AND a copy in team/researchers/lisa-wong/insights/.

### Pitfall 4: metadata.yaml Speaker Slug Inconsistency
**What goes wrong:** metadata.yaml stores speaker slugs that don't match actual profile directory names.
**Why it happens:** Slug generation happens in two places (file-meeting for metadata.yaml, create-speaker-profile for directory name) without shared logic.
**How to avoid:** Use create-speaker-profile's slug generation as the canonical source. metadata.yaml slug field must match exactly.
**Warning signs:** `find team/ -name "PROFILE.md"` slugs don't match `grep slug metadata.yaml` values.

### Pitfall 5: Status Lifecycle Confusion
**What goes wrong:** User sets `status: active` but person hasn't attended a meeting in months. Or compute-team marks someone inactive who the user considers active.
**Why it happens:** Explicit status (user-set) and inferred status (from activity) can conflict.
**How to avoid:** Keep explicit status as the source of truth. compute-team adds `inferred_status` and `last_active` as SEPARATE fields. Larry uses both: "Sarah's status is 'active' but she hasn't been in recent meetings. Still active?" This is a prompt, not an override.
**Warning signs:** PROFILE.md has `status: active` but `last_active: 2026-01-15`.

## Code Examples

### Updated create-speaker-profile PROFILE.md output

```yaml
---
name: Tyler Chen
roles: [researcher]
primary_role: researcher
role: researcher  # backward compat
status: active
affiliation: (unknown -- pending research)
first_meeting: 2026-03-20
last_active: 2026-03-20
meetings_attended: 1
created_by: file-meeting
research_status: pending
last_updated: 2026-03-20
---

# Tyler Chen (researcher)

**Role:** researcher | **Affiliation:** Unknown | **Status:** active

## Context

[To be filled after proactive research]

## Expertise

[To be inferred from meeting contributions]

## Contributions

[Computed by compute-team -- do not edit manually]
```

### compute-team core scanning logic (bash)

```bash
#!/usr/bin/env bash
# compute-team: Scan team/ and room/ to produce TEAM-STATE.md
# Called by compute-state as a sub-step

set -euo pipefail
ROOM_DIR="${1:-.}"

# Scan all PROFILE.md files for team roster
declare -a team_names=()
declare -a team_roles=()
declare -a team_statuses=()
declare -a team_last_active=()

while IFS= read -r profile; do
  name=$(grep -m1 '^name:' "$profile" | sed 's/^name: *//')
  roles=$(grep -m1 '^roles:' "$profile" | sed 's/^roles: *//' || \
          grep -m1 '^role:' "$profile" | sed 's/^role: *//')
  status=$(grep -m1 '^status:' "$profile" | sed 's/^status: *//' || echo "active")

  team_names+=("$name")
  team_roles+=("$roles")
  team_statuses+=("$status")
done < <(find "$ROOM_DIR/team" -name "PROFILE.md" 2>/dev/null)

# Scan room/ sections for speaker attribution
# Build contribution matrix: person -> section -> count
for section_dir in "$ROOM_DIR"/*/; do
  section=$(basename "$section_dir")
  [[ "$section" == team || "$section" == meetings || "$section" == .* ]] && continue
  for md_file in "$section_dir"*.md; do
    [ -f "$md_file" ] || continue
    speaker=$(grep -m1 '^speaker:' "$md_file" | sed 's/^speaker: *//' || echo "")
    [ -n "$speaker" ] || continue
    # Increment contribution count for this speaker + section
  done
done

# Compute expertise distribution, gaps, missing perspectives
# Write TEAM-STATE.md
```

### metadata.yaml generation (in file-meeting update)

```bash
# After filing all segments, generate metadata.yaml
cat > "room/meetings/${MEETING_DIR}/metadata.yaml" <<EOF
meeting_id: ${MEETING_ID}
meeting_name: ${MEETING_NAME}
meeting_date: ${MEETING_DATE}
source: ${SOURCE}
speakers:
$(for s in "${SPEAKERS[@]}"; do
  echo "  - name: ${s[name]}"
  echo "    role: ${s[role]}"
  echo "    slug: ${s[slug]}"
done)
topics: ${TOPICS}
decisions_count: ${DECISION_COUNT}
insights_count: ${INSIGHT_COUNT}
action_items_count: ${ACTION_COUNT}
sections_touched: ${SECTIONS}
has_audio: ${HAS_AUDIO}
EOF
```

### Updated attribution frontmatter (extends artifact-template.md)

```yaml
---
methodology: file-meeting
created: 2026-03-20
source: transcript
attribution:
  speaker: Lisa Wong
  role: researcher
  profile_path: team/researchers/lisa-wong
  meeting_date: 2026-03-20
  meeting_id: 2026-03-20-market-review
segment_type: insight
confidence: 0.85
room_section: market-analysis
assumptions:
  - claim: "Enterprise grew 34%"
    status: unvalidated
    impacts: [financial-model]
perspective: researcher
cascade_sections: [financial-model, business-model]
---
```

Note: The `attribution:` block is a nested YAML object replacing the flat `speaker`, `speaker_role`, `meeting_date` fields from Phase 6. This provides the complete provenance chain required by CONTEXT.md.

### Past meeting lookup (ARCH-03 implementation)

```bash
# Find all meetings where Lawrence participated
grep -rl "lawrence-aronhime" room/meetings/*/metadata.yaml

# Find meetings that discussed pricing
grep -rl "pricing" room/meetings/*/metadata.yaml

# Find decisions from last 30 days
for f in room/meetings/*/metadata.yaml; do
  meeting_date=$(grep '^meeting_date:' "$f" | sed 's/^meeting_date: *//')
  if [[ "$meeting_date" > "$(date -d '-30 days' +%Y-%m-%d)" ]]; then
    decisions=$(grep '^decisions_count:' "$f" | sed 's/^decisions_count: *//')
    if [[ "$decisions" -gt 0 ]]; then
      echo "$f: $decisions decisions"
    fi
  fi
done
```

## State of the Art

| Old Approach (Phase 6) | Current Approach (Phase 7) | Impact |
|------------------------|---------------------------|--------|
| Flat `role:` string in PROFILE.md | `roles:` list + `primary_role` + `status` | Supports multi-role people and lifecycle |
| Speaker reference copies in subfolders | Topic primary + computed backlinks | No duplicate files; always-accurate links |
| Minimal meeting archive (transcript, summary, filed-to/) | Full package (7 files + audio) | Self-contained searchable archive |
| compute-state is standalone | compute-state calls compute-team | Layered computation with team intelligence |
| No team intelligence | TEAM-STATE.md knowledge landscape | Larry has rich team context |
| No meeting metadata search | metadata.yaml with grep lookup | Cross-meeting memory for Larry |

**Breaking changes from Phase 6:**
- file-meeting.md Step 4 "Create Speaker Reference Copy" must be removed (replaced by computed backlinks)
- `speaker:` and `speaker_role:` flat fields in artifact frontmatter wrapped into `attribution:` block
- PROFILE.md gains new frontmatter fields (roles, primary_role, status, last_active)

## Open Questions

1. **Speaker subfolder migration**
   - What we know: Phase 6 creates copies in insights/advice/connections/concerns/ subfolders. Phase 7 removes this.
   - What's unclear: Should existing subfolder copies be deleted during migration, or left as orphans?
   - Recommendation: Leave existing copies. compute-team ignores them. Clean migration is not worth the risk.

2. **Attribution frontmatter migration**
   - What we know: Phase 6 artifacts have flat `speaker:`, `speaker_role:` fields. Phase 7 wants nested `attribution:` block.
   - What's unclear: Should compute-team support both formats?
   - Recommendation: YES -- compute-team must handle both flat (Phase 6 legacy) and nested `attribution:` block. Grep for `^speaker:` OR `^  speaker:` (indented under attribution:).

3. **TEAM-STATE.md intelligence depth**
   - What we know: CONTEXT says full intelligence (sentiment, patterns, influence scoring).
   - What's unclear: How much of this is achievable from filesystem-only data (no NLP, no embeddings)?
   - Recommendation: Tier the intelligence. Contribution counts, role distribution, gap analysis = from filesystem. Sentiment and agreement patterns = from Larry's classification metadata in frontmatter (already has segment_type, confidence, cascade_sections). Influence scoring = from decision attribution counts. No NLP needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | bash + manual verification |
| Config file | none -- see Wave 0 |
| Quick run command | `bash scripts/compute-team room/ && cat room/team/TEAM-STATE.md` |
| Full suite command | `bash scripts/compute-state room/ && cat room/STATE.md` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEAM-01 | team/ directory created with dynamic subfolders | smoke | `ls -la room/team/` after new-project | N/A -- manual |
| TEAM-02 | PROFILE.md has extended schema | unit | `grep '^roles:' room/team/*/*/PROFILE.md` | N/A -- Wave 0 |
| TEAM-03 | new-project creates team/ | smoke | Run `/mindrian-os:new-project` and verify `room/team/` exists | N/A -- manual |
| TEAM-04 | Cross-links via attribution frontmatter + computed backlinks | integration | `grep 'attribution:' room/*/2026-*.md && grep 'Contributions' room/team/*/*/PROFILE.md` | N/A -- Wave 0 |
| TEAM-05 | TEAM-STATE.md computed correctly | unit | `bash scripts/compute-team room/ && cat room/team/TEAM-STATE.md` | N/A -- Wave 0 |
| ARCH-01 | Full meeting archive package | smoke | `ls room/meetings/*/` verifies all 7 files | N/A -- manual |
| ARCH-02 | Status shows meeting + team info | smoke | Run `/mindrian-os:status` and check output | N/A -- manual |
| ARCH-03 | Past meeting lookup | unit | `grep -rl 'speaker_name' room/meetings/*/metadata.yaml` | N/A -- Wave 0 |

### Sampling Rate
- **Per task commit:** Verify changed script runs without error
- **Per wave merge:** Run compute-state -> compute-team pipeline on test room
- **Phase gate:** Full pipeline: new-project -> file-meeting -> compute-state with team intelligence

### Wave 0 Gaps
- [ ] Test room fixture with 2+ meetings and 3+ speakers for integration testing
- [ ] `scripts/compute-team` -- new script, does not exist yet
- [ ] Updated `scripts/compute-state` to call compute-team
- [ ] Updated `scripts/create-speaker-profile` with extended schema

## Sources

### Primary (HIGH confidence)
- Existing codebase: `scripts/create-speaker-profile`, `scripts/compute-state`, `commands/file-meeting.md`, `commands/new-project.md`, `commands/status.md` -- read directly
- `references/meeting/speaker-profile-template.md` -- existing PROFILE.md schema
- `references/meeting/summary-template.md` -- existing meeting archive structure
- `references/meeting/artifact-template.md` -- existing frontmatter schema

### Secondary (MEDIUM confidence)
- Phase 6 RESEARCH.md -- patterns and decisions that Phase 7 builds on
- `.planning/STATE.md` -- architectural evolution context

### Tertiary (LOW confidence)
- None -- all findings are derived from reading the actual codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- extending existing bash/markdown patterns, no new dependencies
- Architecture: HIGH -- all decisions locked in CONTEXT.md, patterns clearly derived from existing code
- Pitfalls: HIGH -- identified from reading actual Phase 6 code and spotting conflicts with Phase 7 decisions

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- internal architecture, no external dependencies)
