/* ---------------------------------------------------------------------------
   BlackHoleStill — the static frame.

   Shown when WebGPU is unavailable, when the renderer fails to initialise, and
   as the poster underneath the canvas while it boots (cross-faded out by
   styles/blackhole.css once the stage reports `data-status="live"`).

   Deliberately NOT a bitmap: no binary asset is added to the repo. The whole
   frame is one inline SVG plus the site's existing `--noise` grain, drawn from
   the simulation's own palette (blackhole.config.js → the `--bh-*` tokens in
   global.css): nebula navy #071f44 / #010615 behind a warm disk
   #a84b23 → #7f1b00, a small lensed shadow and a photon ring.

   Geometry is scaled off the real thing rather than guessed. With the config's
   blackHoleMass 0.4 (rs = 0.8), diskInnerRadius 4.1 and diskOuterRadius 14.5,
   the lensed shadow is ~8% of the disk's width and the disk is a shallow
   ellipse (the establishing camera sits ~14° under the plane) — which is why
   the hole reads small and centred with a lot of sky around it, matching the
   live render's framing.

   Nothing animates here, so the reduced-motion and no-WebGPU paths are both
   genuinely still. Star positions come from a seeded PRNG at module scope:
   pure math, no `window`/`document`, so the file is import-safe anywhere and
   the field is identical on every paint.
--------------------------------------------------------------------------- */

/** mulberry32 — tiny deterministic PRNG, so the star field never re-shuffles. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  fill: string;
}

const STARS: Star[] = (() => {
  const rnd = mulberry32(0x51f3a7);
  const stars: Star[] = [];
  for (let i = 0; i < 168; i++) {
    const roll = rnd();
    stars.push({
      x: rnd() * 1600,
      y: rnd() * 900,
      r: 0.5 + rnd() * rnd() * 2.1,
      o: 0.18 + rnd() * 0.72,
      // A few warm and a few blue-white, the rest neutral — the same spread
      // the shader's blackbody star field produces.
      fill: roll > 0.9 ? '#ffd9b0' : roll > 0.76 ? '#cfe4ff' : '#ffffff',
    });
  }
  return stars;
})();

/* Disk plane, as seen from the establishing camera (0, -5, 20): a shallow
   ellipse tipped ~13° so it never sits perfectly horizontal. */
const TILT = -13;
const CX = 800;
const CY = 450;

