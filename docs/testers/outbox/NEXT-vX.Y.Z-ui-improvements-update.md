---
type: tester-update-notice
version: TBD (likely v1.12.4 or v1.13.0)
status: placeholder (not yet drafted; phases not yet shipped)
ships_after_phases: [104, 88.2]
draft_protocol: pull from docs/testers/REGISTRY.md Active testers, BCC
---

# NEXT release update notice — placeholder

This file gets renamed to `YYYY-MM-DD-vX.Y.Z-update.md` and filled in when Phase 104 + Phase 88.2 ship.

## What ships in this release (planned)

### Phase 104 — Per-command JTBD consumption (the second wave)

The dependency layer shipped in v1.12.3 captured the operator + JTBD signal per turn. Phase 104 retrofits 80+ existing /mos: commands to actually USE that signal:
- Each command declares which JTBDs it serves (e.g. `/mos:find-bottlenecks` declares `serves_jtbd: [find-bottleneck, surface-contradiction]`)
- The selector library (Shape F.6 from v1.12.3) reads the declarations and tunes the next-move menu per command per active JTBD
- "Wrong guess?" override from v1.12.3 (`/mos:jtbd set ...`) now visibly changes 80+ commands' behavior

**User-facing impact:** the v1.12.3 promise ("suggestions match your actual job") becomes real across the whole methodology surface. Today setting a JTBD only affects the operator/memory layer; after Phase 104 it affects every methodology command.

### Phase 88.2 — Shape F.1 canonical picker (the UI polish)

The interactive picker that replaces today's legacy AskUserQuestion surface. Specifically:
- Shape F.1 picker uses the canonical 12-glyph + 5-color De Stijl vocabulary
- Mondrian-aware layout (matches the rest of the UI Ruling System)
- Keyboard-friendly selection
- Operator-aware option set (Phase 99 wires the source of truth)
- Confidence-gated RECOMMENDED markers (per Canon Part 3)

**User-facing impact:** every time Larry asks you to choose between options, the picker now looks like the rest of MindrianOS instead of the generic Claude Code AskUserQuestion. Same plumbing, polished surface.

## Email content draft (in plain English — to refine before send)

Subject draft: "MindrianOS [version] — Larry's suggestions are now job-aware end to end"

Body skeleton (3-benefit pattern from v1.12.3):

1. **Suggestions actually changed** — Set a JTBD with `/mos:jtbd set find-bottleneck` and watch /mos:explore-domains, /mos:rs-fetch, /mos:think-hats, /mos:hat-briefing each surface different next-move options. The substrate from last release is now load-bearing.

2. **The picker looks like the rest of MindrianOS** — When Larry asks you to choose between options, it now uses the De Stijl Mondrian vocabulary instead of the generic AskUserQuestion. Same workflow, polished surface.

3. **(third benefit TBD based on what else lands in the cut)**

## To draft when ready

1. Read `docs/testers/REGISTRY.md` Active testers (current list of 3, may grow by then)
2. Use Gmail MCP `create_draft` with `htmlBody` mirroring v1.12.3 De Stijl pattern
3. TO: jsagir@gmail.com, BCC: every active tester
4. Rename this file to `YYYY-MM-DD-vX.Y.Z-update.md`, update frontmatter `status: drafted` → `sent_YYYY-MM-DD`

## Reference

- v1.12.3 release notice: `outbox/2026-05-02-v1.12.3-update.md`
- v1.12.3 CHANGELOG entry: `../../CHANGELOG.md`
- Canonical Phase 104 plan dir (when filed): `.planning/phases/104-*/`
- Canonical Phase 88.2 plan dir: `.planning/phases/88.2-uiux-selector-block/`
