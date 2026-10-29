#!/usr/bin/env python3
"""Join the base64 chunks pulled through the browser pane ('@@NNN@@' + data, the N newest javascript_tool result files) into a file.
usage: pull.py OUT N"""
import sys, glob, json, re, base64, os
out, n = sys.argv[1], int(sys.argv[2])
d = os.environ['TOOL_RESULTS']  # (the session's tool-results folder, where the browser's chunk results are saved)
files = sorted(glob.glob(d + '/mcp-remote-devices-Claude_Browser__javascript_tool-*.txt'), key=os.path.getmtime)[-n:]
parts = {}
for f in files:
    t = json.load(open(f))[0]['text']
    m = re.search(r'@@(\d{3})@@([A-Za-z0-9+/=]*)', t)
    parts[int(m.group(1))] = m.group(2)
assert sorted(parts) == list(range(len(parts))), sorted(parts)
open(out, 'wb').write(base64.b64decode(''.join(parts[i] for i in sorted(parts))))
print(out, len(parts), 'chunks', os.path.getsize(out), 'bytes')
