# Owner ruling: C10 scope (2026-11-26)

Asked on a card in jsagi-42 (the owner's only terminal while away). Answer: "Both go to 400.3-06 (Rec.)".

BEGIN IMMEDIATE on BOTH index-path write sites (lazygraph-ops.cjs indexArtifact :654 and rebuildGraph :764) is owned by 400.3 plan 06. Phase 367 does not change either BEGIN line; the 367-03 diff gate enforces this. AC11 arms I1/I2 stay KNOWN-OPEN (400.3-06) until it lands. The planner reading in 367-03 (595e93353) is confirmed.
