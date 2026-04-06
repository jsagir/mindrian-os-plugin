#!/usr/bin/env bash
# test-phase-56.sh -- Phase 56: Path Resolution tests
# Validates resolve-room MindrianRooms-first resolution and room-registry central writes
#
# Requirements tested:
#   PATH-01: resolve-room finds active room from ~/MindrianRooms/.rooms/registry.json first
#   PATH-02: resolve-room scans ~/MindrianRooms/ directory when no registry exists
#   PATH-03: resolve-room falls back to legacy room/ with deprecation warning

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# Create isolated temp base for all tests
TMPBASE=$(mktemp -d)
# Save and clear the legacy warn file so tests are isolated
WARN_FILE="${TMPDIR:-/tmp}/.mindrian-legacy-warned"
ORIG_WARN_FILE=""
if [ -f "$WARN_FILE" ]; then
  ORIG_WARN_FILE=$(mktemp)
  cp "$WARN_FILE" "$ORIG_WARN_FILE"
fi

cleanup() {
  rm -rf "$TMPBASE"
  # Remove warn file created during tests
  rm -f "$WARN_FILE"
  # Restore original warn file if it existed
  if [ -n "$ORIG_WARN_FILE" ] && [ -f "$ORIG_WARN_FILE" ]; then
    cp "$ORIG_WARN_FILE" "$WARN_FILE"
    rm -f "$ORIG_WARN_FILE"
  fi
}
trap cleanup EXIT

echo "=== test-phase-56: Path Resolution ==="

# ---- Test 1: Baseline -- no room anywhere returns exit 1 ----
echo "Test 1: resolve-room with no room anywhere"
EMPTY_DIR="$TMPBASE/empty"
mkdir -p "$EMPTY_DIR"
if MINDRIAN_ROOMS_HOME="$TMPBASE/nonexistent-rooms-home" \
   bash "$PLUGIN_ROOT/scripts/resolve-room" "$EMPTY_DIR" 2>/dev/null; then
  fail "resolve-room should exit 1 when no room exists anywhere"
else
  pass "resolve-room returns exit 1 when no room exists (baseline)"
fi

# ---- Test 2: PATH-01 -- central registry resolution ----
echo "Test 2: resolve-room finds room via central registry (PATH-01)"
CENTRAL_HOME="$TMPBASE/central-rooms"
mkdir -p "$CENTRAL_HOME/.rooms"
mkdir -p "$CENTRAL_HOME/myproject"
cat > "$CENTRAL_HOME/.rooms/registry.json" <<'ENDJSON'
{
  "version": 2,
  "root": "PLACEHOLDER",
  "active": "myproject",
  "rooms": {
    "myproject": {
      "path": "myproject",
      "venture_name": "My Project",
      "venture_stage": "Design",
      "status": "active",
      "created": "2026-01-01T00:00:00.000000",
      "last_opened": "2026-04-06T00:00:00.000000"
    }
  }
}
ENDJSON
# Replace placeholder with actual path
python3 -c "
import json
with open('$CENTRAL_HOME/.rooms/registry.json') as f:
    reg = json.load(f)
reg['root'] = '$CENTRAL_HOME'
with open('$CENTRAL_HOME/.rooms/registry.json', 'w') as f:
    json.dump(reg, f, indent=2)
"

WORK_DIR_2="$TMPBASE/some-workspace"
mkdir -p "$WORK_DIR_2"
RESULT=$(MINDRIAN_ROOMS_HOME="$CENTRAL_HOME" \
  bash "$PLUGIN_ROOT/scripts/resolve-room" "$WORK_DIR_2" 2>/dev/null) || true
if [[ "$RESULT" == "$CENTRAL_HOME/myproject" ]]; then
  pass "resolve-room finds active room from central registry"
else
  fail "expected $CENTRAL_HOME/myproject, got: $RESULT"
fi

# ---- Test 3: PATH-02 -- directory scan fallback (no registry) ----
echo "Test 3: resolve-room directory scan fallback (PATH-02)"
SCAN_HOME="$TMPBASE/scan-rooms"
mkdir -p "$SCAN_HOME/targetproject"
# No .rooms/registry.json exists -- resolve-room should scan directory
SCAN_WORK="$TMPBASE/workspace-targetproject"
mkdir -p "$SCAN_WORK"
# The workspace basename is "workspace-targetproject" which won't match,
# so we use a workspace whose basename matches a room dir
SCAN_WORK2="$TMPBASE/targetproject"
mkdir -p "$SCAN_WORK2"
RESULT=$(MINDRIAN_ROOMS_HOME="$SCAN_HOME" \
  bash "$PLUGIN_ROOT/scripts/resolve-room" "$SCAN_WORK2" 2>/dev/null) || true
if [[ "$RESULT" == "$SCAN_HOME/targetproject" ]]; then
  pass "resolve-room finds room via directory scan when no registry exists"
else
  fail "expected $SCAN_HOME/targetproject, got: $RESULT"
fi

# ---- Test 4: Workspace registry fallback ----
echo "Test 4: resolve-room falls back to workspace .rooms/registry.json"
WS_DIR="$TMPBASE/ws-with-registry"
mkdir -p "$WS_DIR/.rooms"
mkdir -p "$WS_DIR/rooms/localroom"
cat > "$WS_DIR/.rooms/registry.json" <<ENDJSON
{
  "version": 1,
  "active": "localroom",
  "rooms": {
    "localroom": {
      "path": "rooms/localroom",
      "venture_name": "Local Room",
      "venture_stage": "Pre-Opportunity",
      "status": "active",
      "created": "2026-01-01T00:00:00Z",
      "last_opened": "2026-04-06T00:00:00Z"
    }
  }
}
ENDJSON
# Use a ROOMS_HOME with no registry and no matching dir, forcing workspace fallback
NO_MATCH_HOME="$TMPBASE/empty-rooms-home"
mkdir -p "$NO_MATCH_HOME"
RESULT=$(MINDRIAN_ROOMS_HOME="$NO_MATCH_HOME" \
  bash "$PLUGIN_ROOT/scripts/resolve-room" "$WS_DIR" 2>/dev/null) || true
