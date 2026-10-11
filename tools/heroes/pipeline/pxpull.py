#!/usr/bin/env python3
"""Assemble base64 chunks pulled through the browser pane into a file.
Usage: pxpull.py OUT N   -> the N newest javascript_tool result files (chunks are 240000 chars, space padded)."""
import sys, os, glob, json, re, base64
out, n = sys.argv[1], int(sys.argv[2])
import os; d = os.environ.get('TOOL_RESULTS', os.path.expanduser('~/.claude/projects/-home-claude-god-of-legacy/<your-session-id>/tool-results'))
files = sorted(glob.glob(d + '/mcp-remote-devices-Claude_Browser__javascript_tool-*.txt') + glob.glob(d + '/toolu_*.json'), key=os.path.getmtime)[-n:]
parts = []
for f in files:
    t = json.load(open(f))[0]['text']
    m = re.match(r'^"(.*?)"\s*\n*\(captured', t, re.S) or re.match(r'^"(.*)"\s*$', t, re.S)
    parts.append((m.group(1) if m else t).strip().strip('"'))
b = ''.join(parts).replace(' ', '')
open(out, 'wb').write(base64.b64decode(b)); print(out, len(b), 'chars', len(files), 'files')
