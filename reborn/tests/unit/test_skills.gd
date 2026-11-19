extends RefCounted
## The Samurai's skills on the fixed tick (GPT's v1.2 decisions), with real nodes in the tree — his body and combat
## controller, the Training Automaton, the dummy — stepped by hand (their own physics ticks switched off; one physics
## frame is let run where a test builds walls, so the physics server has them):
## Phantom Chain — the soft aim turns him through startup only; thrown, it flies straight, locked at release (a target
## that steps aside after the release is missed), up to 9 m and no further, stopped by the world; it captures what it
## reaches (8 damage), the same at 30, 60 and 120 ticks a second; a narrow target crossing its path fast within one
## tick is still caught; a target that resists takes the damage and a short stagger, and nothing opens; the cooldown
## starts with the throw and a refused press starts none. Chain Pull — opened by the capture only, its window running
## out (or closing when the hold ends); pressed, it drags the target to 1.6 m in front of him in clamp(d / 14, 0.25,
## 0.6) s and deals 6 on arrival; a low wall in the way stops the target there and the pull deals nothing; a press
## while he is still busy waits for the graph's cancel point (50 % of the chain's recovery); the windows hold through
## his hit-stop. The conditional buttons with three opportunities at once: two buttons and the overflow chip.

const DT := 1.0 / 60.0

var _nodes: Array[Node] = []
var _notices: Array[String] = []


func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## The Samurai at `at` facing `facing` (radians; 0 = +Z), and his combat controller.
func _samurai(at: Vector3 = Vector3.ZERO, facing: float = 0.0) -> CombatController:
	var f := Fighter.new()
	f.setup(CharacterVisual.create())
	_tree().root.add_child(f)
	f.set_physics_process(false)
	f.global_position = at
	f.facing = facing
	var c := CombatController.new()
	c.fighter = f
	_tree().root.add_child(c)
	c.notice.connect(func(t: String) -> void: _notices.append(t))
	_nodes.append_array([c, f])
	return c


func _automaton(at: Vector3) -> TrainingAutomaton:
	var a := TrainingAutomaton.create()
	_tree().root.add_child(a)
	a.set_physics_process(false)
	a.place(at)
	_nodes.append(a)
	return a


func _dummy(at: Vector3) -> TrainingDummy:
	var d := TrainingDummy.create()
	_tree().root.add_child(d)
	d.set_physics_process(false)
	d.global_position = at
	_nodes.append(d)
	return d


func _block(centre: Vector3, size: Vector3) -> void:
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


func _clear() -> void:
	for n in _nodes:
		if is_instance_valid(n):
			n.free()
	_nodes.clear()
	_notices.clear()
	for n in _tree().root.get_children():
		if n is Label3D:
			n.free()


## One world tick: the automaton moves first (as in the game: priority -15), then his combat (-10).
func _tick(c: CombatController, autos: Array, seconds: float, dt: float = DT) -> void:
	for i in int(round(seconds / dt)):
		for a in autos:
			(a as TrainingAutomaton).step(dt)
		c.tick(dt, Vector3.ZERO)


## Tick until the thrown chain stops flying (at most 2 s); returns its state.
func _resolve(c: CombatController, autos: Array, dt: float = DT) -> String:
	var t := 0.0
	while t < 2.0 and (c.shot == null or c.shot.state == "flying"):
		_tick(c, autos, dt, dt)
		t += dt
	return c.shot.state if c.shot else "none"


func test_the_chain_captures_what_it_reaches_at_any_tick_rate() -> String:
	for hz: int in [30, 60, 120]:
		var dt := 1.0 / hz
		var c := _samurai()
		var a := _automaton(Vector3(0, 0, 6))
		if not c.try_press("skill1"):
			_clear()
			return "the CHAIN press was refused"
		var cd := c.melee.cooldown_left("phantom_chain")
		var st := _resolve(c, [a], dt)
		var travelled := c.shot.travelled if c.shot else -1.0
		var res := [st, a.state, a.hp, c.legacy.has("chain_pull", a.get_instance_id()),
			String(c.conditionals()["slots"][0].get("ability", ""))]
		_clear()
		print("[SKILLS] chain at %d Hz: %s, %.3f m flown" % [hz, res, travelled])
		if not is_equal_approx(cd, 6.0):
			return "the cooldown at the throw's start was %.2f s (want 6)" % cd
		if res != ["hit", "captured", 142, true, "chain_pull"]:
			return "at %d Hz the chain ended %s (want hit, captured, 142 HP, PULL on the first button)" % [hz, res]
		# its head meets the capsule 0.55 m short of the target's axis: 6 - 0.45 (thrown from 0.45 m ahead) - 0.55
		if absf(travelled - 5.0) > 0.11:
			return "at %d Hz it flew %.3f m before the hit (want 5.0)" % [hz, travelled]
	return ""


