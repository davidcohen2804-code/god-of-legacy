class_name SealVisual
extends Node3D
## How Explosive Seal looks (GPT's v1.5 / v1.6 direction). It decides nothing: it only shows the combat state — the
## Seal's action, the marks in CombatController.marks and their fuses, the detonations:
##   - the application: through the Seal's last STREAK s of startup a thin crimson-violet streak runs from his open left
##     palm to the target's chest, arriving as the mark is planted (120 ms); a Seal that misses lets it fizzle where it
##     is — no glyph, no flash of success;
##   - the mark: an original seal glyph — two concentric rings and four short inward strokes, about 0.45 m across — over
##     the target's chest, facing the camera, additive; three pulses, quickening (PULSES: 0, 330 and 530 ms after it was
##     planted), then through the last CONTRACT s it contracts and brightens: the cue that it is about to burst. Its
##     contrast (GPT's v1.7): dim at rest (REST_ALPHA), each pulse's peak at full alpha and PEAK_HOT of the way to the hot
##     pale pink; in the last CONTRACT s it is at full hot and full alpha within FLARE s, held while it contracts;
##   - the detonation: a compact burst at the mark — a small core flash (at most half a metre, under 0.12 s), a
##     crimson-violet ring opening to about 1.3 m over 0.3 s, a few sparks — the target stays visible through it; a mark
##     whose target falls before its detonation fades out unexploded.
## Unshaded and additive, small pools; nothing covers the screen.

const PULSES := [0.0, 0.33, 0.53] ## s after the mark was planted (GPT's v1.6)
const PULSE := 0.12 ## each pulse's swell, s
const CONTRACT := 0.12 ## the last s before the detonation: it contracts and brightens
const STREAK := 0.08 ## the streak's flight, s, ending when the mark is planted
const COLOR := Color(0.86, 0.16, 0.52)
const HOT := Color(1.0, 0.55, 0.85) ## a pale hot pink — never white: the mark keeps its colour (GPT's v1.7)
const REST_ALPHA := 0.5 ## between the pulses (GPT's v1.7)
const PEAK_HOT := 0.85 ## a pulse's peak: this much of the way to HOT, at full alpha
const FLARE := 0.04 ## s into the last CONTRACT s by which it is at full hot and full alpha
const SHRINK := 0.55 ## its size at the detonation
const CHEST := 0.68 ## the glyph's height, as a fraction of the target's hurt height
const CORE_LIFE := 0.12
const RING_LIFE := 0.3
const RING_TO := 1.3 ## m, the ring's radius at its widest
const SPARKS := 10
const SPARK_LIFE := 0.3

var combat: CombatController
var fighter: Fighter
## Detonations shown so far (for the tests and the report).
var bursts := 0

var _glyph_mesh: Mesh
var _glyphs := {} ## target id → {node: MeshInstance3D, mat, target, born: s shown, fade: s left fading (-1: not)}
var _streak: MeshInstance3D
var _streak_mat: StandardMaterial3D
var _streak_to := Vector3.ZERO
var _streak_k := -1.0 ## how far it has flown (0..1; -1: none)
var _fizzle := -1.0 ## s left of a missed Seal's streak fading
var _core: MeshInstance3D
var _core_mat: StandardMaterial3D
var _core_age := 10.0
var _ring: MeshInstance3D
var _ring_mat: StandardMaterial3D
var _ring_age := 10.0
var _sparks: Array[MeshInstance3D] = []
var _spark_vel: Array[Vector3] = []
var _spark_mat: StandardMaterial3D
var _spark_age := 10.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 11
	_glyph_mesh = _make_glyph()
	_streak_mat = _additive(Color(COLOR, 0.0))
	var bar := BoxMesh.new()
	bar.size = Vector3(0.035, 0.035, 1.0)
	_streak = _instance(bar, _streak_mat)
	var sphere := SphereMesh.new()
	sphere.radius = 0.5
	sphere.height = 1.0
	sphere.radial_segments = 14
	sphere.rings = 7
	_core_mat = _additive(Color(HOT, 0.0))
	_core = _instance(sphere, _core_mat)
	_ring_mat = _additive(Color(COLOR, 0.0))
	_ring_mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	_ring_mat.billboard_keep_scale = true
	_ring = _instance(_ring_band(0.9, 1.0, 40), _ring_mat)
	var shard := PrismMesh.new()
	shard.size = Vector3(0.05, 0.16, 0.02)
	_spark_mat = _additive(Color(HOT, 0.0))
	for i in SPARKS:
		_sparks.append(_instance(shard, _spark_mat))
		_spark_vel.append(Vector3.ZERO)
	if combat:
		combat.seal_planted.connect(_on_planted)
		combat.seal_missed.connect(func(_t: Node3D, _why: String) -> void: _on_missed())
		combat.seal_detonated.connect(func(t: Node3D, _d: int) -> void: _on_detonated(t))


