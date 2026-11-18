extends RefCounted
## The character roster: five slots in order, only the Samurai playable.


func test_five_slots_in_order() -> String:
	var r := Roster.load_default()
	var ids: Array = []
	for c in r.characters:
		ids.append(c.id)
	if ids != ["samurai", "warrior", "archer", "mage", "gambler"]:
		return "slots were %s" % [ids]
	return ""


func test_only_samurai_playable() -> String:
	var r := Roster.load_default()
	for c in r.characters:
		if r.can_play(c.id) != (c.id == "samurai"):
			return "%s playable = %s" % [c.id, r.can_play(c.id)]
	if r.can_play("nobody"):
		return "an unknown id is playable"
	return ""


func test_locked_entries_have_a_name_and_weapon() -> String:
	var r := Roster.load_default()
	for c in r.characters:
		if c.name.is_empty() or c.weapon.is_empty():
			return "%s lacks a name or weapon" % c.id
	return ""
