# Phase 39: Model Profiles & Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 39-model-profiles-routing
**Areas discussed:** Profile Defaults, Dispatch Mechanism

---

## Profile Defaults

### Default profile for new rooms

| Option | Description | Selected |
|--------|-------------|----------|
| Balanced (Recommended) | Opus for teaching/grading, Sonnet for structured work, Haiku for scanning | |
| Quality | Opus everywhere except scanning. Higher cost but maximum reasoning quality. | x |
| Inherit | All agents use whatever model the user's session is running | |

**User's choice:** Quality
**Notes:** MindrianOS users want the best teaching experience. Quality as default prioritizes Larry's teaching quality.

### Global defaults inheritance

| Option | Description | Selected |
|--------|-------------|----------|
| Yes - ~/.mindrian/defaults.json | User sets once, all new rooms inherit | |
| No - always balanced | Every new room starts at balanced | |
| You decide | Claude's discretion | x |

**User's choice:** You decide
**Notes:** Claude has flexibility to design global defaults architecture.

---

## Dispatch Mechanism

### Model delivery to agents

| Option | Description | Selected |
|--------|-------------|----------|
| Command instructions (Recommended) | Commands resolve model, include in dispatch instructions. Agent frontmatter stays inherit. | x |
| Agent frontmatter swap | Dynamically rewrite agent .md before dispatch | |
| Settings.json per-agent | Store overrides in settings.json | |

**User's choice:** Command instructions
**Notes:** Matches GSD's proven pattern. Agent files remain clean.

### Cascade step model assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Script-level resolution (Recommended) | post-write calls model-profiles.cjs per step, passes as env/arg | x |
| Hardcoded in scripts | Each script has model tier hardcoded | |
| You decide | Claude's discretion | |

**User's choice:** Script-level resolution
**Notes:** Flexible, allows profile changes to affect cascade without script edits.

---

## Claude's Discretion

- Global defaults architecture
- Stage hint override behavior
- Config file location details
- /mos:models command UX

## Deferred Ideas

None
