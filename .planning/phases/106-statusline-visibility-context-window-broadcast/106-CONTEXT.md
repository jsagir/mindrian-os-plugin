---
phase: 106
name: statusline-visibility-context-window-broadcast
status: ready-to-plan
priority: P0 — testers can't see MindrianOS while it eats their context
gathered: 2026-05-03
mode: pre-staged from task #35 (autonomous v1.12.4 push session)
parent_release: v1.12.4 (Phase 88.2 + 104 bundled, shipped 2026-05-02)
target_release: v1.12.5
---

# Phase 106: Statusline Visibility + Context-Window Broadcast — Context

The statusline is the **only persistent visibility surface** for MindrianOS state in a Claude Code session. Per turn output goes by; statusline persists. Testers reported they don't see the branded MindrianOS statusline (`🏠 MindrianOS-Plugin ▶ 📂 product-evolution │ 🔍 PRODUCT EVOLUTION │ 🧠 MindrianOS v1.12.0 🔄`) — instead they see the generic Claude Code line `⏵⏵ accept edits on · 1 local agent`. Without the statusline, MindrianOS is invisible while consuming tokens.

When asked about context-window usage, testers have **no visibility** into what MindrianOS is doing or how much budget it's eating. This makes the plugin feel like a black box.

This is P0. Testers need to see state at a glance.

<domain>
## Phase Boundary

