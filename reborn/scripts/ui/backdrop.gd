class_name Backdrop
extends Control
## The menus' backdrop, drawn in code (no image files): a ruined moon sanctuary at twilight in layered silhouettes —
## a deep violet sky, a great moon framed by a broken arch, two far ridges, a broken colonnade, a cracked courtyard
## floor, drifting mist and slow spirit motes. The scenery sits at the screen's edges (the moon and arch on the right,
## the colonnade on the left) so the centred logo and buttons stay clear at 16:9 and at wider phone ratios.
## Still layers are drawn once (again only when the screen changes size); only the moving layers redraw each frame.

const HORIZON := 0.79 ## the horizon line, as a fraction of the screen height
const MOON_R := 100.0 ## the moon's radius, in units of 1/720 of the screen height

const SKY_TOP := Color("#0b0a16")
const SKY_MID := Color("#211B35")
const SKY_LOW := Color("#3b2d5e")
const RIDGE_FAR := Color("#241d3d")
const RIDGE_NEAR := Color("#18132b")
const RUIN := Color("#110e20")
const GROUND_TOP := Color("#1b1530")
const GROUND_LOW := Color("#08070f")
const NEAR := Color("#06050b")
const MOON := Color("#F2E9DD")
const VIOLET := Color("#9674E7")
const GOLD := Color("#D9B778")
const MIST := Color(0.78, 0.71, 0.96)
## Darker patches on the moon's face: offset from the centre and radius, in moon radii.
const MARIA: Array[Vector3] = [
	Vector3(-0.32, -0.22, 0.27), Vector3(0.2, -0.1, 0.18), Vector3(-0.08, 0.34, 0.2), Vector3(0.4, 0.3, 0.12),
	Vector3(0.05, -0.5, 0.1),
]

var _t := 0.0
var _glow: GradientTexture2D
var _vignette: GradientTexture2D
var _stars: Array[Dictionary] = []
var _motes: Array[Dictionary] = []
var _moving: Array[Control] = []
var _halo: Control


class Layer extends Control:
	var painter: Callable

	func _draw() -> void:
		painter.call(self)


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_glow = _radial([Vector2(0.0, 1.0), Vector2(0.3, 0.5), Vector2(0.62, 0.16), Vector2(1.0, 0.0)])
	_vignette = _radial([Vector2(0.0, 0.0), Vector2(0.58, 0.0), Vector2(1.0, 0.62)], Color("#05040a"))
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261118
	for i in 64:
		_stars.append({"x": rng.randf(), "y": rng.randf() * 0.58, "s": rng.randf_range(0.6, 1.7),
			"a": rng.randf_range(0.25, 0.75), "f": rng.randf_range(0.6, 1.6), "p": rng.randf() * TAU})
	for i in 44:
		_motes.append({"x": rng.randf(), "y": rng.randf(), "s": rng.randf_range(1.2, 3.2),
			"v": rng.randf_range(0.01, 0.032), "p": rng.randf() * TAU, "violet": rng.randf() < 0.4})
	_add(_paint_sky, false)
	_add(_paint_stars, true)
	_halo = _add(_paint_halo, false)
	_add(_paint_far, false)
	_add(_paint_mist_back, true)
	_add(_paint_ruins, false)
	_add(_paint_mist_front, true)
	_add(_paint_near, false)
	_add(_paint_motes, true)
	_add(_paint_vignette, false)


func _process(delta: float) -> void:
	_t += delta
	_halo.modulate.a = 0.9 + 0.1 * sin(_t * TAU / 9.0)
	for l in _moving:
		l.queue_redraw()


func _add(painter: Callable, moving: bool) -> Control:
	var l := Layer.new()
	l.painter = painter
	l.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(l)
	if moving:
		_moving.append(l)
	return l


## A radial gradient texture of `col` whose alpha follows the (offset, alpha) points, centre to rim.
static func _radial(points: Array, col: Color = Color.WHITE) -> GradientTexture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array(points.map(func(p: Vector2) -> float: return p.x))
	g.colors = PackedColorArray(points.map(func(p: Vector2) -> Color: return Color(col.r, col.g, col.b, p.y)))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 256
	t.height = 256
	return t


static func _moon_center(s: Vector2) -> Vector2:
	var u := s.y / 720.0
	return Vector2(s.x - 222.0 * u, 0.6 * s.y)


