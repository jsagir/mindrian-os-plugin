'use strict';

/**
 * Phase 80 Plan 80-05 -- IMPORT-REPORT.md renderer.
 *
 * Consumed by scripts/vault-import.cjs at the end of the 4-stage pipeline
 * (and by the --undo branch to re-render with UNDONE: true). Shape verbatim
 * from 80-CONTEXT.md gray area #10.
 *
 * Sections (in order): frontmatter, H1, Summary, Routing Table,
 * People Detected, Meetings Detected, Warnings, /mos: Usability Check
 * (placeholder populated by 80-06), Manifest Reference.
 *
 * Main-topic-slug extraction: top-2 destination sections by count. If a
 * single section dominates (> 60%), use that section alone. --topic flag
 * override is applied upstream in scripts/vault-import.cjs via pickMainTopic.
 */

const { readManifest } = require('./manifest.cjs');

function slugifyTopic(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

function extractMainTopicSlug(manifest, override) {
  if (override) return slugifyTopic(override);
  const counts = new Map();
  for (const f of manifest.files || []) {
    const sec = f.classification && f.classification.section;
    if (!sec) continue;
    counts.set(sec, (counts.get(sec) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
  if (sorted.length === 0) return 'unclassified';
  const total = sorted.reduce(function (s, e) { return s + e[1]; }, 0);
  const top = sorted[0];
  if (top[1] / total > 0.6) return slugifyTopic(top[0]);
  if (sorted.length === 1) return slugifyTopic(top[0]);
  return slugifyTopic(top[0]) + '-' + slugifyTopic(sorted[1][0]);
}

function countDecisions(files) {
  let auto = 0, sugg = 0, inbox = 0;
  for (const f of files || []) {
    const d = f.classification && f.classification.decision;
    if (d === 'AUTO') auto++;
    else if (d === 'SUGGEST') sugg++;
    else if (d === 'INBOX') inbox++;
  }
  return { auto: auto, sugg: sugg, inbox: inbox };
}

function escapeCell(s) {
  return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function generateImportReport(manifest, opts) {
  opts = opts || {};
  const date = (manifest.import_id || '').slice(0, 10);
  const counts = countDecisions(manifest.files || []);
  const mainTopic = manifest.main_topic || extractMainTopicSlug(manifest, opts.topic);
  const isUndone = !!(manifest.undo && manifest.undo.is_undone);

  const lines = [];
  lines.push('---');
  if (isUndone) lines.push('UNDONE: true');
  lines.push('date: ' + date);
  lines.push('main_topic: ' + mainTopic);
  lines.push('source_vault: ' + (manifest.source_vault || ''));
  lines.push('total_files: ' + (manifest.files || []).length);
  lines.push('status: ' + (manifest.status || 'in_progress'));
  lines.push('import_id: ' + (manifest.import_id || ''));
  lines.push('---');
  lines.push('');

  const titleTopic = mainTopic.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  lines.push('# Import Report -- ' + date + ' ' + titleTopic);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('- ' + (manifest.files || []).length + ' files ingested');
  lines.push('- ' + counts.auto + ' auto-routed (confidence >= 0.75)');
  lines.push('- ' + counts.sugg + ' in inbox/suggested (0.45 - 0.74)');
  lines.push('- ' + counts.inbox + ' in inbox/unclassified (< 0.45)');
  lines.push('- ' + (manifest.people || []).length + ' people detected');
  lines.push('- ' + (manifest.meetings || []).length + ' meetings detected');
  if (isUndone) {
    lines.push('');
    lines.push('> This import has been UNDONE. Files were moved to `imports/' + (manifest.import_id || '') + '/undone/`. ROOM.md and MINTO.md scaffolds scoped to this import were removed. The source vault was never touched.');
  }
  lines.push('');

  // Routing Table
  lines.push('## Routing Table');
  lines.push('');
  lines.push('| Source | Destination | Confidence | Decision |');
  lines.push('|--------|-------------|------------|----------|');
  for (const f of manifest.files || []) {
    const c = f.classification || {};
    lines.push(
      '| ' + escapeCell(f.source_path) +
      ' | ' + escapeCell(f.destination_path || '(skipped)') +
      ' | ' + (c.confidence != null ? c.confidence : '') +
      ' | ' + escapeCell(c.decision || '') + ' |'
    );
  }
  lines.push('');

  // People Detected
  lines.push('## People Detected');
  lines.push('');
  if (!(manifest.people || []).length) {
    lines.push('(none)');
  } else {
    lines.push('| Name | Role Guess | Mentions | Profile |');
    lines.push('|------|------------|----------|---------|');
    for (const p of manifest.people) {
      lines.push(
        '| ' + escapeCell(p.name) +
        ' | ' + escapeCell(p.role_guess || p.role_bucket || 'unassigned') +
        ' | ' + ((p.mention_files || []).length) +
        ' | ' + escapeCell(p.profile_path || '') + ' |'
      );
    }
  }
  lines.push('');

  // Meetings Detected
  lines.push('## Meetings Detected');
  lines.push('');
  if (!(manifest.meetings || []).length) {
    lines.push('(none)');
  } else {
    lines.push('| Date | Signals | Routed To |');
    lines.push('|------|---------|-----------|');
    for (const m of manifest.meetings) {
      lines.push(
        '| ' + escapeCell(m.detected_date || '') +
        ' | ' + escapeCell((m.detection_signals || []).join(', ')) +
        ' | ' + escapeCell(m.routed_to || m.filed_via || '(pending)') + ' |'
      );
    }
  }
  lines.push('');

  // Warnings
  lines.push('## Warnings');
  lines.push('');
  if (!(manifest.warnings || []).length) {
    lines.push('(none)');
  } else {
    for (const w of manifest.warnings) {
      lines.push('- ' + escapeCell(w.type) + ': ' + escapeCell(w.context || ''));
    }
  }
  lines.push('');

  // /mos: Usability Check (placeholder for 80-06)
  lines.push('## /mos: Usability Check');
  lines.push('');
  if (opts.smokeTestResult) {
    lines.push('- status: ' + escapeCell(opts.smokeTestResult.status || 'unknown'));
    if (opts.smokeTestResult.details) {
      lines.push('- details: ' + escapeCell(opts.smokeTestResult.details));
    }
  } else {
    lines.push('_Placeholder -- populated by Phase 80 Plan 06 (branding + smoke test)._');
  }
  lines.push('');

  // Manifest Reference
  lines.push('## Manifest Reference');
  lines.push('');
  lines.push('See `01-ingest/output/MANIFEST.json` for the full source -> destination mapping (undo support).');
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  generateImportReport: generateImportReport,
  extractMainTopicSlug: extractMainTopicSlug,
  slugifyTopic: slugifyTopic,
  countDecisions: countDecisions
};
