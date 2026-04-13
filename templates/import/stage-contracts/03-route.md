---
icm_layer: 2
stage: 03-route
import_id: {{IMPORT_ID}}
created: {{TIMESTAMP}}
---

# Stage 03: Route -- Deterministic File Placement

**Purpose:** Move every classified file from source to its target section. No AI.

**Inputs:**
- `../01-ingest/output/MANIFEST.json` (with classify-stage updates and any user overrides)
- `../02-classify/output/classifications.md` (re-read in case of edits)

**Outputs (this folder's `output/`):**
- `routing-log.md` -- every move, every collision, every refusal

**Contract:**
- For every file in MANIFEST whose classification is settled:
  1. Compute target: `room/{section}/{artifact-slug}/{artifact-slug}.md` (Phase 78 nested layout)
  2. Slug rules: lowercase, kebab-case, max 60 chars, derived from filename stem (or frontmatter `title:` if present)
  3. If destination folder exists -> append `-imported-{YYYY-MM-DD}` suffix; if that exists too, append `-2`, `-3`, etc.
  4. Create destination folder, copy/move file, update MANIFEST `destination_*` fields
  5. Inject `_imported_from:` provenance into the file's frontmatter
- Inbox branching by confidence when `classification.section === 'inbox'`:
  - conf >= 0.45 -> `inbox/suggested/{slug}/{slug}.md`
  - conf <  0.45 -> `inbox/unclassified/{slug}/{slug}.md`
- People: for each confirmed person, call `scripts/create-speaker-profile --layout=import --role-bucket={bucket} {slug} "{display}"`
- Meetings: copy detected meeting files to `imports/{id}/meetings-pending/` then Stage 03b shells out to `/mos:file-meeting --file` per file so they land in `room/meetings/`
- Source files in `--copy` mode are never deleted. In `--move` mode, source is unlinked AFTER successful target write
- Refuses to operate if target room is missing `STATE.md` (would create a broken room)

**Failure modes:**
- Permission denied on target -> abort, MANIFEST stage_state = "failed", partial state preserved (idempotent re-run picks up where it stopped)
- Disk full -> abort, log
- Target room nested inside another room -> refuse with explicit error

**Verification:**
- Every MANIFEST file with a destination_path exists on disk
- routing-log.md collision count matches MANIFEST.collisions length
- Source files unchanged (in copy mode)
