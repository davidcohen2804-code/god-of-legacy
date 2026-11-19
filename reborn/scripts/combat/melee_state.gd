class_name MeleeState
extends RefCounted
## The combat state machine for one fighter: pure logic on the fixed physics tick, no nodes, no animation — the
## controller feeds it presses, ticks and confirmed hits, and reads its phases and events; the tests drive it directly.
## Every action is data (AttackData): the three-strike chain on Attack (M3) and the other actions — Heavy (M4) and,
## later, the skills — all run through the same phases and rules here; nothing bypasses it.
##
##   FREE ──press──▶ STARTUP ──▶ ACTIVE ──▶ RECOVERY ──▶ FREE
##                                  │ confirmed hit: hit-stop (timers frozen), the chain may go on
## Each tick: step(dt), then the controller sweeps the blade over `swept` and reports hits (hit_confirmed).
##   HITSTUN (taking a hit) interrupts everything; a dodge may cancel the later half of RECOVERY.
##
## The chain (Attack): only a confirmed hit opens the next strike. A press from the active window on is held as the
## next strike's request; after a hit it fires once half the recovery is past (or as soon as the chain resumes from
## FREE within CHAIN_GRACE); after a miss the chain starts again from the first strike. An interruption, a dodge,
## another action or the chain's expiry start it over.
## The primary target (GPT's v1.7 — one authority, shared with Explosive Execution's strike sequence): Basic 1 sets it —
## the target it turned toward (aim_target, told by the controller) the moment its blade strikes it; otherwise, once
## its active window has closed, the nearest target it struck (equal distances: the lower id). Basic 2 and 3 go on only
## if their blade struck the primary in their active window; other targets struck by the same sweep, before or after
## it, take their damage and change nothing. A strike that struck only others is a target switch: the chain starts
## over (the next strike is Basic 1). Decided once the window has closed and every hit of its last tick is in, so the
## order inside one sweep never matters.
## Other actions start only from FREE (a press made earlier waits in the input buffer) and only when off cooldown; an
## Attack press during one is held, and the chain's first strike follows it. An action may name moments of its own
## ("events": the controller acts on them — a projectile's release, a mark's placing…), each reported once, and its
## active window may be set while it runs (a pull lasts as long as the target takes to arrive).
## Conditional abilities (the Legacy Chain's) start from FREE too, and — only where the graph's edge allows it — by
## cutting the recovery of the action that opened them from a set fraction on (GPT's v1.2: Chain → Pull from 50 %).

enum Phase { FREE, STARTUP, ACTIVE, RECOVERY, HITSTUN }

## How much of the recovery must pass before a confirmed strike may chain into the next, or a dodge cancel it.
const CHAIN_CANCEL_FROM := 0.5
const DODGE_CANCEL_FROM := 0.5
## After a confirmed strike's recovery, how long the next strike may still follow.
const CHAIN_GRACE := 0.35

var attacks: Array[AttackData] = [] ## the chain on Attack, in order
var action: AttackData ## the running (or last) action
var phase := Phase.FREE
var step_index := -1 ## the running (or last) action's place in the chain, 0..2; -1 for any other action
var t := 0.0 ## time in the current phase
var hitstop := 0.0
var hitstun := 0.0
var confirmed := false ## the running action has hit
var chain_target := 0 ## the chain's primary target: its instance id (0: none)
## The target the running chain strike turned toward (the controller's aim assist; 0: none) — Basic 1's primary when
## its blade strikes it.
var aim_target := 0
var next_step := 0
var chain_open := 0.0
var queued := false
## Seconds left on each action's cooldown, by id.
var cooldowns := {}
## [{type: String, ...}] since the owner last drained them.
var events: Array[Dictionary] = []

## The part of the active window this tick swept, as (from, to) fractions 0..1 — (-1, -1) when it swept nothing.
## The controller tests the blade over exactly this span after each step(), so no slice is skipped.
var swept := Vector2(-1, -1)

var _hit_ids := {}
var _hit_dist := {} ## target id → how far from him it stood when this activation struck it (Basic 1's choice)
var _fired := {}
var _active_time := -1.0 ## the running action's active window when set while it runs (-1: its data's)
var _settle := false ## a chain strike's active window has closed; its outcome for the chain is still to decide
var _decided := false ## the running chain strike's outcome for the chain is decided


func _init(p_attacks: Array[AttackData] = []) -> void:
	attacks = p_attacks if not p_attacks.is_empty() else AttackData.samurai_basics()


func current() -> AttackData:
	return action


func is_attacking() -> bool:
	return phase == Phase.STARTUP or phase == Phase.ACTIVE or phase == Phase.RECOVERY


func locks_movement() -> bool:
	return is_attacking() or phase == Phase.HITSTUN


func can_dodge() -> bool:
	return phase == Phase.FREE or (phase == Phase.RECOVERY and t >= action.recovery * DODGE_CANCEL_FROM)


