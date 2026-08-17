# Table grid

![Default appearance for the 'table-grid' field plug-in](extras/tablegrid.png)

## Description

This field plug-in supports the creation of a table for data input in SurveyCTO forms. While this has been a SurveyCTO limitation so far, it is possible to address this request through the creation of a [Repeat Group](https://docs.surveycto.com/02-designing-forms/01-core-concepts/06.groups.html) with [table appearance](https://www.surveycto.com/videos/paper-to-digital-tables/), which displays the data collected in a table. This field plug-in, however, allows you to create the real grid appearance and edit data directly from the table.

[![Download now](extras/download-button.png)](https://github.com/surveycto/table-grid/raw/master/table-grid.fieldplugin.zip)

### Features

1. Define number of rows and columns in the table.
1. Define the labels for the rows and columns in the table.
1. Use the `numbers` appearance for numeric input.
1. Use **dynamic references** in the headings for rows and columns.
1. **Historical data display** - Show previous period data alongside current inputs.
1. **Number formatting** - Automatic comma formatting for large numbers with real-time formatting.
1. **Advanced input validation** - Set minimum/maximum values, decimal restrictions, and custom validation messages.
1. **Soft vs Hard validation modes** - Choose between warnings (soft) or blocking errors (hard).
1. **Automatic totals** - Calculate row or column totals in real-time.
1. **Enhanced accessibility** - Full keyboard navigation and screen reader support.
1. **Smart validation messages** - Individual cell validation with intelligent positioning to prevent cutoff and overlap.

### Data format

This field plug-in requires the `text` field type. The plug-in has two answer formats depending on which mode is active:

#### Legacy mode (no `col_labels`/`row_labels`/enhanced parameters)

The data is stored as a flat pipe <code> (|)</code> separated list with a trailing pipe:

`1|2|3|4|5|6|7|8|9|0|`

For example, this table:

| | A | B |
| --- | --- | --- |
| 1 | A1 | B1 |
| 2 | A2 | B2 |

…is stored as `A1|B1|A2|B2|`.

Use the [`item-at()`](https://docs.surveycto.com/02-designing-forms/01-core-concepts/09.expressions.html#Help_Forms_item-at) function to retrieve individual cells from the saved value. SurveyCTO's signature is `item-at(separator, list, index)` and the index is **zero-based**:

```
item-at('|', ${field}, row * cols + col)
```

For the example above (`A1|B1|A2|B2|`, with `cols=2`), `item-at('|', ${field}, 0)` returns `A1`, `item-at('|', ${field}, 3)` returns `B2`.

#### Enhanced mode (any of `col_labels`, `row_labels`, `show_historical`, `total`, `format_numbers`, `min_value`, `max_value`, `allow_decimals`, `validation_strict`)

The data is stored as a **row-oriented** matrix: cells in a row are joined by commas, rows are joined by pipes, and there is **no trailing pipe**:

`A1,B1|A2,B2`

This format keeps row structure intact, so cells can be addressed by `(row, col)` directly via nested `item-at()` calls (zero-based indices on both axes):

```
item-at('|', ${field}, R)                          <-- whole row R as "A,B,C"

item-at(',', item-at('|', ${field}, R), C)         <-- single cell at row R, col C
```

> **Note**: Use `item-at()`, not `selected-at()`. `selected-at()` is for `select_multiple` choice selections and won't work on these delimited strings.

> **Breaking change vs upstream `surveycto/table-grid`.** Upstream uses the flat `|` format documented in the previous section regardless of parameters. This fork uses the enhanced row-oriented format whenever any enhanced parameter is set. If you are migrating an existing form from upstream and adding any enhanced parameter, your XPath calculations on the answer field will need to be updated.

**Subtotal and grid-total rows are stored as ordinary rows** in this matrix, in the order they appear on screen — see [Subtotals and editable totals](#subtotals-and-editable-totals).

**Note**: Because rows are separated by pipes <code> (|)</code> and cells are separated by commas <code> (,)</code>, do not put pipes or commas in any of the actual cell values. Use whole numbers, decimals with `.` (the plug-in normalizes commas to dots when `allow_decimals=true`), or short text that doesn't contain those delimiters.

## How to use

### Getting started

**To use this plug-in as-is**, just download the [table-grid.fieldplugin.zip](https://github.com/surveycto/table-grid/raw/master/table-grid.fieldplugin.zip) file from this repo, specify this field plug-in as a custom field *appearance* in the form design (like in the [sample forms](https://github.com/surveycto/table-grid/tree/master/extras/sample-form)), and attach it to your form. For more details about using field plug-ins, please read the [user documentation](https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html).

**To create your own** field plug-in using this as a template, follow these steps:

1. Fork this repo
1. Make changes to the files in the `source` directory.  
    * **Note:** be sure to update the `manifest.json` file as well.
1. Re-zip the four plug-in files **at the zip root** with no subdirectories. From the repo root:

    ```bash
    rm -f yourpluginname.fieldplugin.zip
    (cd source && zip -X ../yourpluginname.fieldplugin.zip \
        manifest.json template.html script.js style.css)
    ```

    Avoid `zip -r source/` or "compress the source folder" from a file
    manager — those bundle every file in `source/` (including macOS
    `.DS_Store` files), which SurveyCTO rejects because filenames inside
    a plug-in must start with a letter.
1. Rename `yourpluginname` in the command above to the name you want to use for your plug-in.
1. You may then attach your new `.fieldplugin.zip` file to your form as normal.

For more information about developing your own field plug-ins, please read the [developer documentation](https://github.com/surveycto/Field-plug-in-resources).

### Default SurveyCTO feature support

| Feature / Property | Support |
| --- | --- |
| Supported field type(s) | `text`|
| Default values | Yes |
| Constraint message | Uses default behavior |
| Required message | Uses default behavior |
| Read only | Yes *(shows the current value, if present)* |
| media:image | Yes |
| media:audio | Yes |
| media:video | Yes |
| `numbers` appearance | Yes |

### Parameters

> ⚠️ **Quote alphabetic values.** SurveyCTO evaluates appearance-parameter
> values as XPath. Numeric literals (`rows=2`, `min_value=100`) and
> `${field}` references work as bare tokens, but **bare alphabetic words
> like `true`, `bottom`, `column` evaluate to an empty string** and the
> plug-in will silently treat the parameter as unset. Always quote them:
>
> ```
> ✅ show_historical='true', historical_display='bottom', total='column'
> ❌ show_historical=true,   historical_display=bottom,   total=column
> ```
>
> If a feature you set looks like it isn't engaging, this is the most
> common cause. Quoting works for every alphabetic value the plug-in
> accepts (`'true'`, `'false'`, `'top'`, `'bottom'`, `'columns'`,
> `'toggle'`, `'row'`, `'column'`, etc.). `${...}` references should
> remain unquoted.

#### Basic Parameters (Legacy Support)

The following parameters maintain compatibility with existing forms:

| Parameter key | Parameter value |
| --- | --- |
| `columns` or `cols` | The number of columns to be displayed. |
| `rows` | The number of rows to be displayed. |
| `column_headers` or `col_labels` | The headings for each column. Use comma-separated format: `"Header 1, Header 2, Header 3"` or legacy pipe-separated format: `"Header 1\|Header 2\|Header 3"` |
| `row_headers` or `row_labels`| The headings for each row. Use comma-separated format: `"Row 1, Row 2, Row 3"` or legacy pipe-separated format: `"Row 1\|Row 2\|Row 3"` |
| `required` (optional)| Indicates whether some or all the cells in the table should have a value. When set to `1` all the cells in the table should have a value. Default is `0`.|

#### Enhanced Parameters

The following parameters enable advanced features:

| Parameter key | Parameter value |
| --- | --- |
| `show_historical` | Set to `true` to display historical data alongside current inputs. Default is `false`. |
| `historical_data` | Historical data in the same format as the main data: `"A1,B1\|A2,B2"` for a 2x2 table. |
| `historical_display` | How to display historical data: `bottom` (default, below input), `top` (above input), `columns`, or `toggle`. |
| `historical_label` | Label for historical data. Default is `"Last Year"`. |
| `total` | Read-only totals. `row` adds a totals **column** on the right (each row's across-columns sum); `column` adds a totals **row** at the bottom (each column's down-rows sum). Note the names describe what is summed, not where the result appears. |
| `total_label` | Label for the totals header/row. Default is `"Total"`. Set to e.g. `"Sum"` when respondents enter their own totals. |
| `subtotals` | Subtotal groups, separated by `\|`. Each group is `<subtotal row>:<rows it sums>`, e.g. `"3:1-2\|6:4-5"`. Sources accept ranges (`1-2`), lists (`3,6,7`), or a mix. Row numbers start at **1**. See [Subtotals and editable totals](#subtotals-and-editable-totals). |
| `grid_total` | The grid total row, same `<row>:<rows it sums>` syntax, e.g. `"12:3,6,7,10,11"`. Sums subtotals and any ungrouped rows you list — never the raw line items twice. |
| `subtotal_reference_label` | Prefix on the calculated-sum caption shown under an overridden subtotal. Default is `"Calculated"`. |
| `format_numbers` | Set to `true` to format numbers with comma separators (real-time formatting). Default is `false`. |
| `min_value` | Minimum allowed value for numeric inputs. Applies **globally** to every cell — per-cell, per-row and per-column limits are not supported. Set `min_value=0` (with `validation_strict='true'` and SurveyCTO's native `required=yes`) to block negative numbers. |
| `max_value` | Maximum allowed value for numeric inputs. Global, as above. Does not apply to subtotal or grid-total rows. |
| `allow_decimals` | Set to `false` to restrict inputs to whole numbers only. Default is `true`. |
| `validation_strict` | Set to `true` to prevent form progression when validation fails (hard validation). **Important:** Must be used with SurveyCTO's native `required` set to `yes` for progression blocking to work. Set to `false` for soft validation with warnings. Default is `false`. |
| `frame_adjust` | Pixel offset added to the auto-computed table height when the column header is pinned. Use a positive number to make the table area taller, negative to shrink it. Only useful when fine-tuning for unusual form layouts (long labels, large hint text). Default is `0`. |
| `pinned_headers` | Controls the bounded-scroll layout that pins the column header and row labels. `auto` (default) only clamps when the table is taller than the available viewport. `always` forces the clamp. `never` disables it entirely — the table renders at natural height and the form scrolls instead. Use `never` if the bounded layout misbehaves on a particular form. |
| `row_label_width` | Width of the first column (row labels). Accepts pixels (`220px`) or percentages (`35%`). When set, this overrides the auto-sizing for the row label column. Useful when long question labels are getting truncated or the data columns are too wide. |
| `data_column_width` | Uniform width applied to every data column. Accepts pixels (`80px`) or percentages (`15%`). When set, the row-label column takes the remaining space (or honors `row_label_width` if also set). |
| `column_widths` | Per-column override (one entry per column, including the row-label column, separated by `\|` or `,`). Three modes: **proportional shares** — unit-less numbers like `"2\|1\|1\|1\|1"` (first column gets 2/6 of the table width, each data column 1/6); **explicit pixels** — `"250px\|80px\|80px\|80px\|80px"`; **explicit percentages** — `"40%\|15%\|15%\|15%\|15%"`. When set, `column_widths` overrides `row_label_width` and `data_column_width`. The number of entries must match the table column count (rows + label column, plus any historical/total columns); otherwise the spec is ignored and the plug-in falls back to auto-sizing. |

#### Validation Message Customization

Customize validation messages for better user experience:

| Parameter key | Parameter value |
| --- | --- |
| `constraint_message_min` | Custom message for minimum value violations. Use `{min}` placeholder. Default: `"Value must be at least {min}"` |
| `constraint_message_max` | Custom message for maximum value violations. Use `{max}` placeholder. Default: `"Value must be at most {max}"` |
| `constraint_message_decimals` | Custom message when decimals are not allowed. Default: `"Decimal numbers are not allowed"` |
| `constraint_message_invalid` | Custom message for invalid numbers. Default: `"Please enter a valid number"` |
| `constraint_message_min_soft` | Soft validation message for minimum values. Default: `"Recommended minimum: {min}"` |
| `constraint_message_max_soft` | Soft validation message for maximum values. Default: `"Recommended maximum: {max}"` |
| `constraint_message_decimals_soft` | Soft validation message for decimals. Default: `"Whole numbers preferred"` |
| `constraint_message_invalid_soft` | Soft validation message for invalid numbers. Default: `"Please check this number"` |

#### Historical Data Display Modes

- **`bottom`** *(default)*: Historical values appear below the input field in each cell
- **`top`**: Historical values appear above the input field in each cell *(formerly `inline` — that name still works as an alias for backward compatibility)*
- **`columns`**: Historical data appears in separate columns next to current data columns
- **`toggle`**: Users can toggle between viewing historical data and current inputs

### Subtotals and editable totals

Rows can be grouped into sections that roll up into a subtotal row, and the subtotals can roll up into a grid total. Both the subtotal rows and the total row are **editable**: they start as the calculated sum and keep tracking it, but a respondent who knows the real figure — because their institution cannot break out every line item — can type over it, and their number then wins permanently.

#### Configuring groups

`subtotals` declares one group per `|`-separated entry, as `<subtotal row>:<rows it sums>`. `grid_total` declares the total row the same way. **Row numbers start at 1** and refer to positions in `row_labels`.

```
custom-table-grid(
  rows=12,
  cols=2,
  row_labels='Medicare FFS,Medicare Advantage,Medicare subtotal,Medicaid FFS,Medicaid managed care,Medicaid subtotal,Other government,Commercial FFS,Commercial managed care,Commercial subtotal,Self-pay,TOTAL',
  col_labels='Charges,Payments',
  subtotals='3:1-2|6:4-5|10:8-9',
  grid_total='12:3,6,7,10,11',
  format_numbers='true'
)
```

Subtotal labels come from `row_labels` — nothing is auto-generated, so you control the wording.

#### Rows that belong to no section

Rows 7 (`Other government`) and 11 (`Self-pay`) above are **one-off line items**: they belong to no subtotal but must still count toward the grid total. They need no configuration at all — list them among `grid_total`'s sources and they are done. They render as ordinary rows, with no subtotal styling and no duplicated row.

This is also why the grid total sums *subtotals and one-offs* rather than every line item: adding the line items again would double-count everything that already rolls into a subtotal, and it would discard subtotal overrides.

#### Override behaviour

- A subtotal or total cell auto-fills with its calculated sum and follows later edits to its components.
- The moment the respondent types in it, the cell is theirs. Component edits update the *reference* figure but never overwrite their value.
- When the two disagree, the calculated sum appears beneath the cell (`Calculated: 1,650,000`) with the cell highlighted, plus a small **use** button that hands the cell back to automatic. Customise the caption prefix with `subtotal_reference_label`.
- A mismatch is **always a warning, never a blocker**. Respondents can proceed.
- If a section has no values at all, its subtotal stays **empty**, not `0` — so an untouched grid is still correctly treated as unanswered.

#### Restrictions

- Subtotals are **row-based only**. Because they sum down rows, they cannot be combined with `total='row'` (which adds a totals column on the right). That combination is a configuration error and the plug-in refuses to render, showing the reason.
- Any malformed `subtotals` / `grid_total` value — an out-of-range row, a duplicated subtotal row, a group that sums itself, or a subtotal used before it is defined — also fails loudly at load rather than rendering a grid that silently sums nothing.
- `max_value` does **not** apply to subtotal or total rows: a sum exceeds the ceiling meant for the items it sums by construction. `min_value` and `allow_decimals` still apply.

#### What gets stored

Subtotal and total rows are **real rows in the answer matrix**, serialized in the order they appear on screen. The example above stores 12 rows:

```
item-at('|', ${payer_grid}, 2)                        <-- Medicare subtotal row, "1900000,1200000"
item-at('|', ${payer_grid}, 11)                       <-- TOTAL row
item-at(',', item-at('|', ${payer_grid}, 2), 0)       <-- Medicare subtotal, Charges column
```

> **Indices are 0-based in `item-at()` but 1-based in `subtotals`/`grid_total`.** The parameters are written against your `row_labels` list, which authors count from 1; `item-at()` follows SurveyCTO's own convention. Row 3 in `subtotals` is index 2 in `item-at()`.

> **Adding subtotal rows to an existing grid shifts every later `item-at()` index** and widens the exported data. Plan that change deliberately if the form is already collecting.

The running calculated reference sums are **not** stored, and neither is an "was overridden" flag — the plug-in has no metadata channel (see the note in `updateAnswer`). Both are derivable form-side, which is the recommended pattern anyway.

#### Comparing supplied against calculated

To flag a respondent-supplied subtotal that disagrees with its components, recompute the sum in a `calculate` and compare:

| type | name | calculation |
| --- | --- | --- |
| `calculate` | `medicare_ffs` | `number(item-at(',', item-at('\|', ${payer_grid}, 0), 0))` |
| `calculate` | `medicare_adv` | `number(item-at(',', item-at('\|', ${payer_grid}, 1), 0))` |
| `calculate` | `medicare_sub` | `number(item-at(',', item-at('\|', ${payer_grid}, 2), 0))` |
| `calculate` | `medicare_diff` | `${medicare_sub} - (${medicare_ffs} + ${medicare_adv})` |

`medicare_diff` is non-zero exactly when the respondent overrode that subtotal, which doubles as the override flag and as a data-quality check you can drive a `constraint` or a review field from.

#### Validation Modes

- **Soft Validation** (`validation_strict=false`): Shows amber/orange warning messages but allows form progression. Ideal for recommendations or guidelines.
- **Hard Validation** (`validation_strict=true`): Shows red error messages and prevents form progression until issues are resolved. Required for strict data quality. **Note:** For hard validation to block progression, the field must also have `required` set to `yes` in the SurveyCTO form design.

#### Long tables and the pinned column header

When the table is taller than the available space inside the field, the plug-in caps the table area to the visible height and pins the column header (and the row labels) so they remain visible while the user scrolls *inside* the table. Tables that comfortably fit are left alone — there is no internal scroll for short tables.

The available height is read from `parentIFrame.getPageInfo` when available (web Collect via iframeResizer) so the bounded area matches the parent's actual visible viewport. On Android/iOS Collect — where iframeResizer isn't present — the plug-in falls back to a heuristic based on screen height. For unusual form layouts — very long question labels, large hints, custom themes — use the `frame_adjust` parameter to add or subtract pixels, or set `pinned_headers='never'` to disable the bounded layout entirely:

```
custom-table-grid(
  rows=12,
  cols=4,
  ...
  frame_adjust=-40   // shrink the visible table area by 40px
)

custom-table-grid(
  rows=12,
  cols=4,
  ...
  pinned_headers='never'   // disable internal scroll; let the form scroll instead
)
```

#### Controlling column widths

By default the plug-in chooses column widths based on column count and screen size. If your row labels are long (e.g. full questions) or your data columns are too wide for single numeric inputs, override the defaults:

```
custom-table-grid(
  rows=5, cols=4,
  row_labels="Total revenue, Operating expenses, Net income, Headcount, Capex",
  col_labels="Q1, Q2, Q3, Q4",
  row_label_width="40%",     // make the question column wider
  data_column_width="15%"    // and each data column narrower
)
```

For full per-column control (e.g. one wide notes column among narrow numeric columns), use `column_widths`:

```
custom-table-grid(
  rows=3, cols=4,
  col_labels="Q1, Q2, Notes, Q4",
  column_widths="2|1|1|3|1"   // proportional shares: row-labels 2, Q1 1, Q2 1, Notes 3, Q4 1
)
```

#### Example Usage

**Basic table with validation:**
```
custom-table-grid(
  rows=3, 
  cols=4, 
  col_labels="Q1, Q2, Q3, Q4",
  row_labels="Revenue, Expenses, Profit",
  min_value=0,
  max_value=1000000,
  format_numbers='true',
  validation_strict='false',
  constraint_message_min="Please enter at least {min}",
  constraint_message_min_soft="Consider values above {min}"
)
```

**Advanced table with historical data:**
```
custom-table-grid(
  rows=3, 
  cols=4, 
  col_labels="Q1, Q2, Q3, Q4",
  row_labels="Revenue, Expenses, Profit",
  show_historical='true',
  historical_data="100,200,150,300|50,75,60,120|50,125,90,180",
  historical_display='top',
  format_numbers='true',
  total='row',
  min_value=0,
  allow_decimals='false',
  required=1
)
```

**Note**: When using comma-separated labels, avoid using commas within the label text itself. For historical data, use the same row|column structure as the main data format.

#### Pre-loading historical data from form fields

`historical_data` is a single string parsed as `row1col1,row1col2,...|row2col1,row2col2,...`. SurveyCTO substitutes any `${field}` references **once**, before the plug-in loads, so the matrix has to arrive as a fully assembled string.

**Always assemble the matrix in a `calculate` field with `concat()` and pass that field in.** Inlining `${...}` references directly inside the `historical_data` value is fragile: empty values, commas inside referenced values (e.g. thousands separators like `"1,234"`), or extra whitespace from the form engine will silently misalign the rows.

XLSForm example — survey sheet:

| type | name | calculation |
| --- | --- | --- |
| calculate | hist_q1 | `instance('last_year')/root/item[id=${id}]/q1` |
| calculate | hist_q2 | `instance('last_year')/root/item[id=${id}]/q2` |
| calculate | hist_q3 | `instance('last_year')/root/item[id=${id}]/q3` |
| calculate | hist_q4 | `instance('last_year')/root/item[id=${id}]/q4` |
| calculate | hist_matrix | `concat(${hist_q1},",",${hist_q2},",",${hist_q3},",",${hist_q4})` |

Then in the table-grid field's `parameters`:

```
custom-table-grid(
  rows=1,
  cols=4,
  col_labels="Q1, Q2, Q3, Q4",
  show_historical='true',
  historical_data=${hist_matrix}
)
```

For multi-row tables, build one `concat()` per row and join them with `"|"`:

```
calculate hist_matrix = concat(
  ${hist_revenue_q1},",",${hist_revenue_q2},",",${hist_revenue_q3},",",${hist_revenue_q4},
  "|",
  ${hist_expenses_q1},",",${hist_expenses_q2},",",${hist_expenses_q3},",",${hist_expenses_q4}
)
```

**JSON alternative.** If your historical values themselves contain commas (e.g. pre-formatted currency strings), pass the matrix as a JSON 2D array instead — the plug-in detects a leading `[` and parses accordingly:

```
historical_data='[["1,234","2,500"],["900","1,100"]]'
```

## More resources

* **Sample form**  
You can find some sample form definitions in here:[extras/sample-form](https://github.com/surveycto/table-grid/tree/master/extras/sample-form)  

* **Developer documentation**  
Instructions and resources for developing your own field plug-ins.  
[https://github.com/surveycto/Field-plug-in-resources](https://github.com/surveycto/Field-plug-in-resources)

* **User documentation**  
How to get started using field plug-ins in your SurveyCTO form.  
[https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html](https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html)
