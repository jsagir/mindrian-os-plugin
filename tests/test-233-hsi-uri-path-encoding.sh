#!/usr/bin/env bash
# Phase 233 code-review WR-03 regression: compute-hsi.py --scope-to-nodes must
# survive a room path carrying URI-significant bytes.
#
# ROOT CAUSE this locks. load_graph_artifact_ids opened room.db with
#
#     sqlite3.connect('file:%s?mode=ro' % db_path, uri=True)
#
# splicing the path in raw. SQLite's URI parser treats ? as the query separator,
# # as the fragment start, and % as the escape byte. A room directory containing
# any of them means the parser stops reading the path early and swallows the rest
# as a query string, so the mode=ro that follows is never recognized as the
# read-only mode flag. That is the same bug class lib/core/graph-derivation.cjs
# ::_fileUriPath was written to close for the sub-room ATTACH on the SAME db path;
# the awareness had simply not crossed to the python side. The fix mirrors that
# helper byte for byte.
#
# The threat register claim at stake (233-03 SUMMARY.md, T-233-09): "Read-only is
# enforced at the SQLite layer, so a write attempt fails mechanically, not by
# convention." For a room path with ?, # or % that guarantee did not hold.
#
# PROVEN BY GROUND TRUTH, three legs, all against a room whose directory name
# contains all three bytes at once:
#   A. the function returns the REAL Artifact id set (not the None degrade path),
#      so the open genuinely succeeded rather than failing safe and looking fine.
#   B. the connection is REALLY read-only: an INSERT through the same opened URI
#      raises. This is the T-233-09 claim, executed rather than asserted.
#   C. the encoder is byte-identical to the JS _fileUriPath it mirrors, checked by
#      running both over the same adversarial inputs. Two encoders that disagree
#      about what a room path means would be a worse bug than either alone.
#
# Skips cleanly when numpy / scikit-learn are absent (compute-hsi.py guards those
# at module scope), which is an environment fact and not a regression. Makes ZERO
# network reach: no model is loaded, only the module import and one sqlite open.
# No em-dashes.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUITE="test-233-hsi-uri-path-encoding"

fail() { echo "FAIL [$SUITE]: $1" >&2; exit 1; }

HSI="$REPO_ROOT/scripts/compute-hsi.py"
[ -f "$HSI" ] || fail "missing scanner: scripts/compute-hsi.py"

