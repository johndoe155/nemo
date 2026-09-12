/* ---------------------------------------------------------------------------
   PERSONA MODEL — scoped mounting layer.

   The rendering implementation is vendored in src/three/persona-model and is
   intentionally not reinterpreted here. This component owns only the widget
   boundary: local loading/error states, accessible framing, and cleanup of the
   donor scene's document-level cursor side effect.
--------------------------------------------------------------------------- */

import { Component, useEffect, useState, type ReactNode } from 'react';
import { useProgress } from '@react-three/drei';
import PersonaModelCanvas from '../three/persona-model/PersonaModelScene.jsx';

const DESCRIPTION_ID = 'persona-model-description';

function PersonaModelLoading() {
  const { active, progress } = useProgress();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (active || progress < 100) {
      setHidden(false);
      return;
    }

    const timer = window.setTimeout(() => setHidden(true), 350);
    return () => window.clearTimeout(timer);
  }, [active, progress]);

  return (
    <div
      className={`persona-model__loading${hidden ? ' is-hidden' : ''}`}
      aria-hidden={hidden}
      aria-live="polite"
    >
      <span className="persona-model__loader" aria-hidden="true" />
      <span className="persona-model__loading-label">
        Loading character — {Math.min(99, Math.round(progress))}%
      </span>
    </div>
  );
}

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
  useEffect(
    () => () => {
      // The donor changes body.cursor while its mesh is hovered. Always restore
      // the page cursor if the desktop gate unmounts while that hover is active.
      document.body.style.cursor = '';
    },
    [],
  );

  return (
    <div
      className="persona-model"
      role="group"
      tabIndex={0}
      aria-label="Interactive 3D character"
      aria-describedby={DESCRIPTION_ID}
    >
      <p className="sr-only" id={DESCRIPTION_ID}>
        Interactive 3D character display. The figure floats gently, can be viewed from every angle
        by dragging, and glows and shifts while you press and hold it, or hold Enter or Space.
      </p>
      <PersonaModelLoading />
      <PersonaCanvasBoundary>
        <PersonaModelCanvas />
      </PersonaCanvasBoundary>
    </div>
  );
}
