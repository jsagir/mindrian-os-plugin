'use strict';

// Phase 358-07, Task 1 (RED). B2-04 legs: the reader, render and card legs
// for the room's governing-question record (R legs) and the Decision Gate
// card (C legs).
//
// NO em-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-render-home-'));
process.env.MINDRIAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-render-mhome-'));
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-358-b2-render-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.MINDRIAN_BRAIN_KEY;

const navigation = require('../lib/core/navigation.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');

let frameProvenance = null;
let frameProvenanceLoadError = null;
try {
  frameProvenance = require('../lib/core/frame-provenance.cjs');
} catch (e) {
  frameProvenanceLoadError = e;
}
function requireDoor() {
  if (!frameProvenance) {
    throw new Error(
      'lib/core/frame-provenance.cjs not landed yet: '
      + (frameProvenanceLoadError && frameProvenanceLoadError.message)
    );
  }
  return frameProvenance;
}

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    const detail = e && e.message ? e.message : String(e);
    failMessages.push(label + ' :: ' + detail);
    process.stdout.write('FAIL - ' + label + '\n');
    process.stdout.write('  ' + detail + '\n');
  }
}

function makeTempRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function withRoom(prefix, fn) {
  const dir = makeTempRoom(prefix);
  const db = navigation.openRoomDbForCaller(dir);
  try {
    return fn(db, dir);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

const Q1 = 'Which camera solves the delay?';
const Q2 = 'Which camera works with sunglasses?';
const Q3 = 'Should the checkpoint move north?';
const A2 = 'It assumed the delay was the camera, but the officers wear sunglasses.';

// ---------------------------------------------------------------------------
// R legs: readers and renders
// ---------------------------------------------------------------------------

check('R1: an empty room shows no governing question in both renders', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-render-r1-', (db, dir) => {
    const view = door.readGoverningQuestion(db, dir);
    assert.equal(view.current, null);
    assert.equal(view.pending, null);
    const lines = door.renderQuestionLines(view);
    assert.ok(lines.includes('No governing question recorded yet.'));

    const history = door.readQuestionHistory(db, dir);
    const hlines = door.renderHistoryLines(history);
    assert.ok(hlines.includes('No governing question recorded yet.'));
  });
});

check('R2: after the first question, renderQuestionLines shows version, origin, set time and first-question change', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-render-r2-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    const view = door.readGoverningQuestion(db, dir);
    const lines = door.renderQuestionLines(view);
    assert.ok(lines.includes('Governing question (version 1 of 1): ' + Q1));
    const label = navigation.frameOriginInfo('tasking').label;
    assert.ok(lines.includes('Origin: tasking - ' + label));
    assert.ok(lines.some((l) => l.startsWith('Set at: ')));
    assert.ok(lines.includes('Change: first question'));
  });
});

check('R3: a refused change puts the waiting-ask line first in both renders, before the current-question line', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-render-r3-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen' });

    const view = door.readGoverningQuestion(db, dir);
    const lines = door.renderQuestionLines(view);
    assert.equal(lines[0], 'A question change is waiting.');

    const history = door.readQuestionHistory(db, dir);
    const hlines = door.renderHistoryLines(history);
    assert.equal(hlines[0], 'A question change is waiting.');

    const idxProposed = lines.indexOf('Proposed question: ' + Q2);
    const idxAsk = lines.indexOf('What did the old question get wrong?');
    const idxGoverning = lines.findIndex((l) => l.startsWith('Governing question'));
    assert.ok(idxProposed >= 0 && idxProposed < idxGoverning);
    assert.ok(idxAsk >= 0 && idxAsk < idxGoverning);
    assert.ok(view.pending && view.pending.card, 'the waiting ask must carry its card into a later session');
  });
});

check('R4: history renders the header, per-version blocks, the refines account line, and (current) exactly once', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-render-r4-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });

    const history = door.readQuestionHistory(db, dir);
    const lines = door.renderHistoryLines(history);
    assert.ok(lines.includes('Question history (3 versions, oldest first)'));

    const v1Idx = lines.findIndex((l) => l.startsWith('Version 1 - origin tasking'));
    assert.ok(v1Idx >= 0);
    assert.equal(lines[v1Idx + 1], '  Question: ' + Q1);
    assert.equal(lines[v1Idx + 2], '  Change: first question');

    const v2Idx = lines.findIndex((l) => l.startsWith('Version 2 - origin chosen'));
    assert.ok(v2Idx >= 0);
    assert.equal(lines[v2Idx + 1], '  Question: ' + Q2);
    assert.equal(lines[v2Idx + 2], '  Change: refines version 1 (account on file)');
    assert.equal(lines[v2Idx + 3], '  What the old question got wrong: ' + A2);

    const v3Idx = lines.findIndex((l) => l.startsWith('Version 3 - origin prompt'));
    assert.ok(v3Idx >= 0);
    assert.ok(lines[v3Idx].endsWith(' (current)'));
    assert.equal(lines[v3Idx + 1], '  Question: ' + Q3);
    assert.equal(lines[v3Idx + 2], '  Change: relocates from version 2 (no account)');

    const currentCount = lines.filter((l) => l.endsWith(' (current)')).length;
    assert.equal(currentCount, 1);
  });
});

check('R5: renderQuestionLines for the current relocated version shows its change and the earlier-versions count', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-render-r5-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });

    const view = door.readGoverningQuestion(db, dir);
    const lines = door.renderQuestionLines(view);
    assert.ok(lines.includes('Change: relocates from version 2 (no account)'));
    assert.ok(lines.includes('Earlier versions: 2 (see the history)'));
  });
});

