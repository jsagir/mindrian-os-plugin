// Phase 127.1 -- Neo4j vector index DDL
// Created by scripts/load-embeddings-into-neo4j.cjs (Plan 127.1-02).
//
// One source of truth for the methodology vector-index shape. Loader reads
// this file, splits on the trailing semicolon, executes the DDL via the
// neo4j-driver session.run path. Maintainers do not have to grep through
// .cjs to find the DDL; the .cypher file IS the contract.
//
// Locked by the CONTEXT.md four-lock protocol:
//   Lock 1 (byte-identical embeddings):   preserved by the loader's SHA256
//                                          round-trip check between the
//                                          Pinecone-side manifest (Plan
//                                          127.1-01) and the Neo4j-side
//                                          re-read after MERGE+SET.
//   Lock 2 (model + dims):                 multilingual-e5-large, 1024 dims.
//                                          The dim=1024 lives below as a
//                                          grep-locked numeric literal so a
//                                          future minor-version Neo4j config
//                                          drift surfaces in code review.
//   Lock 3 (similarity metric):            cosine. Explicit even though
//                                          Neo4j 5.13+ defaults to cosine
//                                          per RESEARCH A127.1.3; the
//                                          explicit lock survives any future
//                                          default change in a minor-version
//                                          upgrade and makes the metric an
//                                          inspectable artifact of the
//                                          SHOW INDEXES row that Surface 2
//                                          harness consumes.
//   Lock 4 (non-regression harness):       owned by Plan 127.1-03 / Wave 2.
//                                          Cutover blocked until top-5
//                                          overlap >= 0.80 across the 20
//                                          fuzzy queries in
//                                          tests/127.1-graphrag-overlap-corpus.json.
//
// Index parameters (per RESEARCH A127.1.4):
//   - HNSW Lucene-backed (Neo4j 5.11+ native vector index)
//   - Defaults m=16, ef_construction=100 are sufficient for a 1,427-vector
//     corpus per the SIGMOD 2026 HNSW merger study and dbi-services pgvector
//     tuning report; pre-tuning is unnecessary at this scale.
//   - quantization.enabled defaults to true (memory-efficient; Neo4j
//     Cypher Manual 2026 recommends as default).
//
// Node + property contract:
//   - Node label:   MethodologyChunk
//   - Property:     embedding (LIST<FLOAT> on Neo4j 5.13-2025.09;
//                              VECTOR<FLOAT> on Neo4j 2025.10+)
//
// IF NOT EXISTS makes the loader idempotent: running the DDL twice is a
// no-op on the second run.

CREATE VECTOR INDEX mindrian_methodology_vec IF NOT EXISTS
FOR (n:MethodologyChunk) ON (n.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1024,
    `vector.similarity_function`: 'cosine'
  }
};

// Introspection query consumed by Surface 2 harness via
// tests/fixtures/127.1/index-config.fixture.json.
//
// SHOW INDEXES YIELD name, state, type, entityType, labelsOrTypes, properties, indexConfig
//   WHERE name = 'mindrian_methodology_vec';
