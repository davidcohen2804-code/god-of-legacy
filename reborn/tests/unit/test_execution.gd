extends RefCounted
## M4 Stage D — Explosive Execution (GPT's v1.2, v1.5 and v1.6), with real nodes in the tree — his body and combat
## controller and the Training Automaton (its sparring off) — stepped by hand in the game's order each frame: the
## automaton (priority -15), his combat (-10), his body (0), its blade (+10). His body moves straight by its velocity, or
## — where walls matter — by its own physics (on a floor).
## The branch: Basic 1 → 2 → 3, each a confirmed hit on the same target within 900 ms of the last (the combat clock),
## opens Explosive Seal for 1.2 s (it may cut Basic 3's recovery from 50 %); the Seal (120 / 60 / 120 ms) plants its
## mark at 120 ms — only on a target alive, within 2.2 m, in clear line and sealable; the mark detonates 650 ms after
## it was planted, on the target's own time, whatever he does meanwhile (24, a 0.3 s reaction, a 0.6 m push); a
## damaging detonation on a target that survives it opens Phantom Execution for 1.0 s; the Execution (200 / 120 /
## 400 ms, 45) dashes to 1.1 m short of its target and must connect.
## Refusals keep their opportunity (a Seal that could not succeed, an Execution from beyond 3 m); a committed action
## that fails (a Seal whose target left before 120 ms, one cut off by a blow, an Execution whose target moved out of
## its path) is spent and opens nothing. The whole branch at 30, 60 and 120 Hz.

const DT := 1.0 / 60.0
const D := 1.7 ## he stands this far in front of the automaton
const SEAL := "explosive_seal"
const EXEC := "phantom_execution"

var _nodes: Array[Node] = []
var _notices: Array[String] = []
var _detonations: Array = [] ## [target id, damage] per seal_detonated


func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## The Samurai at `at` facing the automaton at the origin (facing π: toward -Z), and his combat controller.
func _samurai(at: Vector3 = Vector3(0, 0, D), facing: float = PI) -> CombatController:
	var f := Fighter.new()
	f.setup(CharacterVisual.create())
	f.position = at # (placed before it joins the physics space)
	_tree().root.add_child(f)
	f.set_physics_process(false)
	f.prev_position = at
	f.facing = facing
	var c := CombatController.new()
	c.fighter = f
	_tree().root.add_child(c)
	c.notice.connect(func(t: String) -> void: _notices.append(t))
	c.seal_detonated.connect(func(t: Node3D, d: int) -> void: _detonations.append([t.get_instance_id(), d]))
	_nodes.append_array([c, f])
	return c


## An automaton at `at` facing `facing` (0: +Z, toward him), its sparring off.
func _automaton(c: CombatController, at: Vector3 = Vector3.ZERO, facing: float = 0.0) -> TrainingAutomaton:
	var a := TrainingAutomaton.create()
	a.position = at
	_tree().root.add_child(a)
	a.set_physics_process(false)
	a.place(at)
	a.facing = facing
	a.foe = c
	a.watch = c.fighter
	a.spar = false
	_nodes.append(a)
	return a


## A solid box (world geometry), placed before it joins the physics space.
func _block(centre: Vector3, size: Vector3) -> void:
	var b := StaticBody3D.new()
	b.collision_layer = 1
	var s := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	s.shape = box
	b.add_child(s)
	b.position = centre
	_tree().root.add_child(b)
	_nodes.append(b)


func _floor(c: CombatController, autos: Array) -> void:
	_block(Vector3(0, -0.5, 0), Vector3(60, 1, 60))
	await _tree().physics_frame
	await _tree().physics_frame
	for i in 6:
		_frame(c, autos, DT, true)


func _clear() -> void:
	for n in _nodes:
		if is_instance_valid(n):
			n.free()
	_nodes.clear()
	_notices.clear()
	_detonations.clear()
	for n in _tree().root.get_children():
		if n is Label3D:
			n.free()


func _body(f: Fighter, dt: float) -> void:
	f.prev_position = f.global_position
	if f.frozen:
		return
	f.velocity = Vector3(f.action_velocity.x, 0.0, f.action_velocity.z) if f.action_lock else Vector3.ZERO
	f.global_position += f.velocity * dt


func _frame(c: CombatController, autos: Array, dt: float, real: bool = false) -> void:
	for a in autos:
		(a as TrainingAutomaton).step(dt)
	c.tick(dt, Vector3.ZERO)
	if real:
		c.fighter._physics_process(dt)
	else:
		_body(c.fighter, dt)
	for a in autos:
		(a as TrainingAutomaton).strike_check()


