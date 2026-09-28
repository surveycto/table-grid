#!/usr/bin/env python3
"""Deploy the AHA Revenue-by-Payer mirror form with the current plug-in build.

    SCTO_USERNAME=me@example.org python3 extras/tests/deploy_mirror.py
    (prompts for the password; SCTO_SERVER defaults to mitoworks21)

Creates the form in the root group, or replaces it in place if it already
exists. The attachment set is replaced wholesale so the server never keeps a
stale table-grid.fieldplugin.zip next to the new one.
"""
import getpass
import os
import sys

from surveycto_client import SurveyCTOClient
from surveycto_client.runtime import RateLimiter, safe_call, set_rate_limiter

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FORM_XLSX = os.path.join(REPO, 'extras', 'sample-form', 'AHA revenue by payer mirror.xlsx')
PLUGIN = os.path.join(REPO, 'table-grid.fieldplugin.zip')
FORM_ID = 'aha_revenue_by_payer_mirror'
ROOT_GROUP = 1

server = os.environ.get('SCTO_SERVER', 'mitoworks21')
username = os.environ.get('SCTO_USERNAME') or input('SurveyCTO username: ')
password = os.environ.get('SCTO_PASSWORD') or getpass.getpass('Password for %s: ' % username)

set_rate_limiter(RateLimiter(max_requests=25, period=60.0))
client = SurveyCTOClient(server, username, password)

xlsx = open(FORM_XLSX, 'rb').read()
attachments = [('table-grid.fieldplugin.zip', open(PLUGIN, 'rb').read())]

tree = safe_call(client.get_console_tree)
exists = any(f.get('id') == FORM_ID for f in tree.get('forms', []))

if exists:
    print('Updating existing form %s ...' % FORM_ID)
    safe_call(client.update_form, form_id=FORM_ID, xlsx_content=xlsx,
              filename=os.path.basename(FORM_XLSX), keep_media=False,
              attachments=attachments)
else:
    print('Deploying new form %s to the root group ...' % FORM_ID)
    safe_call(client.upload_form, xlsx_content=xlsx,
              filename=os.path.basename(FORM_XLSX), parent_group_id=ROOT_GROUP,
              attachments=attachments)

# list_form_attachments() misses the deployedGroupFiles.mediaFiles envelope
# and always returns [] -- read the endpoint directly.
resp = client.session.get('%s/forms/%s/files' % (client.base_url, FORM_ID), auth=client._auth, timeout=20)
try:
    media = (resp.json().get('deployedGroupFiles') or {}).get('mediaFiles') or []
except ValueError:
    media = []
names = [m.get('filename') or m.get('name') or str(m) if isinstance(m, dict) else str(m) for m in media]
print('Attachments on server:', names)
if not any('table-grid.fieldplugin.zip' in n for n in names):
    sys.exit('Plug-in did not attach -- check the console.')
print('Web form: https://%s.surveycto.com/collect/%s' % (server, FORM_ID))
