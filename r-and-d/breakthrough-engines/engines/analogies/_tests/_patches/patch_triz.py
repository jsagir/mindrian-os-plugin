import json,re
p='references/methodology/triz-matrix.json'
s=open(p,encoding='utf-8').read()
d=json.loads(s)
m={k:v for k,v in d.items() if k!='_meta'}
cols=set(c for v in m.values() for c in v)
cells=sum(len(v) for v in m.values())
meta_old=s[s.index('"_meta"'):s.index('},',s.index('"_meta"'))+1]
new_meta='''"_meta": {
    "description": "TRIZ Contradiction Matrix - 39 Engineering Parameters x 40 Inventive Principles",
    "source": "Altshuller, G. (1999). The Innovation Algorithm. Worcester, MA: Technical Innovation Center.",
    "usage": "matrix[improving_param][worsening_param] = [principle_numbers]",
    "parameters": 39,
    "principles": 40,
    "schema_version": "2026.1",
    "status": "PARTIAL. Treat a missing cell as NO DATA, never as 'no principle applies'. No cell values were added, removed or edited in the 2026 pass; only this _meta block changed.",
    "parameter_rows_present": %d,
    "distinct_worsening_columns_present": %d,
    "cells_present": %d,
    "cells_possible_excluding_diagonal": %d,
    "coverage_fraction": %.3f,
    "consumer_note": "Iterate every top-level key except _meta as an improving-parameter row. Cell values are lists of distinct integers in 1..40 (checked in 2026).",
    "known_issues": [
      "Row count is 40 but 'parameters' declares 39: 'Manufacturability' and 'Ease of manufacture' both appear. The standard matrix has ONE parameter 32 (named 'Ease of manufacture' or 'Manufacturability' depending on edition). 'Manufacturability' has 13 row cells and is used as a column once; treat it as a duplicate alias of 'Ease of manufacture' until the cells are checked against the source.",
      "Only %d of 39 parameters are ever used as a worsening column; the matrix is not complete. Cell contents were not verified against Altshuller (1999) in the 2026 pass (no source text available offline).",
      "Parameter names differ from the commonly published list; see parameter_aliases."
    ],
    "parameter_aliases": {
      "Use of energy by moving object": "19 Use of energy by moving object",
      "Use of energy by stationary object": "20 Use of energy by stationary object",
      "Accuracy of measurement": "28 Measurement accuracy",
      "Harmful factors acting on object": "30 Object-affected harmful factors",
      "Harmful side effects": "31 Object-generated harmful factors",
      "Ease of manufacture": "32 Ease of manufacture (a.k.a. Manufacturability)",
      "Manufacturability": "32 (duplicate alias of Ease of manufacture)",
      "Ease of use": "33 Ease of operation (a.k.a. Convenience of use)",
      "Ease of repair": "34 Ease of repair (a.k.a. Repairability)",
      "Degree of automation": "38 Extent of automation"
    }
  }''' % (len(m),len(cols),cells,39*38,cells/(39*38),len(cols))
s2=s.replace(meta_old,new_meta)
assert s2!=s
json.loads(s2)
open(p,'w',encoding='utf-8').write(s2)
d2=json.loads(s2)
assert {k:v for k,v in d2.items() if k!='_meta'}==m
print('ok',len(m),len(cols),cells)
