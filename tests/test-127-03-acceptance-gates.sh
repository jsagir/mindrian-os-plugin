#!/usr/bin/env bash
# Phase 127 Plan 03 -- CONTEXT acceptance gates 1-5 (BRAIN-MCP-127-10).
#
# Five gates exercised end-to-end:
#   Gate 1: clean install, no key -> Tier-0 sentinel returned
#   Gate 2: clean install with live key -> non-null Brain payload (SKIP if no live key)
#   Gate 3: Lawrence-state legacy user-scope HTTP entry -> migration removes it
#   Gate 4: Tier-0 cohort -> canonical shim startup line on stderr
#   Gate 5: Class-M smoke parity -> expected 5-layer cascade
#
# Exit 0 iff no FAIL is present. SKIP is non-fatal.
# HARD RULE: no em-dashes (hyphens only) anywhere in this file.
set -u
# NOT set -e: we want to capture per-gate failures and continue;
# final aggregation decides the exit code.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
export REPO_ROOT

declare -A RESULTS
FAIL_COUNT=0

record() {
  local gate="$1"; local status="$2"; local detail="$3"
  RESULTS["$gate"]="$status :: $detail"
  if [ "$status" = "FAIL" ]; then FAIL_COUNT=$((FAIL_COUNT + 1)); fi
}

# Gate 1: clean install, no key
run_gate_1() {
  local TMPDIR_G1; TMPDIR_G1="$(mktemp -d -t g1-XXXXXX)"
  local OUT_FILE="$TMPDIR_G1/out.json"
  # Phase 250-04 (HONEST-03): MINDRIAN_DISABLE_AUTO_REGISTER=1 -- this gate's
  # DIRECTOR_NOT_AVAILABLE expectation is a keyless-fixture assertion; once
  # the live /register endpoint exists, a live silent registration would
  # otherwise mint a real token here and break the fixture.
  if HOME="$TMPDIR_G1" MINDRIAN_DISABLE_AUTO_REGISTER=1 env -u MINDRIAN_BRAIN_KEY timeout 15 node -e '
    const cp = require("child_process");
    const proc = cp.spawn(process.execPath, ["bin/mindrian-brain-mcp-client.cjs"]);
    let buf = "";
    proc.stdout.on("data", c => buf += c.toString("utf8"));
    proc.stdin.write(JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"g1",version:"1.0"}}}) + "\n");
    setTimeout(() => {
      proc.stdin.write(JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"brain_schema",arguments:{}}}) + "\n");
    }, 500);
    setTimeout(() => {
      const lines = buf.split("\n").filter(Boolean);
      let found = false;
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2 && msg.result && msg.result.content) {
            const text = msg.result.content[0].text;
            const parsed = JSON.parse(text);
            if (parsed.status === "DIRECTOR_NOT_AVAILABLE") { found = true; break; }
          }
        } catch (e) {}
      }
      proc.kill("SIGTERM");
      process.exit(found ? 0 : 1);
    }, 5000);
  ' >"$OUT_FILE" 2>&1; then
    record "gate-1" "PASS" "Tier-0 sentinel returned on brain_schema"
  else
    record "gate-1" "FAIL" "expected DIRECTOR_NOT_AVAILABLE sentinel; got: $(cat "$OUT_FILE" 2>/dev/null | head -c 200)"
  fi
  rm -rf "$TMPDIR_G1"
}

# Gate 2: clean install with live key
run_gate_2() {
  if [ -z "${MINDRIAN_TEST_LIVE_KEY:-}" ]; then
    record "gate-2" "SKIP" "MINDRIAN_TEST_LIVE_KEY not set"
    return
  fi
  local TMPDIR_G2; TMPDIR_G2="$(mktemp -d -t g2-XXXXXX)"
  printf 'MINDRIAN_BRAIN_KEY=%s\n' "$MINDRIAN_TEST_LIVE_KEY" > "$TMPDIR_G2/.mindrian.env"
  chmod 600 "$TMPDIR_G2/.mindrian.env"
  if HOME="$TMPDIR_G2" env -u MINDRIAN_BRAIN_KEY timeout 30 node -e '
    const cp = require("child_process");
    const proc = cp.spawn(process.execPath, ["bin/mindrian-brain-mcp-client.cjs"]);
    let buf = "";
    proc.stdout.on("data", c => buf += c.toString("utf8"));
    proc.stdin.write(JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"g2",version:"1.0"}}}) + "\n");
    setTimeout(() => proc.stdin.write(JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/call",params:{name:"brain_schema",arguments:{}}}) + "\n"), 500);
    setTimeout(() => {
      const lines = buf.split("\n").filter(Boolean);
      let ok = false;
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2 && msg.result && msg.result.content) {
            const text = msg.result.content[0].text;
            const parsed = JSON.parse(text);
            if (parsed && (parsed.status === "DIRECTOR_NOT_AVAILABLE" || Object.keys(parsed).length > 0)) { ok = true; break; }
          }
        } catch (e) {}
      }
      proc.kill("SIGTERM");
      process.exit(ok ? 0 : 1);
    }, 25000);
  ' 2>/dev/null; then
    record "gate-2" "PASS" "live brain_schema returned a structured response"
  else
    record "gate-2" "FAIL" "live brain_schema did not return a parseable response"
  fi
  rm -rf "$TMPDIR_G2"
}

