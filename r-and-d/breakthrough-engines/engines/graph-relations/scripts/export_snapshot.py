#!/usr/bin/env python3
"""Export a snapshot straight from Neo4j with the official driver (pip install neo4j). READ-ONLY.
Connection from environment: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE (optional).
Usage: export_snapshot.py OUT.json [--labels A,B] [--types X,Y]"""
import argparse, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "lib"))
from common import DEFAULT_LABELS, SEMANTIC_TYPES, assert_read_only, build_snapshot, write_json


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("--labels"); ap.add_argument("--types")
    a = ap.parse_args(argv)
    try:
        from neo4j import GraphDatabase, READ_ACCESS
    except Exception:
        print("neo4j driver not installed. Run: pip install neo4j  (or use snapshot_from_rows.py with rows from the query tool)")
        return 2
    labels = a.labels.split(",") if a.labels else DEFAULT_LABELS
    types = a.types.split(",") if a.types else SEMANTIC_TYPES
    nq = assert_read_only(open(os.path.join(HERE, "..", "cypher", "snapshot_nodes.cypher"), encoding="utf-8").read())
    eq = assert_read_only(open(os.path.join(HERE, "..", "cypher", "snapshot_edges.cypher"), encoding="utf-8").read())
    drv = GraphDatabase.driver(os.environ["NEO4J_URI"], auth=(os.environ["NEO4J_USER"], os.environ["NEO4J_PASSWORD"]))
    with drv.session(database=os.environ.get("NEO4J_DATABASE"), default_access_mode=READ_ACCESS) as s:
        nodes = [r.data() for r in s.run(nq, labels=labels)]
        edges = [r.data() for r in s.run(eq, labels=labels, types=types)]
    drv.close()
    snap = build_snapshot(nodes, edges, meta={"source": "driver", "labels": labels, "types": types})
    write_json(a.out, snap)
    print(f"snapshot: {len(snap['nodes'])} nodes, {len(snap['edges'])} edges -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
