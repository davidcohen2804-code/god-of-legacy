class_name Fighter
extends CharacterBody3D
## A combatant's body: its collision capsule, gravity and facing (M2.2 adds walking, sprinting, jumping and dodging).
## What drives it (the player controller, later an enemy brain) only sets intents; its visual only shows what it does.

var visual: CharacterVisual
var facing := 0.0 ## yaw in radians; the model faces +Z at 0
var gravity := 24.0
var combat_ready := false


func setup(v: CharacterVisual, radius: float = 0.34, height: float = 1.7) -> void:
	visual = v
	add_child(v)
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = radius
	cap.height = height
	shape.shape = cap
	shape.position = Vector3(0, height * 0.5, 0)
	add_child(shape)
	collision_layer = 2
	collision_mask = 1 | 2
	floor_snap_length = 0.35
	floor_max_angle = deg_to_rad(50.0)


func _ready() -> void:
	visual.rotation.y = facing
	visual.play("Sword_Idle" if combat_ready else "Idle_Loop", 0.0)


func forward() -> Vector3:
	return Vector3(sin(facing), 0.0, cos(facing))


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	velocity.x = 0.0
	velocity.z = 0.0
	move_and_slide()
	visual.rotation.y = facing
