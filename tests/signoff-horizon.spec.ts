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
      cameraHoldRef: { readonly current: boolean };
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

/** The hold and the arm line. One trigger holds both boxes — the black hole's
 * container and the sign-off sheet — to the viewport for the whole consumption,
 * and it owns the scrub. There is no second trigger because the release must not
 * be a handover: see `holdDistanceAt` in lib/spaghettification.ts. */
const HOLD = 'signoff-horizon';
const ARM = 'signoff-horizon-arm';

async function open(page: Page, query = '') {
  await page.goto(fixture + query);
  await page.waitForFunction(() => Boolean(window.horizonFixture));
  await page.evaluate(() => document.fonts.ready);
  // GSAP places every trigger on `window.load`, and the fixture has images to
  // wait for: a test that measures a trigger line before that refresh lands is
  // aiming at a number the page is about to change.
  await page.waitForLoadState('load');
  await page.waitForFunction(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon');
    const run = Number(document.querySelector<HTMLElement>('.footer.signoff')?.dataset.horizonRun);
    return Boolean(trigger) && run > 0 && trigger!.end > trigger!.start;
  }, null, { timeout: 10_000 }).catch(() => undefined);
}

/** Whether the stage's cinematic camera is being held. The pin fixes the black
 * hole's box; this is what fixes the framing inside it, so the singularity the
 * invitation falls into is static in both senses for the whole hold. */
const cameraHeld = (page: Page) => page.evaluate(() => window.horizonFixture.cameraHoldRef.current);

/** The consumption's own scroll distance, as the effect publishes it. The hold
 * spans `run + settle`; the fall occupies the first `run` px and the screen stays
 * locked for `settle` px after it. */
const consumptionRun = (page: Page) =>
  page.evaluate(() => Number(document.querySelector<HTMLElement>('.footer.signoff')!.dataset.horizonRun));

/** Jump the scroll to the position that asks for `consumption` of the fall, and
 * wait for the playhead to land on it.
 *
 * The playhead is a scroll-domain quantity: `start + run · consumption` is the
 * pixel that asks for it, and because `run` is longer than the playhead's
 * smoothing distance ONE instant jump lands it exactly (see `followPlayhead`).
 * An earlier version scrubbed a tween in TIME, which needed a second jump and a
 * 400ms wait to dodge a velocity-spike re-target race; there is no tween now, so
 * there is no race and nothing to wait for.
 */
/** Whether the one-shot snapshot is still in flight. While it is, the effect
 * deliberately paints playhead 0 (the frozen frame has to be a raster of the rest
 * geometry), so nothing that asserts a RUNNING scene may be asserted in that
 * window. It is bounded on both sides: the capture is either in hand or retired by
 * the watchdog, and a runner where html2canvas cannot finish at all — a software
 * rasteriser, no GPU — stays in it until then. The hold is not part of the freeze,
 * so the layout assertions below always run. */
const settled = new WeakSet<Page>();
async function sceneRunning(page: Page): Promise<boolean> {
  if (!settled.has(page)) {
    // Long enough to outlast the effect's own patience, so a runner with no GPU (or
    // a software rasteriser that needs a minute to clone the footer) settles before
    // the assertions are made rather than being read as a broken hold. Where the
    // capture works — a real browser, CI with SwiftShader — this returns in a frame
    // or two, and it is waited for once per page: a retired overlay is not re-armed
    // for a second snapshot inside the same test.
    await page.waitForFunction(() =>
      document.querySelector<HTMLElement>('.footer.signoff')!.dataset.horizonState !== 'capturing',
    null, { timeout: 14_000 }).catch(() => undefined);
    if ((await page.locator(root).getAttribute('data-horizon-state')) !== 'capturing') settled.add(page);
  }
  return (await page.locator(root).getAttribute('data-horizon-state')) !== 'capturing';
}

/** Jump the scroll to the position that asks for `consumption` of the fall, and
 * wait for the playhead to land on it.
 *
 * The playhead is a scroll-domain quantity: `start + run · consumption` is the
 * pixel that asks for it, and because `run` is longer than the playhead's
 * smoothing distance ONE instant jump lands it exactly (see `followPlayhead`).
 * An earlier version scrubbed a tween in TIME, which needed a second jump and a
 * 400ms wait to dodge a velocity-spike re-target race; there is no tween now, so
 * there is no race and nothing to wait for.
 *
 * The target is recomputed from the trigger's own line each round, in the same
 * task as the scroll, and the jump is repeated until the line it was measured on
 * is the line still standing: a page whose `window.load` refresh has not landed
 * yet reports a `start` hundreds of pixels away from its settled one, and a test
 * that teleports to a pre-settled line arrives at progress 0 and reads that as the
 * effect having failed. The third concern is the pixel: scroll offsets are whole
 * numbers, so the playhead lands on what the applied scroll asks for, which is
 * read back rather than assumed.
 */
