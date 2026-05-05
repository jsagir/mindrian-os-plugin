---
type: out-of-repo-deliverable
phase: 115
target_repo: ~/mindrian-website/
target_url: https://mindrianos-jsagirs-projects.vercel.app
applied_post_merge: pending (manual action in CHANGELOG)
spec_string_source: lib/copy/115-spec-strings.cjs WEBSITE_HERO_TAGLINE
---

# Phase 115 Website Hero Rewrite (D-09 -- out-of-repo deliverable)

> **Out-of-repo:** the website source lives at `~/mindrian-website/` (independent of MindrianOS-Plugin). Phase 115 ships the COPY here as a deliverable. The actual edit lands in the website repo post-merge per `CHANGELOG.md` action item.

## Spec string (verbatim from `lib/copy/115-spec-strings.cjs` WEBSITE_HERO_TAGLINE)

> For founders stuck on a decision they can't name.

This is the SAME string as D-04 MARKETING_LINE and D-08 README_HERO_TAGLINE. Single source of truth: `lib/copy/115-spec-strings.cjs`. If that constant ever changes (e.g., D-20 rollback to fallback emotion #1), this file MUST also be updated AND re-applied to the website.

## Application steps (manual; user executes post-merge)

```bash
cd ~/mindrian-website/

# Find the hero file (likely in components/Hero.tsx, app/page.tsx, or similar)
grep -rn "co-founder\|PWS methodology" .  # current hero language to replace

# Edit the hero string to:
#   "For founders stuck on a decision they can't name."

# Commit + push to main
git add <hero file>
git commit -m "feat(hero): align with MindrianOS Phase 115 owned emotion"
git push origin main

# Vercel auto-deploys from main; verify at https://mindrianos-jsagirs-projects.vercel.app
```

## Pre-merge surface (in this repo only)

This deliverable file (`docs/copy/115-website-hero.md`) IS the in-repo verifiable artifact. The 8-surface grep test (115-04 plan) asserts this file exists and contains the WEBSITE_HERO_TAGLINE string -- proves the deliverable shipped on the MindrianOS-Plugin side.

Out-of-repo confirmation is a HUMAN UAT item (per `tests/manual/115-acceptance.md` -- visit `mindrianos-jsagirs-projects.vercel.app`, see hero is the new tagline). Not a bash test.

## CHANGELOG action item (115-04 plan adds this entry)

After v1.13.0-beta.3 release, the CHANGELOG.md entry includes:

```markdown
### Phase 115 -- post-merge action (manual)

After this release, apply the website hero rewrite from
docs/copy/115-website-hero.md to ~/mindrian-website/[hero file].
The website repo is independent; this is not auto-applied.
```

## Why not automate via gh

Per Open Question 3 in 115-RESEARCH.md: programmatic cross-repo edit risks committing under wrong author / wrong branch / mid-dev work. Manual handoff is one CHANGELOG line and one paste -- low friction. STAY MANUAL for v1.13.0-beta.3.

## D-20 rollback note

If validation week triggers rollback per `tests/manual/115-rollback-procedure.md` Step 3, the fallback WEBSITE_HERO_TAGLINE becomes "For founders with a pile of insights they can't see the shape of." This file is updated AND re-applied to the website repo as part of the rollback cascade.
