# MindrianOS localhost workspace POC

This is a separate proof of concept for the proposed workspace. It demonstrates:

- a BlockNote-style contenteditable working file with local save/reload;
- a `Local graph` tab with a relationship view;
- `Talk to the local graph`, which searches the local graph fixture and returns matching nodes and edges;
- task, evidence, decision, and activity surfaces in one workspace.

Run from the repository root:

```bash
node docs/reviews/localhost-poc/server.cjs 3196
```

Open <http://localhost:3196>. This POC uses only `data/graph.json` and `data/workspace.md`; it makes no remote model calls. It is deliberately separate from the legacy `localhost:3131` dashboard.
