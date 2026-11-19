#!/usr/bin/env bash
# (M4.2) The review's recordings, for GPT — now A2's close (GPT's v2.4): at the Android phone's shape (2.4 : 1) and the
# iPhone's (2.2 : 1), with the thumbs drawn and the controls at each phone's size, two thumbs at real speed (exploration
# B, the combat framing taken at 9 m and let go past 10.5 m, Phantom Control with the aerial pursuit) and the column pass
# with the camera's new rule. (The earlier scripts — feel, side, explore, columns — stay in the demo driver.) Each with
# the game's own sound (Movie Maker records its mix). Run from the repository's root; both workflows use it.
# usage: record_review.sh <out dir> <ffmpeg>        (Godot at $G, else ~/godot/godot)
set -u
OUT=$1
FF=$2
G=${G:-$HOME/godot/godot}
T=${RUNNER_TEMP:-/tmp}
mkdir -p "$OUT"

record() { # name, width, height, the game's own arguments...
	local name=$1 w=$2 h=$3
	shift 3
	xvfb-run -a -s "-screen 0 ${w}x${h}x24" "$G" --path reborn --rendering-method gl_compatibility \
		--rendering-driver opengl3 --resolution "${w}x${h}" --write-movie "$T/$name.avi" --fixed-fps 30 \
		-- "$@" > "$T/$name.log" 2>&1 || true
	grep -m1 "recording movie in" "$T/$name.log" || true
	tail -n 6 "$T/$name.log"
}

encode() { # the .avi, the .mp4 (and its PNG pack: a page carries it through an image load)
	if [ -s "$1" ]; then
		"$FF" -y -loglevel error -i "$1" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast \
			-c:a aac -b:a 128k -movflags +faststart "$2"
		python3 reborn/tools/pack_png.py "$2" "$2.png"
	else
		echo "no recording: $1"
	fi
}

# (Movie Maker records at the project's base size, 1280 × 720, unless the window's size is overridden: a wider window
# is cut down to 16 : 9 round its middle — the stick and the buttons at the sides fall outside. A phone's shape needs
# the override, for its recording only. `--phone` / `--iphone`: the controls laid out as on that phone.)
phone() { # name, width, the game's own arguments...  (720 tall: the Android phone 1728 wide, the iPhone 1588)
	local name=$1 w=$2
	shift 2
	printf '[display]\n\nwindow/size/window_width_override=%s\nwindow/size/window_height_override=720\n' "$w" \
		> reborn/override.cfg
	record "$name" "$w" 720 "$@"
	rm -f reborn/override.cfg
}

# (M4.2-A2's close, GPT's v2.4) at both phones' shapes: two thumbs at real speed — exploration B, the walk in across
# the 9 m, Phantom Control with Rising Slash and the aerial pursuit, the walk back out past 10.5 m — and the column pass
# with the fading on and the camera's new rule. Their logs: the framing's changes, the camera through the column pass.
phone accept_android 1728 --demo --demo-accept --phone
phone accept_iphone 1588 --demo --demo-accept --iphone
phone columns_android 1728 --demo --demo-columns-on --phone
phone columns_iphone 1588 --demo --demo-columns-on --iphone
for n in accept_android accept_iphone columns_android columns_iphone; do
	grep -E "\[(CAMERA|COLUMNS)\]" "$T/$n.log" | tee "$OUT/m42c_${n}_camera.txt" || true
	encode "$T/$n.avi" "$OUT/m42c_${n}.mp4"
done
