class_name AutomatonVisual
extends CharacterVisual
## The Training Automaton's look (GPT's v1.2 decision): a humanoid sparring construct of dark lacquered wood, stone
## and bronze fittings — visually distinct from the Samurai, with an unmistakable face and torso. The body is
## Quaternius' Universal Base Character (CC0) on the standard rig with the same moves (tools/build_automaton.mjs);
## everything else is dressed here from primitives: a bronze face mask with glowing eye slits and a stone crown,
## bronze rings at the readable joints, a bronze breastplate with a stone core, a stone girdle, and a wooden practice
## sword in the right hand. Each piece rides its bone (BoneAttachment3D), placed from the body's own measurements
## (fit.json: per bone, the box of the vertices it moves, at rest), so nothing is placed by guesswork.

const ADIR := "res://assets/characters/automaton/"

var wood_material: StandardMaterial3D
var bronze_material: StandardMaterial3D
var stone_material: StandardMaterial3D
var eye_material: StandardMaterial3D
var _fit := {}
var _skel_from_model := Transform3D.IDENTITY


static func build_new() -> AutomatonVisual:
	var v := AutomatonVisual.new()
	v._build()
	return v


func _build() -> void:
	_load(ADIR + "automaton.glb")
	_dress()


func _dress() -> void:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(ADIR + "fit.json"))
	_fit = (data as Dictionary).get("bones", {}) if typeof(data) == TYPE_DICTIONARY else {}
	wood_material = StandardMaterial3D.new()
	wood_material.albedo_texture = TexLoader.load_webp(ADIR + "wood_albedo.webp.bin")
	wood_material.uv1_scale = Vector3(3, 3, 1)
	wood_material.roughness = 0.34 # lacquer
	wood_material.metallic_specular = 0.7
	wood_material.rim_enabled = true
	wood_material.rim = 0.28
	wood_material.rim_tint = 0.35
	body_material = wood_material
	for m in meshes:
		m.material_override = wood_material
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	bronze_material = StandardMaterial3D.new()
	bronze_material.albedo_color = Color("#9a7442")
	bronze_material.metallic = 0.85
	bronze_material.roughness = 0.38
	stone_material = StandardMaterial3D.new()
	stone_material.albedo_color = Color("#5a5466")
	stone_material.roughness = 0.88
	eye_material = StandardMaterial3D.new()
	eye_material.albedo_color = Color("#2a1a10")
	eye_material.emission_enabled = true
	eye_material.emission = Color("#e2a85a")
	eye_material.emission_energy_multiplier = 1.4
	for m: StandardMaterial3D in [wood_material, bronze_material, stone_material]:
		m.emission_enabled = true
		m.emission = Color("#d9ccff")
		m.emission_energy_multiplier = 0.0
	if skeleton == null:
		return
	_skel_from_model = _relative(skeleton).affine_inverse()
	_face()
	_torso()
	_joints()
	_practice_sword()


## The face: an oval bronze mask over the front of the head, two glowing eye slits, a brow ridge, a slotted mouth
## grille, and a stone crown over the skull.
func _face() -> void:
	var b := _box("Head")
	if b.is_empty():
		return
	var lo: Vector3 = b[0]
	var hi: Vector3 = b[1]
	var c := (lo + hi) * 0.5
	var h := hi.y - lo.y
	var w := hi.x - lo.x
	var front := hi.z
	var mask_c := Vector3(0.0, c.y - h * 0.04, front - h * 0.22)
	_piece("Head", _ellipsoid(), bronze_material, mask_c, Vector3(w * 0.5, h * 0.46, h * 0.26))
	for side: float in [-1.0, 1.0]:
		_piece("Head", _cube(), eye_material, Vector3(side * w * 0.2, c.y + h * 0.07, front + 0.012),
			Vector3(w * 0.22, h * 0.04, 0.012))
	_piece("Head", _cube(), stone_material, Vector3(0.0, c.y + h * 0.17, front + 0.004), Vector3(w * 0.86, h * 0.07, 0.03))
	for i in 3:
		_piece("Head", _cube(), stone_material, Vector3(0.0, c.y - h * (0.16 + 0.05 * i), front + 0.01),
			Vector3(w * 0.32, h * 0.025, 0.012))
	var crown := SphereMesh.new()
	crown.is_hemisphere = true
	crown.radius = 1.0
	crown.height = 1.0
	_piece("Head", crown, stone_material, Vector3(0.0, c.y + h * 0.2, (lo.z + hi.z) * 0.5 - 0.005),
		Vector3(w * 0.56, h * 0.42, (hi.z - lo.z) * 0.56))


## The torso: a bronze breastplate with a stone core disc, and a stone girdle at the waist.
func _torso() -> void:
	var b := _box("spine_03")
	if not b.is_empty():
		var lo: Vector3 = b[0]
		var hi: Vector3 = b[1]
		var plate_c := Vector3(0.0, lerpf(lo.y, hi.y, 0.48), hi.z + 0.012)
		_piece("spine_03", _cube(), bronze_material, plate_c, Vector3((hi.x - lo.x) * 0.72, (hi.y - lo.y) * 0.7, 0.035))
		var core := CylinderMesh.new()
		core.top_radius = 1.0
		core.bottom_radius = 1.0
		core.height = 1.0
		_piece("spine_03", core, stone_material, plate_c + Vector3(0, 0.01, 0.022), Vector3(0.05, 0.02, 0.05),
			Basis(Vector3.RIGHT, PI * 0.5))
		_piece("spine_03", _cube(), eye_material, plate_c + Vector3(0, 0.01, 0.034), Vector3(0.022, 0.022, 0.004))
	var p := _box("pelvis")
	if not p.is_empty():
		var plo: Vector3 = p[0]
		var phi: Vector3 = p[1]
		_piece("pelvis", _cube(), stone_material, Vector3(0.0, lerpf(plo.y, phi.y, 0.62), phi.z + 0.01),
			Vector3((phi.x - plo.x) * 0.8, (phi.y - plo.y) * 0.32, 0.04))


