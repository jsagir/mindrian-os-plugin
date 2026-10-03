// Candidate B: the D-05 vertical slice, one view. Open a room, show one
// artifact read-only through BlockNote, ask whether a claim has enough
// evidence, answer the minted gate with one Confirm, and watch the evidence
// list follow the room through the ui/shared replica (pull only, RESYNC on
// hints). Every room read and write is an action over the shared pool; the
// feed routes relay room_changes and the room.changed hint. agent-native's own
// chat, agent and MCP are not used. Hyphens only; no outside host.
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";

import "../slice.css";

const DocumentReader = lazy(() => import("../components/document-reader"));

export function meta() {
  return [{ title: "Room" }];
}

type Opt = { id: string; label: string; description: string; recommended: boolean; verdict: "approve" | "reject" | "defer" };
type Gate = { gate_id: string; header: string; rationale: string; recommended_id: string; options: Opt[] };
type Doc = Record<string, unknown> & { id: string };

export default function SliceRoute() {
  const { room = "" } = useParams();
  const [search] = useSearchParams();
  const [clientReady, setClientReady] = useState(false);
  const [opened, setOpened] = useState<"idle" | "ok" | "failed">("idle");
  const [feed, setFeed] = useState<"starting" | "live" | "unavailable">("starting");
  const [nodes, setNodes] = useState<Doc[]>([]);
  const [artifacts, setArtifacts] = useState<Doc[]>([]);
  const [gate, setGate] = useState<Gate | null>(null);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState("");

  const open = useActionMutation("open-room" as never, { skipActionQueryInvalidation: true } as never);
  const propose = useActionMutation("propose-decision" as never, { skipActionQueryInvalidation: true } as never);
  const answer = useActionMutation("approve-decision" as never, { skipActionQueryInvalidation: true } as never);

  useEffect(() => setClientReady(true), []);

  // 1. Open the room: bind this browser session to it (human only).
  useEffect(() => {
    if (!clientReady || !room) return;
    (open as { mutate: (v: unknown, o: unknown) => void }).mutate({ room }, {
      onSuccess: (r: { ok?: boolean }) => setOpened(r && r.ok ? "ok" : "failed"),
      onError: () => setOpened("failed"),
    });
  }, [clientReady, room]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. The read copy: open the replica once the room is bound. Pull only.
  useEffect(() => {
    if (opened !== "ok") return;
    let cancelled = false;
    let close: (() => Promise<void>) | null = null;
    const subs: Array<{ unsubscribe: () => void }> = [];
    (async () => {
      const head = await fetch("/mos/feed/changes?collection=nodes&mode=snapshot&limit=1").then((r) => r.json());
      if (cancelled) return;
      if (!head || head.ok === false || typeof head.epoch !== "string") {
        setFeed("unavailable");
        return;
      }
      const { openReplica } = await import("mos-ui-shared/replica");
      const replica = await openReplica({
        roomKey: room,
        epoch: head.epoch,
        fetchPage: async (collection, checkpoint, batchSize) => {
          const q = new URLSearchParams({ collection, limit: String(batchSize) });
          if (checkpoint) {
            q.set("after", String(checkpoint.seq));
            q.set("epoch", checkpoint.epoch);
          }
          return fetch("/mos/feed/changes?" + q.toString()).then((r) => r.json());
        },
        hints: (listener) => {
          const es = new EventSource("/mos/feed/hint?room=" + encodeURIComponent(room));
          es.addEventListener("hint", listener);
          return () => es.close();
        },
        onReset: () => setFeed("starting"),
      });
      if (cancelled) {
        await replica.close();
        return;
      }
      close = () => replica.close();
      const db = replica.db as unknown as Record<string, { find: () => { $: { subscribe: (f: (docs: Array<{ toJSON: () => Doc }>) => void) => { unsubscribe: () => void } } } }>;
      subs.push(db.nodes.find().$.subscribe((docs) => setNodes(docs.map((d) => d.toJSON()))));
      subs.push(db.artifacts.find().$.subscribe((docs) => setArtifacts(docs.map((d) => d.toJSON()))));
      setFeed("live");
    })().catch(() => setFeed("unavailable"));
    return () => {
      cancelled = true;
      subs.forEach((s) => s.unsubscribe());
      if (close) void close();
    };
  }, [opened, room]);

  // The selection: URL first, else the first claim and the first artifact.
  const selectedNode = search.get("node") || String((nodes.find((n) => n.type === "claim") || nodes[0] || { id: "" }).id);
  const firstArtifact = artifacts[0];
  const artifactPath = search.get("path") || (firstArtifact ? String(firstArtifact.section || "") + "/" + String(firstArtifact.file || "") : "");
  const evidence = useMemo(() => nodes.filter((n) => n.id !== selectedNode), [nodes, selectedNode]);

  const artifact = useActionQuery(
    "read-artifact" as never,
    { path: artifactPath } as never,
    { enabled: opened === "ok" && artifactPath.length > 1 } as never,
  );
  const art = artifact.data as { ok?: boolean; markdown?: string; reason?: string } | undefined;

  function ask() {
    setError("");
    (propose as { mutate: (v: unknown, o: unknown) => void }).mutate(
      { room, selectedNodeId: selectedNode, question: "Does this claim have enough evidence?" },
      {
        onSuccess: (r: { ok?: boolean; gate?: Gate; refused?: string }) => {
          if (!r || !r.ok || !r.gate) {
            setError("The room did not open a decision: " + String((r && r.refused) || "no gate") + ". Nothing was written.");
            return;
          }
          setGate(r.gate);
          setChoice(r.gate.recommended_id);
        },
        onError: () => setError("Could not reach the room. Nothing was written."),
      },
    );
  }

  const chosen = gate ? gate.options.find((o) => o.id === choice) : undefined;
  function confirm() {
    if (!gate || !chosen) return;
    (answer as { mutate: (v: unknown, o: unknown) => void }).mutate(
      { gate_id: gate.gate_id, chosen: chosen.id, verdict: chosen.verdict },
      {
        onSuccess: (r: { answered?: boolean; refused?: string | null }) => {
          if (!r || !r.answered) setError("The room refused the answer: " + String((r && r.refused) || "unknown") + ". Nothing was written.");
        },
        onError: () => setError("The answer did not reach the room. Nothing was written."),
      },
    );
  }
  const result = (answer as { data?: { answered?: boolean; ratified?: boolean } }).data;
  const done = !!(result && result.answered);

  return (
    <div className="mos-slice">
      <div className="wrap">
        <p className="eyebrow">
          01 / Room <span className="mono">{room}</span>
        </p>
        <h1>
          Is the <em>evidence</em> enough?
        </h1>
        {opened === "failed" && (
          <p className="err" role="alert">
            The room could not be opened. Nothing was changed.
          </p>
        )}

        <h2>Document</h2>
        <div className="doc">
          {clientReady && art && art.ok && typeof art.markdown === "string" ? (
            <Suspense fallback={<p className="note">Loading the document...</p>}>
              <DocumentReader markdown={art.markdown} />
            </Suspense>
          ) : (
            <p className="note" style={{ padding: "12px 16px" }}>
              {artifactPath ? (art && art.ok === false ? "The document is not available: " + String(art.reason || "unknown") : "Loading the document...") : "No document selected yet."}
            </p>
          )}
        </div>

        <button type="button" className="ask" onClick={ask} disabled={opened !== "ok" || (propose as { isPending?: boolean }).isPending || !selectedNode}>
          Ask Claude: does this claim have enough evidence?
        </button>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}

        {gate && !done && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            <h2>{gate.header}</h2>
            <p className="note">{gate.rationale}</p>
            <fieldset>
              <legend>Your answer</legend>
              {gate.options.map((o) => (
                <label key={o.id} className={"opt" + (choice === o.id ? " on" : "")}>
                  <input type="radio" name="choice" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
                  <span className="label">{o.label}</span>
                  {o.recommended && <span className="rec">Recommended</span>}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="cta" disabled={(answer as { isPending?: boolean }).isPending} data-testid="confirm">
              <span className="marker" aria-hidden="true">
                <span className="tri" />
              </span>
              <span className="text">
                <strong>Confirm: {chosen ? chosen.label : ""}</strong>
                <small>{chosen && chosen.verdict === "approve" ? "Saves this decision to the room." : "Records your answer. Nothing else is saved."}</small>
              </span>
            </button>
          </form>
        )}
        {done && (
          <p className="locked" role="status">
            <span className="sq" aria-hidden="true" /> {result && result.ratified ? "Decision recorded in the room." : "Your answer is recorded."}
          </p>
        )}

        <h2>Evidence</h2>
        {feed === "unavailable" && <p className="note">The room's change feed is not available from this daemon yet, so the evidence list cannot follow the room.</p>}
        {feed === "starting" && opened === "ok" && <p className="note">Opening the read copy...</p>}
        <ul className="evidence" data-testid="evidence">
          {evidence.map((n) => (
            <li key={n.id}>
              <span className="mono">{String(n.type || "node")}</span> {String(n.title || n.id)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
