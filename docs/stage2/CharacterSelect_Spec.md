# GOD OF LEGACY — Stage 2: Character Select

## Scope
Implement ONLY the Character Select stage that comes after the approved Main Menu.

Do not implement:
- character creator
- gameplay/world map
- player movement
- combat
- inventory
- skills
- quests
- enemies
- animation system

The next stage will create the actual playable character.

## Existing project
Continue the existing Phaser 3 + TypeScript + Vite project from Stage 1.
Do not rebuild Stage 1 and do not redesign the Main Menu.

The START GAME action from MainMenuScene must now open CharacterSelectScene.

## Supplied Stage 2 files
Use these exact filenames:
- CharacterSelect_Background_1920x1080.png
- CharacterSlot_Frame.png
- CharacterSelect_Layout_Reference.png
- CharacterSelect_DataSchema.json

CharacterSelect_Layout_Reference.png is REFERENCE ONLY.
Do not render that file inside the game.

## Reference resolution
1920x1080, 16:9.

## Visual structure
Character Select should feel like the same world and same product as the Main Menu:
- dark fantasy
- antique gold edges
- charcoal / deep blue panels
- restrained crimson accent for primary action
- no neon
- no generic dashboard styling

Keep the center area visually open for the future character preview.

### Exact desktop layout at 1920x1080

Screen title:
- text: SELECT YOUR LEGACY
- centerX: 960
- top: 46
- font: Cinzel if already used by Stage 1; otherwise Georgia serif
- 46px
- color: warm ivory / gold

Character slots:
- 4 slots vertically on left
- x: 90
- first y: 190
- vertical step: 155
- slot display size: 430x132
- use CharacterSlot_Frame.png as the reusable frame for all four slots

Each slot:
- portrait area: left 84x84
- character name on first line
- class + level on second line
- when empty: show EMPTY
- selected state is created in code, not another image:
  - warm-gold outer glow
  - brightness +8%
  - scale 1.015 over 120ms
- hover:
  - brightness +5%
  - pointer cursor
- pressed:
  - scale 0.99

Center preview area:
- reserve roughly x=650..1320
- do not create a fake character image
- when selected character has no preview asset, show no human silhouette
- instead show a subtle circular pedestal/rune only
- actual character preview art will be provided in Stage 3

Character info:
- right panel x=1390, y=210
- size 425x500
- code-built panel
- fields:
  - Name
  - Class
  - Level
  - Last played
- no invented class names
- if slot is empty, fields show em dash

Buttons:
- BACK: x=90 y=855 size 255x64
- DELETE: x=360 y=855 size 255x64
- ENTER WORLD: x=1390 y=750 size 425x78
- CREATE CHARACTER: x=1390 y=842 size 425x70

Buttons are built in code using the same material language as Stage 1.
Do not create new image assets for buttons.

## Behavior

### Initial state
Load CharacterSelect_DataSchema.json as the default shape.
Persist user character-slot data in localStorage.
If saved data exists and validates, use saved data.

Default installation has 4 empty character slots.
No fake character should be pre-created.

### Slot selection
- Clicking a non-empty slot selects it.
- Clicking an empty slot selects the slot but keeps ENTER WORLD disabled.
- Selection updates the right-side information panel.
- Remember selected slot locally.

### CREATE CHARACTER
- Goes to CharacterCreateScene.
- In this Stage 2 implementation, CharacterCreateScene must be a deliberately minimal placeholder:
  - dark background
  - centered text: CHARACTER CREATION — STAGE 3
  - BACK button that returns to CharacterSelectScene
- Do not build character creation yet.

### ENTER WORLD
Enabled only when the selected slot contains a valid character.
For Stage 2, it opens WorldScenePlaceholder:
- centered text: WORLD — FUTURE STAGE
- BACK button returns to CharacterSelectScene.
Do not build gameplay.

### DELETE
Disabled for empty slot.
For a non-empty selected character:
- show confirmation modal
- copy: Delete <character name>?
- DELETE / CANCEL
- only confirmed DELETE clears that slot and saves immediately

### BACK
Return to MainMenuScene.
No page reload.

### Keyboard
- Escape = BACK when no modal is open
- Escape closes confirmation modal first
- Up/Down moves between slots
- Enter activates selected slot or ENTER WORLD when valid

## Data rules
CharacterSelect_DataSchema.json defines the contract.
Do not invent extra persistent fields without asking.

Validation:
- max 4 slots
- slotId 1..4
- level >= 1 for real characters
- name is non-empty for real characters
- classId must be non-empty for real characters
- malformed local data falls back safely to empty slots; do not crash

## Architecture
Add / use these boundaries:

- CharacterSelectScene
  Phaser scene, world/background presentation only.

- CharacterSelectUI
  DOM overlay for slots, text, buttons, panels and modals.

- CharacterStore
  Owns load / validate / save / delete / selected slot.

- CharacterTypes
  TypeScript interfaces corresponding to the JSON schema.

- CharacterCreateScene
  Stage-3 placeholder only.

- WorldScenePlaceholder
  Future-world placeholder only.

Keep CharacterStore independent from Phaser rendering.

## Asset keys
Use one central manifest entry for each new asset:
- characterSelect.background
- characterSelect.slotFrame

Do not scatter literal paths through scene code.

## Responsive behavior
- Design coordinates are based on 1920x1080.
- Preserve 16:9 composition.
- At other desktop sizes, scale the entire layout proportionally.
- UI remains interactive and readable at 1280x720.
- Do not crop off buttons or slots.
- Do not stretch background disproportionately.

## Stage 1 protection
Do not change:
- approved Main Menu artwork
- Main Menu button assets
- Settings behavior
- Stage 1 architecture

Only update START GAME navigation if necessary to reach CharacterSelectScene.

## Completion checklist
Before reporting completion verify:
1. Main Menu still works.
2. START GAME opens Character Select.
3. Four empty slots appear correctly.
4. Slot hover/selection works.
5. CREATE CHARACTER opens only the Stage 3 placeholder.
6. ENTER WORLD is disabled for empty slots.
7. DELETE is disabled for empty slots.
8. BACK returns to Main Menu.
9. Keyboard navigation works.
10. localStorage persistence does not crash on malformed data.
11. 1920x1080 and 1280x720 both preserve layout.
12. No gameplay or character creator was added.
