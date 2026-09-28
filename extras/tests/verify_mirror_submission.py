#!/usr/bin/env python3
"""Read back the latest aha_revenue_by_payer_mirror submission and check the
saved table-grid answer against what was typed in the web-forms test run.

    python3 extras/tests/verify_mirror_submission.py
    (prompts for username and password; SCTO_SERVER defaults to mitoworks21)

Typed in that run: Medicaid a Gross 100, b Gross 50, c Net 57, d Net 3, and
999 into the (N/A) c Gross cell, which must not have been accepted.
"""
import getpass
import os
import sys

from surveycto_client import SurveyCTOClient

FORM_ID = 'aha_revenue_by_payer_mirror'

server = os.environ.get('SCTO_SERVER', 'mitoworks21')
username = os.environ.get('SCTO_USERNAME') or input('SurveyCTO username: ')
password = os.environ.get('SCTO_PASSWORD') or getpass.getpass('Password for %s: ' % username)
client = SurveyCTOClient(server, username, password)

subs = client.download_form_json_wide(FORM_ID)
if not subs:
    sys.exit('No submissions found for %s.' % FORM_ID)
latest = sorted(subs, key=lambda s: s.get('CompletionDate') or s.get('SubmissionDate') or '')[-1]
answer = latest.get('revenue_by_payer', '')
print('Submission :', latest.get('KEY'), latest.get('SubmissionDate'))
print('Answer     :', answer)
print('Before-grid:', repr(latest.get('revenue_by_payer_before', '')))
print('Echo calcs : total_gross=%r total_net=%r gme_gross=%r' % (
    latest.get('total_gross'), latest.get('total_net'), latest.get('gme_gross')))
print()

rows = answer.split('|')
expected = {3: '100,', 4: '50,', 5: ',57', 6: ',3', 7: ',', 8: ',', 9: '150,60', 16: '150,60'}
checks = [
    ('17 rows', len(rows) == 17),
    ('2 cells in every row', all(len(r.split(',')) == 2 for r in rows)),
    ('N/A cells (rows 6-9 Gross) saved blank', all(rows[i].split(',')[0] == '' for i in range(5, 9))),
    ('999 typed into an N/A cell was not saved', '999' not in answer),
]
for i, want in sorted(expected.items()):
    checks.append(('row %d = %r' % (i + 1, want), rows[i] == want if i < len(rows) else False))
checks.append(('untouched rows are blank', all(rows[i] == ',' for i in range(len(rows)) if i not in expected)))
checks.append(('form engine read TOTAL as 150 / 60',
               str(latest.get('total_gross')) == '150' and str(latest.get('total_net')) == '60'))

for name, ok in checks:
    print(('PASS  ' if ok else 'FAIL  ') + name)
fails = sum(1 for _, ok in checks if not ok)
print('\n%d passed, %d failed' % (len(checks) - fails, fails))
sys.exit(1 if fails else 0)
