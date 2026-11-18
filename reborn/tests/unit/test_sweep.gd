extends RefCounted
## The katana's sweep test (SwordSweep): bearings around the attacker, reach, the band of heights, the slice of the
## arc swept in one tick — a blade that crosses a target between two ticks still hits it (no tunnelling) — and the
## whole chain, sweep included, giving the same hits at 30, 60 and 144 ticks a second.


func _strike(arc_from: float, arc_to: float, reach: float = 1.5) -> AttackData:
	return AttackData.make("t", 0.1, 0.08, 0.1, 10, 0.03, 0.08, 0.0, "", 0.0, 1.0, Vector2(arc_from, arc_to), reach, 0.0)


func _near(a: float, b: float, tol: float = 0.5) -> bool:
	return absf(a - b) <= tol


func test_bearings_left_right_and_ahead() -> String:
	# facing +Z (0): +X is his left (+)
	var b := SwordSweep.bearing(Vector3.ZERO, 0.0, Vector3(1, 0, 1))
	if not _near(b.x, 45.0):
		return "a point ahead-left at %s (want +45°)" % b.x
	b = SwordSweep.bearing(Vector3.ZERO, 0.0, Vector3(-1, 0, 1))
	if not _near(b.x, -45.0):
		return "a point ahead-right at %s (want -45°)" % b.x
	# facing -Z (PI): the origin straight ahead of a fighter 2 m south of it
	b = SwordSweep.bearing(Vector3(0, 0, 2), PI, Vector3.ZERO)
	if not (_near(b.x, 0.0, 0.01) and _near(b.y, 2.0, 0.001)):
		return "straight ahead at %s" % b
	# facing +X (PI/2): -Z is his left
	b = SwordSweep.bearing(Vector3.ZERO, PI * 0.5, Vector3(0, 0, -1))
	if not _near(b.x, 90.0):
		return "facing +X, -Z at %s (want +90°)" % b.x
	b = SwordSweep.bearing(Vector3.ZERO, 0.0, Vector3(0, 0, -1))
	if not _near(absf(b.x), 180.0):
		return "a point behind at %s" % b.x
	return ""


func test_the_arc_hits_ahead_and_not_behind() -> String:
	var a := _strike(-70, 15)
	if not SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, 0, 1.4), 0.38, 1.9):
		return "a target ahead was not hit"
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, 0, -1.4), 0.38, 1.9):
		return "a target behind was hit"
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(1.4, 0, 0), 0.38, 1.9):
		return "a target 90° to his left was hit by a cut that ends 15° left"
	return ""


func test_reach_and_height() -> String:
	var a := _strike(-70, 15, 1.45)
	if not SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, 0, 1.8), 0.38, 1.9):
		return "a target within reach + its radius (1.8 m) was missed"
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, 0, 1.9), 0.38, 1.9):
		return "a target beyond reach + its radius (1.9 m) was hit"
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, 2.5, 1.2), 0.38, 1.9):
		return "a target standing 2.5 m higher was hit"
	if not SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, -1.0, 1.2), 0.38, 1.9):
		return "a target 1 m lower (reaching up into the cut) was missed"
	return ""


## The arc from 70° right to 70° left; a target 40° to the left, 1.4 m away, covers about 24°..56° of it (fractions
## 0.67..0.90 of the swing).
func test_only_the_slice_over_the_target_hits() -> String:
	var a := _strike(-70, 70)
	var c := Vector3(1.4 * sin(deg_to_rad(40.0)), 0, 1.4 * cos(deg_to_rad(40.0)))
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0.0, 0.6), c, 0.38, 1.9):
		return "a slice that ends before the target hit it"
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0.95, 1.0), c, 0.38, 1.9):
		return "a slice that starts past the target hit it"
	if not SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0.6, 0.95), c, 0.38, 1.9):
		return "the slice over the target missed it"
	return ""


## One long tick sweeps the blade from 80° right to 80° left: neither end is near the target ahead, yet the swept
## slice passes through it — it must hit (sampling only the two blade positions would not).
func test_no_tunnelling_through_a_target_between_ticks() -> String:
	var a := _strike(-80, 80)
	if not SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0.0, 1.0), Vector3(0, 0, 1.4), 0.38, 1.9):
		return "a target crossed inside one tick's slice was not hit"
	return ""


