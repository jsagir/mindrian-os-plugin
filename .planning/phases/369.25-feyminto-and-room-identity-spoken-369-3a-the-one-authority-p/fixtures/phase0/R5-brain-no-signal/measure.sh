#!/usr/bin/env bash
# R5: read-only look at the live egain problem-definition/BRAIN.md. cat, grep and ls only; nothing is written under ~/MindrianRooms.
set -u
D="$HOME/MindrianRooms/egain-des-liquid-conductor/problem-definition"
OUT="${1:?out dir}"
ls -la --time-style=full-iso "$D" > "$OUT/listing-before.txt"
{
  echo "# R5 raw read of $D/BRAIN.md (cat, no writes)"
  cat "$D/BRAIN.md"
  echo
  echo "# sections and their body"
  grep -n '^## \|(no signal)' "$D/BRAIN.md"
  echo
  echo "# arithmetic"
  echo "cost_tokens = $(grep '^cost_tokens:' "$D/BRAIN.md" | awk '{print $2}'); one call returned adds 60 (lib/core/brain-derivation.cjs cost estimate), so calls returned = $(( $(grep '^cost_tokens:' "$D/BRAIN.md" | awk '{print $2}') / 60 ))"
  echo "sections = $(grep -c '^## ' "$D/BRAIN.md"); sections with (no signal) = $(grep -c '^(no signal)$' "$D/BRAIN.md")"
  echo "brain_graph_version = $(grep '^brain_graph_version:' "$D/BRAIN.md" | awk '{print $2}') (0 is the default when brain_schema returned no numeric brain_graph_version)"
} > "$OUT/brain-raw.txt"
ls -la --time-style=full-iso "$D" > "$OUT/listing-after.txt"
diff "$OUT/listing-before.txt" "$OUT/listing-after.txt" > "$OUT/listing-diff.txt" && echo "listing unchanged" || echo "listing CHANGED (see listing-diff.txt)"
