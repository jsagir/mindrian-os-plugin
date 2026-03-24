#!/usr/bin/env python3
"""
Consolidate all Pinecone indexes into a single 'pws-brain' index
with integrated multilingual-e5-large embeddings.

Source indexes:
  - mindrian-knowledge  (768-dim, 10,475 records, 21 namespaces)
  - neo4j-knowledge-base (1024-dim, 1,451 records, 2 namespaces)
  - mindrian-graphrag    (1024-dim, 144 records, 1 namespace)
  - pws-world            (1024-dim, 325 records, 1 namespace)

Target: pws-brain (1024-dim, multilingual-e5-large integrated)

All text content is re-embedded by the integrated model on upsert.
"""

import os
import sys
import time
from pinecone import Pinecone

API_KEY = os.environ.get("PINECONE_API_KEY", "pcsk_2BdKp7_8ptiybKm28fyCqMowRVky4EUoFm4Tx9pwatf8E4zK3VhvqADaMMwoS1VSyTURha")
TARGET_INDEX = "pws-brain"

# Map source namespaces to target namespaces (flatten the mess)
NAMESPACE_MAP = {
    # mindrian-knowledge namespaces
    "t1-core": "core",
    "t3-reference": "reference",
    # All t2-* tool namespaces merge into "tools"
    "t2-trending-absurd": "tools",
    "t2-six-thinking-hats": "tools",
    "t2-systems-thinking": "tools",
    "t2-reverse-salient": "tools",
    "t2-pws-investment": "tools",
    "t2-pws-consultant": "tools",
    "t2-minto-pyramid": "tools",
    "t2-beautiful-question": "tools",
    "t2-oracle-futures": "tools",
    "t2-scenario-analysis": "tools",
    "t2-red-teaming": "tools",
    "t2-knowns-unknowns": "tools",
    "t2-scurve": "tools",
    "t2-validation-compass": "tools",
    "t2-pws-grading": "tools",
    "t2-nested-hierarchies": "tools",
    "t2-leadership": "tools",
    "t2-ackoff-pyramid": "tools",
    "t2-domain-selection": "tools",
    "t2-jtbd": "tools",
    # neo4j-knowledge-base namespaces
    "pws-materials": "materials",
    "": "materials",  # default namespace -> materials
    "__default__": "materials",
    # mindrian-graphrag
    "graphrag": "graphrag",
    # pws-world
    "pws-world-default": "world",
}

SOURCE_INDEXES = [
    {
        "name": "mindrian-knowledge",
        "namespaces": [
            "t1-core", "t3-reference",
            "t2-trending-absurd", "t2-six-thinking-hats", "t2-systems-thinking",
            "t2-reverse-salient", "t2-pws-investment", "t2-pws-consultant",
            "t2-minto-pyramid", "t2-beautiful-question", "t2-oracle-futures",
            "t2-scenario-analysis", "t2-red-teaming", "t2-knowns-unknowns",
            "t2-scurve", "t2-validation-compass", "t2-pws-grading",
            "t2-nested-hierarchies", "t2-leadership", "t2-ackoff-pyramid",
            "t2-domain-selection", "t2-jtbd",
        ],
    },
    {
        "name": "neo4j-knowledge-base",
        "namespaces": ["pws-materials", ""],
    },
    {
        "name": "mindrian-graphrag",
        "namespaces": ["graphrag"],
    },
    {
        "name": "pws-world",
        "namespaces": ["__default__"],
    },
]


def fetch_all_ids(index, namespace: str) -> list[str]:
    """List all vector IDs in a namespace."""
    all_ids = []
    for ids_batch in index.list(namespace=namespace):
        if isinstance(ids_batch, list):
            all_ids.extend(ids_batch)
        else:
            all_ids.extend(ids_batch)
    return all_ids


def fetch_records_batch(index, ids: list[str], namespace: str) -> list[dict]:
    """Fetch vectors + metadata for a batch of IDs."""
    result = index.fetch(ids=ids, namespace=namespace)
    records = []
    for vid, vec in result.get("vectors", {}).items():
        meta = vec.get("metadata", {})
        # Find the text content field
        content = meta.get("content") or meta.get("text") or meta.get("chunk_text") or ""
        if not content:
            # Try to build content from other fields
            title = meta.get("title", "")
            desc = meta.get("description", "")
            content = f"{title}. {desc}".strip(". ")
        if content:
            records.append({
                "id": vid,
                "content": content,
                "metadata": {k: v for k, v in meta.items() if k != "content" and isinstance(v, (str, int, float, bool))},
            })
    return records


