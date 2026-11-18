class_name BladeTrail
extends MeshInstance3D
## The katana's swing as a short, fading ribbon of moonlight between the blade's middle and its tip, drawn while the
## combat controller says the strike is cutting (`emitting`). It only shows the swing — the hit itself is decided by
## the state machine and the sweep test, never by this. Through hit-stop (`frozen`) it holds still with the blade.
## The blade's samples are taken once a frame and joined by Catmull-Rom curves, so the ribbon stays round even at a
## low frame rate. Built in world space (keep it under a node at the origin).

const LIFE := 0.12 ## seconds a sample of the blade stays in the ribbon
const BASE := 0.3 ## along the katana (its local +Y), m: the ribbon's inner edge…
const TIP := 0.8 ## …and its outer edge (the blade runs from 0.08 to 0.79)
const SUBDIV := 4

var blade: Node3D
var emitting := false
var frozen := false
var colour := Color(0.82, 0.78, 1.0)

var _samples: Array = [] ## [inner: Vector3, outer: Vector3, age: float]
var _im := ImmediateMesh.new()


func _ready() -> void:
	mesh = _im
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.vertex_color_use_as_albedo = true
	material_override = m


func _process(delta: float) -> void:
	if not frozen:
		for s in _samples:
			s[2] += delta
		while not _samples.is_empty() and float(_samples[0][2]) > LIFE:
			_samples.pop_front()
		if emitting and blade and is_instance_valid(blade) and blade.is_inside_tree():
			var t := blade.global_transform
			_samples.append([t * Vector3(0, BASE, 0), t * Vector3(0, TIP, 0), 0.0])
	_rebuild()


func _rebuild() -> void:
	_im.clear_surfaces()
	var n := _samples.size()
	if n < 2:
		return
	_im.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for i in n - 1:
		for k in SUBDIV:
			var f := float(k) / SUBDIV
			var age := lerpf(float(_samples[i][2]), float(_samples[i + 1][2]), f)
			var a := clampf(1.0 - age / LIFE, 0.0, 1.0)
			_vertex(_curve(i, f, 0), Color(colour, 0.08 * a))
			_vertex(_curve(i, f, 1), Color(colour, 0.75 * a * a))
	var last: Array = _samples[n - 1]
	var a_last := clampf(1.0 - float(last[2]) / LIFE, 0.0, 1.0)
	_vertex(last[0], Color(colour, 0.08 * a_last))
	_vertex(last[1], Color(colour, 0.75 * a_last * a_last))
	_im.surface_end()


func _vertex(p: Vector3, c: Color) -> void:
	_im.surface_set_color(c)
	_im.surface_add_vertex(p)


## A point on the edge `e` (0 inner, 1 outer) between samples i and i+1 at fraction f (Catmull-Rom).
func _curve(i: int, f: float, e: int) -> Vector3:
	var n := _samples.size()
	var p0: Vector3 = _samples[maxi(i - 1, 0)][e]
	var p1: Vector3 = _samples[i][e]
	var p2: Vector3 = _samples[i + 1][e]
	var p3: Vector3 = _samples[mini(i + 2, n - 1)][e]
	return p1.cubic_interpolate(p2, p0, p3, f)
