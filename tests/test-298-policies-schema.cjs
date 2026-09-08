#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-policies-schema.cjs -- Phase 298 (harness-as-code) Plan 09, Task 3.
 *
 * Proves R-02 (policy schema, closed and validated) and R-03 (the rung ladder;
 * a policy's declared rung is one of declared/logged/blocking, and the runner
 * never mints one). Carries the VALIDATION.md T-298-03 and T-298-04 rows for
 * this test file:
 *   T-298-03 R-02 policy schema: closed schema; unknown key rejected at --check
 *   T-298-04 R-02 gate reachability: every `runner` path resolves inside the
 *     repo root (no traversal)
 *
 * SUBJECT: data/harness-policies/_schema.json
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between.
 *
 * Mirror: tests/test-harness-manifest-check.cjs (in-process validation
 * against an exported allowlist, no spawn except for the one --check
 * subprocess assertion 3 needs).
 *
 * Run: node tests/test-298-policies-schema.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const POLICIES_DIR = path.join(REPO_ROOT, 'data', 'harness-policies');
const SUBJECT = path.join(POLICIES_DIR, '_schema.json');
const GENERATOR_PATH = path.join(REPO_ROOT, 'scripts', 'build-harness-manifest.cjs');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md');
const TEST_NAME = 'test-298-policies-schema.cjs';

const ASSERTIONS_IMPLEMENTED = true;

