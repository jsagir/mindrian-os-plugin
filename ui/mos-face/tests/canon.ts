// The canon face states, copied by value from the mos-brand book (read only), for the tests.
//
// Source: mos-brand book e947a5d, segments/identity/theo/entries/2026-10-19/asset-fa8504998f.json
// (the pose of each state; renderer asset-d96217b320.js on a 400 unit master).
// State names: segments/identity/theo/states/entries/2026-10-19/content.html (table of 11 states,
// "Use exact state names"). assetLabel is the visible label that the asset file holds.
// SHA256 of the asset file bytes: e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2
// tests/test-380-decisions.cjs checks this table against `git show e947a5d:<path>` when the book
// checkout is present, so a hand edit of this table cannot pass. Only data: no logic.
// Hyphens only.

export const CANON_ASSET = 'segments/identity/theo/entries/2026-10-19/asset-fa8504998f.json'
export const CANON_ASSET_SHA256 = 'e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2'

export type CanonPose = {
  e1: [number, number, number, number]
  e2: [number, number, number, number]
  s: [number, number, number, number, number]
  r: [number, number]
  plane: string
  c1: string
  c2: string
  hollow: boolean
}
export type CanonState = { id: string; name: string; assetLabel: string; pose: CanonPose }

// CANON_STATES_JSON_BEGIN
const CANON_STATES_JSON = '[{"id":"rest","name":"Rest","assetLabel":"Rest","pose":{"e1":[312,120,52,52],"e2":[312,300,52,52],"s":[110,205,18,250,36],"r":[236,225],"plane":"#FFFFFF","c1":"#111111","c2":"#111111","hollow":false}},{"id":"listen","name":"Listening","assetLabel":"Listening","pose":{"e1":[300,120,68,68],"e2":[300,300,68,68],"s":[110,205,10,250,36],"r":[236,225],"plane":"#FFFFFF","c1":"#111111","c2":"#111111","hollow":false}},{"id":"search","name":"Search","assetLabel":"Searching","pose":{"e1":[262,100,44,44],"e2":[340,320,44,44],"s":[300,205,30,250,36],"r":[214,225],"plane":"#1F3FBF","c1":"#F7F5EE","c2":"#111111","hollow":false}},{"id":"found","name":"Found","assetLabel":"Found","pose":{"e1":[312,120,52,52],"e2":[312,300,52,52],"s":[110,205,0,250,36],"r":[236,225],"plane":"#1F3FBF","c1":"#F7F5EE","c2":"#111111","hollow":false}},{"id":"challenge","name":"Challenge","assetLabel":"Challenge","pose":{"e1":[312,120,52,52],"e2":[312,312,52,14],"s":[110,205,-32,262,36],"r":[236,190],"plane":"#D6281F","c1":"#111111","c2":"#111111","hollow":false}},{"id":"contradiction","name":"Contradiction","assetLabel":"Contradiction","pose":{"e1":[284,120,52,52],"e2":[346,300,52,52],"s":[110,205,0,250,36],"r":[236,225],"plane":"#F2C200","c1":"#111111","c2":"#111111","hollow":false}},{"id":"reframe","name":"Reframe","assetLabel":"Reframe","pose":{"e1":[268,138,60,60],"e2":[340,138,60,60],"s":[110,205,-24,250,36],"r":[236,260],"plane":"#F2C200","c1":"#111111","c2":"#111111","hollow":false}},{"id":"limit","name":"Limit","assetLabel":"Nothing found","pose":{"e1":[278,120,44,44],"e2":[350,300,44,44],"s":[110,205,90,250,30],"r":[236,225],"plane":"#FFFFFF","c1":"#4B4943","c2":"#4B4943","hollow":false}},{"id":"decision","name":"Your decision","assetLabel":"Your decision","pose":{"e1":[312,120,52,52],"e2":[312,300,52,52],"s":[110,205,0,250,36],"r":[236,225],"plane":"#111111","c1":"#F7F5EE","c2":"#111111","hollow":false}},{"id":"boundary","name":"Boundary","assetLabel":"Boundary","pose":{"e1":[312,120,52,12],"e2":[312,300,52,12],"s":[110,205,0,250,36],"r":[236,190],"plane":"#D6281F","c1":"#111111","c2":"#111111","hollow":false}},{"id":"handover","name":"Handover","assetLabel":"Handover","pose":{"e1":[312,120,52,52],"e2":[312,300,52,52],"s":[96,205,18,250,36],"r":[236,225],"plane":"#FFFFFF","c1":"#FFFFFF","c2":"#FFFFFF","hollow":true}}]'
// CANON_STATES_JSON_END

export const CANON_STATES: CanonState[] = JSON.parse(CANON_STATES_JSON) as CanonState[]
