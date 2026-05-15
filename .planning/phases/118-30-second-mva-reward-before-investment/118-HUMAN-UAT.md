---
status: partial
phase: 118-30-second-mva-reward-before-investment
source: [118-VERIFICATION.md]
started: 2026-05-15T14:00:00Z
updated: 2026-05-15T14:00:00Z
verifier: gsd-verifier (sonnet)
auto_score: 9/9 observable truths verified
auto_proof: 16/16 Phase 118 aggregator suites GREEN; Plans 00-06 all SUMMARYs match shipped artifacts; CRITICAL-1+5/2/3/4/6 + WARN-1/2/4/5 cross-plan invariants confirmed; Canon Part 8/9/10 boundaries clean; 0 em-dashes in user-facing output; 0 new statusline segments
---

## Current Test

[awaiting human testing -- requires the beta.17 release cut + live API tokens for Brain MCP + Tavily + Vercel]

## Tests

### 1. Live Vercel ephemeral deploy

expected:
- Operator configures `VERCEL_TOKEN` in `~/.mindrian.env` (or env / .env per resolve-vercel-key precedence)
- Operator types a venture sentence at the prompt: `"I have an idea for a couples finance app"`
- Within 45 seconds wall-clock, terminal shows: `→ Your Feynman deck: https://mos-brief-<sha8>-<random>.vercel.app`
- Browser visit to that URL renders the Feynman deck HTML (6-section Feynman structure + 6 agent findings + 3-option footer in plain text)
- `~/.mindrian/mva/state.json` contains `{current_sha8, current_sha256, rendered_at_ms, vercel_url}` with the real Vercel URL
- Vercel project name: `mindrianos-briefs` (per LD2)
- Subdomain GC: 7 days default (Vercel non-production behavior)

result: [pending]

### 2. Live Brain MCP + Tavily integration

expected:
- Operator configures `MINDRIAN_BRAIN_KEY` + `TAVILY_API_KEY` in `~/.mindrian.env`
- Operator types a venture sentence; pipeline fires
- Three Brain agents (brain_similar, brain_cross_domain, brain_classic_traps) all return `status='ok'` with real findings within their 35s per-agent budgets
- Tavily agent (tavily_funding) returns `status='ok'` with real grant/funding hits within 35s
- Six-hats agent (six_hats_red_black) returns red+black hat narratives
- Dashboard agent (dashboard_graph) returns graph neighborhood (may return `status='empty'` if no active room — that's expected, not a failure)
- Aggregate brief renders ALL 5+ agent results (or graceful-degrade on per-agent failure)
- Telemetry events emitted to `~/.mindrian/telemetry/v1.13/mva.jsonl`:
  - `mva_pipeline_started` with sentence_sha256
  - `mva_agent_returned` × 6 (one per agent) with duration_ms + status
  - `mva_brief_rendered` with total_duration_ms (NOT duration_ms per WARN-2)
  - `mva_brief_deployed` with vercel_subdomain_hash + deploy_duration_ms
  - `mva_option_selected` when user picks 1/2/3 with option_id + time_to_click_ms

result: [pending]

### 3. Dror 2.0 acceptance test

expected:
- A real Wave-2 tester (Lawrence / Gary / Rea / Natan / Justin / Aryeh) types one venture sentence
- Time from first-sentence-typed to brief-fully-rendered: <= 45 seconds (B2 hard budget)
- Time from brief-rendered to first-option-click: <= 60 seconds (Dror 2.0 criterion)
- Tester reports: "felt the product" — the empathy axis the Hooked audit measures
- Canon Part 8 receipt: no portion of the tester's raw sentence appears in any Brain query / Tavily query / Vercel deploy payload / telemetry event (sha256-only flow verified)

result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Pre-work for Tests 1-3

1. **Configure API tokens** (operator only; never commit; never expose):
   - `VERCEL_TOKEN`: get from Vercel dashboard → Settings → Tokens → Create
   - `MINDRIAN_BRAIN_KEY`: existing (per Brain MCP setup)
   - `TAVILY_API_KEY`: get from Tavily dashboard → API Keys
   - Add to `~/.mindrian.env` per the env > ~/.mindrian.env > .env precedence

2. **Cut beta.17 release** (per the corrected v1.13.1-EXECUTION-PLAN.md shift-by-1):
   ```bash
   scripts/release.sh --prerelease --no-minisite --allow-ahead
   ```
   The `--no-minisite` opt-out remains in effect until the install-minisite Vercel-to-GitHub bootstrap closes (open follow-up since Phase 126 cut).

3. **Verify install on tester machine** (Test 3): the tester needs beta.17 installed via the standard `claude plugin install/update mos@mindrian-marketplace` flow.

## Gaps

[none -- all 9 automated must-haves verified; pending items are live-service legs requiring real API tokens + a live tester]

## Acknowledged pre-existing items NOT caused by Phase 118

See `deferred-items.md` for full context:
- `tests/test-doctor-acceptance-preflight-checks.cjs` Test 2 SKIPPED (orphaned by Phase 126 beta.16 hotfix 3fc008b; carry-forward for beta.17.1)
- Same test's Test 7 fails on a pre-existing maintainer-environment install-state drift (legacy plugin clone at `~/.claude/plugins/mindrian-os`); operator can resolve with `mindrian-os doctor --fix --install-state`; not a Phase 118 regression
