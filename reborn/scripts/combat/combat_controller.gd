class_name CombatController
extends Node
## Binds the combat state machine (MeleeState) to the Samurai's body, moves and targets, one fixed physics tick at a
## time (the player controller hands it the tick's presses, then calls tick()):
##   1. a conditional press waiting for its moment starts when the graph allows it; the state machine steps (startup →
##      active → recovery, hit-stop, the chain, cooldowns);
##   2. a sword action's blade — its baked path over the slice of the active window this tick covered — is tested
##      against every target in the "hurtbox" group (SwordSweep), each target at most once per action; a confirmed hit
##      starts hit-stop and the target's reaction;
##   3. the Phantom Chain in flight moves on (ChainShot: swept against the targets and the world); a pull under way is
##      watched to its end; the Legacy Chain's windows age (not through hit-stop) and close when their target no longer
##      qualifies;
##   4. its events start the moves; through startup he turns toward the target the action picked (assist: the nearest
##      within its range and 60° of the stick, or of his facing when the stick is idle — never a full turn-around) or
##      else toward the stick, steps into a cut (stopping short of the target), and through hit-stop body, move, blade
##      trail and target all hold still; a landed blow jolts the camera, a pushing blow harder (restrained: mobile).
## Every action is data (AttackData): Attack runs the chain; Heavy and the skills start the action bound to their
## button; the Legacy Chain's conditional abilities start from its two buttons — the resolver (LegacyChain), fed only
## by confirmed combat events, decides what each button holds. Animation, camera, sound and effects only follow what
## the state machine decided — they listen to the signals; nothing here reads the animation back.
## Enemy blows (M4 Stage C: the Training Automaton's) come in through `incoming`: each tick of an attacker's active
## window is resolved against his body along its movement through the tick (HitResolver) — a blow that would have
## struck him inside Shadow Step's defensive window is a genuine evasion (attack_evaded: Shadow Counter opens against
## that attacker); one inside a roll's window is avoided (nothing opens); any other contact lands (damage, hitstun,
## his opportunities close). Shadow Step itself is a burst of movement along the stick (backward when it is idle) that
## keeps his facing; Shadow Counter dashes at its attacker through its startup, then strikes like any cut.

## An action began (`step`: its place in the Attack chain, 0..2, or -1).
signal strike_started(a: AttackData, step: int)
## Its active window opened (the blade is cutting, the chain is thrown…).
signal strike_active(a: AttackData, step: int)
## It landed on `target` (`dir`: flat, from the attacker to the target).
signal strike_hit(a: AttackData, step: int, target: Node3D, dir: Vector3)
## It ended without a hit.
signal strike_missed(a: AttackData, step: int)
## An outcome the player should read (the chain missed or was blocked, a target resisted, a pull was blocked…).
signal notice(text: String)
## The resolver's authoritative evasion: `attacker_id`'s attack `attack_id` would have struck `defender_id` (him) inside
## Shadow Step's defensive window and was prevented by it. Once per qualifying attack.
signal attack_evaded(attacker_id: int, defender_id: int, attack_id: String)
## An enemy's blow landed on him (`dir`: flat, from the attacker toward him).
signal blow_taken(a: AttackData, attacker: Node3D, dir: Vector3)
signal hp_changed(hp: int, max_hp: int)

const STOP_SHORT := 1.1 ## the step into a cut stops this close to the target's centre, m
const STANCE_TIME := 4.0 ## the drawn-sword stance after an action, s
const PUSH_TIME := 0.2 ## a blow's push on him lasts this long, s
## A step is blocked at once when a test move of its first BLOCK_PROBE m (sliding along what it touches) gets him
## less than half of that away (GPT's v1.4: no stationary shadow against a wall).
const BLOCK_PROBE := 0.6

## The target assist (GPT's M3 review: 3.6 m, ±60°, at most 12 rad/s through startup; it turns, never moves him).
var assist_range := 3.6
var assist_cone := 60.0 ## degrees either side of the stick (or of his facing when the stick is idle)
var assist_turn := 12.0 ## rad/s

var fighter: Fighter
var rig: CameraRig
var trail: BladeTrail
var melee := MeleeState.new()
## The Legacy Chain resolver (its graph from the data).
var legacy := LegacyChain.new(AttackData.graph())
## The Phantom Chain thrown (flying, holding its capture, or drawn back); null when none.
var shot: ChainShot
## Totals and the last actions, for the tests and the report: strike_log = [{step (1..3, 0 off the chain), id, hits,
## damage}], newest last.
var stats := {"strikes": 0, "hits": 0, "misses": 0, "damage": 0, "chains": 0}
var strike_log: Array[Dictionary] = []
## The last pull, for the tests and the report: {result: arrived | blocked | escaped | interrupted, dist, time}.
var last_pull := {}
## His health (GPT's M3 numbers: 200). In the training courtyard (`training`) he is never defeated: at 0 it refills.
var max_hp := 200
var hp := 200
var training := true
## Enemy blows so far: evaded (genuine evasions), avoided (a roll's window), taken.
var evasions := 0
var avoided := 0
var blows := 0

