---
name: room-passive
description: >
  Data Room awareness, filing intelligence, and passive monitoring. Active when
  room/ exists -- gives Larry project structure context and filing guidance.
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
# activation: "resolve_room:active"  <- INERT. Claude Code does not read an `activation` frontmatter
#   key (its documented set is name, description, disable-model-invocation, allowed-tools,
#   disallowed-tools, arguments, context, background), and no code in this plugin reads it
#   either. Kept as a comment so the INTENT survives; it never gated anything. Pinned by
#   tests/test-skill-frontmatter-inert-keys.cjs.
paths:
  - "**/STATE.md"
  - "**/ROOM.md"
  - "**/MindrianRooms/**"
  - "**/.rooms/**"
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on infra. The passive room-listening skill runs every turn to capture insights; an always-on capture substrate with no discrete trigger."
---

# Room Passive -- Awareness + Filing Intelligence

## Activation

This skill activates when `scripts/resolve-room` finds any active room. The resolver checks (in order): central registry at `~/MindrianRooms/.rooms/registry.json`, directory scan under `~/MindrianRooms/`, workspace registry, and legacy `room/` fallback. If any strategy returns a path, this skill is active.

The resolved room path (absolute) is the working room for all operations below.

## Room Awareness

Be aware of the active room's structure: reference specific sections, note empty sections as opportunities, use entry counts for completeness, read ROOM.md for section purpose. The room lives under `~/MindrianRooms/[name]/` (or legacy `room/` for unmigrated workspaces).

## Room Structure

8 DD-aligned sections: problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model

Plus: `team/` (members/mentors/advisors with ICM nested profiles), `meetings/` (YYYY-MM-DD-{name}/ archives)

## ICM Layer 0 Mandate (MANDATORY)

Every directory in the Data Room MUST have an identity file (ROOM.md). No exceptions.
This is ICM Layer 0 -- it answers "Where am I? What belongs here? What does NOT belong here?"

### The Rule
When creating ANY new directory -- whether a room section, sub-room, team profile folder,
meeting archive, opportunity bank, or any other folder -- ALWAYS create a ROOM.md inside it.

### ROOM.md Template
```markdown
---
icm_layer: 0
section: {section-name or folder-type}
parent: {parent-room-or-directory}
---
# {Folder Display Name}

{One sentence: what this folder contains.}

## What Belongs Here
- {2-4 bullet points}

## What Does NOT Belong Here
- {2-3 redirects to correct locations}
```

### Enforcement
- When filing an artifact to a section that lacks ROOM.md, create it FIRST
- When creating a new sub-room, create ROOM.md for every section directory
- When running /mos:room or room analysis, flag directories missing ROOM.md as ICM gaps
- Scripts that create directories (create-speaker-profile, create-room, etc.) MUST generate ROOM.md
- This applies to ALL rooms, ALL sub-rooms, ALL sections, ALL special folders -- no exceptions

### Why This Matters
Without Layer 0, Claude (on any surface -- CLI, Desktop, Cowork) cannot determine what belongs
in a folder. This leads to misfiling, duplication, and lost context. ROOM.md is the folder's
contract with every agent that touches it.

## Filing Intelligence

When methodology produces an artifact:
1. Suggest correct room from methodology's default (see `references/methodology/index.md`)
2. Confirm before filing -- NEVER file silently
3. Uncertain classification: analyze content and suggest best section
4. Cross-room relevance: file to primary, mention secondary

### Wikilink Injection on Filing (NATIVE-02)

**Rule:** Whenever you write a new artifact into the active room (via any skill, command, or direct edit), the artifact MUST arrive with wikilinks already present. Do NOT leave wikilinking to a retroactive batch pass -- wikilinks are part of the artifact's birth, not a later cleanup.

**How (preferred -- call the wrapper):**

After writing a new file, immediately run:
```bash
node scripts/wikilink-file.cjs "$ROOM_DIR" "$NEW_FILE_PATH" \
  [--filed-to-target="market-analysis/2026-04-09-tam.md"] \
  [--meeting-slug="2026-04-09-align-strategy-session"]
```

The wrapper loads `lib/vault/room-scanner.cjs` + `lib/vault/wikilink-builder.cjs`, scans the room once, injects team-name wikilinks into the new file's body, and (if a meeting slug is given) appends a filed-to footer. Errors are logged to stderr but never abort filing -- backward compatibility is non-negotiable.

