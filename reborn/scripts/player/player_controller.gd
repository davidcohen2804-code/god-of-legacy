class_name PlayerController
extends Node
## Player controller: reads the intents (PlayerInput) and drives the player's Fighter relative to the camera — the
## stick moves it along the camera's ground plane; jump, dodge and attack presses are taken from the buffer — and turns
## the camera with the drag. Every physics tick, before the body moves: the presses go to whoever may take them (the
## combat controller decides about attacks and when a dodge may cancel a strike), then the combat ticks, then the body
## (Fighter, later in the same tick) follows the stick or the strike. Heavy, the skills and the conditional buttons are
## not in M3: their presses are dropped.

var fighter: Fighter
var input: PlayerInput
var rig: CameraRig
var combat: CombatController


func _ready() -> void:
	process_physics_priority = -10 # after the input's buffer, before the bodies move


func _physics_process(delta: float) -> void:
	if fighter == null:
		return
	var mv := input.move_vector()
	var dir := rig.ground_basis() * Vector3(mv.x, 0.0, -mv.y)
	fighter.move_intent = dir
	fighter.sprinting = input.wants_sprint() and mv.length() > 0.6
	var busy := combat != null and combat.busy()
	# Jump only from free movement (not during a strike; the press waits in the buffer for its end).
	if input.peek("jump") and not busy and fighter.jump():
		input.consume("jump")
	# Dodge from free movement, or cancelling the later part of a strike's recovery (and the chain).
	if input.peek("dodge"):
		if combat == null:
			if fighter.dodge(dir):
				input.consume("dodge")
		elif combat.can_dodge():
			combat.on_dodge()
			if fighter.dodge(dir):
				input.consume("dodge")
	if input.peek("attack") and combat != null and combat.try_attack():
		input.consume("attack")
	for a in ["heavy", "skill1", "skill2", "skill3", "cond1", "cond2"]:
		input.consume(a)
	if combat:
		combat.tick(delta, dir)
		input.paused = combat.is_frozen()


func _process(delta: float) -> void:
	if rig:
		rig.sensitivity = Game.camera_sensitivity
		rig.turn(input.take_camera_drag(delta))
