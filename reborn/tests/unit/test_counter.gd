extends RefCounted
## M4 Stage C — defensive counterplay (GPT's v1.3 direction and v1.4 evasion rule B), with real nodes in the tree — his
## body and combat controller and the Training Automaton — stepped by hand in the game's order each frame: the
## automaton (priority -15), his combat (-10), his body (0), then its blade resolved against him (+10). His body moves
## straight by its velocity, or — where walls matter — by its own physics (60 Hz, on a floor).
## The automaton's sweep: GPT's 550 / 130 / 400 ms and 15 damage, its direction locked 300 ms into the startup, its
## cadence; its blow on a Samurai who stays (350 ms of hitstun, a 0.35 m push, his opportunities closed); a blow cuts its
## attack off; a wall stops its step into the cut.
## Shadow Step: 4 m in its 180 ms at 30, 60 and 120 Hz, along the stick or backward when it is idle, his facing kept, its
## defensive window the first 120 ms of the movement; a wall stops it.
## The evasion (rule B): the blade crossing his Shadow Origin inside the window — and only then — is a genuine evasion:
## attack_evaded once, Shadow Counter open 600 ms against that attacker; the window of presses that earn it is about
## 120 ms wide at every tick rate. A step too early (the window over before the blade comes) or too late (struck in the
## startup), a step with no attack, an attack out of reach of where he stood, an attack cut off before its blade came,
## a roll (it avoids: nothing opens) and a step blocked at once by a wall earn nothing.
## Shadow Counter: it waits for the step's cancel point, dashes at most 4 m toward its attacker (stopping short, never
## behind it), and its blade must connect (14); the opportunity closes when it runs out, when he is struck, or when its
## attacker is defeated; a wall stops the dash and the strike then misses.

const DT := 1.0 / 60.0
const D := 1.7 ## he stands this far in front of the automaton

var _nodes: Array[Node] = []
var _notices: Array[String] = []
var _evaded: Array = [] ## [attacker id, defender id, attack id] per attack_evaded


func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## The Samurai at `at` facing the automaton at the origin (facing π: toward -Z), and his combat controller.
func _samurai(at: Vector3 = Vector3(0, 0, D), facing: float = PI) -> CombatController:
	var f := Fighter.new()
	f.setup(CharacterVisual.create())
	f.position = at # (placed before it joins the physics space: no stale entry where it was made)
	_tree().root.add_child(f)
	f.set_physics_process(false)
	f.prev_position = at
	f.facing = facing
	var c := CombatController.new()
	c.fighter = f
	_tree().root.add_child(c)
	c.notice.connect(func(t: String) -> void: _notices.append(t))
	c.attack_evaded.connect(func(a: int, d: int, id: String) -> void: _evaded.append([a, d, id]))
	_nodes.append_array([c, f])
	return c


## An automaton at `at` facing `facing` (0: +Z, toward him), sparring with `c` — its own sparring script off unless
## asked (the tests start its attacks).
func _automaton(c: CombatController, at: Vector3 = Vector3.ZERO, facing: float = 0.0, spar: bool = false) -> TrainingAutomaton:
	var a := TrainingAutomaton.create()
	a.position = at
	_tree().root.add_child(a)
	a.set_physics_process(false)
	a.place(at)
	a.facing = facing
	a.foe = c
	a.watch = c.fighter
	a.spar = spar
	_nodes.append(a)
	return a


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


## A floor at y 0 and a few physics frames for him to settle on it (his own physics: walls and rolls).
func _floor(c: CombatController, autos: Array) -> void:
	_block(Vector3(0, -0.5, 0), Vector3(60, 1, 60))
	await _tree().physics_frame
	await _tree().physics_frame
	for i in 6:
		_frame(c, autos, DT, Vector3.ZERO, true)


func _clear() -> void:
	for n in _nodes:
		if is_instance_valid(n):
			n.free()
	_nodes.clear()
	_notices.clear()
	_evaded.clear()
	for n in _tree().root.get_children():
		if n is Label3D:
			n.free()


