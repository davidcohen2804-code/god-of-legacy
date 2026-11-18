class_name CourtyardBuilder
extends RefCounted
## The first arena: an ancient ruined courtyard at dusk — worn flagstones, a ring of broken walls with a great gate,
## standing and fallen columns, stone lanterns, rubble. Built from a few primitives and three small textures
## (tools/make_textures.py) so it stays light on a phone's GPU; the open middle is kept clear for the fight.
## Collision: layer 1 (the floor, walls, columns); the play area is a circle of radius ARENA_R.

const ARENA_R := 17.5
const WALL_R := 19.6
const ENV := "res://assets/env/"


static func build(root: Node3D, quality: int) -> void:
	var stone := TexLoader.material(ENV + "wall_blocks.webp.bin", Vector2(1, 1), Color(0.95, 0.92, 0.88), 0.95, true)
	var dark_stone := TexLoader.material(ENV + "wall_blocks.webp.bin", Vector2(1, 1), Color(0.62, 0.6, 0.6), 0.95, true)
	_environment(root, quality)
	_ground(root)
	_walls(root, stone, dark_stone)
	_columns(root, stone)
	_gate(root, stone)
	_lanterns(root, dark_stone, quality)
	_rubble(root, dark_stone)


static func _environment(root: Node3D, quality: int) -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var mat := ProceduralSkyMaterial.new()
	mat.sky_top_color = Color("#283a6e")
	mat.sky_horizon_color = Color("#d79b74")
	mat.sky_curve = 0.12
	mat.ground_horizon_color = Color("#6a4a48")
	mat.ground_bottom_color = Color("#1a1418")
	mat.sun_angle_max = 18.0
	sky.sky_material = mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.75
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.fog_enabled = true
	env.fog_light_color = Color("#9a8090")
	env.fog_density = 0.008
	env.fog_sky_affect = 0.25
	if quality >= 2:
		env.glow_enabled = true
		env.glow_intensity = 0.6
		env.glow_bloom = 0.05
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-28.0, 38.0, 0.0)
	sun.light_color = Color("#ffcf9e")
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.directional_shadow_max_distance = 36.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL if quality == 0 else DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	root.add_child(sun)


static func _ground(root: Node3D) -> void:
	var floor_mat := TexLoader.material(ENV + "flagstones.webp.bin", Vector2(11, 11), Color(0.98, 0.95, 0.9))
	_mesh(root, _plane(Vector2(44, 44)), floor_mat, Vector3(0, 0, 0))
	var earth := TexLoader.material(ENV + "earth.webp.bin", Vector2(28, 28))
	_mesh(root, _plane(Vector2(170, 170)), earth, Vector3(0, -0.03, 0))
	var ring := TorusMesh.new()
	ring.inner_radius = 5.0
	ring.outer_radius = 5.7
	ring.rings = 48
	ring.ring_segments = 6
	var ring_mat := TexLoader.material(ENV + "wall_blocks.webp.bin", Vector2(6, 1), Color(0.5, 0.48, 0.5))
	var r := _mesh(root, ring, ring_mat, Vector3(0, 0.0, 0))
	r.scale = Vector3(1, 0.04, 1)
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


static func _walls(root: Node3D, stone: Material, dark: Material) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	var n := 22
	for i in n:
		var a := TAU * float(i) / float(n)
		var gate := absf(wrapf(a - PI * 1.5, -PI, PI)) < 0.2
		var h := 0.0 if gate else rng.randf_range(1.0, 3.6)
		if i % 7 == 3:
			h = rng.randf_range(0.35, 0.7)
		var length := TAU * WALL_R / float(n) * 0.96
		var pos := Vector3(cos(a) * WALL_R, 0.0, sin(a) * WALL_R)
		var yaw := -a + PI * 0.5
		if h > 0.0:
			var m := _mesh(root, _box(Vector3(length, h, 1.1)), stone if h > 1.0 else dark, pos + Vector3(0, h * 0.5, 0))
			m.rotation.y = yaw
			if h > 2.2 and rng.randf() < 0.6:
				var cap := _mesh(root, _box(Vector3(length * 0.6, 0.4, 1.3)), dark, pos + Vector3(0, h + 0.2, 0))
				cap.rotation.y = yaw + rng.randf_range(-0.05, 0.05)
		# collision all the way round (low ruins and the gate's threshold included)
		_collider(root, Vector3(length, 4.0, 1.2), pos + Vector3(0, 2.0, 0), yaw)


