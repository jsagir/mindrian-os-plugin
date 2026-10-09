"""Jev claim check: does a source excerpt support a register claim? Judgment only.
Inputs: claims.json (public source excerpts only, no room content). No Theo or Brain calls.
Output: results.json with Jev's choice and probabilities. Decisions stay with the navigator.
"""
import json, os, sys, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
key = os.environ["TYPESAFE_API_KEY"].strip()
claims = json.load(open(os.path.join(HERE, "claims.json"), encoding="utf-8"))
out = []
for c in claims:
    body = {"state": f"SOURCE EXCERPT ({c['source']}):\n{c['excerpt']}\n\nCLAIM UNDER CHECK:\n{c['claim']}",
            "model": "jev-latest",
            "questions": {"claim_status": {"type": "choice",
                "instructions": "Compare the CLAIM UNDER CHECK with the SOURCE EXCERPT only. Does the source support the claim's exact number and outcome?",
                "criteria": {"supported": "The excerpt states the same number and the same outcome as the claim.",
                             "contradicted": "The excerpt states a different number or outcome from the claim.",
                             "not_stated": "The excerpt does not state the number or the outcome in the claim."}}}}
    req = urllib.request.Request("https://api.typesafe.ai/v1/systemone", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=120))
    a = r["answers"]["claim_status"]
    out.append({"id": c["id"], "claim": c["claim"], "jev_choice": a["choice"], "jev_probabilities": a["probabilities"],
                "jev_confidence": a["confidence"], "model": r.get("model"), "status": "PROPOSED: judgment, navigator decides"})
with open(os.path.join(HERE, "results.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1)
for o in out: print(o["id"], o["jev_choice"], o["jev_probabilities"])
