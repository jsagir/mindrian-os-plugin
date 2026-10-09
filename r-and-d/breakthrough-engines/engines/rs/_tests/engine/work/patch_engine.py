import sys, re
src_path = sys.argv[1]; out_path = sys.argv[2]; block_path = sys.argv[3]
s = open(src_path, encoding="utf-8").read()
block = open(block_path, encoding="utf-8").read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (n, old[:80])
    s = s.replace(old, new)

# 1. docstring: honest default + 2026 notes
rep('''Embedding model is configurable per RESEARCH.md Q4:
  - RS_EMBEDDING_MODEL unset (default) -> multilingual-e5-large via Pinecone
    inference (Plan 89-03 wires the cold path).
  - RS_EMBEDDING_MODEL=minilm                -> local all-MiniLM-L6-v2.
  - RS_EMBEDDING_MODEL=bert-large-cased      -> explicit repro mode (heavy).
''', '''Embedding model is configurable per RESEARCH.md Q4:
  - RS_EMBEDDING_MODEL unset (default)       -> local all-MiniLM-L6-v2. (The
    original docstring claimed multilingual-e5-large; the code never did that,
    because the Pinecone inference path is a NotImplementedError stub.)
  - RS_EMBEDDING_MODEL=minilm                -> local all-MiniLM-L6-v2.
  - RS_EMBEDDING_MODEL=multilingual-e5-large -> stub; now falls back to MiniLM
    with a warning and metadata.embedding_fallback instead of crashing.
  - RS_EMBEDDING_MODEL=hashing               -> offline deterministic hashing
    surrogate (lexical, NOT semantic; outputs are flagged dense_degraded).
  - RS_EMBEDDING_MODEL=bert-large-cased      -> explicit repro mode (heavy,
    not wired; raises NotImplementedError).

2026 scoring (additive; see rs/CHANGES-engine.md):
  --scoring hybrid (default)  BM25 + LSA structural signal vs dense embedding
                              signal, ranked by corpus percentile.
  --scoring legacy            the original abs(semantic - lsa) with a fixed
                              threshold, unchanged.
  Every pair carries a `verification` block (source trail, claim-level
  evidence, second-signal check, novelty status) and metadata carries the
  provenance of what was computed. All new JSON keys are additive.
''')

# 2. guarded ensure_ml_deps
rep('''from ensure_ml_deps import ensure
ensure(["numpy", "requests"])''', '''try:
    from ensure_ml_deps import ensure
except ImportError:  # helper not shipped in this slice; deps are checked below
    def ensure(_packages):  # type: ignore[misc]
        return None
ensure(["numpy", "requests"])''')

# 3. new block after HYBRID_OVERSHOOT constant
anchor = "HYBRID_OVERSHOOT = 10\n"
rep(anchor, anchor + "\n\n" + block)

# 4. CRLF-safe frontmatter
rep('re.match(r"^---\\n([\\s\\S]*?)\\n---", content)', 're.match(r"^---\\r?\\n([\\s\\S]*?)\\r?\\n---", content)')
rep('for line in fm_match.group(1).split("\\n"):', 'for line in fm_match.group(1).splitlines():')
rep('re.match(r"^---\\n[\\s\\S]*?\\n---\\n?", content)', 're.match(r"^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n?", content)')

# 5. discover_artifacts: surface read errors, retrieved_at, cap
rep('''            try:
                content = fpath.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            body = extract_body(content).strip()''', '''            try:
                content = fpath.read_text(encoding="utf-8-sig")
                mtime = datetime.fromtimestamp(
                    fpath.stat().st_mtime, tz=timezone.utc).date().isoformat()
            except (OSError, UnicodeDecodeError) as e:
                print(f"rs-engine: skipped unreadable artifact {fpath}: {e}", file=sys.stderr)
                continue
            body = extract_body(content).strip()''')
rep('''                "path": str(fpath.relative_to(room_path)),
                "text": body,
            })
    return artifacts''', '''                "path": fpath.relative_to(room_path).as_posix(),
                "text": body,
                "retrieved_at": mtime,
            })
    if len(artifacts) > MAX_ARTIFACTS:
        print(
            f"rs-engine: {len(artifacts)} artifacts exceeds RS_MAX_ARTIFACTS="
            f"{MAX_ARTIFACTS} (pairwise matrices are O(n^2)); keeping the first "
            f"{MAX_ARTIFACTS} in sorted path order.",
            file=sys.stderr,
        )
        artifacts = artifacts[:MAX_ARTIFACTS]
    return artifacts''')

