extends RefCounted
## The sword's state machine (MeleeState), driven tick by tick like the game's fixed physics step: the three-hit chain
## advances only on confirmed hits, a miss or an expired chain starts over, a swing hits a target once, hit-stop
## freezes the timers, dodges and presses are allowed only where the rules say.

const DT := 1.0 / 60.0
const T1 := 1001
const T2 := 2002


func _ticks(s: MeleeState, seconds: float) -> void:
	for i in int(round(seconds / DT)):
		s.step(DT)


## Tick until the strike's active window has swept (part of) its arc; true if it did within `limit` seconds.
func _until_swept(s: MeleeState, limit: float = 1.0) -> bool:
	for i in int(limit / DT):
		s.step(DT)
		if s.swept.x >= 0.0:
			return true
	return false


func _until_phase(s: MeleeState, p: MeleeState.Phase, limit: float = 2.0) -> bool:
	for i in int(limit / DT):
		if s.phase == p:
			return true
		s.step(DT)
	return s.phase == p


func _damage(s: MeleeState) -> int:
	var d := 0
	for e in s.events:
		if e["type"] == "hit":
			d += int(e["damage"])
	return d


func test_frame_data_is_gpts() -> String:
	var a := AttackData.samurai_basics()
	var want := [[0.12, 0.075, 0.17, 10], [0.11, 0.085, 0.17, 12], [0.16, 0.10, 0.22, 18]]
	for i in 3:
		var w: Array = want[i]
		if not (is_equal_approx(a[i].startup, w[0]) and is_equal_approx(a[i].active, w[1])
				and is_equal_approx(a[i].recovery, w[2]) and a[i].damage == w[3]):
			return "basic%d is %s/%s/%s %s" % [i + 1, a[i].startup, a[i].active, a[i].recovery, a[i].damage]
	return ""


func test_three_confirmed_hits_make_the_chain() -> String:
	var s := MeleeState.new()
	if not s.attack_pressed():
		return "the first press was refused"
	for k in 3:
		if s.step_index != k:
			return "strike %d expected, strike %d running" % [k + 1, s.step_index + 1]
		if not _until_swept(s):
			return "strike %d never swept" % (k + 1)
		if not s.hit_confirmed(T1):
			return "strike %d's hit not confirmed" % (k + 1)
		if s.hit_confirmed(T1):
			return "strike %d hit the same target twice" % (k + 1)
		if not _until_phase(s, MeleeState.Phase.RECOVERY):
			return "strike %d never recovered" % (k + 1)
		if k < 2:
			s.attack_pressed() # held as the chain's next strike
			if not _until_phase(s, MeleeState.Phase.STARTUP, 0.5):
				return "strike %d did not chain" % (k + 2)
	if _damage(s) != 40:
		return "the chain dealt %d (want 40)" % _damage(s)
	_until_phase(s, MeleeState.Phase.FREE)
	if s.next_step != 0:
		return "after the third strike the chain still points at strike %d" % (s.next_step + 1)
	return ""


func test_a_miss_does_not_advance_the_chain() -> String:
	var s := MeleeState.new()
	s.attack_pressed()
	_until_phase(s, MeleeState.Phase.RECOVERY)
	s.attack_pressed() # pressed again after a whiff
	if not _until_phase(s, MeleeState.Phase.STARTUP, 0.6):
		return "the second press never started a strike"
	if s.step_index != 0:
		return "a miss advanced the chain to strike %d" % (s.step_index + 1)
	var missed := s.events.any(func(e: Dictionary) -> bool: return e["type"] == "miss")
	if not missed:
		return "no miss reported"
	if _damage(s) != 0:
		return "a miss dealt damage"
	return ""


func test_the_chain_expires() -> String:
	var s := MeleeState.new()
	s.attack_pressed()
	_until_swept(s)
	s.hit_confirmed(T1)
	_until_phase(s, MeleeState.Phase.FREE)
	if s.chain_open <= 0.0:
		return "no chain window after a confirmed hit"
	_ticks(s, MeleeState.CHAIN_GRACE + 0.05)
	s.attack_pressed()
	if s.step_index != 0:
		return "a press after the chain's grace started strike %d" % (s.step_index + 1)
	return ""


func test_the_chain_resumes_inside_its_grace() -> String:
	var s := MeleeState.new()
	s.attack_pressed()
	_until_swept(s)
	s.hit_confirmed(T1)
	_until_phase(s, MeleeState.Phase.FREE)
	_ticks(s, MeleeState.CHAIN_GRACE * 0.5)
	s.attack_pressed()
	return "" if s.step_index == 1 else "a press inside the grace started strike %d" % (s.step_index + 1)


func test_another_target_starts_the_chain_over() -> String:
	var s := MeleeState.new()
	s.attack_pressed()
	_until_swept(s)
	s.hit_confirmed(T1)
	_until_phase(s, MeleeState.Phase.RECOVERY)
	s.attack_pressed()
	_until_phase(s, MeleeState.Phase.STARTUP, 0.5)
	_until_swept(s)
	s.hit_confirmed(T2) # strike 2 lands on someone else
	_until_phase(s, MeleeState.Phase.FREE)
	s.attack_pressed()
	return "" if s.step_index == 0 else "after a target switch the chain went on to strike %d" % (s.step_index + 1)


