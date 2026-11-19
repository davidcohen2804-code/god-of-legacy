class_name TouchControls
extends Control
## On-screen controls for a phone held in landscape (GPT's M2 layout, 1280×720 reference, centres and diameters):
## a fixed-base joystick bottom-left — it takes a touch that starts within 1.5× its radius, never one that began
## elsewhere, and pushed to its rim for 250 ms it sprints; on the right Basic Attack, three skills on an arc, Heavy,
## Dodge and Jump; up to two conditional buttons above the arc (only while valid, with a ring that runs out with the
## opportunity's window — M4), and between them, when more opportunities wait than the two buttons hold, a small chip
## with their count: tapping it brings the best waiting one onto a button (GPT's v1.2). Dragging anywhere else turns
## the camera. Several fingers at once, each followed by its own id.
## Sizes: every hit target is at least 44 CSS px, 48 where it fits. Each side's cluster is scaled about its corner
## (spacing and hit sizes together) as far as the right cluster still fits under the top bar; a hit circle grown past
## its drawn button never reaches a neighbour's. The drawn buttons grow less than their hit areas, to keep the screen
## clean.
## It only produces intents (PlayerInput); it knows nothing of the rules — what the conditional buttons show, and each
## skill's cooldown, it is told. Basic Attack (the katana chain), Heavy, Phantom Chain, Shadow Step, Rising Slash,
## Dodge and Jump take presses (a button not built yet would be drawn dimmed and take none).
## A conditional button that starts showing an opportunity (a new one, or one brought on from the waiting chip) gives a
## brief cue (GPT's v1.7): a 3 px ring bursting from its edge to CUE_GROW × its radius over CUE s, gold turning to violet
## as it fades — never so wide that it reaches a neighbouring button — and its fill lit for CUE_FILL s. Drawn only: the
## touch targets never change and the cue takes no input.
## The look (M4.2-A2, GPT's v2.3 — `style`): "icons", the approved icons centred in their discs at the approved
## diameters, each button's short word under its disc (at least 10 CSS px: ivory with a dark outline, drawn only — it
## takes no touch and stays clear of every other button's hit area), the conditional buttons as violet capsules as wide
## as their word at the same size — the chip's count too — their window running out along the outline, their cue
## bursting along it; the capsules sit either side of the chip, each one's inner end fixed (a longer word moves only its
## outer end), their hit areas as tall as 48 CSS px and covering the whole capsule. "words" — the earlier look (QA).
## The icons are rasterized from their SVGs for this screen, at its own pixel size (sharp on any phone).

const REF := Vector2(1280, 720)
## "icons" (GPT's v2.3) or "words" (the earlier look — QA, regressions).
static var style := "icons"
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
	"more": [Vector2(1050, 268), 40.0, "R"], # (its top level with cond2's: the cluster's height is unchanged)
}
const LABELS := {
	"attack": "ATTACK", "skill1": "CHAIN", "skill2": "STEP", "skill3": "RISE", "heavy": "HEAVY", "dodge": "DODGE",
	"jump": "JUMP",
}
## The icons' layout (GPT's v2.1 sizes: the approved diameters; the same centres) — the conditional row's centres: the
## chip's; the capsules are placed from it.
const LAYOUT_ICONS := {
	"stick": [Vector2(140, 565), 148.0, "L"],
	"attack": [Vector2(1070, 555), 112.0, "R"],
	"skill1": [Vector2(950, 450), 76.0, "R"],
	"skill2": [Vector2(1070, 390), 76.0, "R"],
	"skill3": [Vector2(1180, 450), 76.0, "R"],
	"heavy": [Vector2(1195, 615), 64.0, "R"],
	"dodge": [Vector2(910, 630), 72.0, "R"],
	"jump": [Vector2(820, 555), 64.0, "R"],
	"cond1": [Vector2(975, 280), 64.0, "R"],
	"cond2": [Vector2(1125, 280), 64.0, "R"],
	"more": [Vector2(1050, 280), 40.0, "R"],
}
const SHORT := {
	"attack": "ATK", "skill1": "CHAIN", "skill2": "STEP", "skill3": "RISE", "heavy": "HEAVY", "dodge": "DODGE",
	"jump": "JUMP",
}
const ICON := {
	"attack": "attack", "skill1": "chain", "skill2": "step", "skill3": "rise", "heavy": "heavy", "dodge": "dodge",
	"jump": "jump",
}
const ICON_DIR := "res://assets/ui/hud/"
const ICON_SHARE := 0.6 ## an icon's size, of its disc's diameter
const LABEL_PX := 22.0 ## canvas px at least: 10.4 CSS px on the iPhone's 340, 11 on Android's 360
const LABEL_MIN_CSS := 10.0
const LABEL_GAP := 4.0 ## px between a disc and its word
const LABEL_OUTLINE := 5
const CAPSULE_PAD := 16.0 ## px either side of a capsule's word, before its round ends
const CAPSULE_H := 0.82 ## a capsule's height, of the 64 disc's
const ROW_GAP := 6.0 ## px between the hit areas in the conditional row
const MIN_CSS := 44.0
const WANT_CSS := 48.0
const TOP_BAR := 110.0 ## canvas px kept free at the top for the HUD
const STICK_CAPTURE := 1.5 ## a touch starting within this many base radii takes the stick
const RIM := 0.95 ## the stick's push (0..1) that counts as its rim
const DEAD := 0.12
const CUE := 0.3 ## s, a conditional button's activation ring
const CUE_FILL := 0.15 ## s its fill stays lit
const CUE_GROW := 1.4 ## the ring's widest, as a multiple of the button's drawn radius
const CUE_CLEAR := 4.0 ## px the ring keeps clear of any other button

