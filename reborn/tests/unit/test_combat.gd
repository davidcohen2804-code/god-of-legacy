extends RefCounted
## The combat controller with real nodes in the tree — the Samurai's body and the training dummy — its fixed tick
## driven by hand (no physics runs inside a test, so the bodies stay where they are put; a press waits 0.12 s as in
## the input's buffer). The chain deals 10 + 12 + 18, each once, and only the third pushes the dummy; strikes at the
## empty air deal nothing and the next one is the first strike again; the assist does not turn a far target into a
## hit; a press during hit-stop is kept for the next strike.

const DT := 1.0 / 60.0

var _nodes: Array[Node] = []


## The dummy at the origin, the Samurai `dist` m south of it facing `facing` (PI: toward it).
func _world(dist: float, facing: float) -> Array:
	var tree := Engine.get_main_loop() as SceneTree
	var d := TrainingDummy.create()
	tree.root.add_child(d)
	var f := Fighter.new()
	f.setup(CharacterVisual.create())
	tree.root.add_child(f)
	f.global_position = Vector3(0, 0, dist)
	f.facing = facing
	var c := CombatController.new()
	c.fighter = f
	tree.root.add_child(c)
	_nodes = [c, f, d]
	return [f, d, c]


func _clear() -> void:
	var tree := Engine.get_main_loop() as SceneTree
	for n in _nodes:
		if is_instance_valid(n):
			n.free()
	_nodes.clear()
	for n in tree.root.get_children():
		if n is Label3D: # (the damage numbers)
			n.free()


## Tick for `seconds`, pressing attack at the given times (s from now).
func _run(c: CombatController, seconds: float, presses: Array) -> void:
	var t := 0.0
	var pending := presses.duplicate()
	var buffered := -1.0
	while t < seconds:
		t += DT
		while not pending.is_empty() and t >= float(pending[0]):
			pending.pop_front()
			buffered = 0.12
		if buffered > 0.0:
			if c.try_attack():
				buffered = -1.0
			elif not c.is_frozen():
				buffered -= DT
		c.tick(DT, Vector3.ZERO)


func _steps(c: CombatController) -> Array:
	return c.strike_log.map(func(e: Dictionary) -> Array: return [e["step"], e["hits"], e["damage"]])


func test_the_chain_deals_each_strike_once() -> String:
	var w := _world(1.6, PI)
	var d: TrainingDummy = w[1]
	var c: CombatController = w[2]
	_run(c, 1.6, [0.0, 0.30, 0.62])
	var err := ""
	var steps := _steps(c)
	if steps != [[1, 1, 10], [2, 1, 12], [3, 1, 18]]:
		err = "strikes [step, hits, damage]: %s (want 1/1/10, 2/1/12, 3/1/18)" % [steps]
	elif d.hp != TrainingDummy.MAX_HP - 40:
		err = "the dummy has %d HP (want %d)" % [d.hp, TrainingDummy.MAX_HP - 40]
	elif not is_equal_approx(d._push_from.distance_to(d._push_to), 0.5):
		err = "the third strike's push is %s m (want 0.5)" % d._push_from.distance_to(d._push_to)
	elif c.stats["chains"] != 1:
		err = "chains completed: %d" % c.stats["chains"]
	_clear()
	return err


func test_only_the_third_strike_pushes() -> String:
	var w := _world(1.6, PI)
	var d: TrainingDummy = w[1]
	var c: CombatController = w[2]
	_run(c, 0.62, [0.0, 0.30])
	var err := ""
	if _steps(c) != [[1, 1, 10], [2, 1, 12]]:
		err = "strikes: %s" % [_steps(c)]
	elif d._push_t >= 0.0 or d._push_from.distance_to(d._push_to) > 0.0:
		err = "the dummy was pushed by the first or second strike"
	_clear()
	return err


