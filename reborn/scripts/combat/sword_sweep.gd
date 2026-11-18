class_name SwordSweep
extends RefCounted
## The katana's hit test. The blade — its path through the active window baked from the move itself
## (AttackData.blade_at) — is swept through exactly the part of the window that this tick covered (MeleeState.swept),
## in small steps (48 per window), and every position of the blade (a segment from near the guard to the tip, about
## 6 cm thick) is tested against the target's upright capsule. Sweeping the whole slice between the previous and the
## current tick means a fast blade cannot pass through a target unseen between ticks, and the hit follows the visible
## swing — where the blade actually goes, high or low, near or far (GPT's M3 review) — not a simplified arc.

const STEPS := 48 ## blade positions per active window
const BLADE_RADIUS := 0.03


## The yaw (degrees, relative to the attacker's facing, + = his left) and distance of `point` from the attacker.
static func bearing(attacker: Vector3, facing: float, point: Vector3) -> Vector2:
	var d := point - attacker
	var lx := d.x * cos(facing) - d.z * sin(facing)
	var lz := d.x * sin(facing) + d.z * cos(facing)
	return Vector2(rad_to_deg(atan2(lx, lz)), Vector2(lx, lz).length())


## Does `a`'s blade, swept from fraction span.x to span.y of its active window, touch the upright capsule standing at
## `centre` (its base) with `radius` and `height`? The attacker stands at `attacker` facing `facing` (radians).
static func hits(a: AttackData, attacker: Vector3, facing: float, span: Vector2, centre: Vector3, radius: float,
		height: float) -> bool:
	if span.x < 0.0 or a == null:
		return false
	var basis := Basis(Vector3.UP, facing)
	var low := centre + Vector3(0, minf(radius, height * 0.5), 0)
	var high := centre + Vector3(0, maxf(height - radius, height * 0.5), 0)
	var n := maxi(1, ceili((span.y - span.x) * STEPS))
	for i in n + 1:
		var blade := a.blade_at(lerpf(span.x, span.y, float(i) / n))
		var p := attacker + basis * (blade[0] as Vector3)
		var q := attacker + basis * (blade[1] as Vector3)
		if segment_distance(p, q, low, high) <= radius + BLADE_RADIUS:
			return true
	return false


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
