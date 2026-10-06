#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 22 (FBRIEF-06, SEED-122 ruling 1): the name FeyMinto, one word, on every surface a navigator reads.
 * "The three per-folder files are FeyMinto's three faces; the file names may stay for compatibility, the layer is
 * named FeyMinto."
 *
 * Arms:
 *   N1 commands/mos-reason.md, commands/doctor.md, commands/heal.md and their skills/<name>/SKILL.md mirrors name FeyMinto
 *   N2 data/command-registry.json: the /mos:mos-reason row's teaching sentence names FeyMinto (the registry carries
 *      `teaching`, not the frontmatter description)
 *   N3 `node scripts/doctor.cjs --icm-walk --room <born room>` text carries a 'FeyMinto faces' row in every nest block
 *   N4 the recovery card built by mintRecoveryGate keeps header === RECOVERY_CARD_HEADER and its body names FeyMinto
 *   N5 (regression guard for plan 20) formatBriefHead on a rendered brief and readinessLine both name FeyMinto, and
 *      lib/mcp/tools/context.cjs still answers feyminto_brief
 *   N6 agents/larry-extended.md and skills/larry-personality/SKILL.md are byte-identical to the phase base
 *      (369.6 owns them): git diff --quiet BASE_SHA -- <both>
 *   N7 the face file names still exist on a born room (root MINTO.md, nest FEYNMAN.md and BRAIN.md, BRIEF.md once
 *      rendered) and the referrer count of each face name under lib, scripts and hooks is at least the Phase 0 count
 *      (MINTO 128, FEYNMAN 23, BRAIN 64, the R1 row of 369.25-PHASE0-STATUS.md, same grep -rlIF measure)
 *   dash guard over the test, the edited docs, the walk module and the gate module
 *
 * BASE_SHA: 369.25-PHASE0-STATUS.md records no sha; the phase's first commit is f06c4ef78 (the Phase 0 status
 * table), so its parent is the phase base.
 *
 * Fixture rooms are born under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const BASE_SHA = 'f06c4ef78^';
const PHASE0_REFERRERS = { MINTO: 128, FEYNMAN: 23, BRAIN: 64 };

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function safe(fn, fallback) { try { return fn(); } catch (_e) { return fallback; } }
const read = (rel) => safe(() => fs.readFileSync(path.join(ROOT, rel), 'utf8'), '');

const iso = H.mkIsolatedHome('naming');
const SAVED = {};
for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) SAVED[k] = process.env[k];
const SAVED_CWD = process.cwd();
function restoreEnv() {
  try { process.chdir(SAVED_CWD); } catch (_e) { /* best effort */ }
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
}

const DOCS = ['commands/mos-reason.md', 'commands/doctor.md', 'commands/heal.md'];
const MIRRORS = ['skills/mos-reason/SKILL.md', 'skills/doctor/SKILL.md', 'skills/heal/SKILL.md'];

