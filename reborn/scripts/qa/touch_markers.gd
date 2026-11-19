class_name TouchMarkers
extends Control
## The review recordings' fingers (M4.2 — so the reviewer sees what was pressed, and when, and what answered it): a soft
## ring under every touch while it is down — the stick's thumb follows it — fading for a quarter second after it lifts.
## Only in the recordings (Game.demo); drawn only, it takes no input. It must sit after the touch controls in the tree:
## the input reaches it first and goes on to them.

const R := 30.0 ## px
const FADE := 0.25 ## s

var _down := {} ## touch index → where it is
var _gone: Array = [] ## [where it lifted, s since]


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var t := make_input_local(event) as InputEventScreenTouch
		if t.pressed:
			_down[t.index] = t.position
		elif _down.has(t.index):
			_gone.append([_down[t.index], 0.0])
			_down.erase(t.index)
	elif event is InputEventScreenDrag:
		var d := make_input_local(event) as InputEventScreenDrag
		if _down.has(d.index):
			_down[d.index] = d.position


func _process(delta: float) -> void:
	for g: Array in _gone:
		g[1] = float(g[1]) + delta
	_gone = _gone.filter(func(g: Array) -> bool: return float(g[1]) < FADE)
	queue_redraw()


func _draw() -> void:
	for p: Vector2 in _down.values():
		_mark(p, 1.0)
	for g: Array in _gone:
		_mark(g[0], 1.0 - float(g[1]) / FADE)


func _mark(p: Vector2, a: float) -> void:
	draw_circle(p, R, Color(1, 1, 1, 0.2 * a))
	draw_arc(p, R, 0.0, TAU, 40, Color(1, 1, 1, 0.85 * a), 3.0, true)
