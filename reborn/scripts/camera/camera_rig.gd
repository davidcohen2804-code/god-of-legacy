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
## overrides a drag. With the fading on, a column across its line to him fades and the camera keeps its distance; only
## its own small volume keeps out of the stone, moved aside eased (GPT's v2.4 — see column_rule); it looks over the
## low walls. A landed
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
##       assist (the camera turns, ASSIST_MAX° at most, once the target's body stays on the right-hand controls —
##       their hit circles and words, GPT's v2.4);
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
const ASSIST_MAX := 12.0 ## degrees each time the target comes onto the controls
const ASSIST_RATE := 30.0 ## degrees a second at most (eased in and out; GPT's v2.4: approved)
const ASSIST_PAUSE := 0.6 ## s after a drag before it may act again (approved)
## (GPT's v2.4) The assist acts on the right-hand controls' own areas — each button's hit circle and each word's box,
## ASSIST_MARGIN CSS px round them — not on the cluster's whole box: only once the target's body has stayed on one of
## them ASSIST_HOLD s (ASSIST_HYST CSS px in), until it is off them; its count starts afresh once the body is
## ASSIST_HYST CSS px clear of them.
const ASSIST_HOLD := 0.15 ## s
const ASSIST_MARGIN := 10.0 ## CSS px (GPT's v2.4: 8–12)
const ASSIST_HYST := 4.0 ## CSS px either side of that edge (the earlier 8 canvas px on the Android phone)
## The exploration framing (no target within range): B since GPT's v2.4 (7.35 m, 35°, 50°); A, the earlier one, in QA.
static var explore := "B"
const EXPLORE_VARIANTS := {
	"A": {"pitch": -36.0, "dist": 8.0, "height": 1.3, "fov": 55.0},
	"B": {"pitch": -35.0, "dist": 7.35, "height": 1.3, "fov": 50.0},
}

const PITCH_MIN := -45.0
const PITCH_MAX := -30.0
const DIST_MIN := 7.0
const DIST_MAX := 9.0
const MIN_PULL := 3.0 ## the closest the earlier rule's pull-in may bring the camera
## (GPT's v2.4) The columns and the camera. While the fading is on, a column across the camera's line to him no longer
## pulls it in — the column fades (OcclusionFader); only the camera's own volume, a ball of BODY_R m, may not enter the
## stone of a column or the arch (each piece taken as an upright cylinder round it: set_solids). When its place would
## put it in one, it stands on that piece's rim instead — the side nearest its place, slid round as its place moves (at
## most SLIDE_V m/s, eased over RIM_T s; it holds its side while its place crosses the piece's axis, so it goes round,
## never through) — until the straight way to its place is clear; then it eases back to it (over about CLEAR_T s, SLIDE_V
## at most). Never a jump, and its volume never in the stone of any piece. `column_rule`
## "sight" (QA, the comparison only — never the game's) and the fading off bring back the earlier rule: pulled in at
## once in front of a column across the line, never closer than MIN_PULL.
static var column_rule := "volume"
const BODY_R := 0.25 ## m
const SLIDE_V := 5.0 ## m/s
const RIM_T := 0.06 ## s
const CLEAR_T := 0.25 ## s
const AXIS_HOLD := 0.3 ## share of the rim's radius: its place this near the piece's axis, the camera holds its side
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
## The right-hand controls the assist keeps the target off (canvas px, ASSIST_MARGIN already round them): each button's
## hit circle (x, y, radius) and each word's box — set_controls(), told by the arena; and ASSIST_HYST in canvas px.
var assist_circles: Array[Vector3] = []
var assist_rects: Array[Rect2] = []
var assist_hyst := 8.0
## (QA) B's corrections now: the aim's rise for a target in the air, the pull back it needed, the assist's turn so far.
var lift := 0.0
var air_pull := 0.0
var assist_turned := 0.0
var assists := 0 ## how many times it has started turning
## (QA) m the camera stands moved out of the stone now (GPT's v2.4: its own volume — see column_rule).
var cleared := 0.0
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
var _on_for := 0.0 ## s the target's body has stayed on the controls (ASSIST_HYST in)
var _solids: Array[Dictionary] = [] ## set_solids(): each piece of stone, an upright cylinder — c (x, z), r, y0, y1
var _slide := -1 ## the piece the camera is going round (its index), else -1
var _phase := 0 ## 0 at its place; 1 on that piece's rim; 2 easing back to its place
var _rim_ang := 0.0 ## where on that rim (radians round its axis, from +x toward +z)
var _spin := 1.0 ## the way round it has been going
var _back := Vector3.ZERO ## (phase 2) its offset from its place, easing away
var _cam_at := Vector3.INF ## where it stood last frame


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
	_on_for = 0.0