func test_the_soft_aim_turns_him_through_startup_only() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(3, 0, 5)) # 31° to his left, 5.8 m
	c.try_press("skill1")
	_tick(c, [a], 0.2)
	var turned := rad_to_deg(c.fighter.facing)
	var st := _resolve(c, [a])
	var held := a.state
	_clear()
	if absf(turned - rad_to_deg(atan2(3.0, 5.0))) > 2.0:
		return "through startup he turned to %.1f° (want the target's 31°)" % turned
	return "" if st == "hit" and held == "captured" else "aimed at it, the chain ended %s, the target %s" % [st, held]


func test_a_target_that_steps_aside_after_the_release_is_missed() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(0, 0, 6))
	c.try_press("skill1")
	_tick(c, [a], 0.25) # (released at 0.22 s: locked)
	a.place(Vector3(1.5, 0, 6)) # it steps aside
	var st := _resolve(c, [a])
	var travelled := c.shot.travelled
	var res := [a.state, a.hp, c.legacy.open.size()]
	_clear()
	if st != "spent" or absf(travelled - 9.0) > 0.01:
		return "the chain followed: %s after %.2f m (want its full 9 m, nothing touched)" % [st, travelled]
	return "" if res == ["stand", 150, 0] else "a missed chain still did something: %s" % [res]


func test_the_chain_reaches_9_m_and_no_further() -> String:
	var c := _samurai()
	var near := _automaton(Vector3(0, 0, 9.6)) # its capsule within the chain's 9 m
	var st := ""
	c.try_press("skill1")
	st = _resolve(c, [near])
	var hit_near := st == "hit"
	_clear()
	c = _samurai()
	var far := _automaton(Vector3(0, 0, 10.3)) # just beyond
	c.try_press("skill1")
	st = _resolve(c, [far])
	var far_state := far.state
	_clear()
	if not hit_near:
		return "a target 9.6 m ahead was not reached"
	return "" if st == "spent" and far_state == "stand" else "a target 10.3 m ahead: the chain %s, it %s" % [st, far_state]


func test_a_wall_stops_the_chain() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(0, 0, 6))
	_block(Vector3(0, 1.5, 3.0), Vector3(4, 3, 0.4))
	await _tree().physics_frame
	c.try_press("skill1")
	var st := _resolve(c, [a])
	var head := c.shot.head.z
	var held := a.state
	_clear()
	if st != "blocked" or held != "stand":
		return "behind a wall: the chain %s, the target %s (want blocked, untouched)" % [st, held]
	return "" if absf(head - 2.55) < 0.06 else "the chain's head stopped at z %.3f (want against the wall: 2.55)" % head


func test_a_narrow_fast_target_crossing_within_one_tick_is_caught() -> String:
	var a := _automaton(Vector3.ZERO)
	a.hurt_radius = 0.1
	var data := AttackData.get_attack("phantom_chain")
	# the head goes from z 2.0 to 2.4 this tick while the target crosses its path from x -1 to +1 at z 2.2
	var shot := ChainShot.new(data, Vector3(0, 1.25, 2.0), Vector3(0, 0, 1))
	a.global_position = Vector3(1, 0, 2.2)
	a.prev_position = Vector3(-1, 0, 2.2)
	var st := shot.advance(DT, [a])
	var only_end := ChainShot.new(data, Vector3(0, 1.25, 2.0), Vector3(0, 0, 1))
	a.prev_position = a.global_position
	var st_end := only_end.advance(DT, [a])
	_clear()
	if st != "hit":
		return "a narrow target crossing the chain's path within the tick was skipped (%s)" % st
	return "" if st_end == "flying" else "(the case is wrong: where it ended is already in the path)"


func test_the_dummy_resists_the_chain() -> String:
	var c := _samurai()
	var d := _dummy(Vector3(0, 0, 5))
	c.try_press("skill1")
	var t := 0.0
	while t < 2.0 and (c.shot == null or c.shot.state == "flying"):
		c.tick(DT, Vector3.ZERO)
		t += DT
	var res := [c.shot.state if c.shot else "none", d.hp, c.legacy.open.size(), _notices.duplicate()]
	_clear()
	return "" if res == ["done", 142, 0, ["Resists the chain"]] else \
		"on the dummy: %s (want the chain let go, 142 HP, nothing opened, 'Resists the chain')" % [res]


