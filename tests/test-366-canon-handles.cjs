#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366-05: the Theo-readiness primitives, hermetic.
 *   C1-C7  the ratified-only translation table and the translation check in
 *          the one resolver (D-10, D-13, D-14), with realpath containment.
 *   C8-C12 the node-then-edge framework writer (D-11, D-16, Pitfall 7).
 * Fully local: no network, no Brain, no model. Rooms live under mkdtemp.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate from the machine's real rooms BEFORE any repo module loads.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-canon-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-canon-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: () => 0, restore: function () {} };
const C = hygiene.makeChecker('test-366-canon-handles');

const stamp = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs'));

let tr = null;
try {
  tr = require(path.join(REPO_ROOT, 'lib/core/canon-translations.cjs'));
} catch (e) {
  C.check('canon-translations module loads', false, String(e && e.message).slice(0, 120));
  process.exit(C.summary());
}

const CANON = 'Reverse Salient Analysis';
const names = stamp.loadFrameworkNames();

function mkRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-canon-' + label + '-'));
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: canon-fixture\n---\n');
  return { root, roomDir };
}

function writeTable(roomDir, rows) {
  const dir = path.join(roomDir, 'references');
  fs.mkdirSync(dir, { recursive: true });
  const lines = ['---', 'translations:'];
  for (const r of rows) {
    lines.push('  - term: ' + JSON.stringify(r.term));
    lines.push('    canon_name: ' + JSON.stringify(r.canon_name));
    lines.push('    ratified_at: ' + (r.ratified_at === null ? 'null' : JSON.stringify(r.ratified_at)));
  }
  lines.push('---', '', '# Canon translations', '');
  fs.writeFileSync(path.join(dir, 'canon-translations.md'), lines.join('\n'));
}

// ---------------------------------------------------------------------------
// C1: readTranslations returns ratified rows only
// ---------------------------------------------------------------------------
{
  const { roomDir } = mkRoom('c1');
  writeTable(roomDir, [
    { term: 'Bottleneck Hunt', canon_name: CANON, ratified_at: '2026-10-01' },
    { term: 'Choke Point Scan', canon_name: CANON, ratified_at: null },
  ]);
  const m = tr.readTranslations(roomDir);
  C.check('C1 readTranslations is a Map', m instanceof Map);
  C.check('C1 ratified row present', m.get('Bottleneck Hunt') === CANON, JSON.stringify([...m]));
  C.check('C1 proposed row (ratified_at null) excluded', !m.has('Choke Point Scan'));
  const rows = tr.listRows(roomDir);
  C.check('C1 listRows returns both rows', Array.isArray(rows) && rows.length === 2, JSON.stringify(rows));
  C.check('C1 listRows keeps ratified_at null', rows.some((r) => r.term === 'Choke Point Scan' && r.ratified_at === null));
  C.check('C1 TRANSLATIONS_RELPATH', tr.TRANSLATIONS_RELPATH === path.join('references', 'canon-translations.md'));
  C.check('C1 missing table reads as an empty Map', tr.readTranslations(mkRoom('c1b').roomDir).size === 0);
}

// ---------------------------------------------------------------------------
// C2: the translation check resolves a ratified term
// ---------------------------------------------------------------------------
{
  const { roomDir } = mkRoom('c2');
  writeTable(roomDir, [{ term: 'Bottleneck Hunt', canon_name: CANON, ratified_at: '2026-10-01' }]);
  const ctx = stamp.resolverCtxFor(roomDir);
  C.check('C2 resolverCtxFor builds names, registry, translations',
    ctx && ctx.names instanceof Set && ctx.registry instanceof Map && ctx.translations instanceof Map);
  const r = stamp.resolveEndpoint({ framework: 'Bottleneck Hunt', methodology: null, title: null }, ctx);
  C.check('C2 framework term resolves via translation', r.name === CANON && r.via === 'translation', JSON.stringify(r));
  const t = stamp.resolveEndpoint({ framework: null, methodology: null, title: 'Bottleneck Hunt' }, ctx);
  C.check('C2 title term resolves via translation', t.name === CANON && t.via === 'translation', JSON.stringify(t));
  const miss = stamp.resolveEndpoint({ framework: 'bottleneck hunt', methodology: null, title: null }, ctx);
  C.check('C2 exact match only (no case folding)', miss.name === null && miss.via === null, JSON.stringify(miss));
  const noCtx = stamp.resolveEndpoint({ framework: 'Bottleneck Hunt' }, { names, registry: stamp.loadCommandFrameworks() });
  C.check('C2 no translations in ctx is a miss', noCtx.name === null);
}

// ---------------------------------------------------------------------------
// C3: the exact checks still win over a translation row
// ---------------------------------------------------------------------------
{
  const { roomDir } = mkRoom('c3');
  const other = [...names].find((n) => n !== CANON);
  writeTable(roomDir, [{ term: CANON, canon_name: other, ratified_at: '2026-10-01' }]);
  const ctx = stamp.resolverCtxFor(roomDir);
  const r = stamp.resolveEndpoint({ framework: CANON }, ctx);
  C.check('C3 canon framework resolves via framework, not translation', r.name === CANON && r.via === 'framework', JSON.stringify(r));
}