## His body by its velocity, no collision (as the Fighter moves it while an action drives it). (No physics frame runs
## meanwhile: bodies are placed where they belong before they join the physics space, or a frame is let run.)
func _body(f: Fighter, dt: float) -> void:
	f.prev_position = f.global_position
	if f.frozen:
		return
	f.velocity = Vector3(f.action_velocity.x, 0.0, f.action_velocity.z) if f.action_lock else Vector3.ZERO
	f.global_position += f.velocity * dt


## One world frame in the game's order. `press`: a press made in it, after the automata moved (the arena's armed press
## and the keys reach the controller then): "skill2", "dodge" or "" for none.
func _frame(c: CombatController, autos: Array, dt: float, stick: Vector3 = Vector3.ZERO, real: bool = false,
		press: String = "") -> void:
	for a in autos:
		(a as TrainingAutomaton).step(dt)
	match press:
		"skill2":
			c.try_press("skill2")
		"dodge":
			if c.can_dodge():
				c.on_dodge()
				c.fighter.dodge(stick)
	c.tick(dt, stick)
	if real:
		c.fighter._physics_process(dt)
	else:
		_body(c.fighter, dt)
	for a in autos:
		(a as TrainingAutomaton).strike_check()


## The automaton attacks now; when its attack has run `press_at` s he presses `key` (Shadow Step, or a roll) with the
## stick at `stick`; the exchange runs `length` s. Returns how its attack ended against him.
func _exchange(c: CombatController, a: TrainingAutomaton, press_at: float, stick: Vector3 = Vector3.ZERO,
		dt: float = DT, key: String = "skill2", real: bool = false, length: float = 1.2) -> String:
	if not a.attack():
		return "it did not attack"
	var pressed := press_at < 0.0
	var t := 0.0
	while t < length - 1e-6:
		var now := ""
		# (the attack's time as the controller sees it this frame: after the automaton's step)
		if not pressed and a.attack_time() + dt >= press_at - 1e-6:
			pressed = true
			now = key
		_frame(c, [a], dt, stick, real, now)
		t += dt
	return a.last_attack


func _opened(c: CombatController, a: TrainingAutomaton) -> bool:
	return c.legacy.has("shadow_counter", a.get_instance_id())


# --- the automaton's sweep -------------------------------------------------------------------------------------------


func test_the_sweep_is_gpts() -> String:
	var a := AttackData.automaton_attack("sweep")
	if a == null:
		return "no sweep in data/abilities/automaton.json"
	var got := [a.startup, a.active, a.recovery, a.damage, a.reaction, a.knockback, a.blade_tip.size()]
	return "" if got == [0.55, 0.13, 0.4, 15, 0.35, 0.35, 13] else \
		"the sweep: %s (want 550/130/400 ms, 15, 0.35 s hitstun, 0.35 m push, a baked blade)" % [got]


func test_the_sweep_runs_its_phases_and_locks_its_direction() -> String:
	var c := _samurai(Vector3(1.0, 0, 1.4)) # off to its left: it turns toward him
	var a := _automaton(c)
	a.attack()
	var t := 0.0
	var phases := []
	var turned_early := false
	var at_lock := 0.0
	var moved_after_lock := 0.0
	var active_from := -1.0
	var recovery_from := -1.0
	while t < 1.2:
		_frame(c, [a], DT)
		t += DT
		if t > 0.05 and t < 0.25 and absf(a.facing) > 0.01:
			turned_early = true
		if t >= 0.31 and at_lock == 0.0:
			at_lock = a.facing
			c.fighter.global_position = Vector3(-2.5, 0, 2.0) # he moves to its right (out of reach): it must not follow now
		if at_lock != 0.0 and a.state == "attack":
			moved_after_lock = maxf(moved_after_lock, absf(a.facing - at_lock))
		var ph := String(a.info()["state"])
		if phases.is_empty() or String(phases[-1]) != ph:
			phases.append(ph)
		if active_from < 0.0 and a.telegraph >= 1.0:
			active_from = t
		if recovery_from < 0.0 and active_from > 0.0 and a.telegraph < 1.0:
			recovery_from = t
	var res := [phases, turned_early, a.info()["cadence"] > 1.5]
	_clear()
	if not turned_early:
		return "it did not turn toward him in the early startup"
	if moved_after_lock > 0.001:
		return "its direction moved %.3f rad after the lock (300 ms)" % moved_after_lock
	if absf(active_from - 0.55) > DT + 0.001 or absf(recovery_from - 0.68) > DT + 0.001:
		return "the cut ran %.3f–%.3f s (want 0.55–0.68)" % [active_from, recovery_from]
	return "" if res == [["attack", "stand"], true, true] else "the attack: %s" % [res]


