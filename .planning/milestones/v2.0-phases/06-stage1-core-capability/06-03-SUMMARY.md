---
phase: 06-stage1-core-capability
plan: 03
subsystem: meeting-intelligence
tags: [meeting, file-meeting, speaker-profile, research, pipeline, transcript, provenance]

# Dependency graph
requires:
  - phase: 06-01
    provides: "7 meeting reference files (transcript patterns, segment classification, section mapping, artifact/summary/speaker templates)"
  - phase: 06-02
    provides: "scripts/transcribe-audio Velma wrapper for --audio input mode"
  - phase: 06-04
    provides: "references/meeting/cross-relationship-patterns.md for Step 6 batch scan"
provides:
  - "commands/file-meeting.md: 6-step pipeline command for meeting transcript filing with confirm-then-file UX"
  - "scripts/create-speaker-profile: Bash script creating ICM nested folder profiles under room/team/"
  - "scripts/research-speaker: Bash script for proactive web research on new speakers with --apply flag"
  - "commands/help.md: Updated with file-meeting command and meeting-aware recommendations"
affects: [phase-7-team-room, phase-8-cross-meeting, phase-9-knowledge-graph]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "6-step meeting pipeline: input -> speaker ID -> classify -> confirm-then-file -> summary -> cross-relationship scan"
    - "Post-pipeline proactive research: never block filing on external API calls"
    - "Smart hybrid speaker table: AUTO-MATCHED / NEEDS CONFIRMATION statuses"
    - "Structured rejection reasons: not relevant / already known / wrong section / other"
    - "Dual-storage meeting archive: full summary in meetings/ dir, compact reference at room root"

key-files:
  created:
    - commands/file-meeting.md
    - scripts/create-speaker-profile
    - scripts/research-speaker
  modified:
    - commands/help.md

key-decisions:
  - "file-meeting is a thin command orchestrating 6 pipeline steps conversationally through Larry's voice"
  - "Speaker research runs post-pipeline only -- never blocks the filing flow (Pitfall 7)"
  - "research-speaker outputs to stdout for user confirmation; --apply flag writes to PROFILE.md only after approval"
  - "Meeting-aware recommendations added to help.md for organic discoverability"

patterns-established:
  - "6-step meeting pipeline pattern: input, speaker ID, classify, confirm-then-file, summary, cross-relationship"
  - "Post-pipeline research pattern: create profile stubs during filing, research after pipeline completes"
  - "Smart hybrid matching: auto-match known profiles, flag unknowns for confirmation"
  - "Batched confirm-then-file: group by type, offer all/review/skip per batch"

requirements-completed: [MEET-01, MEET-02, MEET-03, MEET-04, MEET-05, MEET-06, MEET-07]

# Metrics
duration: 7min
completed: 2026-03-23
---

# Phase 6 Plan 03: File-Meeting Command + Speaker Research Summary

**6-step meeting filing pipeline command with speaker profile creation, proactive web research, and help integration -- consumes all reference files from Plans 01/02/04**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-23T17:58:02Z
- **Completed:** 2026-03-23T18:05:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Complete file-meeting command implementing the full 6-step pipeline: transcript input (3 modes), speaker identification with smart hybrid matching, priority-first segment classification, confirm-then-file with structured rejection, dual-storage meeting summary, and cross-relationship batch scan
- create-speaker-profile script creating ICM nested folder profiles (PROFILE.md + insights/ + advice/ + connections/ + concerns/) with all 12 role types mapped to plural directories
- research-speaker script with stdout-first design (user confirmation required before --apply writes to PROFILE.md) and graceful fallback when web search is unavailable
- help.md updated with Meeting Intelligence category, meeting-aware recommendations, and setup transcription command

## Task Commits

Each task was committed atomically:

1. **Task 1: Create file-meeting command and create-speaker-profile script** - `1419fb8` (feat)
2. **Task 2: Create research-speaker script** - `e8cbf23` (feat)
3. **Task 3: Update help.md with file-meeting command** - `a92e0eb` (feat)

## Files Created/Modified

- `commands/file-meeting.md` - 6-step pipeline command orchestrating transcript input, speaker ID, classification, confirm-then-file, summary, and cross-relationship scan
- `scripts/create-speaker-profile` - Bash script creating ICM nested folder profiles with research_status tracking
- `scripts/research-speaker` - Bash script for proactive web research with stdout output and --apply flag
- `commands/help.md` - Added file-meeting under Meeting Intelligence, meeting-aware recommendations, setup transcription in infrastructure

## Decisions Made

- file-meeting is a thin command that loads all reference files and orchestrates conversationally -- it delegates to existing scripts (transcribe-audio, create-speaker-profile, research-speaker) rather than inlining logic
- Speaker research runs AFTER the entire filing pipeline completes, never during -- this follows Pitfall 7 from research and the locked CONTEXT.md decision
- research-speaker outputs findings to stdout first; the calling command presents to user and only uses --apply after confirmation
- Meeting-aware recommendations in help.md trigger on meeting mentions or room/meetings/ existence for organic command discovery

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None -- Velma API key is required only for --audio mode and is configured via `/mindrian-os:setup transcription` (already implemented in Plan 02).

## Next Phase Readiness

- All Phase 6 plans (01-04) are now complete
- file-meeting command consumes all reference files, transcription script, and cross-relationship patterns
- Speaker profile infrastructure ready for Phase 7 team room features
- Cross-relationship scan (Tier 0) ready for Phase 8 upgrade to Tier 1 (LSA + MiniLM)
- help.md advertises the command for immediate user discoverability

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 06-stage1-core-capability*
*Completed: 2026-03-23*
