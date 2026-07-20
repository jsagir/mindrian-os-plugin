'use strict';
// Phase 232-02 Task 1 -- room-home.cjs test suite (D-05).
//
// room-home.cjs is the deterministic Room Home data layer behind SPEC Req 4:
//   - parseStateMd(stateText): PURE STATE.md parser (frontmatter + Sections table
//     + Gaps bullets), never throws on malformed input.
//   - getRoomHomeData(roomDir): assembles Room Home data from the room's real
//     STATE.md (via lib/core/state-ops.cjs) + governing thought (via
//     lib/core/folder-memory.cjs readTriple); graceful degrades everywhere.
//   - renderRoomHomeBody(data, opts): emits the UI-SPEC Room Home panel HTML,
//     all dynamic text HTML-escaped; opts.staticExport drops the live briefing
//     control (Plan 06 read-only export surface).
//
// Hermetic: reads only the checked-in fixture room tests/fixtures/wiki-room-232.
// Zero network. Plain node asserts, process.exit(1) on failure.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const modPath = path.join(REPO_ROOT, 'lib', 'wiki', 'room-home.cjs');
const { parseStateMd, getRoomHomeData, renderRoomHomeBody } = require(modPath);

const FIXTURE_ROOM = path.join(REPO_ROOT, 'tests', 'fixtures', 'wiki-room-232');

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

const STATE_WITH_GAPS = [
  '---',
  'computed: 2026-07-20T00:00:00Z',
  'venture_stage: Discovery',
  'total_entries: 3',
  '---',
  '# Data Room State',
  '',
  '## Sections',
  '| Section | Entries | Progress | Status | Last Updated |',
  '|---------|---------|----------|--------|-------------|',
  '| problem-definition | 2 | ####------ 2/5 | active | 2026-07-19 |',
  '| market-analysis | 1 | ##-------- 1/5 | active | 2026-07-18 |',
  '',
  '## Gaps',
  '- solution-design: No entries. Consider mapping your solution architecture.',
  '- business-model: No entries. Consider defining your revenue model.',
  '',
].join('\n');

const STATE_NO_GAPS = [
  '---',
  'computed: 2026-07-20T00:00:00Z',
  'venture_stage: Validation',
  'total_entries: 8',
  '---',
  '# Data Room State',
  '',
  '## Sections',
  '| Section | Entries | Progress | Status | Last Updated |',
  '|---------|---------|----------|--------|-------------|',
  '| problem-definition | 4 | ########-- 4/5 | active | 2026-07-19 |',
  '',
  '## Gaps',
  'No gaps detected -- all sections have entries.',
  '',
].join('\n');

// Test 1: full parse with frontmatter, sections table, and gap bullets.
check('Test 1: parseStateMd parses frontmatter, sections, and gaps', () => {
  const r = parseStateMd(STATE_WITH_GAPS);
  assert.equal(r.ventureStage, 'Discovery');
  assert.equal(r.totalEntries, 3);
  assert.ok(Array.isArray(r.sections));
  assert.equal(r.sections.length, 2);
  assert.equal(r.sections[0].name, 'problem-definition');
  assert.equal(r.sections[0].entries, 2);
  assert.equal(r.sections[1].name, 'market-analysis');
  assert.equal(r.sections[1].entries, 1);
  assert.ok(Array.isArray(r.gaps));
  assert.equal(r.gaps.length, 2);
  assert.equal(r.gaps[0].section, 'solution-design');
  assert.ok(/solution architecture/.test(r.gaps[0].message));
  assert.equal(r.gaps[1].section, 'business-model');
  assert.ok(/revenue model/.test(r.gaps[1].message));
});

// Test 2: the "No gaps detected" variant yields an empty gaps array.
check('Test 2: parseStateMd returns gaps:[] on the no-gaps variant', () => {
  const r = parseStateMd(STATE_NO_GAPS);
  assert.ok(Array.isArray(r.gaps));
  assert.equal(r.gaps.length, 0);
  assert.equal(r.ventureStage, 'Validation');
  assert.equal(r.totalEntries, 8);
});

// Test 3: malformed / null / garbage input never throws, returns safe empty shape.
check('Test 3: parseStateMd returns a safe empty shape on null/empty/garbage', () => {
  for (const bad of [null, undefined, '', '   ', 42, {}, 'not a state file at all']) {
    const r = parseStateMd(bad);
    assert.equal(r.ventureStage, null);
    assert.equal(r.totalEntries, 0);
    assert.deepEqual(r.sections, []);
    assert.deepEqual(r.gaps, []);
  }
});

// Test 4: getRoomHomeData against the fixture (STATE.md present, no MINTO.md)
// returns governingThought null (the readTriple degrade path) plus parsed fields.
check('Test 4: getRoomHomeData degrades governingThought to null with no MINTO', () => {
  const d = getRoomHomeData(FIXTURE_ROOM);
  assert.equal(d.governingThought, null);
  assert.equal(d.ventureStage, 'Discovery');
  assert.equal(d.totalEntries, 3);
  assert.equal(d.sections.length, 2);
  assert.equal(d.gaps.length, 2);
  // suggestedNext is the first gap's message.
  assert.ok(/solution architecture/.test(d.suggestedNext));
});

// Test 5: renderRoomHomeBody (live variant) emits the full UI-SPEC panel set.
check('Test 5: renderRoomHomeBody emits the live Room Home panel set', () => {
  const d = getRoomHomeData(FIXTURE_ROOM);
  const html = renderRoomHomeBody(d, {});
  assert.ok(html.includes('id="room-home"'), 'room-home wrapper');
  assert.ok(html.includes('id="briefing-panel"'), 'briefing panel');
  assert.ok(html.includes('(no MINTO yet)'), 'governing-thought fallback copy');
  assert.ok(html.includes('Discovery'), 'stage chip text');
  assert.ok(html.includes('problem-definition'), 'section name 1');
  assert.ok(html.includes('market-analysis'), 'section name 2');
  assert.ok(/solution architecture/.test(html), 'gap message 1');
  assert.ok(/revenue model/.test(html), 'gap message 2');
  assert.ok(html.includes('Generate Briefing'), 'generate briefing control');
  // per-section progress bars use blue over the rule track.
  assert.ok(html.includes('var(--blue)'), 'blue progress fill');
  assert.ok(html.includes('var(--rule)'), 'rule progress track');
});

// Test 6: staticExport variant drops the live control, shows the empty-state copy.
check('Test 6: renderRoomHomeBody({staticExport:true}) drops the live control', () => {
  const d = getRoomHomeData(FIXTURE_ROOM);
  const html = renderRoomHomeBody(d, { staticExport: true });
  assert.ok(!html.includes('Generate Briefing'), 'no live CTA in static export');
  assert.ok(
    html.includes("No briefing yet. Generate Larry's read of the room."),
    'static empty-state copy'
  );
  // stats still render in the static surface.
  assert.ok(html.includes('problem-definition'), 'sections still render statically');
});

console.log(`\ntest-232-room-home.cjs: ${pass}/${total} passed`);
if (pass !== total) process.exit(1);
