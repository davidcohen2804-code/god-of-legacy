class_name CameraRig
extends Node3D
## Camera controller: third person, elevated 30–45° at 7–9 m (GPT's M2 spec). Modes —
##   EXPLORATION: steady behind the player;
##   COMBAT: framing the player and the current foe — closer and narrower than exploring (M3: both must read on a
##   phone's small screen through the strikes and the foe's reactions);
##   COMBO: a little closer, for aerial chains and finishers — still inside the same band, so a change of mode never
##   jumps the framing.
## Every change is damped (no snapping, no cuts) — after the start, where settle() places it at once in the framing it
## starts in (GPT's v1.7: its first frame is the game view). A touch drag turns it at any time; easing toward a locked foe never
## overrides a drag. It pulls in (never closer than 3 m) in front of columns; it looks over the low walls. A landed
## blow gives it a brief jolt (shake), stronger for a finisher; a finisher may also narrow its view a little
## (`fov_push`: degrees, eased in and out, never turning it — GPT's v1.6: at most 2° for Phantom Execution).

enum Mode { EXPLORATION, COMBAT, COMBO }

const PITCH_MIN := -45.0
const PITCH_MAX := -30.0
const DIST_MIN := 7.0
const DIST_MAX := 9.0
const MIN_PULL := 3.0 ## the closest a wall-avoiding pull-in may bring the camera
const PRESETS := {
	Mode.EXPLORATION: {"pitch": -36.0, "dist": 8.0, "height": 1.3, "fov": 55.0},
	Mode.COMBAT: {"pitch": -33.0, "dist": 7.2, "height": 1.2, "fov": 44.0},
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
## Degrees its view narrows by now (a finisher's push-in); eased toward, never a jump.
var fov_push := 0.0

var _pitch_offset := 0.0
var _pos := Vector3.ZERO
var _pitch := -36.0
var _dist := 8.0
var _height := 1.3
var _drag_quiet := 1.0
var _shake := 0.0
var _shake_t := 0.0
var _fov := 55.0
var _push := 0.0


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


## Put the camera at once where it settles for its mode, target and focus — distance, pitch, height, field of view and
## position, no easing (GPT's v1.7): when the arena is built, so the very first frame drawn is the game view (never
## the floor-level view of a camera not yet placed, nor a framing still easing in). Its smoothing takes over from there.
func settle() -> void:
	if target and cam:
		_update(0.0, true)


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


## A brief jolt of the view (0..1: a light blow ~0.2, a finisher ~0.6), dying away in a fraction of a second.
func shake(amount: float) -> void:
	_shake = clampf(maxf(_shake, amount), 0.0, 1.0)


func elevation() -> float:
	return -_pitch


func distance() -> float:
	return _dist


func _process(delta: float) -> void:
	if target == null or not active:
		return
	_update(delta, false)


## One step of the camera toward its framing — eased over `delta`, or there at once (`snap`: settle()).
func _update(delta: float, snap: bool) -> void:
	_drag_quiet += delta
	var p: Dictionary = PRESETS[mode]
	var k := 1.0 if snap else 1.0 - exp(-delta * 4.0)
	var extra := 0.0
	var aim := target.global_position
	if focus and is_instance_valid(focus) and mode != Mode.EXPLORATION:
		var sep := target.global_position.distance_to(focus.global_position)
		extra = clampf((sep - 3.0) * 0.25, 0.0, 1.5)
		aim = aim.lerp(focus.global_position, 0.25 if sep < 12.0 else 0.0)
		if lock and _drag_quiet > 0.6:
			var to := focus.global_position - target.global_position
			yaw = lerp_angle(yaw, atan2(-to.x, -to.z), 1.0 if snap else 1.0 - exp(-delta * 2.6))
	_dist = lerpf(_dist, clampf(float(p["dist"]) + extra, DIST_MIN, DIST_MAX), k)
	_pitch = lerpf(_pitch, clampf(float(p["pitch"]) + _pitch_offset, PITCH_MIN, PITCH_MAX), k)
	_height = lerpf(_height, float(p["height"]), k)
	_fov = lerpf(_fov, float(p["fov"]), k)
	_push = lerpf(_push, fov_push, 1.0 if snap else 1.0 - exp(-delta * 14.0))
	cam.fov = _fov - _push
	_pos = _pos.lerp(aim + Vector3(0, _height, 0), 1.0 if snap else 1.0 - exp(-delta * 9.0))

	var b := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, deg_to_rad(_pitch))
	var want_pos := _pos + b.z * _dist
	# Kept in front of what it must not see through (the columns: layer 16), never closer than MIN_PULL; low walls are
	# below its line, and the courtyard's invisible bounds are not on that layer.
	var q := PhysicsRayQueryParameters3D.create(_pos, want_pos, 16)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty():
		var d := maxf(_pos.distance_to(hit["position"]) - 0.35, MIN_PULL)
		want_pos = _pos + b.z * d
	if _shake > 0.0:
		_shake_t += delta
		_shake = maxf(0.0, _shake - delta * 3.2)
		b = b * Basis(Vector3.RIGHT, deg_to_rad(1.7 * _shake * sin(_shake_t * 59.0))) \
			* Basis(Vector3.UP, deg_to_rad(1.1 * _shake * sin(_shake_t * 43.0 + 1.3)))
	cam.global_transform = Transform3D(b, want_pos)
