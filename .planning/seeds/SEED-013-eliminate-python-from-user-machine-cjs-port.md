---
id: SEED-013
status: open  # CORRECTED 2026-07-14: this file previously claimed "graduated (Phase 134)" -- verified FALSE against .planning/ROADMAP.md, Phase 134 shows 9 plans, all 9 unchecked (0/9 executed). Real status is still open, not graduated. Caught during a full-corpus curation pass; do not re-mark graduated without re-verifying Phase 134's plan checklist directly.
planted: 2026-05-24
planted_during: v1.13.0-beta.32 cycle (Plan 127.2-04 ship + post-ship Python-fragility discussion)
spiked: 2026-05-24
spike_artifact: .planning/research/2026-05-24-cjs-port-feasibility-spike.md
spike_verdict: AMBER (port if triggers fire AND after byte-compat sub-probe)
pre_gate_required: .planning/research/2026-05-24-cjs-port-pinecone-bytecompat-subprobe.md (30-minute sub-probe; runs anytime; binary go/no-go for Phase 134 scaffolding)
revised_cost: 4-6 weeks if Pinecone byte-compat passes; 6-10 weeks if it fails and re-vectorization is needed
key_findings_from_spike: |
  - 261 MB node_modules + 552 MB on-disk model cache + 3.2 GB RSS at runtime
  - onnxruntime-node ships 93 MB of native binaries -- BREAKS the "vendored node_modules is cross-platform-safe because every prod dep is pure JS" invariant from .claude/includes/release-process.md
  - Pinecone byte-compat is UNPROVEN; Xenova ships quantized ONNX while Pinecone runs full-precision; quantization drift typically 0.001-0.05; if drift pushes cosine-sim below 0.99 the 12,401-vector pws-brain index needs re-vectorization
  - Aryeh's 8 GB Windows tester class may not have headroom for 3.2 GB RSS
  - Phase 134 must own a triple-tree-vs-runtime-install-vs-hybrid vendoring decision before scaffold
