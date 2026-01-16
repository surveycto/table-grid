# Per-Cell Constraints Specification

**Version:** 1.0
**Status:** Draft
**Date:** January 2026
**Related JIRA:** [Per-cell constraint support]

---

## 1. Executive Summary

This specification defines the enhancement to support cell-by-cell validation constraints in the table-grid field plug-in. Currently, `min_value` and `max_value` parameters apply globally to all cells. This enhancement allows specifying different constraints per cell while maintaining full backward compatibility.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Extend existing parameters | Maintains backward compatibility; no new parameter names needed |
| Use pipe/comma format (like `historical_data`) | Consistent with existing patterns; familiar to users |
| Support mixed global + per-cell | Maximum flexibility for form designers |
| Empty values = unconstrained | Intuitive; matches existing optional parameter behavior |
| Per-cell constraint messages | Enables context-specific feedback for each cell |
| 2-second feedback delay | Balances immediate feedback with avoiding premature error display |

---

## 2. Current Architecture Context

### 2.1 Existing Validation Flow

```
User Input → Debounced Validation (300ms) → validateNumericInput()
                                                    ↓
                                          Check: NaN? Decimals? Min? Max?
                                                    ↓
                                          showValidationMessage() per cell
                                                    ↓
                                          updateAnswer() (150ms debounce)
                                                    ↓
                              ┌─────────────────────┴─────────────────────┐
                              ↓                                           ↓
                    validation_strict=true                    validation_strict=false
                              ↓                                           ↓
                    validateAllInputs()                         setAnswer(answer)
                              ↓                                 + show warnings
                    Any invalid? ────Yes──→ setAnswer('')
                         │                   (block progression)
                         No
                         ↓
                    setAnswer(answer)
```

### 2.2 Immediate Feedback Timing

**Enhancement:** Introduce a configurable delay before showing constraint error messages to avoid premature error display while the user is still typing.

**Rationale:** Showing an error immediately after the first keystroke (e.g., typing "1" when minimum is "100") creates a poor user experience. A 2-second delay after typing pauses allows the user to complete their input before feedback is shown.

**Implementation:**

| Validation Type | Debounce Delay | Purpose |
|-----------------|----------------|---------|
| Format validation (NaN, decimals) | 300ms | Quick feedback for invalid characters |
| Constraint validation (min/max) | 2000ms | Allow user to complete input before range check |
| Answer update | 150ms | Responsive data capture |

```
User Input → Format Check (300ms debounce) → Show format errors immediately
          ↓
          → Constraint Check (2000ms debounce) → Show min/max errors after pause
          ↓
          → Answer Update (150ms debounce)
```

**New parameter (optional):**
```
constraint_feedback_delay=2000    → Delay in ms before showing constraint errors (default: 2000)
constraint_feedback_delay=0       → Show constraint errors immediately (legacy behavior)
```

### 2.3 Navigation Blocking Mechanism

**Critical constraint:** The plug-in cannot directly control form navigation. It can only:
1. Call `setAnswer('')` to clear the field value
2. Rely on SurveyCTO's native `required=yes` to block progression on empty fields

**This means:**
- `validation_strict=true` + SurveyCTO `required=yes` = hard blocking
- `validation_strict=true` + SurveyCTO `required=no` = visual errors but NO blocking
- `validation_strict=false` = soft warnings, never blocks

### 2.4 Existing Parameter Format Reference

**`historical_data` format (current implementation):**
```
"row0col0,row0col1,row0col2|row1col0,row1col1,row1col2|row2col0,row2col1,row2col2"
 └────── Row 0 ──────┘ └────── Row 1 ──────┘ └────── Row 2 ──────┘
```

---

## 3. Detailed Specification

### 3.1 Parameter Extensions

#### 3.1.1 `min_value` Parameter

**Current behavior (preserved):**
```
min_value=0          → All cells must be ≥ 0
min_value=100        → All cells must be ≥ 100
```

**New behavior (list format):**
```
min_value="0,10,20|5,15,25"    → Per-cell minimums for 2×3 table
min_value="0,,20|,15,"         → Sparse: only some cells constrained
min_value=",,"                 → No constraints (equivalent to omitting)
```

**Format specification:**
- Pipe (`|`) separates rows
- Comma (`,`) separates columns within a row
- Empty string between delimiters = unconstrained for that cell
- Whitespace is trimmed from values