func test_strikes_at_the_air_deal_nothing_and_start_over() -> String:
	var w := _world(1.6, 0.0) # facing away: the dummy is behind him (out of the assist's cone)
	var d: TrainingDummy = w[1]
	var c: CombatController = w[2]
	_run(c, 0.6, [0.0])
	_run(c, 0.6, [0.0])
	var err := ""
	if _steps(c) != [[1, 0, 0], [1, 0, 0]]:
		err = "strikes at the air: %s (want two first strikes, no hits)" % [_steps(c)]
	elif d.hp != TrainingDummy.MAX_HP:
		err = "the dummy lost HP: %d" % d.hp
	elif c.stats["misses"] != 2:
		err = "misses counted: %d" % c.stats["misses"]
	_clear()
	return err


func test_the_assist_does_not_reach_a_far_target() -> String:
	var w := _world(3.0, PI) # 3 m: within the assist's 3.6 m, beyond the first strike's reach (1.45 + 0.38)
	var d: TrainingDummy = w[1]
	var c: CombatController = w[2]
	_run(c, 0.6, [0.0])
	var err := ""
	if _steps(c) != [[1, 0, 0]] or d.hp != TrainingDummy.MAX_HP:
		err = "a strike from 3 m: %s, dummy %d HP" % [_steps(c), d.hp]
	_clear()
	return err


func test_a_press_during_hit_stop_is_kept() -> String:
	var w := _world(1.6, PI)
	var c: CombatController = w[2]
	_run(c, 0.0, [])
	var pressed := false
	var t := 0.0
	c.try_attack()
	while t < 1.0:
		t += DT
		c.tick(DT, Vector3.ZERO)
		if c.is_frozen() and not pressed:
			pressed = c.try_attack() # pressed while the blow holds everything still
	var err := ""
	if not pressed:
		err = "the press during hit-stop was refused (or no hit-stop happened)"
	elif _steps(c) != [[1, 1, 10], [2, 1, 12]]:
		err = "after a press during hit-stop: %s (want the second strike to follow)" % [_steps(c)]
	_clear()
	return err


func test_the_assist_turns_him_to_a_target_beside_him() -> String:
	var w := _world(1.5, PI - deg_to_rad(50.0)) # the dummy 50° to one side of where he faces
	var f: Fighter = w[0]
	var c: CombatController = w[2]
	_run(c, 0.5, [0.0])
	var err := ""
	var off := absf(rad_to_deg(wrapf(f.facing - PI, -PI, PI)))
	if off > 3.0:
		err = "after the strike's startup he still faces %.1f° off the dummy" % off
	elif _steps(c) != [[1, 1, 10]]:
		err = "the turned strike: %s" % [_steps(c)]
	_clear()
	return err


## The hit shape against the visible swing (GPT's M3 review: validate each attack's hit shape against its animation).
## Each attack's move is posed as the game plays it (started at anim_from, at anim_speed) at 13 moments through its
## active window, and the blade Godot draws — near the guard and at the tip — is compared with the baked path the hit
## test sweeps (samurai_blades.json). They must agree within 6 cm. The table is printed for the report.
func test_each_attacks_hit_path_is_its_visible_blade() -> String:
	var tree := Engine.get_main_loop() as SceneTree
	var v := CharacterVisual.create()
	tree.root.add_child(v)
	var hand := v.skeleton.find_bone("hand_r")
	var err := ""
	var all := AttackData.load_set()
	for id in ["basic1", "basic2", "basic3", "heavy"]:
		var a: AttackData = all[id]
		if a.blade_tip.size() != 13:
			err = "%s has no baked blade" % id
			break
		v.anim.play(v._alias[a.anim], 0.0)
		var worst := 0.0
		var rows: Array[String] = []
		for i in 13:
			var f := i / 12.0
			v.anim.seek(a.anim_from + (a.startup + f * a.active) * a.anim_speed, true)
			v.skeleton.force_update_all_bone_transforms()
			var pose := v.skeleton.global_transform * v.skeleton.get_bone_global_pose(hand)
			var tip := pose * (CharacterVisual.GRIP * Vector3(0, 0.792, 0))
			var base := pose * (CharacterVisual.GRIP * Vector3(0, 0.12, 0))
			var off := maxf(tip.distance_to(a.blade_tip[i]), base.distance_to(a.blade_base[i]))
			worst = maxf(worst, off)
			if i % 3 == 0:
				var b := SwordSweep.bearing(Vector3.ZERO, 0.0, tip)
				rows.append("f%.2f tip %+.0f° %.2fm h%.2f (baked %+.0f°, Δ%.0fcm)" % [f, b.x, b.y, tip.y,
					SwordSweep.bearing(Vector3.ZERO, 0.0, a.blade_tip[i]).x, off * 100.0])
		print("[BLADE] %s %s: worst Δ %.1f cm | %s" % [id, a.anim, worst * 100.0, " | ".join(rows)])
		if worst > 0.06:
			err = "%s: the baked blade is %.1f cm from the blade Godot draws" % [id, worst * 100.0]
			break
	v.free()
	return err