async function scrollProgress(page: Page, consumption: number) {
  await page.waitForFunction(() => Boolean(window.horizonFixture.ScrollTrigger.getById('signoff-horizon')));
  // Out of the capture window first, as far as it is willing to be waited for: the
  // effect measures the scene at REST while the snapshot is being cloned, which
  // means the trigger's own line is briefly the settled line minus the reservation,
  // and a test that aims at THAT parks the reader at the top of the span and calls
  // it a broken hold. The window is bounded by the effect's own patience (see
  // `CAPTURE_PATIENCE_MS`), so waiting a little is never waiting forever.
  await sceneRunning(page);
  const aim = () => page.evaluate(async (c) => {
    const ST = window.horizonFixture.ScrollTrigger;
    const sheet = document.querySelector<HTMLElement>('.footer.signoff')!;
    const read = () => {
      const trigger = ST.getById('signoff-horizon')!;
      return {
        start: trigger.start,
        span: trigger.end - trigger.start,
        run: Number(sheet.dataset.horizonRun),
      };
    };
    let target = read();
    let spent = 0;
    let height = NaN;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      window.scrollTo({ top: target.start + target.run * c, behavior: 'instant' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const now = read();
      if (Math.abs(now.start - target.start) < 0.5) {
        target = now;
        spent = window.scrollY - now.start;
        height = document.querySelector<HTMLElement>('.bh-hold')!.getBoundingClientRect().height;
        break;
      }
      // The line moved under the jump: settle, and aim again. (A refresh that lands
      // while the reservation is applied is the case this is for; the effect
      // re-derives the line at the end of the capture window, so this loop is the
      // belt to that brace.)
      target = now;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const wanted = target.run * c;
    return {
      target: Math.min(1, Math.max(0, spent / (target.run || 1))),
      spent,
      short: c > 0 && spent < wanted - 2,
      span: target.span,
      height: Number.isNaN(height)
        ? document.querySelector<HTMLElement>('.bh-hold')!.getBoundingClientRect().height
        : height,
    };
  });
  let asked = await aim(consumption);
  // A jump made INSIDE the capture window lands on a line the effect is about to
  // move back down by the reservation it had zeroed. If the reader ended up short
  // of what was asked and the window has since closed, aim once more at the settled
  // line: this is the difference between "the hold does not engage" and "the test
  // teleported while the page was being cloned".
  // And once the capture window has closed, aim again. The playhead is the
  // scroll's function, and it is a SCROLL that re-derives it: a test that teleports
  // into the span while the snapshot is being cloned arrives at a paint frozen at 0,
  // and nothing would move it again until the reader moved. Re-aiming is what the
  // reader does instead, and it costs a frame.
  if (consumption > 0 && await sceneRunning(page)) asked = await aim(consumption);

  if (consumption > 0) {
    // The reservation is the part of the contract the paint has no say in.
    expect(asked.height).toBeCloseTo(Math.min(Math.max(asked.spent, 0), asked.span) + 1, 0);
    if (await sceneRunning(page)) {
      // The playhead landing on the scroll's ask IS the evidence that the scene is
      // running: it is written by the same pass that writes `data-horizon-scene`,
      // and the state attribute is a label for the paint, which may be legitimately
      // absent for a frame or two after an overlay has been retired.
      await expect.poll(() => page.locator(root).getAttribute('data-horizon-progress'))
        .toBe(asked.target.toFixed(4));
    }
  } else {
    // Zero consumption is the trigger's OWN start line, and the hold has not
    // begun: no state, no progress, and the footer is the page's ordinary paint.
    // (Asserting `active` here would be asserting that a trigger is inside a span
    // it has only just reached.)
    await expect(page.locator(root)).not.toHaveAttribute('data-horizon-state', /capturing|ready/);
    expect(asked.height).toBeLessThanOrEqual(1.5);
  }
}

/** The scene is running: the hold is engaged and the sheet is being consumed.
 * `data-horizon-state` labels the PAINT ('capturing' → 'ready', or 'hold' when the
 * overlay was refused), and it is legitimately absent on a runner that retired the
 * overlay mid-capture and has had no scroll since — so the claim is read from the
 * scene attribute too, which is written by the same paint pass that would have
 * written the state. What may never be seen is the scene not running at all: that
 * is the difference between "no GPU" and "no pin", and it is the whole point of the
 * gate split in lib/singularityGate.tsx. */
async function expectSceneRunning(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>('.footer.signoff')!;
    return `${sheet.dataset.horizonState ?? ''}|${sheet.dataset.horizonScene ?? ''}`;
  }), { timeout: 10_000 }).toMatch(/ready\|pinned|hold\|pinned|ready\|idle\b.*|hold\|.*|\|pinned/);
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
  // The hold is a box, not a pin: `.bh-hold` is the reservation the composition
  // is locked to the viewport with, and its height is the whole mechanism. It is
  // read here because the invariants are about it — the run of the fall, the pad,
  // the frozen release, and the fact that at rest it is a pixel tall and nothing
  // more.
  const holdEl = document.querySelector<HTMLElement>('.bh-hold');
  const holdTrigger = byId('signoff-horizon');
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
    hold: holdEl
      ? {
          height: holdEl.getBoundingClientRect().height,
          inline: holdEl.style.height || null,
          display: getComputedStyle(holdEl).display,
        }
      : null,
    // Scroll anchoring keeps content still by moving the scroll, which is exactly
    // the cancellation a layout-driven hold cannot survive: it has to be off while
    // the reservation is growing, and back on the moment it is not.
    scrollAnchor: getComputedStyle(document.documentElement).overflowAnchor,
    pins: {
      hold: holdTrigger
        ? {
            start: holdTrigger.start,
            end: holdTrigger.end,
            span: holdTrigger.end - holdTrigger.start,
            active: holdTrigger.isActive,
            progress: holdTrigger.progress,
          }
        : null,
      arm: byId('signoff-horizon-arm') ? { start: byId('signoff-horizon-arm')!.start } : null,
      // One trigger for the whole sequence — the hole's container and the sheet are
      // held by the same box, so `|sheet.start − hole.start|` and
      // `|sheet.end − hole.end|` are zero because there is nothing to compare: no
      // handover, no double-pin, and no spacer to keep in sync. Counted, so a
      // second pin sneaking back in fails the suite.
      count: window.horizonFixture.ScrollTrigger.getAll()
        .filter((trigger) => String(trigger.vars.id).startsWith('signoff-horizon')).length,
      triggerIsInvite: holdTrigger?.trigger === inviteEl,
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
        filter: getComputedStyle(el).filter,
        pointerEvents: getComputedStyle(el).pointerEvents,
        // The LAYOUT box, which a transform does not touch: `offset*` is what
        // the lift out of document flow writes, and what must not move while the
        // warp runs or the sheet's own box collapses around it.
        position: getComputedStyle(el).position,
        offsetLeft: el.offsetLeft,
        offsetTop: el.offsetTop,
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
      };
    }),
    // The anchor is the flyers' offset parent, and its height is pinned for as
    // long as they are lifted, so nothing below them jumps when they leave flow.
    anchor: (() => {
      const el = document.querySelector<HTMLElement>('.signoff__anchor')!;
      return { height: el.getBoundingClientRect().height, inlineHeight: el.style.height };
    })(),
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
  // A released hold must leave nothing behind: no GSAP spacer anywhere, and the
  // reservation back to the single pixel it is at rest (never a leftover box the
  // page has to scroll past). The footer and the black hole's frame stay ordinary
  // in-flow children throughout, because the hold never takes them out of flow.
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator(root)).not.toHaveCSS('position', 'fixed');
  expect(await page.evaluate(() => {
    const hold = document.querySelector<HTMLElement>('.bh-hold');
    return hold ? hold.getBoundingClientRect().height : -1;
  })).toBeLessThanOrEqual(1.5);
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

