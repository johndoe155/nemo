import { useEffect, useRef } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';

/* ============================================================================
   HERO RINGS — "physical anomalies suspended in the Nemoverse"
   ----------------------------------------------------------------------------
   Replaces the two flat `.hero__orbit.orbit.spin` divs (1px rgba border + one
   rigid ::after dot on a linear @keyframes spin).

   MATERIAL / DIMENSIONALITY
     · a conic-gradient annulus (iris → cyan → white-hot → magenta) is masked
       over a structural SVG stroke, so the ring reads as a lit object with
       varied lighting instead of a hairline.
     · an asymmetric opacity map (non-rotating "veil" mask) sinks the ring into
       the absolute void at its lowest point and lets it burn brightest on the
       side facing the central portal.
     · backdrop-filter blur sits directly behind the stroke: the cosmos visibly
       refracts through the ring like curved glass.

   PHYSICS-DRIVEN INTERACTIVITY
     · cursor position → useSpring → rotateX / rotateY 3D parallax tilt + drift.
       The rings are pulled off their perfect axis as the user explores.
     · angular velocity is integrated per frame (no CSS keyframes). Scroll
       velocity is spring-smoothed and mapped into a boost, so the rings spool
       up during fast scrolls and coast back down to their idle rate.

   PARTICLE SYSTEM
     · sparks are independent <motion.div> elements (not ::after) so they can
       use screen / color-dodge blending.
     · each spark drags a comet tail sampled from its own past orbital angles.
     · glow intensity is a function of orbital position — sparks flare as they
       cross the brightest lobe of the nebula and dim in the void.
     · layered sine noise adds micro-jitter to angle and radius: cosmic
       interference rather than a robot-perfect circle.

   Everything collapses to a cheap static render under prefers-reduced-motion.
============================================================================ */

const DEG = Math.PI / 180;

/* Two light sources drive the sparks' glow: the ring's own portal-facing arc
   (9 o'clock, where the veil peaks) and the weaker nebula lobe washing in from
   the upper right of the hero art. Angles are math-space: 0 = +x, positive
   clockwise on screen. */
const PORTAL_AXIS = 186 * DEG;
const NEBULA_AXIS = -55 * DEG;

/* Hook-count must stay constant across renders, so tails are always allocated
   at MAX_TAIL and only `tailLength` of them are rendered. */
const MAX_TAIL = 12;
const TAIL_COARSE = 5;

type SparkSpec = {
  /* starting phase around the ring, degrees */
  phase: number;
  /* head diameter, px */
  size: number;
  color: string;
  /* angular spacing between tail samples, degrees */
  tailStep: number;
  /* noise seeds */
  s1: number;
  s2: number;
  s3: number;
};

type RingSpec = {
  id: string;
  size: number;
  right: string;
  top: string;
  /* 1 = clockwise, -1 = counter-clockwise */
  dir: 1 | -1;
  /* idle angular velocity, deg/s (the old 22s / 30s loops = 16.4 / 12 deg/s) */
  speed: number;
  /* material thickness, px */
  weight: number;
  /* cursor tilt amplitude, deg */
  tilt: number;
  /* cursor drift amplitude, px */
  drift: number;
  /* sensitivity to scroll velocity */
  boost: number;
  conic: string;
  sparks: SparkSpec[];
};