## The conditional button holding `ability` (-1: none).
func _slot(c: CombatController, ability: String) -> int:
	for i in c.legacy.slots:
		if String(c.legacy.in_slot(i).get("ability", "")) == ability:
			return i
	return -1


## The open opportunity for `ability` ({} when none).
func _open(c: CombatController, ability: String) -> Dictionary:
	for o in c.legacy.open:
		if String(o["ability"]) == ability:
			return o
	return {}


func _flat_distance(c: CombatController, a: Node3D) -> float:
	var d := a.global_position - c.fighter.global_position
	return Vector2(d.x, d.z).length()


## The branch against `a` for `seconds`: Attack pressed every frame until the third strike has started (a player
## mashing it); SEAL pressed the moment it shows (when `seal`), EXECUTE the moment it shows (when `execute`). `hook`
## (t, record) runs after every frame and may change the world (or set record.stop_seal / stop_exec to hold a button,
## record.stop to end the run there).
## The record, at frame ends (s from the start): sequence (SEAL opened) and seal_left; seal_start; planted and
## planted_e (the Seal's own time then); detonated; exec_open and exec_left; exec_start; exec_cut; exec_hit; and
## dist_exec (his distance to it as EXECUTE was pressed), dash, hp, strikes (the log since the start).
func _branch(c: CombatController, a: TrainingAutomaton, dt: float, seconds: float, seal: bool = true,
		execute: bool = true, hook: Callable = Callable(), real: bool = false) -> Dictionary:
	var r := {}
	var id := a.get_instance_id()
	var from := int(c.stats["strikes"])
	var t := 0.0
	while t < seconds - 1e-6:
		if int(c.stats["strikes"]) - from < 3 and not r.has("sequence"):
			c.try_press("attack")
		_frame(c, [a], dt, real)
		t += dt
		if not r.has("sequence") and c.legacy.has(SEAL, id):
			r["sequence"] = t
			r["seal_left"] = float(_open(c, SEAL).get("left", 0.0))
		if seal and r.has("sequence") and not r.has("seal_pressed") and not r.has("stop_seal") and _slot(c, SEAL) >= 0:
			if c.try_conditional(_slot(c, SEAL)):
				r["seal_pressed"] = t
		var act := c.melee.action
		if act and act.id == SEAL and not r.has("seal_start") and c.melee.is_attacking():
			r["seal_start"] = t - c.melee.elapsed()
		if not r.has("planted") and c.marks.has(id):
			r["planted"] = t
			r["planted_e"] = c.melee.elapsed() if act and act.id == SEAL else -1.0
		if not r.has("detonated") and not _detonations.is_empty():
			r["detonated"] = t
			r["det_hp"] = a.hp
		if not r.has("exec_open") and c.legacy.has(EXEC, id):
			r["exec_open"] = t
			r["exec_left"] = float(_open(c, EXEC).get("left", 0.0))
		if execute and r.has("exec_open") and not r.has("exec_pressed") and not r.has("stop_exec") and _slot(c, EXEC) >= 0:
			r["dist_exec"] = _flat_distance(c, a)
			if c.try_conditional(_slot(c, EXEC)):
				r["exec_pressed"] = t
		act = c.melee.action
		if act and act.id == EXEC and not r.has("exec_start") and c.melee.is_attacking():
			r["exec_start"] = t - c.melee.elapsed()
		if act and act.id == EXEC and c.melee.phase == MeleeState.Phase.ACTIVE and not r.has("exec_cut"):
			r["exec_cut"] = t
		for e in c.strike_log:
			if String(e["id"]) == EXEC and int(e["hits"]) > 0 and not r.has("exec_hit"):
				r["exec_hit"] = t
		if hook.is_valid():
			hook.call(t, r)
		if r.has("stop"):
			break
	r["hp"] = a.hp
	r["dash"] = float(c.state()["dash"])
	var n := int(c.stats["strikes"]) - from
	r["strikes"] = c.strike_log.slice(-n) if n > 0 else []
	return r


# --- the data ------------------------------------------------------------------------------------------------------


