# Table grid

![Default appearance for the 'table-grid' field plug-in](extras/preview.jpg)

## Description

This field plug-in allows for spreadsheet like table data input. Instead of a repeat group using the 'table' appearance option, a table with columns adjacent to one another (unlike what is allowed with fields normally) is displayed.

[![Download now](extras/download-button.png)](https://github.com/surveycto/baseline-text/raw/master/baseline-text.fieldplugin.zip)

This plug-in is currently under beta. If you you find a problem with the field plug-in, please email support@surveycto.com.

### Features

1. Define number of rows and columns in the table.
1. Define the labels for the rows and columns in the table.

### Data format

This field plug-in requires the `text` field type.
The data is stored in a pipe separated list of items such as: 
`1|2|3|4|5|6|7|8|9|0|`


## How to use

### Getting started


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
| `numbers_decimal` appearance | Yes |
| `numbers_phone` appearance | Yes |

### Parameters

| Parameter key | Parameter value |
| --- | --- |
| `columns` | The number of columns you want. |
| `rows` | The number of rows you want. |
| `column_headers` | The headings for each column separated by a pipe (`|`). |
| `row_headers`| The headings for each row separated by a pipe (`|`).|

## More resources

* **Test form**  
This form will help you explore the differences between this field plug-in and the default text field.  
[Download test form package](https://github.com/surveycto/baseline-text/raw/master/extras/test-form/test-form-package.zip)  
[Instructions for test form](/extras/test-form/README.md)

* **Developer documentation**  
Instructions and resources for developing your own field plug-ins.  
[https://github.com/surveycto/Field-plug-in-resources](https://github.com/surveycto/Field-plug-in-resources)

* **User documentation**  
How to get started using field plug-ins in your SurveyCTO form.  
[https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html](https://docs.surveycto.com/02-designing-forms/03-advanced-topics/06.using-field-plug-ins.html)
