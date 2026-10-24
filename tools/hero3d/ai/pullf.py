#!/usr/bin/env python3
"""pullf.py OUT [gz] FILE... -> join base64 chunks from the given tool-result files (in that order)."""
import sys, json, re, base64, gzip
out = sys.argv[1]; args = sys.argv[2:]; gz = False
if args and args[0] == 'gz': gz = True; args = args[1:]
D = '/root/.claude/projects/-home-claude/3e5fb49a-8e0a-5558-8b49-0394b00826f4/tool-results/'
parts = []
for f in args:
    if '/' not in f: f = D + f
    t = json.load(open(f))[0]['text']
    m = re.match(r'^"(.*?)"\s*\n*\(captured', t, re.S) or re.match(r'^"(.*)"\s*$', t, re.S)
    parts.append((m.group(1) if m else t).strip().strip('"'))
raw = base64.b64decode(''.join(parts).replace(' ', ''))
if gz: raw = gzip.decompress(raw)
open(out, 'wb').write(raw); print(out, len(raw), 'bytes from', len(args), 'files')
