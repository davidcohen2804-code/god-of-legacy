class_name TrainingDummy
extends StaticBody3D
## The training enemy in the courtyard's middle (M3): a straw-wrapped post on a stone base with 150 HP. It reacts to
## every confirmed strike — a short flash and a sway that grows with the blow (GPT: ~80 ms for the first strike,
## ~110 ms for the second, 180–220 ms and a controlled 0.5 m push for the third), the sway carried along with the
## blade's travel as well as away from the attacker (so it reads from behind him too) — shows the damage (stacked
## when blows follow each other), holds still through hit-stop,
## topples at 0 HP and stands up again, whole, two seconds later. After a push it slides back onto its mark (0.6 s
## later, over 0.5 s), so the courtyard's middle stays the training spot. It does not move or attack (M5).

signal hp_changed(hp: int, max_hp: int)
signal defeated

const MAX_HP := 150
const RADIUS := 0.38
const HEIGHT := 1.9

var hp := MAX_HP
## The upright capsule the katana's sweep tests (for every target in the "hurtbox" group).
var hurt_radius := RADIUS
var hurt_height := HEIGHT
var _pivot: Node3D
var _mats: Array[StandardMaterial3D] = []
## The sway: where the top leans (a horizontal vector, its length the angle in radians) and how fast.
var _lean := Vector3.ZERO
var _lean_v := Vector3.ZERO
var _fall_dir := Vector3.FORWARD
var _flash := 0.0
var _freeze := 0.0
var _push_from := Vector3.ZERO
var _push_to := Vector3.ZERO
var _push_t := -1.0
var _down := -1.0 ## time since toppling (-1: standing)
var _home := Vector3.ZERO
var _back_wait := 0.0 ## after a push: time left before sliding back onto the mark
var _back_from := Vector3.ZERO
var _back_t := -1.0
## The last push's distance (m) and the pushes so far, for the tests and the report.
var last_push := 0.0
var pushes := 0
var numbers := DamageNumbers.new()
## What it is and resists (data/targets.json): a fixed post — never pulled or launched (GPT's v1.2: an optional,
## stationary diagnostic target that does not leave its base).
var target_data := TargetData.of("training_dummy")


static func create() -> TrainingDummy:
	var d := TrainingDummy.new()
	d.name = "TrainingDummy"
	d.collision_layer = 4
	var shape := CollisionShape3D.new()
	var c := CylinderShape3D.new()
	c.radius = RADIUS
	c.height = HEIGHT
	shape.shape = c
	shape.position = Vector3(0, HEIGHT * 0.5, 0)
	d.add_child(shape)
	d._pivot = Node3D.new()
	d._pivot.name = "Body"
	d.add_child(d._pivot)
	var wood := d._mat("#4a3426", 0.85)
	var straw := d._mat("#9c8152", 0.95)
	var rope := d._mat("#6e2c3a", 0.9)
	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color("#3c3a46")
	stone.roughness = 0.95
	var base := MeshInstance3D.new()
	base.mesh = _cyl(0.46, 0.5, 0.16)
	base.material_override = stone
	base.position = Vector3(0, 0.08, 0)
	d.add_child(base) # the base stays put; the rest sways on the pivot
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
	d._pivot.add_child(head)
	return d


func _ready() -> void:
	_home = position
	add_to_group("hurtbox")


func is_alive() -> bool:
	return _down < 0.0


## A confirmed strike: `damage`, reeling for `reaction` s, pushed `push` m along `dir` (flat, from the attacker),
## swaying along `sway` (flat; `dir` when none — the attacker gives the blade's travel blended with `dir`).
func take_hit(damage: int, reaction: float, push: float, dir: Vector3, sway: Vector3 = Vector3.ZERO) -> void:
	if not is_alive():
		return
	hp = maxi(0, hp - damage)
	hp_changed.emit(hp, MAX_HP)
	_flash = FLASH_TIME
	dir.y = 0.0
	dir = dir.normalized() if dir.length() > 0.01 else Vector3.FORWARD
	sway.y = 0.0
	sway = sway.normalized() if sway.length() > 0.01 else dir
	# a sway that grows with the blow (~9°, ~12°); a blow that pushes staggers it hard (~28°)
	_lean_v += sway * deg_to_rad(30.0 + 150.0 * reaction / 0.2 + (90.0 if push > 0.0 else 0.0))
	_fall_dir = sway
	_back_t = -1.0 # a blow stops the slide back where it is
	_back_wait = 0.6 if position.distance_to(_home) > 0.01 else 0.0
	if push > 0.0:
		_push_from = position
		_push_to = position + dir * push
		_push_t = 0.0
	numbers.spawn(self, damage)
	QA.flag("dummy_hit", "%d:%d" % [damage, hp])
	if hp == 0:
		_down = 0.0
		defeated.emit()


