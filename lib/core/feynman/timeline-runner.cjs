'use strict';
// Phase 124-02 -- FEYNMAN.md timeline runner
// =========================================
// The side-effect orchestrator. Walks a room's section folders, finds each FEYNMAN.md,
// applies the D-02 sentinel-bounded merge over the body returned by the pure renderer
// (Plan 124-01), writes back atomically (.tmp + rename), updates the timeline_last_rendered
// frontmatter, and logs a memory_event on every refresh attempt (success or failure).
//
// Honors the D-09 watermark contract: skip when the frontmatter timeline_last_rendered ISO
// is >= the SQL MAX(memory_event.created_at) ISO for the section (second-resolution).
//
// The renderer (timeline-renderer.cjs) is the pure function. The runner is the impure shell
// around it. tests/test-feynman-timeline-runner.cjs is the integration test for this module.
//
// Canon Part 9: every refresh logs a typed memory_event making the regenerate-vs-skip
// decision legible in the local mind. Canon Part 8: zero net new Brain surface.
// Canon Part 7: reuses the atomic .tmp + rename idiom from scripts/vault-section-minto-generator.cjs;
//               the frontmatter line-walk parser idiom from scripts/frontmatter-schema-validator.cjs.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const renderer = require('./timeline-renderer.cjs');
const navigation = require('../navigation.cjs');

// ---------- Sentinel contract (D-02) ----------

const SENTINEL_START = '<!-- TIMELINE_AUTO_START -->';
const SENTINEL_END = '<!-- TIMELINE_AUTO_END -->';
const HEADER = '## Timeline (auto)';

// ---------- Frontmatter helpers (hand-rolled; no gray-matter) ----------

function parseFrontmatter(content) {
  // Returns { fm: { [key]: value }, fmOrder: [keys...], body: '<rest>', hadFrontmatter: bool }.
  const lines = content.split('\n');
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { fm: {}, fmOrder: [], body: content, hadFrontmatter: false };
  }
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) {
    return { fm: {}, fmOrder: [], body: content, hadFrontmatter: false };
  }
  const fmLines = lines.slice(1, endIdx);
  const bodyLines = lines.slice(endIdx + 1);
  const fm = {};
  const fmOrder = [];
  for (const ln of fmLines) {
    const m = ln.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2];
    let val;
    if (raw === '' || raw === 'null') val = null;
    else if (raw === 'true') val = true;
    else if (raw === 'false') val = false;
    else if (/^-?\d+(\.\d+)?$/.test(raw)) val = Number(raw);
    else if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) val = raw.slice(1, -1);
    else val = raw;
    fm[key] = val;
    if (fmOrder.indexOf(key) === -1) fmOrder.push(key);
  }
  return { fm: fm, fmOrder: fmOrder, body: bodyLines.join('\n'), hadFrontmatter: true };
}

function serializeFrontmatter(fm, fmOrder, body, hadFrontmatter) {
  // If fm is empty AND there was no original frontmatter -> return body unchanged.
  const keys = Object.keys(fm);
  if (keys.length === 0 && !hadFrontmatter) return body;
  // Honor fmOrder for existing keys; append any new keys not in fmOrder at the end.
  const order = fmOrder.slice();
  for (const k of keys) {
    if (order.indexOf(k) === -1) order.push(k);
  }
  const out = ['---'];
  for (const k of order) {
    if (!(k in fm)) continue;
    const v = fm[k];
    if (v === null) out.push(k + ':');
    else if (typeof v === 'boolean' || typeof v === 'number') out.push(k + ': ' + String(v));
    else out.push(k + ': ' + String(v));
  }
  out.push('---');
  return out.join('\n') + '\n' + body;
}

// ---------- Sentinel-bounded merge (D-02 hard invariant) ----------

function mergeSentinelSection(body, renderedBody) {
  // Case A: the sentinel pair exists -- replace the content between.
  const startIdx = body.indexOf(SENTINEL_START);
  const endIdx = body.indexOf(SENTINEL_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = body.slice(0, startIdx + SENTINEL_START.length);
    const after = body.slice(endIdx);
    return before + '\n' + renderedBody + '\n' + after;
  }
  // Case B: no sentinel pair -- append at end-of-file (ensure trailing newline).
  const sep = body.endsWith('\n') ? '' : '\n';
  return body + sep + '\n' + HEADER + '\n\n' + SENTINEL_START + '\n' + renderedBody + '\n' + SENTINEL_END + '\n';
}

function bodyOutsideSentinels(body) {
  // For the SHA256 byte-preservation check. Returns the body with the sentinel block excised
  // (everything from SENTINEL_START to SENTINEL_END inclusive removed, plus the lines they
  // sit on). If no sentinels, returns the body unchanged.
  const startIdx = body.indexOf(SENTINEL_START);
  const endIdx = body.indexOf(SENTINEL_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return body;
  // Find the start of the line containing SENTINEL_START (back up to the previous newline)
  // and the end of the line containing SENTINEL_END (forward to the next newline).
  let lineStart = body.lastIndexOf('\n', startIdx);
  if (lineStart === -1) lineStart = 0;
  let lineEnd = body.indexOf('\n', endIdx + SENTINEL_END.length);
  if (lineEnd === -1) lineEnd = body.length;
  return body.slice(0, lineStart) + body.slice(lineEnd);
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// ---------- Atomic write (D-02 hard invariant: no partial-write corruption) ----------

function atomicWrite(targetPath, content) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tmp = path.join(dir, '.' + base + '.tmp.' + process.pid + '.' + Date.now());
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, content, 0, 'utf8');
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort on platforms without it */ }
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, targetPath);
}

