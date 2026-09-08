#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-contract-parity.cjs -- Phase 298 (harness-as-code) Plan 13, Task 2.
 *
 * Proves R-06 (contract parity, byte budget, frozen phrases). Carries the
 * VALIDATION.md T-298-12 and T-298-13 rows:
 *   T-298-12 R-06 contract parity: dropped phrase fails --check naming
 *     surface and phrase
 *   T-298-13 R-06 byte budget: Desktop wire <= 1,950 bytes (reads 1,944
 *     today)
 *
 * SUBJECT: data/harness-policies/contract-parity-larry.json
 *
 * Every tampered phrase is read from SUBJECT at run time, never hardcoded
 * here. Every tamper (two surfaces, plus a red case on the declared byte
 * budget) runs inside a try-finally that restores from the exact bytes read
 * before the edit -- an in-memory copy, nothing else. The finally block
 * asserts byte-identical restoration, and the test's last assertion is an
 * empty working-tree status, proving every tamper landed back where it
 * started. `lib/mcp/runtime-instructions.cjs` (the Desktop/Cowork wire
 * itself) is NEVER tampered; the red case for its budget tampers only the
 * policy's declared limit.
 *
 * Run: node tests/test-298-contract-parity.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'data', 'harness-policies', 'contract-parity-larry.json');
const GEN_PATH = path.join(REPO_ROOT, 'scripts', 'build-harness-manifest.cjs');
const NO_INSTRUCTIONS_TEST = path.join(REPO_ROOT, 'lib', 'mcp', 'no-instructions.test.cjs');
const TEST_NAME = 'test-298-contract-parity.cjs';

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
    throw new Error(
      (msg || 'assertion failed') + ' -- expected ' + JSON.stringify(expected) +
        ', got ' + JSON.stringify(actual)
    );
  }
}

