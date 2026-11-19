class_name DemoDriver
extends Node
## The review recording (M4 Stage C: defensive counterplay): run with `-- --demo`, the game goes straight to the arena
## and this node plays a fixed script of touches through the engine's own input — the same path a finger takes — so the
## on-screen controls show the thumb on the stick and the taps on STEP, COUNTER and DODGE. The Samurai walks up to the
## Training Automaton (its sparring script off: the script starts each of its attacks, so every example begins the
## same way) and, at real speed: its telegraphed sweep (the raised, kindling sword and the amber arc), Shadow Step
## timed into the cut — the blade passes through his fading shadow — COUNTER appearing and pressed, the counter's dash
## and cut landing; then three failed evasions: too late (struck in the step's startup), a plain roll (no shadow — no
## COUNTER), too early (his shadow has faded before the blade comes); and the success once more at half speed. Presses
## timed against the sweep are made when its attack has run a set time, a frame or two of input latency included, as a
## practised thumb would. Captions in the HUD's prompt line name each part. Recorded with Godot's Movie Maker
## (--write-movie, fixed frame rate), so the clip is smooth however slowly the machine renders; the script runs in game
## time. It quits when the script ends.

## [time (s), action, args...]. "go": the thumb steers the stick toward a point of the courtyard (x, z) at a push
## (0..1; 1 = the rim, which sprints after 0.25 s) until he is there; "approach": he walks at a push toward the
## automaton until he stands `d` m from it; "point": a light push toward a direction of the courtyard (x, z) for a
## moment, so he turns to face it; "stick": a fixed push (x right, y up); "stick_up": the thumb lifts; "tap": a button;
## "tap_shown": a button tapped `delay` s after it appears (within 2 s); "tap_on_attack": a button tapped when the
## automaton's attack has run `at` s; "stick_on_attack": the stick pushed so then; "attack": the automaton attacks (as
## soon as it can, within 2 s); "spar": its
## sparring script on or off; "drag": a second finger turns the camera; "caption": a line in the HUD for some seconds;
## "slowmo": the game's speed. The Samurai starts 7 m south of the dummy looking north; the automaton stands north-west
## of the dummy, at (-3.5, -2.5).
const SCRIPT := [
	[0.2, "spar", false],
	[0.4, "caption", "Shadow Counter: evade the automaton's telegraphed sweep, then answer it", 3.0],
	[0.5, "go", Vector2(-3.5, 1.4), 0.85], # run up to it (the stick lets go 0.8 m short of the point)
	[2.2, "approach", 1.75, 0.35], # walk in to 1.75 m from it, facing it
	[3.7, "caption", "Its telegraph: the sword raised and kindling amber, an amber arc where the cut will pass", 2.0],
	[3.7, "attack"],
	[3.7, "tap_on_attack", "skill2", 0.43], # Shadow Step, timed into the cut (idle stick: backward)
	[4.35, "caption", "SHADOW STEP — the blade passes through his fading shadow: COUNTER", 1.5],
	[4.35, "tap_shown", "cond1", 0.15],
	[4.95, "caption", "SHADOW COUNTER — he dashes back at it; the cut must connect (14)", 1.8],
	[7.1, "caption", "Failed evasion 1 — too late: struck in the step's startup", 2.2],
	[7.1, "attack"],
	[7.1, "tap_on_attack", "skill2", 0.53],
	[10.2, "caption", "Failed evasion 2 — a plain roll: no shadow, no COUNTER", 2.2],
	[10.2, "attack"],
	[10.2, "stick_on_attack", Vector2(1, 0), 0.44], # the thumb pushes right (east, along the cut's sweep)...
	[10.2, "tap_on_attack", "dodge", 0.5], # ...and DODGE rolls that way as the blade comes
	[11.3, "stick_up"],
	[11.5, "approach", 1.75, 0.35],
	[13.3, "caption", "Failed evasion 3 — too early: his shadow fades before the blade arrives", 2.2],
	[13.3, "attack"],
	[13.3, "tap_on_attack", "skill2", 0.25],
	[14.6, "approach", 1.75, 0.35],
	[16.7, "caption", "The evasion and the counter again, at half speed", 2.4],
	[16.8, "slowmo", 0.5],
	[17.0, "attack"],
	[17.0, "tap_on_attack", "skill2", 0.43],
	[17.6, "tap_shown", "cond1", 0.15],
	[19.6, "slowmo", 1.0],
	[21.2, "end"],
]

var touch: TouchControls
var player: Fighter
var rig: CameraRig
var automaton: TrainingAutomaton
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
var _on_attack: Array[Dictionary] = [] ## taps (key) or stick pushes (stick) at a moment of the automaton's attack: at
var _attack_left := 0.0 ## an "attack" still trying (s)
var _approach := {} ## walking in to the automaton: d, push


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
	if _attack_left > 0.0:
		_attack_left -= delta
		if automaton and automaton.attack():
			_attack_left = 0.0
	for i in range(_on_attack.size() - 1, -1, -1):
		if automaton and automaton.attack_time() >= float(_on_attack[i]["at"]):
			var e: Dictionary = _on_attack[i]
			_on_attack.remove_at(i)
			if e.has("stick"):
				_goal = Vector3.INF
				_stick(e["stick"], true)
			else:
				_tap(String(e["key"]))
	if not _approach.is_empty() and automaton:
		var to := automaton.global_position - player.global_position
		to.y = 0.0
		if to.length() <= float(_approach["d"]):
			_approach = {}
			_stick(Vector2.ZERO, false)
		else:
			var local := rig.ground_basis().inverse() * to.normalized()
			_stick(Vector2(local.x, -local.z).normalized() * float(_approach["push"]), true)
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
		"approach":
			_goal = Vector3.INF
			_approach = {"d": float(step[2]), "push": float(step[3])}
		"attack":
			_attack_left = 2.0
		"tap_on_attack":
			_on_attack.append({"key": String(step[2]), "at": float(step[3])})
		"stick_on_attack":
			_on_attack.append({"stick": step[2] as Vector2, "at": float(step[3])})
		"spar":
			if automaton:
				automaton.spar = bool(step[2])
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
