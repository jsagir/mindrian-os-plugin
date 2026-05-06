---
description: "Manually trigger auto-explore on a specific file (Desktop fallback when PostToolUse hook does not fire per RESEARCH 4.8)"
argument-hint: "<file_path>"
allowed-tools:
  - "Bash"
  - "Read"
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
