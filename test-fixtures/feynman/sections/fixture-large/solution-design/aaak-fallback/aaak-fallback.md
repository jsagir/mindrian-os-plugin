---
type: artifact
title: AAAK tier-0 fallback
created: 2026-04-14
---

# AAAK tier-0 fallback

When the generator is invoked from a bare shell with no Claude session in the loop, the tier-0 path activates. It falls through to the pre-phase-81 deterministic renderer plus an AAAK compression footer.

The AAAK library was built earlier in the same session that produced this phase. Twenty-one passing tests protect the compression primitive against regression. Nothing modifies it.

The tier-0 path is not a second-class citizen. It is the unconditional baseline that keeps cron jobs and headless scripts working when no reasoner is available.
