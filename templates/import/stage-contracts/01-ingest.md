---
icm_layer: 2
stage: 01-ingest
import_id: {{IMPORT_ID}}
created: {{TIMESTAMP}}
---

# Stage 01: Ingest -- Source Scan and Manifest

**Purpose:** Walk the source vault. No AI. No file moves. Pure deterministic snapshot.

**Inputs:**
- Source path: `{{SOURCE_PATH}}`
- Mode: `{{MODE}}`  (copy | move)

**Outputs (this folder's `output/`):**
- `MANIFEST.json` -- full source file inventory + content hashes
- `source-tree.md` -- human-readable file tree of the source vault

**Contract:**
- Walks `.md` and `.markdown` files only
- Skips `.obsidian/`, `.git/`, `node_modules/`, hidden dirs, `.trash/`
- Captures: relative path, size, mtime, sha1 hash, parsed frontmatter, extracted source wikilinks, parent folder name
- Writes MANIFEST.json with `stage_states.ingest.status = "complete"`
- Never modifies source. Never modifies room.

**Failure modes:**
- Source path missing -> abort with error
- Source contains zero `.md` files -> warn but continue (will result in an empty import)
- Permission denied -> abort with error

**Verification:**
- `node scripts/vault-import.cjs --verify-stage=ingest --import-id={{IMPORT_ID}}` re-walks source and confirms manifest matches
- Manifest `files[]` length == source `.md` count
