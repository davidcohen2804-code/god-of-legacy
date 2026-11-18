class_name CameraRig
extends Node3D
## Camera controller: third person, elevated, at a moderate distance. Modes —
##   EXPLORATION: high and steady behind the player;
##   COMBAT: a little further, framing the player and the current foe;
##   COMBO: closer and lower while the player strings an aerial chain or a finisher.
## Every change is damped (no snapping). Touch drag turns it at any time; target lock only eases the turn toward
## the foe, and a drag still wins. It pulls in in front of walls.

enum Mode { EXPLORATION, COMBAT, COMBO }

const PRESETS := {
	Mode.EXPLORATION: {"pitch": -31.0, "dist": 7.4, "height": 1.35, "fov": 56.0},
	Mode.COMBAT: {"pitch": -29.0, "dist": 8.4, "height": 1.25, "fov": 57.0},
	Mode.COMBO: {"pitch": -17.0, "dist": 6.2, "height": 1.9, "fov": 53.0},
}

var target: Node3D
var focus: Node3D
var lock := false
var mode := Mode.EXPLORATION
var yaw := 0.0
var sensitivity := 1.0
var cam: Camera3D

var _pitch_offset := 0.0
var _pos := Vector3.ZERO
var _pitch := -31.0
var _dist := 7.4
var _height := 1.35
var _drag_quiet := 1.0
var _shake := 0.0


func _ready() -> void:
	cam = Camera3D.new()
	cam.near = 0.1
	cam.far = 160.0
	add_child(cam)
	cam.current = true
	if target:
		_pos = target.global_position


func snap_behind(y: float) -> void:
	yaw = y
	if target:
		_pos = target.global_position + Vector3(0, _height, 0)


## Pixels of drag from the input system.
func turn(drag: Vector2) -> void:
	if drag == Vector2.ZERO:
		return
	yaw -= drag.x * 0.0058 * sensitivity
	_pitch_offset = clampf(_pitch_offset - drag.y * 0.11 * sensitivity, -14.0, 20.0)
	_drag_quiet = 0.0


func shake(amount: float) -> void:
	_shake = maxf(_shake, amount)


## The ground-plane directions the joystick moves along.
func ground_basis() -> Basis:
	return Basis(Vector3.UP, yaw)


func _process(delta: float) -> void:
	if target == null:
		return
	_drag_quiet += delta
	var p: Dictionary = PRESETS[mode]
	var k := 1.0 - exp(-delta * 4.0)
	var extra := 0.0
	var aim := target.global_position
	if focus and is_instance_valid(focus) and mode != Mode.EXPLORATION:
		var sep := target.global_position.distance_to(focus.global_position)
		extra = clampf((sep - 3.0) * 0.35, 0.0, 3.5)
		aim = aim.lerp(focus.global_position, 0.28 if sep < 12.0 else 0.0)
		if lock and _drag_quiet > 0.6:
			var to := focus.global_position - target.global_position
			var want := atan2(-to.x, -to.z)
			yaw = lerp_angle(yaw, want, 1.0 - exp(-delta * 2.6))
	_dist = lerpf(_dist, float(p["dist"]) + extra, k)
	_pitch = lerpf(_pitch, float(p["pitch"]) + _pitch_offset, k)
	_height = lerpf(_height, float(p["height"]), k)
	cam.fov = lerpf(cam.fov, float(p["fov"]), k)
	_pos = _pos.lerp(aim + Vector3(0, _height, 0), 1.0 - exp(-delta * 9.0))

	var b := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, deg_to_rad(_pitch))
	var want_pos := _pos + b.z * _dist
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(_pos, want_pos, 1)
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		want_pos = (hit["position"] as Vector3) + b.z * -0.35
	var t := Transform3D(b, want_pos)
	if _shake > 0.0:
		_shake = maxf(0.0, _shake - delta * 2.5)
		var s := _shake * _shake
		t.origin += Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * 0.12 * s
	cam.global_transform = t