var _target: Node3D
var _aim := Vector3.ZERO
var _stance := 0.0
## A conditional press waiting for its earliest legal moment: {ability, target}.
var _queued := {}
## The target of the conditional ability starting now.
var _cond_target: Node3D
## The target being pulled, and the pull action.
var _pulling: Node3D
var _pull_action: AttackData
## A leap's path (Aerial Pursuit): from where he left the ground to where he strikes.
var _leap_from := Vector3.ZERO
var _leap_to := Vector3.ZERO
## The action this tick ran (null when none) and how far into it the tick began and ended (s from its start) — the
## defensive window's place in the tick, Shadow Step's and Shadow Counter's movement through it.
var _span_action: AttackData
var _span_e := Vector2(-1, -1)
## Shadow Step's direction (flat, world space); its Shadow Origin — where he stood when its movement began (GPT's v1.4
## rule B: through the defensive window a blow is tested against him there) — and whether it was blocked at once;
## Shadow Counter's dash length (m) and how far it has gone.
var _step_dir := Vector3.ZERO
var _shadow_at := Vector3.INF
var _shadow_blocked := false
var _dash_len := 0.0
var _dash_moved := 0.0
## A blow's push on him: along `_push_dir`, `_push_dist` m in all, `_push_left` s still to go.
var _push_dir := Vector3.ZERO
var _push_dist := 0.0
var _push_left := 0.0


## Dodging is allowed from free movement, or in the later part of an action's recovery (cancelling it and the chain).
func can_dodge() -> bool:
	return melee.can_dodge() and fighter.state == "ground" and fighter.is_on_floor() and not fighter.frozen


func on_dodge() -> void:
	melee.dodge_started()
	fighter.action_lock = false
	fighter.action_velocity = Vector3.ZERO


func busy() -> bool:
	return melee.locks_movement()


## An Attack press from the input buffer: true when the state machine took it (a strike started, or the next one
## held). Not in the air or mid-roll. During hit-stop a press is held for the next strike like any other.
func try_attack() -> bool:
	return try_press("attack")


## A press of `button` from the input buffer: Attack runs the chain; another button starts the action bound to it in
## the data (Heavy, the skills) when the state machine allows it (free, off cooldown) and its range check passes. True
## when taken. (A refused press starts nothing — no cooldown.)
func try_press(button: String) -> bool:
	if fighter.state != "ground":
		return false
	if button == "attack":
		return melee.attack_pressed()
	var a := AttackData.for_button(button)
	if a == null:
		return false
	if a.needs_target_within > 0.0 and _nearest_alive(a.needs_target_within) == null:
		QA.flag("out_of_range", a.id)
		return false
	return melee.action_pressed(a)


## A press on conditional button `slot` (0, 1): the opportunity that button shows now is the one asked for. It starts
## at once when it may; otherwise it waits (queued) for its earliest legal moment — the cancel point the graph allows,
## or the end of the action — as long as the opportunity stays open. False when the button holds nothing.
func try_conditional(slot: int) -> bool:
	var o := legacy.in_slot(slot)
	if o.is_empty():
		return false
	_queued = {"ability": String(o["ability"]), "target": int(o["target"])}
	QA.flag("cond_pressed", String(o["ability"]))
	_try_queued()
	return true


## The overflow's choice: bring the best waiting opportunity onto a button.
func promote_waiting() -> bool:
	return legacy.promote()


## The fighter was hit (M5) or otherwise interrupted: his opportunities close and the chain lets go.
func interrupted(why: String = "interrupted") -> void:
	legacy.interrupt(why)
	_queued = {}
	_let_go()


func is_frozen() -> bool:
	return melee.hitstop > 0.0