func test_the_branch_is_gpts() -> String:
	var s := AttackData.get_attack(SEAL)
	var e := AttackData.get_attack(EXEC)
	if s == null or e == null:
		return "Explosive Seal or Phantom Execution is missing from samurai.json"
	var got := [s.kind, s.startup, s.active, s.recovery, s.damage, s.reaction, s.knockback,
		float(s.seal.get("range", 0.0)), float(s.seal.get("fuse", 0.0)), s.anim, s.blend]
	var want := ["seal", 0.12, 0.06, 0.12, 24, 0.3, 0.6, 2.2, 0.65, "Spell_Simple_Shoot", 0.12]
	if got != want:
		return "Explosive Seal: %s (want %s)" % [got, want]
	got = [e.startup, e.active, e.recovery, e.damage, e.hit_stop, e.reaction, e.knockback, e.within,
		float(e.dash.get("stop", 0.0)), float(e.dash.get("max", 0.0)), String(e.dash.get("curve", "")), e.anim, e.anim_from,
		e.anim_speed, e.blade_tip.size()]
	want = [0.2, 0.12, 0.4, 45, 0.1, 0.6, 0.8, 3.0, 1.1, 1.9, "in", "Sword_Heavy_Combo", 2.33, 1.0, 13]
	if got != want:
		return "Phantom Execution: %s (want %s)" % [got, want]
	var g := LegacyChain.new(AttackData.graph())
	var se := g.edge_for(SEAL)
	var ee := g.edge_for(EXEC)
	var sc: Dictionary = se.get("cancel", {})
	got = [se.get("on"), se.get("window"), se.get("rank"), sc.get("from"), sc.get("at"), ee.get("on"), ee.get("window"),
		ee.get("rank")]
	want = ["sequence", 1.2, 5, "basic3", 0.5, "detonated", 1.0, 1]
	if got != want:
		return "the graph's edges: %s (want %s)" % [got, want]
	var q := StrikeSequence.from_data()
	return "" if ", ".join(q.strikes) == "basic1, basic2, basic3" and is_equal_approx(q.gap, 0.9) else \
		"the sequence: %s within %.2f s (want Basic 1, 2, 3 within 0.9 s)" % [q.strikes, q.gap]


func test_the_strike_sequence() -> String:
	var q := StrikeSequence.new(["basic1", "basic2", "basic3"], 0.9)
	var rows := []
	rows.append([q.confirm("basic1", 7, 0.0), q.confirm("basic2", 7, 0.5), q.confirm("basic3", 7, 1.3)])
	rows.append([q.confirm("basic1", 7, 2.0), q.confirm("basic2", 7, 2.95), q.confirm("basic3", 7, 3.2), q.progress(7)])
	rows.append([q.confirm("basic1", 7, 4.0), q.confirm("basic2", 8, 4.3), q.confirm("basic3", 7, 4.6)])
	rows.append([q.confirm("basic2", 7, 5.0), q.confirm("basic3", 7, 5.2)])
	q.confirm("basic1", 7, 6.0)
	q.confirm("basic2", 7, 6.3)
	q.reset()
	rows.append([q.confirm("basic3", 7, 6.6)])
	rows.append([q.confirm("basic1", 7, 7.0), q.confirm("basic2", 7, 7.9), q.confirm("basic3", 7, 8.8)])
	q.confirm("basic1", 7, 9.0)
	q.confirm("basic1", 8, 9.0)
	q.confirm("basic2", 7, 9.3)
	q.confirm("basic2", 8, 9.3)
	rows.append([q.confirm("basic3", 7, 9.6), q.confirm("basic3", 8, 9.6)])
	rows.append([q.confirm("heavy", 7, 10.0), q.progress(7)])
	var want := [[false, false, true], [false, false, false, 0], [false, false, false], [false, false], [false],
		[false, false, true], [true, true], [false, 0]]
	return "" if rows == want else "the sequence: %s (want %s: in order, the same target, each within 0.9 s)" % [rows, want]


# --- the whole branch --------------------------------------------------------------------------------------------


