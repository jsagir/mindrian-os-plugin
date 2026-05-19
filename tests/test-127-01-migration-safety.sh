#!/usr/bin/env bash
set -euo pipefail

# Phase 127-01 Task 3 -- migration safety harness.
#
# Exercises all 4 safety guards (SG-1..SG-4) across 4 fixture states:
#   clean-no-legacy / legacy-same-key / legacy-different-key / already-migrated.
#
# Hermetic HOME via mktemp; no test touches the real ~/.claude.json or
# ~/.mindrian/. All fixtures use synthetic testfixturekey0001 / 0002 strings
# (no-real-names HARD RULE).
#
# Emits "ALL 4 SAFETY GUARDS VERIFIED" on full PASS; non-zero exit on any fail.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
FAILED_TESTS=()

run_test() {
  local name="$1"
  local fixture="$2"
  local body="$3"

  local TMPDIR
  TMPDIR="$(mktemp -d -t mig127XXXXXX)"

  set +e
  HOME="$TMPDIR" FIXTURE="$REPO_ROOT/tests/fixtures/127-01-migration/$fixture" \
    node -e "$body" >"$TMPDIR/.stdout" 2>"$TMPDIR/.stderr"
  local rc=$?
  set -e

  if [ "$rc" -eq 0 ]; then
    PASS=$((PASS + 1))
    echo "PASS: $name"
  else
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("$name")
    echo "FAIL: $name"
    echo "----- stdout -----"
    cat "$TMPDIR/.stdout" 2>/dev/null || true
    echo "----- stderr -----"
    cat "$TMPDIR/.stderr" 2>/dev/null || true
    echo "------------------"
  fi
  rm -rf "$TMPDIR"
}

# T1: clean install -- no legacy entry
run_test "T1-clean-no-legacy" "clean-no-legacy.json" '
  const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
  const plan = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => null });
  if (plan.action !== "none") { console.error("expected action=none, got " + plan.action); process.exit(1); }
'

# T2: legacy-same-key end-to-end with mock-remove
run_test "T2-legacy-same-key-execute" "legacy-same-key.json" '
  const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
  const fx = require(process.env.FIXTURE);
  let removed = false;
  const plan = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
  if (plan.action !== "remove") { console.error("expected action=remove, got " + plan.action); process.exit(1); }
  const result = m.executePlan({ plan, homeDir: process.env.HOME, dryRun: false, isoTs: "2026-05-19T20:30:00Z", mockRemove: () => { removed = true; } });
  if (!result.executed) { console.error("expected executed=true"); process.exit(1); }
  if (!removed) { console.error("mockRemove was not called"); process.exit(1); }
  const fs = require("fs"), path = require("path");
  const snap = result.snapshot_path;
  if (!fs.existsSync(snap)) { console.error("snapshot file missing"); process.exit(1); }
  const log = fs.readFileSync(path.join(process.env.HOME, ".mindrian", "migrations.jsonl"), "utf8");
  if (!log.includes("\"action\":\"removed\"")) { console.error("log missing removed record"); process.exit(1); }
'

# T3: Lawrence two-key case -- refuse
run_test "T3-legacy-different-key-refuse" "legacy-different-key.json" '
  const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
  const fx = require(process.env.FIXTURE);
  const plan = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
  if (plan.action !== "refuse") { console.error("expected action=refuse, got " + plan.action); process.exit(1); }
  if (!plan.warning || !/auto-migration refused/.test(plan.warning)) { console.error("warning missing"); process.exit(1); }
  let removeCalled = false;
  const result = m.executePlan({ plan, homeDir: process.env.HOME, dryRun: false, mockRemove: () => { removeCalled = true; } });
  if (removeCalled) { console.error("removeFn must not be called on refuse"); process.exit(1); }
  const fs = require("fs"), path = require("path");
  const snapDir = path.join(process.env.HOME, ".mindrian", "pre-migration-snapshots");
  if (fs.existsSync(snapDir) && fs.readdirSync(snapDir).length > 0) { console.error("snapshot should not exist on refuse"); process.exit(1); }
'

# T4: SG-4 idempotency
run_test "T4-already-migrated-idempotency" "already-migrated.json" '
  const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
  const fx = require(process.env.FIXTURE);
  const plan1 = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
  m.executePlan({ plan: plan1, homeDir: process.env.HOME, dryRun: false, isoTs: "2026-05-19T20:30:00Z", mockRemove: () => {} });
  const plan2 = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
  if (plan2.action !== "already_migrated") { console.error("expected action=already_migrated, got " + plan2.action); process.exit(1); }
