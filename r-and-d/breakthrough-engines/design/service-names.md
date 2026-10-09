# Service names by job (draft, navigator to confirm)

Discovery only. Folder paths are unchanged, because moving them would break the test paths and the baseline copies. Each service is named for the job the user gets.

## Service 1: Scout the gaps (compute)
| Folder | Job | Name |
|---|---|---|
| hsi | Find open space nobody occupies | Find the open space |
| rs (stall detection) | Show where progress is stuck | Find where progress stalls |
| analogies | Borrow solutions from other fields | Borrow from other fields |
| rs-explain | Ask a plain question about your work | Ask about my work |
| rs-fetch | Gather evidence | Gather the evidence |
| rs-thesis | Read a prior finding | Read a finding |

Naming rule: names use everyday words the navigator would say. Internal terms (graph, node, engine, RS, HSI) never appear in a service name.

## Service 2: Test the idea (judgment)
| Folder | Job | Name |
|---|---|---|
| eureka | Spot the next breakthrough | Spot the next breakthrough |
| algorithms/jason | Critique a pitch for restatement and hype | Critique the pitch |

## Service 3: Deliberate (orchestration)
| Folder | Job | Name |
|---|---|---|
| bono | Debate a what-if before committing | Debate the what-if |
| algorithms/genesis | Map the domains and personas for a problem | Map the experts |
| rs-experts | Find the right experts | Find the right experts |

## Not a service
| Folder | Reason |
|---|---|
| algorithms/opposable-mind-hmm | Measures a person's thinking, not an idea. Needs a labelled dataset first. Separate project. |

## Rename steps that need a plugin change (GSD only)
- Command names (rs-explain, rs-fetch, rs-thesis, rs-experts) are plugin commands. Renaming them is a GSD change to the plugin, not an edit here.
- Folder moves in package-2026 wait until the test paths are updated.
