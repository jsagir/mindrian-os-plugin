---
phase: 77-obsidian-kit-welcome-doc
plan: 04
subsystem: obsidian-vault-export
tags: [vault, design-system, de-stijl, rules, obsidian]
requires:
  - lib/vault/room-scanner.cjs
provides:
  - scripts/vault-rules-generator.cjs
  - VAULT-RULES.md (generated at vault root)
affects:
  - Every exported Obsidian vault (adds canonical design system doc at root)
tech-stack:
  added: []
  patterns:
    - Static-template CJS generator (zero deps, idempotent)
    - CLI pattern mirrors vault-wikilink-injector.cjs (argv routing, JSON stats, --dry-run)
key-files:
  created:
    - scripts/vault-rules-generator.cjs
  modified: []
decisions:
  - Keep VAULT-RULES.md body fully static so re-runs are byte-identical (only roomName interpolated at footer)
  - Generator falls back to basename if scanRoom fails on sparse directories (robust to minimal test rooms)
metrics:
  tasks_completed: 2
  duration: single-session
  completed: 2026-04-12
requirements: [RULES-01, RULES-02, RULES-06, RULES-10]
---

# Phase 77 Plan 04: Vault Rules Generator Summary

De Stijl design system is now shipped as a canonical `VAULT-RULES.md` at the root of every exported Obsidian vault via `scripts/vault-rules-generator.cjs`, documenting color tokens, typography hierarchy, callout mapping, graph view rulings, and per-file-type formatting rules as a single human-and-agent readable contract.

## What Shipped

`scripts/vault-rules-generator.cjs` -- a standalone Node.js CJS script (220 lines, zero npm deps) that generates a canonical `VAULT-RULES.md` at the root of any Data Room vault. Invoke with `node scripts/vault-rules-generator.cjs <room-dir> [--dry-run]`. Matches the CLI contract of `scripts/vault-wikilink-injector.cjs`.

The generated `VAULT-RULES.md` contains 8 sections:

1. **De Stijl Color Tokens** (RULES-02) -- all 7 hex values (`#C83D2F`, `#2B5BA5`, `#E8A838`, `#4A9EAF`, `#4A8C5C`, `#8B5CF6`, `#6B6B6B`) with CSS variable names, semantic meanings, and section mappings.
2. **Typography Hierarchy** (RULES-06) -- H1 red underbar, H2 blue left bar, H3 gold text, H4 cyan uppercase with exact CSS treatments.
3. **Obsidian Callout Mapping** -- 8-row table mapping `[!warning]`, `[!tip]`, `[!quote]`, `[!info]`, `[!example]`, `[!success]`, `[!abstract]`, `[!important]` to semantic roles.
4. **Symbol Vocabulary** -- no raw terminal glyphs; Obsidian-native elements only.
5. **Formatting Rules per File Type** -- content artifacts, team profiles, meetings, xrefs, filed-to stubs.
6. **Graph View Ruling** (RULES-10) -- node sizing, edge colors by relationship type, labels, force layout (`linkDistance=180, repelStrength=12, centerStrength=0.4`).
7. **The Three Link Types** (ARCH-05) -- serendipity/structural/contradiction.
8. **File Type Contract** -- every directory has ROOM.md.

## Validation Evidence

Generator proven on a real directory (`/tmp/test-vault-rules-room`):

- **Output size:** 5,218 bytes
- **sha256 (run 1):** `d15ed31b482c46fafd64d247e45a193a7d1924088c7481eccdb410bc700ad803`
- **sha256 (run 2):** `d15ed31b482c46fafd64d247e45a193a7d1924088c7481eccdb410bc700ad803`
- **Idempotent:** CONFIRMED (byte-identical across runs -- no timestamps in body)
- **All 7 De Stijl hex tokens present:** CONFIRMED
- **`linkDistance=180` force layout param:** CONFIRMED
- **Callouts `[!warning]` and `[!success]`:** CONFIRMED
- **H1 rule `H1 = claim sentence`:** CONFIRMED
- **`${roomName}` interpolated at footer:** CONFIRMED (`test-vault-rules-room` appears in output)

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement vault-rules-generator.cjs with full De Stijl design system documentation | 909baa9 | scripts/vault-rules-generator.cjs |
| 2 | Create minimal test room and validate generator end-to-end | (validation-only, no new files) | - |

## Requirements Satisfied

- **RULES-01** (ship VAULT-RULES.md at root) -- generator writes file to room root via `fs.writeFileSync`.
- **RULES-02** (document De Stijl color tokens) -- section 1 table with all 7 hex values, CSS variables, semantic meanings, and section mappings.
- **RULES-06** (typography hierarchy enforced) -- section 2 table with H1/H2/H3/H4 rulings and CSS treatments.
- **RULES-10** (graph view ruling) -- section 6 table with node sizing, edge colors by relationship type, labels, and force layout params.

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED

- [x] `scripts/vault-rules-generator.cjs` exists at `/home/jsagi/.claude/plugins/mindrian-os/scripts/vault-rules-generator.cjs` (220 lines)
- [x] Commit `909baa9` exists in git log
- [x] Generator produces byte-identical output on consecutive runs (sha256 verified)
- [x] All 7 De Stijl hex tokens present in generated output
- [x] Typography hierarchy, callout mapping, graph view ruling sections all present
- [x] Zero npm dependencies (only `fs`, `path`, local `room-scanner.cjs`)
