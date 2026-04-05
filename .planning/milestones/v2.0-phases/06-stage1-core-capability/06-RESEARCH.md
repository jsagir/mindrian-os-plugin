# Phase 6: Stage 1 Core Capability - Research

**Researched:** 2026-03-23 (updated)
**Domain:** Meeting transcript filing as wicked problem management gateway
**Confidence:** HIGH

## Summary

Phase 6 implements the `file-meeting` command -- the gateway through which conversations (the primary knowledge source for ventures) get decomposed into claims, assumptions, and relationships that populate the Data Room's nested system model. The discuss-phase locked in several critical decisions that reshape the original research: Velma replaces Whisper for all audio transcription, speaker roles are expanded to 12 types, new speakers automatically get ICM nested folder profiles with proactive web research, segments are presented priority-first, structured rejection reasons are captured as data, and the meeting archive uses dual storage (meetings/ directory + room/ root reference). The attend-mcp/Recall.ai/Vexa interface is designed but not implemented.

The core challenge is implementing a multi-step conversational pipeline (speaker ID with smart hybrid matching against team/, segment classification with priority ordering, section mapping with role-weighted routing, confirm-then-file with structured rejection capture, summary generation with narrative lead, and post-filing cross-relationship batch scan) within the existing thin-command + thick-reference pattern. Every filed artifact carries wicked-problem-aware metadata (assumptions, cascade impacts, rejection reasons, speaker perspective).

Audio transcription via Modulate Velma (3 cents/hour, streaming, diarization, 20+ emotions) replaces the previously researched Whisper stack entirely. Velma is a REST API -- no local Python/PyTorch dependencies. This dramatically simplifies the audio path but introduces a cloud dependency. Text paste and file path remain zero-dependency.

