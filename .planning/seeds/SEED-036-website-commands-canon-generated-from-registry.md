---
seed: SEED-036
slug: website-commands-canon-generated-from-registry
title: Website commands-canon.json should be GENERATED from the plugin command-registry (kill the hand-sync drift)
status: dormant
created: 2026-06-19
captured_during: v1.14.0-beta.3 release ceremony (manual website command refresh exposed the drift)
disposition: fold into the release.sh website step OR a standalone sync script; next website content pass
canon_parts: [6, 7, 8]
bundle: none
related: [SEED-006 (mindrian-wiki-sprint-the-visible-room), SEED-024 (brain-as-orchestration-graph-framework-tiers)]
depends_on_shipped: [122 (workflow-layer: data/command-registry.json + build-command-registry.cjs generator + --check tripwire), 143.3 (connector-registry generator precedent)]
---

# SEED-036: website commands-canon.json GENERATED from the plugin command-registry

## The drift (observed 2026-06-19)

During the v1.14.0-beta.3 release ceremony, the website command list (`mindrian-website/website/src/data/commands-canon.json`) had to be updated BY HAND to add the new v1.14.0 commands (`/mos:bono`, `/mos:trending-to-absurd`, `/mos:futures`, `/mos:new-surface`, `/mos:correct-reference-now`) and to move its displayed total to 99. The website renders the docs/commands page from this hand-maintained JSON (`data.groups.reduce((n,g)=>n+g.commands.length,0)` = the displayed count).

This is a drift-prone two-source-of-truth: the plugin already OWNS the authoritative command set in two generated places, and the website carries a third, hand-edited copy that nobody regenerates.

- Plugin source of truth: `commands/*.md` frontmatter (name / description / argument-hint / serves_jtbd / help_jtbd / teaching).
- Plugin generated artifact: `data/command-registry.json`, produced by `scripts/build-command-registry.cjs` with a `--check` tripwire wired into pre-commit + the Feynman runner (Phase 122 workflow-layer). The registry is regenerated, never hand-edited.
- Website artifact (the drift): `commands-canon.json`, hand-edited. No generator, no `--check`, no lockstep. It silently goes stale every time a command is added/renamed/removed in the plugin.

The same class of bug this release already bit twice: the `/mos:new-surface` empty-frontmatter bug (caught only by the release gate) and the STATE/ROADMAP milestone drift. Hand-maintained mirrors of a generated truth always rot.

## The fix

Generate the website `commands-canon.json` from the plugin's `data/command-registry.json` (the single source of truth), so the website command list can never drift from what the plugin actually ships.

Two viable shapes (pick at scoping):

1. **A sync generator** (preferred, mirrors the Part 7 reuse posture): a small script (sibling of `build-command-registry.cjs` / `build-connector-registry.cjs`) that reads `data/command-registry.json`, maps each command into the website's grouped canon shape (group by `serves_jtbd` / the existing 11-group clustering), preserves the curated group titles + ordering, and writes `commands-canon.json`. Add a `--check` tripwire so CI/pre-commit fails loud when the website canon is stale vs the registry.

2. **A release-step hook**: extend `scripts/release.sh` Step 9.6b (the website reconcile, currently FALLBACK_VERSION-only) to ALSO regenerate `commands-canon.json` from the registry and commit it as part of the website deploy, so a release physically cannot ship a stale website command list.

Either way: the website command list becomes a projection of the plugin registry, not a parallel hand-edited file. Count, names, and descriptions stay in lockstep by construction.

## Why a seed (not an immediate phase)

- The website lives in a SEPARATE repo (`mindrian-website`), so the generator either runs cross-repo at release time or ships as a website-repo script that pulls the published registry. That cross-repo boundary is a real design choice worth deliberating, not rushing.
- The grouped/curated shape (11 groups, hand-chosen titles + ordering) must be PRESERVED, not flattened. The generator needs a group-mapping policy (likely keyed on `serves_jtbd` plus a small curated override map). That mapping is the load-bearing design work.
- No user is blocked today: the website is correct as of v1.14.0-beta.3 (manually reconciled). The cost is recurring maintenance + silent-staleness risk, which is exactly what a seed is for.

## Trigger

Fires at the next website content pass, OR the next release where a command set change would otherwise require a manual website edit. Whichever comes first. Co-evaluate with SEED-006 (the visible-room wiki) since both are website-surface generation from room/plugin truth.

## Acceptance (when promoted)

- `commands-canon.json` is produced by a generator from `data/command-registry.json`; zero hand edits to the command list thereafter.
- A `--check` tripwire fails when the website canon is stale vs the plugin registry (mirrors `build-command-registry.cjs --check`).
- The curated 11-group titles + ordering are preserved (the generator maps, it does not flatten).
- The displayed total equals the real plugin command count by construction (no hardcoded number).
- Part 8 holds trivially: the registry carries only generic command metadata (slugs, descriptions, jtbd tags), never user content.

## Breadcrumbs

- Plugin generator precedent: `scripts/build-command-registry.cjs` + `data/command-registry.json` + its pre-commit `--check` (Phase 122 workflow-layer).
- Connector generator precedent (same idiom): `scripts/build-connector-registry.cjs` + `data/connector-registry.json` (Phase 143.3).
- Website consumer: `mindrian-website/website/src/app/docs/commands/page.tsx` (renders `data.groups[].commands`); data file `website/src/data/commands-canon.json`.
- Release website step to extend: `scripts/release.sh` Step 9.6b (website FALLBACK_VERSION reconcile).
- Memory rule alignment: `feedback_version_bump_website_facts_reconcile` (fact-check hand-typed website surfaces after a bump) -- this seed eliminates the hand-typed command surface entirely.