## GPT's M3 review: the assist's cone is ±60° — a target 70° to his left is not turned to (and Basic 1, which cuts
## from his right to 15° left, misses it).
func test_the_assist_ignores_a_target_outside_its_cone() -> String:
	var w := _world(1.5, PI - deg_to_rad(70.0))
	var f: Fighter = w[0]
	var c: CombatController = w[2]
	var before := f.facing
	_run(c, 0.5, [0.0])
	var err := ""
	if absf(wrapf(f.facing - before, -PI, PI)) > 0.01:
		err = "he turned %.1f° toward a target outside the cone" % rad_to_deg(absf(wrapf(f.facing - before, -PI, PI)))
	elif _steps(c) != [[1, 0, 0]]:
		err = "a strike past a target 70° aside: %s" % [_steps(c)]
	_clear()
	return err


## Human tapping rhythms (GPT's M3 review: varied intervals, and rapid tapping — not only the CI's 60 ms taps). A
## thumb tapping steadily every 0.15 s, 0.25 s, 0.35 s, 0.45 s or 0.6 s makes the chain (a tap that lands while the
## next strike is already held is simply not needed); tapping as fast as a thumb can (every 60 ms) makes it too;
## taps 0.8 s apart are first strikes each time (the 0.35 s grace after a strike has passed).
func test_human_tapping_rhythms_make_the_chain() -> String:
	var chain := [[1, 1, 10], [2, 1, 12], [3, 1, 18]]
	for gap in [0.06, 0.15, 0.25, 0.35, 0.45, 0.6, 0.8]:
		var w := _world(1.6, PI)
		var c: CombatController = w[2]
		# tap every `gap` until the third strike has begun, then let it finish
		var t := 0.0
		var next := 0.0
		var buffered := -1.0
		while t < 6.0 and (c.stats["strikes"] < 3 or c.melee.is_attacking()):
			t += DT
			if t >= next and c.stats["strikes"] < 3:
				next += gap
				buffered = 0.12
			if buffered > 0.0:
				if c.try_attack():
					buffered = -1.0
				elif not c.is_frozen():
					buffered -= DT
			c.tick(DT, Vector3.ZERO)
		var got := _steps(c).slice(0, 3)
		_clear()
		var want: Array = chain if gap < 0.7 else [[1, 1, 10], [1, 1, 10], [1, 1, 10]]
		if got != want:
			return "taps every %.2f s: %s (want %s)" % [gap, got, want]
	return ""


## M4 stage A: Heavy (GPT: 330/110/350 ms, 30) through the same resolver — one hit for 30 and a push, on its own
## button; the chain is not touched by it, and an Attack press during it brings the first strike after it.
func test_heavy_lands_once_for_30_and_pushes() -> String:
	var w := _world(1.6, PI)
	var d: TrainingDummy = w[1]
	var c: CombatController = w[2]
	var err := ""
	if not c.try_press("heavy"):
		err = "the heavy press was refused"
	else:
		var t := 0.0
		while t < 1.2:
			t += DT
			c.tick(DT, Vector3.ZERO)
		if _steps(c) != [[0, 1, 30]]:
			err = "heavy: %s (want one hit for 30, off the chain)" % [_steps(c)]
		elif d.hp != TrainingDummy.MAX_HP - 30:
			err = "the dummy has %d HP after a heavy" % d.hp
		elif not is_equal_approx(d._push_from.distance_to(d._push_to), 0.5):
			err = "the heavy pushed %s m" % d._push_from.distance_to(d._push_to)
	_clear()
	return err