static func _columns(root: Node3D, stone: Material) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var n := 10
	for i in n:
		var a := TAU * (float(i) + 0.5) / float(n)
		var pos := Vector3(cos(a) * 15.6, 0.0, sin(a) * 15.6)
		var broken := i % 3 == 1
		var h := rng.randf_range(2.0, 3.8) if broken else 6.4
		_mesh(root, _box(Vector3(1.7, 0.5, 1.7)), stone, pos + Vector3(0, 0.25, 0))
		var c := CylinderMesh.new()
		c.top_radius = 0.62
		c.bottom_radius = 0.72
		c.height = h
		c.radial_segments = 14
		var col := _mesh(root, c, stone, pos + Vector3(0, 0.5 + h * 0.5, 0))
		if broken:
			col.rotation = Vector3(rng.randf_range(-0.04, 0.04), rng.randf() * TAU, rng.randf_range(-0.04, 0.04))
		else:
			_mesh(root, _box(Vector3(1.6, 0.42, 1.6)), stone, pos + Vector3(0, 0.5 + h + 0.21, 0))
		_collider(root, Vector3(1.5, 6.0, 1.5), pos + Vector3(0, 3.0, 0), 0.0)
	# a fallen column outside the play area
	var f := CylinderMesh.new()
	f.top_radius = 0.6
	f.bottom_radius = 0.7
	f.height = 5.5
	f.radial_segments = 14
	var fallen := _mesh(root, f, stone, Vector3(-8.5, 0.6, -21.5))
	fallen.rotation = Vector3(0, 0.4, PI * 0.5)


static func _gate(root: Node3D, stone: Material) -> void:
	var z := -WALL_R - 0.3
	for x in [-3.3, 3.3]:
		_mesh(root, _box(Vector3(1.4, 8.4, 1.4)), stone, Vector3(x, 4.2, z))
		_mesh(root, _box(Vector3(2.0, 0.6, 2.0)), stone, Vector3(x, 0.3, z))
	_mesh(root, _box(Vector3(10.0, 0.9, 1.7)), stone, Vector3(0, 8.6, z))
	_mesh(root, _box(Vector3(8.4, 0.45, 1.2)), stone, Vector3(0, 7.4, z))


static func _lanterns(root: Node3D, dark: Material, quality: int) -> void:
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color("#ffd29a")
	glow.emission_enabled = true
	glow.emission = Color("#ffb066")
	glow.emission_energy_multiplier = 2.4
	for i in 4:
		var a := TAU * float(i) / 4.0 + PI * 0.25
		var pos := Vector3(cos(a) * 12.6, 0.0, sin(a) * 12.6)
		_mesh(root, _box(Vector3(0.9, 0.3, 0.9)), dark, pos + Vector3(0, 0.15, 0))
		_mesh(root, _box(Vector3(0.36, 1.1, 0.36)), dark, pos + Vector3(0, 0.85, 0))
		_mesh(root, _box(Vector3(0.62, 0.5, 0.62)), glow, pos + Vector3(0, 1.62, 0))
		var roof := _mesh(root, _box(Vector3(1.05, 0.22, 1.05)), dark, pos + Vector3(0, 2.0, 0))
		roof.rotation.y = PI * 0.25
		_collider(root, Vector3(0.9, 2.2, 0.9), pos + Vector3(0, 1.1, 0), 0.0)
		if quality >= 1:
			var l := OmniLight3D.new()
			l.light_color = Color("#ffb878")
			l.light_energy = 1.5
			l.omni_range = 7.5
			l.position = pos + Vector3(0, 1.7, 0)
			root.add_child(l)


static func _rubble(root: Node3D, dark: Material) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for i in 26:
		var a := rng.randf() * TAU
		var d := rng.randf_range(17.6, 19.0)
		var s := SphereMesh.new()
		var r := rng.randf_range(0.25, 0.8)
		s.radius = r
		s.height = r * 2.0
		s.radial_segments = 7
		s.rings = 4
		var m := _mesh(root, s, dark, Vector3(cos(a) * d, r * 0.3, sin(a) * d))
		m.scale = Vector3(1.0, rng.randf_range(0.5, 0.8), rng.randf_range(0.8, 1.2))
		m.rotation.y = rng.randf() * TAU


static func _mesh(root: Node3D, mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.position = pos
	root.add_child(m)
	return m


static func _box(size: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = size
	return b


static func _plane(size: Vector2) -> PlaneMesh:
	var p := PlaneMesh.new()
	p.size = size
	return p


static func _collider(root: Node3D, size: Vector3, pos: Vector3, yaw: float) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.position = pos
	body.rotation.y = yaw
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	body.add_child(shape)
	root.add_child(body)
