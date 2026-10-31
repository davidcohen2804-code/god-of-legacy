#!/usr/bin/env python3
"""Assemble an image pulled from the browser pane in tagged base64 chunks ('IDX:<tag>:nn|<base64>', ≤ 240000 chars each).
Usage: pull_idx.py OUT TAG N   (TOOL_RESULTS = the session's tool-results folder; chunks in any order)."""
import sys, os, glob, json, re, base64
out, tag, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
d = os.environ.get('TOOL_RESULTS', '')
files = sorted(glob.glob(d + '/mcp-remote-devices-Claude_Browser__javascript_tool-*.txt') + glob.glob(d + '/toolu_*.json'), key=os.path.getmtime)[-(n + 40):]
parts = {}
pat = re.compile(r'IDX:' + re.escape(tag) + r':(\d+)\|([A-Za-z0-9+/=\s]+)')
for f in files:
    try: t = json.load(open(f))[0]['text']
    except Exception: continue
    m = pat.search(t)
    if m: parts[int(m.group(1))] = m.group(2)
assert sorted(parts) == list(range(n)), f'chunks found for {tag}: {sorted(parts)}'
b = ''.join(parts[i] for i in range(n)).replace(' ', '').replace('\n', '')
open(out, 'wb').write(base64.b64decode(b)); print(out, len(b), 'chars', n, 'chunks')
