---
type: artifact
title: Architecture overview
created: 2026-04-14
---

# Architecture overview

The system is organized as a near-decomposable hierarchy where each room section is an independent subsystem with strong internal cohesion and weak external coupling. Sections communicate only through the cross-reference graph and through explicit cascade events.

This follows Simon 1962 on the architecture of complexity. The practical payoff is that a change inside one section does not force every other section to recompute. Only the sections touched by the cascade event re-run their checks.

The architecture is implemented as plain folders on disk. The folder IS the subsystem boundary.
