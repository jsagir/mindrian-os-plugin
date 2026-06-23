---
name: query
description: "[Deprecated] Query the knowledge graph in natural language (use /mos:graph)"
help_jtbd: "Ask your room any question; get the answer as graph paths (deprecated: use /mos:graph)."
body_shape: D
argument-hint: "[question]"
serves_jtbd: ["audit-room", "explore"]
deprecated: true
deprecated_redirect: "graph"
deprecated_removal: "v1.14.0"
teaching: "Deprecated alias. Use /mos:graph to ask natural-language questions of the knowledge graph; query and graph share the same translator. Scheduled removal: v1.14.0."
allowed-tools:
  - Read
  - Bash
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Deprecated command. Superseded by /mos:graph for natural-language room queries; retained only for compatibility, so it carries no problem-state trigger. INV-06 promotion candidacy is moot given deprecation."
---

# /mos:query

> Deprecated. /mos:query now redirects to /mos:graph. Scheduled removal: v1.14.0. Use /mos:graph going forward.

You are Larry. The user invoked /mos:query. Per D-09 (LOCKED 2026-05-16, Phase 121.5-08 Sub-plan J) /mos:query is a soft-alias stub for the v1.13.x window. The canonical surface is /mos:graph.

## Steps

1. Emit the deprecation note above as a single cyan line (Larry voice; no em-dash; one sentence per skills/ui-system/SKILL.md Section 6).

2. Invoke /mos:graph with the user's original arguments (the natural-language question). Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/soft-alias-runner.cjs" --from query --to "graph" --remaining-args $ARGUMENTS
```

The runner emits `{redirect, deprecation_note, args, ok}`. Use the redirect to confirm the target, then proceed with /mos:graph behavior. The user sees ONE deprecation note + the graph traversal output.

3. Pass through /mos:graph's response (formatted insights, not raw query rows) verbatim.

## Why this is a soft-alias

Cluster 5 audit (2026-05-15) found that /mos:query and /mos:graph both translated natural language to SQL/Cypher against room.db. Two commands, identical translator, different names. Folding query into graph collapses the user-facing collision while preserving every tester's existing invocation for the v1.13.x window.

Per D-09 the old command stays as a soft-alias stub for v1.13.x; removal is scheduled v1.14.0. CHANGELOG announces the rename.

## Cross-references

- `commands/graph.md` -- the canonical target with the full graph query translator.
- `scripts/soft-alias-runner.cjs` -- the shared runner.
- Canon Part 7 (Reuse Before Build) -- consolidation rationale.