#### 3.1.2 `max_value` Parameter

**Identical format to `min_value`:**
```
max_value=1000                  → All cells must be ≤ 1000
max_value="100,200,300|150,250,350"  → Per-cell maximums
max_value="100,,"               → Only first cell of first row constrained
```

#### 3.1.3 Mixed Global + Per-Cell

Form designers can combine:

| `min_value` | `max_value` | Result |
|-------------|-------------|--------|
| `0` | `"100,200,300"` | Global min, per-cell max |
| `"0,10,20"` | `1000` | Per-cell min, global max |
| `"0,10,20"` | `"100,200,300"` | Both per-cell |
| `0` | `1000` | Both global (current behavior) |

#### 3.1.4 `constraint_message_min` Parameter

**Current behavior (preserved):**
```
constraint_message_min="Value must be at least {min}"    → Same message for all cells
```

**New behavior (list format):**
```
constraint_message_min="Q1 revenue must be at least {min},Q2 revenue must be at least {min}|Headcount must be at least {min},Budget must be at least {min}"
```

**Format specification:**
- Pipe (`|`) separates rows
- Comma (`,`) separates columns within a row
- Empty string between delimiters = use default message for that cell
- If the list is shorter than the table, unspecified cells use the default message
- The `{min}` placeholder is replaced with the cell-specific minimum value

**Examples:**
```
constraint_message_min="Must be ≥{min},,"      → Custom message for [0,0] only; others use default
constraint_message_min="Q1: ≥{min},Q2: ≥{min}|Q3: ≥{min},Q4: ≥{min}"  → All cells have custom messages
```

#### 3.1.5 `constraint_message_max` Parameter

**Identical format to `constraint_message_min`:**
```
constraint_message_max="Cannot exceed {max}"                          → Global (current behavior)
constraint_message_max="Q1 max is {max},Q2 max is {max}|..."          → Per-cell messages
constraint_message_max="Budget cap: {max},,"                          → Only first cell custom
```

#### 3.1.6 Mixed Global + Per-Cell Messages

Form designers can combine constraint values and messages independently:

| Constraint | Message | Result |
|------------|---------|--------|
| `min_value="0,10,20"` | `constraint_message_min="Must be ≥{min}"` | Per-cell values, global message |
| `min_value=0` | `constraint_message_min="Q1: ≥{min},Q2: ≥{min}"` | Global value, per-cell messages |
| `min_value="0,10,20"` | `constraint_message_min="Q1: ≥{min},Q2: ≥{min}"` | Both per-cell |

### 3.2 Format Detection Logic

```javascript
function isPerCellFormat(value) {
    if (value === null || value === undefined) return false;
    var str = String(value).trim();
    // Contains pipe OR comma = per-cell format
    return str.indexOf('|') >= 0 || str.indexOf(',') >= 0;
}
```

**Rationale:** A single numeric value (e.g., `100`) won't contain delimiters. Any delimiter indicates per-cell format.

### 3.3 Parsing Specification

```javascript
/**
 * Parse constraint value into 2D array or single value
 * @param {string|number} value - Parameter value
 * @param {number} rows - Expected row count
 * @param {number} cols - Expected column count
 * @returns {Object} {isPerCell: boolean, value: number|null, matrix: array[][]|null}
 */
function parseConstraintValue(value, rows, cols) {
    if (value === null || value === undefined || value === '') {
        return { isPerCell: false, value: null, matrix: null };
    }

    var str = String(value).trim();

    // Check for per-cell format
    if (!isPerCellFormat(str)) {
        var num = parseFloat(str);
        return {
            isPerCell: false,
            value: isNaN(num) ? null : num,
            matrix: null
        };
    }

    // Parse as 2D matrix
    var matrix = [];
    var rowStrings = str.split('|');

    for (var r = 0; r < rows; r++) {
        matrix[r] = [];
        var colStrings = (rowStrings[r] || '').split(',');

        for (var c = 0; c < cols; c++) {
            var cellValue = (colStrings[c] || '').trim();
            if (cellValue === '') {
                matrix[r][c] = null;  // Unconstrained
            } else {
                var num = parseFloat(cellValue);
                matrix[r][c] = isNaN(num) ? null : num;
            }
        }
    }

    return { isPerCell: true, value: null, matrix: matrix };
}
```

