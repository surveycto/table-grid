#!/usr/bin/env python3
"""Headless checks for who gets the cursor when the plug-in loads.

Background (EST-358, Oct 2026): with two grids on one web-forms page, a
page redraw mid-typing reloads both plug-ins; each then grabbed focus on
load and the caret was yanked out of the cell being typed in. In web forms
the host calls setFocus() itself when the field should take the cursor, so
the plug-in must not take it on its own there. Android/iOS Collect keep the
self-focus (one field per screen, soft keyboard should open at once).

    python3 extras/tests/focus_on_load.py
"""
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


def _find_source():
    env = os.environ.get('TABLE_GRID_SRC')
    if env:
        return env
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(os.path.dirname(here))
    candidate = os.path.join(repo, 'source')
    return candidate if os.path.isdir(candidate) else os.path.join(os.getcwd(), 'source')


def _find_chrome():
    env = os.environ.get('CHROME')
    if env:
        return env
    for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'):
        found = shutil.which(name)
        if found:
            return found
    for path in ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                 '/Applications/Chromium.app/Contents/MacOS/Chromium',
                 '/usr/bin/google-chrome', '/usr/bin/chromium'):
        if os.path.exists(path):
            return path
    sys.exit('No Chrome/Chromium found. Set CHROME=/path/to/chrome and re-run.')


SRC = _find_source()
CHROME = _find_chrome()
TEMPLATE = open(os.path.join(SRC, 'template.html'), encoding='utf-8').read()
STYLE = open(os.path.join(SRC, 'style.css'), encoding='utf-8').read()
SCRIPT = open(os.path.join(SRC, 'script.js'), encoding='utf-8').read()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><style>%(style)s</style></head>
<body class="%(body_class)s">
<script>
window.__answers = [];
window.setAnswer = function (v) { window.__answers.push(v); };
window.__params = %(params)s;
window.getPluginParameter = function (k) {
  return Object.prototype.hasOwnProperty.call(window.__params, k) ? window.__params[k] : null;
};
window.fieldProperties = { CURRENT_ANSWER: %(current)s, APPEARANCE: '', LANGUAGE: 'default',
  READONLY: false, PARAMETERS: [] };
window.__log = [];
window.__assert = function (name, cond, detail) {
  window.__log.push((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '   <- ' + detail));
};
window.active = function () {
  var a = document.activeElement;
  if (!a || a === document.body) return 'body';
  return a.tagName + (a.dataset ? '[' + a.dataset.row + ',' + a.dataset.col + ']' : '');
};
</script>
%(template)s
<pre id="results"></pre>
<script>%(script)s</script>
<script>
var steps = %(steps)s;
function runStep(i) {
  if (i >= steps.length) {
    document.getElementById('results').textContent = window.__log.join('\\n');
    return;
  }
  try { (0, eval)(steps[i]); } catch (e) { window.__log.push('FAIL  step ' + i + ' threw: ' + e.message); }
  setTimeout(function () { runStep(i + 1); }, 400);
}
setTimeout(function () { runStep(0); }, 400);
</script>
</body></html>
"""


def _js(value):
    return json.dumps(value).replace('</', '<\\/')


def render(params, steps, current, body_class):
    tpl = TEMPLATE
    for tag in ['LABEL', 'HINT', 'MEDIAIMAGE', 'MEDIAAUDIO', 'MEDIAVIDEO']:
        tpl = tpl.replace('{{{%s}}}' % tag, '').replace('{{%s}}' % tag, '')
    tpl = re.sub(r'\{\{#\w+\}\}.*?\{\{/\w+\}\}', '', tpl, flags=re.S)
    tpl = tpl.replace('{{CURRENT_ANSWER}}', html.escape(current))
    return PAGE % {'style': STYLE, 'script': SCRIPT, 'template': tpl, 'params': _js(params),
                   'current': _js(current), 'steps': _js(steps), 'body_class': body_class}


def run(name, params, steps, current='', body_class='web-collect'):
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8') as f:
        f.write(render(params, steps, current, body_class))
        path = f.name
    proc = subprocess.run(
        [CHROME, '--headless', '--disable-gpu', '--no-sandbox',
         '--virtual-time-budget=%d' % (1200 + 700 * len(steps)), '--dump-dom', 'file://' + path],
        capture_output=True, text=True, timeout=180)
    m = re.search(r'<pre id="results">(.*?)</pre>', proc.stdout, re.S)
    body = html.unescape(m.group(1)).strip() if m else ''
    if proc.returncode != 0:
        body += '\nFAIL  browser exited with status %d' % proc.returncode
    if not m:
        body += '\nFAIL  no results block in the page (steps never completed)'
    elif not re.search(r'^(PASS|FAIL)', body, re.M):
        body += '\nFAIL  no assertions executed'
    body = body.strip()
    print('=' * 72)
    print(name)
    print('=' * 72)
    print(body)
    print()
    os.unlink(path)
    return body


GRID = {'rows': '3', 'cols': '2', 'row_labels': 'New construction,Facility renovation,Facility infrastructure',
        'col_labels': '2026 actual %,2027 projected %'}

results = []

# A web-forms page redraw reloads the plug-in with its partial answer. The
# respondent is typing in another field; this grid must not take the cursor.
results.append(run('1. web forms: reload with a partial answer does not take focus', GRID, [
    """__assert('no cell focused after load', active() === 'body', 'active=' + active());""",
], current='6,5|32,|,'))

# Same rule for a fresh field: in web forms the host decides who has focus.
results.append(run('2. web forms: fresh field does not take focus on its own', GRID, [
    """__assert('no cell focused after load', active() === 'body', 'active=' + active());""",
]))

# When the host does hand the cursor over, the first open cell takes it.
results.append(run('3. web forms: host setFocus() focuses the first cell', GRID, [
    """setFocus();""",
    """__assert('first cell focused', active() === 'INPUT[0,0]', 'active=' + active());""",
], current='6,5|32,|,'))

# Collect keeps the old behaviour: one field per screen, cursor ready at once.
results.append(run('4. Android Collect: first cell focused on load', GRID, [
    """__assert('first cell focused', active() === 'INPUT[0,0]', 'active=' + active());""",
], body_class='android-collect'))

fails = sum(len(re.findall(r'^FAIL', r, re.M)) for r in results)
passes = sum(len(re.findall(r'^PASS', r, re.M)) for r in results)
print('%d passed, %d failed' % (passes, fails))
sys.exit(1 if fails else 0)
