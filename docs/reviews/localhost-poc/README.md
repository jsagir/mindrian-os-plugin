# MindrianOS localhost workspace POC

This is a separate proof of concept for the proposed workspace. It demonstrates:

- a BlockNote-style contenteditable working file with local save/reload;
- a `Local graph` tab with a relationship view;
- `Talk to the local graph`, which searches the local graph fixture and returns matching nodes and edges;
- task, evidence, decision, and activity surfaces in one workspace.

Run from the repository root in safe fixture mode:

```bash
node docs/reviews/localhost-poc/server.cjs 3196
```

To point it at a real MindrianOS room, use the room path explicitly:

```bash
node docs/reviews/localhost-poc/server.cjs 3196 --room /home/jsagi/MindrianRooms/axiom
```

Open <http://localhost:3196>. In fixture mode it uses `data/graph.json` and `data/workspace.md`. In room mode it reads the governed local graph projection through `lib/core/navigation.cjs` and writes `workspace-poc.md` inside the selected room. It makes no remote model calls. It is deliberately separate from the legacy `localhost:3131` dashboard.
