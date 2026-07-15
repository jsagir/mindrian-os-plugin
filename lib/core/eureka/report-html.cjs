/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-03 -- the pure De Stijl HTML renderer for the /mos:eureka export.
 *
 * WHY THIS MODULE EXISTS (D6 / G-4, SEED-058 req 6)
 *   A shared eureka report can reach a SECOND reader who did not run the scan and
 *   sees ONLY this artifact. The mode label + its caveat are that reader's entire
 *   calibration signal. This renderer makes the mode banner impossible to lose:
 *   a non-collapsible, top-of-document banner read straight from
 *   provenance.run_mode. A reasoning-mode result can never render as an embedded
 *   one, and an unknown mode is printed VERBATIM, never blanked or defaulted.
 *
 * CANON POSTURE
 *   - Part 8 (Graph Boundary): the export is SELF-CONTAINED and zero-egress. Inline
 *     CSS only. No CDN font, no <script>, no external URL of any kind -- a shared
 *     export must never phone home from a second reader's machine.
 *   - Part 9 (Memory Locality): render-only. It reads the existing
 *     portfolio-report.json and invents no second data shape.
 *
 * The visual language imitates dashboard/export-template.html (Mondrian palette
 * blocks: red / yellow / blue / black rules on white) with INLINE css only -- it
 * reuses NONE of that template's CDN/script machinery.
 *
 * Pure CJS, node built-ins only, zero npm deps. Never throws: malformed json
 * yields a minimal error page naming what was missing. No em-dashes anywhere.
 */
'use strict';

// -- De Stijl palette (mirrors dashboard/export-template.html :root vars). --
const PALETTE = Object.freeze({
  red: '#C23B22',
  blue: '#1B3B6F',
  yellow: '#E8B931',
  black: '#1A1A1A',
  white: '#F7F3ED',
  gray: '#D4CFC7',
});

// ---------- escapeHtml ----------
//
// Escape every interpolated value. A room title carrying '<script>' must never
// inject markup into a report a second reader opens (T-226-10, XSS-class in a
// local artifact). Non-string input is coerced first (never throws).
function escapeHtml(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Round a numeric leg to d places for display; non-numbers render 'n/a'.
function fmtNum(n, d) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 'n/a';
  return n.toFixed(typeof d === 'number' ? d : 3);
}

function isReasoningMode(provenance) {
  return !!provenance && provenance.run_mode === 'reasoning';
}

// ---------- buildModeBanner ----------
//
// The mandatory, non-collapsible, top-of-document banner. It is NOT a footer and
// NOT collapsible (D6): the mode is the second reader's entire calibration signal.
//   - run_mode 'reasoning'  -> red banner + the five-element caveat paragraph.
//   - any other run_mode    -> neutral black-on-yellow banner naming the mode
//                              string VERBATIM (never defaulted, never blank).
function buildModeBanner(provenance) {
  const p = provenance || {};
  const runMode = (p.run_mode === null || p.run_mode === undefined || String(p.run_mode) === '')
    ? '(mode not stated)'
    : String(p.run_mode);

  if (isReasoningMode(p)) {
    const cause = escapeHtml(p.degrade_cause || 'encoder_unavailable');
    const L = [];
    L.push('<div class="mode-banner reasoning" role="alert">');
    L.push('  <div class="mode-banner-title">REASONING MODE - LOWER-CONFIDENCE RESULT</div>');
    L.push('  <div class="mode-banner-caveat">');
    // The five caveat elements, identical in substance to the md caveat.
    L.push('    <p><strong>1. Lower confidence by basis, not a verdict.</strong> The pairs below are a'
      + ' short working diagnosis, not a finished ranked list.</p>');
    L.push('    <p><strong>2. Why the basis is weak.</strong> The embedding encoder was unavailable'
      + ' (degrade cause: <code>' + cause + '</code>), so 2 of the critic\'s 3 numeric legs'
      + ' (differential_score and semantic_similarity) are structurally null. Only the lexical'
      + ' overlap (Jaccard, lsa_similarity) is a real number here.</p>');
    L.push('    <p><strong>3. The analogy bar was NOT lowered.</strong> The same six-item'
      + ' structure-mapping rubric ran twice (neutral + adversarial) and the verdict was computed'
      + ' by code, exactly as embedded mode.</p>');
    L.push('    <p><strong>4. Nothing here is banked or confirmed.</strong> Acting on any pair is a'
      + ' human decision (Canon Part 9: human-only promotion); banked is false on every row.</p>');
    L.push('    <p><strong>5. Upgradeable.</strong> Re-running after the encoder is installed upgrades'
      + ' this room to embedded mode and shows the reasoning to embedded delta, rather than silently'
      + ' replacing this result.</p>');
    L.push('  </div>');
    L.push('</div>');
    return L.join('\n');
  }

  // Any non-reasoning mode: name the mode string verbatim (SEED req 1).
  const L = [];
  L.push('<div class="mode-banner embedded" role="status">');
  L.push('  <div class="mode-banner-title">MODE: ' + escapeHtml(runMode) + '</div>');
  L.push('  <div class="mode-banner-caveat"><p>This result was produced in the mode named above.'
    + ' Reasoning-mode and embedded-mode results are never merged into one ranked list.</p></div>');
  L.push('</div>');
  return L.join('\n');
}

