class_name UiTheme
extends RefCounted
## The interface's look in one place: fonts, colours, panels and buttons. Every box keeps comfortable padding
## between its text and its border.

## GPT's REBORN palette (direction v1.1): midnight violet and deep plum grounds, antique gold and spirit violet
## accents (no dominant cyan), crimson for danger, warm ivory text.
const MIDNIGHT := Color("#111020")
const PLUM := Color("#211B35")
const GOLD := Color("#D9B778")
const GOLD_DIM := Color("#8C7448")
const INK := Color("#111020")
const PANEL := Color(0.129, 0.106, 0.208, 0.92)
const TEXT := Color("#F2E9DD")
const TEXT_DIM := Color("#B9AEA3")
const ACCENT := Color("#9674E7")
const CRIMSON := Color("#A93553")

static var _theme: Theme
static var _fonts := {}


static func font(file: String) -> Font:
	if not _fonts.has(file):
		_fonts[file] = load("res://assets/fonts/%s.woff2" % file)
	return _fonts[file]


## Cinzel, for the logo and titles; `spacing` widens the letters.
static func display_font(spacing: int = 0) -> Font:
	var fv := FontVariation.new()
	fv.base_font = font("cinzel-latin-700-normal")
	fv.spacing_glyph = spacing
	return fv


static func box(bg: Color = PANEL, border: Color = GOLD_DIM, radius: int = 18, border_w: int = 2,
		pad_x: float = 28.0, pad_y: float = 22.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(border_w)
	sb.set_corner_radius_all(radius)
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_y
	sb.content_margin_bottom = pad_y
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 8
	sb.anti_aliasing = true
	return sb


static func build() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font = font("inter-latin-500-normal")
	t.default_font_size = 26

	var bold := font("inter-latin-700-normal")
	t.set_stylebox("normal", "Button", box(Color(0.082, 0.07, 0.14, 0.94), GOLD_DIM, 10, 2, 40.0, 16.0))
	t.set_stylebox("hover", "Button", box(Color(0.13, 0.105, 0.2, 0.96), GOLD, 10, 2, 40.0, 16.0))
	t.set_stylebox("pressed", "Button", box(GOLD, GOLD, 10, 2, 40.0, 16.0))
	t.set_stylebox("focus", "Button", box(Color(0, 0, 0, 0), GOLD, 12, 3, 40.0, 16.0))
	t.set_stylebox("disabled", "Button", box(Color(0.07, 0.06, 0.1, 0.8), Color(1, 1, 1, 0.12), 10, 2, 40.0, 16.0))
	t.set_font("font", "Button", bold)
	t.set_font_size("font_size", "Button", 28)
	t.set_color("font_color", "Button", TEXT)
	t.set_color("font_hover_color", "Button", GOLD)
	t.set_color("font_pressed_color", "Button", INK)
	t.set_color("font_hover_pressed_color", "Button", INK)
	t.set_color("font_focus_color", "Button", TEXT)
	t.set_color("font_disabled_color", "Button", Color(1, 1, 1, 0.32))

	t.set_color("font_color", "Label", TEXT)
	t.set_stylebox("panel", "PanelContainer", box())

	t.set_stylebox("normal", "OptionButton", box(Color(0.082, 0.07, 0.14, 0.94), GOLD_DIM, 10, 2, 22.0, 12.0))
	t.set_stylebox("hover", "OptionButton", box(Color(0.13, 0.105, 0.2, 0.96), GOLD, 10, 2, 22.0, 12.0))
	t.set_stylebox("pressed", "OptionButton", box(Color(0.13, 0.105, 0.2, 0.96), GOLD, 10, 2, 22.0, 12.0))
	t.set_stylebox("focus", "OptionButton", box(Color(0, 0, 0, 0), GOLD, 10, 2, 22.0, 12.0))
	t.set_font("font", "OptionButton", bold)
	t.set_font_size("font_size", "OptionButton", 24)
	t.set_stylebox("panel", "PopupMenu", box(Color(0.1, 0.085, 0.16, 0.98), GOLD_DIM, 10, 2, 16.0, 12.0))
	t.set_font_size("font_size", "PopupMenu", 26)
	t.set_constant("v_separation", "PopupMenu", 18)

	t.set_font("font", "CheckButton", bold)
	t.set_font_size("font_size", "CheckButton", 24)
	t.set_stylebox("normal", "CheckButton", StyleBoxEmpty.new())
	t.set_stylebox("hover", "CheckButton", StyleBoxEmpty.new())
	t.set_stylebox("pressed", "CheckButton", StyleBoxEmpty.new())
	t.set_stylebox("focus", "CheckButton", StyleBoxEmpty.new())

	var track := box(Color(1, 1, 1, 0.12), Color(0, 0, 0, 0), 6, 0, 0.0, 5.0)
	var fill := box(GOLD, Color(0, 0, 0, 0), 6, 0, 0.0, 5.0)
	t.set_stylebox("slider", "HSlider", track)
	t.set_stylebox("grabber_area", "HSlider", fill)
	t.set_stylebox("grabber_area_highlight", "HSlider", fill)
	_theme = t
	return t


static func label(text: String, size: int = 26, color: Color = TEXT, bold: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if bold:
		l.add_theme_font_override("font", font("inter-latin-700-normal"))
	return l


static func title(text: String, size: int = 54, spacing: int = 3) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_override("font", display_font(spacing))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", GOLD)
	l.add_theme_color_override("font_outline_color", Color(0.07, 0.05, 0.1, 0.95))
	l.add_theme_constant_override("outline_size", maxi(4, size / 9))
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.55))
	l.add_theme_constant_override("shadow_offset_x", 0)
	l.add_theme_constant_override("shadow_offset_y", maxi(2, size / 14))
	return l
