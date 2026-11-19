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

## The combat framing in use (M4.2-A: the three compared in A1; GPT's v2.2 chose B — A and C stay for QA and the
## regression comparisons):
##   A — the earlier one: COMBAT below, a quarter metre farther per metre the two stand apart beyond 3 m (≤ +1.5 m);
##   B — closer, fixed: 6.6 m, 42°, pitch 32° — with its three corrections (GPT's v2.2, each switchable in QA):
##       the shoulder (the camera `shoulder` m to his left, still looking at its aim, so the two do not stand one over
##       the other on the screen), the airborne framing (while the target is in the air its aim rises AIR_SHARE of the
##       target's height, AIR_LIFT_MAX at most, and the pitch eases toward AIR_PITCH; only if the target's head would
##       still enter the top band, or his feet a control cluster, a modest pull back of AIR_EXTRA m at most) and the
##       assist (the camera turns, ASSIST_MAX° at most, while the target enters the right-hand cluster's box);
##   C — adaptive: 42°, pitch 32°, the least distance in C_NEAR–C_FAR that keeps both fighters — their projected heads
##       and feet, a body's width either side — on the screen and out of the HUD's areas (`exclusions`); when even
##       C_FAR cannot, an emergency extension up to FALLBACK_MAX — counted (`fallbacks`), never a cropped fighter.
static var variant := "B"
const VARIANTS := {
	"A": {"pitch": -33.0, "dist": 7.2, "height": 1.2, "fov": 44.0},
	"B": {"pitch": -32.0, "dist": 6.6, "height": 1.2, "fov": 42.0},
	"C": {"pitch": -32.0, "dist": 6.6, "height": 1.2, "fov": 42.0},
}
const C_NEAR := 6.6
const C_FAR := 7.2
const FALLBACK_MAX := 8.7
const EDGE := 12.0 ## canvas px C keeps a fighter clear of the screen's edges
static var shoulder := 0.35 ## m (GPT's v2.2: about 0.35, 0.5 at most; 0 switches it off)
static var air_framing := true
static var assist := true
const AIR_SHARE := 0.4
const AIR_LIFT_MAX := 0.8 ## m
const AIR_PITCH := -30.0
const AIR_EXTRA := 0.8 ## m (provisional: "a brief, modest distance increase")
const ASSIST_MAX := 12.0 ## degrees each time the target comes into the cluster
const ASSIST_RATE := 30.0 ## degrees a second at most (eased in and out; provisional)
const ASSIST_DEAD := 8.0 ## canvas px: it starts once the target is this far into the cluster's box, is done once out
const ASSIST_PAUSE := 0.6 ## s after a drag before it may act again
## The exploration framing (no target within range): A as before; B — GPT's v2.2 proposal, compared in QA.
static var explore := "A"
const EXPLORE_VARIANTS := {
	"A": {"pitch": -36.0, "dist": 8.0, "height": 1.3, "fov": 55.0},
	"B": {"pitch": -35.0, "dist": 7.35, "height": 1.3, "fov": 50.0},
}

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
## The screen areas the fighters are kept out of (canvas px: the HUD's top band and the control clusters) and the
## screen's size — told by the arena (variant C's framing and the QA metrics).
var exclusions: Array[Rect2] = []
var screen := Vector2(1280, 720)
## Variant C beyond its preferred band now (the emergency extension), and how often it has gone there.
var fallback := false
var fallbacks := 0
## The right-hand control cluster's box (canvas px), told by the arena: B's assist keeps the target out of it.
var assist_zone := Rect2()
## (QA) B's corrections now: the aim's rise for a target in the air, the pull back it needed, the assist's turn so far.
var lift := 0.0
var air_pull := 0.0
var assist_turned := 0.0
var assists := 0 ## how many times it has started turning
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
var _was_fallback := false
var _side := 0.0 ## m the camera stands to his right (negative: his left) now — eased
var _assist_v := 0.0 ## degrees a second the assist is turning now — eased
var _assisting := false


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


## (QA: identical shots) the framing as it starts — no pitch dragged in, the assist's count afresh.
func reset_view() -> void:
	_pitch_offset = 0.0
	assist_turned = 0.0
	_assisting = false
	_assist_v = 0.0


