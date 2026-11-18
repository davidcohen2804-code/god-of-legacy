class_name AttackData
extends RefCounted
## One attack's definition, read from res://data/abilities/samurai.json (GPT's numbers): frame data, damage, hit-stop,
## what it does to the target, the move that shows it — and the blade's path through its active window, baked from
## that move (samurai_blades.json, by tools/bake_blades.mjs). The hit test sweeps that path (SwordSweep), so the hit
## follows the visible swing (GPT's M3 review), and the combat logic never reads the animation player.

const DATA := "res://data/abilities/samurai.json"
const BLADES := "res://data/abilities/samurai_blades.json"

var id := ""
var name := ""
var button := "" ## the input that starts it ("attack", "heavy"…)
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
## The move, where to start it and how fast to play it so its swing fills the active window.
var anim := ""
var anim_from := 0.0
var anim_speed := 1.0
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
	a.button = String(d.get("button", ""))
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
		else:
			push_error("AttackData: no baked blade for %s (run tools/bake_blades.mjs)" % k)
		out[String(k)] = a
	out["_chains"] = data.get("chains", {})
	_sets[path] = out
	return out


static func get_attack(p_id: String) -> AttackData:
	return load_set().get(p_id) as AttackData


## The action a button starts, other than the Attack chain (Heavy…); null when none is defined.
static func for_button(button: String) -> AttackData:
	var all := load_set()
	for k in all:
		if all[k] is AttackData and (all[k] as AttackData).button == button and button != "attack":
			return all[k]
	return null


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
