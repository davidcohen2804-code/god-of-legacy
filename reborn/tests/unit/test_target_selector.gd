extends RefCounted
## M4.2-A2 (GPT's v2.1 target-bar rule): the combo's target first, then the one he is fighting, then the nearest; a
## change between equals waits 0.4 s, a better-ranked one takes over at once, a bystander never steals it, and the bar
## clears when nothing qualifies.

var a := RefCounted.new()
var b := RefCounted.new()


func _c(node: Object, dist: float, alive: bool = true) -> Dictionary:
	return {"node": node, "alive": alive, "dist": dist}


func test_the_nearest_within_range_and_none_beyond() -> String:
	var s := TargetSelector.new()
	var got := [s.pick([_c(a, 5.0), _c(b, 3.0)], null, {}, 0.016) == b, s.pick([_c(a, 9.5), _c(b, 12.0)], null, {}, 0.016) == null]
	return "" if got == [true, true] else "nearest within 9 m: %s, none beyond 9 m: %s" % got


func test_a_bystander_never_steals_the_one_he_fights() -> String:
	var s := TargetSelector.new()
	s.pick([_c(a, 4.0)], null, {a: 0.5}, 0.016)
	var held := true
	for i in 120: # 2 s: b walks in nearer, a stays his opponent
		if s.pick([_c(a, 4.0), _c(b, 1.5)], null, {a: 0.5 + i * 0.016}, 0.016) != a:
			held = false
	return "" if held else "a nearer bystander took the target from the one he was fighting"


func test_equals_switch_only_after_the_retention() -> String:
	var s := TargetSelector.new()
	s.pick([_c(a, 3.0), _c(b, 3.2)], null, {}, 0.016) # a: the nearer
	var flips := 0
	var t := 0.0
	var at := -1.0
	while t < 1.0:
		t += 0.05
		# b now a little nearer
		var got := s.pick([_c(a, 3.2), _c(b, 3.0)], null, {}, 0.05)
		if got == b and at < 0.0:
			at = t
		if got != a and got != b:
			flips += 1
	if at < TargetSelector.RETAIN - 0.001 or at > TargetSelector.RETAIN + 0.06:
		return "the nearer of two equals took over after %.2f s (want %.1f)" % [at, TargetSelector.RETAIN]
	# and a brief swap back and forth never moves it
	var s2 := TargetSelector.new()
	s2.pick([_c(a, 3.0), _c(b, 3.2)], null, {}, 0.016)
	var moved := false
	for i in 30:
		var nearer_b := i % 6 < 3 # b nearer for 0.15 s at a time
		if s2.pick([_c(a, 3.2 if nearer_b else 3.0), _c(b, 3.0 if nearer_b else 3.2)], null, {}, 0.05) != a:
			moved = true
	return "" if not moved and flips == 0 else "flickered between two equals (moved %s, %d bad picks)" % [moved, flips]


func test_the_combo_target_ranks_first_and_takes_over_at_once() -> String:
	var s := TargetSelector.new()
	s.pick([_c(a, 2.0), _c(b, 5.0)], null, {a: 0.2}, 0.016)
	var got := s.pick([_c(a, 2.0), _c(b, 5.0)], b, {a: 0.2}, 0.016)
	return "" if got == b and s.rank == 3 else "with an opportunity open against b: %s, rank %d (want b at once, 3)" % [got, s.rank]


func test_a_dead_target_clears_the_bar() -> String:
	var s := TargetSelector.new()
	s.pick([_c(a, 2.0)], null, {a: 0.1}, 0.016)
	var got := s.pick([_c(a, 2.0, false)], null, {a: 0.2}, 0.016)
	return "" if got == null and s.rank == 0 else "the target died: %s (want none)" % [got]