# 6. minilm model cache
rep('''def _embed_local_minilm(texts: Sequence[str]) -> Optional[np.ndarray]:
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:''', '''_ST_MODEL = None


def _embed_local_minilm(texts: Sequence[str]) -> Optional[np.ndarray]:
    global _ST_MODEL
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:''')
rep('''    model = SentenceTransformer("all-MiniLM-L6-v2")
    vectors = model.encode(list(texts), show_progress_bar=False)''', '''    if _ST_MODEL is None:  # load once per process (was reloaded on every call)
        _ST_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    vectors = _ST_MODEL.encode(list(texts), show_progress_bar=False)''')

# 7. compute_embeddings model resolution
rep('''    cold_model = "all-MiniLM-L6-v2" if model_env in ("", "minilm") else model_env''',
'''    if model_env in ("hashing", "hash", HASH_MODEL_NAME):
        model_env = "hashing"
    known = ("", "minilm", "hashing", DEFAULT_EMBEDDING_MODEL, "e5-large", "bert-large-cased")
    cold_model = (
        "all-MiniLM-L6-v2" if model_env in ("", "minilm")
        else HASH_MODEL_NAME if model_env == "hashing"
        else model_env
    )
    if model_env not in known:
        # Unknown names used to make the cache key never match what was stored.
        cold_model = "all-MiniLM-L6-v2"''')
rep('''        if model_env == "minilm" or model_env == "" and cold_model == "all-MiniLM-L6-v2":
            # MiniLM is the honest default until 89-03 wires Pinecone.
            new_vectors = _embed_local_minilm(missing_texts)
            model_used = "all-MiniLM-L6-v2"
        elif model_env == DEFAULT_EMBEDDING_MODEL or model_env == "e5-large":
            # Pinecone inference path. Plan 89-01 stub -> NotImplementedError.
            new_vectors = _embed_via_pinecone_inference(missing_texts)
            model_used = DEFAULT_EMBEDDING_MODEL''', '''        if model_env in ("minilm", ""):
            # MiniLM is the honest default until 89-03 wires Pinecone.
            new_vectors = _embed_local_minilm(missing_texts)
            model_used = "all-MiniLM-L6-v2"
        elif model_env == "hashing":
            new_vectors = _embed_hashing(missing_texts)
            model_used = HASH_MODEL_NAME
        elif model_env == DEFAULT_EMBEDDING_MODEL or model_env == "e5-large":
            # Pinecone inference path is still a stub. Fall back loudly rather
            # than crash a whole run (the error is printed and recorded).
            try:
                new_vectors = _embed_via_pinecone_inference(missing_texts)
                model_used = DEFAULT_EMBEDDING_MODEL
            except NotImplementedError as e:
                print(f"rs-engine: {e} Falling back to local MiniLM.", file=sys.stderr)
                _EMBED_FALLBACKS.append(f"{model_env}->all-MiniLM-L6-v2")
                new_vectors = _embed_local_minilm(missing_texts)
                model_used = "all-MiniLM-L6-v2"''')
rep('''def compute_embeddings(
    artifacts: Sequence[Dict],''', '''_EMBED_FALLBACKS: List[str] = []


def compute_embeddings(
    artifacts: Sequence[Dict],''')
rep('''    matrix = np.vstack([v for v in vectors if v is not None])
    return matrix, cold_model''', '''    if any(v is None for v in vectors):
        raise RuntimeError("embedding vectors missing after fill; refusing to misalign rows")
    dims = {v.shape[0] for v in vectors if v is not None}
    if len(dims) > 1:
        raise ValueError(f"mixed embedding dimensions in cache: {sorted(dims)}")
    matrix = np.vstack(vectors)
    return matrix, cold_model''')

# 8. semantic_similarity_matrix numpy
rep('''    from sklearn.metrics.pairwise import cosine_similarity
    sim = cosine_similarity(embeddings)
    return np.clip(sim, 0.0, 1.0).astype(np.float32)''', '''    # numpy implementation (same values as sklearn cosine_similarity, plus a
    # zero-norm guard); negative cosines are clipped to 0 as before.
    return cosine_matrix(embeddings, clip=True)''')

