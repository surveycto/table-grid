/* global fieldProperties, setAnswer, getPluginParameter */

// Detect platform
var isWebCollect = (document.body.className.indexOf('web-collect') >= 0)
var isAndroid = (document.body.className.indexOf('android-collect') >= 0)
var isIOS = (document.body.className.indexOf('ios-collect') >= 0)

// Get parameters
var numberColumns = getPluginParameter('x')
var numberRows = getPluginParameter('y')
var columnHeaders = getPluginParameter('x_label')
var rowHeaders = getPluginParameter('y_label')

var div = document.getElementById('table-holder') // General div to house the grid.

// // Find the input element
// var input = document.getElementById('text-field')

// // Restricts input for the given textbox to the given inputFilter.
// function setInputFilter (textbox, inputFilter) {
//   function restrictInput () {
//     if (inputFilter(this.value)) {
//       this.oldSelectionStart = this.selectionStart
//       this.oldSelectionEnd = this.selectionEnd
//       this.oldValue = this.value
//     } else if (this.hasOwnProperty('oldValue')) {
//       this.value = this.oldValue
//       this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd)
//     } else {
//       this.value = ''
//     }
//   }

//   // Apply restriction when typing, copying/pasting, dragging-and-dropping, etc.
//   textbox.addEventListener('input', restrictInput)
//   textbox.addEventListener('keydown', restrictInput)
//   textbox.addEventListener('keyup', restrictInput)
//   textbox.addEventListener('mousedown', restrictInput)
//   textbox.addEventListener('mousedown', restrictInput)
//   textbox.addEventListener('contextmenu', restrictInput)
//   textbox.addEventListener('drop', restrictInput)
// }

// // If the field label or hint contain any HTML that isn't in the form definition, then the < and > characters will have been replaced by their HTML character entities, and the HTML won't render. We need to turn those HTML entities back to actual < and > characters so that the HTML renders properly. This will allow you to render HTML from field references in your field label or hint.
// function unEntity (str) {
//   return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
// }
// if (fieldProperties.LABEL) {
//   document.querySelector('.label').innerHTML = unEntity(fieldProperties.LABEL)
// }
// if (fieldProperties.HINT) {
//   document.querySelector('.hint').innerHTML = unEntity(fieldProperties.HINT)
// }

// // Define what happens when the user attempts to clear the response
// function clearAnswer () {
//   input.value = ''
// }

// // If the field is not marked readonly, then focus on the field and show the on-screen keyboard (for mobile devices)
// function setFocus () {
//   if (!fieldProperties.READONLY) {
//     input.focus()
//     if (window.showSoftKeyboard) {
//       window.showSoftKeyboard()
//     }
//   }
// }

// // Save the user's response (update the current answer)
// input.oninput = function () {
//   setAnswer(input.value)
// }

// // check for standard appearance options and apply them
// if (fieldProperties.APPEARANCE.includes('numbers_phone') === true) {
//   input.type = 'tel'
// } else if (fieldProperties.APPEARANCE.includes('numbers_decimal') === true) {
//   input.pattern = '[0-9]*'

//   // Set/remove the 'inputmode'.
//   function setInputMode (attributeValue) {
//     if (attributeValue === null) {
//       input.removeAttribute('inputmode')
//     } else {
//       input.setAttribute('inputmode', attributeValue)
//     }
//   }

//   setInputMode('numeric')

//   // For iOS, we'll default the inputmode to 'numeric' (as defined above), unless some specific value is
//   // passed as plug-in parameter.
//   if (isIOS) {
//     var inputModeIOS = getPluginParameter('inputmode-ios')
//     if (inputModeIOS !== undefined) {
//       setInputMode(inputModeIOS)
//     }
//   } else if (isAndroid) {
//     // For Android, we'll default the inputmode to 'numeric' (as defined above),
//     // unless some specific value is passed as plug-in parameter.
//     var inputModeAndroid = getPluginParameter('inputmode-android')
//     if (inputModeAndroid !== undefined) {
//       setInputMode(inputModeAndroid)
//     }
//   } else if (isWebCollect) {
//     // For WebCollect, we'll default the inputmode to 'numeric' (as defined above),
//     // unless some specific value is passed as plug-in parameter.
//     var inputModeWebCollect = getPluginParameter('inputmode-web')
//     if (inputModeWebCollect !== undefined) {
//       setInputMode(inputModeWebCollect)
//     }
//   }

//   // If the field is not marked as readonly, then restrict input to decimal only.
//   if (!fieldProperties.READONLY) {
//     setInputFilter(input, function (value) {
//       return /^-?\d*[.,]?\d*$/.test(value)
//     })
//   }
// } else if (fieldProperties.APPEARANCE.includes('numbers') === true) {
//   input.type = 'number'
// }

// New changes for table-grid

numberRows = parseInt(numberRows) + 1
numberColumns = parseInt(numberColumns)
var rowHeadersArray = rowHeaders.split('|')
var columnHeadersArray = columnHeaders.split('|')

var table = '<table id="gridTable" class="gridTable">'
for (var i = 0; i < numberRows; i++) {
  if (i > 0) {
    table += '<tr>'
    var rowHeader = rowHeadersArray[i - 1]
    table += '<th scope="row">' + rowHeader + '</th>'
  } else {
    table += '<th scope="col">' + 'ROW 1' + '</th>'
  }
  for (var j = 0; j < numberColumns; j++) {
    if (i === 0) {
      // table += '<thead>'
      var headerText = columnHeadersArray[j]
      var hId = '<th scope="col">' + headerText + '</th>'
      table += hId
    } else {
      var td = '<td contenteditable="true" class="cell">'
      table += td
      table += 'Cell ' + j
      table += '</td>'
    }
  }
  table += '</tr>'
  if (i === 0) {
    table += '</thead>'
  }
}
table += '</table>'
div.innerHTML = table // Add the row to main container.

var getTable = document.getElementById('gridTable')
var cells = getTable.getElementsByTagName('td')
var cells1 = document.querySelectorAll('.cell')
var cellsLength = cells.length
// var cellValues = ''

for (var p = 0; p < cellsLength; p++) {
  var cell = cells1[p]
  cell.addEventListener('input', (e) => {
    console.log(getValues())
    setAnswer(getValues())
  })
  // cell.addEventListener('input', cell, false)
}

function getValues () {
  var cellValues = ''
  for (var q = 0; q < cellsLength; q++) {
    cellValues = cellValues + cells[q].innerHTML + '|'
    // cellValues.push(cells[q])
    // cells[q].onclick = function () {
    //   console.log(this.innerHTML)
    // }
  }
  // console.log(cellValues)
  return cellValues
}
