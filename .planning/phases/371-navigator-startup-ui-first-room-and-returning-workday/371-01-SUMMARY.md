---
phase: 371
plan: "01"
status: complete
requirements_completed: [STARTUI371-01, STARTUI371-06]
canon_parts: [3, 7, 8, 9, 11, 12]
---
# Plan 01 - scoped v5 startup composition

Replaced the startup surface's legacy CSS injection with scoped v5 styles,
packaged Figtree and DM Sans bytes/OFL notices and embedded font delivery. The
resource is rooms/v4 with data: asset CSP. Added the shallow structured room
picture, black decision frame, semantic room list, responsive layout, keyboard
focus/forced-colors/reduced-motion rules and no-JS explanation. Other views keep
their existing CSS. The loader now injects the shared identity into a body with
attributes as well as a bare body tag; an initial browser failure exposed that
exact-match bug, fixed before completing this plan.

Verification: tests/test-startup-flows.cjs --browser passes both real MCP lifecycle
groups and all three Apps SDK browser groups after the loader fix. Consolidated
narrow/zoom/font/CSP and other view regressions are part of Plan 03. The UI-SPEC's
font requirement is met with optional font-display to avoid a late layout shift
under a confirmation click; both families have safe readable sans-serif fallback.
No network font request, root dependency, new invocable surface or release.

Plan 02 still supplies safe recovery, timezone markup and complete focus behavior.
The final phase verifier determines requirement closure; this summary does not
certify live ChatGPT host policy or panel persistence.
