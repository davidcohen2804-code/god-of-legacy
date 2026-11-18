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
