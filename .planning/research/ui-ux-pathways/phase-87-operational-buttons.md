---
type: phase-spec
phase: 87
name: operational-control-surface
status: concept
depends_on: Phase 86 (localhost dashboard)
source: Session 2026-04-16 discussion
---

# Phase 87: Operational Buttons (Browser -> Claude Code)

## Goal

Add clickable action buttons to the localhost dashboard that trigger MindrianOS commands in Claude Code. Transform the browser from a passive viewer into an active control surface.

## Implementation tiers (ship in sequence)

### Tier v1: Clipboard bridge (ships with Phase 87)

User clicks a button in the browser. The button copies the MindrianOS command to the system clipboard. A toast notification says "Command copied -- paste in Claude Code to run."

```javascript
document.querySelector('[data-action="fill-gap"]').addEventListener('click', (e) => {
  const cmd = `/mos:analyze-needs --section ${e.target.dataset.section}`;
  navigator.clipboard.writeText(cmd);
  showToast(`Copied: ${cmd} -- paste in Claude Code`);
});
```

**Buttons to ship in v1:**
- [Fill Gap] on each empty or sparse section in the graph
- [Run Methodology] dropdown with the top methodology commands
- [File Meeting] for quick meeting filing
- [Build Thesis] when room has enough coverage
- [Export Deck] to generate a presentation

### Tier v2: Command queue file

Browser writes to `room/.mindrian/command-queue.json`. A Claude Code hook reads it:

```json
[
  {
    "id": "cmd-001",
    "command": "/mos:analyze-needs",
    "args": {"section": "market-analysis"},
    "queued_at": "2026-04-16T08:30:00Z",
    "queued_from": "dashboard",
    "status": "pending"
  }
]
```

UserPromptSubmit hook detects the queue and surfaces: "Dashboard queued: run JTBD analysis on market-analysis. Execute now?"

### Tier v3: RemoteTrigger (when available)

Browser POSTs directly to Claude Code's RemoteTrigger API. Command executes without user touching the terminal. Full seamless bidirectional control.

## Business model gate

Operational buttons are the candidate premium feature. Free tier: see everything (viewer). Paid tier: act on it (buttons). Decision deferred to GTM strategy -- see [[mindrian-gtm/gtm-strategy/bsl-1.1-ip-protection]].