func test_hit_stop_freezes_the_strike() -> String:
	var s := MeleeState.new()
	s.attack_pressed()
	_until_swept(s)
	var t0 := s.t
	var ph := s.phase
	s.hit_confirmed(T1)
	if not is_equal_approx(s.hitstop, s.current().hit_stop):
		return "hit-stop %s (want %s)" % [s.hitstop, s.current().hit_stop]
	s.step(DT)
	if s.t != t0 or s.phase != ph or s.swept.x >= 0.0:
		return "the strike moved during hit-stop"
	_ticks(s, 0.05)
	return "" if s.hitstop == 0.0 else "hit-stop never ended"


func test_presses_and_dodges_follow_the_rules() -> String:
	var s := MeleeState.new()
	if not s.can_dodge():
		return "cannot dodge while free"
	s.attack_pressed()
	if s.can_dodge():
		return "could dodge in startup"
	if s.attack_pressed():
		return "a press in startup was taken"
	_until_phase(s, MeleeState.Phase.ACTIVE)
	if s.can_dodge():
		return "could dodge in the active window"
	_until_phase(s, MeleeState.Phase.RECOVERY)
	if s.can_dodge():
		return "could dodge at the start of recovery"
	_ticks(s, s.current().recovery * 0.6)
	if s.phase == MeleeState.Phase.RECOVERY and not s.can_dodge():
		return "could not dodge late in recovery"
	s.dodge_started()
	if s.phase != MeleeState.Phase.FREE or s.next_step != 0:
		return "the dodge did not cancel the strike and the chain"
	return ""


func test_a_hit_interrupts_the_chain() -> String:
	var s := MeleeState.new()
	s.attack_pressed()
	_until_swept(s)
	s.hit_confirmed(T1)
	s.take_hit(0.3)
	if s.phase != MeleeState.Phase.HITSTUN or s.attack_pressed():
		return "hit-stun did not hold the fighter"
	_ticks(s, 0.32)
	if s.phase != MeleeState.Phase.FREE:
		return "hit-stun never ended (still %s, %.3f s left)" % [MeleeState.Phase.keys()[s.phase], s.hitstun]
	s.attack_pressed()
	return "" if s.step_index == 0 else "after being hit the chain went on to strike %d" % (s.step_index + 1)


## M4 stage A: the actions other than the chain (Heavy, later the skills) run through the same state machine.
func _action(id: String, cooldown: float = 0.0, events: Array = []) -> AttackData:
	var a := AttackData.make(id, 0.2, 0.1, 0.2, 20, 0.05, 0.1, 0.0, "", 0.0, 1.0, Vector2(-40, 40), 1.5, 0.0)
	a.cooldown = cooldown
	a.events = events
	return a


func test_heavy_is_gpts() -> String:
	var h := AttackData.get_attack("heavy")
	if h == null:
		return "no heavy attack in the data"
	if not (is_equal_approx(h.startup, 0.33) and is_equal_approx(h.active, 0.11) and is_equal_approx(h.recovery, 0.35)
			and h.damage == 30 and h.button == "heavy"):
		return "heavy is %s/%s/%s %s on %s" % [h.startup, h.active, h.recovery, h.damage, h.button]
	if AttackData.for_button("heavy") != h:
		return "the heavy button does not start the heavy attack"
	return ""


func test_another_action_breaks_the_chain() -> String:
	var s := MeleeState.new()
	s.attack_pressed()
	_until_swept(s)
	s.hit_confirmed(T1)
	_until_phase(s, MeleeState.Phase.FREE)
	if s.next_step != 1:
		return "no chain open after a confirmed first strike"
	if not s.action_pressed(_action("heavy_test")):
		return "a free fighter could not start another action"
	if s.step_index != -1 or s.next_step != 0 or s.chain_open > 0.0:
		return "the chain survived another action (step %d, next %d)" % [s.step_index, s.next_step]
	_until_phase(s, MeleeState.Phase.FREE)
	s.attack_pressed()
	return "" if s.step_index == 0 else "after another action the chain went on to strike %d" % (s.step_index + 1)


func test_actions_wait_for_free_and_for_their_cooldown() -> String:
	var s := MeleeState.new()
	var a := _action("cd_test", 1.0)
	s.attack_pressed()
	if s.action_pressed(a):
		return "another action started in the middle of a strike"
	_until_phase(s, MeleeState.Phase.FREE)
	if not s.action_pressed(a):
		return "the action did not start from free"
	_until_phase(s, MeleeState.Phase.FREE)
	if s.action_pressed(a):
		return "the action started again while cooling down (%.2f s left)" % s.cooldown_left("cd_test")
	_ticks(s, 1.0)
	if s.cooldown_left("cd_test") > 0.0 or not s.action_pressed(a):
		return "the action was not ready after its cooldown"
	return ""


func test_an_attack_press_during_an_action_follows_it() -> String:
	var s := MeleeState.new()
	s.action_pressed(_action("heavy_test"))
	_until_phase(s, MeleeState.Phase.RECOVERY)
	if not s.attack_pressed():
		return "an Attack press during the action's recovery was refused"
	_until_phase(s, MeleeState.Phase.STARTUP, 1.0)
	return "" if s.step_index == 0 else "the held Attack press did not start the first strike (step %d)" % s.step_index


func test_action_events_fire_once_in_order() -> String:
	var s := MeleeState.new()
	s.action_pressed(_action("ev_test", 0.0, [{"at": 0.05, "name": "release"}, {"at": 0.25, "name": "mark"}]))
	var fired: Array[String] = []
	for i in 60:
		s.step(DT)
		if s.swept.x >= 0.0:
			s.hit_confirmed(T1) # (a hit-stop in the middle must not repeat or skip anything)
		for e in s.events:
			if e["type"] == "event":
				fired.append(String(e["name"]))
		s.events.clear()
	return "" if fired == ["release", "mark"] else "the action's events fired as %s" % [fired]