func test_its_blow_lands_on_a_samurai_who_stays() -> String:
	var c := _samurai()
	var a := _automaton(c)
	a.attack()
	var t := 0.0
	while t < 0.95:
		_frame(c, [a], DT)
		t += DT
		if absf(t - 0.3) < DT * 0.5:
			c.legacy.event("evaded", a.get_instance_id()) # (an opportunity he holds when the blow comes: it closes)
	var closed_by_hit := false
	for e in c.legacy.events:
		closed_by_hit = closed_by_hit or (String(e["type"]) == "closed" and String(e["why"]) == "hit")
	var res := [a.last_attack, c.hp, c.blows, MeleeState.Phase.keys()[c.melee.phase], c.legacy.open.size(),
		closed_by_hit, _evaded.size()]
	var pushed := c.fighter.global_position.z - D
	var stun := c.melee.hitstun
	_clear()
	if res != ["hit", 185, 1, "HITSTUN", 0, true, 0]:
		return "a Samurai who stays: %s (want hit, 185 HP, in hitstun, his opportunity closed by the blow, no evasion)" % [res]
	if absf(pushed - 0.35) > 0.03:
		return "he was pushed %.2f m (want 0.35)" % pushed
	return "" if stun > 0.0 and stun < 0.35 else "his hitstun had %.2f s left 0.3 s after the blow (want 350 ms in all)" % stun


func test_a_blow_it_takes_cuts_its_attack_off() -> String:
	var c := _samurai(Vector3(0, 0, 1.3))
	var a := _automaton(c)
	a.attack()
	for i in 12:
		_frame(c, [a], DT)
	c.try_press("attack") # Basic 1 lands in its startup (it is 1.3 m ahead)
	for i in 50:
		_frame(c, [a], DT)
	var res := [a.last_attack, a.hp < 150, c.hp, a.state != "attack"]
	_clear()
	return "" if res == ["interrupted", true, 200, true] else \
		"struck in its startup: %s (want its attack interrupted, damaged, no blow on him)" % [res]


func test_a_wall_stops_its_step_into_the_cut() -> String:
	var c := _samurai()
	var a := _automaton(c)
	await _floor(c, [a])
	_block(Vector3(0, 1.5, 0.6), Vector3(4, 3, 0.4)) # its face 0.1 m in front of the automaton's body
	await _tree().physics_frame
	a.attack()
	for i in 72:
		_frame(c, [a], DT, Vector3.ZERO, true)
	var z := a.global_position.z
	_clear()
	return "" if z < 0.12 else "its step went %.2f m into a wall 0.1 m away" % z