func _process(delta: float) -> void:
	if combat == null or fighter == null:
		return
	_update_streak(delta)
	_update_glyphs(delta)
	_age_burst(delta)


## The streak: it leaves his palm STREAK s before the Seal's planting moment and reaches the target's chest as the mark
## is planted; a miss lets it fade where it got to.
func _update_streak(delta: float) -> void:
	if _fizzle >= 0.0:
		_fizzle -= delta
		_streak_mat.albedo_color = Color(COLOR, 0.7 * clampf(_fizzle / 0.08, 0.0, 1.0))
		if _fizzle < 0.0:
			_streak.visible = false
			_streak_k = -1.0
		return
	var a := combat.melee.current()
	var t := combat.current_target()
	if a == null or a.kind != "seal" or t == null or combat.melee.phase != MeleeState.Phase.STARTUP:
		if _streak_k >= 0.0:
			_fizzle = 0.08 # (the startup ended with no mark planted — struck first: it fades where it got to)
		return
	var lead := a.startup - combat.melee.t
	if lead > STREAK:
		return
	_streak_k = clampf(1.0 - lead / STREAK, 0.0, 1.0)
	_streak_to = _glyph_point(t)
	_lay_streak(_palm(), _streak_to, _streak_k, 0.85)


func _on_planted(target: Node3D, _fuse: float) -> void:
	_streak_k = -1.0
	_streak.visible = false
	var id := target.get_instance_id()
	if _glyphs.has(id):
		(_glyphs[id]["node"] as Node).queue_free()
	var mat := _additive(Color(COLOR, 0.0))
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.billboard_keep_scale = true
	mat.no_depth_test = true # (a mark on the target: it reads in front of the arm or the sword that crosses it)
	mat.render_priority = 2
	var g := _instance(_glyph_mesh, mat)
	g.visible = true
	_glyphs[id] = {"node": g, "mat": mat, "target": target, "born": 0.0, "fade": -1.0}
	_place_glyph(_glyphs[id])


func _on_missed() -> void:
	if _streak_k >= 0.0:
		_fizzle = 0.08


## Each mark's glyph: where its target's chest is, toward the camera; its pulses and its last contraction from the fuse
## the combat logic keeps; gone with its detonation, fading when its mark ended otherwise.
func _update_glyphs(delta: float) -> void:
	for id in _glyphs.keys():
		var g: Dictionary = _glyphs[id]
		g["born"] = float(g["born"]) + delta
		var node := g["node"] as MeshInstance3D
		var mat := g["mat"] as StandardMaterial3D
		if not is_instance_valid(g["target"]):
			node.queue_free()
			_glyphs.erase(id)
			continue
		_place_glyph(g)
		if float(g["fade"]) < 0.0 and not combat.marks.has(id):
			g["fade"] = 0.15 # (its target fell first: the mark fades out unexploded)
		if float(g["fade"]) >= 0.0:
			g["fade"] = float(g["fade"]) - delta
			mat.albedo_color = Color(COLOR, 0.8 * clampf(float(g["fade"]) / 0.15, 0.0, 1.0))
			if float(g["fade"]) <= 0.0:
				node.queue_free()
				_glyphs.erase(id)
			continue
		var m: Dictionary = combat.marks[id]
		var fuse := float((m["action"] as AttackData).seal.get("fuse", 0.65))
		var left := float(m["left"])
		var e := fuse - left
		var look := glyph_look(e, left)
		node.scale = Vector3.ONE * lerpf(0.4, 1.0, clampf(float(g["born"]) / 0.08, 0.0, 1.0)) * look.x # (it opens as the streak lands)
		mat.albedo_color = Color(COLOR.lerp(HOT, look.y), look.z)


