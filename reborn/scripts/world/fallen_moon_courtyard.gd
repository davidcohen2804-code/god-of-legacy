class_name FallenMoonCourtyard
extends RefCounted
## The Fallen Moon Courtyard (GPT's M2 spec, first visual pass): a 28 × 28 m ruined courtyard at blue-violet
## twilight. Its middle 18 m stays clear for the fight (a dark inlaid ring marks it); around it eight columns — standing,
## broken and one fallen — a damaged arch in the north wall with the great moon above it, three braziers for warm
## accents, ruined walls, rubble; cracked flagstones with a little moss. One shadow-casting light (the moon), no
## volumetrics or heavy post-processing. Built from primitives and three small textures (tools/make_textures.py) to
## stay light on a phone's GPU. Collision layers: 1 the floor, the columns and the braziers; 8 the closed square of
## walls round the courtyard (bodies only — the camera looks over them); 16 what the camera keeps in front of (the
## columns).
## North is −Z; the player starts south of the centre looking north, toward the arch and the moon.

const HALF := 14.0 ## half the courtyard's side
const CLEAR_R := 9.0 ## the open middle's radius
const COLUMN_R := 11.6
const ENV := "res://assets/env/"

## The braziers' lights, for their flicker.
static var flames: Array[OmniLight3D] = []
## The moon (its shadows follow the graphics preset).
static var moon: DirectionalLight3D


static func build(root: Node3D) -> void:
	flames.clear()
	var stone := TexLoader.material(ENV + "wall_blocks.webp.bin", Vector2(0.6, 0.6), Color(0.74, 0.73, 0.78), 0.95, true)
	var dark := TexLoader.material(ENV + "wall_blocks.webp.bin", Vector2(0.6, 0.6), Color(0.46, 0.45, 0.52), 0.95, true)
	_environment(root)
	_ground(root, dark)
	_walls(root, stone, dark)
	_arch(root, stone, dark)
	_columns(root, stone, dark)
	_braziers(root, dark)
	_rubble(root, dark)


static func _environment(root: Node3D) -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var mat := ProceduralSkyMaterial.new()
	mat.sky_top_color = Color("#141130")
	mat.sky_horizon_color = Color("#43386a")
	mat.sky_curve = 0.1
	mat.ground_horizon_color = Color("#2a2442")
	mat.ground_bottom_color = Color("#0c0a14")
	mat.sun_angle_max = 16.0
	mat.sun_curve = 0.06
	sky.sky_material = mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#4d5174")
	env.ambient_light_energy = 0.62
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.fog_enabled = true
	env.fog_light_color = Color("#2b2646")
	env.fog_density = 0.02
	env.fog_sky_affect = 0.0
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)

	# The moon: the one shadow-casting light, cool blue-violet, low in the north-north-east; its disk in the sky is
	# the light's own (angular size), above the arch from the starting view.
	var moon := DirectionalLight3D.new()
	moon.name = "Moon"
	moon.rotation_degrees = Vector3(-36, 160, 0)
	moon.light_color = Color("#c3c4f0")
	moon.light_energy = 1.15
	moon.light_angular_distance = 3.2
	moon.shadow_enabled = true
	moon.shadow_opacity = 0.72 # (M3: the ruins' long shadows softened, so they do not compete with the fight)
	moon.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	moon.directional_shadow_max_distance = 34.0
	root.add_child(moon)
	FallenMoonCourtyard.moon = moon


## The preset's shadows on the moon (GPT's v1.7): none on Low, one split on Medium, two on High.
static func apply_quality(q: Dictionary) -> void:
	if not is_instance_valid(moon):
		return
	var splits := int(q.get("splits", 2))
	moon.shadow_enabled = splits > 0
	moon.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL if splits == 1 \
		else DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS


static func _ground(root: Node3D, dark: Material) -> void:
	var floor_mat := TexLoader.material(ENV + "flagstones.webp.bin", Vector2(7, 7), Color(0.76, 0.76, 0.8), 0.92)
	_mesh(root, _plane(Vector2(HALF * 2.0, HALF * 2.0)), floor_mat, Vector3.ZERO)
	var earth := TexLoader.material(ENV + "earth.webp.bin", Vector2(30, 30), Color(0.2, 0.19, 0.25))
	_mesh(root, _plane(Vector2(160, 160)), earth, Vector3(0, -0.02, 0))
	# The open middle's edge: a band of darker stone inlaid flush with the floor.
	var r := _mesh(root, _annulus(CLEAR_R - 0.18, CLEAR_R + 0.18, 96), dark, Vector3(0, 0.006, 0))
	r.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var body := StaticBody3D.new()
	body.collision_layer = 1
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(200, 1, 200)
	shape.shape = box
	shape.position = Vector3(0, -0.5, 0)
	body.add_child(shape)
	root.add_child(body)


