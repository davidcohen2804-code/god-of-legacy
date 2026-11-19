class_name TelegraphArc
extends Node3D
## The Training Automaton's warning on the flagstones (GPT's v1.3 direction: the telegraph is the weapon's posture plus
## a restrained amber warning, so the cut can be dodged without knowing an invisible hitbox): a thin amber arc at the
## reach of its cut — the practice sword's baked path out to its tip, the step into the cut included — across the
## width the cut sweeps, over a faint fill, laid where the automaton stood when the attack began and turned with it
## until its direction locks. It kindles through the windup, brightens as the cut passes, and fades with the
## follow-through. It only shows what the attack does (the hit test is the blade's own path, not this shape); additive
## and unshaded, no light of its own (light on a phone's GPU).

const BAND := 0.07 ## the arc's line, m wide
const INNER := 0.45 ## the fill starts this far out (m): the automaton's own feet stay clear
const SEGMENTS := 40

var radius := 1.9 ## m from where it stood: the cut's reach plus its step
var yaw_from := -75.0 ## degrees from its facing (+ = its left), the width the cut sweeps
var yaw_to := 75.0
var _band: MeshInstance3D
var _fill: MeshInstance3D
var _band_mat: StandardMaterial3D
var _fill_mat: StandardMaterial3D


## The arc of attack `a`: its reach and the width of its sweep from the baked blade (the yaws the tip passes through
## where it is out from the body, beyond 0.9 m).
static func for_attack(a: AttackData) -> TelegraphArc:
	var t := TelegraphArc.new()
	t.name = "TelegraphArc"
	var lo := INF
	var hi := -INF
	var reach := 0.0
	for p: Vector3 in a.blade_tip:
		var r := Vector2(p.x, p.z).length()
		reach = maxf(reach, r)
		if r > 0.9:
			var y := rad_to_deg(atan2(p.x, p.z))
			lo = minf(lo, y)
			hi = maxf(hi, y)
	if lo < hi:
		t.yaw_from = lo
		t.yaw_to = hi
	if reach > 0.0:
		t.radius = reach + a.lunge
	return t


func _ready() -> void:
	top_level = true
	_band_mat = _material()
	_fill_mat = _material()
	_band = _mesh(radius - BAND, radius, _band_mat)
	_fill = _mesh(INNER, radius - BAND, _fill_mat)
	visible = false


## Show it laid at `at` facing `facing` (radians) at strength `k` (0..1; hidden at 0), brighter through the cut.
func show_at(at: Vector3, facing: float, k: float, cutting: bool) -> void:
	if k <= 0.001:
		visible = false
		return
	visible = true
	global_transform = Transform3D(Basis(Vector3.UP, facing), at + Vector3(0, 0.025, 0))
	_band_mat.albedo_color = Color(1.0, 0.6, 0.2, 0.8 if cutting else 0.5 * k)
	_fill_mat.albedo_color = Color(1.0, 0.52, 0.14, 0.14 if cutting else 0.08 * k)


func _material() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.albedo_color = Color(1.0, 0.6, 0.2, 0.0)
	return m


## A flat band of the ring between `r0` and `r1` (m) across the sweep's width, in its frame (+Z its facing, +X its left).
func _mesh(r0: float, r1: float, mat: Material) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in SEGMENTS:
		var a0 := deg_to_rad(lerpf(yaw_from, yaw_to, float(i) / SEGMENTS))
		var a1 := deg_to_rad(lerpf(yaw_from, yaw_to, float(i + 1) / SEGMENTS))
		var d0 := Vector3(sin(a0), 0.0, cos(a0))
		var d1 := Vector3(sin(a1), 0.0, cos(a1))
		for v: Vector3 in [d0 * r0, d0 * r1, d1 * r1, d0 * r0, d1 * r1, d1 * r0]:
			st.set_normal(Vector3.UP)
			st.add_vertex(v)
	var m := MeshInstance3D.new()
	m.mesh = st.commit()
	m.material_override = mat
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)
	return m