static func _vgrad(c: CanvasItem, x0: float, x1: float, y0: float, y1: float, a: Color, b: Color) -> void:
	c.draw_polygon(PackedVector2Array([Vector2(x0, y0), Vector2(x1, y0), Vector2(x1, y1), Vector2(x0, y1)]),
		PackedColorArray([a, a, b, b]))


static func _with_a(col: Color, a: float) -> Color:
	return Color(col.r, col.g, col.b, a)


func _glow_at(c: CanvasItem, at: Vector2, radius: Vector2, col: Color) -> void:
	c.draw_texture_rect(_glow, Rect2(at - radius, radius * 2.0), false, col)


# --- still layers ------------------------------------------------------------------------------------------------

func _paint_sky(c: Control) -> void:
	var w := c.size.x
	var h := c.size.y
	var hz := h * HORIZON
	_vgrad(c, 0, w, 0, hz * 0.5, SKY_TOP, SKY_MID)
	_vgrad(c, 0, w, hz * 0.5, hz, SKY_MID, SKY_LOW)
	_vgrad(c, 0, w, hz, h, SKY_LOW, GROUND_LOW)
	var m := _moon_center(c.size)
	_glow_at(c, Vector2(m.x, hz), Vector2(h * 0.9, h * 0.34), _with_a(VIOLET, 0.22))


## The moon's halo: drawn once, its brightness breathes through the layer's modulate.
func _paint_halo(c: Control) -> void:
	var u := c.size.y / 720.0
	var m := _moon_center(c.size)
	var r := MOON_R * u
	_glow_at(c, m, Vector2(r, r) * 4.4, _with_a(VIOLET, 0.34))
	_glow_at(c, m, Vector2(r, r) * 1.9, _with_a(MOON, 0.32))


func _paint_far(c: Control) -> void:
	var w := c.size.x
	var h := c.size.y
	var u := h / 720.0
	var hz := h * HORIZON
	var m := _moon_center(c.size)
	var r := MOON_R * u
	c.draw_circle(m, r, MOON, true, -1.0, true)
	_glow_at(c, m + Vector2(r * 0.28, r * 0.3), Vector2(r, r) * 0.95, Color(0.55, 0.45, 0.72, 0.22))
	for s in MARIA:
		c.draw_circle(m + Vector2(s.x, s.y) * r, s.z * r, Color(0.6, 0.53, 0.7, 0.2), true, -1.0, true)
	c.draw_colored_polygon(_ridge(w, h, hz - 0.17 * h, 0.05 * h, 0.31, 1.3), RIDGE_FAR)
	# A distant broken tower on the far ridge, right of the colonnade; the nearer ridge hides its foot.
	var tx := 300.0 * u
	var ty := hz - 0.2 * h
	c.draw_colored_polygon(PackedVector2Array([
		Vector2(tx - 14 * u, hz), Vector2(tx - 11 * u, ty + 20 * u), Vector2(tx - 6 * u, ty + 6 * u),
		Vector2(tx + 2 * u, ty + 14 * u), Vector2(tx + 9 * u, ty), Vector2(tx + 13 * u, ty + 24 * u),
		Vector2(tx + 15 * u, hz)]), RIDGE_FAR.darkened(0.1))
	c.draw_colored_polygon(_ridge(w, h, hz - 0.085 * h, 0.03 * h, 0.19, 4.1), RIDGE_NEAR)


## A ridge line: `top` is its mean height, `amp` its swing, `hill` the width of its hills (in screen heights).
static func _ridge(w: float, h: float, top: float, amp: float, hill: float, phase: float) -> PackedVector2Array:
	var pts := PackedVector2Array([Vector2(0, h)])
	var step := h * 0.02
	var x := 0.0
	while x < w + step:
		var xx := minf(x, w)
		var y := top - amp * sin(xx / (hill * h) + phase) - amp * 0.45 * sin(xx / (hill * 0.37 * h) + phase * 1.7) \
			- amp * 0.22 * sin(xx / (hill * 0.13 * h) + phase * 2.3)
		pts.append(Vector2(xx, y))
		x += step
	pts.append(Vector2(w, h))
	return pts


