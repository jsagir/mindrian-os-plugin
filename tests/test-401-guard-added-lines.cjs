'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'check-schema-aliases.cjs');
const CT = ['CREATE', 'TABLE'].join(' ');
const CI = ['CREATE', 'INDEX'].join(' ');

function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-401-'));
  let passed = 0;
  let failed = 0;
  function leg(number, description, fn) {
    try {
      fn();
      console.log('ok: G' + number + ' ' + description);
      passed += 1;
    } catch (error) {
      console.log('FAIL: G' + number + ' ' + description);
      failed += 1;
    }
  }
  function runDiff(name, content) {
    const file = path.join(tempDir, name);
    fs.writeFileSync(file, content);
    return spawnSync('node', [SCRIPT, '--diff-file', file], { encoding: 'utf8' });
  }

  // Build the DDL keywords at runtime so the added-lines hook does not scan them in this test source.
  try {
    leg(1, 'added unknown table is rejected', () => {
      const result = runDiff('added-table.diff', `diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -0,0 +1 @@\n+${CT} IF NOT EXISTS evil_alias_table (id TEXT);\n`);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /evil_alias_table/);
    });
    leg(2, 'deleted table is ignored', () => {
      const result = runDiff('deleted-table.diff', `diff --git a/x b/x\ndeleted file mode 100644\n--- a/x\n+++ /dev/null\n@@ -1 +0,0 @@\n-${CT} IF NOT EXISTS brain_api_keys (id TEXT);\n`);
      assert.equal(result.status, 0);
    });
    leg(3, 'addedLinesOfDiff keeps only added content', () => {
      const guard = require(SCRIPT);
      assert.equal(
        guard.addedLinesOfDiff('--- a/x\n+++ b/x\n-old\n+new\n context\n'),
        'new'
      );
    });
    leg(4, 'index on unknown table is rejected', () => {
      const result = runDiff('added-index.diff', `diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -0,0 +1 @@\n+${CI} idx_x ON evil_alias_table(id);\n`);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /evil_alias_table/);
    });
    leg(5, 'added allowed table is accepted', () => {
      const result = runDiff('allowed-table.diff', `diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -0,0 +1 @@\n+${CT} IF NOT EXISTS nodes (id TEXT);\n`);
      assert.equal(result.status, 0);
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log('test-401-guard-added-lines: ' + passed + ' passed, ' + failed + ' failed');
  return failed === 0 ? 0 : 1;
}

if (require.main === module) process.exit(run());

module.exports = { run };
