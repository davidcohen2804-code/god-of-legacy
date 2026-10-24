#!/usr/bin/env python3
"""pull.py OUT FIRST_TS LAST_TS [gz] -> join javascript_tool result files whose timestamp is in [FIRST_TS, LAST_TS], in timestamp order."""
import sys, glob, json, re, base64, gzip, os
out, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); gz = len(sys.argv) > 4
d = '/root/.claude/projects/-home-claude/3e5fb49a-8e0a-5558-8b49-0394b00826f4/tool-results'
fs = []
for f in glob.glob(d + '/mcp-remote-devices-Claude_Browser__javascript_tool-*.txt'):
    ts = int(re.search(r'-(\d+)\.txt$', f).group(1))
    if a <= ts <= b: fs.append((ts, f))
fs.sort(); parts = []
for ts, f in fs:
    t = json.load(open(f))[0]['text']
    m = re.match(r'^"(.*?)"\s*\n*\(captured', t, re.S) or re.match(r'^"(.*)"\s*$', t, re.S)
    parts.append((m.group(1) if m else t).strip().strip('"'))
raw = base64.b64decode(''.join(parts).replace(' ', ''))
if gz: raw = gzip.decompress(raw)
open(out, 'wb').write(raw); print(out, len(raw), 'bytes from', len(fs), 'files')
