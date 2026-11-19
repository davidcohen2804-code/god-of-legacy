class_name DemoDriver
extends Node
## The review recording (M4 Stage B: Phantom Control): run with `-- --demo`, the game goes straight to the arena and
## this node plays a fixed script of touches through the engine's own input — the same path a finger takes — so the
## on-screen controls show the thumb on the stick and the taps on CHAIN, PULL, RISE and PURSUE: the Samurai takes his
## place 6.6 m from the Training Automaton and runs the branch at real speed — Phantom Chain captures it, Chain Pull
## drags it in, Rising Slash launches it, Aerial Pursuit leaps after it and strikes it in the air — then a chain thrown
## at nothing (missed: no PULL) and a Rising Slash at nothing (no launch: no PURSUE), and the whole branch once more at
## half speed. The conditional buttons are tapped a moment after they appear, as a player would (PURSUE while Rising
## Slash still recovers: it waits for its cancel point). Captions in the HUD's prompt line name each part; the game's
## own notices (a missed chain) show there too. Recorded with Godot's Movie Maker (--write-movie, fixed frame rate), so
## the clip is smooth however slowly the machine renders; the script runs in game time. It quits when the script ends.

## [time (s), action, args...]. "go": the thumb steers the stick toward a point of the courtyard (x, z) at a push
## (0..1; 1 = the rim, which sprints after 0.25 s) until he is there; "point": a light push toward a direction of the
## courtyard (x, z) for a moment, so he turns to face it; "stick": a fixed push (x right, y up); "tap": a button;
## "tap_shown": a button tapped `delay` s after it appears (within 2 s); "drag": a second finger turns the camera;
## "caption": a line in the HUD for some seconds; "slowmo": the game's speed. The Samurai starts 7 m south of the dummy
## looking north; the automaton stands north-west of the dummy, at (-3.5, -2.5).
const SCRIPT := [
	[0.4, "caption", "Phantom Control: chain → pull → rising slash → aerial pursuit", 3.4],
	[0.5, "go", Vector2(-10.4, 0.6), 0.85], # run west, past the dummy
	[3.2, "go", Vector2(-9.4, -0.9), 0.3], # walk to his place
	[4.2, "point", Vector2(1.0, -0.3), 0.25], # face the automaton, 6.6 m away
	[4.8, "caption", "PHANTOM CHAIN — thrown, it captures the automaton", 1.6],
	[4.9, "tap", "skill1"],
	[5.3, "tap_shown", "cond1", 0.25], # PULL, a moment after it appears
	[5.6, "caption", "CHAIN PULL — dragged in to him", 1.2],
	[6.45, "caption", "RISING SLASH — launched", 1.2],
	[6.5, "tap", "skill3"],
	[6.6, "tap_shown", "cond1", 0.1], # PURSUE, pressed while Rising Slash still recovers: it waits for 50 %
	[6.85, "caption", "AERIAL PURSUIT — he leaps after it and strikes it in the air", 2.2],
	[8.6, "caption", "A missed chain: nothing is captured — no PULL", 2.6],
	[8.7, "go", Vector2(-8.6, 3.6), 0.85],
	[10.0, "point", Vector2(0.0, 1.0), 0.25], # face the open courtyard
	[10.95, "tap", "skill1"], # (off cooldown at 10.9)
	[11.8, "caption", "A Rising Slash that misses: nothing is launched — no PURSUE", 2.4],
	[12.0, "tap", "skill3"],
	[13.6, "go", Vector2(-9.6, -0.8), 0.85], # back to his place (the automaton has walked back to its mark)
	[15.4, "point", Vector2(1.0, -0.3), 0.25],
	[16.2, "caption", "The same branch at half speed", 2.0],
	[16.3, "slowmo", 0.5],
	[17.0, "tap", "skill1"],
	[17.4, "tap_shown", "cond1", 0.25],
	[18.6, "tap", "skill3"],
	[18.7, "tap_shown", "cond1", 0.1],
	[20.0, "slowmo", 1.0],
	[21.6, "end"],
]

var touch: TouchControls
var player: Fighter
var rig: CameraRig
var caption: Callable
var _t := 0.0
var _i := 0
var _stick_down := false
var _drag := {} ## the camera finger: from, to, start, length
var _goal := Vector3.INF
var _push := 0.0
var _point_left := 0.0 ## the light push toward a direction: time left
var _point_dir := Vector3.ZERO
var _wait := {} ## a button to tap once it shows: key, delay, since (when it appeared), limit


