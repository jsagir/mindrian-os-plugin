#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-41 (E-MODULATE): doc test for the audio disclosure line.
 * Owner decision 2026-11-06: scripts/transcribe-audio sends the whole audio
 * file to Modulate (Velma). Leave it, add no gate, document it.
 *
 * Arms:
 *   TD1  commands/file-meeting.md, section of the --audio heading
 *   TD2  commands/setup.md, step Explain What Velma Adds
 *   TD3  skills/file-meeting/SKILL.md and skills/setup/SKILL.md, same sections
 *   TD4  README.md, section Your room stays on your machine
 *   TD5  the phrase line appears exactly once in each of the 5 files, no dash
 *   TD6  scripts/transcribe-audio is unchanged, holds no gate, still calls curl
 *
 * No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

// Blob hash of scripts/transcribe-audio when plan 386-41 started (the owner
// chose no gate and no change). Re-pin only with a written reason if another
// phase changes the script on purpose.
const TRANSCRIBE_AUDIO_BLOB = '4c984e4b6e209cc4dac7ddc563e837697e259b25';

const PHRASE = /audio file leaves your machine/i;

let failed = 0;
function arm(label, fn) {
  try {
    fn();
    console.log('ok - ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL - ' + label + ': ' + (e && e.message ? e.message : String(e)));
  }
}
function need(cond, msg) {
  if (!cond) throw new Error(msg);
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Lines of the section that starts at the first heading matching headRe and
// ends before the next heading of the same or a higher level.
function section(text, headRe) {
  const lines = text.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && headRe.test(lines[i])) { start = i; level = m[1].length; break; }
  }
  need(start >= 0, 'heading not found: ' + headRe);
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out;
}
function phraseLine(lines, where, extra) {
  const hits = lines.filter(function (l) { return PHRASE.test(l); });
  need(hits.length >= 1, where + ': no line holds the phrase "audio file leaves your machine"');
  const line = hits[0];
  need(/Modulate/.test(line) || extra, where + ': the line does not name Modulate');
  if (extra) need(extra.test(line), where + ': the line lacks ' + extra);
  return line;
}

const FM_HEAD = /^###\s+`--audio/;
const SETUP_HEAD = /^###\s+1\.\s+Explain What Velma Adds/;
const README_HEAD = /^##\s+Your room stays on your machine/;

arm('TD1 commands/file-meeting.md --audio section', function () {
  const l = phraseLine(section(read('commands/file-meeting.md'), FM_HEAD), 'file-meeting');
  need(/Modulate/.test(l), 'no Modulate');
});

arm('TD2 commands/setup.md Velma step', function () {
  const l = phraseLine(section(read('commands/setup.md'), SETUP_HEAD), 'setup');
  need(/Modulate/.test(l), 'no Modulate');
});

arm('TD3 skill mirrors hold the phrase in the same sections', function () {
  const a = phraseLine(section(read('skills/file-meeting/SKILL.md'), FM_HEAD), 'skills/file-meeting');
  const b = phraseLine(section(read('skills/setup/SKILL.md'), SETUP_HEAD), 'skills/setup');
  need(/Modulate/.test(a) && /Modulate/.test(b), 'no Modulate in a mirror');
});

arm('TD4 README privacy section', function () {
  const l = phraseLine(section(read('README.md'), README_HEAD), 'README', /does not go to the Brain/);
  need(/Modulate/.test(l), 'no Modulate');
});

arm('TD5 phrase line appears once per file and holds no dash', function () {
  ['commands/file-meeting.md', 'commands/setup.md', 'skills/file-meeting/SKILL.md', 'skills/setup/SKILL.md', 'README.md']
    .forEach(function (rel) {
      const hits = read(rel).split('\n').filter(function (l) { return PHRASE.test(l); });
      need(hits.length === 1, rel + ': phrase line count is ' + hits.length);
      need(!/[–—]/.test(hits[0]), rel + ': the phrase line holds a dash character');
    });
});

arm('TD6 transcribe-audio unchanged, no gate, still calls curl', function () {
  const r = spawnSync('git', ['hash-object', path.join(ROOT, 'scripts', 'transcribe-audio')], { encoding: 'utf8' });
  need(r.status === 0, 'git hash-object failed');
  need(r.stdout.trim() === TRANSCRIBE_AUDIO_BLOB, 'blob hash changed: ' + r.stdout.trim());
  const t = read('scripts/transcribe-audio');
  need(!/approve/i.test(t), 'the script holds the word approve');
  need(/\bcurl\b/.test(t), 'the script no longer calls curl');
});

if (failed > 0) {
  console.log(failed + ' arm(s) failed');
  process.exit(1);
}
console.log('all arms passed');
