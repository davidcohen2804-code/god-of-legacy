#!/bin/sh
# Run a command with the lab served at :4199 for its duration only.
cd /home/claude/v4lab
python3 -m http.server 4199 --directory dist-v4lab > /dev/null 2>&1 &
PID=$!
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null http://localhost:4199/index.html && break; sleep 0.3; done
"$@"; RC=$?
kill $PID 2>/dev/null
exit $RC