**Primary recommendation:** Build the command in the thin-command + thick-reference pattern. The command.md orchestrates 6 pipeline steps. A new `references/meeting/` directory holds transcript parsing patterns, expanded speaker role taxonomy (12 roles), segment classification rules with priority ordering, section mapping matrix with role-weighted routing, the wicked-problem-aware artifact template, meeting summary template with narrative + structured format, and cross-relationship detection patterns. A new `scripts/transcribe-audio` script wraps the Velma API. The `commands/setup.md` gains a `transcription` subcommand for Velma API key configuration. Speaker profiles use ICM nested folder structures under `team/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Velma only, no Whisper**: Modulate Velma is the sole transcription engine (3 cents/hour, streaming, diarization, 20+ emotions). No local Whisper fallback.
- **Explicit flags for input modes**: `/file-meeting` (paste), `/file-meeting --file path.txt`, `/file-meeting --audio recording.mp3`
- **Speaker labels are critical**: If transcript has speaker labels, Larry uses them. If missing, Larry asks the user to explain who was in the meeting and infers from content.
- **Infer metadata, then confirm**: Larry processes the transcript, infers date/participants/purpose from content and Data Room context, then presents inferences for user confirmation or correction.
- **Smart hybrid speaker presentation**: Larry shows a table of all identified speakers. If team/ directory has existing members, auto-matches by name. User confirms matches and fills unknowns.
- **Expanded role set**: mentor, researcher, team-member, investor, advisor, customer, founder, partner, domain-expert, government, competitor, unknown (12 roles)
- **Auto-create new profiles**: Every identified speaker who doesn't exist in team/ automatically gets an ICM nested folder profile created (not flat files) with sub-folders for insights/, advice/, connections/, concerns/.
- **Proactive person research**: When a new profile is created, a proactive agent researches the person online in context of the project/room and builds a Data Room-specific profile. User confirms before finalizing.
- **Priority-first ordering**: Larry shows decisions and action items first (highest impact), then insights and advice. Noise handled separately.
- **Always show classification reasoning**: Larry explains every classification transparently.
- **Flag potential noise**: Uncertain noise segments flagged for hidden insights.
- **Cross-relationship batch scan**: After ALL segments are filed, run a full cross-relationship scan. Don't interrupt filing flow.
- **Structured rejection reasons**: When user rejects, offer: [not relevant] [already known] [wrong section] [other]. Rejection reasons become graph data.
- **Narrative + structured meeting summary**: Larry writes a narrative lead paragraph in his voice, followed by structured sections.
- **Dual storage**: Full summary in room/meetings/YYYY-MM-DD-{name}/ with links to all filed artifacts. Compact reference at room/ root.
- **Action items with owners**: Owners from speaker context. Deadlines only when explicitly mentioned. No invented deadlines.
- **Emotion signals**: Surface only strong emotional signals from Velma data ("Speaker 3 was very skeptical..."). Don't surface routine emotions.
- **Role-weighted filing**: Speaker role influences classification priority and room routing.
- **Velma setup**: Both `/mindrian-os:setup transcription` command AND auto-prompt on first `--audio` use if not configured.
- **External source hook**: Design the interface for future external sources (Read AI, attend-mcp) in Phase 6. Only paste/file/audio are implemented. Phase 8 plugs in with `--latest` flag.
- **Cross-meeting memory**: Larry checks team/ directory for known people, suggests matches, but ALWAYS confirms -- never auto-assigns.
- **Chunking strategy**: Claude's discretion for handling long transcripts efficiently.
- **Exact provenance frontmatter format**: Must include speaker, speaker_role, meeting_date, segment_type, confidence, source: transcript.
- **Tier 0/1/2 cross-relationship**: Tier 0 = keyword matching (analyze-room). Tier 1 = LSA + MiniLM. Tier 2 = Brain MCP (full HSI).
- **Evolving graph architecture**: Every meeting is rebuilt in relation to ALL other conversations and the Data Room.

### Claude's Discretion
- Long transcript chunking strategy
- Exact provenance frontmatter format (must include required fields listed above)
- Surface adaptation for CLI vs Desktop vs Cowork (tri-polar design rule)
- attend-mcp integration depth in Phase 6 vs deferred

### Deferred Ideas (OUT OF SCOPE)
- **Live meeting join implementation** -- attend-mcp/Recall.ai/Vexa actual integration. Phase 6 designs the interface only.
- **Chrome extension for meeting capture** -- Out of scope. attend-mcp is the better approach.
- **Cross-meeting intelligence** -- Phase 8 (XMTG requirements). Phase 6 files individual meetings.
- **Read AI MCP integration** -- Phase 8 (RDAI requirements). Phase 6 designs the `--latest` hook.
- **Meeting nodes in knowledge graph dashboard** -- Phase 9 (GRAP requirements).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MEET-01 | Three input modes: paste, file path, audio file | Command.md routes via explicit flags; scripts/transcribe-audio wraps Velma API; text/file are direct |
| MEET-02 | Speaker identification with role confirmation | Reference file defines speaker patterns (Zoom/Teams/Otter/Meet/raw); smart hybrid matching against team/ directory; expanded 12-role taxonomy |
| MEET-03 | Segment classification (insight, advice, question, decision, action-item, noise) | Reference file defines taxonomy with priority ordering and role-aware heuristics |
| MEET-04 | Non-noise segments mapped to Data Room sections | Extends classify-insight logic; reference file maps speaker_role x segment_type to sections with role-weighted routing |
| MEET-05 | Confirm-then-file UX (same as room-passive) | Section-batched confirmation; structured rejection capture [not relevant / already known / wrong section / other] |
| MEET-06 | Provenance metadata in every filed artifact | Extended YAML frontmatter with speaker, speaker_role, meeting_date, segment_type, confidence, source, assumptions, perspective, cascade_sections |
| MEET-07 | Meeting summary after all filings | Narrative + structured template in dual storage (meetings/ + room/ root reference) |
| MEET-08 | Audio transcription (Velma, not Whisper) | Modulate Velma REST API (3 cents/hr, streaming, diarization, 20+ emotions); setup via /mindrian-os:setup transcription |
| MEET-09 | Timestamps and speaker labels from transcription | Velma provides speaker diarization natively; emotion signals surfaced for strong signals only |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Modulate Velma API | Current | Audio-to-text with speaker diarization + emotions | Locked decision. 3 cents/hour, streaming, 20+ emotions, 50+ languages, PII redaction. REST API -- no local dependencies. |
| curl / node fetch | N/A | HTTP client for Velma API calls | Scripts use curl for simplicity; bash-native, no dependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ffmpeg | 6.0+ | Audio format conversion (optional) | Only if Velma requires specific format. Velma supports .mp3, .m4a, .wav natively. |
| jq | 1.6+ | JSON parsing in bash scripts | Parse Velma API response in transcribe-audio script |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Velma API | openai-whisper + whisperx + pyannote | Local/offline but massive dependency chain (Python, PyTorch, HuggingFace token, ~2GB models). User locked Velma. |
| Velma API | OpenAI Whisper API | Better known but no emotion detection, no native diarization, higher cost ($0.006/min vs Velma $0.0005/min) |
| Velma API | Deepgram | Good diarization but higher cost (~$0.0043/min), no emotion detection |

**Installation:**
```bash
# No pip install needed -- Velma is a REST API
# Only need: curl (pre-installed), jq (for JSON parsing)
sudo apt install jq  # if not present
# Or on macOS: brew install jq
```

**Velma API key is stored in project .mcp.json or environment variable (same pattern as Brain MCP setup).**

## Architecture Patterns

### New Files for Phase 6

```
commands/
  file-meeting.md              # Thin command -- orchestrates 6 pipeline steps with explicit flag routing
references/
  meeting/
    transcript-patterns.md     # Speaker ID patterns for Zoom/Teams/Otter/Meet/raw + Velma output format
    segment-classification.md  # Taxonomy with priority ordering + role-aware heuristics
    section-mapping.md         # speaker_role x segment_type -> room section routing matrix (12 roles x 6 types x 8 sections)
    artifact-template.md       # YAML frontmatter + body with wicked problem fields
    summary-template.md        # Narrative + structured meeting summary template
    cross-relationship-patterns.md  # 5 relationship types with detection heuristics
    speaker-profile-template.md     # ICM nested folder profile template for new speakers
    live-join-interface.md     # Design spec for --join <url> and --latest flags (not implemented)
