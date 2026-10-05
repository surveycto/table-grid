# Web-forms test report — table-grid v2.3.0

**Date:** 5 Oct 2026
**Server:** `mitoworks21.surveycto.com`, form `aha_revenue_by_payer_mirror` (root group), form version `2610051340`
**Driver:** the user's Chrome (Claude in Chrome), logged in by the user; started over from Options › Start over so the new version loaded
**Form:** `extras/sample-form/AHA revenue by payer mirror.xlsx` with a new Fixed assets question: `grid_total='3:1,-2'`, `min_value=0`, `validation_strict='true'`, `format_numbers='true'`, native `required=yes`
**Result:** all browser checks pass; server read-back below. Android and iOS not run (AHA uses web forms only).

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | New form version served | PASS | Fixed assets hint carries the v2.3.0 blocking wording added with `required=yes` |
| 2 | Payer grid regression (2.2.1 steps) | PASS | Typed Gross 100, 50 and Net 57, 3 → readout "4c TOTAL as saved: Gross 150, Net 60" |
| 3 | N/A cell still rejects input | PASS | Typed 999 into Medicaid c Gross — stayed blank; readout `[]` |
| 4 | Negative typed into Less is refused | PASS | Gross 1,250,000, Less -400,000: Less outlined red, "Value must be at least 0" on focus; Net shows 1,650,000 (subtracting a negative adds — not flipped) |
| 5 | …and blocks progression | PASS | Next → "Sorry, this response is required!", stayed on the field |
| 6 | Net = Gross − Less from positive entries | PASS | Less corrected to 1,400,000 → Net -150,000; red state and required error cleared |
| 7 | Negative Net is flagged, not hard-failed | PASS | Amber cell, "Below zero. Please check this figure."; no min_value error |
| 8 | Negative Net does not block a required field | PASS | Next moved on to the readout |
| 9 | Form engine reads the signed result | PASS | Readout "Fixed assets as saved: Gross 1250000, Less 1400000, Net -150000." |
| 10 | Console | PASS | No errors |
| 11 | Submission | PASS | "Your form has been successfully submitted." |

Checks 5 and 8 are the pair that matters: on a required field, a refused entry blocks while a negative Net passes. Without `required=yes` neither would block, so the earlier non-required run did not distinguish them.

## Server round trip

`python3 extras/tests/verify_mirror_submission.py`: **16 passed, 0 failed.**

```
Submission : uuid:e1cc2c3a-4b7b-4f50-a364-7750a6c39678  Oct 5, 2026 11:45:05 AM
Answer     : ,|,|,|100,|50,|,57|,3|,|,|150,60|,|,|,|,|,|,|150,60
Echo calcs : total_gross='150' total_net='60' gme_gross=''
Fixed assets: 1250000|1400000|-150000   echo: gross='1250000' less='1400000' net='-150000'
```

The deduction is stored as typed (positive); only Net carries the sign, and the form engine reads it as -150000.

The script then picked the "latest" submission by sorting date text, which mis-orders times across 9 AM/10 AM. Both 5 Oct submissions carry identical values, so the result holds either way; the script now compares parsed times.

## Notes

- The first redeploy did not change the served form: openpyxl drops the cached result of the settings `version` formula (`=TEXT(...NOW()...)`), so the upload carried no usable version. The sample form now has a literal version.
- Validation messages show only on the focused cell (existing tooltip behaviour since before 2.2.x); unfocused invalid cells show the red outline.
- One earlier test submission (5 Oct, before `required=yes`) also exists on the server.

## Undo

- Form `aha_revenue_by_payer_mirror` in the root group on `mitoworks21`.
- Two test submissions (5 Oct 2026).
