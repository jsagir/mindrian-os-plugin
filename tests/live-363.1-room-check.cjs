'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 07: opt-in LIVE verifier for the beta.51 bug cluster
 * (B51-01, B51-03, B51-04, B51-05, B51-06, B51-07).
 *
 * WHAT: replays the beta.51 test session against a COPY of a real room and
 * prints one PASS/FAIL line per requirement. Every earlier 363.1 plan proved
 * its fix on a hermetic fixture; this checks the fixes hold on real room.db
 * files (Windows paths, rs-engine CONTEXT rows, egress-label focus_area rows,
 * a birth-seeded FEYNMAN in every section).
 *
 * WHY it lives outside tests/test-363.1-*: the aggregator globs that prefix
 * and must never need the real rooms. This file is run by hand (or by a
 * verification plan) with explicit paths.
 *
 * SAFETY (T-363.1-25 / 26 / 27):
 *   - copy-only: --copy must live under /tmp/ and be disjoint from --original,
 *     and must hold .mindrian/room.db, or the process exits 2 before running
 *     anything.
 *   - the original's room.db, portfolio-report.json and STATE.md are sha256
 *     hashed before and after; any change is the failing check
 *     ORIGINAL-UNTOUCHED.
 *   - no network code, no --stamp (Canon Part 8: no room bytes leave the
 *     machine). The encoder is the local model cache.
 *   - no real room path is hard-coded; paths arrive as flags only.
 *
 * USAGE:
 *   node tests/live-363.1-room-check.cjs --copy <dir> --original <dir>
 *        [--label <name>] [--stage] [--race] [--allow-empty]
 *
 * EXIT: 0 all checks pass, 1 a check failed, 2 guard/usage refusal,
 *       77 ENV GAP (the encoder was unavailable, so the run degraded).
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { copy: null, original: null, label: 'room', stage: false, race: false, allowEmpty: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--copy': out.copy = argv[i += 1]; break;
      case '--original': out.original = argv[i += 1]; break;
      case '--label': out.label = argv[i += 1]; break;
      case '--stage': out.stage = true; break;
      case '--race': out.race = true; break;
      case '--allow-empty': out.allowEmpty = true; break;
      default:
        process.stderr.write('live-363.1: unknown argument ' + a + '\n');
        process.exit(2);
    }
  }
  return out;
}

function refuse(msg) {
  process.stderr.write('live-363.1 REFUSED: ' + msg + '\n');
  process.exit(2);
}

function sha256(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch (_e) { return null; }
}

function originalHashes(orig) {
  const files = [
    path.join(orig, '.mindrian', 'room.db'),
    path.join(orig, '.mindrian', 'eureka', 'portfolio-report.json'),
    path.join(orig, 'STATE.md'),
  ];
  const h = {};
  for (const f of files) if (fs.existsSync(f)) h[f] = sha256(f);
  return h;
}

