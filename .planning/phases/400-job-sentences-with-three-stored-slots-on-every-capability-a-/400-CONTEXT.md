# Phase 400 CONTEXT: job sentences, Cynefin layer, problem-axes fixes, hosted Gemini relay

**Source:** owner session 2026-11-24 plus three mails from the research machine
("MindrianOS FULL handoff", "return handoff", "handoff follow-up", all 2026-11-24).
**Research trail (PRIVATE, never copy into this public repo):**
`~/MindrianOS/research/2026-11-24-decision-advisor-handoff/` (the 399 handoff files,
`HANDOFF-cynefin-layer-2026-11-24.md`, `return-2026-11-24c/`, `return-2026-11-24d/zip/` = 50 files, the newest).
Rule as in 399: repo files may carry derived, labels-only data (ids, names, slot sentences we write,
rescaled numbers). Never commit the research files, rubrics, calibration sets, or the "DO-NOT-OPEN" batch file.

**Branch:** `work/400-job-sentences-cynefin-layer` in worktree `~/dev/MindrianOS-Plugin-399`,
cut from `work/399-decision-advisor` at ddd9de038 (399 is unpushed; 400 stacks on it).
**Builds on:** Phase 399 (decision advisor). **canon_parts:** 7, 8, 9, 12

## Owner rulings (locked, 2026-11-24)

- O-01 Job formula: "When <situation>, I want <progress>, so I can <outcome>." Store all three slots.
  The book glossary's choice among its three wordings was NOT ruled; do not edit the book.
- O-02 A stated, measurable target makes a problem Well-defined AND wicked when it is disputed and fixes
  shift it. D-06 holds in code (wicked can sit on any level). The book's "sharp edge of Ill-Defined"
  wording was not ruled; do not change the book.
- O-03 Disorder: "Let the host model decide." Pass the disorder label plus the book's slicing note to the
  host model. The advisor does not force an abstain on disorder. Confirm the wording at plan time.
- O-04 One Cynefin domain per room in v1 (no per-part domains).
- O-05 The navigating-complexity draft chapter (PwS-Book) is the Cynefin label source for v1; labels provisional.
- O-06 Labels-only Gemini runs are approved.
- O-07 ACCESS: a hosted relay in THIS phase. All users reach Gemini Decision through a relay that holds
  the owner's key. The key never ships in the plugin (public repo and npm).
- O-08 RELAY HOST: Render, beside the existing Brain/Theo services. Build the relay host-neutral
  (plain Node, no platform lock), with a Render blueprint for deploy.

- O-09 RELAY AUTH (owner card 2026-11-24): install id + caps, the pattern Theo uses today. Every
  install may ask the relay live; callers send the existing install id (x-theo-install-id style, see
  400-RESEARCH Q1); per-install and global daily caps bound the bill. Users hold no key (SEED-119 stands).
  A separate operator token, held only by the owner, skips the user caps for release-time table builds.
  The relay accepts only closed-label requests (the shared labels-only validator), so it is not a
  general Gemini endpoint.
- O-10 RELEASE RUN (owner card 2026-11-24): the shipped egress line `decision_advisor` stays OFF for users.
  The release-time table build passes only with an explicit operator flag plus the operator token;
  each run prints what it sends and writes an audit record. Turning the line on for users is a later ruling.

- O-11 LABEL STORE (owner card 2026-11-24): job sentence slots, fits_domains and move_type live in
  FRONTMATTER of each capability file, like the 399 job labels. The generated skill mirrors carry the
  copy (scripts/build-skill-mirrors.cjs must stay in sync; its --check must pass).
- O-12 OLD COMMANDS (owner card 2026-11-24): organize, mva-brief and mva-report stay on the 73 run-step
  list and are labelled in this phase. Their removal belongs to a later efficiency phase.

## Research findings to honour (small sets, one labeller: agreement, not accuracy; never quote publicly)

- F-01 Job signal per slot (176 frameworks, names hidden): When 0.75, I want 0.71, So I can 0.71,
  whole sentence with name 0.82. Every slot carries signal; none replaces the sentence.
- F-02 Cynefin from a job sentence is unreliable: the When clause alone came back Disorder on 81 of 176,
  top answer under 0.5 on about half. The room's domain comes ONLY from the navigator's answer.
- F-03 Wicked and Cynefin must be separate axes (399 defect X1 confirmed).
- F-04 fits_domains, 113 installed commands at 0.70+: complicated 57, complex 38, clear 22, disorder 18,
  chaotic 0. No command fits chaotic: show "no strong pick" honestly.
- F-05 Move types, commands: categorize 41, analyze 29, probe 29, slice 14, act 0. Many categorize
  commands are housekeeping: exclude non-methodology commands from move matching. Owner review needed.