func test_the_whole_branch_at_any_tick_rate() -> String:
	var rows: Array[String] = []
	for hz: int in [30, 60, 120]:
		var dt := 1.0 / hz
		var c := _samurai()
		var a := _automaton(c)
		var r := _branch(c, a, dt, 3.5)
		_clear()
		for k in ["sequence", "seal_start", "planted", "detonated", "exec_open", "exec_start", "exec_cut", "exec_hit"]:
			if not r.has(k):
				return "at %d Hz the branch stopped before %s: %s" % [hz, k, r]
		if absf(float(r["seal_left"]) - 1.2) > dt + 1e-6:
			return "at %d Hz SEAL opened with %.3f s (want 1.2)" % [hz, r["seal_left"]]
		if float(r["seal_start"]) - float(r["sequence"]) > 0.45:
			return "at %d Hz the Seal began %.3f s after SEAL opened (pressed at once: want by Basic 3's cancel point)" % [hz, float(r["seal_start"]) - float(r["sequence"])]
		var pe := float(r["planted_e"])
		if pe < 0.12 - 1e-6 or pe > 0.12 + dt + 1e-6:
			return "at %d Hz the mark was planted %.3f s into the Seal (want 0.12)" % [hz, pe]
		var at := float(r["planted"]) - (pe - 0.12) # (the planting moment itself)
		var fuse := float(r["detonated"]) - at
		if fuse < 0.65 - 1e-6 or fuse > 0.65 + dt + 1e-6:
			return "at %d Hz the mark detonated %.3f s after it was planted (want 0.65)" % [hz, fuse]
		if int(r["det_hp"]) != 150 - 40 - 24:
			return "at %d Hz after the detonation the automaton had %d (want 86: 10 + 12 + 18 + 24)" % [hz, r["det_hp"]]
		if absf(float(r["exec_open"]) - float(r["detonated"])) > 1e-6 or absf(float(r["exec_left"]) - 1.0) > dt + 1e-6:
			return "at %d Hz EXECUTE: open at %.3f with %.3f s (want at the detonation, %.3f, for 1.0 s)" % [hz, r["exec_open"], r["exec_left"], r["detonated"]]
		var cut := float(r["exec_cut"]) - float(r["exec_start"])
		if cut < 0.2 - 1e-6 or cut > 0.2 + dt + 1e-6:
			return "at %d Hz the Execution's cut began %.3f s after it started (want 0.2)" % [hz, cut]
		if int(r["hp"]) != 150 - 109:
			return "at %d Hz the automaton ended at %d (want 41: 10 + 12 + 18 + 24 + 45)" % [hz, r["hp"]]
		var want_dash := clampf(float(r["dist_exec"]) - 1.1, 0.0, 1.9)
		if absf(float(r["dash"]) - want_dash) > 0.05:
			return "at %d Hz the Execution dashed %.2f m from %.2f m (want %.2f: to 1.1 m short)" % [hz, r["dash"], r["dist_exec"], want_dash]
		rows.append("%d Hz: SEAL %.2f → planted %.2f → detonated %.2f (fuse %.3f) → EXECUTE from %.2f m, dash %.2f, cut %.3f" % [hz,
			r["sequence"], r["planted"], r["detonated"], fuse, r["dist_exec"], r["dash"], cut])
	print("[EXECUTION] ", " | ".join(rows))
	return ""


func test_the_three_strikes_leave_the_seal_in_reach() -> String:
	# GPT's v1.6: Basic 3 pushes its target 0.5 m — the branch must not routinely fail from its own knockback
	for d: float in [1.2, 1.45, 1.7]: # (from where Basic 1 reaches it)
		var c := _samurai(Vector3(0, 0, d))
		var a := _automaton(c)
		var r := _branch(c, a, DT, 1.4, true, false, func(_t: float, rec: Dictionary) -> void:
			if rec.has("planted") and not rec.has("planted_at"):
				rec["planted_at"] = _flat_distance(c, a))
		_clear()
		if not r.has("planted"):
			return "starting %.1f m away the Seal was not planted: %s" % [d, r]
		if float(r["planted_at"]) > 2.2:
			return "starting %.1f m away the Seal was planted from %.2f m" % [d, r["planted_at"]]
	return ""


# --- no Seal without a confirmed sequence ------------------------------------------------------------------------


func test_no_seal_after_a_missed_third_strike() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var from := int(c.stats["strikes"])
	var r := _branch(c, a, DT, 2.0, true, false, func(_t: float, rec: Dictionary) -> void:
		if int(c.stats["strikes"]) - from >= 3 and not rec.has("moved"):
			rec["moved"] = true
			a.place(Vector3(0, 0, -3.0))) # (Basic 3 starts: its target is no longer there)
	var res := [r.has("sequence"), c.legacy.open.size(), r["strikes"].map(func(e: Dictionary) -> Array: return [e["step"], e["hits"]])]
	_clear()
	return "" if res == [false, 0, [[1, 1], [2, 1], [3, 0]]] else \
		"Basic 3 missing after two hits: %s (want no SEAL; strikes 1/1, 2/1, 3/0)" % [res]


func test_no_seal_when_the_third_strike_lands_on_another_target() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var b := _automaton(c, Vector3(6, 0, 0))
	var from := int(c.stats["strikes"])
	var swapped := {}
	var t := 0.0
	while t < 2.0:
		if int(c.stats["strikes"]) - from < 3:
			c.try_press("attack")
		_frame(c, [a, b], DT)
		t += DT
		if int(c.stats["strikes"]) - from >= 2 and not swapped.has("done") and c.melee.step_index == 1 \
				and c.melee.phase == MeleeState.Phase.RECOVERY:
			swapped["done"] = true
			var at := a.global_position
			a.place(Vector3(-6, 0, 0)) # (the first leaves; the second stands where it was for Basic 3)
			b.place(at)
	var log := c.strike_log.slice(-3).map(func(e: Dictionary) -> Array: return [e["step"], e["hits"]])
	var res := [c.legacy.open.size(), log, a.hp, b.hp]
	_clear()
	return "" if res == [0, [[1, 1], [2, 1], [3, 1]], 128, 132] else \
		"Basic 1 and 2 on one, Basic 3 on another: %s (want no SEAL; 10 + 12 on the first, 18 on the second)" % [res]


