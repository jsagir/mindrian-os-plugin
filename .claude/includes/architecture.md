# Architecture Reference

## ICM x Wicked Problem Management x Simon

ICM (Van Clief & McDermott 2026) says: folder structure IS the code. Rittel & Webber (1973) says: the venture IS a wicked problem. Simon (1962) says: complex systems persist through hierarchical near-decomposability. Combined: the folder structure IS the wicked problem, organized as a near-decomposable hierarchy.

ICM Layer 0 (Identity) = The venture's current problem formulation (STATE.md)
ICM Layer 1 (Routing) = Problem type x wickedness -> which agent/skill responds
ICM Layer 2 (Contracts) = Pipeline stage contracts encode cascade rules
ICM Layer 3 (Reference) = Brain graph + methodology references + assumption registry
ICM Layer 4 (Artifacts) = Room entries = claims with validity status + cross-refs

## Simon's Architecture of Complexity -- The Basis Theorem

| Simon | MindrianOS |
|-------|-----------|
| Near-decomposable systems | Room sections = subsystems with strong internal cohesion, weak external coupling |
| Hierarchy as universal form | room/ -> sections -> artifacts -> claims |
| Watchmaker parable | Skills, commands, agents -- each built independently, snapped together via hooks |
| Perturbations absorbed within levels | Filing an artifact updates its section, not the whole room |
| Innovation at boundaries | Cross-relationship discovery (INFORMS, CONTRADICTS, CONVERGES) |
| Stable building blocks recombined | 25 methodology commands as reusable modules, pipeline chaining |

## Cross-Subsystem Cascade Rule

When an artifact is filed that contradicts or changes an assumption in another section:
1. Detect the impact (analyze-room or Brain)
2. Generate soft edits for affected sections
3. Present to user: APPROVE / REJECT (with reason) / DEFER
4. Decision + reason become graph data

## The Proactive Discovery Loop

Artifact filed -> cross-relationship scan -> new edges found -> Larry surfaces -> User decision -> Decision becomes graph data -> next scan is smarter
