# Phase 355 Verification Record

Phase 355: Hidden in Plain Sight, the Jev-through-Theo cross-connection engines. Sections generated from a machine record say so at their top; verifiers add their own sections after them.

## Hit-rate record (SPEC Req 7)

<!-- Regenerate with node scripts/measure-355-hit-rate.cjs record; verifiers append below, never overwrite this section. -->

This is the first time anyone has measured whether the connection engines show a person something worth reading. The navigator read every pairing the engines showed on three small practice rooms and answered three yes / no questions about each one: is this useful, is the named direction right, and did I already know this. Every number below is computed by code from those answers. The machine source is `tests/fixtures/355-rooms/hit-rate-record.json`; `node scripts/measure-355-hit-rate.cjs --check` recomputes it from the raw files and fails if a single value differs. No live room was read or written: the measurement script refuses any room path outside `tests/fixtures/355-rooms/`, and every engine ran on a temporary copy.

### Rooms and producers

| Room | Shape | Producers that ran | Shown pairings |
|---|---|---|---|
| `room-ill-defined` | an ill-defined problem (rural clinics losing patients between referral and follow-up) | hsi, rs, eureka: substrate_unavailable | 32 |
| `room-extend` | the extend-the-opportunity step (a working cold-chain delivery service looking at an adjacent use) | hsi, rs, eureka: substrate_unavailable | 26 |
| `room-control` | four deliberately distant domains with planted meaning bridges and planted same-word cases | hsi, rs, eureka: substrate_unavailable | 38 |