## Ruined walls along the square's edges (a gap in the north for the arch), closed all round for collision.
static func _walls(root: Node3D, stone: Material, dark: Material) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2811
	for side in 4:
		var dir := [Vector3(1, 0, 0), Vector3(0, 0, 1), Vector3(-1, 0, 0), Vector3(0, 0, -1)][side] as Vector3
		var normal := Vector3(-dir.z, 0, dir.x) # points out of the courtyard
		var yaw := atan2(dir.x, dir.z) - PI * 0.5
		var seg := 2.8
		var n := int(HALF * 2.0 / seg)
		for i in n:
			var along := -HALF + seg * (float(i) + 0.5)
			var pos := dir * along + normal * (HALF + 0.45)
			if side == 2 and absf(along) < 3.6:
				continue # the arch's opening (north)
			var h := rng.randf_range(0.6, 2.8)
			if i % 4 == 2:
				h = rng.randf_range(0.25, 0.55)
			var m := _mesh(root, _box(Vector3(seg * 0.97, h, 0.9)), stone if h > 1.0 else dark, pos + Vector3(0, h * 0.5, 0))
			m.rotation.y = yaw
			if h > 2.0 and rng.randf() < 0.5:
				var cap := _mesh(root, _box(Vector3(seg * 0.6, 0.3, 1.05)), dark, pos + Vector3(0, h + 0.15, 0))
				cap.rotation.y = yaw + rng.randf_range(-0.06, 0.06)
		_collider(root, Vector3(HALF * 2.0 + 2.0, 4.0, 1.0), normal * (HALF + 0.5) + Vector3(0, 2.0, 0), yaw, 8)


## The damaged arch in the north wall: two piers, a ring of voussoirs with its keystone and a neighbour fallen.
static func _arch(root: Node3D, stone: Material, dark: Material) -> void:
	var z := -HALF - 0.45
	for x: float in [-2.9, 2.9]:
		_mesh(root, _box(Vector3(1.3, 5.2, 1.3)), stone, Vector3(x, 2.6, z))
		_mesh(root, _box(Vector3(1.6, 0.35, 1.6)), dark, Vector3(x, 5.35, z))
		_mesh(root, _box(Vector3(1.6, 0.4, 1.6)), dark, Vector3(x, 0.2, z))
	var centre := Vector3(0, 5.5, z)
	var r := 2.9
	var n := 11
	for i in n:
		if i == 5 or i == 6:
			continue # the broken top
		var a := PI * (float(i) + 0.5) / float(n)
		var p := centre + Vector3(cos(a) * r, sin(a) * r, 0)
		var v := _mesh(root, _box(Vector3(0.8, 0.95, 1.2)), stone, p)
		v.rotation.z = a - PI * 0.5
	# The fallen keystone and its neighbour on the ground inside the arch.
	var k1 := _mesh(root, _box(Vector3(0.55, 0.95, 1.2)), dark, Vector3(0.4, 0.3, z + 1.6))
	k1.rotation = Vector3(0.3, 0.8, 1.35)
	var k2 := _mesh(root, _box(Vector3(0.5, 0.9, 1.1)), dark, Vector3(-0.9, 0.26, z + 2.3))
	k2.rotation = Vector3(-0.2, 2.2, 1.5)


## Eight columns on a ring round the open middle: standing (with capitals), broken off, and one fallen.
static func _columns(root: Node3D, stone: Material, dark: Material) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 909
	for i in 8:
		var a := TAU * (float(i) + 0.5) / 8.0
		var pos := Vector3(cos(a) * COLUMN_R, 0.0, sin(a) * COLUMN_R)
		_mesh(root, _cyl(0.62, 0.62, 0.4), dark, pos + Vector3(0, 0.2, 0))
		if i == 2:
			# fallen: its stump left standing, the shaft lying along the ring (outside the open middle)
			_mesh(root, _cyl(0.42, 0.45, 0.9), stone, pos + Vector3(0, 0.85, 0))
			var tangent := Vector3(-sin(a), 0.0, cos(a))
			var drum := _mesh(root, _cyl(0.4, 0.4, 3.6), stone, pos + tangent * 2.4 + Vector3(0, 0.4, 0))
			drum.rotation = Vector3(PI * 0.5, atan2(tangent.x, tangent.z), 0.0)
			_collider_cyl(root, 0.5, 1.3, pos + Vector3(0, 0.65, 0))
			continue
		var broken := i % 3 != 0
		var h := rng.randf_range(1.8, 3.4) if broken else 5.0
		_mesh(root, _cyl(0.38, 0.45, h), stone, pos + Vector3(0, 0.4 + h * 0.5, 0))
		if broken:
			var chunk := _mesh(root, _cyl(0.3, 0.38, 0.5), stone, pos + Vector3(0.08, 0.4 + h + 0.12, 0.05))
			chunk.rotation = Vector3(rng.randf_range(-0.4, 0.4), 0.0, rng.randf_range(-0.5, 0.5))
		else:
			_mesh(root, _box(Vector3(1.15, 0.38, 1.15)), dark, pos + Vector3(0, 0.4 + h + 0.19, 0))
		_collider_cyl(root, 0.5, 0.4 + h, pos + Vector3(0, (0.4 + h) * 0.5, 0), 1 | 16)


