---
kind: context
phase: 167
slug: harness-manifest-and-surface-generator
milestone: v1.14.0
created: 2026-06-18
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
spec_loaded: true
status: context-captured
sequence: "THIRD in v1.14.0 (163 done -> 166 done -> 167 -> 164 -> 165), navigator-LOCKED 2026-06-18"
---

# Phase 167 Context: Harness-as-code completion

<domain>
Complete the harness-as-code stack on top of the Phase 166 runChain executor: a declared harness
MANIFEST (read-layer over the three maps), fable-mode step discipline in the runtime, and a
/mos:new-surface generator. Realizes SEED-032. Requirements LOCKED in 167-SPEC.md (HARN-01/02/03);
this CONTEXT captures the HOW decisions from discussion + the research-grounded build substrate.
</domain>

<spec_lock>
Requirements LOCKED by 167-SPEC.md (HARN-01 manifest, HARN-02 fable-mode, HARN-03 generator). Read it
+ 167-RESEARCH.md before planning. Do NOT re-derive WHAT; this CONTEXT locks HOW.
</spec_lock>

<decisions>

### D-167-01: the manifest is a generated data/harness-manifest.json (navigator-LOCKED 2026-06-18)
Produce `data/harness-manifest.json` via a new `scripts/build-harness-manifest.cjs`, mirroring the
shipped generator idiom (`build-connector-registry.cjs` / `build-orchestration-projection.cjs`):
deterministic sorted source walk -> build -> serialize (JSON.stringify(...,2)+"\n", byte-stable) ->
3-branch main (write / --check / refresh). The manifest is the DECLARED, VERSIONED descriptor naming
the three existing maps as ONE entry (command-registry=posture, connector-registry=wiring,
brain-orchestration-projection=ranked next-reach). It does NOT merge or retire them (D-166-03). NO new
deps; no YAML (parser dep / 2nd hand-rolled parser = drift); no TS. The manifest is a LOCAL artifact
carrying `methodology_tier=mindrian-operation` machinery metadata only (Part 8 amendment entry 19);
NOT folded into the Brain projection.

### D-167-02: recipe-maps WRAPS, not becomes (the manifest's executable counterpart)
`lib/core/recipe-maps.cjs` (166 W1) stays the live read-join over the three maps (must NOT be retired,
D-166-03). The manifest is the declared descriptor; recipe-maps gains a `loadManifest()` / `manifest()`
accessor returning the declared three-map binding, so the runtime reads the manifest while recipe-maps
remains the executable join. `postureForCommand` / `wiringForReach` / `rankedNextReach` unchanged;
`rankedNextReach` stays CONTRACT-ONLY (live consumption deferred with Phase 157/137).

### D-167-03: manifest --check enforced in BOTH pre-commit AND a test aggregator (navigator-LOCKED)
Wire the manifest --check into the live `.git/hooks/pre-commit` (alongside command-registry :144-145
and brain-packet-schema :160-161) AND a new `tests/run-all-167.sh` aggregator. This is STRONGER than
the connector/projection precedent (whose --checks run only in test aggregators -- a known drift gap
this phase closes for the manifest). --check asserts byte-equality (STALE) + the three referenced maps
resolve + per-entry well-formedness, exit-1 + a stderr recovery line.

### D-167-04: fable-mode is POSTURE-SCOPED (navigator-LOCKED 2026-06-18)
HARN-02 verify+self-critique fires only on MATERIAL / uncertain steps, NOT on every autonomous_safe
step (respects the 166 token analysis: do not burn tokens re-verifying trivially-safe steps). Hook
point: `lib/core/chain-executor.cjs` between the onStep return (:359-361) and the previousOutput
assignment (:389) -- a `selfCritiqueFn(step, result)` whose verdict augments `result.quality`, feeding
the EXISTING LOW_QUALITY halt path in `makeGateFn` (:195) so a failed self-critique maps
autonomous_safe -> halt next hop. NO new loop; NO auto-retry-to-convergence (166 B3). fable-mode is
net-new naming over the shipped quality machinery (no fable-mode skill or model alias exists today --
do NOT invent a "fable" model tier; model-profiles stays opus/sonnet/haiku).

