#!/usr/bin/env bash
# Phase 205 aggregator (larry-loop-elevation). Grows as 205 builds.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "== 205: elevation-doctrine consistency floor =="
node "$DIR/test-205-elevation-doctrine-floor.cjs"
echo "== 205-02: Frame node + SHARES_JOB / ELEVATES_TO edges (D-Q5) =="
node "$DIR/test-205-frame-node.cjs"
echo "== 205-02: edge allow-list additive drift floor =="
node "$DIR/test-edges-part4-cascade-floor.cjs"
echo "ALL 205 TESTS PASS"
