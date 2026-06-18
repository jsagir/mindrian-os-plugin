# Phase 167 deferred items

Out-of-scope discoveries logged during execution (per the executor scope
boundary). These are NOT Phase 167 deliverables and were NOT fixed by this phase.

## DI-167-01: data/brain-orchestration-projection.json is STALE against its own generator (PRE-EXISTING, Phase 157 artifact)

- **Found during:** 167-05 (Wave 5 verify), the post-finalization regression sweep.
- **Symptom:** `node scripts/build-orchestration-projection.cjs --check` exits 1
  with `STALE: data/brain-orchestration-projection.json diverges from the
  regenerated projection`. The generator now emits 213 nodes / 52 edges; the
  committed artifact carries 207 nodes (a +92-line regeneration diff from
  commands/agents/skills that landed across the repo since the projection was
  last regenerated at commit ba4a9437, Phase 157-04).
- **Why it is OUT OF SCOPE for Phase 167:** the stale artifact is the Phase 157
  orchestration-projection surface, NOT a Phase 167 deliverable. Phase 167's
  harness manifest DIGESTS the projection's committed BYTES; the manifest is
  INTERNALLY CONSISTENT and CORRECT:
    - `node scripts/build-harness-manifest.cjs --check` -> `harness-manifest: OK`
    - the manifest `ranked_next_reach` digest (1e4b8bea9e64bdbc...) byte-matches
      the committed projection bytes (verified by instrumentation in 167-05).
  So within Phase 167's contract everything is consistent. Regenerating the
  projection would be a Phase-157-artifact maintenance action that also re-flips
  the manifest's ranked_next_reach digest -- a multi-surface change unrelated to
  the harness-as-code verify wave, and outside this executor's scope boundary
  (only auto-fix issues DIRECTLY caused by the current task's changes).
- **Not a Phase 167 regression:** the drift pre-dates Phase 167 (last projection
  regeneration commit ba4a9437 is Phase 157-04); Phase 167-04's /mos:new-surface
  is one of several surfaces the projection generator would pick up on the next
  Phase-157 regeneration, but the projection artifact is owned by Phase 157, not
  167. The Phase 167 manifest gate intentionally digests committed bytes, so it
  stays green and faithful regardless.
- **Recommended owner / follow-on:** a Phase-157 / projection-maintenance pass
  that runs `node scripts/build-orchestration-projection.cjs`, re-runs
  `node scripts/build-harness-manifest.cjs` (the ranked_next_reach digest will
  re-flip), and re-stages both together. Phase 137 (brain-mindrianos-sync-compat,
  deferred) is the natural home if continuous projection sync lands there.