### 3.4 Constraint Retrieval

```javascript
/**
 * Get min/max constraint for a specific cell
 * @param {Object} constraintDef - Parsed constraint definition
 * @param {number} rowIndex - 0-based row index
 * @param {number} colIndex - 0-based column index
 * @returns {number|null} The constraint value or null if unconstrained
 */
function getCellConstraint(constraintDef, rowIndex, colIndex) {
    if (!constraintDef) return null;

    if (!constraintDef.isPerCell) {
        return constraintDef.value;  // Global value for all cells
    }

    if (constraintDef.matrix &&
        constraintDef.matrix[rowIndex] &&
        constraintDef.matrix[rowIndex][colIndex] !== undefined) {
        return constraintDef.matrix[rowIndex][colIndex];
    }

    return null;  // Unconstrained (out of bounds or empty)
}
```

### 3.5 Constraint Message Parsing

```javascript
/**
 * Parse constraint message into 2D array or single string
 * @param {string} message - Message parameter value
 * @param {number} rows - Expected row count
 * @param {number} cols - Expected column count
 * @param {string} defaultMessage - Default message if not specified
 * @returns {Object} {isPerCell: boolean, message: string, matrix: string[][]|null}
 */
function parseConstraintMessage(message, rows, cols, defaultMessage) {
    if (message === null || message === undefined || message === '') {
        return { isPerCell: false, message: defaultMessage, matrix: null };
    }

    var str = String(message).trim();

    // Check for per-cell format (contains pipe or comma)
    if (!isPerCellFormat(str)) {
        return {
            isPerCell: false,
            message: str,
            matrix: null
        };
    }

    // Parse as 2D matrix of messages
    var matrix = [];
    var rowStrings = str.split('|');

    for (var r = 0; r < rows; r++) {
        matrix[r] = [];
        var colStrings = (rowStrings[r] || '').split(',');

        for (var c = 0; c < cols; c++) {
            var cellMessage = (colStrings[c] || '').trim();
            // Empty = use default message
            matrix[r][c] = cellMessage === '' ? defaultMessage : cellMessage;
        }
    }

    return { isPerCell: true, message: null, matrix: matrix };
}

/**
 * Get constraint message for a specific cell
 * @param {Object} messageDef - Parsed message definition
 * @param {number} rowIndex - 0-based row index
 * @param {number} colIndex - 0-based column index
 * @param {string} defaultMessage - Fallback message
 * @returns {string} The message for this cell
 */
function getCellConstraintMessage(messageDef, rowIndex, colIndex, defaultMessage) {
    if (!messageDef) return defaultMessage;

    if (!messageDef.isPerCell) {
        return messageDef.message || defaultMessage;
    }

    if (messageDef.matrix &&
        messageDef.matrix[rowIndex] &&
        messageDef.matrix[rowIndex][colIndex]) {
        return messageDef.matrix[rowIndex][colIndex];
    }

    return defaultMessage;
}
```

### 3.6 Validation Function Updates

**Current `validateNumericInput()` signature:**
```javascript
function validateNumericInput(value, params, useSoftMessages)
```

**Updated signature:**
```javascript
function validateNumericInput(value, params, useSoftMessages, rowIndex, colIndex)
```

**Updated implementation:**
```javascript
function validateNumericInput(value, params, useSoftMessages, rowIndex, colIndex) {
    // ... existing empty/NaN/decimal checks ...

    // Get cell-specific constraints
    var minValue = getCellConstraint(params.minValueDef, rowIndex, colIndex);
    var maxValue = getCellConstraint(params.maxValueDef, rowIndex, colIndex);

    // Get cell-specific messages (with fallback to defaults)
    var defaultMinMsg = useSoftMessages
        ? 'Value should be at least {min}'
        : 'Value must be at least {min}';
    var defaultMaxMsg = useSoftMessages
        ? 'Value should be at most {max}'
        : 'Value must be at most {max}';

    var minMsgDef = useSoftMessages
        ? params.constraintMessageMinSoftDef
        : params.constraintMessageMinDef;
    var maxMsgDef = useSoftMessages
        ? params.constraintMessageMaxSoftDef
        : params.constraintMessageMaxDef;

    // Min check
    if (minValue !== null && numValue < minValue) {
        var msg = getCellConstraintMessage(minMsgDef, rowIndex, colIndex, defaultMinMsg);
        return {
            valid: false,
            message: msg.replace('{min}', minValue)
        };
    }

    // Max check
    if (maxValue !== null && numValue > maxValue) {
        var msg = getCellConstraintMessage(maxMsgDef, rowIndex, colIndex, defaultMaxMsg);
        return {
            valid: false,
            message: msg.replace('{max}', maxValue)
        };
    }

    return { valid: true, message: '' };
}
```