### D-167-05: /mos:new-surface reuses the new-project SCAFFOLD-BACKEND pattern (NOT ignite) (navigator-LOCKED)
Precise distinction (navigator question 2026-06-18): `/mos:ignite` and `/mos:new-project` are two
LAYERS of ROOM creation, not duplicates. `/mos:ignite` is the conversational FRONT DOOR (the B1/B2/B3
birth gates, the Hooked first-cycle, owns the `birthRoom` transaction) -- it orchestrates. `/mos:new-project`
is the SCAFFOLD BACKEND it delegates to (builds sections from `room-blueprints.json`, writes ROOM.md
per folder, registers the room) -- it emits files. HARN-03 needs the MECHANICS (deterministic file
emission + frontmatter), which is new-project's half, NOT ignite's gate orchestration. So HARN-03
reuses the `/mos:new-project` scaffold-backend PATTERN + the 11-key connector frontmatter contract
(`docs/CONNECTOR-CONTRACT.md`, build-connector-registry.cjs:89-101). IMPORTANT: even this is PATTERN
reuse, not literal extension -- new-project scaffolds a ROOM (folders/sections); `/mos:new-surface`
scaffolds a SURFACE (a command/agent/skill .md + its manifest entry), a different artifact. So
new-surface borrows new-project's file-emission + frontmatter-contract + --check idiom, adapted to
surfaces; `/mos:ignite` is OUT of scope. The --check (mirroring D-167-01/D-167-03) proves the emitted
surface entry landed + is well-formed. No parallel scaffolder beyond this.

### D-167-06: canon guards (carried)
Part 7 unify+repoint (near-zero net-new orchestration; no LangChain/CrewAI). Part 8: manifest is
generic machinery metadata; a build-time boundary scan over the manifest + generator (mirror
`tests/test-orchestration-projection-part8-boundary.cjs` planted-secret tripwire); zero user-data
egress; no new Brain wire. Part 9: any state via navigation.cjs. No em-dashes. Harness-as-code 9
properties incl. an adversarial structured verdict wave (mirror 166 W8 / 163 W6).
</decisions>

<canonical_refs>
- `.planning/phases/167-harness-manifest-and-surface-generator/167-SPEC.md` -- LOCKED requirements.
- `.planning/phases/167-harness-manifest-and-surface-generator/167-RESEARCH.md` -- 4-lens map + substrate.
- `.planning/seeds/SEED-032-harness-as-code.md` -- the seed this realizes (4 parts + required capabilities).
- `scripts/build-connector-registry.cjs` + `scripts/build-orchestration-projection.cjs` -- the generator + --check TEMPLATE.
- `lib/core/recipe-maps.cjs` -- the read-join the manifest wraps (D-167-02).
- `lib/core/chain-executor.cjs:185-207,359-389` -- the fable-mode hook point (D-167-04).
- `agents/framework-runner.md:69-77,121-136` -- the quality enum / self-check source.
- `commands/new-project.md` + `commands/ignite.md` + `docs/CONNECTOR-CONTRACT.md` -- the scaffold backend + frontmatter contract (D-167-05).
- `.git/hooks/pre-commit:144-145,160-161` -- the pre-commit --check wiring precedent (D-167-03).
- `docs/MINDRIAN-CANON.md` Part 8 (Brain dual role) + Appendix D entry 19 -- the manifest's boundary.
</canonical_refs>

<code_context>
Net-new (the minority): `scripts/build-harness-manifest.cjs` + `data/harness-manifest.json`; the
recipe-maps `loadManifest()` accessor; the `selfCritiqueFn` seam in chain-executor.cjs; the
`/mos:new-surface` command + its generator; `tests/run-all-167.sh` + a Part 8 boundary test + an
adversarial verdict. Reuse (the majority): the two generators' write/--check/recovery skeleton, the
recipe-maps three-map join, the framework-runner quality enum, the new-project scaffold + connector
frontmatter, the pre-commit hook wiring, the 163/166 adversarial-verdict pattern.
</code_context>

<deferred>
- Live Brain write of the manifest / continuous sync (Phase 137).
- Bulk backfill of all 96 commands' wiring into the manifest (the generator makes per-surface cheap; backfill is a follow-on).
- The SEED-032 "idempotent harness runner" (capability 2) beyond the manifest+generator+fable-mode -- if it exceeds this phase's budget, carry to a follow-on; flag at plan-phase.
</deferred>

<open_for_planner>
- The SEED-032 "converged room" idempotence fixture (capability 2): scope a minimal no-op-on-re-run test, or defer.
- Exact manifest schema keys (superset naming the three maps' join) -- planner derives from recipe-maps + the three registries.
</open_for_planner>