var input: PlayerInput
## Buttons that take presses; the rest are drawn dimmed.
var enabled_actions := {"attack": true, "heavy": true, "skill1": true, "skill2": true, "skill3": true, "dodge": true,
	"jump": true}
## Areas left to the interface's own buttons (pause...): touches there are not taken.
var reserved: Array[Rect2] = []
## Controls whose own areas are left to them, wherever they are laid out (the device test's TEST button).
var reserved_controls: Array[Control] = []

var css_per_px := 1.0 ## CSS pixels per canvas pixel on this screen
var css_override := 0.0 ## (tests) a phone's CSS pixels per canvas pixel, in place of this screen's
var hit_scale := 1.0
var art_scale := 1.0
var _btn := {} ## name → {c, r_hit, r_min, r_art}
var _cond := {}
var _waiting := 0 ## opportunities waiting beyond the two buttons
var _cooldown := {} ## name → [seconds left, total]
var _touch := {} ## touch index → {role, key}
var _stick_index := -1
var _stick_knob := Vector2.ZERO
var _flash := {}
var _cue := {} ## cond key → s since its opportunity came onto it
var _t := 0.0
var _font: Font
var label_px := LABEL_PX ## the words' size on this screen (icons)
var _want_r := 24.0
var _stretch := 1.0 ## window px per canvas px
var _icons := {} ## key → its icon, rasterized for this screen
var _icon_px := {} ## key → the px it was rasterized at


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = UiTheme.font("inter-latin-700-normal")
	resized.connect(_layout)
	_layout()


## A Legacy Chain conditional button ("cond1", "cond2"): shown with `label` while `on`, its ring at `left` (the part
## of its window still open, 1..0); `ident` names the opportunity (ability and target) so a new one on the button cues
## (the label when not given). Told every frame.
func set_conditional(key: String, label: String, on: bool, left: float = 1.0, ident: String = "") -> void:
	var before: Dictionary = _cond.get(key, {})
	var was := bool(before.get("on", false))
	var id := ident if ident != "" else label
	if on and (not was or String(before.get("ident", "")) != id):
		_cue[key] = 0.0
		QA.flag("cue", "%s:%s" % [key, label])
	elif not on:
		_cue.erase(key)
	var relabel := on and String(before.get("label", "")) != label
	_cond[key] = {"label": label, "on": on, "left": clampf(left, 0.0, 1.0), "ident": id}
	if style == "icons" and relabel and _btn.has(key):
		_capsule(key) # (its word's width: its outer end moves, its inner end stays)
	if was != on or (style == "icons" and relabel):
		_publish_rects()


