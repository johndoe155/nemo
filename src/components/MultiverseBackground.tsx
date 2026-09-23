import { useEffect, useRef } from 'react';
import { mountMultiverseBackground } from '../background/multiverseBackground';
import { observeScenes } from '../lib/scenes';
import { pageScrollTo } from '../lib/scroll';

/* The page background. Replaces Ambience + Starfield: one WebGL2 field (the
   donor's 2D canvases if WebGL2 or float targets are missing), driven by the
   page's own scroller. District tints still come from observeScenes — the
   body and the card lines read html[data-scene] even though the nebula
   washes no longer mount. */
export default function MultiverseBackground() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const stopScenes = observeScenes();
    const stop = mountMultiverseBackground(node, { pageScrollTo });
    return () => {
      stop();
      stopScenes();
    };
  }, []);

  return (
    <div className="mv-bg" ref={host} aria-hidden="true">
      <canvas id="gl" />
      <canvas id="scene" />
      <canvas id="particles" />
      <div id="vignette" />
      <div id="grain" />
    </div>
  );
}
