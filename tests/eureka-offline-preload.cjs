'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * quick(260706-13z) -- ZERO-network guard for the Phase 211 test aggregator.
 *
 * WHY THIS EXISTS (must-have truth #4): "bash tests/run-all-211.sh stays green
 * with ZERO network (Canon Part 8)." Every 211 test embeds via the stub
 * encodeFn seam, so no test NEEDS a model download. The one exception is the
 * tri-modal rerank test (Test 8), which asserts the graceful-degrade path
 * (warning:'rerank_unavailable') when the FlashRank model cannot load. That
 * assertion only holds when a real model load is impossible.
 *
 * Historically the suite got that for free because @huggingface/transformers
 * was not installed in the dev tree. Once the eureka deps ARE installed (the
 * quick(260706-13z) doctor L1 deps_present layer requires it), a networked
 * machine would silently DOWNLOAD the rerank model and break the ZERO-network
 * contract. transformers.js v4 ignores HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE;
 * the only offline switch is env.allowRemoteModels.
 *
 * This preload (wired via NODE_OPTIONS=--require in run-all-211.sh, inherited by
 * every spawned leg AND its child processes) flips that switch to false, so any
 * uncached model load fails fast and degrades instead of reaching the network.
 * It is a no-op when the dep is absent (airgapped CI), so it never breaks the
 * deps-absent path either. Defensive: never throws.
 */
try {
  // eslint-disable-next-line global-require
  const transformers = require('@huggingface/transformers');
  if (transformers && transformers.env) {
    transformers.env.allowRemoteModels = false; // cache-only; no network reach
  }
} catch (_e) {
  // Dep absent (airgapped install) -> nothing to guard; the model paths already
  // degrade via require-throw. Silent by design.
}
