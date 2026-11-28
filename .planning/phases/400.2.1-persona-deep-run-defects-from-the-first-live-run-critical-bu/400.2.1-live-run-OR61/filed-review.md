Deep review: six isolated hats, own research, own reading.
Research failed for: green (below_relevance_floor).

## Brief
target: room
governing question: What must be true before mathematicians accept a result that only a computer has checked?
sub-questions:
- What check shows that the formal statement matches the theorem as mathematicians state it?
- How far must acceptance rest on trust in the proof assistant itself and its logical foundations?
- Must people be able to read and understand the proof, or is a machine check enough?
- Does an independent check, in another proof assistant or by an outside team, change acceptance?

## Dissent register
### What check shows that the formal statement matches the theorem as mathematicians state it?
black opposes: Unchecked statement fidelity kills acceptance: the kernel certifies proof of the written statement, not that it is the real theorem. Only outside review closes this.
white no_position:
red mixed: Uneasy. Nobody outside has looked, and that sits in my stomach.
yellow favours: A short formal statement can be read by outside experts; in the Lean-checked Scholze case the statement sat in one challenge file for review.
green alternative_offered: Hypothesis: a blind back-translation of the formal statement to plain words, plus a short human-readable spec checked mechanically, exposes mismatches before any journal.
### How far must acceptance rest on trust in the proof assistant itself and its logical foundations?
black mixed: Foundation trust is a real but smaller risk; kernel and checker bugs exist, yet specification errors are the likelier failure and need outside kernels to rule out.
white no_position:
red mixed: A quiet dread of leaning on a machine I can't see into.
yellow favours: Machine checking shrinks trust to a small kernel; the Kepler formal proof re-verifies in about five hours from the proof scripts.
green alternative_offered: Hypothesis: re-checking with a second small independent kernel and listing the axioms used shrinks the trusted base to something auditable.
### Must people be able to read and understand the proof, or is a machine check enough?
black opposes: A bare machine check is not enough: with 40,000 unreviewed lines, nobody can inspect definitions for a misstated claim, so readable key definitions are needed.
white no_position:
red favours: I want to feel the proof, not just be told it passed.
yellow favours: When referees could not certify computer steps, the formal proof settled that part; machine check plus a readable statement and blueprint helped.
green alternative_offered: Hypothesis: a short human-readable layer (statement plus key lemmas) may give understanding without reading all 40,000 lines; test whether referees can follow it.
### Does an independent check, in another proof assistant or by an outside team, change acceptance?
black favours: Independent checks by another assistant or outside team are the cheapest falsifier and should change acceptance; the room says none exists yet.
white no_position:
red favours: Relief at the thought of a second pair of eyes.
yellow favours: Outside checks add value: Kepler was formalised after referee doubt, and the Lean project was led by a team separate from the author.
green alternative_offered: Hypothesis: if a second team formalizes the statement blind in another assistant, a match raises confidence and a mismatch locates the weak point.

## Tensions
### What check shows that the formal statement matches the theorem as mathematicians state it?
pair: black and green
black opposes: Unchecked statement fidelity kills acceptance: the kernel certifies proof of the written statement, not that it is the real theorem. Only outside review closes this.
green alternative_offered: Hypothesis: a blind back-translation of the formal statement to plain words, plus a short human-readable spec checked mechanically, exposes mismatches before any journal.
state: settled
tension id: fc2ab8c2e93dbe3aff5099f9d343fbf10d4a9556ba12d47afa0c0ef47fa19d69
pair: black and yellow
black opposes: Unchecked statement fidelity kills acceptance: the kernel certifies proof of the written statement, not that it is the real theorem. Only outside review closes this.
yellow favours: A short formal statement can be read by outside experts; in the Lean-checked Scholze case the statement sat in one challenge file for review.
state: settled
tension id: 7257a241fb07b0fb524ae03005ca6f5d0645c28a1623a294cb4df6322524104b
### Must people be able to read and understand the proof, or is a machine check enough?
pair: black and green
black opposes: A bare machine check is not enough: with 40,000 unreviewed lines, nobody can inspect definitions for a misstated claim, so readable key definitions are needed.
green alternative_offered: Hypothesis: a short human-readable layer (statement plus key lemmas) may give understanding without reading all 40,000 lines; test whether referees can follow it.
state: settled
tension id: 8b7a3aea69f18e72ba4e0ac0e2f47cf44f7762c7e86e6f08907fbbbf65a892dd
pair: black and yellow
black opposes: A bare machine check is not enough: with 40,000 unreviewed lines, nobody can inspect definitions for a misstated claim, so readable key definitions are needed.
yellow favours: When referees could not certify computer steps, the formal proof settled that part; machine check plus a readable statement and blueprint helped.
state: settled
tension id: 4b3f102b9fac889444260568667d81843d54576f011b97b87c971451febeb82c
The tension map knows three hat pairs: yellow and black, green and black, red and white. Opposite positions of any other pair are shown in the dissent register only.

