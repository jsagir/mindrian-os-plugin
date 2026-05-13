'use strict';
// Phase 124-01 -- FEYNMAN.md timeline renderer
// ===========================================
// Pure function. Given (db, sectionSlug, opts) returns { markdown_body, summary_stats }.
// Reads ONLY via lib/core/navigation.cjs (the Phase 109 closed chokepoint per D-03).
// ZERO filesystem reads. ZERO Brain calls. ZERO LLM calls.
//
// Canon Part 9: the Larry-explains face of memory_event -- structured SQL becomes
// human-readable explanation strings via templated rendering, never LLM in the loop.
//
// Canon Part 8: zero net new Brain surface; the renderer is local-only.
//
// Canon Part 5: "stale" is a context signal (4 buckets: recent / quiet / stale / dormant)
// alongside the existing evidence tier; thresholds frozen at 7 / 30 / 90 days per D-06.
//
// Output format (D-05 LOCKED):
//   *Last refreshed: {ISO}. {N} insight events, first captured {first_iso}, last touched {last_iso} ({last_delta_human}).*
//
//   **Recent events** (within 7 days, top 5):
//   - {iso}: {event_type} -- {one_line_explain}
//   - ...
//
//   **Flagged stale** (over 30 days untouched, top 5):
//   - {iso}: {event_type} on {target_summary} -- last touched {delta_human}
//   - ...
//
//   **Health:** recent={n_recent} / quiet={n_quiet} / stale={n_stale} / dormant={n_dormant}.
//
// Empty state (zero memory_event rows scoped to section):
//   *No timeline events yet.*

const navigation = require('../navigation.cjs');

// ---------- D-06 thresholds ----------

const THRESHOLDS = Object.freeze({
  recent_ms: 7 * 24 * 60 * 60 * 1000,
  quiet_ms: 30 * 24 * 60 * 60 * 1000,
  stale_ms: 90 * 24 * 60 * 60 * 1000,
});

function resolveThresholds() {
  const raw = process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON;
  if (!raw) return THRESHOLDS;
  try {
    const parsed = JSON.parse(raw);
    const r = Number.isFinite(parsed.recent_ms) ? parsed.recent_ms : THRESHOLDS.recent_ms;
    const q = Number.isFinite(parsed.quiet_ms) ? parsed.quiet_ms : THRESHOLDS.quiet_ms;
    const s = Number.isFinite(parsed.stale_ms) ? parsed.stale_ms : THRESHOLDS.stale_ms;
    if (!(r < q && q < s)) return THRESHOLDS;
    return Object.freeze({ recent_ms: r, quiet_ms: q, stale_ms: s });
  } catch (_) {
    return THRESHOLDS;
  }
}

// ---------- ISO + human delta helpers ----------

function isoSecond(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function humanDelta(deltaMs) {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'unknown';
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 60) return sec + ' seconds ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + ' minutes ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' hours ago';
  const days = Math.floor(hr / 24);
  if (days < 30) return days + ' days ago';
  const months = Math.floor(days / 30);
  if (months < 12) return months + ' months ago';
  const years = Math.floor(days / 365);
  return years + ' years ago';
}

// ---------- Section scoping (D-08) ----------

function isInSection(sourcePath, sectionSlug) {
  if (typeof sourcePath !== 'string' || typeof sectionSlug !== 'string') return false;
  if (sourcePath === sectionSlug) return true;
  return sourcePath.startsWith(sectionSlug + '/');
}

// ---------- Explanation strings (templated; colocated fallback) ----------
//
// The Phase 109-05 renderExplanation(kind, payload) signature does not directly
// match the memory_event row shape returned by findRecentChanges, so we use a
// colocated templated fallback that renders generic event_type + target_node_id.
// Zero LLM in the loop -- the strings are pure string concatenation over typed
// SQL fields.

function oneLineExplain(row) {
  // row = { eventType, targetNodeId, sourcePath, properties, createdAt }
  const tgt = row && row.targetNodeId ? (' on ' + row.targetNodeId) : '';
  const evt = (row && row.eventType) ? row.eventType : 'event';
  return evt + tgt;
}

// ---------- The renderer ----------