**How (manual -- when running the wrapper is not feasible):**

Inject wikilinks directly while writing the artifact:

- **Team members:** First occurrence of each team member display name in the body -> `[[team/{category}/{slug}/PROFILE.md|{Display Name}]]`. Longer names beat prefixes (e.g., "Avital Leibovich" wins over "Avital"). Never self-link (the person's own PROFILE.md stays plain).
- **Section references** in STATE.md / ROOM.md -> `[[{section}/ROOM.md|{section}]]`
- **Filed-to stubs** (one stub per filed artifact under `meetings/{slug}/filed-to/`) -> include BOTH lines:
  ```
  -> Full artifact: [[{section}/{artifact-filename}.md]]
  <- Source meeting: [[meetings/{slug}/summary.md|{Meeting Display Name}]]
  ```
- **Meeting display name** is the slug with the `YYYY-MM-DD-` prefix stripped and the remainder title-cased ("2026-04-09-align-strategy-session" -> "Align Strategy Session").

**Graceful fallback (WIKI-06):** If the room has zero team profiles or zero meetings, skip that link type. Do not crash, do not invent targets.

**Idempotence:** Never double-link. If `[[...|Name]]` already exists for a display name, don't add another occurrence of the same link. If a filed-to footer line already exists, do not duplicate it.

**Canonical builder module:** See `lib/vault/wikilink-builder.cjs` -- it exports `buildTeamLinks`, `buildSectionLink`, `buildMeetingLink`, `buildFiledToFooter`, `injectFiledToFooter` as pure functions. The `scripts/wikilink-file.cjs` wrapper is the preferred filing-time entry point. Phase 76's retroactive `scripts/vault-wikilink-injector.cjs` remains available for whole-room sweeps.

## Active Room Lock (Multi-Room)

When `.rooms/registry.json` exists:
- Resolve active room before ANY write
- Target path MUST be inside active room
- Block cross-room writes with error + fix (`/mos:rooms open [target]`)
- Non-room writes always allowed
- Admin commands room-agnostic

Single-room mode (no registry): skip lock checks.

## Provenance Metadata

Every filed artifact MUST include frontmatter: methodology, created, depth, problem_type, venture_stage, room_section.

## Meeting-Sourced Artifacts

`source: transcript` artifacts carry extended metadata: speaker, speaker_role, meeting_date, segment_type, confidence, assumptions, perspective, cascade_sections.

- Cross-linked to topic section AND speaker profile
- Track assumption validity across sessions
- Cascade awareness via `cascade_sections:` field

For ad-hoc meeting mentions, suggest `/mos:file-meeting` for structured filing.

## UDS Cross-Instance Listener Stubs (READY-03)

<!-- UDS (Unified Data Sharing) is a future Anthropic feature for cross-instance state sharing.
     When UDS ships, room-passive should listen for external room updates from other Claude instances
     (e.g., a Cowork teammate files an artifact, and your Desktop session sees it).

     Activation conditions:
     1. Environment variable `tengu_harbor` is set to `true` (UDS feature gate)
     2. OR file `room/.mindrian/uds-active` exists
     3. AND room has multi-user configuration in room/.mindrian/uds-config.json

     When active, room-passive should:
     - Poll room/.mindrian/uds-inbox/ for incoming state diffs from other instances
     - Apply diffs to local room state (new artifacts, updated STATE.md sections)
     - Surface changes to user: "A teammate filed a new market analysis entry. Want to review?"
     - Write acknowledgments to room/.mindrian/uds-outbox/ for sync confirmation

     Until UDS ships, this is a no-op. The stubs exist so that:
     - The room-passive skill already documents the integration surface
     - When UDS activates via GrowthBook gate, only the transport layer needs implementation
     - The skill instructions (what to do with incoming changes) are already defined
-->

When `tengu_harbor` env var is `true` or `room/.mindrian/uds-active` exists, check `room/.mindrian/uds-inbox/` for cross-instance updates on session start. Surface new entries to user before standard greeting. This is a future capability -- currently a no-op until UDS ships.

## Wiki Dashboard Awareness

When room has 2+ sections with content, mention wiki once per session after filing, analyzing, or first methodology output: "`/mos:wiki` for live wiki view." Sharing: `/mos:wiki --export` for static HTML bundle.
