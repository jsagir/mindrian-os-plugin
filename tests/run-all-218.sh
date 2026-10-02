#!/usr/bin/env bash
# Phase 218 verification aggregator -- the single PASS/FAIL/SKIP gate for the
# entity-extraction-pipeline cluster (the typed entity-node writer + domain edge
# vocabulary from Plan 01, the D-05 write-safety + tier-1 prose extractor from
# Plan 02, and the standalone entity-extract.cjs dispatcher + noise-reduction
# outcome from Plan 03). Pure composition + governed wiring over the shipped
# 211-216 Eureka engine (Canon Part 7/11).
#
# The phase gate has TWO legs (the 211-05 / 216 pattern):
#   (1) this aggregator green (all offline, hermetic, zero network), AND
#   (2) the Plan 03 human-verify leg recorded: a HUMAN runs entity-extract
#       against the live aion-eureka-synergy room and confirms the top-25
#       structural-vs-structural share drops below 50% (REQ-5 acceptance number,
#       D-04), logged in the phase VERIFICATION artifact.
#
# ZERO-TOUCH PROOF (D-03/REQ-3/REQ-4): the whole point of routing extraction
# through navigation is that the downstream readers and the embedding store get
# richer results with NO code change on their side. The git-diff --exit-code
# gates below are the enforcement: vector-store.cjs (REQ-3, no second embedding
# path) and insights.cjs + graph-ops.cjs (REQ-4, no reader change) must be
# byte-unchanged. The grep gates enforce Canon Part 8/9: no raw INSERT INTO
# nodes/edges (all writes route through navigation) and no network reach in the
# extractor or dispatcher.
#
# EGRESS RULE (Part 8, restated, refined for the two-tier redesign quick-task
# 260714-k44 over 260714-hzx): the tier-1 extractor AND the entity-extract.cjs
# dispatcher BODY make zero network reach -- grep-enforced by leg (d) below. Tier-2a
# (lib/core/eureka/embedding-classifier.cjs) is ALSO fully local and free: it
# delegates to the embedding-spine boundary (generic model weights by id only, no
# user bytes), so it never carries a transport of its own. The ONLY remote model
# reach in the pipeline lives in the tier-2b classifier module
# (lib/core/semantic-index/entity-classifier.cjs): a LOCAL classification call over the
# Anthropic LLM transport (the mva-classifier / llm-name-suggester precedent),
# NEVER the Brain surface, with a degrade-to-passthrough contract, now called for
# the low-margin escalated residual ONLY. This is NOT the rejected Plurai network
# judge. Every leg here runs OFFLINE: the tier-2 legs exercise the embedding tier
# via injected verdicts and the escalation path via an injected classifier, with the
# fallback path forced by a no-key, so real-room content never reaches any live
# model in CI. The live-room acceptance (with a real key) is the Task 3 leg.
#
# The 211 regression leg is run_if, GATED ON A FILE that must exist, so a
# partially-landed tree exits cleanly with a SKIP rather than RED-failing on
# absence. bash only. No em-dashes.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ZERO-network guard (inherited from Phase 211/216): the offline preload flips
# transformers.js env.allowRemoteModels=false in every spawned leg (AND its
# children -- the noise-reduction leg's entity-extract re-embed spawns nothing but
# loads the model), so an uncached model load fails fast and degrades instead of
# reaching the network. No-op when the eureka dep is absent.
export NODE_OPTIONS="${NODE_OPTIONS:-} --require ${ROOT}/tests/eureka-offline-preload.cjs"

PASS=0
FAIL=0
SKIP=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}
run_if() {
  local label="$1"; local file="$2"; shift 2
  if [ -f "$file" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $file)"; SKIP=$((SKIP+1)); echo ""
  fi
}

# (a) The Plan 01 + Plan 02 unit tests: the entity-node writer + edge vocabulary,
#     the D-05 write-safety edit, and the tier-1 prose extractor.
run "218-01 edge vocab + entity writer floor" \
  node tests/test-218-edge-vocab.cjs