const RINGS: RingSpec[] = [
  {
    id: 'outer',
    size: 620,
    right: '-8%',
    top: '-12%',
    dir: 1,
    speed: 16.4,
    weight: 2.6,
    tilt: 13,
    drift: 26,
    boost: 1,
    conic: `conic-gradient(from 0deg,
      rgba(138, 77, 255, 0) 0deg,
      rgba(138, 77, 255, 0.5) 32deg,
      rgba(63, 232, 255, 0.92) 94deg,
      rgba(245, 243, 255, 0.9) 128deg,
      rgba(255, 61, 154, 0.6) 190deg,
      rgba(138, 77, 255, 0.2) 248deg,
      rgba(63, 232, 255, 0.52) 312deg,
      rgba(138, 77, 255, 0) 360deg)`,
    sparks: [
      { phase: 0, size: 9, color: '#3fe8ff', tailStep: 3.4, s1: 0.31, s2: 1.77, s3: 4.12 },
      { phase: 141, size: 5.5, color: '#ff3d9a', tailStep: 2.4, s1: 2.4, s2: 5.1, s3: 0.92 },
    ],
  },
  {
    id: 'inner',
    size: 420,
    right: '6%',
    top: '4%',
    dir: -1,
    speed: 12,
    weight: 1.9,
    tilt: 19,
    drift: 40,
    boost: 1.5,
    conic: `conic-gradient(from 0deg,
      rgba(255, 200, 87, 0) 0deg,
      rgba(255, 61, 154, 0.4) 46deg,
      rgba(138, 77, 255, 0.78) 116deg,
      rgba(63, 232, 255, 0.9) 174deg,
      rgba(245, 243, 255, 0.72) 212deg,
      rgba(138, 77, 255, 0.28) 284deg,
      rgba(255, 200, 87, 0) 360deg)`,
    sparks: [
      { phase: 208, size: 7, color: '#8a4dff', tailStep: 4.2, s1: 1.13, s2: 3.9, s3: 2.05 },
      { phase: 44, size: 4.5, color: '#ffc857', tailStep: 3, s1: 5.6, s2: 0.44, s3: 3.31 },
    ],
  },
];

/* Flare curve: ~0 in the void arc, 1 crossing the brightest lighting. */
function lobe(theta: number, axis: number) {
  const l = (1 + Math.cos(theta - axis)) / 2;
  return l * l * (3 - 2 * l); // smoothstep — keeps the peak tight
}

function flareAt(theta: number) {
  return Math.max(lobe(theta, PORTAL_AXIS), 0.5 * lobe(theta, NEBULA_AXIS));
}

/* Layered incommensurate sines ≈ cheap band-limited noise. Returns an angular
   wobble in degrees and a radial wobble as a fraction of the radius. */
function interference(t: number, s: SparkSpec) {
  const a =
    Math.sin(t * 1.63 + s.s1) * 0.9 +
    Math.sin(t * 0.41 + s.s2) * 1.8 +
    Math.sin(t * 3.11 + s.s3) * 0.35;
  const r =
    Math.sin(t * 0.93 + s.s2) * 0.011 +
    Math.sin(t * 2.27 + s.s3) * 0.006 +
    Math.sin(t * 5.3 + s.s1) * 0.002;
  return { a, r };
}

type DotValues = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  o: MotionValue<number>;
  s: MotionValue<number>;
};

/* Fixed-length allocation → hook order is stable. */
function useDots(count: number): DotValues[] {
  const dots: DotValues[] = [];
  for (let i = 0; i < count; i++) {
    /* eslint-disable react-hooks/rules-of-hooks */
    dots.push({
      x: useMotionValue(0),
      y: useMotionValue(0),
      o: useMotionValue(0),
      s: useMotionValue(1),
    });
    /* eslint-enable react-hooks/rules-of-hooks */
  }
  return dots;
}

/* ---------------------------------------------------------------------------
   Spark — one orbiting particle plus its comet tail
--------------------------------------------------------------------------- */