The pairings are what HSI and the reverse-salient engine showed, at most 30 per producer per room, with a similarity floor of 0.2 applied the same way to every room (the engines' own default is 0.3; the lower floor was needed to reach 20 shown pairings per room). The encoder was `MongoDB/mdbr-leaf-ir`. Eureka showed nothing: these rooms are plain markdown with no extracted entities, so its substrate was unavailable, and the record says so instead of guessing a ranked pair. Pairings were deduplicated across producers, so 96 distinct pairings were judged in total.

One labeler, the navigator, judged every pairing twice. Sitting 1 was blind: the pairing with no stamp (96 judged, finished 2026-09-24T16:23:28.824Z). Stamps were computed only after sitting 1 was committed. Sitting 2 showed the same pairings shuffled, now with their stamp lines (96 judged, finished 2026-09-24T20:28:04.600Z). No pairing appeared only in the stamped pass (0 stamped-only pairings).

### Hit rate

"Useful" means the navigator said yes to "is this useful" in the blind sitting. The 95% Wilson interval is the range of true rates that could plausibly produce the count we saw; a small count gives a wide range, which is the honest shape of a first measurement.

| Scope | Useful / judged | Rate | 95% Wilson interval |
|---|---|---|---|
| `room-ill-defined` | 21 / 32 | 65.6% | 48.3% to 79.6% |
| `room-extend` | 15 / 26 | 57.7% | 38.9% to 74.5% |
| `room-control` | 7 / 38 | 18.4% | 9.2% to 33.4% |
| **Pooled** | 43 / 96 | 44.8% | 35.2% to 54.7% |

Per stamp tier (blind sitting-1 labels joined to the stamps by pair id, so the stamp could not anchor the label):

| Tier | Useful / judged | Rate | 95% Wilson interval |
|---|---|---|---|
| strong | 7 / 13 | 53.8% | 29.1% to 76.8% |
| indirect | 0 / 1 | 0.0% | 0.0% to 79.3% |
| unverified | 36 / 82 | 43.9% | 33.7% to 54.7% |

Strong-tier pairings were judged useful 7 of 13 (53.8%, 95% Wilson 29.1% to 76.8%), against the unstamped baseline of 44.8%. The strong interval does not sit above the baseline, so, in the words of AI-SPEC Section 6, the tier carries no measured information yet. The tier rule is not changed in this phase; the result goes to the next engine phase's discussion.

Per producer (blind):

| Producer | Useful / judged | Rate | 95% Wilson interval |
|---|---|---|---|
| hsi | 27 / 47 | 57.4% | 43.3% to 70.5% |
| rs | 16 / 49 | 32.7% | 21.2% to 46.6% |

### Unstamped baseline

The unstamped baseline is the rate on today's raw engine output with no stamp in sight: sitting 1 over all 96 shown pairings, 43 of 96 (44.8%, 95% Wilson 35.2% to 54.7%). It is the same number as the pooled rate above, on purpose: every shown pairing was judged blind, so the pooled blind rate is the baseline, and each tier rate is a slice of that same blind judging. A tier rate is read against this baseline, never against zero.

### As-shown rate and stamp influence

Sitting 2 showed the same pairings again, shuffled, each with its stamp lines. The as-shown useful rate is 42 of 96 (43.8%, 95% Wilson 34.3% to 53.7%). The gap between the as-shown rate and the unstamped baseline is -1.0 percentage points. That gap measures how much seeing the stamp moved the reader. It is not a measure of usefulness, and the tier rates above never use sitting-2 labels.

| Tier | Blind useful rate | As-shown useful rate | Gap |
|---|---|---|---|
| strong | 7 of 13 (53.8%, 95% Wilson 29.1% to 76.8%) | 6 of 13 (46.2%, 95% Wilson 23.2% to 70.9%) | -7.7 percentage points |
| indirect | 0 of 1 (0.0%, 95% Wilson 0.0% to 79.3%) | 0 of 1 (0.0%, 95% Wilson 0.0% to 79.3%) | +0.0 percentage points |
| unverified | 36 of 82 (43.9%, 95% Wilson 33.7% to 54.7%) | 36 of 82 (43.9%, 95% Wilson 33.7% to 54.7%) | +0.0 percentage points |

Per pairing, the two sittings agreed on useful 93 of 96, on direction 93 of 96, and on already known 95 of 96. Useful answers moved from no to yes on 1 pairing and from yes to no on 2 pairings. Two cautions travel with this: most pairings (82 of 96) carried an unverified stamp, so for most of them the stamp line said only "verify with a domain expert"; and sitting 2 was taken in the same session as sitting 1 (see Disclosed limitations), so memory of the first answers may have held the second ones steady, which would make the influence look smaller than a later sitting would show.

### Stamp mix and not_called share

| Tier | Stamped pairings |
|---|---|
| strong | 13 |
| indirect | 1 |
| unverified | 82 |

Unverified share: 85.4% of stamped pairings. Reasons behind the unverified stamps:

| Reason | Count |
|---|---|
| `handle_unresolved` | 77 |
| `no_lateral_relation` | 1 |
| `no_path_within_3_hops` | 4 |

The not_called share is 80.2%: for those pairings at least one side did not carry a canon Framework name under the D-48 exact-match rule (frontmatter `framework:`, then `methodology:` through the command registry, then the title), so Theo was never asked. That is a vocabulary gap between room prose and canon names, noted for the later Terminology Translation work, not a Theo outage. Where Theo was asked and found no lateral path, that is a canon-coverage finding for Theo (T-3), sent upstream with counts only.

### Hub inflation, provenance routing and diversity

Degree source: in-sample proxy: interior-node frequency across the strong paths in this record, top decile (no governed Theo call returns node degree). Hub-inflation share: 4 of 13 strong stamps (30.8%) have a path interior that crosses a top-decile node. Top-decile interior nodes: "PWS Value Proposition" (4). A high share would mean a strong stamp mostly certifies one shared textbook node rather than a transfer; the list goes to the PWS author for review and into the next phase's tier-rule review, not into this phase's rule.

Provenance-routed strong stamps (a lateral path that also crosses a `BrainRecord` node or a `SOURCED_FROM` edge, RESEARCH C6): 0. Diversity: 5 distinct interior nodes across 13 strong stamps (0.385). All counts are recorded with no target.

### Direction fidelity (false friends per tier)

Blind, the navigator marked the named direction right on 16 of 96 (16.7%, 95% Wilson 10.5% to 25.4%). As shown, 15 of 96 (15.6%, 95% Wilson 9.7% to 24.2%).

| Direction shown | Direction marked right / shown | Rate | 95% Wilson interval |
|---|---|---|---|
| "same meaning in different words" | 9 / 75 | 12.0% | 6.4% to 21.3% |
| "same words with different meaning" | 7 / 21 | 33.3% | 17.2% to 54.6% |

| Tier | Direction marked right / shown | Rate | 95% Wilson interval |
|---|---|---|---|
| strong | 2 / 13 | 15.4% | 4.3% to 42.2% |
| indirect | 0 / 1 | 0.0% | 0.0% to 79.3% |
| unverified | 14 / 82 | 17.1% | 10.5% to 26.6% |

The planted cases in `room-control` (`planted-cases.json`, never opened before judging) were joined only now, after both sittings, by artifact path. The engines showed 3 of the 4 planted false friends (same word, different meaning) and 3 of the 4 planted meaning bridges (same mechanism, different words).

| Planted case | Pair | Direction shown | Tier | Direction right (blind) | Useful (blind) |
|---|---|---|---|---|---|
| false friend | `0d18bca0c2f7` | "same words with different meaning" | unverified | y | n |
| false friend | `e183a8a8a38e` | "same words with different meaning" | unverified | n | n |
| false friend | `f06bd895b05b` | "same words with different meaning" | unverified | y | n |
| meaning bridge | `3a4fdbc9405b` | "same meaning in different words" | strong | y | n |
| meaning bridge | `aa4cb153e855` | "same meaning in different words" | strong | y | n |
| meaning bridge | `cf322dc30df8` | "same words with different meaning" | unverified | n | n |

False-friend count per tier (planted false friends whose named direction the navigator marked wrong), with the number shown beside it: strong 0 of 0, indirect 0 of 0, unverified 1 of 3. No false friend reached the strong tier, so none goes to the PWS author from this run.

### Verified versus already known

| Tier | Already known | Not already known | Useful and not already known |
|---|---|---|---|
| strong | 7 | 6 | 2 |
| indirect | 0 | 1 | 0 |
| unverified | 38 | 44 | 16 |

Overall the navigator already knew 45 of 96 (46.9%, 95% Wilson 37.2% to 56.8%). Already-known share: strong 53.8%, unverified 46.3%. Strong pairings were already known more often than unverified ones: on these rooms, verification and novelty lean apart, which is input for the later computed novelty signal. With only 13 strong pairings this is a lean, not a settled difference.

### Theo latency

Theo `find_connections` latency, measured on the plugin side through `brain-client.cjs` on the dev machine (the first plugin-side measurement): p50 1580 ms, p95 1761 ms, over 165 timed calls (min 1544 ms, max 3385 ms; nearest-rank percentiles). The timings cover every call in the capture file, across all Phase 355 captures including this plan's append (the file records 164 calls and 164 distinct responses beside 165 timings). Stamping itself replays the capture offline and makes no network call.

### Portfolio ranking tension (D-47)

Today's eureka feasibility map gives its higher band to pairs labeled "same words with different meaning" (the shared-words case). This phase fixed the label's meaning but kept the ranking byte-for-byte (D-47, pinned by `tests/fixtures/355/eureka-ranking-pin.json`), because a ranking change is not an honesty-pass decision. The per-direction hit rate below is the evidence the next engine phase needs:

| Direction shown | Useful / judged | Rate | 95% Wilson interval |
|---|---|---|---|
| "same meaning in different words" | 41 / 75 | 54.7% | 43.4% to 65.4% |
| "same words with different meaning" | 2 / 21 | 9.5% | 2.7% to 28.9% |

On these rooms the direction today's ranking rewards was judged useful less often (9.5% against 54.7%). The two Wilson intervals do not overlap. Nothing in the ranking is changed here; the numbers go to the next engine phase.

### Every shown pairing, per room

Columns: pair id, producer, the direction phrase shown, the stamp tier (with the unverified reason), then the blind answers (useful, direction right, already known) and the as-shown useful answer. y = yes, n = no.

#### `room-ill-defined`: useful 21 of 32 (65.6%, 95% Wilson 48.3% to 79.6%)

| Pair | Producer | Direction shown | Tier | Useful | Direction right | Already known | Useful as shown |
|---|---|---|---|---|---|---|---|
| `71a3b362198b` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `138231a5710a` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | y | y | y |
| `550a0c8ccb95` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `22f2f99ce390` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | y | y | y |
| `942a7bb77393` | hsi | same meaning in different words | strong | y | n | y | y |
| `5f346a0c4258` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `a9c96654c1cb` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `dfb8af2a042f` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | y | y | y |
| `575d21ab0fa1` | hsi | same meaning in different words | strong | n | n | n | n |
| `651643e6aef4` | hsi | same meaning in different words | strong | n | n | n | n |
| `53628980d126` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `967eebebdb2a` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `20a8a389efbb` | hsi | same meaning in different words | strong | y | n | y | y |
| `08d48c49f73f` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `eaf0c6945c2a` | hsi | same meaning in different words | strong | y | n | y | y |
| `bfa53320bdb5` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `59f67da1507d` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `ac899cc31a08` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `a3dd5a5a8ba9` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `739b13f07f52` | hsi | same meaning in different words | strong | y | n | n | n |
| `32428ac3c5d0` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `e522567a70db` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `71b5ca116782` | rs | same meaning in different words | strong | y | n | y | y |
| `973e829e5c7a` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `2d2f994aa0b7` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `7f149cc68eae` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `762e30d72079` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | n |
| `86160a4c843e` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `33c16fc98207` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `5670bf421779` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `dedbd55a5148` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | y | n | y |
| `e649276d0880` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |

#### `room-extend`: useful 15 of 26 (57.7%, 95% Wilson 38.9% to 74.5%)

| Pair | Producer | Direction shown | Tier | Useful | Direction right | Already known | Useful as shown |
|---|---|---|---|---|---|---|---|
| `4966f51f4ba5` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `b6c39a8315e4` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `4ae95ebc099b` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `b9d565a07c73` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `bde4986ef002` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `920e9533101d` | hsi | same meaning in different words | unverified (`no_path_within_3_hops`) | y | n | n | y |
| `481a96a042ed` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | y | n | y |
| `a9c4eb92d9cc` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `d37e922b92b0` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `2dbf73d27401` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `21617932599e` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `5af9d958e847` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `9482b5ee2a88` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `be93e2bc753b` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `df772c7aa5d7` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `a21dc91990b1` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `ca988c187c01` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `bd37004bd111` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `4fdfc34bbe31` | rs | same words with different meaning | strong | y | n | n | y |
| `7ec79d35bcf1` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `be259de33291` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | n | y |
| `f8059ad37e84` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `89e18440699d` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `c165d7681b78` | rs | same meaning in different words | strong | n | n | n | n |
| `73c2c0780e26` | rs | same meaning in different words | strong | n | n | n | n |
| `824233d5323d` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |

#### `room-control`: useful 7 of 38 (18.4%, 95% Wilson 9.2% to 33.4%)

| Pair | Producer | Direction shown | Tier | Useful | Direction right | Already known | Useful as shown |
|---|---|---|---|---|---|---|---|
| `27e3a9dabd93` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `5546fe323f60` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `9d6f82c08309` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `6a7b75fc7d8b` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | y | y | n |
| `aa4cb153e855` | hsi | same meaning in different words | strong | n | y | y | n |
| `0665103b1407` | hsi | same meaning in different words | unverified (`no_path_within_3_hops`) | y | n | y | y |
| `e5fee29f3af4` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `f9fd20cf5a3e` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | n |
| `716eb86322a4` | hsi | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `68f9f5a9dc5c` | hsi | same meaning in different words | unverified (`handle_unresolved`) | n | y | y | n |
| `954cb61cfd87` | hsi | same meaning in different words | strong | y | n | y | y |
| `925616befba3` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `f84fe5852911` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `5102fc9796a9` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `c5f662bf8905` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | y | n | n |
| `69bc60c5c1e7` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | y | y | n |
| `94cffb2d0328` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `26c18b2b9ed8` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `4e052215042a` | rs | same meaning in different words | unverified (`no_path_within_3_hops`) | y | n | y | y |
| `608a8786af6b` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `3a4fdbc9405b` | rs | same meaning in different words | strong | n | y | y | n |
| `f06bd895b05b` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | y | y | n |
| `da82dcd1283b` | rs | same meaning in different words | unverified (`handle_unresolved`) | y | n | y | y |
| `6bbc973b8673` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `69c01d1e94a5` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | y | y | n |
| `e183a8a8a38e` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | y | n |
| `8113656967e0` | rs | same meaning in different words | unverified (`no_lateral_relation`) | n | n | n | n |
| `7b46e9e17d79` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | y | y |
| `d4807ef935c4` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `923eaa491b7d` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `97bd79e86a1f` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `cf322dc30df8` | rs | same words with different meaning | unverified (`no_path_within_3_hops`) | n | n | y | n |
| `013ae8ee02d5` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | n | n | n |
| `88576a2b871c` | rs | same words with different meaning | unverified (`handle_unresolved`) | y | y | y | y |
| `874efea9a47c` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | y | y | n |
| `f3bec26b00bf` | rs | same meaning in different words | unverified (`handle_unresolved`) | n | n | n | n |
| `e31a64af2475` | rs | same meaning in different words | indirect | n | n | n | n |
| `0d18bca0c2f7` | rs | same words with different meaning | unverified (`handle_unresolved`) | n | y | y | n |

### Disclosed limitations

- **One labeler.** Every judgment is the navigator's; no second blind labeler was available, so there is no agreement figure or kappa for this set. The machine usefulness judge measured in 355-26 is compared against this gold in `355-JEV-MEASUREMENT.md` under its own model name and never feeds these rates.
- **Sitting 2 was taken in the same session as sitting 1.** The labeling protocol asks for a later sitting; the navigator chose "now, same session" at 19:36 local on 2026-09-24. Memory of sitting 1 may have steadied sitting 2, which bears on the stamp-influence gap only, never on the blind rates.
- **How sitting 2 was taken.** 5 pairings were labeled in the terminal CLI; the other 91 were labeled blind by the navigator in chat (session jsagi-7b, 2026-09-24/25). The orchestrator rendered the same whitelisted display fields the CLI shows (room, A excerpt, B excerpt, direction phrase, stamp lines), in the CLI's own seeded order (the session file's order_seed), and wrote the navigator's y / n answers into the session file keyed by pair id; those entries carry `via: "chat-sitting"` and no per-item timing (91 untimed entries). In the first chat batch of 10, two B excerpts were shortened to a back-reference to an identical earlier excerpt and a few excerpts were lightly condensed; every later batch was verbatim. No hidden field (boundary tag, planted-case data) was ever shown.
- **Desktop and Cowork cannot compute a stamp (D-50).** The guarded Brain shim exposes no `find_connections`; Larry there narrates only stamps a CLI run already stored and otherwise says "not yet checked".
- **`compute-hsi.py` still writes retired-convention strings (D-07).** No reader trusts them; every reader re-derives the direction from the stored similarity pair.
- **Name snapshot date (D-51).** Endpoints were resolved against `data/framework-names.json`, snapshot dated 2026-09-23 (source hash `3935848a1641`); the capture was taken against the same snapshot hash.
- **Fixture rooms, not ventures.** The three rooms are small, Claude-authored and synthetic; eureka contributed no pairings; the similarity floor was lowered uniformly to reach 20 per room. The latency figures come from one dev machine.