# 9. Mode A internal
rep('''    texts = [f"{a['title']}\\n{a['text']}" for a in artifacts]

    # Structural signal: authoritative topic-keyword-membership LSA.
    lsa_matrix = build_lsa_matrix(texts)

    # Semantic signal: embedding cosine.
    embeddings, model_used = compute_embeddings(artifacts, room_dir)
    if embeddings is None:
        # Fallback: treat semantic as identity so abs_diff collapses to 1-lsa.
        # This keeps the engine honest when no embedder is available.
        print(
            "rs-engine: no embedder available; semantic matrix set to identity",
            file=sys.stderr,
        )
        n = len(artifacts)
        sem_matrix = np.eye(n, dtype=np.float32)
    else:
        sem_matrix = semantic_similarity_matrix(embeddings)

    top_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=topk)
''', '''    texts = [f"{a['title']}\\n{a['text']}" for a in artifacts]

    # Structural signal: authoritative topic-keyword-membership LSA.
    lsa_matrix = build_lsa_matrix(texts)

    # Semantic signal: embedding cosine.
    embeddings, model_used = compute_embeddings(artifacts, room_dir)
    sem_matrix, model_used, degraded = _resolve_semantic(
        embeddings, texts, model_used, "rs-engine")

    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, degraded)
    top_pairs = scorer.topk(topk)
''')
rep('''            "direction": classify_direction(signed),
        })

    edges_written = write_reverse_salient_edges(room_dir, pair_dicts)''', '''            "direction": classify_direction(signed),
        })
        pair_dicts[-1].update(scorer.annotate(i, j, a_i, a_j))

    edges_written = write_reverse_salient_edges(room_dir, pair_dicts)''')
rep('''            "edges_written": edges_written,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result


# --- Cross-room''', '''            "edges_written": edges_written,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    result["metadata"].update(scorer.metadata())
    if _EMBED_FALLBACKS:
        result["metadata"]["embedding_fallback"] = list(_EMBED_FALLBACKS)
    return result


# --- Cross-room''')

# 10. cross-room
rep('''    embeddings, model_used = compute_embeddings(cache_artifacts, cache_dir)
    if embeddings is None:
        print(
            "rs-engine: no embedder available; semantic matrix set to identity",
            file=sys.stderr,
        )
        n = len(corpus)
        sem_matrix = np.eye(n, dtype=np.float32)
    else:
        sem_matrix = semantic_similarity_matrix(embeddings)

    # Overshoot so post-filter still yields topk when some pairs are intra-room.
    overshoot_k = max(topk * CROSS_ROOM_OVERSHOOT, topk + 10)
    top_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=overshoot_k)''', '''    embeddings, model_used = compute_embeddings(cache_artifacts, cache_dir)
    sem_matrix, model_used, degraded = _resolve_semantic(
        embeddings, texts, model_used, "rs-engine")

    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, degraded)
    # Overshoot so post-filter still yields topk when some pairs are intra-room.
    overshoot_k = max(topk * CROSS_ROOM_OVERSHOOT, topk + 10)
    top_pairs = scorer.topk(overshoot_k)''')
rep('''            "direction": classify_direction(signed),
        })
        if len(pair_dicts) >= topk:
            break
''', '''            "direction": classify_direction(signed),
        })
        pair_dicts[-1].update(scorer.annotate(i, j, a_i, a_j))
        if len(pair_dicts) >= topk:
            break
''')
rep('''            "pair_matrix": pair_matrix,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result


def _print_cross_room_summary''', '''            "pair_matrix": pair_matrix,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    result["metadata"].update(scorer.metadata())
    return result


def _print_cross_room_summary''')

# 11. external
rep('''        if sem_matrix is not None:
            model_used = "multilingual-e5-large"
        else:''', '''        if sem_matrix is not None:
            # Label kept for key compatibility; the vectors actually come from
            # the rs_cache local encoder bridge (see embedding_model_actual).
            model_used = "multilingual-e5-large"
            ext_model_actual = "rs_cache local encoder bridge (rs-vector-bridge.cjs)"
        else:''')
rep('''    sem_matrix: Optional[np.ndarray] = None
    model_used: str
    if cache_mode in ("warm", "cold") and records:''', '''    sem_matrix: Optional[np.ndarray] = None
    model_used: str
    ext_model_actual: Optional[str] = None
    ext_degraded = False
    if cache_mode in ("warm", "cold") and records:''')
