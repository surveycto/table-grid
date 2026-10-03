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
window.setAnswer = function (v) { window.__answers.push(v); };
window.__params = %(params)s;
window.getPluginParameter = function (k) {
  return Object.prototype.hasOwnProperty.call(window.__params, k) ? window.__params[k] : null;
};
window.fieldProperties = {
  CURRENT_ANSWER: '', LANGUAGE: 'default', READONLY: false, PARAMETERS: [],
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
var card = document.createElement('div'); card.className = 'card';
card.innerHTML = '<iframe id="plugin" scrolling="no" src="child-' + v + '.html"></iframe>';
main.appendChild(card);
var nav = document.createElement('nav');
nav.innerHTML = '<button>Back</button><button>Next</button>';
main.appendChild(nav);
iFrameResize({ checkOrigin: false, log: false }, '#plugin');

// Probe: how much of the plug-in's content is hidden by the iframe edge.
window.__probe = function () {
  var f = document.getElementById('plugin');
  var d = f.contentDocument;
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
