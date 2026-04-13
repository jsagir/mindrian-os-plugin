---
icm_layer: 2
stage: 02-classify
import_id: {{IMPORT_ID}}
created: {{TIMESTAMP}}
---

# Stage 02: Classify -- AI Classification + Review Gate

**Purpose:** For every file in the manifest, decide which section it belongs to and how confident we are.

**Inputs:**
- `../01-ingest/output/MANIFEST.json`
- `references/import-config.md` (Layer 3: thresholds, role keywords, frontmatter promotion map)

**Outputs (this folder's `output/`):**
- `classifications.md` -- editable Markdown table, one row per file
- `people-candidates.md` -- detected persons with role guesses
- `meeting-candidates.md` -- detected meeting files

**Contract:**
- Classifier IS the live agent (Larry). For each file: read content, filename, frontmatter, parent folder. Output: section slug + confidence (0..1) + 1-line evidence quote + decision verb (AUTO | SUGGEST | INBOX).
- Confidence thresholds (from references/import-config.md):
  - >= 0.75 -> AUTO
  - 0.45 - 0.74 -> SUGGEST (route to inbox/suggested with hint)
  - < 0.45 -> INBOX (unclassified)
- Person detection runs in parallel (5-tier ladder: frontmatter -> attendees header -> @mentions -> First Last >=3 mentions -> NER sweep).
- Meeting detection runs in parallel (2-of-3 rule: date in filename + attendees header + dialogue shape).
- After all 3 outputs are written, PAUSE for review gate.

**Review Gate:**
- Larry presents a summary: `N files classified, M people detected, K meetings flagged`
- User options:
  - `approve` -> proceed to Stage 03
  - `edit` -> open `classifications.md` (or people/meeting candidates) in editor; on save, re-read; re-summarize
  - `abort` -> stop. No files have moved. Free operation.
- Skip gate entirely if `--yes` flag passed.
- Stop entirely (don't proceed to Stage 03) if `--dry-run` flag passed.

**Failure modes:**
- Manifest missing -> abort
- Vault has > 500 files -> chunk classification into batches of 100 to avoid context bloat
- Classifier returns ambiguous output -> log to warnings[] in MANIFEST and place file in INBOX

**Verification:**
- classifications.md row count == manifest files[] length
- Every row has section + confidence + evidence + decision
- After review-gate edits, `lib/import/classifications-sync.cjs syncClassificationsToManifest` persists changes back into MANIFEST before Stage 03 runs.