## (QA) whether the assist is turning the camera now (or about to: started, its turn not used up).
func is_assisting() -> bool:
	return (_assisting and assist_turned < ASSIST_MAX) or _assist_v > 0.5


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
	var combat := mode == Mode.COMBAT
	var p: Dictionary = PRESETS[mode]
	if combat:
		p = VARIANTS[variant]
	elif mode == Mode.EXPLORATION:
		p = EXPLORE_VARIANTS.get(explore, EXPLORE_VARIANTS["A"])
	var k := 1.0 if snap else 1.0 - exp(-delta * 4.0)
	var extra := 0.0
	var aim := target.global_position
	var foe := focus and is_instance_valid(focus) and mode != Mode.EXPLORATION
	var fixes := combat and foe and variant == "B" # (B's corrections, while it frames a target)
	if foe:
		var sep := target.global_position.distance_to(focus.global_position)
		extra = clampf((sep - 3.0) * 0.25, 0.0, 1.5)
		aim = aim.lerp(focus.global_position, 0.25 if sep < 12.0 else 0.0)
		if lock and _drag_quiet > 0.6:
			var to := focus.global_position - target.global_position
			yaw = lerp_angle(yaw, atan2(-to.x, -to.z), 1.0 if snap else 1.0 - exp(-delta * 2.6))
	if fixes and assist and not snap:
		_assist(delta)
	else:
		_assisting = false
		_assist_v = 0.0
	# B's airborne framing: the aim rises with a target in the air (on top of the quarter-way aim toward it), and the
	# pitch eases toward AIR_PITCH as it does — up through the launch, back down with the target, home after it lands.
	var air_goal := 0.0
	if fixes and air_framing:
		air_goal = minf(maxf(focus.global_position.y, 0.0) * AIR_SHARE, AIR_LIFT_MAX)
	lift = lerpf(lift, air_goal, 1.0 if snap else 1.0 - exp(-delta * 6.0))
	aim.y += lift
	var pitch_goal := float(p["pitch"])
	if fixes:
		pitch_goal = lerpf(pitch_goal, AIR_PITCH, clampf(lift / AIR_LIFT_MAX, 0.0, 1.0))
	_pitch = lerpf(_pitch, clampf(pitch_goal + _pitch_offset, PITCH_MIN, PITCH_MAX), k)
	_height = lerpf(_height, float(p["height"]), k)
	_fov = lerpf(_fov, float(p["fov"]), k)
	_push = lerpf(_push, fov_push, 1.0 if snap else 1.0 - exp(-delta * 14.0))
	cam.fov = _fov - _push
	_pos = _pos.lerp(aim + Vector3(0, _height, 0), 1.0 if snap else 1.0 - exp(-delta * 9.0))
	var b := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, deg_to_rad(_pitch))
	var want := clampf(float(p["dist"]) + extra, DIST_MIN, DIST_MAX)
	fallback = false
	air_pull = 0.0
	if combat and variant == "B":
		want = C_NEAR
		if fixes and air_framing and lift > 0.05:
			air_pull = _air_pull(b, _pos, _fov)
			want += air_pull
	elif combat and variant == "C":
		want = fit_distance(b, _pos, _fov)
		fallback = want > C_FAR + 0.001
		if fallback and not _was_fallback:
			fallbacks += 1
	_was_fallback = fallback
	_dist = lerpf(_dist, want, k)

	var want_pos := _pos + b.z * _dist
	# Kept in front of what it must not see through (the columns: layer 16), never closer than MIN_PULL; low walls are
	# below its line, and the courtyard's invisible bounds are not on that layer.
	var q := PhysicsRayQueryParameters3D.create(_pos, want_pos, 16)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty():
		var d := maxf(_pos.distance_to(hit["position"]) - 0.35, MIN_PULL)
		want_pos = _pos + b.z * d
	# B's shoulder: the camera a little to his left, still looking at its aim — the composition stays centred, the two
	# no longer one over the other on the screen; the ground directions (yaw) are untouched.
	_side = lerpf(_side, -shoulder if fixes else 0.0, k)
	if absf(_side) > 0.001:
		want_pos += Basis(Vector3.UP, yaw).x * _side
		b = Basis.looking_at(_pos - want_pos, Vector3.UP)
	if _shake > 0.0:
		_shake_t += delta
		_shake = maxf(0.0, _shake - delta * 3.2)
		b = b * Basis(Vector3.RIGHT, deg_to_rad(1.7 * _shake * sin(_shake_t * 59.0))) \
			* Basis(Vector3.UP, deg_to_rad(1.1 * _shake * sin(_shake_t * 43.0 + 1.3)))
	cam.global_transform = Transform3D(b, want_pos)


## B's pull back while the target is in the air: the least, in steps of 5 cm up to AIR_EXTRA, at which both fighters'
## framing points fall on the screen and outside every HUD area (the target below the top band, his feet above the
## clusters) — the aim's rise and the flatter pitch come first; AIR_EXTRA if even that cannot.
func _air_pull(b: Basis, center: Vector3, fov: float) -> float:
	var pts := framing_points(target, b)
	pts.append_array(framing_points(focus, b))
	var e := 0.0
	while e < AIR_EXTRA:
		if _all_clear(pts, center, b, C_NEAR + e, fov):
			return e
		e += 0.05
	return AIR_EXTRA


