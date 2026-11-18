extends Node3D
## Arena — placeholder until M2: a lit courtyard floor and pillars (to prove the 3D picture on the target browsers),
## the chosen character's stand-in, and the way back to the menu.

var _cam: Camera3D
var _t := 0.0
var _fps: Label


func _ready() -> void:
	_build_world()
	_build_hud()
	QA.mark("arena")


func _process(delta: float) -> void:
	_t += delta
	var a := _t * 0.12
	_cam.position = Vector3(sin(a) * 14.0, 8.5, cos(a) * 14.0)
	_cam.look_at(Vector3(0, 1.0, 0))
	if _fps.visible:
		_fps.text = "%d FPS" % Engine.get_frames_per_second()


func _build_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var mat := ProceduralSkyMaterial.new()
	mat.sky_top_color = Color("#16204a")
	mat.sky_horizon_color = Color("#6d5c7e")
	mat.ground_horizon_color = Color("#3a3142")
	mat.ground_bottom_color = Color("#0b0b12")
	sky.sky_material = mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_energy = 1.25
	sun.light_color = Color("#ffe3bd")
	sun.shadow_enabled = true
	add_child(sun)

	var stone := StandardMaterial3D.new()
	stone.albedo_color = Color("#6b655d")
	stone.roughness = 0.95
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(40, 40)
	ground.mesh = plane
	ground.material_override = stone
	add_child(ground)

	var pillar_mat := StandardMaterial3D.new()
	pillar_mat.albedo_color = Color("#8a8378")
	pillar_mat.roughness = 0.9
	for i in 8:
		var a := TAU * float(i) / 8.0
		var p := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.6
		cyl.bottom_radius = 0.72
		cyl.height = 5.0 - float(i % 3) * 1.1
		p.mesh = cyl
		p.material_override = pillar_mat
		p.position = Vector3(cos(a) * 12.0, cyl.height * 0.5, sin(a) * 12.0)
		add_child(p)

	var hero := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.38
	cap.height = 1.8
	hero.mesh = cap
	var hm := StandardMaterial3D.new()
	var c := Game.roster.find(Game.selected_character)
	hm.albedo_color = c.accent if c else Color.WHITE
	hero.material_override = hm
	hero.position = Vector3(0, 0.9, 0)
	add_child(hero)

	_cam = Camera3D.new()
	_cam.fov = 55.0
	add_child(_cam)
	_cam.position = Vector3(0, 8.5, 14.0)
	_cam.look_at(Vector3(0, 1.0, 0))
	_cam.current = true


func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var hud := Control.new()
	hud.theme = UiTheme.build()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(hud)

	var back := Button.new()
	back.text = "MENU"
	back.custom_minimum_size = Vector2(180, 72)
	back.position = Vector2(32, 28)
	back.pressed.connect(func() -> void: Game.go("main_menu"))
	hud.add_child(back)
	QA.register("arena_menu", back)

	var c := Game.roster.find(Game.selected_character)
	var note := UiTheme.label("%s · arena placeholder — movement and combat arrive in M2–M3" % (c.name if c else "?"), 22, UiTheme.TEXT_DIM)
	note.position = Vector2(236, 48)
	hud.add_child(note)

	_fps = UiTheme.label("", 22, UiTheme.GOLD, true)
	_fps.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	_fps.offset_left = -180
	_fps.offset_top = 40
	_fps.offset_right = -32
	_fps.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_fps.visible = Game.show_fps or QA.enabled
	hud.add_child(_fps)
