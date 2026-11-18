class_name TouchControls
extends Control
## On-screen controls for a phone held in landscape. Left: a floating joystick wherever the thumb lands on the left
## part of the screen (pushed to its rim = sprint). Right: the round basic-attack button (hold it for the heavy
## attack), the three skills in a semicircle round it, dodge and jump; the Legacy Chain's conditional skills appear
## in an outer arc only while they are available. Dragging anywhere else turns the camera. Several fingers at once.
## It only produces intents (PlayerInput); it knows nothing of the combat rules.

const SKILL_ANGLES: Array[float] = [180.0, 225.0, 270.0]
const COND_ANGLES: Array[float] = [192.0, 220.0, 248.0, 276.0]
const STICK_R := 118.0
const HEAVY_HOLD := 0.34

var input: PlayerInput
var labels := {
	"attack": "ATTACK", "skill1": "CHAIN", "skill2": "STEP", "skill3": "RISE", "dodge": "DODGE",
	"jump": "JUMP", "lock": "LOCK",
}
## Areas left to the interface's real buttons (the pause button): touches there are not taken.
var reserved: Array[Rect2] = []
var lock_on := false

var _btn := {}
var _cond := {}
var _cool := {}
var _touch := {}
var _stick_index := -1
var _stick_origin := Vector2.ZERO
var _stick_knob := Vector2.ZERO
var _stick_rest := Vector2.ZERO
var _attack_index := -1
var _attack_held := 0.0
var _heavy_sent := false
var _flash := {}
var _t := 0.0
var _font: Font


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = UiTheme.font("inter-latin-700-normal")
	resized.connect(_layout)
	_layout()


## The Legacy Chain's conditional slots ("cond1".."cond4"): shown with `label` while `on`.
func set_conditional(key: String, label: String, on: bool) -> void:
	var was: bool = _cond.has(key) and bool(_cond[key]["on"])
	_cond[key] = {"label": label, "on": on, "since": _t if (on and not was) else float(_cond.get(key, {}).get("since", _t))}
	if on != was:
		_publish_rects()


func set_cooldown(key: String, remaining: float, total: float) -> void:
	_cool[key] = Vector2(maxf(remaining, 0.0), maxf(total, 0.001))


func is_shown(key: String) -> bool:
	if key.begins_with("cond"):
		return _cond.has(key) and bool(_cond[key]["on"])
	return _btn.has(key)


func _layout() -> void:
	var s := size
	var inset := _safe_insets()
	var right := s.x - 30.0 - inset.y
	var bottom := s.y - 26.0
	var a := Vector2(right - 150.0, bottom - 124.0)
	_btn.clear()
	_btn["attack"] = {"c": a, "r": 96.0}
	for i in 3:
		_btn["skill%d" % (i + 1)] = {"c": a + Vector2.from_angle(deg_to_rad(SKILL_ANGLES[i])) * 200.0, "r": 64.0}
	_btn["dodge"] = {"c": a + Vector2(-404.0, 40.0), "r": 62.0}
	_btn["jump"] = {"c": a + Vector2.from_angle(deg_to_rad(300.0)) * 192.0, "r": 52.0}
	_btn["lock"] = {"c": Vector2(right - 52.0, 176.0), "r": 46.0}
	for i in 4:
		_btn["cond%d" % (i + 1)] = {"c": a + Vector2.from_angle(deg_to_rad(COND_ANGLES[i])) * 340.0, "r": 58.0}
	_stick_rest = Vector2(30.0 + inset.x + 170.0, bottom - 150.0)
	_publish_rects()


func _safe_insets() -> Vector2:
	# (left, right) in this canvas's units; the web page itself is kept inside the safe area by the browser
	var win := DisplayServer.window_get_size()
	var safe := DisplayServer.get_display_safe_area()
	if win.x <= 0 or safe.size.x <= 0 or safe.size.x >= win.x:
		return Vector2.ZERO
	var k := size.x / float(win.x)
	return Vector2(maxf(0.0, safe.position.x) * k, maxf(0.0, win.x - safe.end.x) * k)


func _publish_rects() -> void:
	for key in _btn:
		var b: Dictionary = _btn[key]
		var r: float = b["r"]
		if is_shown(key):
			QA.set_rect("btn_" + key, Rect2(b["c"] - Vector2(r, r), Vector2(r, r) * 2.0))
		else:
			QA.set_rect("btn_" + key, Rect2())
	QA.set_rect("stick_zone", Rect2(Vector2(40, size.y * 0.45), Vector2(size.x * 0.4 - 40.0, size.y * 0.5)))
	QA.set_rect("camera_zone", Rect2(Vector2(size.x * 0.5, 60.0), Vector2(size.x * 0.25, size.y * 0.3)))


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or input == null:
		return
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		var p := (make_input_local(t) as InputEventScreenTouch).position
		if t.pressed:
			if _down(t.index, p):
				get_viewport().set_input_as_handled()
		else:
			_up(t.index)
	elif event is InputEventScreenDrag:
		var d := make_input_local(event) as InputEventScreenDrag
		if _drag(d.index, d.position, d.relative):
			get_viewport().set_input_as_handled()