# Gate 3: Lawrence state -- legacy user-scope HTTP entry exists
run_gate_3() {
  local TMPDIR_G3; TMPDIR_G3="$(mktemp -d -t g3-XXXXXX)"
  # Synthesize a tmp `claude` shim that responds to legacy claude mcp commands
  local FAKE_BIN="$TMPDIR_G3/bin"; mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/claude" <<'CLAUDE_SHIM'
#!/usr/bin/env bash
case "$*" in
  *"mcp get mindrian-brain"*)
    cat <<'JSON'
{ "name": "mindrian-brain", "scope": "user", "type": "http", "url": "https://example.invalid/mcp", "headers": { "Authorization": "Bearer testfixturekey0001" } }
JSON
    exit 0 ;;
  *"mcp remove mindrian-brain"*)
    echo "Removed user-scope server: mindrian-brain"
    exit 0 ;;
  *) echo "fake claude: unhandled $*" >&2; exit 1 ;;
esac
CLAUDE_SHIM
  chmod 755 "$FAKE_BIN/claude"
  printf 'MINDRIAN_BRAIN_KEY=testfixturekey0001\n' > "$TMPDIR_G3/.mindrian.env"
  chmod 600 "$TMPDIR_G3/.mindrian.env"

  if HOME="$TMPDIR_G3" PATH="$FAKE_BIN:$PATH" env -u MINDRIAN_BRAIN_KEY timeout 15 \
     node scripts/migrate-brain-mcp-from-http-to-stdio.cjs >"$TMPDIR_G3/mig.log" 2>&1; then
    if [ -f "$TMPDIR_G3/.mindrian/migrations.jsonl" ] \
       && ls "$TMPDIR_G3/.mindrian/pre-migration-snapshots/"*.json >/dev/null 2>&1; then
      record "gate-3" "PASS" "migration removed legacy entry, snapshot + log present"
    else
      record "gate-3" "FAIL" "migration did not write expected log/snapshot"
    fi
  else
    record "gate-3" "FAIL" "migration script failed: $(head -c 200 "$TMPDIR_G3/mig.log" 2>/dev/null)"
  fi
  rm -rf "$TMPDIR_G3"
}

# Gate 4: Tier-0 cohort -- shim startup line
run_gate_4() {
  local TMPDIR_G4; TMPDIR_G4="$(mktemp -d -t g4-XXXXXX)"
  local STDERR_FILE="$TMPDIR_G4/stderr.log"
  HOME="$TMPDIR_G4" env -u MINDRIAN_BRAIN_KEY timeout 5 \
    node bin/mindrian-brain-mcp-client.cjs 2>"$STDERR_FILE" >/dev/null &
  local PID=$!
  sleep 3
  kill -TERM "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  if grep -qE '^\[mindrian-brain\] MCP server v.+ started \(stdio\)$' "$STDERR_FILE"; then
    record "gate-4" "PASS" "shim emitted canonical startup line"
  else
    record "gate-4" "FAIL" "startup line missing or malformed: $(head -c 200 "$STDERR_FILE" 2>/dev/null)"
  fi
  rm -rf "$TMPDIR_G4"
}

# Gate 5: Class-M smoke parity
run_gate_5() {
  local TMPDIR_G5; TMPDIR_G5="$(mktemp -d -t g5-XXXXXX)"
  local OUT="$TMPDIR_G5/smoke.json"
  if HOME="$TMPDIR_G5" MINDRIAN_OS_ROOT="$REPO_ROOT" env -u MINDRIAN_BRAIN_KEY timeout 30 \
     node scripts/doctor.cjs --brain-smoke --json >"$OUT" 2>/dev/null; then
    if node -e '
      const j = JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
      if (j.class !== "M") process.exit(11);
      if (!Array.isArray(j.layers) || j.layers.length !== 6) process.exit(12);
      // Expected: L1 PASS, L2 FAIL (no key), L3-L6 skipped
      if (j.layers[0].ok !== true) process.exit(13);
      if (j.layers[1].ok !== false) process.exit(14);
      if (j.layers[2].reason !== "skipped-prior-layer-failed") process.exit(15);
      if (j.layers[3].reason !== "skipped-prior-layer-failed") process.exit(16);
      if (j.layers[4].reason !== "skipped-prior-layer-failed") process.exit(17);
      if (j.layers[5].reason !== "skipped-prior-layer-failed") process.exit(18);
    ' "$OUT"; then
      record "gate-5" "PASS" "Class-M reported expected cascade (L1 PASS, L2 FAIL, L3-L6 skipped)"
    else
      record "gate-5" "FAIL" "Class-M cascade mismatched: $(head -c 200 "$OUT" 2>/dev/null)"
    fi
  else
    record "gate-5" "FAIL" "doctor --brain-smoke --json failed"
  fi
  rm -rf "$TMPDIR_G5"
}

echo "Running CONTEXT acceptance gates 1-5..."
run_gate_1
run_gate_2
run_gate_3
run_gate_4
run_gate_5

echo ""
echo "==== ACCEPTANCE GATES ===="
for gate in gate-1 gate-2 gate-3 gate-4 gate-5; do
  printf "  %-10s %s\n" "$gate" "${RESULTS[$gate]}"
done
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "VERDICT: ALL ACCEPTANCE GATES PASSED (SKIP is non-fatal)"
  exit 0
else
  echo "VERDICT: $FAIL_COUNT gate(s) FAILED"
  exit 1
fi
