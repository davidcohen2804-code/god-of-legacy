class_name Backdrop
extends Control
## The menus' night backdrop, drawn (no image files): a deep gradient, a soft moon and slow rising embers.

const EMBERS := 46

var _embers: Array = []
var _t := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in EMBERS:
		_embers.append({
			"x": rng.randf(), "y": rng.randf(), "s": rng.randf_range(1.5, 4.0),
			"v": rng.randf_range(0.012, 0.04), "p": rng.randf() * TAU,
		})


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _draw() -> void:
	var w := size.x
	var h := size.y
	var top := Color("#141b36")
	var bottom := Color("#05060b")
	draw_polygon(
		PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w, h), Vector2(0, h)]),
		PackedColorArray([top, top, bottom, bottom]))
	var moon := Vector2(w * 0.74, h * 0.26)
	for i in range(10, 0, -1):
		draw_circle(moon, h * 0.045 * i, Color(0.72, 0.82, 1.0, 0.012 * (11 - i)))
	draw_circle(moon, h * 0.065, Color(0.9, 0.94, 1.0, 0.85))
	for e in _embers:
		var y := fposmod(float(e["y"]) - _t * float(e["v"]), 1.0)
		var x := float(e["x"]) + sin(_t * 0.6 + float(e["p"])) * 0.01
		var a := 0.2 + 0.4 * pow(sin(_t * 1.7 + float(e["p"])), 2.0)
		draw_circle(Vector2(x * w, y * h), float(e["s"]), Color(1.0, 0.72, 0.38, a))
