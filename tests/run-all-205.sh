#!/usr/bin/env bash
# Phase 205 aggregator (larry-loop-elevation). Grows as 205 builds.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "== 205: elevation-doctrine consistency floor =="
node "$DIR/test-205-elevation-doctrine-floor.cjs"
echo "ALL 205 TESTS PASS"
