// Read-only. Source chunks that mention BOTH nodes of a proposed relationship: in-graph evidence.
// Parameters: $a, $b (elementIds). Chunk text lives on Chunk and PwsChunk; MethodologyChunk holds ids and embeddings.
MATCH (a) WHERE elementId(a) = $a
MATCH (b) WHERE elementId(b) = $b
OPTIONAL MATCH (c1)-[:MENTIONS]->(a)
OPTIONAL MATCH (c1)-[:MENTIONS]->(b)
WITH a, b, collect(DISTINCT c1) AS both_via_mentions
OPTIONAL MATCH (a)-[:MENTIONED_IN]->(c2)<-[:MENTIONED_IN]-(b)
RETURN [c IN both_via_mentions | coalesce(c.id, '')][0..10] AS mention_chunk_ids,
       collect(DISTINCT {id: coalesce(c2.id, ''), text: left(coalesce(c2.text, ''), 600)})[0..10] AS cooccurring_chunks
