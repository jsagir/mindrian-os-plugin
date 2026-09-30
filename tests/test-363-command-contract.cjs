#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 19 -- five PWS commands become research planners.
 * Contract test, legs P1-P8, for /mos:map-unknowns, /mos:root-cause,
 * /mos:think-hats, /mos:diffusion and /mos:whitespace.
 *
 * Pins: byte preservation of every pre-phase section (P1), the quick-pass ask
 * line counts (P2), frontmatter limited to the teaching line and, for
 * whitespace, a commented Write pre-approval (P3), the anchors of each new
 * research-planner section (P4), no web-tool or mode-name words in the new
 * sections (P5), the diffusion lens offer and the two-section rule (P6), the
 * registry rows (P7), and dash and phrase hygiene (P8).
 *
 * Plain node:assert/strict, zero dependencies, text and JSON assertions only,
 * no network. Pre-phase text comes from `git show <base_sha>:<path>` with the
 * base_sha in tests/fixtures/363-pre-phase.json.
 *
 * exit 0 -> PASSED, exit 1 -> FAILED, exit 77 -> ENV GAP (fixture or git object absent).
 *
 * House rule: hyphens only. The dash characters below are spelled as unicode escapes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', '363-pre-phase.json');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const SECTION_HEADING = '## Research planner (quick research run or deep research run)';
const WS_HEADING = '## Subcommand: research ZONE_ID';
const PENDING_LINE = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/research-planner.cjs" pending --room <room dir>';
const ASK_LINE = 'Ask: "Quick pass or deep dive?"';

const SIX_M = ['rc:6m_man', 'rc:6m_machine', 'rc:6m_method', 'rc:6m_material', 'rc:6m_measurement', 'rc:6m_nature'];

// One entry per command: file, heading, dimension ids the new section must name,
// the teaching sentence the plan appends, whether the diffusion lens is offered.
const COMMANDS = [
  {
    name: 'map-unknowns',
    heading: SECTION_HEADING,
    dims: ['mu:known_known', 'mu:blind_spot', 'mu:hidden_known', 'mu:unknown_unknown'],
    teach: 'It can also turn your blind spots into a research plan you run with /mos:research.',
    lens: true,
  },
  {
    name: 'root-cause',
    heading: SECTION_HEADING,
    dims: ['rc:why_link'].concat(SIX_M),
    teach: 'Each why that rests on an assumption can become a research question with its own falsifier.',
    lens: true,
  },
  {
    name: 'think-hats',
    heading: SECTION_HEADING,
    dims: ['hat:white', 'hat:black', 'hat:yellow', 'hat:green', 'hat:red', 'hat:blue'],
    teach: 'Each hat can become a research lane: black for counterevidence, yellow for prior successes, white for missing facts.',
    lens: true,
  },
  {
    name: 'diffusion',
    heading: SECTION_HEADING,
    dims: ['df:first_adopters', 'df:absorptive_capacity', 'df:civil_defense_crossing', 'df:timing'],
    teach: 'It can also plan research on who adopts first, absorptive capacity, the civil and defense crossing, and timing.',
    lens: false,
  },
  {
    name: 'whitespace',
    heading: WS_HEADING,
    dims: ['ws:gap_claim', 'ws:covered_elsewhere', 'ws:irrelevant', 'ws:extraction_failure'],
    teach: 'A gap that spans two sections can become a research plan that checks whether the literature is missing it too.',
    lens: true,
  },
];

// --- Local helpers (frontmatter reader copied by value, per plan) ------------

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function extractFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  return m ? { text: m[0], inner: m[1] } : null;
}

function extractBody(raw) {
  const bodyStart = raw.indexOf('\n---', 4);
  return bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw;
}

function extractTopScalar(fm, key) {
  const re = new RegExp('^' + key + ':[ \\t]*(.*)$', 'm');
  const m = re.exec(fm);
  if (!m) return null;
  return m[1].trim().replace(/^["']/, '').replace(/["']$/, '');
}

function extractDashList(fm, key) {
  const re = new RegExp('^' + key + ':\\s*\\r?\\n((?:[ \\t]+-[ \\t]+.*\\r?\\n?|[ \\t]*#.*\\r?\\n?)+)', 'm');
  const m = re.exec(fm);
  if (!m) return null;
  return m[1]
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l))
    .map((l) => l.replace(/^[ \t]*-[ \t]+/, '').trim());
}