const results = [];
function check(id, ok, detail) {
  results.push({ id, ok: !!ok, detail });
  process.stdout.write((ok ? 'PASS ' : 'FAIL ') + id + ': ' + detail + '\n');
}

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.copy || !opts.original) {
    refuse('both --copy and --original are required (copy-only verifier)');
  }
  const copy = path.resolve(opts.copy);
  const orig = path.resolve(opts.original);
  const under = (a, b) => a === b || a.startsWith(b + path.sep);
  if (!copy.startsWith('/tmp/')) refuse('--copy must live under /tmp/ (got ' + copy + ')');
  if (under(copy, orig) || under(orig, copy)) refuse('--copy and --original must be disjoint');
  if (!fs.existsSync(path.join(copy, '.mindrian', 'room.db'))) refuse('--copy holds no .mindrian/room.db');

  const before = originalHashes(orig);

  // The same predicates the fix uses, reused as the oracle.
  const scaffold = require(path.join(REPO, 'lib', 'core', 'scaffold-predicate.cjs'));
  const excl = require(path.join(REPO, 'lib', 'core', 'eureka', 'candidate-exclusion.cjs'));
  const shared = require(path.join(REPO, 'lib', 'core', 'folder-memory-shared.cjs'));
  const folderMemory = require(path.join(REPO, 'lib', 'core', 'folder-memory.cjs'));
  const statusline = require(path.join(REPO, 'lib', 'core', 'statusline-cache.cjs'));

  const digest = { label: opts.label };
  const scratchHome = fs.mkdtempSync(path.join(path.dirname(copy), 'rooms-home-'));

  // (1) compute-state (stage), copy only.
  if (opts.stage) {
    const r = spawnSync('bash', [path.join(REPO, 'scripts', 'compute-state'), copy], {
      encoding: 'utf8',
      timeout: 120000,
      env: Object.assign({}, process.env, { ROOMS_HOME: scratchHome, MINDRIAN_ROOMS_HOME: scratchHome }),
    });
    const m = /^venture_stage:\s*(.+)$/m.exec(r.stdout || '');
    digest.venture_stage = m ? m[1].trim() : null;
  }

  // (2) eureka run against the copy, then snapshot the live report.
  const run = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'eureka-command.cjs'), copy, 'run', '--no-extract'], {
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const eurDir = path.join(copy, '.mindrian', 'eureka');
  const repJson = path.join(eurDir, 'portfolio-report.json');
  const repMd = path.join(eurDir, 'portfolio-report.md');
  if (!fs.existsSync(repJson)) {
    process.stdout.write('FAIL EUREKA-RUN: no portfolio-report.json (rc ' + run.status + ') ' + String(run.stderr || '').split('\n').slice(0, 3).join(' | ') + '\n');
    process.exit(1);
  }
  const snapJson = path.join(eurDir, 'live-363.1-report.json');
  const snapMd = path.join(eurDir, 'live-363.1-report.md');
  fs.copyFileSync(repJson, snapJson);
  if (fs.existsSync(repMd)) fs.copyFileSync(repMd, snapMd);
  const report = readJson(snapJson);
  const prov = report.provenance || {};
  if (prov.degrade_cause || /reasoning/i.test(String(prov.run_mode || ''))) {
    process.stdout.write('ENV GAP: encoder unavailable (degrade_cause=' + prov.degrade_cause + ', run_mode=' + prov.run_mode + ')\n');
    process.exit(77);
  }

  const ranked = Array.isArray(report.ranked) ? report.ranked : [];
  const tail = report.tail || {};
  const statements = Array.isArray(report.statements) ? report.statements : [];

  // (3) checks against the snapshot.
  const badEndpoints = [];
  const kinds = { real: 0, structural: 0 };
  function endpointProblem(id, title) {
    const s = String(id || '');
    if (s.startsWith('memory_artifact:')) return 'memory_artifact';
    if (/(^|\/)(CONTEXT|MINTO|ROOM|STATE|USER|BRAIN)$/.test(s)) return 'scaffold_basename';
    if (/(^|\/)FEYNMAN$/.test(s) && scaffold.isScaffoldFile(path.join(copy, s + '.md'))) return 'seeded_feynman';
    const t = String(title || '').toLowerCase().trim();
    if (excl.EGRESS_CLASS_DOMAIN_LABELS.has(String(title || '')) || excl.EGRESS_CLASS_DOMAIN_LABELS.has(t)) return 'egress_label';
    if (excl.GENERIC_ENTITY_TOKENS.has(t)) return 'generic_entity';
    return null;
  }
  for (const row of ranked) {
    for (const side of ['a', 'b']) {
      const why = endpointProblem(row[side], row[side + '_title']);
      if (why) { badEndpoints.push(row.rank + side + ':' + row[side] + ' (' + why + ')'); kinds.structural += 1; } else kinds.real += 1;
    }
  }
  check('B51-01-ENDPOINTS', badEndpoints.length === 0,
    ranked.length + ' ranked rows, ' + kinds.real + ' real endpoints, ' + kinds.structural + ' structural'
      + (badEndpoints.length ? '; offenders: ' + badEndpoints.slice(0, 6).join(', ') : ''));
  check('B51-01-NONEMPTY', ranked.length > 0 || opts.allowEmpty,
    'ranked.length=' + ranked.length + (opts.allowEmpty ? ' (--allow-empty)' : ''));
  check('B51-01-COUNTED', Number(prov.structural_excluded) > 0,
    'structural_excluded=' + prov.structural_excluded + ' by_reason=' + JSON.stringify(prov.structural_excluded_by_reason || {}));

  const axes = prov.tail_axis_distinct || {};
  check('B51-03-AXES', Number(axes.attention) >= 2 && Number(axes.growth) >= 2,
    'tail_axis_distinct attention=' + axes.attention + ' growth=' + axes.growth);
  check('B51-03-LABEL', tail.growth_proxy === prov.growth_proxy && !!tail.growth_proxy,
    'tail.growth_proxy=' + tail.growth_proxy + ' provenance.growth_proxy=' + prov.growth_proxy);
  if (Number(prov.cohort_techs) >= 30) {
    check('B51-03-STRUCTURE', tail.insufficient_structure === false,
      'cohort_techs=' + prov.cohort_techs + ' tail.insufficient_structure=' + tail.insufficient_structure);
  } else {
    check('B51-03-STRUCTURE', true, 'cohort_techs=' + prov.cohort_techs + ' (< 30, not asserted)');
  }

  const proseBad = [];
  statements.forEach((s, i) => {
    const t = String((s && s.text) || '');
    if (/composite/i.test(t)) proseBad.push('stmt' + (i + 1) + ':composite');
    if (t.indexOf('.md') !== -1) proseBad.push('stmt' + (i + 1) + ':.md');
    if (t.indexOf('\\') !== -1) proseBad.push('stmt' + (i + 1) + ':backslash');
    if (/\bthe a\b/i.test(t)) proseBad.push('stmt' + (i + 1) + ':the-a');
  });
  let mdBad = false;
  if (fs.existsSync(snapMd) && /\(composite \d/.test(fs.readFileSync(snapMd, 'utf8'))) mdBad = true;
  check('B51-04-PROSE', proseBad.length === 0 && !mdBad,
    statements.length + ' statements' + (proseBad.length ? '; offenders: ' + proseBad.slice(0, 6).join(', ') : '') + (mdBad ? '; md carries "(composite N"' : ''));

  if (opts.stage) {
    const vs = digest.venture_stage;
    check('B51-05-STAGE', !!vs && vs !== 'Investment', 'venture_stage: ' + vs);
  }

  // B51-06: placeholder governing thoughts never classify as check.
  let placeholders = 0;
  const badHealth = [];
  let entries = [];
  try { entries = fs.readdirSync(copy, { withFileTypes: true }); } catch (_e) { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue;
    const dir = path.join(copy, ent.name);
    if (!fs.existsSync(path.join(dir, 'MINTO.md'))) continue;
    let triple;
    try { triple = folderMemory.readTriple(dir); } catch (_e) { continue; }
    const r = (triple && triple.reasoning) || {};
    if (shared.isPlaceholderGoverningThought(r.governing_thought)) {
      placeholders += 1;
      const g = statusline.classifyHealth(r.reasoning_health_score);
      if (g === 'check') badHealth.push(ent.name + '=' + r.reasoning_health_score);
    }
  }
  check('B51-06-HEALTH', badHealth.length === 0,
    placeholders + ' placeholder-governing-thought sections found' + (badHealth.length ? '; check-graded: ' + badHealth.join(', ') : ''));

  // Digest before the race scan overwrites the report files.
  digest.ranked_endpoint_kinds = kinds;
  digest.top5 = ranked.slice(0, 5).map((r) => (r.a_title || r.a) + ' <> ' + (r.b_title || r.b));
  digest.tail_axis_distinct = axes;
  digest.growth_proxy = prov.growth_proxy;
  digest.statement_1 = statements[0] ? String(statements[0].text || '') : null;
  digest.structural_excluded = prov.structural_excluded;
  digest.structural_excluded_by_reason = prov.structural_excluded_by_reason;
  digest.cohort_techs = prov.cohort_techs;
  digest.tail_insufficient_structure = tail.insufficient_structure;

  // (4) race check LAST (its scan overwrites the report files with a stub run).
  if (opts.race) {
    const eur = path.join(REPO, 'scripts', 'eureka-command.cjs');
    const st = spawnSync(process.execPath, [eur, copy, 'start', '--offline'], { encoding: 'utf8', timeout: 60000 });
    const s1 = spawnSync(process.execPath, [eur, copy, 'status'], { encoding: 'utf8', timeout: 60000 });
    let first = null;
    try { first = JSON.parse(String(s1.stdout).trim().split('\n').pop()); } catch (_e) { first = null; }
    const firstOk = st.status === 0 && first && first.state === 'running' && first.phase === 'starting';
    let final = first;
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      const sp = spawnSync(process.execPath, [eur, copy, 'status'], { encoding: 'utf8', timeout: 60000 });
      try { final = JSON.parse(String(sp.stdout).trim().split('\n').pop()); } catch (_e) { final = null; }
      if (final && (final.state === 'done' || final.state === 'failed')) break;
      spawnSync('sleep', ['1']);
    }
    const ended = final && (final.state === 'done' || final.state === 'failed');
    check('B51-07-RACE', firstOk && ended,
      'first status=' + JSON.stringify(first && { state: first.state, phase: first.phase }) + ' final=' + (final && final.state));
    digest.race_first_status = first && { state: first.state, phase: first.phase };
    digest.race_final_state = final && final.state;
  }

  // (5) the original must be byte-unchanged.
  const after = originalHashes(orig);
  const changed = Object.keys(Object.assign({}, before, after)).filter((k) => before[k] !== after[k]);
  check('ORIGINAL-UNTOUCHED', changed.length === 0,
    Object.keys(before).length + ' original files hashed' + (changed.length ? '; CHANGED: ' + changed.join(', ') : ''));

  try { fs.rmSync(scratchHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

  digest.checks = results.map((r) => r.id + '=' + (r.ok ? 'PASS' : 'FAIL'));
  process.stdout.write('DIGEST ' + JSON.stringify(digest) + '\n');
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main();
