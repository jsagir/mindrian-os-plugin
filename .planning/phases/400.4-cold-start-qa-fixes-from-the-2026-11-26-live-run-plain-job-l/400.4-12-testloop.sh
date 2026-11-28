#!/usr/bin/env bash
# Plan 400.4-12 test loop. Usage: 400.4-12-testloop.sh <out.md> <label> <grep -E pattern>
# Runs every tests/*.cjs file that names the pattern, one at a time, 300 s timeout each, HOME and MINDRIAN_ROOMS_HOME in fresh
# temp dirs, stdin /dev/null. Writes a table: file | exit | first failing line. Sequential, no background process.
set -u
OUT="$1"; LABEL="$2"; PATTERN="$3"
cd "$(dirname "$0")/../../.." || exit 1
{
  echo "# 400.4-12 test loop: $LABEL"
  echo
  echo "pattern: \`$PATTERN\`"
  echo
  echo "| file | exit | first failing line |"
  echo "|------|------|--------------------|"
} > "$OUT"
for f in $(grep -lE "$PATTERN" tests/*.cjs | sort); do
  T=$(mktemp -d)
  LOG="$T/out.log"
  HOME="$T/home" MINDRIAN_ROOMS_HOME="$T/rooms" bash -c 'mkdir -p "$HOME" "$MINDRIAN_ROOMS_HOME"; timeout 300 node "$0"' "$f" < /dev/null > "$LOG" 2>&1
  rc=$?
  first=""
  if [ "$rc" -ne 0 ]; then
    first=$(grep -m1 -E "FAIL|Error|not ok|AssertionError|assert" "$LOG" | tr '|' '/' | cut -c1-160)
    [ -z "$first" ] && first=$(tail -n1 "$LOG" | tr '|' '/' | cut -c1-160)
  fi
  echo "| $f | $rc | $first |" >> "$OUT"
  rm -rf "$T"
done
echo "done: $(grep -c '^| tests/' "$OUT") files" >> "$OUT"