// ---------- the inline stylesheet (De Stijl, zero external assets) ----------
function styleBlock() {
  return [
    '<style>',
    '  * { margin: 0; padding: 0; box-sizing: border-box; }',
    '  body { background: ' + PALETTE.white + '; color: ' + PALETTE.black + ';',
    '    font-family: Georgia, "Times New Roman", serif; line-height: 1.5; padding: 0 0 48px 0; }',
    '  .wrap { max-width: 960px; margin: 0 auto; padding: 0 20px; }',
    '  h1 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 26px; letter-spacing: 0.04em;',
    '    text-transform: uppercase; border-bottom: 5px solid ' + PALETTE.black + '; padding: 20px 0 12px; }',
    '  h2 { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 18px; letter-spacing: 0.03em;',
    '    text-transform: uppercase; margin: 32px 0 12px; padding-left: 10px;',
    '    border-left: 8px solid ' + PALETTE.blue + '; }',
    '  .mode-banner { width: 100%; border: 5px solid ' + PALETTE.black + '; margin: 0 0 8px;',
    '    padding: 18px 22px; }',
    '  .mode-banner.reasoning { background: ' + PALETTE.red + '; color: ' + PALETTE.white + '; }',
    '  .mode-banner.embedded { background: ' + PALETTE.yellow + '; color: ' + PALETTE.black + '; }',
    '  .mode-banner-title { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 700;',
    '    font-size: 20px; letter-spacing: 0.06em; text-transform: uppercase; }',
    '  .mode-banner-caveat { margin-top: 10px; font-size: 14px; }',
    '  .mode-banner-caveat p { margin: 6px 0; }',
    '  .mode-banner code { background: rgba(0,0,0,0.18); padding: 1px 5px; font-family: "Courier New", monospace; }',
    '  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; }',
    '  th, td { border: 3px solid ' + PALETTE.black + '; padding: 7px 10px; text-align: left;',
    '    font-size: 13px; vertical-align: top; }',
    '  th { background: ' + PALETTE.black + '; color: ' + PALETTE.white + ';',
    '    font-family: "Helvetica Neue", Arial, sans-serif; letter-spacing: 0.04em; text-transform: uppercase; }',
    '  tr:nth-child(even) td { background: ' + PALETTE.gray + '; }',
    '  .card { border: 4px solid ' + PALETTE.black + '; border-top: 12px solid ' + PALETTE.blue + ';',
    '    padding: 14px 18px; margin: 12px 0; background: #fff; }',
    '  .card-head { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 700; font-size: 15px;',
    '    margin-bottom: 8px; }',
    '  .card-text { font-size: 14px; margin-bottom: 10px; }',
    '  .tag { display: inline-block; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11px;',
    '    letter-spacing: 0.05em; text-transform: uppercase; padding: 2px 8px; margin-right: 6px;',
    '    border: 2px solid ' + PALETTE.black + '; }',
    '  .tag.mode { background: ' + PALETTE.red + '; color: ' + PALETTE.white + '; }',
    '  .tag.mode.embedded { background: ' + PALETTE.yellow + '; color: ' + PALETTE.black + '; }',
    '  .tag.banked-false { background: ' + PALETTE.white + '; color: ' + PALETTE.black + '; }',
    '  .upgrade { border: 4px dashed ' + PALETTE.blue + '; padding: 14px 18px; margin: 12px 0;',
    '    background: #fff; }',
    '  .foot { margin-top: 40px; padding-top: 14px; border-top: 5px solid ' + PALETTE.black + ';',
    '    font-size: 12px; color: #555; }',
    '  code { font-family: "Courier New", monospace; }',
    '</style>',
  ].join('\n');
}