run "218-01 entity-node writer (proposed-only)" \
  node tests/test-218-entity-writer.cjs
run "218-02 D-05 write-safety (busy timeout + rollback)" \
  node tests/test-218-write-safety.cjs
run "218-02 tier-1 extractor (zero egress)" \
  node tests/test-218-extractor.cjs
# Tier-2 (two-tier, quick-task 260714-k44 over 260714-hzx): tier-2a local embedding
# classifier + tier-2b escalation-only LLM classifier + the dispatcher second pass +
# framework_terms capture. All offline (injected embedding verdicts + injected
# classifier + forced no-key); proves embedding-alone resolution, minimal escalation,
# honest no-LLM degrade, WHY reroute, framework_terms merge, relation filtering,
# encoder-unavailable degrade-to-hzx, and the synthetic domain-agnostic path.
run "tier-2 two-tier WHAT/WHY classifier + dispatcher second pass (offline)" \
  node tests/test-218-what-why-classifier.cjs

# (a.1) T-218-VD-4: the extractor also walks non-memory-kinded analysis files.
#     Phase 366 plan 25 (D-02, runner retirement, slice B) retired two legs that
#     lived here, both on the standalone Eureka runner, which is gone:
#     T-218-VD (cohort stratification, a percentile fix inside the runner's
#     all-pairs scoring loop; the Eureka perspective has no percentile cohort)
#     and T-218-VD-5 (the runner dispatcher's auto-extract-before-run pre-step;
#     entity extraction itself stays covered by the extractor, tier-2 and
#     noise-reduction legs here). Reasons recorded in 366-25-SUMMARY.md.
run "T-218-VD-4 extend-to-artifacts (walk non-memory-kinded analysis files)" \
  node tests/test-218-extend-to-artifacts.cjs

# (b) REQ-3 zero-touch gate: no second embedding path, no vector-store signature
#     change. The re-embed rides the EXISTING tri-modal indexNodes path.
run "REQ-3 vector-store unchanged" \
  git diff --exit-code lib/core/semantic-index/vector-store.cjs

# (c) REQ-4 zero-touch gate: the downstream readers (whitespace_scan via
#     insights.cjs, contradiction_check via graph-ops.cjs) benefit with ZERO code
#     change on their side.
run "REQ-4 readers unchanged" \
  git diff --exit-code lib/core/navigation/insights.cjs lib/core/graph-ops.cjs

# (d) REQ-2 / Canon Part 9 + Part 8 grep gates: every write routes through
#     navigation (no raw INSERT), and the tier-1 extractor + the dispatcher BODY
#     make zero network reach. This file list stays FROZEN on purpose: it is the
#     proof the tier-1 partner and the dispatcher body stayed clean after the
#     tier-2 addition. The ONE model reach (entity-classifier.cjs) is deliberately
#     NOT in this list; the tier-2 test asserts it is the sole eureka carrier.
run "no raw node/edge INSERT" \
  bash -c '! grep -rnE "INSERT INTO (nodes|edges)" scripts/entity-extract.cjs lib/core/semantic-index/entity-extractor.cjs'
run "zero network" \
  bash -c "! grep -rnE \"fetch|https?\\.|require\\('node:http\" lib/core/semantic-index/entity-extractor.cjs scripts/entity-extract.cjs"

# (e) No command surface leaked (D-03: entity-extract.cjs is a plain script, NOT a
#     born-wired /mos: command; the connector registry must stay green as proof).
run "no command surface leaked" \
  node scripts/build-connector-registry.cjs --check

# (f) REQ-5 exact: the noise-reduction mechanism on a hermetic seeded room. With
#     the quick-260715-0nj / 363.1 D-03 scaffold exclusion (now in the Eureka
#     perspective's substrate stage, eureka-recall.cjs) the structural share is
#     0 by construction (empty pre, exactly-0 post, minted entities reach the
#     substrate as bridges).
run "REQ-5 noise-reduction (exact, offline)" \
  node tests/test-218-noise-reduction.cjs