scripts/
  transcribe-audio             # Bash wrapper: Velma API call, audio -> timestamped speaker-labeled text
  create-speaker-profile       # Creates ICM nested folder profile for a new speaker under team/
```

### Modified Files

```
commands/setup.md              # Add 'transcription' subcommand for Velma API key
commands/help.md               # Add file-meeting to command list
skills/room-passive/SKILL.md   # Add transcript source awareness + meeting provenance
scripts/analyze-room           # Recognize meeting-sourced artifacts + meetings/ directory
scripts/compute-state          # Add meeting count, last meeting date to state output
```

### Pattern 1: Thin Command + Thick Reference (Existing Pattern)

**What:** Command.md contains the conversational flow and pipeline steps. Reference files contain the domain knowledge (patterns, taxonomies, templates). This is the established v1.0 pattern used by all 25+ methodology commands.

**When to use:** Always -- this is how MindrianOS commands work.

**Example (file-meeting command structure):**
```markdown
---
name: file-meeting
description: File a meeting transcript into your Data Room -- paste text, provide a file, or transcribe audio via Velma
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# /mindrian-os:file-meeting

You are Larry. This command files a meeting transcript into the Data Room.

## Setup

1. Read `references/meeting/transcript-patterns.md`
2. Read `references/meeting/segment-classification.md`
3. Read `references/meeting/section-mapping.md`
4. Read `references/meeting/artifact-template.md`
5. Read `references/meeting/summary-template.md`
6. Read `references/meeting/cross-relationship-patterns.md`
7. Read `references/meeting/speaker-profile-template.md`
8. Read `room/STATE.md` for venture context (if exists)
9. Scan `room/team/` for known speaker profiles

## Step 1: Get Transcript Input
[routing by flags: paste / --file / --audio]

## Step 2: Speaker Identification + Profile Creation
[smart hybrid: match against team/, auto-create ICM profiles for unknowns]

## Step 3: Segment Classification (Priority-First)
[classify, sort by priority: decisions > action-items > insights > advice]

## Step 4: Section Mapping + Confirm-Then-File
[section-batched presentation, structured rejection capture]

## Step 5: Create Meeting Summary + Archive
[narrative + structured, dual storage: meetings/ + room/ root]

## Step 6: Cross-Relationship Batch Scan
[INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES]
```

### Pattern 2: Wicked-Problem-Aware Artifact Frontmatter

**What:** Every filed meeting artifact extends the standard provenance metadata with wicked problem fields.

**When to use:** Every artifact created by file-meeting.

**Example:**
```yaml
---
methodology: file-meeting
created: 2026-03-23
source: transcript
speaker: Tyler Josephson
speaker_role: researcher
segment_type: insight
confidence: 0.85
meeting_date: 2026-03-22
room_section: solution-design
assumptions:
  - claim: "Ionic liquids avoid harsh acid entirely"
    status: unvalidated
    impacts: [financial-model, legal-ip]
perspective: researcher
cascade_sections: [financial-model, legal-ip]
---
```

### Pattern 3: Smart Hybrid Speaker Presentation

**What:** When Larry identifies speakers, cross-reference against existing team/ directory profiles. Present a table with auto-matches and unknowns for user to confirm.

**When to use:** Step 2 of every file-meeting run.

**Example flow:**
```
Larry: "I found 4 speakers in this transcript. Here's what I know:

| Speaker | Match | Role | Status |
|---------|-------|------|--------|
| Lawrence | team/mentors/lawrence-aronhime/ | mentor | AUTO-MATCHED |
| Tyler | (no match) | researcher? | NEEDS CONFIRMATION |
| Elena | (no match) | team-member? | NEEDS CONFIRMATION |
| David | team/advisors/david-calvo/ | advisor | AUTO-MATCHED |

Confirm the matches? For Tyler and Elena, what are their roles?
(mentor, researcher, team-member, investor, advisor, customer, founder,
partner, domain-expert, government, competitor, unknown)"
```

### Pattern 4: ICM Nested Folder Profile for New Speakers

**What:** When a new speaker is identified (not in team/), auto-create an ICM nested folder profile under team/ with proper role-based sub-directory placement.

**When to use:** Step 2 when unknown speakers are confirmed.

**Structure:**
```
room/team/
  mentors/
    lawrence-aronhime/
      PROFILE.md           # Name, role, affiliation, Data Room context
      insights/            # Insights attributed to this person
      advice/              # Advice given across meetings
      connections/         # People/resources they've connected
      concerns/            # Concerns they've raised
  researchers/
    tyler-josephson/
      PROFILE.md
      insights/
      advice/
      connections/
      concerns/
```

**PROFILE.md template:**
```yaml
---
name: Tyler Josephson
role: researcher
affiliation: (from web research or user input)
first_meeting: 2026-03-22
meetings_attended: 1
created_by: file-meeting
---

# Tyler Josephson (Researcher)

## Context
[What this person means to the venture, derived from meeting content]

## Expertise
[Inferred from their statements and proactive web research]

