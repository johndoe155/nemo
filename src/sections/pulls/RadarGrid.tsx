/* ============================================================================
   RadarGrid — the ARCHIVE SEALED panel's HUD backdrop.

   A faint grid with a 3D tilt (barrel distortion) drawn once to an offscreen
   layer. A top-to-bottom linear scanline sweeps over it; grid intersection
   nodes flash bright blue-white on beam contact and decay with a phosphor
   persistence trail. Subtle chromatic aberration is applied exclusively
   inside the light cone. The canvas is feathered near its edges by a CSS
   mask so the beam never clips harshly against the rounded borders.

   Reduced motion: static grid, no sweep.
   ========================================================================== */

import { useEffect, useRef } from 'react';

interface RadarGridProps {
  /** spinning pulls run the sweep hotter + faster */
  spin: boolean;
}

const CELL = 34; // grid cell size (css px)
const SWEEP_IDLE = 6.8; // seconds per full sweep
const SWEEP_SPIN = 2.4;
const DECAY = 0.95; // phosphor decay half-life factor (in exp decay τ)

export default function RadarGrid({ spin }: RadarGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spinRef = useRef(spin);
  useEffect(() => {
    spinRef.current = spin;
  }, [spin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let raf = 0;
    let visible = true;
    let W = 0;
    let H = 0;
    let grid: HTMLCanvasElement | null = null;
    let lines: number[][][] = []; // pre-mapped polylines for the CA pass
    let nodeX: number[] = [];
    let nodeY: number[] = [];
    let hitAt: number[] = [];
    let hitAmp: number[] = [];

    /* radial sprite for the phosphor nodes (fast drawImage) */
    const sprite = document.createElement('canvas');
    sprite.width = 32;
    sprite.height = 32;
    {
      const s = sprite.getContext('2d')!;
      const g = s.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(235, 245, 255, 0.95)');
      g.addColorStop(0.35, 'rgba(160, 205, 255, 0.55)');
      g.addColorStop(1, 'rgba(120, 170, 255, 0)');
      s.fillStyle = g;
      s.fillRect(0, 0, 32, 32);
    }

    /* faint 3D tilt (barrel distortion + slight vertical convergence) */
    const map = (x: number, y: number): [number, number] => {
      const nx = (x - W / 2) / (W / 2);
      const ny = (y - H / 2) / (H / 2);
      const r2 = nx * nx + ny * ny;
      const k = 1 + 0.1 * r2; // barrel
      const tilt = 1 - 0.08 * (ny * 0.5 + 0.5); // faint top-down convergence
      return [W / 2 + nx * (W / 2) * k, H / 2 + ny * (H / 2) * k * tilt];
    };

    const polyline = (pts: number[][]) => {
      if (!grid) return;
      const g = grid.getContext('2d')!;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
    };

    const build = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);

      grid = document.createElement('canvas');
      grid.width = canvas.width;
      grid.height = canvas.height;
      const g = grid.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(224, 228, 236, 0.045)';
      g.lineWidth = 1;

      lines = [];
      nodeX = [];
      nodeY = [];

      const step = 8; // sampling density along each line
      for (let x = 0; x <= W; x += CELL) {
        const pts: number[][] = [];
        for (let y = 0; y <= H; y += step) pts.push(map(x, y));
        lines.push(pts);
        polyline(pts);
      }
      for (let y = 0; y <= H; y += CELL) {
        const pts: number[][] = [];
        for (let x = 0; x <= W; x += step) pts.push(map(x, y));
        lines.push(pts);
        polyline(pts);
      }
      for (let y = 0; y <= H; y += CELL) {
        for (let x = 0; x <= W; x += CELL) {
          const [mx, my] = map(x, y);
          nodeX.push(mx);
          nodeY.push(my);
        }
      }
      hitAt = new Array(nodeX.length).fill(-1e9);
      hitAmp = new Array(nodeX.length).fill(0);
    };

    const drawNodes = (tSec: number) => {
      const c = canvas.getContext('2d')!;
      for (let i = 0; i < nodeX.length; i++) {
        const age = tSec - hitAt[i];
        if (age < 3.2) {
          const amp = hitAmp[i] * Math.exp(-age / DECAY);
          if (amp > 0.03) {
            c.globalAlpha = Math.min(0.85, 0.05 + amp);
            c.drawImage(sprite, nodeX[i] - 5, nodeY[i] - 5, 10, 10);
          }
        }
      }
      c.globalAlpha = 1;
    };

    const drawSweep = (tSec: number) => {
      if (!grid) return;
      const c = canvas.getContext('2d')!;
      const period = spinRef.current ? SWEEP_SPIN : SWEEP_IDLE;
      const trail = H * 0.4;
      const y = ((tSec % period) / period) * (H + trail * 2) - trail;

      /* phosphor contact: nodes inside the light cone record their hit */
      const cone = 92;
      for (let i = 0; i < nodeX.length; i++) {
        const d = Math.abs(nodeY[i] - y);
        if (d < cone) {
          const env = Math.exp(-(d * d) / (2 * cone * cone * 0.32));
          if (tSec - hitAt[i] > 0.4 && env > hitAmp[i]) {
            hitAt[i] = tSec;
            hitAmp[i] = env;
          }
        }
      }

      /* chromatic aberration exclusively inside the lighted cone */
      c.save();
      c.beginPath();
      c.rect(0, y - cone, W, cone * 2);
      c.clip();
      c.globalCompositeOperation = 'lighter';
      for (const line of lines) {
        const midY = (line[0][1] + line[line.length - 1][1]) / 2;
        if (Math.abs(midY - y) > cone * 2) continue;
        c.globalAlpha = 0.1 * coneEnv(y, midY, cone);
        c.strokeStyle = '#ff4a63';
        c.lineWidth = 1;
        drawPath(c, line, -1.4, 0);
        c.strokeStyle = '#4a8dff';
        drawPath(c, line, 1.4, 0);
        c.strokeStyle = '#5ff0d8';
        drawPath(c, line, 0, -0.6);
      }
      c.restore();

      /* feathered scanline core */
      const core = c.createLinearGradient(0, y - 46, 0, y + 46);
      core.addColorStop(0, 'rgba(150, 200, 255, 0)');
      core.addColorStop(0.42, 'rgba(150, 200, 255, 0.1)');
      core.addColorStop(0.5, 'rgba(225, 240, 255, 0.55)');
      core.addColorStop(0.58, 'rgba(150, 200, 255, 0.1)');
      core.addColorStop(1, 'rgba(150, 200, 255, 0)');
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = core;
      c.fillRect(0, y - 46, W, 92);
      c.fillStyle = 'rgba(240, 248, 255, 0.85)';
      c.fillRect(0, y - 0.7, W, 1.4);
      c.restore();

      drawNodes(tSec);
    };

    const render = (t: number) => {
      if (reduce) return; // static frame drawn once below
      raf = requestAnimationFrame(render);
      if (!visible) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw !== W || ch !== H || !grid) build();
      if (!grid) return;
      const c = canvas.getContext('2d')!;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.drawImage(grid, 0, 0, W, H);
      drawSweep(t / 1000);
    };

    build();
    if (reduce) {
      const c = canvas.getContext('2d')!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.drawImage(grid!, 0, 0, W, H);
      for (let i = 0; i < nodeX.length; i++) {
        c.globalAlpha = 0.07;
        c.drawImage(sprite, nodeX[i] - 5, nodeY[i] - 5, 10, 10);
      }
      c.globalAlpha = 1;
    } else {
      raf = requestAnimationFrame(render);
    }

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting;
            },
            { threshold: 0 },
          )
        : null;
    io?.observe(canvas);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!reduce) build();
          })
        : null;
    ro?.observe(canvas);
    const onVis = () => {
      if (document.hidden) visible = false;
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className="npx__radar" aria-hidden="true" />;
}

function coneEnv(y: number, yy: number, cone: number) {
  const d = Math.abs(y - yy);
  return Math.exp(-(d * d) / (2 * cone * cone * 0.42));
}

function drawPath(
  c: CanvasRenderingContext2D,
  line: number[][],
  ox: number,
  oy: number,
) {
  c.beginPath();
  c.moveTo(line[0][0] + ox, line[0][1] + oy);
  for (let i = 1; i < line.length; i++) c.lineTo(line[i][0] + ox, line[i][1] + oy);
  c.stroke();
}