func tick(dt: float, stick_dir: Vector3) -> void:
	_try_queued()
	_span_action = melee.current() if melee.is_attacking() else null
	var e0 := melee.elapsed() if _span_action else -1.0
	melee.step(dt)
	_span_e = Vector2(e0, _elapsed_of(_span_action))
	_events(stick_dir) # (an action's start and its active window before its hits: the swing sounds before the impact)
	if _span_action and _span_action.kind == "step" and _span_e.x < _span_action.startup \
			and _span_e.y >= _span_action.startup:
		_shadow_origin() # (its movement begins in this tick: he still stands where it began)
	var a := melee.current()
	if a and a.kind == "melee" and melee.swept.x >= 0.0:
		for t in get_tree().get_nodes_in_group("hurtbox"):
			var target := t as Node3D
			if target == null or (target.has_method("is_alive") and not target.is_alive()):
				continue
			if a.air and not (target.has_method("is_airborne") and target.is_airborne()):
				continue # (an aerial strike is at an airborne target: one already down is not struck)
			# (a target that moves itself on the tick says where it stood when the tick began: its movement through
			# the tick is swept too)
			var from: Variant = target.get("prev_position")
			if SwordSweep.hits(a, fighter.global_position, fighter.facing, melee.swept, target.global_position,
					float(target.get("hurt_radius")), float(target.get("hurt_height")),
					from if from is Vector3 else Vector3.INF):
				if melee.hit_confirmed(target.get_instance_id()):
					_land(a, target)
	_events(stick_dir)
	_tick_shot(dt)
	_tick_pull()
	if melee.hitstop <= 0.0:
		legacy.step(dt) # (the windows hold through hit-stop)
	_check_opportunities()
	if legacy.events.size() > 64:
		legacy.events = legacy.events.slice(-32) # (nothing drains them in play: keep the latest for the tests)
	# the body: held still through hit-stop, driven by the action while it lasts
	var frozen := melee.hitstop > 0.0
	fighter.frozen = frozen
	fighter.action_lock = melee.locks_movement()
	if melee.is_attacking() and fighter.visual.anim and fighter.visual.current == a.anim:
		fighter.visual.anim.speed_scale = 0.0 if frozen else a.anim_speed
	elif melee.phase == MeleeState.Phase.HITSTUN and fighter.visual.anim:
		fighter.visual.anim.speed_scale = 0.0 if frozen else 1.0
	fighter.action_velocity = Vector3.ZERO
	fighter.action_air = false
	if a and a.air and melee.is_attacking():
		_air_body(a, dt, frozen)
	elif melee.phase == MeleeState.Phase.HITSTUN:
		_stun_body(dt, frozen)
	elif a and a.kind == "step" and _span_action == a:
		_step_body(a, dt, frozen)
	elif not frozen and (melee.phase == MeleeState.Phase.STARTUP or melee.phase == MeleeState.Phase.ACTIVE):
		var step := fighter.forward() * a.lunge / (a.startup + a.active)
		if not a.dash.is_empty():
			step = _dash_velocity(a, dt)
		if _target and is_instance_valid(_target):
			if a.dash.is_empty() and _flat(_target.global_position - fighter.global_position).length() < STOP_SHORT:
				step = Vector3.ZERO
			if melee.phase == MeleeState.Phase.STARTUP:
				_face_target(a, dt)
		elif melee.phase == MeleeState.Phase.STARTUP and _aim != Vector3.ZERO:
			fighter.face_toward(fighter.global_position + _aim, assist_turn, dt)
		fighter.action_velocity = step
	_stance = maxf(0.0, _stance - dt)
	fighter.combat_ready = _stance > 0.0
	if trail:
		var sword := a != null and a.kind == "melee"
		var cutting := melee.phase == MeleeState.Phase.ACTIVE
		var near_cut := (melee.phase == MeleeState.Phase.STARTUP and melee.t > a.startup - 0.05) \
			or (melee.phase == MeleeState.Phase.RECOVERY and melee.t < 0.07)
		trail.emitting = sword and (cutting or near_cut)
		trail.frozen = frozen


func _land(a: AttackData, target: Node3D) -> void:
	var dir := _flat(target.global_position - fighter.global_position).normalized()
	# the target sways along the blade's travel (its path runs toward his left or right) as well as away from him
	var side := Vector3(dir.z, 0.0, -dir.x) * signf(a.arc_to - a.arc_from)
	if target.has_method("take_hit"):
		target.take_hit(a.damage, a.reaction, a.knockback, dir, (dir * 0.55 + side * 0.85).normalized())
	if not a.launch.is_empty():
		_launch(a, target)
	if not a.spike.is_empty() and target.has_method("spike") and target.is_airborne():
		target.spike(float(a.spike.get("start", 3.0)), float(a.spike.get("accel", 45.0)), float(a.spike.get("top", 10.0)))
	_after_hit(a, target, dir, melee.step_index)


## An enemy's blow this tick — `a`'s active window over `span` (fractions), by `attacker` (a Node3D with `facing`) —
## resolved against his body through its movement this tick and his defensive windows (HitResolver), and acted on:
## "hit" (damage, hitstun, interrupted), "evaded" (the authoritative attack_evaded: Shadow Counter opens against the
## attacker), "avoided" (a roll's window: nothing opens) — or "" when the blade does not touch him. The attacker asks
## for each tick of its active window, until it has a result against him (one result per attack).
func incoming(a: AttackData, attacker: Node3D, span: Vector2) -> String:
	if a == null or attacker == null or span.x < 0.0:
		return ""
	var shadow := Vector3.INF
	if _span_action and _span_action.kind == "step" and String(_span_action.step.get("evade", "body")) == "shadow":
		shadow = _shadow_at
	var r := HitResolver.resolve(a, attacker.global_position, float(attacker.get("facing")), span,
		fighter.prev_position, fighter.global_position, fighter.hurt_radius, fighter.hurt_height,
		evasion_span(), fighter.iframe_span(), shadow, _shadow_blocked)
	if r.is_empty():
		return ""
	var result := String(r["result"])
	match result:
		"evaded":
			_evaded(a, attacker)
		"avoided":
			avoided += 1
			QA.flag("blow_avoided", a.id)
		"hit":
			_take_blow(a, attacker)
	return result


