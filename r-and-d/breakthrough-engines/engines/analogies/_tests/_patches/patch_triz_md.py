p='references/methodology/triz-principles.md'
s=open(p,encoding='utf-8').read()
a=s.index("## The 39 Engineering Parameters")
b=s.index("---\n\n## Reference")
new='''## The 39 Engineering Parameters

For reference, the 39 parameters of the standard TRIZ Contradiction Matrix (numbering follows the commonly published list). The right-hand column gives the name `triz-matrix.json` uses where it differs.

| # | Parameter | Name in triz-matrix.json (if different) |
|---|-----------|------------------------------------------|
| 1 | Weight of moving object | |
| 2 | Weight of stationary object | |
| 3 | Length of moving object | |
| 4 | Length of stationary object | |
| 5 | Area of moving object | |
| 6 | Area of stationary object | |
| 7 | Volume of moving object | |
| 8 | Volume of stationary object | |
| 9 | Speed | |
| 10 | Force | |
| 11 | Stress or pressure | |
| 12 | Shape | |
| 13 | Stability of object composition | |
| 14 | Strength | |
| 15 | Duration of action of moving object | |
| 16 | Duration of action of stationary object | |
| 17 | Temperature | |
| 18 | Illumination intensity | |
| 19 | Use of energy by moving object | |
| 20 | Use of energy by stationary object | |
| 21 | Power | |
| 22 | Loss of energy | |
| 23 | Loss of substance | |
| 24 | Loss of information | |
| 25 | Loss of time | |
| 26 | Quantity of substance | |
| 27 | Reliability | |
| 28 | Measurement accuracy | Accuracy of measurement |
| 29 | Manufacturing precision | |
| 30 | Object-affected harmful factors | Harmful factors acting on object |
| 31 | Object-generated harmful factors | Harmful side effects |
| 32 | Ease of manufacture (also published as Manufacturability) | Ease of manufacture, and a second row Manufacturability |
| 33 | Ease of operation (also published as Convenience of use) | Ease of use |
| 34 | Ease of repair (also published as Repairability) | Ease of repair |
| 35 | Adaptability or versatility | |
| 36 | Device complexity | |
| 37 | Difficulty of detecting and measuring | |
| 38 | Extent of automation | Degree of automation |
| 39 | Productivity | |

The 2025 version of this table listed a different order from #29 on (Productivity at #36, Manufacturability at #39, no Manufacturing precision), which did not match any standard numbering or the row names in `triz-matrix.json`. Use the names, not the numbers, when joining to the JSON.

**Coverage warning.** `triz-matrix.json` is a partial matrix (about 45 percent of the possible cells, 40 rows because parameter 32 appears twice). A missing cell means no data, not that no principle applies. When the contradiction's cell is missing, say so and propose principles from the principle descriptions above as hypotheses to test, not as matrix results.

'''
s=s[:a]+new+s[b:]
open(p,'w',encoding='utf-8').write(s)