func test_no_seal_after_a_blow_cuts_the_sequence() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var sweep := AttackData.automaton_attack("sweep")
	var r := _branch(c, a, DT, 2.0, true, false, func(_t: float, rec: Dictionary) -> void:
		if not rec.has("struck") and c.strike_log.size() >= 2 and String(c.strike_log[-1]["id"]) == "basic2" \
				and int(c.strike_log[-1]["hits"]) > 0:
			rec["struck"] = c.sequence.progress(a.get_instance_id())
			c._take_blow(sweep, a)) # (a blow lands on him between Basic 2 and Basic 3)
	var steps := (r["strikes"] as Array).map(func(e: Dictionary) -> int: return int(e["step"]))
	var res := [r.get("struck", -1), r.has("sequence"), c.sequence.progress(a.get_instance_id()) <= 1, steps]
	_clear()
	return "" if res == [2, false, true, [1, 2, 1]] else \
		"a blow after Basic 2: %s (want the sequence at 2, then over: no SEAL, the next strike Basic 1 again)" % [res]


# --- the Seal ------------------------------------------------------------------------------------------------------


func test_an_unused_seal_expires() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var r := _branch(c, a, DT, 2.2, false, false, func(t: float, rec: Dictionary) -> void:
		if rec.has("sequence"):
			var since := t - float(rec["sequence"])
			if since >= 1.1 and not rec.has("at_1_1"):
				rec["at_1_1"] = c.legacy.has(SEAL)
			if since >= 1.3 and not rec.has("at_1_3"):
				rec["at_1_3"] = c.legacy.has(SEAL))
	var res := [r.get("at_1_1"), r.get("at_1_3"), c.marks.size(), r["hp"], _detonations.size()]
	_clear()
	return "" if res == [true, false, 0, 110, 0] else \
		"SEAL left unpressed: %s (want open at 1.1 s, gone at 1.3 s; no mark, 110 HP, no detonation)" % [res]


## Play the three strikes and stand until he is free with SEAL open, the automaton where it was pushed.
func _to_seal(c: CombatController, a: TrainingAutomaton, real: bool = false) -> void:
	var from := int(c.stats["strikes"])
	var t := 0.0
	while t < 2.0 and not (c.legacy.has(SEAL) and c.melee.phase == MeleeState.Phase.FREE):
		if int(c.stats["strikes"]) - from < 3:
			c.try_press("attack")
		_frame(c, [a], DT, real)
		t += DT


func test_refused_seal_presses_keep_the_opportunity() -> String:
	var c := _samurai()
	var a := _automaton(c)
	await _floor(c, [a])
	_to_seal(c, a, true)
	if not c.legacy.has(SEAL):
		_clear()
		return "SEAL did not open"
	var me := c.fighter.global_position
	var left0 := float(_open(c, SEAL)["left"])
	var rows := []
	# beyond 2.2 m
	a.place(me + Vector3(0, 0, -2.6))
	c.try_conditional(_slot(c, SEAL))
	rows.append([_notices.back() if not _notices.is_empty() else "", c.melee.action.id, c.legacy.has(SEAL)])
	# a wall between them
	a.place(me + Vector3(0, 0, -1.8))
	_block(me + Vector3(0, 1.0, -0.9), Vector3(3, 2, 0.2))
	await _tree().physics_frame
	c.try_conditional(_slot(c, SEAL))
	rows.append([_notices.back(), c.melee.action.id, c.legacy.has(SEAL)])
	(_nodes.back() as Node).free()
	_nodes.pop_back()
	await _tree().physics_frame
	# a target that resists the seal
	var data: Dictionary = a.target_data.duplicate()
	a.target_data = data.duplicate()
	a.target_data["sealable"] = false
	c.try_conditional(_slot(c, SEAL))
	rows.append([_notices.back(), c.melee.action.id, c.legacy.has(SEAL)])
	a.target_data = data
	for i in 6:
		_frame(c, [a], DT, true)
	var left1 := float(_open(c, SEAL).get("left", -1.0))
	# now it can: it starts, and the mark is planted
	c.try_conditional(_slot(c, SEAL))
	var started := c.melee.action.id
	for i in 12:
		_frame(c, [a], DT, true)
	var planted := c.marks.has(a.get_instance_id())
	_clear()
	var want := [["Out of reach", "basic3", true], ["Blocked", "basic3", true], ["Resists the seal", "basic3", true]]
	if rows != want:
		return "refused Seal presses: %s (want %s: nothing started, SEAL kept)" % [rows, want]
	if absf((left0 - left1) - 6.0 * DT) > 1e-4:
		return "the refused presses changed SEAL's window: %.3f → %.3f s over 6 frames" % [left0, left1]
	return "" if started == SEAL and planted else "a valid press then: started %s, planted %s" % [started, planted]


