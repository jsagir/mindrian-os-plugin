'use strict';

/**
 * classifications-sync.cjs -- round-trip Larry/human edits from the Stage 02
 * classifications.md review gate back into MANIFEST.json.
 *
 * Addresses Blocker 4 from the Phase 80 plan-check (CONTEXT.md Locked Fix 4):
 * when a human opens classifications.md, edits a row, and saves, those edits
 * MUST persist into manifest.files[].classification before Stage 03 routes.
 *
 * The classifications.md table shape (rendered by Stage 02) is:
 *   | File | Section | Confidence | Evidence | Decision |
 *   |------|---------|------------|----------|----------|
 *   | notes/onboarding.md | problem-definition | 0.84 | "..." | AUTO |
 */

const fs = require('node:fs');
const manifestMod = require('./manifest.cjs');

function parseClassificationsMarkdown(mdPath) {
  const raw = fs.readFileSync(mdPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (/^\|\s*File\s*\|/i.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (/^\|\s*-+/.test(line)) continue;
    if (line.trim() === '') {
      if (rows.length > 0) break;
      continue;
    }
    if (!line.trim().startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    const cells = line.split('|').slice(1, -1).map(function (c) { return c.trim(); });
    if (cells.length < 5) {
      throw new Error('malformed classifications row (expected 5 columns, got ' + cells.length + '): ' + line);
    }
    const file = cells[0];
    const section = cells[1];
    const confidenceRaw = cells[2];
    const evidence = cells[3];
    const decision = cells[4];
    const confidence = Number(confidenceRaw);
    if (!Number.isFinite(confidence)) {
      throw new Error('malformed classifications row (confidence not numeric): ' + line);
    }
    rows.push({
      file: file,
      section: section,
      confidence: confidence,
      evidence: evidence,
      decision: decision
    });
  }
  return rows;
}

function syncClassificationsToManifest(mdPath, manifestPath) {
  const rows = parseClassificationsMarkdown(mdPath);
  const manifest = manifestMod.readManifest(manifestPath);
  const byPath = new Map();
  for (const f of manifest.files) {
    byPath.set(f.source_path, f);
  }
  let edits = 0;
  for (const row of rows) {
    const f = byPath.get(row.file);
    if (!f) {
      manifest.warnings = manifest.warnings || [];
      manifest.warnings.push({ type: 'classification_unmatched', context: row.file });
      continue;
    }
    const prev = f.classification || {};
    if (
      prev.section !== row.section ||
      prev.decision !== row.decision ||
      prev.confidence !== row.confidence
    ) {
      edits += 1;
    }
    f.classification = {
      section: row.section,
      confidence: row.confidence,
      evidence: row.evidence,
      decision: row.decision,
      stage: 'classify'
    };
  }
  manifest.stage_states.classify.human_edited = edits > 0 || manifest.stage_states.classify.human_edited === true;
  manifest.stage_states.classify.edits_count = (manifest.stage_states.classify.edits_count || 0) + edits;
  manifestMod.writeManifest(manifestPath, manifest);
  return { rows: rows.length, edits: edits };
}

module.exports = {
  parseClassificationsMarkdown: parseClassificationsMarkdown,
  syncClassificationsToManifest: syncClassificationsToManifest
};
