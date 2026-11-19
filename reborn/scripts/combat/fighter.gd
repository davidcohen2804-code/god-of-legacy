class_name Fighter
extends CharacterBody3D
## A combatant's body: movement, gravity, facing, jump and dodge, shared by the player and (later) the enemies. What
## drives it (PlayerController, an enemy brain) only sets intents; its visual only shows what it does. While the
## combat state machine owns the body (a strike, a reaction) it sets `action_lock` and drives the body's step itself;
## `frozen` holds it still through hit-stop.

## ground | air | dodge
signal state_changed(state: String)

const DODGE_TIME := 0.56
const DODGE_SPEED := 9.6
## The dodge's defensive window, seconds from its start (GPT: begin with 120 ms, then tune).
const DODGE_IFRAMES := Vector2(0.0, 0.12)

var visual: CharacterVisual
var move_intent := Vector3.ZERO ## world-space, length 0..1
var sprinting := false
var facing := 0.0 ## yaw in radians; the model faces +Z at 0
var walk_speed := 1.9
var run_speed := 5.2
var sprint_speed := 7.8
var accel := 34.0
var turn_rate := 14.0
var gravity := 24.0
var jump_velocity := 7.8
var state := "ground"
var invulnerable := false
var combat_ready := false
## Set by the combat controller: the body follows `action_velocity` instead of the stick (a strike's step forward).
var action_lock := false
var action_velocity := Vector3.ZERO
## A leap (Aerial Pursuit): the body follows `action_velocity` up and down too, without gravity.
var action_air := false
## Hit-stop: no movement, no gravity, no animation advance.
var frozen := false
## Rolls so far (for the tests and the report).
var dodges := 0
## The upright capsule an enemy's blade is tested against, and where he stood when this tick's movement began (the
## blade is swept against his movement through the tick, not only where he ended up).
var hurt_radius := 0.34
var hurt_height := 1.7
var prev_position := Vector3.ZERO

var _dodge_t := 0.0
var _dodge_prev := 0.0 ## the roll's clock when this tick began
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
	hurt_radius = radius
	hurt_height = height
	collision_layer = 2
	collision_mask = 1 | 2 | 4 | 8 # the world, other bodies, the target, the courtyard's bounds
	floor_snap_length = 0.35
	floor_max_angle = deg_to_rad(50.0)


func _ready() -> void:
	visual.rotation.y = facing
	visual.play("Sword_Idle" if combat_ready else "Idle_Loop", 0.0)


func forward() -> Vector3:
	return Vector3(sin(facing), 0.0, cos(facing))


func ground_speed() -> float:
	return Vector2(velocity.x, velocity.z).length()


func jump() -> bool:
	if state != "ground" or not is_on_floor():
		return false
	velocity.y = jump_velocity
	_air_t = 0.0
	_set_state("air")
	visual.play("Jump_Start", 0.06, 1.7, true, 0.3)
	return true


## A quick roll along `dir` (world space; the facing when none), with its short defensive window. Only from the
## ground (no mid-air roll — GPT's M2 review) and never during a strike (the combat controller asks first).
func dodge(dir: Vector3) -> bool:
	if state != "ground" or not is_on_floor() or action_lock:
		return false
	if dir.length() < 0.1:
		dir = forward()
	_dodge_dir = Vector3(dir.x, 0.0, dir.z).normalized()
	_dodge_t = 0.0
	facing = atan2(_dodge_dir.x, _dodge_dir.z)
	dodges += 1
	_set_state("dodge")
	visual.play("Roll", 0.05, 1.8, true)
	return true


## The roll ends here (he was struck out of it): no more movement or defensive window from it.
func cancel_dodge() -> void:
	if state == "dodge":
		invulnerable = false
		_set_state("ground" if is_on_floor() else "air")


