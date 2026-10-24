#!/usr/bin/env node
'use strict';

// Current rs-experts CLI safety contract: no remote calls, no guessed authors,
// and an absent local room is reported as unavailable rather than as no matches.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'rs-experts-command.cjs');
const CMD_MD = path.join(__dirname, '..', 'commands', 'rs-experts.md');

test('missing local database is explicitly distinguished from a complete empty result', () => {
  const emptyRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-experts-empty-room-'));
  try {
    const res = spawnSync(process.execPath, [SCRIPT, 'quantum biology', '--json'], {
      encoding: 'utf8', env: { ...process.env, MINDRIAN_ROOM: emptyRoom },
    });
    assert.equal(res.status, 1);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.reason, 'room_db_unavailable');
    assert.equal(parsed.local_only, true);
    assert.ok(!('authors' in parsed));
  } finally {
    fs.rmSync(emptyRoom, { recursive: true, force: true });
  }
});

test('help names the room-local search and its directory limitation', () => {
  const res = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /stored paper titles and abstracts/);
  assert.match(res.stdout, /not an external expert-directory search/);
});

test('Part 8 fence: no Brain client or external directory call in executable source', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const stripped = src.split('\n').filter((line) => {
    const t = line.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  }).join('\n');
  assert.doesNotMatch(stripped, /brainClient|brain-client|fetch\s*\(|https?:\/\//);
  const mdSrc = fs.readFileSync(CMD_MD, 'utf8');
  const fmMatch = mdSrc.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fmMatch);
  const allowedToolsMatch = fmMatch[1].match(/allowed-tools:\n((?:[ \t]+.*\n?)*)/);
  assert.ok(allowedToolsMatch);
  const executableTools = allowedToolsMatch[1].split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(executableTools, /mcp__mindrian[-_]brain__|read_neo4j_cypher/);
});