## Key Contributions
[Auto-populated from filed artifacts where speaker == this person]
```

### Pattern 5: Dual Storage for Meeting Archive

**What:** Every meeting gets both a full archive folder AND a compact reference at the room root level.

**When to use:** Step 5 after all filings.

**Structure:**
```
room/
  meetings/
    2026-03-22-team-sync/
      transcript.md          # Original or processed transcript
      summary.md             # Full narrative + structured summary
      filed-to/              # Symlinks or references to filed artifacts
  meeting-2026-03-22-team-sync.md  # Compact reference at root (for quick access)
```

### Pattern 6: Structured Rejection Capture

**What:** When user rejects a filing, capture a structured reason that becomes graph data.

**When to use:** Step 4 for every rejected segment.

**Example flow:**
```
User: "skip"
Larry: "Why skip? [not relevant] [already known] [wrong section] [other]"
User: "already known"
Larry records:
  - segment: "Ionic liquids cost less than traditional solvents"
  - rejection_reason: already_known
  - rejected_at: 2026-03-23
  - rejected_by: user
  -> Stored in meeting summary under ## Rejections section
  -> Future graph data (wicked problem architecture: rejection IS data)
```

### Pattern 7: Confirm-Then-File with Section Batching

**What:** Present segments grouped by section, sorted by priority within each section. Avoid per-segment fatigue.

**When to use:** Step 4.

**Example:**
```
Larry: "I classified 18 non-noise segments. Here's what I'd file, starting
with the highest-impact items:

**DECISIONS (2 segments):**
1. Lawrence (mentor): 'Focus on B2B first, consumer can wait.'
   -> team-execution | decision | HIGH confidence
   Reasoning: Direct strategic direction from mentor
2. Jonathan (founder): 'We're pivoting the pricing to usage-based.'
   -> business-model | decision | HIGH confidence
   Reasoning: Explicit business model change from founder

File both decisions? [all / review / skip]

**ACTION ITEMS (3 segments):**
[...]"
```

### Anti-Patterns to Avoid

- **Monolithic command file:** Do NOT put transcript patterns, classification rules, and templates in the command.md. Use the reference file pattern.
- **Silent filing:** NEVER file without confirmation. Rejection is data.
- **Ignoring speaker role context:** A mentor's "advice" and a researcher's "finding" go to different sections even with the same topic. Role-aware routing is essential.
- **Flat speaker profiles:** Use ICM nested folders (insights/, advice/, connections/, concerns/), not flat PROFILE.md files.
- **Auto-assigning without confirmation:** Even when Larry is confident about a speaker match from team/, ALWAYS confirm. Never auto-assign.
- **Treating audio transcription as blocking:** Audio/Velma is behind setup. Text paste is the zero-friction default.
- **Flat metadata:** Record assumptions implied, perspective lens, and cascade impact -- not just "who said what."
- **Interrupting filing with cross-relationships:** Run the batch scan AFTER all segments are filed. Don't break the filing flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio transcription | Custom speech-to-text | Modulate Velma API | 3 cents/hr, streaming, diarization, emotions -- locked decision |
| Speaker diarization | Custom speaker clustering | Velma's native diarization | Diarization is built into the API response |
| Emotion detection | Sentiment analysis pipeline | Velma's 20+ emotion categories | Only surface strong signals; Velma does the heavy lifting |
| Transcript format parsing | Universal parser script | Pattern-matching reference file | Zoom, Teams, Otter, Meet each have simple but distinct patterns. Reference file is more maintainable. |
| Room section classification | New classifier | Extend existing classify-insight script | Add meeting-specific keywords to the existing keyword-based classifier |
| Cross-relationship detection | Custom NLP pipeline | Larry's in-conversation reasoning + existing analyze-room | Claude reasons about content semantically better than any bash script |
| Speaker profile web research | Custom scraper | Larry's built-in web search capability | Larry can research people conversationally and build context-aware profiles |

**Key insight:** The "intelligence" in meeting filing is Larry's conversational reasoning, not algorithmic processing. Larry reads the transcript, understands context, identifies speakers, classifies segments, and surfaces cross-relationships. The scripts handle mechanical parts (Velma API call, file creation, state computation). Don't automate what Larry does best.

## Common Pitfalls

### Pitfall 1: Treating All Speaker Segments Equally
**What goes wrong:** Filing every statement without role-weighted priority. A mentor's offhand market comment is more valuable than a team member's status update.
**Why it happens:** Temptation to process linearly.
**How to avoid:** Priority-first ordering (locked decision). Batch by priority tier: decisions/action-items first, then insights/advice. Larry asks "want to review the lower-priority ones too?"
**Warning signs:** Every segment gets same confidence score; user gets fatigued confirming 30+ segments.

### Pitfall 2: Missing the Assumption Layer
**What goes wrong:** Filing insights without extracting the implied assumption. "TAM is $190M" is an insight but $190M is an assumption that can become stale.
**Why it happens:** Extra work to extract assumptions.
**How to avoid:** Artifact template MUST include `assumptions:` field. Larry identifies at least one assumption per non-noise segment. If none obvious, use `assumptions: none_detected`.
**Warning signs:** No assumption fields in filed artifacts.

### Pitfall 3: Velma Setup Friction
**What goes wrong:** User tries audio mode without API key configured, gets an error.
**Why it happens:** Cloud API requires credential setup.
**How to avoid:** Two paths (locked decision): (1) `/mindrian-os:setup transcription` proactive setup, (2) auto-prompt on first `--audio` use if not configured. Larry says "Audio transcription needs your Velma API key. Set it up now? It takes 30 seconds."
**Warning signs:** Users report errors when providing audio files.

### Pitfall 4: Confirm-Then-File Fatigue
**What goes wrong:** 25+ segments confirmed individually is exhausting.
**Why it happens:** Literal interpretation of "confirm each filing."
**How to avoid:** Section-batched presentation with priority ordering. "I found 4 insights for solution-design. File all 4? Review individually? Skip?"
**Warning signs:** Users stop engaging and say "yes to all."

### Pitfall 5: Cross-Relationship Scan as Afterthought
**What goes wrong:** Step 6 gets a throwaway "any contradictions?" check.
**Why it happens:** Developer fatigue by Step 6.
**How to avoid:** Step 6 IS the wicked problem management value. Budget equal effort. It's where Larry says "This changes your financial model assumption."
**Warning signs:** Step 6 outputs are generic or empty.

### Pitfall 6: Transcript Format Brittleness
**What goes wrong:** Parser works for Zoom but breaks on Teams, Otter, or raw paste.
**Why it happens:** Hardcoding one format.
**How to avoid:** Reference file documents 5+ formats with examples. Larry detects format or asks. For raw paste without labels, Larry infers from content or asks user.
**Warning signs:** "I can't identify speakers" for non-Zoom formats.

### Pitfall 7: ICM Profile Creation Blocking the Flow
**What goes wrong:** Creating full ICM nested folder profiles for 3 new speakers interrupts the meeting filing flow.
**Why it happens:** Profile creation with web research is time-consuming.
**How to avoid:** Create minimal profile stubs during Step 2 (just PROFILE.md + empty sub-folders). Queue proactive web research as a follow-up after Step 6. Present research results for user confirmation in a separate flow.
**Warning signs:** Filing pipeline stalls at Step 2 while researching people online.

### Pitfall 8: Dual Storage Inconsistency
**What goes wrong:** Meetings/ archive and room/ root reference get out of sync.
**Why it happens:** Two locations for the same information.
**How to avoid:** meetings/ directory is the source of truth. Room root reference is a compact generated file that points to meetings/. Generate it automatically after summary creation.
**Warning signs:** Summary in meetings/ differs from room/ root reference.

## Code Examples

### Velma API Integration Pattern (for scripts/transcribe-audio)

```bash
#!/usr/bin/env bash
# transcribe-audio: Audio file -> timestamped speaker-labeled transcript via Velma
# Requires: VELMA_API_KEY env var or .mindrian-os/velma-config
# Usage: scripts/transcribe-audio <audio-file> [output-file]