def main():
    pc = Pinecone(api_key=API_KEY)

    # Step 1: Create target index if it doesn't exist
    existing = [idx.name for idx in pc.list_indexes()]
    if TARGET_INDEX not in existing:
        print(f"Creating index '{TARGET_INDEX}' with multilingual-e5-large...")
        pc.create_index_for_model(
            name=TARGET_INDEX,
            cloud="aws",
            region="us-east-1",
            embed={
                "model": "multilingual-e5-large",
                "field_map": {"text": "content"},
            },
        )
        # Wait for index to be ready
        while True:
            desc = pc.describe_index(TARGET_INDEX)
            if desc.status.ready:
                break
            print("  Waiting for index to be ready...")
            time.sleep(5)
        print(f"  Index '{TARGET_INDEX}' is ready.")
    else:
        print(f"Index '{TARGET_INDEX}' already exists.")

    target = pc.Index(TARGET_INDEX)

    total_migrated = 0
    total_skipped = 0

    for source_config in SOURCE_INDEXES:
        src_name = source_config["name"]
        print(f"\n{'='*60}")
        print(f"Source: {src_name}")
        print(f"{'='*60}")

        src_index = pc.Index(src_name)

        for ns in source_config["namespaces"]:
            target_ns = NAMESPACE_MAP.get(ns, "misc")
            display_ns = ns if ns else "(default)"
            print(f"\n  Namespace: {display_ns} -> {target_ns}")

            # Fetch all IDs
            try:
                all_ids = fetch_all_ids(src_index, ns)
            except Exception as e:
                print(f"    ERROR listing IDs: {e}")
                continue

            if not all_ids:
                print(f"    No records found, skipping.")
                continue

            print(f"    Found {len(all_ids)} records")

            # Process in batches of 20 (stay under 250K token/min limit)
            batch_size = 20
            ns_migrated = 0
            ns_skipped = 0
            backoff = 3  # seconds between batches

            for i in range(0, len(all_ids), batch_size):
                batch_ids = all_ids[i:i + batch_size]
                try:
                    records = fetch_records_batch(src_index, batch_ids, ns)
                except Exception as e:
                    print(f"    ERROR fetching batch {i//batch_size}: {e}")
                    continue

                if not records:
                    ns_skipped += len(batch_ids)
                    continue

                # Upsert to target (integrated model will re-embed)
                upsert_batch = []
                for rec in records:
                    meta = rec["metadata"]
                    meta["_source_index"] = src_name
                    meta["_source_namespace"] = ns
                    meta["content"] = rec["content"]

                    upsert_batch.append({
                        "_id": f"{src_name}_{ns}_{rec['id']}" if ns else f"{src_name}_{rec['id']}",
                        "content": rec["content"],
                        **{k: v for k, v in meta.items() if k != "content"},
                    })

                # Retry with exponential backoff on rate limit
                for attempt in range(5):
                    try:
                        target.upsert_records(target_ns, upsert_batch)
                        ns_migrated += len(upsert_batch)
                        break
                    except Exception as e:
                        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                            wait = backoff * (2 ** attempt)
                            print(f"    Rate limited, waiting {wait}s... (batch {i//batch_size})")
                            time.sleep(wait)
                        else:
                            print(f"    ERROR upserting batch {i//batch_size}: {e}")
                            ns_skipped += len(batch_ids)
                            break
                else:
                    print(f"    FAILED after 5 retries, skipping batch {i//batch_size}")
                    ns_skipped += len(batch_ids)

                # Progress update every 10 batches
                if (i // batch_size) % 10 == 0 and i > 0:
                    print(f"    Progress: {ns_migrated}/{len(all_ids)} migrated")

                # Pace ourselves
                time.sleep(backoff)

            print(f"    Migrated: {ns_migrated}, Skipped: {ns_skipped}")
            total_migrated += ns_migrated
            total_skipped += ns_skipped

    print(f"\n{'='*60}")
    print(f"MIGRATION COMPLETE")
    print(f"Total migrated: {total_migrated}")
    print(f"Total skipped:  {total_skipped}")
    print(f"Target index:   {TARGET_INDEX}")
    print(f"{'='*60}")

    # Show target stats
    time.sleep(5)  # Give Pinecone a moment to index
    stats = target.describe_index_stats()
    print(f"\nTarget index stats:")
    for ns, info in stats.namespaces.items():
        print(f"  {ns}: {info.vector_count} records")
    print(f"  TOTAL: {stats.total_vector_count}")


if __name__ == "__main__":
    main()