## Press SEAL with him free and the automaton 1.8 m in front; `meddle` (seal time) runs after each frame; returns
## [the notices, a mark planted, SEAL still open, detonations within 1.2 s, EXECUTE open].
func _committed_seal(c: CombatController, a: TrainingAutomaton, meddle: Callable, real: bool = false) -> Array:
	_to_seal(c, a, real)
	a.place(c.fighter.global_position + Vector3(0, 0, -1.8))
	_notices.clear()
	c.try_conditional(_slot(c, SEAL))
	if c.melee.action.id != SEAL:
		return ["not started"]
	var t := 0.0
	while t < 1.2:
		_frame(c, [a], DT, real)
		t += DT
		meddle.call(t)
	return [_notices.duplicate(), c.marks.has(a.get_instance_id()), c.legacy.has(SEAL), _detonations.size(),
		c.legacy.has(EXEC)]


func test_a_seal_whose_target_leaves_before_its_moment_misses() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var res := _committed_seal(c, a, func(t: float) -> void:
		if t >= 0.06 and t < 0.06 + DT:
			a.place(c.fighter.global_position + Vector3(0, 0, -2.6)))
	_clear()
	return "" if res == [["Seal missed"], false, false, 0, false] else \
		"the target left before 120 ms: %s (want 'Seal missed', no mark, SEAL spent, nothing detonates or opens)" % [res]


func test_a_seal_blocked_before_its_moment_misses() -> String:
	var c := _samurai()
	var a := _automaton(c)
	await _floor(c, [a])
	_to_seal(c, a, true)
	a.place(c.fighter.global_position + Vector3(0, 0, -1.8))
	_notices.clear()
	c.try_conditional(_slot(c, SEAL))
	var started := c.melee.action.id
	for i in 2:
		_frame(c, [a], DT, true)
	_block(c.fighter.global_position + Vector3(0, 1.0, -0.9), Vector3(3, 2, 0.2)) # (a wall rises between them)
	await _tree().physics_frame
	for i in 70:
		_frame(c, [a], DT, true)
	var res := [_notices.duplicate(), c.marks.has(a.get_instance_id()), c.legacy.has(SEAL), _detonations.size(),
		c.legacy.has(EXEC)] if started == SEAL else ["not started"]
	_clear()
	return "" if res == [["Seal missed"], false, false, 0, false] else \
		"a wall between them before 120 ms: %s (want 'Seal missed', no mark, SEAL spent)" % [res]


func test_a_seal_cut_off_by_a_blow_is_spent() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var sweep := AttackData.automaton_attack("sweep")
	var res := _committed_seal(c, a, func(t: float) -> void:
		if t >= 0.06 and t < 0.06 + DT:
			c._take_blow(sweep, a))
	_clear()
	return "" if res == [[], false, false, 0, false] else \
		"struck 60 ms into the Seal: %s (want no mark, SEAL spent, nothing opens)" % [res]


# --- the mark ------------------------------------------------------------------------------------------------------


## Plant a mark (the three strikes, SEAL at once; EXECUTE at once when `execute`), `meddle` (s since the planting
## moment) after every frame from then on, for 3.2 s in all; returns [s from the planting moment to the detonation (-1:
## none), detonations, EXECUTE opened, the record (exec_start: s since the planting moment, 0 when none)].
func _planted(c: CombatController, a: TrainingAutomaton, meddle: Callable, execute: bool = false) -> Array:
	var seen := {}
	var r := _branch(c, a, DT, 3.2, true, execute, func(t: float, rec: Dictionary) -> void:
		if rec.has("planted"):
			var at := float(rec["planted"]) - (float(rec["planted_e"]) - 0.12)
			seen["at"] = at
			seen["opened"] = bool(seen.get("opened", false)) or c.legacy.has(EXEC)
			meddle.call(t - at))
	if not seen.has("at"):
		return [-2.0, 0, false, r]
	var at := float(seen["at"])
	var det := float(r["detonated"]) - at if r.has("detonated") else -1.0
	r["exec_start"] = float(r["exec_start"]) - at if r.has("exec_start") else 0.0
	return [det, _detonations.size(), bool(seen.get("opened", false)), r]


