# MindrianOS Commands - Claude Cowork Feasibility Audit

**Date:** 2026-04-05
**Total Commands Audited:** 64
**Plugin Version:** v1.7.1
**User Types:** Student, Researcher, Venture Builder

## Executive Summary

| Status | Count | % |
|--------|-------|---|
| WORKS NOW | 18 | 28% |
| NEEDS MCP WRAPPER | 31 | 48% |
| NEEDS REDESIGN | 12 | 19% |
| NOT APPLICABLE | 3 | 5% |

28% of commands work on Cowork today with zero changes.
48% can be ported with thin MCP wrappers around existing CJS/Bash logic.
19% need architectural redesign (hooks, local servers, async workflows).
5% are CLI-only infrastructure.

## Cowork Readiness by User Type

| User Type | Ready Now | With MCP Wrappers | Needs Redesign |
|-----------|-----------|-------------------|----------------|
| Student | 9 commands | +25 methodology commands | grade assessment loop |
| Researcher | 8 commands | +12 research/analysis | intelligence loops |
| Venture Builder | 7 commands | +20 market/thesis/export | multi-room, presentation |

## The Pattern

All 25 methodology commands follow the SAME pattern:
1. Read room context
2. Run framework conversation
3. Write artifact to room section

MCP wrapper: tool receives room_path + section, Larry runs the framework conversationally, tool writes the artifact. One MCP tool template covers all 25.

## Phase Plan

Phase 1 (ships immediately): 18 WORKS NOW commands
Phase 2 (MCP v1.0): 31 wrapped commands (1 template covers 25 methodology commands)
Phase 3 (MCP v1.1): wiki, dashboard, scout (persistent server)
Phase 4 (v2.0): new-project, file-meeting, publish (Cowork API integration)
