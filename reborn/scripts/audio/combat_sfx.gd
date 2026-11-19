class_name CombatSfx
extends Node
## The sword's sounds (GPT's M3 review): a swing as each action's active window opens and an impact on each confirmed
## hit — three distinct ones for the chain, the third heavier; Heavy takes the heaviest, pitched down. A blow taken
## thuds low; the automaton's sweep swings low; a genuine evasion has its own glassy rush (GPT's v1.4: a distinctive
## sound). An action may name its own (data: sounds) — Phantom Execution's heavy whoosh and impact, Explosive Seal's
## detonation; a planted mark sounds as it is planted (never for a Seal that missed) and ticks with its pulses (the
## fuse the combat logic keeps). Synthesized placeholders (tools/make_sfx.py). It only listens; it never decides anything.
## Non-positional (the camera is always close to the fight); the Settings sound level applies (the master bus).

const DIR := "res://assets/audio/"
const VOICES := 6

var _swing: Array[AudioStream] = []
var _impact: Array[AudioStream] = []
var _evade: AudioStream
var _named := {} ## name → AudioStream (assets/audio/<name>.wav), loaded on first use
var _combat: CombatController
var _pulsed := {} ## mark target id → its pulses sounded
var _players: Array[AudioStreamPlayer] = []
var _next := 0


func _ready() -> void:
	for i in 3:
		_swing.append(load(DIR + "swing_%d.wav" % (i + 1)) as AudioStream)
		_impact.append(load(DIR + "impact_%d.wav" % (i + 1)) as AudioStream)
	_evade = load(DIR + "evade.wav") as AudioStream
	for i in VOICES:
		var p := AudioStreamPlayer.new()
		p.name = "Voice%d" % i
		add_child(p)
		_players.append(p)


func bind(c: CombatController) -> void:
	c.strike_active.connect(_on_active)
	c.strike_hit.connect(_on_hit)
	c.blow_taken.connect(func(_a: AttackData, _by: Node3D, _dir: Vector3) -> void: _play(_impact[2], -1.0, 0.7))
	c.attack_evaded.connect(func(_a: int, _d: int, _id: String) -> void: _play(_evade, -2.0, 1.0))
	c.seal_planted.connect(func(_t: Node3D, _f: float) -> void: _play(_sound("seal"), -3.0, 1.0))
	_combat = c


## A mark's pulses after the first (its planting sounds already): a tick each, a little higher each time.
func _process(_delta: float) -> void:
	if _combat == null:
		return
	for id in _combat.marks:
		var m: Dictionary = _combat.marks[id]
		var e := float((m["action"] as AttackData).seal.get("fuse", 0.65)) - float(m["left"])
		var n := int(_pulsed.get(id, 1))
		while n < SealVisual.PULSES.size() and e >= float(SealVisual.PULSES[n]):
			_play(_sound("seal_tick"), -7.0, 1.0 + 0.14 * n)
			n += 1
		_pulsed[id] = n
	for id in _pulsed.keys():
		if not _combat.marks.has(id):
			_pulsed.erase(id)


## An enemy's swing (the automaton's sweep: the heaviest swing, pitched down).
func bind_attacker(t: TrainingAutomaton) -> void:
	t.attack_active.connect(func() -> void: _play(_swing[2], -4.0, 0.78))


func _on_active(a: AttackData, step: int) -> void:
	if a.sounds.has("active"):
		_play(_sound(String(a.sounds["active"])), -3.0, 1.0)
		return
	_play(_swing[_voice(a, step)], -5.0, _pitch(step))


func _on_hit(a: AttackData, step: int, _target: Node3D, _dir: Vector3) -> void:
	if a.sounds.has("hit"):
		_play(_sound(String(a.sounds["hit"])), 0.0, 1.0)
		return
	_play(_impact[_voice(a, step)], -1.0, _pitch(step))


## A sound by name (null for "").
func _sound(n: String) -> AudioStream:
	if n == "":
		return null
	if not _named.has(n):
		_named[n] = load(DIR + n + ".wav") as AudioStream
	return _named[n]


## The chain's strikes have their own sounds; another action takes the heaviest when it pushes (Heavy), the lightest
## otherwise — pitched down a little, so it sounds like neither.
func _voice(a: AttackData, step: int) -> int:
	if step >= 0:
		return clampi(step, 0, 2)
	return 2 if a != null and a.knockback > 0.0 else 0


func _pitch(step: int) -> float:
	return randf_range(0.96, 1.04) * (1.0 if step >= 0 else 0.86)


func _play(s: AudioStream, db: float, pitch: float) -> void:
	if s == null:
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.stream = s
	p.volume_db = db
	p.pitch_scale = pitch
	p.play()
