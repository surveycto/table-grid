# Web-forms test report — table-grid v2.3.1

**Date:** 30 Oct 2026 · **Server:** mitoworks21 · **Form:** `aha_revenue_by_payer_mirror` (versions 2610301200, 2610301300 and 2610301500) · **Browser:** Chrome (desktop), signed in · **Build:** `table-grid.fieldplugin.zip` 2.3.1 (manifest 2.3.1)

## What changed in 2.3.1

In web forms the plug-in no longer takes the cursor on its own when it loads. The host calls `setFocus()` when the field should have focus (as for SurveyCTO's own fields), and that path still works. Android/iOS Collect keep the self-focus. Driver: EST-358 comment 251547 — with two grids on one page, a page redraw reloaded both plug-ins and each grabbed focus, yanking the caret out of the cell being typed in.

Headless, before the server pass: `extras/tests/focus_on_load.py` 4/4 (the two web-forms cases failed on 2.3.0), `subtotals-acceptance.py` 162/162, `section_e_beds.py` 28/28. The web-Collect harness `?two=1` page reproduces the recording with 2.3.0 (focus lands in grid 2 cell 0,0 after a redraw) and not with 2.3.1.

## Server pass

Each page holds Q13 (4x1, `total='column'`) and Q14 (3x2), mirroring AHA's Budgets page. Values typed by clicking each cell: Q13 34/44/0/0, Q14 6,5 / 32,4. A marker set on each plug-in window before typing tells whether the iframe reloaded (marker gone = reloaded).

| # | Page | Same-page dependency on the grids | Plug-ins reloaded while typing? | Cursor after each keystroke | Result |
| --- | --- | --- | --- | --- | --- |
| A | `budgets_plain` | none | no | stays in the cell typed in (Q14 r1c1 at the end) | PASS |
| B | `budgets_dep` | note shown by relevance on Q14; note label echoing a Q14 cell via a calculate | no | stays put | PASS — both notes updated live (note appeared, echo read "5%") without any plug-in reload |
| C | `budgets_label` | Q14's own label quotes `${q13c}` | no | stays put | PASS — the label did **not** refresh while on the page (kept "…") |
| D | `budgets_param` | Q14's `row_labels` built from a calculate on `${q13d}` | no | stays put | PASS — the parameter did **not** refresh while on the page; it showed the new value only after leaving and re-entering the page |
| E | `budgets_group` | nested group (three selects) shown by relevance on Q14 | n/a | n/a | INVALID probe: web forms rejects the page with "Only questions are allowed in 'field-list'" and falls back to the previous page, re-rendering it. Page flattened in the form afterwards (selects carry the relevance directly); not re-deployed. |
| F | `budgets_calcs` | ten per-cell calculates on the page reading both grids with `item-at()` (AHA's Section E pattern) | no | stays put (Q13 r3c0 after Q13, Q14 r1c1 after Q14) | PASS — run on form version 2610301500 after a redeploy |

Also seen: on page load no cell is focused in web forms (expected with 2.3.1); typed values and the Q13 total (78) were intact throughout; no scroll jumps (`scrollY` stayed 0).

## What this says about the recording

The plug-in-side fix holds on the server: whatever reloads the page, a reload no longer moves the cursor. But none of the same-page constructs tried here (relevance on a note, a dynamic label, a dynamic parameter, per-cell calculates in AHA's own style) made web forms reload a plug-in, so the trigger in AHA's "Hospital Construction Survey" is still unidentified. Web forms treats plug-in labels and parameters as fixed for the life of the page, which matches the earlier advice that the grid reads its settings when it loads. Next step is the real form (form ID requested in the draft reply). Candidates not yet tried: relevance on the plug-in fields themselves, a repeat on the page, or a `table-list` style group.

## Known, out of scope

- With `total='column'`, an empty grid shows "0" in the total row (seen on every page here). Noted earlier for the N/A-column case; cosmetic.
- Starting a form session after a redeploy resumes the saved session on the old definition; use Options › Start over.