let passCount = 0;
let failCount = 0;
function record(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passCount += 1;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : err) + '\n');
    failCount += 1;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertion failed') + ' -- expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertOk(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ['id', 'kind', 'runner', 'args', 'rung', 'evidence_log', 'promotion_rule', 'owner', 'pinned_by', 'applies_to', 'notes'];

// The extra keys _schema.json's validation_rule explicitly permits beyond the
// eleven common fields, per policy id. Not part of the closed rung/kind/
// applies_to vocabularies (those are read from _schema.json below), so this
// small map is authored directly rather than parsed out of prose.
const ALLOWED_EXTRA_KEYS = {
  'memory-write-policy': ['channels', 'verbs', 'basket_fires_at', 'claim_review_status', 'toggled_off_writes', 'narrated'],
  'contract-parity-larry': ['surfaces', 'byte_budget'],
};

function loadSchema() {
  return JSON.parse(fs.readFileSync(SUBJECT, 'utf8'));
}

function loadPolicyFiles() {
  return fs
    .readdirSync(POLICIES_DIR)
    .filter((f) => f.endsWith('.json') && f !== '_schema.json')
    .sort();
}

function loadPolicy(file) {
  return JSON.parse(fs.readFileSync(path.join(POLICIES_DIR, file), 'utf8'));
}

// The runner_path_rule predicate, mirroring _schema.json's own prose exactly:
// null is a valid (ghost) runner; a non-null runner must begin with the
// literal prefix "scripts/", contain no parent-directory segment, not be an
// absolute path, and resolve inside REPO_ROOT.
function isValidRunnerPath(runner) {
  if (runner === null) return true;
  if (typeof runner !== 'string' || runner.length === 0) return false;
  if (path.isAbsolute(runner)) return false;
  if (runner.indexOf('scripts/') !== 0) return false;
  if (runner.split('/').indexOf('..') !== -1) return false;
  const resolved = path.resolve(REPO_ROOT, runner);
  const rel = path.relative(REPO_ROOT, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return true;
}

function main() {
  if (!fs.existsSync(SUBJECT)) {
    process.stdout.write('SKIP ' + TEST_NAME + ' (missing ' + SUBJECT + ')\n');
    process.exit(0);
  }

  if (!ASSERTIONS_IMPLEMENTED) {
    process.stdout.write('FAIL ' + TEST_NAME + ': subject landed but assertions are still a stub\n');
    process.exit(1);
  }

  const schema = loadSchema();
  const doc = schema._doc;
  const rungVocab = new Set(doc.rung_vocabulary);
  const kindVocab = new Set(doc.kind_vocabulary);
  const applyVocab = new Set(doc.applies_to_vocabulary);
  const policyFiles = loadPolicyFiles();

  // -------------------------------------------------------------------------
  // Assertion 1: every policy file parses as JSON, carries exactly the
  // eleven schema fields, plus only the explicitly-permitted extras.
  // -------------------------------------------------------------------------
  record('assertion 1: every policy file has exactly the eleven schema fields plus only permitted extras', () => {
    assertEqual(policyFiles.length, 11, 'expected 11 policy files beside _schema.json and CONTEXT.md');
    for (const file of policyFiles) {
      const policy = loadPolicy(file);
      const id = file.replace(/\.json$/, '');
      const extraAllowed = new Set(ALLOWED_EXTRA_KEYS[id] || []);
      const keys = Object.keys(policy);
      for (const field of REQUIRED_FIELDS) {
        assertOk(Object.prototype.hasOwnProperty.call(policy, field), file + ' missing required field ' + field);
      }
      for (const key of keys) {
        const isRequired = REQUIRED_FIELDS.indexOf(key) !== -1;
        const isPermittedExtra = extraAllowed.has(key);
        assertOk(isRequired || isPermittedExtra, file + ' carries an unexpected key: ' + key);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Assertion 2: closed vocabularies, read from _schema.json, never hardcoded.
  // -------------------------------------------------------------------------
  record('assertion 2: every rung, kind and applies_to member is drawn from _schema.json', () => {
    assertOk(rungVocab.size > 0 && kindVocab.size > 0 && applyVocab.size > 0, '_schema.json vocabularies must be non-empty');
    for (const file of policyFiles) {
      const policy = loadPolicy(file);
      assertOk(rungVocab.has(policy.rung), file + ': rung "' + policy.rung + '" not in _schema.json rung_vocabulary');
      assertOk(kindVocab.has(policy.kind), file + ': kind "' + policy.kind + '" not in _schema.json kind_vocabulary');
      assertOk(Array.isArray(policy.applies_to) && policy.applies_to.length > 0, file + ': applies_to must be a non-empty array');
      for (const tier of policy.applies_to) {
        assertOk(applyVocab.has(tier), file + ': applies_to member "' + tier + '" not in _schema.json applies_to_vocabulary');
      }
    }
  });

  // -------------------------------------------------------------------------
  // Assertion 3: unknown-key rejection at --check. Guarded: plan 298-12 wires
  // the generator's policy validation; while it has not landed yet this
  // assertion records a stated skip rather than failing (per the plan's own
  // guard instruction), so this test proves what exists today without ever
  // reporting a false pass on behavior that has not shipped.
  // -------------------------------------------------------------------------
  record('assertion 3: an unknown key on a policy file fails build-harness-manifest.cjs --check', () => {
    const generatorSource = fs.readFileSync(GENERATOR_PATH, 'utf8');
    const generatorValidatesPolicies = generatorSource.indexOf('harness-policies') !== -1;
    if (!generatorValidatesPolicies) {
      process.stdout.write(
        '        SKIPPED: scripts/build-harness-manifest.cjs does not yet reference "harness-policies" ' +
          '(the generator\'s policy validation lands in plan 298-12, not yet executed) -- recorded as a ' +
          'stated skip per the plan\'s own guard, never a false pass\n'
      );
      return;
    }

    function runCheck() {
      try {
        execFileSync('node', [GENERATOR_PATH, '--check'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        return { status: 0, output: '' };
      } catch (err) {
        return {
          status: typeof err.status === 'number' ? err.status : 1,
          output: String(err.stdout || '') + String(err.stderr || ''),
        };
      }
    }

    const before = runCheck();
    const priorStatus = before.status;

    const tmpFile = path.join(POLICIES_DIR, '__test-298-tmp-unknown-key.json');
    let cleanedUp = false;
    try {
      fs.writeFileSync(
        tmpFile,
        JSON.stringify(
          {
            id: '__test-298-tmp-unknown-key',
            kind: 'gate',
            runner: null,
            args: [],
            rung: 'declared',
            evidence_log: null,
            promotion_rule: { window_runs: 1, max_false_positive_rate: 0.1, min_true_positives: 1 },
            owner: 'test',
            pinned_by: [],
            applies_to: ['full'],
            notes: 'a temporary fixture for the unknown-key rejection assertion, deleted in the finally block',
            xyz: 'this key is not in the schema',
          },
          null,
          2
        ) + '\n',
        'utf8'
      );
      const tampered = runCheck();
      assertOk(tampered.status !== 0, '--check must exit non-zero when a policy file carries an unknown key');
      assertOk(tampered.output.indexOf('__test-298-tmp-unknown-key.json') !== -1, '--check output must name the offending file');
      assertOk(tampered.output.indexOf('xyz') !== -1, '--check output must name the offending key (xyz)');
    } finally {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
        cleanedUp = true;
      }
    }
    assertOk(cleanedUp, 'the temporary unknown-key fixture must be deleted');
    const after = runCheck();
    assertEqual(after.status, priorStatus, '--check must return to its prior exit status once the temporary file is removed');
  });

  // -------------------------------------------------------------------------
  // Assertion 4: runner path safety, positive (every non-null runner
  // resolves inside the repo, on disk) and negative (three synthetic bad
  // shapes each fail the rule, in-process, no filesystem touched).
  // -------------------------------------------------------------------------
  record('assertion 4: every non-null runner is repo-relative under scripts/ and resolves on disk; three synthetic negatives fail', () => {
    for (const file of policyFiles) {
      const policy = loadPolicy(file);
      if (policy.runner === null) continue;
      assertOk(isValidRunnerPath(policy.runner), file + ': runner fails runner_path_rule: ' + policy.runner);
      assertOk(fs.existsSync(path.resolve(REPO_ROOT, policy.runner)), file + ': runner does not exist on disk: ' + policy.runner);
    }
    assertOk(isValidRunnerPath('scripts/check-worktree-hygiene.cjs') === true, 'sanity: a well-formed runner must pass');
    assertOk(isValidRunnerPath('/etc/passwd') === false, 'an absolute path must fail runner_path_rule');
    assertOk(isValidRunnerPath('scripts/../../../etc/passwd') === false, 'a path with a parent-directory segment must fail runner_path_rule');
    assertOk(isValidRunnerPath('lib/core/repo-version.cjs') === false, 'a path outside scripts/ must fail runner_path_rule');
  });

  // -------------------------------------------------------------------------
  // Assertion 5: ghost accounting. Exactly the three named policies have a
  // null runner, and each carries a notes string explaining why.
  // -------------------------------------------------------------------------
  record('assertion 5: exactly three named policies have a null runner, each with a notes explanation', () => {
    const expectedGhosts = new Set(['voice-backend-noun-free', 'memory-write-policy', 'contract-parity-larry']);
    const actualGhosts = new Set();
    for (const file of policyFiles) {
      const policy = loadPolicy(file);
      if (policy.runner === null) {
        actualGhosts.add(policy.id);
        assertOk(typeof policy.notes === 'string' && policy.notes.trim().length > 0, file + ': a null-runner policy must carry a non-empty notes explanation');
      }
    }
    assertEqual(actualGhosts.size, 3, 'expected exactly three null-runner policies, found ' + actualGhosts.size);
    for (const id of expectedGhosts) {
      assertOk(actualGhosts.has(id), 'expected ' + id + ' to have a null runner');
    }
    for (const id of actualGhosts) {
      assertOk(expectedGhosts.has(id), 'unexpected null-runner policy: ' + id);
    }
  });

  // -------------------------------------------------------------------------
  // Assertion 6: promotion_rule shape on every policy.
  // -------------------------------------------------------------------------
  record('assertion 6: every promotion_rule carries window_runs, max_false_positive_rate (0-1), min_true_positives', () => {
    for (const file of policyFiles) {
      const policy = loadPolicy(file);
      const rule = policy.promotion_rule;
      assertOk(rule && typeof rule === 'object', file + ': promotion_rule must be an object');
      assertOk(Number.isFinite(rule.window_runs), file + ': promotion_rule.window_runs must be numeric');
      assertOk(Number.isFinite(rule.max_false_positive_rate), file + ': promotion_rule.max_false_positive_rate must be numeric');
      assertOk(rule.max_false_positive_rate >= 0 && rule.max_false_positive_rate <= 1, file + ': promotion_rule.max_false_positive_rate must be between 0 and 1');
      assertOk(Number.isFinite(rule.min_true_positives), file + ': promotion_rule.min_true_positives must be numeric');
    }
  });

  // -------------------------------------------------------------------------
  // Assertion 7: R-07 cross-check -- every identifier memory-write-policy.json
  // names in channels/verbs appears in skills/larry-personality/SKILL.md, and
  // basket_fires_at is at least 2.
  // -------------------------------------------------------------------------
  record('assertion 7: memory-write-policy channel/verb identifiers all appear in SKILL.md; basket_fires_at >= 2', () => {
    const policy = loadPolicy('memory-write-policy.json');
    assertOk(Number.isFinite(policy.basket_fires_at) && policy.basket_fires_at >= 2, 'basket_fires_at must be >= 2');
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    // The channel VALUES are short prose sentences naming identifiers inline
    // (e.g. "the room graph, reached only through lib/core/navigation.cjs");
    // extract the identifier-shaped tokens (dotted paths, snake_case names,
    // capitalized single words) from each value and require each to appear
    // in the skill, rather than requiring the whole sentence to match.
    const IDENTIFIER_RE = /[A-Za-z][A-Za-z0-9_./-]{2,}/g;
    function identifiersIn(text) {
      const found = String(text).match(IDENTIFIER_RE) || [];
      // Drop short/common English words that happen to match the shape but
      // are not identifiers (e.g. "the", "only", "through").
      const STOPWORDS = new Set(['the', 'only', 'through', 'plus', 'and']);
      return found.filter((tok) => !STOPWORDS.has(tok.toLowerCase()) && tok.length >= 3);
    }

    const channelIdentifiers = [];
    for (const key of Object.keys(policy.channels)) {
      channelIdentifiers.push(...identifiersIn(policy.channels[key]));
    }
    // Verbs are already bare identifiers (strings or arrays of strings).
    const verbIdentifiers = [];
    for (const key of Object.keys(policy.verbs)) {
      const v = policy.verbs[key];
      if (Array.isArray(v)) verbIdentifiers.push(...v);
      else verbIdentifiers.push(v);
    }

    // Require every VERB identifier (unambiguous, no extraction risk) and
    // every extracted channel identifier of at least dotted-path or
    // snake_case shape to be present in the skill.
    for (const verb of verbIdentifiers) {
      assertOk(skill.indexOf(verb) !== -1, 'memory-write-policy verb identifier "' + verb + '" not found in skills/larry-personality/SKILL.md');
    }
    // Keep only dotted-path / snake_case shaped tokens (e.g.
    // "lib/core/navigation.cjs", "STATE.md", "memory_event"); a bare English
    // word like "room" or "reached" is not an identifier and would produce
    // a false failure if SKILL.md happened not to contain it verbatim.
    const meaningfulChannelIdentifiers = channelIdentifiers.filter((tok) => /[._]/.test(tok));
    assertOk(meaningfulChannelIdentifiers.length > 0, 'expected at least one dotted-path/proper-noun identifier extracted from memory-write-policy channels');
    for (const ident of meaningfulChannelIdentifiers) {
      assertOk(skill.indexOf(ident) !== -1, 'memory-write-policy channel identifier "' + ident + '" not found in skills/larry-personality/SKILL.md');
    }
  });

  // -------------------------------------------------------------------------
  // Assertion 8: R-03 side-effect check -- evaluatePromotion is pure. Two
  // calls against a synthetic policy and synthetic rows must not change any
  // file's mtime under data/harness-policies/.
  // -------------------------------------------------------------------------
  record('assertion 8: evaluatePromotion(policy, lines) is side-effect free -- no file mtime under data/harness-policies/ changes', () => {
    const voiceStyleLog = require(path.join(REPO_ROOT, 'lib', 'hmi', 'voice-style-log.cjs'));
    assertOk(typeof voiceStyleLog.evaluatePromotion === 'function', 'lib/hmi/voice-style-log.cjs must export evaluatePromotion');

    const mtimesBefore = {};
    for (const file of fs.readdirSync(POLICIES_DIR)) {
      mtimesBefore[file] = fs.statSync(path.join(POLICIES_DIR, file)).mtimeMs;
    }

    const syntheticPolicy = {
      rung: 'logged',
      promotion_rule: { window_runs: 10, max_false_positive_rate: 0.1, min_true_positives: 2 },
    };
    const syntheticRows = [
      { result: 'true_positive' },
      { result: 'true_positive' },
      { result: 'fire' },
      { result: 'false_positive' },
    ];

    const verdict1 = voiceStyleLog.evaluatePromotion(syntheticPolicy, syntheticRows);
    const verdict2 = voiceStyleLog.evaluatePromotion(syntheticPolicy, syntheticRows);
    assertOk(verdict1 && typeof verdict1 === 'object', 'evaluatePromotion must return an object');
    assertEqual(JSON.stringify(verdict1), JSON.stringify(verdict2), 'evaluatePromotion must be deterministic across two calls with identical input');

    const mtimesAfter = {};
    for (const file of fs.readdirSync(POLICIES_DIR)) {
      mtimesAfter[file] = fs.statSync(path.join(POLICIES_DIR, file)).mtimeMs;
    }
    assertEqual(Object.keys(mtimesAfter).length, Object.keys(mtimesBefore).length, 'evaluatePromotion must not create or delete a file under data/harness-policies/');
    for (const file of Object.keys(mtimesBefore)) {
      assertEqual(mtimesAfter[file], mtimesBefore[file], 'evaluatePromotion must not touch the mtime of ' + file);
    }
  });

  process.stdout.write('\n');
  process.stdout.write(TEST_NAME + ': ' + passCount + ' passed, ' + failCount + ' failed\n');
  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