export default function BlackHoleStill() {
  return (
    <div className="bh-still" aria-hidden="true">
      <svg
        className="bh-still__svg"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          {/* Nebula — the shader's two FBM layers, reduced to two washes */}
          <radialGradient id="bhs-neb1" cx="24%" cy="20%" r="66%">
            <stop offset="0%" stopColor="#071f44" stopOpacity="0.9" />
            <stop offset="52%" stopColor="#04122c" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#010615" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bhs-neb2" cx="80%" cy="76%" r="62%">
            <stop offset="0%" stopColor="#0a2752" stopOpacity="0.5" />
            <stop offset="58%" stopColor="#03102a" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#010615" stopOpacity="0" />
          </radialGradient>

          {/* Warm bloom the disk throws onto the surrounding sky */}
          <radialGradient id="bhs-bloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.3" />
            <stop offset="34%" stopColor="#a84b23" stopOpacity="0.2" />
            <stop offset="68%" stopColor="#7f1b00" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#7f1b00" stopOpacity="0" />
          </radialGradient>

          {/* Accretion disk — asymmetric on purpose: the approaching limb is
              Doppler-beamed brighter, exactly what dopplerStrength does. */}
          <linearGradient
            id="bhs-disk"
            gradientUnits="userSpaceOnUse"
            x1={CX - 560}
            y1={CY}
            x2={CX + 560}
            y2={CY}
          >
            <stop offset="0%" stopColor="#fff4de" />
            <stop offset="16%" stopColor="#ffd9a0" />
            <stop offset="44%" stopColor="#a84b23" />
            <stop offset="76%" stopColor="#7f1b00" />
            <stop offset="100%" stopColor="#3b0d00" />
          </linearGradient>

          {/* The lensed shadow: pure black core, faint warm rim */}
          <radialGradient id="bhs-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="1" />
            <stop offset="82%" stopColor="#000000" stopOpacity="1" />
            <stop offset="97%" stopColor="#150703" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#2a0f04" stopOpacity="0.7" />
          </radialGradient>

          <filter id="bhs-soft" x="-40%" y="-300%" width="180%" height="700%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id="bhs-glow" x="-40%" y="-400%" width="180%" height="900%">
            <feGaussianBlur stdDeviation="7" />
          </filter>

          {/* Everything below the disk plane — the near limb, which passes in
              FRONT of the shadow. Applied inside the tilted group so the split
              follows the disk, not the viewport. */}
          <clipPath id="bhs-near">
            <rect x="-200" y={CY + 2} width="2000" height="900" />
          </clipPath>
        </defs>

        {/* Sky */}
        <rect width="1600" height="900" fill="#010615" />
        <rect width="1600" height="900" fill="url(#bhs-neb1)" />
        <rect width="1600" height="900" fill="url(#bhs-neb2)" />

        <g className="bh-still__stars">
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill={s.fill} opacity={s.o.toFixed(2)} />
          ))}
        </g>

        {/* Warm light the disk spills into the sky */}
        <ellipse cx={CX} cy={CY} rx="640" ry="330" fill="url(#bhs-bloom)" />

        {/* ---- Accretion disk, far limb (behind the shadow) ---- */}
        <g transform={`rotate(${TILT} ${CX} ${CY})`}>
          <ellipse
            cx={CX}
            cy={CY}
            rx="556"
            ry="140"
            fill="none"
            stroke="url(#bhs-disk)"
            strokeWidth="104"
            opacity="0.42"
            filter="url(#bhs-soft)"
          />
          <ellipse
            cx={CX}
            cy={CY}
            rx="486"
            ry="122"
            fill="none"
            stroke="url(#bhs-disk)"
            strokeWidth="58"
            opacity="0.85"
            filter="url(#bhs-glow)"
          />
          <ellipse
            cx={CX}
            cy={CY}
            rx="452"
            ry="113"
            fill="none"
            stroke="url(#bhs-disk)"
            strokeWidth="16"
            opacity="0.95"
          />
        </g>

        {/* ---- Lensed shadow + photon ring ---- */}
        <circle cx={CX} cy={CY} r="52" fill="url(#bhs-shadow)" />
        <circle
          cx={CX}
          cy={CY}
          r="55"
          fill="none"
          stroke="#ffe6bd"
          strokeWidth="5"
          opacity="0.55"
          filter="url(#bhs-glow)"
        />
        <circle cx={CX} cy={CY} r="54.5" fill="none" stroke="#fff6e4" strokeWidth="1.6" opacity="0.9" />

        {/* ---- The far limb bent over the top of the shadow: the arc that
               sells gravitational lensing in a single static frame ---- */}
        <g transform={`rotate(${TILT} ${CX} ${CY})`}>
          <path
            d={`M ${CX - 132} ${CY} A 132 96 0 0 1 ${CX + 132} ${CY}`}
            fill="none"
            stroke="url(#bhs-disk)"
            strokeWidth="30"
            opacity="0.5"
            filter="url(#bhs-glow)"
          />
          <path
            d={`M ${CX - 104} ${CY} A 104 74 0 0 1 ${CX + 104} ${CY}`}
            fill="none"
            stroke="#ffeccb"
            strokeWidth="4"
            opacity="0.75"
          />
        </g>

        {/* ---- Near limb, redrawn over the shadow ---- */}
        <g transform={`rotate(${TILT} ${CX} ${CY})`} clipPath="url(#bhs-near)">
          <ellipse
            cx={CX}
            cy={CY}
            rx="486"
            ry="122"
            fill="none"
            stroke="url(#bhs-disk)"
            strokeWidth="58"
            opacity="0.95"
            filter="url(#bhs-glow)"
          />
          <ellipse
            cx={CX}
            cy={CY}
            rx="452"
            ry="113"
            fill="none"
            stroke="url(#bhs-disk)"
            strokeWidth="18"
          />
        </g>
      </svg>

      {/* The site's obsidian grain, reused as-is so the still sits in the same
          material family as every other surface on the page. */}
      <span className="bh-still__grain" />
    </div>
  );
}
