/* global fieldProperties, setAnswer, getPluginParameter */

// ====================
// DEBUG MODE
// ====================

// Set to true for development debugging. Must be false in shipped builds —
// otherwise every plug-in instance floods the host JS console.
var DEBUG_MODE = false

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

// Whitespace-tokenized appearance check. Substring matching ('numbers' as
// a substring of, say, 'numbers-only' or a prefixed 'custom-numbers-grid')
// would false-match; tokenization treats the appearance value as a list of
// space-separated keywords, which is how SurveyCTO documents the column.
function hasAppearanceToken(token) {
  var appearance = fieldProperties && fieldProperties.APPEARANCE
  if (!appearance) return false
  var tokens = String(appearance).split(/\s+/)
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i] === token) return true
  }
  return false
}

// Parse a numeric value or return null. Strict: rejects partial-number
// strings like "12abc", "1.2.3", or "10|20" that parseFloat would happily
// accept. Empty / null / undefined → null (treated as unconstrained).
var STRICT_NUMERIC_RE = /^-?\d+(\.\d+)?$/

function parseNumericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  var s = String(value).trim()
  if (s === '') return null
  if (!STRICT_NUMERIC_RE.test(s)) return null
  var n = Number(s)
  return isFinite(n) ? n : null
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

  // Honor the documented legacy aliases (columns/row_headers/column_headers).
  // Without this, a form that sets columns=2 plus any enhanced flag would
  // route to enhanced mode but silently fall back to cols=4 + missing labels.
  var rawParams = {
    rows: getUnifiedParameter(['rows'], '3'),
    cols: getUnifiedParameter(['cols', 'columns'], '4'),
    row_labels: getUnifiedParameter(['row_labels', 'row_headers'], ''),
    col_labels: getUnifiedParameter(['col_labels', 'column_headers'], ''),
    show_historical: safeGetPluginParameter('show_historical', 'false'),
    historical_data: safeGetPluginParameter('historical_data', ''),
    historical_display: safeGetPluginParameter('historical_display', 'bottom'),
    total: safeGetPluginParameter('total', ''),
    subtotals: safeGetPluginParameter('subtotals', ''),
    grid_total: safeGetPluginParameter('grid_total', ''),
    format_numbers: safeGetPluginParameter('format_numbers', 'false'),
    min_value: safeGetPluginParameter('min_value', ''),
    max_value: safeGetPluginParameter('max_value', ''),
    allow_decimals: safeGetPluginParameter('allow_decimals', 'true'),
    validation_strict: safeGetPluginParameter('validation_strict', 'false'),
    frame_adjust: safeGetPluginParameter('frame_adjust', '0'),
    row_label_width: safeGetPluginParameter('row_label_width', ''),
    data_column_width: safeGetPluginParameter('data_column_width', ''),
    column_widths: safeGetPluginParameter('column_widths', ''),
    pinned_headers: safeGetPluginParameter('pinned_headers', 'auto')
  }

  debugLog('Raw parameters:', rawParams)

  var params = {
    rows: parsePositiveInt(rawParams.rows, 3),
    cols: parsePositiveInt(rawParams.cols, 4),
    rowLabels: parseLabels(rawParams.row_labels),
    colLabels: parseLabels(rawParams.col_labels),
    showHistorical: rawParams.show_historical === 'true',
    historicalData: parseHistoricalData(rawParams.historical_data),
    // 'inline' was renamed to 'top' in v2.0.x — keep it as a backward-compat
    // alias so existing forms that still pass historical_display=inline keep
    // rendering correctly. README documents top/bottom/columns/toggle only.
    historicalDisplay: normalizeHistoricalDisplay(rawParams.historical_display),
    historicalLabel: safeGetPluginParameter('historical_label', 'Last Year'),
    numbersAppearance: hasAppearanceToken('numbers'),

    required: parsePositiveInt(safeGetPluginParameter('required', '0'), 0),

    total: rawParams.total,
    totalLabel: safeGetPluginParameter('total_label', 'Total'),
    subtotalReferenceLabel: safeGetPluginParameter('subtotal_reference_label', 'Calculated'),
    formatNumbers: rawParams.format_numbers === 'true',
    minValue: parseNumericOrNull(rawParams.min_value),
    maxValue: parseNumericOrNull(rawParams.max_value),
    allowDecimals: rawParams.allow_decimals !== 'false',
    validationStrict: rawParams.validation_strict === 'true',
    frameAdjust: parseInt(rawParams.frame_adjust, 10) || 0,

    // Column width controls. `rowLabelWidth` and `dataColumnWidth` accept
    // "<N>px" or "<N>%". `columnWidths` is a list (pipe- or comma-separated)
    // that overrides the other two when present; entries may be unitless
    // proportional shares ("2|1|1|1") or explicit "<N>px"/"<N>%". Parsing
    // happens lazily in applyColumnWidths so cols-count is known.
    rowLabelWidth: parseColumnWidth(rawParams.row_label_width),
    dataColumnWidth: parseColumnWidth(rawParams.data_column_width),
    columnWidths: rawParams.column_widths ? String(rawParams.column_widths).trim() : '',

    // pinned_headers='auto' (default, current behavior), 'always' (force
    // bounded scroll context), or 'never' (skip applyTableContainerHeight
    // entirely — table renders at natural height, the form scrolls instead).
    pinnedHeaders: normalizePinnedHeaders(rawParams.pinned_headers),

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

  // Subtotal groups. Parsed here (rather than at init) so every caller of
  // getTableParameters sees the same model; errors are surfaced once, at
  // render time, by generateTable.
  params.subtotalConfig = parseSubtotalConfig(rawParams.subtotals, rawParams.grid_total, params.rows)

  // total='row' renders a totals COLUMN on the right (the naming is
  // counter-intuitive; see README). Subtotals sum down rows into a row, so
  // the two layouts can't coexist.
  if (params.subtotalConfig.configured && params.total === 'row') {
    params.subtotalConfig.errors.push(
      "total='row' adds a totals column on the right, which cannot be combined with subtotal groups. " +
      "Subtotals sum down rows, so use total='column' or remove the total parameter.")
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

// Parse a width value in "<N>px" or "<N>%" form. Returns the original
// string if valid, or null. Empty/null/undefined → null. Unit-less numbers
// are treated as pixels (e.g., "220" → "220px") for ergonomics.
var WIDTH_VALUE_RE = /^(\d+(?:\.\d+)?)\s*(px|%)?$/

function parseColumnWidth(value) {
  if (value === null || value === undefined || value === '') return null
  var s = String(value).trim()
  if (!s) return null
  var m = WIDTH_VALUE_RE.exec(s)
  if (!m) return null
  var unit = m[2] || 'px'
  return m[1] + unit
}

// ====================
// SUBTOTAL GROUP PARSING
// ====================

/**
 * Parse a source-row reference list: "1-3", "3,6,7", or "1-2,5".
 *
 * Row numbers in the parameter are 1-based, matching how an author counts
 * their own row_labels list. Returned indices are 0-based, matching every
 * other row index in this file.
 *
 * Returns null on any malformed token so the caller can fail loudly. Unlike
 * column_widths — where ignoring a bad spec still yields a correct grid at
 * default widths — a silently ignored subtotal spec renders a grid that
 * looks complete and sums nothing.
 */
/**
 * Strict positive-integer parse. parseInt is deliberately NOT used here:
 * it stops at the first non-digit, so "3oops" would parse as 3 and "1-2junk"
 * as 1-2. A typo in a subtotal spec must fail loudly, not silently resolve
 * to a plausible-looking row number and sum the wrong cells.
 */
var ROW_INT_RE = /^\d+$/

function parseStrictRowNumber(token) {
  var t = String(token).trim()
  if (!ROW_INT_RE.test(t)) return null
  var n = parseInt(t, 10)
  return isNaN(n) ? null : n
}

function parseRowRefs(spec, rows) {
  if (spec === null || spec === undefined) return null
  var out = []
  var parts = String(spec).split(',')
  for (var i = 0; i < parts.length; i++) {
    var token = parts[i].trim()
    if (!token) return null
    var dash = token.indexOf('-')
    if (dash > 0) {
      var from = parseStrictRowNumber(token.slice(0, dash))
      var to = parseStrictRowNumber(token.slice(dash + 1))
      if (from === null || to === null) return null
      if (from < 1 || to < 1 || from > rows || to > rows || to < from) return null
      for (var r = from; r <= to; r++) out.push(r - 1)
    } else {
      var n = parseStrictRowNumber(token)
      if (n === null || n < 1 || n > rows) return null
      out.push(n - 1)
    }
  }
  return out.length ? out : null
}

/** Parse one "<target>:<sources>" entry into 0-based indices, or null. */
function parseGroupEntry(entry, rows) {
  var colon = entry.indexOf(':')
  if (colon < 1) return null
  var target = parseStrictRowNumber(entry.slice(0, colon))
  if (target === null || target < 1 || target > rows) return null
  var sources = parseRowRefs(entry.slice(colon + 1), rows)
  if (!sources) return null
  return { target: target - 1, sources: sources }
}

/**
 * Build the subtotal model from `subtotals` and `grid_total`.
 *
 * Groups come back in evaluation order — subtotal groups as declared, the
 * grid total last — so a single pass computes nested sums correctly. That
 * ordering is enforced, not assumed: a group that sums a subtotal declared
 * later is a configuration error.
 *
 * One-off rows (AHA's "Other government", "Self-pay") need no configuration.
 * They are ordinary rows listed among grid_total's sources, which is why
 * nothing here can render a duplicate subtotal row for them.
 */
function parseSubtotalConfig(subtotalsSpec, gridTotalSpec, rows) {
  var model = { configured: false, groups: [], targets: {}, errors: [] }

  var haveSub = subtotalsSpec !== null && subtotalsSpec !== undefined && String(subtotalsSpec).trim() !== ''
  var haveTotal = gridTotalSpec !== null && gridTotalSpec !== undefined && String(gridTotalSpec).trim() !== ''
  if (!haveSub && !haveTotal) return model
  model.configured = true

  var entries = []

  if (haveSub) {
    var chunks = String(subtotalsSpec).split('|')
    for (var i = 0; i < chunks.length; i++) {
      var raw = chunks[i].trim()
      if (!raw) continue
      var g = parseGroupEntry(raw, rows)
      if (!g) {
        model.errors.push('subtotals: could not read "' + raw +
          '". Expected <subtotal row>:<rows it sums>, for example 3:1-2. Row numbers start at 1 and must be between 1 and ' + rows + '.')
        continue
      }
      g.isTotal = false
      entries.push(g)
    }
  }

  if (haveTotal) {
    var traw = String(gridTotalSpec).trim()
    if (traw.indexOf('|') >= 0) {
      model.errors.push('grid_total: only one total row is supported, but more than one entry was given.')
    } else {
      var t = parseGroupEntry(traw, rows)
      if (!t) {
        model.errors.push('grid_total: could not read "' + traw +
          '". Expected <total row>:<rows it sums>, for example 12:3,6,7. Row numbers start at 1 and must be between 1 and ' + rows + '.')
      } else {
        t.isTotal = true
        entries.push(t)
      }
    }
  }

  var seenTarget = {}
  for (var j = 0; j < entries.length; j++) {
    var e = entries[j]
    var label = (e.isTotal ? 'grid_total' : 'subtotals') + ': row ' + (e.target + 1)
    var ok = true

    if (seenTarget[e.target]) {
      model.errors.push(label + ' is defined more than once. A row can hold only one subtotal or total.')
      continue
    }
    seenTarget[e.target] = true

    var seenSource = {}
    for (var k = 0; k < e.sources.length; k++) {
      if (e.sources[k] === e.target) {
        model.errors.push(label + ' includes itself in the rows it sums.')
        ok = false
      }
      // A row listed twice would be counted twice. Never intentional in a
      // subtotal, and silently doubling a line item is exactly the kind of
      // wrong-but-plausible total this parser exists to prevent.
      if (seenSource[e.sources[k]]) {
        model.errors.push(label + ' lists row ' + (e.sources[k] + 1) +
          ' more than once, which would count it twice.')
        ok = false
      }
      seenSource[e.sources[k]] = true
      for (var n = j + 1; n < entries.length; n++) {
        if (entries[n].target === e.sources[k]) {
          model.errors.push(label + ' sums row ' + (e.sources[k] + 1) +
            ', which is itself a subtotal defined later. Declare inner subtotals before the rows that use them.')
          ok = false
        }
      }
    }

    if (ok) {
      model.groups.push(e)
      model.targets[e.target] = e
    }
  }

  return model
}

/** True when this row holds a subtotal or the grid total. */
function isSubtotalRow(params, rowIndex) {
  if (!params.subtotalConfig || isNaN(rowIndex) || rowIndex < 0) return false
  return !!params.subtotalConfig.targets[rowIndex]
}

/** True when this row holds the grid total specifically. */
function isGridTotalRow(params, rowIndex) {
  if (!params.subtotalConfig || isNaN(rowIndex) || rowIndex < 0) return false
  var g = params.subtotalConfig.targets[rowIndex]
  return !!(g && g.isTotal)
}

/**
 * Per-cell validation options. A subtotal is larger than the items it sums
 * by construction, so a max_value sized for a line item would reject it.
 * min_value still applies: if every component is above a floor, so is
 * their sum, and an overridden subtotal should respect it too.
 */
function validationOptionsFor(params, input) {
  if (!input || !params.subtotalConfig || !params.subtotalConfig.configured) return null
  var row = parseInt(input.getAttribute('data-row'), 10)
  return isSubtotalRow(params, row) ? { skipMax: true } : null
}

function normalizePinnedHeaders(value) {
  if (!value) return 'auto'
  var v = String(value).trim().toLowerCase()
  if (v === 'always' || v === 'never' || v === 'auto') return v
  return 'auto'
}

/**
 * Normalize historical_display values. 'inline' is the legacy name for 'top'
 * — older READMEs and form configurations still use it. Default is 'bottom'.
 */
function normalizeHistoricalDisplay(value) {
  if (!value) return 'bottom'
  var v = String(value).trim().toLowerCase()
  if (v === 'inline') return 'top'
  return v
}

function parseHistoricalData(dataString) {
  debugLog('Raw historical data parameter:', dataString)

  if (!dataString) return null

  // Remove surrounding quotes and normalise whitespace. XPath substitution can
  // inject CR/LF/non-breaking spaces, especially when the matrix is built via
  // concat() across multiple lines in a calculate.
  var cleanString = dataString
    .replace(/^['"]|['"]$/g, '')
    .replace(/ /g, ' ')
    .replace(/[\r\n\t]+/g, ' ')

  debugLog('Cleaned historical data:', cleanString)

  if (!cleanString.trim()) return null

  // JSON-array fallback: lets advanced users build the matrix in a dataset
  // and side-step ',' / '|' collisions with thousands separators in their data.
  // Format: [["100","200"],["300","400"]]
  var trimmed = cleanString.trim()
  if (trimmed.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every(function (r) { return Array.isArray(r) })) {
        var jsonResult = parsed.map(function (row) {
          return row.map(function (cell) {
            return cell === null || cell === undefined ? '' : String(cell).trim()
          })
        })
        debugLog('Parsed historical data (JSON):', jsonResult)
        return jsonResult
      }
      debugLog('Historical data JSON is not a 2D array, falling back to delimited parse')
    } catch (jsonError) {
      debugLog('Historical data JSON parse failed, falling back to delimited parse:', jsonError)
    }
  }

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
    'subtotals', 'grid_total', // Subtotal groups imply the enhanced matrix format
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
  historicalDisplay: normalizeHistoricalDisplay(getUnifiedParameter(['historical_display'], 'bottom')),
  historicalLabel: getUnifiedParameter(['historical_label'], 'Last Year'),
  total: getUnifiedParameter(['total'], ''),
  totalLabel: getUnifiedParameter(['total_label'], 'Total'),
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

/**
 * A grid is "numeric" when the form author has signalled numeric input via
 * the `numbers` appearance, format_numbers=true, or min/max constraints.
 * In numeric grids, comma→dot decimal-separator conversion is a feature.
 * In text grids, the same conversion silently mutates user input ("Smith,
 * John" → "Smith. John"), so it must be disabled.
 */
function isNumericGrid(params) {
  if (!params) return false
  return !!(params.numbersAppearance ||
    params.formatNumbers ||
    params.minValue !== null ||
    params.maxValue !== null)
}

/**
 * Strip characters that would corrupt the serialized answer format. Pipe
 * separates rows in both legacy and enhanced output; comma separates
 * columns in enhanced output. Keypress already blocks typed delimiters,
 * but this catches pasted content (and a clipboard "1,234\n5,678" that
 * would otherwise embed real commas / newlines into the matrix).
 */
function stripDelimiterChars(value, blockComma) {
  if (!value) return value
  var out = String(value).replace(/\|/g, '').replace(/[\r\n\t]+/g, ' ')
  if (blockComma) out = out.replace(/,/g, '')
  return out
}

/**
 * Apply stripDelimiterChars to an input element in place, preserving the
 * caret position when possible.
 */
function sanitizeInputValue(input, blockComma) {
  if (!input) return
  var raw = input.value
  var cleaned = stripDelimiterChars(raw, blockComma)
  if (cleaned === raw) return
  var pos = input.selectionStart != null ? input.selectionStart : cleaned.length
  // Adjust caret for any chars stripped before it.
  var removedBeforeCaret = raw.substring(0, pos).length - stripDelimiterChars(raw.substring(0, pos), blockComma).length
  input.value = cleaned
  try {
    input.setSelectionRange(pos - removedBeforeCaret, pos - removedBeforeCaret)
  } catch (e) {
    // ignore — some input modes reject setSelectionRange
  }
}

function filterDecimalInput(value, allowDecimals, isNumeric) {
  if (!value) return value

  // Outside numeric grids, leave the user's text alone — commas are valid
  // text content there, and the comma→dot mutation would corrupt it.
  if (!isNumeric) return value

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

function validateNumericInput(value, params, useSoftMessages, opts) {
  useSoftMessages = useSoftMessages || false
  if (!value || value === '') return { valid: true, message: '' }

  var unformattedValue = params.formatNumbers ? unformatNumber(value) : value
  var trimmed = String(unformattedValue).trim()

  // Strict: full-string match. parseFloat would accept "12abc", "1.2.3",
  // "10|20" — all of which would silently corrupt the saved answer because
  // they pass range checks via their numeric prefix.
  if (!STRICT_NUMERIC_RE.test(trimmed)) {
    return {
      valid: false,
      message: useSoftMessages ? params.constraintMessageInvalidSoft : params.constraintMessageInvalid
    }
  }
  var num = Number(trimmed)
  if (!isFinite(num)) {
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

  // opts.skipMax is set for subtotal/total rows: a sum exceeds the ceiling
  // meant for the items it sums by construction. min_value still applies.
  if (!(opts && opts.skipMax) && params.maxValue !== null && num > params.maxValue) {
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
      var validation = validateNumericInput(input.value, params, useSoftMessages, validationOptionsFor(params, input))
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

      // Remember the input so the scroll handler can reposition this
      // tooltip when #table-container scrolls internally (the table has a
      // bounded height to keep the thead pinned, so cell positions move
      // even though the iframe doesn't scroll).
      messageDiv._validationInput = input

      input.parentNode.appendChild(messageDiv)
    }
  }
}

function positionValidationMessage(input, messageDiv) {
  // Re-positioning a previously placed tooltip: clear any previously chosen
  // direction class so we don't accumulate position-top + position-bottom
  // when the input scrolls past the viewport boundary.
  messageDiv.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right')

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

  // If the form supplies explicit widths, skip the auto-sizing entirely —
  // we don't want a window-resize event to overwrite the user's intent
  // via setupResizeHandler/applyRowHeaderWidths.
  if (params.columnWidths || params.rowLabelWidth || params.dataColumnWidth) {
    return { userSupplied: true }
  }

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

  debugLog('Intelligent sizing: cols=' + effectiveCols +
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
  debugLog('=== applyRowHeaderWidths called ===')

  if (!sizing) {
    debugLog('ERROR: No sizing object provided')
    return
  }

  // If the form supplied explicit widths, the colgroup already has them.
  // Don't fight it with inline JS styles on the cells.
  if (sizing.userSupplied) {
    debugLog('User-supplied column widths in effect, skipping row-label width override.')
    return
  }

  var rowLabels = document.querySelectorAll('.row-label, .gridTable th[scope="row"]')
  debugLog('Found row labels:', rowLabels.length)

  for (var i = 0; i < rowLabels.length; i++) {
    rowLabels[i].style.width = sizing.rowWidth + 'px'
    rowLabels[i].style.minWidth = '80px'
    rowLabels[i].style.maxWidth = sizing.rowMaxWidth + 'px'
    rowLabels[i].style.whiteSpace = 'normal'
    rowLabels[i].style.wordWrap = 'break-word'
    rowLabels[i].style.overflowWrap = 'break-word'
    var computed = window.getComputedStyle(rowLabels[i])
    debugLog('Row label ' + i + ' - width: ' + computed.width + ', white-space: ' + computed.whiteSpace + ', overflow: ' + computed.overflow)
  }

  // Also apply to corner cell
  var cornerCells = document.querySelectorAll('.row-label-header, .gridTable th:first-child')
  debugLog('Found corner cells:', cornerCells.length)

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

/**
 * Warn (in debug logs) when historical_data shape doesn't match rows x cols.
 * This surfaces XLSForm misconfigurations during testing — most often caused
 * by inline parameter values like `historical_data="${a},${b}|${c},${d}"`
 * where some `${...}` evaluates to empty or contains a comma. Building the
 * matrix in a single `concat()`-based calculate field avoids this.
 */
function validateHistoricalDataShape(params) {
  if (!params.showHistorical || !params.historicalData) return

  var data = params.historicalData
  if (!Array.isArray(data)) return

  if (data.length !== params.rows) {
    debugLog('WARNING: historical_data has ' + data.length +
      ' rows but the table expects ' + params.rows +
      '. Build it in a calculate via concat() to avoid this.')
  }

  for (var r = 0; r < data.length; r++) {
    if (Array.isArray(data[r]) && data[r].length !== params.cols) {
      debugLog('WARNING: historical_data row ' + r + ' has ' +
        data[r].length + ' cells but the table expects ' + params.cols +
        '. A comma in a referenced value (e.g. thousands separator) usually causes this.')
    }
  }
}

/**
 * Parse a column_widths spec into a list of CSS width strings, one per
 * <col> element including the leading row-label column. Accepts:
 *   - proportional shares: "2|1|1|1|1"  →  ["33.33%","16.66%",...]
 *   - explicit pixels:     "250px|80px|80px|80px|80px"
 *   - explicit percents:   "40%|15%|15%|15%|15%"
 * Returns null if the spec is empty, malformed, or doesn't match the
 * expected total column count (so the caller can fall back to other rules).
 */
function parseColumnWidthsSpec(spec, totalCols) {
  if (!spec) return null
  var clean = String(spec).replace(/^['"]|['"]$/g, '').trim()
  if (!clean) return null

  var delim = clean.indexOf('|') >= 0 ? '|' : ','
  var parts = clean.split(delim).map(function (s) { return s.trim() }).filter(Boolean)
  if (parts.length !== totalCols) {
    debugLog('column_widths: got ' + parts.length + ' entries, expected ' + totalCols + ' — ignoring.')
    return null
  }

  // Detect mode: if every entry is unit-less numeric, treat as proportional.
  var allShares = parts.every(function (p) { return /^\d+(\.\d+)?$/.test(p) })
  if (allShares) {
    var sum = parts.reduce(function (a, p) { return a + parseFloat(p) }, 0)
    if (sum <= 0) return null
    return parts.map(function (p) {
      return ((parseFloat(p) / sum) * 100).toFixed(4) + '%'
    })
  }

  // Otherwise require every entry to parse as a width.
  var widths = parts.map(parseColumnWidth)
  if (widths.some(function (w) { return w === null })) {
    debugLog('column_widths: malformed entry, ignoring spec.')
    return null
  }
  return widths
}

/**
 * Build the table <colgroup>. Width-resolution priority:
 *   1. column_widths (full per-column override)
 *   2. row_label_width / data_column_width (Tier 1 convenience)
 *   3. intelligent sizing defaults from applyIntelligentHeaderSizing
 */
function buildColgroup(params, effectiveCols, sizing) {
  var colgroup = document.createElement('colgroup')
  var totalCols = effectiveCols + 1
  var widths = parseColumnWidthsSpec(params.columnWidths, totalCols)

  // Row label column
  var rowHeaderCol = document.createElement('col')
  if (widths) {
    rowHeaderCol.style.width = widths[0]
  } else if (params.rowLabelWidth) {
    rowHeaderCol.style.width = params.rowLabelWidth
  } else if (sizing && sizing.rowWidth) {
    rowHeaderCol.style.width = sizing.rowWidth + 'px'
  }
  // else: only dataColumnWidth was supplied — leave row-label col to CSS defaults
  colgroup.appendChild(rowHeaderCol)

  // Data columns
  for (var c = 0; c < effectiveCols; c++) {
    var dataCol = document.createElement('col')
    if (widths) {
      dataCol.style.width = widths[c + 1]
    } else if (params.dataColumnWidth) {
      dataCol.style.width = params.dataColumnWidth
    }
    // else: leave unset so table-layout: fixed splits remaining space evenly
    colgroup.appendChild(dataCol)
  }

  return colgroup
}

/**
 * Replace the grid with a visible configuration error. Subtotal misconfiguration
 * fails loudly rather than falling back to a plain grid: a grid that renders
 * normally but silently sums nothing is worse than one that refuses to render.
 * The answer is cleared so the form cannot be submitted against a broken grid.
 */
function renderConfigError(messages) {
  var container = document.getElementById('table-wrapper') || document.getElementById('table-holder')
  if (!container) return

  var box = document.createElement('div')
  box.className = 'config-error'

  var heading = document.createElement('strong')
  heading.className = 'config-error-title'
  heading.textContent = 'Table grid configuration error'
  box.appendChild(heading)

  var list = document.createElement('ul')
  for (var i = 0; i < messages.length; i++) {
    var li = document.createElement('li')
    li.textContent = messages[i]
    list.appendChild(li)
  }
  box.appendChild(list)

  container.innerHTML = ''
  container.appendChild(box)

  try {
    setAnswer('')
  } catch (e) {
    debugLog('Could not clear answer on config error:', e)
  }
}

function generateTable(params) {
  debugLog('=== GENERATE TABLE (ENHANCED MODE) ===')

  if (params.subtotalConfig && params.subtotalConfig.errors.length) {
    debugLog('Subtotal configuration errors:', params.subtotalConfig.errors)
    renderConfigError(params.subtotalConfig.errors)
    return
  }

  validateHistoricalDataShape(params)
  debugLog('Params: rows=' + params.rows + ', cols=' + params.cols)

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

  // Calculate effective column count (data side, excluding row label column).
  var effectiveCols = params.cols
  if (params.showHistorical && params.historicalDisplay === 'columns') {
    effectiveCols = params.cols * 2
  }
  if (params.total === 'row') {
    effectiveCols += 1
  }

  // Generate colgroup. If the form supplies column_widths or row_label_width,
  // those win over the intelligent-sizing defaults; table-layout: fixed makes
  // the col widths authoritative.
  var colgroup = buildColgroup(params, effectiveCols, sizing)
  table.appendChild(colgroup)
  debugLog('Generated colgroup with ' + (effectiveCols + 1) + ' columns')

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

  debugLog('Table generated, setting up events...')
  setupCellEventListeners()

  debugLog('Loading existing data...')
  loadExistingData(params)

  debugLog('=== END GENERATE TABLE ===')
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
    totalHeader.textContent = params.totalLabel || 'Total'
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

    // Subtotal and grid-total rows are ordinary data rows that auto-fill.
    // Keeping them in the input matrix means serialization, loading,
    // validation and keyboard navigation need no special cases.
    if (isSubtotalRow(params, rowIndex)) {
      row.className += isGridTotalRow(params, rowIndex) ? ' grid-total-row' : ' subtotal-row'
    }

    // Row label cell. Rendered as <th scope="row"> (not <td>) for two
    // reasons: it matches what legacy mode now does, and sticky on <th>
    // is more reliable than sticky on <td> in Android System WebView.
    var labelCell = document.createElement('th')
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

        if (histValue !== null && histValue !== undefined && String(histValue).trim() !== '') {
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

    // Totals row label — rendered as <th scope="row"> for the same
    // sticky-reliability reason as the data-row labels above.
    var emptyCell = document.createElement('th')
    emptyCell.setAttribute('scope', 'row')
    emptyCell.textContent = params.totalLabel || 'Total'
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

    if (histValue !== null && histValue !== undefined && String(histValue).trim() !== '') {
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

  // Mark subtotal/total inputs so override tracking and the max_value
  // exemption can find them without re-deriving group membership.
  if (isSubtotalRow(params, rowIndex)) {
    input.setAttribute('data-subtotal', isGridTotalRow(params, rowIndex) ? 'total' : 'sub')
  }

  // Plugin required field handling
  if (params.required >= 1) {
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

    if (histValueBottom !== null && histValueBottom !== undefined && String(histValueBottom).trim() !== '') {
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

  // Reference-sum caption for subtotal/total cells. Empty and hidden until
  // the respondent overrides the cell and their figure disagrees with the
  // calculated one — while the two agree, the input already shows the
  // calculated value and a caption would just repeat it.
  if (isSubtotalRow(params, rowIndex)) {
    var calcSpan = document.createElement('span')
    calcSpan.className = 'subtotal-calc'
    calcSpan.setAttribute('data-calc-row', rowIndex)
    calcSpan.setAttribute('data-calc-col', colIndex)
    calcSpan.setAttribute('role', 'note')
    calcSpan.style.display = 'none'
    container.appendChild(calcSpan)
  }

  return container
}

// ====================
// SUBTOTAL CALCULATION & OVERRIDE
// ====================

/** Sum a group's source rows for one column. Returns null if no source holds a number. */
function calculateGroupSum(group, colIndex) {
  var sum = 0
  var hasValue = false
  for (var s = 0; s < group.sources.length; s++) {
    var src = document.querySelector('input[data-row="' + group.sources[s] + '"][data-col="' + colIndex + '"]')
    if (!src || !src.value) continue
    var n = parseFloat(unformatNumber(src.value))
    if (!isNaN(n)) {
      sum += n
      hasValue = true
    }
  }
  return hasValue ? sum : null
}

function setCellVariance(input, on) {
  var cell = input.closest ? input.closest('td') : null
  if (!cell) return
  if (on) {
    cell.classList.add('subtotal-variance')
  } else {
    cell.classList.remove('subtotal-variance')
  }
}

/** Hand an overridden cell back to automatic calculation. */
function restoreCalculated(input) {
  input.removeAttribute('data-manual')
  var params = getTableParameters()
  updateSubtotals(params)
  updateTotals(params)
  updateAnswer()
}

/**
 * Write one subtotal cell.
 *
 * Not overridden: the cell tracks the calculated sum. An empty group writes
 * an EMPTY cell, never 0 — a 0 here would make an untouched grid look
 * answered, defeating both required=1 and SurveyCTO's native required check.
 *
 * Overridden: the respondent's number stands permanently. The calculated sum
 * moves to the caption for reference, and a difference is flagged visually.
 * It is never a blocker; a genuine difference is the whole point of the feature.
 */
function applySubtotalCell(params, group, colIndex, calcValue) {
  var input = document.querySelector('input[data-row="' + group.target + '"][data-col="' + colIndex + '"]')
  if (!input) return
  var caption = document.querySelector('.subtotal-calc[data-calc-row="' + group.target + '"][data-calc-col="' + colIndex + '"]')

  if (input.getAttribute('data-manual') !== 'true') {
    var next = calcValue === null
      ? ''
      : (params.formatNumbers ? formatNumber(calcValue, true) : String(calcValue))
    if (input.value !== next) input.value = next
    if (caption) {
      caption.textContent = ''
      caption.style.display = 'none'
    }
    setCellVariance(input, false)
    return
  }

  var entered = parseFloat(unformatNumber(input.value))
  var differs = calcValue !== null && !isNaN(entered) && Math.abs(entered - calcValue) > 1e-9

  if (caption) {
    if (calcValue === null || !differs) {
      caption.textContent = ''
      caption.removeAttribute('data-shown')
      caption.style.display = 'none'
    } else {
      var shown = params.formatNumbers ? formatNumber(calcValue, true) : String(calcValue)

      // Rebuild ONLY when the displayed value actually changed. Recomputing
      // on every keystroke and on blur used to replace this DOM each time,
      // which destroyed the restore button between mousedown and mouseup —
      // so the first real click on it never produced a click event and the
      // button looked broken. Diffing also avoids needless DOM churn.
      if (caption.getAttribute('data-shown') !== shown || !caption.firstChild) {
        caption.textContent = ''

        var label = document.createElement('span')
        label.className = 'subtotal-calc-value'
        label.textContent = (params.subtotalReferenceLabel || 'Calculated') + ': ' + shown
        caption.appendChild(label)

        var restore = document.createElement('button')
        restore.type = 'button'
        restore.className = 'subtotal-restore'
        restore.textContent = 'use'
        restore.setAttribute('aria-label', 'Replace with the calculated value ' + shown)
        // Keep focus in the cell so pressing the button doesn't fire the
        // input's blur handler (which recomputes) mid-click. Belt and braces
        // with the diffing above: this prevents the re-render from being
        // triggered at all, the diff makes it harmless if it is.
        restore.addEventListener('mousedown', function (e) { e.preventDefault() })
        restore.addEventListener('click', function () { restoreCalculated(input) })
        caption.appendChild(restore)

        caption.setAttribute('data-shown', shown)
      }

      caption.style.display = ''
    }
  }

  setCellVariance(input, differs)
}

/**
 * Recompute every subtotal and the grid total.
 *
 * Groups are evaluated in declaration order, which parseSubtotalConfig
 * guarantees is dependency order, so the grid total sees freshly-written
 * subtotals (including overridden ones) in the same pass.
 */
function updateSubtotals(params) {
  var cfg = params.subtotalConfig
  if (!cfg || !cfg.configured || !cfg.groups.length) return

  for (var g = 0; g < cfg.groups.length; g++) {
    var group = cfg.groups[g]
    for (var col = 0; col < params.cols; col++) {
      applySubtotalCell(params, group, col, calculateGroupSum(group, col))
    }
  }
}

/**
 * Rebuild override state after loading a saved answer.
 *
 * Override flags are not stored (they would need a metadata channel this
 * plug-in deliberately removed in 2.0.30). They are derived instead: a saved
 * subtotal that disagrees with the sum of its saved components was overridden.
 * Without this, returning to a completed field would silently overwrite the
 * respondent's own figures with the calculated ones.
 */
function reconcileSubtotalOverrides(params) {
  var cfg = params.subtotalConfig
  if (!cfg || !cfg.configured) return

  for (var g = 0; g < cfg.groups.length; g++) {
    var group = cfg.groups[g]
    for (var col = 0; col < params.cols; col++) {
      var input = document.querySelector('input[data-row="' + group.target + '"][data-col="' + col + '"]')
      if (!input || !input.value) continue
      var stored = parseFloat(unformatNumber(input.value))
      if (isNaN(stored)) continue
      var calc = calculateGroupSum(group, col)
      if (calc === null || Math.abs(stored - calc) > 1e-9) {
        input.setAttribute('data-manual', 'true')
        debugLog('Restored override on subtotal row ' + (group.target + 1) + ', col ' + (col + 1))
      }
    }
  }
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
    var validation = validateNumericInput(input.value, params, true, validationOptionsFor(params, input)) // Use soft messages
    showValidationMessage(input, validation.message, validation.valid, true)
  }, 300)

  var debouncedHardValidation = debounce(function (input, params) {
    var validation = validateNumericInput(input.value, params, false, validationOptionsFor(params, input)) // Use hard messages
    showValidationMessage(input, validation.message, validation.valid, false)
  }, 300)

  // Create debounced update function. Subtotals recompute BEFORE the answer
  // is serialized, so the saved matrix always carries current subtotal values.
  var debouncedUpdate = debounce(function () {
    updateSubtotals(params)
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

        // Strip pasted delimiter chars before any other processing so they
        // can't reach the serialized answer.
        sanitizeInputValue(this, !isNumericGrid(params))

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
          var filteredValue = filterDecimalInput(workingValue, params.allowDecimals, isNumericGrid(params))

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
        var validation = validateNumericInput(this.value, params, useSoftValidation, validationOptionsFor(params, this))
        showValidationMessage(this, validation.message, validation.valid, useSoftValidation)

        updateSubtotals(params)
        updateTotals(params)
      })

      // Handle keypress for decimal separator conversion
      input.addEventListener('keypress', function (e) {
        // Pipe is the row separator in both legacy and enhanced answer
        // formats — never let it through, regardless of grid type.
        if (e.key === '|') {
          e.preventDefault()
          return
        }
        if (!params.allowDecimals) {
          // Prevent decimal point entry (both comma and dot)
          if (e.key === '.' || e.key === ',') {
            e.preventDefault()
          }
        } else {
          // Convert comma to dot for decimal separator (user-friendly).
          // In numeric grids the comma is treated as a decimal entry and
          // rewritten to a dot. In text grids the comma is the column
          // separator in enhanced mode, so we just block it instead of
          // mutating the user's text.
          if (e.key === ',') {
            e.preventDefault()
            if (!isNumericGrid(params)) return
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
        // Strip pasted delimiter chars first so they can't reach the
        // serialized answer.
        sanitizeInputValue(this, !isNumericGrid(params))

        // Convert commas to dots only for numeric grids (prevent column
        // splitting). In text grids the conversion mutates legitimate text
        // input, so it's gated on isNumericGrid.
        if (isNumericGrid(params)) {
          var rawValue = this.value
          var cursorPosition = this.selectionStart

          // Check if this value matches the originally loaded value
          var loadedValue = this.getAttribute('data-loaded-value')
          var isLoadedValue = loadedValue && rawValue === loadedValue

          if (!isLoadedValue) {
            // Apply comma-to-dot conversion
            var filteredValue = filterDecimalInput(rawValue, params.allowDecimals, true)
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
        // Always block the row delimiter.
        if (e.key === '|') {
          e.preventDefault()
          return
        }
        if (!params.allowDecimals) {
          // Prevent decimal point entry (both comma and dot)
          if (e.key === '.' || e.key === ',') {
            e.preventDefault()
          }
        } else {
          // Convert comma to dot for decimal separator (user-friendly) in
          // numeric grids only; otherwise block the comma to keep enhanced
          // mode's column separator intact.
          if (e.key === ',') {
            e.preventDefault()
            if (!isNumericGrid(params)) return
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

    // Override tracking for subtotal/total cells. Assigning .value in JS does
    // not fire `input`, so anything reaching this handler is the respondent
    // typing — which is exactly when the cell stops auto-filling.
    if (input.getAttribute('data-subtotal')) {
      input.addEventListener('input', function () {
        if (this.getAttribute('data-loading') === 'true') return
        if (this.getAttribute('data-manual') !== 'true') {
          this.setAttribute('data-manual', 'true')
          debugLog('Subtotal cell overridden at row ' + this.getAttribute('data-row'))
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
    // preventScroll: avoid the iframe (and its parent form) yanking the
    // viewport when focus moves to an offscreen cell.
    nextInput.focus({ preventScroll: true })
  }
}

function updateAnswer() {
  var params = getTableParameters()
  var answerMatrix = []
  var allCells = [] // flat list, used for required-field validation

  // Whether the cell's text-comma should be treated as a numeric thousands
  // separator (and stripped) at serialization time. In numeric grids,
  // filterDecimalInput leaves "1,234" unchanged (it's a valid thousands
  // formatting), but that value would then split into two enhanced cells
  // when joined with ",". Strip the comma here to keep the invariant: an
  // enhanced cell never contains a comma at the serialization boundary.
  var stripCommaAsThousands = isNumericGrid(params)

  for (var row = 0; row < params.rows; row++) {
    var rowData = []
    for (var col = 0; col < params.cols; col++) {
      var input = document.querySelector('input[data-row="' + row + '"][data-col="' + col + '"]')
      var value = input ? input.value : ''

      // Numeric: unformat thousands separators before serialization. This
      // covers both format_numbers=true (display formatting on) and any
      // other numeric-grid signal (min/max/numbers appearance) where the
      // user manually typed thousands-style commas.
      if (stripCommaAsThousands && value) {
        value = unformatNumber(value)
      } else if (params.formatNumbers && value) {
        // Legacy path retained for the (impossible-but-defensive) case
        // where stripCommaAsThousands is false yet formatNumbers is true.
        value = unformatNumber(value)
      }

      // Final invariant: every cell that's about to be joined with "," (the
      // enhanced column delimiter) must not itself contain a comma, and no
      // cell may contain "|" (the row delimiter) in either format.
      if (typeof value === 'string') {
        value = value.replace(/,/g, '').replace(/\|/g, '')
      }

      rowData.push(value)
      allCells.push(value)
    }
    answerMatrix.push(rowData.join(','))
  }

  var answer = answerMatrix.join('|')

  // Earlier versions persisted the raw cell matrix to setMetaData on every
  // keystroke as a "recovery" mechanism. That was unsafe: plug-in metadata
  // is exported with the submission, so values that strict validation
  // intentionally blocks (and that we deliberately keep out of setAnswer)
  // were still leaking into the raw XML. Recovery now relies solely on
  // setAnswer / CURRENT_ANSWER. Form authors who need persistent partial
  // input should use required=0 and validation_strict=false so partial
  // matrices flow through setAnswer normally.

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

    if (params.required >= 1) {
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
  if (params.required >= 1) {
    checkAllRequired(allCells, answer)
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
 * Plugin's custom required field validation. Only used when required=1.
 *
 * Caller passes the flat cell array directly — we never re-parse the
 * serialized string. Inferring format from delimiters (presence of ',')
 * is unsafe: e.g., enhanced output for a 1-column table looks like
 * "A|B|C" with no commas at all, which would be indistinguishable from
 * legacy format and would incorrectly trim trailing-empty cells.
 *
 * @param {string[]} cells      - Flat array of every cell value, in order
 * @param {string}   cellValues - Serialized matrix to set as the answer
 *                                when validation passes
 */
function checkAllRequired(cells, cellValues) {
  debugLog('Checking plugin required fields against ' +
    (cells ? cells.length : 0) + ' cells')

  if (!cells || cells.length === 0) {
    setAnswer('')
    return
  }

  var hasEmptyCell = cells.some(function (cell) {
    return cell === null || cell === undefined || String(cell).trim() === ''
  })

  if (hasEmptyCell) {
    debugLog('Plugin required validation failed: at least one cell is empty')
    setAnswer('') // Block progression if any cell is empty
  } else {
    debugLog('Plugin required validation passed: all ' + cells.length +
      ' cells filled')
    setAnswer(cellValues)
  }
}

function loadExistingData(params) {
  var currentAnswer = fieldProperties.CURRENT_ANSWER

  // The previous metadata-based recovery path was removed in 2.0.30 to
  // close a data-leak bug — see updateAnswer for the rationale. We rely on
  // CURRENT_ANSWER (whatever setAnswer last persisted) plus the hidden
  // input fallback below for in-session partial recovery.

  // Fallback: Check for pending answer from failed validation (stored in hidden input)
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

    // Update totals after loading data. Override state is rebuilt from the
    // loaded values first, otherwise updateSubtotals would overwrite the
    // respondent's own figures with the calculated ones.
    setTimeout(function () {
      reconcileSubtotalOverrides(params)
      updateSubtotals(params)
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
      // Same max_value exemption as live validation. Without it, a valid
      // calculated subtotal would show a spurious maximum warning after
      // navigating back to the field or resuming a saved form.
      var validation = validateNumericInput(input.value, params, useSoftValidation, validationOptionsFor(params, input))
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
  debugLog('=== GENERATE TABLE (LEGACY MODE) ===')
  debugLog('Params: rows=' + unifiedParams.rows + ', cols=' + unifiedParams.cols)

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
  if (hasAppearanceToken('numbers')) {
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

  // Build the table with DOM nodes and textContent. Earlier versions
  // concatenated header strings into HTML and assigned via innerHTML; with
  // dynamic ${...} references in headings the content can be respondent-
  // or dataset-driven, which made HTML injection possible. Constructing
  // nodes here keeps any markup in user data inert.
  var table = document.createElement('table')
  table.id = 'gridTable'
  table.className = 'gridTable'

  for (var i = 0; i < legacyRows; i++) {
    var tr = document.createElement('tr')

    if (i > 0) {
      var rowHeaderTh = document.createElement('th')
      rowHeaderTh.setAttribute('scope', 'row')
      rowHeaderTh.className = 'default-hint-text-size'
      rowHeaderTh.setAttribute('dir', 'auto')
      // unEntity decodes &amp;/&lt;/&gt;/&quot;/&#39; before the value goes
      // into textContent, matching how enhanced mode handles row labels.
      rowHeaderTh.textContent = unEntity(rowHeadersArray[i - 1] || 'Row ' + i)
      tr.appendChild(rowHeaderTh)
    } else {
      var cornerTh = document.createElement('th')
      cornerTh.setAttribute('scope', 'col')
      cornerTh.className = 'default-hint-text-size'
      tr.appendChild(cornerTh)
    }

    for (var j = 0; j < legacyColumns; j++) {
      if (i === 0) {
        var colTh = document.createElement('th')
        colTh.setAttribute('scope', 'col')
        colTh.className = 'default-hint-text-size sticky'
        colTh.setAttribute('dir', 'auto')
        colTh.textContent = unEntity(columnHeadersArray[j] || 'Col ' + (j + 1))
        tr.appendChild(colTh)
      } else {
        var td = document.createElement('td')
        var cellInput = document.createElement('input')
        cellInput.type = fieldAppearance
        cellInput.className = 'cell default-hint-text-size'
        cellInput.setAttribute('dir', 'auto')
        if (unifiedParams.required >= 1) {
          cellInput.required = true
        }
        td.appendChild(cellInput)
        tr.appendChild(td)
      }
    }

    table.appendChild(tr)
  }

  var div = document.getElementById('table-holder')
  if (div) {
    div.innerHTML = ''
    div.appendChild(table)
    applyRowHeaderWidths(sizing)
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
      // Sanitize before getValues runs so the serialized answer never
      // contains the pipe row separator (legacy mode joins cells with '|').
      // Commas are fine in legacy mode — its format is single-delimiter.
      cell.addEventListener('input', function () {
        sanitizeInputValue(this, false)
      })
      cell.addEventListener('input', getValues)
      // Block typed pipes too so the user gets immediate feedback.
      cell.addEventListener('keypress', function (e) {
        if (e.key === '|') e.preventDefault()
      })
    }
  }
}

function getValues(e) {
  var getTable = document.getElementById('gridTable')
  if (!getTable) return ''

  var cells = getTable.getElementsByTagName('input')
  var cellValues = ''
  var allCells = [] // flat list, used for required-field validation
  var hasAnyValue = false

  for (var q = 0; q < cells.length; q++) {
    var cell = cells[q]
    var cellvalue = cell ? cell.value : ''
    // Final invariant for legacy format: cell values must never contain
    // the '|' row delimiter. Input filtering already blocks typed/pasted
    // pipes; this strips any that slipped through (e.g. legacy data).
    if (typeof cellvalue === 'string') {
      cellvalue = cellvalue.replace(/\|/g, '')
    }
    cellValues = cellValues + cellvalue + '|'
    allCells.push(cellvalue)

    // Check if any cell has a value
    if (cellvalue && cellvalue.trim() !== '') {
      hasAnyValue = true
    }
  }

  // (Legacy mode previously persisted cellValues via setMetaData; removed
  // in 2.0.30 — see updateAnswer for the rationale.)

  // CRITICAL: Handle empty state properly
  if (!hasAnyValue) {
    debugLog('Legacy mode: All cells empty')

    if (required >= 1) {
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
  if (required >= 1) {
    checkAllRequired(allCells, cellValues)
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
    // Drop override state with the value. Leaving data-manual set would keep
    // a previously overridden subtotal frozen after the host clears the
    // field, so it would never auto-fill again on re-entry.
    enhancedInputs[i].removeAttribute('data-manual')
    enhancedInputs[i].removeAttribute('data-loaded-value')
    var clearedCell = enhancedInputs[i].closest ? enhancedInputs[i].closest('td') : null
    if (clearedCell) clearedCell.classList.remove('subtotal-variance')
    // Clear any validation messages
    showValidationMessage(enhancedInputs[i], '', true)
  }

  // Clear the calculated-reference captions on subtotal/total cells
  var captions = document.querySelectorAll('.subtotal-calc')
  for (var c = 0; c < captions.length; c++) {
    captions[c].textContent = ''
    captions[c].removeAttribute('data-shown')
    captions[c].style.display = 'none'
  }

  // Reset the read-only total cells rendered by total='row'/'column'
  var totalCells = document.querySelectorAll('.total-cell')
  for (var t = 0; t < totalCells.length; t++) {
    totalCells[t].textContent = '0'
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
    hiddenInput.removeAttribute('data-pending-answer')
    hiddenInput.removeAttribute('data-invalid-answer')
  }

  // (No metadata to clear — the metadata persistence path was removed in
  // 2.0.30 to prevent leaking validation-blocked values into the
  // submission's raw XML.)

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
  // Order matters: decode &amp; last so we don't double-decode entities like
  // &amp;lt; (which should decode to "&lt;", not "<").
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
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
      // Subtotal and grid-total rows are real rows in the matrix. Including
      // them here would count their components twice.
      if (isSubtotalRow(params, rowIndex)) continue
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
        if (isSubtotalRow(params, rowIndex)) continue
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
// STICKY-HEADER SCROLL CONTAINER
// ====================

/**
 * Ask the host iframe to re-measure the plug-in. SurveyCTO web Collect
 * embeds plug-ins through iframeResizer, which exposes a child-side API
 * at `window.parentIFrame`. After we change `#table-container`'s
 * max-height the iframe element on the parent may still be sized to the
 * old content height, leaving an empty band below the table; calling
 * `parentIFrame.size()` triggers the parent to recompute and resize.
 *
 * On the first successful contact with parentIFrame we also pin the
 * height calculation method to `bodyOffset`. iframeResizer's default
 * heuristic samples both body offsetHeight and descendant scrollHeight
 * on every event, which oscillates between the clipped container height
 * and the full table scrollHeight as the user scrolls inside
 * #table-container — producing a white band that flickers in and out
 * below the table. `bodyOffset` ignores the inner scroll content and
 * tracks only the body's own height, which is what we want.
 *
 * No-op outside web Collect (Android/iOS Collect don't load
 * iframeResizer) — the typeof guard handles that.
 */
var heightMethodPinned = false

/**
 * Seed an initial pixel max-height on #table-container at script load,
 * BEFORE the table is rendered. Two reasons this matters:
 *
 *  1. iframeResizer measures body.offsetHeight on a tight schedule once
 *     the plug-in iframe loads. If the table renders at full natural
 *     height before our JS clamps anything, iframeResizer locks the
 *     iframe at that larger size, leaving a visible gap between the
 *     table and the form's "Next" button when applyTableContainerHeight
 *     later reduces the container's height.
 *
 *  2. We can NOT use `max-height: <N>vh` in CSS for the initial cap,
 *     because `vh` resolves against the iframe's own viewport — and the
 *     iframe is sized to its content. That creates a feedback loop
 *     (body ≈ Nvh, iframe ≈ body, vh shrinks) which collapses the
 *     container to a tiny fixed-point height regardless of row count.
 *
 * The cap here is derived from the parent's window.innerHeight when
 * accessible (it's stable; same-origin in the standard SurveyCTO host).
 * Falls back to screen.height in cross-origin or non-iframe contexts.
 * applyTableContainerHeight refines this later with parentIFrame.getPageInfo
 * data once iframeResizer's child library is ready.
 */
function seedInitialContainerHeight() {
  var container = document.getElementById('table-container')
  if (!container) return
  var parentVH = 0
  try {
    parentVH = (window.parent && window.parent.innerHeight) || 0
  } catch (e) {
    parentVH = 0
  }
  if (!parentVH) parentVH = window.screen ? window.screen.height : 800
  // Reserve generous space for form chrome (toolbar, header, Next button,
  // page padding) so the iframe never grows large enough that shrinking it
  // later leaves a visible gap.
  var cap = Math.max(280, parentVH - 320)
  container.style.maxHeight = cap + 'px'
  container.style.boxSizing = 'border-box'
}
seedInitialContainerHeight()

/**
 * iframeResizer's child library (`window.parentIFrame`) is injected
 * asynchronously after the parent finishes its handshake, so on the
 * first `requestHostResize` at plug-in startup it is often still
 * undefined. Without retrying we'd never pin the height method, and
 * iframeResizer would stay on its default heuristic (which oscillates
 * between bodyOffset and descendant scrollHeight as the user scrolls
 * #table-container, producing the flickering white band below the
 * table). Poll briefly until parentIFrame appears, then set the method
 * once.
 */
function pinHeightMethod() {
  if (heightMethodPinned) return
  var attempts = 0
  function tryPin() {
    if (heightMethodPinned) return
    try {
      if (window.parentIFrame &&
        typeof window.parentIFrame.setHeightCalculationMethod === 'function') {
        window.parentIFrame.setHeightCalculationMethod('bodyOffset')
        heightMethodPinned = true
        debugLog('Pinned iframeResizer heightCalculationMethod=bodyOffset')
        if (typeof window.parentIFrame.size === 'function') {
          window.parentIFrame.size()
        }
        return
      }
    } catch (e) {
      // ignore and retry
    }
    attempts++
    if (attempts < 40) { // ~4s total at 100ms cadence
      setTimeout(tryPin, 100)
    } else {
      debugLog('parentIFrame never appeared; height method not pinned (likely mobile Collect or non-iframe host)')
    }
  }
  tryPin()
}

function callParentSize() {
  try {
    if (window.parentIFrame &&
      typeof window.parentIFrame.size === 'function') {
      if (!heightMethodPinned &&
        typeof window.parentIFrame.setHeightCalculationMethod === 'function') {
        window.parentIFrame.setHeightCalculationMethod('bodyOffset')
        heightMethodPinned = true
        debugLog('Pinned iframeResizer heightCalculationMethod=bodyOffset (via requestHostResize)')
      }
      window.parentIFrame.size()
    }
  } catch (e) {
    // Cross-origin or detached: ignore. The plug-in still works; the
    // parent iframe just won't re-measure on this tick.
  }
}

// Fire size() on a few staggered ticks. iframeResizer measures
// document.body.offsetHeight on each call; after we clamp #table-container
// the body height shrinks but layout-induced reflow can take a few frames
// to settle. A single rAF call wasn't enough on web Collect — the iframe
// would stay at the larger pre-clamp height, leaving a visible gap between
// the table's bottom and the form's Next button.
function requestHostResize() {
  requestAnimationFrame(callParentSize)
  setTimeout(callParentSize, 50)
  setTimeout(callParentSize, 200)
}

/**
 * Pin the column header (thead) while rows scroll inside the plug-in.
 *
 * SurveyCTO field plug-ins run inside an iframe whose height is auto-sized
 * to content by the host (Collect web/Android/iOS). To get a sticky thead,
 * the table needs a bounded scroll context. We use `max-height` on
 * `#table-container` so:
 *   - small tables remain unconstrained and the container collapses to
 *     natural content height (no white band below the data),
 *   - large tables get clipped to the available viewport, which makes the
 *     container scrollable and the sticky thead actually pin.
 *
 * Measurement source: #table-wrapper.scrollHeight (wrapper has
 * overflow:visible, so its scrollHeight reflects natural content height
 * even while the container's max-height is set). Earlier versions cleared
 * the container's max-height and read its scrollHeight; that worked but
 * caused the iframe to briefly grow during the measure-then-clamp cycle,
 * producing a white band that flickered into view as users scrolled.
 *
 * Viewport source: parentIFrame.getPageInfo when available (web Collect
 * via iframeResizer) — exact parent viewport + iframe offset, no chrome
 * guess. Falls back to a window.parent.innerHeight heuristic otherwise.
 *
 * `frame_adjust` lets form authors nudge the computed height for unusual
 * layouts. `pinned_headers='never'` opts out entirely (form scrolls
 * instead of an internal scroll context); `'always'` forces the clamp.
 */
// pageInfoCache: parent-viewport info from iframeResizer. Updated whenever
// the parent fires a layout change (scroll/resize/focus) — much more
// accurate than guessing chromeEstimate.
var pageInfoCache = null
var pageInfoSubscribed = false
var pageInfoOnFirstUpdate = null

function subscribePageInfo(onFirstUpdate) {
  if (pageInfoSubscribed) return
  pageInfoOnFirstUpdate = onFirstUpdate || null
  try {
    if (window.parentIFrame &&
      typeof window.parentIFrame.getPageInfo === 'function') {
      window.parentIFrame.getPageInfo(function (info) {
        var hadCache = pageInfoCache !== null
        pageInfoCache = info
        if (!hadCache && typeof pageInfoOnFirstUpdate === 'function') {
          // First time: re-run the layout calc with accurate data.
          // Subsequent updates flow through setupContainerResizeHandler.
          try { pageInfoOnFirstUpdate() } catch (e) { /* ignore */ }
        }
      })
      pageInfoSubscribed = true
    }
  } catch (e) {
    // Ignore — fall back to the heuristic path.
  }
}

function applyTableContainerHeight(params) {
  // Honor pinned_headers='never': skip the bounded-scroll layout entirely.
  // Table renders at natural height; the form (host) handles scrolling.
  // Use 'none' (not '') because the CSS rule sets max-height: 80vh as a
  // safety cap — clearing the inline style would still leave the cap.
  if (params && params.pinnedHeaders === 'never') {
    var optoutContainer = document.getElementById('table-container')
    if (optoutContainer) {
      optoutContainer.style.maxHeight = 'none'
      optoutContainer.style.overflow = 'visible'
    }
    requestHostResize()
    return
  }

  var container = document.getElementById('table-container')
  if (!container) return

  // Only the enhanced mode renders a thead worth pinning, unless the form
  // explicitly forces it via pinned_headers='always'.
  var hasThead = !!container.querySelector('thead')
  var forceClamp = params && params.pinnedHeaders === 'always'
  if (!hasThead && !forceClamp) return

  // Measure natural content height from the wrapper. Wrapper has
  // overflow:visible (style.css) so its scrollHeight reflects natural
  // layout height even when the container's max-height is currently set.
  // No transient unclamping → no oscillation on the parent iframe height,
  // which is what produced the white band under the table during scroll.
  var wrapper = document.getElementById('table-wrapper')
  var naturalHeight = wrapper && wrapper.scrollHeight
    ? wrapper.scrollHeight
    : container.scrollHeight

  var offsetTop = container.getBoundingClientRect().top
  var hostViewport = 0
  var chromeEstimate = 0
  var source = 'heuristic'

  // Prefer iframeResizer's pageInfo when available — it returns the parent's
  // exact viewport height and the iframe's offset within it.
  if (pageInfoCache && typeof pageInfoCache.windowHeight === 'number') {
    var iframeTopInParent = typeof pageInfoCache.offsetTop === 'number'
      ? pageInfoCache.offsetTop
      : 0
    var containerTopInParent = iframeTopInParent + offsetTop
    hostViewport = pageInfoCache.windowHeight - containerTopInParent
    // Small breathing room for the form's "Next" button.
    chromeEstimate = 80
    source = 'pageInfo'
  } else if (isWebCollect) {
    try {
      hostViewport = (window.parent.innerHeight || window.parent.outerHeight) - offsetTop
    } catch (e) {
      hostViewport = (window.outerHeight || window.innerHeight) - offsetTop
    }
    chromeEstimate = 220 // toolbar + form nav + buttons
  } else {
    // Mobile (Android/iOS Collect): no iframeResizer.
    hostViewport = window.screen.height - offsetTop
    chromeEstimate = 200 // form nav + soft-keyboard buffer
  }

  if (!hostViewport || hostViewport <= 0) {
    requestHostResize()
    return
  }

  var available = hostViewport - chromeEstimate +
    (params && params.frameAdjust ? params.frameAdjust : 0)

  if ((naturalHeight <= available || available < 150) && !forceClamp) {
    // Small enough to render at natural height — release any prior clamp.
    container.style.maxHeight = ''
    debugLog('Table container unconstrained: natural=' + naturalHeight +
      'px <= available=' + available + 'px (' + source + ')')
  } else {
    var clamp = available < 150 ? 300 : available
    container.style.maxHeight = clamp + 'px'
    debugLog('Table container constrained: natural=' + naturalHeight +
      'px, maxHeight=' + clamp + 'px (source=' + source +
      ', offsetTop=' + offsetTop + ', chrome=' + chromeEstimate +
      ', frameAdjust=' + (params ? params.frameAdjust : 0) + ')')
  }

  // Ask the parent iframe to re-measure so any whitespace below the
  // plug-in collapses (or grows, when max-height was just lifted).
  requestHostResize()
}

/**
 * Wire resize handling to the parent window when running in web Collect,
 * and to our own window otherwise. We deliberately do NOT listen on the
 * iframe's own `resize` for web — iframeResizer fires that whenever
 * content reflows (e.g. on every keystroke that changes layout), which
 * would re-run the height calc for no reason and risk scroll-position
 * glitches.
 */
function setupContainerResizeHandler(params) {
  var resizeTimeout
  function debouncedReapply() {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(function () {
      // applyTableContainerHeight clears max-height before measuring, so
      // we don't need to reset state here. (Older versions also wiped a
      // dataset.naturalHeight cache; that cache was removed when we
      // switched to max-height — scrollHeight is now re-derived on every
      // call against the actual layout.)
      applyTableContainerHeight(params)
    }, 200) // slightly longer than the 150ms column-width debounce so the
    // row-label re-wrap finishes before we measure
  }

  if (isWebCollect) {
    try {
      // Append, don't overwrite — other plug-ins or host code may already
      // have an onresize handler on the parent.
      var prior = window.parent.onresize
      window.parent.onresize = function (e) {
        if (typeof prior === 'function') prior.call(window.parent, e)
        debouncedReapply()
      }
    } catch (e) {
      // Cross-origin: fall back to our own window. Less ideal but safe.
      window.addEventListener('resize', debouncedReapply)
    }
  } else {
    // Mobile: orientation change fires window resize reliably.
    window.addEventListener('resize', debouncedReapply)
  }
}

/**
 * Keep validation tooltips anchored to their inputs while the user scrolls
 * inside the bounded #table-container. The tooltips use position: fixed and
 * are placed once at creation time using getBoundingClientRect; without a
 * scroll listener they would drift away from their inputs as rows scroll.
 */
function setupValidationScrollHandler() {
  var container = document.getElementById('table-container')
  if (!container) return

  var rafId = null
  function reposition() {
    rafId = null
    var messages = document.querySelectorAll('.validation-message')
    for (var i = 0; i < messages.length; i++) {
      var msg = messages[i]
      var input = msg._validationInput
      if (input && document.body.contains(input)) {
        positionValidationMessage(input, msg)
      }
    }
  }

  function onScroll() {
    if (rafId !== null) return
    rafId = requestAnimationFrame(reposition)
  }

  container.addEventListener('scroll', onScroll, { passive: true })
  // Window scroll matters too — outer iframe scroll can also shift the
  // viewport-relative coordinates of cells.
  window.addEventListener('scroll', onScroll, { passive: true })
}

// ====================
// MAIN INITIALIZATION
// ====================

function initializeTableGrid() {
  try {
    debugLog('=== TABLE GRID INITIALIZATION ===')

    // Pin iframeResizer's height calculation method as early as possible.
    // The default heuristic re-measures on scroll and oscillates between
    // body offset and descendant scrollHeight, causing a white band
    // below the table to flicker as the user scrolls. `bodyOffset`
    // tracks only the body's own height, which is stable.
    if (isWebCollect) {
      pinHeightMethod()
      // Re-run the height calc the moment iframeResizer hands us real
      // page info. The first applyTableContainerHeight call further down
      // runs synchronously with no pageInfoCache, so it falls back to a
      // heuristic; we want the accurate clamp applied as soon as
      // iframeResizer's first measurement lands. Defer with setTimeout
      // so the init function has finished and enhancedParams is populated.
      subscribePageInfo(function () {
        setTimeout(function () {
          try { applyTableContainerHeight(enhancedParams) } catch (e) { /* ignore */ }
        }, 0)
      })
    }

    // Determine which mode to use
    var useEnhancedMode = shouldUseEnhancedMode()
    debugLog('Mode detection - Enhanced mode:', useEnhancedMode)
    debugLog('Unified params: rows=' + unifiedParams.rows + ', cols=' + unifiedParams.cols)

    var enhancedParams = null
    if (useEnhancedMode) {
      debugLog('>>> Using ENHANCED mode')
      enhancedParams = initializeEnhancedMode()
    } else {
      debugLog('>>> Using LEGACY mode')
      initializeLegacyMode()
    }

    // Common initialization for both modes
    setupCommonFeatures()

    // Pin the thead via internal scroll (enhanced mode only — legacy has
    // no thead worth pinning and its layout is left untouched).
    if (useEnhancedMode) {
      applyTableContainerHeight(enhancedParams)
      setupContainerResizeHandler(enhancedParams)
    }

    // Keep validation tooltips anchored to their inputs as rows scroll.
    // Wired for both modes: legacy has no internal scroll container but the
    // window-scroll path still helps when the iframe itself scrolls.
    setupValidationScrollHandler()

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

  return params
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
  // The label and hint are populated by the Mustache template at render
  // time via {{{LABEL}}} / {{{HINT}}}. Earlier versions also overwrote
  // those nodes here with `innerHTML = unEntity(...)` — a redundant write
  // that, once unEntity actually decoded entities, became an HTML
  // injection sink. Trust the template render and don't overwrite.

  // Set initial focus if not readonly
  if (fieldProperties && !fieldProperties.READONLY) {
    setTimeout(setFocus, 100)
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initializeTableGrid()
})