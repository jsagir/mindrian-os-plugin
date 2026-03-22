# Changelog

All notable changes to MindrianOS Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-22

### Added
- **Larry Personality** -- Full teaching voice with mode engine calibration (40:30:20:10 distribution), signature openers, and tri-surface awareness (CLI, Desktop, Cowork)
- **26 Methodology Commands** -- Complete PWS framework toolkit: beautiful-question, explore-domains, explore-trends, map-unknowns, diagnose, analyze-needs, build-knowledge, structure-argument, challenge-assumptions, root-cause, macro-trends, user-needs, validate, find-bottlenecks, analyze-timing, dominant-designs, think-hats, scenario-plan, analyze-systems, systems-thinking, lean-canvas, leadership, explore-futures, grade, build-thesis, score-innovation
- **Pipeline Chaining** -- ICM stage contracts connect methodologies in intelligent sequences: Discovery pipeline (explore-domains -> think-hats -> analyze-needs), Thesis pipeline (structure-argument -> challenge-assumptions -> build-thesis)
- **Proactive Intelligence** -- Two-layer system: bash structural detection + Claude semantic interpretation with noise gate (max 2 HIGH-confidence findings per session)
- **Data Room Dashboard** -- De Stijl-styled localhost viewer with knowledge graph visualization, room chat, and CoSE/grid layout engine
- **Document Generation** -- PDF export for thesis, report, profile, and brief types with WeasyPrint rendering and TOC bookmarks
- **Brain MCP Integration** -- Optional Neo4j Brain connection with 5 Brain-powered commands: suggest-next, find-connections, compare-ventures, deep-grade, research
- **Self-Update System** -- Version check, changelog display, modification backup/reapply flow via `/mindrian-os:update`
- **Infrastructure Commands** -- new-project, help, status, room, setup, update
- **Passive Room Filing** -- PostToolUse hook auto-classifies and files insights to room sub-rooms
- **Graceful Degradation** -- Full functionality at Tier 0 (no dependencies), enhanced with optional Neo4j and Brain