set -euo pipefail

AUDIO_FILE="$1"
OUTPUT_FILE="${2:-/dev/stdout}"

# Check for API key
VELMA_API_KEY="${VELMA_API_KEY:-}"
if [ -z "$VELMA_API_KEY" ]; then
  # Try reading from config
  CONFIG_FILE="${HOME}/.mindrian-os/velma-config"
  if [ -f "$CONFIG_FILE" ]; then
    VELMA_API_KEY=$(grep "^VELMA_API_KEY=" "$CONFIG_FILE" | cut -d= -f2-)
  fi
fi

if [ -z "$VELMA_API_KEY" ]; then
  echo "ERROR: Velma API key not configured." >&2
  echo "Run: /mindrian-os:setup transcription" >&2
  exit 1
fi

# Validate audio file exists
if [ ! -f "$AUDIO_FILE" ]; then
  echo "ERROR: Audio file not found: $AUDIO_FILE" >&2
  exit 1
fi

# Upload and transcribe via Velma API
# Velma returns JSON with speaker-labeled, timestamped segments + emotion data
RESPONSE=$(curl -s -X POST "https://api.modulate.ai/v1/transcribe" \
  -H "Authorization: Bearer ${VELMA_API_KEY}" \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@${AUDIO_FILE}" \
  -F "features=diarization,emotions" \
  -F "language=auto")

# Check for errors
if echo "$RESPONSE" | jq -e '.error' &>/dev/null; then
  echo "ERROR: Velma API error: $(echo "$RESPONSE" | jq -r '.error.message')" >&2
  exit 1
fi

# Format output: speaker-labeled timestamped segments
echo "$RESPONSE" | jq -r '
  .segments[] |
  "[" + .speaker + "] " + (.start | tostring) + "-" + (.end | tostring) +
  (if .emotions and (.emotions | length > 0) and (.emotions[0].confidence > 0.7)
   then " {" + .emotions[0].label + "}"
   else ""
   end) +
  "\n" + .text + "\n"
' > "$OUTPUT_FILE"
```

**Note:** The exact Velma API endpoint, request format, and response schema need verification against current Velma developer docs. The pattern above is based on publicly documented features (diarization, emotions, timestamps). The setup command should include a test call.

### Expanded Speaker Role Taxonomy

```markdown
| Role | Description | Filing Priority | Default Sections |
|------|-------------|----------------|------------------|
| mentor | Teaching guide, strategic advisor | HIGH | market-analysis, problem-definition |
| researcher | Subject matter expert, technical contributor | HIGH | solution-design, problem-definition |
| investor | Financial stakeholder, due diligence | HIGH | financial-model, competitive-analysis |
| advisor | Domain-specific counsel | MEDIUM-HIGH | varies by domain |
| customer | End user, buyer, target market | HIGH | market-analysis, business-model |
| founder | Core team, decision maker | MEDIUM | all sections |
| partner | Strategic partner, collaborator | MEDIUM | business-model, team-execution |
| domain-expert | External expert in specific field | MEDIUM-HIGH | varies by expertise |
| team-member | Internal team, execution | MEDIUM | team-execution, solution-design |
| government | Regulatory, policy, grants | MEDIUM | legal-ip, financial-model |
| competitor | Competitive intelligence source | LOW-MEDIUM | competitive-analysis |
| unknown | Role not determined | LOW | held pending role assignment |
```

### ICM Nested Folder Profile Creation Script Pattern

```bash
#!/usr/bin/env bash
# create-speaker-profile: Create ICM nested folder profile for a new speaker
# Usage: scripts/create-speaker-profile <room-dir> <name-slug> <role> <full-name>

set -euo pipefail

ROOM_DIR="$1"
NAME_SLUG="$2"
ROLE="$3"
FULL_NAME="$4"

# Map role to team/ subdirectory
case "$ROLE" in
  mentor) SUBDIR="mentors" ;;
  advisor) SUBDIR="advisors" ;;
  investor) SUBDIR="investors" ;;
  *) SUBDIR="members" ;;