func _paint_ruins(c: Control) -> void:
	var w := c.size.x
	var h := c.size.y
	var u := h / 720.0
	var hz := h * HORIZON
	var m := _moon_center(c.size)
	var rim := _with_a(MOON, 0.26)

	# The courtyard floor: a cracked plane running to the arch.
	_vgrad(c, 0, w, hz, h, GROUND_TOP, GROUND_LOW)
	c.draw_texture_rect(_glow, Rect2(Vector2(m.x - 2.6 * MOON_R * u, hz - 0.03 * h), Vector2(5.2 * MOON_R * u, 0.2 * h)),
		false, _with_a(VIOLET, 0.16))
	var line := Color(0.62, 0.55, 0.85, 0.07)
	for i in range(-7, 8):
		var foot := Vector2(m.x + i * 0.34 * h, h)
		c.draw_line(Vector2(m.x + i * 0.02 * h, hz), foot, line, 1.0 * u, true)
	var row := 0.012 * h
	for i in 6:
		var y := hz + row
		c.draw_line(Vector2(0, y), Vector2(w, y), line, 1.0 * u, true)
		row *= 1.75

	# A low broken wall along the horizon, between the colonnade and the arch.
	var wall := PackedVector2Array([Vector2(250 * u, hz)])
	var x := 250.0 * u
	var k := 0
	while x < m.x - 180.0 * u:
		var top := hz - (16.0 + 14.0 * absf(sin(k * 1.9 + 0.4))) * u
		if k % 5 == 3:
			top = hz - 3.0 * u
		wall.append(Vector2(x, top))
		wall.append(Vector2(x + 38.0 * u, top + (k % 2) * 4.0 * u))
		x += 40.0 * u
		k += 1
	wall.append(Vector2(x, hz))
	if wall.size() >= 4:
		c.draw_colored_polygon(wall, RIDGE_NEAR.darkened(0.25))

	# The broken arch, framing the moon.
	var ri := 118.0 * u
	var ro := 156.0 * u
	var ys := m.y
	for side: float in [-1.0, 1.0]:
		var x_in := m.x + side * ri
		var x_out := m.x + side * ro
		c.draw_colored_polygon(PackedVector2Array([
			Vector2(x_out, ys), Vector2(x_in, ys), Vector2(x_in, hz), Vector2(x_out, hz)]), RUIN)
		var x_cap0 := minf(x_in, x_out) - 8.0 * u
		c.draw_rect(Rect2(x_cap0, ys - 4.0 * u, ro - ri + 16.0 * u, 13.0 * u), RUIN)
		c.draw_rect(Rect2(x_cap0, hz - 20.0 * u, ro - ri + 16.0 * u, 20.0 * u), RUIN)
		c.draw_line(Vector2(x_in, ys + 9.0 * u), Vector2(x_in, hz - 20.0 * u), rim, 1.6 * u, true)
	c.draw_colored_polygon(_arch_segment(m, ys, ri, ro, 180.0, 113.0, u), RUIN)
	c.draw_colored_polygon(_arch_segment(m, ys, ri, ro, 0.0, 61.0, u), RUIN)
	c.draw_arc(Vector2(m.x, ys), ri, deg_to_rad(-178.0), deg_to_rad(-117.0), 24, rim, 1.6 * u, true)
	c.draw_arc(Vector2(m.x, ys), ri, deg_to_rad(-57.0), deg_to_rad(-2.0), 24, rim, 1.6 * u, true)
	# The fallen keystone and rubble at the arch's feet.
	c.draw_colored_polygon(PackedVector2Array([
		Vector2(m.x - 30 * u, hz + 10 * u), Vector2(m.x - 4 * u, hz - 12 * u), Vector2(m.x + 30 * u, hz - 4 * u),
		Vector2(m.x + 22 * u, hz + 14 * u)]), RUIN)
	for s: Vector3 in [Vector3(-190, 8, 14), Vector3(-170, 14, 9), Vector3(176, 10, 12), Vector3(205, 16, 8),
			Vector3(60, 18, 7)]:
		_stone(c, Vector2(m.x + s.x * u, hz + s.y * u), s.z * u, RUIN)

	# The broken colonnade on the left.
	_column(c, 58.0 * u, hz, 0.4 * h, u, false, rim)
	_column(c, 150.0 * u, hz, 0.47 * h, u, true, rim)
	_column(c, 238.0 * u, hz, 0.6 * h, u, true, rim)
	var beam_y := 0.4 * h - 34.0 * u
	c.draw_colored_polygon(PackedVector2Array([
		Vector2(14 * u, beam_y + 2 * u), Vector2(118 * u, beam_y - 3 * u), Vector2(110 * u, beam_y + 8 * u),
		Vector2(126 * u, beam_y + 15 * u), Vector2(120 * u, beam_y + 24 * u), Vector2(14 * u, beam_y + 24 * u)]), RUIN)
	c.draw_line(Vector2(14 * u, beam_y + 2 * u), Vector2(118 * u, beam_y - 3 * u), rim, 1.4 * u, true)
	_stone(c, Vector2(196 * u, hz + 6 * u), 12.0 * u, RUIN)
	_stone(c, Vector2(274 * u, hz + 12 * u), 9.0 * u, RUIN)