## The chain (presses at 0, 0.30 and 0.62 s) against a target 1.5 m ahead, ticked at 30, 60 and 144 Hz: the same
## three hits, 10 + 12 + 18, every time.
func test_the_same_hits_at_any_tick_rate() -> String:
	var target := Vector3(0, 0, 1.5)
	for hz in [30.0, 60.0, 144.0]:
		var dt: float = 1.0 / hz
		var s := MeleeState.new()
		var presses := [0.0, 0.30, 0.62]
		var buffered := -1.0
		var t := 0.0
		var hits: Array = []
		while t < 1.6:
			t += dt
			while not presses.is_empty() and t >= float(presses[0]):
				presses.pop_front()
				buffered = 0.12
			if buffered > 0.0:
				if s.attack_pressed():
					buffered = -1.0
				elif s.hitstop <= 0.0:
					buffered -= dt
			s.step(dt)
			if s.swept.x >= 0.0 and SwordSweep.hits(s.current(), Vector3.ZERO, 0.0, s.swept, target, 0.38, 1.9):
				if s.hit_confirmed(7):
					hits.append([s.step_index + 1, s.current().damage])
			s.events.clear()
		if hits != [[1, 10], [2, 12], [3, 18]]:
			return "at %d Hz the hits were %s" % [int(hz), hits]
	return ""


## The edges of each basic strike's shape (GPT's M3 review: edge-of-range, side angles, vertical separation): just
## inside every edge hits, just outside misses.
func test_the_edges_of_each_basic_strike() -> String:
	var r := 0.38
	for a in AttackData.samurai_basics():
		var mid := (a.arc_from + a.arc_to) * 0.5
		var at := func(yaw: float, dist: float, y: float = 0.0) -> Vector3:
			return Vector3(dist * sin(deg_to_rad(yaw)), y, dist * cos(deg_to_rad(yaw)))
		var hit := func(p: Vector3) -> bool: return SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), p, r, 1.9)
		# range
		if not hit.call(at.call(mid, a.reach + r - 0.02)):
			return "%s: a target just inside its reach was missed" % a.id
		if hit.call(at.call(mid, a.reach + r + 0.02)):
			return "%s: a target just beyond its reach was hit" % a.id
		# the arc's two ends, 1.2 m away (the target's own half-width counts)
		var half := rad_to_deg(asin(r / 1.2))
		for end in [maxf(a.arc_from, a.arc_to), minf(a.arc_from, a.arc_to)]:
			var out := 1.0 if end == maxf(a.arc_from, a.arc_to) else -1.0
			if not hit.call(at.call(end + out * (half - 1.0), 1.2)):
				return "%s: a target just inside the arc's end at %.0f° was missed" % [a.id, end]
			if hit.call(at.call(end + out * (half + 1.0), 1.2)):
				return "%s: a target just past the arc's end at %.0f° was hit" % [a.id, end]
		# heights: a target standing on a step (its base just under the cut's top) / just above it
		if not hit.call(at.call(mid, 1.2, a.height.y - 0.05)):
			return "%s: a target whose base is just under the cut's top was missed" % a.id
		if hit.call(at.call(mid, 1.2, a.height.y + 0.05)):
			return "%s: a target standing above the cut was hit" % a.id
		# a target below (its top just above / just under the cut's bottom)
		if not hit.call(at.call(mid, 1.2, a.height.x - 1.9 + 0.05)):
			return "%s: a target reaching just into the cut from below was missed" % a.id
		if hit.call(at.call(mid, 1.2, a.height.x - 1.9 - 0.05)):
			return "%s: a target entirely below the cut was hit" % a.id
	return ""


## A target crossing in front of him while the strike runs (moving targets, GPT's M3 review): one hit, once — whether
## it runs against the blade's travel or with it (then only if the blade catches it).
func test_a_moving_target_is_hit_once() -> String:
	for speed in [-4.0, 4.0]:
		var s := MeleeState.new()
		s.attack_pressed() # Basic 1: from 72° right to 15° left of him
		var pos := Vector3(1.0 if speed < 0.0 else -1.0, 0, 1.2)
		var hits := 0
		var dt := 1.0 / 60.0
		for i in 40:
			s.step(dt)
			pos.x += speed * dt
			if s.swept.x >= 0.0 and SwordSweep.hits(s.current(), Vector3.ZERO, 0.0, s.swept, pos, 0.38, 1.9):
				if s.hit_confirmed(9):
					hits += 1
			s.events.clear()
		if hits != 1:
			return "a target crossing at %+.0f m/s was hit %d times" % [speed, hits]
	return ""
