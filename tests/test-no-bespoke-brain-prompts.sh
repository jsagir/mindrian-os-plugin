#!/usr/bin/env bash
# Plan 121.5-10 Sub-plan K CI tripwire (audit punch list item 6).
#
# Exits 1 if any future commit reintroduces a bespoke Brain-suggestion prompt
# pattern in the 5 Brain-suggestion consumer files (the surfaces the lock
# protects) OR in any net-new consumer that requires chain-recommender or
# rankForSelector. Protects the Sub-plan K consolidation gain: the lock
# collapses 5 divergent Brain-suggestion consumers into ONE shape (the
# locked content template at docs/F-SELECTOR-CONSUMER-GUIDE.md Section 4);
# this tripwire prevents regression by surfacing any new bespoke pattern as
# a CI failure.
#
# Scope discipline (audit Section 6 item 6):
#   - SCANS the 5 named Brain-suggestion consumer files explicitly + any
#     NEW source file that imports chain-recommender.cjs or rankForSelector
#     from f-selector-ranker.cjs. The general Larry-voice "Want to explore
#     that next?" methodology-body prose is NOT in scope (those are
#     methodology close-outs, not Brain-suggestion selectors -- audit
#     Section 4.3 explicitly defers their F.1 close-out to v1.14.0).
#   - PATTERNS target the bespoke SELECTOR-prompt shapes that the locked
#     template replaces: bracket-text option lists ([continue]/[stop]),
#     verbose "(RECOMMENDED)" tags, "Pick one to" + selector verbs.
#
# Bash only. No emoji. No em-dashes. No external deps.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

# Bespoke-pattern allowlist: these substrings, when found verbatim in the
# SCANNED files (the 5 consumer surfaces + new chain-recommender/rankForSelector
# consumers), are flagged as regression. Each is a known anti-pattern from
# the audit Section 5.1 + 5.3 (the prose that was REPLACED by the locked
# template). Future additions to this list belong here, not inline in
# consumer source.
PATTERNS=(
  "\\[continue\\][[:space:]]+"
  "\\[stop\\][[:space:]]+"
  "\\(RECOMMENDED\\)"
  "Pick one to "
  "continue / stop"
)

# Scanned consumer surfaces. The 5 named files per audit Section 5.3 + the
# canonical consumer-discovery rule (anything new that imports
# chain-recommender or f-selector-ranker becomes a consumer and inherits the
# lock).
CONSUMER_FILES=(
  "$REPO/scripts/suggest-next-command.cjs"
  "$REPO/scripts/act-command.cjs"
  "$REPO/lib/agents/tension-hook-agent.cjs"
  "$REPO/lib/agents/auto-explore-agent.cjs"
  "$REPO/lib/agents/reverse-salient-agent.cjs"
)

# Auto-discover additional consumer files: any source file under lib/ or
# scripts/ that imports the chain-recommender or the f-selector-ranker is a
# consumer and inherits the lock.
EXTRA_CONSUMERS=()
while IFS= read -r f; do
  EXTRA_CONSUMERS+=("$f")
done < <(grep -rlE "require\\(.*(chain-recommender|f-selector-ranker)\\.cjs" \
  "$REPO/lib" "$REPO/scripts" 2>/dev/null | grep -v "\\.test\\.cjs$" | sort -u)

# Combine, de-duplicate.
ALL_FILES=()
declare -A SEEN
for f in "${CONSUMER_FILES[@]}" "${EXTRA_CONSUMERS[@]}"; do
  if [[ -f "$f" && -z "${SEEN[$f]:-}" ]]; then
    ALL_FILES+=("$f")
    SEEN[$f]=1
  fi
done

# Allowlist: comments that document the bespoke patterns for retirement
# context (e.g. "replaces the bespoke [continue] / [stop] brackets") are
# legitimate explanatory comments, NOT bespoke prose to flag. Same for the
# graceful-degradation fallback string in act-command.cjs that ships AFTER
# the F.0 pickShape call (which is the locked path; the fallback is reachable
# only when the dispatcher is missing -- a degraded environment). The fallback
# carries [GATE] text but NOT the [continue]/[stop] brackets the tripwire
# scans for, so it does not match anyway.
#
# Specific line-anchored allowlist: comment lines (start with whitespace + //
# or # or *) that mention the patterns in retirement context. These are
# documentation, not live prompts.
is_comment_line() {
  local content="$1"
  # Match common comment prefixes: //, #, *, --
  if [[ "$content" =~ ^[[:space:]]*(//|#|\*|--) ]]; then
    return 0
  fi
  return 1
}

hits=0
hit_lines=()

for file in "${ALL_FILES[@]}"; do
  for pattern in "${PATTERNS[@]}"; do
    while IFS= read -r line; do
      # Each line is "<lineno>:<content>". Parse out the content for the
      # comment-line filter.
      lineno="${line%%:*}"
      content="${line#*:}"
      if is_comment_line "$content"; then
        continue
      fi
      hits=$((hits + 1))
      hit_lines+=("$file:$lineno: $content")
    done < <(grep -n -E "$pattern" "$file" 2>/dev/null || true)
  done
done

if [[ $hits -gt 0 ]]; then
  echo "FAIL: $hits bespoke Brain-suggestion prompt patterns detected." >&2
  echo "" >&2
  echo "These patterns are RETIRED by the Phase 121.5-10 Sub-plan K locked" >&2
  echo "Brain-suggestion content template (docs/F-SELECTOR-CONSUMER-GUIDE.md" >&2
  echo "Section 4). Brain-suggestion consumers MUST route through" >&2
  echo "lib/hmi/selector-dispatcher.cjs pickShape with" >&2
  echo "payload.brain_suggestion_variant:true and the locked chip + question" >&2
  echo "+ option rows + footer shape." >&2
  echo "" >&2
  echo "Offending lines:" >&2
  for l in "${hit_lines[@]}"; do
    echo "  $l" >&2
  done
  exit 1
fi

echo "PASS: zero bespoke Brain-suggestion prompt patterns in scanned consumer files."
echo "  Scanned files (${#ALL_FILES[@]}):"
for f in "${ALL_FILES[@]}"; do
  echo "    - ${f#$REPO/}"
done
echo "  Patterns checked: ${#PATTERNS[@]}"
exit 0
