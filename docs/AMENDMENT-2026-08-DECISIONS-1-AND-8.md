# Amendment 2026-08: Decisions #1 and #8, Rewritten Together

**Ratified on merge.** IN FORCE with the release that completes SWEEP-01..03. No release
cut carries the rewritten rows while any guard silently degrades (ROADMAP amendment-sweep
lockstep, HARD).

This document is the single reviewable unit for the doctrine change HONEST-02 requires:
it amends `.claude/includes/decisions.md` rows 1 and 8 together (row 5's wording is also
touched), carries the causal record of the outage that made the change necessary inside
the amendment text itself, and states exactly when the rewritten rows take effect on the
constitution's own tracked file.

## 1. Preamble

**What is amended:** `.claude/includes/decisions.md` row 1 (One-command install) and row
8 (Tier 0 fully functional), rewritten together as one unit per HONEST-02's requirement
that they never be split. Row 5 (Brain as remote MCP) receives a wording touch, not a
rewrite.

**On whose authority:** the navigator's escalation gates on 2026-08-09 (recorded in
`docs/2026-08-09-HANDOFF-tier0-removal-milestone.md`, section 1: "Larry without the
Brain isn't Larry, then Tier 0 is shipping a hollow imitation") and the Build-the-Loop
ratification on 2026-08-10 (`docs/2026-08-10-HANDOFF-build-the-loop-milestone.md`).

**STATUS + EFFECTIVE clause:** Ratified on merge; IN FORCE with the release that
completes SWEEP-01..03. No release cut carries the rewritten rows while any guard
silently degrades (ROADMAP amendment-sweep lockstep, HARD). Until that release,
`.claude/includes/decisions.md` rows 1 and 8 keep their current text on main; this
document is the ratified, reviewable record of what those rows become. Application in
Phase 252's release is mechanical: the verbatim rows below replace the current rows,
nothing more, nothing less.

**Application-timing ruling (Task 1, this plan, blocking gate):** the navigator ruled
**doc-now / rows-at-sweep** on 2026-08-10, via the orchestrator's live Decision Gate.
Verbatim ruling recorded for this plan: the amendment document merges now with the
explicit in-force-with-the-SWEEP-release clause above; `.claude/includes/decisions.md`
rows flip in Phase 252's release commit, not before. This is the mechanically safe
sequencing under any beta-cut cadence between Phases 250 and 252 (Phase 251 sits
between them): the ratified document's own effective clause makes every intermediate
release self-describing, while a rewritten row on main ahead of the guard flip would be
the exact contradiction the lockstep rule names as worse than either state.

## 2. The Causal Record

On the record, not in a chat log, per the navigator's explicit direction.

**(a) The doctrine clause, quoted verbatim, with its historical location.**
`skills/brain-connector/SKILL.md:31`, as it stood before plan 250-01:

> "Any success = Brain active. All fail = silent fallback. Never mention failures to
> user."

**(b) The weeks-long outage this doctrine made invisible.** For weeks,
`scripts/brain-response-sanitize-hook.cjs` blanked 100 percent of Brain responses and
returned them in a shape the host could not read, throwing `e.reduce is not a function`
on every call. Nobody noticed, because the doctrine instructed silence: a total outage
of the most valuable thing in the product looked, from outside, like a Larry who simply
had less to say. Full diagnosis:
`docs/2026-08-09-HANDOFF-brain-envelope-and-egress-guard.md`.

**(c) The inert `activation:` frontmatter no-op.** The same file carried a second dead
clause: `activation: "env:MINDRIAN_BRAIN_KEY"` in `skills/brain-connector/SKILL.md`'s
frontmatter is a no-op. Claude Code's documented SKILL.md frontmatter set is `name`,
`description`, `disable-model-invocation`, `allowed-tools`, `disallowed-tools`,
`arguments`, `context`, `background`. `activation` is not among them, and no code in
this plugin reads it either; the skill has only ever loaded on description match. Two
clauses in one file, both pretending to do something, neither doing it. Cite:
`docs/2026-08-09-HANDOFF-tier0-removal-milestone.md`, section 2.

