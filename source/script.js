/* global fieldProperties, setAnswer, getPluginParameter */

// ====================
// DEBUG MODE
// ====================

// Set to true for development debugging
var DEBUG_MODE = true

// Debug logging function
function debugLog() {
  if (!DEBUG_MODE) return
  if (typeof console !== 'undefined' && console.log) {
    console.log.apply(console, arguments)
  }
}

// ====================
// PLATFORM DETECTION
// ====================

// Detect platform for platform-specific behaviors
var bodyClass = (document.body && document.body.className) || ''
var isWebCollect = (bodyClass.indexOf('web-collect') >= 0)
var isAndroid = (bodyClass.indexOf('android-collect') >= 0)
var isIOS = (bodyClass.indexOf('ios-collect') >= 0)

debugLog('Platform detection:', {
  isWebCollect: isWebCollect,
  isAndroid: isAndroid,
  isIOS: isIOS
})

// ====================
// PARAMETER PARSING FUNCTIONS
// ====================

// Parse a positive integer with fallback
function parsePositiveInt(value, fallback) {
  var n = parseInt(value, 10)
  if (isNaN(n) || n < 1) return fallback
  return n
}

// Parse a numeric value or return null
function parseNumericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  var n = parseFloat(value)
  return isNaN(n) ? null : n
}

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
    historical_display: safeGetPluginParameter('historical_display', 'bottom'),
    total: safeGetPluginParameter('total', ''),
    format_numbers: safeGetPluginParameter('format_numbers', 'false'),
    min_value: safeGetPluginParameter('min_value', ''),
    max_value: safeGetPluginParameter('max_value', ''),
    allow_decimals: safeGetPluginParameter('allow_decimals', 'true'),
    validation_strict: safeGetPluginParameter('validation_strict', 'false')
  }

  debugLog('Raw parameters:', rawParams)

  var params = {
    rows: parsePositiveInt(rawParams.rows, 3),
    cols: parsePositiveInt(rawParams.cols, 4),
    rowLabels: parseLabels(rawParams.row_labels),
    colLabels: parseLabels(rawParams.col_labels),
    showHistorical: rawParams.show_historical === 'true',
    historicalData: parseHistoricalData(rawParams.historical_data),
    historicalDisplay: rawParams.historical_display || 'bottom',
    historicalLabel: safeGetPluginParameter('historical_label', 'Last Year'),
    numbersAppearance: fieldProperties.APPEARANCE && fieldProperties.APPEARANCE.includes('numbers'),

    required: parsePositiveInt(safeGetPluginParameter('required', '0'), 0),

    total: rawParams.total,
    formatNumbers: rawParams.format_numbers === 'true',
    minValue: parseNumericOrNull(rawParams.min_value),
    maxValue: parseNumericOrNull(rawParams.max_value),
    allowDecimals: rawParams.allow_decimals !== 'false',
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

  // Support both comma and pipe separators (pipe for legacy compatibility)
  var delimiter = cleanString.indexOf('|') >= 0 ? '|' : ','
  return cleanString.split(delimiter).map(function (s) { return s.trim() }).filter(function (s) { return s.length > 0 })
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
  cols: parsePositiveInt(getUnifiedParameter(['cols', 'columns'], '4'), 4),
  rows: parsePositiveInt(getUnifiedParameter(['rows'], '3'), 3),
  colLabels: getUnifiedParameter(['col_labels', 'column_headers'], ''),
  rowLabels: getUnifiedParameter(['row_labels', 'row_headers'], ''),
  required: parsePositiveInt(getUnifiedParameter(['required'], '0'), 0),

  // Enhanced parameters
  showHistorical: getUnifiedParameter(['show_historical'], 'false') === 'true',
  historicalData: getUnifiedParameter(['historical_data'], ''),
  historicalDisplay: getUnifiedParameter(['historical_display'], 'bottom'),
  historicalLabel: getUnifiedParameter(['historical_label'], 'Last Year'),
  total: getUnifiedParameter(['total'], ''),
  formatNumbers: getUnifiedParameter(['format_numbers'], 'false') === 'true',
  minValue: parseNumericOrNull(getUnifiedParameter(['min_value'], '')),
  maxValue: parseNumericOrNull(getUnifiedParameter(['max_value'], '')),
  allowDecimals: getUnifiedParameter(['allow_decimals'], 'true') !== 'false',
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
  if (!shouldFormat || !value || value === '') {
    return value
  }

  var stringValue = value.toString()

  // Check if user is typing a decimal (trailing dot or incomplete decimal)
  var hasTrailingDot = stringValue.endsWith('.')
  var decimalParts = stringValue.split('.')
  var decimalSuffix = ''

  if (hasTrailingDot) {
    // Preserve the trailing dot for user who is typing
    decimalSuffix = '.'
  } else if (decimalParts.length === 2 && decimalParts[1] !== '') {
    // Has decimal portion - we'll preserve it after formatting the integer part
    decimalSuffix = '.' + decimalParts[1]
  }

  // Parse the integer part only
  var integerPart = decimalParts[0]
  var num = parseFloat(integerPart)

  if (isNaN(num)) return value

  // Format the integer part with commas for thousands separator
  var formattedInteger = num.toLocaleString('en-US', {
    maximumFractionDigits: 0,
    useGrouping: true
  })

  return formattedInteger + decimalSuffix
}

