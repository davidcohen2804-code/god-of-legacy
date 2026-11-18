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