## The glyph `e` s after its mark was planted, `left` s before its detonation: (size factor, how far toward HOT, alpha).
static func glyph_look(e: float, left: float) -> Vector3:
	var glow := 0.0
	for p: float in PULSES:
		if e >= p and e < p + PULSE:
			glow = maxf(glow, sin((e - p) / PULSE * PI))
	var size := 1.0 + 0.28 * glow
	var hot := glow * PEAK_HOT
	var alpha := lerpf(REST_ALPHA, 1.0, glow)
	if left < CONTRACT:
		var c := 1.0 - clampf(left / CONTRACT, 0.0, 1.0)
		var flare := clampf((CONTRACT - left) / FLARE, 0.0, 1.0)
		size *= lerpf(1.0, SHRINK, c)
		hot = maxf(hot, flare)
		alpha = lerpf(alpha, 1.0, flare)
	return Vector3(size, hot, alpha)


func _on_detonated(target: Node3D) -> void:
	var at := _glyph_point(target)
	var id := target.get_instance_id()
	if _glyphs.has(id):
		at = (_glyphs[id]["node"] as Node3D).global_position
		(_glyphs[id]["node"] as Node).queue_free()
		_glyphs.erase(id)
	_core_age = 0.0
	_core.global_position = at
	_core.visible = true
	_ring_age = 0.0
	_ring.global_position = at
	_ring.visible = true
	_spark_age = 0.0
	for i in SPARKS:
		var yaw := TAU * float(i) / SPARKS + _rng.randf_range(-0.3, 0.3)
		var dir := Vector3(sin(yaw), _rng.randf_range(-0.5, 0.7), cos(yaw)).normalized()
		_sparks[i].global_position = at + dir * 0.12
		_sparks[i].rotation = Vector3(_rng.randf() * TAU, _rng.randf() * TAU, _rng.randf() * TAU)
		_spark_vel[i] = dir * _rng.randf_range(2.5, 4.5)
		_sparks[i].visible = true
	bursts += 1


func _age_burst(delta: float) -> void:
	if _core_age < CORE_LIFE:
		_core_age += delta
		var k := clampf(_core_age / CORE_LIFE, 0.0, 1.0)
		_core.visible = k < 1.0
		_core.scale = Vector3.ONE * lerpf(0.2, 0.5, 1.0 - (1.0 - k) * (1.0 - k))
		_core_mat.albedo_color = Color(COLOR.lerp(HOT, 0.6), 0.75 * (1.0 - k))
	if _ring_age < RING_LIFE:
		_ring_age += delta
		var k := clampf(_ring_age / RING_LIFE, 0.0, 1.0)
		_ring.visible = k < 1.0
		_ring.scale = Vector3.ONE * lerpf(0.25, RING_TO, 1.0 - pow(1.0 - k, 3.0))
		_ring_mat.albedo_color = Color(COLOR.lerp(HOT, 0.3 * (1.0 - k)), 0.85 * (1.0 - k))
	if _spark_age < SPARK_LIFE:
		_spark_age += delta
		var k := clampf(_spark_age / SPARK_LIFE, 0.0, 1.0)
		for i in SPARKS:
			_sparks[i].visible = k < 1.0
			_sparks[i].global_position += _spark_vel[i] * delta
			_spark_vel[i] *= 1.0 - 3.5 * delta
		_spark_mat.albedo_color = Color(HOT, 0.9 * (1.0 - k))