## The part of his last tick (fractions 0..1) that lay inside the roll's defensive window; (-1, -1) when none.
func iframe_span() -> Vector2:
	if state != "dodge":
		return Vector2(-1, -1)
	return HitResolver.overlap(DODGE_IFRAMES, Vector2(_dodge_prev, _dodge_t))


func _set_state(s: String) -> void:
	if s != state:
		state = s
		state_changed.emit(s)


## An action leaves the ground (a leap): from here he is in the air — no ground action starts until he lands.
func begin_air_action() -> void:
	_air_t = 0.0
	_set_state("air")


## Turn toward a point at up to `rate` radians per second (a strike's target assist).
func face_toward(point: Vector3, rate: float, delta: float) -> void:
	var to := point - global_position
	if Vector2(to.x, to.z).length() < 0.05:
		return
	var want := atan2(to.x, to.z)
	facing = facing + clampf(wrapf(want - facing, -PI, PI), -rate * delta, rate * delta)


func _physics_process(delta: float) -> void:
	visual.rotation.y = facing
	prev_position = global_position
	_dodge_prev = _dodge_t
	if frozen:
		return
	var on_floor := is_on_floor()
	if action_lock:
		if action_air:
			velocity = action_velocity
		else:
			velocity.x = action_velocity.x
			velocity.z = action_velocity.z
			if not on_floor:
				velocity.y -= gravity * delta
		move_and_slide()
		return
	if state == "dodge":
		_dodge_t += delta
		var sp := DODGE_SPEED * clampf((1.0 - _dodge_t / DODGE_TIME) * 1.35, 0.0, 1.0)
		velocity.x = _dodge_dir.x * sp
		velocity.z = _dodge_dir.z * sp
		invulnerable = _dodge_t >= DODGE_IFRAMES.x and _dodge_t <= DODGE_IFRAMES.y
		if _dodge_t >= DODGE_TIME:
			invulnerable = false
			_set_state("ground" if on_floor else "air")
	else:
		var top := sprint_speed if sprinting else (run_speed if move_intent.length() > 0.45 else walk_speed)
		var want := move_intent.normalized() * top if move_intent.length() > 0.05 else Vector3.ZERO
		var hv := Vector3(velocity.x, 0.0, velocity.z)
		hv = hv.move_toward(want, (accel if on_floor else accel * 0.4) * delta)
		velocity.x = hv.x
		velocity.z = hv.z
		if move_intent.length() > 0.05:
			facing = lerp_angle(facing, atan2(move_intent.x, move_intent.z), 1.0 - exp(-turn_rate * delta))
	if not on_floor:
		velocity.y -= gravity * delta
	move_and_slide()

	var now_floor := is_on_floor()
	if state == "air":
		_air_t += delta
		if now_floor and _air_t > 0.12:
			_set_state("ground")
			_land_t = 0.18
			visual.play("Jump_Land", 0.05, 1.5, true, 0.2)
		elif _air_t > 0.34:
			visual.play("Jump_Loop", 0.2)
	elif state == "ground" and not now_floor and velocity.y < -2.5:
		_set_state("air")
		_air_t = 0.35
	visual.rotation.y = facing
	if state == "ground":
		if _land_t > 0.0:
			_land_t -= delta
		else:
			_locomotion()


## The walk/run/sprint cycle from the ground speed, its playback matched to the speed (no sliding feet).
func _locomotion() -> void:
	var speed := ground_speed()
	if speed < 0.35:
		visual.play("Sword_Idle" if combat_ready else "Idle_Loop", 0.2)
	elif sprinting and speed > run_speed + 0.6:
		visual.play("Sprint_Loop", 0.15, clampf(speed / 7.6, 0.7, 1.4))
	elif speed < 2.6:
		visual.play("Walk_Loop", 0.15, clampf(speed / 1.6, 0.6, 1.5))
	else:
		visual.play("Jog_Fwd_Loop", 0.15, clampf(speed / 4.6, 0.7, 1.35))