/* The status gate decides what is PAINTED, not what is HELD. A stage that is
   still booting, or that never worked, still gives the reader the whole hold: the
   text and the button are consumed by the DOM sheet exactly as they are with a
   live black hole, and only the overlay is withheld. Refusing the layout too is
   what made an earlier version of this page pin nothing at all until a WebGL2
   context happened to be ready — and it is why the footer looked unpinched, with
   the text sliding past the hole instead of into it. */
for (const status of ['booting', 'unsupported', 'error']) {
  test(`stage status ${status} gets the hold without the paint`, async ({ page }) => {
    await open(page, `?status=${status}`);
    await page.locator(root).scrollIntoViewIfNeeded();
    // No capture, no overlay, and no paint of any kind.
    expect(await page.evaluate(() => window.horizonStats.captures)).toBe(0);
    await expect(page.locator(overlay)).toHaveCount(0);
    await expect(page.locator(root)).not.toHaveAttribute('data-horizon-paint');
    // …but the hold is there and the sheet is being consumed under it: 'hold' is
    // the degraded-but-running scene. ONE trigger, because the arm line — the thing
    // that would start a capture — is never created for a stage that cannot paint.
    // (With a live stage there are two; `the pin belongs to the black hole` below
    // asserts that number, so neither case can quietly grow a third.)
    await expectSceneRunning(page);
    expect(await page.evaluate(() => window.horizonFixture.ScrollTrigger.getAll()
      .filter((trigger) => String(trigger.vars.id).startsWith('signoff-horizon')).length)).toBe(1);
    await scrollProgress(page, 0.5);
    expect(await page.evaluate(() => document.querySelectorAll('.signoff-horizon__canvas').length)).toBe(0);
  });
}

/* ==========================================================================
   Requirement 1 — the black hole is the pinned subject.
   ======================================================================== */