## The part of his last tick (fractions 0..1) that lay inside Shadow Step's defensive window; (-1, -1) when none
## (also once a blow has struck him: whatever he was doing was cut off).
func evasion_span() -> Vector2:
	if _span_action == null or _span_action.kind != "step" or melee.phase == MeleeState.Phase.HITSTUN:
		return Vector2(-1, -1)
	return HitResolver.overlap(_span_action.defense_window(), _span_e)


## Shadow Step's Shadow Origin (INF before its movement began).
func shadow_origin() -> Vector3:
	return _shadow_at


## Is he inside Shadow Step's defensive window now?
func evading() -> bool:
	var a := melee.current()
	if a == null or a.kind != "step" or not melee.is_attacking():
		return false
	var w := a.defense_window()
	return melee.elapsed() >= w.x and melee.elapsed() <= w.y


## Shadow Step's movement begins: its Shadow Origin is where he stands now; and is the step blocked at once — a test
## move of its first BLOCK_PROBE m along its direction, sliding along what it touches, gets him less than half of
## that away (against a wall: then it earns no evasion, GPT's v1.4)?
func _shadow_origin() -> void:
	_shadow_at = fighter.global_position
	_shadow_blocked = false
	if fighter.is_inside_tree():
		var t := fighter.global_transform
		t.origin.y += 0.05 # (clear of the floor it stands on)
		var start := t.origin
		var motion := _step_dir * BLOCK_PROBE
		for i in 3:
			var c := KinematicCollision3D.new()
			if not fighter.test_move(t, motion, c):
				t.origin += motion
				break
			t.origin += c.get_travel()
			motion = c.get_remainder().slide(c.get_normal())
			motion.y = 0.0
			if motion.length() < 0.01:
				break
		_shadow_blocked = _flat(t.origin - start).length() < BLOCK_PROBE * 0.5
	QA.flag("shadow_origin", "%.2f,%.2f%s" % [_shadow_at.x, _shadow_at.z, ":blocked" if _shadow_blocked else ""])


## A genuine evasion: the resolver's authoritative event — Shadow Counter opens against that attacker.
func _evaded(a: AttackData, attacker: Node3D) -> void:
	evasions += 1
	var id := attacker.get_instance_id()
	legacy.event("evaded", id)
	QA.flag("evaded", "%s:%d" % [a.id, evasions])
	attack_evaded.emit(id, fighter.get_instance_id(), a.id)


## A blow landed on him: its damage; its hitstun cuts off whatever he was doing (a roll too) — his opportunities close
## and the chain lets go; its push (GPT's v1.4: 350 ms of hitstun, a 0.35 m controlled push, for the automaton's
## sweep); a flinch and the camera's jolt.
func _take_blow(a: AttackData, attacker: Node3D) -> void:
	var dir := _flat(fighter.global_position - attacker.global_position)
	dir = dir.normalized() if dir.length() > 0.01 else -fighter.forward()
	blows += 1
	hp = maxi(0, hp - a.damage)
	if hp == 0 and training:
		_training_refill()
	hp_changed.emit(hp, max_hp)
	fighter.cancel_dodge()
	interrupted("hit")
	melee.take_hit(a.reaction)
	melee.hitstop = a.hit_stop # (he holds still for the blow's hit-stop, then reels)
	_push_dir = dir
	_push_dist = a.knockback
	_push_left = PUSH_TIME if a.knockback > 0.0 else 0.0
	fighter.visual.play("Hit_Chest", 0.05, 1.0, true)
	if rig:
		rig.shake(0.5)
	QA.flag("blow_taken", "%s:%d" % [a.id, hp])
	blow_taken.emit(a, attacker, dir)


## The training courtyard's rule, apart from any defeat (GPT's v1.4: approved for training, separate from normal
## defeat logic): at 0 his health comes back whole.
func _training_refill() -> void:
	hp = max_hp
	notice.emit("Health restored (training)")
	QA.flag("player_restored", true)


## How far into `a` the state machine is now (its whole length once it has ended); -1 for none.
func _elapsed_of(a: AttackData) -> float:
	if a == null:
		return -1.0
	if melee.current() == a and melee.is_attacking():
		return melee.elapsed()
	return a.total()


## Shadow Step's burst: still through startup; through the active window along its direction — `step.distance` m on a
## smooth curve, easing in and out — moved by his body with collision (a wall stops it or turns it aside); still
## through recovery. His facing is kept (he faces his foe as he steps). Each tick moves him over the part of the
## action's time the tick ran through, so the burst is the same at any tick rate.
func _step_body(a: AttackData, dt: float, frozen: bool) -> void:
	if frozen or _span_e.x < 0.0:
		return
	var m0 := clampf((_span_e.x - a.startup) / maxf(a.active, 0.0001), 0.0, 1.0)
	var m1 := clampf((_span_e.y - a.startup) / maxf(a.active, 0.0001), 0.0, 1.0)
	if m1 <= m0:
		return
	var dist := float(a.step.get("distance", 4.0))
	fighter.action_velocity = _step_dir * dist * (_smooth(m1) - _smooth(m0)) / maxf(dt, 0.0001)