func test_a_refused_press_starts_no_cooldown() -> String:
	var c := _samurai()
	c.try_press("skill1")
	_tick(c, [], 1.0)
	var before := c.melee.cooldown_left("phantom_chain")
	var again := c.try_press("skill1")
	_tick(c, [], 0.5)
	var after := c.melee.cooldown_left("phantom_chain")
	_clear()
	if again:
		return "a second CHAIN press during its cooldown was taken"
	return "" if absf(after - (before - 0.5)) < 0.02 else "the cooldown went %.2f → %.2f (a refused press restarted it?)" % [before, after]


## Throw at an automaton 6 m ahead and hold until it is captured; returns the controller (with the automaton held).
func _capture(a: TrainingAutomaton) -> CombatController:
	var c := _samurai()
	c.try_press("skill1")
	_resolve(c, [a])
	return c


func test_the_pull_drags_it_to_1_6_m_ahead_in_its_time() -> String:
	var a := _automaton(Vector3(0, 0, 6))
	var c := _capture(a)
	if not c.try_conditional(0):
		_clear()
		return "the PULL button held nothing after the capture"
	var t := 0.0
	var started := -1.0
	while t < 2.0 and not c.last_pull.has("result"):
		_tick(c, [a], DT)
		t += DT
		if started < 0.0 and a.state == "pulled":
			started = t
	var pull := c.last_pull.duplicate()
	var z := a.global_position.z
	var hp := a.hp
	_clear()
	if pull.get("result", "") != "arrived" or absf(z - 1.6) > 0.02:
		return "the pull ended %s with it at z %.3f (want arrived, 1.6 m in front of him)" % [pull, z]
	var want := clampf(4.4 / 14.0, 0.25, 0.6)
	if absf(float(pull.get("time", 0.0)) - want) > DT * 1.5:
		return "the drag took %.3f s (want %.3f for 4.4 m)" % [float(pull.get("time", 0.0)), want]
	return "" if hp == 136 else "after the chain and the pull it has %d HP (want 150 - 8 - 6)" % hp


func test_a_low_wall_in_the_way_stops_the_pull_and_it_deals_nothing() -> String:
	var a := _automaton(Vector3(0, 0, 6))
	_block(Vector3(0, 0.4, 3.5), Vector3(4, 0.8, 0.3)) # the chain passes over it (1.0–1.5 m up); the body does not
	await _tree().physics_frame
	var c := _capture(a)
	var held := a.state
	c.try_conditional(0)
	var t := 0.0
	while t < 2.0 and not c.last_pull.has("result"):
		_tick(c, [a], DT)
		t += DT
	_tick(c, [a], 0.2)
	var pull := c.last_pull.duplicate()
	var z := a.global_position.z
	var res := [held, pull.get("result", ""), a.hp, _notices.has("Pull blocked")]
	_clear()
	if res != ["captured", "blocked", 142, true]:
		return "a pull into a low wall: %s (want captured, blocked, 142 HP — no pull damage — and the notice)" % [res]
	return "" if z > 3.65 + 0.29 and z < 3.65 + 0.32 else "it stopped at z %.3f (want against the wall's face: 3.95)" % z


func test_the_pull_window_runs_out() -> String:
	var a := _automaton(Vector3(0, 0, 6))
	var c := _capture(a)
	_tick(c, [a], 0.75)
	var open := c.legacy.open.size()
	var took := c.try_conditional(0)
	_clear()
	return "" if open == 0 and not took else "0.75 s after the capture: %d opportunities, a press taken %s" % [open, took]


func test_a_press_while_he_is_busy_waits_for_the_cancel_point() -> String:
	var a := _automaton(Vector3(0, 0, 2.5)) # close: caught early in his recovery
	var c := _samurai()
	c.try_press("skill1")
	_resolve(c, [a])
	var phase := String(MeleeState.Phase.keys()[c.melee.phase])
	var rec_t := c.melee.t
	var queued := c.try_conditional(0)
	var waiting := String(c.conditionals()["queued"])
	var switched := -1.0
	var t := 0.0
	while t < 1.0 and switched < 0.0:
		var before := c.melee.t
		_tick(c, [a], DT)
		t += DT
		if c.melee.action and c.melee.action.id == "chain_pull":
			switched = before # the chain's recovery time when the pull cut it (the queued press goes first in a tick)
	_clear()
	if phase != "RECOVERY" or rec_t >= 0.115:
		return "(the case is wrong: the capture came at %s %.3f s)" % [phase, rec_t]
	if not queued or waiting != "chain_pull":
		return "a PULL press during the chain's early recovery was not kept (queued %s, %s)" % [queued, waiting]
	if switched < 0.115 or switched > 0.115 + DT * 1.5:
		return "the pull cut the chain's recovery at %.3f s (want from 50 %%: 0.115 s)" % switched
	return ""