test('the pin belongs to the black hole: the reference framing, held through the whole consumption', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => Boolean(window.horizonFixture.ScrollTrigger.getById('signoff-horizon')));

  // The hold begins on the REFERENCE FRAMING: the first scroll position where
  // the viewport has the black hole AND the whole "ENTER THE NEMOVERSE"
  // headline in it at once. Jump to the hold's own start line.
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
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
  // subject of the hold, and the hold is driven by the headline's bottom edge.
  // Asserted as: one trigger for the whole sequence, both boxes still in flow (so
  // no spacer was inserted anywhere between them), and the reservation carrying
  // the composition at one position.
  expect(atStart.pins.count).toBe(2);
  expect(atStart.pins.triggerIsInvite).toBe(true);
  // The sheet is never parked: its own position is whatever the page styles it,
  // and `fixed` would mean a pin that no longer exists.
  expect(atStart.sheet.position).not.toBe('fixed');
  expect(atStart.hold).not.toBeNull();
  expect(atStart.pins.hold!.progress).toBe(0);
  expect(atStart.frame.height).toBeGreaterThan(0);
  // "Rigidly anchored and static" is two claims: the composition is locked to the
  // viewport, and the stage's own cinematic camera is held for as long as it is,
  // so the disc does not fly around inside a box that is not moving.
  // (The camera hold is engaged by the hold itself, so it is asserted inside the
  // walk below, where the scene is running — not at the start line, which is the
  // last position at which nothing has been taken out of the layout yet.)

  // The composition on screen at the trigger: the headline's bottom edge `air`
  // px above the fold and its top edge on screen (the WHOLE headline, which is
  // what the framing is specified on); the CTA still below the fold; the hole
  // above the headline with the seam gradient — not the sheet — between them.
  // Two quantisations stand between the analytic framing and the pixels: the
  // trigger's inset is published as a whole number (`triggerLine` rounds it, because
  // a fractional start is a fractional scroll offset the browser cannot represent),
  // and the reservation is grown in whole CSS pixels for the same reason. That
  // leaves under two pixels of framing error, which is what the black hole's own
  // `--bh-frame-fit` budget is sized against; sub-pixel precision here is not a
  // property a page with integer scroll offsets can offer.
  expect(Math.abs(inviteBox.bottom - (atStart.viewport - air))).toBeLessThan(2.5);
  expect(inviteBox.top).toBeGreaterThanOrEqual(-0.5);
  expect(inviteBox.height).toBeGreaterThan(0);
  // The CTA's own top margin is 2.6rem and `air` is capped at 42px, so the
  // button's top edge lands on the fold, never above it.
  expect(ctaBox.top).toBeGreaterThanOrEqual(atStart.viewport - 2);
  expect(atStart.sheet.bottom).toBeGreaterThan(atStart.viewport);
  expect(atStart.frame.bottom).toBeLessThanOrEqual(inviteBox.top);
  expect(atStart.frame.bottom).toBeGreaterThan(0);
  // …and the CONTAINMENT that makes it the reference framing rather than a crop
  // of it: ONE scroll position holds both boxes whole. The container's top edge
  // is at or below the top of the viewport, and the whole headline is above the
  // fold. Specifying the trigger on the headline alone — as an earlier version
  // did — guaranteed only the second half, and left the hole's crown off the top
  // of the screen at the exact moment the hold began.
  const rise = inviteBox.bottom - atStart.frame.bottom;
  expect(rise).toBeGreaterThan(0);
  expect(atStart.frame.top).toBeGreaterThanOrEqual(-0.5);
  expect(atStart.frame.height + rise).toBeLessThanOrEqual(atStart.viewport - air + 1.5);
  // The container's height is the composition's one free variable: the stage
  // publishes what it was budgeted to, and the box on screen is that number.
  const fit = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bh-frame-fit').trim());
  if (fit) expect(Math.abs(parseFloat(fit) - atStart.frame.height)).toBeLessThan(1.5);
  // The warp has not begun: this is the frame the reader is meant to see.
  await expect(page.locator(root)).toHaveAttribute('data-horizon-progress', '0.0000');

  // The two boxes share one line and one span because there is only ONE trigger:
  // the hole's container and the sheet below it are pushed by the same box, so
  // there is no gap, no double-pin and no handover to time between them. The arm
  // line starts earlier; it is the only other scroll line in the section, and it
  // never holds anything.
  expect(atStart.pins.arm!.start).toBeLessThan(atStart.pins.hold!.start);
  expect(atStart.pins.hold!.span).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.querySelectorAll('.pin-spacer').length)).toBe(0);

  // Requirements 2 and 3: the hole does not move by one pixel for the whole
  // fall, while the scroll does — and the sheet holds the screen with it, so
  // the only thing that changes is the warp.
  const frameTops: number[] = [atStart.frame.top];
  const frameBottoms: number[] = [atStart.frame.bottom];
  const sheetTops: number[] = [atStart.sheet.top];
  const scrolls: number[] = [atStart.scrollY];
  for (const consumption of [0, 0.25, 0.5, 0.75, 1]) {
    await scrollProgress(page, consumption);
    const scene = await readScene(page);
    frameTops.push(scene.frame.top);
    frameBottoms.push(scene.frame.bottom);
    sheetTops.push(scene.sheet.top);
    scrolls.push(scene.scrollY);
    if (consumption > 0) {
      expect(scene.pins.hold!.progress).toBeGreaterThan(0);
      expect(scene.pins.hold!.progress).toBeLessThan(1);
      expect(await cameraHeld(page)).toBe(true);
    }
    // The singularity the invitation falls into is the parked hole's centre,
    // above the sheet: the pull is upward, into the hole, for the whole fall.
    expect(scene.frame.centre.y).toBeLessThan(scene.sheet.top);
    if (consumption === 1) {
      // Requirement 2, on the frame it is actually about: the consumption has
      // reached 100% and BOTH pins are still holding the screen. The trigger's
      // own progress is short of 1 by the settle margin, which is what makes
      // "the pin outlasts the timeline" a property of the geometry rather than
      // of how fast the reader arrived.
      expect(scene.pins.hold!.progress).toBeLessThan(1);
      expect(await page.locator(root).getAttribute('data-horizon-progress')).toBe('1.0000');
      // The sheet is rigidly locked at the reference position — and it is locked by
      // the reservation, not by `position: fixed`: it is still an ordinary in-flow
      // box, which is what lets the curtain pay the scroll back at the end instead
      // of releasing into a hole in the page.
      expect(scene.sheet.position).not.toBe('fixed');
      expect(Math.abs(scene.hold!.height - (scene.pins.hold!.span * scene.pins.hold!.progress + 1)))
        .toBeLessThan(2);
    }
  }
  // The pins span the consumption's run PLUS the release margin, and the scroll
  // it took to finish the fall is exactly the run.
  const span = atStart.pins.hold!.span;
  const run = await consumptionRun(page);
  expect(run).toBeGreaterThan(0);
  expect(span - run).toBeGreaterThan(0);
  // One whole pixel per scrolled pixel, and the run to within the pixel rounding
  // of the trigger's own (fractional) start line.
  expect(Math.abs(scrolls.at(-1)! - scrolls[0] - run)).toBeLessThan(1.5);
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
    window.horizonFixture.cameraHoldRef.current)).toBe(false);
  const released = await readScene(page);
  expect(released.pins.hold!.progress).toBe(1);
  // The reservation is NOT taken back. Collapsing the box the hold grew would
  // pull the document up by the whole span and teleport the reader — which is the
  // release bug in its other form. It freezes at `span + pad` instead: the page
  // keeps exactly the space the reader paid for with the scroll, and the box stops
  // participating in the animation (it has no animation left to be paid for).
  expect(released.hold!.height).toBeCloseTo(released.pins.hold!.span + 1, 0);
  expect(released.scrollY).toBeGreaterThan(scrolls.at(-1)!);
  // …and the camera hold is over with the pin, not with the playhead: a hold
  // that outlived the release would freeze the stage's establishing move for
  // the rest of the session.
  expect(await cameraHeld(page)).toBe(false);
});

/** The second reported failure, as an assertion: a wide band of background
 * between the black hole and the sign-off.
 *
 * It was not a styling mistake. The hold was being paid for INSIDE the picture:
 * `pinSpacing: true` wrote the whole pin distance as padding on a spacer that
 * replaced the pinned `.bh-frame`, i.e. exactly the seam between the hole and the
 * sheet, and the released frame was then pushed down into it. So the reservation
 * only existed while the scene was pinned, and it appeared between the two things
 * the reader was looking at. The fix is structural — the reservation is a sibling
 * ABOVE the section — and this test is the fence around that structure: measure
 * the seam at rest, through the whole consumption, and past the release, and it
 * must be the same distance every time, because nothing is ever inserted into it.
 */
