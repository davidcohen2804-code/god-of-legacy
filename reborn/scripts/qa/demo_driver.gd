class_name DemoDriver
extends Node
## The movement demo (for the M2 review's recording): run with `-- --demo`, the game goes straight to the arena and
## this node plays a fixed script of touches through the engine's own input — the same path a finger takes — so the
## on-screen controls show the thumb on the stick, the presses and the sprint ring while the Samurai walks, runs,
## sprints, jumps, dodges and the camera turns. Recorded with Godot's Movie Maker (--write-movie, fixed frame rate),
## so the clip is smooth however slowly the machine renders. It quits when the script ends.

## [time (s), action, args...] — stick values are (x right, y up) of the stick's push, 0..1.
const SCRIPT := [
	[1.0, "stick", Vector2(0.55, 0.0)], # walk round the target, to his right
	[2.6, "stick", Vector2(0.8, 0.6)], # run, curving
	[4.2, "stick", Vector2(0.0, 1.0)], # held at the rim: sprint after 0.25 s
	[6.6, "stick_up"],
	[7.4, "tap", "jump"],
	[8.8, "drag", Vector2(-420, 0), 1.6], # a second finger turns the camera
	[10.8, "stick", Vector2(0.0, 1.0)],
	[11.9, "tap", "jump"], # a running jump
	[13.4, "stick_up"],
	[13.8, "tap", "dodge"],
	[14.8, "stick", Vector2(-1.0, 0.0)],
	[15.0, "tap", "dodge"], # a roll to the left
	[15.8, "stick", Vector2(-0.4, 1.0)], # run while turning the camera: two fingers
	[16.1, "drag", Vector2(300, 0), 2.0],
	[18.6, "stick_up"],
	[20.5, "end"],
]

var touch: TouchControls
var _t := 0.0
var _i := 0
var _stick_down := false
var _drag := {} ## the camera finger: from, to, start, length


func _physics_process(delta: float) -> void:
	_t += delta
	while _i < SCRIPT.size() and _t >= float(SCRIPT[_i][0]):
		_run(SCRIPT[_i])
		_i += 1
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
	var stick: Dictionary = touch._btn["stick"]
	var c: Vector2 = stick["c"]
	var r: float = stick["r_hit"]
	match String(step[1]):
		"stick":
			var v: Vector2 = step[2]
			var p := c + Vector2(v.x, -v.y) * r
			if not _stick_down:
				_touch(0, c, true)
				_stick_down = true
			var d := InputEventScreenDrag.new()
			d.index = 0
			d.position = p
			d.relative = p - c
			Input.parse_input_event(d)
		"stick_up":
			if _stick_down:
				_touch(0, c, false)
				_stick_down = false
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


func _touch(index: int, p: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = index
	e.position = p
	e.pressed = pressed
	Input.parse_input_event(e)