## The right-hand controls' own areas (canvas px, TouchControls.control_areas): each button's hit circle (x, y, radius)
## and each word's box; `css` CSS px a canvas px. ASSIST_MARGIN goes round each here.
func set_controls(circles: Array[Vector3], rects: Array[Rect2], css: float) -> void:
	var m := ASSIST_MARGIN / maxf(css, 0.01)
	assist_circles.clear()
	for c in circles:
		assist_circles.append(Vector3(c.x, c.y, c.z + m))
	assist_rects.clear()
	for r in rects:
		assist_rects.append(r.grow(m))
	assist_hyst = ASSIST_HYST / maxf(css, 0.01)


## (GPT's v2.4) The stone the camera's own volume keeps out of: the columns' and the arch's pieces (`groups`: each
## column's, the arch's), which never move — each taken as an upright cylinder round it: a column's shaft, stump or
## plinth as itself; a box (a capital, a pier and its cap, a stone of the arch, a broken top, the fallen drum) by the
## circle round its footprint. The pieces of one group on one axis (a column's plinth, shaft and capital; a pier, its cap
## and base) are one: the widest round that axis, from the lowest to the highest — so its rim does not change as the
## camera rises or sinks past them. Told by the arena once the courtyard is built.
func set_solids(groups: Array) -> void:
	_solids.clear()
	_slide = -1
	_phase = 0
	for g: Array in groups:
		var merged: Array[Dictionary] = []
		for m: MeshInstance3D in g:
			if m == null or m.mesh == null:
				continue
			var xf := m.global_transform
			var w := xf * m.mesh.get_aabb()
			var mid := Vector2(w.get_center().x, w.get_center().z)
			var r := 0.5 * Vector2(w.size.x, w.size.z).length()
			var cyl := m.mesh as CylinderMesh
			if cyl and xf.basis.y.normalized().dot(Vector3.UP) > 0.999:
				r = maxf(cyl.top_radius, cyl.bottom_radius)
			var one: Dictionary = {}
			for s: Dictionary in merged:
				if (s["c"] as Vector2).distance_to(mid) < 0.3:
					one = s
					break
			if one.is_empty():
				merged.append({"c": mid, "r": r, "y0": w.position.y, "y1": w.end.y})
			else:
				one["r"] = maxf(float(one["r"]), r + (one["c"] as Vector2).distance_to(mid))
				one["y0"] = minf(float(one["y0"]), w.position.y)
				one["y1"] = maxf(float(one["y1"]), w.end.y)
		_solids.append_array(merged)


## (GPT's v2.4) Where the camera stands for its place `p` (where its framing puts it) — see column_rule. `snap`: there at
## once (settle()): on the nearest rim if `p` is in a piece.
func _stand(p: Vector3, delta: float, snap: bool) -> Vector3:
	if _solids.is_empty():
		_cam_at = p
		return p
	# the piece whose rim holds `p` (the deepest in)
	var hold := -1
	var deepest := 0.0
	for i in _solids.size():
		var s: Dictionary = _solids[i]
		if p.y < float(s["y0"]) - BODY_R or p.y > float(s["y1"]) + BODY_R:
			continue
		var into := float(s["r"]) + BODY_R - Vector2(p.x, p.z).distance_to(s["c"])
		if into > deepest:
			deepest = into
			hold = i
	if snap:
		_phase = 0
		_slide = -1
		_back = Vector3.ZERO
		_cam_at = _off_stone(p, BODY_R)
		return _cam_at
	if hold >= 0 and (_phase != 1 or hold != _slide):
		# into one: onto its rim where the camera stands round it now
		var from := _cam_at if _cam_at != Vector3.INF else p
		_slide = hold
		_phase = 1
		_rim_ang = (Vector2(from.x, from.z) - (_solids[hold]["c"] as Vector2)).angle()
	var at := p
	if _phase == 1:
		var s: Dictionary = _solids[_slide]
		var c: Vector2 = s["c"]
		var rim := float(s["r"]) + BODY_R
		if hold != _slide:
			# out of it: still round its rim while its place is behind the piece from the camera, then straight back
			var a := c + Vector2.from_angle(_rim_ang) * rim
			if (Vector2(p.x, p.z) - a).dot(a - c) >= 0.0:
				_phase = 2
				_back = Vector3(a.x, p.y, a.y) - p
		if _phase == 1:
			var v := Vector2(p.x, p.z) - c
			var want := v.angle() if v.length() > AXIS_HOLD * rim else _rim_ang
			var d := wrapf(want - _rim_ang, -PI, PI)
			if absf(d) > deg_to_rad(170.0):
				d = _spin * absf(d) # (straight across: the way it has been going)
			elif absf(d) > 0.0001:
				_spin = signf(d)
			var most := SLIDE_V / rim * delta
			_rim_ang += clampf(d * (1.0 - exp(-delta / RIM_T)), -most, most)
			var a := c + Vector2.from_angle(_rim_ang) * rim
			at = Vector3(a.x, p.y, a.y)
	if _phase == 2:
		var next := _back * exp(-delta * 3.0 / CLEAR_T)
		var moved := (next - _back).length()
		if moved > SLIDE_V * delta:
			next = _back + (next - _back) * (SLIDE_V * delta / moved)
		_back = next
		at = p + _back
		if _back.length() < 0.001:
			_phase = 0
			_slide = -1
			_back = Vector3.ZERO
			at = p
	_cam_at = _off_stone(at, BODY_R) # (easing back, or round another piece's rim: never into any)
	return _cam_at


