# Phase 159 -- Deferred Items

Items explicitly OUT of scope for Phase 159 (dial-closer-consumer-wire), recorded
per the SPEC Boundaries section so a later phase can pick them up.

| ID | Item | Why deferred | Reference |
|----|------|--------------|-----------|
| DI-159-01 | LIVE Desktop/Cowork conversational pick-capture | DCW-07: the consumer is shared core and the capture-adapter SEAM is documented (`docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md` + the exported `CAPTURE_ADAPTER_CONTRACT`), but the LIVE conversational capture for Desktop/Cowork is a follow-up. CLI is live + tested this phase. | SPEC DCW-07; `docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md` |
| DI-159-02 | Re-routing the ignite/B3 `closeReach` path through the shared consumer | HOW-1: producer + consumer were co-located in `offer-closer.cjs` for the smaller, lower-risk wire. `dial-close-reach.cjs::closeReach` is a SIBLING surface; re-routing it through `consumeF1Pick` is additive and only needed if a later phase requires it. | SPEC Boundaries; 159-CONTEXT HOW-1 |
| DI-159-03 | The dormant `_applyDecayWeight` command-rail (SC-04 / BLOCKER 2) | A separate latent follow-up untouched here. | SPEC Boundaries |
| DI-159-04 (finding) | Wire 3 validation: how often the live engine arm fires `reach_presented` | The live producer->consumer->penalty loop only runs on the active engine arm (`navigation-engine.cjs decide()` flips `routing_source` legacy->engine). If engine activation is rare in practice the live loop runs rarely. This phase PROVES the loop is correct end to end (the 2-turn integration test); it does NOT change engine-activation frequency. Not a blocker -- it bounds how often the live loop runs. | SPEC Constraints (Wire 3); 159-CONTEXT specifics |

## DCW-07 deferral (the seam contract is the hand-off)

The Desktop/Cowork capture-adapter seam is documented as a contract
(`docs/F1-PICK-CAPTURE-ADAPTER-SEAM.md`) and as the exported, frozen
`CAPTURE_ADAPTER_CONTRACT` constant in `lib/hmi/f1-pick-capture-cli.cjs`. A future
phase that wires LIVE Desktop/Cowork capture implements an adapter matching that
contract and feeds the SAME shared-core `consumeF1Pick`; no consumer change is
needed.
