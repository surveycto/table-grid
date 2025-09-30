/* global fieldProperties, setAnswer, getPluginParameter */

// Enhanced Table Grid Field Plugin with Historical Data Support
// Version 2.0.0

// ====================
// DEBUG MODE
// ====================

// Set to true for development debugging
var DEBUG_MODE = false

// Debug logging function
function debugLog() {
  if (DEBUG_MODE && console && console.log) {
    console.log.apply(console, arguments)
  }
}

// ====================
// PLATFORM DETECTION
// ====================

// Detect platform for platform-specific behaviors
var isWebCollect = (document.body.className.indexOf('web-collect') >= 0)
var isAndroid = (document.body.className.indexOf('android-collect') >= 0)
var isIOS = (document.body.className.indexOf('ios-collect') >= 0)

debugLog('Platform detection:', {
  isWebCollect: isWebCollect,
  isAndroid: isAndroid,
  isIOS: isIOS
})

// ====================
// PARAMETER PARSING FUNCTIONS
// ====================

function safeGetPluginParameter(name, defaultValue) {
  defaultValue = defaultValue !== undefined ? defaultValue : null
  try {
    var value = getPluginParameter(name)

    if (value === null || value === undefined) {
      debugLog('Parameter \'' + name + '\': null/undefined, using default:', defaultValue)
      return defaultValue
    }

    // Remove quotes if present
    if (typeof value === 'string') {
      value = value.replace(/^['"]|['"]$/g, '')
    }

    debugLog('Parameter \'' + name + '\':', value)
    return value
  } catch (error) {
    debugLog('Failed to get parameter \'' + name + '\':', error)
    return defaultValue
  }
}

function getTableParameters() {
  debugLog('=== PARAMETER PARSING DEBUG ===')

  var rawParams = {
    rows: safeGetPluginParameter('rows', '3'),
    cols: safeGetPluginParameter('cols', '4'),
    row_labels: safeGetPluginParameter('row_labels', ''),
    col_labels: safeGetPluginParameter('col_labels', ''),
    show_historical: safeGetPluginParameter('show_historical', 'false'),
    historical_data: safeGetPluginParameter('historical_data', ''),
    historical_display: safeGetPluginParameter('historical_display', 'inline'),
    total: safeGetPluginParameter('total', ''),
    format_numbers: safeGetPluginParameter('format_numbers', 'false'),
    min_value: safeGetPluginParameter('min_value', ''),
    max_value: safeGetPluginParameter('max_value', ''),
    allow_decimals: safeGetPluginParameter('allow_decimals', 'true'),
    validation_strict: safeGetPluginParameter('validation_strict', 'false')
  }

  debugLog('Raw parameters:', rawParams)

  var params = {
    rows: Math.max(1, parseInt(rawParams.rows)),
    cols: Math.max(1, parseInt(rawParams.cols)),
    rowLabels: parseLabels(rawParams.row_labels),
    colLabels: parseLabels(rawParams.col_labels),
    showHistorical: rawParams.show_historical === 'true',
    historicalData: parseHistoricalData(rawParams.historical_data),
    historicalDisplay: rawParams.historical_display || 'inline',
    historicalLabel: safeGetPluginParameter('historical_label', 'Last Year'),
    numbersAppearance: fieldProperties.APPEARANCE && fieldProperties.APPEARANCE.includes('numbers'),

    // SIMPLIFIED: Only plugin's required parameter (let SurveyCTO handle native required)
    required: parseInt(safeGetPluginParameter('required', '0')), // Keep as 0 or 1, not boolean

    total: rawParams.total,
    formatNumbers: rawParams.format_numbers === 'true',
    minValue: rawParams.min_value !== '' ? parseFloat(rawParams.min_value) : null,
    maxValue: rawParams.max_value !== '' ? parseFloat(rawParams.max_value) : null,
    allowDecimals: rawParams.allow_decimals === 'true',
    validationStrict: rawParams.validation_strict === 'true',

    // Constraint message parameters
    constraintMessageMin: safeGetPluginParameter('constraint_message_min', 'Value must be at least {min}'),
    constraintMessageMax: safeGetPluginParameter('constraint_message_max', 'Value must be at most {max}'),
    constraintMessageDecimals: safeGetPluginParameter('constraint_message_decimals', 'Decimal numbers are not allowed'),
    constraintMessageInvalid: safeGetPluginParameter('constraint_message_invalid', 'Please enter a valid number'),

    // Soft validation messages
    constraintMessageMinSoft: safeGetPluginParameter('constraint_message_min_soft', 'Recommended minimum: {min}'),
    constraintMessageMaxSoft: safeGetPluginParameter('constraint_message_max_soft', 'Recommended maximum: {max}'),
    constraintMessageDecimalsSoft: safeGetPluginParameter('constraint_message_decimals_soft', 'Whole numbers preferred'),
    constraintMessageInvalidSoft: safeGetPluginParameter('constraint_message_invalid_soft', 'Please check this number')
  }

  debugLog('Processed parameters:', params)
  debugLog('=== END PARAMETER DEBUG ===')

  return params
}

function parseLabels(labelString) {
  if (!labelString) return []

  // Remove surrounding quotes if present
  var cleanString = labelString.replace(/^['"]|['"]$/g, '')
  debugLog('Parsing labels - original:', labelString, 'cleaned:', cleanString)

  if (!cleanString) return []
  return cleanString.split(',').map(function (s) { return s.trim() }).filter(function (s) { return s.length > 0 })
}

function parseHistoricalData(dataString) {
  debugLog('Raw historical data parameter:', dataString)

  if (!dataString) return null

  // Remove surrounding quotes if present
  var cleanString = dataString.replace(/^['"]|['"]$/g, '')
  debugLog('Cleaned historical data:', cleanString)

  if (!cleanString.trim()) return null

  try {
    var result = cleanString.split('|').map(function (row) {
      return row.split(',').map(function (cell) { return cell.trim() })
    })
    debugLog('Parsed historical data result:', result)
    return result
  } catch (error) {
    debugLog('Invalid historical data format:', error)
    return null
  }
}

// ====================
// UNIFIED PARAMETER HANDLING
// ====================

/**
 * Gets a parameter with multiple possible names (for backward compatibility)
 * @param {string[]} paramNames - Array of parameter names to try (in order of preference)
 * @param {string} defaultValue - Default value if none found
 * @returns {string} Parameter value or default
 */
function getUnifiedParameter(paramNames, defaultValue) {
  defaultValue = defaultValue !== undefined ? defaultValue : ''
  for (var i = 0; i < paramNames.length; i++) {
    var value = safeGetPluginParameter(paramNames[i])
    if (value !== null && value !== undefined) {
      return value
    }
  }
  return defaultValue
}

/**
 * Determines if we should use enhanced mode based on available parameters
 * @returns {boolean} True if enhanced mode should be used
 */
function shouldUseEnhancedMode() {
  // Check for any enhanced-specific parameters
  var enhancedParams = [
    'show_historical', 'historical_data', 'historical_display', 'historical_label',
    'total', 'format_numbers', 'min_value', 'max_value', 'allow_decimals', 'validation_strict',
    'col_labels', 'row_labels' // New comma-separated format
  ]

  for (var i = 0; i < enhancedParams.length; i++) {
    var value = safeGetPluginParameter(enhancedParams[i])
    if (value !== null && value !== undefined && value !== '') {
      return true
    }
  }

  return false
}

// Unified parameter extraction - works for both modes
var unifiedParams = {
  // Core parameters (with backward compatibility)
  cols: parseInt(getUnifiedParameter(['cols', 'columns'], '4')),
  rows: parseInt(getUnifiedParameter(['rows'], '3')),
  colLabels: getUnifiedParameter(['col_labels', 'column_headers'], ''),
  rowLabels: getUnifiedParameter(['row_labels', 'row_headers'], ''),
  required: parseInt(getUnifiedParameter(['required'], '0')),

  // Enhanced parameters
  showHistorical: getUnifiedParameter(['show_historical'], 'false') === 'true',
  historicalData: getUnifiedParameter(['historical_data'], ''),
  historicalDisplay: getUnifiedParameter(['historical_display'], 'inline'),
  historicalLabel: getUnifiedParameter(['historical_label'], 'Last Year'),
  total: getUnifiedParameter(['total'], ''),
  formatNumbers: getUnifiedParameter(['format_numbers'], 'false') === 'true',
  minValue: getUnifiedParameter(['min_value'], ''),
  maxValue: getUnifiedParameter(['max_value'], ''),
  allowDecimals: getUnifiedParameter(['allow_decimals'], 'true') === 'true',
  validationStrict: getUnifiedParameter(['validation_strict'], 'false') === 'true'
}

// Legacy variable names for backward compatibility (kept for existing code)
var numberColumns = unifiedParams.cols
var numberRows = unifiedParams.rows
var columnHeaders = unifiedParams.colLabels
var rowHeaders = unifiedParams.rowLabels
var required = unifiedParams.required

// ====================
// NUMBER FORMATTING UTILITIES
// ====================

function formatNumber(value, shouldFormat) {
  if (!shouldFormat || !value || value === '' || isNaN(value)) {
    return value
  }

  var num = parseFloat(value)
  if (isNaN(num)) return value

  // Format with commas for thousands separator
  return num.toLocaleString('en-US', {
    maximumFractionDigits: 10, // Preserve decimal places
    useGrouping: true // Ensure grouping is enabled
  })
}

function unformatNumber(formattedValue) {
  if (!formattedValue) return ''
  // Remove commas and other formatting, but preserve the number
  var cleaned = formattedValue.toString().replace(/,/g, '').replace(/\s/g, '')
  return cleaned
}

function filterDecimalInput(value, allowDecimals) {
  if (allowDecimals || !value) return value
  // Disallow decimals: remove a dot and everything after it (keep grouping commas)
  return value.replace(/\..*$/, '')
}

// ====================
// INPUT VALIDATION UTILITIES
// ====================

/**
 * Debounce utility to limit function execution frequency
 * Improves performance by reducing validation calls during rapid input
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  var timeout
  return function () {
    var context = this
    var args = arguments
    clearTimeout(timeout)
    timeout = setTimeout(function () {
      func.apply(context, args)
    }, wait)
  }
}

function validateNumericInput(value, params, useSoftMessages) {
  useSoftMessages = useSoftMessages || false
  if (!value || value === '') return { valid: true, message: '' }

  var unformattedValue = params.formatNumbers ? unformatNumber(value) : value
  var num = parseFloat(unformattedValue)

  if (isNaN(num)) {
    return {
      valid: false,
      message: useSoftMessages ? params.constraintMessageInvalidSoft : params.constraintMessageInvalid
    }
  }

  // Check decimal restriction
  if (!params.allowDecimals && (unformattedValue.includes('.') || unformattedValue.includes(','))) {
    return {
      valid: false,
      message: useSoftMessages ? params.constraintMessageDecimalsSoft : params.constraintMessageDecimals
    }
  }

  // Check range constraints with custom messages
  if (params.minValue !== null && num < params.minValue) {
    var message = useSoftMessages ? params.constraintMessageMinSoft : params.constraintMessageMin
    var formattedMin = params.formatNumbers ? formatNumber(params.minValue, true) : params.minValue
    return {
      valid: false,
      message: message.replace('{min}', formattedMin)
    }
  }

  if (params.maxValue !== null && num > params.maxValue) {
    var message = useSoftMessages ? params.constraintMessageMaxSoft : params.constraintMessageMax
    var formattedMax = params.formatNumbers ? formatNumber(params.maxValue, true) : params.maxValue
    return {
      valid: false,
      message: message.replace('{max}', formattedMax)
    }
  }

  return { valid: true, message: '' }
}

function validateAllInputs(params, useSoftMessages) {
  useSoftMessages = useSoftMessages || false
  var inputs = document.querySelectorAll('.cell-input')
  var allValid = true
  var invalidCount = 0
  var invalidInputs = []

  for (var i = 0; i < inputs.length; i++) {
    var input = inputs[i]
    if (input.value) {
      var validation = validateNumericInput(input.value, params, useSoftMessages)
      if (!validation.valid) {
        allValid = false
        invalidCount++
        invalidInputs.push({
          input: input,
          message: validation.message,
          row: input.getAttribute('data-row'),
          col: input.getAttribute('data-col')
        })
        showValidationMessage(input, validation.message, false, useSoftMessages)
      } else {
        showValidationMessage(input, '', true, useSoftMessages)
      }
    } else {
      // Empty values are valid for non-required fields
      showValidationMessage(input, '', true, useSoftMessages)
    }
  }

  return {
    valid: allValid,
    invalidCount: invalidCount,
    invalidInputs: invalidInputs
  }
}

function showValidationMessage(input, message, isValid, isSoft) {
  isSoft = isSoft || false
  if (!input || !input.parentNode) {
    debugLog('Invalid input element for validation message')
    return
  }

  // Remove existing validation message
  var existingMessage = input.parentNode.querySelector('.validation-message')
  if (existingMessage) {
    existingMessage.remove()
  }

  // Update input styling
  if (isValid) {
    input.classList.remove('invalid-input')
    input.classList.remove('soft-invalid')
  } else {
    input.classList.add('invalid-input')

    // Add or remove soft-invalid class based on validation type
    if (isSoft) {
      input.classList.add('soft-invalid')
    } else {
      input.classList.remove('soft-invalid')
    }

    if (message) {
      // Create validation message
      var messageDiv = document.createElement('div')
      messageDiv.className = 'validation-message'

      if (isSoft) {
        messageDiv.classList.add('soft')
      }

      messageDiv.textContent = message

      // Position using fixed positioning relative to viewport
      positionValidationMessage(input, messageDiv)

      input.parentNode.appendChild(messageDiv)
    }
  }
}

function positionValidationMessage(input, messageDiv) {
  var inputRect = input.getBoundingClientRect()
  var viewportHeight = window.innerHeight
  var viewportWidth = window.innerWidth

  // Calculate available space in all directions
  var spaceAbove = inputRect.top
  var spaceBelow = viewportHeight - inputRect.bottom
  var spaceLeft = inputRect.left
  var spaceRight = viewportWidth - inputRect.right

  var messageHeight = 40 // Estimated message height
  var messageWidth = 250 // Estimated message width

  // Determine best position based on available space
  var position = 'top' // default

  if (spaceBelow > messageHeight + 10) {
    position = 'bottom'
  } else if (spaceAbove > messageHeight + 10) {
    position = 'top'
  } else if (spaceRight > messageWidth + 10) {
    position = 'right'
  } else if (spaceLeft > messageWidth + 10) {
    position = 'left'
  }

  // Apply positioning
  if (position === 'bottom') {
    messageDiv.style.top = (inputRect.bottom + 8) + 'px'
    messageDiv.style.left = (inputRect.left + inputRect.width / 2) + 'px'
    messageDiv.style.transform = 'translateX(-50%)'
    messageDiv.classList.add('position-bottom')
  } else if (position === 'top') {
    messageDiv.style.top = (inputRect.top - messageHeight - 8) + 'px'
    messageDiv.style.left = (inputRect.left + inputRect.width / 2) + 'px'
    messageDiv.style.transform = 'translateX(-50%)'
    messageDiv.classList.add('position-top')
  } else if (position === 'right') {
    messageDiv.style.top = (inputRect.top + inputRect.height / 2) + 'px'
    messageDiv.style.left = (inputRect.right + 8) + 'px'
    messageDiv.style.transform = 'translateY(-50%)'
    messageDiv.classList.add('position-right')
  } else if (position === 'left') {
    messageDiv.style.top = (inputRect.top + inputRect.height / 2) + 'px'
    messageDiv.style.left = (inputRect.left - messageWidth - 8) + 'px'
    messageDiv.style.transform = 'translateY(-50%)'
    messageDiv.classList.add('position-left')
  }
}

// ====================
// TABLE GENERATION FUNCTIONS
// ====================

function cleanupEventListeners() {
  var inputs = document.querySelectorAll('.cell-input')
  for (var i = 0; i < inputs.length; i++) {
    var newInput = inputs[i].cloneNode(true)
    if (inputs[i].parentNode) {
      inputs[i].parentNode.replaceChild(newInput, inputs[i])
    }
  }
}

function generateTable(params) {
  debugLog('=== GENERATE TABLE DEBUG ===')
  debugLog('Display mode:', params.historicalDisplay)
  debugLog('Show historical:', params.showHistorical)
  debugLog('Historical data:', params.historicalData)

  var container = document.getElementById('table-wrapper')
  if (!container) {
    container = document.getElementById('table-holder')
  }

  if (!container) {
    debugLog('Table container not found')
    return
  }

  var table = document.createElement('table')
  table.className = 'data-table'
  table.setAttribute('role', 'table')
  table.setAttribute('aria-label', 'Data entry table with ' + (params.showHistorical ? 'historical data' : 'current data only'))

  // Generate header
  debugLog('Generating header...')
  var thead = generateTableHeader(params)
  table.appendChild(thead)

  // Generate body
  debugLog('Generating body...')
  var tbody = generateTableBody(params)
  table.appendChild(tbody)

  cleanupEventListeners()
  container.innerHTML = ''
  container.appendChild(table)

  debugLog('Table generated, setting up events...')
  setupCellEventListeners()

  debugLog('Loading existing data...')
  loadExistingData(params)

  debugLog('=== END GENERATE TABLE DEBUG ===')
}

function generateTableHeader(params) {
  var thead = document.createElement('thead')
  var headerRow = document.createElement('tr')

  // Empty cell for row labels
  var emptyCell = document.createElement('th')
  emptyCell.className = 'row-label-header'
  emptyCell.setAttribute('scope', 'col')
  headerRow.appendChild(emptyCell)

  // Column headers based on display mode
  params.colLabels.forEach(function (label, colIndex) {
    if (params.showHistorical && params.historicalDisplay === 'columns') {
      // Historical column
      var histCell = document.createElement('th')
      histCell.textContent = label + ' (' + params.historicalLabel + ')'
      histCell.className = 'historical-header'
      histCell.setAttribute('scope', 'col')
      headerRow.appendChild(histCell)
    }

    // Current column
    var currentCell = document.createElement('th')
    currentCell.textContent = params.historicalDisplay === 'columns' ?
      label + ' (Current)' : label
    currentCell.className = 'current-header'
    currentCell.setAttribute('scope', 'col')
    headerRow.appendChild(currentCell)
  })

  // Add total column header if needed
  if (params.total === 'row') {
    var totalHeader = document.createElement('th')
    totalHeader.textContent = 'Total'
    totalHeader.className = 'total-header current-header'
    totalHeader.setAttribute('scope', 'col')
    headerRow.appendChild(totalHeader)
  }

  thead.appendChild(headerRow)
  return thead
}

function generateTableBody(params) {
  var tbody = document.createElement('tbody')

  for (var rowIndex = 0; rowIndex < params.rows; rowIndex++) {
    var row = document.createElement('tr')
    row.className = 'data-row'

    // Row label cell
    var labelCell = document.createElement('td')
    var rowLabel = params.rowLabels[rowIndex] || 'Row ' + (rowIndex + 1)
    labelCell.textContent = unEntity(rowLabel)
    labelCell.className = 'row-label'
    labelCell.setAttribute('scope', 'row')
    row.appendChild(labelCell)

    // Data cells
    for (var colIndex = 0; colIndex < params.cols; colIndex++) {
      if (params.showHistorical && params.historicalDisplay === 'columns') {
        // Historical data cell (read-only)
        var histCell = document.createElement('td')
        histCell.className = 'historical-cell'
        var histValue = getHistoricalValue(params.historicalData, rowIndex, colIndex)

        if (histValue !== null && histValue !== undefined) {
          histCell.textContent = params.formatNumbers ? formatNumber(histValue, true) : histValue
          debugLog('Adding historical cell [' + rowIndex + '][' + colIndex + '] with value: "' + histValue + '"')
        } else {
          histCell.textContent = '-'
          debugLog('Adding historical cell [' + rowIndex + '][' + colIndex + '] with no data (showing "-")')
        }

        histCell.setAttribute('aria-label', 'Historical value: ' + (histValue || 'no data'))
        row.appendChild(histCell)
      }

      // Current data cell (input)
      var currentCell = document.createElement('td')
      currentCell.className = 'current-cell'

      var cellContent = createCellContent(params, rowIndex, colIndex)
      currentCell.appendChild(cellContent)

      row.appendChild(currentCell)
    }

    // Add row total cell if needed
    if (params.total === 'row') {
      var totalCell = document.createElement('td')
      totalCell.className = 'total-cell'
      totalCell.setAttribute('data-total-row', rowIndex)
      totalCell.textContent = '0'
      row.appendChild(totalCell)
    }

    tbody.appendChild(row)
  }

  // Add column totals row if needed
  if (params.total === 'column') {
    var totalRow = document.createElement('tr')
    totalRow.className = 'total-row'

    // Empty cell for row label
    var emptyCell = document.createElement('td')
    emptyCell.textContent = 'Total'
    emptyCell.className = 'row-label total-label'
    totalRow.appendChild(emptyCell)

    // Total cells for each column
    for (var colIndex = 0; colIndex < params.cols; colIndex++) {
      if (params.showHistorical && params.historicalDisplay === 'columns') {
        // Historical total (if applicable)
        var histTotalCell = document.createElement('td')
        histTotalCell.className = 'total-cell historical-total'
        histTotalCell.setAttribute('data-total-col-hist', colIndex)
        histTotalCell.textContent = '0'
        totalRow.appendChild(histTotalCell)
      }

      // Current total
      var totalCell = document.createElement('td')
      totalCell.className = 'total-cell'
      totalCell.setAttribute('data-total-col', colIndex)
      totalCell.textContent = '0'
      totalRow.appendChild(totalCell)
    }

    tbody.appendChild(totalRow)
  }

  return tbody
}

function createCellContent(params, rowIndex, colIndex) {
  var container = document.createElement('div')
  container.className = 'cell-content'

  debugLog('Creating cell [' + rowIndex + '][' + colIndex + ']')

  // Historical value display (inline mode OR toggle mode)
  if (params.showHistorical && (params.historicalDisplay === 'inline' || params.historicalDisplay === 'toggle')) {
    var histValue = getHistoricalValue(params.historicalData, rowIndex, colIndex)
    debugLog('Historical value for [' + rowIndex + '][' + colIndex + ']:', histValue)

    if (histValue !== null && histValue !== undefined) {
      var histSpan = document.createElement('span')
      histSpan.className = params.historicalDisplay === 'toggle' ? 'toggle-historical' : 'inline-historical'
      histSpan.textContent = params.formatNumbers ? formatNumber(histValue, true) : histValue
      histSpan.setAttribute('role', 'note')
      histSpan.setAttribute('aria-label', params.historicalLabel + ': ' + histValue)
      histSpan.title = params.historicalLabel + ': ' + histValue
      container.appendChild(histSpan)
      debugLog('Added historical span with value:', histValue)
    }
  }

  // Input field
  var input = document.createElement('input')
  input.type = params.numbersAppearance ? 'number' : 'text'
  input.className = 'cell-input default-answer-text-size'
  input.setAttribute('data-row', rowIndex)
  input.setAttribute('data-col', colIndex)

  // For number formatting or decimal control, we'll use text input
  if (params.formatNumbers || !params.allowDecimals) {
    input.type = 'text'
    input.setAttribute('inputmode', 'numeric')
  }

  // Set min/max attributes for number inputs
  if (input.type === 'number') {
    if (params.minValue !== null) {
      input.setAttribute('min', params.minValue)
    }
    if (params.maxValue !== null) {
      input.setAttribute('max', params.maxValue)
    }
    if (!params.allowDecimals) {
      input.setAttribute('step', '1')
    }
  }

  // Accessibility attributes
  var rowLabel = params.rowLabels[rowIndex] || 'Row ' + (rowIndex + 1)
  var colLabel = params.colLabels[colIndex] || 'Column ' + (colIndex + 1)
  input.setAttribute('aria-label', 'Current value for ' + rowLabel + ' ' + colLabel)

  // SIMPLIFIED: Only plugin required field handling
  if (params.required === 1) {
    input.required = true
    input.setAttribute('aria-required', 'true')
    input.setAttribute('data-required', 'true')
  }

  // Read-only handling
  if (fieldProperties.READONLY) {
    input.readOnly = true
    input.className += ' readonly'
  }

  container.appendChild(input)
  return container
}

function getHistoricalValue(historicalData, rowIndex, colIndex) {
  debugLog('Getting historical value for [' + rowIndex + '][' + colIndex + ']', {
    historicalData: historicalData,
    hasData: !!historicalData,
    hasRow: !!(historicalData && historicalData[rowIndex]),
    hasCol: !!(historicalData && historicalData[rowIndex] && historicalData[rowIndex][colIndex])
  })

  if (!historicalData || !historicalData[rowIndex] || historicalData[rowIndex][colIndex] === undefined) {
    return null
  }

  var value = historicalData[rowIndex][colIndex]
  debugLog('Historical value found: "' + value + '"')
  return value
}

// ====================
// EVENT HANDLING & DATA MANAGEMENT
// ====================

function setupCellEventListeners() {
  var inputs = document.querySelectorAll('.cell-input')
  var params = getTableParameters()

  // Create debounced validation functions for both soft and hard validation
  var debouncedSoftValidation = debounce(function (input, params) {
    var validation = validateNumericInput(input.value, params, true) // Use soft messages
    showValidationMessage(input, validation.message, validation.valid, true)
  }, 300)

  var debouncedHardValidation = debounce(function (input, params) {
    var validation = validateNumericInput(input.value, params, false) // Use hard messages
    showValidationMessage(input, validation.message, validation.valid, false)
  }, 300)

  // Create debounced update function
  var debouncedUpdate = debounce(function () {
    updateAnswer()
    updateTotals(params)
  }, 150) // 150ms delay for updates

  for (var i = 0; i < inputs.length; i++) {
    var input = inputs[i]
    // Handle number formatting and validation on input
    if (params.formatNumbers || !params.allowDecimals || params.minValue !== null || params.maxValue !== null) {
      debugLog('Setting up ENHANCED input handling for input:', input)

      // Flag to prevent recursive formatting
      input._isFormatting = false

      input.addEventListener('input', function () {
        // Prevent recursive formatting
        if (this._isFormatting) {
          return
        }

        var rawValue = this.value

        // Store original cursor position
        var cursorPosition = this.selectionStart

        // Filter decimal input if not allowed
        if (!params.allowDecimals) {
          var filteredValue = filterDecimalInput(rawValue, params.allowDecimals)
          if (filteredValue !== rawValue) {
            this.value = filteredValue
            rawValue = filteredValue
          }
        }

        // Real-time formatting with smart cursor positioning
        if (params.formatNumbers && rawValue) {
          // Remove existing formatting to get clean number
          var unformatted = unformatNumber(rawValue)

          if (unformatted && !isNaN(unformatted)) {
            var formatted = formatNumber(unformatted, true)

            // Always update if different, to ensure formatting is applied
            if (formatted !== rawValue) {
              // Set flag to prevent recursive formatting
              this._isFormatting = true

              // Count digits (not commas) before cursor in the original value
              var digitsBeforeCursor = 0
              for (var j = 0; j < Math.min(cursorPosition, rawValue.length); j++) {
                if (rawValue[j] !== ',') {
                  digitsBeforeCursor++
                }
              }

              // Set the formatted value
              this.value = formatted

              // Find the new cursor position by counting the same number of digits in formatted value
              var newPosition = 0
              var digitCount = 0
              for (var k = 0; k < formatted.length; k++) {
                if (formatted[k] !== ',') {
                  digitCount++
                  if (digitCount >= digitsBeforeCursor) {
                    newPosition = k + 1
                    break
                  }
                } else if (digitCount >= digitsBeforeCursor) {
                  newPosition = k
                  break
                }
              }

              // Ensure newPosition is valid
              if (newPosition === 0) {
                newPosition = formatted.length
              }

              // Set cursor position immediately (no setTimeout)
              try {
                this.setSelectionRange(newPosition, newPosition)
              } catch (e) {
                debugLog('Error setting cursor position:', e)
              }

              // Clear flag
              this._isFormatting = false

              // Continue to validation and save - don't skip them!
              // The formatted value needs to be saved
            }
          }
        }

        // Use soft validation during typing (less intrusive)
        if (!params.validationStrict) {
          debouncedSoftValidation(this, params)
        } else {
          debouncedHardValidation(this, params)
        }

        // Use debounced updates for better performance
        debouncedUpdate()
      })

      // Handle focus - select all for easy editing and remove formatting
      input.addEventListener('focus', function () {
        var cell = this.closest('td')
        if (cell) {
          cell.classList.add('focused-cell')
        }

        // Select all text for easy replacement
        var self = this
        setTimeout(function () { self.select() }, 0)
      })

      // Handle blur - apply formatting and final validation
      input.addEventListener('blur', function () {
        var cell = this.closest('td')
        if (cell) {
          cell.classList.remove('focused-cell')
        }

        // Use the same validation mode as during typing (respect validationStrict setting)
        var useSoftValidation = !params.validationStrict
        var validation = validateNumericInput(this.value, params, useSoftValidation)
        showValidationMessage(this, validation.message, validation.valid, useSoftValidation)

        updateTotals(params)
      })

      // Handle keypress for decimal restriction
      if (!params.allowDecimals) {
        input.addEventListener('keypress', function (e) {
          // Prevent decimal point entry
          if (e.key === '.' || e.key === ',') {
            e.preventDefault()
          }
        })
      }

    } else {
      debugLog('Setting up STANDARD input handling for input:', input)
      // Standard input handling with debouncing
      input.addEventListener('input', function () {
        debouncedUpdate()
      })

      input.addEventListener('focus', function () {
        var cell = this.closest('td')
        if (cell) {
          cell.classList.add('focused-cell')
        }
      })

      input.addEventListener('blur', function () {
        var cell = this.closest('td')
        if (cell) {
          cell.classList.remove('focused-cell')
        }
      })
    }

    // Add keyboard navigation
    input.addEventListener('keydown', function (e) {
      handleKeyboardNavigation(e, this)
    })
  }
}

function handleKeyboardNavigation(event, currentInput) {
  var row = parseInt(currentInput.getAttribute('data-row'))
  var col = parseInt(currentInput.getAttribute('data-col'))
  var params = getTableParameters()
  var nextInput = null

  switch (event.key) {
    case 'ArrowUp':
      if (row > 0) {
        nextInput = document.querySelector('input[data-row="' + (row - 1) + '"][data-col="' + col + '"]')
      }
      break
    case 'ArrowDown':
      if (row < params.rows - 1) {
        nextInput = document.querySelector('input[data-row="' + (row + 1) + '"][data-col="' + col + '"]')
      }
      break
    case 'ArrowLeft':
      if (col > 0) {
        nextInput = document.querySelector('input[data-row="' + row + '"][data-col="' + (col - 1) + '"]')
      }
      break
    case 'ArrowRight':
      if (col < params.cols - 1) {
        nextInput = document.querySelector('input[data-row="' + row + '"][data-col="' + (col + 1) + '"]')
      }
      break
    case 'Tab':
      // Let default tab behavior handle this
      return
    default:
      return
  }

  if (nextInput && event.key.startsWith('Arrow')) {
    event.preventDefault()
    nextInput.focus()
  }
}

function updateAnswer() {
  var params = getTableParameters()
  var answerMatrix = []

  for (var row = 0; row < params.rows; row++) {
    var rowData = []
    for (var col = 0; col < params.cols; col++) {
      var input = document.querySelector('input[data-row="' + row + '"][data-col="' + col + '"]')
      var value = input ? input.value : ''

      // Store unformatted values in the answer
      if (params.formatNumbers && value) {
        value = unformatNumber(value)
      }

      rowData.push(value)
    }
    answerMatrix.push(rowData.join(','))
  }

  var answer = answerMatrix.join('|')

  // PLUGIN'S REQUIRED LOGIC - Check this FIRST and ALWAYS enforce
  if (params.required === 1) {
    checkAllRequired(answer)
    return // Exit here - checkAllRequired will handle setting the answer
  }

  // For non-plugin-required fields, check validation constraints
  var hasValidationConstraints = params.minValue !== null || params.maxValue !== null || !params.allowDecimals

  if (hasValidationConstraints) {
    // Use soft validation messages if NOT in strict mode
    var useSoftValidation = !params.validationStrict
    var validation = validateAllInputs(params, useSoftValidation)

    if (params.validationStrict && !validation.valid) {
      // HARD validation: preserve data but prevent progression by NOT setting answer
      debugLog('Hard validation failed: ' + validation.invalidCount + ' invalid inputs - blocking progression')
      // Do NOT call setAnswer - this preserves existing data and prevents progression
      return
    } else if (!params.validationStrict && !validation.valid) {
      // SOFT validation: show warnings but allow progression
      debugLog('Soft validation: ' + validation.invalidCount + ' invalid inputs (allowing progression)')
    }
  }

  // Set answer (either no constraints, or validation passed, or soft validation mode)
  setAnswer(answer)

  // Update hidden input if exists
  var hiddenInput = document.getElementById('answer-input')
  if (hiddenInput) {
    hiddenInput.value = answer
  }
}

/**
 * Plugin's custom required field validation
 * Only used when required=1 parameter is set
 * @param {string} cellValues - Pipe-separated cell values
 */
function checkAllRequired(cellValues) {
  debugLog('Checking plugin required fields for values:', cellValues)

  if (!cellValues) {
    setAnswer('')
    return
  }

  var tempArray = cellValues.split('|')

  // Remove empty last element if it exists (common with pipe-separated data)
  if (tempArray.length > 0 && tempArray[tempArray.length - 1] === '') {
    tempArray.pop()
  }

  // Check if any cell is empty
  var hasEmptyCell = tempArray.some(function (cell) {
    return cell === '' || cell === null || cell === undefined
  })

  if (hasEmptyCell) {
    debugLog('Plugin required validation failed: empty cells found')
    setAnswer('') // Block progression if required cells are empty
  } else {
    debugLog('Plugin required validation passed: all cells filled')
    setAnswer(cellValues) // Allow progression when all cells are filled
  }
}

function loadExistingData(params) {
  var currentAnswer = fieldProperties.CURRENT_ANSWER
  if (!currentAnswer) return

  try {
    var rows = currentAnswer.split('|')

    for (var rowIndex = 0; rowIndex < Math.min(rows.length, params.rows); rowIndex++) {
      var cells = rows[rowIndex].split(',')

      for (var colIndex = 0; colIndex < Math.min(cells.length, params.cols); colIndex++) {
        var input = document.querySelector('input[data-row="' + rowIndex + '"][data-col="' + colIndex + '"]')
        if (input && cells[colIndex]) {
          var value = cells[colIndex]
          // Format the value if number formatting is enabled AND the input is not focused
          if (params.formatNumbers && value && !isNaN(value) && input !== document.activeElement) {
            value = formatNumber(value, true)
          }
          input.value = value
        }
      }
    }

    // Update totals after loading data
    setTimeout(function () {
      updateTotals(params)
    }, 100)
  } catch (error) {
    debugLog('Error loading existing data:', error)
  }
}

// ====================
// LEGACY TABLE GENERATION (for backward compatibility)
// ====================

var prevAnswer = fieldProperties.CURRENT_ANSWER
var fieldAppearance = fieldProperties.APPEARANCE
var div = document.getElementById('table-holder')

var prevAnswerArray
if (prevAnswer != null) {
  prevAnswerArray = prevAnswer.split('|')
}

/**
 * Generate legacy table using unified parameters for consistency
 */
function generateLegacyTable() {
  debugLog('=== GENERATING LEGACY TABLE ===')
  debugLog('Using unified parameters:', unifiedParams)

  // Determine field appearance
  var fieldAppearance = 'text'
  if (fieldProperties.APPEARANCE && fieldProperties.APPEARANCE.includes('numbers')) {
    fieldAppearance = 'number'
  }

  var legacyRows = unifiedParams.rows + 1 // Add 1 for header row
  var legacyColumns = unifiedParams.cols

  // Parse headers - support both pipe-separated (legacy) and comma-separated (new)
  var rowHeadersArray = []
  var columnHeadersArray = []

  if (unifiedParams.rowLabels) {
    if (unifiedParams.rowLabels.includes('|')) {
      // Legacy pipe-separated format
      rowHeadersArray = unifiedParams.rowLabels.split('|')
    } else {
      // New comma-separated format
      rowHeadersArray = unifiedParams.rowLabels.split(',').map(function (s) { return s.trim() })
    }
  }

  if (unifiedParams.colLabels) {
    if (unifiedParams.colLabels.includes('|')) {
      // Legacy pipe-separated format
      columnHeadersArray = unifiedParams.colLabels.split('|')
    } else {
      // New comma-separated format
      columnHeadersArray = unifiedParams.colLabels.split(',').map(function (s) { return s.trim() })
    }
  }

  var table = '<table id="gridTable" class="gridTable">'
  for (var i = 0; i < legacyRows; i++) {
    table += '<tr>'

    if (i > 0) {
      // Data row - add row header
      var rowHeader = rowHeadersArray[i - 1] || 'Row ' + i
      table += '<th scope="row" style="width:auto" class="default-hint-text-size" dir="auto">' + unEntity(rowHeader) + '</th>'
    } else {
      // Header row - empty corner cell
      table += '<th scope="col" class="default-hint-text-size"></th>'
    }

    for (var j = 0; j < legacyColumns; j++) {
      if (i === 0) {
        // Header row - add column headers
        var headerText = columnHeadersArray[j] || 'Col ' + (j + 1)
        table += '<th scope="col" class="default-hint-text-size sticky" dir="auto">' + unEntity(headerText) + '</th>'
      } else {
        // Data row - add input cells
        var inputAttrs = 'type="' + fieldAppearance + '" class="cell default-hint-text-size" dir="auto"'

        if (unifiedParams.required === 1) {
          inputAttrs += ' required'
        }

        table += '<td><input ' + inputAttrs + '></td>'
      }
    }

    table += '</tr>'

    if (i === 0) {
      table += '</thead>'
    }
  }
  table += '</table>'

  // Insert table into container
  var div = document.getElementById('table-holder')
  if (div) {
    div.innerHTML = table
    debugLog('Legacy table generated successfully')
  } else {
    debugLog('Table holder not found')
  }
}

function setupLegacyEventListeners() {
  var getTable = document.getElementById('gridTable')
  if (!getTable) return

  var cells = getTable.getElementsByTagName('input')
  var cellsLength = cells.length

  if (prevAnswer != null && prevAnswerArray) {
    for (var t = 0; t < Math.min(prevAnswerArray.length - 1, cellsLength); t++) {
      if (cells[t]) {
        cells[t].value = prevAnswerArray[t]
      }
    }
  }

  for (var p = 0; p < cellsLength; p++) {
    var cell = cells[p]
    if (cell) {
      cell.addEventListener('input', getValues)
    }
  }
}

function getValues(e) {
  var getTable = document.getElementById('gridTable')
  if (!getTable) return ''

  var cells = getTable.getElementsByTagName('input')
  var cellValues = ''

  for (var q = 0; q < cells.length; q++) {
    var cell = cells[q]
    var cellvalue = cell ? cell.value : ''
    cellValues = cellValues + cellvalue + '|'
  }

  if (required === 1) {
    checkAllRequired(cellValues)
  } else {
    setAnswer(cellValues)
  }
  return cellValues
}

// checkAllRequired function is now unified above - no duplicate needed

// ====================
// REQUIRED PLUGIN FUNCTIONS
// ====================

/**
 * Clear all answers in both enhanced and legacy modes
 */
function clearAnswer() {
  debugLog('Clearing all answers')

  // Clear enhanced mode inputs
  var enhancedInputs = document.querySelectorAll('.cell-input')
  for (var i = 0; i < enhancedInputs.length; i++) {
    enhancedInputs[i].value = ''
    // Clear any validation messages
    showValidationMessage(enhancedInputs[i], '', true)
  }

  // Clear legacy mode inputs
  var legacyTable = document.getElementById('gridTable')
  if (legacyTable) {
    var legacyCells = legacyTable.getElementsByTagName('input')
    for (var i = 0; i < legacyCells.length; i++) {
      if (legacyCells[i]) {
        legacyCells[i].value = ''
      }
    }
  }

  // Clear hidden input
  var hiddenInput = document.getElementById('answer-input')
  if (hiddenInput) {
    hiddenInput.value = ''
  }

  // Clear the answer
  setAnswer('')

  debugLog('All answers cleared')
}

/**
 * Set focus to the first input field (works for both modes)
 */
function setFocus() {
  if (fieldProperties.READONLY) {
    debugLog('Field is readonly, not setting focus')
    return
  }

  var firstInput = null

  // Try enhanced mode first
  firstInput = document.querySelector('.cell-input')

  // Fallback to legacy mode
  if (!firstInput) {
    var legacyTable = document.getElementById('gridTable')
    if (legacyTable) {
      var legacyInputs = legacyTable.getElementsByTagName('input')
      firstInput = legacyInputs[0]
    }
  }

  if (firstInput) {
    debugLog('Setting focus to first input')
    firstInput.focus()

    // Show soft keyboard on mobile platforms
    if (isAndroid || isIOS) {
      try {
        if (typeof showSoftKeyboard !== 'undefined') {
          showSoftKeyboard()
        }
      } catch (e) {
        debugLog('Soft keyboard not available')
      }
    }
  } else {
    debugLog('No input field found to focus on')
  }
}

/**
 * HTML entity handling - converts HTML entities back to actual characters
 * Fixes rendering issues with field references containing HTML
 * @param {string} str - String containing HTML entities
 * @returns {string} String with entities decoded
 */
function unEntity(str) {
  if (!str) return ''
  return str.replace(/</g, '<').replace(/>/g, '>').replace(/&/g, '&')
}

// RTL language detection
function isRTL(language) {
  if (!language) return false
  var rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi']
  return rtlLanguages.some(function (lang) {
    return language.toLowerCase().indexOf(lang) === 0
  })
}

// ====================
// TOGGLE FUNCTIONALITY
// ====================

function setupToggleMode(params) {
  debugLog('=== TOGGLE MODE SETUP ===')
  debugLog('Display mode:', params.historicalDisplay)

  if (params.historicalDisplay !== 'toggle') {
    debugLog('Not toggle mode, skipping setup')
    return
  }

  var controls = document.getElementById('historical-controls')
  var toggleBtn = document.getElementById('toggle-view')
  var toggleText = document.getElementById('toggle-text')
  var container = document.getElementById('table-container')

  debugLog('Toggle elements found:', {
    controls: !!controls,
    toggleBtn: !!toggleBtn,
    toggleText: !!toggleText,
    container: !!container
  })

  if (!controls || !toggleBtn || !toggleText || !container) {
    debugLog('Toggle controls not found in template')
    return
  }

  debugLog('Setting up toggle functionality...')
  controls.style.display = 'block'
  container.classList.add('toggle-mode', 'current-view')

  var isShowingHistorical = false

  toggleBtn.addEventListener('click', function () {
    debugLog('Toggle clicked, current state:', isShowingHistorical)
    isShowingHistorical = !isShowingHistorical

    if (isShowingHistorical) {
      container.classList.remove('current-view')
      container.classList.add('historical-view')
      toggleText.textContent = 'Current'
    } else {
      container.classList.remove('historical-view')
      container.classList.add('current-view')
      toggleText.textContent = 'Historical'
    }
    debugLog('Toggle state changed to:', isShowingHistorical)
  })

  debugLog('=== END TOGGLE MODE SETUP ===')
}

function setupResponsiveBehavior(params) {
  if (params.historicalDisplay === 'columns') {
    var container = document.getElementById('table-container')
    if (container) {
      container.classList.add('columns-mode')
    }

    window.addEventListener('resize', function () {
      // Could add dynamic behavior here if needed
    })
  }
}

// ====================
// TOTAL CALCULATION FUNCTIONS
// ====================

function updateTotals(params) {
  if (!params.total) return

  if (params.total === 'row') {
    updateRowTotals(params)
  } else if (params.total === 'column') {
    updateColumnTotals(params)
  }
}

function updateRowTotals(params) {
  for (var rowIndex = 0; rowIndex < params.rows; rowIndex++) {
    var total = 0
    var hasValues = false

    for (var colIndex = 0; colIndex < params.cols; colIndex++) {
      var input = document.querySelector('input[data-row="' + rowIndex + '"][data-col="' + colIndex + '"]')
      if (input && input.value) {
        var value = parseFloat(unformatNumber(input.value))
        if (!isNaN(value)) {
          total += value
          hasValues = true
        }
      }
    }

    var totalCell = document.querySelector('[data-total-row="' + rowIndex + '"]')
    if (totalCell) {
      if (hasValues) {
        totalCell.textContent = params.formatNumbers ? formatNumber(total, true) : total.toString()
      } else {
        totalCell.textContent = '0'
      }
    }
  }
}

function updateColumnTotals(params) {
  for (var colIndex = 0; colIndex < params.cols; colIndex++) {
    var total = 0
    var hasValues = false

    for (var rowIndex = 0; rowIndex < params.rows; rowIndex++) {
      var input = document.querySelector('input[data-row="' + rowIndex + '"][data-col="' + colIndex + '"]')
      if (input && input.value) {
        var value = parseFloat(unformatNumber(input.value))
        if (!isNaN(value)) {
          total += value
          hasValues = true
        }
      }
    }

    var totalCell = document.querySelector('[data-total-col="' + colIndex + '"]')
    if (totalCell) {
      if (hasValues) {
        totalCell.textContent = params.formatNumbers ? formatNumber(total, true) : total.toString()
      } else {
        totalCell.textContent = '0'
      }
    }

    // Update historical totals if applicable
    if (params.showHistorical && params.historicalDisplay === 'columns') {
      var histTotal = 0
      var hasHistValues = false

      for (var rowIndex = 0; rowIndex < params.rows; rowIndex++) {
        var histValue = getHistoricalValue(params.historicalData, rowIndex, colIndex)
        if (histValue !== null && histValue !== undefined) {
          var value = parseFloat(unformatNumber(histValue))
          if (!isNaN(value)) {
            histTotal += value
            hasHistValues = true
          }
        }
      }

      var histTotalCell = document.querySelector('[data-total-col-hist="' + colIndex + '"]')
      if (histTotalCell) {
        if (hasHistValues) {
          histTotalCell.textContent = params.formatNumbers ? formatNumber(histTotal, true) : histTotal.toString()
        } else {
          histTotalCell.textContent = '0'
        }
      }
    }
  }
}

// ====================
// MAIN INITIALIZATION
// ====================

/**
 * Main initialization function that handles both legacy and enhanced modes
 */
function initializeTableGrid() {
  try {
    debugLog('=== TABLE GRID INITIALIZATION ===')

    // Determine which mode to use
    var useEnhancedMode = shouldUseEnhancedMode()
    debugLog('Mode detection - Enhanced mode:', useEnhancedMode)
    debugLog('Unified parameters:', unifiedParams)

    if (useEnhancedMode) {
      initializeEnhancedMode()
    } else {
      initializeLegacyMode()
    }

    // Common initialization for both modes
    setupCommonFeatures()

  } catch (error) {
    debugLog('Error initializing table grid plugin:', error)
    // Fallback to legacy mode on any error
    try {
      debugLog('Falling back to legacy mode due to error')
      initializeLegacyMode()
    } catch (legacyError) {
      debugLog('Legacy fallback also failed:', legacyError)
    }
  }
}

/**
 * Initialize enhanced mode with all new features
 */
function initializeEnhancedMode() {
  debugLog('=== INITIALIZING ENHANCED MODE ===')

  var params = getTableParameters()

  // Validate and fill missing labels
  if (params.rowLabels.length === 0) {
    for (var i = 0; i < params.rows; i++) {
      params.rowLabels.push('Row ' + (i + 1))
    }
  }

  if (params.colLabels.length === 0) {
    for (var j = 0; j < params.cols; j++) {
      params.colLabels.push('Col ' + (j + 1))
    }
  }

  // RTL support
  if (fieldProperties.LANGUAGE && isRTL(fieldProperties.LANGUAGE)) {
    var container = document.getElementById('table-container')
    if (container) {
      container.dir = 'rtl'
    }
  }

  // Generate enhanced table
  generateTable(params)

  // Setup display mode features
  if (params.historicalDisplay === 'toggle') {
    setupToggleMode(params)
  }

  // Apply responsive behavior
  setupResponsiveBehavior(params)
}

/**
 * Initialize legacy mode for backward compatibility
 */
function initializeLegacyMode() {
  debugLog('=== INITIALIZING LEGACY MODE ===')
  generateLegacyTable()
  setupLegacyEventListeners()
}

/**
 * Setup features common to both modes
 */
function setupCommonFeatures() {
  // Handle field labels and hints with null checks
  if (fieldProperties && fieldProperties.LABEL) {
    var labelElement = document.querySelector('.label')
    if (labelElement) {
      labelElement.innerHTML = unEntity(fieldProperties.LABEL)
    }
  }

  if (fieldProperties && fieldProperties.HINT) {
    var hintElement = document.querySelector('.hint')
    if (hintElement) {
      hintElement.innerHTML = unEntity(fieldProperties.HINT)
    }
  }

  // Set initial focus if not readonly
  if (fieldProperties && !fieldProperties.READONLY) {
    setTimeout(setFocus, 100)
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initializeTableGrid()
})