// ---------- provenance table ----------
function provenanceTable(provenance) {
  const p = provenance || {};
  const keys = Object.keys(p);
  const L = [];
  L.push('<h2>Provenance</h2>');
  L.push('<table>');
  L.push('  <tr><th>Field</th><th>Value</th></tr>');
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    let v = p[k];
    // Objects (e.g. ahp_weights, reasoning, upgrade, pairs_rejected_by_rubric) get
    // a compact JSON string; scalars render directly. Both escaped.
    if (v !== null && typeof v === 'object') {
      try { v = JSON.stringify(v); } catch (_e) { v = '[unserializable]'; }
    }
    L.push('  <tr><td><code>' + escapeHtml(k) + '</code></td><td>' + escapeHtml(v) + '</td></tr>');
  }
  L.push('</table>');
  return L.join('\n');
}

// ---------- ranked table ----------
//
// Reasoning columns: rank / pair / lsa_similarity / verdict / mode. Embedded
// columns: rank / pair / score / banked / mode. The reasoning branch NEVER emits
// a differential_score or semantic_similarity cell (T-226-01): those legs are
// structurally null and are simply not columns here.
function rankedTable(ranked, provenance) {
  const rows = Array.isArray(ranked) ? ranked : [];
  const reasoning = isReasoningMode(provenance);
  const L = [];
  L.push('<h2>Ranked' + (reasoning ? ' (reasoning mode)' : '') + '</h2>');
  if (rows.length === 0) {
    L.push('<p><em>No ranked pairs in this report.</em></p>');
    return L.join('\n');
  }
  L.push('<table>');
  if (reasoning) {
    L.push('  <tr><th>Rank</th><th>Pair (A x B)</th><th>lsa_similarity</th><th>Verdict</th><th>Mode</th></tr>');
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const pair = escapeHtml(r.a_title || r.a) + ' x ' + escapeHtml(r.b_title || r.b);
      const rowMode = escapeHtml(r.mode || 'reasoning');
      L.push('  <tr><td>' + escapeHtml(r.rank) + '</td><td>' + pair + '</td><td>'
        + escapeHtml(fmtNum(r.lsa_similarity, 3)) + '</td><td>' + escapeHtml(r.verdict)
        + '</td><td>' + rowMode + '</td></tr>');
    }
  } else {
    L.push('  <tr><th>Rank</th><th>Pair (A x B)</th><th>Score</th><th>Banked</th><th>Mode</th></tr>');
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const pair = escapeHtml(r.a_title || r.a) + ' x ' + escapeHtml(r.b_title || r.b);
      const rowMode = escapeHtml(r.mode || 'embedded');
      const score = (typeof r.score === 'number') ? escapeHtml(fmtNum(r.score, 3)) : escapeHtml(r.score);
      L.push('  <tr><td>' + escapeHtml(r.rank) + '</td><td>' + pair + '</td><td>'
        + score + '</td><td>' + escapeHtml(String(r.banked === true))
        + '</td><td>' + rowMode + '</td></tr>');
    }
  }
  L.push('</table>');
  return L.join('\n');
}

// ---------- statement cards ----------
//
// Each statement card carries its mode tag and banked value VISIBLY (D6): a shared
// card can never read as embedded when it was reasoning, or hide that it is unbanked.
function statementCards(statements) {
  const rows = Array.isArray(statements) ? statements : [];
  const L = [];
  L.push('<h2>Opportunity Statements</h2>');
  if (rows.length === 0) {
    L.push('<p><em>No statement candidates in this report.</em></p>');
    return L.join('\n');
  }
  for (let i = 0; i < rows.length; i += 1) {
    const s = rows[i] || {};
    const mode = s.mode === 'reasoning' ? 'reasoning' : 'embedded';
    const modeClass = mode === 'reasoning' ? 'mode' : 'mode embedded';
    L.push('<div class="card">');
    L.push('  <div class="card-head">Rank ' + escapeHtml(s.rank) + ' -- '
      + escapeHtml(s.a) + ' x ' + escapeHtml(s.b) + '</div>');
    L.push('  <div class="card-text">' + escapeHtml(s.text) + '</div>');
    L.push('  <div>');
    L.push('    <span class="tag ' + modeClass + '">mode: ' + escapeHtml(mode) + '</span>');
    L.push('    <span class="tag banked-false">banked: ' + escapeHtml(String(s.banked === true)) + '</span>');
    L.push('    <span class="tag">critic: ' + escapeHtml(s.critic) + '</span>');
    if (mode === 'reasoning') {
      // The one surviving number, labeled; the two absent legs are honest n/a.
      L.push('    <span class="tag">lsa_similarity: ' + escapeHtml(fmtNum(s.lsa_similarity, 3)) + '</span>');
      L.push('    <span class="tag">differential_score: n/a (no encoder)</span>');
      L.push('    <span class="tag">semantic_similarity: n/a (no encoder)</span>');
    }
    if (s.potential_tier !== undefined && s.potential_tier !== null) {
      L.push('    <span class="tag">potential: ' + escapeHtml(s.potential_tier) + '</span>');
    }
    L.push('  </div>');
    L.push('</div>');
  }
  return L.join('\n');
}

