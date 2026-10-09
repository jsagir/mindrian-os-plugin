import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
def rep(o, n, c=1):
    global s
    assert s.count(o) == c, (s.count(o), o[:80])
    s = s.replace(o, n)

# 1. debug helper + containment helper after requires of node builtins
rep("""const { execFileSync } = require('node:child_process');
""", """const { execFileSync } = require('node:child_process');

// 2026: errors that used to be swallowed silently are reported when
// RS_AGENT_DEBUG=1 (stderr only; never changes return values).
function debugLog(where, err) {
  if (process.env.RS_AGENT_DEBUG === '1') {
    process.stderr.write('[reverse-salient-agent] ' + where + ': ' +
      String((err && err.message) || err) + '\\n');
  }
}

// 2026: resolve `rel` under `base` and refuse anything that escapes it
// (artifact ids come from engine output and must not read outside the room).
function resolveInside(base, rel) {
  if (typeof base !== 'string' || typeof rel !== 'string' || rel.length === 0) return null;
  const root = path.resolve(base);
  const full = path.resolve(root, rel);
  const relative = path.relative(root, full);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return full;
}

const DEFAULT_ENGINE_TIMEOUT_MS = 60000;
""")

# 2. gatherFocusContext / brain catches report
rep("""  } catch (_e) {
    // Defensive: if any navigation function throws (e.g. db schema not yet
    // initialized in a fresh tmp room), the agent surfaces no finding rather
    // than crashing. Wave 2 will wire telemetry on this path.
    return null;
  }""", """  } catch (_e) {
    // Defensive: if any navigation function throws (e.g. db schema not yet
    // initialized in a fresh tmp room), the agent surfaces no finding rather
    // than crashing. Wave 2 will wire telemetry on this path.
    debugLog('gatherFocusContext', _e);
    return null;
  }""")
rep("""  } catch (_e) {
    return { brain: null, graceful_degradation: 'no_quadruple' };
  }""", """  } catch (_e) {
    debugLog('gatherBrainContext', _e);
    return { brain: null, graceful_degradation: 'no_quadruple' };
  }""")

# 3. rsEndpoints containment
rep("""      try {
        raw = fs.readFileSync(path.join(roomDir, artifactId + '.md'), 'utf8');
      } catch (_e) {
        raw = '';
      }""", """      try {
        // 2026: artifact ids come from engine output; never read outside the room.
        const full = resolveInside(roomDir, String(artifactId) + '.md');
        raw = full ? fs.readFileSync(full, 'utf8') : '';
      } catch (_e) {
        debugLog('rsEndpoints', _e);
        raw = '';
      }""")

# 4. normalizePair: prefer raw-scale values, pass new additive fields
rep("""function normalizePair(pair) {
  const p = (pair && typeof pair === 'object') ? pair : {};
  return {""", """function normalizePair(pair) {
  const p = (pair && typeof pair === 'object') ? pair : {};
  // 2026: rs-engine.py's hybrid scoring reports signed_diff/abs_diff in
  // z-score units (roughly 0..6). mapDirectionToCascadeEdge and the persisted
  // edge properties are defined on the raw [-1, 1] scale (the 0.7 cut), so
  // prefer the raw_* keys the engine now also writes. Older engine output
  // (no raw_* keys, or --scoring legacy) falls through unchanged.
  const rawSigned = (typeof p.raw_signed_diff === 'number') ? p.raw_signed_diff : undefined;
  const rawAbs = (typeof p.raw_abs_diff === 'number') ? p.raw_abs_diff : undefined;
  return {""")
rep("""    signed_diff: readPairField(p, 'signed_diff', 'signed_delta'),
    abs_diff: readPairField(p, 'abs_diff'),
    direction: readPairField(p, 'direction', 'innovation_type'),
    lsa_score: readPairField(p, 'lsa_score'),
    semantic_score: readPairField(p, 'semantic_score'),
  };""", """    signed_diff: rawSigned !== undefined ? rawSigned : readPairField(p, 'signed_diff', 'signed_delta'),
    abs_diff: rawAbs !== undefined ? rawAbs : readPairField(p, 'abs_diff'),
    direction: readPairField(p, 'direction', 'innovation_type'),
    lsa_score: readPairField(p, 'lsa_score'),
    semantic_score: readPairField(p, 'semantic_score'),
    // 2026 additive passthrough (data only; never rendered, see D-29).
    scoring: readPairField(p, 'scoring'),
    gap_percentile: readPairField(p, 'gap_percentile'),
    gap_z: readPairField(p, 'gap_z'),
    verification: readPairField(p, 'verification'),
  };""")

# 5. python backend: threshold/topic/output flags, timeout, stale-result guard
rep("""  const backend = rsBackendDispatch.resolveBackend();""", """  const backend = rsBackendDispatch.resolveBackend();
  const startedAtMs = Date.now();
  const resultsPath = path.join(roomDir, '.rs-engine-results.json');""")
