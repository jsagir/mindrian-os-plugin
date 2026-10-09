p='scripts/analogy-fitness-report.cjs'
s=open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:60],s.count(old))
    s=s.replace(old,new)

rep(""" *   --out <file>   also write the JSON report to <file>.
""",""" *   --out <file>   also write the JSON report to <file>. A relative path resolves against
 *                  the plugin root (legacy behaviour), an absolute path is used as given.
 *   --rank-mode <percentile|fixed>  (2026) percentile (default) derives per-layer
 *                  correspondence thresholds and the restatement trip from the candidate
 *                  corpus (needs >= 5 candidates, else it falls back to fixed and says so);
 *                  fixed reproduces the 2025 absolute thresholds (0.5 layer, 0.8 restatement).
 *   --legacy-rank  keep the 2025 order (a flagged restatement may lead when every candidate
 *                  is thin-banded). Default lifts the best non-restatement to Rank 1.
 *   --max-candidates <n>  bound the run (default 200); extra candidates are reported as
 *                  truncated, never silently dropped.
""")
rep("""  const opts = { mode: argv[0], input: null, stub: false, out: null };""","""  const opts = { mode: argv[0], input: null, stub: false, out: null, rankMode: 'percentile', legacyRank: false, maxCandidates: 200 };""")
rep("""      case '--out': opts.out = argv[i += 1]; break;""","""      case '--out': opts.out = argv[i += 1]; break;
      case '--rank-mode': opts.rankMode = argv[i += 1] === 'fixed' ? 'fixed' : 'percentile'; break;
      case '--legacy-rank': opts.legacyRank = true; break;
      case '--max-candidates': {
        const n = Number(argv[i += 1]);
        if (Number.isFinite(n) && n >= 1) opts.maxCandidates = Math.floor(n);
        break;
      }""")

# renderMatrix: add percentile column only when present
rep("""  L.push('| Rank | ID | Domain | Band | Fused | Restatement |');
  L.push('| ---- | -- | ------ | ---- | ----- | ----------- |');""","""  const hasPct = report.rows.some(function (r) { return typeof r.fusedPercentile === 'number'; });
  L.push('| Rank | ID | Domain | Band | Fused |' + (hasPct ? ' Pctile |' : '') + ' Restatement |');
  L.push('| ---- | -- | ------ | ---- | ----- |' + (hasPct ? ' ------- |' : '') + ' ----------- |');""")
rep("""    L.push('| ' + r.rank + ' | ' + r.id + ' | ' + (r.domain || '') + ' | '
      + band + ' | ' + fused + ' | ' + restate + ' |');""","""    const pct = (typeof r.fusedPercentile === 'number') ? ' ' + Math.round(r.fusedPercentile * 100) + ' |' : (hasPct ? ' n/a |' : '');
    L.push('| ' + r.rank + ' | ' + r.id + ' | ' + (r.domain || '') + ' | '
      + band + ' | ' + fused + ' |' + pct + ' ' + restate + ' |');""")
rep("""    L.push('fitness measured by ' + report.provenance.model + ' (' + report.provenance.dim + '-dim)');
  }""","""    L.push('fitness measured by ' + report.provenance.model + ' (' + report.provenance.dim + '-dim)');
  }
  if (report.scoring) {
    L.push('threshold mode: ' + report.scoring.mode + ' (n=' + report.n_scored + ')'
      + (report.scoring.note ? '; ' + report.scoring.note : ''));
  }""")