function unformatNumber(formattedValue) {
  if (!formattedValue) return ''
  // Remove commas and other formatting, but preserve the number
  var cleaned = formattedValue.toString().replace(/,/g, '').replace(/\s/g, '')
  return cleaned
}

function filterDecimalInput(value, allowDecimals) {
  if (!value) return value

  // Value should already be unformatted (no thousands separators) at this point
  // Only convert comma to dot if it appears to be a decimal separator
  var commaCount = (value.match(/,/g) || []).length
  var dotCount = (value.match(/\./g) || []).length

  var standardizedValue = value
  // Only convert comma to dot if it's likely a decimal separator:
  // - exactly one comma, no dots already present
  // - and the part after comma has 1-2 digits (typical decimal) or isn't exactly 3 digits
  if (commaCount === 1 && dotCount === 0) {
    var commaIndex = value.indexOf(',')
    var afterComma = value.substring(commaIndex + 1)
    var isLikelyDecimal = afterComma.length <= 2 || !/^\d{3}$/.test(afterComma)
    if (isLikelyDecimal) {
      standardizedValue = value.replace(',', '.')
    }
  }

  // If decimals are not allowed, remove dot and everything after it
  if (!allowDecimals) {
    return standardizedValue.replace(/\..*$/, '')
  }

  return standardizedValue
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

/**
 * Calculate and apply intelligent column/row header sizing based on:
 * - Number of columns
 * - Screen width
 * - Whether historical columns are displayed
 * This minimizes horizontal scroll while ensuring readability.
 */
function applyIntelligentHeaderSizing(params) {
  // Apply to document root for CSS variable inheritance
  var root = document.documentElement

  var screenWidth = window.innerWidth || document.documentElement.clientWidth
  var effectiveCols = params.cols

  // Double effective columns if showing historical in columns mode
  if (params.showHistorical && params.historicalDisplay === 'columns') {
    effectiveCols = params.cols * 2
  }

  // Set min/max constraints based on column count
  var colMinWidth, colMaxWidth, rowWidth, rowMaxWidth

  if (effectiveCols <= 2) {
    // Few columns: allow wider row headers for readability
    colMinWidth = 100
    colMaxWidth = 250
    rowWidth = 200
    rowMaxWidth = 280
  } else if (effectiveCols <= 4) {
    // Medium number of columns
    colMinWidth = 80
    colMaxWidth = 180
    rowWidth = 180
    rowMaxWidth = 220
  } else if (effectiveCols <= 6) {
    // More columns: constrain widths
    colMinWidth = 70
    colMaxWidth = 150
    rowWidth = 150
    rowMaxWidth = 180
  } else {
    // Many columns: tight constraints to minimize scroll
    colMinWidth = 60
    colMaxWidth = 120
    rowWidth = 120
    rowMaxWidth = 150
  }

  // Adjust for screen size
  if (screenWidth <= 480) {
    colMinWidth = Math.max(50, colMinWidth - 20)
    colMaxWidth = Math.min(100, colMaxWidth - 30)
    rowWidth = Math.min(100, rowWidth - 30)
    rowMaxWidth = Math.min(120, rowMaxWidth - 30)
  } else if (screenWidth <= 768) {
    colMinWidth = Math.max(60, colMinWidth - 10)
    colMaxWidth = Math.min(130, colMaxWidth - 20)
    rowWidth = Math.min(150, rowWidth - 20)
    rowMaxWidth = Math.min(180, rowMaxWidth - 20)
  }

  // Apply CSS custom properties to document root for proper inheritance
  root.style.setProperty('--col-header-min-width', colMinWidth + 'px')
  root.style.setProperty('--col-header-max-width', colMaxWidth + 'px')
  root.style.setProperty('--row-header-width', rowWidth + 'px')
  root.style.setProperty('--row-header-max-width', rowMaxWidth + 'px')

  console.log('Intelligent sizing: cols=' + effectiveCols +
    ', rowWidth=' + rowWidth + 'px, rowMax=' + rowMaxWidth + 'px')

  // Return sizing values for direct application after table is built
  return {
    rowWidth: rowWidth,
    rowMaxWidth: rowMaxWidth,
    colMinWidth: colMinWidth,
    colMaxWidth: colMaxWidth
  }
}

/**
 * Apply row header widths directly to elements (for table-layout: auto compatibility)
 */
function applyRowHeaderWidths(sizing) {
  console.log('=== applyRowHeaderWidths called ===')

  if (!sizing) {
    console.log('ERROR: No sizing object provided')
    return
  }

  var rowLabels = document.querySelectorAll('.row-label, .gridTable th[scope="row"]')
  console.log('Found row labels:', rowLabels.length)

  for (var i = 0; i < rowLabels.length; i++) {
    rowLabels[i].style.width = sizing.rowWidth + 'px'
    rowLabels[i].style.minWidth = '80px'
    rowLabels[i].style.maxWidth = sizing.rowMaxWidth + 'px'
    rowLabels[i].style.whiteSpace = 'normal'
    rowLabels[i].style.wordWrap = 'break-word'
    rowLabels[i].style.overflowWrap = 'break-word'
    var computed = window.getComputedStyle(rowLabels[i])
    console.log('Row label ' + i + ' - width: ' + computed.width + ', white-space: ' + computed.whiteSpace + ', overflow: ' + computed.overflow)
  }

  // Also apply to corner cell
  var cornerCells = document.querySelectorAll('.row-label-header, .gridTable th:first-child')
  console.log('Found corner cells:', cornerCells.length)

  for (var j = 0; j < cornerCells.length; j++) {
    cornerCells[j].style.width = sizing.rowWidth + 'px'
    cornerCells[j].style.minWidth = '80px'
    cornerCells[j].style.maxWidth = sizing.rowMaxWidth + 'px'
  }
}

/**
 * Reapply intelligent sizing on window resize
 */
function setupResizeHandler(params) {
  var resizeTimeout
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(function () {
      var sizing = applyIntelligentHeaderSizing(params)
      applyRowHeaderWidths(sizing)
    }, 150)
  })
}

