# GOD OF LEGACY — Main Menu implementation spec

## Project foundation
- Stack: Phaser 3 + TypeScript + Vite.
- Development target: desktop 16:9, reference resolution 1920x1080.
- Keep rendering/UI responsive, preserving the 16:9 composition.
- Do not create gameplay, maps, player systems, combat, inventory or quests in this stage.

## Final assets
Use these exact filenames:
- MainMenu_Background_1920x1080.png
- GodOfLegacy_Logo_Transparent.png
- StartButton.png
- SettingsButton.png
- ExitButton.png

Do not redraw, regenerate, replace or reinterpret these assets.

## Layout at 1920x1080
Coordinates are center-based unless stated otherwise.

Background:
- Fill the entire 1920x1080 design area.
- Preserve aspect ratio; use cover-style scaling without distortion.

Logo:
- centerX: 960
- top: 28
- display width: 900
- preserve aspect ratio.

START GAME:
- centerX: 960
- centerY: 585
- display size: 600x150

SETTINGS:
- centerX: 960
- centerY: 735
- display size: 500x120

EXIT:
- centerX: 960
- centerY: 860
- display size: 500x120

Version:
- text: v0.1.0
- right: 28
- bottom: 22
- font: Cinzel if available, otherwise Georgia serif
- size: 24px
- color: #F3E7CF
- subtle shadow only.

## Button interaction
Use only the single supplied PNG per button.
Do NOT create separate hover/pressed image files.

Normal:
- scale 1.00
- brightness 1.00

Hover:
- animate over 120ms
- scale 1.025
- brightness about 1.12
- subtle warm outer glow
- cursor becomes pointer

Pressed:
- animate immediately
- scale 0.985
- brightness about 0.92
- move down 2px
- restore on release

Keep the hit area aligned to the visible button.

## Actions
START GAME:
- For this stage only, register the click and transition to a blank placeholder scene named CharacterSelectScene.
- The placeholder may contain only centered text: "CHARACTER SELECT — NEXT STAGE".
- Do not build character selection yet.

SETTINGS:
- Open an in-game modal panel over the current menu.
- Dim the background behind it with a 55% black overlay.
- Panel size: 760x560, centered.
- Style: dark blue/charcoal panel, thin antique-gold border, matching the button language.
- Build the panel with code; no extra image asset is required.

Settings controls:
1. Master Volume — slider, 0–100, default 80.
2. Music Volume — slider, 0–100, default 70.
3. SFX Volume — slider, 0–100, default 90.
4. Fullscreen — toggle, default Off.
5. Resolution — dropdown:
   - 1280x720
   - 1600x900
   - 1920x1080
6. BACK button — closes the modal.

Persist settings locally.

EXIT:
- Development/browser build: open a confirmation modal: "Exit God Of Legacy?"
- Buttons: EXIT / CANCEL.
- If running inside a future desktop wrapper, route the confirmed EXIT through one isolated platform adapter function.
- Do not scatter platform-specific exit logic through UI code.

## Settings modal styling
- Font: Cinzel if available, otherwise Georgia serif.
- Header: SETTINGS, 38px.
- Labels: 24px.
- Gold border/accent: #C99A45.
- Panel background: rgba(10, 18, 28, 0.96).
- Active slider/toggle accent: muted crimson/gold, not neon.
- Modal must support Escape to close.

## Architecture
Create these modules/scenes only:
- BootScene
- MainMenuScene
- CharacterSelectScene (placeholder only)
- MainMenuUI
- SettingsModal
- SettingsStore
- PlatformAdapter

Keep layout constants in one config file.
Do not hard-code the same coordinates across multiple files.

## Quality requirements
- No stretched images.
- No visible seams.
- No extra UI.
- No placeholder graphics except the single CharacterSelectScene text.
- No additional features.
- No redesign.
- Menu must look clean at 1920x1080 and scale proportionally to other 16:9 desktop resolutions.