func test_the_windows_hold_through_his_hit_stop() -> String:
	var a := _automaton(Vector3(0, 0, 6))
	var c := _capture(a)
	var left0 := float(c.legacy.open[0]["left"])
	c.melee.hitstop = 0.1 + DT * 0.5
	_tick(c, [a], 0.1)
	var left1 := float(c.legacy.open[0]["left"]) if not c.legacy.open.is_empty() else -1.0
	_tick(c, [a], 0.1)
	var left2 := float(c.legacy.open[0]["left"]) if not c.legacy.open.is_empty() else -1.0
	_clear()
	if absf(left1 - left0) > 0.0001:
		return "the window ran through hit-stop: %.3f → %.3f" % [left0, left1]
	return "" if absf(left2 - (left1 - 0.1)) < 0.002 else "after hit-stop the window ran %.3f → %.3f" % [left1, left2]


func test_three_at_once_show_two_buttons_and_the_overflow() -> String:
	var tc := TouchControls.new()
	tc.input = PlayerInput.new()
	_tree().root.add_child(tc)
	tc.size = Vector2(1280, 720)
	tc._layout()
	tc.set_conditional("cond1", "COUNTER", true, 0.8)
	tc.set_conditional("cond2", "PULL", true, 0.4)
	tc.set_waiting(1)
	var keys := ["btn_cond1", "btn_cond2", "btn_more"]
	var rects := {}
	for k in keys:
		rects[k] = QA._rects.get(k, [])
	var err := ""
	for k in keys:
		if (rects[k] as Array).size() != 4:
			err = "%s is not on screen with three opportunities" % k
	if err == "":
		for i in keys.size():
			for j in range(i + 1, keys.size()):
				var p: Array = rects[keys[i]]
				var q: Array = rects[keys[j]]
				var d := Vector2(p[0] + p[2] * 0.5, p[1] + p[3] * 0.5).distance_to(Vector2(q[0] + q[2] * 0.5, q[1] + q[3] * 0.5))
				if d < (p[2] + q[2]) * 0.5:
					err = "%s and %s overlap" % [keys[i], keys[j]]
	if err == "":
		var m: Array = rects["btn_more"]
		tc._down(5, Vector2(m[0] + m[2] * 0.5, m[1] + m[3] * 0.5))
		if not tc.input.peek("cond_more"):
			err = "a tap on the overflow chip did not ask for the waiting opportunity"
	tc.set_waiting(0)
	var gone := not QA._rects.has("btn_more")
	tc.input.free()
	tc.free()
	if err == "" and not gone:
		err = "the overflow chip stayed with nothing waiting"
	return err


## The body through an air action, as its physics tick would move it here (no obstacles in these tests): the leap's
## commanded velocity, then gravity down to the floor.
func _body(f: Fighter, dt: float) -> void:
	if f.frozen:
		return
	if f.action_lock and f.action_air:
		f.velocity = f.action_velocity
	elif f.global_position.y > 0.0:
		f.velocity.y -= f.gravity * dt
	else:
		f.velocity = Vector3.ZERO
	f.global_position += f.velocity * dt
	f.global_position.y = maxf(0.0, f.global_position.y)


func _tick_all(c: CombatController, autos: Array, seconds: float) -> void:
	for i in int(round(seconds / DT)):
		for a in autos:
			(a as TrainingAutomaton).step(DT)
		c.tick(DT, Vector3.ZERO)
		_body(c.fighter, DT)


## Rising Slash at an automaton just ahead: tick until it is in the air (at most 1 s).
func _rise(c: CombatController, a: TrainingAutomaton) -> bool:
	if not c.try_press("skill3"):
		return false
	var t := 0.0
	while t < 1.0 and a.state != "air":
		_tick_all(c, [a], DT)
		t += DT
	return a.state == "air"


