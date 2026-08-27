---
description: "Manually trigger auto-explore on a specific file (Desktop fallback when PostToolUse hook does not fire per RESEARCH 4.8)"
help_jtbd: "Let Larry decompose your domain before you even ask."
body_shape: "methodology"
hitl_shape: "F.3"
hitl_why: "The rabbit-hole exploration asks how deep to keep going, a depth budget."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 3): first delivery at commands/auto-explore.md:65, the F.1 dispatch contract carrying the domain-decomposition finding computed over the navigator's own freshly-filed artifact.
interactive_first_reward: methodology_reframe
argument-hint: "<file_path>"
serves_jtbd: ["find-problem", "understand-market", "explore"]
teaching: "In the moment a new artifact lands, /mos:auto-explore kicks off the same domain decomposition the PostToolUse hook would run. Use it on Desktop when the hook does not fire."
allowed-tools:
  - "Bash"
  - "Read"
  - AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-01]
  reach_id: context_block
  sub_mode: auto-explore
  framework: "Domain Selection"
  posture: push_forward
  hierarchy_rank: 17
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
---

# /mos:auto-explore -- Manual auto-explore (Desktop fallback)

On Desktop the PostToolUse hook does not fire (Desktop has no PostToolUse hook surface), so the auto-fire pathway from Phase 117-01's `scripts/auto-explore-fingerprint.cjs` cannot trigger automatically. This command is the **Desktop fallback** per RESEARCH 4.8 -- manual invocation produces the same F.1 contract as the CLI auto-fire path, preserving tri-polar render parity (invariant 4 from VALIDATION.md).

## Steps for Larry

1. Validate that the file at `$1` exists. If not, return: "File not found: $1".

2. Compute material_id:

   ```javascript
   const store = require('lib/memory/explored-materials-store');
   const fs = require('node:fs');
   const stat = fs.statSync(file_path);
   const material_id = store.computeMaterialId(roomDir, file_path, stat.mtime.getTime());
   ```

3. Check rate-limit ledger:

   ```javascript
   const existing = store.findLatest(roomSlug, material_id);
   if (existing && existing.user_response && !forceFlag) {
     return "Already explored -- last finding response: " + existing.user_response +
            ". Re-run with --force to override.";
   }
   ```

4. Call surfaceFinding directly (synchronous; no UserPromptSubmit drain needed since this is invoked directly by user):

   ```javascript
   const agent = require('lib/agents/auto-explore-agent');
   const result = agent.surfaceFinding({
     finding: theComputedFinding,
     roomDir: roomDir,
     operator: 'AUTONOMOUS',
     tier: 1,
   });
   ```

5. Return the F.1 dispatch contract inline. The user picks Explore / Skip / Later via Larry's AskUserQuestion follow-up turn.

6. Mark surfaced=true in ledger via `store.appendMaterial`.

7. When the user picks an option, call `agent.handleUserResponse` with the chosen verb so the F.1 selection routes back into JSONL state and (on EXPLORE) emits the INFORMS cascade edge.

## Why this exists

Per RESEARCH 4.8, Desktop has no PostToolUse hook. Without this command, Desktop users would never see auto-explore findings. The slash invocation produces the SAME F.1 contract as CLI auto-fire -- verified by the three-surface render parity smoke in VALIDATION.md (invariant 4). This is the structural fix for tri-polar coverage.

## Tri-polar surfaces

| Surface | Auto-fire path | Recovery path |
|---------|----------------|---------------|
| CLI | PostToolUse hook (`scripts/auto-explore-fingerprint.cjs`) -> background spawn -> UserPromptSubmit drain (`scripts/auto-explore-drain.cjs`) | SessionStart preflight (`scripts/preflight-auto-explore.cjs`) |
| Cowork | Same as CLI | Same as CLI |
| Desktop | NONE (no PostToolUse) | This slash command + SessionStart preflight drain |
