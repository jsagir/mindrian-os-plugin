#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 04 Task 2 (D-47, D-48; R-22, R-23, R-24; Codex C1 and C8). The one-next-move fixture.
 *
 * READ THIS FIRST. D-47 says the chat and the side panel say one next move in the same words. That holds by CODE only
 * once the panel's suggestion source is wired to the engine (a /gsd-quick or phase 369.7). Until then it holds by
 * MEASURED (OP5 against the captured engine result, plan 369.6-05). So this fixture is NOT evidence that Larry and
 * the panel already say one next move. Its legs say exactly what they check:
 *
 *   M1  engine           one fixture room state feeds nextMoveForSection (lib/core/feyminto/next-move.cjs), the local
 *                        function that suggest_next's next_move uses (resolveNextMove in lib/mcp/tools/sensors.cjs). A
 *                        section with a runnable primary returns a command and its sources; a section with none returns
 *                        no primary and the fixed NO_PRIMARY_LINE (the "engine has nothing" branch).
 *   M2  formatter        thinkPrompt of ui/mos-face/hooks/advice.ts, fed the engine's command and the framework the mod's
 *                        own data names for it, renders text that starts "Theo suggests" and names that command and that
 *                        framework. This is a FORMATTING test: the panel's sentence renders the engine's words. It does
 *                        not show that the panel selects them.
 *   M3  contract line    the agent body carries the one-next-move contract line, the sentence plan 369.6-09 writes into
 *                        "Operating invisibly": it holds both "same engine call" and "side panel".
 *                        (required, flipped by 369.6-09 Task 2)
 *   M4  selection        the panel's own cue-word pick for the fixture's user text (classify of advice.ts, then the first
 *                        command the mod's TERM_COMMANDS holds for that framework) is printed as MATCH or MISMATCH
 *                        against the engine's command. The label is "pending integration". M4 never fails. The panel's
 *                        command in production comes from Theo's answer, which a test cannot call (Canon Part 8, no
 *                        network), so M4 reports the cue-word path only until the R-23 wiring lands.
 *   M5  isolation        the room is born by bornScratchRoom in a child process; process.env equals its start value
 *                        afterwards; the room lies inside the scratch rooms root (Codex C1).
 *
 * FIXTURE CHOICE. The room is the release room seed (tests/fixtures/release-room), born by bornScratchRoom of
 * scripts/isolate-larry-voice.cjs (plan 369.6-02). The section is the first section, in name order, whose engine primary
 * has a teaching line in the mod's WHY table and a framework in the mod's TERM_COMMANDS table (commands.ts): both
 * tables are what thinkPrompt and situationOf read. The rule is data-driven so a change to either table cannot leave
 * the fixture silently empty (M1 fails when no section qualifies). At the plan 04 commit the rule picks business-model (engine
 * command /mos:lean-canvas, framework Lean Canvas); that section holds no seed claim, so its user text is the governing question
 * alone and the panel's cue-word pick falls back to the default framework, which is the honest M4 result today. The framework for the command is the reverse lookup
 * of TERM_COMMANDS in commands.ts. The fixture user text is the room's governing question plus the seed claims of the
 * chosen section; it is fixed text, written before the engine is asked, and is not tuned to the engine's answer.
 *
 * Isolation (Codex C1): the first lines create a scratch root and apply the isolation to this process before any other
 * repo module loads, so the in-process engine call resolves every home inside the scratch root. This file never reads,
 * lists, stats or snapshots the operator's rooms folder or rooms registry.
 *
 * Read-only toward the repo. No mod source or dist change (D-48). Tri-Polar: the mod is the CLI panel; on Desktop and
 * Cowork the observer mode is owned by 369.4 (R-22).
 *
 * KNOWN rule of this phase: a failing KNOWN leg prints "KNOWN <leg> closes in <plan>" and does not fail; a KNOWN leg
 * that passes FAILS until it is flipped to required by the task that satisfied it.
 *
 * Output: one PASS, FAIL or KNOWN line per leg, the M4 report line, then PASS: n FAIL: n. Exit 0 when no required leg fails.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ---- isolation first (Codex C1) -------------------------------------------------------------------------------