esac

PROFILE_DIR="${ROOM_DIR}/team/${SUBDIR}/${NAME_SLUG}"

# Create ICM nested folder structure
mkdir -p "${PROFILE_DIR}/insights"
mkdir -p "${PROFILE_DIR}/advice"
mkdir -p "${PROFILE_DIR}/connections"
mkdir -p "${PROFILE_DIR}/concerns"

# Create minimal PROFILE.md (Larry will enrich later with web research)
cat > "${PROFILE_DIR}/PROFILE.md" << EOF
---
name: ${FULL_NAME}
role: ${ROLE}
affiliation: unknown
first_meeting: $(date +%Y-%m-%d)
meetings_attended: 1
created_by: file-meeting
---

# ${FULL_NAME} (${ROLE})

## Context
[To be enriched after meeting filing completes]

## Expertise
[To be enriched via proactive research]

## Key Contributions
[Auto-populated from filed artifacts]
EOF

echo "CREATED:${PROFILE_DIR}"
```

### Meeting Archive Dual Storage Pattern

```
# After all filings complete (Step 5):

room/
  meetings/
    2026-03-22-team-sync/
      transcript.md            # Full transcript (original or Velma output)
      summary.md               # Narrative + structured summary (source of truth)
      metadata.yaml            # Meeting metadata (participants, type, date, duration)

  # Compact root reference (auto-generated from meetings/ content)
  meeting-2026-03-22-team-sync.md
    # Contains: 1-paragraph narrative + link to full summary
    # Links to all filed artifacts
    # Quick-access for room/ browsers
```

### Velma Setup Flow (for commands/setup.md transcription section)

```markdown
## /mindrian-os:setup transcription

### 1. Explain What Velma Adds
"Velma gives Larry ears. When you have a recording of a meeting -- MP3, M4A,
WAV -- Larry can transcribe it locally with speaker labels and emotional
signals. 3 cents per hour. No data leaves your machine except to Velma's
API for transcription."

### 2. Collect API Key
"You'll need a Velma API key from modulate.ai/api. Sign up for free -- you
get 400 hours included."
- Ask for VELMA_API_KEY

### 3. Store Configuration
Write to workspace .mcp.json (merge with existing):
{
  "mcpServers": {
    "velma-transcribe": {
      "env": {
        "VELMA_API_KEY": "{user_provided_key}"
      }
    }
  }
}
Also write VELMA_API_KEY to ~/.mindrian-os/velma-config for script access.

### 4. Test Connection
Run scripts/transcribe-audio with a tiny test (or a simple API health check).

### 5. Report Result
"Velma is connected. Next time you run /file-meeting --audio recording.mp3,
Larry will transcribe and file it automatically."
```

### Live Meeting Join Interface Design (for references/meeting/live-join-interface.md)

```markdown
# Live Meeting Join Interface (Design Only -- Not Implemented in Phase 6)

## Command Interface
/mindrian-os:file-meeting --join <meeting-url>
/mindrian-os:file-meeting --latest

## Provider Options

