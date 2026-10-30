#!/usr/bin/env python3
"""Build a local stand-in for SurveyCTO web Collect around the plug-in.

The acceptance suite renders the plug-in as a plain page, which cannot show
bugs in how the host sizes the plug-in's iframe. This harness reproduces that
host: a parent page with form "cards", the plug-in inside an iframe, and
iframe-resizer (parent + child libraries) sizing the iframe to its content,
as web Collect does.

    python3 extras/tests/webcollect-harness.py OUT_DIR
    python3 -m http.server -d OUT_DIR 8765
    open http://localhost:8765/parent.html?v=aha

Variants (?v=):
    aha        AHA payer grid mirror with na_cells (current build)
    aha-na     AHA mirror as AHA runs it today: "Field Not Required" text in
               the history, no na_cells
    fixed-assets  3x1 Gross - Less = Net grid (grid_total='3:1,-2', v2.3.0)
Add &top=N to push the plug-in further down the page (default 1 card above).

Two grids on one page (EST-358 focus glitch, Oct 2026):
    open http://localhost:8765/parent.html?two=1
renders the AHA Budgets page (Q13 4x1 with a total, Q14 3x2) and a
"Redraw page" button that reloads both plug-ins with their saved answers,
as web forms does when something on the page depends on a value just typed.
The probe shows which plug-in cell holds the cursor.
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aha_mirror  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get('TABLE_GRID_SRC') or os.path.join(os.path.dirname(os.path.dirname(HERE)), 'source')

IFR = 'https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.9/'

VARIANTS = {
    'aha': ('Revenue by Payer both', aha_mirror.params(na_cells=True)),
    'aha-na': ('Revenue by Payer both', aha_mirror.params(na_cells=False, na_text='Field Not Required')),
    'budget-13': ('13. Please indicate the percentage of your recently completed construction '
                  'projects that corresponds to the following descriptions. Percentages must total 100%.', {
        'rows': '4', 'cols': '1', 'col_labels': 'Percentage (%)',
        'row_labels': 'On or under budget/on or ahead of schedule,On or under budget/behind schedule,'
                      'Over budget/on or ahead of schedule,Over budget/behind schedule',
        'total': 'column', 'total_label': 'Total (%)'}),
    'budget-14': ('14. Approximately what percentage of your overall capital budget is allocated '
                  'to construction projects?', {
        'rows': '3', 'cols': '2', 'col_labels': '2026 actual %,2027 projected %',
        'row_labels': 'New construction,Facility renovation,Facility infrastructure'}),
    'fixed-assets': ('Fixed assets', {
        'rows': '3', 'cols': '1', 'col_labels': 'Amount',
        'row_labels': 'Gross fixed assets,Less: accumulated depreciation,<b>Net fixed assets</b>',
        'grid_total': '3:1,-2', 'min_value': '0', 'validation_strict': 'true',
        'format_numbers': 'true'}),
}

CHILD = """<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="style.css">
</head>
<body class="web-collect">
<script>
window.__answers = [];
window.setAnswer = function (v) {
  window.__answers.push(v);
  try { window.parent.__saved[window.frameElement.id] = v; } catch (e) {}
};
window.__params = %(params)s;
window.getPluginParameter = function (k) {
  return Object.prototype.hasOwnProperty.call(window.__params, k) ? window.__params[k] : null;
};
window.fieldProperties = {
  CURRENT_ANSWER: (function () {
    try { return window.parent.__saved[window.frameElement.id] || ''; } catch (e) { return ''; }
  })(),
  LANGUAGE: 'default', READONLY: false, PARAMETERS: [],
  LABEL: %(label_js)s, HINT: ''
};
window.goToNextField = function () {};
</script>
%(template)s
<script src="script.js"></script>
<script src="%(ifr)siframeResizer.contentWindow.min.js"></script>
</body></html>
"""

PARENT = """<!doctype html>
<html><head><meta charset="utf-8"><title>web Collect harness</title>
<style>
  body { margin: 0; background: #eceff1; font-family: -apple-system, 'Segoe UI', sans-serif; }
  header { background: #1d3557; color: #fff; padding: 14px 24px; position: sticky; top: 0; z-index: 5; }
  main { max-width: 1000px; margin: 0 auto; padding: 16px; }
  .card { background: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.2);
          padding: 24px 16px; margin-bottom: 16px; }
  .card p { margin: 0 0 8px; }
  iframe { width: 100%%; border: 0; display: block; }
  nav { display: flex; justify-content: space-between; padding: 8px 0 40px; }
  nav button { padding: 10px 24px; }
  #probe { position: fixed; right: 8px; bottom: 8px; background: #000c; color: #0f0;
           font: 12px monospace; padding: 6px 8px; white-space: pre; z-index: 9; }
