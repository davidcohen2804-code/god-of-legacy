class_name SwordSweep
extends RefCounted
## The katana's hit test. The blade — its path through the active window baked from the move itself
## (AttackData.blade_at) — is swept through exactly the part of the window that this tick covered (MeleeState.swept),
## in small steps (48 per window), and every position of the blade (a segment from near the guard to the tip, about
## 6 cm thick) is tested against the target's upright capsule. Sweeping the whole slice between the previous and the
## current tick means a fast blade cannot pass through a target unseen between ticks, and the hit follows the visible
## swing — where the blade actually goes, high or low, near or far (GPT's M3 review) — not a simplified arc.
## A target that moved during the tick is tested along its own movement too (GPT's v1.2 review: the blade against the
## target's final position alone is not continuous): at each step of the blade the capsule stands where it was at
## that moment of the tick, from where it stood when the tick began to where it ended — with more steps when it moved
## far, so a body thrown or dragged fast cannot slip through a cut between two ticks.

const STEPS := 48 ## blade positions per active window
const BLADE_RADIUS := 0.03
const TARGET_STEP := 0.1 ## at most this far (m) between two positions of a moving target


## The yaw (degrees, relative to the attacker's facing, + = his left) and distance of `point` from the attacker.
static func bearing(attacker: Vector3, facing: float, point: Vector3) -> Vector2:
	var d := point - attacker
	var lx := d.x * cos(facing) - d.z * sin(facing)
	var lz := d.x * sin(facing) + d.z * cos(facing)
	return Vector2(rad_to_deg(atan2(lx, lz)), Vector2(lx, lz).length())


## Does `a`'s blade, swept from fraction span.x to span.y of its active window, touch the upright capsule standing at
## `centre` (its base) with `radius` and `height`? The attacker stands at `attacker` facing `facing` (radians). A target
## that moved during this tick passes `centre_from`, where its base stood when the tick began.
static func hits(a: AttackData, attacker: Vector3, facing: float, span: Vector2, centre: Vector3, radius: float,
		height: float, centre_from: Vector3 = Vector3.INF) -> bool:
	return first_contact(a, attacker, facing, span, centre, radius, height, centre_from) >= 0.0


## Where in this tick (0..1: from its start to its end) the blade swept over `span` first touches the capsule — moving
## from `centre_from` to `centre` through the same tick when it moved — or -1 when it does not. The blade and the body
## are taken at the same moments of the tick, so the answer says when the blow arrives, not only whether (the resolver
## asks what the defender was doing at that moment: Shadow Step's defensive window, a roll's).
static func first_contact(a: AttackData, attacker: Vector3, facing: float, span: Vector2, centre: Vector3,
		radius: float, height: float, centre_from: Vector3 = Vector3.INF) -> float:
	if span.x < 0.0 or a == null:
		return -1.0
	var start := centre_from if centre_from.is_finite() else centre
	var basis := Basis(Vector3.UP, facing)
	var low := Vector3(0, minf(radius, height * 0.5), 0)
	var high := Vector3(0, maxf(height - radius, height * 0.5), 0)
	var n := maxi(maxi(1, ceili((span.y - span.x) * STEPS)), ceili(start.distance_to(centre) / TARGET_STEP))
	for i in n + 1:
		var f := float(i) / n
		var blade := a.blade_at(lerpf(span.x, span.y, f))
		var p := attacker + basis * (blade[0] as Vector3)
		var q := attacker + basis * (blade[1] as Vector3)
		var c := start.lerp(centre, f)
		if segment_distance(p, q, c + low, c + high) <= radius + BLADE_RADIUS:
			return f
	return -1.0


## The shortest distance between segments p1–q1 and p2–q2 (Ericson, Real-Time Collision Detection 5.1.9).
static func segment_distance(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3) -> float:
	var d1 := q1 - p1
	var d2 := q2 - p2
	var r := p1 - p2
	var a := d1.dot(d1)
	var e := d2.dot(d2)
	var f := d2.dot(r)
	var s := 0.0
	var t := 0.0
	if a <= 1e-9 and e <= 1e-9:
		return p1.distance_to(p2)
	if a <= 1e-9:
		t = clampf(f / e, 0.0, 1.0)
	else:
		var c := d1.dot(r)
		if e <= 1e-9:
			s = clampf(-c / a, 0.0, 1.0)
		else:
			var b := d1.dot(d2)
			var denom := a * e - b * b
			s = clampf((b * f - c * e) / denom, 0.0, 1.0) if absf(denom) > 1e-12 else 0.0
			t = (b * s + f) / e
			if t < 0.0:
				t = 0.0
				s = clampf(-c / a, 0.0, 1.0)
			elif t > 1.0:
				t = 1.0
				s = clampf((b - c) / a, 0.0, 1.0)
	return (p1 + d1 * s).distance_to(p2 + d2 * t)