rep('''            embeddings, model_used = compute_embeddings(artifacts, corpus_dir)
            sem_matrix = (
                semantic_similarity_matrix(embeddings)
                if embeddings is not None
                else np.eye(len(artifacts), dtype=np.float32)
            )
    else:
        embeddings, model_used = compute_embeddings(artifacts, corpus_dir)
        if embeddings is None:
            print(
                "rs-engine: no embedder available for Mode B; "
                "semantic matrix set to identity.",
                file=sys.stderr,
            )
            sem_matrix = np.eye(len(artifacts), dtype=np.float32)
        else:
            sem_matrix = semantic_similarity_matrix(embeddings)

    top_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=topk)
''', '''            embeddings, model_used = compute_embeddings(artifacts, corpus_dir)
            sem_matrix, model_used, ext_degraded = _resolve_semantic(
                embeddings, texts, model_used, "rs-engine")
    else:
        embeddings, model_used = compute_embeddings(artifacts, corpus_dir)
        sem_matrix, model_used, ext_degraded = _resolve_semantic(
            embeddings, texts, model_used, "rs-engine Mode B")

    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, ext_degraded)
    top_pairs = scorer.topk(topk)
''')
rep('''            "target_doi": a_j.get("doi"),
            "lsa_score": round(float(lsa_matrix[i, j]), 4),
            "semantic_score": round(float(sem_matrix[i, j]), 4),
            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })
''', '''            "target_doi": a_j.get("doi"),
            "lsa_score": round(float(lsa_matrix[i, j]), 4),
            "semantic_score": round(float(sem_matrix[i, j]), 4),
            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })
        pair_dicts[-1].update(scorer.annotate(i, j, a_i, a_j))
''')
rep('''            "edges_written": 0,  # Mode B does NOT write room.db edges.
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result, corpus_dir''', '''            "edges_written": 0,  # Mode B does NOT write room.db edges.
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    result["metadata"].update(scorer.metadata())
    if ext_model_actual:
        result["metadata"]["embedding_model_actual"] = ext_model_actual
    return result, corpus_dir''')

# 12. hybrid
rep('''    embeddings, model_used = compute_embeddings(cache_artifacts, corpus_dir)
    if embeddings is None:
        print(
            "rs-engine hybrid: no embedder available; "
            "semantic matrix set to identity.",
            file=sys.stderr,
        )
        n = len(corpus)
        sem_matrix = np.eye(n, dtype=np.float32)
    else:
        sem_matrix = semantic_similarity_matrix(embeddings)

    # Overshoot top-k, then post-filter to cross-corpus only.
    overshoot_k = max(topk * HYBRID_OVERSHOOT, topk + 10)
    raw_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=overshoot_k)
''', '''    embeddings, model_used = compute_embeddings(cache_artifacts, corpus_dir)
    sem_matrix, model_used, degraded = _resolve_semantic(
        embeddings, texts, model_used, "rs-engine hybrid")

    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, degraded)
    # Overshoot top-k, then post-filter to cross-corpus only.
    overshoot_k = max(topk * HYBRID_OVERSHOOT, topk + 10)
    raw_pairs = scorer.topk(overshoot_k)
''')
rep('''            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })

    result = {
        "metadata": {
            "mode": "hybrid",
            "hybrid": True,
            "topic": topic,''', '''            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })
        pair_dicts[-1].update(scorer.annotate(i, j, room_art, ext_doc))

    result = {
        "metadata": {
            "mode": "hybrid",
            "hybrid": True,
            "topic": topic,''')
rep('''            "external_target": external_target,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result, corpus_dir''', '''            "external_target": external_target,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    result["metadata"].update(scorer.metadata())
    return result, corpus_dir''')

# 13. _write_results atomic + mkdir
rep('''    path = Path(output).resolve() if output else (room_dir / RESULTS_FILENAME)
    path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return path''', '''    path = Path(output).resolve() if output else (room_dir / RESULTS_FILENAME)
    _write_json_atomic(path, result)
    return path


def _write_json_atomic(path: Path, payload: Dict) -> None:
    """mkdir parents, write to a temp file, then replace (no torn results)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)''')