func test_it_spars_on_its_own_when_he_stands_close() -> String:
	var c := _samurai()
	var a := _automaton(c, Vector3.ZERO, 0.0, true)
	_frame(c, [a], DT)
	var first := a.attacks
	for i in int(round(2.8 / DT)):
		_frame(c, [a], DT)
	var before_cadence := a.attacks
	for i in int(round(0.4 / DT)):
		_frame(c, [a], DT)
	var after_cadence := a.attacks
	_clear()
	c = _samurai(Vector3(0, 0, 3.6))
	a = _automaton(c, Vector3.ZERO, 0.0, true)
	for i in int(round(2.0 / DT)):
		_frame(c, [a], DT)
	var far := a.attacks
	_clear()
	var res := [first, before_cadence, after_cadence, far]
	return "" if res == [1, 1, 2, 0] else \
		"sparring: %s (want an attack at once, the next only after 3 s, none at 3.6 m)" % [res]


# --- Shadow Step -----------------------------------------------------------------------------------------------------


func test_the_step_goes_4_m_in_its_time_at_any_tick_rate() -> String:
	for hz: int in [30, 60, 120]:
		var dt := 1.0 / hz
		var c := _samurai(Vector3.ZERO, 0.0)
		if not c.try_press("skill2"):
			_clear()
			return "the STEP press was refused"
		var cd := c.melee.cooldown_left("shadow_step")
		var t := 0.0
		var z_at_startup := 0.0
		var window: Array[float] = []
		while t < 0.5:
			_frame(c, [], dt)
			t += dt
			if t <= 0.09 + 1e-6:
				z_at_startup = c.fighter.global_position.z
			if c.evading():
				window.append(t)
		var p := c.fighter.global_position
		var facing := c.fighter.facing
		_clear()
		if not is_equal_approx(cd, 5.0):
			return "its cooldown at the start was %.2f s (want 5)" % cd
		if absf(z_at_startup) > 0.001:
			return "at %d Hz he moved %.3f m through the 90 ms startup" % [hz, z_at_startup]
		if absf(p.z + 4.0) > 0.01 or absf(p.x) > 0.001 or absf(facing) > 0.001:
			return "at %d Hz the idle-stick step ended at (%.3f, %.3f) facing %.3f (want 4 m backward, facing kept)" % [hz, p.x, p.z, facing]
		if window.is_empty() or window[0] < 0.09 - 1e-6 or window[-1] > 0.21 + dt + 1e-6:
			return "at %d Hz the defensive window ran %s (want 0.09–0.21 s)" % [hz, window]
	return ""


func test_the_step_follows_the_stick() -> String:
	var c := _samurai(Vector3.ZERO, 0.0)
	c.try_press("skill2")
	for i in 30:
		_frame(c, [], DT, Vector3(1, 0, 0)) # the stick toward +X (his left)
	var p := c.fighter.global_position
	_clear()
	return "" if absf(p.x - 4.0) < 0.01 and absf(p.z) < 0.001 else "a step along the stick ended at %s (want 4 m along it)" % p


func test_a_wall_stops_the_step() -> String:
	var c := _samurai(Vector3.ZERO, 0.0)
	await _floor(c, [])
	_block(Vector3(0, 1.5, -1.2), Vector3(4, 3, 0.4)) # 1.2 m behind him: its face at -1.0
	await _tree().physics_frame
	c.try_press("skill2")
	for i in 30:
		_frame(c, [], DT, Vector3.ZERO, true)
	var z := c.fighter.global_position.z
	_clear()
	return "" if z > -0.7 and z < -0.5 else "against a wall 1 m behind him the step ended at z %.2f (want stopped at the wall, -0.66)" % z


# --- the evasion (rule B) --------------------------------------------------------------------------------------------


func test_a_timed_step_evades_and_opens_the_counter() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var r := _exchange(c, a, 0.467, Vector3.ZERO, DT, "skill2", false, 0.75)
	var res := [r, c.hp, c.evasions, _evaded.duplicate(), _opened(c, a),
		String(c.conditionals()["slots"][0].get("ability", ""))]
	var want := ["evaded", 200, 1, [[a.get_instance_id(), c.fighter.get_instance_id(), "sweep"]], true, "shadow_counter"]
	var left := float(c.legacy.open[0]["left"]) if not c.legacy.open.is_empty() else 0.0
	_clear()
	if res != want:
		return "a step timed into the cut: %s (want evaded once — attacker, him, sweep —, unhurt, COUNTER on the first button)" % [res]
	return "" if left > 0.3 and left <= 0.6 else "the counter's window: %.2f s left (want from 0.6)" % left


