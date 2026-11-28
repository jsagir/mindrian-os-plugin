#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a): rule F1, the frontmatter split rule.
//
// The host ends the frontmatter of a command, skill or agent file at the first
// triple dash after line 1, also when the triple dash is in the middle of a
// line. A comment line such as "# == Phase 122 frontmatter ==" written with
// triple dashes therefore ends the frontmatter early, and every key below it
// becomes body text. This module is the one owner of that rule:
//
//   --check                  list each offending line; exit 1 when one exists
//   --fix                    rewrite the comment lines of SOURCE files only
//                            (commands, agents, hand-kept skills); never a
//                            generated mirror (scripts/build-skill-mirrors.cjs
//                            regenerates those)
//   --census                 key counts per file, repo view and host view
//   --census-compare <file>  compare the census of the tree with a saved one
//   --root <dir>             optional; the default is the repository of this
//                            script, never the working directory
//
// Canon Part 8: local file reads only; no network.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const TRIPLE = '---';
const CENSUS_KEYS = ['hitl_shape', 'hitl_stages', 'allowed-tools', 'pending_tool_grants'];

function listSurfaceFiles(root) {
  const out = [];
  const cmdDir = path.join(root, 'commands');
  if (fs.existsSync(cmdDir)) {
    for (const f of fs.readdirSync(cmdDir)) {
      if (f.endsWith('.md') && fs.statSync(path.join(cmdDir, f)).isFile()) out.push({ rel: 'commands/' + f, cls: 'commands' });
    }
  }
  const skDir = path.join(root, 'skills');
  if (fs.existsSync(skDir)) {
    for (const d of fs.readdirSync(skDir)) {
      const p = path.join(skDir, d, 'SKILL.md');
      if (fs.existsSync(p) && fs.statSync(p).isFile()) out.push({ rel: 'skills/' + d + '/SKILL.md', cls: 'skills' });
    }
  }
  const agDir = path.join(root, 'agents');
  if (fs.existsSync(agDir)) {
    for (const f of fs.readdirSync(agDir)) {
      if (f.endsWith('.md') && fs.statSync(path.join(agDir, f)).isFile()) out.push({ rel: 'agents/' + f, cls: 'agents' });
    }
  }
  out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return out;
}

// The same rule as frontmatterBounds of scripts/build-skill-mirrors.cjs: line 1
// is exactly the fence, and the block runs to the next line that is exactly the
// fence. Returns { lines, fmEnd } (0-based index of the closing fence) or null.
function frontmatterBounds(text) {
  const lines = text.split('\n');
  if (lines[0] !== TRIPLE) return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === TRIPLE) return { lines, fmEnd: i };
  }
  return null;
}

function isColumnZeroComment(line) {
  return line.startsWith('#');
}

// Each line between the fences that holds a triple dash. `line` is 1-based.
function findOffenders(text) {
  const b = frontmatterBounds(text);
  if (!b) return [];
  const out = [];
  for (let i = 1; i < b.fmEnd; i++) {
    const l = b.lines[i];
    if (l.indexOf(TRIPLE) !== -1) out.push({ line: i + 1, text: l, fixable: isColumnZeroComment(l) });
  }
  return out;
}

// A column-0 comment line: each run of 3 or more hyphens becomes "==".
// Any other line is returned as it is.
function rewriteLine(line) {
  if (!isColumnZeroComment(line)) return line;
  return line.replace(/-{3,}/g, '==');
}

// Applies rewriteLine to the lines between the fences only. Body lines are
// never read for a rewrite.
function rewriteText(text) {
  const b = frontmatterBounds(text);
  if (!b) return { text, changed: false, unfixable: [] };
  const lines = b.lines.slice();
  const unfixable = [];
  let changed = false;
  for (let i = 1; i < b.fmEnd; i++) {
    const l = lines[i];
    if (l.indexOf(TRIPLE) === -1) continue;
    if (!isColumnZeroComment(l)) {
      unfixable.push({ line: i + 1, text: l });
      continue;
    }
    const r = rewriteLine(l);
    if (r !== l) {
      lines[i] = r;
      changed = true;
    }
  }
  return { text: changed ? lines.join('\n') : text, changed, unfixable };
}

