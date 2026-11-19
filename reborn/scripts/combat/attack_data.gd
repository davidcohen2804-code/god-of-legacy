class_name AttackData
extends RefCounted
## One action's definition, read from res://data/abilities/samurai.json (GPT's numbers): frame data, damage, hit-stop,
## what it does to the target, the move that shows it — and, for a sword action, the blade's path through its active
## window, baked from that move (samurai_blades.json, by tools/bake_blades.mjs). The hit test sweeps that path
## (SwordSweep), so the hit follows the visible swing (GPT's M3 review), and the combat logic never reads the
## animation player. Other kinds: "projectile" (the Phantom Chain: thrown at its release event, its flight and
## capture in `projectile` / `capture`), "pull" (Chain Pull: its drag in `pull`), "step" (Shadow Step: a burst of
## movement with a defensive window, in `step`) and "seal" (Explosive Seal: a mark planted at its seal event, in
## `seal`). The Training Automaton's attacks are read the same way from their own
## file (automaton.json, its blades baked from its own model).

const DATA := "res://data/abilities/samurai.json"
const BLADES := "res://data/abilities/samurai_blades.json"
const AUTOMATON := "res://data/abilities/automaton.json"
const AUTOMATON_BLADES := "res://data/abilities/automaton_blades.json"

var id := ""
var name := ""
var label := "" ## the short word on its button
var button := "" ## the input that starts it ("attack", "heavy", "skill1"…; "cond": a Legacy Chain opportunity)
## melee (a blade) | projectile | pull | step | seal
var kind := "melee"
var startup := 0.1
var active := 0.08
var recovery := 0.17
var damage := 10
var cooldown := 0.0
var hit_stop := 0.035
## The target's reaction: how long it reels, and how far it is pushed (m).
var reaction := 0.08
var knockback := 0.0
## Ground covered forward during startup and active (a short step into the cut), m.
var lunge := 0.25
## Range validation: when above 0, the action starts only with a living target within this distance (m).
var needs_target_within := 0.0
## Moments of the action the controller acts on (a projectile's release…): [{at: s from its start, name}].
var events: Array = []
## Aim assist through startup: the nearest target within this range and the assist's cone (m; 0: the melee assist's).
var aim_range := 0.0
## A projectile's flight: {speed m/s, radius m, range m, height m (above his feet), ahead m (in front of him)}.
var projectile := {}
## How long a hit captures a target that can be captured (s).
var capture := 0.0
## A pull: {ahead: the endpoint, m in front of him; speed: m/s over the target's travel; min, max: s}.
var pull := {}
## A confirmed hit throws a launchable target up: {height m, airtime s} (Rising Slash).
var launch := {}
## A leap at an airborne target (Aerial Pursuit): he ends `leap.ahead` m short of where the target will be at the
## strike, `leap.below` m under its height; it starts only within `within` m (flat). A conditional ability's `within`
## is the farthest its target may stand when it starts (Phantom Execution: 3 m) — beyond, the press is refused.
var air := false
var leap := {}
var within := 0.0
## Its confirmed blow on an airborne target drives it down: {start, accel, top} (m/s, m/s², m/s).
var spike := {}
## Where the assist puts the target relative to his facing (degrees, + = his left): the middle of a cut that runs to
## one side.
var aim_yaw := 0.0
## A step (Shadow Step): {distance m, defense: [from, to] s from the start of the movement — its defensive window}.
var step := {}
## A mark planted at the seal event (Explosive Seal): {range: m (centre to centre), fuse: s from planting to its
## detonation — which deals this action's damage, reaction and knockback}.
var seal := {}
## A dash at the opportunity's target through startup (Shadow Counter, Phantom Execution): {max m, stop: m short of its centre, pace: m/s —
## its startup lasts at least the dash's length over this (GPT's v1.5: max(0.15, d / 18) s)}.
var dash := {}
## The automaton's telegraph: {to: the move's time it raises the weapon to, time: s it takes, lock: s into startup its
## direction locks, turn: rad/s until then}; and its follow-through through recovery: {to: the move's time}.
var windup := {}
var follow := {}
## The move, where to start it and how fast to play it so its swing fills the active window — or, with `active_at`
## (≥ 0), the move's time where the active window begins (a startup of its own before it: the automaton's telegraph).
var anim := ""
var anim_from := 0.0
var anim_speed := 1.0
var active_at := -1.0
## How long the move blends in from what he was doing (s).
var blend := 0.05
## The camera's jolt when it lands (0..1; 0: by its push — 0.6 for a blow that pushes, else 0.22).
var shake := 0.0
## How long his stance blends back in after it (s; 0: the stance's own) — a finisher's ending pose eases out.
var exit_blend := 0.0
## Its own sounds by name (assets/audio/<name>.wav): {active, hit}; empty: the sword's.
var sounds := {}
## The blade through the active window: a point near the guard and the tip, in the attacker's frame (+Z forward,
## +X his left, +Y up, origin between his feet), evenly spaced in time from the window's start to its end.
var blade_base := PackedVector3Array()
var blade_tip := PackedVector3Array()
## Summaries of that path: the tip's yaw at the window's start and end (degrees, + = his left — the cut runs toward
## the sign of arc_to - arc_from), its farthest reach, and the lowest and highest points of the blade.
var arc_from := 0.0
var arc_to := 0.0
var reach := 0.0
var height := Vector2.ZERO

