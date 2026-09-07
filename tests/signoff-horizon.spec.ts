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

async function open(page: Page, query = '') {
  await page.goto(fixture + query);
  await page.waitForFunction(() => Boolean(window.horizonFixture));
  await page.evaluate(() => document.fonts.ready);
}

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

async function expectPlain(page: Page) {
  await expect(page.locator(overlay)).toHaveCount(0);
  await expect(page.locator(root)).not.toHaveAttribute('data-horizon-paint');
  await expect(page.locator('.signoff__anchor')).toHaveCSS('opacity', '1');
  // A killed pinned ScrollTrigger must also revert its pin: the spacer is
  // gone and the footer is an ordinary in-flow child again.
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

test('one snapshot/texture; measured seam timing; reversible scrub; geometric full consumption', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.horizonStats.captures)).toBe(0);
  await scrollProgress(page, 0);
  const alignment = await page.evaluate(() => {
    const footer = document.querySelector('.signoff')!;
    const box = footer.getBoundingClientRect();
    const frame = document.querySelector('.bh-frame')!;
    const seam = parseFloat(getComputedStyle(frame, '::after').height);
    const anchor = Math.max(0, frame.getBoundingClientRect().bottom + seam - box.top);
    const trigger = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!;
    const spacer = footer.parentElement;
    return {
      // Pin start: the WHOLE invitation is on screen (footer top at
      // viewportHeight - footerHeight - seam, one seam of air below it),
      // with the Singularity stage still filling the top of the view.
      startError: Math.abs(box.top + anchor - Math.max(seam * 2, innerHeight - box.height - seam)),
      travel: trigger.end - trigger.start,
      expectedTravel: innerHeight - seam * 2,
      pinIsFooter: trigger.pin === footer,
      footerInSpacer: Boolean(spacer?.classList.contains('pin-spacer')),
      // pinSpacing must grant the spacer EXACTLY the pinned distance, so the
      // curtain below the sign-off never shifts when the pin engages.
      pinnedPadding: (spacer?.getBoundingClientRect().height ?? 0) - box.height,
    };
  });
  expect(alignment.startError).toBeLessThan(1);
  expect(alignment.travel).toBe(alignment.expectedTravel);
  expect(alignment.pinIsFooter).toBe(true);
  expect(alignment.footerInSpacer).toBe(true);
  expect(alignment.pinnedPadding).toBeCloseTo(alignment.travel, 0);
  await expect(page.locator('.signoff__anchor')).toHaveCSS('opacity', '1');
  await scrollProgress(page, 0.5);
  await expect(page.locator('.signoff__anchor')).toHaveCSS('opacity', '0');
  await expect(page.locator(overlay)).toHaveCSS('pointer-events', 'none');
  const canvasBox = await page.locator(overlay).boundingBox();
  expect(canvasBox).toEqual(await page.locator(root).boundingBox());
  // THE PIN: the section is locked in place — position:fixed, and the exact
  // same viewport box while scroll (and the playhead) keep advancing.
  const locked = await page.evaluate(() => ({
    position: getComputedStyle(document.querySelector('.signoff')!).position,
    top: document.querySelector('.signoff')!.getBoundingClientRect().top,
    scrollY,
  }));
  expect(locked.position).toBe('fixed');
  await scrollProgress(page, 0.75);
  const stillLocked = await page.evaluate(() => ({
    top: document.querySelector('.signoff')!.getBoundingClientRect().top,
    scrollY,
  }));
  expect(stillLocked.top).toBeCloseTo(locked.top, 6);
  expect(stillLocked.scrollY).toBeGreaterThan(locked.scrollY);
  await scrollProgress(page, 0.5);

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
  expect((await pixels()).painted).toBe(0);
  await scrollProgress(page, 0.5);
  expect(await pixels()).toEqual(middle);
  await scrollProgress(page, 0);
  await expect(page.locator('.signoff__anchor')).toHaveCSS('opacity', '1');
  // Scrolling past the pinned distance releases the pin: the footer returns
  // to normal flow and continues to the curtain, fully consumed.
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