## `p` moved straight out of any piece whose rim of `r` m holds it (from its axis; toward the aim from the axis itself).
func _off_stone(p: Vector3, r: float) -> Vector3:
	var out := p
	for s: Dictionary in _solids:
		if out.y < float(s["y0"]) - r or out.y > float(s["y1"]) + r:
			continue
		var c: Vector2 = s["c"]
		var v := Vector2(out.x, out.z) - c
		var need := float(s["r"]) + r
		if v.length() >= need:
			continue
		var dir := v.normalized() if v.length() > 0.0001 else (Vector2(_pos.x, _pos.z) - c).normalized()
		if dir == Vector2.ZERO:
			dir = Vector2.RIGHT
		var a := c + dir * need
		out = Vector3(a.x, out.y, a.y)
	return out


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
	var sight := column_rule == "sight" or not OcclusionFader.enabled
	if sight:
		# (the rule before GPT's v2.4 — QA's comparison, and with the fading off) kept in front of a column across its
		# line to him (layer 16), at once, never closer than MIN_PULL; low walls are below its line, and the courtyard's
		# invisible bounds are not on that layer
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
	# (GPT's v2.4) its own volume out of the stone — round a column's rim, never through it, never a jump (see
	# column_rule); still looking at its aim, like the shoulder
	var at := want_pos
	if sight:
		_phase = 0
		_slide = -1
		_cam_at = want_pos
	else:
		at = _stand(want_pos, delta, snap)
	cleared = at.distance_to(want_pos)
	if cleared > 0.0005:
		want_pos = at
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


## B's assist: once the target's body (feet to head, a body's width either side) has stayed on the right-hand controls —
## a button's hit circle or a word's box, ASSIST_MARGIN round them, assist_hyst px in — for ASSIST_HOLD s, the camera
## turns toward it — eased in and out, ASSIST_RATE°/s at most, ASSIST_MAX° in all each time — until the body is off
## them; it never turns back. A drag stops it at once, and it waits ASSIST_PAUSE s after one; the count starts afresh
## once the body is assist_hyst px clear of them (or after a drag).
func _assist(delta: float) -> void:
	if assist_circles.is_empty() and assist_rects.is_empty():
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
		_on_for = 0.0
		return
	var touching := on_controls(r, 0.0)
	_on_for = _on_for + delta if on_controls(r, -assist_hyst) else 0.0
	if not _assisting and assist_turned < ASSIST_MAX and _on_for >= ASSIST_HOLD:
		_assisting = true
		assists += 1
	if _assisting and not touching:
		_assisting = false
	if not on_controls(r, assist_hyst):
		assist_turned = 0.0
	var goal := ASSIST_RATE if _assisting and assist_turned < ASSIST_MAX else 0.0
	_assist_v = lerpf(_assist_v, goal, 1.0 - exp(-delta * 8.0))
	var step := minf(_assist_v * delta, ASSIST_MAX - assist_turned)
	if step > 0.0:
		yaw -= deg_to_rad(step) # (a turn to the right: the target moves left on the screen, away from the cluster)
		assist_turned += step


## Whether box `r` (canvas px) comes onto the controls the assist keeps clear: a button's hit circle or a word's box
## (ASSIST_MARGIN round them already), `grow` px further out — negative: that far in.
func on_controls(r: Rect2, grow: float) -> bool:
	for c in assist_circles:
		var near := Vector2(clampf(c.x, r.position.x, r.end.x), clampf(c.y, r.position.y, r.end.y))
		if near.distance_to(Vector2(c.x, c.y)) < c.z + grow:
			return true
	for q in assist_rects:
		var g := q.grow(grow)
		if g.size.x > 0.0 and g.size.y > 0.0 and g.intersects(r):
			return true
	return false


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