// ---------- upgrade section (SEED req 5, D6 never-merge) ----------
function upgradeSection(provenance) {
  const p = provenance || {};
  if (!p.upgrade || typeof p.upgrade !== 'object') return '';
  const u = p.upgrade;
  const L = [];
  L.push('<h2>Reasoning to Embedded Upgrade</h2>');
  L.push('<div class="upgrade">');
  L.push('  <p>This room was previously scored in <strong>REASONING</strong> mode ('
    + escapeHtml(u.previous_run_date) + '). This result does NOT silently replace that one.</p>');
  L.push('  <p>Delta: <strong>' + escapeHtml(u.survived) + '</strong> of the prior top pairs survived'
    + ' into the new embedded ranked list, <strong>' + escapeHtml(u.demoted_or_absent)
    + '</strong> demoted or absent.</p>');
  L.push('</div>');
  return L.join('\n');
}

// ---------- error page (never throws) ----------
function errorPage(missingReason) {
  return [
    '<!DOCTYPE html>',
    '<html lang="en" dir="ltr">',
    '<head><meta charset="UTF-8"><title>Eureka report - unrenderable</title>',
    styleBlock(),
    '</head>',
    '<body><div class="wrap">',
    '<div class="mode-banner reasoning" role="alert">',
    '  <div class="mode-banner-title">REPORT COULD NOT BE RENDERED</div>',
    '  <div class="mode-banner-caveat"><p>The eureka report JSON was missing or malformed: '
    + escapeHtml(missingReason) + '. Re-run /mos:eureka to regenerate it.</p></div>',
    '</div>',
    '</div></body></html>',
    '',
  ].join('\n');
}

// ---------- renderReportHtml (the public entry) ----------
//
// Returns a COMPLETE, self-contained HTML string. Never throws: a malformed json
// (not an object, or no provenance) returns a minimal error page naming what was
// missing rather than crashing a shared-export pipeline.
function renderReportHtml(json, opts) {
  const _opts = opts || {};
  if (!json || typeof json !== 'object') {
    return errorPage('no report object was supplied');
  }
  const provenance = json.provenance;
  if (!provenance || typeof provenance !== 'object') {
    return errorPage('the report has no provenance object (cannot determine run_mode)');
  }
  const title = escapeHtml(_opts.title || 'Eureka Portfolio Report');

  const L = [];
  L.push('<!DOCTYPE html>');
  L.push('<html lang="en" dir="ltr">');
  L.push('<head>');
  L.push('<meta charset="UTF-8">');
  L.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  L.push('<title>' + title + '</title>');
  L.push(styleBlock());
  L.push('</head>');
  L.push('<body>');
  // The mode banner is the FIRST thing in the body, above the title (D6): it can
  // never be scrolled past or mistaken for a footnote.
  L.push(buildModeBanner(provenance));
  L.push('<div class="wrap">');
  L.push('<h1>' + title + '</h1>');
  L.push(provenanceTable(provenance));
  L.push(rankedTable(json.ranked, provenance));
  L.push(statementCards(json.statements));
  L.push(upgradeSection(provenance));
  L.push('<div class="foot">Generated by MindrianOS /mos:eureka. Self-contained, zero-network'
    + ' (Canon Part 8). Run mode: ' + escapeHtml(provenance.run_mode) + '.</div>');
  L.push('</div>');
  L.push('</body>');
  L.push('</html>');
  L.push('');
  return L.join('\n');
}

// ---------- Exports ----------

module.exports = {
  renderReportHtml: renderReportHtml,
  _test: {
    escapeHtml: escapeHtml,
    buildModeBanner: buildModeBanner,
    isReasoningMode: isReasoningMode,
    PALETTE: PALETTE,
  },
};
