# Table grid

![Default appearance for the 'table-grid' field plug-in](extras/tablegrid.png)

## Description

This field plug-in supports the creation of a table for data input in SurveyCTO forms. While this has been a SurveyCTO limitation so far, it is possible to address this request through the creation of a [Repeat Group](https://docs.surveycto.com/02-designing-forms/01-core-concepts/06.groups.html) with [table appearance](https://www.surveycto.com/videos/paper-to-digital-tables/), which displays the data collected in a table. This field plug-in, however, allows you to create the real grid appearance and edit data directly from the table.

[![Download now](extras/download-button.png)](https://github.com/surveycto/table-grid/raw/master/table-grid.fieldplugin.zip)

This plug-in is currently under beta. If you you find a problem with the field plug-in, please email support@surveycto.com.

### Features

1. Define number of rows and columns in the table.
1. Define the labels for the rows and columns in the table.
1. Use the `numbers` appearance for numeric input.
1. Use **dynamic references** in the headings for rows and columns. 

### Data format

This field plug-in requires the `text` field type.
The data is stored in a pipe <code> (&#124;)</code> separated list of items such as: 

`1|2|3|4|5|6|7|8|9|0|`

For example, if you have the following table: 

| | A | B |
| --- | --- | --- |
| 1 | A1 | B1 |
| 2 | A2 | B2 |

The data will be stored as:

`A1|B1|A2|B2|`

You can use any of the functions in the *Working with lists of items* section of our documentation on [Using expressions in your forms: a reference for all operators and functions](https://docs.surveycto.com/02-designing-forms/01-core-concepts/09.expressions.html). Specifically, the [item-at() function](https://docs.surveycto.com/02-designing-forms/01-core-concepts/09.expressions.html#Help_Forms_item-at) will allow you to retrieve items from the saved value.  

**Note**: Because the responses are separates by a pipe <code> (&#124;)</code> make sure there are no pipes <code> (&#124;)</code> in any of the actual text in the responses. 


## How to use

### Getting started


### Default SurveyCTO feature support

| Feature / Property | Support |
| --- | --- |
| Supported field type(s) | `text`|
| Default values | No |
| Constraint message | Uses default behavior |
| Required message | Uses default behavior |
| Read only | Yes *(shows the current value, if present)* |
| media:image | No |
| media:audio | No |
| media:video | No |
| `numbers` appearance | Yes |

### Parameters

The following parameters are required for this field plug-in:

| Parameter key | Parameter value |
| --- | --- |
| `columns` | The number of columns to be displayed. |
| `rows` | The number of rows to be displayed. |
| `column_headers` | The headings for each column separated by a pipe <code> (&#124;)</code>. |
| `row_headers`| The headings for each row separated by a pipe <code> (&#124;)</code>.|
| `required` (optional)| Indicates whether some or all the cells in the table should have a value. When set to `1` all the the `cells` in the table should have a value. Default is `0`.|

**Note**: Because the headings are separates by a pipe <code> (&#124;)</code> make sure there are no pipes <code> (&#124;)</code> in any of the text in the headers. 

## More resources

* **Sample form**  
This form will help you explore the differences between this field plug-in and the default text field.  
[Download Sample form package](https://github.com/surveycto/baseline-text/raw/master/extras/test-form/test-form-package.zip)  

* **Developer documentation**  
Instructions and resources for developing your own field plug-ins.  
[https://github.com/surveycto/Field-plug-in-resources](https://github.com/surveycto/Field-plug-in-resources)

* **User documentation**  
How to get started using field plug-ins in your SurveyCTO form.  
[https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html](https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html)
