class_name DemoDriver
extends Node
## The movement demo (for the M2 review's recording): run with `-- --demo`, the game goes straight to the arena and
## this node plays a fixed script of touches through the engine's own input — the same path a finger takes — so the
## on-screen controls show the thumb on the stick, the presses and the sprint ring while the Samurai walks, runs,
## sprints, jumps, dodges and the camera turns. Recorded with Godot's Movie Maker (--write-movie, fixed frame rate),
## so the clip is smooth however slowly the machine renders. It quits when the script ends.

## [time (s), action, args...]. "go": the thumb steers the stick toward a point of the courtyard (x, z) at a push
## (0..1; 1 = the rim, which sprints after 0.25 s) until he is there — so the walk stays inside the open middle
## whatever the camera does; "stick": a fixed push (x right, y up); "drag": a second finger turns the camera.
## The Samurai starts 7 m south of the target looking north.
const SCRIPT := [
	[1.0, "go", Vector2(4.0, 5.0), 0.4], # walk to the target's right
	[2.6, "go", Vector2(5.0, -3.0), 0.85], # run past it
	[4.3, "go", Vector2(-6.0, -4.5), 1.0], # sprint across
	[6.3, "stick_up"],
	[6.8, "tap", "jump"], # a standing jump
	[8.0, "drag", Vector2(300, 0), 1.6], # a second finger turns the camera
	[10.0, "go", Vector2(-2.0, 6.0), 0.9],
	[10.7, "tap", "jump"], # a running jump
	[11.7, "stick_up"],
	[12.0, "tap", "dodge"], # a roll ahead
	[13.0, "stick", Vector2(-1.0, 0.0)],
	[13.2, "tap", "dodge"], # a roll to the left
	[13.6, "stick_up"],
	[14.2, "go", Vector2(4.0, 2.0), 0.4], # two fingers: walking while the camera turns back
	[14.4, "drag", Vector2(-300, 0), 2.2],
	[16.8, "go", Vector2(0.0, 6.5), 0.9], # and a short run back
	[18.4, "stick_up"],
	[19.6, "end"],
]

var touch: TouchControls
var player: Fighter
var rig: CameraRig
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
		"end":
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