const FLASH_TIME := 0.1 ## the hit flash: a short pulse (a longer one hid the dummy's shape)


## Hold still for `t` seconds (hit-stop).
func freeze_for(t: float) -> void:
	_freeze = maxf(_freeze, t)


func _physics_process(delta: float) -> void:
	if _freeze > 0.0:
		_freeze -= delta
		return
	if _push_t >= 0.0:
		_push_t += delta
		var k := clampf(_push_t / 0.2, 0.0, 1.0)
		position = _push_from.lerp(_push_to, 1.0 - pow(1.0 - k, 3.0))
		if k >= 1.0:
			_push_t = -1.0
			last_push = _push_from.distance_to(position)
			pushes += 1
			QA.flag("dummy_pushed", snappedf(last_push, 0.01))
			_back_wait = 0.6
	elif _back_t >= 0.0:
		_back_t += delta
		var b := clampf(_back_t / 0.5, 0.0, 1.0)
		position = _back_from.lerp(_home, b * b * (3.0 - 2.0 * b))
		if b >= 1.0:
			_back_t = -1.0
	elif _back_wait > 0.0 and _down < 0.0:
		_back_wait -= delta
		if _back_wait <= 0.0 and position.distance_to(_home) > 0.01:
			_back_from = position
			_back_t = 0.0
	if _down >= 0.0:
		_down += delta
		var fall := clampf(_down / 0.6, 0.0, 1.0)
		_lean = _lean.lerp(_fall_dir * deg_to_rad(78.0), 1.0 - pow(1.0 - fall, 3.0))
		if _down >= 2.6:
			_stand_up()
	else:
		# a damped spring back to upright
		_lean_v += (-90.0 * _lean - 9.0 * _lean_v) * delta
		_lean += _lean_v * delta
	var angle := _lean.length()
	_pivot.transform = Transform3D(Basis(Vector3.UP.cross(_lean / angle).normalized(), angle), Vector3.ZERO) \
		if angle > 0.0001 else Transform3D()
	_flash = maxf(0.0, _flash - delta)
	var glow := clampf(_flash / 0.06, 0.0, 1.0)
	for m in _mats:
		m.emission_energy_multiplier = 0.55 * glow # (a lift, not a white cut-out: the straw and rope stay readable)
	numbers.advance(delta)


func _stand_up() -> void:
	_down = -1.0
	_lean = Vector3.ZERO
	_lean_v = Vector3.ZERO
	hp = MAX_HP
	position = _home
	_push_t = -1.0
	_back_t = -1.0
	_back_wait = 0.0
	hp_changed.emit(hp, MAX_HP)
	QA.flag("dummy_reset", true)


## For the QA bridge.
func state() -> Dictionary:
	return {"hp": hp, "alive": is_alive(), "pos": [snappedf(position.x, 0.01), snappedf(position.z, 0.01)],
		"off_mark": snappedf(position.distance_to(_home), 0.01), "last_push": snappedf(last_push, 0.01), "pushes": pushes,
		"tilt": snappedf(rad_to_deg(_lean.length()), 0.1)}


func _mat(hex: String, rough: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(hex)
	m.roughness = rough
	m.emission_enabled = true
	m.emission = Color("#d9ccff")
	m.emission_energy_multiplier = 0.0
	_mats.append(m)
	return m


func _part(mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = mat
	m.position = pos
	_pivot.add_child(m)
	return m


static func _cyl(top: float, bottom: float, h: float) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = top
	c.bottom_radius = bottom
	c.height = h
	c.radial_segments = 16
	c.rings = 1
	return c