func _physics_process(delta: float) -> void:
	_t += delta
	while _i < SCRIPT.size() and _t >= float(SCRIPT[_i][0]):
		_run(SCRIPT[_i])
		_i += 1
	if _goal != Vector3.INF:
		var to := _goal - player.global_position
		to.y = 0.0
		if to.length() < 0.8:
			_goal = Vector3.INF
			_stick(Vector2.ZERO, false)
		else:
			# the stick push that moves him toward the goal from this camera (controller: dir = basis * (x, 0, -y))
			var local := rig.ground_basis().inverse() * to.normalized()
			_stick(Vector2(local.x, -local.z).normalized() * _push, true)
	if _point_left > 0.0:
		_point_left -= delta
		if _point_left <= 0.0:
			_stick(Vector2.ZERO, false)
		else:
			var local := rig.ground_basis().inverse() * _point_dir
			_stick(Vector2(local.x, -local.z).normalized() * 0.25, true)
	if not _wait.is_empty():
		_wait["limit"] = float(_wait["limit"]) - delta
		if touch.is_shown(String(_wait["key"])):
			_wait["since"] = float(_wait["since"]) + delta
			if float(_wait["since"]) >= float(_wait["delay"]):
				_tap(String(_wait["key"]))
				_wait.clear()
		if not _wait.is_empty() and float(_wait["limit"]) <= 0.0:
			_wait.clear()
	if not _drag.is_empty():
		var k := clampf((_t - float(_drag["start"])) / float(_drag["length"]), 0.0, 1.0)
		var p: Vector2 = (_drag["from"] as Vector2).lerp(_drag["to"], k)
		var d := InputEventScreenDrag.new()
		d.index = 1
		d.position = p
		d.relative = p - (_drag["last"] as Vector2)
		_drag["last"] = p
		Input.parse_input_event(d)
		if k >= 1.0:
			_touch(1, p, false)
			_drag.clear()


func _run(step: Array) -> void:
	match String(step[1]):
		"go":
			var g: Vector2 = step[2]
			_goal = Vector3(g.x, 0.0, g.y)
			_push = float(step[3])
		"stick":
			_goal = Vector3.INF
			_stick(step[2], true)
		"stick_up":
			_goal = Vector3.INF
			_stick(Vector2.ZERO, false)
		"tap":
			_tap(String(step[2]))
		"tap_shown":
			_wait = {"key": String(step[2]), "delay": float(step[3]), "since": 0.0, "limit": 2.0}
		"point":
			var d: Vector2 = step[2]
			_goal = Vector3.INF
			_point_dir = Vector3(d.x, 0.0, d.y).normalized()
			_point_left = float(step[3])
		"drag":
			var from := Vector2(touch.size.x * 0.42, touch.size.y * 0.32)
			_touch(1, from, true)
			_drag = {"from": from, "to": from + (step[2] as Vector2), "start": _t, "length": float(step[3]), "last": from}
		"caption":
			if caption.is_valid():
				caption.call(String(step[2]), float(step[3]))
		"slowmo":
			Engine.time_scale = float(step[2])
		"end":
			Engine.time_scale = 1.0
			get_tree().quit()


## A short tap on a button (a second finger: the stick's thumb may stay down).
func _tap(key: String) -> void:
	var b: Dictionary = touch._btn[key]
	_touch(2, b["c"], true)
	get_tree().create_timer(0.12).timeout.connect(_touch.bind(2, b["c"], false))


## The thumb on the stick: pushed by v (x right, y up, 0..1), or lifted.
func _stick(v: Vector2, down: bool) -> void:
	var stick: Dictionary = touch._btn["stick"]
	var c: Vector2 = stick["c"]
	var r: float = stick["r_hit"]
	if not down:
		if _stick_down:
			_touch(0, c, false)
			_stick_down = false
		return
	if not _stick_down:
		_touch(0, c, true)
		_stick_down = true
	var p := c + Vector2(v.x, -v.y) * r
	var d := InputEventScreenDrag.new()
	d.index = 0
	d.position = p
	d.relative = p - c
	Input.parse_input_event(d)


func _touch(index: int, p: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = index
	e.position = p
	e.pressed = pressed
	Input.parse_input_event(e)