</style>
<script src="%(ifr)siframeResizer.min.js"></script>
</head><body>
<header>AHA Annual Survey (harness)</header>
<main id="main"></main>
<pre id="probe"></pre>
<script>
var q = new URLSearchParams(location.search);
var v = q.get('v') || 'aha';
var top = parseInt(q.get('top') || '1', 10);
var main = document.getElementById('main');
for (var i = 0; i < top; i++) {
  var c = document.createElement('div'); c.className = 'card';
  c.innerHTML = '<p><b>Question ' + (i + 1) + '</b></p><p>Some earlier field on the page.</p><input style="width:60%%">';
  main.appendChild(c);
}
window.__saved = {};  // answers the plug-ins report, fed back on a redraw
var children = q.get('two') ? ['budget-13', 'budget-14'] : [v];
children.forEach(function (name, i) {
  var card = document.createElement('div'); card.className = 'card';
  var id = children.length > 1 ? 'plugin' + (i + 1) : 'plugin';
  card.innerHTML = '<iframe id="' + id + '" scrolling="no" src="child-' + name + '.html"></iframe>';
  main.appendChild(card);
});
var nav = document.createElement('nav');
nav.innerHTML = '<button>Back</button>' +
  (children.length > 1 ? '<button id="redraw">Redraw page</button>' : '') + '<button>Next</button>';
main.appendChild(nav);
iFrameResize({ checkOrigin: false, log: false }, 'iframe');
// Web forms redraws the whole page when something on it depends on a value
// just typed: every plug-in iframe reloads with its saved answer.
window.__redraw = function () {
  Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
    f.contentWindow.location.reload();
  });
};
if (children.length > 1) document.getElementById('redraw').onclick = window.__redraw;
// Which plug-in cell (if any) holds the cursor.
window.__focus = function () {
  var out = [];
  Array.prototype.forEach.call(document.querySelectorAll('iframe'), function (f) {
    var d = f.contentDocument;
    var a = d && d.activeElement;
    if (a && a.tagName === 'INPUT') out.push(f.id + ' r' + a.dataset.row + 'c' + a.dataset.col);
  });
  return out.length ? out.join(', ') : 'none';
};

// Probe: how much of the plug-in's content is hidden by the iframe edge.
window.__probe = function () {
  var f = document.querySelector('iframe');
  var d = f && f.contentDocument;
  if (!d) return null;
  var tc = d.getElementById('table-container');
  var r = tc ? tc.getBoundingClientRect() : null;
  var out = {
    iframeHeight: f.clientHeight,
    bodyOffset: d.body.offsetHeight,
    docScroll: d.documentElement.scrollHeight,
    containerBottom: r ? Math.round(r.bottom + d.defaultView.scrollY) : null,
    containerMaxHeight: tc ? tc.style.maxHeight : null
  };
  out.clippedPx = out.containerBottom === null ? null : Math.max(0, out.containerBottom - out.iframeHeight);
  out.focus = window.__focus();
  return out;
};
setInterval(function () {
  var p = window.__probe();
  if (p) document.getElementById('probe').textContent = JSON.stringify(p, null, 1);
}, 500);
</script>
</body></html>
"""


def render_template(label):
    tpl = open(os.path.join(SRC, 'template.html'), encoding='utf-8').read()
    tpl = tpl.replace('{{{LABEL}}}', label).replace('{{{HINT}}}', '')
    tpl = re.sub(r'\{\{#\w+\}\}.*?\{\{/\w+\}\}', '', tpl, flags=re.S)
    return tpl.replace('{{CURRENT_ANSWER}}', '')


def build(out):
    os.makedirs(out, exist_ok=True)
    for name in ('script.js', 'style.css'):
        with open(os.path.join(SRC, name), encoding='utf-8') as s, \
                open(os.path.join(out, name), 'w', encoding='utf-8') as d:
            d.write(s.read())
    for key, (label, params) in VARIANTS.items():
        with open(os.path.join(out, 'child-%s.html' % key), 'w', encoding='utf-8') as f:
            f.write(CHILD % {
                'params': json.dumps(params),
                'label_js': json.dumps(label),
                'template': render_template(html.escape(label)),
                'ifr': IFR,
            })
    with open(os.path.join(out, 'parent.html'), 'w', encoding='utf-8') as f:
        f.write(PARENT % {'ifr': IFR})
    print('Harness written to %s' % out)


if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '_harness'))
