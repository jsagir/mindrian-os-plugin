# Environment Variable Tuning for MindrianOS

These Claude Code environment variables optimize MindrianOS session behavior. Set them in your shell profile or per-session.

## AUTOCOMPACT_PCT_OVERRIDE

**What:** Controls when autocompact triggers (percentage of context window used).
**Default:** ~93% (187K of 200K tokens)
**MindrianOS recommendation:** 85% for rooms with large STATE.md, 90% for typical rooms.
**Why:** Lower threshold gives PreCompact hook more time to save room context before compression. Rooms with 8 populated sections and meeting archives have larger session-start context.

```bash
export AUTOCOMPACT_PCT_OVERRIDE=85
```

## MAX_THINKING_TOKENS

**What:** Maximum thinking budget per response.
**Default:** Model-dependent
**MindrianOS recommendation:** Increase for /mos:grade and /mos:act sessions.
**Why:** Grading against 100+ real projects requires nuanced reasoning. Methodology sessions (especially JTBD, Six Hats, Scenario Planning) benefit from deeper thinking to push past surface-level answers.

```bash
export MAX_THINKING_TOKENS=32768
```

## CLAUDE_CODE_MAX_CONTEXT_TOKENS

**What:** Override context window size.
**Default:** 200K (or 1M with [1m] suffix)
**MindrianOS recommendation:** Use 1M for deep multi-hour methodology sessions. Standard 200K for routine work.
**Why:** Deep methodology chains (thesis pipeline, discovery pipeline) accumulate significant context across 5+ stages. 1M context prevents mid-pipeline compression.

Note: 1M context is available for Opus 4.6 and Sonnet 4.6 via the [1m] model suffix. It uses beta header context-1m-2025-08-07.

## Usage in settings.json

These can be documented in settings.json for team awareness:

```json
{
  "env_recommendations": {
    "AUTOCOMPACT_PCT_OVERRIDE": {
      "value": "85",
      "rationale": "Room-aware threshold - gives PreCompact hook time to save context"
    },
    "MAX_THINKING_TOKENS": {
      "value": "32768",
      "rationale": "Deeper reasoning for grading and methodology sessions"
    },
    "CLAUDE_CODE_MAX_CONTEXT_TOKENS": {
      "value": "1000000",
      "rationale": "1M context for deep pipeline sessions"
    }
  }
}
```

## Source

Identified via ccleaks.com Claude Code capability audit (2026-03-31). See docs/research/RESEARCH_11_POWERHOUSE_SESSION.md for full analysis.