## Same position
### Must people be able to read and understand the proof, or is a machine check enough?
favours, same position, both attributed: red, yellow
### Does an independent check, in another proof assistant or by an outside team, change acceptance?
favours, same position, both attributed: red, black, yellow

## Not run
none

## Rule lines
white: white_no_evidence
Blue is checked against the owner rule, not against the debate judge rule.

## Hat lists
white missing_data: Room records no outside check that the formal statement matches the real theorem.
white missing_data: Room does not name the proof assistant used or its logical foundation.
white missing_data: Room records no independent re-check in another assistant; the 40,000-line figure has no cited source.
white missing_data: Room cites no journal or referee statement; only 'no journal has reviewed it'.
green provocation: Treat the formal statement as the weak point: have a second team state the theorem blind in another proof assistant and compare the two statements.
green provocation: Back-translate the formal statement into plain language with a separate reader who has not seen the original, then compare with the textbook statement.
green provocation: Publish a short human-readable specification mechanically checked against the full proof, so reviewers audit pages, not 40,000 lines.
green provocation: Run a prize-style adversarial audit: reward anyone who finds a dropped hypothesis or narrowed domain in the statement.
blue skipped: White took no position on any of the four sub-questions (sq-80678c02, sq-6ddbfa73, sq-2b437b23, sq-fec38016).
blue skipped: Green's research was fetched but not wired; Red ran no search by design.
blue skipped: 3 of 10 search strings were refused; the ledger does not say which hats lost them.
blue thin: white: 0 evidence items, 0 positions, though research ran with results and 9 door items were left.
blue thin: red: 0 evidence items; its 4 positions rest on no cited material.
blue thin: green: 2 evidence items and no door items; research was not wired into the reading.
blue thin: yellow: 3 evidence items against black's 6, so the two sides are unevenly supported.
blue ask_next: Why did white take no position when its research returned results?
blue ask_next: Should green's fetched material be wired in and green re-read before the hats are weighed?
blue ask_next: Which hats' search strings were the 3 refused, and did that thin any reading?
blue ask_next: What would show the four sub-questions have enough material to stop gathering and start deciding?