### 3.7 Edge Cases and Handling

#### 3.7.1 Constraint Value Edge Cases

| Scenario | Behavior |
|----------|----------|
| List shorter than table | Missing cells = unconstrained |
| List longer than table | Extra values ignored |
| Empty value in list (`"0,,20"`) | That cell = unconstrained |
| Non-numeric in list (`"0,abc,20"`) | That cell = unconstrained (with console warning) |
| Only pipes (`"||"`) | All cells unconstrained |
| min > max for a cell | Both constraints applied; cell can never be valid (form designer error) |
| Negative constraints | Allowed (e.g., temperature data) |
| Decimal constraints | Allowed (e.g., `min_value="0.5,1.5,2.5"`) |

#### 3.7.2 Constraint Message Edge Cases

| Scenario | Behavior |
|----------|----------|
| Message list shorter than table | Missing cells = use default message |
| Message list longer than table | Extra messages ignored |
| Empty message in list (`"Msg1,,Msg3"`) | That cell = use default message |
| Message without `{min}`/`{max}` placeholder | Message shown as-is (no substitution) |
| Only pipes in message (`"||"`) | All cells use default message |
| Message contains pipe or comma literally | Not supported; use alternative phrasing |

#### 3.7.3 Feedback Timing Edge Cases

| Scenario | Behavior |
|----------|----------|
| `constraint_feedback_delay=0` | Immediate constraint feedback (300ms with format validation) |
| `constraint_feedback_delay` not specified | Default 2000ms delay |
| User navigates away before delay | Validation triggered immediately on blur |
| Rapid typing across multiple cells | Each cell has independent delay timer |

---

## 4. Validation Behavior

### 4.1 Per-Cell Visual Feedback

Each cell is validated independently with its own constraints:

```
┌─────────────────────────────────────────────────────────┐
│  Table: 2×3, min_value="0,10,20|5,15,25"               │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│          │  Col 0   │  Col 1   │  Col 2   │            │
├──────────┼──────────┼──────────┼──────────┼────────────┤
│  Row 0   │  min=0   │  min=10  │  min=20  │            │
│          │  [-5]🔴  │  [15]✓   │  [10]🔴  │            │
├──────────┼──────────┼──────────┼──────────┼────────────┤
│  Row 1   │  min=5   │  min=15  │  min=25  │            │
│          │  [10]✓   │  [14]🔴  │  [30]✓   │            │
└──────────┴──────────┴──────────┴──────────┴────────────┘

🔴 = validation error (red border, error message on focus)
✓  = valid (no border color)
```

### 4.2 Global Progression Blocking

When `validation_strict=true`, the existing `validateAllInputs()` function checks ALL cells. If ANY cell fails its constraint, progression is blocked.

**No change to blocking logic**, only to how each cell's constraints are determined.

### 4.3 Validation Message Content

Messages dynamically include the **cell-specific** constraint value:

| Cell | Constraint | User Input | Message |
|------|------------|------------|---------|
| [0,0] | min=0 | -5 | "Value must be at least 0" |
| [0,2] | min=20 | 10 | "Value must be at least 20" |
| [1,1] | min=15 | 14 | "Value must be at least 15" |

---

## 5. Backward Compatibility

### 5.1 Guaranteed Compatibility

| Existing Usage | New Behavior |
|----------------|--------------|
| `min_value=0` | Works exactly as before (global) |
| `max_value=1000` | Works exactly as before (global) |
| No min/max parameters | Works exactly as before (no constraints) |
| `validation_strict=true` | Works exactly as before |
| `validation_strict=false` | Works exactly as before |

### 5.2 Detection Logic

The parser automatically detects format:
- Single number without delimiters → global constraint
- String with pipe or comma → per-cell constraints

No new parameters required. No breaking changes.

### 5.3 Existing Form Migration

**Zero migration required.** All existing forms continue to work unchanged.

---

## 6. Error Handling

