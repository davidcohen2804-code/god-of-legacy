extends RefCounted
## The katana's sweep test (SwordSweep): bearings around the attacker; a blade swept through a slice of its window
## hits what it passes and nothing it does not — reach, the arc's ends, a target standing higher or lower; a blade that
## crosses a target between two ticks still hits it (no tunnelling); a target crossing the cut is hit once, and one
## thrown through it within a single tick is hit too (its own movement through the tick is swept); and the
## whole chain, with the Samurai's real baked blades, gives the same hits at 30, 60 and 144 ticks a second.
## (Most cases use a made-up level blade from 0.35 m to its reach at 1 m height, so the geometry is exact: a target of
## radius 0.38 is touched when its axis comes within 0.41 m of the blade.)


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
	if not SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, -0.8, 1.2), 0.38, 1.9):
		return "a target 0.8 m lower (its top reaching up into the cut) was missed"
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


## The blade's edges (GPT's M3 review: edge-of-range, side angles, vertical separation) — just inside each edge
## hits, just outside misses. A level blade at 1 m height, 0.35–1.5 m from him, turning from 60° right to 60° left;
## the target's radius 0.38 plus the blade's 0.03: contact within 0.41 m.
func test_the_blade_edges() -> String:
	var a := _strike(-60, 60, 1.5)
	var hit := func(p: Vector3) -> bool: return SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0, 1), p, 0.38, 1.9)
	var at := func(yaw: float, dist: float, y: float = 0.0) -> Vector3:
		return Vector3(dist * sin(deg_to_rad(yaw)), y, dist * cos(deg_to_rad(yaw)))
	# reach: the tip passes 0.41 m short of a target at 1.91 m
	if not hit.call(at.call(0.0, 1.89)) or hit.call(at.call(0.0, 1.93)):
		return "the reach edge is not at 1.91 m"
	# the arc's ends: at 1 m a target is touched up to asin(0.41) = 24.2° past the end
	for end in [60.0, -60.0]:
		var out := signf(end)
		if not hit.call(at.call(end + out * 23.2, 1.0)) or hit.call(at.call(end + out * 25.2, 1.0)):
			return "the side edge past %.0f° is not at 24°" % end
	# above: a target whose capsule axis starts 0.41 m over the blade (base 1.03 m) is the edge
	if not hit.call(at.call(0.0, 1.0, 1.0)) or hit.call(at.call(0.0, 1.0, 1.06)):
		return "the upper edge is not at a base of 1.03 m"
	# below: a target whose axis ends 0.41 m under the blade (base -0.93 m) is the edge
	if not hit.call(at.call(0.0, 1.0, -0.9)) or hit.call(at.call(0.0, 1.0, -0.96)):
		return "the lower edge is not at a base of -0.93 m"
	return ""


## A target crossing in front of him while the strike runs (moving targets, GPT's M3 review): one hit, once — running
## against the blade's travel and with it.
func test_a_moving_target_is_hit_once() -> String:
	for speed in [-4.0, 4.0]:
		var one: Array[AttackData] = [_strike(-72, 15, 1.45)]
		var s := MeleeState.new(one)
		s.attack_pressed()
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


## A target thrown or dragged fast through the cut between two ticks (GPT's v1.2 review: the blade against where the
## target ended alone is not continuous): tested along its own movement through the tick it is hit; where it ended
## alone, it is not; and one crossing behind him while the blade is ahead is not hit at all.
func test_a_target_moving_fast_through_the_cut_is_hit() -> String:
	var a := _strike(-10, 10, 1.5)
	# 4 m in one tick, crossing straight ahead of him while the blade passes there (yaw -10° to +10°)
	var from := Vector3(-2.0, 0, 1.0)
	var to := Vector3(2.0, 0, 1.0)
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0.0, 1.0), to, 0.38, 1.9):
		return "(the case is wrong: where it ended is already within the blade's reach)"
	if not SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0.0, 1.0), to, 0.38, 1.9, from):
		return "a target crossing the cut within the tick was missed"
	if SwordSweep.hits(a, Vector3.ZERO, 0.0, Vector2(0.0, 1.0), Vector3(2, 0, -1.0), 0.38, 1.9, Vector3(-2, 0, -1.0)):
		return "a target crossing behind him was hit"
	return ""


## The segment distance itself, on cases worked by hand.
func test_segment_distance() -> String:
	var d := SwordSweep.segment_distance(Vector3(0, 1, 0), Vector3(2, 1, 0), Vector3(1, 0, 1), Vector3(1, 2, 1))
	if not is_equal_approx(d, 1.0):
		return "crossing segments 1 m apart measured %s" % d
	d = SwordSweep.segment_distance(Vector3(0, 0, 0), Vector3(1, 0, 0), Vector3(3, 0, 0), Vector3(4, 0, 0))
	if not is_equal_approx(d, 2.0):
		return "collinear segments 2 m apart measured %s" % d
	d = SwordSweep.segment_distance(Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(-1, 3, 0), Vector3(1, 3, 0))
	if not is_equal_approx(d, 3.0):
		return "a point 3 m from a segment measured %s" % d
	return ""