## Shadow Counter's dash through startup: toward its target as it stands now (following it), `dash.max` m at most in
## all and stopping `dash.stop` m short of its centre, easing out; his body moves it with collision — nothing solid
## is passed through, and he never ends up behind the target. Nothing after startup.
func _dash_velocity(a: AttackData, dt: float) -> Vector3:
	if _target == null or not is_instance_valid(_target) or _span_e.x < 0.0:
		return Vector3.ZERO
	var k0 := clampf(_span_e.x / maxf(a.startup, 0.0001), 0.0, 1.0)
	var k1 := clampf(_span_e.y / maxf(a.startup, 0.0001), 0.0, 1.0)
	if k1 <= k0:
		return Vector3.ZERO
	var to := _flat(_target.global_position - fighter.global_position)
	var room := to.length() - float(a.dash.get("stop", STOP_SHORT))
	if room <= 0.0:
		return Vector3.ZERO
	var d := minf(_dash_len * (_ease_out(k1) - _ease_out(k0)), room)
	_dash_moved += d
	return to.normalized() * d / maxf(dt, 0.0001)


## Reeling from a blow: pushed `_push_dist` m away from the attacker over PUSH_TIME, easing out, with collision.
func _stun_body(dt: float, frozen: bool) -> void:
	if frozen or _push_left <= 0.0:
		return
	var k0 := 1.0 - _push_left / PUSH_TIME
	_push_left = maxf(0.0, _push_left - dt)
	var k1 := 1.0 - _push_left / PUSH_TIME
	fighter.action_velocity = _push_dir * _push_dist * (_ease3(k1) - _ease3(k0)) / maxf(dt, 0.0001)


## A launching blow landed: a launchable target is thrown up (its arc is its own), which opens Aerial Pursuit against
## it; a target that resists, or one still protected by the juggle cap, stays down — nothing opens.
func _launch(a: AttackData, target: Node3D) -> void:
	var data: Variant = target.get("target_data")
	var td: Dictionary = data if data is Dictionary else {}
	if not bool(td.get("launchable", false)) or not target.has_method("launch"):
		notice.emit("Resists the launch")
		QA.flag("launch", "resisted")
		return
	if not target.is_alive():
		return
	if target.launch(float(a.launch.get("height", 2.2)), float(a.launch.get("airtime", 0.9))):
		legacy.event("launched", target.get_instance_id())
		QA.flag("launch", String(target.name))
	else:
		notice.emit("Cannot be launched now")
		QA.flag("launch", "protected")


## Aerial Pursuit's leap: toward where the airborne target will be at the strike — he ends `leap.ahead` m short of it,
## `leap.below` m under its height (at least `leap.min_hop` m up: always a visible jump) — with collision; he is in the
## air from here.
func _begin_leap(a: AttackData) -> void:
	var at := fighter.global_position
	var tp := at + fighter.forward() * 2.0
	if _target and is_instance_valid(_target):
		tp = _target.predict(a.startup + a.active * 0.5) if _target.has_method("predict") else _target.global_position
	var flat := _flat(tp - at)
	var dir := flat.normalized() if flat.length() > 0.01 else fighter.forward()
	var dist := maxf(0.0, flat.length() - float(a.leap.get("ahead", 0.95)))
	_leap_from = at
	_leap_to = at + dir * dist
	_leap_to.y = maxf(at.y + float(a.leap.get("min_hop", 0.0)), tp.y - float(a.leap.get("below", 0.6)))
	fighter.begin_air_action()
	QA.flag("leap", "%.2f:%.2f" % [dist, _leap_to.y])


## The body through an air action: the leap through startup, a hang through the strike, then a fall (gravity) through
## recovery — he lands on his own afterwards if still in the air.
func _air_body(a: AttackData, dt: float, frozen: bool) -> void:
	if frozen:
		fighter.action_air = true
		return
	match melee.phase:
		MeleeState.Phase.STARTUP:
			var k := clampf(melee.t / maxf(a.startup, 0.001), 0.0, 1.0)
			var want := _leap_from.lerp(_leap_to, 1.0 - (1.0 - k) * (1.0 - k))
			fighter.action_air = true
			fighter.action_velocity = (want - fighter.global_position) / maxf(dt, 0.0001)
			if _target and is_instance_valid(_target):
				_face_target(a, dt)
		MeleeState.Phase.ACTIVE:
			fighter.action_air = true


## Turn toward the action's target through its startup (the assist), leaving it at the action's aim yaw.
func _face_target(a: AttackData, dt: float) -> void:
	var d := _target.global_position - fighter.global_position
	d.y = 0.0
	if a.aim_yaw != 0.0:
		d = d.rotated(Vector3.UP, -deg_to_rad(a.aim_yaw))
	fighter.face_toward(fighter.global_position + d, assist_turn, dt)