## Three braziers: stone bowls with live flames — the warm accents (no shadows).
static func _braziers(root: Node3D, dark: Material) -> void:
	var fire := StandardMaterial3D.new()
	fire.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fire.albedo_color = Color(1.0, 0.7, 0.32)
	fire.emission_enabled = true
	fire.emission = Color(1.0, 0.55, 0.2)
	fire.emission_energy_multiplier = 2.0
	for pos: Vector3 in [Vector3(-5.0, 0, -11.9), Vector3(5.0, 0, -11.9), Vector3(-11.0, 0, 10.2)]:
		_mesh(root, _cyl(0.22, 0.32, 1.0), dark, pos + Vector3(0, 0.5, 0))
		_mesh(root, _cyl(0.55, 0.3, 0.32), dark, pos + Vector3(0, 1.16, 0))
		var flame := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.2
		cone.height = 0.55
		cone.radial_segments = 10
		flame.mesh = cone
		flame.material_override = fire
		flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		flame.position = pos + Vector3(0, 1.5, 0)
		root.add_child(flame)
		var light := OmniLight3D.new()
		light.position = pos + Vector3(0, 1.9, 0)
		light.light_color = Color("#ff8a42")
		light.light_energy = 1.4
		light.omni_range = 7.5
		light.omni_attenuation = 1.4
		root.add_child(light)
		flames.append(light)
		_collider_cyl(root, 0.45, 1.3, pos + Vector3(0, 0.65, 0))


## A little rubble by the walls and columns — kept out of the open middle.
static func _rubble(root: Node3D, dark: Material) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 5150
	for i in 26:
		var a := rng.randf() * TAU
		var d := rng.randf_range(CLEAR_R + 1.2, HALF - 0.6)
		var p := Vector3(cos(a) * d, 0.0, sin(a) * d)
		p.x = clampf(p.x, -HALF + 0.5, HALF - 0.5)
		p.z = clampf(p.z, -HALF + 0.5, HALF - 0.5)
		var s := rng.randf_range(0.18, 0.5)
		var m := _mesh(root, _box(Vector3(s * 1.4, s * 0.8, s)), dark, p + Vector3(0, s * 0.35, 0))
		m.rotation = Vector3(rng.randf_range(-0.4, 0.4), rng.randf() * TAU, rng.randf_range(-0.4, 0.4))
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


static func _mesh(root: Node3D, mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.position = pos
	root.add_child(m)
	return m


## A flat ring on the ground (normals up), `n` segments.
static func _annulus(r0: float, r1: float, n: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	for i in n:
		var a0 := TAU * float(i) / float(n)
		var a1 := TAU * float(i + 1) / float(n)
		var p := [Vector3(cos(a0) * r0, 0, sin(a0) * r0), Vector3(cos(a0) * r1, 0, sin(a0) * r1),
			Vector3(cos(a1) * r1, 0, sin(a1) * r1), Vector3(cos(a1) * r0, 0, sin(a1) * r0)]
		for k: int in [0, 1, 2, 0, 2, 3]: # (clockwise from above: Godot's front faces)
			st.set_uv(Vector2((p[k] as Vector3).x, (p[k] as Vector3).z) * 0.5)
			st.add_vertex(p[k])
	return st.commit()


static func _plane(s: Vector2) -> PlaneMesh:
	var p := PlaneMesh.new()
	p.size = s
	return p


static func _box(s: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = s
	return b


static func _cyl(top: float, bottom: float, h: float) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = top
	c.bottom_radius = bottom
	c.height = h
	c.radial_segments = 14
	c.rings = 1
	return c


static func _collider(root: Node3D, size: Vector3, pos: Vector3, yaw: float, layer: int = 1) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = layer
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	body.position = pos
	body.rotation.y = yaw
	root.add_child(body)


static func _collider_cyl(root: Node3D, radius: float, h: float, pos: Vector3, layer: int = 1) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = layer
	var shape := CollisionShape3D.new()
	var c := CylinderShape3D.new()
	c.radius = radius
	c.height = h
	shape.shape = c
	body.add_child(shape)
	body.position = pos
	root.add_child(body)
