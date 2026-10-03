/*
 * GENERATED FILE. DO NOT EDIT.
 * Source: tests/fixtures/267/wire-snapshot-zod4.json (local.tools, 47 tools).
 * Regenerate: node ui/shared/scripts/gen-mcp-adapter.mjs
 * Verify:     node ui/shared/scripts/gen-mcp-adapter.mjs --check
 *
 * The internal 1:1 adapter over the MindrianOS MCP tools. Call wrappers and
 * argument types only: no validation and no schema of its own, because the
 * server's schemas are the single source. Exposed to neither humans nor agents.
 */

export type CallTool = (tool: string, args: Record<string, unknown>) => Promise<unknown>;

export const MCP_TOOL_NAMES = [
  "analysis",
  "artifact_file",
  "chain_resolve",
  "chain_run",
  "claim_read",
  "claim_verify",
  "claim_write",
  "context_assemble",
  "contract_version",
  "contradiction_check",
  "detect_dual_path",
  "eureka_critic",
  "export",
  "extract_shallow",
  "framework_run",
  "gate_answer",
  "gate_render",
  "graph_query",
  "graph_reason",
  "graph_write",
  "identity_write",
  "intelligence",
  "meeting",
  "memory_event",
  "methodology",
  "orchestration",
  "question_read",
  "question_set",
  "reach_candidates",
  "research_run",
  "room-dashboard",
  "room-graph",
  "room-wiki",
  "room_artifact",
  "room_bind",
  "room_changes",
  "room_content",
  "room_graph",
  "room_list",
  "room_search",
  "room_state",
  "room_state_bound",
  "status_read",
  "stop_gate_check",
  "suggest_next",
  "view_compile",
  "whitespace_scan",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export type AnalysisArgs = {
  "command": "analyze-systems" | "analyze-timing" | "find-bottlenecks" | "root-cause" | "systems-thinking" | "macro-trends" | "explore-trends" | "explore-futures" | "dominant-designs" | "scenario-plan" | "causal-extract" | "causal-trace" | "causal-predict";
  "context"?: string;
  "section"?: string;
};

export function analysis(call: CallTool, args: AnalysisArgs): Promise<unknown> {
  return call("analysis", args as Record<string, unknown>);
}

export type ArtifactFileArgs = {
  "content": string;
  "epistemic_type"?: "observation" | "extracted_fact" | "derived_fact" | "model_derived_assertion" | "interpretation" | "hypothesis" | "assumption" | "conclusion" | "recommendation" | "decision";
  "evidence_node_ids"?: string[];
  "filename": string;
  "section": string;
};

export function artifactFile(call: CallTool, args: ArtifactFileArgs): Promise<unknown> {
  return call("artifact_file", args as Record<string, unknown>);
}

export type ChainResolveArgs = {
  "chain": string[];
};

export function chainResolve(call: CallTool, args: ChainResolveArgs): Promise<unknown> {
  return call("chain_resolve", args as Record<string, unknown>);
}

export type ChainRunArgs = {
  "chain"?: string[];
  "evidence_node_ids"?: string[];
  "gate_answer"?: unknown;
  "subject_node_id"?: string;
};

export function chainRun(call: CallTool, args: ChainRunArgs): Promise<unknown> {
  return call("chain_run", args as Record<string, unknown>);
}

export type ClaimReadArgs = {
  "claim_id"?: string;
  "limit"?: number;
  "query"?: string;
};

export function claimRead(call: CallTool, args: ClaimReadArgs): Promise<unknown> {
  return call("claim_read", args as Record<string, unknown>);
}

export type ClaimVerifyArgs = {
  "against_id": string;
  "against_kind": "artifact" | "source" | "observation" | "person" | "experiment";
  "checked_at"?: string;
  "checked_by"?: "user" | "system";
  "claim_id": string;
  "method": "read" | "compare" | "observe" | "test" | "ask";
  "note_handle"?: string;
  "resolves_dispute"?: boolean;
  "result": "supports" | "contradicts" | "inconclusive";
  "rung": number;
};

export function claimVerify(call: CallTool, args: ClaimVerifyArgs): Promise<unknown> {
  return call("claim_verify", args as Record<string, unknown>);
}

export type ClaimWriteArgs = {
  "conditions"?: string;
  "counter_conditions"?: string;
  "disambiguation"?: string;
  "knowledge_type": "fact" | "causal" | "heuristic" | "anomaly_cue" | "mental_model" | "assumption";
  "source_segment"?: string;
  "source_speaker"?: string;
  "text": string;
  "valid_from"?: string;
  "valid_until"?: string;
};

export function claimWrite(call: CallTool, args: ClaimWriteArgs): Promise<unknown> {
  return call("claim_write", args as Record<string, unknown>);
}

export type ContextAssembleArgs = {
  "estimate_only"?: boolean;
  "focus_node_id"?: string;
  "fragment_char_cap"?: number;
  "fragment_window"?: number;
  "max_depth"?: number;
  "top_k"?: number;
};

export function contextAssemble(call: CallTool, args: ContextAssembleArgs): Promise<unknown> {
  return call("context_assemble", args as Record<string, unknown>);
}

export type ContractVersionArgs = Record<string, never>;

export function contractVersion(call: CallTool, args: ContractVersionArgs): Promise<unknown> {
  return call("contract_version", args as Record<string, unknown>);
}

export type ContradictionCheckArgs = {
  "include_superseded"?: boolean;
  "node_id"?: string;
};

export function contradictionCheck(call: CallTool, args: ContradictionCheckArgs): Promise<unknown> {
  return call("contradiction_check", args as Record<string, unknown>);
}

export type DetectDualPathArgs = {
  "text": string;
};

export function detectDualPath(call: CallTool, args: DetectDualPathArgs): Promise<unknown> {
  return call("detect_dual_path", args as Record<string, unknown>);
}

export type EurekaCriticArgs = {
  "differential_score": number;
  "lsa_similarity": number;
  "rubric_pattern": string;
  "schema_version": number;
  "semantic_similarity": number;
  "source_domain_tag": "engineering" | "biology" | "medicine" | "computing" | "materials" | "energy" | "mathematics" | "finance" | "social" | "food" | "unknown";
  "surprise_type": "structural_transfer" | "semantic_implementation";
  "target_domain_tag": "engineering" | "biology" | "medicine" | "computing" | "materials" | "energy" | "mathematics" | "finance" | "social" | "food" | "unknown";
};

export function eurekaCritic(call: CallTool, args: EurekaCriticArgs): Promise<unknown> {
  return call("eureka_critic", args as Record<string, unknown>);
}

export type ExportArgs = {
  "command": "export" | "radar" | "dashboard" | "wiki" | "present" | "publish" | "snapshot";
  "context"?: string;
  "format"?: string;
};

export function exportTool(call: CallTool, args: ExportArgs): Promise<unknown> {
  return call("export", args as Record<string, unknown>);
}

export type ExtractShallowArgs = {
  "sessionId": string;
  "text": string;
};

export function extractShallow(call: CallTool, args: ExtractShallowArgs): Promise<unknown> {
  return call("extract_shallow", args as Record<string, unknown>);
}

export type FrameworkRunArgs = {
  "chain": string[];
  "evidence_node_ids"?: string[];
  "subject_node_id"?: string;
};

export function frameworkRun(call: CallTool, args: FrameworkRunArgs): Promise<unknown> {
  return call("framework_run", args as Record<string, unknown>);
}

export type GateAnswerArgs = {
  "chosen": string[];
  "gate_id": string;
  "verdict": "approve" | "reject" | "defer";
};

export function gateAnswer(call: CallTool, args: GateAnswerArgs): Promise<unknown> {
  return call("gate_answer", args as Record<string, unknown>);
}

export type GateRenderArgs = {
  "ambiguous"?: boolean;
  "evidence_node_ids"?: string[];
  "gate_id"?: string;
  "header"?: string;
  "kind"?: string;
  "options": unknown[];
  "select_mode"?: "single" | "multi";
  "subject_node_id"?: string;
};

export function gateRender(call: CallTool, args: GateRenderArgs): Promise<unknown> {
  return call("gate_render", args as Record<string, unknown>);
}

export type GraphQueryArgs = {
  "max_depth"?: number;
  "node_id"?: string;
  "top_k"?: number;
};

export function graphQuery(call: CallTool, args: GraphQueryArgs): Promise<unknown> {
  return call("graph_query", args as Record<string, unknown>);
}

export type GraphReasonArgs = {
  "max_depth"?: number;
  "max_results"?: number;
  "mode": "transitive_support" | "nearest_sub_room_decisions";
  "node_id"?: string;
};

export function graphReason(call: CallTool, args: GraphReasonArgs): Promise<unknown> {
  return call("graph_reason", args as Record<string, unknown>);
}

export type GraphWriteArgs = {
  "edge_type": string;
  "properties"?: unknown;
  "read_version"?: number | null;
  "source_id": string;
  "target_id": string;
};

export function graphWrite(call: CallTool, args: GraphWriteArgs): Promise<unknown> {
  return call("graph_write", args as Record<string, unknown>);
}

export type IdentityWriteArgs = {
  "brain_persona"?: string;
  "canonical_role"?: string;
  "journey_stage"?: string;
  "larry_persona"?: string;
  "problem_type"?: string;
  "role_blend"?: unknown;
  "user_id"?: string;
  "venture_stage"?: string;
};

export function identityWrite(call: CallTool, args: IdentityWriteArgs): Promise<unknown> {
  return call("identity_write", args as Record<string, unknown>);
}

export type IntelligenceArgs = {
  "command": "find-connections" | "build-thesis" | "compare-ventures" | "research" | "deep-grade" | "grade" | "leadership" | "whitespace" | "eureka-run" | "eureka-status" | "eureka-report";
  "context"?: string;
};

export function intelligence(call: CallTool, args: IntelligenceArgs): Promise<unknown> {
  return call("intelligence", args as Record<string, unknown>);
}

export type MeetingArgs = {
  "claim_text"?: string;
  "command": "file-meeting" | "pipeline" | "speakers";
  "context"?: string;
  "knowledge_type"?: "fact" | "causal" | "heuristic" | "anomaly_cue" | "mental_model" | "assumption";
};

export function meeting(call: CallTool, args: MeetingArgs): Promise<unknown> {
  return call("meeting", args as Record<string, unknown>);
}

export type MemoryEventArgs = {
  "dedupe_key"?: string;
  "label": string;
  "payload"?: unknown;
};

export function memoryEvent(call: CallTool, args: MemoryEventArgs): Promise<unknown> {
  return call("memory_event", args as Record<string, unknown>);
}

export type MethodologyArgs = {
  "command": "lean-canvas" | "think-hats" | "structure-argument" | "beautiful-question" | "build-knowledge" | "challenge-assumptions" | "validate" | "map-unknowns" | "diagnose" | "score-innovation" | "explore-domains" | "analyze-needs" | "user-needs" | "find-analogies";
  "context"?: string;
  "section"?: string;
};

export function methodology(call: CallTool, args: MethodologyArgs): Promise<unknown> {
  return call("methodology", args as Record<string, unknown>);
}

export type OrchestrationArgs = {
  "command": "act" | "act-chain" | "act-swarm" | "act-dry-run" | "rooms-list" | "rooms-new" | "rooms-open" | "rooms-close" | "rooms-archive" | "rooms-where" | "scout" | "scout-health" | "scout-deadlines" | "scout-competitors" | "scout-hsi" | "scout-snapshot" | "reanalyze" | "onboard" | "models" | "admin" | "hat-briefing" | "scheduled-tasks";
  "confirmArchived"?: boolean;
  "context"?: string;
  "room"?: string;
};

export function orchestration(call: CallTool, args: OrchestrationArgs): Promise<unknown> {
  return call("orchestration", args as Record<string, unknown>);
}

export type QuestionReadArgs = {
  "history"?: boolean;
};

export function questionRead(call: CallTool, args: QuestionReadArgs): Promise<unknown> {
  return call("question_read", args as Record<string, unknown>);
}

export type QuestionSetArgs = {
  "account"?: string;
  "based_on_version"?: number;
  "cancel"?: boolean;
  "origin"?: "chosen" | "tasking" | "prompt" | "inherited";
  "relocate"?: boolean;
  "text"?: string;
};

export function questionSet(call: CallTool, args: QuestionSetArgs): Promise<unknown> {
  return call("question_set", args as Record<string, unknown>);
}

export type ReachCandidatesArgs = {
  "section"?: string;
  "user_text"?: string;
};

export function reachCandidates(call: CallTool, args: ReachCandidatesArgs): Promise<unknown> {
  return call("reach_candidates", args as Record<string, unknown>);
}

export type ResearchRunArgs = {
  "gate_id"?: string;
  "grant_id"?: string;
  "limit"?: number;
  "max_candidates"?: number;
  "mode"?: "quick" | "deep";
  "offline"?: boolean;
  "offset"?: number;
  "op": "planners" | "plan" | "grant_request" | "grant_status" | "grant_revoke" | "run_quick" | "deep_plan" | "basket" | "file" | "pending" | "perspective_recall" | "perspective_candidates" | "perspective_judge" | "eureka_recall" | "eureka_judge" | "eureka_candidates";
  "perspective"?: "eureka" | "rs" | "hsi" | "whitespace" | "analogies" | "connections";
  "question_set"?: unknown;
  "room"?: string;
  "run_id"?: string;
  "run_tag"?: string;
  "terms"?: (string | unknown)[];
};

export function researchRun(call: CallTool, args: ResearchRunArgs): Promise<unknown> {
  return call("research_run", args as Record<string, unknown>);
}

export type RoomDashboardArgs = Record<string, never>;

export function roomDashboard(call: CallTool, args: RoomDashboardArgs): Promise<unknown> {
  return call("room-dashboard", args as Record<string, unknown>);
}

export type RoomGraphHyphenatedArgs = Record<string, never>;

export function roomGraphHyphenated(call: CallTool, args: RoomGraphHyphenatedArgs): Promise<unknown> {
  return call("room-graph", args as Record<string, unknown>);
}

export type RoomWikiArgs = Record<string, never>;

export function roomWiki(call: CallTool, args: RoomWikiArgs): Promise<unknown> {
  return call("room-wiki", args as Record<string, unknown>);
}

export type RoomArtifactArgs = {
  "max_bytes"?: number;
  "path": string;
};

export function roomArtifact(call: CallTool, args: RoomArtifactArgs): Promise<unknown> {
  return call("room_artifact", args as Record<string, unknown>);
}

export type RoomBindArgs = {
  "room"?: string;
  "sessionId"?: string;
};

export function roomBind(call: CallTool, args: RoomBindArgs): Promise<unknown> {
  return call("room_bind", args as Record<string, unknown>);
}

export type RoomChangesArgs = {
  "after"?: number | null;
  "collection": "nodes" | "relations" | "artifacts" | "decisions" | "activity";
  "epoch"?: string | null;
  "limit"?: number;
  "mode"?: "delta" | "snapshot";
  "snapshot_cursor"?: string;
};

export function roomChanges(call: CallTool, args: RoomChangesArgs): Promise<unknown> {
  return call("room_changes", args as Record<string, unknown>);
}

export type RoomContentArgs = {
  "command": "new-project" | "setup" | "update" | "help" | "detect-integrations" | "scan-opportunities" | "list-opportunities" | "file-opportunity" | "list-funding" | "create-funding" | "update-funding-stage" | "generate-personas" | "list-personas" | "invoke-persona" | "analyze-perspectives";
  "context"?: string;
  "section"?: string;
};

export function roomContent(call: CallTool, args: RoomContentArgs): Promise<unknown> {
  return call("room_content", args as Record<string, unknown>);
}

export type RoomGraphArgs = {
  "command": "graph-index" | "graph-rebuild" | "graph-query" | "graph-stats" | "reasoning-get" | "reasoning-generate" | "reasoning-verify" | "reasoning-run" | "reasoning-list" | "reasoning-frontmatter" | "visualize-room" | "visualize-graph" | "visualize-chain";
  "query"?: string;
  "section"?: string;
};

export function roomGraph(call: CallTool, args: RoomGraphArgs): Promise<unknown> {
  return call("room_graph", args as Record<string, unknown>);
}

export type RoomListArgs = Record<string, never>;

export function roomList(call: CallTool, args: RoomListArgs): Promise<unknown> {
  return call("room_list", args as Record<string, unknown>);
}

export type RoomSearchArgs = {
  "query": string;
  "section"?: string;
};

export function roomSearch(call: CallTool, args: RoomSearchArgs): Promise<unknown> {
  return call("room_search", args as Record<string, unknown>);
}

export type RoomStateArgs = {
  "command": "status" | "analyze" | "compute-state" | "get-state" | "suggest-next";
  "section"?: string;
};

export function roomState(call: CallTool, args: RoomStateArgs): Promise<unknown> {
  return call("room_state", args as Record<string, unknown>);
}

export type RoomStateBoundArgs = Record<string, never>;

export function roomStateBound(call: CallTool, args: RoomStateBoundArgs): Promise<unknown> {
  return call("room_state_bound", args as Record<string, unknown>);
}

export type StatusReadArgs = {
  "cap_usd"?: number;
  "context_window"?: unknown;
  "spend_usd"?: number;
};

export function statusRead(call: CallTool, args: StatusReadArgs): Promise<unknown> {
  return call("status_read", args as Record<string, unknown>);
}

export type StopGateCheckArgs = {
  "output_text"?: string;
  "preceding_user_text"?: string;
  "ran_entries"?: string[];
  "session_id"?: string;
  "transcript_path"?: string;
};

export function stopGateCheck(call: CallTool, args: StopGateCheckArgs): Promise<unknown> {
  return call("stop_gate_check", args as Record<string, unknown>);
}

export type SuggestNextArgs = {
  "section"?: string;
  "user_text"?: string;
};

export function suggestNext(call: CallTool, args: SuggestNextArgs): Promise<unknown> {
  return call("suggest_next", args as Record<string, unknown>);
}

export type ViewCompileArgs = {
  "page_id"?: string;
  "view": "wiki" | "dashboard" | "deck" | "insights" | "diagrams" | "graph";
};

export function viewCompile(call: CallTool, args: ViewCompileArgs): Promise<unknown> {
  return call("view_compile", args as Record<string, unknown>);
}

export type WhitespaceScanArgs = Record<string, never>;

export function whitespaceScan(call: CallTool, args: WhitespaceScanArgs): Promise<unknown> {
  return call("whitespace_scan", args as Record<string, unknown>);
}