const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const iso = require(path.join(ROOT, 'scripts', 'isolate-larry-voice.cjs'));
const SCRATCH = iso.makeScratch('test-3696-onemove-');
iso.applyIsolationToProcess(SCRATCH);
const ENV_AT_START = JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; }));
function envNow() { return JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; })); }

process.on('exit', function () {
  try { fs.rmSync(SCRATCH.root, { recursive: true, force: true }); } catch (_e) { /* the scratch root is under the temp base */ }
});

const { pathToFileURL } = require('node:url');
const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-one-next-move');
const { importModModule } = require('./helpers/mod-ts-import-3696.cjs');

const AGENT = 'agents/larry-extended.md';
const KNOWN = {
};
function leg(id, name, passes, detail) {
  const k = KNOWN[id];
  const label = id + ' ' + name;
  if (!k) return check(label, passes, detail);
  if (passes) return check(label + ': KNOWN ' + id + ' now passes: flip it to required', false, k.why);
  console.log('KNOWN ' + id + ' closes in ' + k.closes_in + ': ' + name + ' (' + k.why + ')');
  return true;
}

async function main() {
  // ---- the fixture room, born in a child process ----------------------------------------------------------------
  let room = null;
  let birthError = '';
  try {
    room = iso.bornScratchRoom(SCRATCH);
  } catch (err) {
    birthError = err && err.message ? err.message : String(err);
  }
  check('M5 the fixture room is born by bornScratchRoom (child process, isolated environment)', room !== null, birthError);
  if (!room) { process.exit(summary()); }
  const insideScratch = room.roomDir === SCRATCH.rooms || room.roomDir.indexOf(SCRATCH.rooms + path.sep) === 0;
  check('M5 the room lies inside the scratch rooms root', insideScratch, room.roomDir);
  check('M5 process.env after the child birth equals process.env at the start of this test', envNow() === ENV_AT_START, '');

  // ---- engine and mod data -----------------------------------------------------------------------------------
  const nm = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const cm = await importModModule('ui/mos-face/hooks/commands.ts');
  const adv = await importModModule('ui/mos-face/hooks/advice.ts');

  const sections = fs.readdirSync(room.roomDir, { withFileTypes: true })
    .filter(function (d) { return d.isDirectory() && d.name.indexOf('.') !== 0; })
    .map(function (d) { return d.name; })
    .sort();
  function engineFor(section) {
    return nm.nextMoveForSection({ roomDir: room.roomDir, sectionDir: path.join(room.roomDir, section), surface: 'mcp' });
  }
  function frameworkOf(command) {
    const hit = Object.keys(cm.TERM_COMMANDS).map(function (k) { return cm.TERM_COMMANDS[k]; })
      .find(function (e) { return Array.isArray(e.commands) && e.commands.indexOf(command) !== -1; });
    return hit ? hit.framework : '';
  }

  let chosen = null;
  let none = null;
  sections.forEach(function (s) {
    const r = engineFor(s);
    if (!chosen && r && r.primary && typeof r.primary.command === 'string') {
      const slash = '/mos:' + r.primary.command;
      const fw = frameworkOf(slash);
      if (cm.WHY[slash] && fw) chosen = { section: s, result: r, slash: slash, framework: fw };
    }
    if (!none && r && !r.primary) none = { section: s, result: r };
  });
  console.log('fixture room: ' + room.slug + ', ' + sections.length + ' sections');
  console.log('fixture section: ' + (chosen ? chosen.section : 'none') + ', engine command ' + (chosen ? chosen.slash : 'none')
    + ', framework in the mod data: ' + (chosen ? chosen.framework : 'none'));

  // ---- M1 engine ----------------------------------------------------------------------------------------------
  check('M1 engine: a section of the fixture room returns a runnable primary that the mod can render', chosen !== null,
    'no section has a primary with a WHY line and a TERM_COMMANDS framework');
  if (chosen) {
    const p = chosen.result.primary;
    check('M1 engine: the primary carries a command and a non-empty sources list',
      typeof p.command === 'string' && p.command.length > 0 && Array.isArray(p.sources) && p.sources.length > 0, JSON.stringify(p).slice(0, 200));
    const again = engineFor(chosen.section);
    check('M1 engine: the same room state gives the same primary on a second call',
      again && again.primary && again.primary.command === p.command, '');
  }
  check('M1 engine: a section with no runnable primary returns no primary and the fixed NO_PRIMARY_LINE branch',
    none !== null && none.result.primary === null && typeof nm.NO_PRIMARY_LINE === 'string' && nm.NO_PRIMARY_LINE.length > 0,
    none ? '' : 'no such section in the fixture');

  // ---- M2 formatter -------------------------------------------------------------------------------------------
  if (chosen) {
    const text = adv.thinkPrompt({
      command: chosen.slash,
      framework: chosen.framework,
      whyLine: cm.WHY[chosen.slash] || '',
      room: room.slug,
      stage: 'fixture',
      stale: [],
      subject: '',
    });
    check('M2 formatter: thinkPrompt starts "Theo suggests"', typeof text === 'string' && text.indexOf('Theo suggests') === 0, String(text).slice(0, 80));
    check('M2 formatter: thinkPrompt names the engine command', text.indexOf(chosen.slash) !== -1, chosen.slash);
    check('M2 formatter: thinkPrompt names the framework the mod data holds for that command', text.indexOf(chosen.framework) !== -1, chosen.framework);
    console.log('M2 formatter label: this leg shows that the panel sentence renders the engine words; it does not show that the panel selects them');
  } else {
    check('M2 formatter: thinkPrompt renders the engine words', false, 'no fixture section to render');
  }

  // ---- M3 contract line ---------------------------------------------------------------------------------------
  const agent = fs.readFileSync(path.join(ROOT, AGENT), 'utf8');
  leg('M3', 'the agent body carries the one-next-move contract line ("same engine call" and "side panel")',
    agent.indexOf('same engine call') !== -1 && agent.indexOf('side panel') !== -1, '');

  // ---- M4 selection parity, pending integration (never fails) -------------------------------------------------
  if (chosen) {
    const roomText = fs.readFileSync(path.join(room.roomDir, 'ROOM.md'), 'utf8');
    const gq = /governing_question:\s*"?([^"\n]+)"?/.exec(roomText);
    let claims = [];
    try {
      const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'release-room', 'seed.json'), 'utf8'));
      claims = (seed.claims || []).filter(function (c) { return String(c.source || '').indexOf(chosen.section + '/') === 0; })
        .map(function (c) { return c.text; });
    } catch (_e) { claims = []; }
    const userText = [gq ? gq[1] : ''].concat(claims).join(' ').trim();
    const handle = adv.classify(userText, '');
    const entry = Object.keys(cm.TERM_COMMANDS).map(function (k) { return cm.TERM_COMMANDS[k]; })
      .find(function (e) { return e.framework === handle.framework; });
    const panelCommand = entry && entry.commands && entry.commands.length ? entry.commands[0] : null;
    const label = panelCommand !== null && panelCommand === chosen.slash ? 'MATCH' : 'MISMATCH';
    console.log('M4 selection parity (pending integration): ' + label);
    console.log('  engine command: ' + chosen.slash + '; panel cue-word pick: ' + (panelCommand || 'none')
      + ' (framework ' + handle.framework + ', cues ' + (handle.matched.length ? handle.matched.join('/') : 'none') + ')');
    console.log('  route: wiring the panel suggestion source to the engine, a /gsd-quick or 369.7 (R-23, D-47). Not a failure of this plan.');
  } else {
    console.log('M4 selection parity (pending integration): MISMATCH');
    console.log('  no fixture section; nothing to compare');
  }

  // ---- M5 static: the birth is isolated, the operator rooms folder is never named ----------------------------
  const self = fs.readFileSync(__filename, 'utf8');
  const roomsWord = ['Mindrian', 'Rooms'].join('');
  check('M5 this file names bornScratchRoom and never names the operator rooms folder',
    self.indexOf('bornScratchRoom') !== -1 && self.indexOf(roomsWord) === -1, '');
  const bad = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)].filter(function (c) { return self.indexOf(c) !== -1; });
  check('M6 no em dash or en dash in this file', bad.length === 0, bad.length ? 'found' : '');
  check('no network call was attempted', NET.attempts() === 0);
  process.exit(summary());
}

main().catch(function (err) {
  console.log('FAIL: test crashed (' + (err && err.stack ? err.stack : String(err)) + ')');
  process.exit(1);
});
