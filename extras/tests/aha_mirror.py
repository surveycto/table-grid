"""AHA "Revenue by Payer" grid, mirrored from the screenshots on EST-358
(28 Sep 2026). Row wording, section breaks and historical values are copied
from what is visible; the rows the screenshots scroll past (g. Total Medicaid
and 4a(3) Other government) are reconstructed so that every subtotal and the
4c TOTAL add up to the historical figures AHA shows.

Shared by the web-Collect harness and the acceptance tests so both exercise
the same configuration.
"""

# (label, gross history, net history). None = not applicable for that column.
ROWS = [
    ("<b>4a.GOVERNMENT(1) Medicare (4a(1))</b> :<br>a. Fee for service patient revenue", 756165510, 210752484),
    ("b. Managed care revenue", 2074659886, 597101509),
    ("c. Total <b>(a + b)</b>", 2830825396, 807853993),
    ("<b>4a. GOVERNMENT(2)Medicaid (4a(2)):</b><br>a. Fee for service patient revenue", 270239539, 37470804),
    ("b. Managed care revenue", 1099033735, 210336386),
    ("c. Medicaid Graduate Medical Education (GME) payments", None, 7323626),
    ("d. Medicaid Disproportionate Share Hospital Payments (DSH)", None, 0),
    ("e. Medicaid State Directed Payments", None, 357395647),
    ("f. Other Medicaid Supplemental Payments(not including Medicaid DSH Payments "
     "or Medicaid State Directed Payments)", None, 33331708),
    ("g. Total Medicaid <b>(a + b + c + d + e + f)</b>", 1369273274, 645858171),
    ("<b>4a. GOVERNMENT(3) Other government (4a(3)):</b>", 149507537, 46846669),
    ("<b>4b. NONGOVERNMENT:(1) Self-pay (4b(1)):</b>", 83499304, 12192036),
    ("<b>4b. NONGOVERNMENT:(2) Commercial payers(4b(2)):</b><br>a. Managed care (includes HMO and PPO)", 2486101451, 1480224107),
    ("b. Other Commercial payers", 122968646, 46694474),
    ("c. Total Commercial payers <b>(a + b)</b>", 2609070097, 1526918581),
    ("<b>4b. NONGOVERNMENT:4b(3) All other nongovernment:</b>", 200995809, 119419820),
    ("<b>4c. TOTAL</b><br>( Total net should equal F1a.)", 7243171417, 3159089270),
]

SUBTOTALS = '3:1-2|10:4-9|15:13-14'
GRID_TOTAL = '17:3,10,11,12,15,16'
NA_CELLS = '6-9:1'          # Medicaid c-f have no Gross figure


def history(na_text=''):
    """historical_data matrix. na_text fills the not-applicable slots --
    'Field Not Required' reproduces AHA's current workaround."""
    out = []
    for _, g, n in ROWS:
        out.append(','.join(na_text if v is None else str(v) for v in (g, n)))
    return '|'.join(out)


def params(na_cells=True, na_text=''):
    p = {
        'rows': str(len(ROWS)),
        'cols': '2',
        'row_labels': '|'.join(r[0] for r in ROWS),
        'col_labels': 'Gross|Net',
        'historical_data': history(na_text),
        'historical_display': 'bottom',
        'format_numbers': 'true',
        'allow_decimals': 'false',
        'min_value': '0',
        'subtotals': SUBTOTALS,
        'grid_total': GRID_TOTAL,
        'row_label_width': '40%',
        'label_weight': 'normal',
        'show_historical': 'true',
    }
    if na_cells:
        p['na_cells'] = NA_CELLS
    return p


def _check():
    # Reconstructed rows must make every subtotal and the TOTAL add up.
    def col(i, rows):
        return sum((ROWS[r - 1][i] or 0) for r in rows)
    for i in (1, 2):
        assert col(i, [1, 2]) == ROWS[2][i]
        assert col(i, range(4, 10)) == ROWS[9][i]
        assert col(i, [13, 14]) == ROWS[14][i]
        assert col(i, [3, 10, 11, 12, 15, 16]) == ROWS[16][i]


_check()
