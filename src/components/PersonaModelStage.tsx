import { Component, Fragment, useEffect, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { BASE_FOV, ResponsiveRig, Scene } from '../three/persona-model/scene.jsx';

/* ============================================================================
   PersonaModelStage — the React mounting layer for the vendored character.

   The rendering logic (model fit, lights, HDR environment, controls, hold
   shader and its uniforms) lives verbatim-by-intent in
   src/three/persona-model/scene.jsx. This component owns only the work the
   standalone donor page cannot do inside the Hub: its scoped box, minimal
   loading/error UI, and Canvas lifecycle. Do not move scene values or shader
   math into this file; see src/three/persona-model/PROVENANCE.md.
   ========================================================================== */

type BoundaryState = {
  failed: boolean;
  attempt: number;
};

class PersonaModelBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Pick<BoundaryState, 'failed'> {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    // Keep the rest of PILLAR 4 (especially the chat) live if WebGL or an asset
    // fails. The unmodified scene remains the source of the actual error.
    console.error('[persona-model] stage failed to render:', error);
  }

  private retry = (): void => {
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      return (
        <div className="persona-model__failure" role="alert">
          <p>Character display unavailable.</p>
          <button className="persona-model__retry" type="button" onClick={this.retry}>
            Retry display
          </button>
        </div>
      );
    }

    // A fresh key re-creates Canvas on retry, rather than retaining a failed
    // renderer/context from the previous attempt.
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

function LoadingState() {
  const { active, progress } = useProgress();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!active && progress >= 100) {
      const timer = window.setTimeout(() => setHidden(true), 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [active, progress]);

  if (hidden) return null;

  return (
    <div className="persona-model__loading" aria-live="polite">
      <span className="persona-model__loader" aria-hidden="true" />
      <span>Loading character — {Math.min(99, Math.round(progress))}%</span>
    </div>
  );
}

export default function PersonaModelStage() {
  return (
    <div
      className="persona-model"
      role="group"
      aria-label="Interactive 3D character display"
      aria-describedby="persona-model-description"
    >
      <p className="persona-model__sr" id="persona-model-description">
        Interactive 3D character display. The figure floats gently, can be viewed from every angle
        by dragging, and glows and shifts while you press and hold it, or hold Enter or Space.
      </p>

      <PersonaModelBoundary>
        <Canvas
          className="persona-model__canvas"
          shadows={{ type: THREE.PCFSoftShadowMap }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0.15, 5.8], fov: BASE_FOV, near: 0.1, far: 100 }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
          }}
        >
          <ResponsiveRig />
          <Scene />
        </Canvas>
      </PersonaModelBoundary>

      <LoadingState />
    </div>
  );
}
