extends RefCounted
## The Training Automaton's reactions (TrainingAutomaton) on its fixed tick, stepped by hand (its own physics tick is
## switched off; its moves are collision queries, so they stop at solid things): a launch rises 2.2 m and lands 0.9 s
## later at 30, 60 and 120 ticks a second; something above it ends the rise early; it lies a moment, rises and stands;
## blows in the air reach the juggle cap, and so does a long time in the air, and after it no launch until it is up
## again; the chain's capture holds it still, repeated captures hold it less, then not at all, until the run resets; a
## pull reaches its point — or stops where a wall blocks it, never passing through — and is refused unless it is held;
## a pushing blow pushes it half a metre, a light one not; hit-stop holds it still, in the air too; at 0 HP it falls
## and rises again whole; and the data says which targets the pull and the launch can move.

const DT := 1.0 / 60.0

var _nodes: Array[Node] = []


func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


func _auto(at: Vector3 = Vector3.ZERO) -> TrainingAutomaton:
	var a := TrainingAutomaton.create()
	_tree().root.add_child(a)
	a.set_physics_process(false) # (after it joined the tree: _ready switches it on) — the test steps it
	a.place(at)
	_nodes.append(a)
	return a


func _block(centre: Vector3, size: Vector3) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.collision_layer = 1
	var s := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	s.shape = box
	b.add_child(s)
	_tree().root.add_child(b)
	b.global_position = centre
	_nodes.append(b)
	return b


func _clear() -> void:
	for n in _nodes:
		if is_instance_valid(n):
			n.free()
	_nodes.clear()
	for n in _tree().root.get_children():
		if n is Label3D: # (the damage numbers)
			n.free()


func _run(a: TrainingAutomaton, seconds: float, dt: float = DT) -> void:
	for i in int(round(seconds / dt)):
		a.step(dt)


## Step until it leaves `state` (at most `limit` s); returns the time it took.
func _until_not(a: TrainingAutomaton, state: String, dt: float = DT, limit: float = 6.0) -> float:
	var t := 0.0
	while a.state == state and t < limit:
		a.step(dt)
		t += dt
	return t


func test_a_launch_rises_2_2_m_and_lands_0_9_s_later_at_any_tick_rate() -> String:
	for hz: int in [30, 60, 120]:
		var dt := 1.0 / hz
		var a := _auto()
		if not a.launch(2.2, 0.9):
			_clear()
			return "a standing automaton could not be launched"
		_until_not(a, "air", dt)
		var apex := a.last_apex
		var air := a.last_airtime
		var st := a.state
		var y := a.global_position.y
		_clear()
		print("[AUTOMATON] %d Hz: apex %.3f m, %.3f s in the air" % [hz, apex, air])
		if absf(apex - 2.2) > 0.02:
			return "at %d Hz it rose to %.3f m (want 2.2)" % [hz, apex]
		if absf(air - 0.9) > dt + 0.001:
			return "at %d Hz it came down after %.3f s (want 0.9)" % [hz, air]
		if st != "down" or absf(y) > 0.001:
			return "at %d Hz after landing: %s at y %.3f (want down on the floor)" % [hz, st, y]
	return ""


func test_it_lies_a_moment_then_rises_and_stands() -> String:
	var a := _auto()
	a.launch(2.2, 0.9)
	_until_not(a, "air")
	var lying := _until_not(a, "down")
	var rising := _until_not(a, "getup")
	var st := a.state
	var hp := a.hp
	_clear()
	if absf(lying - 0.8) > DT * 1.5 or absf(rising - 1.22) > DT * 1.5:
		return "lay %.3f s and rose for %.3f s (want 0.8 and 1.22)" % [lying, rising]
	if st != "stand" or hp != 150:
		return "after rising: %s, %d HP" % [st, hp]
	return ""


func test_something_above_ends_the_rise_early() -> String:
	var a := _auto()
	_block(Vector3(0, 3.0, 0), Vector3(3, 0.4, 3)) # its underside 2.8 m up: the head (1.8 m) meets it 1.0 m up
	await _tree().physics_frame # (the physics server takes in the new bodies)
	a.launch(2.2, 0.9)
	_until_not(a, "air")
	var apex := a.last_apex
	var air := a.last_airtime
	var st := a.state
	_clear()
	if apex < 0.9 or apex > 1.02:
		return "under a ceiling 2.8 m up it rose to %.3f m (want ~1.0)" % apex
	if air >= 0.85 or st != "down":
		return "under the ceiling: %.3f s in the air, then %s (want a shorter fall, then down)" % [air, st]
	return ""


func test_air_blows_reach_the_juggle_cap() -> String:
	var a := _auto()
	a.launch(2.2, 0.9)
	_run(a, 0.1)
	for i in 3:
		a.take_hit(5, 0.1, 0.0, Vector3.FORWARD)
		_run(a, 0.05)
	if not a.juggle_protected():
		_clear()
		return "three blows in the air did not reach the juggle cap"
	_until_not(a, "air")
	var relaunch_down := a.can_launch()
	_until_not(a, "down")
	_until_not(a, "getup")
	var relaunch_up := a.can_launch()
	_clear()
	if relaunch_down:
		return "it could be launched again while still protected"
	if not relaunch_up:
		return "back on its feet it still could not be launched"
	# a long flight reaches the cap by time alone
	var b := _auto()
	b.launch(4.0, 2.0)
	_run(b, 1.45)
	var early := b.juggle_protected()
	_run(b, 0.1)
	var late := b.juggle_protected()
	_clear()
	if early or not late:
		return "the cap by time: protected at 1.45 s %s, at 1.55 s %s (want no, yes)" % [early, late]
	return ""


