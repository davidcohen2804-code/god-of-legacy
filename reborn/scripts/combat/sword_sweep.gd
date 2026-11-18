class_name SwordSweep
extends RefCounted
## The katana's sweep as a volume: on each tick the blade covers the part of its arc between two fractions of the
## active window (MeleeState.swept) — a horizontal fan from the attacker's centre out to the tip's reach, within the
## band of heights it cuts. A target (an upright capsule: centre, radius, height) is hit when any part of it lies in
## that fan. Testing the whole slice between the previous and the current tick means a fast blade cannot pass
## through a target unseen between ticks.


## The yaw (degrees, relative to the attacker's facing, + = his left) and distance of `point` from the attacker.
static func bearing(attacker: Vector3, facing: float, point: Vector3) -> Vector2:
	var d := point - attacker
	var lx := d.x * cos(facing) - d.z * sin(facing)
	var lz := d.x * sin(facing) + d.z * cos(facing)
	return Vector2(rad_to_deg(atan2(lx, lz)), Vector2(lx, lz).length())


## Does the slice of `a`'s arc between fractions `span.x` and `span.y` touch the capsule at `centre` (its base on the
## ground) of `radius` and `height`?
static func hits(a: AttackData, attacker: Vector3, facing: float, span: Vector2, centre: Vector3, radius: float,
		height: float) -> bool:
	if span.x < 0.0:
		return false
	var b := bearing(attacker, facing, centre)
	var dist := b.y
	if dist > a.reach + radius:
		return false
	var base_y := centre.y - attacker.y
	if base_y + height < a.height.x or base_y > a.height.y:
		return false
	var y0 := lerpf(a.arc_from, a.arc_to, span.x)
	var y1 := lerpf(a.arc_from, a.arc_to, span.y)
	# the capsule's angular half-width seen from the attacker (all of it when he stands inside it)
	var half := 180.0 if dist <= radius else rad_to_deg(asin(clampf(radius / dist, 0.0, 1.0)))
	return b.x + half >= minf(y0, y1) and b.x - half <= maxf(y0, y1)