test('the SAME real CTA accepts Tab, Shift-Tab, Enter and pointer clicks at 0/50/100%; AX tree stays exposed', async ({ page }) => {
  await open(page);
  await scrollProgress(page, 0.5);
  const link = page.locator('.signoff a');
  await page.evaluate(() => {
    // Freeze only the scroll driver to test each paint state with the CTA on
    // screen. Actual reversible scrolling is exercised in the previous test.
    // disable(true) also reverts the pin, returning the pinned sign-off from
    // its fixed position to natural flow — the CTA sits below the fold for
    // the whole pin, so the interaction checks need the un-pinned layout.
    window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!.disable(true);
    const footer = document.querySelector('.signoff')!;
    window.scrollTo({ top: footer.getBoundingClientRect().top + scrollY - 80, behavior: 'instant' });
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
      (document.activeElement as HTMLElement)?.blur();
      const animation = window.horizonFixture.ScrollTrigger.getById('signoff-horizon')!.animation!;
      animation.pause().progress(p === 0 ? 0.001 : 0);
      animation.progress(p);
    }, progress);
    await expect(page.locator(root)).toHaveAttribute('data-horizon-progress', progress.toFixed(4));
    await expect(link).toHaveAttribute('href', '#nemoverse');
    await expect(link).toHaveAccessibleName('Explore the universes');
    const ax = await cdp.send('Accessibility.getFullAXTree');
    expect(ax.nodes.some((node) => !node.ignored && node.role?.value === 'link' && node.name?.value === 'Explore the universes')).toBe(true);
    expect(await link.evaluate((el) => el.closest('[aria-hidden="true"], [inert], [hidden]'))).toBeNull();
    const targetIsRealLink = await link.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2));
    });
    expect(targetIsRealLink).toBe(true);
    await link.click();
    await expect.poll(() => page.evaluate(() => window.horizonClicks)).toBe(++clicks);
    await page.locator('#nemoverse a').evaluate((el: HTMLAnchorElement) => el.focus({ preventScroll: true }));
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(page.locator('.signoff__anchor')).toHaveCSS('opacity', '1');
    await expect(page.locator(overlay)).toHaveCSS('opacity', '0');
    await expect(link).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.horizonClicks)).toBe(++clicks);
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#nemoverse a')).toBeFocused();
  }
});

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

test('WebGL2 pixels agree with an independent CPU port of the vendored ODE', async ({ page }) => {
  await open(page, '?status=unsupported');
  const result = await page.evaluate(async () => {
    const { createEventHorizonWarp, horizonRadiusAtProgress, HORIZON_STEPS } = await import('/src/three/eventHorizonWarp.ts');
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
    const geometry = { width: source.width, height: source.height, anchorX: 256, anchorY: 20, seam: 60 };
    const warp = createEventHorizonWarp(source, () => {});
    const gl = warp.canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(source.width * source.height * 4);
    let maxError = 0, checks = 0, captureChecks = 0, escapeChecks = 0;
    const rs = physics.blackHoleMass * 2;
    // Float64 reference. Initial conditions and plane conversion are explicit;
    // the physical coefficients come from the config, never test literals.
    const trace = (x: number, y: number, radius: number): [number, number] | null => {
      if (!radius) return [x, y];
      const scale = radius / rs;
      const px = (x - geometry.anchorX) / scale;
      const py = (y - geometry.anchorY) / scale;
      if (Math.hypot(px, py) < rs * 1.01) return null;
      let rx = px, ry = py + physics.stepSize * HORIZON_STEPS;
      let dx = 0, dy = -1, remaining = HORIZON_STEPS;
      for (let i = 0; i < HORIZON_STEPS; i++) {
        const r = Math.hypot(rx, ry);
        if (r < rs * 1.01) return null;
        if (r > 100) { escapeChecks++; break; }
        const bend = rs / (r * r) * physics.stepSize * physics.gravitationalLensing;
        dx += (-rx / r) * bend;
        dy += (-ry / r) * bend;
        const length = Math.hypot(dx, dy);
        dx /= length; dy /= length;
        rx += dx * physics.stepSize; ry += dy * physics.stepSize;
        remaining--;
      }
      if (Math.hypot(rx, ry) < rs * 1.01) return null;
      rx += dx * physics.stepSize * remaining;
      ry += dy * physics.stepSize * remaining;
      const tx = geometry.anchorX + rx * scale;
      const ty = geometry.anchorY + ry * scale;
      return tx < 0 || ty < 0 || tx > source.width || ty > source.height ? null : [tx, ty];
    };
    for (const p of [0, 0.001, 0.25, 0.5, 0.75, 1]) {
      warp.draw(p, geometry);
      gl.readPixels(0, 0, source.width, source.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let y = 7; y < source.height; y += 23) for (let x = 5; x < source.width; x += 29) {
        const landed = trace(x + 0.5, y + 0.5, horizonRadiusAtProgress(p, geometry));
        const i = ((source.height - 1 - y) * source.width + x) * 4;
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
    warp.dispose();
    return { maxError, checks, captureChecks, escapeChecks, lost: gl.isContextLost() };
  });
  expect(result.checks).toBeGreaterThan(1000);
  expect(result.captureChecks).toBeGreaterThan(100);
  expect(result.escapeChecks).toBeGreaterThan(0);
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
      warp.draw(0, { width: box.width, height: box.height, anchorX: box.width / 2, anchorY: 0, seam: 60 });
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
