#!/usr/bin/env python3
"""Headless acceptance runs for the table-grid subtotals feature.

Builds a page per scenario with stubbed host APIs, loads the real
source/template.html + style.css + script.js, drives the DOM, and prints
assertions. Chrome's virtual time budget fast-forwards the debounce timers.
"""
import html
import json
import os
import re
import subprocess
import sys
import tempfile

import shutil


def _find_source():
    """Locate source/. Env override first, then the repo this file sits in."""
    env = os.environ.get('TABLE_GRID_SRC')
    if env:
        return env
    here = os.path.dirname(os.path.abspath(__file__))          # extras/tests
    repo = os.path.dirname(os.path.dirname(here))               # repo root
    candidate = os.path.join(repo, 'source')
    if os.path.isdir(candidate):
        return candidate
    return os.path.join(os.getcwd(), 'source')


def _find_chrome():
    """Locate a Chrome/Chromium binary. Env override first, then PATH, then
    the usual per-platform install locations."""
    env = os.environ.get('CHROME')
    if env:
        return env
    for name in ('google-chrome', 'google-chrome-stable', 'chromium',
                 'chromium-browser', 'chrome'):
        found = shutil.which(name)
        if found:
            return found
    for path in (
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    ):
        if os.path.exists(path):
            return path
    sys.exit('No Chrome/Chromium found. Set CHROME=/path/to/chrome and re-run.')


SRC = _find_source()
CHROME = _find_chrome()

if not os.path.isdir(SRC):
    sys.exit('No source/ directory at %s. Set TABLE_GRID_SRC and re-run.' % SRC)

