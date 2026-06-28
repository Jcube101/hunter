// boids.js — ALL tuning parameters for Hunter.
//
// This is the single source of truth for every magic number in the game.
// Values mirror the "Difficulty Parameters" table in GDD.md exactly.
// When a value changes here, update the matching row in GDD.md and commit
// with a `tune:` prefix (see CONTRIBUTING.md "Tuning Discipline").
//
// Never hardcode any of these values inline anywhere else in the codebase.

// --- Fish counts (determined once at game start, no respawning) ---
export const FISH_COUNT_MOBILE = 30 // viewport width < 768px
export const FISH_COUNT_DESKTOP = 50

// --- Speeds (px/frame) ---
export const FISH_BASE_SPEED = 2.5
export const FISH_FLEE_SPEED = 4.0 // at predator contact
export const SHARK_SPEED = 3.8 // faster than base, slower than flee speed

// --- Flee (predator avoidance) ---
export const FLEE_RADIUS = 100 // px — fish notice predator within this
export const FLEE_WEIGHT = 3.0 // dominates all other forces

// --- Separation (avoid crowding) ---
export const SEPARATION_RADIUS = 25 // px
export const SEPARATION_WEIGHT = 1.5

// --- Alignment (match heading of neighbors) ---
export const ALIGNMENT_RADIUS = 60 // px
export const ALIGNMENT_WEIGHT = 1.0

// --- Cohesion (drift toward group center) ---
export const COHESION_RADIUS = 100 // px
export const COHESION_WEIGHT = 1.4

// --- Anchor (weak constant pull toward world center; applied every frame) ---
export const ANCHOR_WEIGHT = 0.02 // very subtle — was 0.05, too strong (school clumped)

// --- Edge repulsion (turn away from world boundary) ---
export const EDGE_REPULSION_RADIUS = 120 // px from world boundary — start turning earlier
export const EDGE_REPULSION_WEIGHT = 3.0 // avoid walls aggressively (compensates weaker anchor)

// --- Catch detection ---
export const HITBOX_RADIUS = 8 // px — fish catch detection

// --- Mobile input ---
export const SHARK_OFFSET_MOBILE = 80 // px above touch point

// --- World sizing (× device viewport, fixed at game start) ---
export const WORLD_WIDTH_MULTIPLIER = 1.3
export const WORLD_HEIGHT_MULTIPLIER = 1.2

// --- Timing ---
export const GAME_DURATION = 60 // seconds
export const LOW_TIME_THRESHOLD = 10 // seconds — timer turns red

// --- Derived helpers (not tuning values; convenience only) ---
export const MOBILE_BREAKPOINT = 768 // px — viewport width boundary for mobile
export const INITIAL_VELOCITY_RANGE = 1.5 // ±px/frame randomised spawn velocity

// --- Geometry / feel constants (not in the GDD tuning table, but kept here so
//     nothing is hardcoded inline; see CONTRIBUTING.md). ---
// Distance from shark center to its mouth/front tip. Shared by the renderer
// (sprite tip) and the catch check so the visual and hitbox stay in sync.
export const SHARK_MOUTH_OFFSET = 16 // px
// Screen shake on catch (GDD.md "On Catch": 3 frames, 4px offset).
export const SHAKE_FRAMES = 3
export const SHAKE_OFFSET = 4 // px
// Minimum predator speed before its facing angle updates (prevents jitter at rest).
export const ROTATION_VELOCITY_THRESHOLD = 0.1 // px/frame
// Minimap width as a fraction of viewport width (GDD.md: ~15%).
export const MINIMAP_VIEWPORT_FRACTION = 0.15
// Catch detection is disabled for this long at game start so the school can
// scatter from the shared center spawn before the player can score (GDD.md).
export const GRACE_PERIOD = 2000 // ms
