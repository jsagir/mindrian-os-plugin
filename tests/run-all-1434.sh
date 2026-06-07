#!/usr/bin/env bash
# Phase 143.4 verification aggregator (DISC-09 acceptance gate) -- the single
# PASS/FAIL gate proving /mos:discover is wired soundly and the constitutional
# boundary (Canon Part 8) holds across the discover surface.
#
# Mirrors tests/run-all-1433.sh: a bash PASS/FAIL loop that runs each step to
# completion and exits non-zero if any failed. The runner MUST run to completion
# (no crash) even when a step fails; it prints a per-step PASS/FAIL line and a
# final tally; it exits 1 if any failed.
#
# It composes, in order:
#   (1) node tests/test-discover-part8.cjs
#         -> the DISC-06 boundary sweep (5 checks over the single discover
#            connector) returns zero failures.
#   (2) node scripts/build-connector-registry.cjs --check
#         -> the CONN-03 CI tripwire: the registry is not stale and every
#            connector (incl. the single discover connector) passes validation.
#   (3) a node one-liner asserting registry + resolver wiring (FIX 1 + FIX 3):
#         - data/connector-registry.json has EXACTLY ONE /mos:discover connector
#           (sub_mode client-product-discovery) and ZERO plain-language-bridge
#           connectors;
#         - data/command-registry.json framework_index["Jobs to Be Done (JTBD)"]
#           includes BOTH /mos:discover and /mos:jtbd (registry-includes-discover
#           + WFL-01 + FIX 3);
#         - commandsForFramework("The Pyramid Principle") is non-empty (DISC-10
#           dispatch-by-resolver, FIX 1).
#   (4) a node one-liner asserting the Plan 02 artifacts exist and parse:
#         - discovery-scaffold.json has 5 sections;
#         - discovery-brief-template.md contains "Plain-language message".
#   (5) a presence check that the synthetic fixture client exists.
#
# bash only. No emoji. No em-dashes.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# Run from the repo root so the node one-liners resolve data/ + lib/ via process.cwd().
cd "$REPO_ROOT" || { echo "FATAL: cannot cd to repo root $REPO_ROOT"; exit 1; }
START_TIME=$(date +%s)

TOTAL=0
PASSED=0
FAILED=0
FAILED_STEPS=()

run_step() {
  # run_step "<label>" <command...>
  local label="$1"; shift
  ((TOTAL++))
  echo "--- Running: $label ---"
  if "$@"; then
    ((PASSED++)); echo ">>> $label: PASSED"
  else
    ((FAILED++)); FAILED_STEPS+=("$label"); echo ">>> $label: FAILED"
  fi
  echo ""
}

echo "========================================"
echo "  Phase 143.4 verification aggregator"
echo "  (DISC-09 acceptance gate)"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# (1) The DISC-06 Part-8 boundary sweep (5 checks over the single connector).
# ---------------------------------------------------------------------------
run_step "test-discover-part8.cjs (DISC-06 boundary sweep)" \
  node "$SCRIPT_DIR/test-discover-part8.cjs"

# ---------------------------------------------------------------------------
# (2) The CONN-03 CI tripwire -- registry not stale + every connector valid.
# ---------------------------------------------------------------------------
run_step "connector-registry --check (CONN-03 tripwire)" \
  node "$REPO_ROOT/scripts/build-connector-registry.cjs" --check

# ---------------------------------------------------------------------------
# (3) Registry + resolver wiring (FIX 1 + FIX 3 + DISC-10 dispatch-by-resolver).
# ---------------------------------------------------------------------------
run_step "registry+resolver wiring (one discover connector, no bridge, JTBD+Pyramid resolve)" \
  node -e '
    const fs = require("fs");
    const path = require("path");
    const root = process.cwd();
    const reg = JSON.parse(fs.readFileSync(path.join(root, "data", "connector-registry.json"), "utf8"));
    const conns = Array.isArray(reg.connectors) ? reg.connectors : [];
    const discover = conns.filter(c => c && c.surface === "/mos:discover");
    if (discover.length !== 1) throw new Error("expected EXACTLY ONE /mos:discover connector, found " + discover.length);
    if (discover[0].sub_mode !== "client-product-discovery") throw new Error("discover sub_mode must be client-product-discovery, found " + discover[0].sub_mode);
    const bridge = conns.filter(c => c && c.sub_mode === "plain-language-bridge");
    if (bridge.length !== 0) throw new Error("expected ZERO plain-language-bridge connectors, found " + bridge.length);
    const cmdReg = JSON.parse(fs.readFileSync(path.join(root, "data", "command-registry.json"), "utf8"));
    const idx = (cmdReg && cmdReg.framework_index) || {};
    const jtbd = Array.isArray(idx["Jobs to Be Done (JTBD)"]) ? idx["Jobs to Be Done (JTBD)"] : [];
    if (!jtbd.includes("/mos:discover")) throw new Error("JTBD framework_index must include /mos:discover");
    if (!jtbd.includes("/mos:jtbd")) throw new Error("JTBD framework_index must include /mos:jtbd (FIX 3)");
    const resolver = require(path.join(root, "lib", "workflow", "command-resolver.cjs"));
    const pyramid = resolver.commandsForFramework("The Pyramid Principle");
    if (!Array.isArray(pyramid) || pyramid.length === 0) throw new Error("The Pyramid Principle must resolve non-empty (DISC-10 dispatch-by-resolver, FIX 1)");
    console.log("OK wiring: one discover connector, zero bridge, JTBD resolves /mos:discover+/mos:jtbd, Pyramid resolves [" + pyramid.join(", ") + "]");
  '

# ---------------------------------------------------------------------------
# (4) Plan 02 artifacts exist and parse.
# ---------------------------------------------------------------------------
run_step "Plan 02 artifacts (discovery-scaffold.json 5 sections + brief has Plain-language message)" \
  node -e '
    const fs = require("fs");
    const path = require("path");
    const root = process.cwd();
    const sc = JSON.parse(fs.readFileSync(path.join(root, "skills", "client-discovery-interview", "discovery-scaffold.json"), "utf8"));
    const sections = Array.isArray(sc.sections) ? sc.sections : [];
    if (sections.length !== 5) throw new Error("discovery-scaffold.json must have 5 sections, found " + sections.length);
    const bt = fs.readFileSync(path.join(root, "templates", "discovery", "discovery-brief-template.md"), "utf8");
    if (!bt.includes("Plain-language message")) throw new Error("discovery-brief-template.md must contain Plain-language message");
    console.log("OK Plan 02 artifacts: 5 scaffold sections, brief has Plain-language message");
  '

# ---------------------------------------------------------------------------
# (5) Synthetic fixture client presence.
# ---------------------------------------------------------------------------
run_step "fixture client presence (tests/fixtures/discover-acceptance/client-brief.md)" \
  test -f "$REPO_ROOT/tests/fixtures/discover-acceptance/client-brief.md"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "========================================"
echo "  Summary (143.4 verification)"
echo "========================================"
echo "  Total:  $TOTAL"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Time:   ${ELAPSED}s"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "  Failed:"
  for s in "${FAILED_STEPS[@]}"; do
    echo "    - $s"
  done
  echo "========================================"
  exit 1
fi

echo "========================================"
exit 0
