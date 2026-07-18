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

# SEED-067: Subscription passthrough -- forbidden BY ANTHROPIC, not universally

> **SCOPE CORRECTION 2026-07-18 (same day).** The original title and framing of this seed
> -- "subscription passthrough is contractually forbidden" -- was **too broad** and is
> corrected below. BYO-sub is forbidden **by Anthropic**. It is not forbidden by every
> vendor; GitHub Copilot is built for exactly this. The corrected framing changes the
> conclusion materially, so the original text is kept below the correction rather than
> silently rewritten.

## What's actually open

Two things:

1. **A capability-floor requirement** (see below) created by the navigator's decision to
   support both access models.
2. **Verification of two vendors** whose terms are unknown: GitHub Copilot (expected
   permissive, third-party editors use it routinely) and OpenAI Codex/ChatGPT (unknown
   whether subscription auth is open to third-party clients or locked to OpenAI's own
   binary by client-ID allowlist or attestation).

**Trigger:** immediate for (1) -- it is a design constraint on any access model.
(2) becomes blocking the day a fork is committed (SEED-063).

## The corrected finding -- BYO-sub is vendor-dependent

| Path | Verdict | Basis |
|---|---|---|
| **Anthropic Pro/Max** | **FORBIDDEN** | Explicit prohibition on third-party products routing requests through Free/Pro/Max credentials or offering Claude.ai login. Applies **regardless of who holds the subscription** -- BYO-sub does not escape it. Verified 2026-07-18. |
| **GitHub Copilot** | **LIKELY SANCTIONED -- UNVERIFIED** | Copilot is designed for third-party editors; BYO-sub appears to be the intended model. **Verify the terms before relying on it.** |
| **OpenAI Codex / ChatGPT** | **UNKNOWN -- UNVERIFIED** | Codex CLI signs in with a ChatGPT subscription; whether that path is open to third parties or locked to OpenAI's own client is not established. |
| **Local model (Ollama etc.)** | **NO CONSTRAINT** | No subscription, no vendor terms. Quality tradeoff only. Aligns with the Part 8 / no-egress posture. |
| **BYO API key** | **ALWAYS PERMITTED** | Metered. Works with every provider. No ToS grey area. |

## The observation that matters more than the table

**The one vendor that forbids BYO-sub is the vendor we are currently married to.**

That is not an argument against leaving the plugin runtime -- it is an argument *for* it.
Today Anthropic's terms are the only terms that apply to us, because Anthropic's runtime
is the only runtime we have. A model-agnostic harness (SEED-063) means we can choose a
vendor whose terms permit the access model we want to sell.

**Vendor-neutrality is not only about outages and churn. It is about which contracts we
are forced to live under.**

This also retires a cost worry raised earlier in the same session -- that forking would
push the navigator's own daily driving from flat subscription cost to metered API cost.
That assumed Anthropic. Drop the assumption and it may not hold.

## NAVIGATOR DECISION 2026-07-18 -- support BOTH, let the user pick at setup

Both BYO-key and BYO-sub, chosen at setup. Widest reach; hedges vendor risk.

**The cost of "both", stated plainly:** two auth paths to build, test, and support -- and
**the model roster differs by path.** Which means **Larry's behaviour varies with how the
user signed in.**

For a code tool that is tolerable. For a *teaching* product it is not. The methodology
assumes a model that can hold a reframe, earn a framework across several turns, and end
at a Decision Gate rather than a verdict (Canon Parts 10 and 12). On a weaker model that
degrades into precisely what the canon forbids -- framework-dumping and verdicts. **The
user will not blame the model. They will blame Larry.**

### Therefore: a declared CAPABILITY FLOOR is a hard requirement of this decision

1. **Name the minimum model** the full methodology actually works on. Measure it; do not
   assert it.
2. **Detect it at setup**, on both auth paths.
3. **Degrade honestly below it** -- surface a reduced capability set with an explicit
   statement of what is unavailable, rather than silently producing a worse Larry. This
   is the same honest-degrade discipline the gate ladder already applies when a client
   cannot render a card (`renderViaText`), and the same no-silent-skip rule the
   skill-optimization work uses.
4. **Do NOT** let the reduced surface include the methodology sessions. A half-working
   Lean Canvas is worse than a refusal that names the reason.

---

## ORIGINAL FINDING (kept for the record; scope corrected above)

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
