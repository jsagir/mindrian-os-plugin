'use strict';
/**
 * MindrianOS Plugin -- Room Home data layer (D-05, SPEC Req 4).
 *
 * The deterministic room-state assembler behind the wiki Room Home dashboard.
 * Room Home is sourced from the room's REAL STATE.md / compute-state data plus
 * the section's governing thought, never from the graph and never hardcoded.
 *
 * This is the port target CONTEXT.md names in place of the off-disk
 * rooms.ts::getRoomState prototype: a small newly-ported STATE.md parser layered
 * over the shipping lib/core/state-ops.cjs (getState/computeState) and
 * lib/core/folder-memory.cjs (readTriple governing-thought).
 *
 * Exports:
 *   - parseStateMd(stateText)       PURE STATE.md parser, never throws
 *   - getRoomHomeData(roomDir)      assembles Room Home data, never throws
 *   - renderRoomHomeBody(data,opts) UI-SPEC Room Home body HTML
 *
 * CJS, no new dependencies (gray-matter is a root dependency). No em-dashes.
 * wiki-server.cjs wiring happens in Plan 04; nothing here reaches the network
 * or the Brain (Canon Part 8).
 */

const path = require('path');
const matter = require('gray-matter');
const { getState, computeState } = require('../core/state-ops.cjs');

// ---------- helpers ----------

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMPTY_STATE = Object.freeze({
  ventureStage: null,
  totalEntries: 0,
  computed: null,
  sections: [],
  gaps: [],
});

function emptyState() {
  return { ventureStage: null, totalEntries: 0, computed: null, sections: [], gaps: [] };
}

// Pull the raw text of a `## Heading` block up to the next `## ` heading (or EOF).
function sectionBlock(body, heading) {
  const lines = String(body || '').split('\n');
  const out = [];
  let inBlock = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      const isTarget = line.replace(/^##\s+/, '').trim().toLowerCase() === heading.toLowerCase();
      if (inBlock) break; // hit the next section
      inBlock = isTarget;
      continue;
    }
    if (inBlock) out.push(line);
  }
  return out;
}

