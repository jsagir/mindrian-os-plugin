---
name: agentshield
description: "Scan the plugin's own agent-config surfaces (MCP, hooks, skills, CLAUDE.md, supply chain) for known attack patterns"
help_jtbd: "Scan the plugin's own agent-config surfaces for known attack patterns before you trust a fresh MCP server, hook, or skill."
body_shape: E (Action Report)
hitl_shape: "none"
hitl_why: "A read-only security scan that reports per-surface status and takes no navigator decision, so it reaches no genuine fork (mirrors doctor as a deliberately-run diagnostic, but pure report with no repair gate)."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 2): first delivery at commands/agentshield.md:38, a per-surface status row (clean / ambiguous / flagged), the same shape as doctor's already-ruled diagnostic surface.
interactive_first_reward: "--none (diagnostic surface)"
body_shape_detail: per-surface status rows with [clean] / [N flagged] markers, a total-findings summary, one Feynman line per flagged finding
serves_jtbd: ["audit-room"]
teaching: "When you want to know whether the plugin's own MCP tools, hooks, skills, CLAUDE.md, and dependencies carry a known attack pattern, /mos:agentshield scans all five surfaces and reports what is clean and what is flagged. Larry runs the scan and explains any finding in plain English."
allowed-tools: [Bash, Read]
# --- Phase 199-05 CIRS R1 exclude (Canon Part 11) ---
# Born WIRED-or-EXCLUDED: this surface is declared EXCLUDED-with-reason, not left
# dark. It is a deliberately-run diagnostic (mirrors /mos:doctor's precedent), so
# it never reacts to a navigator problem-state and takes no reach on the spine.
connector:
  excluded: true
  reason: "Utility command. A deliberately-run security scan the navigator or release pipeline invokes on demand; it inspects the plugin's own config surfaces, it never reacts to a navigator problem-state (Part 11 R1 EXCLUDED-with-reason, mirrors /mos:doctor)."
---

# /mos:agentshield

Scan the plugin's own five non-Brain config surfaces -- MCP tool descriptions,
hook commands, skill files, CLAUDE.md permissions, and package.json dependencies
-- for known attack-class patterns. This is a deliberately-run security check, not
a background reaction: the navigator or the release pipeline invokes it on demand.

## Step 1: Invoke the agentshield skill

Invoke the `agentshield` Skill via the Skill tool, passing `$ARGUMENTS` through.
Do NOT hand-roll a bespoke dispatch script here -- routing through the Skill tool
is the CC-v1.19 currency requirement (SEED-016). The skill runs the shipped
orchestrator `runAgentShieldScan()` (Phase 199-04) and renders the Shape E Action
Report.

## Step 2: Render

Display the skill's Shape E Action Report directly. Do not re-format. Each surface
gets one status row: `[clean]`, `[N ambiguous]`, or `[N flagged]`. Every flagged
finding gets one Feynman line explaining, in plain English, what the attack class
means.

## When to suggest /mos:agentshield

- Before trusting a freshly added MCP server, hook, or skill
- As a release pre-flight (the doctor Class O acceptance point runs the same scan)
- After pulling plugin updates that changed `.mcp.json`, `hooks/`, or `package.json`
