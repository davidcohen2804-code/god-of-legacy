class_name TouchControls
extends Control
## On-screen controls for a phone held in landscape (GPT's M2 layout, 1280×720 reference, centres and diameters):
## a fixed-base joystick bottom-left — it takes a touch that starts within 1.5× its radius, never one that began
## elsewhere, and pushed to its rim for 250 ms it sprints; on the right Basic Attack, three skills on an arc, Heavy,
## Dodge and Jump; up to two conditional buttons above the arc (only while valid, with an expiry ring — M4). Dragging
## anywhere else turns the camera. Several fingers at once, each followed by its own id.
## Sizes: every hit target is at least 44 CSS px, 48 where it fits. Each side's cluster is scaled about its corner
## (spacing and hit sizes together) as far as the right cluster still fits under the top bar; a hit circle grown past
## its drawn button never reaches a neighbour's. The drawn buttons grow less than their hit areas, to keep the screen
## clean.
## It only produces intents (PlayerInput); it knows nothing of the rules. Basic Attack (the katana chain), Heavy,
## Dodge and Jump take presses; the skills are drawn dimmed and take none until theirs is built (M4).

const REF := Vector2(1280, 720)
## name → [centre in the reference, diameter, cluster ("L" bottom-left, "R" bottom-right)]
const LAYOUT := {
	"stick": [Vector2(140, 565), 148.0, "L"],
	"attack": [Vector2(1070, 555), 88.0, "R"],
	"skill1": [Vector2(950, 450), 64.0, "R"],
	"skill2": [Vector2(1070, 390), 64.0, "R"],
	"skill3": [Vector2(1180, 450), 64.0, "R"],
	"heavy": [Vector2(1195, 615), 58.0, "R"],
	"dodge": [Vector2(910, 630), 68.0, "R"],
	"jump": [Vector2(820, 555), 58.0, "R"],
	"cond1": [Vector2(975, 300), 64.0, "R"],
	"cond2": [Vector2(1125, 280), 64.0, "R"],
}
const LABELS := {
	"attack": "ATTACK", "skill1": "CHAIN", "skill2": "STEP", "skill3": "RISE", "heavy": "HEAVY", "dodge": "DODGE",
	"jump": "JUMP",
}
const MIN_CSS := 44.0
const WANT_CSS := 48.0
const TOP_BAR := 110.0 ## canvas px kept free at the top for the HUD
const STICK_CAPTURE := 1.5 ## a touch starting within this many base radii takes the stick
const RIM := 0.95 ## the stick's push (0..1) that counts as its rim
const DEAD := 0.12

var input: PlayerInput
## Buttons that take presses; the rest are drawn dimmed.
var enabled_actions := {"attack": true, "heavy": true, "dodge": true, "jump": true}
## Areas left to the interface's own buttons (pause...): touches there are not taken.
var reserved: Array[Rect2] = []

var css_per_px := 1.0 ## CSS pixels per canvas pixel on this screen
var hit_scale := 1.0
var art_scale := 1.0
var _btn := {} ## name → {c, r_hit, r_min, r_art}
var _cond := {}
var _touch := {} ## touch index → {role, key}
var _stick_index := -1
var _stick_knob := Vector2.ZERO
var _flash := {}
var _t := 0.0
var _font: Font


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = UiTheme.font("inter-latin-700-normal")
	resized.connect(_layout)
	_layout()


## A Legacy Chain conditional slot ("cond1", "cond2"): shown with `label` while `on`, its ring running out over
## `seconds` (M4).
func set_conditional(key: String, label: String, on: bool, seconds: float = 0.0) -> void:
	_cond[key] = {"label": label, "on": on, "since": _t, "life": seconds}
	_publish_rects()


func is_shown(key: String) -> bool:
	if key.begins_with("cond"):
		return _cond.has(key) and bool(_cond[key]["on"])
	return _btn.has(key)


func is_enabled(key: String) -> bool:
	return key.begins_with("cond") or bool(enabled_actions.get(key, false))