func test_the_mark_detonates_whatever_he_does() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var sweep := AttackData.automaton_attack("sweep")
	var stun_end := {}
	var res := _planted(c, a, func(t: float) -> void:
		if t >= 0.3 and t < 0.3 + DT:
			c._take_blow(sweep, a) # (struck 300 ms into the fuse: hitstun, his own hit-stop)
		if t >= 0.3 and not stun_end.has("t") and c.melee.phase != MeleeState.Phase.HITSTUN and c.blows > 0:
			stun_end["t"] = t, true)
	var hp := a.hp
	_clear()
	if float(res[0]) < 0.65 - 1e-6 or float(res[0]) > 0.65 + DT + 1e-6:
		return "struck during the fuse, the mark detonated %.3f s after it was planted (want 0.65: his state does not change it)" % res[0]
	if int(res[1]) != 1 or not bool(res[2]):
		return "struck during the fuse: %d detonation(s), EXECUTE opened %s (want one, opened)" % [res[1], res[2]]
	var r: Dictionary = res[3]
	if float(r["exec_start"]) > 0.0 and float(r["exec_start"]) < float(stun_end.get("t", 99.0)) - 1e-6:
		return "he started the Execution %.3f s in, inside his hitstun (it ended at %.3f)" % [r["exec_start"], stun_end.get("t", -1.0)]
	return "" if hp <= 150 - 40 - 24 else "the detonation dealt nothing: %d HP" % hp


func test_the_fuse_waits_only_while_its_target_is_held_still() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var frozen := _planted(c, a, func(t: float) -> void:
		if t >= 0.2 and t < 0.2 + DT:
			a.freeze_for(0.15))
	_clear()
	c = _samurai()
	a = _automaton(c)
	var his := _planted(c, a, func(t: float) -> void:
		if t >= 0.2 and t < 0.2 + DT:
			c.melee.hitstop = 0.1) # (his own hit-stop: not the mark's)
	_clear()
	var delay := float(frozen[0]) - 0.65
	if delay < 0.15 - DT - 1e-6 or delay > 0.15 + DT + 1e-6:
		return "the target held still 150 ms in the fuse: it detonated %.3f s after planting (want about 0.80)" % frozen[0]
	return "" if float(his[0]) >= 0.65 - 1e-6 and float(his[0]) <= 0.65 + DT + 1e-6 else \
		"his own hit-stop in the fuse: it detonated %.3f s after planting (want 0.65)" % his[0]


func test_no_execution_without_a_damaging_detonation_on_a_survivor() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var before := _planted(c, a, func(t: float) -> void:
		if t >= 0.2 and t < 0.2 + DT:
			a.take_hit(200, 0.1, 0.0, Vector3(0, 0, -1))) # (defeated before its mark bursts)
	var faded := c.marks.size()
	_clear()
	c = _samurai()
	a = _automaton(c)
	var killed := _planted(c, a, func(t: float) -> void:
		if t >= 0.2 and t < 0.2 + DT:
			a.hp = 20) # (the detonation will defeat it)
	var hp := a.hp
	_clear()
	if float(before[0]) >= 0.0 or int(before[1]) != 0 or bool(before[2]) or faded != 0:
		return "its target defeated before the detonation: %s, marks left %d (want no detonation, nothing opened)" % [before.slice(0, 3), faded]
	return "" if int(killed[1]) == 1 and not bool(killed[2]) and hp == 0 else \
		"a detonation that defeats its target: %s, %d HP (want it to burst, nothing opened)" % [killed.slice(0, 3), hp]


# --- the Execution ---------------------------------------------------------------------------------------------------


func test_an_execution_from_beyond_3_m_is_refused_and_kept() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var r := _branch(c, a, DT, 3.2, true, false, func(t: float, rec: Dictionary) -> void:
		if rec.has("exec_open") and not rec.has("moved"):
			rec["moved"] = true
			a.place(c.fighter.global_position + Vector3(0, 0, -4.0)) # (a QA reposition: 4 m away)
			c.try_conditional(_slot(c, EXEC))
			rec["refused"] = [_notices.back() if not _notices.is_empty() else "", c.legacy.has(EXEC),
				c.melee.action.id if c.melee.action else ""]
		if rec.has("moved"):
			var since := t - float(rec["exec_open"])
			if since >= 0.9 and not rec.has("at_0_9"):
				rec["at_0_9"] = c.legacy.has(EXEC)
			if since >= 1.1 and not rec.has("at_1_1"):
				rec["at_1_1"] = c.legacy.has(EXEC))
	var res := [r.get("refused"), r.get("at_0_9"), r.get("at_1_1"), r["hp"]]
	_clear()
	return "" if res == [["Out of reach", true, SEAL], true, false, 86] else \
		"EXECUTE pressed with its target 4 m away: %s (want refused and kept, still open at 0.9 s, gone at 1.1 s, 86 HP)" % [res]


