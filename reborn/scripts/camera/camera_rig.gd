class_name CameraRig
extends Node3D
## Camera controller: third person, elevated 30–45° at 7–9 m (GPT's M2 spec). Modes —
##   EXPLORATION: steady behind the player;
##   COMBAT: a little further and lower, framing the player and the current foe;
##   COMBO: a little closer, for aerial chains and finishers — still inside the same band, so a change of mode never
##   jumps the framing.
## Every change is damped (no snapping, no cuts). A touch drag turns it at any time; easing toward a locked foe never
## overrides a drag. It pulls in in front of walls.

enum Mode { EXPLORATION, COMBAT, COMBO }

const PITCH_MIN := -45.0
const PITCH_MAX := -30.0
const DIST_MIN := 7.0
const DIST_MAX := 9.0
const PRESETS := {
	Mode.EXPLORATION: {"pitch": -36.0, "dist": 8.0, "height": 1.3, "fov": 55.0},
	Mode.COMBAT: {"pitch": -33.0, "dist": 8.6, "height": 1.25, "fov": 56.0},
	Mode.COMBO: {"pitch": -32.0, "dist": 7.4, "height": 1.4, "fov": 54.0},
}

var target: Node3D
var focus: Node3D
var lock := false
var mode := Mode.EXPLORATION
var yaw := 0.0
var sensitivity := 1.0
var cam: Camera3D
## Off while a test viewpoint holds the camera.
var active := true

var _pitch_offset := 0.0
var _pos := Vector3.ZERO
var _pitch := -36.0
var _dist := 8.0
var _height := 1.3
var _drag_quiet := 1.0


func _ready() -> void:
	cam = Camera3D.new()
	cam.near = 0.1
	cam.far = 200.0
	cam.fov = 55.0
	add_child(cam)
	cam.current = true
	if target:
		_pos = target.global_position + Vector3(0, _height, 0)


## Put the camera straight behind a facing (yaw of the body), without easing — only at the start.
func snap_behind(facing: float) -> void:
	yaw = facing + PI
	if target:
		_pos = target.global_position + Vector3(0, _height, 0)


## Pixels of drag from the input system.
func turn(drag: Vector2) -> void:
	if drag == Vector2.ZERO:
		return
	yaw -= drag.x * 0.0058 * sensitivity
	_pitch_offset = clampf(_pitch_offset - drag.y * 0.11 * sensitivity, -9.0, 6.0)
	_drag_quiet = 0.0


## The ground-plane directions the joystick moves along (forward = away from the camera).
func ground_basis() -> Basis:
	return Basis(Vector3.UP, yaw)


func elevation() -> float:
	return -_pitch


func distance() -> float:
	return _dist


func _process(delta: float) -> void:
	if target == null or not active:
		return
	_drag_quiet += delta
	var p: Dictionary = PRESETS[mode]
	var k := 1.0 - exp(-delta * 4.0)
	var extra := 0.0
	var aim := target.global_position
	if focus and is_instance_valid(focus) and mode != Mode.EXPLORATION:
		var sep := target.global_position.distance_to(focus.global_position)
		extra = clampf((sep - 3.0) * 0.25, 0.0, 1.5)
		aim = aim.lerp(focus.global_position, 0.25 if sep < 12.0 else 0.0)
		if lock and _drag_quiet > 0.6:
			var to := focus.global_position - target.global_position
			yaw = lerp_angle(yaw, atan2(-to.x, -to.z), 1.0 - exp(-delta * 2.6))
	_dist = lerpf(_dist, clampf(float(p["dist"]) + extra, DIST_MIN, DIST_MAX), k)
	_pitch = lerpf(_pitch, clampf(float(p["pitch"]) + _pitch_offset, PITCH_MIN, PITCH_MAX), k)
	_height = lerpf(_height, float(p["height"]), k)
	cam.fov = lerpf(cam.fov, float(p["fov"]), k)
	_pos = _pos.lerp(aim + Vector3(0, _height, 0), 1.0 - exp(-delta * 9.0))

	var b := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, deg_to_rad(_pitch))
	var want_pos := _pos + b.z * _dist
	var q := PhysicsRayQueryParameters3D.create(_pos, want_pos, 1)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty():
		want_pos = (hit["position"] as Vector3) - b.z * 0.35
	cam.global_transform = Transform3D(b, want_pos)