### 6.1 Malformed Input Handling

```javascript
// Console warnings for form designers (not shown to end users)
if (isNaN(parsedValue) && cellStr !== '') {
    console.warn('table-grid: Invalid constraint value "' + cellStr +
                 '" at [' + row + ',' + col + ']. Cell will be unconstrained.');
}
```

### 6.2 Constraint Conflict Handling

If `min > max` for a cell (form designer error):

```javascript
// Both constraints applied independently
// Cell will show error for any value
// Log warning for form designer debugging
if (minValue !== null && maxValue !== null && minValue > maxValue) {
    console.warn('table-grid: min_value (' + minValue + ') > max_value (' +
                 maxValue + ') at [' + row + ',' + col + ']. ' +
                 'No valid value possible for this cell.');
}
```

### 6.3 Dimension Mismatch Handling

| Mismatch | Handling |
|----------|----------|
| Fewer rows in constraint | Missing rows = unconstrained |
| Fewer cols in constraint | Missing cols = unconstrained |
| More rows/cols in constraint | Extra values silently ignored |

---

## 7. Risks and Constraints

### 7.1 Form Engine Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Cannot directly block navigation | Hard validation requires `required=yes` in form design | Document clearly; user education |
| No callback for "about to leave" | Cannot validate on navigation attempt | Validate on every input change |
| Limited DOM control | Cannot modify form-level UI | Focus on cell-level feedback |

### 7.2 Implementation Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance with large tables | Low | Medium | Debouncing already in place (300ms) |
| Complex constraint strings | Medium | Low | Clear documentation + examples |
| User confusion (per-cell vs global) | Medium | Medium | Console warnings + documentation |

### 7.3 UX Considerations

**Potential confusion:** A user might not understand why different cells have different valid ranges.

**Recommendation:** Form designers should use `label` or `hint` text to explain varying constraints, or use the `constraint_message_*` parameters to provide context-aware messages.

---

## 8. Testing Requirements

### 8.1 Unit Tests

#### 8.1.1 Constraint Value Parsing

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Global min parsing | `min_value=0` | `{isPerCell: false, value: 0}` |
| Per-cell min parsing | `min_value="0,10,20"` | `{isPerCell: true, matrix: [[0,10,20]]}` |
| Mixed empty values | `min_value="0,,20"` | `matrix: [[0,null,20]]` |
| Multi-row parsing | `min_value="0,10|20,30"` | `matrix: [[0,10],[20,30]]` |
| Shorter list | 3×3 table, `"0,10"` | Row 0: [0,10,null], Rows 1-2: all null |
| Invalid value handling | `"0,abc,20"` | `[0, null, 20]` + console warning |

#### 8.1.2 Constraint Message Parsing

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Global message parsing | `"Must be ≥{min}"` | `{isPerCell: false, message: "Must be ≥{min}"}` |
| Per-cell message parsing | `"Q1: ≥{min},Q2: ≥{min}"` | `{isPerCell: true, matrix: [["Q1: ≥{min}","Q2: ≥{min}"]]}` |
| Mixed empty messages | `"Custom,,Custom"` | `matrix: [["Custom", defaultMsg, "Custom"]]` |
| Multi-row messages | `"A,B|C,D"` | `matrix: [["A","B"],["C","D"]]` |
| Shorter message list | 3×3 table, `"Msg1,Msg2"` | Row 0: [Msg1,Msg2,default], Rows 1-2: all default |

#### 8.1.3 Feedback Delay Timing

| Test Case | Setup | Expected Behavior |
|-----------|-------|-------------------|
| Default delay | No `constraint_feedback_delay` param | 2000ms delay before constraint error |
| Custom delay | `constraint_feedback_delay=3000` | 3000ms delay before constraint error |
| Zero delay | `constraint_feedback_delay=0` | Immediate constraint error (with format validation) |
| Format vs constraint timing | Type "abc" then "50" (min=100) | Format error at 300ms, constraint error at 2000ms |