if [[ "$RESULT" == *"/rooms/localroom" ]]; then
  pass "resolve-room falls back to workspace registry"
else
  fail "expected */rooms/localroom, got: $RESULT"
fi

# ---- Test 5: PATH-03 -- legacy room/ fallback with deprecation warning ----
echo "Test 5: resolve-room legacy fallback with deprecation warning (PATH-03)"
LEGACY_DIR="$TMPBASE/legacy-ws"
mkdir -p "$LEGACY_DIR/room"
NO_MATCH_HOME2="$TMPBASE/empty-rooms-home2"
mkdir -p "$NO_MATCH_HOME2"
# Ensure warn file doesn't exist so we get the warning
rm -f "$WARN_FILE"
RESULT=$(MINDRIAN_ROOMS_HOME="$NO_MATCH_HOME2" \
  bash "$PLUGIN_ROOT/scripts/resolve-room" "$LEGACY_DIR" 2>"$TMPBASE/stderr5.txt") || true
STDERR5=$(cat "$TMPBASE/stderr5.txt")
if [[ "$RESULT" == *"/room" ]]; then
  pass "resolve-room returns legacy room/ path"
else
  fail "expected */room, got: $RESULT"
fi
if echo "$STDERR5" | grep -q "run /mos:setup to migrate"; then
  pass "deprecation warning emitted to stderr"
else
  fail "expected deprecation warning, got stderr: $STDERR5"
fi

# ---- Test 6: Deprecation warning appears only ONCE (dedup) ----
echo "Test 6: Deprecation dedup -- second call has no warning"
# First call already happened in Test 5 and created the warn file.
# Second call should NOT emit warning.
RESULT2=$(MINDRIAN_ROOMS_HOME="$NO_MATCH_HOME2" \
  bash "$PLUGIN_ROOT/scripts/resolve-room" "$LEGACY_DIR" 2>"$TMPBASE/stderr6.txt") || true
STDERR6=$(cat "$TMPBASE/stderr6.txt")
if [ -z "$STDERR6" ]; then
  pass "deprecation warning suppressed on second call (dedup works)"
else
  fail "expected empty stderr on second call, got: $STDERR6"
fi

# ---- Test 7: MINDRIAN_ROOMS_HOME env var override ----
echo "Test 7: MINDRIAN_ROOMS_HOME overrides ~/MindrianRooms"
CUSTOM_HOME="$TMPBASE/custom-rooms"
mkdir -p "$CUSTOM_HOME/.rooms"
mkdir -p "$CUSTOM_HOME/customroom"
cat > "$CUSTOM_HOME/.rooms/registry.json" <<ENDJSON
{
  "version": 2,
  "root": "$CUSTOM_HOME",
  "active": "customroom",
  "rooms": {
    "customroom": {
      "path": "customroom",
      "venture_name": "Custom",
      "venture_stage": "Seed",
      "status": "active",
      "created": "2026-01-01T00:00:00Z",
      "last_opened": "2026-04-06T00:00:00Z"
    }
  }
}
ENDJSON
RESULT=$(MINDRIAN_ROOMS_HOME="$CUSTOM_HOME" \
  bash "$PLUGIN_ROOT/scripts/resolve-room" "$TMPBASE/irrelevant" 2>/dev/null) || true
if [[ "$RESULT" == "$CUSTOM_HOME/customroom" ]]; then
  pass "MINDRIAN_ROOMS_HOME overrides default ~/MindrianRooms"
else
  fail "expected $CUSTOM_HOME/customroom, got: $RESULT"
fi

# ---- Test 8: room-registry create writes to central registry ----
echo "Test 8: room-registry create writes to central registry"
REG_HOME="$TMPBASE/reg-central"
mkdir -p "$REG_HOME"
CREATE_OUT=$(MINDRIAN_ROOMS_HOME="$REG_HOME" \
  bash "$PLUGIN_ROOT/scripts/room-registry" create "newroom" "newroom" "New Room" "Pre-Opportunity" 2>/dev/null) || true
if [ -f "$REG_HOME/.rooms/registry.json" ]; then
  pass "room-registry create writes to MINDRIAN_ROOMS_HOME/.rooms/registry.json"
else
  fail "room-registry create did not write to central registry"
fi
if echo "$CREATE_OUT" | grep -q "New Room"; then
  pass "room-registry create returns room entry"
else
  fail "room-registry create output missing venture_name, got: $CREATE_OUT"
fi
# Verify the room dir was created under ROOMS_HOME
if [ -d "$REG_HOME/newroom" ]; then
  pass "room-registry create creates room dir under ROOMS_HOME"
else
  fail "room-registry create did not create room dir under ROOMS_HOME"
fi

# ---- Test 9: room-registry list reads from central registry ----
echo "Test 9: room-registry list reads from central registry"
LIST_OUT=$(MINDRIAN_ROOMS_HOME="$REG_HOME" \
  bash "$PLUGIN_ROOT/scripts/room-registry" list 2>/dev/null) || true
if echo "$LIST_OUT" | grep -q "newroom"; then
  pass "room-registry list reads from central registry"
else
  fail "room-registry list missing newroom, got: $LIST_OUT"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
