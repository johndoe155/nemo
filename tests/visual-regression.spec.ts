import { test, expect, type Page } from '@playwright/test';

/* ---------------------------------------------------------------------------
   visual-regression.spec.ts — the motion-safe pixel gate (DESIGN_AUDIT P5.20).

   "so this level of craft survives future edits": the spec extends the
   signoff-horizon pattern — fixed clock, scroll-to-section, pause-everything,
   compare — from the one bespoke section to the crafted surfaces of the
   whole page. Determinism is engineered, not hoped for:

     · reducedMotion: 'reduce' — the house veto; marquees, glows and the
       sphere's spin are all motion-safe OFF states, so the page settles.
     · a frozen Date.now / no-arg new Date (addInitScript) — the countdown
       renders a constant string. Deliberately NOT page.clock: the clock API
       fakes requestAnimationFrame too, and that would strand every framer
       entrance mid-tween instead of at its resting state.
     · a seeded Math.random — the pulls starfield and any sampled scatter
       become repeatable sequences.
     · animations are force-paused (getAnimations + the Lenis engine stops
       by policy under reduce, so no chase frames survive the settle wait).
     · the boot is SKIPPED with one keypress — P2.10's skip makes the entry
       state instantly reachable and deterministic (no race with the timeline).

   Baselines: seed once on CI with
       npx playwright test visual-regression --update-snapshots
   and commit tests/visual-regression.spec.ts-snapshots/. Nothing is
   asserted about GPU-composited 3D (persona/blackhole interiors) — that
   territory belongs to the fixture-driven signoff-horizon suite, which
   measures engine behaviour, not pixels.

   This file runs in CI only (npm run test:visual), same policy as the axe
   gate: no local browser is assumed.
--------------------------------------------------------------------------- */

test.use({
  reducedMotion: 'reduce',
  viewport: { width: 1280, height: 900 },
});

const SEED = '2026-09-15T12:00:00.000Z';

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // one paint cycle after fonts so late metric swaps are on the canvas…
  await page.waitForTimeout(350);
  // …then freeze every running animation (CSS + WAAPI) and the marquees.
  await page.evaluate(() => {
    for (const a of document.getAnimations({ subtree: true })) {
      try {
        a.pause();
      } catch {
        /* finished/disconnected — already still */
      }
    }
  });
  await page.waitForTimeout(120);
}

async function boot(page: Page) {
  await page.addInitScript(
    ([frozen]) => {
      const FROZEN = Number(frozen);
      const RealDate = Date as DateConstructor & { now(): number };
      RealDate.now = () => FROZEN;
      class FrozenDate extends (Date as unknown as { new (...args: number[]): Date }) {
        constructor(...args: number[]) {
          if (args.length === 0) super(FROZEN);
          else super(...(args as [number]));
        }
      }
      (window as unknown as { Date: unknown }).Date = FrozenDate;
      /* deterministic PRNG for anything sampling Math.random */
      let seed = 1013904223;
      Math.random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
    },
    [String(Date.parse(SEED))],
  );
  await page.goto('/');
  /* Skip the choreography (P2.10): any key jumps the timeline to its final
     frame; the font-gated settle still runs through its normal path. */
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-booting'), null, {
    timeout: 15_000,
  });
  await page.evaluate(() => document.querySelector('main')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await settle(page);
}

async function gotoSection(page: Page, id: string, block: ScrollLogicalPosition = 'start') {
  await page.evaluate(
    ([i, b]) => document.getElementById(i)?.scrollIntoView({ behavior: 'instant', block: b as ScrollLogicalPosition }),
    [id, block] as const,
  );
  await settle(page);
}

test.describe('motion-safe visual regression', () => {
  test('boot lands on the finished loader state, not a mid-tween frame', async ({ page }) => {
    await boot(page);
    await expect(page.locator('.ldr')).toHaveCount(0);
  });

  test('hero — title block, badge rail and particle field at rest', async ({ page }) => {
    await boot(page);
    await expect(page).toHaveScreenshot('hero.png');
  });

  test('roster — pinned rail at its head with cards hung', async ({ page }) => {
    await boot(page);
    await gotoSection(page, 'nemoverse');
    // one viewport into the pin: the carriage owns the frame, cards at rest
    await page.evaluate(() => window.scrollBy({ top: window.innerHeight * 0.4, behavior: 'instant' }));
    await settle(page);
    await expect(page).toHaveScreenshot('roster-head.png');
  });

  test('rotunda — reduced motion renders the flat plate grid (P2.1)', async ({ page }) => {
    await boot(page);
    await gotoSection(page, 'rotunda');
    await expect(page).toHaveScreenshot('rotunda-flat.png');
  });

  test('pulls — idle ledger, empty slots, radar at rest', async ({ page }) => {
    await boot(page);
    await gotoSection(page, 'pulls');
    await expect(page).toHaveScreenshot('pulls-idle.png');
  });

  test('store — product grid with the demo-wallet chip state', async ({ page }) => {
    await boot(page);
    await gotoSection(page, 'store');
    await expect(page).toHaveScreenshot('store.png');
  });

  test('dialog — opening a universe card morphs the plate in and holds', async ({ page }) => {
    await boot(page);
    await gotoSection(page, 'nemoverse');
    const card = page.locator('.ucard').first();
    await card.click();
    await page.waitForSelector('.dialog', { state: 'visible' });
    await settle(page);
    await expect(page).toHaveScreenshot('dialog.png');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.dialog', { state: 'detached' });
  });

  test('sign-off footer — curtain at rest', async ({ page }) => {
    await boot(page);
    await gotoSection(page, 'connect', 'end');
    await expect(page).toHaveScreenshot('footer.png');
  });
});
