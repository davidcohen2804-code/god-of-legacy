# Assemble base64 chunks saved from the browser pane's javascript tool. Chunks carry a '#NN#' prefix (chunk 0 may not).
import json, re, sys, base64
out, expect, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
parts = {}
for f in files:
    t = json.load(open(f))[0]['text']
    m = re.match(r'^"(.*?)"\s*\n*\(captured', t, re.S) or re.match(r'^"(.*)"\s*$', t, re.S)
    s = m.group(1) if m else t
    k = re.match(r'^#(\d+)#', s)
    idx = int(k.group(1)) if k else 0
    parts[idx] = (s[k.end():] if k else s).replace(' ', '')
b = ''.join(parts[i] for i in sorted(parts))
assert sorted(parts) == list(range(len(parts))), sorted(parts)
print('chunks', len(parts), 'chars', len(b), 'expected', expect)
assert len(b) == expect
open(out, 'wb').write(base64.b64decode(b))
