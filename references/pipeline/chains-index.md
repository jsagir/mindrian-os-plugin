# Pipeline Chains Index

*Loaded on demand by `/mos:pipeline`*

---

## Available Chains

| Chain | Display Name | Stages | Est. Time | Venture Stages | Description |
|-------|-------------|--------|-----------|----------------|-------------|
| discovery | Discovery Pipeline | 3 | 45-90min | Pre-Opportunity, Discovery | From domain territory to customer needs -- explore intersections, examine from 6 perspectives, identify jobs-to-be-done |
| thesis | Thesis Pipeline | 3 | 60-120min | Design, Investment | From structured argument to stress-tested investment thesis -- build pyramid, challenge assumptions, synthesize thesis |

---

## How Pipelines Work

Each pipeline is a sequence of methodology commands where the output of one stage feeds structured input to the next. The user runs `/mos:pipeline {name}` and Larry orchestrates the flow:

1. **Stage contracts** define what each methodology needs from the previous stage and what it produces for the next
2. **Artifacts are filed to Room sections** with pipeline provenance metadata (`pipeline`, `pipeline_stage`, `pipeline_input`)
3. **User controls progression** -- they can exit, resume, or skip stages at any time
4. **Input extraction is transparent** -- Larry always shows what was carried forward before running the next methodology

Pipelines do not modify how methodologies work. They wrap them with structured context. Every methodology remains independently invocable outside a pipeline.

---

## Adding New Chains

New chains follow the same pattern:

1. Create a directory in `pipelines/{chain-name}/`
2. Add `CHAIN.md` with chain metadata (name, stages, venture_stages, problem_types)
3. Add numbered stage contracts (`01-{methodology}.md`, `02-{methodology}.md`, etc.)
4. Each stage contract defines: Input Extraction, Stage Instructions, Output Contract
5. Add an entry to this index

Stage contracts reference existing methodology commands -- no new commands needed. The chain is the innovation, not the individual stages.
