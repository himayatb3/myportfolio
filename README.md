# Himayat Portfolio

# Play mode

The site now opens on a start screen: **Press start** drops you into a side-scrolling world, **Classic view** is the normal scrolling page (also the fallback without JavaScript and for reduced motion preferences). The choice is remembered for the tab.

**Controls:** arrows / A D to move, Space / W / Up to jump, E / Enter to interact, M to mute. On touch devices an on-screen pad appears.

**What to do:** collect the 10 tech coins, stomp bugs (they only knock you back, there is no game over), walk to doors, flags and the gate and press E, and bump the skill blocks from below. Every project door opens a panel with a short mini-game (workflow order, role visibility, signature pad, notification inbox, alarm classification, booking stages). Contact details are never gated: "Let's talk" is always in the HUD.

**Files:** `game.js` (world, physics, HUD, panels), `minigames.js` (the mini-games), `script.js` (classic scroll view, paused while playing). Panel text is cloned from the classic page via `data-panel` attributes, so content lives in one place.


A portfolio that plays like a game. Scrolling moves a pixel character along an XP bar, every section is a level, and the page rewards you with achievements as you read.

## Run
Extract the ZIP and open index.html in your browser. No installation or build step is required.
You can also open this folder in VS Code and use Live Server.

## Edit
- index.html: profile, projects, skills, experience, and contact links.
- style.css: colors, typography, layout, and responsive styles. Main colors are in :root.
- script.js: HUD, XP bar, level-ups, achievements, quest chain, skill tree, starfield and pointer effects.

Keep all three files in the same folder. Google Fonts (Chakra Petch, Hanken Grotesk, Silkscreen) requires an internet connection; system fonts are used as a fallback.

## Game mechanics
- **HUD and XP bar:** fixed at the top. The pixel character runs along the bar as you scroll and jumps on each level-up.
- **Levels:** every `<section data-level data-name data-hue>` is a level. `data-name` is the label in the HUD and `data-hue` sets the colour tint of the world for that level.
- **Achievements:** short toasts unlocked as you reach real milestones. Edit them in script.js (search for `award(`).
- **Quest chain:** the HSE workflow steps tick off as you scroll through the featured project.
- **Skill tree and campaign log:** a beam fills as you scroll and unlocks each skill and job checkpoint.
- **Colour meaning:** gold is XP, coral is HP, blue is MP, mint is heal, violet is arcane. Accent colours are set per card with the `c-xp`, `c-hp`, `c-mp`, `c-heal` and `c-arcane` classes.
- **Easter egg:** try the Konami code.

## Motion and accessibility
All animation respects the visitor's "reduce motion" system setting: content shows immediately, achievements and particles are skipped, and the starfield stays still. Content stays visible if JavaScript fails to load. The lock-on cursor, card tilt and magnetic buttons only run on devices with a mouse.

## Host
Upload index.html, style.css, and script.js to any static web host.