func test_the_evasion_window_is_120_ms_at_any_tick_rate() -> String:
	var rows: Array[String] = []
	for hz: int in [30, 60, 120]:
		var dt := 1.0 / hz
		var first := -1.0
		var last := -1.0
		var k := 0
		while true:
			var at := 0.36 + k * dt
			if at > 0.64:
				break
			k += 1
			var c := _samurai()
			var a := _automaton(c)
			var r := _exchange(c, a, at, Vector3.ZERO, dt, "skill2", false, 0.8)
			var opened := _opened(c, a)
			_clear()
			if r == "evaded" and not opened:
				return "at %d Hz an evasion %.3f s into the attack opened no counter" % [hz, at]
			if r == "evaded":
				if first < 0.0:
					first = at
				last = at
		var width := last - first + dt
		rows.append("%d Hz: presses %.3f–%.3f s into the attack (%.0f ms)" % [hz, first, last, width * 1000.0])
		if first < 0.0 or width < 0.1 or width > 0.15:
			return "at %d Hz the presses that evade span %.3f–%.3f s (%.0f ms; want about 120)" % [hz, first, last, width * 1000.0]
	print("[COUNTER] evasion window: ", " | ".join(rows))
	return ""


func test_a_step_too_early_or_too_late_earns_nothing() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var early := _exchange(c, a, 0.30, Vector3.ZERO, DT, "skill2", false, 1.2)
	var e := [early, c.hp, _opened(c, a), c.evasions]
	_clear()
	c = _samurai()
	a = _automaton(c)
	var late := _exchange(c, a, 0.57, Vector3.ZERO, DT, "skill2", false, 1.2)
	var l := [late, c.hp, _opened(c, a), c.evasions]
	_clear()
	if e != ["missed", 200, false, 0]:
		return "a step 300 ms into the attack (its window over before the cut): %s (want missed, nothing opened)" % [e]
	return "" if l == ["hit", 185, false, 0] else \
		"a step 570 ms into the attack (struck in its startup): %s (want hit, nothing opened)" % [l]


func test_a_step_with_no_attack_or_out_of_reach_earns_nothing() -> String:
	var c := _samurai()
	var a := _automaton(c)
	c.try_press("skill2")
	for i in 40:
		_frame(c, [a], DT)
	var alone := [c.evasions, c.legacy.open.size()]
	_clear()
	c = _samurai(Vector3(0, 0, 2.5)) # beyond the cut's reach where he stands
	a = _automaton(c)
	var r := _exchange(c, a, 0.467, Vector3.ZERO, DT, "skill2", false, 1.2)
	var far := [r, c.evasions, c.legacy.open.size(), c.hp]
	_clear()
	if alone != [0, 0]:
		return "a step with no attack coming: %s (want nothing)" % [alone]
	return "" if far == ["missed", 0, 0, 200] else "a step against a cut that could not reach him: %s (want missed, nothing)" % [far]


func test_an_attack_cut_off_before_the_shadow_earns_nothing() -> String:
	var c := _samurai()
	var a := _automaton(c)
	a.attack()
	var t := 0.0
	var stepped := false
	var cut := false
	while t < 1.0:
		var now := ""
		if not stepped and a.attack_time() + DT >= 0.467 - 1e-6:
			stepped = true
			now = "skill2"
		_frame(c, [a], DT, Vector3.ZERO, false, now)
		t += DT
		if not cut and a.attack_time() >= 0.52:
			cut = true
			a.take_hit(10, 0.2, 0.0, Vector3(0, 0, -1)) # (a blow from elsewhere, before its cut reaches his shadow)
	var res := [a.last_attack, c.evasions, c.legacy.open.size(), c.hp]
	_clear()
	return "" if res == ["interrupted", 0, 0, 200] else \
		"a step timed into an attack cut off before its blade came: %s (want interrupted, nothing opened)" % [res]


