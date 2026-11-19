class_name ChainShot
extends RefCounted
## The Phantom Chain's head in flight (GPT's v1.2 decisions): thrown straight along the Samurai's facing at the moment
## of release — locked then: no homing, no correction — at 24 m/s, a 0.25 m sphere, for up to 9 m. Each tick its step
## is swept: against the world (the courtyard's columns, braziers and walls stop it) by a shape cast, and against every
## target's capsule along both their movements through the tick, in steps of at most 10 cm — so it cannot skip a
## narrow or fast target. Whichever it touches first along the step ends its flight there. Pure logic but for the cast
## (the tests drive it with or without a world).
##
## flying → hit (it holds its target while the capture lasts) | blocked (the world stopped it) | spent (full length,
## nothing touched) → done (the chain is let go or drawn back).

const WORLD_MASK := 1 | 8
const STEP := 0.1

var action: AttackData
var origin := Vector3.ZERO
var dir := Vector3.FORWARD
var head := Vector3.ZERO
var travelled := 0.0
var speed := 24.0
var radius := 0.25
var length := 9.0
## flying | hit | blocked | spent | done
var state := "flying"
var target: Node3D
## Seconds since it stopped flying (the chain draws back over a moment after a miss).
var since := 0.0

var _sphere := SphereShape3D.new()


func _init(a: AttackData, p_origin: Vector3, p_dir: Vector3) -> void:
	action = a
	origin = p_origin
	head = p_origin
	dir = Vector3(p_dir.x, 0.0, p_dir.z).normalized()
	var p := a.projectile if a else {}
	speed = float(p.get("speed", 24.0))
	radius = float(p.get("radius", 0.25))
	length = float(p.get("range", 9.0))
	_sphere.radius = radius


## One tick of flight against `targets` (Node3D in the "hurtbox" group: hurt_radius, hurt_height and, when they move
## themselves, prev_position) and the world (`space`; none in some tests). Returns the state after it.
func advance(dt: float, targets: Array, space: PhysicsDirectSpaceState3D = null) -> String:
	if state != "flying":
		since += dt
		return state
	var step := minf(speed * dt, length - travelled)
	var from := head
	var to := head + dir * step
	var wall := 1.0
	if space and step > 0.0:
		var q := PhysicsShapeQueryParameters3D.new()
		q.shape = _sphere
		q.transform = Transform3D(Basis(), from)
		q.motion = to - from
		q.collision_mask = WORLD_MASK
		var r := space.cast_motion(q)
		if r.size() == 2 and r[0] < 1.0:
			wall = r[0]
	var n := maxi(1, ceili(step / STEP))
	var best := INF
	var hit: Node3D = null
	for t in targets:
		var node := t as Node3D
		if node == null:
			continue
		var c1 := node.global_position
		var prev: Variant = node.get("prev_position")
		var c0: Vector3 = prev if prev is Vector3 else c1
		var tr := float(node.get("hurt_radius"))
		var th := float(node.get("hurt_height"))
		var low := Vector3(0, minf(tr, th * 0.5), 0)
		var high := Vector3(0, maxf(th - tr, th * 0.5), 0)
		for i in n + 1:
			var f := float(i) / n
			if f > wall or f >= best:
				break
			var p := from.lerp(to, f)
			var c := c0.lerp(c1, f)
			if SwordSweep.segment_distance(p, p, c + low, c + high) <= radius + tr:
				best = f
				hit = node
				break
	if hit:
		head = from.lerp(to, best)
		travelled += step * best
		target = hit
		state = "hit"
	elif wall < 1.0:
		head = from.lerp(to, wall)
		travelled += step * wall
		state = "blocked"
	else:
		head = to
		travelled += step
		if travelled >= length - 0.0001:
			state = "spent"
	if state != "flying":
		since = 0.0
	return state


## Let go of the chain (the hold ended, or the target escaped or fell).
func let_go() -> void:
	if state != "done":
		state = "done"
		since = 0.0