## Sources by hat
### white
door results dropped by the relevance floor: 21
id: EvidenceClaim:persona-white-1a6064403dc7:2569015d
title: airway-sparse-lean: Lean 4 proof project and analysis pipeline for a formally verified point-of-care ultrasound risk equation for difficult videolaryngoscopy
url: https://openalex.org/W7204574539
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-white-1a6064403dc7:119a939d
title: From Informal to Formal - Incorporating and Evaluating LLMs on Natural Language Requirements to Verifiable Formal Proofs
url: https://openalex.org/W4407697148
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-white-1a6064403dc7:74593557
title: From Informal to Formal - Incorporating and Evaluating LLMs on Natural Language Requirements to Verifiable Formal Proofs
url: https://openalex.org/W4412889879
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-white-1a6064403dc7:8c908e7b
title: From Informal to Formal -- Incorporating and Evaluating LLMs on Natural Language Requirements to Verifiable Formal Proofs
url: https://arxiv.org/pdf/2501.16207
tier: Practitioner
provider: host-web
cache_hit: false
id: EvidenceClaim:persona-white-ae536b8e5539:3ea0636a
title: Formalization of PAL$\cdot$S5 in Proof Assistant
url: http://arxiv.org/abs/2012.09388v1
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-white-ae536b8e5539:8989251e
title: Tarski's geometry modelled in Mizar computerized proof assistant
url: https://openalex.org/W2527478776
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-white-ae536b8e5539:359b16da
title: Globular: An Online Proof Assistant for Higher-Dimensional Rewriting
url: https://openalex.org/W2801249049
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-white-ae536b8e5539:ca2fa8ad
title: Formalizing the Gromov-Hausdorff space
url: https://openalex.org/W3183583890
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-white-ae536b8e5539:c137b2b0
title: MLFMF: Data Sets for Machine Learning for Mathematical Formalization
url: https://openalex.org/W4387947647
tier: Academic
provider: openalex
cache_hit: false
### black
door results dropped by the relevance floor: 19
id: EvidenceClaim:persona-black-5f7ae8b4ad5c:df4f6b77
title: Error-tolerant processors: Formal specification and verification
url: https://openalex.org/W4244031552
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-black-5f7ae8b4ad5c:1e7d22ce
title: Towards the Formal Specification and Verification of Maple Programs
url: http://arxiv.org/abs/1207.2300v1
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-black-5f7ae8b4ad5c:e1d2afda
title: Contribution to the Formal Specification and Verification of a Multi-Agent Robotic System
url: http://arxiv.org/abs/1604.05577v1
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-black-5f7ae8b4ad5c:11ad9d
title: Chapter 9: Formal verification's greatest bloopers: the danger of false positives
url: https://www.oreilly.com/library/view/formal-verification-2nd/9780323956130/XHTML/B9780323956123000094/CH0009_279-307_B9780323956123000094.xhtml
tier: Practitioner
provider: host-web
cache_hit: false
id: EvidenceClaim:persona-black-5f7ae8b4ad5c:aa3957d1
title: 01 formalmethods
url: https://uio.no/studier/emner/matnat/ifi/IN5110/h21/slides/01-formalmethods.pdf
tier: Practitioner
provider: host-web
cache_hit: false
id: EvidenceClaim:persona-black-e4c3560f223d:3ea0636a
title: Formalization of PAL$\cdot$S5 in Proof Assistant
url: http://arxiv.org/abs/2012.09388v1
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-black-e4c3560f223d:9f0d27db
title: Automatic Test-Case Reduction in Proof Assistants: A Case Study in Coq
url: http://arxiv.org/abs/2202.13823v2
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-black-e4c3560f223d:a99a7760
title: Rust's Type Checker Implementation Is Unsound: An Empirical Study on Soundness Bugs in rustc
url: http://arxiv.org/abs/2608.28713v1
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-black-e4c3560f223d:a254d2d2
title: Modular development of certified program verifiers with a proof assistant,
url: https://openalex.org/W2108703110
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-black-e4c3560f223d:4a8365c
title: Automatic Test-Case Reduction in Proof Assistants: A Case Study in Coq
url: https://arxiv.org/pdf/2202.13823
tier: Practitioner
provider: host-web
cache_hit: false
Found by the hat, not approved on a card, not wired to the room graph:
url: https://blog.trailofbits.com/2026/09/09/a-proof-of-fermats-last-theorem-that-fits-the-margin/
title: A proof of Fermat's Last Theorem that fits the margin
search string: formal proof mathematicians accept misformalized statement independent kernel checker
summary: Describes a suspicious proof whose flaw was in a string-handling function, not the kernel; calls for alternative kernels.
url: https://arxiv.org/pdf/2605.13171
title: Formal Conjectures: An Open and Evolving Benchmark for Verified Discovery in Mathematics
search string: formal proof mathematicians accept misformalized statement independent kernel checker
summary: Defines misformalization and sorts it into translation, underspecified and source-level errors.
url: https://arxiv.org/pdf/2608.21502
title: A Lean Formalization of Hamilton's Three-Manifold Theorem
search string: formal proof mathematicians accept misformalized statement independent kernel checker
summary: Describes layered assurance: kernel, axiom reports, and human review of definitions.
Search strings the hat reports it sent (not approved on a card):
- formal proof mathematicians accept misformalized statement independent kernel checker
### yellow
door results dropped by the relevance floor: 18
id: EvidenceClaim:persona-yellow-f98c6d79e995:f7d40582
title: VeriAgent: an Approach to Integrating UML and Formal Verification Tools
url: https://openalex.org/W1969913838
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-yellow-f98c6d79e995:655d0274
title: Software process ontology: harvest, formal representation and verification
url: https://openalex.org/W3005805901
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-yellow-f98c6d79e995:8dd4ead3
title: DafnyBench: A Benchmark for Formal Software Verification
url: https://openalex.org/W4399657810
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-yellow-f98c6d79e995:1be4aeb5
title: Formal verification
url: https://www.wikipedia.com/wiki/Program_proof
tier: Practitioner
provider: host-web
cache_hit: false
id: EvidenceClaim:persona-yellow-f98c6d79e995:950e7061
title: Software is infrastructure: failures, successes, costs, and the case for formal verification
url: https://arxiv.org/pdf/2506.13821
tier: Practitioner
provider: host-web
cache_hit: false
id: EvidenceClaim:persona-yellow-10467d9d7aab:f848a449
title: Application of a new computer‐assisted robotic visualization system in cochlear implantation-Proof of concept
url: https://openalex.org/W3171541196
tier: Academic
provider: openalex
cache_hit: false
id: EvidenceClaim:persona-yellow-10467d9d7aab:2e32a8eb
title: Computer-assisted proofs of "Kariya's theorem" with computer algebra
url: http://arxiv.org/abs/2304.07491v1
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-yellow-10467d9d7aab:30117a1d
title: Nonexistence of a Leech Tree of Order 18: A Computer-Assisted Proof
url: http://arxiv.org/abs/2609.20492v1
tier: Academic
provider: arxiv
cache_hit: false
id: EvidenceClaim:persona-yellow-10467d9d7aab:59ad3ccb
title: Computer-assisted proof
url: https://wikipedia.com/wiki/Computer_proof
tier: Practitioner
provider: host-web
cache_hit: false
id: EvidenceClaim:persona-yellow-10467d9d7aab:5962fa3f
title: Computer assisted proof
url: https://www.wikiwand.com/en/Computer-assisted_proof
tier: Practitioner
provider: host-web
cache_hit: false
Found by the hat, not approved on a card, not wired to the room graph:
url: https://en.wikipedia.org/wiki/Kepler_conjecture
title: Kepler conjecture
search string: formal proof Kepler conjecture Flyspeck completed referees could not certify
summary: Referees 99% certain but could not certify computer calculations; formal proof in Isabelle and HOL Light later accepted.
url: https://arxiv.org/pdf/1501.02155
title: A formal proof of the Kepler conjecture
search string: formal proof Kepler conjecture Flyspeck completed referees could not certify
summary: Formal proof; main statement verifiable in about five hours from the scripts.
url: https://leanprover-community.github.io/blog/posts/lte-final
title: Completion of the Liquid Tensor Experiment
search string: Liquid Tensor Experiment Lean formal verification result Scholze
summary: Lean verified a main theorem of Clausen and Scholze, completed July 2022, led by a separate team.
Search strings the hat reports it sent (not approved on a card):
- formal proof Kepler conjecture Flyspeck completed referees could not certify
- Liquid Tensor Experiment Lean formal verification result Scholze
### green
door results dropped by the relevance floor: 5
Found by the hat, not approved on a card, not wired to the room graph:
url: https://arxiv.org/pdf/2606.31134
title: Beyond the Library: An Agentic Framework for Autoformalizing Research Mathematics
search string: formal verification theorem statement fidelity review independent formalization proof assistant
summary: Uses a Faithfulness Judge and a blind back-translation check to compare informal and Lean statements.
url: https://arxiv.org/pdf/2604.03789
title: Automated Conjecture Resolution with Formal Verification
search string: formal verification theorem statement fidelity review independent formalization proof assistant
summary: Uses a comparator to check the proved theorem against a short human-readable specification and standard axioms.
Search strings the hat reports it sent (not approved on a card):
- formal verification theorem statement fidelity review independent formalization proof assistant
Provider host-web: the assistant ran the web search. Code cannot prove that it searched exactly the approved string.
A hat's own searches passed the reader search screen of the door before they left the machine. The screen blocks room words; it cannot catch a figure or a detail with no screened word.

## Rulings
tension id: fc2ab8c2e93dbe3aff5099f9d343fbf10d4a9556ba12d47afa0c0ef47fa19d69
ruling: both_hold
side hat: none
delegated to Larry: yes
ruled on: 2026-11-28

tension id: 7257a241fb07b0fb524ae03005ca6f5d0645c28a1623a294cb4df6322524104b
ruling: both_hold
side hat: none
ruled on: 2026-11-28

tension id: 8b7a3aea69f18e72ba4e0ac0e2f47cf44f7762c7e86e6f08907fbbbf65a892dd
ruling: side_a
side hat: black
ruled on: 2026-11-28

tension id: 4b3f102b9fac889444260568667d81843d54576f011b97b87c971451febeb82c
ruling: both_hold
side hat: none
ruled on: 2026-11-28
