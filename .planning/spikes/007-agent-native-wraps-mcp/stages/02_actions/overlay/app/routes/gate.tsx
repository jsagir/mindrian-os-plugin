// Spike 007: the decision gate as one view (M:OS Design Canon v3, Workshop Modernism).
// One decision, the recommended option preselected, one dominant Confirm.
// Every room read and write is an agent-native action that calls the MindrianOS
// MCP server; nothing about the room is stored by this app. No em-dashes.
import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { useEffect, useMemo, useState } from "react";
import type { LinksFunction } from "react-router";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=JetBrains+Mono:wght@400;600&display=swap" },
];
export function meta() { return [{ title: "Decision gate" }]; }

const ROOM_VIEW = (typeof window !== "undefined" && (window as any).MOS_ROOM_VIEW) || "http://127.0.0.1:3871/";

type Opt = { id: string; label: string; recommended: boolean };
type Gate = { gate_id: string; title: string; question: string; body_md: string; options: Opt[]; approving: string[] };

function uiSession(): string {
  if (typeof window === "undefined") return "ssr-placeholder";
  try {
    let k = sessionStorage.getItem("mos.ui_session");
    if (!k) { k = "ui-" + crypto.randomUUID(); sessionStorage.setItem("mos.ui_session", k); }
    return k;
  } catch { return "ui-" + Math.random().toString(36).slice(2, 14); }
}

// The card body arrives as a short markdown note; render only what it uses
// (a heading, paragraphs, bullet lists) as plain text, never as HTML.
function Body({ md }: { md: string }) {
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  const flush = (k: number) => { if (list.length) { blocks.push(<ul key={"u" + k}>{list.map((l, i) => <li key={i}>{l}</li>)}</ul>); list = []; } };
  md.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("- ")) { list.push(t.slice(2)); return; }
    flush(i);
    if (!t) return;
    if (t.startsWith("## ")) blocks.push(<p key={i} className="lede">{t.slice(3)}</p>);
    else blocks.push(<p key={i}>{t}</p>);
  });
  flush(9999);
  return <div className="body">{blocks}</div>;
}

