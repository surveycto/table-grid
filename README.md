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
1. **Number formatting** - Automatic comma formatting for large numbers.
1. **Input validation** - Set minimum/maximum values and decimal restrictions.
1. **Automatic totals** - Calculate row or column totals in real-time.
1. **Enhanced accessibility** - Full keyboard navigation and screen reader support.

### Data format

This field plug-in requires the `text` field type.
The data is stored in a pipe <code> (|)</code> separated list of items such as: 

`1|2|3|4|5|6|7|8|9|0|`

For example, if you have the following table: 

| | A | B |
| --- | --- | --- |
| 1 | A1 | B1 |
| 2 | A2 | B2 |

The data will be stored as:

`A1|B1|A2|B2|`

You can use any of the functions in the *Working with lists of items* section of our documentation on [Using expressions in your forms: a reference for all operators and functions](https://docs.surveycto.com/02-designing-forms/01-core-concepts/09.expressions.html). Specifically, the [item-at() function](https://docs.surveycto.com/02-designing-forms/01-core-concepts/09.expressions.html#Help_Forms_item-at) will allow you to retrieve items from the saved value.  

**Note**: Because the responses are separated by a pipe <code> (|)</code> make sure there are no pipes <code> (|)</code> in any of the actual text in the responses. 

## How to use

### Getting started

**To use this plug-in as-is**, just download the [table-grid.fieldplugin.zip](https://github.com/surveycto/table-grid/raw/master/table-grid.fieldplugin.zip) file from this repo, specify this field plug-in as a custom field *appearance* in the form design (like in the [sample forms](https://github.com/surveycto/table-grid/tree/master/extras/sample-form)), and attach it to your form. For more details about using field plug-ins, please read the [user documentation](https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html).

**To create your own** field plug-in using this as a template, follow these steps:

1. Fork this repo
1. Make changes to the files in the `source` directory.  
    * **Note:** be sure to update the `manifest.json` file as well.
1. Zip the updated contents of the `source` directory.
1. Rename the .zip file to *yourpluginname*.fieldplugin.zip (replace *yourpluginname* with the name you want to use for your plug-in).
1. You may then attach your new .fieldplugin.zip file to your form as normal.

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

#### Basic Parameters (Legacy Support)

The following parameters maintain compatibility with existing forms:

| Parameter key | Parameter value |
| --- | --- |
| `columns` or `cols` | The number of columns to be displayed. |
| `rows` | The number of rows to be displayed. |
| `column_headers` or `col_labels` | The headings for each column. Use comma-separated format: `"Header 1, Header 2, Header 3"` or legacy pipe-separated format: `"Header 1|Header 2|Header 3"` |
| `row_headers` or `row_labels`| The headings for each row. Use comma-separated format: `"Row 1, Row 2, Row 3"` or legacy pipe-separated format: `"Row 1|Row 2|Row 3"` |
| `required` (optional)| Indicates whether some or all the cells in the table should have a value. When set to `1` all the cells in the table should have a value. Default is `0`.|

#### Enhanced Parameters

The following parameters enable advanced features:

| Parameter key | Parameter value |
| --- | --- |
| `show_historical` | Set to `true` to display historical data alongside current inputs. Default is `false`. |
| `historical_data` | Historical data in the same format as the main data: `"A1,B1|A2,B2"` for a 2x2 table. |
| `historical_display` | How to display historical data: `inline` (default), `columns`, or `toggle`. |
| `historical_label` | Label for historical data. Default is `"Last Year"`. |
| `total` | Calculate totals: `row` for row totals, `column` for column totals. |
| `format_numbers` | Set to `true` to format numbers with comma separators. Default is `false`. |
| `min_value` | Minimum allowed value for numeric inputs. |
| `max_value` | Maximum allowed value for numeric inputs. |
| `allow_decimals` | Set to `false` to restrict inputs to whole numbers only. Default is `true`. |
| `validation_strict` | Set to `true` to prevent form progression when validation fails. Default is `false` (soft validation). |

#### Historical Data Display Modes

- **`inline`**: Historical values appear above input fields in each cell
- **`columns`**: Historical data appears in separate columns next to current data columns  
- **`toggle`**: Users can toggle between viewing historical data and current inputs

#### Example Usage

```
custom-table-grid(
  rows=3, 
  cols=4, 
  col_labels="Q1, Q2, Q3, Q4",
  row_labels="Revenue, Expenses, Profit",
  show_historical=true,
  historical_data="100,200,150,300|50,75,60,120|50,125,90,180",
  historical_display=inline,
  format_numbers=true,
  total=row,
  min_value=0,
  required=1
)
```

**Note**: When using comma-separated labels, avoid using commas within the label text itself. For historical data, use the same row|column structure as the main data format.

## More resources

* **Sample form**  
You can find some sample form definitions in here:[extras/sample-form](https://github.com/surveycto/table-grid/tree/master/extras/sample-form)  

* **Developer documentation**  
Instructions and resources for developing your own field plug-ins.  
[https://github.com/surveycto/Field-plug-in-resources](https://github.com/surveycto/Field-plug-in-resources)

* **User documentation**  
How to get started using field plug-ins in your SurveyCTO form.  
[https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html](https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html)
