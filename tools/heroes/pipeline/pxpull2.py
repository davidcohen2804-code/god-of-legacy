import glob,os,json,re,base64,sys
# pxpull2.py N out1 out2 : the N newest chunk files hold two videos joined by '|'
n=int(sys.argv[1]); import os; d=os.environ.get('TOOL_RESULTS','~/.claude/projects/-home-claude-god-of-legacy/<your-session-id>/tool-results')
fs=sorted(glob.glob(d+'/mcp-remote-devices-Claude_Browser__javascript_tool-*.txt'),key=os.path.getmtime)[-n:]
parts=[]
for f in fs:
    t=json.load(open(f))[0]['text']; m=re.match(r'^"(.*?)"\s*\n*\(captured',t,re.S); parts.append(m.group(1))
b=''.join(parts).replace(' ',''); vids=b.split('|')
for out,v in zip(sys.argv[2:],vids): open(out,'wb').write(base64.b64decode(v)); print(out, len(v))
