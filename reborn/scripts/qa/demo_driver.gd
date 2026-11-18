class_name DemoDriver
extends Node
## The review recording (M3: the first sword combat): run with `-- --demo`, the game goes straight to the arena and
## this node plays a fixed script of touches through the engine's own input — the same path a finger takes — so the
## on-screen controls show the thumb on the stick and the taps on ATTACK and DODGE while the Samurai approaches the
## training dummy, lands the three-strike chain (then the same chain in slow motion), misses on purpose, rolls away,
## comes back for two more chains — the dummy falls at 0 HP and stands up again — and strikes it once more. Captions
## in the HUD's prompt line name each part. Recorded with Godot's Movie Maker (--write-movie, fixed frame rate), so the
## clip is smooth however slowly the machine renders; the script runs in game time. It quits when the script ends.

## [time (s), action, args...]. "go": the thumb steers the stick toward a point of the courtyard (x, z) at a push
## (0..1; 1 = the rim, which sprints after 0.25 s) until he is there; "stick": a fixed push (x right, y up);
## "tap": a button; "drag": a second finger turns the camera; "caption": a line in the HUD for some seconds;
## "slowmo": the game's speed. The Samurai starts 7 m south of the dummy looking north; the camera stays south.
const SCRIPT := [
	[0.6, "caption", "Three katana strikes — only a confirmed hit opens the next", 3.2],
	[0.8, "go", Vector2(0.0, 1.2), 0.85], # run up to the dummy
	[2.2, "tap", "attack"], # Basic 1
	[2.53, "tap", "attack"], # Basic 2
	[2.9, "tap", "attack"], # Basic 3: the push
	[4.0, "slowmo", 0.35],
	[4.0, "caption", "The same chain at 0.35× speed", 1.8],
	[4.2, "tap", "attack"],
	[4.53, "tap", "attack"],
	[4.9, "tap", "attack"],
	[5.8, "slowmo", 1.0],
	[6.0, "go", Vector2(3.0, 3.0), 0.4], # walk away
	[7.8, "stick", Vector2(1.0, 0.0)], # turn east, away from the dummy
	[8.1, "stick_up"],
	[8.2, "caption", "A deliberate miss: no damage, and the chain starts over", 2.4],
	[8.4, "tap", "attack"], # a whiff…
	[9.0, "tap", "attack"], # …and the first strike again
	[9.8, "stick", Vector2(0.0, -1.0)],
	[9.9, "tap", "dodge"], # a roll away
	[10.5, "stick_up"],
	[10.8, "caption", "Dodge, then back in", 1.5],
	[11.0, "go", Vector2(1.4, 0.4), 0.85],
	[12.4, "tap", "attack"],
	[12.73, "tap", "attack"],
	[13.1, "tap", "attack"],
	[14.2, "caption", "At 0 HP the dummy falls — and stands up again", 3.2],
	[14.6, "tap", "attack"],
	[14.93, "tap", "attack"],
	[15.3, "tap", "attack"],
	[16.2, "go", Vector2(-2.5, 3.5), 0.85], # away while it is down
	[17.6, "go", Vector2(-0.6, 0.9), 0.4], # and back
	[19.0, "tap", "attack"],
	[20.2, "end"],
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
			var b: Dictionary = touch._btn[String(step[2])]
			_touch(2, b["c"], true)
			get_tree().create_timer(0.12).timeout.connect(_touch.bind(2, b["c"], false))
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
