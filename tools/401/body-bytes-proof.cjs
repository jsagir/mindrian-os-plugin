#!/usr/bin/env node
'use strict';

// Phase 401 plan F1 (quick 261127-f1a), dev only (tools/ does not ship).
// Rule B: the body bytes of each surface file (the bytes after the line feed
// of the closing fence line) are equal at a base commit and on disk. The
// compare uses buffers and does not decode text. This file does not require
// scripts/check-frontmatter-split.cjs, so the proof does not share the fence
// code of the transforms it checks.
//
//   --base <sha> [--verbose]

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LF = 0x0a;
const DASH = 0x2d;

function isFenceAt(buf, i) {
  // A line that is exactly three dashes, starting at byte i.
  if (i + 3 > buf.length) return false;
  if (buf[i] !== DASH || buf[i + 1] !== DASH || buf[i + 2] !== DASH) return false;
  return i + 3 === buf.length || buf[i + 3] === LF;
}

// The bytes after the line feed of the closing fence line, or null when the
// buffer has no fence pair.
function bodyOf(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  if (!isFenceAt(buf, 0) || buf.length < 4) return null;
  let i = 4; // start of line 2
  while (i <= buf.length) {
    if (isFenceAt(buf, i)) {
      const end = i + 3;
      return end >= buf.length ? Buffer.alloc(0) : buf.subarray(end + 1);
    }
    const nl = buf.indexOf(LF, i);
    if (nl === -1) return null;
    i = nl + 1;
  }
  return null;
}

// readA and readB take a relative path and return a Buffer or null.
function compareBodies(readA, readB, rels) {
  const out = [];
  for (const rel of Array.from(new Set(rels)).sort()) {
    const a = readA(rel);
    const b = readB(rel);
    if (a && !b) { out.push({ rel, kind: 'missing' }); continue; }
    if (!a && b) { out.push({ rel, kind: 'new' }); continue; }
    if (!a && !b) continue;
    const ba = bodyOf(a) || a;
    const bb = bodyOf(b) || b;
    if (!ba.equals(bb)) out.push({ rel, kind: 'body-differs' });
  }
  return out;
}

const SURFACE_RE = /^(commands\/[^/]+\.md|skills\/[^/]+\/SKILL\.md|agents\/[^/]+\.md)$/;

function diskSurface(root) {
  const out = [];
  const add = (rel) => { if (SURFACE_RE.test(rel) && fs.existsSync(path.join(root, rel))) out.push(rel); };
  for (const d of ['commands', 'agents']) {
    const p = path.join(root, d);
    if (fs.existsSync(p)) for (const f of fs.readdirSync(p)) add(d + '/' + f);
  }
  const sk = path.join(root, 'skills');
  if (fs.existsSync(sk)) for (const d of fs.readdirSync(sk)) add('skills/' + d + '/SKILL.md');
  return out;
}

function baseSurface(root, sha) {
  const txt = cp.execFileSync('git', ['ls-tree', '-r', '--name-only', sha, '--', 'commands', 'skills', 'agents'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return txt.split('\n').filter((l) => SURFACE_RE.test(l));
}

function main(argv) {
  let sha = null;
  let verbose = false;
  let bad = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') sha = argv[++i];
    else if (argv[i] === '--verbose') verbose = true;
    else bad = true;
  }
  if (!sha || bad) {
    process.stderr.write('usage: node tools/401/body-bytes-proof.cjs --base <sha> [--verbose]\n');
    process.exit(2);
  }
  const baseRels = new Set(baseSurface(ROOT, sha));
  const diskRels = new Set(diskSurface(ROOT));
  const readA = (rel) => (baseRels.has(rel) ? cp.execFileSync('git', ['cat-file', 'blob', sha + ':' + rel], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }) : null);
  const readB = (rel) => (diskRels.has(rel) ? fs.readFileSync(path.join(ROOT, rel)) : null);
  const rels = Array.from(new Set([...baseRels, ...diskRels])).sort();
  const findings = compareBodies(readA, readB, rels);
  const differ = new Set(findings.map((f) => f.rel));
  for (const f of findings) {
    process.stdout.write((f.kind === 'body-differs' ? 'BODY DIFFERS ' : f.kind === 'missing' ? 'MISSING ' : 'NEW ') + f.rel + '\n');
  }
  if (verbose) for (const rel of rels) if (!differ.has(rel)) process.stdout.write('body-equal ' + rel + '\n');
  if (findings.length) {
    process.stdout.write('body-bytes: ' + findings.length + ' of ' + rels.length + ' files differ (base ' + sha + ')\n');
    process.exit(1);
  }
  process.stdout.write('body-bytes: OK (' + rels.length + ' files; 0 differ; base ' + sha + ')\n');
  process.exit(0);
}

module.exports = { bodyOf, compareBodies };

if (require.main === module) main(process.argv.slice(2));
