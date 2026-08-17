# Subtotals & editable totals — discovery summary and parameter proposal

**Against:** Spec v1, 17 Aug 2026 (AHA subtotals & editable totals enhancement)
**Branch:** `feature/subtotals` · **Base version:** 2.0.41
**Status:** Discovery complete; both decisions in §D confirmed by Mofya, and the
feature is implemented in 2.1.0. See [test evidence](SUBTOTALS_TEST_EVIDENCE.md).

---

## A. Discovery summary (spec step 1)

### A1. Grid configuration

`rows` and `cols` (alias `columns`) set the shape; `row_labels` (alias `row_headers`)
and `col_labels` (alias `column_headers`) supply labels. Labels accept comma **or**
pipe as separator — [`parseLabels`](../../source/script.js#L184) picks pipe if a pipe is
present, else comma. Missing labels fall back to `Row N` / `Column N`.

Two rendering modes exist. [`shouldUseEnhancedMode()`](../../source/script.js#L307)
returns true if **any** of `show_historical`, `historical_data`, `historical_display`,
`historical_label`, `total`, `format_numbers`, `min_value`, `max_value`,
`allow_decimals`, `validation_strict`, `col_labels`, `row_labels` is set and non-empty.
Otherwise the plug-in runs the legacy path. This gate is where any new parameter must
be registered, or a grid configured with only `rows`/`cols`/`subtotals` would silently
fall through to legacy serialization.

### A2. Serialization — spec's assumption confirmed, with a correction

The spec's description is right for enhanced mode:

- **Enhanced:** cells joined by `,` within a row, rows joined by `|`, **no trailing pipe** — `A1,B1|A2,B2`
- **Legacy:** every cell joined by `|` in one flat list, **with** a trailing pipe

[`updateAnswer`](../../source/script.js#L1640) builds the enhanced form and enforces an
invariant worth knowing about: every cell has `,` and `|` stripped before joining
(script.js:1674-1676), and in numeric grids typed thousands separators are removed
first. So a cell can never contain either delimiter.
[`loadExistingData`](../../source/script.js#L1830) auto-detects both formats on read by
comparing segment count against `rows × cols`.

**Correction to the spec's phrasing:** the format is row-major positional, but there is
no explicit row/column *index* stored — position is implied by ordinal. That matters for
§2.5: adding subtotal rows shifts every subsequent `item-at()` index.

### A3. How totals work today — and a naming trap

`total` takes one of two values, and **the names are the opposite of what they suggest**:

| `total` value | What it renders |
|---|---|
| `row` | An extra **column** on the right holding each row's across-columns sum ([script.js:1126](../../source/script.js#L1126)) |
| `column` | An extra **row** at the bottom holding each column's down-rows sum ([script.js:1138](../../source/script.js#L1138)) |

AHA's subtotals sum component **rows** to produce a subtotal **row** — that is the
`total='column'` operation. The configuration §3.2 wants rejected ("total column +
subtotal groups") is therefore **`total='row'`** in this plug-in's vocabulary. Getting
this backwards would implement the guard on the wrong value.

Totals today are read-only `<td>` elements outside the input matrix, so they are
**not serialized** and never appear in the submission. `total='column'` also pins its
row to the bottom of the scroll area.

Because `total` is a single parameter, "total column OR total row, not both" (§3.2) is
already structurally guaranteed — no new guard needed for that half.

**Double-count defect to fix:** [`updateColumnTotals`](../../source/script.js#L2410)
sums `rowIndex` `0..params.rows`. Once subtotal rows become real rows, the grand total
would add both the line items and the subtotals. §2.3 requires summing subtotals only.

### A4. Validation (spec §6.1 — findings for Terrence Fields)

**There is no per-cell validation.** `min_value`, `max_value`, and `allow_decimals` are
single global values applied to every cell:
[`validateAllInputs`](../../source/script.js#L560) iterates every `.cell-input` and calls
[`validateNumericInput`](../../source/script.js#L506) with the same `params` each time.

What *does* exist:

- **Strict numeric parsing.** `STRICT_NUMERIC_RE` (script.js:63) rejects `12abc`,
  `1.2.3`, `10|20` — values `parseFloat` would silently accept and corrupt the answer with.
- **Hard vs soft**, globally, via `validation_strict`. Hard blocking works by withholding
  `setAnswer`, so it **only blocks progression when the field also has SurveyCTO's native
  `required=yes`**. This is documented but easy to miss.
- **Customisable messages** per violation type, with `{min}`/`{max}` placeholders.

**AHA's driving case is already solved today:** "no negative numbers" is
`min_value=0` plus `validation_strict=true` and native `required=yes`. No new code needed.

**Gotcha worth reporting:** passing a multi-value string such as `min_value='0,10|20'`
does not error — [`parseNumericOrNull`](../../source/script.js#L65) rejects it and returns
`null`, which means **unconstrained**. A form author attempting per-cell limits today
gets silently *no* validation rather than a failure.

A reviewed but unimplemented design already exists at
[`PER_CELL_CONSTRAINTS_SPEC.md`](../PER_CELL_CONSTRAINTS_SPEC.md), including the soft-range
variant §6 asks us to leave room for. Recommendation: implement per-cell validation as a
**separate follow-up branch** per §6's own escape clause — it touches the same validation
path as the subtotal work and doing both at once risks destabilising the higher-priority
feature.

### A5. Metadata — the channel the spec assumes exists, does not

§2.5 says to store override flags "if the existing metadata format has room". There is
**no metadata channel at all**. `setMetaData`/`getMetaData` are unused; they were removed
in v2.0.30 deliberately (see the comment at [script.js:1686](../../source/script.js#L1686)).
The reason was a data leak: plug-in metadata ships in the raw submission XML and is *not*
encrypted when the field is publishable, so values that strict validation intentionally
withheld from `setAnswer` were still reaching the server.

Restoring metadata to carry override flags would reverse that security decision. See §D1
for the alternative.

### A6. Iframe resize (§4)

The runaway-resize class of bug is actively defended against here, and the defences are
subtle enough to break by accident:

- [`seedInitialContainerHeight`](../../source/script.js#L2507) caps `#table-container` in
  **pixels** before first render. The comment explains that `vh` units cannot be used —
  the iframe is sized to its content, so `vh` creates a feedback loop that collapses the
  container.
- [`pinHeightMethod`](../../source/script.js#L2537) forces iframeResizer to `bodyOffset`,
  polling up to ~4s for `window.parentIFrame`. Without it the resizer oscillates between
  measurement strategies as the user scrolls.
- [`requestHostResize`](../../source/script.js#L2590) fires `size()` on staggered ticks.

Adding rows changes content height, so subtotal rendering must go through the existing
re-measure path rather than introducing its own resize calls.

### A7. Required-field interaction

[`checkAllRequired`](../../source/script.js#L1807) requires **every** cell to be non-empty
when `required=1`. Subtotal and total cells become real cells, so they fall under this
rule. Combined with the empty-group rule in the design, a section with no line items
leaves its subtotal empty and blocks progression — which is correct, but is a behaviour
change worth stating in the README.

---

## B. Parameter proposal (spec step 2 / §3.1)

Two parameters, sharing one `target:sources` syntax, consistent with the positional,
delimiter-separated style of `column_widths` and `historical_data`.

```
rows=14
row_labels='Medicare FFS,Medicare Advantage,Medicare subtotal,Medicaid FFS,Medicaid managed care,Medicaid subtotal,Other government,Commercial FFS,Commercial managed care,Commercial subtotal,Self-pay,TOTAL'
subtotals='3:1-2|6:4-5|10:8-9'
grid_total='12:3,6,7,10,11'
```

| Parameter | Meaning |
|---|---|
| `subtotals` | Groups separated by `\|`. Each is `target:sources` — the row holding the subtotal, and the rows it sums. Sources accept ranges (`1-2`), lists (`3,6,7`), or a mix. |
| `grid_total` | One `target:sources` entry for the grid total. Styled as a total rather than a subtotal. |

**Row numbers are 1-based**, matching how an author counts their own `row_labels` list.
(Noting the inconsistency: the README documents `item-at()` with 0-based indices. Author
convenience wins here, and it will be documented prominently.)

**One-off rows need no configuration at all.** Rows 7 (Other government) and 11 (Self-pay)
in the example above are ordinary rows that simply appear among `grid_total`'s sources.
This satisfies §2.4 by construction — there is no single-row group, so there is nothing
that could render a duplicated subtotal row. See §D2.

Subtotal labels come from `row_labels`, so they are author-supplied per §3.1 with no new
parameter.

**Load-time validation**, all failing loudly per §3.2: a target row may appear only once
across both parameters; no row may be its own source; every index must be within
`1..rows`; `total='row'` (the right-hand total column) combined with either parameter is
a configuration error.

This departs from the `column_widths` convention of ignoring a malformed spec and falling
back silently ([script.js:906](../../source/script.js#L906)). Silent fallback is right for
column widths — you get a differently-sized but correct grid. It is wrong here: you would
get a grid that looks complete and sums nothing. Flagging the departure rather than
assuming it.

---

## C. What changes in the stored answer

Subtotal and total rows become real rows in the matrix, serialized in visual position.
For the example above, `rows` goes from 11 line items to 14 positions:

```
item-at('|', ${grid}, 2)   -> the Medicare subtotal row
item-at('|', ${grid}, 11)  -> the TOTAL row
item-at(',', item-at('|', ${grid}, 2), 0)  -> Medicare subtotal, first column
```

Per §2.5 the running calculated reference sums are **not** stored; only the values
present in the cells. The README will document the `calculate`-field pattern AHA already
uses for calculated-vs-supplied comparison.

---

## D. Two decisions needed before implementation

Both touch §2, which the spec says not to deviate from without checking.
**Both were put to Mofya on 17 Aug and confirmed as proposed below.**

### D1. Override flags cannot go in metadata (§2.5)

There is no metadata channel, and restoring one would reverse the v2.0.30 security fix
(§A5). Proposal: **do not store an override flag.** It is fully derivable downstream —
a subtotal was overridden exactly when the stored subtotal differs from the sum of its
stored component rows, and both are in the submission. This costs AHA one `calculate`
field per subtotal, in the same pattern §2.5 already asks them to use for
calculated-vs-supplied comparison.

The alternative — reintroducing `setMetaData` — would put override state in the raw XML
unencrypted on publishable fields.

### D2. One-off rows need no group configuration (§2.4)

§2.4 specifies one-offs as "a standalone single-row group" whose internal subtotal is its
own value. Under the proposed syntax that concept is unnecessary: a one-off is a plain
row listed among `grid_total`'s sources. Same arithmetic, and the rendering requirement
("must NOT show a duplicated subtotal row") is satisfied by construction rather than by a
suppression rule that could regress.

Confirming this is a simplification of the mechanism and not a change to the behaviour
§2.4 requires.