func test_captures_hold_less_then_not_at_all() -> String:
	var a := _auto()
	var holds: Array[String] = []
	for i in 4:
		var h := a.capture(0.7)
		holds.append("%.3f" % h)
		if h > 0.0:
			var at := a.global_position
			a.take_hit(5, 0.1, 0.5, Vector3.FORWARD) # a blow while held: no push, still held
			_run(a, h * 0.5)
			if a.state != "captured" or a.global_position.distance_to(at) > 0.001:
				_clear()
				return "a held automaton moved or slipped free: %s, %.3f m" % [a.state, a.global_position.distance_to(at)]
			_until_not(a, "captured")
			_until_not(a, "stagger")
	if ", ".join(PackedStringArray(holds)) != "0.700, 0.350, 0.175, 0.000":
		_clear()
		return "successive captures held it %s s (want 0.7, 0.35, 0.175, then immune)" % ", ".join(PackedStringArray(holds))
	_run(a, 12.1)
	var again := a.capture(0.7)
	_clear()
	return "" if is_equal_approx(again, 0.7) else "12 s after the last capture it was held %.3f s (want 0.7)" % again


func test_a_pull_reaches_its_point() -> String:
	var a := _auto()
	a.capture(0.7)
	_run(a, 0.1)
	if not a.pull_to(Vector3(0, 0, 3), 0.3):
		_clear()
		return "a held automaton refused the pull"
	var took := _until_not(a, "pulled")
	var pull := a.last_pull.duplicate()
	var z := a.global_position.z
	_clear()
	if pull.get("result", "") != "arrived" or absf(z - 3.0) > 0.01:
		return "the pull ended %s at z %.3f (want arrived at 3)" % [pull, z]
	if absf(took - 0.3) > DT * 1.5:
		return "the pull took %.3f s (want 0.3)" % took
	return ""


func test_a_wall_stops_a_pull_and_nothing_passes_through() -> String:
	var a := _auto()
	_block(Vector3(0, 1.5, 2.0), Vector3(4, 3, 0.4)) # a wall across its way, its near face at z 1.8
	await _tree().physics_frame
	a.capture(0.7)
	a.pull_to(Vector3(0, 0, 4), 0.3) # (fast: 13 m/s on average, up to 26 m/s — 0.45 m a tick)
	_until_not(a, "pulled")
	var pull := a.last_pull.duplicate()
	var z := a.global_position.z
	_clear()
	if pull.get("result", "") != "blocked":
		return "a pull into a wall ended %s at z %.3f" % [pull, z]
	if z > 1.8 - 0.3 + 0.01 or z < 1.2:
		return "it stopped at z %.3f (its body against the wall's face: want ~1.5)" % z
	return ""


func test_the_pull_is_refused_unless_it_is_held() -> String:
	var a := _auto()
	var ok := a.pull_to(Vector3(0, 0, 3), 0.3)
	var st := a.state
	_clear()
	return "" if not ok and st == "stand" else "a pull without a capture: %s, %s" % [ok, st]


func test_a_pushing_blow_pushes_half_a_metre_and_a_light_one_not() -> String:
	var a := _auto()
	a.take_hit(10, 0.08, 0.0, Vector3(0, 0, 1))
	_run(a, 0.4)
	var after_light := a.global_position.z
	a.take_hit(18, 0.2, 0.5, Vector3(0, 0, 1))
	_run(a, 0.4)
	var push := a.last_push
	var pushes := a.pushes
	_clear()
	if absf(after_light) > 0.001:
		return "a light blow moved it %.3f m" % after_light
	if pushes != 1 or absf(push - 0.5) > 0.01:
		return "a pushing blow: %d pushes, %.3f m (want one of 0.5 m)" % [pushes, push]
	return ""


func test_hit_stop_holds_it_still_in_the_air() -> String:
	var a := _auto()
	a.launch(2.2, 0.9)
	_run(a, 0.2)
	var y := a.global_position.y
	a.freeze_for(0.1)
	_run(a, 0.1)
	var held := a.global_position.y
	_until_not(a, "air")
	var air := a.last_airtime
	_clear()
	if absf(held - y) > 0.0001:
		return "it moved %.4f m during hit-stop" % absf(held - y)
	if absf(air - 0.9) > DT + 0.001:
		return "hit-stop changed its time in the air to %.3f s (the arc's clock stops with it)" % air
	return ""


func test_at_zero_hp_it_falls_and_rises_again_whole() -> String:
	var a := _auto()
	a.take_hit(150, 0.08, 0.0, Vector3.FORWARD)
	if a.is_alive() or a.state != "defeated":
		_clear()
		return "at 0 HP: alive %s, %s" % [a.is_alive(), a.state]
	var down := _until_not(a, "defeated")
	var hp := a.hp
	_until_not(a, "getup")
	var st := a.state
	_clear()
	if absf(down - 2.6) > DT * 1.5 or hp != 150 or st != "stand":
		return "after %.3f s down: %d HP, then %s (want 2.6 s, 150, stand)" % [down, hp, st]
	return ""


func test_the_data_says_what_the_pull_and_the_launch_move() -> String:
	var auto := TargetData.of("training_automaton")
	var dummy := TargetData.of("training_dummy")
	if not (auto.get("pullable", false) and auto.get("launchable", false)) or int(auto.get("hp", 0)) != 150:
		return "the automaton's data: %s" % [auto]
	if dummy.get("pullable", true) or dummy.get("launchable", true):
		return "the dummy's data lets the pull or the launch move it: %s" % [dummy]
	if float(dummy.get("stagger", 1.0)) > 0.3:
		return "a resisting target's stagger is over 0.3 s"
	var a := _auto()
	a.launch(2.2, 0.9)
	_run(a, 0.1)
	var while_air := a.can_capture() or a.can_launch()
	_clear()
	return "" if not while_air else "in the air it could be captured or launched again"
