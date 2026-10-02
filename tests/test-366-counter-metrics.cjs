#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 16 Task 2 (Claude's Discretion, design section 8, Phase 343 shape):
 * every stage declares its counter-metric pair once, in the perspective registry.
 *
 *   Q1  COUNTER_METRICS is frozen and has one entry per stage (substrate, recall,
 *       recall_exclusion, judge, research, filing, whole_run), each with the keys
 *       stage, optimizes and watched_by; watched_by may be null, an absent key fails
 *   Q2  no entry's text uses a word from the graph-integrity banned list (read from
 *       graph-integrity-counts.cjs, not restated) and none carries an em or en dash
 *   Q3  the declaration lives once: only perspectives/index.cjs declares it, the
 *       entries are frozen too, and the doctrine's absent-key rule is real
 *       (a copy with a key removed fails the same check)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cm-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cm-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
const C = hygiene.makeChecker('test-366-counter-metrics');

const registry = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/index.cjs'));
const PERSP_DIR = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');

const STAGES = ['substrate', 'recall', 'recall_exclusion', 'judge', 'research', 'filing', 'whole_run'];

function shapeErrors(list) {
  const errs = [];
  if (!Array.isArray(list)) return ['not an array'];
  STAGES.forEach(function (s) {
    const hits = list.filter(function (e) { return e && e.stage === s; });
    if (hits.length !== 1) { errs.push(s + ': ' + hits.length + ' entries'); return; }
    const e = hits[0];
    ['stage', 'optimizes', 'watched_by'].forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(e, k)) errs.push(s + ': missing key ' + k);
    });
    if (typeof e.optimizes !== 'string' || e.optimizes.trim().length === 0) errs.push(s + ': optimizes must be a non-empty string');
    if (!(e.watched_by === null || (typeof e.watched_by === 'string' && e.watched_by.trim().length > 0))) errs.push(s + ': watched_by must be a string or null');
  });
  if (list.length !== STAGES.length) errs.push('expected ' + STAGES.length + ' entries, got ' + list.length);
  return errs;
}

// Q1
const cm = registry.COUNTER_METRICS;
C.check('Q1 COUNTER_METRICS is exported and frozen', Array.isArray(cm) && Object.isFrozen(cm));
const errs = shapeErrors(cm);
C.check('Q1 one entry per stage with stage, optimizes and watched_by', errs.length === 0, errs.join(' | '));

// Q2: the banned list is read from the one place it lives.
const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/navigation/graph-integrity-counts.cjs'), 'utf8');
const m = src.match(/Banned-adjective list[\s\S]*?:\s*([\s\S]*?)\.\s*This is why/);
const banned = m ? m[1].replace(/\s*\*\s*/g, ' ').split(',').map(function (w) { return w.trim(); }).filter(Boolean) : [];
C.check('Q2 the banned list was read from graph-integrity-counts.cjs', banned.length >= 10 && banned.indexOf('healthy') !== -1, JSON.stringify(banned));
const bannedRe = new RegExp('\\b(' + banned.join('|') + ')\\b', 'i');
const dashRe = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const texts = [];
(Array.isArray(cm) ? cm : []).forEach(function (e) {
  ['stage', 'optimizes', 'watched_by'].forEach(function (k) { if (typeof e[k] === 'string') texts.push(e.stage + '.' + k + ': ' + e[k]); });
});
const bannedHits = texts.filter(function (t) { return bannedRe.test(t); });
C.check('Q2 no entry uses a banned health word', texts.length > 0 && bannedHits.length === 0, bannedHits.join(' | '));
C.check('Q2 no entry carries an em or en dash', texts.length > 0 && !texts.some(function (t) { return dashRe.test(t); }));

// Q3
const owners = fs.readdirSync(PERSP_DIR).filter(function (f) { return f.endsWith('.cjs') && /COUNTER_METRICS\s*=/.test(fs.readFileSync(path.join(PERSP_DIR, f), 'utf8')); });
C.check('Q3 only perspectives/index.cjs declares COUNTER_METRICS', owners.length === 1 && owners[0] === 'index.cjs', JSON.stringify(owners));
C.check('Q3 every entry is frozen', Array.isArray(cm) && cm.every(function (e) { return Object.isFrozen(e); }));
const broken = (Array.isArray(cm) ? cm : []).map(function (e) { const c = Object.assign({}, e); if (e.stage === 'filing') delete c.watched_by; return c; });
C.check('Q3 an absent watched_by key fails the shape check (null would pass)', shapeErrors(broken).length > 0);
const nulled = (Array.isArray(cm) ? cm : []).map(function (e) { const c = Object.assign({}, e); if (e.stage === 'substrate') c.watched_by = null; return c; });
C.check('Q3 an explicit null watched_by passes the shape check', shapeErrors(nulled).length === 0, shapeErrors(nulled).join(' | '));

const code = C.summary();
for (const d of [TMP_HOME, process.env.MINDRIAN_ROOMS_HOME]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* tmp */ } }
process.exit(code);
