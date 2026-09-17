/* ---------------------------------------------------------------------------
   The boot gate for the hero's particle field (DESIGN_AUDIT P7).

   The field used to carry its OWN loading overlay — brand, spinner, status
   line — which the boot merely suppressed while it owned the screen, so the
   overlay reappeared the instant the boot released and painted a second
   loader across the hero. What replaced it is this gate: the field reports,
   the boot waits for it, capped. The contract below is what the loader leans
   on, and the last test is the guard that catches the overlay coming back.
=========================================================================== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { particleFieldReady, particleFieldSettled, settleParticleField } from '../../src/lib/particleGate';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'src');
const until = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* One test, sequenced in subtests: the module holds exactly one promise for
   the life of the page, so its states have to be exercised in order. */
test('the boot gate: pending → capped → released, and it never re-arms', async (t) => {
  assert.equal(particleFieldSettled(), false, 'nothing has reported yet');

  await t.test('a field that never reports can only hold the boot until the cap', async () => {
    const t0 = Date.now();
    await particleFieldReady(60);
    const waited = Date.now() - t0;
    assert.ok(waited >= 45, `the cap is a real wait, not a no-op (${waited}ms)`);
    assert.ok(waited < 1000, `and it is honoured, not open-ended (${waited}ms)`);
  });

  await t.test('a gate still waiting on the field does not resolve early', async () => {
    let released = false;
    void particleFieldReady(5000).then(() => {
      released = true;
    });
    await until(40);
    assert.equal(released, false, 'the loader is still holding, as intended');
  });

  await t.test('the field reporting releases every waiter without the cap', async () => {
    const waiters = Promise.all([particleFieldReady(5000), particleFieldReady(5000)]);
    settleParticleField();
    await waiters;
    assert.equal(particleFieldSettled(), true);
  });

  await t.test('once released it is a no-op, and a second report cannot re-arm it', async () => {
    const t0 = Date.now();
    await particleFieldReady(5000);
    assert.ok(Date.now() - t0 < 30, 'resolved immediately — no second wait');
    settleParticleField();
    assert.equal(particleFieldSettled(), true, 'still released');
  });
});

test('the field has no loader of its own: the boot owns the wait (P7)', () => {
  /* The regression this guards is the invisible one: the overlay only ever
     showed when the field outlasted the boot, so a re-added veil would pass
     every fast-machine eyeball test and reappear in the field on a cold
     cache — exactly the flash this pass removed. */
  const field = readFileSync(join(SRC, 'components', 'NemoParticleField.tsx'), 'utf8');
  assert.doesNotMatch(field, /nemo-field__loading/, 'no loading overlay markup');
  assert.doesNotMatch(field, /nemo-field__spinner/, 'no spinner to put in one');
  assert.match(field, /settleParticleField/, 'the field reports through the gate');
  for (const cb of ['onReady', 'onError', 'onUnsupported']) {
    assert.match(
      field,
      new RegExp(`${cb}: \\(\\) => settleBoot\\(`),
      `${cb} reaches the gate — every terminal state must release the boot`,
    );
  }

  /* No orphaned veil styles, in either stylesheet that could hide one. */
  for (const sheet of ['nemo-particles.css', 'loader.css']) {
    const css = readFileSync(join(SRC, 'styles', sheet), 'utf8');
    assert.doesNotMatch(css, /nemo-field__loading|npfLoadspin/, `${sheet} carries no veil rules`);
  }

  /* And the boot actually waits on it. */
  const loader = readFileSync(join(SRC, 'components', 'Loader.tsx'), 'utf8');
  assert.match(loader, /import \{ particleFieldReady \}/, 'the loader imports the gate');
  assert.match(
    loader,
    /Promise\.all\(\[fontsReady, particleFieldReady\(/,
    'and the release waits on the field as well as the fonts',
  );
});