## Can `a` (an air action) reach `t` from here: still in the air at the strike, within its range (flat), with nothing
## solid in the way? (A target that will be down before the blade comes is not reachable — no strike at it.)
func _reachable(a: AttackData, t: Node3D) -> bool:
	var tp: Vector3 = t.predict(a.startup + a.active * 0.5) if t.has_method("predict") else t.global_position
	if t.has_method("is_airborne") and tp.y <= 0.05:
		return false
	if a.within > 0.0 and _flat(tp - fighter.global_position).length() > a.within:
		return false
	if not fighter.is_inside_tree():
		return true
	var q := PhysicsRayQueryParameters3D.create(fighter.global_position + Vector3(0, 1.0, 0), tp + Vector3(0, 0.6, 0),
		ChainShot.WORLD_MASK)
	return fighter.get_world_3d().direct_space_state.intersect_ray(q).is_empty()


## What every confirmed hit shares: the target's hit-stop, the totals and log, the camera's jolt, the signal.
func _after_hit(a: AttackData, target: Node3D, dir: Vector3, step: int, damage: int = -1) -> void:
	if target.has_method("freeze_for"):
		target.freeze_for(a.hit_stop)
	var dmg := a.damage if damage < 0 else damage
	stats["hits"] += 1
	stats["damage"] += dmg
	for i in range(strike_log.size() - 1, -1, -1):
		if strike_log[i]["id"] == a.id:
			strike_log[i]["hits"] += 1
			strike_log[i]["damage"] += dmg
			break
	if rig:
		rig.shake(0.6 if a.knockback > 0.0 else 0.22)
	strike_hit.emit(a, step, target, dir)


func _events(stick_dir: Vector3) -> void:
	for e in melee.events:
		var step := int(e.get("step", -1))
		match String(e["type"]):
			"start":
				var a := melee.current()
				if a.button == "cond":
					_target = _cond_target
					_aim = Vector3.ZERO
				else:
					_target = _pick_target(stick_dir, a.aim_range if a.aim_range > 0.0 else assist_range)
					_aim = _flat(stick_dir).normalized() if stick_dir.length() > 0.2 else Vector3.ZERO
				fighter.visual.play(a.anim, 0.05, a.anim_speed, true, a.anim_from)
				if a.air:
					_begin_leap(a)
				if a.kind == "step":
					# along the stick; backward (away from where he faces) when it is idle
					var sd := _flat(stick_dir)
					_step_dir = sd.normalized() if sd.length() > 0.2 else -fighter.forward()
					_shadow_at = Vector3.INF # (recorded when its movement begins)
					_shadow_blocked = false
					QA.flag("step", "%.2f,%.2f" % [_step_dir.x, _step_dir.z])
				if not a.dash.is_empty():
					_dash_moved = 0.0
					_dash_len = 0.0
					if _target and is_instance_valid(_target):
						_dash_len = clampf(_flat(_target.global_position - fighter.global_position).length()
							- float(a.dash.get("stop", STOP_SHORT)), 0.0, float(a.dash.get("max", 4.0)))
				_stance = STANCE_TIME
				stats["strikes"] += 1
				strike_log.append({"step": step + 1, "id": a.id, "hits": 0, "damage": 0})
				if strike_log.size() > 12:
					strike_log.pop_front()
				QA.flag("strike", a.id)
				strike_started.emit(a, step)
			"phase":
				if String(e["phase"]) == "ACTIVE":
					strike_active.emit(melee.current(), step)
			"event":
				match String(e["name"]):
					"release":
						_release(melee.current())
					"pull":
						_begin_pull(melee.current())
			"hit":
				QA.flag("strike_hit", "%s:%d" % [String(e["id"]), int(e["damage"])])
			"miss":
				var m := AttackData.get_attack(String(e["id"]))
				if m == null or m.kind == "melee": # (a thrown chain or a pull lands on its own, later)
					stats["misses"] += 1
					QA.flag("strike_miss", String(e["id"]))
					strike_missed.emit(melee.current(), step)
			"chain_done":
				stats["chains"] += 1
				QA.flag("chain_done", stats["chains"])
			"chain_reset":
				QA.flag("chain_reset", String(e["why"]))
			"ready":
				QA.flag("ready", String(e["id"]))
	melee.events.clear()


## The Phantom Chain leaves his hand: straight along his facing now — locked from here on.
func _release(a: AttackData) -> void:
	_let_go()
	var p := a.projectile
	var origin := fighter.global_position + fighter.forward() * float(p.get("ahead", 0.45)) \
		+ Vector3(0, float(p.get("height", 1.25)), 0)
	shot = ChainShot.new(a, origin, fighter.forward())
	QA.flag("chain_thrown", snappedf(rad_to_deg(fighter.facing), 0.1))


func _tick_shot(dt: float) -> void:
	if shot == null:
		return
	if shot.state != "flying":
		shot.advance(dt, [])
		if shot.state == "hit" and not _holds(shot.target):
			shot.let_go() # the capture ended (or the pull did): the chain lets go
		elif shot.since > 1.0:
			shot = null
		return
	var space: PhysicsDirectSpaceState3D = fighter.get_world_3d().direct_space_state if fighter.is_inside_tree() else null
	match shot.advance(dt, _living_targets(), space):
		"hit":
			_chain_hit(shot.action, shot.target)
		"blocked":
			QA.flag("chain_miss", "blocked")
			notice.emit("Chain blocked")
		"spent":
			QA.flag("chain_miss", "range")
			notice.emit("Chain missed")


