# Subtotals & editable totals — test evidence

**Spec:** v1, 17 Aug 2026, §9 acceptance criteria
**Branch:** `feature/subtotals` · **Plug-in version:** 2.1.0
**Runner:** [`extras/tests/subtotals-acceptance.py`](../../extras/tests/subtotals-acceptance.py)

The runner loads the real `source/template.html`, `source/style.css` and
`source/script.js` into headless Chrome with the SurveyCTO host APIs stubbed
(`setAnswer`, `getPluginParameter`, `fieldProperties`), drives the DOM the way a
respondent would, and asserts on rendered state and on what `setAnswer` received.
Chrome's virtual time budget fast-forwards the plug-in's debounce timers.

Reproduce with:

```bash
python3 extras/tests/subtotals-acceptance.py
```

## §9 checklist

| Criterion | Status | Covered by |
|---|---|---|
| Subtotals render shaded, initialise to component sums, live-update | Pass | Scenario 1 |
| Override persists through component edits; reference sum updates; indicator + warning; never blocked | Pass | Scenario 2 |
| Total = sum of subtotals; subtotal override changes total; total override wins | Pass | Scenario 3 |
| One-off rows render plain and feed the total | Pass | Scenarios 3, 4 |
| AHA worked example end-to-end; `item-at()` positions verified against real output | Pass | Scenario 5 |
| No-groups grid unchanged (regression) | Pass | Scenario 9 |
| Total-column + groups → clear load-time error | Pass | Scenario 7a |
| No iframe-resize runaway on a 12-row grid | Pass | Scenario 10 |
| Per-cell validation findings reported | Reported, not implemented | [Discovery §A4](SUBTOTALS_DISCOVERY.md) |
| Rejects malformed group specs (`3oops:1-2`, `3:1-2junk`, `3:1e2`) | Pass | Scenario 11 |
| Rejects duplicate source rows that would double-count | Pass | Scenario 11 |
| `clearAnswer()` resets values, override flags, variance styling and captions | Pass | Scenario 12 |
| Restored validation honours the subtotal `max_value` exemption | Pass | Scenario 13 |
| Rendering on Web Forms + one Collect platform | **Partial — see below** | — |

## Fixed after code review (17 Aug)

Four defects were found in review and fixed; scenarios 11-13 are the regressions that
now cover them.

- **Permissive integer parsing.** `parseInt` stops at the first non-digit, so
  `subtotals='3oops:1-2'` parsed as row 3 and `3:1-2junk` as rows 1-2 — a typo
  produced a plausible-looking grid that summed the wrong cells. Now a strict
  `/^\d+$/` check via `parseStrictRowNumber`.
- **Duplicate source rows were silently double-counted.** `3:1,1,2` now fails loudly.
- **`clearAnswer()` left subtotal state behind.** It cleared values but not
  `data-manual`, the variance styling, the reference captions, or the read-only total
  cells, so a previously overridden subtotal stayed frozen after the host cleared the
  field and never auto-filled again.
- **Restored validation ignored the `max_value` exemption.** Live validation exempted
  subtotal rows but `restoreValidationState` did not, so a valid calculated subtotal
  showed a spurious maximum warning after navigating back or resuming.

Separately, README examples used unquoted alphabetic parameter values
(`format_numbers=true`, `total=row`) that the same README warns against, and
`${min}` instead of the documented `{min}` placeholder. Both corrected.

## Not covered by automated tests

**Device testing is outstanding.** Everything above runs in headless Chrome, which
is a reasonable proxy for Web Forms but is **not** SurveyCTO Collect. The spec asks
for Web Forms plus at least one Collect platform. Before this ships, it still needs:

- SurveyCTO Collect on Android — the platform where this plug-in has historically
  had trouble (sticky headers, focus, WebView resize).
- Collect for iOS.
- The in-product field plug-in console (Form Designer → *Test* → the plug-in console
  icon), which is the required final validation step for any plug-in change.

The touch-specific concern worth watching: the reference caption and its **use**
button are rendered inside the cell, and the button is a real tap target on a row
that also holds an input.

## Also worth a human eye

- **Known issue, deliberately untouched:** the vertical-scroll glitch on ~10+ row
  grids (spec §5). Subtotal rows make grids taller, so it may surface more often
  even though nothing here changed that code path.
- The empty-group rule (an all-empty section leaves its subtotal empty rather than
  `0`) interacts with `required=1`: such a grid correctly blocks progression. Worth
  confirming that is what AHA expects for partially-completed sections.