### 8.2 Integration Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Per-cell validation display | Enter invalid values in cells with different constraints | Each cell shows its specific error |
| Global + per-cell mixed | Global min, per-cell max | Both constraints respected per cell |
| Hard validation blocking | `validation_strict=true`, invalid cell | Form cannot progress |
| Backward compat - global | Existing form with `min_value=0` | Exact same behavior as before |
| Sparse constraints | Only some cells constrained | Unconstrained cells accept any value |
| Per-cell messages display | Different messages per cell | Each cell shows its specific message |
| Mixed value + message | Per-cell min, global message | Correct min value in global message template |
| Delayed feedback | Type invalid value, wait | Error appears after 2s delay |
| Blur triggers validation | Type invalid, tab away before delay | Error appears immediately on blur |
| Rapid typing resets delay | Type, pause, type again | Delay timer resets on each keystroke |

### 8.3 Edge Case Tests

| Test | Setup | Expected |
|------|-------|----------|
| Empty constraint string | `min_value=""` | No constraints |
| Only delimiters | `min_value="||"` | All cells unconstrained |
| Negative constraints | `min_value="-100,-50"` | Negative values allowed up to limit |
| Decimal constraints | `min_value="0.5,1.5"` | Decimal comparisons work |
| Large table (10×10) | Per-cell constraints | Performance acceptable (<100ms validation) |

---

## 9. Documentation Updates

### 9.1 README.md Updates

Add to Parameters section:

```markdown
#### Per-Cell Constraints

The `min_value` and `max_value` parameters can accept either:

1. **A single value** (applies to all cells):
   ```
   min_value=0
   max_value=1000
   ```

2. **A list of values** (applies per-cell):
   ```
   min_value="0,10,20|5,15,25"
   max_value="100,200,300|150,250,350"
   ```

**List format:**
- Use `|` to separate rows
- Use `,` to separate columns within a row
- Leave empty for unconstrained cells: `"0,,20"` (middle cell unconstrained)
- If the list is shorter than the table, unspecified cells are unconstrained

**Mixing global and per-cell:**
```
min_value=0                    # Global minimum for all cells
max_value="100,200,300|150,250,350"  # Per-cell maximums
```

#### Per-Cell Constraint Messages

The `constraint_message_min` and `constraint_message_max` parameters also support per-cell format:

1. **A single message** (applies to all cells):
   ```
   constraint_message_min="Value must be at least {min}"
   ```

2. **A list of messages** (applies per-cell):
   ```
   constraint_message_min="Q1 revenue must be at least {min},Q2 revenue must be at least {min}|Q3 must be at least {min},Q4 must be at least {min}"
   ```

**Message format:**
- Same pipe/comma format as constraint values
- Use `{min}` or `{max}` placeholders for the constraint value
- Leave empty to use the default message for that cell

#### Constraint Feedback Timing

Control when constraint error messages appear:

```
constraint_feedback_delay=2000   # Wait 2 seconds after typing stops (default)
constraint_feedback_delay=0      # Show errors immediately
```

This delay prevents premature error display while the user is still typing.
```

### 9.2 Example Forms

Add new sample form demonstrating:
- Per-cell min values
- Per-cell max values
- Mixed global + per-cell
- Sparse constraints

---

## 10. Implementation Estimate

### 10.1 Development Tasks

| Task | Description | Effort |
|------|-------------|--------|
| **1. Parser functions** | `parseConstraintValue()`, `getCellConstraint()`, `isPerCellFormat()` | Small |
| **2. Message parser functions** | `parseConstraintMessage()`, `getCellConstraintMessage()` | Small |
| **3. Parameter handling** | Update `getTableParameters()` to parse min/max values and messages | Small |
| **4. Validation update** | Modify `validateNumericInput()` to use per-cell values and messages | Small |
| **5. Feedback delay implementation** | Add separate debounce timer for constraint validation (2000ms default) | Small-Medium |
| **6. Blur handler update** | Trigger immediate constraint validation on cell blur | Small |
| **7. Call site updates** | Update all calls to `validateNumericInput()` to pass indices | Small |
| **8. Error handling** | Console warnings for malformed input | Small |
| **9. Unit tests** | Parser tests, message tests, timing tests | Medium |
| **10. Integration tests** | End-to-end validation scenarios | Medium |
| **11. Documentation** | README updates, example forms | Small |
| **12. Code review & QA** | Review, testing, bug fixes | Medium |

### 10.2 Complexity Assessment

**Overall complexity: LOW-MEDIUM**

**Rationale:**
- Builds on existing, well-structured code
- Pattern already exists (`historical_data` parsing)
- No architectural changes needed
- Validation flow unchanged, only constraint lookup modified
- Full backward compatibility (additive change)