func _layout() -> void:
	var s := size
	if s.x < 8.0 or s.y < 8.0:
		return
	css_per_px = _css_per_px()
	var inset := _safe_insets() # left, top, right, bottom in canvas px
	var want_r := WANT_CSS / css_per_px * 0.5
	var min_r := MIN_CSS / css_per_px * 0.5
	var top: Vector2 = LAYOUT["cond2"][0]
	var reach := REF.y - top.y + float(LAYOUT["cond2"][1]) * 0.5
	var room := s.y - inset.w - inset.y - TOP_BAR
	hit_scale = clampf(minf(want_r / 29.0, room / reach), 1.0, 3.0)
	art_scale = 1.0 + (hit_scale - 1.0) * 0.7
	_btn.clear()
	for key in LAYOUT:
		var spec: Array = LAYOUT[key]
		var ref_c: Vector2 = spec[0]
		var d: float = spec[1]
		var c: Vector2
		if spec[2] == "L":
			c = Vector2(inset.x, s.y - inset.w) + (ref_c - Vector2(0, REF.y)) * hit_scale
		else:
			c = Vector2(s.x - inset.z, s.y - inset.w) + (ref_c - REF) * hit_scale
		var r := d * 0.5 * hit_scale
		_btn[key] = {"c": c, "r_hit": maxf(r, want_r), "r_min": maxf(r, min_r), "r_art": d * 0.5 * art_scale}
	# Hit circles grown to 48 CSS px must stay 6 px clear of every neighbour: where two would not, both go back toward
	# their 44 CSS px floor.
	var keys := _btn.keys()
	for i in keys.size():
		for j in range(i + 1, keys.size()):
			var a: Dictionary = _btn[keys[i]]
			var b: Dictionary = _btn[keys[j]]
			var gap := (a["c"] as Vector2).distance_to(b["c"]) - 6.0
			var sum := float(a["r_hit"]) + float(b["r_hit"])
			if sum > gap:
				var k := maxf(gap / sum, 0.0)
				a["r_hit"] = maxf(float(a["r_hit"]) * k, float(a["r_min"]))
				b["r_hit"] = maxf(float(b["r_hit"]) * k, float(b["r_min"]))
	_stick_knob = _btn["stick"]["c"]
	_publish_rects()


## CSS pixels per canvas pixel: the canvas's stretch over the browser's device pixel ratio.
func _css_per_px() -> float:
	var win := Vector2(DisplayServer.window_get_size())
	if win.y <= 0.0 or size.y <= 0.0:
		return 1.0
	var stretch := minf(win.x / size.x, win.y / size.y)
	return stretch / maxf(DisplayServer.screen_get_scale(), 0.5)


## (left, top, right, bottom) safe-area insets in canvas pixels. On the web the page itself sits inside the safe area
## unless it asks to cover it, so the CSS insets are read only to be sure.
func _safe_insets() -> Vector4:
	var k := 1.0 / maxf(css_per_px, 0.01)
	if OS.has_feature("web"):
		var v: Variant = JavaScriptBridge.eval("""(() => { const d = document.createElement('div');
			d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
			document.body.appendChild(d); const c = getComputedStyle(d);
			const r = [c.paddingLeft, c.paddingTop, c.paddingRight, c.paddingBottom].map(parseFloat).join(',');
			d.remove(); return r; })()""", true)
		if typeof(v) == TYPE_STRING:
			var p := String(v).split(",")
			if p.size() == 4:
				return Vector4(float(p[0]), float(p[1]), float(p[2]), float(p[3])) * k
		return Vector4.ZERO
	var win := DisplayServer.window_get_size()
	var safe := DisplayServer.get_display_safe_area()
	if win.x <= 0 or safe.size.x <= 0:
		return Vector4.ZERO
	var px := size.x / float(win.x)
	return Vector4(maxf(0.0, safe.position.x), maxf(0.0, safe.position.y), maxf(0.0, win.x - safe.end.x),
		maxf(0.0, win.y - safe.end.y)) * px


func _publish_rects() -> void:
	for key in _btn:
		var b: Dictionary = _btn[key]
		var r: float = b["r_hit"]
		var show := true if key == "stick" else is_shown(key)
		QA.set_rect("btn_" + key, Rect2(b["c"] - Vector2(r, r), Vector2(r, r) * 2.0) if show else Rect2())
	var st: Dictionary = _btn["stick"]
	var zr: float = float(st["r_hit"]) * STICK_CAPTURE
	QA.set_rect("stick_zone", Rect2(st["c"] - Vector2(zr, zr), Vector2(zr, zr) * 2.0))
	# A patch of free screen for camera drags: above the left cluster, clear of the top bar and the right cluster.
	QA.set_rect("camera_zone", Rect2(Vector2(size.x * 0.3, size.y * 0.2), Vector2(size.x * 0.22, size.y * 0.22)))


