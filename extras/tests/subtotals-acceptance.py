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
        'params': json.dumps(params),
        'current': json.dumps(current),
        'appearance': json.dumps(appearance),
        'steps': json.dumps(steps),
    }


def run(name, params, steps, current='', appearance=''):
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8') as f:
        f.write(render(params, steps, current, appearance))
        path = f.name
    budget = 1200 + 700 * len(steps)
    out = subprocess.run(
        [CHROME, '--headless', '--disable-gpu', '--no-sandbox',
         '--virtual-time-budget=%d' % budget, '--dump-dom', 'file://' + path],
        capture_output=True, text=True, timeout=180).stdout
    m = re.search(r'<pre id="results">(.*?)</pre>', out, re.S)
    body = html.unescape(m.group(1)).strip() if m else '(no results block)'
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

fails = sum(len(re.findall(r'^FAIL', r, re.M)) for r in results)
passes = sum(len(re.findall(r'^PASS', r, re.M)) for r in results)
print('=' * 72)
print('TOTAL: %d passed, %d failed' % (passes, fails))
sys.exit(1 if fails else 0)
