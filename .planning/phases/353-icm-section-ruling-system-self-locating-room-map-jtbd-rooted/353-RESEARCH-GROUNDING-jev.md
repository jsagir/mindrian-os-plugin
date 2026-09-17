# Phase 353 grounding - Jev (TypeSafe) on the section job canon, OQ-353-1 (2026-09-17)

What crossed the wire: the section slug, the shipped template's `One job:` sentence (plugin-distributed text, `templates/room-skeleton/section-contracts/*.md`; personas has no template, so a draft gloss was sent and is marked as such), and the 16 job ids of `data/command-registry.json`'s `serves_jtbd` vocabulary with one-line glosses written for this probe. No room content, no Theo rows, dev-time key only, from the operator's shell. Script and raw answers: session scratchpad `jev-section-canon.cjs`, `jev-section-canon.raw.json`, `jev-section-canon.table.md` (not committed; the table below is the record).

Model served: `jev-1.13.0`. Question shape: one `choice` over the 16 jobs ("which job does this section exist to do FIRST") plus one `noul` ("does the statement describe exactly one job"). Usage per call as returned: about 710 input / 186 output tokens. Latency per call as measured: 270-1129 ms (first call cold at 876 ms).

## The table (Jev's answer per section)

| section | Jev primary job | confidence | top-3 probabilities | noul (single job?) | latency |
|---|---|---|---|---|---|
| problem-definition | find-problem | 99% | find-problem 100% | 0.48 | 270 ms |
| market-analysis | understand-market | 100% | understand-market 100% | 0.30 | 299 ms |
| team-execution | plan-execution | 97% | plan-execution 98%, file-meeting 2% | 0.19 | 355 ms |
| personas (draft gloss) | understand-market | 93% | understand-market 93%, build 3%, file-meeting 2% | 0.62 | 328 ms |
| strategy | find-bottleneck | 64% | find-bottleneck 67%, explore 33% | 0.14 | 364 ms |
| competitive-analysis | understand-market | 58% | understand-market 62%, validate-idea 18%, decide-pursue 16% | 0.14 | 1129 ms |
| legal-ip | audit-room | 58% | audit-room 60%, file-meeting 20%, surface-contradiction 6% | 0.22 | 313 ms |
| funding | plan-execution | 50% | plan-execution 53%, navigate 30%, build 5% | 0.52 | 302 ms |
| opportunity-bank | explore | 39% | explore 44%, decide-pursue 27%, file-meeting 15% | 0.43 | 313 ms |
| financial-model | audit-room | 26% | audit-room 32%, validate-idea 23%, file-meeting 14% | 0.30 | 298 ms |
| solution-design | file-meeting | 26% | file-meeting 31%, compare-options 30%, build 19% | 0.41 | 451 ms |
| business-model | validate-idea | 19% | validate-idea 25%, prepare-pitch 24%, file-meeting 15% | 0.18 | 876 ms |

## Reading (what the planner takes from this)

1. **Four sections have an unambiguous job in today's vocabulary** (confidence 93-100%): problem-definition -> `find-problem`; market-analysis -> `understand-market`; team-execution -> `plan-execution`; personas -> `understand-market`. These rows can enter the canon as-is, pending the navigator's one ratification.
2. **Two sections are clear with a declared secondary**: strategy -> `find-bottleneck` first, `explore` second (the template statement itself names both: "work the futures and the bottlenecks"); competitive-analysis -> `understand-market` first, `validate-idea` second. The ruling document's part 2 (methodology sequence) should carry the secondary as the second block of the sequence, not drop it.
3. **Four sections expose a vocabulary gap, not a section problem** (confidence 19-32%): business-model, financial-model, legal-ip, solution-design. Their jobs (model how the venture makes money; hold the numbers and what breaks them; hold the legal structure and what is protected; hold the solution and why each choice was made) have no member in the 16-job vocabulary, which was built for COMMANDS, not sections. Jev's low confidence and flat distributions are the honest signal; forcing `audit-room` onto legal-ip or `file-meeting` onto solution-design would put a wrong job on the folder's identity.
   Options for the planner (OQ-353-1), in order of preference: (a) extend the vocabulary by exactly the jobs the sections need, as new `serves_jtbd` members that commands may also adopt (`model-business`, `model-finances`, `protect-assets`, `design-solution`), keeping the vocabulary closed and shipped; (b) map each to its closest command job with the secondary declared and a `vocabulary_gap: true` flag on the canon row so the doctor can report it; (c) leave the four undeclared and fall back to the parent. (a) is recommended: it is a data change with no runtime cost, and the ledger build simply has fewer command rows for those jobs until commands declare them.
4. **`noul` is low on most statements**; it is reported raw here without interpretation beyond the question asked ("does the statement describe exactly one job"). Several templates join two clauses with "and" ("hold who does the work, who advises it, and what happens next"); if the planner tightens any `One job:` sentence, it should re-run this probe on that sentence only.
5. **Cost of the canon probe** (sourced from the returned usage): 12 calls, about 8.5k input and 2.2k output tokens in total. Small enough to re-run at every release next to the ledger build, so the canon and the ledger are scored by the same model version and stamped together.

## What this does NOT ground

- Which frameworks or commands serve each job (that is the ledger build, Plan 2, over Theo's framework rows with the Spike 002 rubric).
- The confidence floor for the runtime filter (WD-353-1); this probe's confidence is over a 16-way choice and is not the ledger's score scale.
- Anything about a real room: no room was read.
