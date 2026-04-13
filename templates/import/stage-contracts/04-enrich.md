---
icm_layer: 2
stage: 04-enrich
import_id: {{IMPORT_ID}}
created: {{TIMESTAMP}}
---

# Stage 04: Enrich -- Wikilinks, ROOM.md scaffolds, MINTO stubs

**Purpose:** Make routed files first-class room citizens. Reuses Phase 79 wikilink-builder.

**Inputs:**
- `../01-ingest/output/MANIFEST.json` (with route-stage updates)
- All routed artifacts on disk
- `templates/icm/GROUP-CLAUDE.md` (ROOM.md scaffold template)

**Outputs (this folder's `output/`):**
- `enrichment-log.md` -- wikilinks added per file, ROOM.md created per folder, MINTO stubs created

**Contract:**
1. **ROOM.md scaffolds:** For every folder created during Stage 03 (artifact folders, section folders, person folders, contracts/) AND every directory Stage 04 itself creates inside `imports/{id}/`, write a deterministic ROOM.md from the GROUP-CLAUDE.md template. Content: folder identity + ICM layer declaration + child count + child list (deterministic, no LLM). Decision 15 allows no exceptions.
2. **MINTO.md stubs:** For every section folder that received >= 1 artifact, write `MINTO.md`:
   ```
   > WARNING: Empty scaffold. Run `/mos:reason {section}` to populate.

   This file holds the Minto/MECE structured reasoning for {section}. It is intentionally empty until /mos:reason runs against the current artifact set.
   ```
3. **Wikilink injection:** for every routed file, call `node scripts/wikilink-batch.cjs <room> <file1> <file2> ...` (or fall back to per-file `wikilink-file.cjs` calls). This injects team-name links via `lib/vault/wikilink-builder.cjs`.
4. **Source wikilink rewriting:** for every entry in `_source_wikilinks` frontmatter, look up the new destination in MANIFEST. If found, append a wikilink line at the bottom of the file: `Related: [[new/path/here.md]]`. If not found, log to enrichment-log as `unresolved`.
5. **Frontmatter promotion:** copy promoted fields (title, aliases, tags, date, created, modified, author, attendees) into the artifact folder's ROOM.md per `references/import-config.md` promotion map.
6. **De Stijl branding:** invoke the Phase 76 footer injector per routed artifact and normalize frontmatter into the canonical import shape.

**Failure modes:**
- wikilink-builder soft-fails per Phase 79 contract -- enrichment continues
- ROOM.md write failure -> log + continue (the file is still valid Markdown)

**Verification:**
- Every routed folder has ROOM.md
- Every populated section folder has MINTO.md
- enrichment-log.md wikilinks_added > 0 (unless room has zero team profiles)