// Split a markdown pipe-table row into trimmed cells, dropping the leading and
// trailing empties produced by the surrounding pipes.
function pipeCells(row) {
  const cells = row.split('|').map((c) => c.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

// ---------- parseStateMd ----------

/**
 * Parse a STATE.md string (the compute-state format) into Room Home fields.
 * PURE and total: any malformed / null / non-string input returns the safe
 * empty shape and never throws.
 *
 * @param {string} stateText
 * @returns {{ventureStage:string|null,totalEntries:number,computed:string|null,
 *            sections:Array<{name,entries,progress,status,lastUpdated}>,
 *            gaps:Array<{section:string|null,message:string}>}}
 */
function parseStateMd(stateText) {
  if (typeof stateText !== 'string' || stateText.trim() === '') {
    return emptyState();
  }

  let data = {};
  let body = '';
  try {
    const parsed = matter(stateText);
    data = parsed.data || {};
    body = parsed.content || '';
  } catch (_e) {
    return emptyState();
  }

  const out = emptyState();

  const vs = data.venture_stage;
  out.ventureStage = vs == null || String(vs).trim() === '' ? null : String(vs).trim();

  const te = Number(data.total_entries);
  out.totalEntries = Number.isFinite(te) ? te : 0;

  const computed = data.computed;
  out.computed = computed == null || String(computed).trim() === '' ? null : String(computed).trim();

  // ---- ## Sections pipe table ----
  for (const rawRow of sectionBlock(body, 'Sections')) {
    const row = rawRow.trim();
    if (!row.startsWith('|')) continue;
    const cells = pipeCells(row);
    if (cells.length === 0) continue;
    const first = cells[0];
    // Skip the header row and the |----| separator row.
    if (first.toLowerCase() === 'section') continue;
    if (/^:?-{2,}:?$/.test(first) || /^-+$/.test(first)) continue;
    const name = first;
    if (!name) continue;
    const entries = parseInt(cells[1], 10);
    out.sections.push({
      name,
      entries: Number.isFinite(entries) ? entries : 0,
      progress: cells[2] != null ? cells[2] : '',
      status: cells[3] != null ? cells[3] : '',
      lastUpdated: cells[4] != null ? cells[4] : '',
    });
  }

  // ---- ## Gaps bullets ----
  const gapLines = sectionBlock(body, 'Gaps');
  const hasNoGaps = gapLines.some((l) => /no gaps detected/i.test(l));
  if (!hasNoGaps) {
    for (const rawLine of gapLines) {
      const line = rawLine.trim();
      if (!line.startsWith('- ')) continue;
      const bullet = line.slice(2).trim();
      if (!bullet) continue;
      const idx = bullet.indexOf(':');
      if (idx === -1) {
        out.gaps.push({ section: null, message: bullet });
      } else {
        const section = bullet.slice(0, idx).trim();
        const message = bullet.slice(idx + 1).trim();
        out.gaps.push({ section: section || null, message });
      }
    }
  }

  return out;
}

// ---------- getRoomHomeData ----------

/**
 * Assemble the full Room Home data object for a room directory.
 * Reads the room's real STATE.md (computing it once if absent), the governing
 * thought via readTriple, and derives suggestedNext. Never throws: fixture rooms
 * without the bash toolchain, or rooms without a MINTO.md, degrade gracefully.
 *
 * @param {string} roomDir
 * @returns {{governingThought:string|null,ventureStage:string|null,
 *            totalEntries:number,computed:string|null,sections:Array,gaps:Array,
 *            suggestedNext:string|null}}
 */
function getRoomHomeData(roomDir) {
  let stateText = null;
  try {
    stateText = getState(roomDir);
  } catch (_e) {
    stateText = null;
  }
  if (stateText == null) {
    // No STATE.md on disk yet -- try to compute it once. Fixture rooms without
    // the bash toolchain must not crash; swallow any compute failure.
    try {
      stateText = computeState(roomDir);
    } catch (_e) {
      stateText = null;
    }
  }

  const parsed = parseStateMd(stateText);

  // Governing thought via the section's MINTO triple. readTriple never throws and
  // returns an all-empty shell when the path or MINTO.md is missing (the degrade
  // path Test 4 exercises).
  let governingThought = null;
  try {
    const { readTriple } = require('../core/folder-memory.cjs');
    const triple = readTriple(path.resolve(roomDir));
    const gt = triple && triple.reasoning ? triple.reasoning.governing_thought : null;
    governingThought = gt == null || String(gt).trim() === '' ? null : String(gt).trim();
  } catch (_e) {
    governingThought = null;
  }

  const suggestedNext = parsed.gaps.length > 0 ? parsed.gaps[0].message : null;

  return {
    governingThought,
    ventureStage: parsed.ventureStage,
    totalEntries: parsed.totalEntries,
    computed: parsed.computed,
    sections: parsed.sections,
    gaps: parsed.gaps,
    suggestedNext,
  };
}

// ---------- renderRoomHomeBody ----------

// The inline client script that POSTs to /api/briefing and renders the result.
// Briefing output is DATA, never instructions: every field is injected as
// textContent (escaped), never as HTML, so room content cannot inject markup
// (T-232-02-02). The verbatim UI-SPEC red-bar error copy renders on ok:false.
const BRIEFING_SCRIPT = [
  '<script>',
  '(function(){',
  '  var btn=document.getElementById("generate-briefing");',
  '  var out=document.getElementById("briefing-output");',
  '  if(!btn||!out)return;',
  '  function line(cls,txt){var d=document.createElement("div");if(cls)d.className=cls;d.textContent=txt;return d;}',
  '  function list(items){var ul=document.createElement("ul");(items||[]).forEach(function(it){var li=document.createElement("li");li.textContent=String(it);ul.appendChild(li);});return ul;}',
  '  function renderError(){',
  '    out.innerHTML="";',
  '    var box=document.createElement("div");box.className="reframe";',
  '    box.appendChild(line("bl","Briefing unavailable."));',
  '    box.appendChild(line("mut","Why: no ANTHROPIC_API_KEY set (or the call failed)."));',
  '    box.appendChild(line("mut","Fix: set ANTHROPIC_API_KEY and retry. Room stats below still work."));',
  '    out.appendChild(box);',
  '  }',
  '  btn.addEventListener("click",function(){',
  '    btn.disabled=true;out.innerHTML="";out.appendChild(line("mut","Generating Larry\\u2019s read..."));',
  '    fetch("/api/briefing",{method:"POST",headers:{"content-type":"application/json"},body:"{}"})',
  '      .then(function(r){return r.json();})',
  '      .then(function(j){',
  '        btn.disabled=false;out.innerHTML="";',
  '        if(!j||!j.ok||!j.briefing){renderError();return;}',
  '        var b=j.briefing;',
  '        if(b.critical_misses&&b.critical_misses.length){out.appendChild(line("eyebrow","Critical misses"));out.appendChild(list(b.critical_misses));}',
  '        if(b.reframe){var rf=document.createElement("div");rf.className="reframe";rf.appendChild(line("eyebrow","Reframe"));rf.appendChild(line(null,b.reframe));out.appendChild(rf);}',
  '        if(b.next_steps&&b.next_steps.length){out.appendChild(line("eyebrow","Next steps"));out.appendChild(list(b.next_steps));}',
  '      })',
  '      .catch(function(){btn.disabled=false;renderError();});',
  '  });',
  '})();',
  '</script>',
].join('\n');

/**
 * Render the Room Home body HTML per UI-SPEC Component Inventory item 2.
 * All dynamic text is HTML-escaped. opts.staticExport (Plan 06) drops the live
 * Generate Briefing control + script and renders the empty-state copy instead.
 *
 * @param {object} data  the shape returned by getRoomHomeData
 * @param {object} [opts] { staticExport?: boolean }
 * @returns {string} HTML
 */
function renderRoomHomeBody(data, opts) {
  const d = data || {};
  const o = opts || {};
  const staticExport = o.staticExport === true;

  const sections = Array.isArray(d.sections) ? d.sections : [];
  const gaps = Array.isArray(d.gaps) ? d.gaps : [];

  const governing = d.governingThought
    ? escHtml(d.governingThought)
    : '(no MINTO yet)';

  const stage = d.ventureStage ? escHtml(d.ventureStage) : 'Unknown';
  const totalEntries = Number.isFinite(Number(d.totalEntries)) ? Number(d.totalEntries) : 0;

  // Progress bars scale to the max section entry count (min 1 to avoid /0).
  const maxEntries = sections.reduce((m, s) => Math.max(m, Number(s.entries) || 0), 1) || 1;

  const sectionRows = sections
    .map((s) => {
      const name = escHtml(s.name);
      const entries = Number(s.entries) || 0;
      const pct = Math.round((entries / maxEntries) * 100);
      return [
        '      <div class="rh-section-row">',
        `        <span class="rh-section-name">${name}</span>`,
        '        <span class="rh-bar-track" style="background:var(--rule)">',
        `          <span class="rh-bar-fill" style="width:${pct}%;background:var(--blue)"></span>`,
        '        </span>',
        `        <span class="rh-section-count">${entries}</span>`,
        '      </div>',
      ].join('\n');
    })
    .join('\n');

  const gapItems = gaps
    .map((g) => {
      const sec = g.section ? `<span class="rh-gap-section">${escHtml(g.section)}</span> ` : '';
      return `        <div class="rh-gap-cell">${sec}${escHtml(g.message)}</div>`;
    })
    .join('\n');

  const gapsBlock = gaps.length
    ? ['    <div class="rh-gaps" style="gap:1px;background:var(--rule)">', gapItems, '    </div>'].join('\n')
    : '    <p class="mut">No gaps detected. All sections have entries.</p>';

  const suggested = d.suggestedNext
    ? `    <p class="rh-suggested">Suggested next: ${escHtml(d.suggestedNext)}</p>`
    : '';

  // Briefing panel: the live variant carries the CTA + script; the static export
  // shows the empty-state copy and NO edit/generate affordance (read-only share).
  const briefingBody = staticExport
    ? "      <p class=\"mut\">No briefing yet. Generate Larry's read of the room.</p>"
    : [
        '      <button id="generate-briefing" class="op" type="button">Generate Briefing</button>',
        '      <div id="briefing-output"></div>',
        BRIEFING_SCRIPT,
      ].join('\n');

  return [
    '<div id="room-home">',
    `  <h1 class="display rh-governing">${governing}</h1>`,
    '  <div class="rh-stats">',
    `    <span class="rh-chip" data-stage="${stage}">${stage}</span>`,
    `    <span class="rh-total">Entries: ${totalEntries}</span>`,
    '  </div>',
    suggested,
    '  <section id="briefing-panel" class="frame">',
    '    <div class="eyebrow">Larry’s Briefing</div>',
    briefingBody,
    '  </section>',
    '  <section class="rh-gaps-panel">',
    '    <div class="eyebrow">Gaps</div>',
    gapsBlock,
    '  </section>',
    '  <section class="rh-progress-panel">',
    '    <div class="eyebrow">Section progress</div>',
    sectionRows,
    '  </section>',
    '</div>',
  ]
    .filter((s) => s !== '')
    .join('\n');
}

module.exports = { parseStateMd, getRoomHomeData, renderRoomHomeBody };
