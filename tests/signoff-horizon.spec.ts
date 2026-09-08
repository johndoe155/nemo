import { test, expect, type Page } from '@playwright/test';
import type { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { gsap } from 'gsap';
import type { BlackHoleStageStatus } from '../src/lib/singularityGate';

declare global {
  interface Window {
    horizonFixture: {
      setStatus(status: BlackHoleStageStatus): void;
      setMounted(mounted: boolean): void;
      ScrollTrigger: typeof ScrollTrigger;
      gsap: typeof gsap;
    };
    horizonStats: {
      captures: number;
      webgpu: number;
      contexts: WebGL2RenderingContext[];
      uploads: number;
      deletes: number;
    };
    finishHorizonCapture?: () => void;
    lateSnapshot?: HTMLCanvasElement;
    horizonClicks: number;
  }
}

const fixture = '/tests/fixtures/signoff-horizon.html';
const root = '.footer.signoff';
const overlay = '.signoff-horizon__canvas';
const hole = '.bh-frame';
const invite = '[data-horizon-item="invite"]';
const cta = '[data-horizon-item="cta"]';
const FLYERS = [invite, cta] as const;

/** The two pins and the arm line. The black hole's pin is the anchor of the
 * whole sequence; the sheet's pin is the last leg of that same hold, and it owns
 * the scrub. */
const HOLE_PIN = 'signoff-horizon-hole';
const SHEET_PIN = 'signoff-horizon';
const ARM = 'signoff-horizon-arm';

async function open(page: Page, query = '') {
  await page.goto(fixture + query);
  await page.waitForFunction(() => Boolean(window.horizonFixture));
  await page.evaluate(() => document.fonts.ready);
}

/** Jump the scrub to `progress` and wait for the playhead to settle on it. */
async function scrollProgress(page: Page, progress: number) {
  await page.waitForFunction(() => Boolean(window.horizonFixture.ScrollTrigger.getById('signoff-horizon')));
  const jump = () => page.evaluate((p) => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * p, behavior: 'instant' });
  }, progress);
  await jump();
  // One instant programmatic fling can leave the scrub tween a re-target
  // short (velocity-spike prediction races the jump). A second jump,
  // measured fresh once things settle, arrives near-stationary and lands
  // the playhead exactly where the assert below demands.
  await page.waitForTimeout(400);
  await jump();
  await expect(page.locator(root)).toHaveAttribute('data-horizon-state', 'ready');
  await expect.poll(() => page.locator(root).getAttribute('data-horizon-progress'))
    .toBe(progress.toFixed(4));
}

/** Everything the layout assertions need, read in one task so the numbers agree. */
const readScene = (page: Page) => page.evaluate(() => {
  const sheet = document.querySelector<HTMLElement>('.footer.signoff')!;
  const frame = document.querySelector<HTMLElement>('.bh-frame')!;
  const stage = document.querySelector<HTMLElement>('.curtain-stage')!;
  const floor = document.querySelector<HTMLElement>('.curtain-footer')!;
  const styles = getComputedStyle(document.documentElement);
  const sheetBox = sheet.getBoundingClientRect();
  const frameBox = frame.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  const byId = (id: string) => window.horizonFixture.ScrollTrigger.getById(id);
  const spacerOf = (id: string) => {
    const trigger = byId(id) as unknown as { spacer?: HTMLElement } | undefined;
    const spacer = trigger?.spacer ?? null;
    return spacer
      ? {
          height: spacer.getBoundingClientRect().height,
          padding: parseFloat(getComputedStyle(spacer).paddingBottom) || 0,
          margin: parseFloat(getComputedStyle(spacer).marginBottom) || 0,
        }
      : null;
  };
  const holeTrigger = byId('signoff-horizon-hole');
  const sheetTrigger = byId('signoff-horizon');
  const inviteEl = document.querySelector('[data-horizon-item="invite"]');
  return {
    viewport: window.innerHeight,
    scrollY: window.scrollY,
    docHeight: document.documentElement.scrollHeight,
    seam: parseFloat(getComputedStyle(frame, '::after').height),
    travel: parseFloat(styles.getPropertyValue('--curtain-travel')) || 0,
    tail: floor.getBoundingClientRect().height,
    sheet: {
      top: sheetBox.top,
      bottom: sheetBox.bottom,
      height: sheetBox.height,
      position: getComputedStyle(sheet).position,
      paddingTop: parseFloat(getComputedStyle(sheet).paddingTop) || 0,
    },
    frame: {
      top: frameBox.top,
      bottom: frameBox.bottom,
      height: frameBox.height,
      centre: { x: frameBox.left + frameBox.width / 2, y: frameBox.top + frameBox.height / 2 },
    },
    stageTop: stageBox.top,
    spacers: { hole: spacerOf('signoff-horizon-hole'), sheet: spacerOf('signoff-horizon') },
    pins: {
      hole: holeTrigger
        ? { start: holeTrigger.start, end: holeTrigger.end, active: holeTrigger.isActive }
        : null,
      sheet: sheetTrigger
        ? {
            start: sheetTrigger.start,
            end: sheetTrigger.end,
            active: sheetTrigger.isActive,
            progress: sheetTrigger.progress,
          }
        : null,
      arm: byId('signoff-horizon-arm') ? { start: byId('signoff-horizon-arm')!.start } : null,
      pinIsFrame: holeTrigger?.pin === frame,
      pinIsSheet: sheetTrigger?.pin === sheet,
      // Both pins are driven by the headline's bottom edge: one screen line, one
      // composition, no handover to time between them.
      triggerIsInvite: holeTrigger?.trigger === inviteEl && sheetTrigger?.trigger === inviteEl,
    },
    flyers: (['[data-horizon-item="invite"]', '[data-horizon-item="cta"]'] as const).map((selector) => {
      const el = document.querySelector<HTMLElement>(selector)!;
      const box = el.getBoundingClientRect();
      return {
        selector,
        top: box.top,
        bottom: box.bottom,
        centre: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
        width: box.width,
        height: box.height,
        opacity: parseFloat(getComputedStyle(el).opacity),
        transform: getComputedStyle(el).transform,
        pointerEvents: getComputedStyle(el).pointerEvents,
      };
    }),
  };
});

type Scene = Awaited<ReturnType<typeof readScene>>;

/** The sheet's hem → the end of the document, on screen. Requirement 4 is the
 * claim that this number does not move while the sheet is being eaten. */
const hemToDocumentEnd = (scene: Scene): number => scene.docHeight - scene.scrollY - scene.sheet.bottom;

/** Where the curtain's paint window opens, relative to the sheet's hem. The
 * stage clips itself inset by --curtain-travel, so the bright floor becomes
 * visible exactly one pad pixel below the hem. */
const hemToCurtainWindow = (scene: Scene): number => scene.stageTop + scene.travel - scene.sheet.bottom;

