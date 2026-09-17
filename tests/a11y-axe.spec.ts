import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* ---------------------------------------------------------------------------
   a11y-axe.spec.ts — DESIGN_AUDIT P0.2's regression gate.

   A page whose whole argument is craft cannot ship WCAG failures. This runs
   axe over the full document (post-boot, so the loader's overlay and the
   inert wiring are gone) at a desktop and a phone viewport and fails on any
   serious/critical violation.

   The exclusions below are deliberate debt with a named payoff in the audit
   roadmap — remove each entry when its section lands, do not add new ones:
     · (none). #rotunda was the last entry; it was removed when P2.1 landed
       (the sphere is now a labelled region with keyboard operation, an
       aria-hidden visual tree and a visually-hidden mirror list).
--------------------------------------------------------------------------- */

const PENDING_DEBT: readonly string[] = [];

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`accessibility @ ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('no serious or critical axe violations outside queued debt', async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto('/', { waitUntil: 'load' });

      // Boot owns the screen for a few seconds; scanning under the loader
      // would measure a page nobody has seen yet.
      await page
        .waitForFunction(() => !document.documentElement.classList.contains('is-booting'), undefined, {
          timeout: 30_000,
        })
        .catch(() => {
          /* If boot never releases, the scan below still runs — and the
             test has a bigger failure to report than this wait. */
        });

      // Let lazy canvases/observers mount before the snapshot.
      await page.waitForTimeout(600);

      let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
      for (const selector of PENDING_DEBT) builder = builder.exclude(selector);

      const results = await builder.analyze();
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        blocking.map((v) => `${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0]?.target?.join(' ')}`),
      ).toEqual([]);
    });
  });
}