func _down(index: int, p: Vector2) -> bool:
	for r in reserved:
		if r.has_point(p):
			return false
	for key in _btn:
		if not is_shown(key):
			continue
		var b: Dictionary = _btn[key]
		if p.distance_to(b["c"]) <= float(b["r"]) * 1.2:
			_touch[index] = {"role": "button", "key": key}
			_flash[key] = 0.2
			if key == "lock":
				input.press("lock")
			else:
				input.press(key)
			if key == "attack":
				_attack_index = index
				_attack_held = 0.0
				_heavy_sent = false
			return true
	if p.x < size.x * 0.45 and _stick_index == -1:
		_stick_index = index
		_stick_origin = p
		_stick_knob = p
		_touch[index] = {"role": "stick"}
		return true
	_touch[index] = {"role": "camera"}
	return true


func _drag(index: int, p: Vector2, rel: Vector2) -> bool:
	if not _touch.has(index):
		return false
	match String(_touch[index]["role"]):
		"stick":
			var v := p - _stick_origin
			if v.length() > STICK_R * 1.4:
				_stick_origin = p - v.normalized() * STICK_R * 1.4
				v = p - _stick_origin
			_stick_knob = _stick_origin + v.limit_length(STICK_R)
			var m := v.limit_length(STICK_R) / STICK_R
			input.touch_move = Vector2(m.x, -m.y) if m.length() > 0.12 else Vector2.ZERO
			input.touch_sprint = v.length() > STICK_R * 0.97
		"camera":
			input.camera_drag += rel
	return true


func _up(index: int) -> void:
	if not _touch.has(index):
		return
	var role := String(_touch[index]["role"])
	if role == "stick":
		_stick_index = -1
		input.touch_move = Vector2.ZERO
		input.touch_sprint = false
	elif role == "button":
		input.release(String(_touch[index]["key"]))
		if index == _attack_index:
			_attack_index = -1
	_touch.erase(index)


func _process(delta: float) -> void:
	_t += delta
	for k in _flash.keys():
		_flash[k] -= delta
		if _flash[k] <= 0.0:
			_flash.erase(k)
	if _attack_index != -1:
		_attack_held += delta
		if _attack_held >= HEAVY_HOLD and not _heavy_sent:
			_heavy_sent = true
			input.press("heavy")
			_flash["attack"] = 0.3
	queue_redraw()


func _draw() -> void:
	var stick_c := _stick_origin if _stick_index != -1 else _stick_rest
	var knob := _stick_knob if _stick_index != -1 else _stick_rest
	var on := _stick_index != -1
	draw_circle(stick_c, STICK_R, Color(1, 1, 1, 0.07 if on else 0.035))
	draw_arc(stick_c, STICK_R, 0.0, TAU, 64, Color(1, 1, 1, 0.28 if on else 0.14), 3.0, true)
	draw_circle(knob, 50.0, Color(1, 1, 1, 0.26 if on else 0.12))
	for key in _btn:
		if not is_shown(key):
			continue
		var b: Dictionary = _btn[key]
		var c: Vector2 = b["c"]
		var r: float = b["r"]
		var cond := String(key).begins_with("cond")
		var lit: bool = _flash.has(key)
		var ring := UiTheme.GOLD if key == "attack" else Color(0.85, 0.9, 1.0, 0.7)
		if cond:
			var k := 0.5 + 0.5 * sin((_t - float(_cond[key]["since"])) * 6.0)
			draw_circle(c, r + 10.0 + 4.0 * k, Color(0.45, 0.85, 1.0, 0.16 + 0.12 * k))
			ring = Color(0.55, 0.9, 1.0, 1.0)
		if key == "lock" and lock_on:
			ring = Color(1.0, 0.45, 0.35)
		draw_circle(c, r, Color(0.04, 0.05, 0.09, 0.62 if not lit else 0.85))
		if lit:
			draw_circle(c, r * 0.96, Color(ring.r, ring.g, ring.b, 0.35))
		draw_arc(c, r, 0.0, TAU, 72, ring, 3.5 if key == "attack" else 2.5, true)
		if _cool.has(key) and (_cool[key] as Vector2).x > 0.0:
			var cv: Vector2 = _cool[key]
			_draw_pie(c, r - 2.0, cv.x / cv.y, Color(0, 0, 0, 0.58))
			_text(c + Vector2(0, -2), "%.1f" % cv.x, 26, Color(1, 1, 1, 0.95))
			_text(c + Vector2(0, 26), _label(key), 14, Color(1, 1, 1, 0.55))
		else:
			_text(c, _label(key), 22 if key == "attack" else (17 if r < 60.0 else 19), Color(1, 1, 1, 0.92))


func _label(key: String) -> String:
	if key.begins_with("cond"):
		return String(_cond[key]["label"])
	return String(labels.get(key, key.to_upper()))


func _text(c: Vector2, s: String, fs: int, col: Color) -> void:
	var w := _font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	draw_string(_font, Vector2(c.x - w * 0.5, c.y + fs * 0.36), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)


func _draw_pie(c: Vector2, r: float, frac: float, col: Color) -> void:
	frac = clampf(frac, 0.0, 1.0)
	if frac <= 0.0:
		return
	var pts := PackedVector2Array([c])
	var n := maxi(3, int(48 * frac))
	for i in n + 1:
		var a := -PI * 0.5 + TAU * frac * float(i) / float(n)
		pts.append(c + Vector2(cos(a), sin(a)) * r)
	draw_colored_polygon(pts, col)