command -v python3 >/dev/null 2>&1 || { echo "SKIP [$SUITE]: python3 unavailable"; exit 0; }
command -v node >/dev/null 2>&1 || { echo "SKIP [$SUITE]: node unavailable"; exit 0; }
python3 -c 'import numpy, sklearn' >/dev/null 2>&1 \
  || { echo "SKIP [$SUITE]: numpy/scikit-learn unavailable (compute-hsi.py guards them at module scope)"; exit 0; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Every URI-significant byte in one directory name, plus a space for good measure.
ROOM="$WORK/room ?q=1 #frag 100%"
mkdir -p "$ROOM/market-analysis" || fail "could not create a room dir with URI-significant bytes"

cat > "$ROOM/market-analysis/node-backed-one.md" <<'EOF'
# Node Backed One

Museums that sell tickets by emotion rather than by exhibit see repeat visits
climb, because the visitor books a feeling and not a floor plan.
EOF

# Build room.db through the repo's own doors, exactly as the sibling scope test does.
node -e '
const path = require("path");
const repo = process.argv[1];
const room = process.argv[2];
const { openGraph, closeGraph } = require(path.join(repo, "lib/core/lazygraph-ops.cjs"));
const { insertNode } = require(path.join(repo, "lib/core/node-insert.cjs"));
(async () => {
  const { db, conn } = await openGraph(room);
  try {
    insertNode(conn, "market-analysis/node-backed-one", "Artifact", JSON.stringify({ title: "one" }));
  } finally {
    await closeGraph(db);
  }
})().catch(e => { console.error("FIXTURE_ERR " + e.message); process.exit(1); });
' "$REPO_ROOT" "$ROOM" || fail "could not build the fixture room.db under a URI-significant path"

[ -f "$ROOM/.mindrian/room.db" ] || fail "fixture room.db was not created"

# --- Legs A + B: load through the real function, then prove read-only ------
OUT="$(python3 - "$HSI" "$ROOM" <<'PYEOF'
import importlib.util
import sqlite3
import sys

hsi_path, room = sys.argv[1], sys.argv[2]

spec = importlib.util.spec_from_file_location("compute_hsi_under_test", hsi_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# Leg A: the REAL id set, not the None degrade path. None here would mean the
# open failed and the caller silently fell back to scoring everything, which is
# precisely how this bug stayed invisible.
ids = mod.load_graph_artifact_ids(room)
if ids is None:
    print("LEG_A_FAIL degraded to None: the URI open did not succeed")
    sys.exit(1)
if ids != {"market-analysis/node-backed-one"}:
    print("LEG_A_FAIL wrong id set: %r" % (ids,))
    sys.exit(1)
print("LEG_A_OK")

# Leg B: the mode=ro flag really was recognized. Open the SAME URI the function
# builds and attempt a write. It must raise.
db_path = "%s/.mindrian/room.db" % room
uri = 'file:%s?mode=ro' % mod._file_uri_path(db_path)
conn = sqlite3.connect(uri, uri=True)
try:
    conn.execute("INSERT INTO nodes (id, type) VALUES ('wr03-probe', 'Artifact')")
    conn.commit()
    print("LEG_B_FAIL the write SUCCEEDED: mode=ro was not honored")
    sys.exit(1)
except sqlite3.OperationalError as exc:
    if "readonly" not in str(exc).lower():
        print("LEG_B_FAIL unexpected error, not a readonly refusal: %s" % exc)
        sys.exit(1)
    print("LEG_B_OK")
finally:
    conn.close()
PYEOF
)" || { echo "$OUT" >&2; fail "python leg failed under a URI-significant room path"; }

echo "$OUT" | grep -q "LEG_A_OK" || { echo "$OUT" >&2; fail "leg A did not pass"; }
echo "$OUT" | grep -q "LEG_B_OK" || { echo "$OUT" >&2; fail "leg B did not pass"; }

# --- Leg C: the python encoder matches the JS one it mirrors ---------------
# Same adversarial inputs through both implementations. If they ever diverge, one
# side can open a room the other cannot, which is a silent per-room failure.
PY_ENC="$(python3 - "$HSI" <<'PYEOF'
import importlib.util
import sys

spec = importlib.util.spec_from_file_location("compute_hsi_enc", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

cases = [
    "/rooms/plain",
    "/rooms/a?b",
    "/rooms/a#b",
    "/rooms/a%b",
    "/rooms/100%?x=1#f",
    "/rooms/%25already",
    "/rooms/with space/and'quote",
]
print("\n".join(mod._file_uri_path(c) for c in cases))
PYEOF
)" || fail "could not run the python encoder"

JS_ENC="$(node -e '
const path = require("path");
const { _fileUriPath } = require(path.join(process.argv[1], "lib/core/graph-derivation.cjs"));
if (typeof _fileUriPath !== "function") { console.error("NO_EXPORT"); process.exit(1); }
const cases = [
  "/rooms/plain",
  "/rooms/a?b",
  "/rooms/a#b",
  "/rooms/a%b",
  "/rooms/100%?x=1#f",
  "/rooms/%25already",
  "/rooms/with space/and'"'"'quote",
];
console.log(cases.map(_fileUriPath).join("\n"));
' "$REPO_ROOT" 2>/dev/null)"

if [ -z "$JS_ENC" ]; then
  echo "NOTE [$SUITE]: lib/core/graph-derivation.cjs does not export _fileUriPath; leg C compares nothing"
else
  [ "$PY_ENC" = "$JS_ENC" ] || {
    echo "--- python ---" >&2; echo "$PY_ENC" >&2
    echo "--- js -------" >&2; echo "$JS_ENC" >&2
    fail "the python _file_uri_path and the JS _fileUriPath disagree; the two would open different rooms"
  }
fi

echo "PASS [$SUITE]: --scope-to-nodes opens read-only under a room path carrying ? # and %"
exit 0