test('nothing is ever inserted between the singularity and the sign-off', async ({ page }) => {
  await open(page);
  const seam = () => page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('#singularity')!;
    const hold = document.querySelector<HTMLElement>('.bh-hold')!;
    const frame = document.querySelector<HTMLElement>('.bh-frame')!;
    const sheet = document.querySelector<HTMLElement>('.footer.signoff')!;
    return {
      // The reservation must sit OUTSIDE the section, or growing it stretches the
      // section's own box (`.singularity::before` paints its background) and the
      // gap opens right where the composition is supposed to end.
      holdIsPrev: section.previousElementSibling === hold,
      // The section's flow box ends where the sheet begins: no band of anything.
      docGap: Math.round((sheet.getBoundingClientRect().top - section.getBoundingClientRect().bottom) * 100) / 100,
      // The on-screen seam: the hole's picture bottom to the sheet's top. It is
      // the framing distance, and the hold must not change it at ANY scroll.
      pictureSeam: Math.round((sheet.getBoundingClientRect().top - frame.getBoundingClientRect().bottom) * 100) / 100,
    };
  });

  const atRest = await seam();
  expect(atRest.holdIsPrev).toBe(true);
  expect(Math.abs(atRest.docGap)).toBeLessThan(1.5);
  expect(atRest.pictureSeam).toBeGreaterThan(0);

  for (const consumption of [0, 0.25, 0.5, 0.75, 1]) {
    await scrollProgress(page, consumption);
    const held = await seam();
    expect(held.holdIsPrev).toBe(true);
    expect(Math.abs(held.docGap)).toBeLessThan(1.5);
    // The composition is locked, the sheet is locked, and the space between them
    // is locked to the pixel it was at rest — the one measurement that would have
    // caught the original bug, where the sheet held still and the hole did not.
    expect(Math.abs(held.pictureSeam - atRest.pictureSeam)).toBeLessThan(1.5);
  }

  // Past the release the box the hold grew is still outside the section, and the
  // section still ends at the sheet: the document keeps the reservation (that is
  // the reader's scroll), and it never once put it between the two boxes.
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    window.scrollTo({ top: trigger.end + 400, behavior: 'instant' });
  });
  await page.waitForTimeout(150);
  const after = await seam();
  expect(after.holdIsPrev).toBe(true);
  expect(Math.abs(after.docGap)).toBeLessThan(1.5);
});

test('the hold lets go where it was holding: no jump at the release', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 1);
  const held = await readScene(page);
  // "Inside the span" is what `active` was standing in for, stated on the number
  // the hold is built from: a scrub trigger's toggle flag is GSAP's own bookkeeping
  // (and it legitimately lags a frame when a refresh re-derives the line), while
  // the progress is the arithmetic the whole design rests on.
  if (await sceneRunning(page)) {
    const running = (await readScene(page)).pins.hold!;
    expect(running.progress).toBeGreaterThan(0.9);
    expect(running.progress).toBeLessThan(1);
  }
  const parkedTop = held.frame.top;

  // The reservation above the composition is the whole cost of the hold, and at
  // the release it simply stops growing: the box stays where the reader's scroll
  // has it. Crossing the end therefore has to read as ordinary scrolling — one
  // pixel of motion per pixel of scroll — and not as a teleport of the pin
  // distance, which is what inserting (or reverting) a spacer at that boundary
  // used to do.
  const jump = await page.evaluate(async () => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
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
  // The frozen reservation is the scroll the reader paid for, kept: they are not
  // refunded with a jump backwards, and the document did not shrink under them.
  expect(jump.scrolled).toBeGreaterThan(0);
  expect(jump.moved).toBeGreaterThan(0);
});

