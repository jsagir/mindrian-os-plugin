#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 20 (FBRIEF-02, FBRIEF-06): session start and context_assemble inject the active nest's first three
 * brief blocks under a 600-token contract, link the rest, and speak FeyMinto.
 *
 * Arms:
 *   J1   formatBriefHead on a brief written by renderBrief: 'FeyMinto: <section> (from BRIEF.md)', the three blocks
 *        (THIS NEST SERVES, WE CURRENTLY THINK, THE QUESTION THAT MATTERS NOW), the More line, none of the other seven
 *        headings, at most 600 tokens by bytes / 4; BRIEF_HEAD_BUDGET is 600 = 100 + 300 + 200
 *   J2   a 4000-byte governing thought is cut inside its 300-token cap with '(more in BRIEF.md)'; the other two blocks
 *        keep their own caps; the whole head stays at or under 600 tokens
 *   J3   after MINTO.md changes the head says 'stale: inputs changed since this brief was written' (the file's
 *        record_basis_fingerprint against recordBasis(sectionPath).fingerprint); a nest with no BRIEF.md says 'no brief
 *        yet' and invents nothing; an unreadable BRIEF.md says so; a room with no BRIEF.md anywhere has no head
 *   J4   scripts/session-start in a born room whose nests all have BRIEF.md, focus on market-analysis: prints that
 *        head, an 'Other nests:' line linking each other nest's BRIEF.md and none of the other nests' governing
 *        thoughts; the same text the in-process assembler returns
 *   J5   the same hook in a born room with no BRIEF.md anywhere prints today's per-section TRIPLE_CONTEXT shape (its
 *        header line present) and the FeyMinto Theo face line instead of 'Brain derivation: fresh'
 *   J6   context_assemble (in-process MCP) for a bound session returns the same head text; for a never-ready room it
 *        returns the readiness line plus the recovery card body (header, notice, options, gate id) and does not create
 *        room.db; for a legacy room (identity missing) it carries the card body beside the real context; a ready room
 *        carries neither
 *   J7   fmtBrainLine: a feyminto-theo face with asked false at_birth renders 'FeyMinto Theo face: not asked (the room
 *        was just created)' and no 'Brain derivation: fresh'; an asked face renders 'asked <age> (<n> queries)'; a
 *        legacy BRAIN.md object still renders 'Brain derivation:'
 *   dash guard over the test and the three files this plan edits
 *
 * No timing assert on the hook: session start measures about 19 s on this machine with or without 369.25.
 * Fixture rooms live under isolated mkdtemp homes (tests/helpers/isolated-home-36925.cjs).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const { buildNeverReadyRoom } = require('./fixtures/never-ready-room/build-fixture.cjs');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + String(detail).slice(0, 400) : '')); }
}
function short(v) { const s = JSON.stringify(v); return s === undefined ? 'undefined' : s.slice(0, 400); }
const tokens = (s) => Math.ceil(Buffer.byteLength(String(s), 'utf8') / 4);

const fmt = () => require(path.join(ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
const briefMod = () => require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));

const OTHER_SEVEN = ['## BECAUSE', '## BUT', '## WHAT CHANGED', '## PROPOSED NEXT MOVE', "## THEO'S CONTRIBUTION", '## YOUR DECISION', '## RECORD BASIS'];
const THREE = ['## THIS NEST SERVES', '## WE CURRENTLY THINK', '## THE QUESTION THAT MATTERS NOW'];
const FOCUS = 'market-analysis';
const SESSION = 'inj-sess-36925';

const SAVED = {};
for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_MCP_FIRST', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) SAVED[k] = process.env[k];
const SAVED_CWD = process.cwd();
function restoreEnv() {
  try { process.chdir(SAVED_CWD); } catch (_e) { /* best effort */ }
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
}
function useIso(iso) {
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;
}

function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _d, _s, handler) { tools[name] = handler; },
    registerTool(name, _config, handler) { tools[name] = handler; },
    server: { getClientVersion() { return { name: 'claude-code', version: '2.1.0' }; }, getClientCapabilities() { return {}; } },
  };
}
function parse(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  if (!text) return null;
  const marker = text.indexOf('\n\n## Suggested Next');
  try { return JSON.parse(marker === -1 ? text : text.slice(0, marker)); } catch (_e) { return null; }
}

// The additionalContext string of a hook run, JSON-decoded.
function hookContext(stdout) {
  const raw = String(stdout || '');
  try {
    const j = JSON.parse(raw);
    let found = null;
    (function walk(o) {
      if (found !== null || !o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        if ((k === 'additionalContext' || k === 'additional_context') && typeof o[k] === 'string') { found = o[k]; return; }
        walk(o[k]);
      }
    })(j);
    if (found !== null) return found;
  } catch (_e) { /* not one JSON document */ }
  // the hook builds its JSON by shell string concatenation, so the document is not strictly valid JSON (raw control
  // characters beside backslash-n escapes): take the string and decode the escapes by hand
  const m = /"additional_?[cC]ontext":\s*"([\s\S]*?)(?<!\\)"/m.exec(raw);
  if (m) return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  return raw;
}