static var _sets := {}


func total() -> float:
	return startup + active + recovery


## The move's time at fraction `f` (0..1) of the active window, as the game plays it (and as its blade was baked).
func move_time(f: float) -> float:
	if active_at >= 0.0:
		return active_at + f * active * anim_speed
	return anim_from + (startup + f * active) * anim_speed


## How fast its move plays through startup: from where it starts to where its active window begins (`active_at`) in the
## startup's time — its own speed unless the startup was stretched (with_startup).
func startup_speed() -> float:
	if active_at < 0.0 or startup <= 0.0:
		return anim_speed
	return (active_at - anim_from) / startup


## A copy of this action whose startup lasts `seconds`: its move plays the same stretch through it — slower or faster —
## and meets its active window where its blade was baked (Shadow Counter's longer dash, GPT's v1.5).
func with_startup(seconds: float) -> AttackData:
	var c := copy()
	if active_at < 0.0:
		c.active_at = anim_from + startup * anim_speed
	c.startup = seconds
	return c


## A shallow copy (its data and its baked blade).
func copy() -> AttackData:
	var c := AttackData.new()
	for p in get_property_list():
		if int(p["usage"]) & PROPERTY_USAGE_SCRIPT_VARIABLE:
			c.set(String(p["name"]), get(String(p["name"])))
	return c


## The start of Shadow Step's defensive window and its end, in seconds from the action's start (zero when none).
func defense_window() -> Vector2:
	var d: Array = step.get("defense", []) as Array
	if d.size() < 2:
		return Vector2.ZERO
	return Vector2(startup + float(d[0]), startup + float(d[1]))


## The blade at fraction `f` (0..1) of the active window: [base, tip] in the attacker's frame.
func blade_at(f: float) -> Array:
	var n := blade_tip.size()
	if n == 0:
		return [Vector3.ZERO, Vector3.ZERO]
	if n == 1:
		return [blade_base[0], blade_tip[0]]
	var x := clampf(f, 0.0, 1.0) * (n - 1)
	var i := mini(int(x), n - 2)
	var k := x - i
	return [blade_base[i].lerp(blade_base[i + 1], k), blade_tip[i].lerp(blade_tip[i + 1], k)]


func set_blade(base: PackedVector3Array, tip: PackedVector3Array) -> void:
	blade_base = base
	blade_tip = tip
	if tip.is_empty():
		return
	arc_from = rad_to_deg(atan2(tip[0].x, tip[0].z))
	arc_to = rad_to_deg(atan2(tip[tip.size() - 1].x, tip[tip.size() - 1].z))
	reach = 0.0
	height = Vector2(INF, -INF)
	for i in tip.size():
		reach = maxf(reach, Vector2(tip[i].x, tip[i].z).length())
		height = Vector2(minf(height.x, minf(tip[i].y, base[i].y)), maxf(height.y, maxf(tip[i].y, base[i].y)))


static func from_dict(p_id: String, d: Dictionary) -> AttackData:
	var a := AttackData.new()
	a.id = p_id
	a.name = String(d.get("name", p_id))
	a.label = String(d.get("label", a.name.to_upper()))
	a.button = String(d.get("button", ""))
	a.kind = String(d.get("kind", "melee"))
	a.aim_range = float(d.get("aim_range", 0.0))
	a.projectile = d.get("projectile", {}) as Dictionary
	a.capture = float(d.get("capture", 0.0))
	a.pull = d.get("pull", {}) as Dictionary
	a.launch = d.get("launch", {}) as Dictionary
	a.air = bool(d.get("air", false))
	a.leap = d.get("leap", {}) as Dictionary
	a.within = float(d.get("within", 0.0))
	a.spike = d.get("spike", {}) as Dictionary
	a.aim_yaw = float(d.get("aim_yaw", 0.0))
	a.step = d.get("step", {}) as Dictionary
	a.dash = d.get("dash", {}) as Dictionary
	a.seal = d.get("seal", {}) as Dictionary
	a.blend = float(d.get("blend", 0.05))
	a.shake = float(d.get("shake", 0.0))
	a.exit_blend = float(d.get("exit_blend", 0.0))
	a.sounds = d.get("sounds", {}) as Dictionary
	a.windup = d.get("windup", {}) as Dictionary
	a.follow = d.get("follow", {}) as Dictionary
	a.active_at = float(d.get("active_at", -1.0))
	a.startup = float(d.get("startup", a.startup))
	a.active = float(d.get("active", a.active))
	a.recovery = float(d.get("recovery", a.recovery))
	a.damage = int(d.get("damage", a.damage))
	a.cooldown = float(d.get("cooldown", 0.0))
	a.hit_stop = float(d.get("hit_stop", a.hit_stop))
	a.reaction = float(d.get("reaction", a.reaction))
	a.knockback = float(d.get("knockback", 0.0))
	a.lunge = float(d.get("lunge", 0.0))
	a.needs_target_within = float(d.get("needs_target_within", 0.0))
	a.events = d.get("events", []) as Array
	a.anim = String(d.get("anim", ""))
	a.anim_from = float(d.get("anim_from", 0.0))
	a.anim_speed = float(d.get("anim_speed", 1.0))
	return a


