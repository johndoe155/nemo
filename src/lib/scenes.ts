/* ============================================================================
   scenes — the depth-zone system (IDENTITY-SPEC §2.1)

   Was: eight space districts with their own hardcoded hexes. Now: a thin
   mapping over src/lib/palette.ts, the single source of truth for colour
   (SPEC §3.3). The page is a dive — surface → reef → mid-water → trench —
   and scroll is depth. The mechanism is unchanged: observeScenes() stamps
   `data-scene` on <html> as sections cross the reading line, and notifies
   the renderer.

   Two consumers:
     · Ambience.tsx (WebGL path) — lerps its uniforms toward the zone palette.
       The shader now paints the ZONE GROUND itself (uBase), so the canvas is
       the page ground exactly as it was the page void before; light zones
       get caustic light sheets instead of additive glow.
     · overhaul.css (no-WebGL fallback) — html[data-scene='…'] rules retarget
       the --amb-* wash colours for the same four zones.

   The scene vector layout grew from 20 to 32 floats to carry the ground:
     [0..17]  three colour fields (rgb·gain, x, y, rad)
     [18]     vignette strength
     [19]     caustic strength (was: gold warmth — gold is retired)
     [20..22] base ground
     [23..25] vignette target colour
     [26..28] caustic tint
     [29]     light-regime mix (1 = dry paper, 0 = water)
============================================================================ */

import {
  DEFAULT_ZONE,
  SECTION_ZONE,
  ZONES,
  floats,
  type ZoneId,
} from './palette';

export type SceneId = ZoneId;

type RGB = readonly [number, number, number];
type XY = readonly [number, number];

interface SceneField {
  color: RGB;
  gain: number;
  pos: XY;
  rad: number;
}

export interface Scene {
  fields: readonly [SceneField, SceneField, SceneField];
  vig: number;
  /** Caustic light-sheet strength. 0 on dry paper. */
  caustic: number;
  base: RGB;
  base2: RGB;
  tint: RGB;
  light: number;
}

const BASE_BY_ZONE: Record<ZoneId, [string, string, string]> = {
  /* [ground, vignette target, caustic tint] — all keys into palette.ts */
  surface: ['paper', 'paper-2', 'manila'],
  reef: ['paper', 'paper-2', 'water'],
  midwater: ['mid-ground', 'deep', 'sky'],
  trench: ['deep', 'deep-3', 'bio-cyan'],
};

function build(id: ZoneId): Scene {
  const z = ZONES[id];
  const [b, b2, t] = BASE_BY_ZONE[id];
  return {
    fields: z.fields.map((f) => ({
      color: floats(f.c),
      gain: f.gain,
      pos: f.pos,
      rad: f.rad,
    })) as unknown as [SceneField, SceneField, SceneField],
    vig: z.vig,
    caustic: z.caustic,
    base: floats(b as never),
    base2: floats(b2 as never),
    tint: floats(t as never),
    light: z.light ? 1 : 0,
  };
}

export const SCENES: Record<SceneId, Scene> = {
  surface: build('surface'),
  reef: build('reef'),
  midwater: build('midwater'),
  trench: build('trench'),
};

export const DEFAULT_SCENE: SceneId = DEFAULT_ZONE;

/* Section id → zone. Ids match the live DOM (Hero renders header#top; the
   footer is #connect and sits outside <main>, hence getElementById). The
   footer is the coda: the page surfaces, so it returns to paper. */
export const SECTION_SCENE: Record<string, SceneId> = { ...SECTION_ZONE };

/* ---------------------------------------------------------------------------
   SCENE_TINTS — the zone palette promoted into the CSS shell.
   `--scene-bg` retints the page ground (body background-color) and
   `--scene-line` carries the regime into card hairlines. Written by
   observeScenes' apply() — the same call that stamps data-scene — so the
   CSS shell, the shader and the no-WebGL fallback cannot drift apart.
--------------------------------------------------------------------------- */
export const SCENE_TINTS: Record<SceneId, { bg: string; line: string }> = {
  surface: { bg: '#F2EEE2', line: 'rgba(12, 11, 14, 0.18)' },
  reef: { bg: '#EEF0E4', line: 'rgba(12, 11, 14, 0.20)' },
  midwater: { bg: '#0B3548', line: 'rgba(242, 238, 226, 0.20)' },
  trench: { bg: '#06202F', line: 'rgba(242, 238, 226, 0.16)' },
};

/* ---------------------------------------------------------------------------
   sceneVec — flatten a scene to the 32-float layout the shader lerps.
--------------------------------------------------------------------------- */
export const SCENE_FLOATS = 32;

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
  v[19] = s.caustic;
  v[20] = s.base[0];
  v[21] = s.base[1];
  v[22] = s.base[2];
  v[23] = s.base2[0];
  v[24] = s.base2[1];
  v[25] = s.base2[2];
  v[26] = s.tint[0];
  v[27] = s.tint[1];
  v[28] = s.tint[2];
  v[29] = s.light;
  return v;
}

/* ---------------------------------------------------------------------------
   observeScenes — single IntersectionObserver over the mapped sections using
   the centre-band technique (-38% / -52% root margins ≈ the section crossing
   the reading line). Stamps data-scene on <html> and calls the optional
   callback exactly once per zone change. Returns a cleanup fn.
--------------------------------------------------------------------------- */
const MOBILE_SCENE_QUERY = '(max-width: 768px)';

export function observeScenes(onScene?: (id: SceneId) => void): () => void {
  const root = document.documentElement;
  let current: SceneId | null = null;

  const apply = (id: SceneId) => {
    if (id === current) return;
    current = id;
    root.dataset.scene = id;
    const tint = SCENE_TINTS[id];
    root.style.setProperty('--scene-bg', tint.bg);
    root.style.setProperty('--scene-line', tint.line);
    onScene?.(id);
  };

  apply(DEFAULT_SCENE);

  if (typeof IntersectionObserver === 'undefined') {
    return () => {
      delete root.dataset.scene;
    };
  }

  // On mobile the trench stage does not exist (see Singularity.tsx). Exclude
  // it from the observed set so the ambience never transitions to a zone
  // whose geometry is absent on phones.
  const isMobile =
    typeof window !== 'undefined' && window.matchMedia(MOBILE_SCENE_QUERY).matches;

  const els = Object.keys(SECTION_SCENE)
    .filter((id) => !(isMobile && id === 'singularity'))
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
    root.style.removeProperty('--scene-bg');
    root.style.removeProperty('--scene-line');
  };
}
