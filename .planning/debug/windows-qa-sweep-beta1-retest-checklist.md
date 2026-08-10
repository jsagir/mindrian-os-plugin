# beta.1 retest checklist for the 2026-08-10 Windows QA sweep hypotheses

The sweep (windows-install-and-field-qa-sweep-2026-08-10.md) observed on beta.7/beta.x.
v2.0.0-beta.1 shipped 2026-08-10 night with the working Brain client, honest refusals,
silent registration, and the resolver collapse. RETEST these before investigating:

- F-N (session-start "1 setup issue: MCP"): beta.7 sits inside the Brain-outage era
  root-caused in 246-01-LIVE-RESULT. EXPECT GONE on beta.1. If it persists, open fresh.
- F-K (guardian trace_missing_field/glyph-low every Stop): retest on beta.1; if it
  persists, it predates tonight's rail work - own debug session.
- F-L (USER.md "Error writing file" on MindrianRooms\... path): Windows backslash-path
  suspicion; retest room birth on beta.1.
- F-M (room health 0-sections vs 3-sections): state-not-recomputed family
  (intern-w1-state-not-recomputed); retest, then fold there if it persists.
- F-D: CLOSED BY SHIPMENT - silent registration is in beta.1 (fully live after the
  Supabase env vars land on Render; until then honest no_key refusal).
- F-C: verify the marketplace-add transient against beta.1's install flow.

F-A and F-I are being fixed on main (2026-08-10 night, post-sweep) - see their tests
when they land: test-doctor-statusline-selftest-bash-invocation.cjs,
test-check-version-network-retry.cjs.