## The chain struck `target`: its damage; a target that can be captured is held (less when captured again soon —
## or not at all while immune), which opens Chain Pull against it; one that resists takes the damage and a short
## stagger (at most 0.3 s), and nothing opens.
func _chain_hit(a: AttackData, target: Node3D) -> void:
	var dir := _flat(target.global_position - fighter.global_position).normalized()
	var data: Variant = target.get("target_data")
	var td: Dictionary = data if data is Dictionary else {}
	var dmg := a.damage
	if bool(td.get("pullable", false)) and target.has_method("capture"):
		target.take_hit(dmg, a.reaction, 0.0, dir)
		var hold := 0.0
		if target.is_alive():
			hold = float(target.capture(a.capture))
			if hold > 0.0:
				legacy.event("captured", target.get_instance_id())
				QA.flag("chain_capture", "%s:%.3f" % [target.name, hold])
			else:
				notice.emit("Immune to the chain")
				QA.flag("chain_capture", "immune")
		if hold <= 0.0:
			shot.let_go()
	else:
		target.take_hit(dmg, minf(float(td.get("stagger", 0.3)), 0.3), 0.0, dir)
		notice.emit("Resists the chain")
		QA.flag("chain_capture", "resisted")
		shot.let_go()
	_after_hit(a, target, dir, -1, dmg)


## Chain Pull's yank: the held target is dragged to the point 1.6 m ahead of him, taking clamp(d / 14, 0.25, 0.6) s
## for its d metres; his action lasts as long. A target no longer held is not pulled (escaped).
func _begin_pull(a: AttackData) -> void:
	var t := _target
	if t == null or not is_instance_valid(t) or not t.has_method("pull_to") or not _holds(t):
		_finish_pull({"result": "escaped"})
		melee.set_active(0.0)
		return
	var p := a.pull
	var end := fighter.global_position + fighter.forward() * float(p.get("ahead", 1.6))
	var d := _flat(end - t.global_position).length()
	var dur := clampf(d / float(p.get("speed", 14.0)), float(p.get("min", 0.25)), float(p.get("max", 0.6)))
	t.set("last_pull", {})
	if t.pull_to(end, dur):
		_pulling = t
		_pull_action = a
		melee.set_active(dur)
		QA.flag("pull_started", "%.2f:%.3f" % [d, dur])
	else:
		_finish_pull({"result": "escaped"})
		melee.set_active(0.0)


## Watch the pull to its end: on arrival the target takes the pull's damage; blocked, it takes none.
func _tick_pull() -> void:
	if _pulling == null:
		return
	if not is_instance_valid(_pulling):
		_finish_pull({"result": "interrupted"})
		return
	if String(_pulling.get("state")) == "pulled":
		return
	var r: Dictionary = _pulling.get("last_pull")
	var result := String(r.get("result", "interrupted"))
	if result == "arrived" and _pulling.is_alive():
		var dir := _flat(_pulling.global_position - fighter.global_position).normalized()
		_pulling.take_hit(_pull_action.damage, _pull_action.reaction, 0.0, dir)
		_after_hit(_pull_action, _pulling, dir, -1)
	elif result == "blocked":
		notice.emit("Pull blocked")
	if melee.action == _pull_action and melee.phase == MeleeState.Phase.ACTIVE:
		melee.set_active(0.0) # (his part ends with the drag)
	_finish_pull(r if not r.is_empty() else {"result": result})


func _finish_pull(r: Dictionary) -> void:
	last_pull = r.duplicate()
	QA.flag("pull", String(r.get("result", "")))
	if String(r.get("result", "")) == "escaped":
		notice.emit("Escaped")
	_pulling = null
	if shot and shot.state == "hit":
		shot.let_go()


## The waiting conditional press starts as soon as the graph allows it; it is dropped when its opportunity closed.
func _try_queued() -> void:
	if _queued.is_empty():
		return
	var ability := String(_queued["ability"])
	var target_id := int(_queued["target"])
	if not legacy.has(ability, target_id):
		QA.flag("cond_dropped", ability)
		_queued = {}
		return
	if fighter.state != "ground":
		return
	var a := AttackData.get_attack(ability)
	if a == null:
		_queued = {}
		return
	var edge := legacy.edge_for(ability)
	var cancel_v: Variant = edge.get("cancel", {})
	var cancel: Dictionary = cancel_v if cancel_v is Dictionary else {}
	_cond_target = instance_from_id(target_id) as Node3D
	if not melee.may_start_conditional(cancel):
		return # (not yet: it waits for its moment)
	if a.air and (_cond_target == null or not _reachable(a, _cond_target)):
		notice.emit("Out of reach")
		QA.flag("cond_refused", ability)
		_queued = {}
		return
	if melee.conditional_pressed(a, cancel):
		legacy.consume(ability, target_id)
		_queued = {}
		_events(Vector3.ZERO) # (its start, now: the target is set before the state machine steps it)


