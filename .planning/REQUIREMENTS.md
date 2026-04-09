# Requirements: Opportunity Engine + Conversation-First Entry v1.9.4

**Defined:** 2026-04-09
**Core Value:** Convert uncertainty to manageable risk through structured exploration -- every framework interaction produces bankable opportunities, every session starts with persona-aware routing

## Opportunity Extraction Engine (OPP)

- [x] **OPP-01**: Universal opportunity schema defined: problem statement, mirror solution, domain, evidence, source_framework, knight_position (risk vs uncertainty), confidence score
- [x] **OPP-02**: Every methodology command (/mos:diagnose, /mos:lean-canvas, /mos:find-bottlenecks, /mos:explore-domains, etc.) produces banked opportunities as a side effect of normal execution
- [x] **OPP-03**: Opportunities persist to room/opportunity-bank/ as structured markdown with YAML frontmatter matching the universal schema
- [x] **OPP-04**: Opportunity bank integrates with existing /mos:opportunities command and KuzuDB (ADDRESSES->Problem, IN_DOMAIN->Domain edges)
- [x] **OPP-05**: Brain enrichment: banked opportunities cross-referenced against 100 frameworks to suggest next validation steps

## Conversation-First Entry (CONV)

- [x] **CONV-01**: Session-start presents 3 modes with JTBD statements: Explore (nothing saved), Explore+Capture (room builds as side effect), Build Then Work (/mos:new-project)
- [x] **CONV-02**: Mode 2 detects user persona (TTO/Researcher/Business) within first 2-3 exchanges through Larry's questions
- [x] **CONV-03**: Mode 2 selects Brain framework chain based on persona: TTO (tech push -> domain -> problem), Researcher (problem exploration -> JTBD -> value prop), Business (opportunity recognition -> market -> problem definition)
- [x] **CONV-04**: Mode 2 banks opportunities during conversation -- well-defined problem + mirror solution extracted from user's own words
- [x] **CONV-05**: When user is ready, banked opportunities seed a new Data Room with pre-loaded sections (not empty)
- [x] **CONV-06**: Pre-room scratchpad persists across sessions so Mode 1 conversations can upgrade to Mode 2 later without losing context

## Onboarding Redesign (ONBD)

- [x] **ONBD-01**: /mos:onboard teaches all three entry paths with persona-specific guided first experience
- [x] **ONBD-02**: Onboarding explains the opportunity bank as the universal output of every framework interaction
- [x] **ONBD-03**: Knight uncertainty/risk framing presented as the "why" -- MindrianOS converts uncertainty to manageable risk
- [x] **ONBD-04**: Returning users who have banked opportunities see them surfaced in session greeting

## Future Requirements (Deferred)

- Cross-user anonymized opportunity patterns (Brain learns from all users' opportunity banks)
- Opportunity scoring against market data (Grants.gov, Crunchbase integration)
- Team opportunity bank (shared across Cowork users)

## Out of Scope

- Automatic room creation without user confirmation (Mode 2 always asks before creating)
- Full auto-pilot framework execution (Larry guides, user decides)
- Payment/monetization changes (handled externally)

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| OPP-01 | Phase 71 | -- | Pending |
| OPP-02 | Phase 71 | -- | Pending |
| OPP-03 | Phase 71 | -- | Pending |
| OPP-04 | Phase 72 | -- | Pending |
| OPP-05 | Phase 72 | -- | Pending |
| CONV-01 | Phase 73 | -- | Pending |
| CONV-02 | Phase 73 | -- | Pending |
| CONV-03 | Phase 73 | -- | Pending |
| CONV-04 | Phase 74 | -- | Pending |
| CONV-05 | Phase 74 | -- | Pending |
| CONV-06 | Phase 74 | -- | Pending |
| ONBD-01 | Phase 75 | -- | Pending |
| ONBD-02 | Phase 75 | -- | Pending |
| ONBD-03 | Phase 75 | -- | Pending |
| ONBD-04 | Phase 75 | -- | Pending |