func test_one_evasion_per_attack() -> String:
	var c := _samurai()
	var a := _automaton(c)
	# a step along the blade's own sweep (to his right, +X): the cut keeps crossing where he stood
	_exchange(c, a, 0.45, Vector3(1, 0, 0), DT, "skill2", false, 1.2)
	var res := [_evaded.size(), c.evasions, c.blows, a.last_attack]
	_clear()
	return "" if res == [1, 1, 0, "evaded"] else "one attack crossing his shadow: %s (want one evasion, no blow)" % [res]


func test_a_roll_avoids_but_opens_nothing() -> String:
	var outcomes := {}
	var timings: Array[String] = []
	var k := 0
	while k < 16:
		var at := 0.44 + k * 0.012
		k += 1
		var c := _samurai()
		var a := _automaton(c)
		await _floor(c, [a])
		var r := _exchange(c, a, at, Vector3(1, 0, 0), DT, "dodge", true, 1.0)
		var opened := c.legacy.open.size()
		var ev := c.evasions
		_clear()
		outcomes[r] = int(outcomes.get(r, 0)) + 1
		timings.append("%.3f %s" % [at, r])
		if opened != 0 or ev != 0:
			return "a roll %.3f s into the attack opened %d (evasions %d)" % [at, opened, ev]
		if r == "evaded":
			return "a roll was counted as an evasion"
	print("[COUNTER] rolls (pressed s into the attack): ", " | ".join(timings))
	return "" if outcomes.has("avoided") else "no roll timing avoided the cut: %s" % [outcomes]


func test_a_step_blocked_at_once_by_a_wall_earns_nothing() -> String:
	var c := _samurai()
	var a := _automaton(c)
	await _floor(c, [a])
	_block(Vector3(0, 1.5, D + 0.6), Vector3(4, 3, 0.4)) # its face 0.06 m behind him
	await _tree().physics_frame
	var r := _exchange(c, a, 0.467, Vector3.ZERO, DT, "skill2", true, 1.0)
	var res := [r, c.evasions, c.legacy.open.size(), c.hp]
	_clear()
	return "" if res == ["avoided", 0, 0, 200] else \
		"a step straight into a wall behind him, timed into the cut: %s (want avoided, nothing opened)" % [res]


# --- Shadow Counter --------------------------------------------------------------------------------------------------


## Evade with a step to his right (+X, 4 m) and press COUNTER at once; returns the frames' log: the counter's start
## (s after the attack began).
func _evade_and_counter(c: CombatController, a: TrainingAutomaton, real: bool = false) -> float:
	a.attack()
	var t := 0.0
	var pressed := false
	var stepped := false
	var started := -1.0
	while t < 1.5:
		var now := ""
		if not stepped and a.attack_time() + DT >= 0.467 - 1e-6:
			stepped = true
			now = "skill2"
		_frame(c, [a], DT, Vector3(1, 0, 0) if not pressed else Vector3.ZERO, real, now)
		t += DT
		if not pressed and _opened(c, a):
			pressed = c.try_conditional(0)
		if started < 0.0 and c.melee.action and c.melee.action.id == "shadow_counter":
			started = t
	return started


func test_the_counter_dashes_and_strikes_its_attacker() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var started := _evade_and_counter(c, a)
	var p := c.fighter.global_position
	var to := Vector3(p.x - a.global_position.x, 0, p.z - a.global_position.z)
	var res := [a.hp, a.state, c.state()["dash"], a.last_attack]
	_clear()
	if started < 0.0:
		return "the counter never started"
	if int(res[0]) != 136:
		return "the counter: %s (want the automaton at 136: 14 landed)" % [res]
	if float(res[2]) > 4.0 + 1e-4 or float(res[2]) < 2.5:
		return "the dash went %.2f m (want up to 4 m, from 4.2 m away)" % float(res[2])
	# he stops short and on his own side: never behind it
	return "" if to.length() > 0.95 and to.x > 0.5 else "he ended %s from it (want short of it, on his side)" % to