func cooldown_left(id: String) -> float:
	return float(cooldowns.get(id, 0.0))


## Seconds since the running action started (its startup, active window and recovery end to end).
func elapsed() -> float:
	match phase:
		Phase.STARTUP:
			return t
		Phase.ACTIVE:
			return action.startup + t
		Phase.RECOVERY:
			return action.startup + active_length() + t
	return 0.0


## The running action's active window (s): its data's, unless set while it runs.
func active_length() -> float:
	return _active_time if _active_time >= 0.0 else (action.active if action else 0.0)


## Set the running action's active window to `seconds` (from its start) — before it ends; once it is past, its
## window ends now.
func set_active(seconds: float) -> void:
	if phase == Phase.STARTUP or phase == Phase.ACTIVE:
		_active_time = maxf(seconds, t if phase == Phase.ACTIVE else 0.0)


## An Attack press. True when it was taken (a strike started, or held as the next one's request); false when it
## cannot be used now (the caller may keep it in its input buffer and offer it again).
func attack_pressed() -> bool:
	match phase:
		Phase.FREE:
			_start(next_step if chain_open > 0.0 else 0)
			return true
		Phase.ACTIVE, Phase.RECOVERY:
			queued = true
			return true
	return false


## A press for another action (Heavy, a skill): it starts from FREE when off cooldown, and breaks the chain. False
## when it cannot start now (busy, or cooling down) — the caller may keep it buffered.
func action_pressed(a: AttackData) -> bool:
	if a == null or phase != Phase.FREE or cooldown_left(a.id) > 0.0:
		return false
	_reset_chain("action")
	_start_action(a, -1)
	return true


## A conditional ability's press (the Legacy Chain resolver chose it): it starts from FREE; or, when `cancel` allows it
## ({from: an action id, at: a fraction}), by cutting that action's recovery from that fraction on. False when it
## cannot start yet (the caller keeps it queued until it can, or until the opportunity closes).
func conditional_pressed(a: AttackData, cancel: Dictionary = {}) -> bool:
	if a == null or not may_start_conditional(cancel):
		return false
	_reset_chain("action")
	_start_action(a, -1)
	return true


## Could a conditional ability with these cancel rights start now (free, or past the allowed point of the recovery
## it may cut)?
func may_start_conditional(cancel: Dictionary = {}) -> bool:
	if phase == Phase.FREE:
		return true
	if phase == Phase.RECOVERY and action and action.id == String(cancel.get("from", "")):
		return t >= action.recovery * float(cancel.get("at", 1.0))
	return false


## A dodge has started (the caller checked can_dodge): it cancels what is left of the action and the chain.
func dodge_started() -> void:
	if phase == Phase.RECOVERY or phase == Phase.FREE:
		_reset_chain("dodge")
		_set_phase(Phase.FREE)


## The fighter is hit (M5): the action and the chain are interrupted (and with them any hit-stop of his own action —
## the blow taken brings its own).
func take_hit(stun: float) -> void:
	hitstun = stun
	hitstop = 0.0
	_reset_chain("interrupted")
	_set_phase(Phase.HITSTUN)


## The sweep found `target_id` (`dist` m from him) in the span this tick swept. True when this is a new hit for this
## activation (damage it); false for a target already hit by this swing (once per target per activation) or when
## nothing was swept. What it means for the chain is decided by the primary-target rule (above).
func hit_confirmed(target_id: int, dist: float = 0.0) -> bool:
	if swept.x < 0.0 or _hit_ids.has(target_id):
		return false
	_hit_ids[target_id] = true
	_hit_dist[target_id] = dist
	confirmed = true
	hitstop = maxf(hitstop, action.hit_stop)
	events.append({"type": "hit", "step": step_index, "id": action.id, "target": target_id, "damage": action.damage})
	if step_index == 0 and not _decided and target_id == aim_target:
		_set_primary(target_id) # (Basic 1 struck the target it turned toward: the primary, at once)
	return true


## Did the running (or last) strike strike the chain's primary target?
func struck_primary() -> bool:
	return chain_target != 0 and _hit_ids.has(chain_target)


## Basic 1's primary target is `id`: the chain goes on against it.
func _set_primary(id: int) -> void:
	_decided = true
	chain_target = id
	next_step = 1 % attacks.size()
	events.append({"type": "primary", "target": id})


