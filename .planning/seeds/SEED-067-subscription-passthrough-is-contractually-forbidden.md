---
kind: seed
status: open
severity: high
created: 2026-07-18
canon_parts: [10, 11]
related: [SEED-063 (OpenCode host runtime), SEED-062 (the engine gap), SEED-065 (MCP ceiling)]
proving_case: "Verified 2026-07-18 during the host-runtime survey. Claude Code carries no OSS licence at all (all-rights-reserved, Anthropic Commercial Terms) and explicitly prohibits third-party products from routing requests through Free/Pro/Max credentials or offering Claude.ai login. The Claude Agent SDK authenticates by ANTHROPIC_API_KEY only -- there is no bring-your-own-subscription path in the SDK."
source: "Emerged while testing the claim that shipping a CLI would widen MindrianOS's addressable market. It does not. This seed records the correction, because the original claim was made in this same session and was wrong."
---

# SEED-067: Subscription passthrough is contractually forbidden -- pricing must assume BYO-key

## What's actually open

A pricing and packaging decision that has been made implicitly and needs to be made
deliberately.

**Trigger:** immediate. This constrains any distribution plan from now on, including the
current plugin.

## The finding

MindrianOS **cannot** offer "use your existing Claude subscription."

- Claude Code carries **no OSS licence** -- all-rights-reserved under Anthropic
  Commercial Terms -- and explicitly prohibits third-party products from routing requests
  through Free/Pro/Max credentials or offering Claude.ai login.
- The Claude Agent SDK authenticates by `ANTHROPIC_API_KEY` only. There is no
  subscription login path.

This is a **contractual** limit, not a technical one. No harness choice changes it. It
holds for the current plugin, for an Agent SDK build, and for an OpenCode fork.

## The two remaining options, and neither is free

1. **User brings an API key.** Setup friction at first run -- the worst possible moment
   for churn, before any value has been demonstrated. Larry's whole first-touch design
   (Canon Part 10, the 30-second MVA reward) assumes the user is already in a working
   session.
2. **We eat inference and bill for it.** That is not a repackaging decision. It is a
   **different business model**: gross margin now moves with token spend, and every
   product decision that increases context or agent fan-out has a direct COGS
   consequence.

## Correction recorded

Earlier in the same session it was claimed that shipping a CLI "widens the market to
anyone with a terminal." **That was wrong.** A binary swaps *"must install Claude Code"*
for *"must have an API key, and we own packaging, updates, and auth."* For a commercial
product that may be **worse** friction, not better.

**Distribution was struck from the reasons to leave the plugin.** The remaining honest
reasons are headless/cron capability and runtime sovereignty -- see SEED-062, SEED-063.

## What this changes about the harness argument

The sovereignty case is narrower than it first appeared, and worth stating precisely:

- We would still depend on Anthropic **as a model vendor** -- but that is a *commodity*
  dependency, swappable for a local model or another provider.
- What changes is that we stop depending on Anthropic **as a runtime** -- hooks, cards,
  the Skill tool, the plugin loader, command registration. That is not swappable, and
  when it churns we are down.

**Runtime lock-in is captivity. Model lock-in is a supplier relationship.** That
distinction, not distribution, is the real argument for SEED-063.

## Do NOT

- Price or position MindrianOS on an assumption that users bring a Claude subscription.
- Treat "ship a binary" as a distribution win without first deciding which of the two
  options above we are choosing, and modelling its margin.
