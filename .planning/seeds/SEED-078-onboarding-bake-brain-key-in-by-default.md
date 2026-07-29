# SEED-078 - Bake the Brain/API key into onboarding by default (repeated 3x onboarding bottleneck)

> Framing (Jonathan Sagir, live 2026-07-28 intern check-in call, quoted verbatim): "I think,
> because we're not charging anything currently, there is no real reason to, uh, not bake the
> brain as part of it by default... Lehi's been telling me this for a while now." This seed
> formalizes something Jonathan has already stated out loud multiple times but never actually
> scheduled as a phase.

**Registered:** 2026-07-29 (from live intern QA evidence spanning three separate check-in calls)
**Class:** PRODUCT / onboarding | **Status:** seed
**Grounding:** `docs/testers/interns/REGISTRY.md`, `~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`
(all three rounds: 07-05, 07-21, 07-28), the install/onboarding flow docs.

## The gap this closes

Three separate weekly intern check-ins, three weeks apart, each independently confirmed the SAME
bottleneck: the CLI/plugin install itself goes fine, but the Brain/API-key setup step is where
every tester gets stuck. This is not a one-off report. It is a 3x-repeated, cross-session-confirmed
pattern from the exact target audience (JHU students), the same population the fall-semester
150-student rollout this whole install-hardening effort exists to serve.

- 07-05 call: "Cohort roster + per-intern records" logged install friction; the Brain-key step
  named as the recurring blocker across multiple interns' individual sessions.
- 07-21 call: filed into the same tracker, same symptom repeated.
- 07-28 call: Devoushka named it explicitly on the live call ("installing Mindryon into the
  terminal is not the issue, but getting the brain and then proceeding ahead... might be the
  bottleneck for everybody"), and Jonathan responded live with the fix quoted above.

## Proposed shape

Since nothing is billed yet, stop treating the Brain key as a separate manual setup step. Bake a
default/auto-provisioned key into the install path so a fresh user gets a working Brain connection
with zero extra steps, the same way the CLI/plugin install already "just works" today.

## Open questions for research before planning (do not skip these before scoping a phase)

1. **Provisioning mechanism.** A pool of pre-issued keys auto-assigned at install, versus a single
   shared low-privilege default key, versus a lightweight anonymous-issuance endpoint. Needs a
   cost/abuse-model design pass.
2. **Preserving the usage-visibility signal.** The current design's whole justification, per
   Lawrence's own words on the same call, is that the API key is the ONLY telemetry Jonathan has:
   "it's their only way of keeping track of downloads... because we don't know anything... it's
   not on our computers... the internet [part] is Claude, it's not us" (Canon Part 8: MindrianOS
   runs entirely on the user's machine, never on Mindrian's own servers). Any auto-provisioning
   design must not silently destroy that visibility while removing the friction - likely needs
   anonymous-but-attributable auto-issuance (a real, trackable key still gets minted, just without
   a manual step blocking on it), not one shared key everyone uses.
3. **Interacts directly with SEED-015 (selective-install-profile-system) and SEED-017
   (hosted-pro-tier-stripe-billing).** Once ANY billing exists, "bake in by default because
   nothing is billed" stops being true. This seed is explicitly a pre-monetization-window fix.
   Sequence it BEFORE SEED-017, or gate it to flip off automatically once billing ships.
4. **Scope of "default."** Does this apply only to a scoped fall-semester JHU cohort install
   profile, or to every fresh install everywhere? A scoped default (matching SEED-015's install-
   profile mechanism, if that ships first) is the safer starting shape. Canon Part 7: reuse
   before build - check whether SEED-015's profile mechanism can carry this rather than inventing
   a second gating system.

## Severity / evidence

HIGH confidence, not a guess: three independent live QA sessions, same root symptom, same
population, and the fix already named by the person who owns the decision. This is the single
most-repeated unresolved friction point surfaced anywhere in this cohort's testing to date.

## Cross-references

- `docs/testers/interns/REGISTRY.md`, `~/MindrianRooms/jonathan-sagir/team/2026-07-05-interns-homework-tracker.md`
  (the full evidence trail across all three rounds)
- SEED-015 (selective-install-profile-system) - likely mechanism for scoping the default
- SEED-017 (hosted-pro-tier-stripe-billing) - this seed's fix must degrade cleanly once billing exists
- Canon Part 8 (Graph Boundary / Brain telemetry) - the constraint any auto-provisioning design must respect
