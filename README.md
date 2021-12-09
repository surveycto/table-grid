# Table grid

![Default appearance for the 'table-grid' field plug-in](extras/tablegrid.png)

## Description

This field plug-in allows for spreadsheet like table data input. Instead of a repeat group using the 'table' appearance option, a table with columns adjacent to one another (unlike what is allowed with fields normally) is displayed.

[![Download now](extras/download-button.png)](https://github.com/surveycto/table-grid/raw/master/table-grid.fieldplugin.zip)

This plug-in is currently under beta. If you you find a problem with the field plug-in, please email support@surveycto.com.

### Features

1. Define number of rows and columns in the table.
1. Define the labels for the rows and columns in the table.

### Data format

This field plug-in requires the `text` field type.
The data is stored in a pipe separated list of items such as: 

`1|2|3|4|5|6|7|8|9|0|`

For example, if you have the following table: 

| | A | B |
| --- | --- | --- |
| 1 | A1 | B1 |
| 2 | A2 | B2 |

The data will be stored as:

`A1|B1|A2|B2|`

You can use any of the functions in the *Working with lists of items* section of our documentation on [Using expressions in your forms: a reference for all operators and functions](https://docs.surveycto.com/02-designing-forms/01-core-concepts/09.expressions.html). Specifically, the [item-at() function](https://docs.surveycto.com/02-designing-forms/01-core-concepts/09.expressions.html#Help_Forms_item-at) will allow you to retrieve items from the saved value.  


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

| Parameter key | Parameter value |
| --- | --- |
| `columns` | The number of columns to be displayed. |
| `rows` | The number of rows to be displayed. |
| `column_headers` | The headings for each column separated by a pipe <code> (&#124;)</code>. |
| `row_headers`| The headings for each row separated by a pipe <code> (&#124;)</code>.|

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