## How far a conditional button's activation ring may open (px from its centre): CUE_GROW × its drawn radius, less
## where another button shown now is closer (it keeps CUE_CLEAR px clear of it) — never inside the button itself.
func cue_reach(key: String) -> float:
	var b: Dictionary = _btn.get(key, {})
	if b.is_empty():
		return 0.0
	var r: float = b["r_art"]
	var reach := r * CUE_GROW
	for other in _btn:
		if other == key or other == "stick" or not is_shown(other):
			continue
		var o: Dictionary = _btn[other]
		# (the chip: in the words' look a pill half as long again as its radius; in the icons' its own straight part)
		var extent: float = float(o["r_art"]) * (1.5 if other == "more" and style == "words" else 1.0)
		reach = minf(reach, _gap(b, o) - extent - CUE_CLEAR)
	return maxf(reach, r + 2.0)


## The distance between two buttons' centre lines (a disc's is its centre; a capsule's, its straight part).
static func _gap(a: Dictionary, b: Dictionary) -> float:
	var ca: Vector2 = a["c"]
	var cb: Vector2 = b["c"]
	var ha := float(a.get("half", 0.0))
	var hb := float(b.get("half", 0.0))
	var dx := maxf(0.0, absf(ca.x - cb.x) - ha - hb)
	return Vector2(dx, ca.y - cb.y).length()


## A touch's distance from a button's centre line.
static func _reach_of(b: Dictionary, p: Vector2) -> float:
	var c: Vector2 = b["c"]
	var h := float(b.get("half", 0.0))
	return p.distance_to(Vector2(clampf(p.x, c.x - h, c.x + h), c.y))


## (Tests and QA) the cue running on a conditional button: s since it began (-1: none).
func cue_age(key: String) -> float:
	return float(_cue.get(key, -1.0))


## How many opportunities wait beyond the two buttons (the chip shows while there are any).
func set_waiting(n: int) -> void:
	if (n > 0) != (_waiting > 0):
		_waiting = n
		_publish_rects()
	_waiting = n


## A button's cooldown (told by the combat state each frame): a dark sweep over it and the seconds left while `left`
## is above 0. The button stays pressable — the combat state refuses the press, the sweep shows why.
func set_cooldown(key: String, left: float, total: float) -> void:
	if left <= 0.0 or total <= 0.0:
		_cooldown.erase(key)
	else:
		_cooldown[key] = [left, total]


func is_shown(key: String) -> bool:
	if key.begins_with("cond"):
		return _cond.has(key) and bool(_cond[key]["on"])
	if key == "more":
		return _waiting > 0
	return _btn.has(key)


func is_enabled(key: String) -> bool:
	return key.begins_with("cond") or key == "more" or bool(enabled_actions.get(key, false))


func _layout() -> void:
	var s := size
	if s.x < 8.0 or s.y < 8.0:
		return
	css_per_px = _css_per_px()
	var inset := _safe_insets() # left, top, right, bottom in canvas px
	var want_r := WANT_CSS / css_per_px * 0.5
	var min_r := MIN_CSS / css_per_px * 0.5
	_want_r = want_r
	var lay: Dictionary = LAYOUT_ICONS if style == "icons" else LAYOUT
	var reach := 0.0 # (the right cluster's height above the bottom edge, to its highest button)
	for key in lay:
		if lay[key][2] == "R":
			reach = maxf(reach, REF.y - (lay[key][0] as Vector2).y + float(lay[key][1]) * 0.5)
	var room := s.y - inset.w - inset.y - TOP_BAR
	hit_scale = clampf(minf(want_r / 29.0, room / reach), 1.0, 3.0)
	art_scale = 1.0 + (hit_scale - 1.0) * 0.7
	label_px = maxf(LABEL_PX, LABEL_MIN_CSS / css_per_px)
	_btn.clear()
	for key in lay:
		var spec: Array = lay[key]
		var ref_c: Vector2 = spec[0]
		var d: float = spec[1]
		var c: Vector2
		if spec[2] == "L":
			c = Vector2(inset.x, s.y - inset.w) + (ref_c - Vector2(0, REF.y)) * hit_scale
		else:
			c = Vector2(s.x - inset.z, s.y - inset.w) + (ref_c - REF) * hit_scale
		var r := d * 0.5 * hit_scale
		_btn[key] = {"c": c, "r_hit": maxf(r, want_r), "r_min": maxf(r, min_r), "r_art": d * 0.5 * art_scale, "half": 0.0}
	if style == "icons":
		# the chip: a pill as tall as its count's words need; the capsules either side of it
		var chip: Dictionary = _btn["more"]
		chip["r_art"] = maxf(float(chip["r_art"]) * 0.7, label_px * 0.95)
		chip["half"] = float(chip["r_art"]) * 1.05
		chip["r_hit"] = maxf(float(chip["r_hit"]), float(chip["r_art"]))
		for key: String in ["cond1", "cond2"]:
			_capsule(key)
	# Hit areas grown to 48 CSS px must stay 6 px clear of every neighbour: where two would not, both go back toward
	# their 44 CSS px floor.
	var keys := _btn.keys()
	for i in keys.size():
		for j in range(i + 1, keys.size()):
			var a: Dictionary = _btn[keys[i]]
			var b: Dictionary = _btn[keys[j]]
			var gap := _gap(a, b) - 6.0
			var sum := float(a["r_hit"]) + float(b["r_hit"])
			if sum > gap:
				var k := maxf(gap / sum, 0.0)
				a["r_hit"] = maxf(float(a["r_hit"]) * k, float(a["r_min"]))
				b["r_hit"] = maxf(float(b["r_hit"]) * k, float(b["r_min"]))
	_stick_knob = _btn["stick"]["c"]
	if style == "icons":
		_rasterize_icons()
	_publish_rects()