function sectionDirs(roomDir) {
  return fs.readdirSync(roomDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name[0] !== '.' && fs.existsSync(path.join(roomDir, d.name, 'ROOM.md')))
    .map((d) => d.name).sort();
}
function thoughtOf(sec) { return 'zebra-' + sec + ' is the governing thought of this nest'; }
function writeMinto(sectionPath, sec, extra) {
  const minto = '---\nschema_version: "1.0"\ntype: section-minto\nsection: ' + sec + '\ngoverning_thought: "' + thoughtOf(sec) + '"\nlast_generated_at: "2026-10-06T00:00:00Z"\ndecision_log: []\n---\n\n# ' + sec + ' -- Minto Reasoning\n\n## Key Claims\n\n## Counterevidence\n\n## Assumptions\n\n## What would change the conclusion\n\n- If a different customer shows up, the thought needs revision.\n' + (extra || '');
  fs.writeFileSync(path.join(sectionPath, 'MINTO.md'), minto, 'utf8');
}
function writeBrief(roomDir, sec) {
  const sectionPath = path.join(roomDir, sec);
  const text = briefMod().renderBrief({ sectionPath, roomDir });
  fs.writeFileSync(path.join(sectionPath, 'BRIEF.md'), text, 'utf8');
  return text;
}
function bornWithBriefs(iso, slug) {
  const b = H.birthFixtureRoom({ iso, slug });
  const roomDir = fs.realpathSync(b.roomDir);
  const secs = sectionDirs(roomDir);
  secs.forEach((s) => { writeMinto(path.join(roomDir, s), s); });
  secs.forEach((s) => { writeBrief(roomDir, s); });
  return { roomDir, slug, secs };
}
function bodyOf(text) { const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/); return m ? m[1] : text; }
// The text of one H2 block, heading excluded.
function block(text, heading) {
  const b = bodyOf(text);
  const a = b.indexOf(heading + '\n');
  if (a === -1) return null;
  const rest = b.slice(a + heading.length + 1);
  const n = rest.search(/^## /m);
  return (n === -1 ? rest : rest.slice(0, n)).trim();
}
function setFocus(roomDir, sessionId, section) {
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const nodeInsert = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  const db = navigation.openRoomDbForCaller(roomDir);
  try {
    nodeInsert.insertNode(db, 'claim:inj-focus-' + section, 'claim', JSON.stringify({ section }), {
      source_path: 'test:36925-20', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed',
    });
    return navigation.setFocus(db, sessionId, 'claim:inj-focus-' + section, 'user');
  } finally { navigation.closeRoomDbForCaller(db); }
}
// A deterministic modification time: the kernel timestamp tick can be coarser than two writes in a row, so each
// change the arms below depend on is stamped a clear step after the previous one.
let stamp = Math.floor(Date.now() / 1000) + 3600;
function bump(...files) { stamp += 10; files.forEach((f) => fs.utimesSync(f, stamp, stamp)); }
// The hook starts the Feynman-MINTO guardian in the background, and it regenerates the nests' FEYNMAN.md after the
// hook has printed (measured: every nest of a freshly born room, a few seconds later). Wait until the nests' inputs
// stop changing, then rewrite the briefs so the arms after the hook start from a current set.
async function settleThenRebrief(roomDir, secs) {
  const sample = () => secs.map((n) => briefMod().recordBasis(path.join(roomDir, n)).fingerprint).join('|');
  let prev = sample();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const cur = sample();
    if (cur === prev) break;
    prev = cur;
  }
  secs.forEach((n) => writeBrief(roomDir, n));
}
const dbFile = (roomDir) => path.join(roomDir, '.mindrian', 'room.db');