## Over the target's chest, a little toward the camera (in front of its body as the player sees it).
func _glyph_point(t: Node3D) -> Vector3:
	var h: Variant = t.get("hurt_height")
	var r: Variant = t.get("hurt_radius")
	var at := t.global_position + Vector3(0, (float(h) if h != null else 1.8) * CHEST, 0)
	var cam := get_viewport().get_camera_3d() if is_inside_tree() else null
	if cam:
		var to := cam.global_position - at
		to.y = 0.0
		if to.length() > 0.01:
			at += to.normalized() * ((float(r) if r != null else 0.3) + 0.06)
	return at


func _place_glyph(g: Dictionary) -> void:
	(g["node"] as Node3D).global_position = _glyph_point(g["target"] as Node3D)


## His open left palm (the Seal's gesture), else his chest.
func _palm() -> Vector3:
	var v := fighter.visual
	if v.skeleton:
		var i := v.skeleton.find_bone("hand_l")
		if i >= 0:
			return (v.skeleton.global_transform * v.skeleton.get_bone_global_pose(i)).origin
	return fighter.global_position + Vector3(0, 1.2, 0)


## The streak from `from` toward `to`, `k` (0..1) of the way.
func _lay_streak(from: Vector3, to: Vector3, k: float, alpha: float) -> void:
	var d := to - from
	if d.length() < 0.05 or k <= 0.0:
		_streak.visible = false
		return
	var head := from + d * k
	var tail := from.lerp(head, maxf(0.0, k - 0.55) / maxf(k, 0.0001)) # (a short bolt, not a beam)
	var mid := (head + tail) * 0.5
	var len := tail.distance_to(head)
	_streak.visible = true
	_streak.global_transform = Transform3D(Basis.looking_at(d.normalized(), Vector3.UP), mid)
	_streak.scale = Vector3(1.0, 1.0, maxf(len, 0.05))
	_streak_mat.albedo_color = Color(COLOR.lerp(HOT, 0.4), alpha)


## The glyph: two concentric rings and four short inward strokes between them, flat in the view plane (unit: m).
func _make_glyph() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_band(st, 0.200, 0.226, 48)
	_band(st, 0.124, 0.141, 40)
	for i in 4:
		var a := PI * 0.25 + PI * 0.5 * i
		var dir := Vector3(cos(a), sin(a), 0.0)
		var side := Vector3(-sin(a), cos(a), 0.0) * 0.011
		var p0 := dir * 0.148
		var p1 := dir * 0.194
		for v: Vector3 in [p0 - side, p1 - side, p1 + side, p0 - side, p1 + side, p0 + side]:
			st.set_normal(Vector3.BACK)
			st.add_vertex(v)
	return st.commit()


func _band(st: SurfaceTool, r0: float, r1: float, n: int) -> void:
	for i in n:
		var a0 := TAU * i / n
		var a1 := TAU * (i + 1) / n
		var d0 := Vector3(cos(a0), sin(a0), 0.0)
		var d1 := Vector3(cos(a1), sin(a1), 0.0)
		for v: Vector3 in [d0 * r0, d0 * r1, d1 * r1, d0 * r0, d1 * r1, d1 * r0]:
			st.set_normal(Vector3.BACK)
			st.add_vertex(v)


func _ring_band(r0: float, r1: float, n: int) -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_band(st, r0, r1, n)
	return st.commit()


func _additive(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.albedo_color = c
	return m


func _instance(mesh: Mesh, mat: Material) -> MeshInstance3D:
	var p := MeshInstance3D.new()
	p.mesh = mesh
	p.material_override = mat
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.visible = false
	add_child(p)
	return p