**(d) The counterfeit framing.** What made Tier 0 wrong was never that a keyless Larry
existed; it is that a keyless Larry presented itself as the real thing, answering
methodology questions from local heuristics without ever disclosing the Brain was down,
indistinguishable from full Larry from outside, for weeks. The test this amendment
applies: can a user ever be served methodology that did not come from the Brain, without
being told? The answer must be no.

**(e) The live 2026-08-10 reproduction, on a stale plugin cache.** The session that
diagnosed the causal record above ran on a pre-beta.13 plugin cache and reproduced both
fixed defects live: three Cypher census calls died with `e.reduce is not a function`,
and a fourth was blocked by the old egress guard as a false-positive leak. Calls through
the `pws-brain-mcp` project scope worked the whole time, because the broken hook's
matcher never covered that server name, a live demonstration of exactly how the outage
stayed invisible. Restart-to-apply is not a formality. Cite:
`docs/2026-08-10-HANDOFF-build-the-loop-milestone.md`, section 4.

**The filed error-taxonomy rule that names this failure mode exactly.** The data4sci
harness blueprint's four-class error taxonomy states the rule this outage needed:
truncation is explicit rather than silent. A silent, malformed truncation of every Brain
response is precisely the failure this amendment's refusal doctrine exists to make
impossible (`250-RESEARCH.md`, "Grounding: langtalks consultation").

**Refuse-rather-than-guess is a first-party position, not external validation.** The
MotherDuck panel note, "an agent facing an undefined term should say 'I don't know,'
never infer or guess," traces to the navigator's own panel appearance
(`docs/2026-08-10-HANDOFF-build-the-loop-milestone.md`, section 3). It is cited here as
the navigator's own prior position, deliberately, not as outside proof.

**Corpus whitespace, stated honestly.** The refusal doctrine has no external precedent in
the 44-source corpus consulted for this phase: no coverage of making a remote knowledge
service a hard requirement, and no coverage of per-turn hook injection. The amendment
owns this as the navigator's call, not as a pattern borrowed from the literature.

## 3. New Decision #1 Row (verbatim)

One-command install; the Brain is part of what installs. Larry's methodology comes from
the Brain and says so; a keyless session gets an honest refusal and a visible path to a
key, never an imitation.

**Note on the coupling, now RESOLVED in this row's favor.** SEED-011 is DECIDED: Option
A, per-install silent registration, baked in by default (NAVIGATOR RULING 2026-08-10,
recorded in `REQUIREMENTS.md` under HONEST-03; the behavior ships in plan 250-04). The
row's "one-command install" claim is strengthened, not threatened, by Brain-required: a
fresh install registers silently and mints its own identity, and the honest refusal
above remains for the failure edge (an unreachable registration endpoint, a rejected
token, or an explicit opt-out).

## 4. New Decision #8 Row (verbatim)

Honest refusal everywhere. A Brain failure or readiness miss surfaces in-turn and
auto-queues enrichment; no surface conceals a failure or serves methodology the graph
did not give.

## 5. Decision #5 Wording Touch

Decision #5 today: "Brain as remote MCP - IP never distributed; users get intelligence,
not data." That text implied the Brain was deliberately remote AND optional. Under this
amendment, Brain stays remote MCP, but the implied optionality is dropped
(`docs/2026-08-09-HANDOFF-tier0-removal-milestone.md`, section 3). Replacement
rationale text for row 5's application in Phase 252's release: "Brain as remote MCP - IP
never distributed; users get intelligence, not data. The Brain is remote by design, not
optional by default; a keyless session gets an honest refusal, never a silent local
substitute."

## 6. Consequential-Edits Ledger (for the SWEEP release, Phase 252)

Everything below applies mechanically, in the same release cut that carries this
amendment's rows into `.claude/includes/decisions.md`, per the amendment-sweep lockstep
rule:

1. **`.claude/includes/decisions.md` rows 1, 5, and 8** - the verbatim replacement text
   in sections 3, 4, and 5 above.
