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

### 2.2 Navigation Blocking Mechanism

**Critical constraint:** The plug-in cannot directly control form navigation. It can only:
1. Call `setAnswer('')` to clear the field value
2. Rely on SurveyCTO's native `required=yes` to block progression on empty fields

**This means:**
- `validation_strict=true` + SurveyCTO `required=yes` = hard blocking
- `validation_strict=true` + SurveyCTO `required=no` = visual errors but NO blocking
- `validation_strict=false` = soft warnings, never blocks

### 2.3 Existing Parameter Format Reference

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

### 3.5 Validation Function Updates

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

    // Min check
    if (minValue !== null && numValue < minValue) {
        var msg = useSoftMessages
            ? params.constraintMessageMinSoft
            : params.constraintMessageMin;
        return {
            valid: false,
            message: msg.replace('{min}', minValue)
        };
    }

    // Max check
    if (maxValue !== null && numValue > maxValue) {
        var msg = useSoftMessages
            ? params.constraintMessageMaxSoft
            : params.constraintMessageMax;
        return {
            valid: false,
            message: msg.replace('{max}', maxValue)
        };
    }

    return { valid: true, message: '' };
}
```

### 3.6 Edge Cases and Handling

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

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Global min parsing | `min_value=0` | `{isPerCell: false, value: 0}` |
| Per-cell min parsing | `min_value="0,10,20"` | `{isPerCell: true, matrix: [[0,10,20]]}` |
| Mixed empty values | `min_value="0,,20"` | `matrix: [[0,null,20]]` |
| Multi-row parsing | `min_value="0,10|20,30"` | `matrix: [[0,10],[20,30]]` |
| Shorter list | 3×3 table, `"0,10"` | Row 0: [0,10,null], Rows 1-2: all null |
| Invalid value handling | `"0,abc,20"` | `[0, null, 20]` + console warning |

### 8.2 Integration Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Per-cell validation display | Enter invalid values in cells with different constraints | Each cell shows its specific error |
| Global + per-cell mixed | Global min, per-cell max | Both constraints respected per cell |
| Hard validation blocking | `validation_strict=true`, invalid cell | Form cannot progress |
| Backward compat - global | Existing form with `min_value=0` | Exact same behavior as before |
| Sparse constraints | Only some cells constrained | Unconstrained cells accept any value |

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
| **2. Parameter handling** | Update `getTableParameters()` to parse min/max as constraint definitions | Small |
| **3. Validation update** | Modify `validateNumericInput()` to accept row/col indices | Small |
| **4. Call site updates** | Update all calls to `validateNumericInput()` to pass indices | Small |
| **5. Error handling** | Console warnings for malformed input | Small |
| **6. Unit tests** | Parser tests, constraint retrieval tests | Small-Medium |
| **7. Integration tests** | End-to-end validation scenarios | Medium |
| **8. Documentation** | README updates, example forms | Small |
| **9. Code review & QA** | Review, testing, bug fixes | Medium |

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
```

### B. Validation Message Placeholders

| Placeholder | Replaced With |
|-------------|---------------|
| `{min}` | Cell-specific minimum value |
| `{max}` | Cell-specific maximum value |

**Example:**
```
constraint_message_min="Revenue must be at least ${min}"
min_value="1000,2000,3000"

Cell [0,0] error: "Revenue must be at least $1000"
Cell [0,1] error: "Revenue must be at least $2000"
Cell [0,2] error: "Revenue must be at least $3000"
```

### C. Decision Log

| Decision | Alternatives Considered | Rationale |
|----------|------------------------|-----------|
| Extend existing params | New params like `cell_min_values` | Simpler API, backward compatible |
| Pipe/comma format | JSON array, semicolon-separated | Consistent with `historical_data` |
| Empty = unconstrained | Empty = 0, require explicit "none" | More intuitive, less verbose |
| Silent ignore extra values | Error on mismatch | More forgiving, easier to use |

---

## 12. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | | | |
| Technical Lead | | | |
| Product Owner | | | |
