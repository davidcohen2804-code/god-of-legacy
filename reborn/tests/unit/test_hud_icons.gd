extends RefCounted
## M4.2-A2 (GPT's v2.3): the icons' controls on both phones — every hit area at least 44 CSS px across and none on
## another, each word at least 10 CSS px and clear of every other button's hit area, the two conditional capsules with
## the longest words beside the chip without touching STEP, CHAIN, RISE or each other, each capsule's hit area round
## all of it; the seven icons rasterized from their SVGs.

func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## (between a button's centre line and a rectangle)
static func _to_rect(b: Dictionary, r: Rect2) -> float:
	var c: Vector2 = b["c"]
	var h := float(b.get("half", 0.0))
	var dx := maxf(0.0, maxf(r.position.x - (c.x + h), (c.x - h) - r.end.x))
	var dy := maxf(0.0, maxf(r.position.y - c.y, c.y - r.end.y))
	return Vector2(dx, dy).length()


func test_the_icons_controls_fit_both_phones() -> String:
	var was := TouchControls.style
	TouchControls.style = "icons"
	var err := ""
	for phone: Array in [["iPhone", Vector2(1588, 720), 340.0 / 720.0], ["Android", Vector2(1726, 720), 360.0 / 720.0]]:
		var tc := TouchControls.new()
		tc.input = PlayerInput.new()
		tc.css_override = float(phone[2])
		_tree().root.add_child(tc)
		tc.size = phone[1]
		tc._layout()
		tc.set_conditional("cond1", "COUNTER", true, 0.8)
		tc.set_conditional("cond2", "EXECUTE", true, 0.4)
		tc.set_waiting(1)
		var css := tc.css_per_px
		var keys: Array = []
		for k: String in tc._btn:
			if k != "stick" and tc.is_shown(k):
				keys.append(k)
		for k: String in keys:
			var b: Dictionary = tc._btn[k]
			if float(b["r_hit"]) * 2.0 * css < 43.9:
				err = "%s: %s's hit area %.1f CSS px across" % [phone[0], k, float(b["r_hit"]) * 2.0 * css]
			if k.begins_with("cond") and float(b["r_hit"]) < float(b["r_art"]):
				err = "%s: %s's hit area is smaller than the capsule drawn" % [phone[0], k]
			for o: String in keys:
				if o != k and TouchControls._gap(b, tc._btn[o]) < float(b["r_hit"]) + float(tc._btn[o]["r_hit"]) - 0.01:
					err = "%s: %s's and %s's hit areas overlap" % [phone[0], k, o]
			var lr := tc.label_rect(k)
			if lr.size != Vector2.ZERO:
				for o: String in keys:
					if o != k and _to_rect(tc._btn[o], lr) < float(tc._btn[o]["r_hit"]):
						err = "%s: %s's word lies on %s's hit area" % [phone[0], k, o]
				if lr.end.y > tc.size.y or lr.position.x < 0.0 or lr.end.x > tc.size.x:
					err = "%s: %s's word leaves the screen" % [phone[0], k]
		if tc.label_px * css < 9.99:
			err = "%s: the words are %.1f CSS px" % [phone[0], tc.label_px * css]
		for k: String in ["cond1", "cond2", "more"]:
			var b: Dictionary = tc._btn[k]
			var c: Vector2 = b["c"]
			if c.y - float(b["r_art"]) < TouchControls.TOP_BAR:
				err = "%s: %s reaches into the top band" % [phone[0], k]
			if c.x + float(b["half"]) + float(b["r_art"]) > tc.size.x:
				err = "%s: %s leaves the screen" % [phone[0], k]
		var icons := int(tc.layout_info()["icons"])
		tc.input.free()
		tc.free()
		if icons != 7 and err == "":
			err = "%s: %d icons rasterized (want 7)" % [phone[0], icons]
		if err != "":
			break
	TouchControls.style = was
	return err


func test_a_capsule_takes_a_touch_anywhere_on_it() -> String:
	var was := TouchControls.style
	TouchControls.style = "icons"
	var tc := TouchControls.new()
	tc.input = PlayerInput.new()
	tc.css_override = 340.0 / 720.0
	_tree().root.add_child(tc)
	tc.size = Vector2(1588, 720)
	tc._layout()
	tc.set_conditional("cond1", "COUNTER", true, 0.8)
	var b: Dictionary = tc._btn["cond1"]
	var c: Vector2 = b["c"]
	var tip := c + Vector2(-float(b["half"]) - float(b["r_art"]) + 2.0, 0.0) # (its far round end)
	tc._down(3, tip)
	var took := tc.input.consume("cond1")
	tc._up(3)
	var inner := c + Vector2(float(b["half"]) + float(b["r_art"]) - 2.0, 0.0) # (its near end, beside the chip)
	tc._down(4, inner)
	var took2 := tc.input.consume("cond1")
	tc._up(4)
	tc.input.free()
	tc.free()
	TouchControls.style = was
	return "" if took and took2 else "a touch on the capsule's ends: far %s, near %s (want both taken)" % [took, took2]