rep("""    const args = ['--mode', mode, '--room', roomDir];
    if (o.topk) args.push('--topk', String(o.topk));
    if (o.no_thesis) args.push('--no-thesis');
    try {
      execFileSync(py, [script].concat(args), {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
      });""", """    // 2026: --output pins the results to the file this function reads back, so
    // external/hybrid modes (which default to research/<slug>/) no longer
    // surface as rs_engine_results_missing. --threshold was previously dropped
    // on the python path; --topic is required by the external/hybrid modes.
    const args = ['--mode', mode, '--room', roomDir, '--output', resultsPath];
    if (o.topk) args.push('--topk', String(o.topk));
    if (typeof o.threshold === 'number' && Number.isFinite(o.threshold)) {
      args.push('--threshold', String(o.threshold));
    }
    if (typeof o.topic === 'string' && o.topic.length > 0) args.push('--topic', o.topic);
    if (o.scoring === 'hybrid' || o.scoring === 'legacy') args.push('--scoring', o.scoring);
    if (o.no_thesis) args.push('--no-thesis');
    const envTimeout = Number(process.env.RS_ENGINE_TIMEOUT_MS);
    const timeoutMs = (Number.isFinite(o.timeoutMs) && o.timeoutMs > 0) ? o.timeoutMs
      : (Number.isFinite(envTimeout) && envTimeout > 0) ? envTimeout
      : DEFAULT_ENGINE_TIMEOUT_MS;
    try {
      execFileSync(py, [script].concat(args), {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      });""")
rep("""  const resultsPath = path.join(roomDir, '.rs-engine-results.json');
  if (!fs.existsSync(resultsPath)) {
    return { ok: false, reason: 'rs_engine_results_missing', pairs: [] };
  }
  let raw;""", """  if (!fs.existsSync(resultsPath)) {
    return { ok: false, reason: 'rs_engine_results_missing', pairs: [] };
  }
  // 2026: a results file older than this invocation means the engine did not
  // write one (exit 0 with nothing written, or a swallowed failure). Reading
  // it would surface findings from a previous run as if they were current.
  try {
    if (fs.statSync(resultsPath).mtimeMs < startedAtMs - 2000) {
      return { ok: false, reason: 'rs_engine_results_stale', pairs: [] };
    }
  } catch (_e) {
    debugLog('runRsEngine stat', _e);
    return { ok: false, reason: 'rs_engine_results_missing', pairs: [] };
  }
  let raw;""")
rep("""  } catch (_e) {
    return { ok: false, reason: 'rs_engine_results_parse_failed', pairs: [] };
  }""", """  } catch (_e) {
    debugLog('runRsEngine parse', _e);
    return { ok: false, reason: 'rs_engine_results_parse_failed', pairs: [] };
  }""")
rep("""  const pairs = (raw && Array.isArray(raw.pairs)) ? raw.pairs.map(normalizePair) : [];
  return { ok: true, pairs, stampsByPairKey };""", """  const pairs = (raw && Array.isArray(raw.pairs)) ? raw.pairs.map(normalizePair) : [];
  return { ok: true, pairs, stampsByPairKey, metadata: (raw && raw.metadata) || null };""")

# 6. composeFinding additive evidence fields
rep("""    signed_diff: pair.signed_diff,
    abs_diff: pair.abs_diff,
    body_text,
    brain_chain_text: chainText,
  };""", """    signed_diff: pair.signed_diff,
    abs_diff: pair.abs_diff,
    body_text,
    brain_chain_text: chainText,
    // 2026 additive: machine-readable evidence from rs-engine.py (source
    // trail, second-signal check, novelty status). Data only: it is NOT part
    // of body_text and is never rendered (D-29 forbids scalars in the render).
    verification: pair.verification || null,
    scoring: pair.scoring || null,
  };""")

# 7. detectAndSurface: forward new opts
rep("""    topk: a.topk,
    no_thesis: a.no_thesis,
    deps: a.deps,
  });""", """    topk: a.topk,
    threshold: a.threshold,
    topic: a.topic,
    scoring: a.scoring,
    timeoutMs: a.timeoutMs,
    no_thesis: a.no_thesis,
    deps: a.deps,
  });""")

# 8. telemetry catches
rep("""  } catch (_e) {
    return { ok: false, reason: 'detected_telemetry_threw' };
  }""", """  } catch (_e) {
    debugLog('emitDetected', _e);
    return { ok: false, reason: 'detected_telemetry_threw' };
  }""")
rep("""  } catch (_e) {
    return { ok: false, reason: 'acted_telemetry_threw' };
  }""", """  } catch (_e) {
    debugLog('emitActed', _e);
    return { ok: false, reason: 'acted_telemetry_threw' };
  }""")
# persona catches
rep("""    return (best && bestWeight > 0) ? best : 'default';
  } catch (_e) {
    return 'default';
  }""", """    return (best && bestWeight > 0) ? best : 'default';
  } catch (_e) {
    debugLog('resolvePersonaKey', _e);
    return 'default';
  }""")
rep("""    return personaSuffix.suffixFor(roleBlend);
  } catch (_e) {
    return 'lagging component';
  }""", """    return personaSuffix.suffixFor(roleBlend);
  } catch (_e) {
    debugLog('resolvePersonaSuffix', _e);
    return 'lagging component';
  }""")
rep("""  _internal: { normalizePair, readPairField },""", """  _internal: { normalizePair, readPairField, resolveInside },""")
open(out, "w", encoding="utf-8").write(s)
print("ok")