### attend-mcp (Open Source)
- GitHub: rexposadas/attendee-mcp
- Backend: attendee.dev (open-source REST API)
- Supports: Zoom, Google Meet, Teams
- MCP tools: create_meeting_bot, get_meeting_transcript, make_bot_speak
- Setup: npm install + attendee backend + API key
- Config in .mcp.json:
  {
    "mcpServers": {
      "attendee": {
        "command": "node",
        "args": ["path/to/attendee-mcp/dist/index.js"],
        "env": {
          "MEETING_BOT_API_URL": "http://localhost:8000",
          "MEETING_BOT_API_KEY": "key"
        }
      }
    }
  }

### Recall.ai (Managed)
- Cost: $0.50/hr recording + $0.15/hr transcription
- SOC 2 / HIPAA compliant
- Single REST call to join
- MCP integration available via Composio

### Vexa (Open Source)
- GitHub: Vexa-ai/vexa
- License: Apache-2.0
- Self-hostable via Docker
- Has its own MCP server
- Supports: Google Meet, Teams, Zoom

## Phase 8 Integration Point
When Phase 8 implements --latest:
1. Check .mcp.json for configured meeting provider
2. Call provider's "get latest transcript" API
3. Feed into the same Step 1-6 pipeline
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local Whisper (openai-whisper) | Velma API (cloud, 3 cents/hr) | 2025-2026 | Zero local dependencies, built-in diarization + emotions |
| pyannote for speaker ID | Velma native diarization | 2025-2026 | No HuggingFace token, no PyTorch, no GPU |
| Manual transcript filing | LLM-powered classification + filing | 2025-2026 | Claude reasons semantically, not keyword-match |
| Flat person profiles | ICM nested folder profiles | 2026 (this phase) | Insights, advice, connections, concerns per person -- structured intelligence |
| Document repositories | Wicked problem management | 2026 (this project) | Assumptions tracked, cascades detected, rejection as data |
| Single meeting tools | MCP-based meeting bots (attend-mcp, Vexa) | 2025-2026 | Join meetings programmatically, get transcripts via API |

**Deprecated/outdated (for this project):**
- **Whisper local transcription** -- replaced by Velma (locked decision). Do not install openai-whisper, whisperx, or pyannote.
- **Flat speaker profiles** -- replaced by ICM nested folder profiles (locked decision).
- **6 speaker roles** -- expanded to 12 (locked decision).

## Open Questions

1. **Velma API exact endpoint and response schema**
   - What we know: Velma offers REST API with diarization and emotion detection. 3 cents/hour. 400 free hours. Supports streaming and batch.
   - What's unclear: Exact endpoint URLs, authentication header format, request/response JSON schema. Velma developer docs are behind signup.
   - Recommendation: Setup command should include a test call. The transcribe-audio script pattern above is a reasonable starting point that can be adjusted after reading Velma docs. The script is isolated -- updating it doesn't affect the rest of the pipeline.

2. **Team/ directory bootstrap for existing rooms**
   - What we know: v1 rooms have 8 flat sections. v2 adds team/ and meetings/. The room evolution diagram is in CLAUDE.md.
   - What's unclear: Should file-meeting auto-create team/ and meetings/ if they don't exist? Or require a migration step?
   - Recommendation: Auto-create on first file-meeting run. Check for team/ and meetings/ directories; create them silently if missing. No migration command needed -- the directories appear naturally when meeting intelligence is first used.

3. **Proactive web research for speaker profiles**
   - What we know: New speakers get ICM folder profiles. Proactive agent researches the person online in project context.
   - What's unclear: Should Larry do this inline during filing, or queue it as a post-filing task? How to avoid blocking the pipeline?
   - Recommendation: Create minimal profile stubs during Step 2. Queue web research for after Step 6. Present research results for user confirmation as a separate follow-up: "I've done some background research on Tyler Josephson. Want to review what I found?"

4. **Long transcript chunking**
   - What we know: Claude's discretion (from CONTEXT.md). Transcripts can be very long (1+ hour meetings).
   - What's unclear: At what length does chunking become necessary? How to maintain speaker context across chunks?
   - Recommendation: Process transcripts up to ~50K tokens in a single pass (Claude can handle this). For longer transcripts, chunk by speaker change boundaries with 2-3 segment overlap. Present segments from all chunks together in priority order.

5. **Emotion signal threshold**
   - What we know: Surface only strong emotional signals from Velma (locked decision). 20+ emotion categories.
   - What's unclear: What confidence threshold constitutes "strong"? Which emotions are worth surfacing?
   - Recommendation: Surface emotions with confidence > 0.7 that are "noteworthy" (skeptical, frustrated, excited, enthusiastic, concerned, angry). Ignore routine emotions (neutral, calm, attentive). Present as contextual notes: "Tyler was notably skeptical when discussing market size."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash + fixture-based (existing pattern) |