## Close each opportunity whose target no longer qualifies: gone, defeated, or out of the state its edge requires.
func _check_opportunities() -> void:
	for o in legacy.open.duplicate():
		var t := instance_from_id(int(o["target"])) as Node3D
		if t == null or not is_instance_valid(t) or (t.has_method("is_alive") and not t.is_alive()):
			legacy.close(String(o["ability"]), int(o["target"]), "defeated")
			continue
		match String(o["requires"]):
			"captured":
				if not _holds(t):
					legacy.close(String(o["ability"]), int(o["target"]), "released")
			"airborne":
				if not (t.has_method("is_airborne") and t.is_airborne()) or \
						(t.has_method("juggle_protected") and t.juggle_protected()):
					legacy.close(String(o["ability"]), int(o["target"]), "landed")


## Does the chain still hold `t` (captured, or being pulled in)?
func _holds(t: Node3D) -> bool:
	if t == null or not is_instance_valid(t):
		return false
	if t.has_method("is_captured") and t.is_captured():
		return true
	return t == _pulling


## The chain lets go of what it holds (a captured target is released; a pull already under way runs on).
func _let_go() -> void:
	if shot:
		if shot.state == "hit" and shot.target and is_instance_valid(shot.target) and shot.target.has_method("release"):
			shot.target.release()
		shot.let_go()


func _living_targets() -> Array:
	var out := []
	for t in get_tree().get_nodes_in_group("hurtbox"):
		var n := t as Node3D
		if n and not (n.has_method("is_alive") and not n.is_alive()):
			out.append(n)
	return out


## The target an action turns to: the nearest living one within `limit` m and the assist's cone around the stick's
## direction (or the facing when the stick is idle).
func _pick_target(stick_dir: Vector3, limit: float = -1.0) -> Node3D:
	var aim := stick_dir if stick_dir.length() > 0.2 else fighter.forward()
	var aim_yaw := atan2(aim.x, aim.z)
	var best: Node3D = null
	var best_d := assist_range if limit < 0.0 else limit
	for n: Node3D in _living_targets():
		var to := _flat(n.global_position - fighter.global_position)
		var d := to.length()
		if d > best_d:
			continue
		if absf(rad_to_deg(wrapf(atan2(to.x, to.z) - aim_yaw, -PI, PI))) > assist_cone:
			continue
		best = n
		best_d = d
	return best


## The nearest living target within `limit` metres (any direction) — the range check of actions that need one.
func _nearest_alive(limit: float) -> Node3D:
	var best: Node3D = null
	var best_d := limit
	for n: Node3D in _living_targets():
		var d := _flat(n.global_position - fighter.global_position).length()
		if d <= best_d:
			best = n
			best_d = d
	return best


## The conditional buttons as they stand: [{ability, name, left, window}] per button (empty when it holds nothing),
## and how many wait.
func conditionals() -> Dictionary:
	var slots := []
	for i in legacy.slots:
		var o := legacy.in_slot(i)
		if o.is_empty():
			slots.append({})
		else:
			var a := AttackData.get_attack(String(o["ability"]))
			slots.append({"ability": o["ability"], "name": a.name if a else String(o["ability"]),
				"left": float(o["left"]), "window": float(o["window"])})
	return {"slots": slots, "waiting": legacy.waiting().size(), "queued": String(_queued.get("ability", ""))}


## For the QA bridge.
func state() -> Dictionary:
	var cd := {}
	for k in melee.cooldowns:
		cd[k] = snappedf(float(melee.cooldowns[k]), 0.01)
	var conds := []
	for i in legacy.slots:
		conds.append(String(legacy.in_slot(i).get("ability", "")))
	return {
		"phase": MeleeState.Phase.keys()[melee.phase],
		"action": melee.action.id if melee.action else "",
		"step": melee.step_index + 1,
		"next": melee.next_step + 1,
		"hitstop": snappedf(melee.hitstop, 0.001),
		"cooldowns": cd,
		"strikes": stats["strikes"], "hits": stats["hits"], "misses": stats["misses"], "damage": stats["damage"],
		"chains": stats["chains"],
		"log": strike_log.duplicate(true),
		"shot": {} if shot == null else {"state": shot.state, "travelled": snappedf(shot.travelled, 0.01),
			"target": String(shot.target.name) if shot.target and is_instance_valid(shot.target) else ""},
		"conds": conds,
		"waiting": legacy.waiting().size(),
		"queued": String(_queued.get("ability", "")),
		"pull": last_pull.duplicate(),
		"body": fighter.state,
		"y": snappedf(fighter.global_position.y, 0.01),
		"hp": hp,
		"evasions": evasions,
		"avoided": avoided,
		"blows": blows,
		"evading": evading(),
		"dash": snappedf(_dash_moved, 0.01),
	}


static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)


static func _smooth(k: float) -> float:
	return k * k * (3.0 - 2.0 * k)


static func _ease_out(k: float) -> float:
	return 1.0 - (1.0 - k) * (1.0 - k)


static func _ease3(k: float) -> float:
	return 1.0 - pow(1.0 - k, 3.0)