# 14. CLI args
rep('''    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=(
            f"Minimum abs(semantic - lsa) to keep a pair (default {DEFAULT_THRESHOLD}). "
            "0.0 disables filtering."
        ),
    )''', '''    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help=(
            "Minimum gap to keep a pair. Legacy scoring: abs(semantic - lsa), "
            f"default {DEFAULT_THRESHOLD}. Hybrid scoring: rank-space gap, "
            "default 0.0 (the percentile cut does the gating). 0.0 disables."
        ),
    )
    parser.add_argument(
        "--scoring",
        choices=[SCORING_HYBRID, SCORING_LEGACY],
        default=DEFAULT_SCORING,
        help=(
            "hybrid (default): BM25 + LSA structural signal vs dense embedding "
            "signal, ranked by corpus percentile. legacy: original "
            "abs(semantic - lsa) with fixed threshold."
        ),
    )
    parser.add_argument(
        "--min-percentile",
        type=float,
        default=DEFAULT_MIN_PERCENTILE,
        help=(
            "Hybrid only: keep pairs whose rank gap is at or above this corpus "
            f"percentile (default {DEFAULT_MIN_PERCENTILE}; 0-1 or 0-100)."
        ),
    )
    parser.add_argument(
        "--lex-weight",
        type=float,
        default=DEFAULT_LEX_WEIGHT,
        help="Hybrid only: weight of BM25 vs LSA in the structural signal (0-1).",
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="Skip the per-pair verification block (faster; not recommended).",
    )''')

# 15. main: configure + threshold resolve
rep('''def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
''', '''def _configure_from_args(args) -> Optional[float]:
    """Populate SCORING_CFG and return the effective threshold, or None on
    invalid input (caller exits 2)."""
    minp = args.min_percentile
    if minp > 1.0:
        minp = minp / 100.0
    if not (0.0 <= minp <= 1.0):
        print("rs-engine: --min-percentile must be within 0-1 (or 0-100)", file=sys.stderr)
        return None
    if not (0.0 <= args.lex_weight <= 1.0):
        print("rs-engine: --lex-weight must be within 0-1", file=sys.stderr)
        return None
    SCORING_CFG.update({
        "scoring": args.scoring,
        "min_percentile": minp,
        "lex_weight": args.lex_weight,
        "verify": not args.no_verify,
    })
    if args.threshold is not None:
        return max(0.0, args.threshold)
    return DEFAULT_THRESHOLD if args.scoring == SCORING_LEGACY else 0.0


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    eff_threshold = _configure_from_args(args)
    if eff_threshold is None:
        return 2
''')
rep('''        topk = max(1, args.topk)
        threshold = max(0.0, args.threshold)

        try:
            result = run_mode_cross_room(''', '''        topk = max(1, args.topk)
        threshold = eff_threshold
        _PRIOR_PAIR_KEYS.clear()
        _PRIOR_PAIR_KEYS.update(_load_prior_pairs(
            Path(args.output).resolve() if args.output
            else Path(args.rooms[0]).resolve() / RESULTS_FILENAME))

        try:
            result = run_mode_cross_room(''')
rep('''    topk = max(1, args.topk)
    threshold = max(0.0, args.threshold)

    try:
        if args.mode == "internal":''', '''    topk = max(1, args.topk)
    threshold = eff_threshold
    _PRIOR_PAIR_KEYS.clear()
    if args.output:
        _prior_path: Optional[Path] = Path(args.output).resolve()
    elif args.mode == "internal":
        _prior_path = room_dir / RESULTS_FILENAME
    else:
        _slug = topic_slug(args.topic) if args.topic else ""
        _prior_path = (room_dir / "research" / _slug / RESULTS_FILENAME) if _slug else None
    _PRIOR_PAIR_KEYS.update(_load_prior_pairs(_prior_path))

    try:
        if args.mode == "internal":''')
# atomic writes in hybrid/external CLI branches
old_w = '''            if args.output:
                output_path = Path(args.output).resolve()
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(
                    json.dumps(result, indent=2), encoding="utf-8",
                )
            else:
                default_path.parent.mkdir(parents=True, exist_ok=True)
                default_path.write_text(
                    json.dumps(result, indent=2), encoding="utf-8",
                )
                output_path = default_path
'''
new_w = '''            output_path = Path(args.output).resolve() if args.output else default_path
            _write_json_atomic(output_path, result)
'''
rep(old_w, new_w, count=2)
open(out_path, "w", encoding="utf-8").write(s)
print("patched ok", len(s.splitlines()))