function runCheck() {
  return spawnSync('node', [GEN_PATH, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function main() {
  if (!fs.existsSync(SUBJECT)) {
    process.stdout.write('SKIP ' + TEST_NAME + ' (missing ' + SUBJECT + ')\n');
    process.exit(0);
  }

  const policy = JSON.parse(fs.readFileSync(SUBJECT, 'utf8'));
  const surfaces = Array.isArray(policy.surfaces) ? policy.surfaces : [];
  const agentSurface = surfaces.find((s) => s && s.path === 'agents/larry-extended.md');
  const skillSurface = surfaces.find((s) => s && s.path === 'skills/larry-personality/SKILL.md');

  if (!agentSurface || !Array.isArray(agentSurface.phrases) || agentSurface.phrases.length === 0) {
    throw new Error(TEST_NAME + ': no declared phrases for agents/larry-extended.md in ' + SUBJECT);
  }
  if (!skillSurface || !Array.isArray(skillSurface.phrases) || skillSurface.phrases.length === 0) {
    throw new Error(TEST_NAME + ': no declared phrases for skills/larry-personality/SKILL.md in ' + SUBJECT);
  }

  // ---------------------------------------------------------------------
  // Cases 1 and 2 share one shape: tamper the first declared phrase for a
  // surface, prove --check goes red naming both the surface path and the
  // exact phrase, restore from the in-memory original, prove --check is
  // green again.
  // ---------------------------------------------------------------------
  function tamperSurfaceCase(label, surface) {
    const absPath = path.join(REPO_ROOT, surface.path);
    const original = fs.readFileSync(absPath, 'utf8');
    const phrase = surface.phrases[0];

    record(label + ': declared phrase is present at baseline', () => {
      if (original.indexOf(phrase) === -1) {
        throw new Error('baseline file does not contain the declared phrase ' + JSON.stringify(phrase));
      }
    });

    try {
      const tampered = original.replace(phrase, '');
      record(label + ': the tamper actually removes the phrase', () => {
        assertEqual(tampered.indexOf(phrase), -1, 'phrase still present after the tamper');
      });
      fs.writeFileSync(absPath, tampered);

      const result = runCheck();
      const combined = String(result.stdout || '') + String(result.stderr || '');

      record(label + ': --check exits non-zero on a dropped phrase', () => {
        if (result.status === 0) {
          throw new Error('--check exited 0 with the phrase missing');
        }
      });
      record(label + ': --check output names the surface path and the missing phrase', () => {
        if (combined.indexOf(surface.path) === -1) {
          throw new Error('output does not name the surface path ' + surface.path + ': ' + combined);
        }
        if (combined.indexOf(phrase) === -1) {
          throw new Error('output does not name the missing phrase: ' + combined);
        }
      });
    } finally {
      fs.writeFileSync(absPath, original);
      record(label + ': restored file is byte-identical to the original', () => {
        assertEqual(fs.readFileSync(absPath, 'utf8'), original, 'restore mismatch');
      });
    }

    record(label + ': --check is green again after restore', () => {
      const result = runCheck();
      if (result.status !== 0) {
        throw new Error(
          '--check did not return to exit 0 after restore: ' +
            String(result.stdout) + String(result.stderr)
        );
      }
    });
  }

  tamperSurfaceCase('agent surface', agentSurface);
  tamperSurfaceCase('skill surface', skillSurface);

  // ---------------------------------------------------------------------
  // Case 3: the byte budget. The declared limit (asserted 1950) and the
  // Desktop wire's EVALUATED constant are read at run time; the constant is
  // measured with Buffer.byteLength, never a file-size read.
  // ---------------------------------------------------------------------
  record('byte budget: declared limit is 1950', () => {
    assertEqual(policy.byte_budget.limit, 1950, 'byte_budget.limit drifted from 1950');
  });

  let measuredBudgetBytes;
  record('byte budget: RUNTIME_INSTRUCTIONS is at or under the declared limit', () => {
    const modPath = path.join(REPO_ROOT, policy.byte_budget.path);
    delete require.cache[require.resolve(modPath)];
    const mod = require(modPath);
    measuredBudgetBytes = Buffer.byteLength(mod[policy.byte_budget.constant], 'utf8');
    if (measuredBudgetBytes > policy.byte_budget.limit) {
      throw new Error(
        'measured ' + measuredBudgetBytes + ' bytes exceeds the declared limit of ' +
          policy.byte_budget.limit
      );
    }
  });

  // ---------------------------------------------------------------------
  // Case 3b: a red case on the byte budget, proving --check fails closed
  // when the budget is busted -- without ever touching the wire file.
  // Only the policy's declared limit is tampered, and restored from the
  // in-memory bytes read before the edit.
  // ---------------------------------------------------------------------
  (function tamperByteBudgetLimit() {
    const originalPolicyBytes = fs.readFileSync(SUBJECT, 'utf8');
    try {
      const tamperedPolicy = JSON.parse(originalPolicyBytes);
      tamperedPolicy.byte_budget.limit = measuredBudgetBytes - 1;
      fs.writeFileSync(SUBJECT, JSON.stringify(tamperedPolicy, null, 2) + '\n');

      const result = runCheck();
      const combined = String(result.stdout || '') + String(result.stderr || '');

      record('byte budget: --check exits non-zero when the declared limit is busted', () => {
        if (result.status === 0) {
          throw new Error('--check exited 0 with an impossibly low limit');
        }
      });
      record('byte budget: --check output names the constant and the measured byte count', () => {
        if (combined.indexOf(policy.byte_budget.constant) === -1) {
          throw new Error('output does not name the constant: ' + combined);
        }
        if (combined.indexOf(String(measuredBudgetBytes)) === -1) {
          throw new Error('output does not name the measured byte count: ' + combined);
        }
      });
    } finally {
      fs.writeFileSync(SUBJECT, originalPolicyBytes);
      record('byte budget: restored policy file is byte-identical to the original', () => {
        assertEqual(fs.readFileSync(SUBJECT, 'utf8'), originalPolicyBytes, 'restore mismatch');
      });
    }

    record('byte budget: --check is green again after the policy is restored', () => {
      const result = runCheck();
      if (result.status !== 0) {
        throw new Error(
          '--check did not return to exit 0 after restore: ' +
            String(result.stdout) + String(result.stderr)
        );
      }
    });
  })();

  // ---------------------------------------------------------------------
  // Cross-check: the generator's own byte measurement and the shipped
  // no-instructions test agree on the same number.
  // ---------------------------------------------------------------------
  record('lib/mcp/no-instructions.test.cjs exits 0 (generator and shipped test agree)', () => {
    const result = spawnSync('node', [NO_INSTRUCTIONS_TEST], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(
        'no-instructions.test.cjs did not exit 0: ' + String(result.stdout) + String(result.stderr)
      );
    }
  });

  // ---------------------------------------------------------------------
  // Final guard: every tamper above was restored -- the working tree is
  // clean. Restoration is from in-memory bytes only, start to finish.
  // ---------------------------------------------------------------------
  record('git status --porcelain is empty (every tamper was restored)', () => {
    const status = execSync('git status --porcelain', { cwd: REPO_ROOT, encoding: 'utf8' });
    if (status.trim() !== '') {
      throw new Error('working tree is not clean after the test run:\n' + status);
    }
  });

  process.stdout.write('\n' + TEST_NAME + ': ' + passCount + ' passed, ' + failCount + ' failed\n');
  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

if (!ASSERTIONS_IMPLEMENTED) {
  process.stdout.write('FAIL ' + TEST_NAME + ': ASSERTIONS_IMPLEMENTED is false\n');
  process.exit(1);
}

main();