| Config file | None -- tests use scripts/ directly against fixtures |
| Quick run command | `bash scripts/classify-insight tests/fixtures/meeting-artifact.md` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEET-01 | Three input modes routed correctly | manual-only | Manual: test paste/file/audio in Claude | N/A |
| MEET-02 | Speaker identification from transcript text | smoke | `bash tests/test-speaker-id.sh` | Wave 0 |
| MEET-03 | Segment classification produces valid types | unit | `bash tests/test-segment-classify.sh` | Wave 0 |
| MEET-04 | Section mapping routes to correct rooms | unit | `bash scripts/classify-insight tests/fixtures/meeting-artifact.md` | Wave 0 (fixture needed) |
| MEET-05 | Confirm-then-file UX with structured rejection | manual-only | Manual: test in Claude conversation | N/A |
| MEET-06 | Filed artifact has complete provenance | unit | `bash tests/test-meeting-frontmatter.sh` | Wave 0 |
| MEET-07 | Summary artifact in dual storage with narrative + structured | smoke | `bash tests/test-meeting-summary.sh` | Wave 0 |
| MEET-08 | Velma API call produces transcript | integration | `bash scripts/transcribe-audio tests/fixtures/sample.wav` | Wave 0 (script + fixture + API key) |
| MEET-09 | Velma output includes timestamps + speaker labels | integration | `bash tests/test-velma-diarization.sh` | Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run: verify classify-insight handles meeting artifacts
- **Per wave merge:** Full bash test suite
- **Phase gate:** All automated tests green + manual conversation test of full 6-step pipeline

### Wave 0 Gaps
- [ ] `tests/run-all.sh` -- test runner that executes all test scripts
- [ ] `tests/fixtures/sample-transcript-zoom.txt` -- sample Zoom transcript for speaker ID tests
- [ ] `tests/fixtures/sample-transcript-teams.txt` -- sample Teams transcript
- [ ] `tests/fixtures/meeting-artifact.md` -- sample filed meeting artifact with full frontmatter (12-role, assumptions, cascade_sections)
- [ ] `tests/test-meeting-frontmatter.sh` -- validates YAML frontmatter fields present
- [ ] `tests/fixtures/sample.wav` -- short audio sample for Velma API tests (or mock)
- [ ] `scripts/transcribe-audio` -- Velma API wrapper script
- [ ] `scripts/create-speaker-profile` -- ICM nested folder profile creation script

## Sources

### Primary (HIGH confidence)
- `docs/superpowers/specs/2026-03-23-meeting-join-design.md` -- Complete design spec with pipeline steps, speaker roles, artifact templates
- `docs/research/LIVE_DATA_ROOM_JTBD_PAPER.md` -- Theoretical backbone: wicked problem framework, nested systems, assumption tracking
- `CLAUDE.md` -- Architectural evolution, cross-relationship discovery rule, ICM x wicked problem management
- `.planning/REQUIREMENTS.md` -- MEET-01 through MEET-09 requirement definitions
- `.planning/phases/06-stage1-core-capability/06-CONTEXT.md` -- All locked decisions including Velma, expanded roles, ICM profiles
- Existing codebase: commands/*.md (pattern), scripts/classify-insight, scripts/analyze-room, skills/room-passive/SKILL.md

### Secondary (MEDIUM confidence)
- [Modulate Velma API](https://www.modulate.ai/api/speech-to-text) -- API overview, pricing (3 cents/hr), features (diarization, 20+ emotions, 50+ languages, PII redaction)
- [Modulate Velma launch](https://newsroom.seaprwire.com/technologies/modulate-launches-velma-transcribe-to-redefine-cost-and-accuracy-in-speech-to-text/) -- Feature details, Ensemble Listening Model, benchmarks
- [attend-mcp GitHub](https://github.com/rexposadas/attendee-mcp) -- MCP server for Attendee meeting bots. Tools: create_meeting_bot, get_meeting_transcript, make_bot_speak
- [Attendee.dev](https://attendee.dev/) -- Open-source meeting bot API for Zoom, Google Meet, Teams
- [Vexa GitHub](https://github.com/Vexa-ai/vexa) -- Open-source meeting transcription API, Apache-2.0, self-hostable, has MCP server
- [Recall.ai pricing](https://www.recall.ai/blog/new-recall-ai-pricing-for-2026) -- $0.50/hr recording, $0.15/hr transcription, SOC 2 / HIPAA

### Tertiary (LOW confidence)
- Velma exact API endpoint URLs and response schema -- behind developer signup, not publicly documented in full. Script pattern is a reasonable approximation.
- Emotion confidence thresholds -- recommendation of 0.7 is based on general ML practice, not Velma-specific guidance.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Velma is the locked decision, REST API pattern is straightforward
- Architecture: HIGH -- design spec is detailed, existing thin-command + thick-reference pattern is proven, ICM nested folder pattern is consistent with project architecture
- Pitfalls: HIGH -- based on UX flow complexity analysis, team/ directory bootstrap concerns, and Velma API dependency management
- Audio pipeline: MEDIUM -- Velma API details not fully verified (behind signup). Script pattern is isolatable and can be updated without affecting core pipeline.
- Live join interface: MEDIUM -- attend-mcp, Recall.ai, Vexa all verified as real products with MCP support. Design-only in Phase 6.

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain; Velma API may update but pattern is isolatable)