## Every attack of a data file, by id, with its baked blade (read once).
static func load_set(path: String = DATA, blades: String = BLADES) -> Dictionary:
	if _sets.has(path):
		return _sets[path]
	var out := {}
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	var baked: Variant = JSON.parse_string(FileAccess.get_file_as_string(blades))
	if typeof(data) != TYPE_DICTIONARY:
		push_error("AttackData: cannot read " + path)
		return out
	var paths: Dictionary = baked.get("attacks", {}) if typeof(baked) == TYPE_DICTIONARY else {}
	var attacks: Dictionary = data.get("attacks", {})
	for k in attacks:
		var a := from_dict(String(k), attacks[k])
		if paths.has(k):
			a.set_blade(_points(paths[k].get("base", [])), _points(paths[k].get("tip", [])))
		elif a.kind == "melee":
			push_error("AttackData: no baked blade for %s (run tools/bake_blades.mjs)" % k)
		out[String(k)] = a
	out["_chains"] = data.get("chains", {})
	out["_sequence"] = data.get("sequence", {})
	out["_graph"] = data.get("graph", [])
	_sets[path] = out
	return out


static func get_attack(p_id: String) -> AttackData:
	return load_set().get(p_id) as AttackData


## One of the Training Automaton's attacks.
static func automaton_attack(p_id: String) -> AttackData:
	return load_set(AUTOMATON, AUTOMATON_BLADES).get(p_id) as AttackData


## The action a button starts, other than the Attack chain (Heavy…); null when none is defined.
static func for_button(button: String) -> AttackData:
	var all := load_set()
	for k in all:
		if all[k] is AttackData and (all[k] as AttackData).button == button and button != "attack" and button != "cond":
			return all[k]
	return null


## The Legacy Chain's graph (its edges) from the data.
static func graph() -> Array:
	return load_set().get("_graph", []) as Array


## The Samurai's three basic strikes, in chain order.
static func samurai_basics() -> Array[AttackData]:
	var all := load_set()
	var out: Array[AttackData] = []
	for k in (all["_chains"] as Dictionary).get("attack", ["basic1", "basic2", "basic3"]):
		out.append(all[String(k)])
	return out


static func _points(a: Array) -> PackedVector3Array:
	var out := PackedVector3Array()
	for p in a:
		out.append(Vector3(float(p[0]), float(p[1]), float(p[2])))
	return out


## (tests) A made-up attack whose blade is a straight blade from 0.35 m to `p_reach` from his centre, held level at
## height `y`, turning about him from yaw arc.x to arc.y (degrees, + = his left) evenly through the window.
static func make(p_id: String, s: float, a: float, r: float, dmg: int, stop: float, react: float, push: float,
		p_anim: String, from: float, speed: float, arc: Vector2, p_reach: float, p_lunge: float, y: float = 1.0) -> AttackData:
	var d := AttackData.new()
	d.id = p_id
	d.startup = s
	d.active = a
	d.recovery = r
	d.damage = dmg
	d.hit_stop = stop
	d.reaction = react
	d.knockback = push
	d.anim = p_anim
	d.anim_from = from
	d.anim_speed = speed
	d.lunge = p_lunge
	var base := PackedVector3Array()
	var tip := PackedVector3Array()
	for i in 13:
		var yaw := deg_to_rad(lerpf(arc.x, arc.y, i / 12.0))
		var dir := Vector3(sin(yaw), 0.0, cos(yaw))
		base.append(dir * 0.35 + Vector3(0, y, 0))
		tip.append(dir * p_reach + Vector3(0, y, 0))
	d.set_blade(base, tip)
	return d