### 10.3 Risk Factors

| Factor | Impact on Effort |
|--------|------------------|
| Existing test coverage | Unknown - may need test harness setup |
| Edge cases in production | May require iteration post-release |
| Documentation quality | Affects user adoption and support burden |

### 10.4 Assumptions

1. Existing codebase is stable and well-tested
2. No changes to form engine behavior during development
3. Standard browser support requirements maintained
4. No need for backwards-incompatible changes

---

## 11. Appendix

### A. Complete Parameter Format Reference

```
min_value parameter:
├── Single value: "0" or 0
│   └── Applied to ALL cells
├── Single row: "0,10,20"
│   └── Applied to row 0 only; other rows unconstrained
├── Multiple rows: "0,10,20|5,15,25"
│   └── Row 0: [0,10,20], Row 1: [5,15,25]
├── Sparse: "0,,20|,15,"
│   └── Only specified cells constrained
└── Empty: "" or omitted
    └── No constraints

max_value parameter:
└── [Same format as min_value]

constraint_message_min parameter:
├── Single message: "Value must be at least {min}"
│   └── Applied to ALL cells (with {min} substituted per cell)
├── Single row: "Q1: ≥{min},Q2: ≥{min},Q3: ≥{min}"
│   └── Applied to row 0 only; other rows use default
├── Multiple rows: "Q1: ≥{min},Q2: ≥{min}|Q3: ≥{min},Q4: ≥{min}"
│   └── Row 0: [Q1 msg, Q2 msg], Row 1: [Q3 msg, Q4 msg]
├── Sparse: "Custom msg,,Custom msg"
│   └── Empty positions use default message
└── Empty: "" or omitted
    └── All cells use default message

constraint_message_max parameter:
└── [Same format as constraint_message_min, using {max} placeholder]

constraint_feedback_delay parameter:
├── Default (omitted): 2000ms
│   └── Show constraint errors 2 seconds after typing stops
├── Custom value: e.g., 3000
│   └── Wait specified milliseconds before showing constraint errors
└── Zero: 0
    └── Show constraint errors immediately (with format validation at 300ms)
```

### B. Validation Message Placeholders

| Placeholder | Replaced With |
|-------------|---------------|
| `{min}` | Cell-specific minimum value |
| `{max}` | Cell-specific maximum value |

**Example 1: Global message with per-cell values**
```
constraint_message_min="Revenue must be at least ${min}"
min_value="1000,2000,3000"

Cell [0,0] error: "Revenue must be at least $1000"
Cell [0,1] error: "Revenue must be at least $2000"
Cell [0,2] error: "Revenue must be at least $3000"
```

**Example 2: Per-cell messages with per-cell values**
```
constraint_message_min="Q1 revenue: min ${min},Q2 revenue: min ${min},Q3 revenue: min ${min}"
min_value="1000,2000,3000"

Cell [0,0] error: "Q1 revenue: min $1000"
Cell [0,1] error: "Q2 revenue: min $2000"
Cell [0,2] error: "Q3 revenue: min $3000"
```

**Example 3: Per-cell messages with global value**
```
constraint_message_min="Q1 must be ≥{min},Q2 must be ≥{min},Q3 must be ≥{min}"
min_value=100

Cell [0,0] error: "Q1 must be ≥100"
Cell [0,1] error: "Q2 must be ≥100"
Cell [0,2] error: "Q3 must be ≥100"
```

### C. Decision Log

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| Extend existing params | New params like `cell_min_values` | Simpler API, backward compatible |
| Pipe/comma format | JSON array, semicolon-separated | Consistent with `historical_data` |
| Empty = unconstrained | Empty = 0, require explicit "none" | More intuitive, less verbose |
| Silent ignore extra values | Error on mismatch | More forgiving, easier to use |
| Per-cell message format | Separate `cell_messages` param | Consistent with constraint value format |
| Empty message = default | Empty = no message | Better UX, always shows feedback |
| 2-second feedback delay | Immediate, 1s, 500ms | Balances user typing speed with responsiveness |
| Separate delay for constraints | Same delay for all validation | Format errors need quick feedback, range errors can wait |
| Blur triggers immediate validation | Always wait for delay | Prevents user from leaving with unseen error |

---

## 12. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | | | |
| Technical Lead | | | |
| Product Owner | | | |
