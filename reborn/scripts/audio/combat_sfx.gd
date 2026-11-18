class_name CombatSfx
extends Node
## The sword's sounds (GPT's M3 review): a swing as each action's active window opens and an impact on each confirmed
## hit — three distinct ones for the chain, the third heavier; Heavy takes the heaviest, pitched down. Synthesized
## placeholders (tools/make_sfx.py). It only listens to the combat controller; it never decides anything.
## Non-positional (the camera is always close to the fight); the Settings sound level applies (the master bus).

const DIR := "res://assets/audio/"
const VOICES := 6

var _swing: Array[AudioStream] = []
var _impact: Array[AudioStream] = []
var _players: Array[AudioStreamPlayer] = []
var _next := 0


func _ready() -> void:
	for i in 3:
		_swing.append(load(DIR + "swing_%d.wav" % (i + 1)) as AudioStream)
		_impact.append(load(DIR + "impact_%d.wav" % (i + 1)) as AudioStream)
	for i in VOICES:
		var p := AudioStreamPlayer.new()
		p.name = "Voice%d" % i
		add_child(p)
		_players.append(p)


func bind(c: CombatController) -> void:
	c.strike_active.connect(_on_active)
	c.strike_hit.connect(_on_hit)


func _on_active(a: AttackData, step: int) -> void:
	_play(_swing[_voice(a, step)], -5.0, _pitch(step))


func _on_hit(a: AttackData, step: int, _target: Node3D, _dir: Vector3) -> void:
	_play(_impact[_voice(a, step)], -1.0, _pitch(step))


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
