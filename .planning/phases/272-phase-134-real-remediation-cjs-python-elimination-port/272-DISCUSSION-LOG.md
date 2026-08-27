# Phase 272: Phase 134 Real Remediation -- CJS Python Elimination Port - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 272-phase-134-real-remediation-cjs-python-elimination-port
**Areas discussed:** Accuracy risk tolerance, Rollout approach, First-time download experience

---

## Accuracy risk tolerance

Initial framing (pre-research) assumed a real byte-compatibility risk: that the new
local JS/ONNX embeddings might drift from an existing local Python embedding path, with
drift below 0.99 cosine similarity forcing a full re-vectorization of the 12,401-vector
Pinecone/pws-brain index. Research (`gsd-advisor-researcher`, opus) verified against the
actual Python source that this premise was false -- the Pinecone index is built by
Pinecone's own server-side hosted inference, not a local model, and the local Python
encoder is a completely different, smaller model (`all-MiniLM-L6-v2`, 384-dim) than the
1024-dim `e5-large` Phase 134's design doc assumed. The "local 1024-dim e5" path is an
unimplemented stub.

| Option | Description | Selected |
|--------|-------------|----------|
| A. Separate spaces, reuse existing encoder | Local room-side: reuse `embedding-spine.cjs`'s already-shipped 384-dim ONNX encoder. External/Brain side: port Pinecone's hosted-inference API call to CJS fetch, no local e5-large load. Gate = rank agreement, not cosine. | ✓ |
| B. Unify on one local e5-large encoder | Single encoder, fully offline, but forces fp32 (2.24GB, larger than the Python runtime being removed) and rests on an unverified e5-large-loads-in-transformers.js-v4 assumption. | |

**User's choice:** Option A (Recommended).
**Notes:** This choice also defuses a separate, more severe risk a different research
agent raised in parallel: this repo's own prior (unrelated) diligence had already
investigated and abandoned `Xenova/multilingual-e5-large` elsewhere because its ONNX
weights couldn't be confirmed to load in transformers.js v4. Because Option A never
attempts to load e5-large locally at all, that risk becomes moot for this phase.

---

## Rollout approach

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side behind an env flag | CJS becomes default; Python retained as fallback; full deletion deferred to a separate later phase. Only real rollback path for a marketplace-distributed plugin. | ✓ |
| Hard cutover, delete Python now | Ships elimination completely in this phase; no safety net if the port has an undetected issue; recovery requires a new release cycle. | |

**User's choice:** Side-by-side behind an env flag (Recommended).
**Notes:** Research flagged that Change 1 (the Python auto-install remediation shipped
earlier the same session) was never verified against a real clean-machine network pip
install -- so it should be retained as the fallback's safety net, not treated as already
proven, during the transition window.

---

## First-time download experience

| Option | Description | Selected |
|--------|-------------|----------|
| A. Lazy download with live progress | Downloads on first real use with genuine byte-level progress (verified: real `{progress, loaded, total}` events do fire in Node); reuses/extends the existing D14 cache-miss notice pattern. | ✓ |
| B. Prefetch at install/setup time | Moves the wait to install time via `/mos:setup` or `doctor --fix`; cannot be the only path since not all surfaces (Desktop/Cowork) run setup. | Additive only |

**User's choice:** Lazy download with live progress bar (Recommended), i.e. Option A,
with Option B available later as an additive opt-in on top, never as a replacement.
**Notes:** Research surfaced a real bug independent of the UX question: the model cache
currently defaults to a location inside the versioned plugin install directory, which
gets deleted by the version pruner on every update -- meaning without a fix, this isn't
actually a one-time "first-run" cost, it silently repeats on every plugin update. Folded
into CONTEXT.md as D-07, a required fix regardless of which download-UX option was
chosen.

---

## Claude's Discretion

- Exact module/file layout for the new CJS analyzer files and the Pinecone-inference
  proxy module.
- Exact env-flag naming/config-key convention (follow existing repo patterns).

## Deferred Ideas

- Full Python deletion -- deferred to a separate, later phase (per rollout decision).
- Unifying onto a single local e5-large encoder -- deferred unless/until offline-capable
  external-corpus search becomes an explicit hard product requirement.
- Change 3 (doctor auto-stub visibility fix) and SEED-013's second frontmatter
  correction -- named in ROADMAP.md as this phase's secondary scope, not discussed in
  this session; flagged for the planner to confirm scope/sequencing with the navigator.

## Unresolved -- flagged, not adjudicated

- `lib/agents/reverse-salient-agent.cjs:19`'s standing "NEVER reimplement rs-math in
  Node" rule directly contradicts this phase's premise. Surfaced by research mid-session;
  not put to the navigator as a discussion question in this pass. Recorded in CONTEXT.md
  as D-09 -- the plan MUST address it explicitly before implementation, not proceed past
  it silently.
