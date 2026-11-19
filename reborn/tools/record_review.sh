#!/usr/bin/env bash
# (M4.2) The review's recordings, for GPT: how it plays — free movement, then the three Legacy Chain branches, at real
# speed in the Android phone's shape (2.4 : 1) with the thumbs drawn — and the branches from the side at half speed.
# Each with the game's own sound (Movie Maker records its mix). Run from the repository's root; both workflows use it.
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
# is cut down to 16 : 9 round its middle — the stick and the buttons at the sides fall outside. The phone's shape needs
# the override, for this recording only.)
printf '[display]\n\nwindow/size/window_width_override=1728\nwindow/size/window_height_override=720\n' > reborn/override.cfg
record feel 1728 720 --demo --demo-feel
rm -f reborn/override.cfg
record side 1280 720 --demo --demo-side
encode "$T/feel.avi" "$OUT/m42_feel_phone.mp4"
encode "$T/side.avi" "$OUT/m42_side_half.mp4"