## One side of the arch's ring, from angle a0 to its broken end a1 (degrees, 0 = right, 90 = top).
static func _arch_segment(m: Vector2, ys: float, ri: float, ro: float, a0: float, a1: float, u: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var n := 14
	for i in n + 1:
		var a := deg_to_rad(lerpf(a0, a1, float(i) / n))
		pts.append(Vector2(m.x + cos(a) * ro, ys - sin(a) * ro))
	var dir := signf(a1 - a0)
	var jag := deg_to_rad(a1 - dir * 5.0)
	var mid := (ri + ro) * 0.5
	pts.append(Vector2(m.x + cos(jag) * mid, ys - sin(jag) * mid))
	var a_in := deg_to_rad(a1 + dir * 3.0)
	pts.append(Vector2(m.x + cos(a_in) * (ri + 6.0 * u), ys - sin(a_in) * (ri + 6.0 * u)))
	for i in range(n, -1, -1):
		var a := deg_to_rad(lerpf(a0, a1 + dir * 2.0, float(i) / n))
		pts.append(Vector2(m.x + cos(a) * ri, ys - sin(a) * ri))
	return pts


static func _column(c: CanvasItem, cx: float, hz: float, top: float, u: float, broken: bool, rim: Color) -> void:
	var hw := 17.0 * u
	var pts := PackedVector2Array([Vector2(cx - hw, hz - 14 * u)])
	if broken:
		pts.append(Vector2(cx - hw, top + 10 * u))
		pts.append(Vector2(cx - 6 * u, top - 4 * u))
		pts.append(Vector2(cx + 2 * u, top + 9 * u))
		pts.append(Vector2(cx + 9 * u, top))
		pts.append(Vector2(cx + hw, top + 14 * u))
	else:
		pts.append(Vector2(cx - hw, top))
		pts.append(Vector2(cx + hw, top))
	pts.append(Vector2(cx + hw, hz - 14 * u))
	c.draw_colored_polygon(pts, RUIN)
	c.draw_rect(Rect2(cx - hw - 9 * u, hz - 14 * u, 2 * hw + 18 * u, 14 * u), RUIN)
	if not broken:
		c.draw_rect(Rect2(cx - hw - 10 * u, top - 12 * u, 2 * hw + 20 * u, 12 * u), RUIN)
	c.draw_line(Vector2(cx + hw, top + (16 * u if broken else 0.0)), Vector2(cx + hw, hz - 14 * u), rim, 1.4 * u, true)


static func _stone(c: CanvasItem, at: Vector2, r: float, col: Color) -> void:
	c.draw_colored_polygon(PackedVector2Array([
		at + Vector2(-r, r * 0.4), at + Vector2(-r * 0.7, -r * 0.5), at + Vector2(r * 0.1, -r * 0.8),
		at + Vector2(r, -r * 0.2), at + Vector2(r * 0.8, r * 0.5)]), col)


func _paint_near(c: Control) -> void:
	var w := c.size.x
	var h := c.size.y
	var u := h / 720.0
	# A fallen column drum at the lower left, rubble at the lower right.
	c.draw_colored_polygon(PackedVector2Array([
		Vector2(0, h - 70 * u), Vector2(150 * u, h - 92 * u), Vector2(176 * u, h - 40 * u),
		Vector2(160 * u, h), Vector2(0, h)]), NEAR)
	c.draw_line(Vector2(0, h - 70 * u), Vector2(150 * u, h - 92 * u), _with_a(MOON, 0.12), 1.4 * u, true)
	for s: Vector3 in [Vector3(-90, -18, 26), Vector3(-160, -8, 18), Vector3(-36, -30, 16), Vector3(-250, -4, 12)]:
		_stone(c, Vector2(w + s.x * u, h + s.y * u), s.z * u, NEAR)


func _paint_vignette(c: Control) -> void:
	c.draw_texture_rect(_vignette, Rect2(Vector2.ZERO, c.size), false)


# --- moving layers -----------------------------------------------------------------------------------------------

func _paint_stars(c: Control) -> void:
	var w := c.size.x
	var h := c.size.y
	var u := h / 720.0
	var m := _moon_center(c.size)
	var keep_out := (MOON_R * 1.6) * u
	for s in _stars:
		var p := Vector2(float(s["x"]) * w, float(s["y"]) * h)
		if p.distance_to(m) < keep_out:
			continue
		var tw := 0.6 + 0.4 * sin(_t * float(s["f"]) + float(s["p"]))
		c.draw_circle(p, float(s["s"]) * u, _with_a(MOON, float(s["a"]) * tw), true, -1.0, true)


func _paint_mist_back(c: Control) -> void:
	_mist(c, HORIZON - 0.075, 0.09, 0.15, 1.0, 0.0)


func _paint_mist_front(c: Control) -> void:
	_mist(c, HORIZON + 0.035, 0.11, 0.12, -0.7, 2.3)


## A soft band of mist across the screen at height `yc` (fraction of the height), drifting at `drift`.
func _mist(c: Control, yc: float, thick: float, alpha: float, drift: float, phase: float) -> void:
	var w := c.size.x
	var h := c.size.y
	var y := yc * h
	var half := thick * h * 0.5
	var step := h * 0.04
	var pts := PackedVector2Array()
	var cols := PackedColorArray()
	var n := int(ceil(w / step)) + 1
	for i in n:
		var x := minf(i * step, w)
		var a := alpha * (0.55 + 0.45 * sin(x / (0.23 * h) + _t * 0.06 * drift + phase)) \
			* (0.65 + 0.35 * sin(x / (0.085 * h) - _t * 0.045 * drift + phase * 1.3))
		var wave := sin(x / (0.4 * h) + _t * 0.03 + phase) * 0.012 * h
		pts.append(Vector2(x, y - half + wave))
		cols.append(_with_a(MIST, 0.0))
		pts.append(Vector2(x, y + wave))
		cols.append(_with_a(MIST, a))
		pts.append(Vector2(x, y + half + wave))
		cols.append(_with_a(MIST, 0.0))
	var idx := PackedInt32Array()
	for i in n - 1:
		var b := i * 3
		for q: Vector2i in [Vector2i(0, 1), Vector2i(1, 2)]:
			var t0 := b + q.x
			var t1 := b + q.y
			idx.append_array(PackedInt32Array([t0, t0 + 3, t1, t1, t0 + 3, t1 + 3]))
	RenderingServer.canvas_item_add_triangle_array(c.get_canvas_item(), idx, pts, cols)


func _paint_motes(c: Control) -> void:
	var w := c.size.x
	var h := c.size.y
	var u := h / 720.0
	for e in _motes:
		var fy := fposmod(float(e["y"]) - _t * float(e["v"]), 1.0)
		var fx := float(e["x"]) + sin(_t * 0.5 + float(e["p"])) * 0.012
		var fade := clampf((fy - 0.12) / 0.3, 0.0, 1.0) * clampf((1.0 - fy) / 0.12, 0.0, 1.0)
		var tw := (0.55 + 0.45 * pow(sin(_t * 1.3 + float(e["p"])), 2.0)) * fade
		if tw <= 0.01:
			continue
		var col: Color = VIOLET if e["violet"] else GOLD
		var p := Vector2(fx * w, fy * h)
		var s := float(e["s"]) * u
		_glow_at(c, p, Vector2(s, s) * 4.0, _with_a(col, 0.32 * tw))
		c.draw_circle(p, s * 0.55, _with_a(col.lightened(0.35), 0.85 * tw), true, -1.0, true)
