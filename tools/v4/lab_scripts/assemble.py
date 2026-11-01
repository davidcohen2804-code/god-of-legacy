# Assemble base64 chunks saved from the browser pane's javascript tool. Chunks carry a '#NN#' prefix (chunk NN starts at
# NN * 240000; chunk 0 may have no prefix) or a '#S<offset>#' prefix (a chunk read at that offset: the last one, read
# overlapping the one before so it is long enough to be saved to a file).
# Usage: assemble.py <out> <expected length> <files...>
import json, re, sys, base64
out, expect, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
CHUNK = 240000
buf = [None] * expect
for f in files:
    t = json.load(open(f))[0]['text']
    m = re.match(r'^"(.*?)"\s*\n*\(captured', t, re.S) or re.match(r'^"(.*)"\s*$', t, re.S)
    s = m.group(1) if m else t
    k = re.match(r'^#S(\d+)#', s) or re.match(r'^#(\d+)#', s)
    if k and s.startswith('#S'): at = int(k.group(1))
    elif k: at = int(k.group(1)) * CHUNK
    else: at = 0
    body = (s[k.end():] if k else s).replace(' ', '')
    for i, ch in enumerate(body): buf[at + i] = ch
missing = sum(1 for c in buf if c is None)
print('chars', expect - missing, 'expected', expect, 'missing', missing)
assert missing == 0
open(out, 'wb').write(base64.b64decode(''.join(buf)))