promotion_gate_after_spike: stays dormant until ALL FOUR hold -- (1) byte-compat sub-probe passes, (2) cross-platform vendoring decision made, (3) Aryeh's tester class consulted on 3.2 GB RSS feasibility, (4) one of the trigger_when conditions below fires
trigger_when: |
  (a) 2+ external testers hit Python-deps install failures AFTER the beta.30 pre-flight surface (meaning the pre-flight makes failures LOUD but doesn't deflect the class), OR
  (b) the install-cache-family premortem accumulates a 3rd Python-deps incident after beta.30, OR
  (c) a tester reports "the methodology analyzer doesn't work on my machine" as a reputation/marketing concern (not just an install ticket), OR
  (d) /gsd:new-milestone opens v1.14.0 and architectural cleanups are on the table, OR
  (e) Aryeh or another Windows tester explicitly asks "when does this stop needing Python?"
scope: large
bundle: cross-platform-fragility-cleanup
implementing_phase: 134 (scaffolded as the implementing phase if this seed activates; CONTEXT.md exists, no PLAN.md)
target_milestone: v1.14.0
related_phases: [89, 117, 127.2, 134]
related_seeds: [SEED-008, SEED-015]
ecc_cross_learning: |
  SEED-015 (selective install profile system, planted 2026-05-24 from ECC v1.9.0 learning)
  would STRUCTURALLY LOWER this seed's urgency: if users can run
  `--without lang:python`, the install-fragility class disappears for everyone
  who doesn't need Engine 1 Act 1 analyzers. The CJS port becomes optional
  rather than required. SEED-013 promotes ONLY IF testers who DO need the
  analyzers continue to hit fragility AFTER selective install ships.
canon_parts: [Part 6, Part 7, Part 8]
companion_artifacts:
  - .planning/phases/134-cjs-port-of-python-analyzers-via-xenova-transformers-elimina/134-CONTEXT.md (the scaffolded phase; CONTEXT only, no PLAN.md)
  - .planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md (Aryeh's transcript; F1+F2+F7 closed in beta.30)
  - .planning/debug/python-requirements-orphan-deps-audit.md (orphan-deps audit; F-AUDIT-01 fixed in beta.30; broader audit deferred)
  - docs/install-cache-family-premortem.md (the 7-case history; cases 5 + 7 + Aryeh's case are Python-related)
---

# SEED-013: Eliminate Python from the user-machine surface entirely

## Why This Matters

The largest install-fragility class in MindrianOS is Python-on-user-machines. Every Engine 1 Act 1 surface (`/mos:find-bottlenecks`, `/mos:whitespace`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`, `/mos:diagnostics`) shells out to `scripts/rs-engine.py` + `lib/core/rs_*.py` + `scripts/hsi-*.py`, which require `sentence-transformers` (PyTorch, ~2GB), `numpy`, `sklearn`, `requests`, and others. On any user machine where those aren't pre-installed, the analyzer is dead.

**Beta.30 made the failure loud** (pre-flight surface emits the actionable fix line) but did not deflect the class. A user who does NOT run `pip install -r requirements-hsi.txt` still cannot use the methodology analyzers. The friction is real. The friction is also Windows-flagrant: the deps land less reliably there, the fix line is harder to follow without admin rights, and the HuggingFace model download (~50-500MB on first run) compounds it.

**The structural fix is to eliminate Python entirely from the user-machine surface.** Replace `scripts/rs-engine.py` + the Python `lib/core/rs_*.py` modules + the Python `scripts/hsi-*.py` with CJS equivalents using `@xenova/transformers` running ONNX `Xenova/multilingual-e5-large` in-process inside Node. Math layers (cosine sim, LSA approximation, HSI scoring) port to pure JS. Same 1024-dim model as the current Pinecone index, so vector compatibility is preserved.

Three Canon parts strengthen if this lands:

- **Part 6 (dog-fooding):** the cross-platform install matrix collapses. Windows + macOS + Linux ship the same Node-only bytes. No per-platform Python fragility.
- **Part 7 (reuse-before-build):** the port replaces a layer (Python) with another (Node + @xenova/transformers). Net-zero on capability count. Net-MINUS on dependency surface. This is the rare architectural cleanup that REDUCES the moat-surface area without losing the moat itself.
- **Part 8 (graph boundary):** when embedding happens in-process on the user's machine, the temptation to call Pinecone's server-side inference on user content (the Phase 127.2 D-10 anti-pattern that the AI assistant itself fell into mid-session) disappears. Local stays local because local is structurally easier than remote.

## Why It Stays Dormant (the matrix recommendation)

The Windows beta-tester matrix that surfaced this whole class also recommended **DEFER** the architectural port. The reasoning: "build heartbeats / CI matrix from the earlier turn FIRST; let it surface the actual failures; THEN port the surfaces that actually break. Don't pre-empt empirical signal."

With beta.32's Class N activation-reached-the-wire gate now live, the release pipeline finally produces tester evidence that corresponds to the version label. Before beta.32, every "Python fragility" report from testers might have been against an older cached version, not the pre-flight-surface-shipping beta.30. From now on, signal is readable.

So the right next move is **NOT** to scaffold Plan 134-00 and start porting. The right next move is to watch what real testers report in the 7-30 day window after beta.32, with the new tester evidence honesty in place. The seed stays dormant until one of the trigger conditions above fires.

## Cost

- **Implementation:** ~3 weeks of focused engineering (model loading + embedding + math layers + tests + Tri-Polar cross-surface validation).
- **Risk:** must maintain byte-compatibility with Pinecone's 1024-dim multilingual-e5-large index. The model variant must be EXACTLY `Xenova/multilingual-e5-large` (the ONNX-quantized HuggingFace mirror of `intfloat/multilingual-e5-large`). Any drift breaks the vector compatibility and forces re-vectorization of the entire Pinecone corpus.
- **Prerequisite (small):** a feasibility spike (~2 hours) confirming `@xenova/transformers` can load the model at acceptable size + speed in Node on user machines. Should land as a SEPARATE research artifact before Plan 134-00 scaffolds.

## What Stays Python (out of scope for this seed)

- `mcp-server-brain/` server-side analytics (Render deploy; Python is FINE there because it's our infrastructure, not user machines).
- `~/Mindrian/mindrian-deploy/` LLM extractors (`langextract`, gemini filesearch, `lazy_graphrag_index.py`) -- these write to the Brain server-side; user machines never run them.
- One-off scripts in `scripts/` that ARE intended for maintainer use only (release tooling, etc.). The classification gate: "does a user run this?" -- if no, Python stays.

## Adjacent SEEDs / phases

- Phase 134 (scaffolded as the implementing phase if this seed activates).
- SEED-008 (intelligence-layer activation gap) -- related theme of "the analyzer never fires when it should." Different fix class (trigger wiring vs runtime fragility).
- The orphan-deps audit RCA (`.planning/debug/python-requirements-orphan-deps-audit.md`) -- if this seed activates, that audit becomes prerequisite: clean inventory of every Python import vs requirements file BEFORE porting.

## What activates the seed

Any one of the trigger_when conditions above. The most likely to fire first: (a) -- another Windows tester hits the Python-deps class even with the pre-flight surface in place. If pre-flight is sufficient, the seed stays dormant indefinitely and may eventually be promoted only as part of a v1.15.0 ecosystem-cleanup wave. If pre-flight isn't sufficient, the seed promotes to phase work within the next milestone.