async function main() {
  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;

  // ---- fixtures: B (born, no briefs), C (never ready), then A (born, a brief in every nest) ------------------------
  const isoB = H.mkIsolatedHome('inj-nobrief');
  const bRoom = H.birthFixtureRoom({ iso: isoB, slug: 'inj-nobrief' });
  const isoC = H.mkIsolatedHome('inj-neverready');
  const nr = buildNeverReadyRoom(isoC.home, { slug: 'inj-never-ready' });
  const isoA = H.mkIsolatedHome('inj-briefs');
  const A = bornWithBriefs(isoA, 'inj-briefs');
  useIso(isoA);
  process.chdir(isoA.home);
  check('fixture: room A has a BRIEF.md in every nest (' + A.secs.length + ' nests)', A.secs.length >= 8 && A.secs.every((s) => fs.existsSync(path.join(A.roomDir, s, 'BRIEF.md'))), short(A.secs));
  check('fixture: room B is born with no BRIEF.md anywhere', sectionDirs(bRoom.roomDir).every((s) => !fs.existsSync(path.join(bRoom.roomDir, s, 'BRIEF.md'))));

  const focusRes = setFocus(A.roomDir, SESSION, FOCUS);
  check('fixture: focus set on ' + FOCUS + ' for the session', !!focusRes && focusRes.ok === true, short(focusRes));

  const briefText = fs.readFileSync(path.join(A.roomDir, FOCUS, 'BRIEF.md'), 'utf8');

  // ---- J1 -------------------------------------------------------------------------------------------------------
  {
    const F = fmt();
    check('J1 BRIEF_HEAD_BUDGET is total 600 = serves 100 + think 300 + question 200',
      !!F.BRIEF_HEAD_BUDGET && F.BRIEF_HEAD_BUDGET.total === 600 && F.BRIEF_HEAD_BUDGET.serves === 100 && F.BRIEF_HEAD_BUDGET.think === 300 && F.BRIEF_HEAD_BUDGET.question === 200
      && F.BRIEF_HEAD_BUDGET.serves + F.BRIEF_HEAD_BUDGET.think + F.BRIEF_HEAD_BUDGET.question === F.BRIEF_HEAD_BUDGET.total, short(F.BRIEF_HEAD_BUDGET));
    check('J1 formatter exports formatBriefHead, formatTripleContext, BRIEF_HEAD_BUDGET',
      typeof F.formatBriefHead === 'function' && typeof F.formatTripleContext === 'function' && !!F.BRIEF_HEAD_BUDGET, Object.keys(F).join(','));
    const head = typeof F.formatBriefHead === 'function'
      ? F.formatBriefHead({ section: FOCUS, briefText, briefRelPath: FOCUS + '/BRIEF.md', stale: false }) : '';
    check('J1 the head opens with "FeyMinto: ' + FOCUS + ' (from BRIEF.md)"', head.indexOf('FeyMinto: ' + FOCUS + ' (from BRIEF.md)') === 0, head.slice(0, 120));
    THREE.forEach((h) => {
      const want = block(briefText, h) || '@@none@@';
      check('J1 the head carries ' + h + ' and its content', head.indexOf(h) !== -1 && head.indexOf(want.slice(0, 40)) !== -1, want.slice(0, 60));
    });
    check('J1 the head carries the governing thought of the nest', head.indexOf(thoughtOf(FOCUS)) !== -1);
    OTHER_SEVEN.forEach((h) => check('J1 the head does not carry ' + h, head.indexOf(h) === -1));
    check('J1 the More line points at the rest of the brief',
      head.indexOf('More: ' + FOCUS + "/BRIEF.md (proposed next move, evidence, Theo's contribution, your decision)") !== -1, head.slice(-200));
    check('J1 the head is at most 600 tokens (bytes / 4): ' + tokens(head), head.length > 0 && tokens(head) <= 600);
    check('J1 no stale line on a current head', head.indexOf('stale:') === -1);
  }

  // ---- J2 -------------------------------------------------------------------------------------------------------
  {
    const F = fmt();
    const filler = (n) => { let s = ''; let i = 0; while (Buffer.byteLength(s, 'utf8') < n) s += 'word' + (i++) + ' '; return s.trim(); };
    let big = briefText.replace(block(briefText, '## WE CURRENTLY THINK'), filler(4000));
    big = big.replace(block(big, '## THIS NEST SERVES'), filler(1500));
    big = big.replace(block(big, '## THE QUESTION THAT MATTERS NOW'), filler(2500));
    const head = typeof F.formatBriefHead === 'function' ? F.formatBriefHead({ section: FOCUS, briefText: big, briefRelPath: FOCUS + '/BRIEF.md', stale: false }) : '';
    const think = block('---\n---\n' + head, '## WE CURRENTLY THINK') || '';
    const serves = block('---\n---\n' + head, '## THIS NEST SERVES') || '';
    const question = (block('---\n---\n' + head, '## THE QUESTION THAT MATTERS NOW') || '').split('\n\nMore:')[0];
    check('J2 the 4000-byte governing thought is cut and says "(more in BRIEF.md)"', think.indexOf('(more in BRIEF.md)') !== -1 && Buffer.byteLength(think, 'utf8') < 4000, think.slice(-80));
    check('J2 WE CURRENTLY THINK is at most 300 tokens: ' + tokens(think), think.length > 0 && tokens(think) <= 300);
    check('J2 THIS NEST SERVES is at most 100 tokens: ' + tokens(serves), serves.length > 0 && tokens(serves) <= 100 && serves.indexOf('(more in BRIEF.md)') !== -1);
    check('J2 THE QUESTION THAT MATTERS NOW is at most 200 tokens: ' + tokens(question), question.length > 0 && tokens(question) <= 200 && question.indexOf('(more in BRIEF.md)') !== -1);
    check('J2 the whole head stays at or under 600 tokens: ' + tokens(head), head.length > 0 && tokens(head) <= 600);
    check('J2 the More line survives the cut', head.indexOf('More: ' + FOCUS + '/BRIEF.md') !== -1);
  }

  // ---- J3 -------------------------------------------------------------------------------------------------------
  {
    const F = fmt();
    check('J3 formatBriefHead given stale:true adds "stale: inputs changed since this brief was written"',
      typeof F.formatBriefHead === 'function' && F.formatBriefHead({ section: FOCUS, briefText, briefRelPath: FOCUS + '/BRIEF.md', stale: true }).indexOf('stale: inputs changed since this brief was written') !== -1);

    const assemble = typeof F.assembleBriefHead === 'function' ? F.assembleBriefHead : null;
    check('J3 formatter exports assembleBriefHead (the one assembler both surfaces call)', !!assemble);
    if (assemble) {
      // current: the newest-by-mtime nest, no focus, a head that is not stale
      bump(path.join(A.roomDir, A.secs[A.secs.length - 1], 'BRIEF.md'));
      const cur = assemble({ roomDir: A.roomDir });
      check('J3 with no focus the active nest is the newest and its head is current', !!cur && typeof cur.head === 'string' && cur.state === 'fresh' && cur.head.indexOf('stale:') === -1 && cur.source === 'newest', short(cur && { state: cur.state, source: cur.source, section: cur.section }));

      // MINTO.md changes after the brief was written -> stale, naming the cause
      const mp = path.join(A.roomDir, FOCUS, 'MINTO.md');
      fs.appendFileSync(mp, '\nA late addition to the reasoning that the brief never saw.\n');
      bump(mp);
      const stale = assemble({ roomDir: A.roomDir });
      check('J3 after MINTO.md changes the newest nest is ' + FOCUS + ' and its head says stale',
        !!stale && stale.section === FOCUS && stale.state === 'stale' && stale.head.indexOf('stale: inputs changed since this brief was written') !== -1, short(stale && { state: stale.state, section: stale.section }));
      check('J3 the stale head names the input that changed', !!stale && /MINTO\.md/.test(stale.head.split('\n').filter((l) => /^stale:/.test(l)).join(' ')), stale && stale.head.slice(0, 300));

      // a focused session pointing at an unchanged nest beats the newest-by-mtime rule
      const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
      const ro = navigation.openRoomDbReadOnlyForCaller(A.roomDir);
      let focused = null;
      try { focused = assemble({ roomDir: A.roomDir, sessionId: SESSION, db: ro }); } finally { navigation.closeRoomDbForCaller(ro); }
      check('J3 a session focus on ' + FOCUS + ' selects it with source focus', !!focused && focused.section === FOCUS && focused.source === 'focus', short(focused && { section: focused.section, source: focused.source }));
      const other = A.secs.find((s) => s !== FOCUS);
      const ro2 = navigation.openRoomDbReadOnlyForCaller(A.roomDir);
      let nofocus = null;
      try { nofocus = assemble({ roomDir: A.roomDir, sessionId: 'a-session-with-no-focus', db: ro2 }); } finally { navigation.closeRoomDbForCaller(ro2); }
      check('J3 a session with no focus falls back to the newest nest', !!nofocus && nofocus.source === 'newest', short(nofocus && { section: nofocus.section, source: nofocus.source }));

      // a nest with no BRIEF.md: 'no brief yet', nothing invented
      const bare = A.secs.find((s) => s !== FOCUS && s !== other) || other;
      fs.rmSync(path.join(A.roomDir, bare, 'BRIEF.md'));
      fs.appendFileSync(path.join(A.roomDir, bare, 'MINTO.md'), '\nA change after the brief was removed.\n');
      bump(path.join(A.roomDir, bare, 'MINTO.md'));
      const nobrief = assemble({ roomDir: A.roomDir });
      check('J3 a nest with no BRIEF.md says "no brief yet" and the reason',
        !!nobrief && nobrief.section === bare && nobrief.state === 'no_brief' && /no brief yet/.test(nobrief.head) && /BRIEF\.md has not been written/.test(nobrief.head), short(nobrief && { state: nobrief.state, section: nobrief.section, head: nobrief.head && nobrief.head.slice(0, 200) }));
      check('J3 a missing brief injects no invented block and no governing thought',
        !!nobrief && THREE.every((h) => nobrief.head.indexOf(h) === -1) && nobrief.head.indexOf(thoughtOf(bare)) === -1);
      check('J3 the missing-brief head still links the nests that have one', !!nobrief && nobrief.text.indexOf(FOCUS + '/BRIEF.md') !== -1, nobrief && nobrief.text.slice(0, 300));

      // an unreadable BRIEF.md: said so, nothing invented
      const junk = A.secs.find((s) => s !== FOCUS && s !== bare);
      fs.writeFileSync(path.join(A.roomDir, junk, 'BRIEF.md'), 'hello, this is not a brief\n');
      fs.appendFileSync(path.join(A.roomDir, junk, 'MINTO.md'), '\nA change after the brief was damaged.\n');
      bump(path.join(A.roomDir, junk, 'MINTO.md'));
      const unread = assemble({ roomDir: A.roomDir });
      check('J3 a BRIEF.md with none of the three blocks is reported as unreadable, nothing invented',
        !!unread && unread.section === junk && unread.state === 'unreadable' && /could not be read/.test(unread.head) && THREE.every((h) => unread.head.indexOf(h) === -1), short(unread && { state: unread.state, head: unread.head && unread.head.slice(0, 200) }));

      // restore room A to all-briefs-current for the arms below
      writeBrief(A.roomDir, bare);
      writeBrief(A.roomDir, junk);
      writeBrief(A.roomDir, FOCUS);

      // a room with no BRIEF.md anywhere has no head at all
      const none = assemble({ roomDir: bRoom.roomDir });
      check('J3 a room with no BRIEF.md anywhere has no head (today\'s rendering stays)', !!none && none.head === null && none.state === 'no_briefs', short(none && { state: none.state }));
    }
  }

  // ---- J4: the hook in room A -----------------------------------------------------------------------------------
  const F = fmt();
  const expected = typeof F.assembleBriefHead === 'function' ? (function () {
    const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
    const ro = navigation.openRoomDbReadOnlyForCaller(A.roomDir);
    try { return F.assembleBriefHead({ roomDir: A.roomDir, sessionId: SESSION, db: ro }); } finally { navigation.closeRoomDbForCaller(ro); }
  })() : null;
  {
    const env = Object.assign({}, isoA.env, { CLAUDE_CODE_SESSION_ID: SESSION });
    const ss = spawnSync('bash', [path.join(ROOT, 'scripts', 'session-start')], { cwd: A.roomDir, env, encoding: 'utf8', timeout: 240000 });
    const ctx = hookContext(ss.stdout);
    check('J4 session-start exits 0 in the born room with briefs', ss.status === 0, 'exit ' + ss.status + ' ' + String(ss.stderr || '').slice(-200));
    check('J4 the hook prints the ' + FOCUS + ' head: "FeyMinto: ' + FOCUS + ' (from BRIEF.md)"', ctx.indexOf('FeyMinto: ' + FOCUS + ' (from BRIEF.md)') !== -1, ctx.slice(0, 300));
    THREE.forEach((h) => check('J4 the hook prints ' + h, ctx.indexOf(h) !== -1));
    check('J4 the hook prints the nest\'s governing thought', ctx.indexOf(thoughtOf(FOCUS)) !== -1);
    const others = A.secs.filter((s) => s !== FOCUS);
    const line = (ctx.split('\n').find((l) => l.indexOf('Other nests:') === 0)) || '';
    check('J4 an "Other nests:" line links every other nest\'s BRIEF.md', line.length > 0 && others.every((s) => line.indexOf(s + '/BRIEF.md') !== -1), line.slice(0, 300));
    const memStart = ctx.indexOf('## ACTIVE ROOM MEMORY');
    const memEndAt = ctx.indexOf('Other nests:', memStart);
    const memBlock = memStart === -1 ? '' : ctx.slice(memStart, memEndAt === -1 ? ctx.length : ctx.indexOf('\n', memEndAt) === -1 ? ctx.length : ctx.indexOf('\n', memEndAt));
    check('J4 the memory block is found and ends at the Other nests line', memBlock.length > 0 && memBlock.indexOf('Other nests:') !== -1, memBlock.slice(0, 120));
    check('J4 none of the other nests\' governing thoughts is injected by the memory block', others.every((s) => memBlock.indexOf(thoughtOf(s)) === -1), others.filter((s) => memBlock.indexOf(thoughtOf(s)) !== -1).join(','));
    check('J4 the hook prints the same text the in-process assembler returns', !!expected && typeof expected.text === 'string' && ctx.indexOf(expected.text) !== -1, expected && expected.text && expected.text.slice(0, 200));
    check('J4 the per-section triple blocks are not injected beside the head', ctx.indexOf('### ' + FOCUS + '/') === -1 && ctx.indexOf('### ' + others[0] + '/') === -1);
    check('J4 the head part of the injection is at most 600 tokens', !!expected && typeof expected.head === 'string' && tokens(expected.head) <= 600, expected && tokens(expected.head));
  }

  // ---- J5 + J7 (hook level): the hook in room B, no briefs --------------------------------------------------------
  {
    const ss = spawnSync('bash', [path.join(ROOT, 'scripts', 'session-start')], { cwd: bRoom.roomDir, env: isoB.env, encoding: 'utf8', timeout: 240000 });
    const ctx = hookContext(ss.stdout);
    check('J5 session-start exits 0 in the born room with no briefs', ss.status === 0, 'exit ' + ss.status + ' ' + String(ss.stderr || '').slice(-200));
    check('J5 a room with no briefs keeps today\'s per-section header', ctx.indexOf('## ACTIVE ROOM MEMORY (per-section triple)') !== -1, ctx.slice(0, 300));
    check('J5 no FeyMinto brief head and no Other nests line', ctx.indexOf('(from BRIEF.md)') === -1 && ctx.indexOf('Other nests:') === -1);
    check('J5 a per-section block is present', /### [a-z-]+\//.test(ctx));
    check('J7 the hook says "FeyMinto Theo face: not asked (the room was just created)" for a face that asked nothing',
      ctx.indexOf('FeyMinto Theo face: not asked (the room was just created)') !== -1, ctx.slice(0, 300));
    check('J7 the hook does not say "Brain derivation: fresh" for that face', ctx.indexOf('Brain derivation: fresh') === -1);
  }

  // ---- J6: context_assemble ---------------------------------------------------------------------------------------
  {
    useIso(isoA);
    process.chdir(isoA.home);
    await settleThenRebrief(A.roomDir, A.secs);
    const expected6 = (function () {
      const nav = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
      const ro = nav.openRoomDbReadOnlyForCaller(A.roomDir);
      try { return F.assembleBriefHead({ roomDir: A.roomDir, sessionId: SESSION, db: ro }); } finally { nav.closeRoomDbForCaller(ro); }
    })();
    check('J6 setup: after the hook settles and the briefs are rewritten the head is current', expected6.state === 'fresh' && expected6.section === FOCUS, short({ state: expected6.state, section: expected6.section }));
    const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
    const ctxTool = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'context.cjs'));
    const gateTools = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
    const ghost = path.join(isoA.home, 'no-such-boot-room');
    const mctx = { fallbackRoomDir: ghost, surface: 'cli' };
    const server = makeFakeServer();
    toolRouter.registerRouterTools(server, ghost, ROOT, { compact: '' }, 'cli');
    ctxTool.register(server, mctx);
    gateTools.register(server, mctx);
    const bound = parse(await server.tools.room_bind({ room: A.slug }, { sessionId: SESSION }));
    check('J6 room_bind binds the session to room A', !!bound && bound.ok === true && bound.effective === true, short(bound));

    const r = parse(await server.tools.context_assemble({ top_k: 3 }, { sessionId: SESSION }));
    check('J6 context_assemble answers ok for the bound room', !!r && r.ok === true, short(r));
    check('J6 context_assemble returns the same head text as the assembler the hook calls',
      !!r && typeof r.feyminto_brief === 'string' && r.feyminto_brief === expected6.text,
      (function () { if (!r || typeof r.feyminto_brief !== 'string') return 'no brief field'; let i = 0; while (i < r.feyminto_brief.length && r.feyminto_brief[i] === expected6.text[i]) i++; return 'first difference at ' + i + ': mcp[' + r.feyminto_brief.slice(i, i + 80) + '] expected[' + String(expected6.text).slice(i, i + 80) + ']'; })());
    check('J6 the head carries the three blocks and links the other nests',
      !!r && typeof r.feyminto_brief === 'string' && THREE.every((h) => r.feyminto_brief.indexOf(h) !== -1) && r.feyminto_brief.indexOf('Other nests:') !== -1);
    check('J6 the brief is at most 600 tokens and says which nest and how it was chosen',
      !!r && !!r.feyminto_brief_meta && r.feyminto_brief_meta.section === FOCUS && r.feyminto_brief_meta.source === 'focus' && r.feyminto_brief_meta.tokens <= 600, short(r && r.feyminto_brief_meta));
    check('J6 a ready room carries no readiness line and no recovery card', !!r && r.feyminto_readiness === undefined && r.recovery_card === undefined, short(r && { a: r.feyminto_readiness, b: r.recovery_card }));
    const est = parse(await server.tools.context_assemble({ estimate_only: true }, { sessionId: SESSION }));
    check('J6 estimate_only reports the brief cost without the body', !!est && est.ok === true && !!est.feyminto_brief_meta && est.feyminto_brief === null && est.feyminto_brief_meta.tokens > 0, short(est && est.feyminto_brief_meta));

    // legacy room: identity missing, db present
    const legacy = H.birthFixtureRoom({ iso: isoA, slug: 'inj-legacy' });
    useIso(isoA);
    const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
    const ldb = navigation.openRoomDbForCaller(legacy.roomDir);
    try { ldb.prepare("DELETE FROM identity WHERE key LIKE 'room.%'").run(); } finally { navigation.closeRoomDbForCaller(ldb); }
    // a TRUE legacy room records no id outside room.db (born before 369.25): plan 27 reads a recorded id as a lost graph
    {
      const rootFile = path.join(legacy.roomDir, '.room-root');
      const cur = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
      delete cur.room_id;
      fs.writeFileSync(rootFile, JSON.stringify(cur));
      const regFile = path.join(isoA.roomsHome, '.rooms', 'registry.json');
      const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
      Object.keys(reg.rooms || {}).forEach((k) => { if (reg.rooms[k] && typeof reg.rooms[k] === 'object') delete reg.rooms[k].room_id; });
      fs.writeFileSync(regFile, JSON.stringify(reg, null, 2));
    }

    const lb = parse(await server.tools.room_bind({ room: 'inj-legacy' }, { sessionId: 's-inj-legacy' }));
    check('J6 room_bind binds the legacy room', !!lb && lb.ok === true && lb.effective === true, short(lb));
    const lr = parse(await server.tools.context_assemble({ top_k: 3 }, { sessionId: 's-inj-legacy' }));
    check('J6 a legacy room still gets its real context', !!lr && lr.ok === true, short(lr));
    check('J6 a legacy room carries the readiness line', !!lr && typeof lr.feyminto_readiness === 'string' && lr.feyminto_readiness.indexOf('FeyMinto: this room is not ready') === 0 && /identity is not in room\.db/.test(lr.feyminto_readiness), lr && lr.feyminto_readiness);
    check('J6 a legacy room (record incomplete, context still readable) is not given a per-session card by a read',
      !!lr && lr.recovery_card === undefined && lr.recovery_gate_id === undefined && /answer the recovery card when a filing asks/.test(lr.feyminto_readiness || ''), short(lr && lr.recovery_card));
    await server.tools.room_bind({ room: 'inj-legacy' }, { sessionId: 's-inj-legacy-2' });
    const lr2 = parse(await server.tools.context_assemble({ top_k: 3 }, { sessionId: 's-inj-legacy-2' }));
    const strip = (x) => { const c = JSON.parse(JSON.stringify(x)); if (c && c._meta) delete c._meta.legTimingsMs; return c; };
    check('J6 two sessions reading the same legacy room get byte-identical answers (the test-347 Test 5 contract)', !!lr && !!lr2 && JSON.stringify(strip(lr)) === JSON.stringify(strip(lr2)), 'differs');
    check('J6 a room with no BRIEF.md anywhere has no brief fields to invent', !!lr && (lr.feyminto_brief === null || lr.feyminto_brief === undefined), short(lr && lr.feyminto_brief));

    // never-ready room: the readiness line and the card, and no room.db created
    useIso(isoC);
    process.chdir(isoC.home);
    const serverC = makeFakeServer();
    const ghostC = path.join(isoC.home, 'no-such-boot-room');
    const cctx = { fallbackRoomDir: nr.roomDir, surface: 'cli' };
    toolRouter.registerRouterTools(serverC, ghostC, ROOT, { compact: '' }, 'cli');
    ctxTool.register(serverC, cctx);
    gateTools.register(serverC, cctx);
    const hashBefore = H.treeHash(nr.roomDir);
    const nrr = parse(await serverC.tools.context_assemble({ top_k: 3 }, { sessionId: 's-inj-nr' }));
    check('J6 a never-ready room is answered honestly: not ok, the existing no_room_db reason, now typed room_db_missing',
      !!nrr && nrr.ok === false && nrr.reason === 'no_room_db' && nrr.not_ready_reason === 'room_db_missing', short(nrr));
    check('J6 a never-ready room returns the readiness line naming the requirement and the recovery',
      !!nrr && typeof nrr.feyminto_readiness === 'string' && nrr.feyminto_readiness.indexOf('FeyMinto: this room is not ready (room.db is missing') === 0 && /\/mos:graph --derive/.test(nrr.feyminto_readiness), nrr && nrr.feyminto_readiness);
    const nc = nrr && nrr.recovery_card;
    check('J6 a never-ready room carries the recovery card body with options recover and defer',
      !!nc && nc.header === "Recover this room's record so work can continue" && nc.options.map((o) => o.id).join(',') === 'recover,defer' && typeof nc.gate_id === 'string' && nc.gate_id === nrr.recovery_gate_id, short(nc));
    check('J6 reading the context did not create room.db or change the room', !fs.existsSync(dbFile(nr.roomDir)) && H.treeHash(nr.roomDir) === hashBefore);
    const gateLedger = require(path.join(ROOT, 'lib', 'mcp', 'gate-ledger.cjs'));
    check('J6 the carried card is live in the gate ledger and nothing was written to the room', !!nc && gateLedger.isGateLive(nc.gate_id) === true && !fs.existsSync(dbFile(nr.roomDir)) && H.treeHash(nr.roomDir) === hashBefore);
  }

  // ---- J7: fmtBrainLine --------------------------------------------------------------------------------------------
  {
    const F2 = fmt();
    const notAsked = F2.fmtBrainLine({ staleness: 'fresh', age_days: 0, brain_graph_version: 0, face: 'feyminto-theo', asked: false, not_asked_reason: 'at_birth', queries_sent: 0 });
    check('J7 a not-asked face reads "FeyMinto Theo face: not asked (the room was just created)"', notAsked === 'FeyMinto Theo face: not asked (the room was just created)', notAsked);
    check('J7 a not-asked face never says "Brain derivation: fresh"', String(notAsked).indexOf('Brain derivation: fresh') === -1);
    const offline = F2.fmtBrainLine({ staleness: 'fresh', age_days: 0, face: 'feyminto-theo', asked: false, not_asked_reason: 'offline' });
    check('J7 another reason reads from the one table of reason lines', offline === 'FeyMinto Theo face: not asked (this run was offline)', offline);
    const asked = F2.fmtBrainLine({ staleness: 'fresh', age_days: 0.2, face: 'feyminto-theo', asked: true, queries_sent: 3 });
    check('J7 an asked face reads "FeyMinto Theo face: asked today (3 queries)"', asked === 'FeyMinto Theo face: asked today (3 queries)', asked);
    const asked2 = F2.fmtBrainLine({ staleness: 'fresh', age_days: 4.2, face: 'feyminto-theo', asked: true, queries_sent: 1 });
    check('J7 an asked face a few days old reads "asked 4d ago (1 query)"', asked2 === 'FeyMinto Theo face: asked 4d ago (1 query)', asked2);
    const legacyFresh = F2.fmtBrainLine({ staleness: 'fresh', age_days: 0, brain_graph_version: 7 });
    check('J7 a legacy BRAIN.md object keeps "Brain derivation: fresh (today, v7)"', legacyFresh === 'Brain derivation: fresh (today, v7)', legacyFresh);
    const legacyStale = F2.fmtBrainLine({ staleness: 'stale', stale_reason: 'governing_thought_changed', recommended_action: 'enqueue_regen' });
    check('J7 a legacy stale object keeps its "Brain derivation: stale (...)" line', /^Brain derivation: stale \(governing_thought changed,/.test(legacyStale), legacyStale);
    const absent = F2.fmtBrainLine({ staleness: 'absent' });
    check('J7 a legacy absent object keeps "Brain derivation: absent"', absent === 'Brain derivation: absent', absent);

    // formatTripleContext: brief head replaces the per-section blocks, footers stay; without it the output is unchanged
    const sections = { 'market-analysis': { room: { exists: true, identity_text: '# Market' }, state: {}, reasoning: {} } };
    const plain = F2.formatTripleContext({ sections });
    const withHead = F2.formatTripleContext({ sections, briefHead: 'FeyMinto: market-analysis (from BRIEF.md)\n\n## THIS NEST SERVES\n\nx', nestLinks: [{ section: 'team', path: 'team/BRIEF.md' }], pendingTier1: [{ section: 'team' }] });
    check('J5 formatTripleContext without briefHead keeps the per-section output', plain.indexOf('## ACTIVE ROOM MEMORY (per-section triple)') !== -1 && plain.indexOf('### market-analysis/') !== -1, plain.slice(0, 200));
    check('J4 formatTripleContext with briefHead replaces the per-section blocks, links the other nests and keeps the footer',
      withHead.indexOf('FeyMinto: market-analysis (from BRIEF.md)') !== -1 && withHead.indexOf('### market-analysis/') === -1 && withHead.indexOf('Other nests: team/BRIEF.md') !== -1 && /tier-0 MINTO pending/.test(withHead), withHead);
  }

  // ---- dash guard ---------------------------------------------------------------------------------------------------
  const guarded = [__filename, path.join(ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'), path.join(ROOT, 'scripts', 'session-start'), path.join(ROOT, 'lib', 'mcp', 'tools', 'context.cjs')];
  const dashed = H.dashGuard(guarded);
  check('dash guard: no em dash or en dash in the test or the three files this plan edits', dashed.length === 0, dashed.join(','));

  restoreEnv();
  console.log('\ntest-36925-injection: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  restoreEnv();
  console.log('FAIL: unexpected error :: ' + String((e && e.stack) || e).slice(0, 800));
  console.log('\ntest-36925-injection: ' + passed + ' passed, ' + (failed + 1) + ' failed');
  process.exit(1);
});