func test_an_execution_whose_target_leaves_its_path_misses() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var r := _branch(c, a, DT, 3.0, true, true, func(_t: float, rec: Dictionary) -> void:
		if rec.has("exec_start") and not rec.has("moved") and c.melee.action.id == EXEC and c.melee.t >= 0.1:
			rec["moved"] = true
			a.place(a.global_position + Vector3(3.0, 0, 0))) # (it steps out of the cut's path in the startup)
	var res := [r.has("exec_start"), r.has("exec_hit"), r["hp"], c.legacy.open.size(),
		(r["strikes"] as Array).filter(func(e: Dictionary) -> bool: return e["id"] == EXEC).map(func(e: Dictionary) -> int: return int(e["hits"]))]
	_clear()
	return "" if res == [true, false, 86, 0, [0]] else \
		"the target out of the Execution's path in its startup: %s (want started, missed: 86 HP, nothing open)" % [res]


func test_a_wall_stops_the_executions_dash_and_it_misses() -> String:
	var c := _samurai()
	var a := _automaton(c)
	await _floor(c, [a])
	var r := _branch(c, a, DT, 3.2, true, false, func(_t: float, rec: Dictionary) -> void:
		if rec.has("exec_open"):
			rec["stop"] = true, true)
	if not r.has("exec_open"):
		_clear()
		return "EXECUTE did not open: %s" % [r]
	var me := c.fighter.global_position
	a.place(me + Vector3(0, 0, -2.9))
	_block(me + Vector3(0, 1.0, -0.55), Vector3(3, 2, 0.2))
	await _tree().physics_frame
	c.try_conditional(_slot(c, EXEC))
	var started := c.melee.action.id
	for i in 50:
		_frame(c, [a], DT, true)
	var moved := Vector2(c.fighter.global_position.x - me.x, c.fighter.global_position.z - me.z).length()
	var res := [started, a.hp, moved < 0.5]
	_clear()
	return "" if res == [EXEC, 86, true] else \
		"an Execution dashing into a wall: %s (want started, stopped at the wall, missed: 86 HP)" % [res]


func test_a_blow_cuts_the_execution_off() -> String:
	var c := _samurai()
	var a := _automaton(c)
	var sweep := AttackData.automaton_attack("sweep")
	var r := _branch(c, a, DT, 3.0, true, true, func(_t: float, rec: Dictionary) -> void:
		if rec.has("exec_start") and not rec.has("struck") and c.melee.action.id == EXEC and c.melee.t >= 0.08:
			rec["struck"] = true
			c._take_blow(sweep, a))
	var res := [r.has("struck"), r.has("exec_cut"), r["hp"], c.legacy.open.size()]
	_clear()
	return "" if res == [true, false, 86, 0] else \
		"struck 80 ms into the Execution: %s (want cut off before its cleave: 86 HP, nothing open)" % [res]


func test_the_cleave_reaches_near_far_and_low_targets() -> String:
	# GPT's v1.6: the baked collision must cover the visible descending strike — targets at different heights and
	# distances, especially near the ground where the sword finishes (the whole cut, he facing +Z)
	var e := AttackData.get_attack(EXEC)
	var rows: Array[String] = []
	var fails: Array[String] = []
	for h: float in [1.8, 1.0, 0.55]:
		for d: float in [0.5, 0.8, 1.1, 1.4, 1.7, 2.1]:
			var hit := SwordSweep.hits(e, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(0, 0, d), 0.3, h)
			rows.append("h%.2f@%.1f:%s" % [h, d, "hit" if hit else "-"])
			var want := d <= 1.7
			if hit != want:
				fails.append("a capsule %.2f m tall %.1f m ahead: %s" % [h, d, "struck" if hit else "missed"])
	for x: float in [-0.65, 0.65]:
		if SwordSweep.hits(e, Vector3.ZERO, 0.0, Vector2(0, 1), Vector3(x, 0, 1.1), 0.3, 1.8):
			fails.append("a body %.2f m to the side was struck by a vertical cleave" % x)
	print("[EXECUTION] the cleave: ", " ".join(rows))
	return "" if fails.is_empty() else ", ".join(fails)