'

# T5: SG-1 byte-equality acceptance gate
run_test "T5-SG-1-claude-json-byte-equality" "legacy-same-key.json" '
  const fs = require("fs"), path = require("path"), crypto = require("crypto");
  const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
  const fx = require(process.env.FIXTURE);
  const fakeClaudeJson = path.join(process.env.HOME, ".claude.json");
  fs.mkdirSync(path.dirname(fakeClaudeJson), { recursive: true });
  const payload = JSON.stringify({ projects: {}, mcpServers: { "mindrian-brain": { type: "http", url: "x", headers: { Authorization: "Bearer testfixturekey0001" } } }, autoUpdate: true, padding: "x".repeat(700) });
  fs.writeFileSync(fakeClaudeJson, payload);
  const before = crypto.createHash("sha256").update(fs.readFileSync(fakeClaudeJson)).digest("hex");
  const plan = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
  m.executePlan({ plan, homeDir: process.env.HOME, dryRun: false, isoTs: "2026-05-19T20:30:00Z", mockRemove: () => {} });
  const after = crypto.createHash("sha256").update(fs.readFileSync(fakeClaudeJson)).digest("hex");
  if (before !== after) { console.error("SG-1 VIOLATION: legacy state file modified during migration"); process.exit(1); }
'

# T6: SG-4 raw-identifier scrub
run_test "T6-SG-4-no-raw-identifiers-in-log" "legacy-same-key.json" '
  const fs = require("fs"), path = require("path");
  const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
  const fx = require(process.env.FIXTURE);
  const plan = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
  m.executePlan({ plan, homeDir: process.env.HOME, dryRun: false, isoTs: "2026-05-19T20:30:00Z", mockRemove: () => {} });
  const log = fs.readFileSync(path.join(process.env.HOME, ".mindrian", "migrations.jsonl"), "utf8");
  if (/Bearer\s+\S+/.test(log)) { console.error("SG-4 VIOLATION: Bearer token in log"); process.exit(1); }
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(log)) { console.error("SG-4 VIOLATION: UUID in log"); process.exit(1); }
'

# T7: SG-2 snapshot mode 0600 (POSIX only)
if [ "$(uname)" != "Linux" ] && [ "$(uname)" != "Darwin" ]; then
  echo "SKIP T7-snapshot-mode-0600 (non-POSIX)"
else
  run_test "T7-SG-2-snapshot-mode-0600" "legacy-same-key.json" '
    const fs = require("fs"), path = require("path");
    const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
    const fx = require(process.env.FIXTURE);
    const plan = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
    const result = m.executePlan({ plan, homeDir: process.env.HOME, dryRun: false, isoTs: "2026-05-19T20:30:00Z", mockRemove: () => {} });
    const mode = fs.statSync(result.snapshot_path).mode & 0o777;
    if (mode !== 0o600) { console.error("snapshot mode is 0" + mode.toString(8) + ", expected 0600"); process.exit(1); }
  '
fi

# T8: SG-3 dry-run side-effect-free
run_test "T8-SG-3-dry-run-no-side-effects" "legacy-same-key.json" '
  const fs = require("fs"), path = require("path");
  const m = require("./scripts/migrate-brain-mcp-from-http-to-stdio.cjs");
  const fx = require(process.env.FIXTURE);
  let removeCalled = false;
  const plan = m.planMigration({ homeDir: process.env.HOME, mockClaude: () => fx.entry, mockBrainKey: fx.current_key });
  const result = m.executePlan({ plan, homeDir: process.env.HOME, dryRun: true, mockRemove: () => { removeCalled = true; } });
  if (removeCalled) { console.error("dry-run must not call removeFn"); process.exit(1); }
  if (result.executed) { console.error("dry-run must return executed=false"); process.exit(1); }
  const snapDir = path.join(process.env.HOME, ".mindrian", "pre-migration-snapshots");
  if (fs.existsSync(snapDir)) { console.error("dry-run must not create snapshot dir"); process.exit(1); }
  const log = path.join(process.env.HOME, ".mindrian", "migrations.jsonl");
  if (fs.existsSync(log)) { console.error("dry-run must not write log"); process.exit(1); }
'

echo ""
echo "==== RESULTS ===="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do echo "  - $t"; done
  exit 1
fi
echo "ALL 4 SAFETY GUARDS VERIFIED"
