/* global fieldProperties, setAnswer, getPluginParameter */

// Detect platform
var isWebCollect = (document.body.className.indexOf('web-collect') >= 0)
var isAndroid = (document.body.className.indexOf('android-collect') >= 0)
var isIOS = (document.body.className.indexOf('ios-collect') >= 0)

// Get parameters
var numberColumns = getPluginParameter('columns')
var numberRows = getPluginParameter('rows')
var columnHeaders = getPluginParameter('column_headers')
var rowHeaders = getPluginParameter('row_headers')
var required = parseInt(getPluginParameter('required')) // Change to integer for ease of comparing.
// var field_type = getPluginParameter('data_type')

var prevAnswer = fieldProperties.CURRENT_ANSWER // Get previous answer.
var fieldAppearance = fieldProperties.APPEARANCE // Get appearance.

var div = document.getElementById('table-holder') // General div to house the grid.

// Check if there was a previous answer so they can be loaded into table.
if (prevAnswer != null) {
  prevAnswerArray = prevAnswer.split('|') // Create array of previous responses.
}

// New changes for table-grid

// If using the numbers appearance, show number input field otherwise text. 
if (fieldAppearance.includes('numbers')) {
  fieldAppearance = 'number'
} else {
  fieldAppearance = 'text'
}

numberRows = parseInt(numberRows) + 1 
numberColumns = parseInt(numberColumns)
var rowHeadersArray = rowHeaders.split('|')
var columnHeadersArray = columnHeaders.split('|')

var table = '<table id="gridTable" class="gridTable">'
for (var i = 0; i < numberRows; i++) {
  if (i > 0) {
    table += '<tr>'
    var rowHeader = rowHeadersArray[i - 1]
    table += '<th scope="row" style ="width:auto" class="default-hint-text-size" dir="auto">' + rowHeader + '</th>'
  } else {
    table += '<th scope="col" class="default-hint-text-size">' + '' + '</th>'
  }
  for (var j = 0; j < numberColumns; j++) {
    if (i === 0) {
      // table += '<thead>'
      var headerText = columnHeadersArray[j]
      var hId = '<th scope="col" class="default-hint-text-size" dir="auto">' + headerText + '</th>'
      table += hId
    } else {
      if (required === 1) {
        var td = '<td><input type="' +  fieldAppearance + '"' + ' class="cell default-hint-text-size" dir="auto" required>'
      } else {
        var td = '<td><input type="' +  fieldAppearance + '"' + ' class="cell default-hint-text-size" dir="auto">'
      }
      
      table += td
      table += '</input></td>'
    }
  }
  table += '</tr>'
  if (i === 0) {
    table += '</thead>'
  }
}
table += '</table>'
div.innerHTML = table // Add the row to main container.

var getTable = document.getElementById('gridTable') // Access the table element
var cells = getTable.getElementsByTagName('input') // Array of all input elements
var cellsLength = cells.length // Length of array of elements

if (prevAnswer != null) {
  for (var t = 0; t < prevAnswerArray.length - 1; t++) {
     cells[t].value = prevAnswerArray[t]
  }
}

for (var p = 0; p < cellsLength; p++) {
  var cell = cells[p]
  cell.addEventListener('input', getValues)
}

function getValues (e) {
  var cellValues = ''
  for (var q = 0; q < cellsLength; q++) {
    var cell = cells[q]
    var cellvalue = cell.value
    cellValues = cellValues + cellvalue + '|'
  }
  if (required === 1) {
    checkAllRequired (cellValues)
  } else {
    setAnswer(cellValues)
  }
  return cellValues
}

// Checks whether all the cells have values
function checkAllRequired(cellValues) {
  var tempArray = cellValues.split('|') // Creates an array based on current entered values.
  var tempArray2 = tempArray.pop() // CLEAN UP: Removes extra last item in the array.
  if(tempArray.includes('')) { // Checks if the array has an empty value.
    setAnswer('') // Sets the answer to null if the array has an empty value, ensuring you can't progress forward. 
  } else {
    setAnswer(cellValues) // Sets answer when all cells are entered. 
  }
}