test('the playhead is a function of the scroll: one jump lands it, and nothing moves after', async ({ page }) => {
  await open(page);
  // A single instant jump to the end of the fall lands the playhead exactly.
  // There is no scrub tween to wait for and no residual to converge: `run` is
  // longer than the smoothing distance, so the follower cannot trail the scroll.
  await scrollProgress(page, 1);
  const landed = await readScene(page);
  // Several frames with the scroll stopped. The scene is deterministic, so
  // nothing may keep moving — and the pins may not let go early either, which
  // is exactly what a time-domain scrub could not promise.
  await page.waitForTimeout(400);
  const settled = await readScene(page);
  expect(settled.scrollY).toBe(landed.scrollY);
  await expect(page.locator(root)).toHaveAttribute('data-horizon-progress', '1.0000');
  expect(Math.abs(settled.sheet.height - landed.sheet.height)).toBeLessThan(0.01);
  expect(Math.abs(settled.hold!.height - landed.hold!.height)).toBeLessThan(0.01);
  expect(settled.pins.hold!.progress).toBeGreaterThan(0.9);
  expect(settled.pins.hold!.progress).toBeLessThan(1);
  // Scroll anchoring is what a layout-driven hold has to opt out of, or the
  // browser moves the scroll to cancel the layout change and snaps the reader
  // back to the top of the span. It is handed back the moment the span is over.
  expect(landed.scrollAnchor).toBe('none');
  expect(settled.scrollAnchor).toBe('none');
  for (const flyer of settled.flyers) {
    expect(flyer.width).toBeLessThan(0.5);
    expect(flyer.pointerEvents).toBe('none');
  }

  // A fling straight past the whole span: the playhead still lands on 1 in the
  // same frame, the pins are released, and nothing is left half-applied on the
  // layout the reader has scrolled on into.
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    window.scrollTo({ top: trigger.end + 600, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() =>
    window.horizonFixture.cameraHoldRef.current)).toBe(false);
  if (await sceneRunning(page)) {
    await expect(page.locator(root)).toHaveAttribute('data-horizon-progress', '1.0000');
  }
  const flung = await readScene(page);
  expect(flung.pins.hold!.progress).toBe(1);
  expect(flung.scrollAnchor).toBe('');
  expect(Math.abs(flung.sheet.height - settled.sheet.height)).toBeLessThan(0.01);
  // Frozen at the span, and it does not move again: the fall is over, and a box
  // that kept tracking the scroll past the release is the teleport described
  // above. The document is longer by the span, permanently, and that is the deal.
  expect(flung.hold!.height).toBeCloseTo(flung.pins.hold!.span + 1, 0);
  const parked = await page.evaluate(async () => {
    const hold = document.querySelector<HTMLElement>('.bh-hold')!;
    const before = hold.style.height;
    window.scrollBy({ top: 220, behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { before, after: hold.style.height };
  });
  expect(parked.after).toBe(parked.before);
  expect(Math.abs(hemToDocumentEnd(flung) - hemToDocumentEnd(settled))).toBeLessThan(2.5);
});

test('one snapshot/texture; reversible playhead; geometric full consumption', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.horizonStats.captures)).toBe(0);
  await scrollProgress(page, 0);
  const rest = await readScene(page);
  // At rest the hold is one pixel tall and nothing else: no spacer, no reserved
  // page, no gap between the singularity and the sign-off. That single pixel is
  // the pad that makes the rounding at the START of the span go the safe way.
  expect(rest.hold).not.toBeNull();
  expect(rest.hold!.height).toBeLessThanOrEqual(1.5);
  // Written as an inline size, deliberately: `SPACER_PAD` is the resting height and
  // the CSS default is zero, so the one pixel is the effect saying "I am here and I
  // am armed" rather than a leftover of a run.
  expect(rest.hold!.inline).toBe('1px');
  expect(rest.hold!.display).not.toBe('none');
  expect(await page.evaluate(() => document.querySelectorAll('.pin-spacer').length)).toBe(0);
  for (const selector of FLYERS) {
    const flyer = rest.flyers.find((f) => f.selector === selector)!;
    expect(flyer.opacity).toBe(1);
    // The field is the identity at rest: no transform was ever written, and
    // no filter either (V4: the SVG lens substrate is retired) — or the
    // handoff to the pinned scene would move the type.
    expect(parseMatrix(flyer.transform)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(flyer.filter).toBe('none');
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
    // A preserveDrawingBuffer:false canvas must be read in the SAME task as the
    // draw. GSAP updates synchronously from a `scroll` event, so nudging the
    // scroll away and back drives two real draws and lands the playhead exactly
    // where it was — `run` is far longer than the playhead's smoothing distance,
    // so a 1% nudge cannot leave a residual behind.
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    const sheet = document.querySelector<HTMLElement>('.footer.signoff')!;
    const run = Number(sheet.dataset.horizonRun);
    const here = trigger.scroll();
    const step = Math.max(2, run * 0.01);
    const away = here - step < trigger.start ? here + step : here - step;
    const jump = (top: number) => {
      window.scrollTo({ top, behavior: 'instant' });
      document.dispatchEvent(new Event('scroll'));
    };
    jump(away);
    jump(here);
    const canvas = document.querySelector<HTMLCanvasElement>('.signoff-horizon__canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let hash = 0, painted = 0;
    for (let i = 0; i < data.length; i++) hash = ((hash << 5) - hash + data[i]) | 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) painted++;
    return { hash, painted, progress: sheet.dataset.horizonProgress, scroll: here };
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

   The live flyers ALWAYS carry the fall on their own geometry: the affine
   envelope of the lens field (`flyerFrameAt` → `flyerTransform`) — a
   translate toward the singularity plus an anisotropic stretch along the pull
   axis. This is the motion the sequence can never lose, whatever the GPU
   does. The overlay (shader or mosaic) adds the nonlinear curvature the
   affine envelope cannot express, and the paint crossfades between the two on
   the mix. (V4) no SVG filter is ever written on a live flyer.
   ======================================================================== */

test('the live flyers carry the fall; the overlay adds curvature; never a filter', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0);
  const rest = await readScene(page);
  const canvasBox = await page.locator(overlay).boundingBox();
  const sheetBox = await page.locator(root).boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(sheetBox).not.toBeNull();
  const veil = sheetBox!.y - canvasBox!.y;
  expect(veil).toBeGreaterThan(0);

  // Which renderer took the snapshot is inspectable: the heavyweight fixture
  // is GPU-armed, so this is the shader — but the contract the suite asserts
  // below is identical for the 2D mosaic fallback.
  await expect(page.locator(root)).toHaveAttribute('data-horizon-renderer', /^(shader|mosaic)$/);

  // The singularity the invitation falls into is the parked hole's centre,
  // above the sheet: the pull is upward for the whole fall.
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  for (const progress of [0.15, 0.4, 0.65, 0.85]) {
    await scrollProgress(page, progress);
    const scene = await readScene(page);
    for (const [index, selector] of FLYERS.entries()) {
      const flyer = scene.flyers[index];
      const at = rest.flyers[index];
      expect(flyer.selector).toBe(selector);

      // The affine fall is written: a non-identity transform whose translation
      // carries the flyer's centre TOWARD the singularity (the distance to the
      // hole's centre shrinks at every playhead, and the matrix is not the
      // rest identity).
      expect(parseMatrix(flyer.transform)).not.toEqual([1, 0, 0, 1, 0, 0]);
      expect(dist(flyer.centre, scene.frame.centre)).toBeLessThan(
        dist(at.centre, scene.frame.centre),
      );

      // V4's rule: no SVG filter on a live flyer, EVER. The feDisplacementMap
      // substrate renders as transparent black on engines whose feImage does
      // not paint data-URL maps (user-verified), so it is gone for good — this
      // assertion is the tripwire keeping it gone.
      expect(flyer.filter).toBe('none');

      // The layout box is the rest box: the lift alone positions the flyer,
      // and the fall never becomes a layout motion.
      expect(flyer.offsetLeft).toBe(at.offsetLeft);
      expect(flyer.offsetTop).toBe(at.offsetTop);
      expect(flyer.offsetWidth).toBe(at.offsetWidth);
      expect(flyer.offsetHeight).toBe(at.offsetHeight);

      if (progress >= 0.4) {
        // The frozen frame owns the paint: live layer fully exchanged.
        expect(flyer.opacity).toBe(0);
      }
    }
  }

  // The overlay canvas tracks the sheet through the fall: same width, sheet +
  // veil of headroom, never a straggler slab over the rest box — and at the
  // end of the fall every flyer has crossed the event horizon: scaled to zero
  // in its own matrix, no pointer target left over the hole, and the frozen
  // frame's geometry swallowing every texel (asserted by the snapshot test
  // above).
  await scrollProgress(page, 1);
  const end = await readScene(page);
  for (const index of [0, 1]) {
    const flyer = end.flyers[index];
    const at = rest.flyers[index];
    expect(parseMatrix(flyer.transform)).not.toEqual([1, 0, 0, 1, 0, 0]);
    expect(flyer.filter).toBe('none');
    expect(flyer.offsetLeft).toBe(at.offsetLeft);
    expect(flyer.offsetTop).toBe(at.offsetTop);
    expect(flyer.pointerEvents).toBe('none');
    expect(flyer.opacity).toBe(0);
  }
});

/* The live flyers STRAND — the spaghettification is in the DOM, not just in
   the frozen frame. The affine envelope above can only translate, rotate and
   scale one box, so the flyer's content is windowed into horizontal bands
   (`.horizon-strand`), each a clone clipped to its strip, each falling with
   its own lag: the band nearer the singularity runs ahead, the far band
   trails, and the word tears along the axis of the pull before every band
   closes onto the point. The bands are inert and aria-hidden — the real
   headline and CTA stay mounted, focusable and nameable. */
test('the live flyers strand along the pull axis before the point', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0);
  // At rest the flyer is the real element only: the grid does not exist yet,
  // so the identity at p = 0 is exact (no clone seam on the lift).
  await expect(page.locator('.horizon-strand')).toHaveCount(0);
  const rest = await readScene(page);
  const restHeight = Object.fromEntries(rest.flyers.map((flyer) => [flyer.selector, flyer.height]));

  await scrollProgress(page, 0.35);
  const scene = await readScene(page);
  const hole = scene.frame.centre;
  const bands: Record<string, number> = { [invite]: 10, [cta]: 6 };
  for (const flyer of scene.flyers) {
    const rows = bands[flyer.selector];
    const cells = page.locator(`${flyer.selector} > .horizon-strand`);
    await expect(cells).toHaveCount(rows);
    // The clones are inert and unnamed: the real link is the only interactive,
    // nameable node, at the same playhead where its paint is exchanged.
    await expect(cells.first()).toHaveAttribute('aria-hidden', 'true');
    await expect(cells.first()).toHaveAttribute('inert', '');
    const centres = await cells.evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }),
    );
    const near = centres[0]; // row 0 is the top strip, nearest the singularity
    const far = centres[rows - 1];
    // The elongation: the band span EXCEEDS the flyer's rest height, so the
    // word visibly tears along the pull axis — a flat affine cannot do this.
    const span = Math.abs(near.y - far.y);
    expect(span).toBeGreaterThan(restHeight[flyer.selector] * 1.3);
    // The near band leads: it has fallen further toward the hole's centre.
    expect(Math.hypot(near.x - hole.x, near.y - hole.y)).toBeLessThan(
      Math.hypot(far.x - hole.x, far.y - hole.y),
    );
  }

  // Full consumption: every band has closed onto the singularity, so the
  // strands span nothing — geometric collapse, never an opacity fade.
  await scrollProgress(page, 1);
  const consumed = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>('.horizon-strand'));
    const hole = document.querySelector<HTMLElement>('.bh-frame')!.getBoundingClientRect();
    const centre = { x: hole.left + hole.width / 2, y: hole.top + hole.height / 2 };
    let worst = 0;
    for (const cell of cells) {
      const box = cell.getBoundingClientRect();
      worst = Math.max(worst, Math.hypot(box.left + box.width / 2 - centre.x, box.top + box.height / 2 - centre.y));
    }
    return { count: cells.length, worst };
  });
  expect(consumed.count).toBeGreaterThan(0);
  expect(consumed.worst).toBeLessThan(3);
});