function extractConnectorBlock(fm) {
  const m = /\nconnector:\r?\n([\s\S]*?)(\r?\n[a-zA-Z_][a-zA-Z0-9_-]*:|$)/.exec('\n' + fm);
  return m ? m[1] : null;
}

function extractNestedScalar(block, key) {
  if (block === null) return null;
  const re = new RegExp('^[ \\t]+' + key + ':[ \\t]*(.*)$');
  for (const line of block.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = re.exec(line);
    if (m) return m[1].replace(/\s+#.*$/, '').trim().replace(/^["']/, '').replace(/["']$/, '');
  }
  return null;
}

function gitShow(sha, rel) {
  const r = spawnSync('git', ['show', sha + ':' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git show ' + sha + ':' + rel + ' failed');
  return r.stdout;
}

function sections(body) {
  // Split a markdown body into "## " chunks; each chunk keeps its heading and trailing text.
  const out = new Map();
  const re = /^## .*$/gm;
  const idxs = [];
  let m;
  while ((m = re.exec(body)) !== null) idxs.push({ i: m.index, h: m[0] });
  idxs.forEach((x, n) => {
    const end = n + 1 < idxs.length ? idxs[n + 1].i : body.length;
    out.set(x.h, body.slice(x.i, end));
  });
  return { map: out, order: idxs.map((x) => x.h), preamble: idxs.length ? body.slice(0, idxs[0].i) : body };
}

function countOf(text, needle) {
  let n = 0;
  let i = text.indexOf(needle);
  while (i !== -1) { n += 1; i = text.indexOf(needle, i + needle.length); }
  return n;
}

// baseLines must appear in newLines in order; returns the extra lines in newLines.
function extraLines(baseLines, newLines) {
  const extras = [];
  let bi = 0;
  for (const l of newLines) {
    if (bi < baseLines.length && l === baseLines[bi]) bi += 1;
    else extras.push(l);
  }
  assert.equal(bi, baseLines.length, 'every base line must remain, in order (stopped at base line ' + bi + ': ' + JSON.stringify(baseLines[bi]) + ')');
  return extras;
}

let pass = 0;
let fail = 0;
function leg(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    pass += 1;
  } catch (err) {
    console.log('FAIL: ' + name + ' -- ' + (err && err.message ? err.message.split('\n')[0] : err));
    fail += 1;
  }
}

// --- Load state --------------------------------------------------------------

let fixture;
let baseSha;
try {
  fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  baseSha = fixture.base_sha;
} catch (err) {
  console.log('ENV GAP: fixture not readable at ' + FIXTURE_PATH + ' -- ' + err.message);
  process.exit(77);
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const relOf = (c) => 'commands/' + c.name + '.md';

let baseRegistry;
try {
  COMMANDS.forEach((c) => {
    c.baseRaw = gitShow(baseSha, relOf(c));
    c.baseFm = extractFrontmatter(c.baseRaw).inner;
    c.baseBody = extractBody(c.baseRaw);
  });
  baseRegistry = JSON.parse(gitShow(baseSha, 'data/command-registry.json'));
} catch (err) {
  console.log('ENV GAP: base_sha git objects not readable -- ' + err.message);
  process.exit(77);
}

COMMANDS.forEach((c) => {
  c.raw = read(relOf(c));
  const fmm = extractFrontmatter(c.raw);
  assert.ok(fmm, relOf(c) + ' must open with a --- frontmatter block');
  c.fmText = fmm.text;
  c.fm = fmm.inner;
  c.body = extractBody(c.raw);
  const secs = sections(c.body);
  c.secs = secs;
  c.section = secs.map.get(c.heading) || null;
});

// P1 --------------------------------------------------------------------------
leg('P1 byte preservation: every pre-phase section is identical (whitespace routing and help gain one research line each)', () => {
  for (const c of COMMANDS) {
    const rel = relOf(c);
    const base = sections(c.baseBody);
    assert.ok(base.order.length >= 3, rel + ': base must have sections');
    assert.equal(c.secs.preamble, base.preamble, rel + ': preamble before the first section changed');
    // Base sections keep their relative order.
    const filtered = c.secs.order.filter((h) => base.map.has(h));
    assert.deepEqual(filtered, base.order, rel + ': pre-phase section order changed');
    const lastBase = base.order[base.order.length - 1];
    for (const heading of base.order) {
      assert.ok(c.secs.map.has(heading), rel + ': section missing: ' + heading);
      const baseChunk = base.map.get(heading);
      const curChunk = c.secs.map.get(heading);
      if (c.name === 'whitespace' && (heading === '## Subcommand Routing' || heading === '## No Args: Help')) {
        const extras = extraLines(baseChunk.split('\n'), curChunk.split('\n'));
        assert.ok(extras.length <= 1, rel + ': ' + heading + ' may gain at most one line, gained ' + extras.length);
        if (extras.length === 1) assert.ok(/research/.test(extras[0]), rel + ': the added line must mention research: ' + extras[0]);
        continue;
      }
      if (heading === lastBase && c.name !== 'whitespace') {
        assert.equal(curChunk.trimEnd(), baseChunk.trimEnd(), rel + ': section changed: ' + heading);
      } else {
        assert.equal(curChunk, baseChunk, rel + ': section changed: ' + heading);
      }
    }
    if (c.name !== 'whitespace') {
      assert.ok(c.body.startsWith(c.baseBody.trimEnd()), rel + ': the base body must remain a byte prefix');
    } else {
      // Base anchors (routing table lines) survive.
      const anchors = (fixture.anchors && fixture.anchors['commands/whitespace.md']) || [];
      assert.ok(anchors.length > 0, 'fixture must hold whitespace anchors');
      anchors.forEach((a) => assert.ok(c.body.indexOf(a) !== -1, 'whitespace anchor missing: ' + a));
    }
  }
});

// P2 --------------------------------------------------------------------------
leg('P2 the quick-pass ask line: per-command count unchanged, repo-wide count equals the fixture', () => {
  for (const c of COMMANDS) {
    assert.equal(countOf(c.raw, ASK_LINE), countOf(c.baseRaw, ASK_LINE), relOf(c) + ': ask line count changed');
  }
  ['map-unknowns', 'root-cause', 'think-hats'].forEach((n) => {
    const c = COMMANDS.find((x) => x.name === n);
    assert.equal(countOf(c.raw, ASK_LINE), 1, n + ': the ask line occurs exactly once');
  });
  let repoWide = 0;
  for (const f of fs.readdirSync(path.join(ROOT, 'commands'))) {
    if (!f.endsWith('.md')) continue;
    if (read('commands/' + f).indexOf(ASK_LINE) !== -1) repoWide += 1;
  }
  assert.equal(repoWide, fixture.quick_pass_line_count, 'repo-wide count of command files carrying the ask line');
});

// P3 --------------------------------------------------------------------------
leg('P3 frontmatter: only teaching changes (whitespace also gains Write with a pre-approval comment); no web, plan or hitl change', () => {
  for (const c of COMMANDS) {
    const rel = relOf(c);
    const isTeach = (l) => /^teaching:/.test(l);
    const isPreApproval = (l) => /^\s*#/.test(l) && /pre-approval/i.test(l);
    const isWrite = (l) => /^\s+-\s+Write\s*$/.test(l);
    const baseLines = c.baseFm.split('\n');
    const newLines = c.fm.split('\n');
    const strip = (lines) => lines.filter((l) => !isTeach(l) && !(c.name === 'whitespace' && (isPreApproval(l) || isWrite(l))));
    assert.deepEqual(strip(newLines), strip(baseLines), rel + ': frontmatter changed beyond the allowed lines');
    if (c.name === 'whitespace') {
      assert.equal(newLines.filter(isWrite).length, 1, rel + ': exactly one Write entry');
      assert.equal(newLines.filter(isPreApproval).length >= 1, true, rel + ': a comment containing pre-approval');
      const tools = extractDashList(c.fm, 'allowed-tools') || [];
      assert.ok(tools.includes('Write'), rel + ': allowed-tools must include Write');
    }
    const tools = extractDashList(c.fm, 'allowed-tools') || [];
    assert.ok(!tools.includes('Task') && !tools.includes('Agent'), rel + ': no Task or Agent');
    // The new teaching begins with the base teaching text and appends the plan's sentence.
    const oldT = extractTopScalar(c.baseFm, 'teaching');
    const newT = extractTopScalar(c.fm, 'teaching');
    assert.ok(newT.startsWith(oldT), rel + ': the new teaching must begin with the base teaching');
    assert.equal(newT, oldT + ' ' + c.teach, rel + ': teaching must be the base teaching plus the plan sentence');
    // The teaching value is one double-quoted YAML scalar.
    assert.ok(/^teaching: ".*"\s*$/m.test(c.fm), rel + ': teaching stays one quoted string');
    ['hitl_shape', 'hitl_why', 'autonomous_safe'].forEach((k) => {
      assert.equal(extractTopScalar(c.fm, k), extractTopScalar(c.baseFm, k), rel + ': ' + k + ' unchanged');
    });
    const cb = extractConnectorBlock(c.fm);
    assert.equal(extractNestedScalar(cb, 'web_scope'), 'null', rel + ': web_scope stays null');
    assert.equal(extractNestedScalar(cb, 'plan_gated'), 'false', rel + ': plan_gated stays false');
    assert.ok(!/^hitl_stages:/m.test(c.fm), rel + ': no hitl_stages');
  }
});

// P4 --------------------------------------------------------------------------
leg('P4 each new section carries its heading, the CLI lines, dimensions, origins, perspective and hand-off anchors', () => {
  for (const c of COMMANDS) {
    const rel = relOf(c);
    assert.ok(c.section, rel + ': section "' + c.heading + '" must be present');
    if (c.name === 'whitespace') {
      const iDiscover = c.secs.order.indexOf('## Subcommand: discover');
      assert.equal(c.secs.order[iDiscover + 1], WS_HEADING, 'whitespace: the research subcommand follows discover');
      assert.equal(c.secs.order[iDiscover + 2], '## Error Handling', 'whitespace: Error Handling follows the research subcommand');
    } else {
      assert.equal(c.secs.order[c.secs.order.length - 1], c.heading, rel + ': the new section comes last');
    }
    const s = c.section;
    const need = [
      c.heading,
      PENDING_LINE,
      'research-planner.cjs" plan',
      '--mode quick|deep',
      'template_id',
      '"' + c.name + '"',
      'user_stated', 'framework_dimension', 'mece_gap',
      'falsifier',
      'coverage_notes',
      'frustrated insider', 'fresh entrant', 'physics grounder',
      'physics', 'assumed',
      '/mos:research --plan',
      'fetches nothing and dispatches nothing',
      'research_run',
      'quick research run', 'deep research run',
      'scqa',
      'key_line',
    ].concat(c.dims);
    need.forEach((t) => assert.ok(s.indexOf(t) !== -1, rel + ': section is missing "' + t + '"'));
  }
});

// P5 --------------------------------------------------------------------------
leg('P5 no mode-name words, web tools or search names in any new section', () => {
  const banned = [/Quick pass/i, /deep dive/i, /subagent_type/, /tavily/i, /WebSearch/, /WebFetch/, /query-semantic-scholar/];
  for (const c of COMMANDS) {
    assert.ok(c.section, relOf(c) + ': section missing');
    banned.forEach((re) => assert.ok(!re.test(c.section), relOf(c) + ': section contains banned text ' + re));
  }
});

// P6 --------------------------------------------------------------------------
leg('P6 the four other doors offer the diffusion lens with a reason; whitespace states the two-section rule and the term rule', () => {
  for (const c of COMMANDS) {
    if (c.lens) {
      assert.ok(c.section.indexOf('lens_selection') !== -1, relOf(c) + ': lens_selection anchor');
      assert.ok(/diffusion/.test(c.section), relOf(c) + ': names the diffusion lens');
      assert.ok(/dual-use|deep-tech/.test(c.section), relOf(c) + ': says when the lens applies');
      assert.ok(/local judgment|never sends the question anywhere/.test(c.section), relOf(c) + ': lens choice stays local');
    } else {
      assert.ok(/df:first_adopters/.test(c.section), 'diffusion: df leaves named');
    }
  }
  // whitespace: routing table and help each gained exactly one research line over the base.
  const wsc = COMMANDS.find((x) => x.name === 'whitespace');
  const baseWs = sections(wsc.baseBody);
  ['## Subcommand Routing', '## No Args: Help'].forEach((h) => {
    const extras = extraLines(baseWs.map.get(h).split('\n'), wsc.secs.map.get(h).split('\n'));
    assert.equal(extras.length, 1, 'whitespace ' + h + ' must gain exactly one line, gained ' + extras.length);
    assert.ok(/research ZONE_ID/.test(extras[0]), 'whitespace ' + h + ': the added line names research ZONE_ID');
  });
  const ws = wsc.section;
  assert.ok(/fewer than 2 sections/.test(ws), 'whitespace: the 2-section rule');
  assert.ok(/gap is not wide enough to research/.test(ws), 'whitespace: the stop sentence');
  assert.ok(/whitespace-results\.json/.test(ws), 'whitespace: reads the zone from the room whitespace results');
  assert.ok(/zone_term/.test(ws), 'whitespace: names zone_term');
  assert.ok(/external/.test(ws) && /not used/.test(ws), 'whitespace: says the external subcommand is not used for this');
});

// P7 --------------------------------------------------------------------------
leg('P7 registry: five rows keep their key set, teaching moved and matches the frontmatter, hash moved', () => {
  const regText = read('data/command-registry.json');
  const reg = JSON.parse(regText);
  for (const c of COMMANDS) {
    const row = (reg.commands || []).find((r) => r && r.command === '/mos:' + c.name);
    const baseRow = (baseRegistry.commands || []).find((r) => r && r.command === '/mos:' + c.name);
    assert.ok(row && baseRow, '/mos:' + c.name + ' row must exist');
    assert.deepEqual(Object.keys(row).sort(), Object.keys(baseRow).sort(), c.name + ': row key set unchanged');
    assert.notEqual(row.teaching, baseRow.teaching, c.name + ': row teaching must have moved');
    assert.equal(row.teaching, extractTopScalar(c.fm, 'teaching'), c.name + ': row teaching matches the frontmatter');
    assert.equal(row.autonomous_safe, baseRow.autonomous_safe, c.name + ': autonomous_safe unchanged');
  }
  assert.notEqual(sha256(regText), fixture.registry['data/command-registry.json'], 'registry sha256 must differ from the fixture');
});

// P8 --------------------------------------------------------------------------
leg('P8 hygiene: no em-dash, en-dash or banned phrase in any file this plan writes', () => {
  const files = COMMANDS.map(relOf).concat(COMMANDS.map((c) => 'skills/' + c.name + '/SKILL.md'), ['tests/test-363-command-contract.cjs']);
  for (const rel of files) {
    if (!fs.existsSync(path.join(ROOT, rel))) assert.fail('missing file: ' + rel);
    const t = read(rel);
    if (rel.startsWith('tests/')) {
      assert.ok(t.indexOf(String.fromCharCode(0x2014)) === -1 && t.indexOf(String.fromCharCode(0x2013)) === -1, rel + ' has a literal dash');
      continue;
    }
    assert.ok(t.indexOf(EM) === -1, rel + ' has an em-dash');
    assert.ok(t.indexOf(EN) === -1, rel + ' has an en-dash');
    assert.ok(!/silent\s+fallback/i.test(t), rel + ' says the banned phrase');
  }
});

console.log('--- 363-19 command contract ---');
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
