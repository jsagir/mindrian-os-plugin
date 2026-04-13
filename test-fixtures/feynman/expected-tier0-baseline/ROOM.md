---
type: room-identity
role: test-fixture-baselines
layer: ICM-L0
created: 2026-04-14
---

# Tier-0 Frozen Baselines

This directory holds byte-frozen tier-0 outputs for the three Feynman-MINTO
fixture sections (fixture-small, fixture-medium, fixture-large). Each
`<fixture>-tier0.md` file is the canonical pre-81 renderSectionMinto output
plus an AAAK compressed footer, captured under
`MINTO_FROZEN_DATE=2026-04-14`.

These files are the regression guards for FEYNMINTO-08. Any change that
modifies the pre-81 deterministic MINTO rendering path or the AAAK footer
rendering will produce a diff here that must be committed intentionally.

## How to regenerate

```
for fx in "fixture-small:problem-definition" "fixture-medium:market-analysis" "fixture-large:solution-design"; do
  name="${fx%:*}"; section="${fx#*:}"
  MINTO_FROZEN_DATE=2026-04-14 node scripts/vault-section-minto-generator.cjs \
    --write test-fixtures/feynman/sections/$name --section $section
  cp test-fixtures/feynman/sections/$name/$section/MINTO.md \
    test-fixtures/feynman/expected-tier0-baseline/$name-tier0.md
  rm test-fixtures/feynman/sections/$name/$section/MINTO.md
done
```

## Verified by

`scripts/vault-section-minto-generator.integration.test.cjs` runs the
frozen baseline regression test under
`MINTO_FROZEN_DATE=2026-04-14` and asserts byte equality.
