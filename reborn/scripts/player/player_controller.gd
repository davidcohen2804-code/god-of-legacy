class_name PlayerController
extends Node
## Player controller: reads the intents (PlayerInput) and drives the player's Fighter relative to the camera — the
## stick moves it along the camera's ground plane, jump and dodge are taken from the buffer — and turns the camera
## with the drag. Attacks and skills are asked of the combat system from M3; until then their presses are dropped.

var fighter: Fighter
var input: PlayerInput
var rig: CameraRig


func _physics_process(_delta: float) -> void:
	if fighter == null:
		return
	var mv := input.move_vector()
	var dir := rig.ground_basis() * Vector3(mv.x, 0.0, -mv.y)
	fighter.move_intent = dir
	fighter.sprinting = input.wants_sprint() and mv.length() > 0.6
	if input.peek("jump") and fighter.jump():
		input.consume("jump")
	if input.peek("dodge") and fighter.dodge(dir):
		input.consume("dodge")
	for a in ["attack", "heavy", "skill1", "skill2", "skill3", "cond1", "cond2"]:
		input.consume(a)


func _process(delta: float) -> void:
	if rig:
		rig.sensitivity = Game.camera_sensitivity
		rig.turn(input.take_camera_drag(delta))