/** Chrome serialises a used `translate3d(...)` as either `matrix()` or
 * `matrix3d()` depending on layer promotion, so read both. Returns the 2D part
 * in CSS order: x' = a·x + c·y + e, y' = b·x + d·y + f. */
function parseMatrix(css: string): [number, number, number, number, number, number] | null {
  const flat = /^matrix\(([-\d.e]+), ([-\d.e]+), ([-\d.e]+), ([-\d.e]+), ([-\d.e]+), ([-\d.e]+)\)$/.exec(css);
  if (flat) return flat.slice(1).map(Number) as [number, number, number, number, number, number];
  const deep = /^matrix3d\(([-\d.e, ]+)\)$/.exec(css);
  if (deep) {
    const m = deep[1].split(', ').map(Number);
    return [m[0], m[1], m[4], m[5], m[12], m[13]];
  }
  return css === 'none' ? [1, 0, 0, 1, 0, 0] : null;
}

async function expectPlain(page: Page) {
  await expect(page.locator(overlay)).toHaveCount(0);
  await expect(page.locator(root)).not.toHaveAttribute('data-horizon-paint');
  for (const selector of FLYERS) {
    await expect(page.locator(selector)).toHaveCSS('opacity', '1');
    await expect(page.locator(selector)).toHaveCSS('pointer-events', 'auto');
  }
  // Killed pins must also revert: both spacers are gone and the black hole's
  // frame and the footer are ordinary in-flow children again.
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  expect(await page.evaluate(() => window.horizonFixture.ScrollTrigger.getAll()
    .filter((trigger) => String(trigger.vars.id).startsWith('signoff-horizon')).length)).toBe(0);
}

// Instrument the browser APIs, not production hooks. A capture means exactly
// one html2canvas clone iframe; upload/context/deletion counts belong only to
// the overlay. The rig runs under React.StrictMode like the real application.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.horizonStats = { captures: 0, webgpu: 0, contexts: [], uploads: 0, deletes: 0 };
    const append = Node.prototype.appendChild;
    Node.prototype.appendChild = function <T extends Node>(child: T): T {
      if (child instanceof HTMLIFrameElement && child.classList.contains('html2canvas-container')) {
        window.horizonStats.captures++;
      }
      return append.call(this, child) as T;
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, options?: object) {
      if (kind === 'webgpu') window.horizonStats.webgpu++;
      const context = getContext.call(this, kind as 'webgl2', options);
      if (kind === 'webgl2' && this.classList.contains('signoff-horizon__canvas') && context &&
          !window.horizonStats.contexts.includes(context as WebGL2RenderingContext)) {
        window.horizonStats.contexts.push(context as WebGL2RenderingContext);
      }
      return context;
    } as typeof getContext;
    const upload = WebGL2RenderingContext.prototype.texImage2D;
    WebGL2RenderingContext.prototype.texImage2D = function (...args: Parameters<typeof upload>) {
      if ((this.canvas as HTMLCanvasElement).classList.contains('signoff-horizon__canvas')) {
        window.horizonStats.uploads++;
      }
      return upload.apply(this, args);
    };
    const remove = WebGL2RenderingContext.prototype.deleteTexture;
    WebGL2RenderingContext.prototype.deleteTexture = function (texture) {
      if ((this.canvas as HTMLCanvasElement).classList.contains('signoff-horizon__canvas')) {
        window.horizonStats.deletes++;
      }
      return remove.call(this, texture);
    };
  });
});

/* ==========================================================================
   Gates: everything that must NOT get a black hole.
   ======================================================================== */