### Open questions

- **Why were so many direction labels rejected?** The navigator marked the named direction wrong on 80 of 96 pairings blind (81 as shown). The question offered only the two direction phrases and no "neither category fits" answer, so a "no" cannot tell apart four causes: the classifier, the export, judging consistency, or the two-phrase definition itself. The cause is not established. Follow-up: review the rejected labels again with a third option ("neither fits") before any change to the direction module.
- **Recall is unmeasured.** None of the three rooms is a research venture (the only science-flavored text sits in `room-control` as planted material the engine is meant to handle correctly), and this record can speak only to precision. A fourth, research-type fixture room seeded with planted known cross-field transfers would let a later pass measure recall (did the engine find the bridge we know is there). Ruling pending with the navigator.

### What this number is

This is the first calibration point in the engine's history, taken on dev-repo fixture rooms, not real ventures. No target was set and none is implied: the pooled useful rate of 44.8% (n = 96) is a starting mark for later runs to be read against. The briefing's own MVP bar, "50%+ of top-10 findings judged 'interesting'", is quoted here only as the briefing's reference point; it is not this phase's target, and this record judged every shown pairing rather than a top 10. A high unverified rate (85.4% here) is a canon-coverage finding for Theo (T-3), reported upstream with counts only, not a phase failure.

<!-- hit-rate-record:end -->