## A chain strike's active window has closed and every hit it swept is in (run at the next tick's start): its outcome
## for the chain — Basic 1 without its aimed target struck takes the nearest target it struck (equal distances: the lower
## id); Basic 2 or 3 goes on when it struck the primary, and is a target switch when it struck only others (the chain
## starts over); a strike that struck nothing is a miss (its end starts the chain over).
func _settle_chain() -> void:
	_settle = false
	if _decided or step_index < 0:
		return
	_decided = true
	if _hit_ids.is_empty():
		return
	if step_index == 0:
		var best := 0
		var best_d := INF
		for id: int in _hit_ids:
			var d := float(_hit_dist.get(id, 0.0))
			if d < best_d - 1e-6 or (absf(d - best_d) <= 1e-6 and id < best):
				best = id
				best_d = d
		_set_primary(best)
	elif _hit_ids.has(chain_target):
		next_step = (step_index + 1) % attacks.size()
	else:
		next_step = 0
		chain_target = 0
		events.append({"type": "chain_reset", "why": "target"})


## Has this activation already been resolved against `target_id` (a hit, or a blow evaded or avoided)?
func touched(target_id: int) -> bool:
	return _hit_ids.has(target_id)


## This activation was resolved against `target_id` without landing (evaded, avoided): it is spent on that target — it
## cannot strike it later in the same swing, and its outcome is reported once.
func spent_on(target_id: int) -> void:
	_hit_ids[target_id] = true


## One fixed tick. Afterwards `swept` holds the part of the active window covered by it.
func step(dt: float) -> void:
	swept = Vector2(-1, -1)
	if _settle:
		_settle_chain() # (the window closed last tick; the controller has reported all its hits since)
	for k in cooldowns.keys():
		cooldowns[k] = maxf(0.0, float(cooldowns[k]) - dt)
		if cooldowns[k] == 0.0:
			cooldowns.erase(k)
			events.append({"type": "ready", "id": k})
	if hitstop > 0.0:
		hitstop = maxf(0.0, hitstop - dt) # everything holds still, the blade too
		return
	if chain_open > 0.0:
		chain_open = maxf(0.0, chain_open - dt)
		if chain_open == 0.0 and phase == Phase.FREE and next_step != 0:
			_reset_chain("expired")
	match phase:
		Phase.FREE:
			return
		Phase.HITSTUN:
			hitstun -= dt
			if hitstun <= 0.0:
				_set_phase(Phase.FREE)
			return
	var a := action
	var before := t
	t += dt
	_fire_events()
	if phase == Phase.STARTUP:
		if t < a.startup:
			return
		t -= a.startup
		before = 0.0
		_set_phase(Phase.ACTIVE)
	if phase == Phase.ACTIVE:
		var act := maxf(active_length(), 0.0001)
		swept = Vector2(clampf(before / act, 0.0, 1.0), clampf(t / act, 0.0, 1.0))
		if t >= act:
			t -= act
			_settle = step_index >= 0
			_set_phase(Phase.RECOVERY)
		return
	# RECOVERY
	if queued and confirmed and step_index >= 0 and step_index < attacks.size() - 1 and t >= a.recovery * CHAIN_CANCEL_FROM:
		_start(next_step)
	elif t >= a.recovery:
		var go_on := queued
		_end_strike()
		if go_on:
			_start(next_step if chain_open > 0.0 else 0)


func _start(k: int) -> void:
	_start_action(attacks[k], k)


func _start_action(a: AttackData, k: int) -> void:
	action = a
	step_index = k
	confirmed = false
	queued = false
	aim_target = 0
	_hit_ids.clear()
	_hit_dist.clear()
	_fired.clear()
	_active_time = -1.0
	_settle = false
	_decided = false
	chain_open = 0.0
	if k <= 0:
		chain_target = 0
	t = 0.0
	if a.cooldown > 0.0:
		cooldowns[a.id] = a.cooldown
	events.append({"type": "start", "step": k, "id": a.id})
	_set_phase(Phase.STARTUP)


func _fire_events() -> void:
	var now := elapsed()
	for e in action.events:
		var n := String(e.get("name", ""))
		if not _fired.has(n) and now >= float(e.get("at", 0.0)):
			_fired[n] = true
			events.append({"type": "event", "id": action.id, "name": n})


func _end_strike() -> void:
	queued = false
	if _settle:
		_settle_chain()
	if not confirmed:
		events.append({"type": "miss", "step": step_index, "id": action.id})
	var last := attacks.size() - 1
	if step_index >= 0 and step_index < last and confirmed and next_step == step_index + 1:
		chain_open = CHAIN_GRACE # (it struck the primary: the next strike may still follow)
	else:
		if step_index == last and struck_primary():
			events.append({"type": "chain_done"})
		next_step = 0
		if not confirmed or step_index < 0:
			chain_target = 0
	_set_phase(Phase.FREE)


func _reset_chain(why: String) -> void:
	if next_step != 0 or chain_open > 0.0 or queued:
		events.append({"type": "chain_reset", "why": why})
	next_step = 0
	chain_open = 0.0
	chain_target = 0
	queued = false
	_settle = false
	_decided = true # (whatever the running strike strikes now, the chain has let go)


func _set_phase(p: Phase) -> void:
	phase = p
	events.append({"type": "phase", "phase": Phase.keys()[p], "step": step_index,
		"id": action.id if action else ""})