- F-06 Wicked yes/no ranks well but Gemini says yes too readily at 0.5 (16 false yes / 78): own cut-off.
- F-07 Reworded Well definition ("a specific measurable target, or a closed set of known options with
  known measures; holds even when disputed; a general wish to improve does not count") gave 72/78 vs
  69/78, fitted on the same cases: ship behind a flag, old wording default until fresh cases confirm.
- F-08 Chaining slot rule (A's "so" = B's "when") scored 0.58 vs 0.50 chance: DO NOT build chaining.
- F-09 Google terms: paid tier $0.10 per 1M input tokens, no output charge. Free-tier content is used by
  Google; paid tier is not. Only Paid Services may serve users in the EEA, Switzerland or the UK.
  The terms forbid using the service to develop competing models. Rate limits are per project
  (Tier 1: 1,500 req/min, 1,000,000 tokens/min, 50,000 req/day). The key's tier is unknown.

## Scope

S1 Job sentences (three slots)
- Rewrite the job summaries in data/job-vocabulary.json as formula sentences with stored slots
  {when, want, so}. Drafts: research `jobs-in-formula-v0.json` (owner review; mark provisional).
- Give every command, skill, agent and MCP tool one formula sentence with three slots, starting with the
  73 run-step commands (data/run-step-capabilities.json). Frameworks reuse the 176 ruled Theo sentences
  only if data/framework-jobs.json exists in this repo; otherwise defer and say so.
- Validator + drift test: every sentence parses into exactly three non-empty slots.

S2 Cynefin layer (from HANDOFF-cynefin-layer P1-P9, amended by O-03..O-05, F-02..F-05)
- New additive axis `cause_effect` {domain: clear|complicated|complex|chaotic|disorder|null, source}
  in lib/core/problem-axes.cjs, separate from wickedness. `wickedness.cynefin_rating` stays one release
  as a deprecated read alias. The CYNEFIN_BY_COMPLEXITY guess is a labelled weak source at most.
- data/cynefin-domains.json: 5 ids, verb order, posture, move type, book source path + quote hash;
  drift test against the PwS-Book glossary ids (read-only check, skip if the book is absent).
- Domain source: the navigator's answer to "who can see cause and effect here?" on a gate card,
  stored room-level. Never inferred from room text, never sent anywhere but as the label.
- Labels per capability: `fits_domains` and `move_type` (categorize|analyze|probe|act|slice) from the
  recorded research runs (cynefin-fit-commands-gemini.json, move-type-gemini.json), filtered to the run-step
  commands, housekeeping excluded, marked provisional, with a review list for the owner.
- Advisor: key gains the domain with fallback dropping it first; prefer capabilities whose move fits the
  domain; reorder only inside the strong band; unknown domain = exact 399 output; chaotic = honest
  "no strong pick"; disorder passes the label + slicing note to the host model (O-03).
- labels-only validator: add `cause_effect_domain` (closed 5 values) and `move_type` to the catalog.

S3 Problem axes
- Reworded Well definition in the level question behind a flag (old wording default).
- Wicked answer gets its own cut-off / rescaling, never raw 0.5.

S4 Hosted Gemini relay (O-07, O-08)
- A small host-neutral Node service (proposed path services/decision-relay/, planner may refine) that:
  holds the Gemini key in an env var only; authenticates each caller with a MindrianOS user credential
  (RESEARCH: reuse the existing Brain/Theo user-key check, do not invent a second account system);
  re-runs the SAME labels-only validator server-side (shared module, one source of truth) and refuses,
  never strips; forwards only to /v1beta/decisions; per-user and global rate limits and a daily cap;
  logs counts, durations and refusals only, never request bodies; no redirects; timeouts.
- Plugin client: a relay provider/transport behind the existing egress policy line `decision_advisor`
  (still default OFF; a room can only turn lines off). The per-turn path still makes NO live call:
  the relay serves (a) the release-time table build and (b) an opt-in live ask outside the turn path,
  if the planner keeps one at all. Default behaviour stays the precomputed table.
- Render blueprint (render.yaml for the relay), README for the operator, a health endpoint.
- OWNER-GATED (never done by the agent): creating the Render service, setting the key, choosing and
  confirming the PAID tier, turning the egress line on by default, any deploy.

S5 Label review carry-over (produce review lists; the owner rules)
- funding section job, personas sentence, the four section-only job summaries, the 2 held and
  5 doubtful command labels, the 0.70 to 0.89 band, the new fits_domains and move_type lists.

## Deferred (do not do in this phase)

- Chaining (F-08). Next research step: formula sentences for the commands in the plugin's 23 curated
  chains, then test the slot rule against them.
- Per-part Cynefin domains (O-04).
- Turning the advisor on by default; turning the egress line on by default.
- A second human labeller; fresh cases for the reworded Well definition; blind Cynefin labels.
- Any change to PwS-Book or Theo.
- Release cut and push (push gate: owner reviews every commit ahead).

## Constraints carried from 399

- No second resolver, ranker or posture authority; single-authority tests stay green.
- Part 8: only labels leave the machine; the relay is a labels-only boundary, not a content path.
- Part 9: SQL only through lib/core/navigation.cjs; new room.db tables/columns registered in
  .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml.
- tests/run-all-399.sh stays green; pre-existing failures listed in 399 SUMMARYs stay unchanged.
- No GEMINI_API_KEY on this machine: use the recorded research outputs; tests use fixtures and a
  capture server, never the network.
- No em dashes. PwS with a lowercase w.