/* ==========================================================================
   Requirement 4 — the curtain pays for exactly what the void vacates.
   ======================================================================== */

test('the flyers leave document flow for the duration, and their layout box never moves', async ({ page }) => {
  await open(page);
  // At rest, before either pin engages: both bodies are in flow, the effect has
  // written no box of its own, and the anchor is as tall as its content.
  const before = await readScene(page);
  expect(before.sheet.position).not.toBe('fixed');
  expect(before.hold!.height).toBeLessThanOrEqual(1.5);
  expect(before.anchor.inlineHeight).toBe('');
  expect(await cameraHeld(page)).toBe(false);
  for (const flyer of before.flyers) {
    expect(flyer.position).toBe('relative');
    expect(parseMatrix(flyer.transform)).toEqual([1, 0, 0, 1, 0, 0]);
  }
  const rest = before.flyers.map((flyer) => ({
    left: flyer.offsetLeft,
    top: flyer.offsetTop,
    width: flyer.offsetWidth,
    height: flyer.offsetHeight,
  }));

  // Requirement 3's "detach from document flow" is literal. For the whole hold
  // both bodies are absolutely positioned at the exact boxes they already
  // occupied, so the lift itself paints nothing — and because the layout can no
  // longer move them, the sheet's collapsing border box cannot perturb a rest
  // position by a sub-pixel while the field is evaluated from it.
  for (const consumption of [0, 0.3, 0.6, 1]) {
    await scrollProgress(page, consumption);
    const scene = await readScene(page);
    // The lift out of flow must not shrink the sheet's box while the hold owns it:
    // the reservation, not `position: fixed`, is what holds the screen.
    expect(scene.sheet.position).not.toBe('fixed');
    expect(scene.anchor.inlineHeight).not.toBe('');
    // Lifting the anchor's only two children would empty it, so its height is
    // written back: nothing below the invitation moves when they leave flow.
    expect(Math.abs(scene.anchor.height - before.anchor.height)).toBeLessThan(0.5);
    scene.flyers.forEach((flyer, index) => {
      expect(flyer.position).toBe('absolute');
      // `offset*` is the LAYOUT box: a transform does not touch it. It is the
      // rest box at every playhead, resolved against the anchor — the offset
      // parent — and not against the sheet.
      expect(flyer.offsetLeft).toBe(rest[index].left);
      expect(flyer.offsetTop).toBe(rest[index].top);
      expect(flyer.offsetWidth).toBe(rest[index].width);
      expect(flyer.offsetHeight).toBe(rest[index].height);
    });
  }

  // Scrolling back UP out of the hold settles the playhead on 0 — the tail
  // converges with the scroll stopped, so the scene is never left half-applied
  // on an unpinned layout — and both bodies are back in document flow.
  await page.evaluate(() => {
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    window.scrollTo({ top: Math.max(0, trigger.start - 400), behavior: 'instant' });
  });
  await expect.poll(() => page.locator(root).getAttribute('data-horizon-progress')).toBe('0.0000');
  const after = await readScene(page);
  expect(after.sheet.position).not.toBe('fixed');
  expect(after.hold!.height).toBeLessThanOrEqual(1.5);
  expect(after.anchor.inlineHeight).toBe('');
  expect(Math.abs(after.anchor.height - before.anchor.height)).toBeLessThan(0.5);
  after.flyers.forEach((flyer, index) => {
    expect(flyer.position).toBe('relative');
    expect(parseMatrix(flyer.transform)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(flyer.offsetLeft).toBe(rest[index].left);
    expect(flyer.offsetTop).toBe(rest[index].top);
  });
  // And the real footer is whole again: the curtain sits one tail below the hem,
  // with nothing parked and nothing consumed.
  expect(Math.abs(hemToDocumentEnd(after) - after.tail)).toBeLessThan(2.5);
});

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
      holdHeight: scene.hold!.height,
      slack: scene.docHeight - scene.scrollY - scene.viewport,
      run: scene.pins.hold!.span,
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
  // The real link only: the strand grid clones the CTA's content into inert,
  // aria-hidden bands, so a bare `.signoff a` would match the clones too.
  const link = page.locator('.signoff [data-horizon-item="cta"] > a');
  await page.evaluate(() => {
    // The pins stay ENGAGED: this is the scene a reader actually interacts
    // with, and with the screen locked the playhead only moves where the scroll
    // puts it. An earlier version reverted both pins and turned a scrub tween by
    // hand; there is no tween to turn now, and there is nothing to gain from
    // testing the interaction on a layout the effect never produces.
    const footer = document.querySelector('.signoff')!;
    window.horizonClicks = 0;
    footer.querySelector('a')!.addEventListener('click', (event) => {
      if (event.isTrusted) window.horizonClicks++;
      event.preventDefault(); // keep all three checks on this same native link
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  let clicks = 0;
  for (const consumption of [0, 0.5, 1]) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await scrollProgress(page, consumption);
    await expect(link).toHaveAttribute('href', '#nemoverse');
    await expect(link).toHaveAccessibleName('Explore the universes');
    // The link is never removed from the accessibility tree, at any playhead —
    // not at the horizon, where its own box has contracted into a point. A
    // transform is not a layout property, and neither opacity nor
    // pointer-events takes a node out of the tree.
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
    expect(rescued.pins.hold!.progress).toBe(before.pins.hold!.progress);
    expect(await page.locator(root).getAttribute('data-horizon-progress')).toBe(consumption.toFixed(4));

    if (consumption < 1) {
      // A real click on a real link, while the sheet is :focus-within — which is
      // also what puts the pointer back on a flyer the horizon has retired.
      await link.click();
      await expect.poll(() => page.evaluate(() => window.horizonClicks)).toBe(++clicks);
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => window.horizonClicks)).toBe(++clicks);
    } else {
      // At 100% the CTA has crossed the event horizon: requirement 3's scale to
      // zero means there is no area left to click, and that is the point — no
      // invisible hit target is left sitting over the hole. What survives is the
      // tab stop and the accessible name, asserted above, plus the rescue's
      // pointer-events, which a zero-area box simply has nothing to apply to.
      const flyer = rescued.flyers.find((f) => f.selector === cta)!;
      expect(flyer.width).toBeLessThan(0.5);
      expect(flyer.height).toBeLessThan(0.5);
      expect(flyer.pointerEvents).toBe('auto');
    }

    // The tab stop is real in both directions, and the CTA is the only one the
    // effect ever touches. Last, because a Tab that scrolls moves the playhead —
    // and the next iteration puts it back where it belongs.
    await page.locator('#nemoverse a').evaluate((el: HTMLAnchorElement) => el.focus({ preventScroll: true }));
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#nemoverse a')).toBeFocused();
  }

  // A consumed flyer must not leave an invisible click target over the hole.
  // Sampled just before the scale reaches zero, where both flyers are past the
  // horizon but still have an area to hit-test, and both are up by the
  // singularity — inside the veil the hem clip re-grants, so nothing about this
  // probe depends on the collapsing hem.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await scrollProgress(page, 0.85);
  const consumed = await readScene(page);
  expect(consumed.flyers.every((flyer) => flyer.pointerEvents === 'none')).toBe(true);
  expect(consumed.flyers.every((flyer) => flyer.width > 0.5 && flyer.height > 0.5)).toBe(true);
  for (const selector of FLYERS) {
    const stray = await page.locator(selector).evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return el.contains(hit) || hit === el;
    });
    expect(stray, `${selector}: an invisible hit target is left over the hole`).toBe(false);
  }

  // …and focus puts the pointer back. Probed on the HEADLINE at the halfway
  // playhead, which is where the geometry allows the probe to mean something:
  // the rescue restores a flyer to its REST box, and the sheet's hem clip cuts
  // that box off once the collapse has run past it (at 85% the sheet is a stub).
  // The pointer itself is restored at every playhead — asserted as a computed
  // style in the loop above — and so are the paint, the ring and the tab stop.
  await scrollProgress(page, 0.5);
  await link.evaluate((el: HTMLAnchorElement) => el.focus({ preventScroll: true }));
  await expect(page.locator(cta)).toHaveCSS('pointer-events', 'auto');
  const rescuedHit = await page.locator(invite).evaluate((el) => {
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
      shaderInfallAt, tidalAt, swirlAt,
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
        // The GPU is handed the FLOORED infall term (`shaderInfallAt`), so the
        // port has to use the same value: at p = 1 the pull diverges, and the
        // floor is what keeps a driver from multiplying 0 x inf at the anchor.
        const stretch = 1 + shaderInfallAt(p) + tidal;
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