# runScore body
a=s.index("  const encodeOpts = opts.stub ? { encodeFn: stubEncode } : {};")
b=s.index("  const report = { provenance: provenance, rows: rows };")
new_body = """  const encodeOpts = opts.stub ? { encodeFn: stubEncode } : {};
  encodeOpts.thresholdMode = opts.rankMode === 'fixed' ? 'fixed' : 'percentile';

  // Bound the run (2026) and report what was cut; never drop silently.
  const allCands = parsed.candidates;
  const cap = Number.isFinite(opts.maxCandidates) ? opts.maxCandidates : 200;
  const used = allCands.slice(0, cap);
  const truncated = allCands.length - used.length;
  const candObjs = used.map(function (c) { return (c && typeof c === 'object') ? c : {}; });

  // Per-candidate figure-guard now lives inside scoreCandidates (one bad candidate becomes a
  // per-row error, it never kills the run). Encoder-unavailable is a GLOBAL degrade there.
  const batch = await fitness.scoreCandidates(parsed.source, candObjs, encodeOpts);
  if (!batch.success) {
    process.stdout.write(JSON.stringify({
      degrade: 'qualitative-only',
      reason: batch.reason || 'encoder_unavailable',
    }) + '\\n');
    return 0;
  }
  const scored = batch.results;
  scored.forEach(function (r, i) {
    r._id = candObjs[i].id;
    r._domain = candObjs[i].domain;
    r._text = candObjs[i].text;
    r._trail = {
      source_id: candObjs[i].source_id != null ? candObjs[i].source_id : candObjs[i].id,
      source_url: candObjs[i].source_url || candObjs[i].url || null,
      source_tier: candObjs[i].source_tier || null,
      retrieved_at: candObjs[i].retrieved_at || candObjs[i].source_date || null,
      evidence: candObjs[i].evidence || null,
      novelty_check: candObjs[i].novelty_check || 'not_checked',
    };
  });

  const ranked = fitness.rankCandidates(scored, { legacy: opts.legacyRank === true });

  // Provenance derived from the FIRST successful result (they all share it).
  let provenance = null;
  for (let i = 0; i < ranked.length; i += 1) {
    if (ranked[i] && ranked[i].success && ranked[i].provenance) {
      provenance = ranked[i].provenance;
      break;
    }
  }

  const rows = ranked.map(function toRow(r, idx) {
    const row = {
      rank: idx + 1,
      id: r._id,
      domain: r._domain,
      text: r._text,
      band: (r.structural && r.structural.band) || null,
      fused: (typeof r.fused === 'number') ? r.fused : null,
      restatementFlag: r.restatementFlag === true,
    };
    if (r.percentile) row.fusedPercentile = r.percentile.fused;
    if (r.z) row.fusedZ = r.z.fused;
    if (r.legacy) row.legacyBand = r.legacy.band;
    if (r._trail) row.source_trail = r._trail;
    if (r._rowError) row.error = r._rowError;
    return row;
  });

"""
s=s[:a]+new_body+s[b:]
rep("""  const report = { provenance: provenance, rows: rows };""","""  const report = {
    provenance: provenance,
    rows: rows,
    // 2026 additive provenance: what was computed, with which parameters, and when.
    scoring: batch.scoring,
    n_scored: batch.n,
    candidates_truncated: truncated,
    generated_at: batch.scoring.computed_at,
    stub_encoder: opts.stub === true,
  };""")
rep("""    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\\n', 'utf8');""","""    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\\n', 'utf8');
    } catch (err) {
      // 2026: report the write failure instead of crashing after the report already printed.
      process.stderr.write('analogy-fitness-report: could not write --out file: ' + (err && err.message) + '\\n');
      return 1;
    }""")
rep("""  if (opts.out) {
    const outPath""","""  if (opts.out) {
    const outPath""") if False else None
# --out missing value
rep("""  if (!parsed || typeof parsed !== 'object'
      || !parsed.source || !Array.isArray(parsed.candidates)) {
    return badInput('bad_input');
  }""","""  if (!parsed || typeof parsed !== 'object'
      || !parsed.source || typeof parsed.source !== 'object' || !Array.isArray(parsed.candidates)) {
    return badInput('bad_input');
  }
  if (parsed.candidates.length === 0) return badInput('no_candidates');
  if (opts.out !== null && (typeof opts.out !== 'string' || opts.out === '' || opts.out.indexOf('--') === 0)) {
    return badInput('out_requires_path');
  }""")
rep("""  main(process.argv.slice(2)).then(function done(code) { process.exit(code); });""","""  // 2026: set exitCode instead of process.exit so piped stdout is flushed before exit.
  main(process.argv.slice(2)).then(function done(code) { process.exitCode = code; });""")
rep("""  renderMatrix: renderMatrix,
  main: main,""","""  renderMatrix: renderMatrix,
  main: main,
  runScore: runScore,""")
open(p,'w',encoding='utf-8').write(s)
