#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd command-text: findings F2, F3, F12, F14, F16 and the 2
 * twins (pipelines/analogy/03-search.md line 58, references/meeting/
 * filing-protocol.md line 192).
 *
 * The Brain line rule (Canon Part 8: no room content to a Brain tool):
 *   CALL        = /^\s*(?:\d+\.\s+)?(?:Call|Run)\s+`(?:mcp__mindrian-brain__)?brain_[a-z_]+`(.*)$/
 *   BIND        = /^\s*-\s+`\$?[a-zA-Z_]+`\s*=\s*(.*)$/
 *   BRAIN_TOKEN = /`(?:mcp__mindrian-brain__)?brain_[a-z_]+`/
 *   ROOM        = a phrase that names room content (see ROOM below)
 * A CALL line is checked: the text after the tool token must not match ROOM.
 * A BIND line is checked only inside a Brain block: the nearest previous
 * line that is not a BIND line and not blank holds a BRAIN_TOKEN. Then the
 * value after `=` must not match ROOM. A checked line must not hold a ROOM
 * phrase at all, also not in a negation.
 *
 * Scanned files: every commands/*.md and every skills/<name>/SKILL.md.
 *
 * Tool names: a registered tool is one of the 6 names that
 * scripts/mindrian-brain-mcp-client.cjs registers (read at run time).
 *
 * Rule for this file: a case for a file that leaves the command set is
 * removed in the commit that removes the file.
 *
 * Reads files only. The B2 text goes to a temp folder that is removed.
 * Node built-in modules only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

const CALL = /^\s*(?:\d+\.\s+)?(?:Call|Run)\s+`(?:mcp__mindrian-brain__)?brain_[a-z_]+`(.*)$/;
const BIND = /^\s*-\s+`\$?[a-zA-Z_]+`\s*=\s*(.*)$/;
const BRAIN_TOKEN = /`(?:mcp__mindrian-brain__)?brain_[a-z_]+`/;
const ROOM = /(venture description|description from (?:the )?room|from (?:the )?room(?! state)\b|the user's (?:concept|venture|idea)|room content|room text|artifact (?:text|content)|transcript|abstract function description)/i;
const TOOL_TOKEN = /(?:mcp__mindrian-brain__)?brain_[a-z_]+/g;

function read(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }

function body(text) {
  const m = text.match(/^---\n[\s\S]*?\n---\n/);
  return m ? text.slice(m[0].length) : text;
}

function scanText(text) {
  const lines = text.split('\n');
  const hits = [];
  let checked = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const c = line.match(CALL);
    if (c) {
      checked += 1;
      if (ROOM.test(c[1])) hits.push(i + 1);
      continue;
    }
    const b = line.match(BIND);
    if (b) {
      let j = i - 1;
      while (j >= 0 && (lines[j].trim() === '' || BIND.test(lines[j]))) j -= 1;
      if (j >= 0 && BRAIN_TOKEN.test(lines[j])) {
        checked += 1;
        if (ROOM.test(b[1])) hits.push(i + 1);
      }
    }
  }
  return { hits, checked };
}

function scannedFiles() {
  const out = [];
  for (const f of fs.readdirSync(path.join(REPO, 'commands'))) {
    if (f.endsWith('.md')) out.push('commands/' + f);
  }
  for (const d of fs.readdirSync(path.join(REPO, 'skills'))) {
    const p = path.join('skills', d, 'SKILL.md');
    if (fs.existsSync(path.join(REPO, p))) out.push(p);
  }
  return out.sort();
}

let registeredCache = null;
function registered() {
  if (registeredCache) return registeredCache;
  const src = read('scripts/mindrian-brain-mcp-client.cjs');
  const names = new Set();
  const re = /registerTool\(\s*'([a-z_]+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) names.add(m[1]);
  registeredCache = names;
  return names;
}

function unknownTools(line) {
  const reg = registered();
  const out = [];
  const toks = line.match(TOOL_TOKEN) || [];
  for (const t of toks) {
    const name = t.replace(/^mcp__mindrian-brain__/, '');
    if (!reg.has(name)) out.push(name);
  }
  return out;
}

const OLD_LINES = [
  'Call `brain_search_semantic` via `mcp__mindrian-brain__brain_search` with:',
  '- `$search_text` = venture description from room',
  '',
  'Call `brain_concept_connect` with:',
  "- `$concept` = the user's concept or domain",
  '',
  '3. Run `brain_search_semantic` with the abstract function description as query text',
];

const NEW_LINES = [
  'Call `mcp__mindrian-brain__brain_search` with framework names and the problem type only (nothing that the room holds crosses to the Brain):',
  '- `query` = the framework names from step 2 and the problem type, in at most 12 words',
  '- `topK` = 10',
  '',
  'Call `brain_concept_connect` with:',
  '- `$concept` = a generic domain handle only: one to three plain words that name a field or a framework (for example `healthcare`), never a venture name, a room name or room wording; when no generic handle exists, ask the person and send nothing',
  '',
  '3. Call `mcp__mindrian-brain__brain_search` with a generic domain handle only as `query` (the TRIZ parameter names, or one to three plain keywords that name a field); when no generic handle exists, ask the person and send nothing',
];

const UPDATE_SHAPE = /confirmed in the field by [A-Z][a-z]+ [A-Z][a-z]+/;
const MIRRORS = ['compare-ventures', 'find-connections', 'find-analogies', 'whitespace', 'file-meeting', 'update'];

function linesHolding(rel, needle) {
  return read(rel).split('\n').filter(function (l) { return l.indexOf(needle) !== -1; });
}

const CASES = [
  ['B1', 'the Brain line rule gives 0 hits over every command and skill file', function () {
    const all = [];
    for (const f of scannedFiles()) {
      for (const n of scanText(read(f)).hits) all.push(f + ':' + n);
    }
    if (all.length) throw new Error(all.length + ' hit(s): ' + all.join(', '));
  }],
  ['B2', 'the scan is not blind and the rule works', function () {
    const files = scannedFiles();
    let checked = 0;
    for (const f of files) checked += scanText(read(f)).checked;
    if (files.length < 50) throw new Error('only ' + files.length + ' files');
    if (checked < 10) throw new Error('only ' + checked + ' checked lines');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-ct-'));
    try {
      const pOld = path.join(tmp, 'old.md');
      const pNew = path.join(tmp, 'new.md');
      const pOut = path.join(tmp, 'outside.md');
      fs.writeFileSync(pOld, OLD_LINES.join('\n'));
      fs.writeFileSync(pNew, NEW_LINES.join('\n'));
      fs.writeFileSync(pOut, 'Some prose line.\n- `$x` = venture description from room\n');
      const o = scanText(fs.readFileSync(pOld, 'utf8')).hits.length;
      const n = scanText(fs.readFileSync(pNew, 'utf8')).hits.length;
      const out = scanText(fs.readFileSync(pOut, 'utf8'));
      if (o !== 3) throw new Error('old lines gave ' + o + ' hits');
      if (n !== 0) throw new Error('new lines gave ' + n + ' hits');
      if (out.checked !== 0 || out.hits.length !== 0) throw new Error('a BIND line outside a Brain block was checked');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    if (unknownTools('2. **brain_search_semantic**: Vector search').length !== 1) throw new Error('bare name not seen');
    if (unknownTools('Call `mcp__mindrian-brain__brain_search` with x').length !== 0) throw new Error('registered name flagged');
  }],
  ['B3', 'every Brain tool name in the rewritten lines is a registered tool', function () {
    const reg = registered();
    if (reg.size !== 6) throw new Error('expected 6 registered tools, got ' + reg.size + ': ' + Array.from(reg).join(','));
    const problems = [];
    for (const n of ['compare-ventures', 'find-connections', 'find-analogies']) {
      for (const rel of ['commands/' + n + '.md', 'skills/' + n + '/SKILL.md']) {
        const toks = body(read(rel)).match(/mcp__mindrian-brain__[a-z0-9_]+/g) || [];
        for (const t of toks) {
          const name = t.replace(/^mcp__mindrian-brain__/, '');
          if (!reg.has(name)) problems.push(rel + ': ' + name);
        }
      }
    }
    const written = [
      ['commands/compare-ventures.md', 'framework names and the problem type only'],
      ['skills/compare-ventures/SKILL.md', 'framework names and the problem type only'],
      ['commands/find-analogies.md', 'generic domain handle only as'],
      ['skills/find-analogies/SKILL.md', 'generic domain handle only as'],
      ['pipelines/analogy/03-search.md', 'generic domain handle only as'],
    ];
    for (const [rel, needle] of written) {
      const ls = linesHolding(rel, needle);
      if (ls.length !== 1) { problems.push(rel + ': ' + ls.length + ' line(s) hold "' + needle + '"'); continue; }
      const toks = ls[0].match(TOOL_TOKEN) || [];
      if (toks.length < 1) problems.push(rel + ': no Brain tool token');
      for (const u of unknownTools(ls[0])) problems.push(rel + ': unknown ' + u);
    }
    if (problems.length) throw new Error(problems.join('; '));
  }],
  ['B4', 'compare-ventures sends framework names and the problem type with query and topK', function () {
    const b = body(read('commands/compare-ventures.md'));
    const lines = b.split('\n');
    const q = lines.filter(function (l) { return /^\s*-\s+`query`\s*=/.test(l); });
    if (q.length !== 1 || q[0].indexOf('framework names') === -1 || q[0].indexOf('problem type') === -1) throw new Error('query line: ' + JSON.stringify(q));
    if (lines.indexOf('- `topK` = 10') === -1) throw new Error('no topK line');
    for (const bad of ['$search_text', 'top_k', 'read_neo4j_cypher']) {
      if (b.indexOf(bad) !== -1) throw new Error('body holds ' + bad);
    }
  }],
  ['B5', 'find-connections takes no concept from the room', function () {
    const b = body(read('commands/find-connections.md'));
    if (/infer from room state/i.test(b)) throw new Error('holds infer from room state');
    const c = b.split('\n').filter(function (l) { return /^\s*-\s+`\$concept`\s*=/.test(l); });
    if (c.length !== 1 || c[0].indexOf('generic domain handle') === -1) throw new Error('concept line: ' + JSON.stringify(c));
    if (b.indexOf('ask the person') === -1) throw new Error('no ask the person');
  }],
  ['B6', 'find-analogies search line names the registered tool and a generic handle', function () {
    const lines = read('commands/find-analogies.md').split('\n');
    const c = lines.filter(function (l) { return /^3\. Call/.test(l); });
    const ok = c.some(function (l) {
      return l.indexOf('mcp__mindrian-brain__brain_search') !== -1 && l.indexOf('generic domain handle') !== -1 && l.indexOf('ask the person') !== -1;
    });
    if (!ok) throw new Error('no matching 3. Call line');
    if (lines.some(function (l) { return /^3\. Run/.test(l); })) throw new Error('a line starts with 3. Run');
  }],
  ['B7', 'the analogy pipeline search line names the registered tool and a generic handle', function () {
    const t = read('pipelines/analogy/03-search.md');
    const l = t.split('\n').filter(function (x) { return x.indexOf('Vector search') !== -1; });
    const ok = l.some(function (x) {
      return x.indexOf('**mcp__mindrian-brain__brain_search**') !== -1 && x.indexOf('generic domain handle') !== -1 && x.indexOf('ask the person') !== -1;
    });
    if (!ok) throw new Error('no matching Vector search line');
    if (t.indexOf('abstract function description as query text') !== -1) throw new Error('old text present');
  }],
  ['W1', 'whitespace states what Semantic Scholar receives', function () {
    const t = read('commands/whitespace.md');
    if (t.indexOf('No user-specific strings are ever sent') !== -1) throw new Error('old sentence present');
    for (const s of ['Semantic Scholar does receive words from this room', 'room folder name', 'approves']) {
      if (t.indexOf(s) === -1) throw new Error('missing: ' + s);
    }
  }],
  ['M1', 'file-meeting step 4 says the claims are already saved as proposed', function () {
    const lines = read('commands/file-meeting.md').split('\n');
    if (lines.some(function (l) { return l.indexOf('**4. Nothing files until the navigator confirms.**') === 0; })) throw new Error('old sentence present');
    const n = lines.filter(function (l) { return l.indexOf('**4. No artifact files until the navigator confirms; the claims are already saved as proposed.**') === 0; }).length;
    if (n !== 1) throw new Error(n + ' line(s) with the new sentence');
  }],
  ['M2', 'filing-protocol says the claims are already saved as proposed', function () {
    const t = read('references/meeting/filing-protocol.md');
    if (t.indexOf('Nothing files without the navigator confirming') !== -1) throw new Error('old sentence present');
    const n = t.split('\n').filter(function (l) {
      return l.indexOf('**No artifact files until the navigator confirms; the claims are already saved as proposed.**') !== -1 && l.indexOf('Every claim is born') !== -1;
    }).length;
    if (n !== 1) throw new Error(n + ' line(s) with the new sentence');
  }],
  ['U1', 'update holds no personal name', function () {
    for (const rel of ['commands/update.md', 'skills/update/SKILL.md']) {
      const t = read(rel);
      if (UPDATE_SHAPE.test(t)) throw new Error(rel + ': name shape present');
      if (t.indexOf('This was confirmed by a field report on 2026-04-26') === -1) throw new Error(rel + ': new sentence missing');
    }
  }],
  ['K1', 'the 6 mirrors exist and the mirror check passes', function () {
    for (const n of MIRRORS) {
      if (!fs.existsSync(path.join(REPO, 'skills', n, 'SKILL.md'))) throw new Error('missing mirror ' + n);
    }
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'build-skill-mirrors.cjs'), '--check'], { cwd: REPO, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('mirror check exit ' + r.status + ': ' + String(r.stdout || '').slice(-300));
  }],
];

let p = 0;
let f = 0;
const failures = [];
for (const [id, name, fn] of CASES) {
  try { fn(); p += 1; process.stdout.write('  ok   ' + id + ' ' + name + '\n'); }
  catch (err) { f += 1; failures.push(id + ': ' + (err && err.message ? err.message : String(err))); process.stdout.write('  FAIL ' + id + ' ' + name + '\n'); }
}
process.stdout.write('261127-bnd command-text: ' + p + ' passed, ' + f + ' failed\n');
for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
process.exit(f ? 1 : 0);