// ---------------------------------------------------------------------------
// C4: a ratified row whose canon_name left the snapshot is ignored
// ---------------------------------------------------------------------------
{
  const { roomDir } = mkRoom('c4');
  writeTable(roomDir, [{ term: 'Ghost Term', canon_name: 'Not A Real Framework 366', ratified_at: '2026-10-01' }]);
  const ctx = stamp.resolverCtxFor(roomDir);
  const r = stamp.resolveEndpoint({ framework: 'Ghost Term' }, ctx);
  C.check('C4 stale row is ignored', r.name === null && r.via === null, JSON.stringify(r));
}

// ---------------------------------------------------------------------------
// C5: proposeRow guards and idempotency
// ---------------------------------------------------------------------------
{
  const { roomDir } = mkRoom('c5');
  const bad = tr.proposeRow(roomDir, { term: 'Some Term', canon_name: 'Not A Real Framework 366' }, { names });
  C.check('C5 non-canon canon_name refused', bad && bad.ok === false && typeof bad.reason === 'string', JSON.stringify(bad));
  const long = tr.proposeRow(roomDir, { term: 'x'.repeat(81), canon_name: CANON }, { names });
  C.check('C5 term over 80 chars refused', long && long.ok === false, JSON.stringify(long));
  C.check('C5 refusals wrote nothing', tr.listRows(roomDir).length === 0);
  const a = tr.proposeRow(roomDir, { term: 'Bottleneck Hunt', canon_name: CANON }, { names });
  const b = tr.proposeRow(roomDir, { term: 'Bottleneck Hunt', canon_name: CANON }, { names });
  C.check('C5 first propose ok', a && a.ok === true, JSON.stringify(a));
  C.check('C5 second propose ok (idempotent)', b && b.ok === true, JSON.stringify(b));
  const rows = tr.listRows(roomDir);
  C.check('C5 one row after two proposals', rows.length === 1, JSON.stringify(rows));
  C.check('C5 proposed row has ratified_at null', rows[0] && rows[0].ratified_at === null);
  C.check('C5 proposed row is not used by the resolver', tr.readTranslations(roomDir).size === 0);
  let threw = false;
  try { tr.proposeRow(null, null, null); } catch (_e) { threw = true; }
  C.check('C5 proposeRow never throws', threw === false);
}

// ---------------------------------------------------------------------------
// C6: ratifyRow sets a date or reports row_missing
// ---------------------------------------------------------------------------
{
  const { roomDir } = mkRoom('c6');
  tr.proposeRow(roomDir, { term: 'Bottleneck Hunt', canon_name: CANON }, { names });
  const ok = tr.ratifyRow(roomDir, 'Bottleneck Hunt', '2026-10-01');
  C.check('C6 ratify existing row ok', ok && ok.ok === true, JSON.stringify(ok));
  const rows = tr.listRows(roomDir);
  C.check('C6 ratified_at is the ISO date', rows[0] && rows[0].ratified_at === '2026-10-01', JSON.stringify(rows));
  C.check('C6 ratified row now resolves', tr.readTranslations(roomDir).get('Bottleneck Hunt') === CANON);
  const miss = tr.ratifyRow(roomDir, 'No Such Term', '2026-10-01');
  C.check('C6 missing row returns row_missing', miss && miss.ok === false && miss.reason === 'row_missing', JSON.stringify(miss));
  const r = stamp.resolveEndpoint({ framework: 'Bottleneck Hunt' }, stamp.resolverCtxFor(roomDir));
  C.check('C6 resolver sees the ratified row', r.via === 'translation' && r.name === CANON, JSON.stringify(r));
}

// ---------------------------------------------------------------------------
// C7: a references/ symlink escaping the room is refused
// ---------------------------------------------------------------------------
{
  const { root, roomDir } = mkRoom('c7');
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'canon-translations.md'),
    '---\ntranslations:\n  - term: "Bottleneck Hunt"\n    canon_name: ' + JSON.stringify(CANON) + '\n    ratified_at: "2026-10-01"\n---\n');
  let linked = true;
  try { fs.symlinkSync(outside, path.join(roomDir, 'references'), 'dir'); } catch (_e) { linked = false; }
  if (!linked) {
    C.check('C7 symlink unsupported here (skipped)', true);
  } else {
    C.check('C7 escaping symlink reads as an empty Map', tr.readTranslations(roomDir).size === 0);
    C.check('C7 escaping symlink lists no rows', tr.listRows(roomDir).length === 0);
    const p = tr.proposeRow(roomDir, { term: 'Other Term', canon_name: CANON }, { names });
    C.check('C7 propose through escaping symlink refused', p && p.ok === false, JSON.stringify(p));
    const before = fs.readFileSync(path.join(outside, 'canon-translations.md'), 'utf8');
    C.check('C7 outside file untouched', before.indexOf('Other Term') === -1);
  }
}

// __TASK2_LEGS__

C.check('no network attempted', net.attempts() === 0);
net.restore();
process.exit(C.summary());