Make the MindrianOS statusline:
1. **Auto-heal** on install drift (don't require manual settings.json edit)
2. **Information-rich** — broadcast token usage, active operator, active JTBD, room name
3. **Detectable when invisible** — auto-warn if statusline isn't firing
4. **Falls back gracefully** — Larry surfaces session-state in greeting if statusline truly cannot fire (Desktop, Cowork)
5. **Validates at install** — first session post-install confirms visibility

Out of scope:
- Rewriting the statusline rendering primitive itself (that's Claude Code internals)
- Cross-platform terminal rendering (handled by Claude Code)
- Emoji vs ANSI fallback selection (defer to Phase 107 if needed)
</domain>

<decisions>
## Implementation Decisions

### Six deliverables (canonical)

**D-01: SELF-HEALING STATUSLINE**
- `settings.json` `statusLine` field resolves via plugin manager API, NOT hardcoded path
- On session start, `scripts/statusline-mos` auto-detects its own canonical install path
- `settings.json` template regenerates per session if path drifts (`cp -aT` recovery from cache, mirroring Phase 93 install-cache drift recovery pattern)

**D-02: CONTEXT-WINDOW BROADCAST**
- Add `📊 [percent]%` token budget indicator to statusline
  - Color thresholds via 5-color De Stijl contract: 🟢 < 50% / 🟡 50-80% / 🔴 > 80%
- Add `🎯 [active-jtbd]` (e.g. `🎯 find-bottleneck`) — read from `lib/hmi/jtbd-state.cjs`
- Add `⚙️ [active-operator]` (e.g. `⚙️ METHODOLOGY`) — read from `lib/conversation/operator.cjs`
- Add `⚠ compaction-imminent` warning when context > 80%
- Existing prefix preserved: `🏠 MindrianOS-Plugin ▶ 📂 [room] │ 🔍 [SECTION] │ 🧠 MindrianOS v[X.Y.Z]`

**D-03: INVISIBILITY DETECTION + AUTO-REPAIR**
- Session-start hook spawns subprocess that calls `node scripts/statusline-mos` and validates output starts with `🏠 MindrianOS-Plugin`
- If FAIL: surface ONE-TIME banner in Larry's first response: "MindrianOS is active but statusline is not visible. Run /mos:doctor --fix to repair."
- `/mos:doctor` adds drift class G: `statusline-not-visible` (extending Phase 95.1 drift detector framework)
- `/mos:doctor --fix` regenerates settings.json statusLine entry pointing at the canonical install path

**D-04: FALLBACK SIGNALING**
- Larry's session-start greeting includes a 1-line state echo: `[MindrianOS v1.12.4 active · room: product-evolution · operator: BUILD_ROOM · jtbd: find-bottleneck · context: 23%]`
- Plain prose, not the rich glyph statusline, but ensures testers always see SOMETHING
- Configurable: `mindrian.statusline.fallback_echo: true` (default true for first 30 days post-install, off after)
- Triggered when D-03 invisibility detection fires OR when running on Desktop/Cowork (which have no statusline primitive)

**D-05: TESTER ONBOARDING VALIDATION**
- First session post-install: `/mos:doctor` runs automatically, surfaces `statusline-visible: ok|fail`
- Welcome doc explains where to look: bottom of terminal, branded line with 🏠 prefix
- "If you don't see it, run `/mos:doctor --fix`" callout
- Tester onboarding flow gains "did you see the statusline?" verification gate

**D-06: PER-SURFACE BEHAVIOR**
- Claude Code CLI: rich statusline (current target — D-01 + D-02 fully wired)
- Claude Desktop: surface state in Larry's response footer (Desktop has no statusline primitive)
- Cowork: shared room-state widget (different surface, same content) — defer details to Phase 107

### Telemetry

- LOCAL JSONL: every session-start logs whether statusline was visible at boot
- Aggregated count surfaces in `/mos:doctor --json` output
- Canon Part 8: zero remote egress; sha256-hashed room slug; never raw content

### Backward compat

- Existing v1.12.x statusline behavior preserved when token-broadcast feature flag is off
- Auto-heal is additive — never overwrites a user's hand-edited settings.json without confirmation
- Fallback echo is opt-out via config (not opt-in), but default-off after 30 days post-install
</decisions>

<canonical_refs>
## Canonical References

### Already-shipped substrate (depend on, don't re-implement)
- `scripts/statusline-mos` (Phase 83 cross-session scope injection — current statusline implementation)
- `lib/conversation/operator.cjs` (Phase 99 — read active operator state)
- `lib/hmi/jtbd-state.cjs` (Phase 100 — read active JTBD)
- `scripts/doctor.cjs` (Phase 95.1 — drift detector framework, extend with class G)
- `scripts/operator-update.cjs` (Phase 99-04 — hook entry pattern reference)
- `lib/hmi/tier-check.cjs` (Phase 101-05 — Mode A/B/Tier 0 — for color threshold gating)

### Reference incidents
- 2026-04-13 wrong-workspace incident (`docs/autopsies/2026-04-13-wrong-workspace-incident.md`)
- 2026-04-28 install-cache drift (`docs/autopsies/2026-04-28-install-cache-drift-incident.md`)
- 2026-05-02 statusline visibility report (testers reported NOT seeing branded statusline; sourced from /mos:v1.12.4 announcement prep session — Larry's banana-ripener letter prep noted this gap)

### Authority docs
- `skills/ui-system/SKILL.md` — UI Ruling System (12-glyph + 5-color contract for the statusline glyphs)
- `docs/MINDRIAN-CANON.md` Part 8 — LOCAL ONLY (telemetry must stay local)
- `CLAUDE.md` decision #15 — every directory gets a ROOM.md (lib/statusline/ROOM.md if a new directory ships)

</canonical_refs>

<specifics>
## Specific Ideas

Heuristic phase plan structure (for the planner to refine into formal PLAN.md files):

| Wave | Plans | Concern |
|------|-------|---------|
| 0 | 106-00 | REQ-IDs (STATUS-106-01..06) + Wave-0 test stubs + ROADMAP entry |
| 1 | 106-01, 106-02, 106-03 | Self-healing settings (D-01) + token broadcast (D-02) + invisibility detector + class G doctor (D-03) — file-disjoint, parallel-safe |
| 2 | 106-04, 106-05 | Fallback signaling (D-04) + onboarding validation (D-05) + per-surface (D-06 — CLI scope only; Desktop/Cowork deferred) |

Token-budget signal source: Claude Code's runtime exposes `process.env.CLAUDE_CONTEXT_USED_TOKENS` and `process.env.CLAUDE_CONTEXT_MAX_TOKENS` (verify at planner time; if absent, fall back to estimating from session-start metadata).

Invisibility detector uses the same pattern as Phase 95.1's class A install-cache drift detector — spawn subprocess, validate stdout prefix, surface one-time banner.

Fallback echo wires into the existing session-start hook (Phase 99-04 pattern).

</specifics>

<deferred>
## Deferred Ideas

- Voice / accessibility readout of statusline state (defer to Phase 108+)
- Per-tester customization of statusline content (defer to v1.13.x)
- Statusline animation / pulse on state change (defer — not P0)
- Cross-terminal compatibility audit (Windows Terminal, iTerm2, Alacritty — defer to platform validation phase)
- ANSI fallback when terminal doesn't support emoji (defer to Phase 107)

</deferred>

## How to start the next session

```
/clear                           # fresh context window
/gsd:plan-phase 106 --auto       # planner spawns researcher (skip — CONTEXT.md is rich) + planner + checker
                                  # likely produces 5-7 plans across 3 waves
/gsd:execute-phase 106 --auto    # executor agents per wave; same parallel pattern as v1.12.4 push
```

After 106 ships:
- Bump version to v1.12.5 (or v1.13.0 if breaking — likely v1.12.5 since changes are additive)
- Tag + push
- Tester announcement (per `docs/testers/STYLE-GUIDE.md`): subject `/mos:v1.12.5 — Statusline that shows you what's happening`
- The statusline issue itself becomes a sentence in the Section 02 framing: "you can finally see what MindrianOS is doing while it does it"
