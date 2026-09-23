# Phase 356: Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 356-CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
**Mode:** advisor (USER-PROFILE.md present; calibration tier minimal_decisive; four parallel gsd-advisor-researcher agents on claude-opus-5-5)
**Areas discussed:** What Jev reads per command, How the answer key gets made, Shared Jev client timing, Policy text home and author
**Navigator directive mid-discussion:** "make sure it's aware of parallel session work, calibrated with any change to the Larry contract, and optimised for Theo work". Applied as a hard constraint to every research agent and recorded as D-11 to D-13.

---

## Policy text: home and author

| Option | Description | Selected |
|--------|-------------|----------|
| data/jev-policies JSON | One file per ledger, fields map to the Noul, hash over file bytes, Theo pin already includes data/. Claude drafts, navigator locks | ✓ |
| references/ markdown | Prose doctrine, navigator-written; no Jev builder reads references/, Theo pin excludes it, needs a parser | |

## How the answer key gets made

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Navigator labels a registry-picked risk subset blind (~15 min), reviews Claude pre-labels for the rest (~15 min); per-row label_source | ✓ |
| Fully blind, all 113 | Cleanest human ground truth; ~60-85 min, fatigue risk | |

## Shared Jev client timing

| Option | Description | Selected |
|--------|-------------|----------|
| Extract if missing | First executor extracts scripts/jev-devtime-client.cjs; 353 builder re-exports the same names; per-builder egress profiles | ✓ (plus "ask Theo") |
| Wait for 354-17 | Single extractor, but blocks 356 behind waves 1-6 of 354 | |

**Navigator's note:** First answered with his algorithm R&D site (https://mindrian-algorithm-rd.vercel.app/). On reading, it covers discovery algorithms, not Jev client design, so it was forwarded to Phase 355 (jsagi-d9). Second answer: "1 + ask theo". The Theo consult (the repo at /home/jsagi/Theo) found no Jev code in Theo, a pin of the plugin's spike sources, and a refuse-don't-strip, separated-by-construction egress design (Theo Phase 3), recorded as D-09.

## What Jev reads per command

| Option | Description | Selected |
|--------|-------------|----------|
| Registry blurb only | teaching + jtbd_summary (~70 tokens); bodies added zero true positives across the 48 safe-tagged commands | ✓ |
| Blurb + filtered body lines | Catches body-only effects; measured to add "deploy to Vercel" false alarms and churn stale entries | |

## Claude's Discretion
- Ledger and answer-key file names, hash encoding, builder CLI flags beyond the 353 mirror, runtime cache policy.

## Deferred Ideas
- Body-excerpt Jev input (only if a label disagrees with its blurb verdict)
- Registry autonomous_safe tag correction at the source
- Algorithm R&D briefing -> Phase 355 (forwarded)
