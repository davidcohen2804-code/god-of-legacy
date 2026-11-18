class_name Fighter
extends CharacterBody3D
## A combatant's body: movement, gravity, facing, jump and dodge, shared by the player and the enemies. What drives
## it (PlayerController, an enemy brain) only sets intents; its visual only shows what it does.
## (M3 hands its actions and reactions to the combat state machine.)

const DODGE_TIME := 0.56
const DODGE_SPEED := 9.6
## The dodge's invulnerable window, in seconds from its start.
const DODGE_IFRAMES := Vector2(0.05, 0.36)

var visual: CharacterVisual
var move_intent := Vector3.ZERO
var sprinting := false
var facing := 0.0
var run_speed := 5.2
var sprint_speed := 7.8
var accel := 34.0
var gravity := 24.0
var jump_velocity := 7.8
## ground | air | dodge
var state := "ground"
var invulnerable := false
var combat_ready := false

var _dodge_t := 0.0
var _dodge_dir := Vector3.ZERO
var _air_t := 0.0
var _land_t := 0.0


func setup(v: CharacterVisual, radius: float = 0.34, height: float = 1.7) -> void:
	visual = v
	add_child(v)
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = radius
	cap.height = height
	shape.shape = cap
	shape.position = Vector3(0, height * 0.5, 0)
	add_child(shape)
	collision_layer = 2
	collision_mask = 1 | 2
	floor_snap_length = 0.35
	floor_max_angle = deg_to_rad(50.0)


func forward() -> Vector3:
	return Vector3(sin(facing), 0.0, cos(facing))


func jump() -> bool:
	if state != "ground" or not is_on_floor():
		return false
	velocity.y = jump_velocity
	state = "air"
	_air_t = 0.0
	visual.play("Jump_Start", 0.06, 1.7, true, 0.3)
	return true


func dodge(dir: Vector3) -> bool:
	if state == "dodge":
		return false
	if dir.length() < 0.1:
		dir = forward()
	_dodge_dir = Vector3(dir.x, 0.0, dir.z).normalized()
	_dodge_t = 0.0
	state = "dodge"
	facing = atan2(_dodge_dir.x, _dodge_dir.z)
	visual.play("Roll", 0.05, 1.8, true)
	return true


func _physics_process(delta: float) -> void:
	var on_floor := is_on_floor()
	if state == "dodge":
		_dodge_t += delta
		var sp := DODGE_SPEED * clampf((1.0 - _dodge_t / DODGE_TIME) * 1.35, 0.0, 1.0)
		velocity.x = _dodge_dir.x * sp
		velocity.z = _dodge_dir.z * sp
		invulnerable = _dodge_t >= DODGE_IFRAMES.x and _dodge_t <= DODGE_IFRAMES.y
		if _dodge_t >= DODGE_TIME:
			invulnerable = false
			state = "ground" if on_floor else "air"
	else:
		var want := move_intent * (sprint_speed if sprinting else run_speed)
		var hv := Vector3(velocity.x, 0.0, velocity.z)
		hv = hv.move_toward(want, (accel if on_floor else accel * 0.4) * delta)
		velocity.x = hv.x
		velocity.z = hv.z
		if move_intent.length() > 0.05:
			facing = lerp_angle(facing, atan2(move_intent.x, move_intent.z), 1.0 - exp(-14.0 * delta))
	if not on_floor:
		velocity.y -= gravity * delta
	move_and_slide()

	var now_floor := is_on_floor()
	if state == "air":
		_air_t += delta
		if now_floor and _air_t > 0.12:
			state = "ground"
			_land_t = 0.2
			visual.play("Jump_Land", 0.05, 1.5, true, 0.2)
		elif _air_t > 0.34:
			visual.play("Jump_Loop", 0.2)
	elif state == "ground" and not now_floor and velocity.y < -2.5:
		state = "air"
		_air_t = 0.35
	visual.rotation.y = facing
	if state == "ground":
		if _land_t > 0.0:
			_land_t -= delta
		else:
			visual.locomotion(Vector2(velocity.x, velocity.z).length(), sprinting, combat_ready)