for (const width of [375, 768]) {
  test(`no section, capture, scrub or overlay context at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await page.locator(root).scrollIntoViewIfNeeded();
    await expect(page.locator('#singularity')).toHaveCount(0);
    await expectPlain(page);
    expect(await page.evaluate(() => ({ captures: window.horizonStats.captures, contexts: window.horizonStats.contexts.length })))
      .toEqual({ captures: 0, contexts: 0 });
  });
}

test('reduced motion is a plain footer, without even loading the capture module', async ({ page }) => {
  const captureRequests: string[] = [];
  page.on('request', (request) => { if (/captureSignoff|html2canvas/.test(request.url())) captureRequests.push(request.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.locator(root).scrollIntoViewIfNeeded();
  await expectPlain(page);
  expect(captureRequests).toEqual([]);
  expect(await page.evaluate(() => window.horizonStats.captures)).toBe(0);
});

for (const status of ['booting', 'unsupported', 'error']) {
  test(`stage status ${status} never arms the footer`, async ({ page }) => {
    await open(page, `?status=${status}`);
    await page.locator(root).scrollIntoViewIfNeeded();
    await expectPlain(page);
    expect(await page.evaluate(() => window.horizonStats.captures)).toBe(0);
  });
}

/* ==========================================================================
   Requirement 1 — the black hole is the pinned subject.
   ======================================================================== */

test('the pin belongs to the black hole: the reference framing, held through the whole consumption', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => Boolean(window.horizonFixture.ScrollTrigger.getById('signoff-horizon-hole')));

  // The hold begins on the REFERENCE FRAMING: the first scroll position where
  // the viewport has the black hole AND the whole "ENTER THE NEMOVERSE"
  // headline in it at once. Jump to the hole trigger's own start line.
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon-hole')!;
    window.scrollTo({ top: trigger.start, behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  const atStart = await readScene(page);
  const air = await page.evaluate(async () => {
    const field = await import('/src/lib/spaghettification.ts');
    return field.titleAir(window.innerHeight);
  });
  const inviteBox = atStart.flyers.find((f) => f.selector === invite)!;
  const ctaBox = atStart.flyers.find((f) => f.selector === cta)!;

  // Requirement 1: the black hole — not the text, not the button — is the
  // pinned subject, and both pins are driven by the headline's bottom edge.
  expect(atStart.pins.pinIsFrame).toBe(true);
  expect(atStart.pins.pinIsSheet).toBe(true);
  expect(atStart.pins.triggerIsInvite).toBe(true);
  expect(atStart.pins.hole!.active).toBe(true);
  expect(atStart.frame.height).toBeGreaterThan(0);

  // The composition on screen at the trigger: the headline's bottom edge `air`
  // px above the fold and its top edge on screen (the WHOLE headline, which is
  // what the framing is specified on); the CTA still below the fold; the hole
  // above the headline with the seam gradient — not the sheet — between them.
  expect(Math.abs(inviteBox.bottom - (atStart.viewport - air))).toBeLessThan(1.5);
  expect(inviteBox.top).toBeGreaterThanOrEqual(-0.5);
  expect(inviteBox.height).toBeGreaterThan(0);
  // The CTA's own top margin is 2.6rem and `air` is capped at 42px, so the
  // button's top edge lands on the fold, never above it.
  expect(ctaBox.top).toBeGreaterThanOrEqual(atStart.viewport - 2);
  expect(atStart.sheet.bottom).toBeGreaterThan(atStart.viewport);
  expect(atStart.frame.bottom).toBeLessThanOrEqual(inviteBox.top);
  expect(atStart.frame.bottom).toBeGreaterThan(0);
  // The warp has not begun: this is the frame the reader is meant to see.
  await expect(page.locator(root)).toHaveAttribute('data-horizon-progress', '0.0000');

  // Both pins engage on that one line and let go on one scroll pixel, so the
  // hold is continuous: no gap, no double-pin, no handover to time.
  expect(atStart.pins.sheet!.active).toBe(true);
  expect(Math.abs(atStart.pins.sheet!.start - atStart.pins.hole!.start)).toBeLessThan(0.5);
  expect(Math.abs(atStart.pins.sheet!.end - atStart.pins.hole!.end)).toBeLessThan(0.5);
  expect(atStart.pins.arm!.start).toBeLessThan(atStart.pins.hole!.start);

  // Requirements 2 and 3: the hole does not move by one pixel for the whole
  // fall, while the scroll does — and the sheet holds the screen with it, so
  // the only thing that changes is the warp.
  const frameTops: number[] = [atStart.frame.top];
  const frameBottoms: number[] = [atStart.frame.bottom];
  const sheetTops: number[] = [atStart.sheet.top];
  const scrolls: number[] = [atStart.scrollY];
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    await scrollProgress(page, progress);
    const scene = await readScene(page);
    frameTops.push(scene.frame.top);
    frameBottoms.push(scene.frame.bottom);
    sheetTops.push(scene.sheet.top);
    scrolls.push(scene.scrollY);
    expect(scene.pins.hole!.active).toBe(true);
    expect(scene.pins.sheet!.active).toBe(true);
    // The singularity the invitation falls into is the parked hole's centre,
    // above the sheet: the pull is upward, into the hole, for the whole fall.
    expect(scene.frame.centre.y).toBeLessThan(scene.sheet.top);
  }
  const run = atStart.pins.sheet!.end - atStart.pins.sheet!.start;
  expect(scrolls.at(-1)! - scrolls[0]).toBeCloseTo(run, 0);
  for (const top of frameTops) expect(Math.abs(top - frameTops[0])).toBeLessThan(1.5);
  for (const bottom of frameBottoms) expect(Math.abs(bottom - frameBottoms[0])).toBeLessThan(1.5);
  for (const top of sheetTops) expect(Math.abs(top - sheetTops[0])).toBeLessThan(1.5);

  // Only when the consumption is complete do BOTH pins let go, and the reader
  // can scroll on into the curtain footer.
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    window.scrollTo({ top: trigger.end + 240, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.querySelector('.footer.signoff')!).position)).not.toBe('fixed');
  const released = await readScene(page);
  expect(released.pins.hole!.active).toBe(false);
  expect(released.pins.sheet!.active).toBe(false);
  expect(released.scrollY).toBeGreaterThan(scrolls.at(-1)!);
});

test('the pin lets go where it was holding: no jump at the release', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 1);
  const held = await readScene(page);
  expect(held.pins.hole!.active).toBe(true);
  const parkedTop = held.frame.top;

  // pinSpacing reserves the pin distance below the frame, and GSAP pushes the
  // released frame down into that reservation by exactly the same distance, so
  // the hole's flow position at the release IS the position it was parked at.
  // Crossing the end has to read as ordinary scrolling — one pixel of motion per
  // pixel of scroll — and not as a teleport of the whole pin distance.
  const jump = await page.evaluate(async () => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon-hole')!;
    const frame = document.querySelector<HTMLElement>('.bh-frame')!;
    const read = () => ({ top: frame.getBoundingClientRect().top, scroll: window.scrollY });
    window.scrollTo({ top: trigger.end - 1, behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = read();
    window.scrollTo({ top: trigger.end + 60, behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const after = read();
    return {
      scrolled: after.scroll - before.scroll,
      moved: before.top - after.top,
      active: trigger.isActive,
    };
  });
  expect(jump.active).toBe(false);
  expect(Math.abs(jump.scrolled - 61)).toBeLessThan(2);
  expect(Math.abs(jump.moved - jump.scrolled)).toBeLessThan(3);
  // And it left from where the hold put it: high on screen, above the sheet.
  expect(parkedTop).toBeLessThan(held.sheet.top);
});

test('one snapshot/texture; reversible scrub; geometric full consumption', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.horizonStats.captures)).toBe(0);
  await scrollProgress(page, 0);
  const rest = await readScene(page);
  // pinSpacing parks the pin distance in the spacer, and the sheet's own
  // negative margin is copied onto it, so the curtain never shifts on engage.
  expect(rest.spacers.hole).not.toBeNull();
  expect(rest.spacers.sheet).not.toBeNull();
  expect(Math.abs(rest.spacers.sheet!.margin + rest.travel)).toBeLessThan(1.5);
  expect(Math.abs(rest.spacers.hole!.margin)).toBeLessThan(1.5);
  expect(rest.spacers.hole!.height - rest.frame.height)
    .toBeCloseTo(rest.pins.hole!.end - rest.pins.hole!.start, 0);
  for (const selector of FLYERS) {
    const flyer = rest.flyers.find((f) => f.selector === selector)!;
    expect(flyer.opacity).toBe(1);
    // The field is the identity at rest: the effect has written a transform, and
    // that transform must be exactly no-op, or the handoff to the pinned scene
    // would move the type.
    expect(parseMatrix(flyer.transform)).toEqual([1, 0, 0, 1, 0, 0]);
  }

  // The overlay covers the sheet plus the measured veil of headroom above it,
  // strand pulled past the sheet's top edge is not clipped mid-fall.
  const canvasBox = await page.locator(overlay).boundingBox();
  const sheetBox = await page.locator(root).boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(sheetBox).not.toBeNull();
  const veil = sheetBox!.y - canvasBox!.y;
  expect(veil).toBeGreaterThan(0);
  expect(Math.abs(canvasBox!.width - sheetBox!.width)).toBeLessThan(1);
  expect(Math.abs(canvasBox!.height - (sheetBox!.height + veil))).toBeLessThan(1);
  await expect(page.locator(overlay)).toHaveCSS('pointer-events', 'none');

  await scrollProgress(page, 0.5);
  const mid = await readScene(page);
  // The live paint has been exchanged for the frozen frame by now.
  for (const flyer of mid.flyers) expect(flyer.opacity).toBe(0);
  expect(mid.sheet.height).toBeLessThan(rest.sheet.height);
  expect(mid.sheet.height).toBeGreaterThan(0);

  const pixels = () => page.evaluate(() => {
    // A preserveDrawingBuffer:false canvas must be read in the SAME task as
    // draw. Force a reversible tiny playhead change then restore it.
    const animation = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!.animation!;
    const p = animation.progress();
    animation.progress(p === 1 ? p - 0.001 : p + 0.001);
    animation.progress(p);
    const canvas = document.querySelector<HTMLCanvasElement>('.signoff-horizon__canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let hash = 0, painted = 0;
    for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data[i]) | 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) painted++;
    return { hash, painted };
  });
  const middle = await pixels();
  expect(middle.painted).toBeGreaterThan(1000);
  await scrollProgress(page, 1);
  // Full consumption is geometric: the horizon has swallowed every texel, so
  // nothing is painted — not an opacity fade over an unwarped image.
  expect((await pixels()).painted).toBe(0);
  await scrollProgress(page, 0.5);
  expect(await pixels()).toEqual(middle);
  await scrollProgress(page, 0);
  for (const selector of FLYERS) await expect(page.locator(selector)).toHaveCSS('opacity', '1');
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    window.scrollTo({ top: trigger.end + 600, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.querySelector('.signoff')!).position)).not.toBe('fixed');
  expect(await page.evaluate(() => ({
    captures: window.horizonStats.captures,
    uploads: window.horizonStats.uploads,
    contexts: window.horizonStats.contexts.length,
    webgpu: window.horizonStats.webgpu,
  }))).toEqual({ captures: 1, uploads: 1, contexts: 1, webgpu: 0 });
  await expect(page.locator('.html2canvas-container')).toHaveCount(0);
});

/* ==========================================================================
   Requirements 2 and 3 — spaghettification, and translation into the point.
   ======================================================================== */

test('the DOM warp is the same field the shader integrates, per flyer', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0);
  const rest = await readScene(page);
  const singularity = rest.frame.centre;
  const canvasBox = await page.locator(overlay).boundingBox();
  const sheetBox = await page.locator(root).boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(sheetBox).not.toBeNull();
  const veil = sheetBox!.y - canvasBox!.y;
  expect(veil).toBeGreaterThan(0);

  for (const progress of [0.15, 0.4, 0.65, 0.85]) {
    await scrollProgress(page, progress);
    const scene = await readScene(page);
    const expected = await page.evaluate(
      async ({ p, point, rests, veil: margin }) => {
        const field = await import('/src/lib/spaghettification.ts');
        const sheet = document.querySelector<HTMLElement>('.footer.signoff')!;
        const box = sheet.getBoundingClientRect();
        const extent = {
          width: box.width,
          height: box.height,
          anchorX: point.x - box.left,
          anchorY: point.y - box.top,
          veil: margin,
          seam: 0,
        };
        const radius = field.horizonRadiusAtProgress(p, extent);
        return rests.map((body: { selector: string; x: number; y: number }) => {
          const frame = field.flyerFrameAt(p, { x: body.x, y: body.y }, point, radius);
          return { selector: body.selector, radius, ...frame };
        });
      },
      {
        p: progress,
        point: singularity,
        veil,
        rests: rest.flyers.map((flyer) => ({
          selector: flyer.selector,
          x: flyer.centre.x,
          y: flyer.centre.y,
        })),
      },
    );

    for (const want of expected) {
      const flyer = scene.flyers.find((f) => f.selector === want.selector)!;
      const at = rest.flyers.find((f) => f.selector === want.selector)!;
      const pull = { x: singularity.x - at.centre.x, y: singularity.y - at.centre.y };
      const pullLength = Math.hypot(pull.x, pull.y);

      // Requirement 3: it travels toward the singularity, it does not bloat in
      // place. The displacement is the field's own fall fraction of the pull.
      const moved = { x: flyer.centre.x - at.centre.x, y: flyer.centre.y - at.centre.y };
      expect(Math.abs(moved.x - want.x)).toBeLessThan(0.75);
      expect(Math.abs(moved.y - want.y)).toBeLessThan(0.75);
      expect(moved.x * pull.x + moved.y * pull.y).toBeGreaterThan(0);
      expect(Math.hypot(singularity.x - flyer.centre.x, singularity.y - flyer.centre.y))
        .toBeLessThan(pullLength);

      // Requirement 2: the box is warped, not uniformly scaled. rotate·scale·
      // rotate⁻¹ is symmetric (no shear), its eigenvalues are `along`/`across`,
      // and the stretched eigenvector points at the singularity.
      const matrix = parseMatrix(flyer.transform);
      expect(matrix, `${want.selector}: unexpected transform ${flyer.transform}`).not.toBeNull();
      const [a, b, c, d, e, f] = matrix!;
      expect(Math.abs(b - c)).toBeLessThan(1e-4);
      expect(Math.abs(e - want.x)).toBeLessThan(0.75);
      expect(Math.abs(f - want.y)).toBeLessThan(0.75);
      const mean = (a + d) / 2;
      const root = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + b * c));
      const major = mean + root;
      const minor = mean - root;
      expect(Math.abs(major - want.along)).toBeLessThan(2e-3);
      expect(Math.abs(minor - want.across)).toBeLessThan(2e-3);
      expect(major).toBeGreaterThan(minor);
      // Eigenvector of the major eigenvalue: the pull axis, up to frame dragging.
      const axis = Math.abs(c) > 1e-6
        ? { x: c, y: major - a }
        : { x: a >= d ? 1 : 0, y: a >= d ? 0 : 1 };
      const length = Math.hypot(axis.x, axis.y);
      const cosine = (axis.x * pull.x + axis.y * pull.y) / (length * pullLength);
      expect(Math.abs(cosine)).toBeGreaterThan(0.2); // the swirl may rotate it
      expect(Math.abs(Math.abs(cosine))).toBeLessThanOrEqual(1 + 1e-9);
    }
  }

  // At the end of the fall every flyer has contracted into the point: a small
  // fraction of its rest distance from the singularity, and of its rest size.
  await scrollProgress(page, 1);
  const end = await readScene(page);
  for (const index of [0, 1]) {
    const flyer = end.flyers[index];
    const at = rest.flyers[index];
    const restRadius = Math.hypot(singularity.x - at.centre.x, singularity.y - at.centre.y);
    const left = Math.hypot(singularity.x - flyer.centre.x, singularity.y - flyer.centre.y);
    expect(left).toBeLessThan(restRadius * 0.12);
    expect(flyer.width).toBeLessThan(at.width * 0.6);
    expect(flyer.height).toBeLessThan(at.height * 0.6);
    // Consumed: no invisible hit target left over the hole, but still focusable.
    expect(flyer.pointerEvents).toBe('none');
    expect(flyer.opacity).toBe(0);
  }
});

/* ==========================================================================
   Requirement 4 — the curtain pays for exactly what the void vacates.
   ======================================================================== */

test('the gap from the sheet hem to the end of the document never shrinks', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0);
  const rest = await readScene(page);
  const progressSamples = [0, 0.2, 0.45, 0.7, 0.9, 1];

  // The expected layout, straight out of the same pure functions the effect
  // uses, fed the scene as measured in this browser. The assertions below are
  // therefore a check that the DOM implements the closed form — not a second,
  // independently guessed set of numbers.
  // Where the hem parks, measured off the pinned sheet: the reference framing
  // leaves it BELOW the fold (the CTA still off-screen at the trigger), so this
  // is negative — and it is scroll the curtain gets to rise into for free.
  const hemInset = rest.viewport - rest.sheet.bottom;
  expect(hemInset).toBeLessThan(0);
  const model = await page.evaluate(async ({ heights, restHeight, tail, hemInset }) => {
    const field = await import('/src/lib/spaghettification.ts');
    const collapsible = field.collapsibleHeight(restHeight, tail, hemInset);
    return {
      collapsible,
      pad: field.SPACER_PAD,
      minSlack: field.MIN_RELEASE_SLACK,
      heights: heights.map((p: number) => field.sheetHeightAt(p, restHeight, collapsible)),
      slack: heights.map((p: number) =>
        field.SPACER_PAD + tail - hemInset - collapsible * field.collapseAt(p)),
    };
  }, { heights: progressSamples, restHeight: rest.sheet.height, tail: rest.tail, hemInset });

  const samples: Array<{
    hemToDocEnd: number;
    hemToWindow: number;
    sheetHeight: number;
    spacerHeight: number;
    spacerPadding: number;
    slack: number;
    run: number;
    scrollY: number;
    tail: number;
  }> = [];
  for (const progress of progressSamples) {
    await scrollProgress(page, progress);
    const scene = await readScene(page);
    samples.push({
      hemToDocEnd: hemToDocumentEnd(scene),
      hemToWindow: hemToCurtainWindow(scene),
      sheetHeight: scene.sheet.height,
      spacerHeight: scene.spacers.sheet!.height,
      spacerPadding: scene.spacers.sheet!.padding,
      slack: scene.docHeight - scene.scrollY - scene.viewport,
      run: scene.pins.sheet!.end - scene.pins.sheet!.start,
      scrollY: scene.scrollY,
      tail: scene.tail,
    });
  }

  const first = samples[0];
  const last = samples.at(-1)!;
  expect(first.tail).toBeGreaterThan(100);
  expect(model.collapsible).toBeGreaterThan(0);

  samples.forEach((sample, index) => {
    // THE invariant: the space between the bottom of the sign-off and the end of
    // the site is the same at every playhead, even though the sheet's own height
    // has been collapsing throughout. It is the curtain's own height plus the
    // one pixel of pad the compensation leaves.
    expect(Math.abs(sample.hemToDocEnd - first.hemToDocEnd)).toBeLessThan(2.5);
    expect(Math.abs(sample.hemToDocEnd - (first.tail + model.pad))).toBeLessThan(2.5);
    // The floor's paint window opens one pad pixel below the hem, so the reveal
    // is a seamless handoff rather than a jump of the whole page.
    expect(Math.abs(sample.hemToWindow - model.pad)).toBeLessThan(2.5);
    expect(Math.abs(sample.tail - first.tail)).toBeLessThan(0.5);
    // The sheet's live height is the closed form, and the reader is scrolling.
    expect(Math.abs(sample.sheetHeight - model.heights[index])).toBeLessThan(1.5);
    expect(sample.scrollY).toBeGreaterThanOrEqual(first.scrollY);
    // The document is never short: the release cannot land on a clamped page.
    expect(Math.abs(sample.slack - model.slack[index])).toBeLessThan(2.5);
    expect(sample.slack).toBeGreaterThanOrEqual(model.minSlack - 1);
  });

  // The spacer is where the height goes: it grows by the pin distance minus
  // exactly what the sheet gave up, and its padding ends as the parked pin
  // distance, so the clip window lands one pad pixel below the hem either way.
  const consumed = first.sheetHeight - last.sheetHeight;
  expect(Math.abs(consumed - model.collapsible)).toBeLessThan(1.5);
  expect(Math.abs(last.spacerHeight - first.spacerHeight - (last.run - consumed))).toBeLessThan(2.5);
  expect(Math.abs(last.spacerPadding - last.run)).toBeLessThan(2.5);
  expect(first.spacerPadding).toBeLessThan(2.5);

  // The release must not move the hem: the pin hands the sheet back to flow at
  // exactly the position it was holding, and the scroll continues from there.
  const atEnd = await readScene(page);
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    window.scrollTo({ top: trigger.end + 200, behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  const pastEnd = await readScene(page);
  expect(pastEnd.sheet.position).not.toBe('fixed');
  const scrolled = pastEnd.scrollY - atEnd.scrollY;
  expect(scrolled).toBeGreaterThan(150);
  expect(Math.abs(atEnd.sheet.bottom - scrolled - pastEnd.sheet.bottom)).toBeLessThan(2.5);
  expect(pastEnd.docHeight - pastEnd.scrollY - pastEnd.viewport).toBeGreaterThan(0);
  // The curtain floor is now on screen: the reveal the compensation paid for.
  await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  });
  await page.waitForTimeout(200);
  const atFloor = await readScene(page);
  expect(atFloor.stageTop + atFloor.travel).toBeLessThan(atFloor.viewport);
  expect(atFloor.sheet.height).toBeLessThan(rest.sheet.height);
});

test('a short curtain caps the collapse instead of borrowing scroll', async ({ page }) => {
  // Shrink the curtain so the document cannot afford to lose the whole sheet.
  // The compensation must degrade the collapse, never the reader's scroll.
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = '.curtain-footer { min-height: 220px !important; height: 220px !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });
  await open(page);
  await scrollProgress(page, 0);
  const rest = await readScene(page);
  const first = hemToDocumentEnd(rest);
  await scrollProgress(page, 1);
  const end = await readScene(page);
  expect(end.tail).toBeLessThan(300);
  expect(Math.abs(hemToDocumentEnd(end) - first)).toBeLessThan(2.5);
  expect(Math.abs(hemToCurtainWindow(end) - 1)).toBeLessThan(2.5);
  // The sheet keeps a stub of exactly the unaffordable remainder: the allowance
  // was capped, the physics were not fudged.
  const capped = await page.evaluate(async ({ restHeight, tail, hemInset }) => {
    const field = await import('/src/lib/spaghettification.ts');
    const collapsible = field.collapsibleHeight(restHeight, tail, hemInset);
    return { collapsible, height: field.sheetHeightAt(1, restHeight, collapsible) };
  }, {
    restHeight: rest.sheet.height,
    tail: end.tail,
    hemInset: rest.viewport - rest.sheet.bottom,
  });
  expect(capped.collapsible).toBeLessThan(rest.sheet.height);
  expect(capped.collapsible).toBeGreaterThan(0);
  expect(Math.abs(end.sheet.height - capped.height)).toBeLessThan(1.5);
  expect(end.sheet.height).toBeGreaterThan(1);
  expect(end.docHeight - end.scrollY - end.viewport).toBeGreaterThan(8);
});

/* ==========================================================================
   Interaction and accessibility — the real link, at every playhead.
   ======================================================================== */

test('the SAME real CTA keeps its tab stop, name and click at 0/50/100%', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0.5);
  const link = page.locator('.signoff a');
  await page.evaluate(() => {
    // Revert BOTH pins so the interaction checks run on a static layout: with
    // the hole pinned the sheet sits mid-viewport and a Tab that scrolls would
    // move the playhead underneath the assertions. The playhead is then driven
    // by hand, which is the same reversible scrub the scroll drives.
    for (const id of ['signoff-horizon-hole', 'signoff-horizon']) {
      window.horizonFixture.ScrollTrigger.getById(id)!.disable(true);
    }
    const footer = document.querySelector('.signoff')!;
    window.scrollTo({ top: footer.getBoundingClientRect().top + scrollY - 120, behavior: 'instant' });
    window.horizonClicks = 0;
    footer.querySelector('a')!.addEventListener('click', (event) => {
      if (event.isTrusted) window.horizonClicks++;
      event.preventDefault(); // keep all three checks on this same native link
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  let clicks = 0;
  for (const progress of [0, 0.5, 1]) {
    await page.evaluate((p) => {
      (document.activeElement as HTMLElement | null)?.blur();
      const animation = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!.animation!;
      animation.pause().progress(p === 0 ? 0.001 : 0);
      animation.progress(p);
    }, progress);
    await expect(page.locator(root)).toHaveAttribute('data-horizon-progress', progress.toFixed(4));
    await expect(link).toHaveAttribute('href', '#nemoverse');
    await expect(link).toHaveAccessibleName('Explore the universes');
    // The link is never removed from the accessibility tree, at any playhead.
    const ax = await cdp.send('Accessibility.getFullAXTree');
    expect(ax.nodes.some((node) => !node.ignored && node.role?.value === 'link' &&
      node.name?.value === 'Explore the universes')).toBe(true);
    expect(await link.evaluate((el) => el.closest('[aria-hidden="true"], [inert], [hidden]'))).toBeNull();

    // Focus anywhere in the sheet is a rescue: the real paint, ring and pointer
    // come back in place and the frozen frame is suppressed — without touching
    // the playhead, the collapse or the curtain.
    const before = await readScene(page);
    await link.evaluate((el: HTMLAnchorElement) => el.focus({ preventScroll: true }));
    await expect(link).toBeFocused();
    for (const selector of FLYERS) {
      await expect(page.locator(selector)).toHaveCSS('opacity', '1');
      await expect(page.locator(selector)).toHaveCSS('pointer-events', 'auto');
      expect(parseMatrix(await page.locator(selector).evaluate(
        (el) => getComputedStyle(el).transform))).toEqual([1, 0, 0, 1, 0, 0]);
    }
    await expect(page.locator(overlay)).toHaveCSS('opacity', '0');
    await expect(link).toHaveCSS('outline-style', 'solid');
    const rescued = await readScene(page);
    expect(Math.abs(rescued.sheet.height - before.sheet.height)).toBeLessThan(0.5);
    expect(rescued.pins.sheet!.progress).toBe(before.pins.sheet!.progress);

    await link.click();
    await expect.poll(() => page.evaluate(() => window.horizonClicks)).toBe(++clicks);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.horizonClicks)).toBe(++clicks);

    // The tab stop is real in both directions, and the CTA is the only one the
    // effect ever touches.
    await page.locator('#nemoverse a').evaluate((el: HTMLAnchorElement) => el.focus({ preventScroll: true }));
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#nemoverse a')).toBeFocused();
  }

  // A consumed flyer must not leave an invisible click target over the hole, and
  // focus must put the pointer back.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    const animation = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!.animation!;
    animation.progress(1);
  });
  const stray = await page.locator(cta).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return el.contains(hit) || hit === el;
  });
  expect(stray).toBe(false);
  await link.evaluate((el: HTMLAnchorElement) => el.focus({ preventScroll: true }));
  const rescuedHit = await page.locator(cta).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return el.contains(hit) || hit === el;
  });
  expect(rescuedHit).toBe(true);
});

/* ==========================================================================
   Retirement, races and disposal.
   ======================================================================== */

test('status loss and unmount dispose contexts/textures/triggers; remount gets a fresh context', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0.5);
  await page.evaluate(() => window.horizonFixture.setStatus('error'));
  await expectPlain(page);
  expect(await page.evaluate(() => window.horizonStats.contexts[0].isContextLost())).toBe(true);
  expect(await page.evaluate(() => window.horizonStats.deletes)).toBe(1);
  await page.evaluate(() => window.horizonFixture.setStatus('live'));
  await scrollProgress(page, 0.5);
  expect(await page.evaluate(() => window.horizonStats.contexts.length)).toBe(2);
  await page.evaluate(() => window.horizonFixture.setMounted(false));
  await expect(page.locator(root)).toHaveCount(0);
  expect(await page.evaluate(() => window.horizonStats.contexts.every((context) => context.isContextLost()))).toBe(true);
  expect(await page.evaluate(() => window.horizonFixture.ScrollTrigger.getAll().length)).toBe(0);
  await page.evaluate(() => window.horizonFixture.setMounted(true));
  await scrollProgress(page, 0.5);
  expect(await page.evaluate(() => ({ captures: window.horizonStats.captures, contexts: window.horizonStats.contexts.length, lost: window.horizonStats.contexts.at(-1)!.isContextLost() })))
    .toEqual({ captures: 3, contexts: 3, lost: false });
});

for (const policy of ['mobile', 'reduce', 'resize']) {
  test(`an armed effect safely returns to real paint on ${policy}`, async ({ page }) => {
    await open(page);
    await scrollProgress(page, 0.5);
    if (policy === 'mobile') await page.setViewportSize({ width: 768, height: 900 });
    if (policy === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (policy === 'resize') await page.setViewportSize({ width: 1100, height: 900 });
    await expectPlain(page);
    expect(await page.evaluate(() => window.horizonStats.contexts[0].isContextLost())).toBe(true);
    expect(await page.evaluate(() => window.horizonStats.captures)).toBe(1); // no resize recapture
    // Both pins reverted: the black hole is back in flow too, and the curtain's
    // spacing is the ordinary one.
    expect(await page.evaluate(() => document.querySelectorAll('.pin-spacer').length)).toBe(0);
    const scene = await readScene(page);
    expect(scene.frame.top).toBeLessThan(scene.sheet.top);
    // The ordinary in-flow relationship is back: the document ends exactly one
    // curtain below the sheet's hem, with nothing parked and nothing consumed.
    expect(Math.abs(hemToDocumentEnd(scene) - scene.tail)).toBeLessThan(2.5);
    expect(scene.sheet.height).toBeGreaterThan(100);
  });
}

test('WebGL2 creation failure keeps native content and kills the scrub', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, options?: object) {
      if (kind === 'webgl2' && this.classList.contains('signoff-horizon__canvas')) return null;
      return get.call(this, kind as 'webgl2', options);
    } as typeof get;
  });
  await open(page);
  await page.locator(root).scrollIntoViewIfNeeded();
  await expect(page.locator(root)).toHaveAttribute('data-horizon-state', 'static');
  await expectPlain(page);
});

test('context loss retires the overlay instead of leaving an invisible CTA', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0.5);
  await page.evaluate(() => window.horizonStats.contexts[0].getExtension('WEBGL_lose_context')!.loseContext());
  await expectPlain(page);
  await expect(page.locator(root)).toHaveAttribute('data-horizon-state', 'static');
});

for (const cancel of ['unmount', 'reduce', 'status']) {
  test(`late capture after ${cancel} cannot attach a context or keep its CPU canvas`, async ({ page }) => {
    // html2canvas has no abort API. Deliberately resolve after cleanup to test
    // the same race as a slow font/image/renderer promise, without timing luck.
    await page.route(/\/src\/lib\/captureSignoff\.ts(?:\?|$)/, (route) => route.fulfill({
      contentType: 'text/javascript',
      body: `export async function captureSignoff() {
        window.horizonStats.captures++;
        return new Promise(resolve => { window.finishHorizonCapture = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 320;
          window.lateSnapshot = canvas; resolve(canvas);
        }; });
      }`,
    }));
    await open(page);
    await page.locator(root).scrollIntoViewIfNeeded();
    await page.waitForFunction(() => Boolean(window.finishHorizonCapture));
    if (cancel === 'unmount') await page.evaluate(() => window.horizonFixture.setMounted(false));
    if (cancel === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (cancel === 'status') await page.evaluate(() => window.horizonFixture.setStatus('error'));
    await expect.poll(() => page.evaluate(() => window.horizonFixture.ScrollTrigger.getAll().length)).toBe(0);
    await page.evaluate(() => window.finishHorizonCapture!());
    await expect.poll(() => page.evaluate(() => window.lateSnapshot?.width)).toBe(0);
    await expect(page.locator(overlay)).toHaveCount(0);
    expect(await page.evaluate(() => ({ captures: window.horizonStats.captures, contexts: window.horizonStats.contexts.length })))
      .toEqual({ captures: 1, contexts: 0 });
  });
}

test('actual BlackHoleStage reports its own live/fallback status to the gate', async ({ page }) => {
  test.setTimeout(90_000);
  // Actual backend / renderer / state machine, at a small test-only resolution.
  // Software GL must not spend the entire CI budget on the unrelated 3D scene.
  await page.route('**/tests/fixtures/signoff-horizon.html?real-stage', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('</head>',
      '<style>.bh-stage { height: 160px !important; max-width: 320px; margin-inline: auto; }</style></head>') });
  });
  await open(page, '?real-stage');
  await expect(page.locator('.bh-stage')).toHaveAttribute('data-status', 'live', { timeout: 60_000 });
  // Let the existing IntersectionObserver pause the scene above, not a mock.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(page.locator(root)).toHaveAttribute('data-horizon-state', 'ready', { timeout: 30_000 });
  await expect(page.locator(overlay)).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectPlain(page);
});

test('WebGL2 pixels agree with an independent CPU port of both shader stages', async ({ page }) => {
  await open(page, '?status=unsupported');
  const result = await page.evaluate(async () => {
    const {
      createEventHorizonWarp, horizonRadiusAtProgress, HORIZON_STEPS, CAPTURE_THRESHOLD,
    } = await import('/src/three/eventHorizonWarp.ts');
    const {
      infallAt, tidalAt, swirlAt,
    } = await import('/src/lib/spaghettification.ts');
    const { flatSimulationConfig: physics } = await import('/src/three/blackhole/blackhole.config.js');
    const source = document.createElement('canvas');
    source.width = 512; source.height = 320;
    const context = source.getContext('2d')!;
    const image = context.createImageData(source.width, source.height);
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      image.data[i] = Math.round(x / (source.width - 1) * 255);
      image.data[i + 1] = Math.round(y / (source.height - 1) * 255);
      image.data[i + 2] = 80;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);

    const TAU = Math.PI * 2;
    const rs = physics.blackHoleMass * 2;
    let maxError = 0, checks = 0, captureChecks = 0, escapeChecks = 0, tidalChecks = 0;

    // Float64 reference for BOTH stages: the tidal remap this effect owns, then
    // the vendored deflection ODE. The physical coefficients come from the
    // config and the field constants from lib/spaghettification.ts — never from
    // test literals.
    const port = (
      geometry: { width: number; height: number; anchorX: number; anchorY: number; seam: number; veil: number },
      x: number,
      y: number,
      p: number,
    ): [number, number] | null => {
      const R = horizonRadiusAtProgress(p, geometry);
      const anchor = { x: geometry.anchorX, y: geometry.anchorY + geometry.veil };
      let sx = x;
      let sy = y;
      if (R > 0) {
        const dx = x - anchor.x;
        const dy = y - anchor.y;
        const r = Math.hypot(dx, dy);
        if (r < R * CAPTURE_THRESHOLD) return null; // inside the horizon: void
        const tidal = tidalAt(r, R, p);
        if (tidal > 0) tidalChecks++;
        const drag = tidal * swirlAt(p) * TAU;
        const stretch = 1 + infallAt(p) + tidal;
        const stretchedX = dx * stretch;
        const stretchedY = dy * stretch;
        sx = anchor.x + stretchedX * Math.cos(drag) - stretchedY * Math.sin(drag);
        sy = anchor.y + stretchedX * Math.sin(drag) + stretchedY * Math.cos(drag);
      }
      // Identity path: the shader samples (pos − sheetOffset) / sheetSize.
      if (R <= 0) return [sx, sy - geometry.veil];
      const pixelsPerUnit = R / rs;
      let rx = (sx - anchor.x) / pixelsPerUnit;
      let ry = (sy - anchor.y) / pixelsPerUnit;
      let dx = 0, dy = -1, remaining = HORIZON_STEPS, captured = false;
      ry += physics.stepSize * HORIZON_STEPS; // the explicit orthographic launch
      for (let i = 0; i < HORIZON_STEPS; i++) {
        const r = Math.hypot(rx, ry);
        if (r * pixelsPerUnit < R * CAPTURE_THRESHOLD) { captured = true; break; }
        if (r > 100) { escapeChecks++; break; }
        const bend = rs / (r * r) * physics.stepSize * physics.gravitationalLensing;
        dx += (-rx / r) * bend;
        dy += (-ry / r) * bend;
        const length = Math.hypot(dx, dy);
        dx /= length; dy /= length;
        rx += dx * physics.stepSize; ry += dy * physics.stepSize;
        remaining--;
      }
      if (captured || Math.hypot(rx, ry) * pixelsPerUnit < R * CAPTURE_THRESHOLD) return null;
      rx += dx * physics.stepSize * remaining;
      ry += dy * physics.stepSize * remaining;
      const tx = anchor.x + rx * pixelsPerUnit;
      const ty = anchor.y + ry * pixelsPerUnit - geometry.veil;
      const u = tx / geometry.width;
      const v = ty / geometry.height;
      if (u < 0 || v < 0 || u > 1 || v > 1) return null;
      return [tx, ty];
    };

    const warp = createEventHorizonWarp(source, () => {});
    const gl = warp.canvas.getContext('webgl2')!;
    // Two overlay boxes: one flush with the sheet, one with a veil of headroom
    // it, so the snapshot's sub-rectangle offset is exercised too.
    for (const geometry of [
      { width: 512, height: 320, anchorX: 256, anchorY: 20, seam: 60, veil: 0 },
      { width: 512, height: 320, anchorX: 256, anchorY: 260, seam: 60, veil: 40 },
    ]) {
      for (const p of [0, 0.001, 0.25, 0.5, 0.75, 1]) {
        warp.draw(p, geometry);
        const width = warp.canvas.width;
        const height = warp.canvas.height;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        for (let y = 7; y < height; y += 23) for (let x = 5; x < width; x += 29) {
          const landed = port(geometry, x + 0.5, y + 0.5, p);
          const i = ((height - 1 - y) * width + x) * 4;
          const expected = landed ? [
            Math.max(0, Math.min(255, (landed[0] - 0.5) / (source.width - 1) * 255)),
            Math.max(0, Math.min(255, (landed[1] - 0.5) / (source.height - 1) * 255)),
            80, 255,
          ] : [0, 0, 0, 0];
          if (!landed) captureChecks++;
          for (let channel = 0; channel < 4; channel++) {
            maxError = Math.max(maxError, Math.abs(pixels[i + channel] - expected[channel]));
          }
          checks++;
        }
      }
    }
    warp.dispose();
    return { maxError, checks, captureChecks, escapeChecks, tidalChecks, lost: gl.isContextLost() };
  });
  expect(result.checks).toBeGreaterThan(1000);
  expect(result.captureChecks).toBeGreaterThan(100);
  expect(result.escapeChecks).toBeGreaterThan(0);
  expect(result.tidalChecks).toBeGreaterThan(100);
  expect(result.maxError).toBeLessThan(2); // interpolation/8-bit rounding only
  expect(result.lost).toBe(true);
});

for (const dpr of [1, 2]) test.describe(`snapshot fidelity at DPR ${dpr}`, () => {
  test.use({ deviceScaleFactor: dpr });
  test('unwarped snapshot retains the headline font/gradient and CTA paint', async ({ page }, testInfo) => {
    await open(page, '?status=unsupported');
    await page.evaluate(() => {
      const footer = document.querySelector<HTMLElement>('.signoff')!;
      // Freeze decorative clocks ONLY in the test so the comparison isn't
      // measuring a moving phase between two screenshots.
      window.horizonFixture.gsap.globalTimeline.pause();
      footer.getAnimations({ subtree: true }).forEach((animation) => animation.pause());
      Object.assign(footer.style, { position: 'fixed', top: '0', left: '0', width: `${innerWidth}px`, zIndex: '999', margin: '0' });
      // The credit crawl moved above the Singularity, so nothing in the
      // sign-off backdrop-filters the live page anymore: the frozen frame can
      // be compared to the live footer like-for-like with no omissions.
    });
    const original = await page.locator(root).screenshot();
    await page.evaluate(async () => {
      const { captureSignoff } = await import('/src/lib/captureSignoff.ts');
      const { createEventHorizonWarp } = await import('/src/three/eventHorizonWarp.ts');
      const footer = document.querySelector<HTMLElement>('.signoff')!;
      const snapshot = await captureSignoff(footer, new AbortController().signal);
      const warp = createEventHorizonWarp(snapshot, () => {});
      const box = footer.getBoundingClientRect();
      footer.appendChild(warp.canvas);
      warp.draw(0, { width: box.width, height: box.height, anchorX: box.width / 2, anchorY: 0, seam: 60, veil: 0 });
      footer.dataset.horizonPaint = 'snapshot';
      footer.style.setProperty('--horizon-mix', '1');
      snapshot.width = snapshot.height = 0;
    });
    const frozen = await page.locator(root).screenshot();
    const difference = await page.evaluate(async ([a, b]) => {
      const decode = async (base64: string) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + base64;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(img, 0, 0);
        return context.getImageData(0, 0, img.width, img.height).data;
      };
      const [live, snapshot] = await Promise.all([decode(a), decode(b)]);
      let error = 0, changed = 0;
      for (let i = 0; i < live.length; i += 4) {
        let pixelError = 0;
        for (let c = 0; c < 3; c++) pixelError += Math.abs(live[i + c] - snapshot[i + c]);
        error += pixelError;
        if (pixelError > 60) changed++;
      }
      return { meanChannelError: error / (live.length / 4 * 3), changedFraction: changed / (live.length / 4) };
    }, [original.toString('base64'), frozen.toString('base64')]);
    await testInfo.attach('live-footer', { body: original, contentType: 'image/png' });
    await testInfo.attach('raw-snapshot', { body: frozen, contentType: 'image/png' });
    // AA/downsampling at the capped texture size may differ slightly. A lost
    // headline, fallback font, blank canvas or 1px opaque glass bar won't pass.
    expect(difference.meanChannelError).toBeLessThan(3);
    expect(difference.changedFraction).toBeLessThan(0.05);
  });
});

test('769px is desktop; a mobile round trip gets a fresh one-shot activation', async ({ page }) => {
  await page.setViewportSize({ width: 769, height: 900 });
  await open(page);
  await scrollProgress(page, 0.5);
  await expect(page.locator('#singularity')).toHaveCount(1);
  await page.setViewportSize({ width: 768, height: 900 });
  await expectPlain(page);
  await page.setViewportSize({ width: 769, height: 900 });
  await scrollProgress(page, 0.5);
  expect(await page.evaluate(() => ({
    captures: window.horizonStats.captures,
    oldLost: window.horizonStats.contexts[0].isContextLost(),
    newLost: window.horizonStats.contexts[1].isContextLost(),
  }))).toEqual({ captures: 2, oldLost: true, newLost: false });
});

test('a silently blank foreignObject restores the real title instead of uploading empty paint', async ({ page }) => {
  await page.addInitScript(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: Parameters<typeof draw>) {
      if (args[0] instanceof HTMLImageElement && args[0].src.startsWith('data:image/svg+xml')) return;
      return draw.apply(this, args);
    };
  });
  await open(page);
  await page.locator(root).scrollIntoViewIfNeeded();
  await expect(page.locator(root)).toHaveAttribute('data-horizon-state', 'static');
  await expectPlain(page);
  await expect(page.locator('.html2canvas-container')).toHaveCount(0);
  expect(await page.evaluate(() => window.horizonStats.contexts.length)).toBe(0);
});
