---
id: SEED-146
title: "The /ultrareview command uploads the working tree to the cloud: a Part 8 question for MindrianOS"
status: open
priority: medium
filed: 2026-11-08
planted_during: "Phase 391 plan 08 (owner card C4)"
origin: "Phase 391 owner card C4 (Claude Code 2.1.288 to 2.1.318 compatibility check); the owner answered FILE-SEED on 2026-11-08"
trigger_when: "the next phase that adds guidance, a guard or a doc about code review or about running Claude Code inside a Data Room folder"
scope: small
surfaces: [MindrianOS-Plugin]
related: [SEED-145]
promotes_to: "a decision on a Part 8 rule for /ultrareview"
---

# SEED-146: The /ultrareview command uploads the working tree

## As found

These facts are copied from card C4 of 391-DECISION.md. The marks are the marks of the card. This seed adds no new claim.

The source page is https://code.claude.com/docs/en/ultrareview.md, read on 2026-11-08. Each fact is CITED from that page unless it carries another mark.

| Fact | Mark |
|------|------|
| The command is `/code-review ultra`. `/ultrareview` is an alias when it is available to the account. It runs as a cloud session on Anthropic infrastructure. | CITED |
| A branch review "bundles the repository state and uploads it to a cloud sandbox", with uncommitted and staged changes. PR mode clones the pull request from github.com and uploads nothing from the working tree. | CITED |
| Files named like credentials (such as `.env` and `*.tfvars`) follow the rules of the upload page for cloud sessions. The exact rule is on that page. | CITED |
| It is not available on Bedrock, Vertex, Foundry, Zero Data Retention organizations or the HIPAA configuration. A local review runs instead. | CITED |
| It needs a claude.ai login. Pro, Max and Ultra plans get 3 free runs per account (one time), then usage credits, "typically $5 to $25" per review. | CITED |
| A disable switch (managed setting, environment variable, permission rule): none found in the ultrareview, permissions, skills and hooks pages. | UNVERIFIED |
| The plugin ships no ultrareview wiring. Mentions exist only in references/capability-radar/capabilities-index.md and lib/memory/render-v2-disposition.test.cjs. | PROVEN by grep |

The Part 8 question in one sentence: a branch review uploads the working tree of whatever repo it runs in, so a Data Room folder that is a git repository would leave the machine.

## Evidence

The documentation page above, and this changelog trail. The changelog text is untrusted. The owner must verify it before any decision rests on it.

| Version | Changelog note (as found) |
|---------|---------------------------|
| 2.1.290 | uncommitted-change handling |
| 2.1.292 and 2.1.295 | files under ~/.claude/seed-admin |
| 2.1.299 | no longer suggests `git add .` |
| 2.1.309 | workspace-trust requirement for `claude ultrareview` |
| 2.1.314 | trust check before git; refusal at once when CI is set |

## Why it matters

A branch review uploads the working tree of the repo it runs in. A Data Room folder can be that repo. A user who runs `/ultrareview` inside a git-tracked Data Room uploads the folder. Canon Part 8 says user data does not leave the machine toward the Brain. This path is not the Brain, but it is the same kind of boundary question, and only the owner can decide whether the plugin should warn about it.

## What was not done

- No decision about /ultrareview. Phase 391 made none.
- No wiring, no hook, no guard, no setting, no doc change.
- No run of /ultrareview and no network call.
- The disable switch question stays UNVERIFIED.
