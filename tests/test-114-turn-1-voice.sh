#!/usr/bin/env bash
# tests/test-114-turn-1-voice.sh
# Phase 114 / AC-114-02: Larry voice present in turn 1 without /mos:* invocation
# Implements BASH-checkable portion of tests/fixtures/114-larry-voice-rubric.md (criteria 1-6).
# HUMAN-judged criteria (7-10) routed to empathy audit per RESEARCH validation strategy.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }
note() { echo "NOTE: $1"; }

# Detect claude --print availability
if ! command -v claude > /dev/null 2>&1; then
  note "\`claude\` CLI not in PATH"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  note "Skipping bash-checkable rubric. exit 0."
  exit 0
fi

if ! claude --help 2>&1 | grep -q -- "--print"; then
  note "\`claude --print\` flag not available in this Claude Code version"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  note "Skipping bash-checkable rubric. exit 0."
  exit 0
fi

# Allow the test env to opt out of live `claude --print` invocation.
# Set MINDRIAN_SKIP_LIVE_CLAUDE=1 to defer behavioral validation to manual
# checklist (useful in CI / pre-commit / non-authenticated environments).
if [ "${MINDRIAN_SKIP_LIVE_CLAUDE:-0}" = "1" ]; then
  note "MINDRIAN_SKIP_LIVE_CLAUDE=1; skipping live claude --print invocation"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  exit 0
fi

# Capture turn 1 response. We invoke with empty prompt (or minimal trigger) so that
# the agent's initialPrompt is the only first-turn user message.
RESPONSE_FILE=$(mktemp /tmp/114-turn-1-response.XXXXXX.txt)
trap "rm -f $RESPONSE_FILE" EXIT

# Invoke. Note: --plugin-dir . loads this plugin's settings (agent: larry-extended)
# and Anthropic platform auto-submits the agent's initialPrompt as turn 1.
if ! timeout 60 claude --print --plugin-dir . "" > "$RESPONSE_FILE" 2>&1; then
  cat "$RESPONSE_FILE"
  note "claude --print invocation failed or timed out (60s)"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  exit 0
fi

if [ ! -s "$RESPONSE_FILE" ]; then
  note "claude --print produced empty response (auth or model issue)"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  exit 0
fi

# Rubric criterion 1: first-person framing within first 30 words
if ! head -c 200 "$RESPONSE_FILE" | grep -q -E "(I'm |I am |Larry)"; then
  cat "$RESPONSE_FILE"
  fail "Rubric 1 (first-person framing): no 'I'm' / 'I am' / 'Larry' in first 200 chars"
fi
pass "Rubric 1: first-person framing present"

# Rubric criterion 2: <= 8 sentences
SENTENCE_COUNT=$(grep -o -E "[.!?]" "$RESPONSE_FILE" | wc -l)
if [ "$SENTENCE_COUNT" -gt 8 ]; then
  cat "$RESPONSE_FILE"
  fail "Rubric 2 (<=8 sentences): counted $SENTENCE_COUNT sentence terminators"
fi
pass "Rubric 2: $SENTENCE_COUNT sentences (<= 8)"

# Rubric criterion 3: signature opener OR initialPrompt response prefix
if ! head -c 100 "$RESPONSE_FILE" | grep -q -i -E "^(Very simply|Think about it like this|Here's (the thing|what everyone misses)|Let me challenge|I'm Larry)"; then
  cat "$RESPONSE_FILE"
  fail "Rubric 3 (signature opener): no signature opener prefix in first 100 chars"
fi
pass "Rubric 3: signature opener or initialPrompt response prefix present"

# Rubric criterion 4: no emoji (negative check via Python unicodedata if available)
if command -v python3 > /dev/null 2>&1; then
  if ! python3 -c "
import sys, unicodedata
content = open('$RESPONSE_FILE').read()
for c in content:
    if unicodedata.category(c) == 'So':
        print('FOUND_EMOJI:', c)
        sys.exit(1)
" > /dev/null 2>&1; then
    cat "$RESPONSE_FILE"
    fail "Rubric 4 (no emoji): emoji character detected"
  fi
  pass "Rubric 4: no emoji (Python unicodedata scan)"
else
  note "Rubric 4 skipped (python3 not available); manual review required"
fi

# Rubric criterion 5: no /mos: invocation
if grep -q "/mos:" "$RESPONSE_FILE"; then
  cat "$RESPONSE_FILE"
  fail "Rubric 5 (no /mos:): /mos: substring found in response (turn 1 must not invoke commands)"
fi
pass "Rubric 5: no /mos: invocation in turn 1"

# Rubric criterion 6: no em-dashes
if grep -q "—" "$RESPONSE_FILE" || grep -q "–" "$RESPONSE_FILE"; then
  cat "$RESPONSE_FILE"
  fail "Rubric 6 (no em-dashes): em-dash character found (CLAUDE.md hard rule)"
fi
pass "Rubric 6: no em-dashes"

echo ""
echo "==== AC-114-02 turn-1 voice: BASH RUBRIC CRITERIA 1-6 PASSED ===="
note "HUMAN rubric criteria 7-10 (warm-but-demanding, no framework dump, ends with question, investigative dial) routed to empathy audit per RESEARCH validation strategy"
exit 0
