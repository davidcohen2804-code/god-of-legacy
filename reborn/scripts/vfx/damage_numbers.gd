class_name DamageNumbers
extends RefCounted
## A target's damage numbers (M3): each confirmed blow shows its damage above the target, rising and fading over
## 0.75 s. Blows in quick succession (within 0.6 s) sit side by side across the view instead of covering each other —
## a number rising from below would run into the next one's place (12 and 10 read as 120). One per target.

var _clock := 0.0 ## game time seen by the owner (advance())
var _at := -10.0 ## when the last number appeared
var _i := 0
var _right := Vector3.RIGHT ## the view's right on the ground


func advance(delta: float) -> void:
	_clock += delta


## Show `damage` above `owner` (a node in the tree), `height` m over its origin — in `tint` when given (the Samurai's
## own wounds), else ivory, gold for a heavy blow.
func spawn(owner: Node3D, damage: int, height: float = 2.2, tint: Color = Color(0, 0, 0, 0)) -> void:
	if not owner.is_inside_tree() or owner.get_parent() == null:
		return
	var cam := owner.get_viewport().get_camera_3d()
	if cam:
		var r := cam.global_transform.basis.x
		r.y = 0.0
		if r.length() > 0.01:
			_right = r.normalized()
	var l := Label3D.new()
	l.text = str(damage)
	l.font = UiTheme.font("inter-latin-700-normal")
	l.font_size = 96
	l.pixel_size = 0.004
	l.outline_size = 18
	l.modulate = tint if tint.a > 0.0 else (Color("#F2E9DD") if damage < 18 else Color("#D9B778"))
	l.outline_modulate = Color(0.07, 0.05, 0.1, 0.9)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.fixed_size = false
	owner.get_parent().add_child(l)
	_i = (_i + 1) % 3 if _clock - _at < 0.6 else 0
	_at = _clock
	l.global_position = owner.global_position + _right * [0.0, 0.55, -0.55][_i] + Vector3(0, height + 0.12 * _i, 0)
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "global_position:y", l.global_position.y + 0.7, 0.75).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.75).set_delay(0.25)
	tw.chain().tween_callback(l.queue_free)