## For the tests and the report: the sizing on this screen and the live touch state.
func layout_info() -> Dictionary:
	var min_css := 0.0
	for key in _btn:
		if is_shown(key):
			var dcss := float(_btn[key]["r_hit"]) * 2.0 * css_per_px
			min_css = dcss if min_css == 0.0 else minf(min_css, dcss)
	return {"css_per_px": snappedf(css_per_px, 0.001), "hit_scale": snappedf(hit_scale, 0.001),
		"art_scale": snappedf(art_scale, 0.001), "min_hit_css": snappedf(min_css, 0.1),
		"stick": _stick_index != -1, "touches": _touch.size(), "enabled": enabled_actions.keys()}


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
	if _touch.has(index):
		return true
	for r in reserved:
		if r.has_point(p):
			return false
	# Buttons first: the nearest one whose hit circle holds the touch.
	var best := ""
	var best_d := INF
	for key in _btn:
		if key == "stick" or not is_shown(key):
			continue
		var b: Dictionary = _btn[key]
		var dd := p.distance_to(b["c"])
		if dd <= float(b["r_hit"]) and dd < best_d:
			best = key
			best_d = dd
	if best != "":
		_touch[index] = {"role": "button", "key": best}
		if is_enabled(best):
			_flash[best] = 0.18
			input.press(best)
			QA.flag("pressed", best)
		else:
			QA.flag("dimmed_tap", best)
		return true
	var st: Dictionary = _btn["stick"]
	if _stick_index == -1 and p.distance_to(st["c"]) <= float(st["r_hit"]) * STICK_CAPTURE:
		_stick_index = index
		_touch[index] = {"role": "stick"}
		_stick_to(p)
		return true
	_touch[index] = {"role": "camera"}
	return true


func _drag(index: int, p: Vector2, rel: Vector2) -> bool:
	if not _touch.has(index):
		return false
	match String(_touch[index]["role"]):
		"stick":
			_stick_to(p)
		"camera":
			input.camera_drag += rel
	return true


func _stick_to(p: Vector2) -> void:
	var st: Dictionary = _btn["stick"]
	var r: float = st["r_hit"]
	var v := (p - (st["c"] as Vector2)).limit_length(r)
	_stick_knob = (st["c"] as Vector2) + v
	var m := v / r
	input.touch_move = Vector2(m.x, -m.y) if m.length() > DEAD else Vector2.ZERO
	input.touch_rim = m.length() >= RIM


func _up(index: int) -> void:
	if not _touch.has(index):
		return
	var role := String(_touch[index]["role"])
	if role == "stick":
		_stick_index = -1
		_stick_knob = _btn["stick"]["c"]
		input.touch_move = Vector2.ZERO
		input.touch_rim = false
	elif role == "button":
		input.release(String(_touch[index]["key"]))
	_touch.erase(index)


func _process(delta: float) -> void:
	_t += delta
	for k in _flash.keys():
		_flash[k] -= delta
		if _flash[k] <= 0.0:
			_flash.erase(k)
	queue_redraw()


func _draw() -> void:
	var st: Dictionary = _btn.get("stick", {})
	if st.is_empty():
		return
	var on := _stick_index != -1
	var sprint := on and input != null and input.wants_sprint()
	var sc: Vector2 = st["c"]
	var sr: float = st["r_art"]
	draw_circle(sc, sr, _alpha(UiTheme.MIDNIGHT, 0.42 if on else 0.3))
	draw_arc(sc, sr, 0.0, TAU, 72, UiTheme.GOLD if sprint else _alpha(UiTheme.GOLD_DIM, 0.9 if on else 0.6),
		4.0 if sprint else 2.5, true)
	draw_circle(_stick_knob, sr * 0.38, _alpha(UiTheme.TEXT, 0.55 if on else 0.3))
	if sprint:
		_text(sc + Vector2(0, -sr - 16.0), "SPRINT", 16, UiTheme.GOLD)
	for key in _btn:
		if key == "stick" or not is_shown(key):
			continue
		var b: Dictionary = _btn[key]
		var c: Vector2 = b["c"]
		var r: float = b["r_art"]
		var cond := String(key).begins_with("cond")
		var a := 1.0 if is_enabled(key) else 0.38
		var lit: bool = _flash.has(key)
		var ring := UiTheme.ACCENT if cond else (UiTheme.GOLD if key == "attack" else UiTheme.GOLD_DIM)
		draw_circle(c, r, _alpha(UiTheme.PLUM, (0.9 if lit else 0.62) * a))
		if lit:
			draw_circle(c, r * 0.94, _alpha(UiTheme.GOLD, 0.32))
		draw_arc(c, r, 0.0, TAU, 72, _alpha(ring, a), 3.5 if key == "attack" else 2.5, true)
		if cond:
			var cd: Dictionary = _cond[key]
			var life := float(cd["life"])
			if life > 0.0:
				var left := clampf(1.0 - (_t - float(cd["since"])) / life, 0.0, 1.0)
				draw_arc(c, r + 6.0, -PI * 0.5, -PI * 0.5 + TAU * left, 64, UiTheme.ACCENT, 3.0, true)
		var label := String(_cond[key]["label"]) if cond else String(LABELS.get(key, key))
		_text(c, label, int(clampf(r * 0.42, 13.0, 22.0)), _alpha(UiTheme.TEXT, 0.95 * a))


static func _alpha(col: Color, a: float) -> Color:
	return Color(col.r, col.g, col.b, a)


func _text(c: Vector2, s: String, fs: int, col: Color) -> void:
	var w := _font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	draw_string(_font, Vector2(c.x - w * 0.5, c.y + fs * 0.36), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)