func test_rising_slash_launches_and_opens_the_pursuit() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(0, 0, 1.3))
	var up := _rise(c, a)
	var res := [up, a.hp, c.legacy.has("aerial_pursuit", a.get_instance_id()),
		String(c.conditionals()["slots"][0].get("ability", "")), c.melee.cooldown_left("rising_slash") > 4.0]
	_clear()
	return "" if res == [true, 134, true, "aerial_pursuit", true] else \
		"Rising Slash on an automaton 1.3 m ahead: %s (want launched, 134 HP, PURSUE on the first button, cooldown 5 s)" % [res]


func test_the_pursuit_leaps_and_strikes_it_in_the_air() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(0, 0, 1.3))
	if not _rise(c, a):
		_clear()
		return "the automaton was not launched"
	c.try_conditional(0) # (pressed at once: it waits for half the Rising Slash's recovery)
	var t := 0.0
	var top := 0.0
	var hit_in_air := false
	var hp0 := a.hp
	while t < 1.5 and a.hp == hp0:
		_tick_all(c, [a], DT)
		t += DT
		top = maxf(top, c.fighter.global_position.y)
		hit_in_air = a.hp < hp0 and a.state == "air"
	var res := [a.hp, hit_in_air, a.info()["juggle_hits"], c.fighter.state]
	_tick_all(c, [a], 1.0)
	var landed := c.fighter.global_position.y
	_clear()
	if res[0] != 120 or not res[1] or int(res[2]) != 1:
		return "the pursuit: %s (want 120 HP, struck in the air, one aerial follow-up)" % [res]
	if top < 0.9:
		return "he struck from %.2f m up (want a visible leap: at least 0.9 m)" % top
	return "" if landed < 0.01 else "he did not come down (%.2f m)" % landed


func test_a_missed_rising_slash_opens_nothing() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(0, 0, 3.0)) # beyond the cut
	c.try_press("skill3")
	_tick_all(c, [a], 0.8)
	var res := [a.state, a.hp, c.legacy.open.size()]
	_clear()
	return "" if res == ["stand", 150, 0] else "a Rising Slash that missed: %s" % [res]


func test_the_dummy_resists_the_launch() -> String:
	var c := _samurai()
	var d := _dummy(Vector3(0, 0, 1.3))
	c.try_press("skill3")
	var t := 0.0
	while t < 1.0 and d.hp == 150:
		c.tick(DT, Vector3.ZERO)
		t += DT
	var res := [d.hp, c.legacy.open.size(), _notices.has("Resists the launch")]
	_clear()
	return "" if res == [134, 0, true] else "Rising Slash on the dummy: %s (want 134 HP, nothing opened, 'Resists the launch')" % [res]


func test_the_pursuit_is_refused_out_of_reach() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(0, 0, 1.3))
	if not _rise(c, a):
		_clear()
		return "the automaton was not launched"
	var y := a.global_position.y
	a.place(Vector3(0, y, 5.5)) # 5.5 m away in the air (beyond 4 m)
	c.try_conditional(0)
	_tick_all(c, [a], 0.4)
	var res := [c.melee.action.id if c.melee.action else "", c.fighter.state, _notices.has("Out of reach"), a.hp]
	_clear()
	return "" if res == ["rising_slash", "ground", true, 134] else "a pursuit 5.5 m away: %s (want refused, still on the ground)" % [res]


## A pursuit pressed late, when the target has fallen low: still a visible jump (at least 0.6 m), and the chop still
## reaches it before it lands.
func test_a_late_pursuit_still_leaps() -> String:
	var c := _samurai()
	var a := _automaton(Vector3(0, 0, 1.3))
	if not _rise(c, a):
		_clear()
		return "the automaton was not launched"
	var t := 0.0
	while t < 1.0 and float(a.info()["airtime"]) == 0.0 and a.state == "air" and a.predict(0.3).y > 0.95:
		_tick_all(c, [a], DT)
		t += DT
	var hp0 := a.hp
	c.try_conditional(0)
	var top := 0.0
	t = 0.0
	while t < 1.0 and a.hp == hp0:
		_tick_all(c, [a], DT)
		t += DT
		top = maxf(top, c.fighter.global_position.y)
	var hp := a.hp
	_clear()
	if top < 0.55:
		return "a late pursuit rose only %.2f m (want a visible jump: 0.6 m)" % top
	return "" if hp == hp0 - 14 else "a late pursuit did not land its chop (%d → %d)" % [hp0, hp]
