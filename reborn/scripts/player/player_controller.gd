class_name PlayerController
extends Node
## Player controller: reads the intents (PlayerInput) and drives the player's Fighter relative to the camera; turns
## the camera with the drag. (M3 adds the attacks and skills, asked of the combat system.)

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
	if input.consume("jump"):
		fighter.jump()
	if input.consume("dodge"):
		fighter.dodge(dir)


func _process(delta: float) -> void:
	if rig:
		rig.sensitivity = Game.camera_sensitivity
		rig.turn(input.take_camera_drag(delta))
