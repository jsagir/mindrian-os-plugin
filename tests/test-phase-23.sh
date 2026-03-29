#!/usr/bin/env bash
# test-phase-23.sh -- Phase 23: Multi-room management tests
# Validates resolve-room, room-registry, and hook retrofits

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

GROUP="${1:-all}"

# --- Registry group ---
run_registry_tests() {
  echo "=== test-phase-23: Registry Infrastructure ==="

  # Create temp workspace for each test
  TMPBASE=$(mktemp -d)
  trap "rm -rf $TMPBASE" EXIT

  # Test 1: resolve-room with no room and no registry returns exit 1
  echo "Test 1: resolve-room with no room and no registry"
  EMPTY_DIR="$TMPBASE/empty-workspace"
  mkdir -p "$EMPTY_DIR"
  if ! bash "$PLUGIN_ROOT/scripts/resolve-room" "$EMPTY_DIR" 2>/dev/null; then
    pass "resolve-room returns exit 1 when no room exists"
  else
    fail "resolve-room should exit 1 when no room exists"
  fi

  # Test 2: resolve-room with legacy room/ returns the room path
  echo "Test 2: resolve-room with legacy room/"
  LEGACY_DIR="$TMPBASE/legacy-workspace"
  mkdir -p "$LEGACY_DIR/room"
  echo "project_name: Legacy Project" > "$LEGACY_DIR/room/STATE.md"
  RESULT=$(bash "$PLUGIN_ROOT/scripts/resolve-room" "$LEGACY_DIR" 2>/dev/null)
  if [[ "$RESULT" == *"/room" ]]; then
    pass "resolve-room returns legacy room/ path"
  else
    fail "resolve-room did not return legacy path, got: $RESULT"
  fi

  # Test 3: room-registry create adds a room to registry
  echo "Test 3: room-registry create"
  REG_DIR="$TMPBASE/registry-workspace"
  mkdir -p "$REG_DIR"
  CREATE_OUT=$(bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" create "acme" "rooms/acme" "Acme Corp" "Pre-Opportunity" 2>/dev/null)
  if [ -f "$REG_DIR/.rooms/registry.json" ]; then
    pass "room-registry create creates .rooms/registry.json"
  else
    fail "room-registry create did not create registry file"
  fi
  if echo "$CREATE_OUT" | grep -q "Acme Corp"; then
    pass "room-registry create returns room entry with venture_name"
  else
    fail "room-registry create output missing venture_name"
  fi

  # Test 4: resolve-room with registry returns the active room path
  echo "Test 4: resolve-room with registry"
  mkdir -p "$REG_DIR/rooms/acme"
  RESULT=$(bash "$PLUGIN_ROOT/scripts/resolve-room" "$REG_DIR" 2>/dev/null)
  if [[ "$RESULT" == *"/rooms/acme" ]]; then
    pass "resolve-room returns active room from registry"
  else
    fail "resolve-room did not return registry path, got: $RESULT"
  fi

  # Test 5: room-registry set-active switches the active room
  echo "Test 5: room-registry set-active"
  bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" create "beta" "rooms/beta" "Beta Inc" "Seed" 2>/dev/null
  mkdir -p "$REG_DIR/rooms/beta"
  ACTIVE=$(bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" get-active 2>/dev/null)
  if [ "$ACTIVE" = "beta" ]; then
    pass "set-active switches to new room on create"
  else
    fail "get-active returned '$ACTIVE' instead of 'beta'"
  fi
  # Switch back to acme
  bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" set-active "acme" 2>/dev/null
  ACTIVE=$(bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" get-active 2>/dev/null)
  if [ "$ACTIVE" = "acme" ]; then
    pass "set-active can switch back to acme"
  else
    fail "set-active did not switch back, got: $ACTIVE"
  fi

  # Test 6: room-registry archive sets status to archived
  echo "Test 6: room-registry archive"
  bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" archive "beta" 2>/dev/null
  STATUS=$(python3 -c "import json; reg=json.load(open('$REG_DIR/.rooms/registry.json')); print(reg['rooms']['beta']['status'])" 2>/dev/null)
  if [ "$STATUS" = "archived" ]; then
    pass "room-registry archive sets status to archived"
  else
    fail "room-registry archive did not set archived, got: $STATUS"
  fi

  # Test 7: resolve-room --adopt creates registry from legacy room/
  echo "Test 7: resolve-room --adopt"
  ADOPT_DIR="$TMPBASE/adopt-workspace"
  mkdir -p "$ADOPT_DIR/room"
  echo "project_name: Adopted Project" > "$ADOPT_DIR/room/STATE.md"
  echo "venture_stage: Growth" >> "$ADOPT_DIR/room/STATE.md"
  RESULT=$(bash "$PLUGIN_ROOT/scripts/resolve-room" "$ADOPT_DIR" --adopt 2>/dev/null)
  if [ -f "$ADOPT_DIR/.rooms/registry.json" ]; then
    pass "resolve-room --adopt creates registry.json"
  else
    fail "resolve-room --adopt did not create registry"
  fi
  VNAME=$(python3 -c "import json; reg=json.load(open('$ADOPT_DIR/.rooms/registry.json')); print(reg['rooms']['default']['venture_name'])" 2>/dev/null)
  if [ "$VNAME" = "Adopted Project" ]; then
    pass "resolve-room --adopt extracts venture_name from STATE.md"
  else
    fail "resolve-room --adopt venture_name wrong, got: $VNAME"
  fi

  # Test 8: room-registry list
  echo "Test 8: room-registry list"
  LIST_OUT=$(bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" list 2>/dev/null)
  if echo "$LIST_OUT" | grep -q "acme"; then
    pass "room-registry list includes acme"
  else
    fail "room-registry list missing acme"
  fi

  # Test 9: room-registry read
  echo "Test 9: room-registry read"
  READ_OUT=$(bash "$PLUGIN_ROOT/scripts/room-registry" "$REG_DIR" read "acme" 2>/dev/null)
  if echo "$READ_OUT" | grep -q "Acme Corp"; then
    pass "room-registry read returns room details"
  else
    fail "room-registry read missing details"
  fi
}

# --- Lock group (placeholder for Plan 03) ---
run_lock_tests() {
  echo "=== test-phase-23: Lock Tests (placeholder) ==="
  echo "  SKIP: post-write active room guard (Plan 03)"
  echo "  SKIP: post-write blocks writes to inactive room (Plan 03)"
}

# --- Greeting group (placeholder for Plan 03) ---
run_greeting_tests() {
  echo "=== test-phase-23: Greeting Tests (placeholder) ==="
  echo "  SKIP: session-start multi-room context (Plan 03)"
}

# Run requested group(s)
case "$GROUP" in
  registry) run_registry_tests ;;
  lock)     run_lock_tests ;;
  greeting) run_greeting_tests ;;
  all)
    run_registry_tests
    run_lock_tests
    run_greeting_tests
    ;;
  *)
    echo "Usage: test-phase-23.sh [registry|lock|greeting|all]" >&2
    exit 1
    ;;
esac

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