## Bronze rings at the joints that read in a fight: shoulders, elbows, wrists, knees, ankles and the neck.
func _joints() -> void:
	var rings := {"upperarm_l": 0.085, "upperarm_r": 0.085, "lowerarm_l": 0.068, "lowerarm_r": 0.068,
		"hand_l": 0.05, "hand_r": 0.05, "calf_l": 0.078, "calf_r": 0.078, "foot_l": 0.06, "foot_r": 0.06,
		"neck_01": 0.07}
	for bone in rings:
		var i := skeleton.find_bone(bone)
		if i < 0:
			continue
		var r: float = rings[bone]
		var torus := TorusMesh.new()
		torus.inner_radius = r - 0.016
		torus.outer_radius = r
		torus.rings = 24
		torus.ring_segments = 8
		var att := _attach(bone)
		var dir := _bone_dir(i)
		var t := Transform3D(Basis(Quaternion(Vector3.UP, dir)), Vector3.ZERO)
		_add(att, torus, bronze_material, t)


## A wooden practice sword (a bokken) in the right hand: a dark wooden blade, a bronze guard and a wrapped grip,
## along the grip's +Y like the Samurai's katana.
func _practice_sword() -> void:
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(ADIR + "grip.json"))
	if typeof(data) != TYPE_DICTIONARY:
		return
	var g: Dictionary = data
	var b: Dictionary = g["basis"]
	var grip := Transform3D(Basis(_v(b["x"]), _v(b["y"]), _v(b["z"])), _v(g["position"]))
	var hand := _attach("hand_r")
	katana = Node3D.new()
	katana.name = "PracticeSword"
	katana.transform = grip
	hand.add_child(katana)
	var blade := CylinderMesh.new()
	blade.top_radius = 0.011
	blade.bottom_radius = 0.017
	blade.height = 0.7
	_add(katana, blade, wood_material, Transform3D(Basis(), Vector3(0, 0.43, 0)))
	var guard := CylinderMesh.new()
	guard.top_radius = 0.034
	guard.bottom_radius = 0.034
	guard.height = 0.012
	_add(katana, guard, bronze_material, Transform3D(Basis(), Vector3(0, 0.075, 0)))
	var wrap := CylinderMesh.new()
	wrap.top_radius = 0.016
	wrap.bottom_radius = 0.016
	wrap.height = 0.22
	_add(katana, wrap, stone_material, Transform3D(Basis(), Vector3(0, -0.04, 0)))


## The hit flash (0..1): a short pale-violet lift over the wood, bronze and stone (the eyes keep their own glow).
func set_flash(k: float) -> void:
	for m: StandardMaterial3D in [wood_material, bronze_material, stone_material]:
		if m:
			m.emission_energy_multiplier = 0.55 * k


## The rest pose's box of the vertices `bone` mostly moves: [min, max] in model space, or [] when unknown.
func _box(bone: String) -> Array:
	if not _fit.has(bone):
		return []
	var d: Dictionary = _fit[bone]
	return [_v(d["min"]), _v(d["max"])]


## A piece on `bone`: `mesh` scaled by `size` (a unit cube / sphere / cylinder made that big) at `at` in model space
## (at rest), turned by `turn`.
func _piece(bone: String, mesh: Mesh, mat: Material, at: Vector3, size: Vector3, turn: Basis = Basis()) -> void:
	var i := skeleton.find_bone(bone)
	if i < 0:
		return
	var model := Transform3D(turn.scaled_local(size), at)
	var local := skeleton.get_bone_global_rest(i).affine_inverse() * _skel_from_model * model
	_add(_attach(bone), mesh, mat, local)


func _add(parent: Node3D, mesh: Mesh, mat: Material, t: Transform3D) -> void:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.transform = t
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(m)


func _attach(bone: String) -> BoneAttachment3D:
	var node_name := "Fit_" + bone
	var existing := skeleton.get_node_or_null(node_name)
	if existing:
		return existing as BoneAttachment3D
	var a := BoneAttachment3D.new()
	a.name = node_name
	a.bone_name = bone
	skeleton.add_child(a)
	return a


## The direction from a bone to its first child at rest, in the bone's own space (the way a ring around it faces).
func _bone_dir(i: int) -> Vector3:
	for c in skeleton.get_bone_children(i):
		var o := skeleton.get_bone_rest(c).origin
		if o.length() > 0.001:
			return o.normalized()
	return Vector3.UP


## `node`'s transform relative to this visual (the product of the transforms between them).
func _relative(node: Node) -> Transform3D:
	var t := Transform3D.IDENTITY
	var n := node
	while n != null and n != self:
		if n is Node3D:
			t = (n as Node3D).transform * t
		n = n.get_parent()
	return t


static func _v(a: Variant) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


static func _cube() -> BoxMesh:
	var b := BoxMesh.new()
	b.size = Vector3.ONE
	return b


static func _ellipsoid() -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = 1.0
	s.height = 2.0
	s.radial_segments = 24
	s.rings = 12
	return s