check('R6: no rendered line, in any state, or the card text, ever uses a ranking word or the forbidden phrases', () => {
  const door = requireDoor();
  const forbidden = /\b(better|improv\w*|upgrad\w*|abandon\w*|correct(ed|ion)|superseded|obsolete|outdated|replaced)\b/i;
  const wrongQuestion = /wrong question/i;
  const governingThought = /governing thought/i;

  withRoom('mindrian-358-b2-render-r6-', (db, dir) => {
    const collected = [];
    function collect() {
      const view = door.readGoverningQuestion(db, dir);
      collected.push(...door.renderQuestionLines(view));
      const history = door.readQuestionHistory(db, dir);
      collected.push(...door.renderHistoryLines(history));
      if (view.pending && view.pending.card) collected.push(view.pending.card.rendered_text);
    }
    collect();
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    collect();
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen' });
    collect();
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    collect();
    door.setGoverningQuestion(db, dir, { text: Q3, origin: 'prompt', relocate: true });
    collect();

    const card = door.renderQuestionChangeCard({ previous: { version: 1, text: Q1 }, proposed: { text: Q2 } });
    collected.push(card.rendered_text);

    for (const line of collected) {
      if (typeof line !== 'string') continue;
      assert.equal(forbidden.test(line), false, 'forbidden ranking/status word in: ' + line);
      assert.equal(wrongQuestion.test(line), false, '"wrong question" phrase in: ' + line);
      assert.equal(governingThought.test(line), false, '"governing thought" phrase in: ' + line);
    }
  });
});

check('R7: an out-of-band edit to an artifact file surfaces as Unresolved (changed and missing)', () => {
  const door = requireDoor();
  withRoom('mindrian-358-b2-render-r7-', (db, dir) => {
    door.setGoverningQuestion(db, dir, { text: Q1, origin: 'tasking' });
    door.setGoverningQuestion(db, dir, { text: Q2, origin: 'chosen', account: A2 });
    const versions = navigation.readGoverningQuestionVersions(db);
    const v1 = versions.find((v) => v.version === 1);
    const v2 = versions.find((v) => v.version === 2);

    fs.writeFileSync(path.join(dir, v1.question_handle), 'tampered text\n');
    let history = door.readQuestionHistory(db, dir);
    assert.ok(history.unresolved.some((u) => u.version === 1 && u.what === 'question' && u.reason === 'file_changed'));
    let lines = door.renderHistoryLines(history);
    assert.ok(lines.includes('Unresolved: the question file for version 1 changed outside the record.'));

    fs.unlinkSync(path.join(dir, v2.refinement_handle));
    history = door.readQuestionHistory(db, dir);
    assert.ok(history.unresolved.some((u) => u.version === 2 && u.what === 'account' && u.reason === 'file_missing'));
    lines = door.renderHistoryLines(history);
    assert.ok(lines.includes('Unresolved: the account file for version 2 is missing.'));
  });
});

check('R8: every origin id renders with its frameOriginInfo label', () => {
  const door = requireDoor();
  for (const o of navigation.FRAME_ORIGINS_ORDERED) {
    withRoom('mindrian-358-b2-render-r8-', (db, dir) => {
      door.setGoverningQuestion(db, dir, { text: Q1, origin: o.id });
      const view = door.readGoverningQuestion(db, dir);
      const lines = door.renderQuestionLines(view);
      assert.ok(lines.includes('Origin: ' + o.id + ' - ' + o.label), 'missing origin line for ' + o.id);
    });
  }
});

// ---------------------------------------------------------------------------
// C legs: the card
// ---------------------------------------------------------------------------

check('C1: renderQuestionChangeCard returns shape F.1, the right header/options, no box chars, no recommended marker', () => {
  const door = requireDoor();
  const card = door.renderQuestionChangeCard({ previous: { version: 1, text: Q1 }, proposed: { text: Q2 } });
  assert.equal(card.shape, 'F.1');
  const headerLine1 = card.header.split('\n')[0];
  assert.equal(headerLine1, 'What did the old question get wrong?');
  assert.ok(card.header.includes('Old question (version 1): ' + Q1));
  assert.ok(card.header.includes('New question: ' + Q2));
  assert.deepEqual(card.options.slice(0, 3), door.QUESTION_CARD_OPTIONS);
  assert.equal(card.options.length, 4, 'the renderer appends exactly one Free-Text row last');
  assert.equal(card.askuserquestion_marker, '[AskUserQuestion contract: shape=F.1 verbs=4]');
  assert.equal(/[─-╿]/.test(card.rendered_text), false, 'no box-drawing characters');
  assert.equal(card.rendered_text.includes('Brain unreachable'), false);
  assert.equal(card.rendered_text.includes('▶'), false, 'no recommended-option marker');
});

check('C2: the render-coverage registry carries the frame-provenance card-emission entry; both checks pass', () => {
  requireDoor();
  delete require.cache[require.resolve('../data/render-coverage-registry.json')];
  const registry = require('../data/render-coverage-registry.json');
  const entry = registry.entries.find((e) => e.entry === 'lib/core/frame-provenance.cjs' && e.kind === 'pickShape');
  assert.ok(entry, 'missing the lib/core/frame-provenance.cjs pickShape entry in the registry');
  assert.equal(entry.render_coverage, 'card-emission');

  const { execFileSync } = require('node:child_process');
  const repoRoot = path.join(__dirname, '..');
  execFileSync('node', ['scripts/check-render-coverage.cjs', '--check'], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('node', ['scripts/build-render-coverage.cjs', '--check'], { cwd: repoRoot, stdio: 'pipe' });
});

process.stdout.write('passed=' + passed + ' failed=' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
