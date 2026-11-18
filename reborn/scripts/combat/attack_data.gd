class_name AttackData
extends RefCounted
## One attack's definition: its frame data (GPT's M3 numbers, seconds), damage, hit-stop, what it does to the target,
## the move that shows it, and its sweep — the arc the katana's tip travels through during the active window,
## measured from the move itself (tools: the blade's tip speed peaks; yaw relative to the attacker's facing, + = his
## left), so the gameplay hit and the drawn blade pass the same place at the same time.

var id := ""
var startup := 0.1
var active := 0.08
var recovery := 0.17
var damage := 10
var hit_stop := 0.035
## The target's reaction: how long it reels, and how far it is pushed (m).
var reaction := 0.08
var knockback := 0.0
## The move, where to start it and how fast to play it so its swing fills the active window.
var anim := ""
var anim_from := 0.0
var anim_speed := 1.0
## The sweep: blade yaw from `arc_from` to `arc_to` (degrees) over the active window; reach of the tip from the
## attacker's centre (m) and the band of heights it cuts (m).
var arc_from := -70.0
var arc_to := 15.0
var reach := 1.5
var height := Vector2(0.2, 1.9)
## Ground covered forward during startup and active (a short step into the cut), m.
var lunge := 0.25


func total() -> float:
	return startup + active + recovery


static func make(p_id: String, s: float, a: float, r: float, dmg: int, stop: float, react: float, push: float,
		p_anim: String, from: float, speed: float, arc: Vector2, p_reach: float, p_lunge: float) -> AttackData:
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
	d.arc_from = arc.x
	d.arc_to = arc.y
	d.reach = p_reach
	d.lunge = p_lunge
	return d


## The Samurai's three basic strikes. Their moves' swings (Quaternius' Sword_Regular_A/B/C): A 0.22–0.30 s, the tip
## from 72° right to 15° left; B 0.22–0.30 s, a wide sweep from 116° left to 96° right; C 0.62–0.70 s, a high cut
## from 154° right to 13° left. Each is started late enough, and played at a speed, that its swing is the active window.
static func samurai_basics() -> Array[AttackData]:
	return [
		make("basic1", 0.12, 0.075, 0.17, 10, 0.035, 0.08, 0.0, "Sword_Regular_A", 0.10, 1.0, Vector2(-72, 15), 1.45, 0.25),
		make("basic2", 0.11, 0.085, 0.17, 12, 0.045, 0.11, 0.0, "Sword_Regular_B", 0.117, 0.94, Vector2(116, -96), 1.6, 0.2),
		make("basic3", 0.16, 0.10, 0.22, 18, 0.065, 0.20, 0.5, "Sword_Regular_C", 0.492, 0.8, Vector2(-154, 13), 1.6, 0.35),
	]