export default function GateRoute() {
  const [session, setSession] = useState("ssr-placeholder");
  useEffect(() => { setSession(uiSession()); }, []);
  const ready = session !== "ssr-placeholder";

  const roomState = useActionQuery("room-state" as any, { ui_session: session, command: "status" } as any, { enabled: ready } as any);
  const mint = useActionMutation("decision-gate" as any, { skipActionQueryInvalidation: true } as any);
  const answer = useActionMutation("decision-gate" as any, { skipActionQueryInvalidation: true } as any);
  const [gate, setGate] = useState<Gate | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!ready || gate || mint.isPending) return;
    const qs = new URLSearchParams(location.search);
    const terms = (qs.get("terms") || "").split(",").map((t) => t.trim()).filter(Boolean);
    mint.mutate({ ui_session: session, op: "mint", source: qs.get("source") || "grant", ...(terms.length ? { terms } : {}) } as any, {
      onSuccess: (r: any) => {
        if (!r?.gate) { setError("The room did not open a decision: " + String(r?.refused || "no gate")); return; }
        setGate(r.gate);
        const rec = r.gate.options.find((o: Opt) => o.recommended) || r.gate.options[0];
        setChoice(rec ? rec.id : "");
        (window as any).__gate = { gate_id: r.gate.gate_id, mcp_session: r.mcp_session, minted_at: Date.now() };
      },
      onError: (e: any) => setError("Could not reach the room: " + String(e?.message || e)),
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const result: any = answer.data;
  const done = !!(result && result.answered);
  const decisionId: string | null = result?.decision_node_id || null;
  const graph = useActionQuery("graph-query" as any, { ui_session: session, node_id: decisionId || "none", top_k: 10 } as any, { enabled: !!decisionId } as any);

  const approving = gate ? gate.approving.includes(choice) : false;
  const chosen = useMemo(() => gate?.options.find((o) => o.id === choice), [gate, choice]);

  function confirm() {
    if (!gate || !choice || answer.isPending) return;
    (window as any).__gate = Object.assign((window as any).__gate || {}, { clicked_at: Date.now() });
    answer.mutate({ ui_session: session, op: "answer", gate_id: gate.gate_id, chosen: [choice], verdict: approving ? "approve" : "reject" } as any, {
      onSuccess: (r: any) => {
        (window as any).__gate = Object.assign((window as any).__gate || {}, { answered_at: Date.now(), result: r });
        if (!r?.answered) setError("The room refused the answer: " + String(r?.refused || "unknown") + ". Nothing was written.");
      },
      onError: (e: any) => setError("The answer did not reach the room: " + String(e?.message || e) + ". Nothing was written."),
    });
  }

  const rs: any = roomState.data;
  const roomLine = rs ? (rs.ok ? (rs.summary?.current_room || rs.bridge?.room || "room") + ", " + (rs.summary?.venture_stage || "stage unknown") + ", " + (rs.summary?.total_entries || "?") + " entries" : "Room unreachable.") : "Reaching the room...";
  const neighbours = (graph.data as any)?.json;
  const nCount = Array.isArray(neighbours?.results) ? neighbours.results.length : Array.isArray(neighbours?.neighbors) ? neighbours.neighbors.length : Array.isArray(neighbours?.nodes) ? neighbours.nodes.length : null;

  return (
    <div className="mos-gate">
      <style>{CSS}</style>
      <div className="wrap">
        <p className="eyebrow">01 / {gate ? gate.title : "Decision"} <span className="sep">/</span> <span className="mono">{roomLine}</span></p>
        {!gate && !error && <h1>Opening the decision...</h1>}
        {error && <p className="err" role="alert">{error}</p>}
        {gate && !done && (
          <form onSubmit={(e) => { e.preventDefault(); confirm(); }}>
            <h1>{(() => { const m = gate.question.match(/^(Approve this )(.+?)\??$/); return m ? <>{m[1]}<em>{m[2]}</em>?</> : gate.question; })()}</h1>
            <Body md={gate.body_md} />
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
            <button type="submit" className="cta" disabled={answer.isPending} data-testid="confirm">
              <span className="marker" aria-hidden="true"><span className={answer.isPending ? "progress" : "tri"} /></span>
              <span className="text">
                <strong>{answer.isPending ? "Working..." : approving ? "Confirm: " + (chosen?.label || "") : "Confirm: " + (chosen?.label || "")}</strong>
                <small>{approving ? "Saves this decision to the room. Nothing is searched yet." : "Records your no. Nothing is saved to the grant."}</small>
              </span>
            </button>
            <p className="fine mono">gate {gate.gate_id} / one MCP session per tab</p>
          </form>
        )}
        {done && (
          <section className="done" role="status">
            <p className="locked"><span className="sq" aria-hidden="true" /> {result.ratified ? "Decision recorded in the room." : "Your answer is recorded."}</p>
            <h1>{chosen?.label}.</h1>
            <p>{result.ratified ? "The room saved it. The live room view shows the new decision without a reload." : "Nothing was saved to the room beyond the answer itself. You can ask again later."}</p>
            {decisionId && <p className="mono fine">decision {decisionId}{nCount != null ? " / linked to " + nCount + " room nodes" : ""}</p>}
            <a className="cta" href={ROOM_VIEW} target="_blank" rel="noreferrer">
              <span className="marker" aria-hidden="true"><span className="tri" /></span>
              <span className="text"><strong>Open the live room view</strong><small>A read-only copy that updates as the room changes.</small></span>
            </a>
          </section>
        )}
      </div>
    </div>
  );
}

const CSS = `
.mos-gate { min-height: 100vh; --paper:#F5F0E6; --paper-deep:#E9DFCF; --paper-light:#FCF9F2; --ink:#14202B; --ink-soft:#46535D; --rust:#A8462D; --cobalt:#2457A5; --ochre:#D49A20; --success:#2F6849; --error:#A12E2E; --ease:cubic-bezier(.22,1,.36,1);
  background: var(--paper); color: var(--ink); font-family: "DM Sans", system-ui, sans-serif; }
.mos-gate * { border-radius: 0 !important; box-sizing: border-box; }
.mos-gate .wrap { max-width: 760px; margin: 0 auto; padding: 48px 16px 80px; }
.mos-gate .mono { font-family: "JetBrains Mono", ui-monospace, monospace; }
.mos-gate .eyebrow { font-family: "JetBrains Mono", monospace; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-soft); border-bottom: 2px solid var(--ink); padding-bottom: 14px; margin: 0 0 28px; }
.mos-gate .eyebrow .mono { text-transform: none; letter-spacing: 0; }
.mos-gate .sep { margin: 0 6px; }
.mos-gate h1 { font-family: "Fraunces", Georgia, serif; font-weight: 600; font-size: clamp(32px, 5vw, 48px); line-height: 1.05; margin: 0 0 20px; }
.mos-gate h1 em { color: var(--rust); font-style: italic; }
.mos-gate .body p { margin: 0 0 10px; line-height: 1.55; color: var(--ink); }
.mos-gate .body .lede { font-size: 19px; }
.mos-gate .body ul { list-style: square; margin: 6px 0 16px; padding: 0 0 0 18px; color: var(--ink-soft); font-size: 14px; line-height: 1.6; }
.mos-gate fieldset { border: 1px solid var(--ink); margin: 24px 0; padding: 0; }
.mos-gate legend { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; padding: 0 8px; margin-left: 12px; }
.mos-gate .opt { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-top: 1px solid var(--ink); cursor: pointer; position: relative; min-height: 52px; }
.mos-gate .opt:first-of-type { border-top: 0; }
.mos-gate .opt::before { content: ""; position: absolute; inset: 0; background: var(--paper-deep); transform: scaleX(0); transform-origin: left; transition: transform 220ms var(--ease); z-index: 0; }
.mos-gate .opt.on::before, .mos-gate .opt:hover::before { transform: scaleX(1); }
.mos-gate .opt > * { position: relative; z-index: 1; }
.mos-gate .opt input { width: 18px; height: 18px; accent-color: var(--cobalt); margin: 0; }
.mos-gate .opt .label { flex: 1; font-size: 16px; }
.mos-gate .rec { font-family: "JetBrains Mono", monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--cobalt); }
.mos-gate .cta { display: flex; align-items: stretch; width: 100%; min-height: 64px; background: var(--ink); color: var(--paper-light); border: 2px solid var(--ink); text-align: left; cursor: pointer; text-decoration: none; transition: transform 200ms var(--ease); padding: 0; font: inherit; }
.mos-gate .cta:hover:not(:disabled) { transform: translateX(6px); }
.mos-gate .cta:focus-visible { outline: 2px solid var(--ochre); outline-offset: 4px; }
.mos-gate .cta:disabled { cursor: progress; }
.mos-gate .cta .marker { width: 40px; display: flex; align-items: center; justify-content: center; border-right: 1px solid var(--ink-soft); }
.mos-gate .cta .tri { width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 13px solid var(--ochre); transition: transform 200ms var(--ease); }
.mos-gate .cta:hover .tri { transform: translateX(4px); }
.mos-gate .cta .progress { width: 18px; height: 2px; background: var(--ochre); }
.mos-gate .cta .text { display: flex; flex-direction: column; justify-content: center; padding: 10px 16px; gap: 2px; }
.mos-gate .cta strong { font-size: 17px; font-weight: 700; }
.mos-gate .cta small { font-size: 13px; color: var(--paper-deep); }
.mos-gate .fine { font-size: 12px; color: var(--ink-soft); margin-top: 12px; }
.mos-gate .err { color: var(--error); border-left: 2px solid var(--error); padding-left: 12px; }
.mos-gate .locked { display: flex; align-items: center; gap: 10px; color: var(--success); font-weight: 600; margin: 0 0 12px; }
.mos-gate .locked .sq { width: 14px; height: 14px; background: var(--rust); animation: snap 420ms var(--ease) both; }
.mos-gate .done .cta { margin-top: 24px; }
@keyframes snap { from { transform: translateY(-12px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mos-gate *, .mos-gate *::before { transition: none !important; animation: none !important; } }
`;