func test_the_counter_waits_for_the_steps_cancel_point() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var started := _evade_and_counter(c, a)
	_clear()
	# the step began at 0.467 s; its cancel point: 90 + 180 ms, then half its 150 ms recovery
	var want := 0.467 + 0.09 + 0.18 + 0.075
	return "" if absf(started - want) <= 2.0 * DT else "the counter started %.3f s into the attack (want %.3f: the step's cancel point)" % [started, want]


func test_the_counter_runs_out() -> String:
	var c := _samurai()
	var a := _automaton(c)
	_exchange(c, a, 0.467, Vector3(1, 0, 0), DT, "skill2", false, 0.66)
	var open_then := _opened(c, a)
	for i in int(round(0.65 / DT)):
		_frame(c, [a], DT)
	var res := [open_then, _opened(c, a), c.try_conditional(0)]
	_clear()
	return "" if res == [true, false, false] else "the counter after 650 ms: %s (want open, then gone and nothing to press)" % [res]


func test_the_counter_closes_when_he_is_struck() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var b := _automaton(c, Vector3(4, 0, D + 1.7), PI) # a second automaton beyond where his step takes him
	a.attack()
	var t := 0.0
	var stepped := false
	var b_started := false
	var opened := false
	while t < 1.3:
		var now := ""
		if not stepped and a.attack_time() + DT >= 0.467 - 1e-6:
			stepped = true
			now = "skill2"
		if not b_started and t >= 0.45:
			b_started = b.attack()
		_frame(c, [a, b], DT, Vector3(1, 0, 0), false, now)
		t += DT
		opened = opened or _opened(c, a)
	var res := [opened, b.last_attack, _opened(c, a), c.blows]
	_clear()
	return "" if res == [true, "hit", false, 1] else \
		"struck by a second automaton inside the counter's window: %s (want the counter open, then closed by the blow)" % [res]


func test_the_counter_closes_when_its_attacker_is_defeated() -> String:
	var c := _samurai()
	var a := _automaton(c)
	_exchange(c, a, 0.467, Vector3(1, 0, 0), DT, "skill2", false, 0.66)
	var open_then := _opened(c, a)
	a.take_hit(200, 0.1, 0.0, Vector3(0, 0, -1))
	_frame(c, [a], DT)
	var res := [open_then, a.is_alive(), _opened(c, a)]
	_clear()
	return "" if res == [true, false, false] else "its attacker defeated: %s (want the counter closed)" % [res]


func test_a_wall_stops_the_counters_dash_and_it_misses() -> String:
	var c := _samurai()
	var a := _automaton(c)
	await _floor(c, [a])
	a.attack()
	var t := 0.0
	var stepped := false
	var walled := false
	var pressed := false
	while t < 1.5:
		var now := ""
		if not stepped and a.attack_time() + DT >= 0.467 - 1e-6:
			stepped = true
			now = "skill2"
		_frame(c, [a], DT, Vector3(1, 0, 0) if not pressed else Vector3.ZERO, true, now)
		t += DT
		if not walled and _opened(c, a) and c.fighter.global_position.x > 3.9:
			# (he has arrived 4 m to the side: a wall now stands between him and it)
			walled = true
			_block(Vector3(2.6, 1.5, D - 0.5), Vector3(0.4, 3, 6))
			await _tree().physics_frame
			pressed = c.try_conditional(0)
	var x := c.fighter.global_position.x
	var res := [walled, pressed, a.hp]
	_clear()
	if res != [true, true, 150]:
		return "a counter dashing into a wall: %s (want pressed, the automaton untouched)" % [res]
	return "" if x > 2.6 else "he ended at x %.2f — through the wall (its far face at 2.4)" % x
