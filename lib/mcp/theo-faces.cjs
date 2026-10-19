/* Copyright (c) 2026 Mindrian. BSL 1.1.
 * Canonical Theo Faces state geometry, vendored with the owner's permission.
 * Source: theo-face/prototype/theo-faces-canonical.html, revision 553928532c6f0ed3f153fa78b3fb0b436131c314.
 * SHA-256: 78c75c6a697213be390091d315af6e883a54f367651d79b36e18462eb46e2464.
 * POSES/LARRY/THEO are copied verbatim. Static rendering uses rf2 for the reframe.
 * No runtime dependency on another checkout, no telemetry and no inferred state.
 */
(function (root, factory) {
  'use strict';
  const faces = factory();
  if (typeof module === 'object' && module.exports) module.exports = faces;
  else root.MindrianFaces = faces;
})(globalThis, function () {
  'use strict';
  const CANONICAL_SOURCE = Object.freeze({
    path: 'theo-face/prototype/theo-faces-canonical.html',
    sha256: '78c75c6a697213be390091d315af6e883a54f367651d79b36e18462eb46e2464'
  });
  var C = { ink:'#111111', paper:'#F7F5EE', white:'#FFFFFF', blue:'#1F3FBF', red:'#D6281F', yellow:'#F2C200', soft:'#4B4943' };
var K = C.ink, W = C.white, Bl = C.blue, Rd = C.red, Y = C.yellow, P0 = C.paper;
function pose(e1, e2, s, r, plane, c1, c2, extra) { var o = { e1:e1, e2:e2, s:s, r:r, plane:plane, c1:c1, c2:c2, hollow:false }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
var POSES = {
  rest:pose([312,120,52,52],[312,300,52,52],[110,205,18,250,36],[236,225],W,K,K,{sway:1}),
  think:pose([96,120,52,52],[96,300,52,52],[300,205,0,250,36],[214,225],Bl,K,K,{bob:1}),
  challenge:pose([312,120,52,52],[312,312,52,14],[110,205,-32,262,36],[236,190],Rd,K,K,{sway:1}),
  contra:pose([284,120,52,52],[346,300,52,52],[110,205,0,250,36],[236,225],Y,K,K,{sway:1}),
  could:pose([278,120,44,44],[350,300,44,44],[110,205,90,250,30],[236,225],W,C.soft,C.soft,{still:1}),
  decision:pose([312,120,52,52],[312,300,52,52],[110,205,0,250,36],[236,225],K,P0,K,{still:1}),
  handover:pose([312,120,52,52],[312,300,52,52],[96,205,18,250,36],[236,225],W,W,W,{hollow:true,still:1}),
  rf1:pose([312,120,34,34],[312,300,34,34],[110,205,0,270,36],[236,225],Y,K,K),
  rf2:pose([268,138,60,60],[340,138,60,60],[110,205,-24,250,36],[236,260],Y,K,K),
  t_rest:null,
  t_listen:pose([300,120,68,68],[300,300,68,68],[110,205,10,250,36],[236,225],W,K,K),
  t_search:pose([262,100,44,44],[340,320,44,44],[300,205,30,250,36],[214,225],Bl,K,K,{bob:1}),
  t_found:pose([312,120,52,52],[312,300,52,52],[110,205,0,250,36],[236,225],Bl,K,K),
  t_none:pose([278,120,44,44],[350,300,44,44],[110,205,90,250,30],[236,225],W,C.soft,C.soft,{still:1}),
  t_refused:pose([312,120,52,12],[312,300,52,12],[110,205,0,250,36],[236,190],Rd,K,K,{still:1}),
  t_handover:pose([312,120,52,52],[312,300,52,52],[96,205,18,250,36],[236,225],W,W,W,{hollow:true,still:1})
};
POSES.t_rest = POSES.rest;
var LARRY = [
  { id:"rest", name:"Rest", sw:W, voice:"No voice mark", body:"The logo as a face. The bar leans toward you, the colon waits in two planes. It blinks and breathes a little.", when:"Idle, the home screen, anywhere Larry is present but not busy." },
  { id:"think", name:"Thinking", sw:Bl, voice:"Building (blue)", body:"The face turns to :/ and the eyes bob out of step. The bar rocks from / through | to \\, weighing.", when:"While a run is in progress. It returns to the logo when the answer lands." },
  { id:"reframe", name:"The reframe", sw:Y, voice:"Contradiction (yellow)", body:"The bar stands upright, then flips back. The eyes open wide side by side and the rules slide. One beat, then rest.", when:"When Larry offers the move: you are thinking of this as X, what if it is Y?" },
  { id:"challenge", name:"Challenging", sw:Rd, voice:"Challenging (red)", body:"One eye narrows. The bar leans back sharply and the rule lifts. Skeptical without a word.", when:"When Larry pushes back on an assumption that needs examination." },
  { id:"contra", name:"Contradiction", sw:Y, voice:"Contradiction (yellow)", body:"The eyes slide out of line and the bar stands straight between them. Two things that do not agree.", when:"When a new claim contradicts one already in the room." },
  { id:"could", name:"It could not", sw:W, voice:"Honest limit", body:"The bar lies flat like a shrug. The eyes drift apart and dim. Plain, not sad.", when:"When a step could not be done and the run says so in plain words." },
  { id:"decision", name:"Your decision", sw:K, voice:"A decision (black)", body:"Everything goes still. Eyes aligned, bar upright, the plane black. The calm means you commit next.", when:"At a decision card. Larry waits and does not move until you choose." },
  { id:"handover", name:"Hand over", sw:W, voice:"Handing over (white)", body:"Outlines only, and the bar steps aside. Larry gets out of the way and the piece is yours.", when:"When a filed artifact or finished piece is handed to you." }
];
var THEO = [
  { id:"t_rest", name:"Rest", sw:W, voice:"No voice mark", body:"Theo at rest. The bar leans toward you and the colon waits in two planes.", when:"Idle. Nothing is being asked." },
  { id:"t_listen", name:"Listening", sw:W, voice:"No voice mark", body:"The eyes widen and line up. The bar leans in a little.", when:"While you type or speak to Theo." },
  { id:"t_search", name:"Searching", sw:Bl, voice:"Building (blue)", body:"The eyes drift out of step and the bar rocks. Blue means Theo is building.", when:"While Theo looks something up in the teaching graph." },
  { id:"t_found", name:"Found", sw:Bl, voice:"Building (blue)", body:"The eyes line up, the bar stands upright, and the plane stays blue. A result is in hand.", when:"When a search returns something grounded." },
  { id:"t_none", name:"Nothing found", sw:W, voice:"Honest limit", body:"The bar lies flat like a shrug. The eyes drift apart and dim.", when:"When the search found nothing. Theo says so in plain words." },
  { id:"t_refused", name:"Refused", sw:Rd, voice:"Challenging (red)", body:"The plane turns red, the eyes narrow to slits and the bar stands rigid.", when:"When Theo will not do what was asked, and says why." },
  { id:"t_handover", name:"Hand over", sw:W, voice:"Handing over (white)", body:"Outlines only, and the bar steps aside. The result is yours.", when:"When the answer is handed to you." }
];

  const modes = new Map(LARRY.concat(THEO).map(mode => [mode.id, mode]));
  function rect(x, y, width, height, fill, extra = '') {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"${extra}/>`;
  }
  function renderFace(state = 'rest') {
    const mode = modes.get(state);
    if (!mode) throw new RangeError('Unknown canonical Theo face state: ' + state);
    const p = state === 'reframe' ? POSES.rf2 : POSES[state];
    const [rx, ry] = p.r;
    const [sx, sy, angle, length, thick] = p.s;
    const hollow = p.hollow ? ` stroke="${K}" stroke-width="8"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" data-state="${state}" aria-label="Theo face: ${mode.name}">` +
      rect(0, 0, 400, 400, C.paper) +
      rect(rx + 7, 14, 379 - rx, ry - 21, p.plane) +
      rect(rx - 7, 14, 14, 372, K) + rect(rx, ry - 7, 386 - rx, 14, K) +
      `<g transform="translate(${sx} ${sy}) rotate(${angle})">` +
      rect(-thick / 2, -length / 2, thick, length, p.hollow ? W : K, hollow) + '</g>' +
      rect(p.e1[0] - p.e1[2] / 2, p.e1[1] - p.e1[3] / 2, p.e1[2], p.e1[3], p.hollow ? W : p.c1, hollow) +
      rect(p.e2[0] - p.e2[2] / 2, p.e2[1] - p.e2[3] / 2, p.e2[2], p.e2[3], p.hollow ? W : p.c2, hollow) +
      rect(7, 7, 386, 386, 'none', ` stroke="${K}" stroke-width="14"`) + '</svg>';
  }
  function identityHeader() {
    return '<header id="mindrian-identity" class="mindrian-identity" aria-label="MindrianOS thinking partner">' +
      '<div id="mindrian-face" class="mindrian-face" data-state="rest">' + renderFace() + '</div>' +
      '<div class="mindrian-identity-copy"><strong>Larry | MindrianOS</strong><span>PWS thinking partner</span></div>' +
      '<p id="mindrian-status" role="status" aria-live="polite">Opening room view...</p></header>';
  }
  const IDENTITY_CSS = `
.mindrian-identity {display:flex;align-items:center;gap:12px;position:relative;z-index:100;background:#1a1a1a;color:#F7F5EE;padding:12px 16px;border-bottom:1px solid #404040;min-height:72px;font-family:var(--ds-font-body,system-ui,sans-serif)}
.mindrian-face {width:48px;height:48px;flex:0 0 48px}.mindrian-face svg{display:block;width:100%;height:100%}
.mindrian-identity-copy{display:flex;flex-direction:column;gap:1px;min-width:0}.mindrian-identity-copy strong{font-size:14px;line-height:20px;font-weight:600}.mindrian-identity-copy span{font-size:12px;line-height:18px;color:#d4cfc7}
#mindrian-status{margin-left:auto;font-size:12px;line-height:18px;color:#d4cfc7;max-width:44ch;text-align:right;overflow-wrap:anywhere}
.mindrian-identity :focus-visible{outline:2px solid #F2C200;outline-offset:3px}
@media(max-width:600px){.mindrian-identity{gap:10px;padding:10px 12px;flex-wrap:wrap}.mindrian-face{width:40px;height:40px;flex-basis:40px}#mindrian-status{flex-basis:100%;margin-left:50px;text-align:left;max-width:none}}
`;
  return { CANONICAL_SOURCE, POSES, LARRY, THEO, renderFace, identityHeader, IDENTITY_CSS };
});
