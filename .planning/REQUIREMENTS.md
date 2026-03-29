# Requirements -- v4.0 Brain API Control & CLI UI Ruling System

**Defined:** 2026-03-26
**Core Value:** Protect the moat (Brain API access control) and establish the visual grammar for all MindrianOS terminal interactions.

## v4.0 Requirements

### Brain API Control
- [ ] **BRAIN-01**: Admin can create time-limited API keys for Brain access via CLI command
- [ ] **BRAIN-02**: Admin can revoke, extend, and list active Brain keys
- [ ] **BRAIN-03**: Supabase `brain_api_keys` table with expiry, usage tracking, plan tier
- [ ] **BRAIN-04**: `brain_write` tool blocked for non-admin API keys
- [ ] **BRAIN-05**: Email notification sent to admin when new access is requested
- [ ] **BRAIN-06**: Supabase credentials wired into Render for production auth

### Admin Panel
- [x] **ADMIN-01**: `/mos:admin` command hidden from non-admin users (not locked -- invisible)
- [x] **ADMIN-02**: Admin panel self-teaches on every invocation (explains what each action does before executing)
- [x] **ADMIN-03**: Every destructive action shows consequences and requires confirmation

### CLI UI Ruling System
- [ ] **UI-01**: `skills/ui-system/SKILL.md` auto-loaded on every session with full rendering rules
- [ ] **UI-02**: 4-zone output anatomy enforced (header, body, intelligence strip, footer)
- [ ] **UI-03**: 5 body shapes implemented (Mondrian board, semantic tree, room card, document view, action report)
- [ ] **UI-04**: Symbol vocabulary (12 glyphs) and color contract (5 ANSI colors) codified
- [ ] **UI-05**: Session start contract (cold/warm/signals) with max 2 signals in greeting
- [ ] **UI-06**: Cross-surface adaptation rules (CLI -> Desktop -> Cowork)
- [ ] **UI-07**: Dual context per folder -- STATE.md + MINTO.md both read before routing

### Multi-Room
- [x] **ROOM-01**: `.rooms/registry.json` with room index and active room tracking
- [ ] **ROOM-02**: `/mos:rooms` command (list, new, open, close, archive, where)
- [x] **ROOM-03**: Context safety -- active room lock on all file-writing commands
- [x] **ROOM-04**: Header canary -- room name always visible in Zone 1
- [x] **ROOM-05**: Session start shows multi-room context when multiple rooms registered

### Autonomous Engine
- [ ] **ACT-01**: `/mos:act` reads room STATE.md + MINTO.md, selects framework via Brain (local fallback)
- [ ] **ACT-02**: Framework execution via subagent (`agents/framework-runner.md`, isolated context)
- [ ] **ACT-03**: Thinking trace displayed before any action
- [ ] **ACT-04**: `--chain` mode chains 3-5 frameworks, each feeds the next via output contract
- [ ] **ACT-05**: `--dry-run` previews without executing

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| BRAIN-01 | Phase 20 | Pending |
| BRAIN-02 | Phase 20 | Pending |
| BRAIN-03 | Phase 20 | Pending |
| BRAIN-04 | Phase 20 | Pending |
| BRAIN-05 | Phase 20 | Pending |
| BRAIN-06 | Phase 20 | Pending |
| UI-01 | Phase 21 | Pending |
| UI-02 | Phase 21 | Pending |
| UI-03 | Phase 21 | Pending |
| UI-04 | Phase 21 | Pending |
| UI-05 | Phase 21 | Pending |
| UI-06 | Phase 21 | Pending |
| UI-07 | Phase 21 | Pending |
| ADMIN-01 | Phase 22 | Complete |
| ADMIN-02 | Phase 22 | Complete |
| ADMIN-03 | Phase 22 | Complete |
| ROOM-01 | Phase 23 | Complete |
| ROOM-02 | Phase 23 | Pending |
| ROOM-03 | Phase 23 | Complete |
| ROOM-04 | Phase 23 | Complete |
| ROOM-05 | Phase 23 | Complete |
| ACT-01 | Phase 24 | Pending |
| ACT-02 | Phase 24 | Pending |
| ACT-03 | Phase 24 | Pending |
| ACT-04 | Phase 24 | Pending |
| ACT-05 | Phase 24 | Pending |

## Out of Scope

- Payment/billing integration -- handled externally via Stripe/marketplace
- Brain graph editing by users -- users get intelligence, never modify
- Mobile-specific UI -- Claude surfaces handle this
- Real-time collaboration -- Cowork handles natively