function Spark({
  spec,
  angle,
  rate,
  radius,
  dir,
  tailLength,
  reduced,
}: {
  spec: SparkSpec;
  angle: MotionValue<number>;
  /* current spin multiplier (1 = idle) — stretches the comet tail */
  rate: MotionValue<number>;
  radius: number;
  dir: 1 | -1;
  tailLength: number;
  reduced: boolean;
}) {
  const head = useDots(1)[0];
  const halo = useMotionValue(0.25);
  const haloScale = useMotionValue(1);
  const tail = useDots(MAX_TAIL);

  const place = (dot: DotValues, deg: number, rr: number) => {
    const th = deg * DEG;
    dot.x.set(Math.cos(th) * rr);
    dot.y.set(Math.sin(th) * rr);
    return th;
  };

  /* Static placement for reduced motion / first paint. */
  useEffect(() => {
    const th = place(head, spec.phase, radius);
    head.o.set(1);
    head.s.set(1);
    halo.set(0.3 + 0.7 * flareAt(th));
    if (reduced) {
      for (let i = 0; i < tail.length; i++) tail[i].o.set(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, radius]);

  useAnimationFrame((time) => {
    if (reduced) return;
    const t = time / 1000;
    const base = angle.get() + spec.phase;
    const noise = interference(t, spec);
    /* the faster the ring spools, the longer the comet draws itself out */
    const stretch = 0.78 + 0.4 * rate.get();

    /* ---- head ---- */
    const headDeg = base + noise.a;
    const headR = radius * (1 + noise.r);
    const th = place(head, headDeg, headR);
    const flare = flareAt(th);
    head.o.set(0.72 + 0.28 * flare);
    head.s.set(0.82 + 0.75 * flare);
    halo.set(0.08 + 0.92 * flare);
    haloScale.set(0.9 + 1.5 * flare);

    /* ---- comet tail: samples of where the head *was* ---- */
    for (let i = 0; i < tailLength; i++) {
      const seg = tail[i];
      const k = (i + 1) / tailLength;
      /* trail behind the direction of travel, with its own drifting noise so
         the tail frays instead of being a rigid arc */
      const lag = (i + 1) * spec.tailStep * stretch;
      const segNoise = interference(t - k * 0.28, spec);
      const deg = base - dir * lag + segNoise.a * (0.6 + k);
      const segR = radius * (1 + segNoise.r * (1 + k * 1.8));
      const segTh = place(seg, deg, segR);
      const fade = Math.pow(1 - k, 1.7);
      seg.o.set(fade * (0.18 + 0.62 * flareAt(segTh)));
      seg.s.set(0.28 + fade * 0.85);
    }
  });

  const shown = reduced ? 0 : tailLength;

  return (
    <>
      {tail.slice(0, shown).map((seg, i) => (
        <motion.div
          key={`t${i}`}
          className="hring__trail"
          style={{
            x: seg.x,
            y: seg.y,
            opacity: seg.o,
            scale: seg.s,
            width: spec.size,
            height: spec.size,
            marginLeft: -spec.size / 2,
            marginTop: -spec.size / 2,
            background: `radial-gradient(circle, ${spec.color} 0%, ${spec.color}00 70%)`,
          }}
        />
      ))}

      <motion.div
        className="hring__spark"
        style={{
          x: head.x,
          y: head.y,
          opacity: head.o,
          scale: head.s,
          width: spec.size,
          height: spec.size,
          marginLeft: -spec.size / 2,
          marginTop: -spec.size / 2,
        }}
      >
        <span
          className="hring__spark-core"
          style={{
            background: `radial-gradient(circle at 40% 35%, #fff 0%, ${spec.color} 45%, ${spec.color}00 100%)`,
            boxShadow: `0 0 ${spec.size * 1.6}px ${spec.color}`,
          }}
        />
        <motion.span
          className="hring__spark-halo"
          style={{
            opacity: halo,
            scale: haloScale,
            background: `radial-gradient(circle, ${spec.color}cc 0%, ${spec.color}33 38%, ${spec.color}00 72%)`,
          }}
        />
      </motion.div>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Ring — material + structure + physics
--------------------------------------------------------------------------- */

function Ring({
  spec,
  mx,
  my,
  y,
  velocity,
  reduced,
  tailLength,
}: {
  spec: RingSpec;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  y: MotionValue<number>;
  velocity: MotionValue<number>;
  reduced: boolean;
  tailLength: number;
}) {
  /* ---- cursor physics: springs, never raw pointer values ---- */
  const sx = useSpring(mx, { stiffness: 48, damping: 16, mass: 0.9 });
  const sy = useSpring(my, { stiffness: 48, damping: 16, mass: 0.9 });

  const rotateY = useTransform(sx, (v) => v * spec.tilt);
  const rotateX = useTransform(sy, (v) => -v * spec.tilt * 0.72);
  const driftX = useTransform(sx, (v) => v * spec.drift);
  const driftY = useTransform([y, sy], (latest) => {
    const [scroll, m] = latest as [number, number];
    return scroll + m * spec.drift * 0.6;
  });

  /* ---- integrated rotation: idle velocity + scroll-velocity boost ---- */
  const angle = useMotionValue(0);
  const counter = useMotionValue(0);
  const rate = useMotionValue(1);
  const angleRef = useRef(0);

  useAnimationFrame((_t, delta) => {
    if (reduced) return;
    const dt = Math.min(delta, 64) / 1000;
    const v = Math.abs(velocity.get());
    /* scroll velocity mapping: idle 1× → up to ~3.4× mid-flick, spring-decayed */
    const boostFactor = 1 + Math.min(2.4, (v / 850) * spec.boost);
    rate.set(boostFactor);
    angleRef.current = (angleRef.current + spec.dir * spec.speed * boostFactor * dt) % 360;
    angle.set(angleRef.current);
    /* the structural stroke counter-drifts → the material reads as two shells */
    counter.set(angleRef.current * -0.38);
  });

  const u = 200 / spec.size; // px → viewBox units
  const R = 100 - (spec.weight / 2) * u; // stroke rides the centre of the material
  const circumference = 2 * Math.PI * R;
  const radiusPx = spec.size / 2 - spec.weight / 2;

  return (
    <motion.div
      className="hring"
      aria-hidden="true"
      style={{
        width: spec.size,
        height: spec.size,
        right: spec.right,
        top: spec.top,
        x: driftX,
        y: driftY,
        ['--hring-weight' as string]: `${spec.weight}px`,
      }}
    >
      <motion.div className="hring__stage" style={{ rotateX, rotateY }}>
        {/* Ethereal glass: the cosmos refracts through the stroke. Kept outside
            .hring__veil on purpose — a masked ancestor becomes a backdrop root
            and would starve backdrop-filter, so this layer carries the
            asymmetric fade in its own composited mask. */}
        <div className="hring__glass" />

        {/* asymmetric opacity map — static in world space, so the ring always
            dies into the void at its lowest point and glows toward the portal */}
        <div className="hring__veil">
          {/* conic material, rotating with the body */}
          <motion.div
            className="hring__conic"
            style={{ rotate: angle, backgroundImage: spec.conic }}
          />

          {/* structural SVG stroke under the gradient */}
          <motion.svg
            className="hring__struct"
            viewBox="0 0 200 200"
            style={{ rotate: counter }}
            focusable="false"
          >
            <defs>
              <linearGradient id={`hring-${spec.id}-stroke`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(245,243,255,0.85)" />
                <stop offset="38%" stopColor="rgba(63,232,255,0.5)" />
                <stop offset="72%" stopColor="rgba(138,77,255,0.28)" />
                <stop offset="100%" stopColor="rgba(138,77,255,0)" />
              </linearGradient>
              <filter id={`hring-${spec.id}-bloom`} x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation={2.4 * u} />
              </filter>
            </defs>

            {/* hairline structure */}
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={`url(#hring-${spec.id}-stroke)`}
              strokeWidth={0.7 * u}
            />
            {/* engineering ticks — reads as a machined orbital gantry */}
            <circle
              cx="100"
              cy="100"
              r={R - 5 * u}
              fill="none"
              stroke="rgba(245,243,255,0.22)"
              strokeWidth={0.5 * u}
              strokeDasharray={`${1.5 * u} ${16 * u}`}
              strokeLinecap="round"
            />
            {/* blown-out specular arc facing the portal */}
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="rgba(63,232,255,0.75)"
              strokeWidth={spec.weight * 0.85 * u}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.16} ${circumference}`}
              strokeDashoffset={circumference * 0.08}
              filter={`url(#hring-${spec.id}-bloom)`}
            />
          </motion.svg>
        </div>

        {/* particle field rides the tilt but escapes the veil mask so sparks
            can burn at full intensity over the dead side of the ring */}
        <div className="hring__field">
          {spec.sparks.map((s) => (
            <Spark
              key={s.phase}
              spec={s}
              angle={angle}
              rate={rate}
              radius={radiusPx}
              dir={spec.dir}
              tailLength={tailLength}
              reduced={reduced}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
   HeroRings — shared scroll-velocity source for both rings
--------------------------------------------------------------------------- */

export default function HeroRings({
  mx,
  my,
  y,
  reduced,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  y: MotionValue<number>;
  reduced: boolean;
}) {
  const { scrollY } = useScroll();
  const rawVelocity = useVelocity(scrollY);
  const velocity = useSpring(rawVelocity, { stiffness: 90, damping: 34, mass: 0.55 });

  const coarse =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const tailLength = coarse ? TAIL_COARSE : MAX_TAIL;

  return (
    <>
      {RINGS.map((spec) => (
        <Ring
          key={spec.id}
          spec={spec}
          mx={mx}
          my={my}
          y={y}
          velocity={velocity}
          reduced={reduced}
          tailLength={tailLength}
        />
      ))}
    </>
  );
}