## A conditional button's capsule (the icons' look): as wide as its word at the label size (COUNTER's until it is told
## one), its inner end at a fixed place beside the chip — cond1 to its left, cond2 to its right, ROW_GAP px between their
## hit areas — so a longer word moves only the outer end; its hit area 48 CSS px tall round the whole capsule.
func _capsule(key: String) -> void:
	var b: Dictionary = _btn[key]
	var chip: Dictionary = _btn["more"]
	var word := String(_cond.get(key, {}).get("label", ""))
	if word == "":
		word = "COUNTER"
	var tw := _font.get_string_size(word, HORIZONTAL_ALIGNMENT_LEFT, -1, int(roundf(label_px))).x
	var h := 64.0 * 0.5 * art_scale * CAPSULE_H
	var half := maxf(0.0, (tw + 2.0 * CAPSULE_PAD + 1.2 * h - 2.0 * h) * 0.5)
	var r_hit := maxf(_want_r, h)
	var cc: Vector2 = chip["c"]
	var cr := float(chip["r_hit"]) + float(chip["half"]) # (the chip's hit area: its pill's straight part and round it)
	if key == "cond1":
		b["c"] = Vector2(cc.x - cr - ROW_GAP - r_hit - half, cc.y)
	else:
		b["c"] = Vector2(cc.x + cr + ROW_GAP + r_hit + half, cc.y)
	b["half"] = half
	b["r_art"] = h
	b["r_hit"] = r_hit
	b["r_min"] = r_hit


## The icons for this screen: each rasterized from its SVG at the size it is drawn at, in the window's own pixels.
func _rasterize_icons() -> void:
	for key: String in ICON:
		if not _btn.has(key):
			continue
		var px := maxi(8, ceili(float(_btn[key]["r_art"]) * 2.0 * ICON_SHARE * _stretch))
		if int(_icon_px.get(key, 0)) == px:
			continue
		var f := FileAccess.open(ICON_DIR + String(ICON[key]) + ".svg", FileAccess.READ)
		if f == null:
			continue
		var img := Image.new()
		if img.load_svg_from_string(f.get_as_text(), float(px) / 128.0) != OK:
			continue
		_icons[key] = ImageTexture.create_from_image(img)
		_icon_px[key] = px


