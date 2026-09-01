/* ============================================================================
   scenes — the section-aware ambient system ("the background knows where
   you are").

   The page is divided into seven atmospheric "districts". As sections cross
   the viewport centre band, observeScenes() stamps `data-scene` onto <html>
   and notifies the renderer. Two consumers:

     · Ambience.tsx (WebGL path) — receives the scene id, looks up the
       palette below and glides its shader uniforms toward it on the GPU.
     · overhaul.css (no-WebGL fallback) — html[data-scene='…'] rules retarget
       the --amb-* colour custom properties of the CSS nebula washes.

   Palette intent (from the design system: gold is reserved for rarity):
     arrival        hero              — the signature iris/cyan/magenta wash
     registry       roster + rotunda  — cyan-led, archival, cooler
     signal         persona           — mono-cool cyan/blue transmission
     arsenal        perks             — iris-led, charged
     vault          pulls + store     — gold ingress; rarity is the story here
     constellation  artists           — magenta-led, celebratory
     abyss          lore + footer     — near-black, vignette closing in
   ========================================================================== */

export type SceneId =
  | 'arrival'
  | 'registry'
  | 'signal'
  | 'arsenal'
  | 'vault'
  | 'constellation'
  | 'abyss';

type RGB = readonly [number, number, number];
type XY = readonly [number, number];

interface SceneField {
  /** Light colour, sRGB 0..1 */
  color: RGB;
  /** Peak additive intensity — kept low so foreground contrast stays AAA */
  gain: number;
  /** Anchor in viewport UV space (x 0..1 left→right, y 0..1 top→bottom;
      values slightly outside push the core off-screen like the old blobs) */
  pos: XY;
  /** Falloff radius in viewport-height units */
  rad: number;
}

export interface Scene {
  fields: readonly [SceneField, SceneField, SceneField];
  /** Vignette strength 0..1 (edge darkening toward void) */
  vig: number;
  /** Gold "rarity light" ingress 0..1 (vault scenes only) */
  warm: number;
}

/* ---- Design-system palette, normalised ---- */
const IRIS: RGB = [0.541, 0.302, 1.0]; //      #8a4dff
const IRIS_DEEP: RGB = [0.357, 0.169, 0.839]; // #5b2bd6
const CYAN: RGB = [0.247, 0.91, 1.0]; //       #3fe8ff
const MAGENTA: RGB = [1.0, 0.239, 0.604]; //   #ff3d9a
const GOLD: RGB = [1.0, 0.784, 0.341]; //      #ffc857
const BLUE: RGB = [0.227, 0.357, 0.85]; //     #3a5bd9

export const SCENES: Record<SceneId, Scene> = {
  arrival: {
    fields: [
      { color: IRIS, gain: 0.16, pos: [0.14, 0.06], rad: 0.62 },
      { color: CYAN, gain: 0.11, pos: [0.96, 0.38], rad: 0.52 },
      { color: MAGENTA, gain: 0.1, pos: [0.38, 1.06], rad: 0.6 },
    ],
    vig: 0.5,
    warm: 0,
  },
  registry: {
    fields: [
      { color: CYAN, gain: 0.12, pos: [0.08, 0.12], rad: 0.58 },
      { color: IRIS, gain: 0.13, pos: [0.98, 0.34], rad: 0.56 },
      { color: BLUE, gain: 0.1, pos: [0.52, 1.1], rad: 0.68 },
    ],
    vig: 0.54,
    warm: 0,
  },
  signal: {
    fields: [
      { color: CYAN, gain: 0.13, pos: [0.86, 0.1], rad: 0.55 },
      { color: BLUE, gain: 0.1, pos: [0.04, 0.58], rad: 0.6 },
      { color: IRIS, gain: 0.07, pos: [0.5, 1.14], rad: 0.62 },
    ],
    vig: 0.6,
    warm: 0,
  },
  arsenal: {
    fields: [
      { color: IRIS, gain: 0.16, pos: [0.84, 0.16], rad: 0.6 },
      { color: MAGENTA, gain: 0.09, pos: [0.04, 0.72], rad: 0.55 },
      { color: CYAN, gain: 0.09, pos: [0.4, 1.1], rad: 0.58 },
    ],
    vig: 0.55,
    warm: 0,
  },
  vault: {
    fields: [
      { color: GOLD, gain: 0.14, pos: [0.78, 0.06], rad: 0.58 },
      { color: IRIS_DEEP, gain: 0.15, pos: [0.05, 0.46], rad: 0.6 },
      { color: MAGENTA, gain: 0.08, pos: [0.55, 1.1], rad: 0.58 },
    ],
    vig: 0.6,
    warm: 1,
  },
  constellation: {
    fields: [
      { color: MAGENTA, gain: 0.12, pos: [0.12, 0.1], rad: 0.58 },
      { color: CYAN, gain: 0.1, pos: [0.94, 0.52], rad: 0.54 },
      { color: IRIS, gain: 0.11, pos: [0.46, 1.1], rad: 0.62 },
    ],
    vig: 0.55,
    warm: 0,
  },
  abyss: {
    fields: [
      { color: IRIS_DEEP, gain: 0.11, pos: [0.5, 0.02], rad: 0.66 },
      { color: BLUE, gain: 0.05, pos: [0.9, 0.78], rad: 0.55 },
      { color: MAGENTA, gain: 0.04, pos: [0.06, 1.05], rad: 0.55 },
    ],
    vig: 0.8,
    warm: 0,
  },
};