# (f.1) quick-260715-0nj both-scaffold candidate-pair filter, at the Eureka
#       perspective's recall seam: scaffold-only room recalls empty; mixed room
#       recalls only content pairs, no scaffold endpoint on either side (363.1
#       D-03), and the entity-bridged content pair ranks. The live
#       re-verification on the aion-eureka-synergy tier2-verified substrate
#       (72.0 percent -> 0.0 percent) is the quick task's Task 2 leg, recorded in
#       218-VERIFICATION.md.
run "quick-260715-0nj scaffold-pair filter (scaffold exclusion at recall, offline)" \
  node tests/test-218-scaffold-pair-filter.cjs

# (f.2) RCA handoff-eureka-entity-noise-2026-07-19: the low-trust entity provenance
#       split, the stamping half -- the unverified (low_confidence/fallback)
#       evidenceTier stamp on WHAT entities. The exclusion half (the runner's pair
#       filter and its Tier-0 guard) retired with the standalone runner in Phase
#       366 plan 25; the Eureka perspective has no low-trust pair filter.
#       Offline/hermetic (injected embedding verdicts + seeded nodes).
run "RCA-260719 low-trust entity stamping (offline)" \
  node tests/test-218-low-trust-exclusion.cjs

# (f.3) CR-01 (code review, phase 231, 2026-07-19): the same entity name can
#       appear in more than one artifact; tier-2b escalates per artifact over a
#       separate network call each time, so an ordinary transient failure on
#       just one of those calls can leave two entries for the same name
#       disagreeing on evidenceTier. Proves the reconciliation pass keeps the
#       highest-trust verdict regardless of write order, and that no DESCRIBES
#       edge is lost for the "losing" artifact's occurrence. Offline/hermetic.
run "CR-01 duplicate entity name reconciliation (highest-trust wins, offline)" \
  node tests/test-218-duplicate-entity-reconciliation.cjs

# (f.4) RCA eureka-entity-extraction-boilerplate-candidates (2026-09-17),
#       narrowed by quick task 260917-ild (Codex findings F2/F3/F4): the
#       scaffold-boilerplate entity-noise fix, now CONTENT-based end to end.
#       A memory_artifact row is a scaffold CANDIDATE on kind+basename (kind
#       AND basename together, never kind alone -- protects existing
#       kind:'ROOM'-tagged non-scaffold-path fixtures), but exclusion itself
#       is decided by comparing the file's body against the shipped
#       templates/room-skeleton/*.tmpl template (plus the BRAIN/FEYNMAN
#       in-code sources) via lib/core/semantic-index/scaffold-template-index.cjs:
#       template-identical is excluded (scaffold_files_skipped) while staying
#       a valid DESCRIBES anchor; a body that DIFFERS has its authored
#       remainder extracted instead (scaffold_files_extracted) and the
#       frontmatter metadata pass runs for BOTH branches. The legacy purge
#       (typed-entity.cjs purgeLegacySelfReferentialEntities) is bounded by
#       PROVEN scaffold-only DESCRIBES provenance, a proposed-or-NULL review
#       state, full-room scope only, and runs after the replacement writes
#       commit (legacy_entities_kept, legacy_purge_skipped). Every entity's
#       source_path is a real room-relative path instead of the prior
#       self-referential 'entity:sid:name' handle. Offline/hermetic.
run "RCA-260917 scaffold entity-noise exclusion (content-based + bounded purge, offline)" \
  node tests/test-eureka-scaffold-entity-noise.cjs

# (g) 211 engine no-regression: Plan 02's openRoomDb D-05 edit is GLOBAL to every
#     caller, so the 211 acceptance path must stay green. Guarded on the 211
#     aggregator so a partial tree SKIPs cleanly.
run_if "211 engine no-regression" "tests/run-all-211.sh" \
  bash tests/run-all-211.sh

echo "======================================"
echo "Phase 218: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
echo "======================================"
[ "$FAIL" -eq 0 ]