## (Tests and QA) where a button's word sits under its disc (the icons' look; empty otherwise).
func label_rect(key: String) -> Rect2:
	if style != "icons" or not _btn.has(key) or not SHORT.has(key):
		return Rect2()
	var b: Dictionary = _btn[key]
	var fs := int(roundf(label_px))
	var w := _font.get_string_size(String(SHORT[key]), HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var c: Vector2 = b["c"]
	var top := c.y + float(b["r_art"]) + LABEL_GAP
	var o := LABEL_OUTLINE * 0.5
	return Rect2(c.x - w * 0.5 - o, top - o, w + 2.0 * o, _font.get_height(fs) + 2.0 * o)


func _label_rects() -> Dictionary:
	var out := {}
	for key: String in SHORT:
		var r := label_rect(key)
		if r.size != Vector2.ZERO:
			out[key] = [snappedf(r.position.x, 0.1), snappedf(r.position.y, 0.1), snappedf(r.size.x, 0.1), snappedf(r.size.y, 0.1)]
	return out


## CSS pixels per canvas pixel: the canvas's stretch over the browser's device pixel ratio.
func _css_per_px() -> float:
	if css_override > 0.0:
		return css_override
	var win := Vector2(DisplayServer.window_get_size())
	if win.y <= 0.0 or size.y <= 0.0:
		return 1.0
	var stretch := minf(win.x / size.x, win.y / size.y)
	_stretch = stretch
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
		var h := float(b.get("half", 0.0))
		var show := true if key == "stick" else is_shown(key)
		QA.set_rect("btn_" + key, Rect2(b["c"] - Vector2(r + h, r), Vector2(r + h, r) * 2.0) if show else Rect2())
	var st: Dictionary = _btn["stick"]
	var zr: float = float(st["r_hit"]) * STICK_CAPTURE
	QA.set_rect("stick_zone", Rect2(st["c"] - Vector2(zr, zr), Vector2(zr, zr) * 2.0))
	# A patch of free screen for camera drags: above the left cluster, clear of the top bar and the right cluster.
	QA.set_rect("camera_zone", Rect2(Vector2(size.x * 0.3, size.y * 0.2), Vector2(size.x * 0.22, size.y * 0.22)))


## The screen the fighters are kept clear of (canvas px — M4.2-A's camera framing and its numbers): the HUD's top band,
## and a box round each cluster's always-shown controls (not the conditional buttons, which come and go), 12 px wider.
func exclusion_rects() -> Array[Rect2]:
	var out: Array[Rect2] = [Rect2(0.0, 0.0, size.x, TOP_BAR)]
	for side: String in ["L", "R"]:
		var box := cluster_box(side)
		if box.size != Vector2.ZERO:
			out.append(box)
	return out


## The box round a cluster's always-shown controls (their discs and, in the icons' look, their words), 12 px wider.
func cluster_box(side: String) -> Rect2:
	var box := Rect2()
	var first := true
	var lay: Dictionary = LAYOUT_ICONS if style == "icons" else LAYOUT
	for key: String in lay:
		if lay[key][2] != side or key.begins_with("cond") or key == "more" or not _btn.has(key):
			continue
		var b: Dictionary = _btn[key]
		var r := float(b["r_art"])
		var one := Rect2((b["c"] as Vector2) - Vector2(r, r), Vector2(r, r) * 2.0)
		var lr := label_rect(key)
		if lr.size != Vector2.ZERO:
			one = one.merge(lr)
		box = one if first else box.merge(one)
		first = false
	return box.grow(12.0) if not first else Rect2()


## (GPT's v2.4) The controls' own areas on one side, in canvas px — what the camera's assist keeps the target off, not
## the cluster's whole box: each shown button's hit circle (x, y, its hit radius) and each word under a disc; the
## conditional buttons and the chip, which come and go, are left out as in cluster_box.
func control_areas(side: String) -> Dictionary:
	var circles: Array[Vector3] = []
	var rects: Array[Rect2] = []
	var lay: Dictionary = LAYOUT_ICONS if style == "icons" else LAYOUT
	for key: String in lay:
		if lay[key][2] != side or key.begins_with("cond") or key == "more" or not is_shown(key):
			continue
		var b: Dictionary = _btn[key]
		var c: Vector2 = b["c"]
		circles.append(Vector3(c.x, c.y, float(b["r_hit"])))
		var lr := label_rect(key)
		if lr.size != Vector2.ZERO:
			rects.append(lr)
	return {"circles": circles, "rects": rects, "css": css_per_px}


## For the tests and the report: the sizing on this screen and the live touch state.
func layout_info() -> Dictionary:
	var cds := {}
	for k in _cooldown:
		cds[k] = snappedf(float(_cooldown[k][0]), 0.01)
	var min_css := 0.0
	for key in _btn:
		if is_shown(key):
			var dcss := float(_btn[key]["r_hit"]) * 2.0 * css_per_px
			min_css = dcss if min_css == 0.0 else minf(min_css, dcss)
	return {"css_per_px": snappedf(css_per_px, 0.001), "hit_scale": snappedf(hit_scale, 0.001),
		"art_scale": snappedf(art_scale, 0.001), "min_hit_css": snappedf(min_css, 0.1), "style": style,
		"label_css": snappedf(label_px * css_per_px, 0.1), "icons": _icons.size(), "labels": _label_rects(),
		"stick": _stick_index != -1, "touches": _touch.size(), "enabled": enabled_actions.keys(), "cooldowns": cds}


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
	for c in reserved_controls:
		if is_instance_valid(c) and c.is_visible_in_tree() and c.get_global_rect().has_point(p):
			return false
	# Buttons first: the nearest one whose hit circle holds the touch.
	var best := ""
	var best_d := INF
	for key in _btn:
		if key == "stick" or not is_shown(key):
			continue
		var b: Dictionary = _btn[key]
		var dd := _reach_of(b, p)
		if dd <= float(b["r_hit"]) and dd < best_d:
			best = key
			best_d = dd
	if best != "":
		_touch[index] = {"role": "button", "key": best}
		if is_enabled(best):
			_flash[best] = 0.18
			input.press("cond_more" if best == "more" else best)
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
		var k := String(_touch[index]["key"])
		input.release("cond_more" if k == "more" else k)
	_touch.erase(index)


func _process(delta: float) -> void:
	_t += delta
	for k in _flash.keys():
		_flash[k] -= delta
		if _flash[k] <= 0.0:
			_flash.erase(k)
	for k in _cue.keys():
		_cue[k] = float(_cue[k]) + delta
		if float(_cue[k]) >= CUE:
			_cue.erase(k)
	queue_redraw()


func _draw() -> void:
	var st: Dictionary = _btn.get("stick", {})
	if st.is_empty():
		return
	var icons := style == "icons"
	var on := _stick_index != -1
	var sprint := on and input != null and input.wants_sprint()
	var sc: Vector2 = st["c"]
	var sr: float = st["r_art"]
	draw_circle(sc, sr, _alpha(UiTheme.MIDNIGHT, 0.42 if on else 0.3))
	draw_arc(sc, sr, 0.0, TAU, 72, UiTheme.GOLD if sprint else _alpha(UiTheme.GOLD_DIM, 0.9 if on else 0.6),
		4.0 if sprint else 2.5, true)
	draw_circle(_stick_knob, sr * 0.38, _alpha(UiTheme.TEXT, 0.55 if on else 0.3))
	if sprint:
		if icons:
			_word(sc + Vector2(0, -sr - label_px * 0.9), "SPRINT", int(roundf(label_px)), UiTheme.GOLD, 1.0)
		else:
			_text(sc + Vector2(0, -sr - 16.0), "SPRINT", 16, UiTheme.GOLD)
	for key in _btn:
		if key == "stick" or not is_shown(key):
			continue
		var b: Dictionary = _btn[key]
		var c: Vector2 = b["c"]
		var r: float = b["r_art"]
		var cond := String(key).begins_with("cond")
		if key == "more":
			_draw_more(b)
			continue
		if icons and cond:
			_draw_capsule(key, b)
			continue
		var a := 1.0 if is_enabled(key) else 0.38
		var lit: bool = _flash.has(key)
		var ring := UiTheme.ACCENT if cond else (UiTheme.GOLD if key == "attack" else UiTheme.GOLD_DIM)
		draw_circle(c, r, _alpha(UiTheme.PLUM, (0.9 if lit else 0.62) * a))
		if lit:
			draw_circle(c, r * 0.94, _alpha(UiTheme.GOLD, 0.32))
		var cue := float(_cue.get(key, -1.0)) if cond else -1.0
		if cue >= 0.0 and cue < CUE_FILL:
			draw_circle(c, r * 0.94, _alpha(UiTheme.GOLD, 0.34 * (1.0 - cue / CUE_FILL)))
		draw_arc(c, r, 0.0, TAU, 72, _alpha(ring, a), 3.5 if key == "attack" else 2.5, true)
		if icons:
			# the icon in its disc; under a cooldown the sweep shades it and the seconds sit on it; the word under the disc
			var tex: Texture2D = _icons.get(key)
			var isz := r * 2.0 * ICON_SHARE
			if tex:
				draw_texture_rect(tex, Rect2(c - Vector2(isz, isz) * 0.5, Vector2(isz, isz)), false,
					_alpha(UiTheme.GOLD if key == "attack" else UiTheme.TEXT, a))
			if _cooldown.has(key):
				var cdi: Array = _cooldown[key]
				_pie(c, r * 0.97, clampf(float(cdi[0]) / float(cdi[1]), 0.0, 1.0), _alpha(UiTheme.MIDNIGHT, 0.62))
				var secs := "%.1f" % float(cdi[0]) if float(cdi[0]) < 10.0 else "%d" % int(cdi[0])
				_word(c, secs, int(clampf(r * 0.62, label_px, 34.0)), UiTheme.TEXT, a)
			var lr := label_rect(key)
			_word(Vector2(c.x, lr.position.y + lr.size.y * 0.5), String(SHORT.get(key, "")), int(roundf(label_px)),
				UiTheme.TEXT, a)
			continue
		if cond:
			var left := float(_cond[key]["left"])
			if left > 0.0:
				draw_arc(c, r + 6.0, -PI * 0.5, -PI * 0.5 + TAU * left, 64, UiTheme.ACCENT, 3.0, true)
		var label := String(_cond[key]["label"]) if cond else String(LABELS.get(key, key))
		if _cooldown.has(key):
			var cdv: Array = _cooldown[key]
			_pie(c, r * 0.97, clampf(float(cdv[0]) / float(cdv[1]), 0.0, 1.0), _alpha(UiTheme.MIDNIGHT, 0.72))
			label = "%.1f" % float(cdv[0]) if float(cdv[0]) < 10.0 else "%d" % int(cdv[0])
		_text(c, label, int(clampf(r * 0.42, 13.0, 22.0)), _alpha(UiTheme.TEXT, 0.95 * a))
		if cue >= 0.0:
			# the activation ring: from the button's edge outward, easing out, gold turning violet as it fades
			var k := clampf(cue / CUE, 0.0, 1.0)
			var rr := lerpf(r + 1.5, cue_reach(key), 1.0 - (1.0 - k) * (1.0 - k))
			var col := UiTheme.GOLD.lerp(UiTheme.ACCENT, k)
			draw_arc(c, rr, 0.0, TAU, 72, Color(col.r, col.g, col.b, 1.0 - k), 3.0, true)


## A conditional button in the icons' look: a violet capsule round its word, its window running out along its outline
## (clockwise from the top's middle, in step with the opportunity's own time), the cue as on a disc but along it.
func _draw_capsule(key: String, b: Dictionary) -> void:
	var c: Vector2 = b["c"]
	var h := float(b["r_art"])
	var half := float(b["half"])
	var lit: bool = _flash.has(key)
	draw_colored_polygon(_stadium(c, half, h), _alpha(UiTheme.PLUM, 0.9 if lit else 0.8))
	var cue := float(_cue.get(key, -1.0))
	if lit:
		draw_colored_polygon(_stadium(c, half, h * 0.94), _alpha(UiTheme.GOLD, 0.32))
	if cue >= 0.0 and cue < CUE_FILL:
		draw_colored_polygon(_stadium(c, half, h * 0.94), _alpha(UiTheme.GOLD, 0.34 * (1.0 - cue / CUE_FILL)))
	_outline(c, half, h, 1.0, UiTheme.ACCENT, 2.5)
	var left := float(_cond[key]["left"])
	if left > 0.0:
		_outline(c, half, h + 6.0, left, UiTheme.ACCENT, 3.0)
	_word(c, String(_cond[key]["label"]), int(roundf(label_px)), UiTheme.TEXT, 1.0)
	if cue >= 0.0:
		var k := clampf(cue / CUE, 0.0, 1.0)
		var rr := lerpf(h + 1.5, cue_reach(key), 1.0 - (1.0 - k) * (1.0 - k))
		var col := UiTheme.GOLD.lerp(UiTheme.ACCENT, k)
		_outline(c, half, rr, 1.0, Color(col.r, col.g, col.b, 1.0 - k), 3.0)


## The overflow chip: a small pill with the count of opportunities waiting (the text well inside its edge).
func _draw_more(b: Dictionary) -> void:
	var c: Vector2 = b["c"]
	var icons := style == "icons"
	var h := float(b["r_art"]) if icons else float(b["r_art"]) * 0.7 # half the pill's height
	var half := float(b["half"]) if icons else h * 1.05 # half the distance between its end circles
	var fill := _alpha(UiTheme.PLUM, 0.92 if _flash.has("more") else 0.74)
	# (one shape: a rectangle and two discs, each see-through, were darker where they overlapped)
	draw_colored_polygon(_stadium(c, half, h), fill)
	_outline(c, half, h, 1.0, UiTheme.ACCENT, 2.0)
	if icons:
		_word(c, "+%d" % _waiting, int(roundf(label_px)), UiTheme.TEXT, 1.0)
	else:
		_text(c, "+%d" % _waiting, int(clampf(h * 1.05, 13.0, 18.0)), _alpha(UiTheme.TEXT, 0.95))


## A capsule's outline (a disc's when `half` is 0): its points clockwise from the top's middle, not closed (a polygon).
static func _stadium(c: Vector2, half: float, r: float, n: int = 24) -> PackedVector2Array:
	var pts := PackedVector2Array([c + Vector2(0, -r)])
	if half > 0.01:
		pts.append(c + Vector2(half, -r))
	for i in range(1, n + 1):
		var ang := -PI * 0.5 + PI * float(i) / n
		pts.append(c + Vector2(half, 0) + Vector2(cos(ang), sin(ang)) * r)
	if half > 0.01:
		pts.append(c + Vector2(-half, r))
	for i in range(1, n):
		var ang := PI * 0.5 + PI * float(i) / n
		pts.append(c + Vector2(-half, 0) + Vector2(cos(ang), sin(ang)) * r)
	if half > 0.01:
		pts.append(c + Vector2(-half, -r))
	return pts


## `frac` of a capsule's outline, clockwise from the top's middle (all of it at 1).
func _outline(c: Vector2, half: float, r: float, frac: float, col: Color, w: float) -> void:
	var pts := _stadium(c, half, r)
	pts.append(pts[0])
	var total := 0.0
	for i in range(1, pts.size()):
		total += pts[i].distance_to(pts[i - 1])
	var want := total * clampf(frac, 0.0, 1.0)
	var out := PackedVector2Array([pts[0]])
	var run := 0.0
	for i in range(1, pts.size()):
		var seg := pts[i].distance_to(pts[i - 1])
		if run + seg >= want:
			out.append(pts[i - 1].lerp(pts[i], (want - run) / maxf(seg, 0.0001)))
			break
		out.append(pts[i])
		run += seg
	if out.size() >= 2:
		draw_polyline(out, col, w, true)


## A filled sweep of `frac` of a full turn, clockwise from the top (a cooldown's remaining part).
func _pie(c: Vector2, r: float, frac: float, col: Color) -> void:
	if frac <= 0.0:
		return
	var pts := PackedVector2Array([c])
	var n := maxi(3, int(48 * frac))
	for i in n + 1:
		var ang := -PI * 0.5 + TAU * frac * float(i) / n
		pts.append(c + Vector2(cos(ang), sin(ang)) * r)
	draw_colored_polygon(pts, col)


static func _alpha(col: Color, a: float) -> Color:
	return Color(col.r, col.g, col.b, a)


func _text(c: Vector2, s: String, fs: int, col: Color) -> void:
	var w := _font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	draw_string(_font, Vector2(c.x - w * 0.5, c.y + fs * 0.36), s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)


## A word centred on `c` in the icons' look: ivory (or `col`) over a dark outline, legible on light stone and in shadow.
func _word(c: Vector2, s: String, fs: int, col: Color, a: float) -> void:
	var w := _font.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var at := Vector2(c.x - w * 0.5, c.y + fs * 0.36)
	draw_string_outline(_font, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, LABEL_OUTLINE, _alpha(UiTheme.MIDNIGHT, 0.85 * a))
	draw_string(_font, at, s, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, _alpha(col, 0.97 * a))