TEMPLATE = open(os.path.join(SRC, 'template.html'), encoding='utf-8').read()
STYLE = open(os.path.join(SRC, 'style.css'), encoding='utf-8').read()
SCRIPT = open(os.path.join(SRC, 'script.js'), encoding='utf-8').read()

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><style>%(style)s</style></head>
<body class="web-collect">
<script>
window.__answers = [];
window.setAnswer = function (v) { window.__answers.push(v); };
window.__params = %(params)s;
window.getPluginParameter = function (k) {
  return Object.prototype.hasOwnProperty.call(window.__params, k) ? window.__params[k] : null;
};
window.fieldProperties = {
  CURRENT_ANSWER: %(current)s,
  APPEARANCE: %(appearance)s,
  LANGUAGE: 'default',
  READONLY: false,
  PARAMETERS: []
};
window.__log = [];
window.__assert = function (name, cond, detail) {
  window.__log.push((cond ? 'PASS  ' : 'FAIL  ') + name + (cond ? '' : '   <- ' + detail));
};
window.lastAnswer = function () {
  return window.__answers.length ? window.__answers[window.__answers.length - 1] : null;
};
window.cell = function (r, c) {
  return document.querySelector('input[data-row="' + r + '"][data-col="' + c + '"]');
};
window.type = function (r, c, v) {
  var el = window.cell(r, c);
  if (!el) { window.__log.push('FAIL  no cell ' + r + ',' + c); return; }
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
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


def render(params, steps, current='', appearance=''):
    tpl = TEMPLATE
    for tag in ['LABEL', 'HINT', 'MEDIAIMAGE', 'MEDIAAUDIO', 'MEDIAVIDEO']:
        tpl = tpl.replace('{{{%s}}}' % tag, '').replace('{{%s}}' % tag, '')
    tpl = re.sub(r'\{\{#\w+\}\}.*?\{\{/\w+\}\}', '', tpl, flags=re.S)
    tpl = tpl.replace('{{CURRENT_ANSWER}}', html.escape(current))
    return PAGE % {
        'style': STYLE,
        'script': SCRIPT,
        'template': tpl,
        'params': _js(params),
        'current': _js(current),
        'appearance': _js(appearance),
        'steps': _js(steps),
    }


def _js(value):
    """JSON for an inline <script>. A literal '</script>' in a value (test 17
    feeds one through row_labels) would otherwise close the harness's own
    script tag and the steps would never run."""
    return json.dumps(value).replace('</', '<\\/')


def run(name, params, steps, current='', appearance=''):
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8') as f:
        f.write(render(params, steps, current, appearance))
        path = f.name
    budget = 1200 + 700 * len(steps)
    proc = subprocess.run(
        [CHROME, '--headless', '--disable-gpu', '--no-sandbox',
         '--virtual-time-budget=%d' % budget, '--dump-dom', 'file://' + path],
        capture_output=True, text=True, timeout=180)
    m = re.search(r'<pre id="results">(.*?)</pre>', proc.stdout, re.S)
    body = html.unescape(m.group(1)).strip() if m else ''
    # A browser that crashed or never ran the steps must not read as a pass:
    # with no assertions there is nothing to fail, so say so explicitly.
    if proc.returncode != 0:
        body += '\nFAIL  browser exited with status %d: %s' % (
            proc.returncode, (proc.stderr.strip().splitlines() or ['(no stderr)'])[-1])
    if not m:
        body += '\nFAIL  no results block in the page (steps never completed)'
    elif not re.search(r'^(PASS|FAIL)', body, re.M):
        body += '\nFAIL  no assertions executed'
    body = body.strip()
    print('=' * 72)
    print(name)
    print('=' * 72)
    print(body if body else '(empty)')
    print()
    os.unlink(path)
    return body


AHA = {
    'rows': '12', 'cols': '2',
    'row_labels': 'Medicare FFS,Medicare Advantage,Medicare subtotal,'
                  'Medicaid FFS,Medicaid managed care,Medicaid subtotal,'
                  'Other government,Commercial FFS,Commercial managed care,'
                  'Commercial subtotal,Self-pay,TOTAL',
    'col_labels': 'Charges,Payments',
    'subtotals': '3:1-2|6:4-5|10:8-9',
    'grid_total': '12:3,6,7,10,11',
}

results = []

# --- 1. render, initialise, live-update ---------------------------------
results.append(run('1. Subtotal rows render, initialise from components, live-update', AHA, [
    """__assert('subtotal rows carry .subtotal-row',
        document.querySelectorAll('tr.subtotal-row').length === 3,
        'got ' + document.querySelectorAll('tr.subtotal-row').length);
       __assert('grid total row carries .grid-total-row',
        document.querySelectorAll('tr.grid-total-row').length === 1,
        'got ' + document.querySelectorAll('tr.grid-total-row').length);
       __assert('subtotal cells are editable inputs',
        !!cell(2,0) && cell(2,0).tagName === 'INPUT' && !cell(2,0).readOnly, 'missing/readonly');
       __assert('empty grid leaves subtotals empty, not 0',
        cell(2,0).value === '' && cell(11,0).value === '', 'sub=' + cell(2,0).value + ' total=' + cell(11,0).value);""",
    """type(0,0,'100'); type(1,0,'50');""",
    """__assert('subtotal = 100+50 = 150', cell(2,0).value === '150', 'got ' + cell(2,0).value);
       __assert('live-updates on further edits', true, '');
       type(1,0,'70');""",
    """__assert('subtotal follows component edit -> 170', cell(2,0).value === '170', 'got ' + cell(2,0).value);
       __assert('other column untouched', cell(2,1).value === '', 'got ' + cell(2,1).value);""",
]))

# --- 2. override semantics ----------------------------------------------
results.append(run('2. Override wins permanently; reference sum + warning; never blocks', AHA, [
    """type(0,0,'100'); type(1,0,'50');""",
    """type(2,0,'900');""",
    """__assert('override marks cell manual', cell(2,0).getAttribute('data-manual') === 'true', 'not marked');
       __assert('override value kept', cell(2,0).value === '900', 'got ' + cell(2,0).value);
       var cap = document.querySelector('.subtotal-calc[data-calc-row="2"][data-calc-col="0"]');
       __assert('reference caption shows calculated sum',
         cap && cap.style.display !== 'none' && cap.textContent.indexOf('Calculated: 150') >= 0,
         cap ? JSON.stringify(cap.textContent) : 'no caption');
       __assert('variance warning styling applied',
         !!document.querySelector('td.subtotal-variance'), 'no variance cell');
       __assert('progression not blocked (answer still set)',
         typeof lastAnswer() === 'string' && lastAnswer().length > 0, 'answer=' + lastAnswer());""",
    """type(1,0,'60');""",
    """__assert('later component edit does NOT overwrite override', cell(2,0).value === '900', 'got ' + cell(2,0).value);
       var cap = document.querySelector('.subtotal-calc[data-calc-row="2"][data-calc-col="0"]');
       __assert('reference sum updates to 160', cap.textContent.indexOf('Calculated: 160') >= 0, JSON.stringify(cap.textContent));""",
    """document.querySelector('.subtotal-restore').click();""",
    """__assert('restore link hands cell back to auto', cell(2,0).value === '160', 'got ' + cell(2,0).value);
       __assert('restore clears manual flag', cell(2,0).getAttribute('data-manual') !== 'true', 'still manual');""",
]))

# --- 3. total = sum of subtotals; overrides flow through -----------------
results.append(run('3. Grid total sums subtotals and one-offs; overrides flow through', AHA, [
    """type(0,0,'100'); type(1,0,'50');   // Medicare  -> 150
       type(3,0,'200'); type(4,0,'40');   // Medicaid  -> 240
       type(6,0,'25');                    // Other government (one-off)
       type(7,0,'300'); type(8,0,'10');   // Commercial -> 310
       type(10,0,'5');                    // Self-pay (one-off)""",
    """__assert('subtotals 150/240/310',
        cell(2,0).value === '150' && cell(5,0).value === '240' && cell(9,0).value === '310',
        [cell(2,0).value, cell(5,0).value, cell(9,0).value].join('/'));
       __assert('total = 150+240+25+310+5 = 730', cell(11,0).value === '730', 'got ' + cell(11,0).value);""",
    """type(2,0,'900');""",
    """__assert('subtotal override changes the total (900+240+25+310+5=1480)',
        cell(11,0).value === '1480', 'got ' + cell(11,0).value);""",
    """type(11,0,'42');""",
    """__assert('total override wins over everything', cell(11,0).value === '42', 'got ' + cell(11,0).value);
       var cap = document.querySelector('.subtotal-calc[data-calc-row="11"][data-calc-col="0"]');
       __assert('total shows its calculated reference', cap.textContent.indexOf('Calculated: 1480') >= 0, JSON.stringify(cap.textContent));
       type(0,0,'1');""",
    """__assert('total override survives component edits', cell(11,0).value === '42', 'got ' + cell(11,0).value);""",
]))

# --- 4. one-off rows render plain ---------------------------------------
results.append(run('4. One-off rows render as ordinary rows', AHA, [
    """var rows = document.querySelectorAll('tbody tr');
       var other = rows[6], self = rows[10];
       __assert('Other government is not a subtotal row',
         other.className.indexOf('subtotal-row') < 0 && other.className.indexOf('grid-total-row') < 0, other.className);
       __assert('Self-pay is not a subtotal row',
         self.className.indexOf('subtotal-row') < 0 && self.className.indexOf('grid-total-row') < 0, self.className);
       __assert('no duplicated subtotal row rendered for one-offs',
         document.querySelectorAll('tbody tr').length === 12, 'row count ' + document.querySelectorAll('tbody tr').length);
       __assert('one-off has no reference caption',
         !document.querySelector('.subtotal-calc[data-calc-row="6"]'), 'caption present');""",
]))

# --- 5. serialization / item-at positions -------------------------------
results.append(run('5. Worked example serialization and item-at positions', AHA, [
    """type(0,0,'100'); type(0,1,'90');
       type(1,0,'50');  type(1,1,'45');
       type(3,0,'200'); type(4,0,'40');
       type(6,0,'25');
       type(7,0,'300'); type(8,0,'10');
       type(10,0,'5');""",
    """var a = lastAnswer();
       var rows = a.split('|');
       __assert('12 serialized rows', rows.length === 12, 'got ' + rows.length + ' :: ' + a);
       __assert('each row has 2 comma-separated cells',
         rows.every(function (r) { return r.split(',').length === 2; }), a);
       __assert("item-at('|',ans,2) is the Medicare subtotal row", rows[2] === '150,135', 'got ' + rows[2]);
       __assert("item-at('|',ans,11) is the TOTAL row", rows[11] === '730,135', 'got ' + rows[11]);
       __assert("item-at(',',item-at('|',ans,2),0) = 150", rows[2].split(',')[0] === '150', rows[2]);
       window.__log.push('       answer = ' + a);""",
]))

# --- 6. override survives a save/reload round trip -----------------------
results.append(run('6. Override state is rebuilt from the saved answer (no metadata)', AHA, [
    """__assert('overridden subtotal reloaded as manual',
        cell(2,0).getAttribute('data-manual') === 'true', 'not manual');
       __assert('overridden value preserved on reload', cell(2,0).value === '900', 'got ' + cell(2,0).value);
       __assert('non-overridden subtotal reloaded as auto',
        cell(5,0).getAttribute('data-manual') !== 'true', 'wrongly manual');
       var cap = document.querySelector('.subtotal-calc[data-calc-row="2"][data-calc-col="0"]');
       __assert('reference caption restored after reload',
        cap && cap.textContent.indexOf('Calculated: 150') >= 0, cap ? JSON.stringify(cap.textContent) : 'none');""",
    """type(1,0,'55');""",
    """__assert('reloaded override still not overwritten', cell(2,0).value === '900', 'got ' + cell(2,0).value);""",
], current='100,0|50,0|900,0|200,0|40,0|240,0|25,0|300,0|10,0|310,0|5,0|1480,0'))

# --- 7. config errors ----------------------------------------------------
bad = dict(AHA)
bad['total'] = 'row'
results.append(run("7a. total='row' + subtotal groups fails loudly", bad, [
    """__assert('config error rendered', !!document.querySelector('.config-error'), 'no error box');
       __assert('no grid rendered', !document.querySelector('table.data-table'), 'grid still rendered');
       __assert('answer cleared', lastAnswer() === '', 'answer=' + JSON.stringify(lastAnswer()));
       var t = document.querySelector('.config-error').textContent;
       __assert('error names the clash', t.indexOf("total='row'") >= 0, t);""",
]))

bad2 = dict(AHA)
bad2['subtotals'] = '3:1-2|3:4-5'
results.append(run('7b. duplicate subtotal target fails loudly', bad2, [
    """__assert('config error rendered', !!document.querySelector('.config-error'), 'no error box');
       var t = document.querySelector('.config-error').textContent;
       __assert('error explains duplicate target', t.indexOf('more than once') >= 0, t);""",
]))

bad3 = dict(AHA)
bad3['subtotals'] = '3:1-99'
results.append(run('7c. out-of-range source row fails loudly (not silently ignored)', bad3, [
    """__assert('config error rendered', !!document.querySelector('.config-error'), 'no error box');
       var t = document.querySelector('.config-error').textContent;
       __assert('error quotes the bad entry', t.indexOf('3:1-99') >= 0, t);""",
]))

bad4 = dict(AHA)
bad4['grid_total'] = '12:3,6,12'
results.append(run('7d. total that sums itself fails loudly', bad4, [
    """__assert('config error rendered', !!document.querySelector('.config-error'), 'no error box');
       var t = document.querySelector('.config-error').textContent;
       __assert('error explains self-reference', t.indexOf('itself') >= 0, t);""",
]))

# --- 8. max_value exemption ---------------------------------------------
capped = dict(AHA)
capped['max_value'] = '500'
capped['min_value'] = '0'
capped['validation_strict'] = 'true'  # hard messages, AHA's blocking case
results.append(run('8. max_value exempts subtotal rows; min_value still applies', capped, [
    """type(0,0,'400'); type(1,0,'300');""",
    """__assert('subtotal 700 exceeds max_value=500 but is not flagged',
        cell(2,0).value === '700', 'got ' + cell(2,0).value);
       var msg = document.querySelector('input[data-row="2"][data-col="0"]').parentNode.querySelector('.validation-message');
       __assert('no max violation shown on the subtotal cell',
        !msg || msg.textContent.indexOf('at most') < 0, msg ? msg.textContent : '');
       type(0,0,'600');""",
    """var m0 = cell(0,0).parentNode.querySelector('.validation-message');
       __assert('line item over max IS still flagged',
        !!m0 && m0.textContent.indexOf('at most') >= 0, m0 ? m0.textContent : 'no message');""",
    """type(2,0,'-5');""",
    """var m2 = cell(2,0).parentNode.querySelector('.validation-message');
       __assert('min_value still applies to an overridden subtotal',
        !!m2 && m2.textContent.indexOf('at least') >= 0, m2 ? m2.textContent : 'no message');""",
]))

# --- 9. no-groups regression --------------------------------------------
plain = {'rows': '3', 'cols': '3', 'row_labels': 'Salaries,Equipment,Travel',
         'col_labels': 'Q1,Q2,Q3', 'format_numbers': 'true', 'total': 'column'}
results.append(run('9. No-groups grid: unchanged behaviour and serialization', plain, [
    """type(0,0,'1000'); type(0,1,'2000'); type(0,2,'3000');
       type(1,0,'10'); type(1,1,'20'); type(1,2,'30');
       type(2,0,'1'); type(2,1,'2'); type(2,2,'3');""",
    """__assert('no subtotal rows rendered', document.querySelectorAll('tr.subtotal-row, tr.grid-total-row').length === 0, 'found some');
       __assert('no config error', !document.querySelector('.config-error'), 'error box present');
       __assert('legacy total row still present', !!document.querySelector('tr.total-row'), 'missing total row');
       __assert('column total unaffected by the new skip logic',
         document.querySelector('[data-total-col="0"]').textContent === '1,011',
         'got ' + document.querySelector('[data-total-col="0"]').textContent);
       __assert('serialization unchanged: 1000,2000,3000|10,20,30|1,2,3',
         lastAnswer() === '1000,2000,3000|10,20,30|1,2,3', 'got ' + lastAnswer());""",
]))


# --- 10. iframe resize does not run away on a tall grid -----------------
tall = dict(AHA)
results.append(run('10. No iframe-resize runaway on a 12-row grid with subtotals', tall, [
    """window.__sizeCalls = 0;
       window.__heights = [];
       window.parentIFrame = {
         size: function () { window.__sizeCalls++; window.__heights.push(document.body.offsetHeight); },
         setHeightCalculationMethod: function () {},
         getPageInfo: function () {}
       };""",
    """type(0,0,'100'); type(1,0,'50'); type(3,0,'200'); type(4,0,'40');
       type(6,0,'25'); type(7,0,'300'); type(8,0,'10'); type(10,0,'5');""",
    """var before = window.__sizeCalls;
       window.__settleBase = before;""",
    """var after = window.__sizeCalls;
       __assert('resize calls stop once editing stops',
         after - window.__settleBase === 0, 'grew by ' + (after - window.__settleBase));
       var c = document.getElementById('table-container');
       __assert('container keeps a pixel max-height cap',
         /px$/.test(c.style.maxHeight), 'maxHeight=' + c.style.maxHeight);
       var hs = window.__heights;
       var maxH = Math.max.apply(null, hs.concat([0]));
       __assert('body height stayed bounded (<= 3x cap)',
         maxH <= parseFloat(c.style.maxHeight) * 3 + 400, 'max body height ' + maxH + ' vs cap ' + c.style.maxHeight);
       __assert('height did not grow monotonically across calls',
         hs.length < 2 || hs[hs.length-1] <= maxH, hs.join(','));
       window.__log.push('       size() calls: ' + window.__sizeCalls + ', heights: ' + hs.join(','));""",
]))


# --- 11. malformed specs must not parse permissively ---------------------
for spec, why in [('3oops:1-2', 'garbage in target'),
                  ('3:1-2junk', 'garbage in range end'),
                  ('3:1,1,2', 'duplicate source row (would double-count)'),
                  ('3:1e2', 'exponent notation')]:
    b = dict(AHA); b['subtotals'] = spec
    results.append(run('11. Rejects "%s" (%s)' % (spec, why), b, [
        """__assert('config error rendered', !!document.querySelector('.config-error'), 'NO ERROR - spec was accepted');
           __assert('no grid rendered', !document.querySelector('table.data-table'), 'grid rendered anyway');""",
    ]))

# --- 12. clearAnswer resets subtotal state -------------------------------
results.append(run('12. clearAnswer fully resets subtotal state', AHA, [
    """type(0,0,'100'); type(1,0,'50');""",
    """type(2,0,'900');""",
    """__assert('precondition: cell is overridden with variance',
        cell(2,0).getAttribute('data-manual') === 'true' && !!document.querySelector('td.subtotal-variance'), 'setup failed');
       clearAnswer();""",
    """__assert('values cleared', cell(2,0).value === '' && cell(0,0).value === '', 'sub=' + cell(2,0).value);
       __assert('override flag cleared', cell(2,0).getAttribute('data-manual') !== 'true', 'still manual');
       __assert('variance styling cleared', !document.querySelector('td.subtotal-variance'), 'variance remains');
       var cap = document.querySelector('.subtotal-calc[data-calc-row="2"][data-calc-col="0"]');
       __assert('reference caption cleared', cap.textContent === '' && cap.style.display === 'none', JSON.stringify(cap.textContent));""",
    """type(0,0,'10'); type(1,0,'20');""",
    """__assert('subtotal auto-fills again after clear', cell(2,0).value === '30', 'got ' + cell(2,0).value);""",
]))

# --- 13. restored validation honours the max_value exemption -------------
reload_capped = dict(AHA)
reload_capped['max_value'] = '500'
reload_capped['validation_strict'] = 'true'
results.append(run('13. Restored validation exempts subtotals from max_value', reload_capped, [
    """var msg = cell(2,0).parentNode.querySelector('.validation-message');
       __assert('no spurious max warning on the restored subtotal',
         !msg || msg.textContent.indexOf('at most') < 0, msg ? msg.textContent : '');
       var m0 = cell(0,0).parentNode.querySelector('.validation-message');
       __assert('line item over max IS still flagged on restore',
         !!m0 && m0.textContent.indexOf('at most') >= 0, m0 ? m0.textContent : 'no message');""",
], current='600,0|50,0|650,0|,|,|,|,|,|,|,|,|,'))


# --- 14. `use` chip survives the blur-triggered recompute ----------------
# Regression for the focus race found on device and in web forms: the input's
# blur handler recomputes subtotals, which used to rebuild the caption and
# detach the restore button between mousedown and mouseup, so the first real
# click never produced a click event. Asserting only on btn.click() passes
# either way -- node identity and the mousedown default are what distinguish
# fixed from broken.
# format_numbers matters: it routes input handling down the ENHANCED branch,
# whose blur handler calls updateSubtotals. Without it the standard branch is
# used, blur never recomputes, and the race cannot reproduce -- which is how
# the original suite missed this. The AHA demo form sets format_numbers='true'.
chip = dict(AHA)
chip['format_numbers'] = 'true'
results.append(run('14. Restore chip survives blur recompute (pointer race)', chip, [
    """type(0,0,'100'); type(1,0,'50');""",
    """type(2,0,'900');""",
    """window.__btn = document.querySelector('.subtotal-restore');
       __assert('chip is present after override', !!window.__btn, 'no chip');
       var md = new MouseEvent('mousedown', {bubbles: true, cancelable: true});
       var notCancelled = window.__btn.dispatchEvent(md);
       __assert('chip preventDefaults mousedown so the cell keeps focus',
         notCancelled === false, 'mousedown default was not prevented');
       cell(2,0).focus();
       cell(2,0).blur();""",
    """__assert('chip node survived the blur recompute',
         !!window.__btn && window.__btn.isConnected === true, 'button node was replaced/detached');
       __assert('chip in the DOM is the same node that got mousedown',
         document.querySelector('.subtotal-restore') === window.__btn, 'DOM holds a different node');
       window.__btn.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
       window.__btn.click();""",
    """__assert('click on the surviving node reverts the override',
         cell(2,0).value === '150', 'got ' + cell(2,0).value);
       __assert('override flag cleared', cell(2,0).getAttribute('data-manual') !== 'true', 'still manual');
       __assert('variance styling cleared', !document.querySelector('td.subtotal-variance'), 'variance remains');""",
    """type(1,0,'70');""",
    """__assert('caption still re-renders when the calculated value changes',
         cell(2,0).value === '170', 'got ' + cell(2,0).value);""",
]))

# --- 15. host iframe height covers the whole plug-in ----------------------
# EST-358 (28 Sep 2026): the table's last row and bottom border were cut off
# in web Collect. The host sizes the iframe to body.offsetHeight, and the
# label's top margin collapsed through <body>, so offsetHeight came up short.
# Uses the AHA payer-grid mirror, which is what AHA reported it on.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aha_mirror  # noqa: E402

results.append(run('15. body.offsetHeight (what the host sizes the iframe to) covers the table', aha_mirror.params(), [
    """var tc = document.getElementById('table-container');
       var bottom = Math.ceil(tc.getBoundingClientRect().bottom + window.scrollY);
       __assert('body.offsetHeight reaches the table bottom border',
         document.body.offsetHeight >= bottom,
         'offsetHeight=' + document.body.offsetHeight + ' < container bottom=' + bottom);
       __assert('body does not start below the page top (no collapsed margin)',
         document.body.getBoundingClientRect().top + window.scrollY === 0,
         'body top=' + document.body.getBoundingClientRect().top);""",
]))

# --- 16. N/A cells ------------------------------------------------------------
AHA_NA = aha_mirror.params()   # na_cells='6-9:1': Medicaid c-f have no Gross
results.append(run('16a. N/A cells render closed and show no history', AHA_NA, [
    """var na = document.querySelectorAll('input[data-na="true"]');
       __assert('four N/A cells', na.length === 4, 'got ' + na.length);
       __assert('N/A cells are the Gross column of rows 6-9',
         [5,6,7,8].every(function (r) { return cell(r,0).getAttribute('data-na') === 'true'; }) &&
         [5,6,7,8].every(function (r) { return cell(r,1).getAttribute('data-na') !== 'true'; }), 'wrong cells');
       __assert('N/A inputs are disabled and out of the tab order',
         Array.prototype.every.call(na, function (i) { return i.disabled && i.tabIndex === -1; }), 'focusable');
       __assert('N/A label shown', cell(5,0).placeholder === 'N/A', cell(5,0).placeholder);
       __assert('td marked na-cell', cell(5,0).closest('td').classList.contains('na-cell'), 'no class');
       __assert('no historical chip under N/A cells',
         !cell(5,0).closest('td').querySelector('.bottom-historical'), 'chip present');
       __assert('Net column keeps its history chip',
         !!cell(5,1).closest('td').querySelector('.bottom-historical'), 'chip missing');
       __assert('screen reader hears "not applicable"',
         /not applicable$/.test(cell(5,0).getAttribute('aria-label')), cell(5,0).getAttribute('aria-label'));""",
]))

results.append(run('16b. N/A cells save blank, keep matrix shape, add nothing to sums', AHA_NA, [
    """type(3,0,'100'); type(4,0,'50');   // Medicaid a, b Gross
       type(5,1,'7'); type(6,1,'0');      // Medicaid c, d Net
       cell(5,0).value = '999';           // a stray write must not leak into the answer""",
    """type(3,0,'100');""",
    """var rows = lastAnswer().split('|');
       __assert('17 rows, 2 cells each', rows.length === 17 &&
         rows.every(function (r) { return r.split(',').length === 2; }), lastAnswer());
       __assert('N/A slots serialize blank', rows[5].split(',')[0] === '' && rows[8].split(',')[0] === '', rows.slice(5,9).join('|'));
       __assert('Total Medicaid Gross = 100 + 50', cell(9,0).value === '150', 'got ' + cell(9,0).value);
       __assert('Total Medicaid Net = 7 + 0', cell(9,1).value === '7', 'got ' + cell(9,1).value);""",
]))

req = dict(AHA_NA); req['required'] = '1'
fill_all = ';'.join("if (!cell(%d,%d).disabled && !cell(%d,%d).getAttribute('data-subtotal')) type(%d,%d,'1')"
                    % (r, c, r, c, r, c) for r in range(17) for c in range(2))
results.append(run('16c. required=1 is satisfied without the N/A cells', req, [
    fill_all,
    """__assert('answer set once every open cell is filled',
         typeof lastAnswer() === 'string' && lastAnswer().length > 0, 'answer=' + JSON.stringify(lastAnswer()));""",
    """type(0,0,'');""",
    """__assert('emptying an open cell still blocks', lastAnswer() === '', 'answer=' + JSON.stringify(lastAnswer()));""",
]))

results.append(run('16d. Arrow keys step over N/A cells', AHA_NA, [
    """cell(4,0).focus();
       cell(4,0).dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true, cancelable: true}));""",
    """__assert('ArrowDown from row 5 lands on row 10 (skips 6-9)',
         document.activeElement === cell(9,0), 'focused row ' + (document.activeElement && document.activeElement.getAttribute('data-row')));""",
]))

# Separate run: in headless Chrome a focus change queued by the previous
# navigation can land after the next step starts. Checked by hand in a real
# browser (web-Collect harness) as well.
results.append(run('16d2. Arrow into an N/A cell with nothing beyond it stays put', AHA_NA, [
    """cell(7,1).focus();
       cell(7,1).dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true, cancelable: true}));
       __assert('focus stays on the Net cell', document.activeElement === cell(7,1),
         'focus moved to ' + (document.activeElement && document.activeElement.getAttribute('data-row')));""",
]))

results.append(run('16e. A stale value saved in a now-N/A cell is not loaded', AHA_NA, [
    """__assert('N/A cell stays blank', cell(5,0).value === '', 'got ' + cell(5,0).value);
       __assert('neighbouring value still loads', cell(5,1).value === '7', 'got ' + cell(5,1).value);
       __assert('stale value excluded from the subtotal', cell(9,0).value === '150', 'got ' + cell(9,0).value);""",
], current=',|,|,|100,|50,|555,7|,|,|,|150,7|,|,|,|,|,|,|,'))

derived = dict(AHA_NA); derived['na_cells'] = '13-14:2'
results.append(run('16f. A subtotal whose sources are all N/A becomes N/A itself', derived, [
    """__assert('Total Commercial Net is N/A', cell(14,1).getAttribute('data-na') === 'true', 'not N/A');
       __assert('Total Commercial Gross stays open', cell(14,0).getAttribute('data-na') !== 'true', 'wrongly N/A');
       __assert('grid TOTAL Net stays open (other sources remain)', cell(16,1).getAttribute('data-na') !== 'true', 'wrongly N/A');""",
]))

whole = dict(AHA_NA); whole['na_cells'] = '11'
results.append(run('16g. A bare row number closes every column', whole, [
    """__assert('both columns of row 11 are N/A',
         cell(10,0).getAttribute('data-na') === 'true' && cell(10,1).getAttribute('data-na') === 'true', 'not both');""",
]))

for spec, why, needle in [('3:1', 'subtotal row', 'holds a subtotal'),
                          ('6-9:3', 'column out of range', '6-9:3'),
                          ('6oops:1', 'garbage row', '6oops:1')]:
    b = dict(AHA_NA); b['na_cells'] = spec
    results.append(run('16h. na_cells rejects "%s" (%s)' % (spec, why), b, [
        """__assert('config error rendered', !!document.querySelector('.config-error'), 'NO ERROR - spec was accepted');
           var t = document.querySelector('.config-error').textContent;
           __assert('error explains the problem', t.indexOf(%s) >= 0, t);""" % json.dumps(needle),
    ]))

# --- 17. rich-text labels (Amber's 2.2.0 build) ----------------------------
rich = {'rows': '2', 'cols': '1', 'col_labels': 'Value',
        'row_labels': '<b>Bold</b> <span style="color:red; background-image:url(x)">red</span>'
                      '|<img src=x onerror="window.__pwned=1">x<script>window.__pwned=2</script>'}
results.append(run('17. Rich labels keep formatting and drop anything executable', rich, [
    """var l = document.querySelectorAll('th.row-label');
       __assert('<b> survives', !!l[0].querySelector('b'), l[0].innerHTML);
       var s = l[0].querySelector('span');
       __assert('safe colour kept', s && s.style.color === 'red', s ? s.getAttribute('style') : 'no span');
       __assert('url() style dropped', s && !s.style.backgroundImage, s ? s.getAttribute('style') : '');
       __assert('no <img>/<script> rendered', !l[1].querySelector('img,script'), l[1].innerHTML);
       __assert('nothing executed', !window.__pwned, 'pwned=' + window.__pwned);
       __assert('aria-label is plain text', cell(0,0).getAttribute('aria-label') === 'Current value for Bold red Value',
         cell(0,0).getAttribute('aria-label'));""",
]))

# --- 18. subtracting rows (AHA Fixed Assets, Oct 2026) ------------------------
# A leading '-' in subtotals/grid_total marks a row that subtracts. The
# respondent types positive amounts; only the sum applies the sign.
FA = {'rows': '3', 'cols': '1', 'col_labels': 'Amount',
      'row_labels': 'Gross fixed assets,Less: accumulated depreciation,Net fixed assets',
      'grid_total': '3:1,-2', 'min_value': '0', 'validation_strict': 'true'}

NEG_FLAG = """function negFlag(r, c) {
  var f = document.querySelector('.subtotal-negative[data-neg-row="' + r + '"][data-neg-col="' + c + '"]');
  return f && f.style.display !== 'none' ? f : null;
}
function hardMsg(r, c) {
  var m = cell(r, c).parentNode.querySelector('.validation-message');
  return m ? m.textContent : '';
}"""

results.append(run('18a. Net = Gross - Less; amounts saved as typed', FA, [
    NEG_FLAG + """; type(0,0,'1000'); type(1,0,'400');""",
    """__assert('Net = 1000 - 400 = 600', cell(2,0).value === '600', 'got ' + cell(2,0).value);
       __assert('saved answer keeps the deduction positive', lastAnswer() === '1000|400|600',
         'answer=' + JSON.stringify(lastAnswer()));
       __assert('no below-zero flag on a positive Net', !negFlag(2,0), 'flag shown');""",
]))

results.append(run('18b. A negative Net is allowed and flagged, never blocked', FA, [
    NEG_FLAG + """; type(0,0,'100'); type(1,0,'400');""",
    """__assert('Net = 100 - 400 = -300', cell(2,0).value === '-300', 'got ' + cell(2,0).value);
       __assert('below-zero flag shown', !!negFlag(2,0), 'no flag');
       __assert('flag uses the default wording', negFlag(2,0) && negFlag(2,0).textContent.indexOf('Below zero') >= 0,
         negFlag(2,0) ? negFlag(2,0).textContent : '');
       __assert('min_value=0 does not hard-fail the Net', hardMsg(2,0).indexOf('at least') < 0, hardMsg(2,0));
       __assert('answer still set (not blocked)', lastAnswer() === '100|400|-300', 'answer=' + JSON.stringify(lastAnswer()));""",
    """type(0,0,'500');""",
    """__assert('flag clears once Net is back above zero', !negFlag(2,0) && cell(2,0).value === '100', 'value ' + cell(2,0).value);""",
]))

results.append(run('18c. A negative typed into the deduction row is not flipped; min_value still blocks it', FA, [
    NEG_FLAG + """; type(0,0,'1000'); type(1,0,'-400');""",
    """__assert('typed value kept as typed', cell(1,0).value === '-400', 'got ' + cell(1,0).value);
       __assert('min_value hard message on the line item', hardMsg(1,0).indexOf('at least') >= 0, hardMsg(1,0));
       __assert('strict mode blocks the answer', lastAnswer() === '', 'answer=' + JSON.stringify(lastAnswer()));""",
]))

results.append(run('18d. A typed-over negative Net is flagged the same way, not blocked', FA, [
    NEG_FLAG + """; type(0,0,'1000'); type(1,0,'400');""",
    """type(2,0,'-50');""",
    """__assert('override kept', cell(2,0).value === '-50' && cell(2,0).getAttribute('data-manual') === 'true', cell(2,0).value);
       __assert('below-zero flag shown on the override', !!negFlag(2,0), 'no flag');
       __assert('no hard min message on the override', hardMsg(2,0).indexOf('at least') < 0, hardMsg(2,0));
       __assert('answer still set', lastAnswer() === '1000|400|-50', 'answer=' + JSON.stringify(lastAnswer()));
       var cap = document.querySelector('.subtotal-calc[data-calc-row="2"][data-calc-col="0"]');
       __assert('reference shows the signed calculation', cap && cap.textContent.indexOf('Calculated: 600') >= 0,
         cap ? cap.textContent : 'no caption');""",
]))

results.append(run('18e. Reload: a Net matching Gross - Less is recognised as calculated', FA, [
    NEG_FLAG + """;
       __assert('Net not treated as an override', cell(2,0).getAttribute('data-manual') !== 'true', 'marked manual');
       __assert('no variance styling', !document.querySelector('td.subtotal-variance'), 'variance shown');""",
], current='1000|400|600'))

results.append(run('18f. Reload: a saved negative Net is flagged again', FA, [
    NEG_FLAG + """;
       __assert('flag restored on load', !!negFlag(2,0), 'no flag');""",
], current='100|400|-300'))

added = {'rows': '3', 'cols': '1', 'row_labels': 'Income,Adjustment,Total',
         'grid_total': '3:1,2'}
results.append(run('18g. Plain addition with a negative component is not flagged', added, [
    NEG_FLAG + """; type(0,0,'100'); type(1,0,'-400');""",
    """__assert('Total = 100 + -400', cell(2,0).value === '-300', 'got ' + cell(2,0).value);
       __assert('no below-zero flag without a subtracting row', !negFlag(2,0), 'flag shown');""",
]))

nested = {'rows': '5', 'cols': '1', 'row_labels': 'Gross,Less: depreciation,Net,Land,Total',
          'subtotals': '3:1,-2', 'grid_total': '5:3,4', 'min_value': '0', 'validation_strict': 'true'}
results.append(run('18h. A total built on a subtracting subtotal is exempt and flagged too', nested, [
    NEG_FLAG + """; type(0,0,'100'); type(1,0,'400'); type(3,0,'50');""",
    """__assert('Net = -300', cell(2,0).value === '-300', 'got ' + cell(2,0).value);
       __assert('Total = -300 + 50 = -250', cell(4,0).value === '-250', 'got ' + cell(4,0).value);
       __assert('Total flagged', !!negFlag(4,0), 'no flag');
       __assert('Total not hard-failed', hardMsg(4,0).indexOf('at least') < 0, hardMsg(4,0));
       __assert('answer set', lastAnswer() === '100|400|-300|50|-250', 'answer=' + JSON.stringify(lastAnswer()));""",
]))

ranged = {'rows': '4', 'cols': '1', 'subtotals': '4:1,-2-3'}
results.append(run('18i. A minus before a range subtracts every row in it', ranged, [
    """type(0,0,'10'); type(1,0,'2'); type(2,0,'3');""",
    """__assert('10 - 2 - 3 = 5', cell(3,0).value === '5', 'got ' + cell(3,0).value);""",
]))

custom = dict(FA); custom['negative_total_message'] = 'Net is negative - please check'
results.append(run('18j. negative_total_message overrides the wording', custom, [
    NEG_FLAG + """; type(0,0,'1'); type(1,0,'2');""",
    """__assert('custom wording shown', negFlag(2,0) && negFlag(2,0).textContent === 'Net is negative - please check',
         negFlag(2,0) ? negFlag(2,0).textContent : 'no flag');""",
]))

for key, spec, needle in [('grid_total', '3:1,--2', '3:1,--2'),
                          ('grid_total', '3:1,-', '3:1,-'),
                          ('grid_total', '3:1,-1', 'more than once'),
                          ('grid_total', '3:-3,1', 'itself')]:
    b = dict(FA); b[key] = spec
    results.append(run('18k. %s rejects "%s"' % (key, spec), b, [
        """__assert('config error rendered', !!document.querySelector('.config-error'), 'NO ERROR - spec was accepted');
           var t = document.querySelector('.config-error').textContent;
           __assert('error explains the problem', t.indexOf(%s) >= 0, t);""" % json.dumps(needle),
    ]))

colsum = {'rows': '4', 'cols': '1', 'subtotals': '3:1,-2', 'total': 'column'}
results.append(run("18m. total='column' + a subtracting row fails loudly", colsum, [
    """__assert('config error rendered', !!document.querySelector('.config-error'), 'NO ERROR - spec was accepted');
       var t = document.querySelector('.config-error').textContent;
       __assert('error names the clash and the fix', t.indexOf("total='column'") >= 0 && t.indexOf('grid_total') >= 0, t);""",
]))

colplain = {'rows': '4', 'cols': '1', 'subtotals': '3:1-2', 'total': 'column'}
results.append(run("18n. total='column' + adding-only subtotals still renders", colplain, [
    """__assert('no config error', !document.querySelector('.config-error'), document.querySelector('.config-error') ? document.querySelector('.config-error').textContent : '');""",
]))

na_neg = dict(FA); na_neg['na_cells'] = '-2:1'
results.append(run('18l. na_cells does not accept a minus sign', na_neg, [
    """__assert('config error rendered', !!document.querySelector('.config-error'), 'NO ERROR - spec was accepted');""",
]))

fails = sum(len(re.findall(r'^FAIL', r, re.M)) for r in results)
passes = sum(len(re.findall(r'^PASS', r, re.M)) for r in results)
print('=' * 72)
print('TOTAL: %d passed, %d failed' % (passes, fails))
sys.exit(1 if fails else 0)
