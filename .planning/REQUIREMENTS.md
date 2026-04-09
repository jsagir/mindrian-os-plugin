# Requirements: Wiring Integrity + Intelligence Loop v1.9.3

**Defined:** 2026-04-09
**Core Value:** Make the intelligence loop real -- from artifact filed to Larry surfaces finding to user decides to decision becomes graph data

## Intelligence Loop (INTEL)

- [ ] **INTEL-01**: After filing an artifact, Larry surfaces up to 2 cross-subsystem impacts with confidence scores (e.g., "This changes your financial model assumption")
- [ ] **INTEL-02**: User can respond APPROVE (cascade soft edits), REJECT (capture reason as graph data), or DEFER (park for later review)
- [ ] **INTEL-03**: APPROVE/REJECT/DEFER decisions are persisted to .proactive-intelligence.json and indexed as KuzuDB edges (INVALIDATES, CONFIRMS, DEFERRED)
- [ ] **INTEL-04**: Mid-session intelligence injection -- after post-write cascade completes, new findings are available to Larry's next response (not just session start)
- [ ] **INTEL-05**: Repeat suppression works -- insights shown 3+ times are not re-surfaced unless new evidence changes them

## Filing Completeness (FILE)

- [ ] **FILE-01**: Filing a markdown artifact triggers an automatic git commit with structured message ("file(section): artifact title")
- [ ] **FILE-02**: classify-insight result is consumed by the cascade (not fire-and-forget) and stored in artifact frontmatter as classification: field
- [ ] **FILE-03**: Post-write cascade reports completion status to Larry via hook output (not silently swallowed)

## Portability + Polish (PORT)

- [ ] **PORT-01**: All hook scripts use cross-platform date/stat commands (replace GNU stat -c %Y with portable alternative)
- [ ] **PORT-02**: on-agent-complete replaces find -printf with POSIX-compatible alternative
- [ ] **PORT-03**: /mos:radar is registered in plugin.json and reachable via the plugin system
- [ ] **PORT-04**: REQUIREMENTS.md checkboxes for phases 39, 60, 61, 62 updated to match actual implementation status

## Future Requirements (Deferred)

- Cross-room relationship detection triggered automatically after filing (currently code exists but never triggered)
- Proactive context windowing (auto-suggest /clear at archetype-specific thresholds)

## Out of Scope

- Full APPROVE cascade that auto-edits affected sections (v2.0+ -- too risky without user trust established)
- Real-time WebSocket push from cascade to UI (not possible in CLI plugin model)
- Windows hook support (acknowledged limitation -- run-hook.cmd exits 0 silently)

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| INTEL-01 | Phase 69 | -- | Pending |
| INTEL-02 | Phase 69 | -- | Pending |
| INTEL-03 | Phase 69 | -- | Pending |
| INTEL-04 | Phase 70 | -- | Pending |
| INTEL-05 | Phase 70 | -- | Pending |
| FILE-01 | Phase 68 | -- | Pending |
| FILE-02 | Phase 68 | -- | Pending |
| FILE-03 | Phase 68 | -- | Pending |
| PORT-01 | Phase 67 | -- | Pending |
| PORT-02 | Phase 67 | -- | Pending |
| PORT-03 | Phase 67 | -- | Pending |
| PORT-04 | Phase 67 | -- | Pending |