function generateTable(params) {
  console.log('=== GENERATE TABLE (ENHANCED MODE) ===')
  console.log('Params: rows=' + params.rows + ', cols=' + params.cols)

  // Apply intelligent header sizing based on column count and screen size
  var sizing = applyIntelligentHeaderSizing(params)
  setupResizeHandler(params)

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

  // Generate colgroup for explicit column widths (important for table-layout: fixed)
  var colgroup = document.createElement('colgroup')

  // Row header column
  var rowHeaderCol = document.createElement('col')
  rowHeaderCol.style.width = sizing.rowWidth + 'px'
  colgroup.appendChild(rowHeaderCol)

  // Calculate data column width - distribute remaining space evenly
  var effectiveCols = params.cols
  if (params.showHistorical && params.historicalDisplay === 'columns') {
    effectiveCols = params.cols * 2
  }
  if (params.total === 'row') {
    effectiveCols += 1
  }

  // Data columns - use equal distribution
  for (var c = 0; c < effectiveCols; c++) {
    var dataCol = document.createElement('col')
    // Let data columns auto-size by not setting explicit width
    colgroup.appendChild(dataCol)
  }

  table.appendChild(colgroup)
  console.log('Generated colgroup with ' + (effectiveCols + 1) + ' columns')

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

  // Apply row header widths directly after table is in DOM
  applyRowHeaderWidths(sizing)

  console.log('Table generated, setting up events...')
  setupCellEventListeners()

  console.log('Loading existing data...')
  loadExistingData(params)

  console.log('=== END GENERATE TABLE ===')
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

  // Historical value display (inline mode OR toggle mode — prepend above input)
  if (params.showHistorical && (params.historicalDisplay === 'top' || params.historicalDisplay === 'toggle')) {
    var histValue = getHistoricalValue(params.historicalData, rowIndex, colIndex)
    debugLog('Historical value for [' + rowIndex + '][' + colIndex + ']:', histValue)

    if (histValue !== null && histValue !== undefined) {
      var histSpan = document.createElement('span')
      histSpan.className = params.historicalDisplay === 'toggle' ? 'toggle-historical' : 'top-historical'
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

  // Plugin required field handling
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

  // Historical value display (bottom mode — append below input)
  if (params.showHistorical && params.historicalDisplay === 'bottom') {
    var histValueBottom = getHistoricalValue(params.historicalData, rowIndex, colIndex)
    debugLog('Historical value (bottom) for [' + rowIndex + '][' + colIndex + ']:', histValueBottom)

    if (histValueBottom !== null && histValueBottom !== undefined) {
      var histSpanBottom = document.createElement('span')
      histSpanBottom.className = 'bottom-historical'
      histSpanBottom.textContent = params.formatNumbers ? formatNumber(histValueBottom, true) : histValueBottom
      histSpanBottom.setAttribute('role', 'note')
      histSpanBottom.setAttribute('aria-label', params.historicalLabel + ': ' + histValueBottom)
      histSpanBottom.title = params.historicalLabel + ': ' + histValueBottom
      container.appendChild(histSpanBottom)
      debugLog('Added bottom historical span with value:', histValueBottom)
    }
  }

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

        // Skip filtering if we're loading data
        if (this.getAttribute('data-loading') === 'true') {
          return
        }

        var rawValue = this.value
        var cursorPosition = this.selectionStart

        // Check if this value matches the originally loaded value (before formatting)
        var loadedValue = this.getAttribute('data-loaded-value')
        var isLoadedValue = loadedValue && unformatNumber(rawValue) === unformatNumber(loadedValue)

        if (isLoadedValue) {
          debugLog('Input matches loaded value, skipping decimal filtering')
          // Clear the loaded value flag after first check
          this.removeAttribute('data-loaded-value')
          // Continue with normal processing (formatting, validation, saving)
          // but skip the decimal filtering step
        } else {
          // Unformat first to remove thousands separators, then apply decimal filtering
          var workingValue = params.formatNumbers ? unformatNumber(rawValue) : rawValue

          // Apply decimal filtering on the unformatted value
          var filteredValue = filterDecimalInput(workingValue, params.allowDecimals)

          if (filteredValue !== workingValue) {
            // Value was modified by decimal filtering
            rawValue = filteredValue
            // We'll update the input value below in the formatting section
            // For now, just update if no formatting will be applied
            if (!params.formatNumbers) {
              this.value = filteredValue
              // Try to maintain cursor position
              try {
                this.setSelectionRange(cursorPosition, cursorPosition)
              } catch (e) {
                debugLog('Error setting cursor position:', e)
              }
            }
          } else {
            // Use the unformatted value for further processing
            rawValue = workingValue
          }
        }

        // Real-time formatting with smart cursor positioning
        if (params.formatNumbers && rawValue) {
          // rawValue is already unformatted at this point
          var unformatted = rawValue

          if (unformatted && !isNaN(unformatted)) {
            var formatted = formatNumber(unformatted, true)

            // Always update if different from the current display value
            if (formatted !== this.value) {
              // Set flag to prevent recursive formatting
              this._isFormatting = true

              // Improved cursor positioning for longer numbers
              var originalValue = this.value
              var digitsBeforeCursor = 0
              for (var j = 0; j < Math.min(cursorPosition, originalValue.length); j++) {
                if (originalValue[j] !== ',' && originalValue[j] !== ' ') {
                  digitsBeforeCursor++
                }
              }

              // Set the formatted value
              this.value = formatted

              // Find the new cursor position by counting the same number of non-comma characters
              var newPosition = 0
              var digitCount = 0
              for (var k = 0; k < formatted.length; k++) {
                if (formatted[k] !== ',' && formatted[k] !== ' ') {
                  digitCount++
                }
                if (digitCount === digitsBeforeCursor) {
                  newPosition = k + 1
                  break
                }
              }

              // Handle edge cases
              if (newPosition === 0 && digitsBeforeCursor === 0) {
                newPosition = 0
              } else if (newPosition === 0) {
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

      // Handle keypress for decimal separator conversion
      input.addEventListener('keypress', function (e) {
        if (!params.allowDecimals) {
          // Prevent decimal point entry (both comma and dot)
          if (e.key === '.' || e.key === ',') {
            e.preventDefault()
          }
        } else {
          // Convert comma to dot for decimal separator (user-friendly)
          if (e.key === ',') {
            e.preventDefault()
            // Insert a dot instead
            var start = this.selectionStart
            var end = this.selectionEnd
            var value = this.value
            this.value = value.substring(0, start) + '.' + value.substring(end)
            this.setSelectionRange(start + 1, start + 1)
            // Trigger input event to handle formatting and validation
            this.dispatchEvent(new Event('input', { bubbles: true }))
            return
          }
        }
      })

    } else {
      debugLog('Setting up STANDARD input handling for input:', input)
      // Standard input handling with debouncing AND comma-to-dot conversion
      input.addEventListener('input', function () {
        // Always convert commas to dots for numeric inputs (prevent column splitting)
        if (params.numbersAppearance || params.allowDecimals) {
          var rawValue = this.value
          var cursorPosition = this.selectionStart

          // Check if this value matches the originally loaded value
          var loadedValue = this.getAttribute('data-loaded-value')
          var isLoadedValue = loadedValue && rawValue === loadedValue

          if (!isLoadedValue) {
            // Apply comma-to-dot conversion
            var filteredValue = filterDecimalInput(rawValue, params.allowDecimals)
            if (filteredValue !== rawValue) {
              this.value = filteredValue
              // Try to maintain cursor position
              try {
                this.setSelectionRange(cursorPosition, cursorPosition)
              } catch (e) {
                debugLog('Error setting cursor position:', e)
              }
            }
          } else {
            // Clear the loaded value flag after first check
            this.removeAttribute('data-loaded-value')
          }
        }

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

      // Handle keypress for decimal separator conversion
      input.addEventListener('keypress', function (e) {
        if (!params.allowDecimals) {
          // Prevent decimal point entry (both comma and dot)
          if (e.key === '.' || e.key === ',') {
            e.preventDefault()
          }
        } else {
          // Convert comma to dot for decimal separator (user-friendly)
          if (e.key === ',') {
            e.preventDefault()
            // Insert a dot instead
            var start = this.selectionStart
            var end = this.selectionEnd
            var value = this.value
            this.value = value.substring(0, start) + '.' + value.substring(end)
            this.setSelectionRange(start + 1, start + 1)
            // Trigger input event to handle any additional processing
            this.dispatchEvent(new Event('input', { bubbles: true }))
            return
          }
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

  // ALWAYS persist cell values to metadata for recovery when navigating back
  // This ensures partial data is never lost, even when validation blocks progression
  if (typeof setMetaData === 'function') {
    setMetaData(answer, true)
    debugLog('Saved cell values to metadata for recovery')
  }

  // Check if all cells are empty (critical for SurveyCTO's native required field handling)
  var allCellsEmpty = true
  for (var i = 0; i < answerMatrix.length; i++) {
    var cells = answerMatrix[i].split(',')
    for (var j = 0; j < cells.length; j++) {
      // Handle '0' as a valid value (not empty)
      if (cells[j] !== undefined && cells[j] !== null && cells[j].trim() !== '') {
        allCellsEmpty = false
        break
      }
    }
    if (!allCellsEmpty) break
  }

  // CRITICAL: Handle empty state properly
  if (allCellsEmpty) {
    debugLog('All cells empty')

    if (params.required === 1) {
      debugLog('Plugin required=1: setting empty answer to block progression')
      setAnswer('')
    } else {
      debugLog('No plugin required: clearing answer to allow SurveyCTO native required to work')
      // For SurveyCTO native required, we need to clear the answer entirely
      // This allows SurveyCTO's built-in required validation to trigger
      setAnswer('')
    }

    var hiddenInput = document.getElementById('answer-input')
    if (hiddenInput) {
      hiddenInput.value = ''
    }
    return
  }

  // Check validation constraints BEFORE checking plugin's required (if validation_strict is set)
  // This ensures that validation_strict works even when required=1
  var hasValidationConstraints = params.minValue !== null || params.maxValue !== null || params.allowDecimals === false

  if (hasValidationConstraints && params.validationStrict) {
    // Run validation check first when strict mode is enabled
    var validation = validateAllInputs(params, false) // Use hard validation messages

    if (!validation.valid) {
      // HARD validation: Block progression by NOT setting the answer
      // When used with SurveyCTO's native required=yes, this prevents moving forward
      debugLog('Hard validation failed: ' + validation.invalidCount + ' invalid inputs - blocking progression')

      // Store values in hidden input for display persistence, but don't set the official answer
      var hiddenInput = document.getElementById('answer-input')
      if (hiddenInput) {
        hiddenInput.value = answer
        hiddenInput.setAttribute('data-pending-answer', answer)
      }

      // Focus on the first invalid input to make the validation message visible
      if (validation.invalidInputs && validation.invalidInputs.length > 0) {
        var firstInvalidInput = validation.invalidInputs[0].input
        setTimeout(function () {
          if (firstInvalidInput && !firstInvalidInput.classList.contains('focused')) {
            firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      }

      // Clear the answer to block progression (SurveyCTO's required=yes will prevent moving forward)
      setAnswer('')
      return
    }
  }

  // Now check plugin's required logic (validation has already passed if validation_strict was set)
  if (params.required === 1) {
    checkAllRequired(answer)
    return // Exit here - checkAllRequired will handle setting the answer
  }

  // For non-plugin-required fields without strict validation, check validation constraints with soft messages
  if (hasValidationConstraints && !params.validationStrict) {
    var validation = validateAllInputs(params, true) // Use soft validation messages

    if (!validation.valid) {
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
    // Clear invalid answer flag when data becomes valid
    hiddenInput.removeAttribute('data-invalid-answer')
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

  // Fallback 1: Check metadata for persisted values (survives navigation, form exit/resume, crashes)
  // This is the primary recovery mechanism for partial data that wasn't officially saved
  if (!currentAnswer && typeof getMetaData === 'function') {
    var metadataAnswer = getMetaData()
    if (metadataAnswer) {
      currentAnswer = metadataAnswer
      debugLog('Recovered cell values from metadata:', currentAnswer)
    }
  }

  // Fallback 2: Check for pending answer from failed validation (stored in hidden input)
  if (!currentAnswer) {
    var hiddenInput = document.getElementById('answer-input')
    var pendingAnswer = hiddenInput ? hiddenInput.getAttribute('data-pending-answer') : null
    if (pendingAnswer) {
      currentAnswer = pendingAnswer
      debugLog('Using pending answer from failed validation:', currentAnswer)
    }
  }

  if (!currentAnswer) return

  debugLog('Loading existing data:', currentAnswer)

  try {
    // Detect data format: enhanced mode uses 'row1col1,row1col2|row2col1,row2col2'
    // Legacy mode uses flat 'val1|val2|val3|val4|'
    var rows = currentAnswer.split('|')
    var totalCells = params.rows * params.cols

    // Detect if this is legacy format (flat pipe-separated with trailing pipe)
    // Legacy format has more pipe segments than rows (one per cell + possible trailing empty)
    var isLegacyFormat = rows.length > params.rows &&
      (rows.length === totalCells || rows.length === totalCells + 1)

    debugLog('Data format detection - isLegacyFormat:', isLegacyFormat, 'rows:', rows.length, 'expected rows:', params.rows)

    if (isLegacyFormat) {
      // Legacy format: flat pipe-separated values
      var cellIndex = 0
      for (var rowIndex = 0; rowIndex < params.rows; rowIndex++) {
        for (var colIndex = 0; colIndex < params.cols; colIndex++) {
          var input = document.querySelector('input[data-row="' + rowIndex + '"][data-col="' + colIndex + '"]')
          var value = rows[cellIndex] || ''
          cellIndex++

          if (input && value && value.trim() !== '') {
            loadValueIntoInput(input, value, params)
          }
        }
      }
    } else {
      // Enhanced format: comma-separated within rows, pipe between rows
      for (var rowIndex = 0; rowIndex < Math.min(rows.length, params.rows); rowIndex++) {
        var cells = rows[rowIndex].split(',')

        for (var colIndex = 0; colIndex < Math.min(cells.length, params.cols); colIndex++) {
          var input = document.querySelector('input[data-row="' + rowIndex + '"][data-col="' + colIndex + '"]')
          var value = cells[colIndex]

          // Check for actual value (not just truthy - handle '0' correctly)
          if (input && value !== undefined && value !== null && value.trim() !== '') {
            loadValueIntoInput(input, value, params)
          }
        }
      }
    }

    // Update totals after loading data
    setTimeout(function () {
      updateTotals(params)
    }, 100)

    // Restore validation state after loading data
    setTimeout(function () {
      restoreValidationState(params)
    }, 150)
  } catch (error) {
    debugLog('Error loading existing data:', error)
  }
}

function loadValueIntoInput(input, value, params) {
  // Store the original loaded value for comparison
  input.setAttribute('data-loaded-value', value)

  // Format the value if number formatting is enabled AND the input is not focused
  if (params.formatNumbers && value && !isNaN(value) && input !== document.activeElement) {
    value = formatNumber(value, true)
  }

  // Set a flag to indicate we're loading data (prevent filtering during load)
  input.setAttribute('data-loading', 'true')
  input.value = value

  // Remove the loading flag after setting the value
  requestAnimationFrame(function (inp) {
    return function () {
      requestAnimationFrame(function () {
        inp.removeAttribute('data-loading')
      })
    }
  }(input))
}

/**
 * Restore validation state for all inputs after loading data
 * This ensures validation styling persists when navigating back to the field
 */
function restoreValidationState(params) {
  debugLog('Restoring validation state after data load')

  var hasValidationConstraints = params.minValue !== null || params.maxValue !== null || params.allowDecimals === false
  if (!hasValidationConstraints) {
    debugLog('No validation constraints, skipping validation state restore')
    return
  }

  // Determine if we should use soft or hard validation
  var useSoftValidation = !params.validationStrict

  var inputs = document.querySelectorAll('.cell-input')
  for (var i = 0; i < inputs.length; i++) {
    var input = inputs[i]
    if (input.value) {
      var validation = validateNumericInput(input.value, params, useSoftValidation)
      showValidationMessage(input, validation.message, validation.valid, useSoftValidation)
    }
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
  console.log('=== GENERATE TABLE (LEGACY MODE) ===')
  console.log('Params: rows=' + unifiedParams.rows + ', cols=' + unifiedParams.cols)

  // Apply intelligent header sizing for legacy mode
  var legacyParams = {
    cols: unifiedParams.cols,
    rows: unifiedParams.rows,
    showHistorical: false,
    historicalDisplay: 'bottom',
    total: ''
  }
  var sizing = applyIntelligentHeaderSizing(legacyParams)
  setupResizeHandler(legacyParams)

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
      table += '<th scope="row" class="default-hint-text-size" dir="auto">' + unEntity(rowHeader) + '</th>'
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
    // Apply row header widths directly after table is in DOM
    applyRowHeaderWidths(sizing)
    console.log('Legacy table generated successfully')
  } else {
    console.log('Table holder not found')
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
  var hasAnyValue = false

  for (var q = 0; q < cells.length; q++) {
    var cell = cells[q]
    var cellvalue = cell ? cell.value : ''
    cellValues = cellValues + cellvalue + '|'

    // Check if any cell has a value
    if (cellvalue && cellvalue.trim() !== '') {
      hasAnyValue = true
    }
  }

  // ALWAYS persist cell values to metadata for recovery when navigating back
  if (typeof setMetaData === 'function') {
    setMetaData(cellValues, true)
    debugLog('Legacy mode: Saved cell values to metadata for recovery')
  }

  // CRITICAL: Handle empty state properly
  if (!hasAnyValue) {
    debugLog('Legacy mode: All cells empty')

    if (required === 1) {
      debugLog('Legacy mode - Plugin required=1: setting empty answer to block progression')
      setAnswer('')
    } else {
      debugLog('Legacy mode - No plugin required: clearing answer to allow SurveyCTO native required to work')
      // For SurveyCTO native required, we need to clear the answer entirely
      // This allows SurveyCTO's built-in required validation to trigger
      setAnswer('')
    }
    return ''
  }

  // We have data, proceed with normal logic
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

    // Use preventScroll to avoid pushing the label out of view.
    // The table container is independently scrollable, so focus
    // should not cause the entire iframe to scroll.
    firstInput.focus({ preventScroll: true })

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
 * Constrain the table container height so the label and controls above it
 * always remain visible. The table becomes independently scrollable when
 * its content exceeds the available space.
 */
function applyTableContainerHeight() {
  var container = document.getElementById('table-container')
  if (!container) return

  // Clear any previously set max-height so we can measure the table's natural height
  container.style.maxHeight = ''

  // The plugin runs inside an iframe. 100vh inside the iframe equals the iframe's
  // own content height (because iframeResizer sizes the iframe to fit), which is
  // useless for constraining. We need the PARENT window's viewport height instead.
  var availableHeight
  try {
    availableHeight = window.parent.innerHeight
  } catch (e) {
    // Cross-origin: fall back to our own viewport (better than nothing)
    availableHeight = window.innerHeight
  }

  if (!availableHeight || availableHeight <= 0) return

  // Measure everything above the table container (label, hint, controls)
  var aboveHeight = 0
  var sibling = container.previousElementSibling
  while (sibling) {
    var style = window.getComputedStyle(sibling)
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      aboveHeight += sibling.offsetHeight
      aboveHeight += parseInt(style.marginTop, 10) || 0
      aboveHeight += parseInt(style.marginBottom, 10) || 0
    }
    sibling = sibling.previousElementSibling
  }

  // Account for container's own margins
  var containerStyle = window.getComputedStyle(container)
  var containerMargin = (parseInt(containerStyle.marginTop, 10) || 0) +
    (parseInt(containerStyle.marginBottom, 10) || 0)

  // Reserve space for: content above table + container margins + SurveyCTO chrome
  // (form header, nav buttons, padding). ~180px is a conservative estimate for
  // the parent page chrome that surrounds the iframe.
  var parentChrome = 180
  var reservedHeight = aboveHeight + containerMargin + parentChrome
  var maxTableHeight = availableHeight - reservedHeight

  // Only constrain if the table's natural height actually exceeds available space.
  // This lets small tables render at full size without unnecessary scrolling.
  var tableNaturalHeight = container.scrollHeight

  if (tableNaturalHeight > maxTableHeight && maxTableHeight > 100) {
    container.style.maxHeight = maxTableHeight + 'px'
    debugLog('Table container constrained: natural=' + tableNaturalHeight +
      'px, max=' + maxTableHeight + 'px (parentVH=' + availableHeight +
      ', above=' + aboveHeight + ', chrome=' + parentChrome + ')')
  } else {
    debugLog('Table container unconstrained: natural=' + tableNaturalHeight +
      'px fits within max=' + maxTableHeight + 'px')
  }
}

function initializeTableGrid() {
  try {
    console.log('=== TABLE GRID INITIALIZATION ===')

    // Determine which mode to use
    var useEnhancedMode = shouldUseEnhancedMode()
    console.log('Mode detection - Enhanced mode:', useEnhancedMode)
    console.log('Unified params: rows=' + unifiedParams.rows + ', cols=' + unifiedParams.cols)

    if (useEnhancedMode) {
      console.log('>>> Using ENHANCED mode')
      initializeEnhancedMode()
    } else {
      console.log('>>> Using LEGACY mode')
      initializeLegacyMode()
    }

    // Common initialization for both modes
    setupCommonFeatures()

    // Constrain table container height so label stays visible
    applyTableContainerHeight()

    // Recalculate on resize (orientation change, window resize)
    var resizeHeightTimeout
    window.addEventListener('resize', function () {
      clearTimeout(resizeHeightTimeout)
      resizeHeightTimeout = setTimeout(applyTableContainerHeight, 200)
    })

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