export const DEFAULT_SCENE: SceneId = 'arrival';

/* Section id → scene. Ids match the live DOM (Hero renders header#top;
   the footer is #connect and sits outside <main>, hence getElementById). */
export const SECTION_SCENE: Record<string, SceneId> = {
  top: 'arrival',
  nemoverse: 'registry',
  rotunda: 'registry',
  persona: 'signal',
  perks: 'arsenal',
  pulls: 'vault',
  store: 'vault',
  artists: 'constellation',
  lore: 'abyss',
  connect: 'abyss',
};

/* ---------------------------------------------------------------------------
   sceneVec — flatten a scene to the 20-float layout the shader loop lerps:
     [ r·g, g·g, b·g, x, y, rad ] × 3 fields, then [ vig, warm ].
   Gain is premultiplied into the colour so the shader adds one vec3 per
   field and the CPU interpolates a single flat array between scenes.
--------------------------------------------------------------------------- */
export const SCENE_FLOATS = 20;

export function sceneVec(s: Scene): Float32Array {
  const v = new Float32Array(SCENE_FLOATS);
  for (let i = 0; i < 3; i++) {
    const f = s.fields[i];
    const o = i * 6;
    v[o] = f.color[0] * f.gain;
    v[o + 1] = f.color[1] * f.gain;
    v[o + 2] = f.color[2] * f.gain;
    v[o + 3] = f.pos[0];
    v[o + 4] = f.pos[1];
    v[o + 5] = f.rad;
  }
  v[18] = s.vig;
  v[19] = s.warm;
  return v;
}

/* ---------------------------------------------------------------------------
   observeScenes — single IntersectionObserver over the mapped sections using
   the same centre-band technique as SideRail (-38% / -52% root margins ≈ the
   section crossing the reading line). Stamps data-scene on <html> and calls
   the optional callback exactly once per scene change. Returns a cleanup fn.
--------------------------------------------------------------------------- */
export function observeScenes(onScene?: (id: SceneId) => void): () => void {
  const root = document.documentElement;
  let current: SceneId | null = null;

  const apply = (id: SceneId) => {
    if (id === current) return;
    current = id;
    root.dataset.scene = id;
    onScene?.(id);
  };

  apply(DEFAULT_SCENE);

  if (typeof IntersectionObserver === 'undefined') {
    return () => {
      delete root.dataset.scene;
    };
  }

  const els = Object.keys(SECTION_SCENE)
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const next = SECTION_SCENE[(e.target as HTMLElement).id];
          if (next) apply(next);
          return;
        }
      }
    },
    { rootMargin: '-38% 0px -52% 0px' },
  );
  els.forEach((el) => io.observe(el));

  return () => {
    io.disconnect();
    delete root.dataset.scene;
  };
}