2. **`CLAUDE.md`** - the "one-command install" / "zero infrastructure" claims. Line
   numbers have drifted since this amendment was researched: the file's own history
   named `:19` and `:84`; as of this ratification the current, correct lines are
   **`CLAUDE.md:29`** ("A commercial Claude Code + Cowork plugin. One command installs
   it...") and **`CLAUDE.md:94`** ("One-command install gives the user Larry..."). Cite
   the drifted numbers explicitly so 252 does not edit stale lines from the original
   research.
3. **`docs/MINDRIAN-CANON.md:21`** - the constitution itself, outside `decisions.md`,
   currently reads: "Larry operates with Brain (Full Loop) or without Brain (Local
   Only). The pedagogy is intrinsic to Larry, not dependent on Brain availability. When
   the Brain is unreachable, Larry still teaches from local context, local graph, and
   Tier 0 methodology fallbacks." This sentence carries the dying Tier-0 doctrine at the
   constitutional layer, outside `decisions.md`, and was not named in this amendment's
   original research ledger. Coordination item folded in from `252-RESEARCH.md`
   (section "MINDRIAN-CANON.md:21 - a gap in 250's consequential ledger"): this line
   rides 252's release alongside the decisions.md rows, or the canon contradicts the
   amended decisions the moment 252 ships. `docs/MINDRIAN-CANON.md:193`'s "Tier 0
   fallback" (the cold-start Decision Gate option set) is a separate, unrelated
   vocabulary collision per 252's research and is NOT part of this ledger item; it is
   renamed, not amended, and keeps its behavior.
4. **`docs/install/BRAIN-SETUP.md`'s broader Tier-0 prose** - the keyless sentence at
   line 16 was already fixed in plan 250-01; the document's remaining Tier-0 framing
   rides 252's wider docs sweep.
5. **The tier-0-no-key fixture inversion** -
   `tests/fixtures/127-03-acceptance/tier-0-no-key/` is repurposed into a no-identity
   refusal fixture (assertion inverted, coverage kept, never deleted) - SWEEP-02
   territory, gated on `check-flagship-floor.cjs` exiting 0.
6. **The living-docs list** - originally estimated at roughly 121 files; 252's own
   re-measure narrows this to 72 non-dist files (34 docs/, 21 skills, 15 commands, plus
   `decisions.md` and `CHANGELOG.md`) and 114 files including the dist mirrors. 252
   re-measures again at execution time; this ledger cites the re-measured count, not the
   original estimate, so the sweep does not under-scope against a stale number.
7. **The `source:'tier0'` hardcoded chains in `lib/core/brain-client.cjs`** -
   `getTier0Chain()` / `getFrameworkChain()`, site 11 in plan 250-01's doctrine-site
   enumeration. Marked (comment-only) in 250-01; flipped to the honesty-rail behavior in
   SWEEP-01.
8. **The SEED-011 registration behavior** - ruled 2026-08-10: ships INSIDE this
   milestone via plan 250-04's cross-repo work (the brain-repo `/register` endpoint plus
   the plugin's silent-registration ladder) and the operator deploy that follows it. The
   cross-repo definition of done applies: this item is not done until the user-reached
   surface actually works on a released build, not merely committed.

## 7. Ratification

- **Interpretation confirmed:** HONEST-02's "rewrites Decisions #1 and #8 TOGETHER as
  one reviewable unit" is satisfied by this ratified document carrying both replacement
  rows verbatim (sections 3 and 4); `.claude/includes/decisions.md`'s row application is
  mechanical in Phase 252's release, per the Task 1 ruling in section 1 above.
- **Navigator sign-off: RATIFIED.** The amendment as written, both rows verbatim,
  doc-now/rows-at-sweep confirmed. Ratified by the navigator, 2026-08-10, via the live
  Decision Gate (Task 3 of plan 250-02, `checkpoint:human-verify`). No wording changes
  requested; the document ships as drafted.

---

*No em-dashes; hyphens only. Feynman-plain prose throughout, per house style.*
