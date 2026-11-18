class_name TexLoader
extends RefCounted
## Loads the project's runtime textures (*.webp.bin, made by tools/make_textures.py — WebP bytes Godot does not
## import) into textures with mipmaps, once each.

static var _cache := {}


static func load_webp(path: String, mipmaps: bool = true) -> Texture2D:
	if _cache.has(path):
		return _cache[path]
	var bytes := FileAccess.get_file_as_bytes(path)
	var img := Image.new()
	if bytes.is_empty() or img.load_webp_from_buffer(bytes) != OK:
		push_error("TexLoader: cannot read %s" % path)
		img = Image.create(4, 4, false, Image.FORMAT_RGB8)
		img.fill(Color.MAGENTA)
	if mipmaps:
		img.generate_mipmaps()
	var tex := ImageTexture.create_from_image(img)
	_cache[path] = tex
	return tex


## A matte material with a tiled texture (the arena's stone and earth).
static func material(path: String, uv_scale: Vector2 = Vector2.ONE, tint: Color = Color.WHITE,
		roughness: float = 0.95, triplanar: bool = false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = load_webp(path)
	m.albedo_color = tint
	m.roughness = roughness
	m.uv1_scale = Vector3(uv_scale.x, uv_scale.y, 1.0)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	if triplanar:
		m.uv1_triplanar = true
		m.uv1_world_triplanar = true
	return m
