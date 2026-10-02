# Phase 369: UI shell, an agent-native app over the MindrianOS MCP server - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-10-02
**Phase:** 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server
**Areas discussed:** Styling and reach (Q4, Q9, Q11, Q14); the other three areas locked at the third-pass defaults by navigator choice
**Mode:** advisor (USER-PROFILE present), calibration tier minimal_decisive (profile Vendor Philosophy: opinionated), outcome-first framing on (profile learning style: guided), one research agent (gsd-advisor-researcher, repo evidence only, no web)

---

## Pre-step: which todos fold

| Option | Description | Selected |
|--------|-------------|----------|
| Registry-drift gate keyed to F-shape | 2026-07-03 todo; touches the gate contract the web button renders | ✓ |
| Mirror gate_render description fix into Theo | 2026-09-07 todo; Theo-side copy of the shared gate contract | ✓ |
| F7 rescope 212/213 against registerCapability | 2026-07-08 todo; the capability ladder where the CLI rung lives | ✓ |
| None: reviewed, none fold | all nine recorded as reviewed | |

**User's choice:** fold the three gate-machinery todos (first card returned all three plus "None" selected together; re-asked as a single-select, navigator confirmed the three folds).
**Notes:** the other six matches (git stash, Brain ingest, deck slide count, autonomous_safe audit, SENS-05 mirror, Jev ledger) were keyword noise and are listed as reviewed in CONTEXT.md.

---

## Pre-step: which areas to discuss

| Option | Description | Selected |
|--------|-------------|----------|
| Which codebase wins (the chassis bake-off, Q1) | workroom vs agent-native by one slice built twice; default workroom provisional | |
| What the first open feels like (Q6, Q7, Q12, Q13) | review-and-decision v1, task-centered IA, opening screen, tiles as illustration | |
| Who may press what (Q3, Q5, deliverable 10) | adapter proof first, exposure policy, human origin by browser-bound session, 289 first | |
| Styling and reach (Q4, Q9, Q11, Q14) | v3 shell only, keep MCP Apps, localhost v1, co-design the indicator | ✓ |

**User's choice:** Styling and reach only.
**Follow-up card:** "Lock the other three areas at their third-pass defaults?" Options: Yes, lock them (Recommended) / Reopen one area. **Chosen:** Yes, lock them. Q8 (TypeScript timing) and Q10 (realtime v1) were presented as pre-answered by evidence and not reopened.

---

## Styling and reach

Research (repo evidence; files read: 369-INPUT.md, skills/ui-system/SKILL.md, lib/mcp/app-views.cjs, lib/mcp/app-html/dashboard.html and mindrian-platform.html, docs/research/MCP-APPS-STRATEGIC-RESEARCH.md, docs/STATUSLINE-CONTRACT.md, docs/reviews/2026-09-20-localhost-workspace-review.md, the prior-art inventory, mindrian-website DESIGN-CANON.md) backed all four defaults; Q11 was settled without a card.

### Q4: where Canon v3 applies

| Option | Description | Selected |
|--------|-------------|----------|
| Shell only, scoped SKILL.md amendment | v3 governs the new shell; SKILL.md gains a dated exception requiring bundled fonts and scripts, no outside hosts; v1.1 generators untouched; plugin-wide reconciliation later | ✓ |
| Restyle the whole plugin to v3 | one palette everywhere inside 369; 10+ generators and shared CSS change; heavier release | |

**User's choice:** Shell only, scoped SKILL.md amendment.
**Notes:** SKILL.md lines 18-25 make the amendment mandatory, not optional (every HTML surface inherits v1.1 by default). C10 (CDN) closes for the shell by bundling the three typefaces.

### Q9: the three MCP Apps and the orphan page

| Option | Description | Selected |
|--------|-------------|----------|
| Keep, share later, park the orphan | the three views stay the Desktop/Cowork face; components shared once the shell is proven; mindrian-platform.html gets a dated parked header; dark-theme and CDN debt filed as a seed | ✓ |
| Rebuild the apps on the shell's components | one codebase now; needs a build inside the host frame's limits; risks the only working Desktop/Cowork surface | |

**User's choice:** Keep, share later, park the orphan.
**Notes:** app-views.cjs registers exactly three views; surface-detect.cjs turns them off on the CLI, so the apps and the shell never compete on one surface. The "Tier 1 is the product" plan (C12) retires as the main investment.

### Q11: reach in v1 (settled by evidence)

No card. Three binding sources agree on CLI/localhost v1 with honest unsupported messaging elsewhere: the 2026-09-20 review line 164, SEED-067 (no subscription passthrough), SEED-073 (filesystem plus room.db canonical). Hosting with a tenant DB is a later phase.

### Q14: the session indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Co-design under the statusline rule | a design gate inside 369 starting from the four STATUSLINE-CONTRACT tiers; signed design note; one component | ✓ |
| Agent designs it inside v3 rules | no gate; repeats the solo pick the rule exists to stop | |

**User's choice:** Co-design under the statusline rule.

### Close

| Option | Description | Selected |
|--------|-------------|----------|
| Create context | write CONTEXT.md and DISCUSSION-LOG.md, commit --only | ✓ |
| Revisit an area | reopen one of the four | |

---

## Claude's Discretion

Plan order inside wave 0; `room_changes` paging shape within the contract; the UI package's module system (ESM) stated explicitly at plan; the bake-off measurement harness within the judged list; wording of the Desktop/Cowork line and the SKILL.md exception.

## Deferred Ideas

Plugin-wide v1.1/v3 reconciliation; rebuilding MCP Apps on shell components; MCP App dark-theme and CDN debt seed (C10, C11); hosted tenant deployment with its own model key; Cowork multi-user WebSockets; the executable workspace loop; governed BlockNote editing; first-class graph view (SEED-026); the single-description registry pattern (SEED-106 item 7); the navigator's own spike 007 click test.

## Process notes

- The todo card's first return carried contradictory selections (all three folds and "None"); resolved by a single-select re-ask.
- One AskUserQuestion was cancelled by an accidental press and re-issued unchanged.
- STATE.md was NOT written by this session: the workflow's `state.record-session` would overwrite `stopped_at` (held by the Phase 366 peer session) and the two-session collision rule forbids state writes while a peer executes. The exact command is handed to the navigator in the close-out.