// The host view: the text from the end of line 1 to the first later triple
// dash (also in the middle of a line). Null when line 1 is not the fence.
function hostFrontmatter(text) {
  const nl = text.indexOf('\n');
  if (nl === -1) return null;
  if (text.slice(0, nl) !== TRIPLE) return null;
  const start = nl + 1;
  const idx = text.indexOf(TRIPLE, start);
  if (idx === -1) return null;
  return text.slice(start, idx);
}

// The text between the fences (lines 2 to the line before the closing fence,
// each with its line feed). Null when the file has no fence pair.
function betweenFences(text) {
  const b = frontmatterBounds(text);
  if (!b) return null;
  return b.lines.slice(1, b.fmEnd).map((l) => l + '\n').join('');
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function countKeys(lines) {
  const out = {};
  for (const k of CENSUS_KEYS) out[k] = 0;
  for (const l of lines) {
    for (const k of CENSUS_KEYS) {
      if (l.startsWith(k + ':')) out[k] += 1;
    }
  }
  return out;
}

function census(text) {
  const b = frontmatterBounds(text);
  const lines = text.split('\n');
  let body = text;
  let fmLines = [];
  if (b) {
    fmLines = b.lines.slice(1, b.fmEnd);
    body = b.lines.slice(b.fmEnd + 1).join('\n');
  }
  const noncomment = fmLines.filter((l) => !isColumnZeroComment(l)).join('\n');
  const host = hostFrontmatter(text);
  const hostLines = host === null ? [] : host.split('\n');
  return {
    lines: lines.length,
    body_sha256: sha256(body),
    noncomment_sha256: sha256(noncomment),
    repo: countKeys(fmLines),
    host: countKeys(hostLines),
  };
}

function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function treeCensus(root) {
  const files = {};
  const totals = { repo: {}, host: {} };
  for (const k of CENSUS_KEYS) { totals.repo[k] = 0; totals.host[k] = 0; }
  for (const f of listSurfaceFiles(root)) {
    const c = census(readText(root, f.rel));
    files[f.rel] = c;
    for (const k of CENSUS_KEYS) { totals.repo[k] += c.repo[k]; totals.host[k] += c.host[k]; }
  }
  return { files, totals };
}

function compareCensus(before, after) {
  const v = [];
  for (const rel of Object.keys(before.files)) {
    if (!(rel in after.files)) v.push('MISSING ' + rel);
  }
  for (const rel of Object.keys(after.files)) {
    const a = after.files[rel];
    const b = before.files[rel];
    if (!b) { v.push('NEW ' + rel); continue; }
    if (a.lines !== b.lines) v.push('LINES ' + rel + ' ' + b.lines + ' -> ' + a.lines);
    if (a.body_sha256 !== b.body_sha256) v.push('BODY ' + rel);
    if (a.noncomment_sha256 !== b.noncomment_sha256) v.push('NONCOMMENT ' + rel);
    for (const k of CENSUS_KEYS) {
      if (a.repo[k] !== b.repo[k]) v.push('REPO ' + rel + ' ' + k + ' ' + b.repo[k] + ' -> ' + a.repo[k]);
      if (a.host[k] < b.host[k]) v.push('HOST-LOWER ' + rel + ' ' + k + ' ' + b.host[k] + ' -> ' + a.host[k]);
      if (a.host[k] !== a.repo[k]) v.push('HOST-NOT-REPO ' + rel + ' ' + k + ' host ' + a.host[k] + ' repo ' + a.repo[k]);
    }
  }
  return v;
}

// A source file is a file that no generator writes: a command, an agent, or a
// skill that has no command of the same name or whose name is in SKIP_LIST.
function isSourceFile(root, rel, skipList) {
  const m = rel.match(/^skills\/([^/]+)\/SKILL\.md$/);
  if (!m) return true;
  const name = m[1];
  if (skipList.includes(name)) return true;
  return !fs.existsSync(path.join(root, 'commands', name + '.md'));
}

function readSkipList() {
  // The mirror generator holds the list; it requires node:fs and node:path only.
  return require('./build-skill-mirrors.cjs').SKIP_LIST;
}

function usage() {
  process.stderr.write(
    'usage: node scripts/check-frontmatter-split.cjs (--check | --fix | --census | --census-compare <file>) [--root <dir>]\n'
  );
  process.exit(2);
}

function main(argv) {
  let root = DEFAULT_ROOT;
  let mode = null;
  let compareFile = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--root':
        root = path.resolve(argv[++i] || usage());
        break;
      case '--check':
      case '--fix':
      case '--census':
        mode = a;
        break;
      case '--census-compare':
        mode = a;
        compareFile = argv[++i];
        if (!compareFile) usage();
        break;
      default:
        usage();
    }
  }
  if (!mode) usage();

  if (mode === '--check') {
    const files = listSurfaceFiles(root);
    const per = { commands: [0, 0], skills: [0, 0], agents: [0, 0] };
    let offFiles = 0;
    let offLines = 0;
    for (const f of files) {
      per[f.cls][1] += 1;
      const off = findOffenders(readText(root, f.rel));
      if (off.length) {
        per[f.cls][0] += 1;
        offFiles += 1;
        offLines += off.length;
        for (const o of off) process.stdout.write(f.rel + ':' + o.line + ': ' + o.text + '\n');
      }
    }
    if (offFiles === 0) {
      process.stdout.write('frontmatter-split: OK (' + files.length + ' files)\n');
      process.exit(0);
    }
    process.stdout.write(
      'frontmatter-split: ' + offFiles + ' of ' + files.length + ' files offend (commands ' +
        per.commands[0] + ' of ' + per.commands[1] + ', skills ' + per.skills[0] + ' of ' + per.skills[1] +
        ', agents ' + per.agents[0] + ' of ' + per.agents[1] + '; ' + offLines + ' lines)\n'
    );
    process.exit(1);
  }

  if (mode === '--fix') {
    const skipList = readSkipList();
    let fixedFiles = 0;
    let fixedLines = 0;
    const unfixable = [];
    for (const f of listSurfaceFiles(root)) {
      if (!isSourceFile(root, f.rel, skipList)) continue;
      const text = readText(root, f.rel);
      const before = findOffenders(text).filter((o) => o.fixable).length;
      const r = rewriteText(text);
      for (const u of r.unfixable) unfixable.push(f.rel + ':' + u.line + ': ' + u.text);
      if (r.changed) {
        fs.writeFileSync(path.join(root, f.rel), r.text);
        fixedFiles += 1;
        fixedLines += before;
      }
    }
    process.stdout.write('fixed: ' + fixedFiles + ' files, ' + fixedLines + ' lines\n');
    for (const u of unfixable) process.stdout.write('UNFIXABLE ' + u + '\n');
    process.exit(unfixable.length ? 1 : 0);
  }

  if (mode === '--census') {
    // Set the exit code and return: process.exit() can cut a large write to a pipe.
    process.stdout.write(JSON.stringify(treeCensus(root), null, 2) + '\n');
    process.exitCode = 0;
    return;
  }

  if (mode === '--census-compare') {
    const before = JSON.parse(fs.readFileSync(path.resolve(compareFile), 'utf8'));
    const v = compareCensus(before, treeCensus(root));
    for (const line of v) process.stdout.write(line + '\n');
    if (v.length) {
      process.stdout.write('census-compare: ' + v.length + ' violations\n');
      process.exit(1);
    }
    process.stdout.write('census-compare: OK\n');
    process.exit(0);
  }
}

module.exports = {
  listSurfaceFiles,
  frontmatterBounds,
  findOffenders,
  rewriteLine,
  rewriteText,
  hostFrontmatter,
  betweenFences,
  census,
  treeCensus,
  compareCensus,
  isSourceFile,
};

if (require.main === module) main(process.argv.slice(2));