async function main() {
  // ---- N1 ---------------------------------------------------------------------------------------------------------
  DOCS.concat(MIRRORS).forEach((f) => {
    check('N1 ' + f + ' names FeyMinto', /FeyMinto/.test(read(f)));
  });

  // ---- N2 ---------------------------------------------------------------------------------------------------------
  {
    const reg = safe(() => JSON.parse(read('data/command-registry.json')), null);
    const list = reg && (Array.isArray(reg) ? reg : (reg.commands || reg.entries || Object.values(reg)));
    const rows = Array.isArray(list) ? list : Object.values(list || {});
    const row = rows.find((r) => r && r.command === '/mos:mos-reason');
    check('N2 the registry row for /mos:mos-reason exists', !!row, rows.length + ' rows');
    // The registry carries the command's teaching sentence (the frontmatter description is not a registry field).
    check('N2 its teaching sentence names FeyMinto', !!row && /FeyMinto/.test(String(row.teaching || '')), row && row.teaching);
  }

  // ---- fixture room -----------------------------------------------------------------------------------------------
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
  process.chdir(iso.home);
  const b = H.birthFixtureRoom({ iso, slug: 'naming-room' });
  check('fixture: room born ready', !!b && b.ok === true, JSON.stringify(b).slice(0, 200));
  const roomDir = fs.realpathSync(b.roomDir);

  // ---- N3 ---------------------------------------------------------------------------------------------------------
  {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.cjs'), '--icm-walk', '--room', roomDir], { env: iso.env, cwd: iso.home, encoding: 'utf8', timeout: 120000 });
    const text = String(r.stdout || '');
    check('N3 the walk exits 0', r.status === 0, 'status ' + r.status + ' ' + String(r.stderr || '').slice(0, 200));
    const blocks = text.split('\n').filter((l) => /^== (room root|nest): /.test(l)).length;
    const rows = text.split('\n').filter((l) => /^\s+I6\s+.*FeyMinto faces/.test(l)).length;
    check('N3 the walk prints at least one nest block', blocks > 0, String(blocks));
    check('N3 every nest block carries a "FeyMinto faces" row (blocks ' + blocks + ', rows ' + rows + ')', blocks > 0 && rows === blocks, text.split('\n').filter((l) => /I6/.test(l))[0]);
  }

  // ---- N4 ---------------------------------------------------------------------------------------------------------
  {
    const gate = require(path.join(ROOT, 'lib', 'mcp', 'room-readiness-gate.cjs'));
    const m = gate.mintRecoveryGate({ roomDir, sessionId: 'naming-n4', readiness: { requirement: 'room.db is missing' } });
    check('N4 the recovery card mints', !!m && m.ok === true, JSON.stringify(m).slice(0, 200));
    const card = m && m.card;
    check('N4 the header is still RECOVERY_CARD_HEADER (cards are named by their job)', !!card && card.header === gate.RECOVERY_CARD_HEADER && gate.RECOVERY_CARD_HEADER === "Recover this room's record so work can continue", card && card.header);
    check('N4 the body names FeyMinto', !!card && /FeyMinto/.test(String(card.notice || '')), card && card.notice);
    check('N4 the header does not take the layer name (job statement kept)', !!card && !/FeyMinto/.test(card.header));
  }

  // ---- N5 ---------------------------------------------------------------------------------------------------------
  {
    const F = require(path.join(ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
    const brief = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));
    const sec = 'market-analysis';
    const briefText = safe(() => brief.renderBrief({ sectionPath: path.join(roomDir, sec), roomDir }), '');
    check('N5 a brief renders for a born nest', typeof briefText === 'string' && briefText.length > 0);
    const head = F.formatBriefHead({ section: sec, briefText, briefRelPath: sec + '/BRIEF.md', stale: false });
    check('N5 formatBriefHead names FeyMinto', /FeyMinto/.test(head), String(head).slice(0, 120));
    check('N5 readinessLine names FeyMinto', /FeyMinto/.test(F.readinessLine('room.db is missing')));
    check('N5 context_assemble still answers feyminto_brief (source)', /feyminto_brief/.test(read('lib/mcp/tools/context.cjs')));

    // ---- N7 (needs the rendered brief) ---------------------------------------------------------------------------
    fs.writeFileSync(path.join(roomDir, sec, 'BRIEF.md'), briefText, 'utf8');
    check('N7 root MINTO.md exists on the born room', fs.existsSync(path.join(roomDir, 'MINTO.md')));
    check('N7 nest FEYNMAN.md and BRAIN.md exist on the born room', fs.existsSync(path.join(roomDir, sec, 'FEYNMAN.md')) && fs.existsSync(path.join(roomDir, sec, 'BRAIN.md')));
    check('N7 nest BRIEF.md exists once rendered', fs.existsSync(path.join(roomDir, sec, 'BRIEF.md')));
  }

  // ---- N6 ---------------------------------------------------------------------------------------------------------
  {
    const r = spawnSync('git', ['diff', '--quiet', BASE_SHA, '--', 'agents/larry-extended.md', 'skills/larry-personality/SKILL.md'], { cwd: ROOT, encoding: 'utf8' });
    check('N6 agents/larry-extended.md and skills/larry-personality/SKILL.md are byte-identical to the phase base ' + BASE_SHA, r.status === 0, 'git diff --quiet exit ' + r.status + ' ' + String(r.stderr || '').slice(0, 120));
    const dirty = spawnSync('git', ['status', '--porcelain', '--', 'agents/larry-extended.md', 'skills/larry-personality/SKILL.md'], { cwd: ROOT, encoding: 'utf8' });
    check('N6 and the working tree copies carry no uncommitted edit', String(dirty.stdout || '').trim() === '', dirty.stdout);
  }

  // ---- N7 referrer counts -----------------------------------------------------------------------------------------
  Object.keys(PHASE0_REFERRERS).forEach((face) => {
    let files = [];
    try { files = execFileSync('grep', ['-rlIF', face + '.md', 'lib', 'scripts', 'hooks'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean); }
    catch (e) { files = String((e && e.stdout) || '').split('\n').filter(Boolean); }
    check('N7 ' + face + '.md referrers under lib, scripts, hooks: ' + files.length + ' (floor ' + PHASE0_REFERRERS[face] + ')', files.length >= PHASE0_REFERRERS[face]);
  });

  // ---- dash guard -------------------------------------------------------------------------------------------------
  const guarded = [__filename]
    .concat(DOCS.concat(MIRRORS).map((f) => path.join(ROOT, f)))
    .concat([path.join(ROOT, 'lib', 'core', 'doctor', 'icm-walk-module.cjs'), path.join(ROOT, 'lib', 'mcp', 'room-readiness-gate.cjs')]);
  const dashHits = H.dashGuard(guarded);
  check('dash guard: no em dash or en dash in the test, the edited docs and mirrors, the walk or the gate module', dashHits.length === 0, dashHits.join(','));
}

main().then(() => {
  restoreEnv();
  iso.cleanup();
  console.log('');
  console.log('PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => {
  restoreEnv();
  try { iso.cleanup(); } catch (_e) { /* best effort */ }
  console.log('FAIL: test crashed :: ' + String((e && e.stack) || e));
  process.exit(1);
});
