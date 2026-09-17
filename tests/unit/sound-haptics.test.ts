import test from 'node:test';
import assert from 'node:assert/strict';

import { SOUND, onSoundScrollTick, emitScrollTick, isSoundEnabled } from '../../src/lib/sound';
import { haptic, HAPTIC } from '../../src/lib/haptics';
import { SCENE_TINTS } from '../../src/lib/scenes';

/* P4.15 — the registry is the contract: components call named voices, the
   tuning lives HERE. These tests pin the shape so a refactor can't silently
   move frequencies back into a component's props. */

test('sound registry carries every diegetic voice the audit names', () => {
  for (const voice of ['attract', 'confirm', 'rodRing', 'stampThud', 'whoosh', 'nearMiss', 'gravity'] as const) {
    assert.ok(voice in SOUND, `SOUND.${voice} missing`);
  }
  // gravity bed stays inside the audit's 40–60 Hz window
  assert.ok(SOUND.gravity.a >= 40 && SOUND.gravity.a <= 60);
  assert.ok(SOUND.gravity.b >= 40 && SOUND.gravity.b <= 60);
  // the rod ring maps speed monotonically and stays capped
  const freqAt = (v: number) => Math.min(SOUND.rodRing.max, SOUND.rodRing.base + v * SOUND.rodRing.perUnit);
  assert.ok(freqAt(0.5) > freqAt(0.2));
  assert.equal(freqAt(99), SOUND.rodRing.max);
});

test('sound is disabled until explicitly enabled (no autoplay exposure)', () => {
  assert.equal(isSoundEnabled(), false);
});

test('the scroll bridge round-trips without a DOM (node-safe)', () => {
  let ticks = 0;
  const off = onSoundScrollTick(() => ticks++);
  emitScrollTick();
  assert.equal(ticks, 1);
  off();
  emitScrollTick();
  assert.equal(ticks, 1, 'unsubscribed handler must not fire');
});

test('haptics are feature-detected and never throw where vibrate is absent', () => {
  assert.equal(typeof HAPTIC.stamp, 'number');
  assert.deepEqual([...HAPTIC.reveal], [4, 24, 10]);
  assert.equal(HAPTIC.dialogOpen, 6);
  // node has navigator (21+) but no vibrate: the util returns false, it does not throw
  assert.equal(haptic(8), typeof navigator !== 'undefined' && 'vibrate' in navigator);
});

test('every scene district ships a CSS-shell tint pair (audit 1.4)', () => {
  const ids = Object.keys(SCENE_TINTS);
  assert.ok(ids.length >= 8, 'all eight districts present');
  for (const id of ids) {
    const t = SCENE_TINTS[id as keyof typeof SCENE_TINTS];
    assert.match(t.bg, /^#[0-9a-f]{6}$/i, `${id}: bg must be a hex`);
    assert.match(t.line, /^rgba?\(/, `${id}: line must be a translucent colour`);
  }
});