function renderTimeline(db, sectionSlug, opts) {
  const options = opts || {};
  const now_ms = Number.isFinite(options.now_ms) ? options.now_ms : Date.now();
  const thresholds = resolveThresholds();

  // 1. Summary stats (first / last / total) via the new navigation primitive (D-08 scoping).
  const summary = navigation.firstCapturedLastTouchedBySection(db, sectionSlug);

  // Empty-state branch (D-05): zero memory_event rows scoped to the section.
  if (summary.total_events === 0) {
    return {
      markdown_body: '*No timeline events yet.*',
      summary_stats: { total_events: 0, n_recent: 0, n_quiet: 0, n_stale: 0, n_dormant: 0 },
    };
  }

  // 2. Recent events (within recent_ms; section-scoped post-fetch filter).
  // findRecentChanges returns rows for the WHOLE room; we filter by sourcePath per D-08.
  const recentLookback = thresholds.recent_ms;
  let allRecent = [];
  try {
    allRecent = navigation.findRecentChanges(db, now_ms - recentLookback, { limit: 200 }) || [];
  } catch (_) { allRecent = []; }
  const scopedRecent = allRecent.filter((r) => isInSection(r.sourcePath, sectionSlug));
  const topRecent = scopedRecent.slice(0, 5);

  // 3. Flagged stale: rows whose delta sits in the [quiet_ms .. stale_ms) window.
  let allStaleWindow = [];
  try {
    const sinceStale = now_ms - thresholds.stale_ms;
    const allWindow = navigation.findRecentChanges(db, sinceStale, { limit: 500 }) || [];
    allStaleWindow = allWindow.filter((r) => isInSection(r.sourcePath, sectionSlug)
      && Number.isFinite(r.createdAt)
      && (now_ms - r.createdAt) >= thresholds.quiet_ms
      && (now_ms - r.createdAt) < thresholds.stale_ms);
  } catch (_) { allStaleWindow = []; }
  const topStale = allStaleWindow.slice(0, 5);

  // 4. Health buckets across ALL memory_event rows scoped to the section.
  let allRows = [];
  try {
    allRows = navigation.findRecentChanges(db, 0, { limit: 10000 }) || [];
  } catch (_) { allRows = []; }
  const scoped = allRows.filter((r) => isInSection(r.sourcePath, sectionSlug)
    && Number.isFinite(r.createdAt));
  let n_recent = 0, n_quiet = 0, n_stale = 0, n_dormant = 0;
  for (const r of scoped) {
    const delta = now_ms - r.createdAt;
    if (delta < thresholds.recent_ms) n_recent += 1;
    else if (delta < thresholds.quiet_ms) n_quiet += 1;
    else if (delta < thresholds.stale_ms) n_stale += 1;
    else n_dormant += 1;
  }

  // 5. Assemble the D-05 markdown body.
  const lines = [];
  const firstIso = isoSecond(summary.first_captured_ms);
  const lastIso = isoSecond(summary.last_touched_ms);
  const lastDeltaHuman = humanDelta(now_ms - summary.last_touched_ms);
  const nowIso = isoSecond(now_ms);
  lines.push('*Last refreshed: ' + nowIso + '. ' + summary.total_events + ' insight events, first captured '
    + firstIso + ', last touched ' + lastIso + ' (' + lastDeltaHuman + ').*');
  lines.push('');
  lines.push('**Recent events** (within 7 days, top 5):');
  if (topRecent.length === 0) {
    lines.push('- (none in the last 7 days)');
  } else {
    for (const r of topRecent) {
      lines.push('- ' + isoSecond(r.createdAt) + ': ' + (r.eventType || 'event') + ' -- ' + oneLineExplain(r));
    }
  }
  lines.push('');
  lines.push('**Flagged stale** (over 30 days untouched, top 5):');
  if (topStale.length === 0) {
    lines.push('- (none over 30 days untouched)');
  } else {
    for (const r of topStale) {
      const tgt = r.targetNodeId || '(unscoped)';
      lines.push('- ' + isoSecond(r.createdAt) + ': ' + (r.eventType || 'event') + ' on ' + tgt
        + ' -- last touched ' + humanDelta(now_ms - r.createdAt));
    }
  }
  lines.push('');
  lines.push('**Health:** recent=' + n_recent + ' / quiet=' + n_quiet + ' / stale=' + n_stale
    + ' / dormant=' + n_dormant + '.');

  return {
    markdown_body: lines.join('\n'),
    summary_stats: { total_events: summary.total_events, n_recent, n_quiet, n_stale, n_dormant },
  };
}

module.exports = { renderTimeline, THRESHOLDS, resolveThresholds, isoSecond, humanDelta, isInSection };
