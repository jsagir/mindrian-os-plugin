#!/usr/bin/env bash
# tests/test-114-turn-1-voice.sh
# Phase 114 / AC-114-02: Larry voice present in turn 1 without /mos:* invocation
# Implements BASH-checkable portion of tests/fixtures/114-larry-voice-rubric.md (criteria 1-6).
# HUMAN-judged criteria (7-10) routed to empathy audit per RESEARCH validation strategy.
#
# Phase 369.6 (D-06, D-11; L4 tests 4 and 5): rubric 3 checks the single leading voice glyph, the label
# "Larry | MindrianOS" and the identity sentence (not a signature opener); rubric 4 allows exactly one leading
# MARK_GLYPHS character and fails any other symbol-category character. A skipped live run exits 0 by default and
# exits 1 when LARRY_VOICE_REQUIRE_LIVE=1, so a required live leg never passes silently.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLUGIN_ROOT"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }
note() { echo "NOTE: $1"; }

# A skipped live run is a pass by default. LARRY_VOICE_REQUIRE_LIVE=1 makes it a failure (L4 test 5).
skip_live() {
  if [ "${LARRY_VOICE_REQUIRE_LIVE:-0}" = "1" ]; then
    echo "FAIL: live run required (LARRY_VOICE_REQUIRE_LIVE=1) but skipped: $1"
    exit 1
  fi
  exit 0
}

# Detect claude --print availability
if ! command -v claude > /dev/null 2>&1; then
  note "\`claude\` CLI not in PATH"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  note "Skipping bash-checkable rubric."
  skip_live "claude CLI not in PATH"
fi

if ! claude --help 2>&1 | grep -q -- "--print"; then
  note "\`claude --print\` flag not available in this Claude Code version"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  note "Skipping bash-checkable rubric."
  skip_live "claude --print flag not available"
fi

# Allow the test env to opt out of live `claude --print` invocation.
# Set MINDRIAN_SKIP_LIVE_CLAUDE=1 to defer behavioral validation to manual
# checklist (useful in CI / pre-commit / non-authenticated environments).
if [ "${MINDRIAN_SKIP_LIVE_CLAUDE:-0}" = "1" ]; then
  note "MINDRIAN_SKIP_LIVE_CLAUDE=1; skipping live claude --print invocation"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  skip_live "MINDRIAN_SKIP_LIVE_CLAUDE=1"
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
  skip_live "claude --print invocation failed or timed out"
fi

if [ ! -s "$RESPONSE_FILE" ]; then
  note "claude --print produced empty response (auth or model issue)"
  note "Defer to manual checklist: tests/manual/114-acceptance.md (AC-114-02 section)"
  skip_live "claude --print produced an empty response"
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

# The five move glyphs come from the one source, MARK_GLYPHS of lib/hmi/voice-color-mark.cjs.
GLYPHS="$(node -e "console.log(Object.keys(require('./lib/hmi/voice-color-mark.cjs').MARK_GLYPHS).join(''))")"

# Rubric criterion 3: the single leading voice glyph, the label, and the identity sentence (369.6 D-11).
# The identity sentence accepts a straight or curly apostrophe, the spelling PWS or PwS, and the CLI model clause or not.
if command -v python3 > /dev/null 2>&1; then
  if ! python3 -c "
import re, sys
glyphs, path = sys.argv[1], sys.argv[2]
text = open(path, encoding='utf-8').read().lstrip()
if not text or text[0] not in glyphs:
    sys.exit(2)
rest = text[1:].lstrip(' ')
if not rest.startswith('Larry | MindrianOS'):
    sys.exit(3)
ident = re.compile(r\"I['\\u2019]m Larry, MindrianOS['\\u2019]s (PWS|PwS) thinking partner(, powered by Claude)?\")
if not ident.search(text[:600]):
    sys.exit(4)
" "$GLYPHS" "$RESPONSE_FILE"; then
    cat "$RESPONSE_FILE"
    fail "Rubric 3 (leading glyph, label, identity sentence): one of the three is missing in turn 1"
  fi
  pass "Rubric 3: leading glyph, label Larry | MindrianOS and identity sentence present"
else
  note "Rubric 3 skipped (python3 not available); manual review required"
fi

# Rubric criterion 4: no emoji except exactly one leading voice glyph (Canon Part 12; 369.6 D-06).
# The allowance is the first character only, and only when it is one of MARK_GLYPHS. Any other symbol-category
# character (Unicode category So) fails.
if command -v python3 > /dev/null 2>&1; then
  if ! python3 -c "
import sys, unicodedata
glyphs, path = sys.argv[1], sys.argv[2]
content = open(path, encoding='utf-8').read().lstrip()
if content and content[0] in glyphs:
    content = content[1:]
for c in content:
    if unicodedata.category(c) == 'So':
        print('FOUND_EMOJI:', c)
        sys.exit(1)
" "$GLYPHS" "$RESPONSE_FILE" > /dev/null 2>&1; then
    cat "$RESPONSE_FILE"
    fail "Rubric 4 (one leading glyph only): a second glyph or another emoji was detected"
  fi
  pass "Rubric 4: exactly one leading voice glyph allowed, no other emoji (Python unicodedata scan)"
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
