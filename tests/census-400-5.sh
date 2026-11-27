#!/usr/bin/env bash
# Phase 400.5 plan 01: the base and after census, and the Goldfish R4-09 compare.
#   bash tests/census-400-5.sh --out FILE
#   bash tests/census-400-5.sh --compare BASE AFTER
# --out runs every census test with a temp HOME and a temp MINDRIAN_ROOMS_HOME (never the real rooms), stdin from
# /dev/null and timeout 600, and writes one row per test. --compare exits 0 only when no base PASS row is FAIL in AFTER,
# no base FAIL row has another masked first line (allow-list: test/83-hook-dispatch.test.cjs), no base HOOKS_LIST path
# is missing, and the AFTER runner FAIL and MISS sets (strict forms) are subsets of the BASE sets.
set -u

MODE="${1:-}"
abspath() { case "$1" in /*) printf '%s' "$1" ;; *) printf '%s/%s' "$(pwd)" "$1" ;; esac; }

if [ "$MODE" = "--compare" ]; then
  [ $# -eq 3 ] || { echo "usage: $0 --compare BASE AFTER" >&2; exit 2; }
  BASE=$(abspath "$2"); AFTER=$(abspath "$3")
  exec node - "$BASE" "$AFTER" <<'NODE'
const fs = require('fs');
const [base, after] = process.argv.slice(2).map((f) => fs.readFileSync(f, 'utf8').split('\n'));
const ALLOW = new Set(['test/83-hook-dispatch.test.cjs']);
function parse(lines) {
  const rows = new Map(); const hooks = new Set(); const feynBad = new Set();
  for (const l of lines) {
    let m;
    if ((m = /^HOOKS_LIST (\S+)$/.exec(l))) { hooks.add(m[1]); continue; }
    if ((m = /^(NAMED|HOOKS) (PASS|SKIP) (\S+)$/.exec(l))) { rows.set(m[1] + ' ' + m[3], { st: m[2], first: '' }); continue; }
    if ((m = /^(NAMED|HOOKS) FAIL (\S+) exit=(\S+) first=(.*)$/.exec(l))) { rows.set(m[1] + ' ' + m[2], { st: 'FAIL', first: m[4] }); continue; }
    if ((m = /^FEYN (FAIL [^ ]+ \(exit [^)]*\)|MISS [^ ]+ \(file does not exist\))$/.exec(l))) { feynBad.add(m[1].split(' ').slice(0, 2).join(' ')); continue; }
    if ((m = /^RUNALL400\.4 (.*)$/.exec(l))) {
      rows.set('RUNALL400.4 -', { st: /\bFAILED=0\b/.test(m[1]) ? 'PASS' : 'FAIL', first: m[1].replace(/PASSED=\d+/, 'PASSED=<n>').replace(/KNOWN=\d+/, 'KNOWN=<n>') });
    }
  }
  return { rows, hooks, feynBad };
}
const B = parse(base); const A = parse(after);
const diffs = []; const info = [];
for (const [k, b] of B.rows) {
  const a = A.rows.get(k);
  const p = k.split(' ').slice(1).join(' ');
  if (b.st === 'PASS' || b.st === 'SKIP') {
    if (a && a.st === 'FAIL') diffs.push('DIFF ' + k + ' base=' + b.st + ' after=FAIL first=' + a.first);
    else if (!a) diffs.push('DIFF ' + k + ' missing in AFTER');
  } else if (!a) {
    diffs.push('DIFF ' + k + ' base=FAIL missing in AFTER');
  } else if (a.st !== 'FAIL') {
    info.push('FIXED ' + k);
  } else if (a.first !== b.first) {
    if (ALLOW.has(p)) info.push('ALLOWED ' + k + ' base_first=' + b.first + ' after_first=' + a.first);
    else diffs.push('DIFF ' + k + ' first line changed base=' + b.first + ' after=' + a.first);
  }
}
for (const h of B.hooks) if (!A.hooks.has(h)) diffs.push('DIFF HOOKS_LIST ' + h + ' missing in AFTER');
for (const f of A.feynBad) if (!B.feynBad.has(f)) diffs.push('DIFF FEYN ' + f + ' not in BASE set');
for (const f of B.feynBad) if (!A.feynBad.has(f)) info.push('FIXED FEYN ' + f);
for (const l of info) console.log(l);
for (const l of diffs) console.log(l);
if (diffs.length === 0) { console.log('CENSUS_COMPARE OK'); process.exit(0); }
console.log('CENSUS_COMPARE DIFF ' + diffs.length);
process.exit(1);
NODE
fi

if [ "$MODE" != "--out" ] || [ $# -ne 2 ]; then
  echo "usage: $0 --out FILE | --compare BASE AFTER" >&2; exit 2
fi
OUT=$(abspath "$2")
cd "$(dirname "$0")/.." || exit 1
START=$(date +%s)

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
export HOME="$ROOT/home" USERPROFILE="$ROOT/home" MINDRIAN_ROOMS_HOME="$ROOT/rooms"
mkdir -p "$HOME" "$MINDRIAN_ROOMS_HOME"
unset CLAUDECODE CLAUDE_CODE_SESSION_ID CLAUDE_CODE_ENTRYPOINT CLAUDE_ACTIVE_ROOM MOS_LIVE_LOAD MOS_USERPROMPT_TRACE

RESEED="tests/test-261029-qef-hook-timeouts.cjs tests/test-385-hook-unwire.cjs tests/test-389-hook-unwire.cjs tests/test-derivation-drain-fires.cjs tests/test-jtbd-hook-integration.cjs tests/test-3696-operation-doctrine.cjs tests/test-369-hook-require-graph.cjs lib/memory/brain-derivation-queue.test.cjs lib/memory/minto-debounce-consumer-census.test.cjs test/83-hook-dispatch.test.cjs"
KEEP="tests/test-391-hooks-contract.cjs tests/test-3551-tri-polar.cjs tests/test-346-catalogue-schema.cjs tests/test-369-installed-layout.cjs tests/test-380-installed-layout.cjs tests/test-connector-tier-d-hooks.cjs tests/test-391-ledger-rows.cjs tests/test-hmi-compliance-e2e.cjs tests/test-quick-260911-juq-hooks-json-top-level.cjs tests/test-388-ship-less.cjs tests/test-admin-gate-hardening.cjs tests/test-198-adapter-budget.test.cjs tests/test-400.4-hook-run-exports.cjs tests/test-400.4-hook-budget.cjs tests/test-400.4-busy-opener.cjs"
CLASSIFIER="tests/test-261109-intent-classifier-query-count.cjs tests/test-251-suppress-unchanged.cjs tests/test-159-integration-2turn-suppress.cjs tests/test-159-turn-start-wiring.cjs tests/test-acpt-01-engine-fires.cjs tests/test-261030-a2s-classifier-parity.cjs tests/test-225-zero-score-gate.cjs tests/test-225-gate-degrade.cjs tests/test-360-picker-policy.cjs tests/test-360-harness-picker.cjs tests/test-active-session-ownership.cjs tests/test-395-offer-is-primary.cjs tests/test-400.4-cold-start-replay.cjs tests/test-400.4-one-voice.cjs"
NAMED="$RESEED $KEEP $CLASSIFIER"
# CENSUS_ONLY (optional): a space-separated list of rel paths; only those rows run (a quick subset for one plan).
ONLY="${CENSUS_ONLY:-}"

mask() {
  sed -E -e "s#${ROOT}#<ROOT>#g" -e 's#/tmp/[^ "'"'"':,)]*#<TMP>#g' \
    -e 's/[0-9]+(\.[0-9]+)? ?ms/<N>ms/g' \
    -e 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?/<TS>/g' -e 's/pid [0-9]+/pid <N>/g' | cut -c1-200
}

# row <SET> <rel>: run one test and print its row.
row() {
  local set="$1" rel="$2" out rc first
  local args=()
  [ "$rel" = "tests/test-400.4-hook-run-exports.cjs" ] && args=(--golden)
  if [ ! -f "$rel" ]; then echo "$set FAIL $rel exit=missing first=file does not exist"; return; fi
  out=$(timeout 600 node "$rel" "${args[@]}" 2>&1 </dev/null); rc=$?
  if [ "$rc" -eq 0 ]; then echo "$set PASS $rel"; return; fi
  if [ "$rc" -eq 77 ]; then echo "$set SKIP $rel"; return; fi
  first=$(printf '%s\n' "$out" | grep -m1 -E '\bFAIL\b|not ok|AssertionError|Error:')
  [ -n "$first" ] || first=$(printf '%s\n' "$out" | grep -v '^[[:space:]]*$' | tail -n 1)
  first=$(printf '%s' "$first" | tr -d '\r' | mask)
  echo "$set FAIL $rel exit=$rc first=$first"
}

if [ -n "$ONLY" ]; then
  { echo "HEAD $(git rev-parse HEAD)"; for t in $ONLY; do row NAMED "$t"; done; } > "$OUT"
  echo "census subset written: $OUT"
  exit 0
fi

TMP_OUT="$ROOT/census.txt"
{
  echo "HEAD $(git rev-parse HEAD)"
  for t in $NAMED; do row NAMED "$t"; done
  HOOKS=$(grep -rl "hooks\.json" tests test lib scripts --include=*.cjs 2>/dev/null \
    | grep -E '^tests/[^/]*\.cjs$|^test/[^/]*\.cjs$|\.test\.cjs$' \
    | grep -v -E '(^|/)test-400\.5-|(^|/)test-400\.4-dispatch-' \
    | grep -v -x 'lib/memory/run-feynman-tests.cjs' | sort -u)
  FILTERED=""
  for h in $HOOKS; do
    skip=0
    for n in $NAMED; do [ "$h" = "$n" ] && skip=1 && break; done
    [ "$skip" -eq 0 ] && FILTERED="$FILTERED $h"
  done
  for h in $FILTERED; do echo "HOOKS_LIST $h"; done
  for h in $FILTERED; do row HOOKS "$h"; done
  timeout 1800 node lib/memory/run-feynman-tests.cjs 2>&1 </dev/null \
    | grep -E '^FAIL [^ ]+ \(exit [^)]*\)$|^MISS [^ ]+ \(file does not exist\)$|^PASS [^ ]+$|^SKIP [^ ]+ \(exit 77, env degraded\)$' \
    | sed 's/^/FEYN /'
  last=$(timeout 3600 bash tests/run-all-400.4.sh 2>&1 </dev/null | grep -v '^[[:space:]]*$' | tail -n 1)
  echo "RUNALL400.4 $last"
} > "$TMP_OUT"
mv "$TMP_OUT" "$OUT"
END=$(date +%s)
echo "census written: $OUT ($((END - START)) s; NAMED=$(grep -c '^NAMED ' "$OUT") HOOKS=$(grep -c '^HOOKS ' "$OUT") FEYN=$(grep -c '^FEYN ' "$OUT"))"