## B's assist: while the target comes into the right-hand cluster's box (ASSIST_DEAD px in) the camera turns toward it
## — eased in and out, ASSIST_RATE°/s at most, ASSIST_MAX° in all each time — until the target is out of the box; it
## never turns back. A drag stops it at once, and it waits ASSIST_PAUSE s after one; the count starts afresh once the
## target is ASSIST_DEAD px clear of the box (or after a drag).
func _assist(delta: float) -> void:
	if assist_zone.size == Vector2.ZERO:
		return
	var sb := screen_box(focus, 1.0)
	if sb.is_empty():
		return
	var bx: Array = sb["box"]
	var r := Rect2(float(bx[0]), float(bx[1]), float(bx[2]), float(bx[3]))
	if _drag_quiet < ASSIST_PAUSE:
		_assisting = false
		_assist_v = 0.0
		assist_turned = 0.0
		return
	var touching := r.intersects(assist_zone)
	if not _assisting and assist_turned < ASSIST_MAX and r.intersects(assist_zone.grow(-ASSIST_DEAD)):
		_assisting = true
		assists += 1
	if _assisting and not touching:
		_assisting = false
	if not r.intersects(assist_zone.grow(ASSIST_DEAD)):
		assist_turned = 0.0
	var goal := ASSIST_RATE if _assisting and assist_turned < ASSIST_MAX else 0.0
	_assist_v = lerpf(_assist_v, goal, 1.0 - exp(-delta * 8.0))
	var step := minf(_assist_v * delta, ASSIST_MAX - assist_turned)
	if step > 0.0:
		yaw -= deg_to_rad(step) # (a turn to the right: the target moves left on the screen, away from the cluster)
		assist_turned += step


## Variant C's distance: the least, in steps of 5 cm from C_NEAR, at which every framing point of both fighters falls on
## the screen (EDGE px in) and outside every HUD area — C_FAR at most, then up to FALLBACK_MAX if it must.
func fit_distance(b: Basis, center: Vector3, fov: float) -> float:
	var pts := framing_points(target, b)
	if focus and is_instance_valid(focus):
		pts.append_array(framing_points(focus, b))
	var d := C_NEAR
	while d < FALLBACK_MAX:
		if _all_clear(pts, center, b, d, fov):
			return d
		d += 0.05
	return FALLBACK_MAX


func _all_clear(pts: PackedVector3Array, center: Vector3, b: Basis, d: float, fov: float) -> bool:
	var inner := Rect2(Vector2(EDGE, EDGE), screen - Vector2(EDGE, EDGE) * 2.0)
	for p in pts:
		var s := project(p, center, b, d, fov, screen)
		if s.z <= 0.05:
			return false
		var at := Vector2(s.x, s.y)
		if not inner.has_point(at):
			return false
		for r in exclusions:
			if r.has_point(at):
				return false
	return true


## A fighter's framing points: its feet and the top of its head, half a body's width to either side as the camera sees
## it (GPT's v2.1: the projected heads and feet, not the centres).
static func framing_points(n: Node3D, b: Basis) -> PackedVector3Array:
	var r: Variant = n.get("hurt_radius")
	var h: Variant = n.get("hurt_height")
	var half := float(r) if r != null else 0.35
	var tall := (float(h) if h != null else 1.8) + 0.1 # (the hair or the head above the hurt box)
	var o := n.global_position
	var side := b.x * half
	return PackedVector3Array([o - side, o + side, o + Vector3(0, tall, 0) - side, o + Vector3(0, tall, 0) + side])


## Where world point `p` falls on a screen of `screen` canvas px for a camera `d` m out from `center` along `b.z`, its
## vertical field of view `fov` degrees: (x, y, depth in front of the camera — not above 0 behind it).
static func project(p: Vector3, center: Vector3, b: Basis, d: float, fov: float, screen_px: Vector2) -> Vector3:
	var w := b.transposed() * (p - center)
	var depth := d - w.z
	if depth <= 0.05:
		return Vector3(0, 0, depth)
	var tv := tan(deg_to_rad(fov) * 0.5)
	var th := tv * screen_px.x / screen_px.y
	return Vector3((w.x / (depth * th) + 1.0) * 0.5 * screen_px.x, (1.0 - w.y / (depth * tv)) * 0.5 * screen_px.y, depth)


## (QA, the comparison's numbers) where a fighter stands on the screen now: its framing box in canvas px, its height in
## CSS px (`css` per canvas px) and whether the box enters a HUD area.
func screen_box(n: Node3D, css: float) -> Dictionary:
	if n == null or not is_instance_valid(n) or cam == null:
		return {}
	var pts := framing_points(n, cam.global_transform.basis)
	var box := Rect2()
	for i in pts.size():
		var at := cam.unproject_position(pts[i])
		box = Rect2(at, Vector2.ZERO) if i == 0 else box.expand(at)
	var hud := false
	for r in exclusions:
		if r.intersects(box):
			hud = true
	var off := not Rect2(Vector2.ZERO, screen).encloses(box)
	return {"box": [snappedf(box.position.x, 0.1), snappedf(box.position.y, 0.1), snappedf(box.size.x, 0.1),
		snappedf(box.size.y, 0.1)], "h_css": snappedf(box.size.y * css, 0.1), "in_hud": hud, "off_screen": off}
