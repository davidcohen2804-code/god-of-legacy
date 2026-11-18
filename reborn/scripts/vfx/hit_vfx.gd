class_name HitVfx
extends Node3D
## Hit effects (GPT's M3 review): on each confirmed blow a short burst of pale chips and sparks where the katana bit,
## thrown along the blade's travel; on the finisher (a blow that pushes) a bigger burst and a ring of dust where the
## target's base scrapes the stone. It only listens to the combat controller. One-shot CPU particles (they run on the
## web's Compatibility renderer), freed when done. Keep it under a node at the origin.

var _quad := QuadMesh.new()
var _spark_mat := StandardMaterial3D.new()
var _dust_mat := StandardMaterial3D.new()
var _spark_ramp := Gradient.new()
var _dust_ramp := Gradient.new()
var _dust_grow := Curve.new()
## Bursts so far (for the tests and the report).
var bursts := 0


func _ready() -> void:
	_quad.size = Vector2.ONE
	var soft := _soft_texture()
	for m in [_spark_mat, _dust_mat]:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.vertex_color_use_as_albedo = true
		m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		m.albedo_texture = soft
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_spark_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_spark_ramp.set_color(0, Color(1.0, 0.96, 0.86, 1.0))
	_spark_ramp.set_color(1, Color(0.78, 0.68, 1.0, 0.0))
	_spark_ramp.add_point(0.45, Color(0.96, 0.9, 1.0, 0.85))
	_dust_ramp.set_color(0, Color(0.6, 0.56, 0.68, 0.42))
	_dust_ramp.set_color(1, Color(0.5, 0.46, 0.58, 0.0))
	_dust_grow.max_value = 2.0
	_dust_grow.add_point(Vector2(0, 0.55))
	_dust_grow.add_point(Vector2(1, 1.35))


func bind(c: CombatController) -> void:
	c.strike_hit.connect(_on_hit)


func _on_hit(attack: AttackData, _step: int, target: Node3D, dir: Vector3) -> void:
	if target == null or not is_instance_valid(target):
		return
	var r: Variant = target.get("hurt_radius")
	var radius := float(r) if r != null else 0.4
	var side := Vector3(dir.z, 0.0, -dir.x) * signf(attack.arc_to - attack.arc_from)
	var throw := (dir * 0.6 + side * 0.8).normalized()
	var heavy := attack.knockback > 0.0
	_burst(target.global_position + Vector3(0, 1.2, 0) - dir * radius * 0.8, throw, 24 if heavy else 10,
		1.45 if heavy else 1.0)
	if heavy:
		_dust(target.global_position + Vector3(0, 0.06, 0), dir)
	bursts += 1


func _burst(at: Vector3, dir: Vector3, n: int, k: float) -> void:
	var p := _particles(n, 0.3, _spark_mat)
	p.direction = dir
	p.spread = 50.0
	p.initial_velocity_min = 2.2 * k
	p.initial_velocity_max = 5.0 * k
	p.gravity = Vector3(0, -7.0, 0)
	p.damping_min = 3.0
	p.damping_max = 5.0
	p.scale_amount_min = 0.035
	p.scale_amount_max = 0.08 * k
	p.color_ramp = _spark_ramp
	_launch(p, at)


func _dust(at: Vector3, dir: Vector3) -> void:
	var p := _particles(14, 0.75, _dust_mat)
	p.explosiveness = 0.9
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
	p.emission_ring_axis = Vector3.UP
	p.emission_ring_radius = 0.45
	p.emission_ring_inner_radius = 0.3
	p.emission_ring_height = 0.05
	p.direction = Vector3(dir.x, 0.35, dir.z)
	p.spread = 70.0
	p.initial_velocity_min = 0.6
	p.initial_velocity_max = 1.6
	p.gravity = Vector3(0, 0.3, 0)
	p.damping_min = 1.5
	p.damping_max = 2.5
	p.scale_amount_min = 0.22
	p.scale_amount_max = 0.4
	p.scale_amount_curve = _dust_grow
	p.color_ramp = _dust_ramp
	_launch(p, at)


func _particles(n: int, life: float, mat: Material) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.amount = n
	p.lifetime = life
	p.explosiveness = 1.0
	p.mesh = _quad
	p.material_override = mat
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return p


func _launch(p: CPUParticles3D, at: Vector3) -> void:
	add_child(p)
	p.global_position = at
	p.emitting = true
	get_tree().create_timer(p.lifetime + 0.3).timeout.connect(p.queue_free)


static func _soft_texture() -> GradientTexture2D:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 64
	t.height = 64
	return t