// ---------- Section walk ----------

function safeIsDir(p) { try { return fs.statSync(p).isDirectory(); } catch (_) { return false; } }
function safeIsFile(p) { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }

function findFeynmanSections(roomDir) {
  // Subdirectories of roomDir that contain a FEYNMAN.md at <roomDir>/<section>/FEYNMAN.md.
  if (!safeIsDir(roomDir)) return [];
  let entries;
  try {
    entries = fs.readdirSync(roomDir, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('.')) continue;
    if (ent.name === 'node_modules') continue;
    const feyPath = path.join(roomDir, ent.name, 'FEYNMAN.md');
    if (safeIsFile(feyPath)) out.push({ slug: ent.name, feyPath: feyPath });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

// ---------- Watermark check (D-09) ----------

function shouldSkipWatermark(db, sectionSlug, fmRendered) {
  if (typeof fmRendered !== 'string' || fmRendered.length === 0) return false;
  let summary;
  try {
    summary = navigation.firstCapturedLastTouchedBySection(db, sectionSlug);
  } catch (_) {
    return false;
  }
  if (!summary || summary.total_events === 0) return false; // no events; refresh to empty-state if needed.
  const sqlIso = renderer.isoSecond(summary.last_touched_ms);
  if (!sqlIso) return false;
  // ISO 8601 second-resolution strings are lex-sortable.
  return sqlIso <= fmRendered;
}

// ---------- The orchestrator ----------

function refreshSection(roomDir, sectionSlug, opts) {
  const options = opts || {};
  const db = options.db;
  const now_ms = Number.isFinite(options.now_ms) ? options.now_ms : Date.now();
  const force = options.force === true;
  const feyPath = path.join(roomDir, sectionSlug, 'FEYNMAN.md');

  if (!safeIsFile(feyPath)) {
    return { status: 'skipped_no_feynman', reason: 'no_feynman_md_in_section_dir' };
  }

  try {
    const rawContent = fs.readFileSync(feyPath, 'utf8');
    const parsed = parseFrontmatter(rawContent);

    // D-09 watermark check.
    if (!force && db && typeof parsed.fm.timeline_last_rendered === 'string') {
      if (shouldSkipWatermark(db, sectionSlug, parsed.fm.timeline_last_rendered)) {
        return { status: 'skipped_watermark', reason: 'sql_older_than_rendered' };
      }
    }

    // Render (D-05). Reads ONLY via navigation.cjs.
    const rendered = renderer.renderTimeline(db, sectionSlug, { now_ms: now_ms });

    // Merge (D-02 hard invariant).
    const newBody = mergeSentinelSection(parsed.body, rendered.markdown_body);

    // Update frontmatter watermark (D-09).
    const newIso = renderer.isoSecond(now_ms);
    const newFm = Object.assign({}, parsed.fm, { timeline_last_rendered: newIso });
    // Force frontmatter emission on every refresh (true so the watermark always lands at
    // the top, even when the original file had no fences).
    const newContent = serializeFrontmatter(newFm, parsed.fmOrder, newBody, true);

    // Atomic write.
    atomicWrite(feyPath, newContent);

    // Log success memory_event (D-10).
    if (db) {
      try {
        navigation.logMemoryEvent(db, 'feynman_timeline_refreshed', {
          source_path: 'feynman:' + sectionSlug,
          created_by: 'system',
        });
      } catch (_) { /* logging failure does not corrupt the refresh; the write already landed */ }
    }

    return { status: 'refreshed', written_path: feyPath, watermark: newIso };
  } catch (err) {
    const reason = (err && err.message) ? String(err.message).slice(0, 200) : 'unknown_error';
    if (db) {
      try {
        navigation.logMemoryEvent(db, 'feynman_timeline_refresh_failed', {
          source_path: 'feynman:' + sectionSlug,
          created_by: 'system',
          reason: reason,
        });
      } catch (_) { /* secondary failure is swallowed */ }
    }
    return { status: 'failed', reason: reason };
  }
}

function refreshAll(roomDir, opts) {
  const options = opts || {};
  const refreshed = [];
  const skipped = [];
  const failed = [];
  const sections = findFeynmanSections(roomDir);
  for (const s of sections) {
    const r = refreshSection(roomDir, s.slug, options);
    if (r.status === 'refreshed') refreshed.push({ slug: s.slug, written_path: r.written_path, watermark: r.watermark });
    else if (r.status === 'failed') failed.push({ slug: s.slug, reason: r.reason });
    else skipped.push({ slug: s.slug, reason: r.reason || r.status });
  }
  return { refreshed: refreshed, skipped: skipped, failed: failed };
}

module.exports = {
  refreshAll,
  refreshSection,
  parseFrontmatter,
  serializeFrontmatter,
  mergeSentinelSection,
  bodyOutsideSentinels,
  sha256Hex,
  findFeynmanSections,
  shouldSkipWatermark,
  atomicWrite,
  SENTINEL_START,
  SENTINEL_END,
  HEADER,
};
