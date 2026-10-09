#!/usr/bin/env python3
"""Assemble a snapshot from the rows returned by cypher/snapshot_nodes.cypher and snapshot_edges.cypher.
Usage: snapshot_from_rows.py NODES.json EDGES.json OUT.json
(rows files are JSON lists of objects, as returned by the read query tool)"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
from common import build_snapshot, write_json


def main(a):
    if len(a) != 3:
        print(__doc__); return 2
    nodes, edges = json.load(open(a[0], encoding="utf-8")), json.load(open(a[1], encoding="utf-8"))
    snap = build_snapshot(nodes, edges, meta={"source": "rows", "nodes_file": a[0], "edges_file": a[1]})
    write_json(a[2], snap)
    dated = sum(1 for e in snap["edges"] if e.get("created_at"))
    print(f"snapshot: {len(snap['nodes'])} nodes, {len(snap['edges'])} edges, {dated} dated -> {a[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
