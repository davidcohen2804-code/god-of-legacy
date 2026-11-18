class_name TrainingDummy
extends StaticBody3D
## The training target in the courtyard's middle: a straw-wrapped post on a stone base. In M2 it is only something
## to move round and frame; hits, reactions and health arrive in M3.


static func create() -> TrainingDummy:
	var d := TrainingDummy.new()
	d.name = "TrainingDummy"
	d.collision_layer = 4
	var shape := CollisionShape3D.new()
	var c := CylinderShape3D.new()
	c.radius = 0.38
	c.height = 1.9
	shape.shape = c
	shape.position = Vector3(0, 0.95, 0)
	d.add_child(shape)
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color("#4a3426")
	wood.roughness = 0.85
	var straw := StandardMaterial3D.new()
	straw.albedo_color = Color("#9c8152")
	straw.roughness = 0.95
	var rope := StandardMaterial3D.new()
	rope.albedo_color = Color("#6e2c3a")
	rope.roughness = 0.9
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color("#3c3a46")
	stone.roughness = 0.95
	d._part(_cyl(0.46, 0.5, 0.16), stone, Vector3(0, 0.08, 0))
	d._part(_cyl(0.08, 0.09, 1.95), wood, Vector3(0, 1.0, 0))
	d._part(_cyl(0.27, 0.3, 0.78), straw, Vector3(0, 1.18, 0))
	d._part(_cyl(0.285, 0.285, 0.06), rope, Vector3(0, 1.32, 0))
	d._part(_cyl(0.305, 0.305, 0.06), rope, Vector3(0, 0.98, 0))
	var arms := d._part(_cyl(0.05, 0.05, 1.1), wood, Vector3(0, 1.42, 0))
	arms.rotation.z = PI * 0.5
	var head := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.17
	s.height = 0.36
	head.mesh = s
	head.material_override = straw
	head.position = Vector3(0, 1.78, 0)
	d.add_child(head)
	return d


func _part(mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.position = pos
	add_child(m)
	return m


static func _cyl(top: float, bottom: float, h: float) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = top
	c.bottom_radius = bottom
	c.height = h
	c.radial_segments = 16
	c.rings = 1
	return c
