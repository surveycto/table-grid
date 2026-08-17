# Subtotals & editable totals — test evidence

**Spec:** v1, 17 Aug 2026, §9 acceptance criteria
**Branch:** `feature/subtotals` · **Plug-in version:** 2.1.1
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
| Rendering on Web Forms + one Collect platform | Pass (Android) | Device run, 17 Aug — 30/30 |

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

## Device run — Android Collect, 17 Aug 2026

Deployed to `mitoworks21.surveycto.com` and driven on a **Pixel 10 Pro XL (Android 17,
SurveyCTO Collect v2.81, real device)**. **30/30 on-device checks passed**, including a
finalized submission that reached the server.

The strongest evidence in that run reads the plug-in's output back through the form
engine rather than off the widget. With the Medicare subtotal overridden to 900:

```
medicare_ffs       = 100    (item-at index 0)
medicare_adv       = 50     (item-at index 1)
medicare_sub       = 900    (item-at index 2 — the override)
medicare_diff      = 750    (drives the relevance-gated note)
grid_total_charges = 1790   (item-at index 11)
```

That confirms `setAnswer` writes a correctly structured matrix, `item-at()` parses it,
and the documented form-side override-detection pattern works end to end. It also
confirms `format_numbers` is display-only: the screen showed `1,790` while the stored
value was `1790`.

**Unexpected accessibility finding, worth protecting.** Every cell surfaces in the
Android accessibility tree as an `android.widget.EditText` inside a `View` labelled
`Current value for <row label> <column label>` — the `aria-label` set in
`createCellContent` — with the live value on the `EditText`'s `text` attribute. That is
a real accessibility win and it made the device run far more rigorous than screenshot
reading. Any future refactor of the render path should keep it.

### Still blocked or unrun after the device pass

| Gate | Status |
|---|---|
| Stored submission values byte-verified on the server | Blocked — role lacks API access (HTTP 412/403) |
| iOS Collect | Blocked — WebDriverAgent not installed on the iPhone |
| Web forms, desktop browser | Not run |
| In-product plug-in console (Form Designer → Test) | Not run |

### Paths the device run did not exercise

1. **Restore-from-saved override state on device.** Whether the override flag, amber
   styling and `Calculated:` caption rebuild from a *stored* answer rather than from
   live typing. Covered headlessly by scenarios 6 and 13; not seen on a real device.
2. **The `use` revert chip was rendered and positioned but never tapped** — the one
   touch-target risk flagged before the run is still open.
3. **Per-column subtotal arithmetic in the Payments column.** It was deliberately left
   empty to prove non-bleed, so column 2 arithmetic is unverified on device.
4. **Override on the grid-total row itself.** Covered headlessly by scenario 3, not on
   device.
5. **Hard-validation blocking.** See the correction below.

### `use` chip focus race — found on device and in web forms, fixed in 2.1.1

The device/web run found the one real defect: the `use` restore chip did nothing on the
first click while the overridden cell still had focus, on **both** Android Collect and
desktop web forms. Root cause was in `applySubtotalCell`, not either host: the input's
blur handler calls `updateSubtotals`, which rebuilt the caption DOM unconditionally and
so detached the button between `mousedown` and `mouseup`. No `click` event was ever
dispatched. The second click worked because the cell was already blurred.

Fixed two ways, as recommended:

1. The caption now **rebuilds only when the displayed value actually changed**
   (`data-shown` diff), so a recompute no longer churns the DOM or replaces the button.
2. The button **preventDefaults `mousedown`**, so pressing it never pulls focus out of
   the cell and the blur recompute is not triggered at all.

The chip's touch target was also enlarged: padding and `min-height` raise the visual
control, and a `::before` overlay extends the hit area to roughly 44px tall without
changing layout — it previously measured 33 × 17 CSS px, under both the Apple and
Material minimums, directly beneath a text input.

**Why the original suite missed it.** Scenario 2 exercised restore via `btn.click()`,
which invokes the handler directly and works even on a detached node. Scenario 14 now
models real pointer ordering and asserts on **node identity** across the blur recompute.
Verified to fail on the pre-fix code (3 assertions) and pass on the fix.

One further trap worth recording: scenario 14 only reproduces when `format_numbers` is
set. That routes input handling down the *enhanced* branch, whose blur handler recomputes;
the standard branch's blur handler does not. A first version of the regression test used
the plain AHA config and passed against the broken code.

### Correction to the device report's reading of check 16

The device report infers from check 16 that "validation is advisory, not blocking, which
matches the design intent for `validation_strict='true'`". That inference is wrong.
`validation_strict='true'` **is** meant to block: `updateAnswer` calls `setAnswer('')`
when strict validation fails, which combined with the field's native `required=yes`
prevents advancing.

What check 16 actually showed is that an invalid entry is *flagged* while the subtotal
still displays a figure derived from the numeric part — display behaviour, not answer
behaviour. Blocking was never exercised, because the bad value was cleared (check 22)
before the form was advanced. **Attempting to swipe forward with an invalid cell still
present remains untested**, and it is the check that would confirm the strict path.

## Not covered by automated tests

Everything in the suite above runs in headless Chrome, which is a fair proxy for Web
Forms and nothing else. It exercises none of the Android System WebView or iOS
WKWebView behaviour where this plug-in has historically had trouble. The Android gap
is now closed by the device run documented above; iOS, desktop web forms and the
in-product console remain open.

The iframe-resize scenario stubs `parentIFrame` rather than running against real
iframeResizer, so it proves the plug-in does not spam `size()` calls; it does not
prove the host sizes correctly.

## Also worth a human eye

- **Known issue, deliberately untouched:** the vertical-scroll glitch on ~10+ row
  grids (spec §5). Subtotal rows make grids taller, so it may surface more often
  even though nothing here changed that code path.
- The empty-group rule (an all-empty section leaves its subtotal empty rather than
  `0`) interacts with `required=1`: such a grid correctly blocks progression. Worth
  confirming that is what AHA expects for partially-completed sections.

## Full run output

Re-run on the host at 2.1.1:

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
    14. Restore chip survives blur recompute (pointer race)
    ========================================================================
    PASS  chip is present after override
    PASS  chip preventDefaults mousedown so the cell keeps focus
    PASS  chip node survived the blur recompute
    PASS  chip in the DOM is the same node that got mousedown
    PASS  click on the surviving node reverts the override
    PASS  override flag cleared
    PASS  variance styling cleared
    PASS  caption still re-renders when the calculated value changes

    ========================================================================
    TOTAL: 84 passed, 0 failed
