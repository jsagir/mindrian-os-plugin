# cascade-surface-e2e fixture

**Sibling of:** `test/fixtures/cascade-e2e/seed-room/`
**Purpose:** Class D surface verification per DOCTOR-95.1-02 + DOCTOR-95.1-08.
**Anchor REQ:** see `.planning/REQUIREMENTS.md` "Plugin Self-Healing Diagnostics (DOCTOR-95.1)".

## Pipeline vs Surface

| | cascade-e2e/seed-room/ | cascade-surface-e2e/ |
|---|---|---|
| **Tests** | Pipeline (edge counts) | Surface (envelope + side-channel + reader contract) |
| **Acceptance gate** | `expected-edges.json` exact match | `.mindrian/last-cascade.json` 8-key shape |
| **Rollback policy** | Refactor must preserve edge counts | Surface change must preserve envelope shape |
| **Owns** | Phase 87-03 | Phase 95.1 |

The two fixtures must coexist without sharing state. Do not consolidate.

## Layout

```
cascade-surface-e2e/
├── .rooms/registry.json          # active = "surface-e2e-room"
├── surface-e2e-room/             # the room (resolves under MINDRIAN_ROOMS_HOME=cascade-surface-e2e)
│   ├── .room-root                # Phase 87-01a sentinel
│   ├── STATE.md                  # cascade walk-up target
│   ├── ROOM.md / MINTO.md        # Layer 0
│   └── problem-definition/
│       ├── ROOM.md / MINTO.md
│       └── seed-artifact/seed-artifact.md   # Decision #16 nested
└── README.md (this file)
```

## Hermeticity contract

The Wave 1 test (`tests/test-cascade-surface-e2e.cjs`) MUST set
`env: { MINDRIAN_ROOMS_HOME: '<repo>/test/fixtures/cascade-surface-e2e' }` on
every `runBashHook` call. Forgetting this leaks side-effects into the user's
real active room (drift class C trap). See `95.1-RESEARCH.md` Pitfall 2.

## License

BSL 1.1 (covered by repo LICENSE).