## Full run output

    ========================================================================
    1. Subtotal rows render, initialise from components, live-update
    ========================================================================
    PASS  subtotal rows carry .subtotal-row
    PASS  grid total row carries .grid-total-row
    PASS  subtotal cells are editable inputs
    PASS  empty grid leaves subtotals empty, not 0
    PASS  subtotal = 100+50 = 150
    PASS  live-updates on further edits
    PASS  subtotal follows component edit -> 170
    PASS  other column untouched

    ========================================================================
    2. Override wins permanently; reference sum + warning; never blocks
    ========================================================================
    PASS  override marks cell manual
    PASS  override value kept
    PASS  reference caption shows calculated sum
    PASS  variance warning styling applied
    PASS  progression not blocked (answer still set)
    PASS  later component edit does NOT overwrite override
    PASS  reference sum updates to 160
    PASS  restore link hands cell back to auto
    PASS  restore clears manual flag

    ========================================================================
    3. Grid total sums subtotals and one-offs; overrides flow through
    ========================================================================
    PASS  subtotals 150/240/310
    PASS  total = 150+240+25+310+5 = 730
    PASS  subtotal override changes the total (900+240+25+310+5=1480)
    PASS  total override wins over everything
    PASS  total shows its calculated reference
    PASS  total override survives component edits

    ========================================================================
    4. One-off rows render as ordinary rows
    ========================================================================
    PASS  Other government is not a subtotal row
    PASS  Self-pay is not a subtotal row
    PASS  no duplicated subtotal row rendered for one-offs
    PASS  one-off has no reference caption

    ========================================================================
    5. Worked example serialization and item-at positions
    ========================================================================
    PASS  12 serialized rows
    PASS  each row has 2 comma-separated cells
    PASS  item-at('|',ans,2) is the Medicare subtotal row
    PASS  item-at('|',ans,11) is the TOTAL row
    PASS  item-at(',',item-at('|',ans,2),0) = 150
           answer = 100,90|50,45|150,135|200,|40,|240,|25,|300,|10,|310,|5,|730,135

    ========================================================================
    6. Override state is rebuilt from the saved answer (no metadata)
    ========================================================================
    PASS  overridden subtotal reloaded as manual
    PASS  overridden value preserved on reload
    PASS  non-overridden subtotal reloaded as auto
    PASS  reference caption restored after reload
    PASS  reloaded override still not overwritten

    ========================================================================
    7a. total='row' + subtotal groups fails loudly
    ========================================================================
    PASS  config error rendered
    PASS  no grid rendered
    PASS  answer cleared
    PASS  error names the clash

    ========================================================================
    7b. duplicate subtotal target fails loudly
    ========================================================================
    PASS  config error rendered
    PASS  error explains duplicate target

    ========================================================================
    7c. out-of-range source row fails loudly (not silently ignored)
    ========================================================================
    PASS  config error rendered
    PASS  error quotes the bad entry

    ========================================================================
    7d. total that sums itself fails loudly
    ========================================================================
    PASS  config error rendered
    PASS  error explains self-reference

    ========================================================================
    8. max_value exempts subtotal rows; min_value still applies
    ========================================================================
    PASS  subtotal 700 exceeds max_value=500 but is not flagged
    PASS  no max violation shown on the subtotal cell
    PASS  line item over max IS still flagged
    PASS  min_value still applies to an overridden subtotal

    ========================================================================
    9. No-groups grid: unchanged behaviour and serialization
    ========================================================================
    PASS  no subtotal rows rendered
    PASS  no config error
    PASS  legacy total row still present
    PASS  column total unaffected by the new skip logic
    PASS  serialization unchanged: 1000,2000,3000|10,20,30|1,2,3

    ========================================================================
    10. No iframe-resize runaway on a 12-row grid with subtotals
    ========================================================================
    PASS  resize calls stop once editing stops
    PASS  container keeps a pixel max-height cap
    PASS  body height stayed bounded (<= 3x cap)
    PASS  height did not grow monotonically across calls
           size() calls: 1, heights: 233

    ========================================================================
    11. Rejects "3oops:1-2" (garbage in target)
    ========================================================================
    PASS  config error rendered
    PASS  no grid rendered

    ========================================================================
    11. Rejects "3:1-2junk" (garbage in range end)
    ========================================================================
    PASS  config error rendered
    PASS  no grid rendered

    ========================================================================
    11. Rejects "3:1,1,2" (duplicate source row (would double-count))
    ========================================================================
    PASS  config error rendered
    PASS  no grid rendered

    ========================================================================
    11. Rejects "3:1e2" (exponent notation)
    ========================================================================
    PASS  config error rendered
    PASS  no grid rendered

    ========================================================================
    12. clearAnswer fully resets subtotal state
    ========================================================================
    PASS  precondition: cell is overridden with variance
    PASS  values cleared
    PASS  override flag cleared
    PASS  variance styling cleared
    PASS  reference caption cleared
    PASS  subtotal auto-fills again after clear

    ========================================================================
    13. Restored validation exempts subtotals from max_value
    ========================================================================
    PASS  no spurious max warning on the restored subtotal
    PASS  line item over max IS still flagged on restore

    ========================================================================
    TOTAL: 76 passed, 0 failed
