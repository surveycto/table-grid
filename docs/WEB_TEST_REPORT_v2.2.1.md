# Web-forms test report — table-grid v2.2.1

**Date:** 28 Sep 2026
**Server:** `mitoworks21.surveycto.com`, form `aha_revenue_by_payer_mirror` (root group), form version `2609281536`
**Driver:** Claude desktop built-in browser (Chromium), logged in as the enumerator by the user
**Form:** `extras/sample-form/AHA revenue by payer mirror.xlsx` — AHA's Revenue by Payer grid rebuilt from the EST-358 screenshots (28 Sep 2026)
**Result:** all checks pass. Android and iOS not yet run.

## Checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Plug-in attached and current build served | PASS | Grid renders; iframe body is `display: flow-root`; 4 N/A inputs present |
| 2 | Bottom not cut off (the reported bug), 800×600 | PASS | iframe 552px, table bottom 548px + 4px margin → 0px hidden; 4c TOTAL chips and bottom border visible |
| 3 | Same at 1280×900 | PASS | iframe 684px, table bottom 680px → 0px hidden |
| 4 | Same at 375px phone width | PASS | iframe 596px, table bottom 592px → 0px hidden |
| 5 | Comparison grid (no `na_cells`) bottom | PASS | iframe 552px, table bottom 548px → 0px hidden |
| 6 | iframe height stable | PASS | 552px, then 552px 5 s later |
| 7 | N/A cell rejects input | PASS | Clicked Medicaid c Gross, typed 999 — stayed blank |
| 8 | Tab skips N/A cells | PASS | Tab from d/Net landed on e/Net |
| 9 | N/A cells excluded from sums | PASS | Typed Gross 100, 50 and Net 57, 3 → g. Total Medicaid 150 / 60, 4c TOTAL 150 / 60 |
| 10 | Formatted labels | PASS | 10 `<b>` runs rendered in row labels, `<br>` line breaks, `label_weight='normal'` |
| 11 | Comparison grid behaves as AHA's does today | PASS | No N/A cells; "Field Not Required" chips; cells editable |
| 12 | Form engine reads the answer | PASS | Echo note: "Gross 150, Net 60"; N/A cell shown as `[...]` (web forms' empty-value display) |
| 13 | Console | PASS | No errors |

ArrowLeft from a Net cell with only an N/A cell to its left leaves focus in place (the caret moves within the cell), as designed.

## Server round trip

Submission `uuid:57591bfc-c5d9-4593-ac1f-05cf56e02a7b`, 28 Sep 2026 17:55, read from the console's wide export:

```
revenue_by_payer = ,|,|,|100,|50,|,57|,3|,|,|150,60|,|,|,|,|,|,|150,60
total_gross = 150    total_net = 60    gme_gross = (blank)    revenue_by_payer_before = (blank)
```

17 rows × 2 cells; Gross in rows 6–9 (the N/A cells) blank; the 999 typed into an N/A cell absent; typed values in rows 4–7 exact; row 10 (g. Total Medicaid) and row 17 (4c TOTAL) `150,60`; all other rows blank.

## Observations (not regressions)

- At 375px the 600px-minimum table scrolls sideways inside its frame. Unchanged from earlier versions; AHA work on desktop.
- `surveycto_client.list_form_attachments()` returns `[]` for forms that do have attachments (known wrapper bug); `extras/tests/deploy_mirror.py` reads `/forms/{id}/files` directly instead.

## Undo

- Form `aha_revenue_by_payer_mirror` in the root group on `mitoworks21`.
- One test submission (key above).
