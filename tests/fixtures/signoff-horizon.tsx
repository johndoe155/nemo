// Test-only rig: real Footer/CSS/StrictMode, without the other expensive page
// scenes. ?real-stage uses the actual BlackHoleStage as an integration smoke.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsap } from 'gsap';
import Footer from '../../src/sections/Footer';
import Singularity from '../../src/sections/Singularity';
import {
  SingularityProvider,
  useSingularityGate,
  type BlackHoleStageStatus,
} from '../../src/lib/singularityGate';
import '@fontsource-variable/space-grotesk';
import '@fontsource/michroma';
import '../../src/assets/fonts/pp-fonts.css';
import '../../src/styles/global.css';
import '../../src/styles/components.css';
import '../../src/styles/overhaul.css';
import '../../src/styles/motion.css';
import '../../src/styles/typography.css';
import '../../src/styles/blackhole.css';

function ControlledStage({ status }: { status: BlackHoleStageStatus }) {
  const { frameRef, holdRef, reportStatus, isMobile } = useSingularityGate();
  useEffect(() => {
    reportStatus(isMobile ? 'booting' : status);
    return () => reportStatus('booting');
  }, [reportStatus, status, isMobile]);
  if (isMobile) return null;
  // The rig has to reproduce the section's structure EXACTLY, including the
  // `.bh-hold` reservation the consumption scene pays for: `holdRef` is what the
  // effect reads to find the box it grows, and a fixture without it silently has
  // no hold at all (the scene stands down, the footer stays plain, and every
  // pinned-scene assertion in the suite would be proving nothing).
  return (
    <>
      <div className="bh-hold" ref={holdRef} aria-hidden="true" />
      <section className="section singularity" id="singularity">
        <div className="bh-frame" ref={frameRef}>
          <div className="bh-stage" data-status={status} />
        </div>
      </section>
    </>
  );
}

/* The rig has to be a CHILD of `SingularityProvider`: `useSingularityGate()`
 * throws when it is called above the provider it reads (the context is null at
 * that point in the tree), which is exactly how this fixture came to render
 * nothing at all — every Playwright test in `tests/signoff-horizon.spec.ts`
 * died on `waitForFunction(() => window.horizonFixture)` before a single
 * assertion ran, and the whole pinning architecture therefore went unverified.
 * State lives in `Fixture`, the context is consumed here. */
function Rig({
  status,
  mounted,
  setStatus,
  setMounted,
}: {
  status: BlackHoleStageStatus;
  mounted: boolean;
  setStatus(s: BlackHoleStageStatus): void;
  setMounted(m: boolean): void;
}) {
  // Exposed so the suite can assert the other half of "the black hole stays
  // rigidly anchored and static": the pin holds the container's box, and this
  // ref is what holds the stage's cinematic camera inside it for exactly as long
  // as the screen is locked. `ControlledStage` has no camera of its own — the
  // ref is driven by the pinned frame, not by the stage — and `?real-stage`
  // hands the same ref to the actual BlackHoleStage.
  const { cameraHoldRef } = useSingularityGate();
  useEffect(() => {
    Object.assign(window, {
      horizonFixture: { setStatus, setMounted, ScrollTrigger, gsap, cameraHoldRef },
    });
  }, [cameraHoldRef, setStatus, setMounted]);
  return (
    <>
      <main>
        <div style={{ height: '110vh' }} id="nemoverse"><a href="#connect">Before the sign-off</a></div>
        {new URLSearchParams(location.search).has('real-stage')
          ? <Singularity />
          : <ControlledStage status={status} />}
      </main>
      {mounted && <Footer />}
    </>
  );
}

function Fixture() {
  const [status, setStatus] = useState<BlackHoleStageStatus>(() =>
    (new URLSearchParams(location.search).get('status') as BlackHoleStageStatus) ?? 'live',
  );
  const [mounted, setMounted] = useState(true);
  return (
    <SingularityProvider>
      <Rig
        status={status}
        mounted={mounted}
        setStatus={setStatus}
        setMounted={setMounted}
      />
    </SingularityProvider>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture /></React.StrictMode>);
