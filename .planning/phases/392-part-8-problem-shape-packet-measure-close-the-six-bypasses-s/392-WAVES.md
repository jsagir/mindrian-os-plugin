# Phase 392 wave ledger (branch work/part8-shape-packet)

STATE.md on this branch is the beta.81 copy and is left untouched on purpose: the main session jsagi-17 owns STATE.md on main, and this branch rebases onto it later (D-07). Wave progress for Phase 392 is kept here instead; the SUMMARY files carry duration, tasks and files per plan.

| Exec wave | Plans | Status | Commits (last) | Notes |
|---|---|---|---|---|
| 1 | 392-01, 392-02, 392-07 | DONE 2026-11-08 | 8fad4a01c, 4bbe5fc72, 095ebe36e | Baseline on beta.81: extended_blocked 8 of 535 (the audit's 37 was at f0df97036), must_refuse 10 of 10; vocabulary drift 89 checks, Theo five enums equal; Eureka deadline on 27 callTool sites, engine_timeout at the plugin deadline. |
| 2 | 392-03, 392-04, 392-08 | DONE 2026-11-08 | 2f60b82f9, dd2a3c2e8, a568221e7 | Unicode tokenizer plus NFKC and Cf normaliser (lazy, hook graph flat, LZ5 green); glued-paragraph caps 80/240 with typed reason; linear email regex (40,000 chars 8.1 s to 3 ms); shape builder from the room only, 83 checks, Theo seal shape. Matrix unchanged: 8 of 535, 10 of 10. Carried to 392-05 and 392-09: the sprout reason as a typed token class; the email form relies on the normaliser for wide gaps; a non-Latin letter now blocks by itself (392-03 deviation 1, fail closed) and 392-09 must decide whether the typed arm lets a non-Latin question through the lexicon and sprout rules instead of a script block. |
| 3 | 392-05 | DONE 2026-11-08 | bdcb4f9ce | Every string leaf of a payload is decided (sibling keys, arrays, brain_query params); carriesEdgeOrBody fails closed past depth 8 or 2,000 nodes in both modules (typed over_budget); shape_reason word_too_long / string_too_long on the sprouts_required verdict. Matrix unchanged 8 of 535, 10 of 10; 386 37/0, 392 12/0, hook graph flat. Carried to 392-09: the email form 4-plus whitespace gap; the non-Latin script block question. |
| 4 | 392-06, 392-10 | STARTED 2026-11-08 | | |
| 5 | 392-09 | | | checkpoint: jsagi-17 notice before the arm change; target: extended_blocked not above 8, must_refuse 10 of 10 |
| 6 | 392-11 | | | |
| 7 | 392-12 | | | |
| 8 | 392-13 | | | |
| 9 | 392-14 | | | checkpoint: Canon Custodian |
| 10 | 392-15, 392-16 | | | |

Owner action queued: label the 87 unique real-call inputs at /home/jsagi/.mindrian/part8-replay/real-calls.jsonl (legitimate, not, unknown) and pass the map as --labels to the replay (outside the repo).
