/* ---------------------------------------------------------------------------
   PERSONA MODEL — scoped mounting layer.

   The rendering implementation is vendored in src/three/persona-model and is
   intentionally not reinterpreted here. This component owns only the widget
   boundary: precomputed-point handoff, local failure state, accessible framing,
   and cleanup of the donor scene's document-level cursor side effect.
--------------------------------------------------------------------------- */

import { Component, useEffect, useState, type ReactNode } from 'react';
import { preloadPersonaPoints, type PersonaPointData } from '../lib/personaPoints';
import PersonaModelCanvas from '../three/persona-model/PersonaModelScene.jsx';

const DESCRIPTION_ID = 'persona-model-description';

class PersonaCanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[persona-model] character stage failed to render:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="persona-model__error" role="status">
          <strong>The character could not materialise.</strong>
          <span>The NEMO chat remains available beside this display.</span>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function PersonaModelStage() {
  const [pointData, setPointData] = useState<PersonaPointData | null>(null);

  useEffect(() => {
    let live = true;
    void preloadPersonaPoints().then(
      (data) => {
        if (live) setPointData(data);
      },
      () => {
        // App owns reporting for the singleton preload. A missing preview must
        // not prevent the independently loaded full model from appearing.
      },
    );
    return () => {
      live = false;
      // The donor changes body.cursor while its mesh is hovered. Always restore
      // the page cursor if the desktop gate unmounts during that hover.
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <div
      className="persona-model"
      role="group"
      tabIndex={0}
      aria-label="Interactive 3D character"
      aria-describedby={DESCRIPTION_ID}
    >
      <p className="sr-only" id={DESCRIPTION_ID}>
        Interactive 3D character display. A point-cloud silhouette appears while the detailed model
        loads. The figure floats gently, can be viewed from every angle by dragging, and glows and
        shifts while you press and hold it, or hold Enter or Space.
      </p>
      <PersonaCanvasBoundary>
        <PersonaModelCanvas pointData={pointData} />
      </PersonaCanvasBoundary>
    </div>
  );
}
