/* ============================================================================
   PERSONA MODEL RENDERING — vendored from nemosite.zip → Model/index.html.

   This file is the donor scene/model/shader logic, kept deliberately close to
   its source. The only module-integration edits are the static import sources,
   the exported scene hooks/constants, and BASE_URL-aware local asset URLs.
   Do not refactor shader math or rendering values; see PROVENANCE.md.
   ========================================================================== */

import { useRef, useMemo, useEffect, useState, useCallback, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


const MODEL_URL = `${import.meta.env.BASE_URL}models/persona-model/model.glb`;
// The glTF's forward axis is -X (character faces toward local +? we measured -X).
// Rotating the clone -90° about Y brings the face to point at the camera (front view).
const MODEL_ROTATION_Y = -Math.PI / 2; // Front facing view matching Tripo Studio default

const FLOAT_SPEED = 1.1;
const FLOAT_AMPLITUDE_BASE = 0.08;

const ORBIT_ROTATE_SPEED = 0.75;
const ORBIT_DAMPING_FACTOR = 0.08;

const VIEWPORT_FIT_FACTOR = 0.78; // Tighter bust shot framing like Tripo Studio
export const BASE_FOV = 32;
const MOBILE_FOV = 38;

const KEY_LIGHT_INTENSITY = 2.1;

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FLOAT_AMPLITUDE = REDUCED_MOTION ? 0 : FLOAT_AMPLITUDE_BASE;

// --- Torchlight sweep band ---------------------------------------------------
const HOLD_SCAN_DURATION = 1.4;
const HOLD_BAND_WIDTH_LEAD = 0.12;   // leading edge of the sweep band
const HOLD_BAND_WIDTH_TRAIL = 0.05;  // trailing edge of the sweep band
// The band is a horizontal stripe that sweeps vertically top -> bottom along the
// model's height axis (see installHoldShader), so no diagonal direction is needed.

// --- Side/front profile masking thresholds (view-space normal) ---------------
const HOLD_SIDE_MASK_MIN = 0.2;
const HOLD_SIDE_MASK_MAX = 0.655;
const HOLD_FRONT_MASK_MIN = 0.2;
const HOLD_FRONT_MASK_MAX = 0.8;

// --- Leftward mesh deformation ----------------------------------------------
// These are FRACTIONS of the model's own local size (not absolute units), so the
// deformation stays subtle regardless of the mesh's authoring scale. This asset's
// node carries a 100x scale while its raw positions span ~0.005 units — an
// absolute value here would fling the mesh off-screen (the "stretch" bug).
// Kept VERY LOW so the effect reads as a refined, gentle "breathing" at the
// silhouette edges rather than a distortion: peak ~1% of model size.
const HOLD_WARP_AMOUNT_BASE = 0.007;  // -X push as a fraction of model width
const HOLD_WARP_AMOUNT = REDUCED_MOTION ? 0 : HOLD_WARP_AMOUNT_BASE;
const HOLD_RIPPLE_AMOUNT_BASE = 0.002;  // high-frequency ripple as a fraction
const HOLD_RIPPLE_AMOUNT = REDUCED_MOTION ? 0 : HOLD_RIPPLE_AMOUNT_BASE;
const HOLD_RIPPLE_FREQ = 9.0;
const HOLD_RIPPLE_SPEED = 6.0;

// --- Specular flare / glossiness shift --------------------------------------
const HOLD_SPECULAR_BOOST = 2.4;   // multiply material reflectivity
const HOLD_ROUGHNESS_SHIFT = 0.5;  // lerp roughness toward 0.045 in the band
const HOLD_RIM_POWER = 2.8;
const HOLD_RIM_BOOST = 2.2;
const HOLD_FLARE_INTENSITY = 3.0;  // > 2.5 HDR near-white spike on passing edges

const HOLD_GLOW_COLOR = new THREE.Color('#ffd3e2');
const HOLD_GLOW_STRENGTH = 1.1;
const HOLD_DARKEN_BASE = 0.55;
const HOLD_DARKEN_SWING_BASE = 0.35;
const HOLD_DARKEN_SWING = REDUCED_MOTION ? HOLD_DARKEN_SWING_BASE * 0.3 : HOLD_DARKEN_SWING_BASE;

function createHoldUniforms() {
  return {
    uHoldElapsed: { value: 0 },
    uIsHeld: { value: 0 },
    uFlux: { value: 1 },
    uMinZ: { value: 0 },
    uMaxZ: { value: 1 },
    uScanDuration: { value: HOLD_SCAN_DURATION },
    uBandWidthLead: { value: HOLD_BAND_WIDTH_LEAD },
    uBandWidthTrail: { value: HOLD_BAND_WIDTH_TRAIL },
    uSideMaskMin: { value: HOLD_SIDE_MASK_MIN },
    uSideMaskMax: { value: HOLD_SIDE_MASK_MAX },
    uFrontMaskMin: { value: HOLD_FRONT_MASK_MIN },
    uFrontMaskMax: { value: HOLD_FRONT_MASK_MAX },
    uWarpAmount: { value: HOLD_WARP_AMOUNT },
    uRippleAmount: { value: HOLD_RIPPLE_AMOUNT },
    uRippleFreq: { value: HOLD_RIPPLE_FREQ },
    uRippleSpeed: { value: HOLD_RIPPLE_SPEED },
    uModelScale: { value: 1 },
    uSpecularBoost: { value: HOLD_SPECULAR_BOOST },
    uRoughnessShift: { value: HOLD_ROUGHNESS_SHIFT },
    uRimBoost: { value: HOLD_RIM_BOOST },
    uRimPower: { value: HOLD_RIM_POWER },
    uFlareIntensity: { value: HOLD_FLARE_INTENSITY },
    uGlowColor: { value: HOLD_GLOW_COLOR.clone() },
    uGlowStrength: { value: HOLD_GLOW_STRENGTH },
  };
}

function installHoldShader(material, uniforms) {
  if (material.userData.holdUniforms) {
    return material.userData.holdUniforms;
  }
  material.userData.holdUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    // ------------------------------------------------------------------ VERTEX
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
        #include <common>
        uniform float uHoldElapsed;
        uniform float uIsHeld;
        uniform float uMinZ;
        uniform float uMaxZ;
        uniform float uScanDuration;
        uniform float uBandWidthLead;
        uniform float uBandWidthTrail;
        uniform float uSideMaskMin;
        uniform float uSideMaskMax;
        uniform float uFrontMaskMin;
        uniform float uFrontMaskMax;
        uniform float uWarpAmount;
        uniform float uRippleAmount;
        uniform float uRippleFreq;
        uniform float uRippleSpeed;
        uniform float uModelScale;
        varying float vHoldSideMask;
        varying float vHoldSweepMask;
        varying vec3 vHoldViewNormal;
        `
      )
      .replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        {
          // ---- M_sweep: vertical sweep along the model's HEIGHT axis ----
          // The band is a horizontal stripe that travels top -> bottom as elapsed
          // advances. For this node (R_x(-90) then R_y(-90) then x100) local
          // position.z maps to world Y (screen vertical), so z is the height axis.
          // Progress is normalized over the local Z extent.
          float holdZSpan = 1.0 / max( uMaxZ - uMinZ, 1e-4 );
          float holdHeight = ( position.z - uMinZ ) * holdZSpan; // 0 = bottom, 1 = top

          // Sweep from the head (holdHeight=1) down to the feet (holdHeight=0) as
          // uHoldElapsed advances, i.e. top -> bottom over time. (Verified: higher
          // local Z = higher world Y = the head, so the band must DESCEND in height.)
          float holdProgress = 1.0 - fract( uHoldElapsed / max( uScanDuration, 1e-4 ) );
          float holdDelta = holdHeight - holdProgress;
          float holdBandMask = holdDelta >= 0.0
            ? 1.0 - smoothstep( 0.0, uBandWidthTrail, holdDelta )
            : 1.0 - smoothstep( 0.0, uBandWidthLead, -holdDelta );
          holdBandMask = clamp( holdBandMask, 0.0, 1.0 );

          // Side-only profile mask from the view-space normal:
          //   front faces (N_v.z -> 1.0) must evaluate to 0.
          vec3 holdViewN = normalize( normalMatrix * normal );
          float holdSideMask = smoothstep( uSideMaskMin, uSideMaskMax, abs( holdViewN.x ) )
                             * ( 1.0 - smoothstep( uFrontMaskMin, uFrontMaskMax, holdViewN.z ) );

          // Layered high-frequency ripple for the "breathing" silhouette.
          float holdRipple = sin( holdHeight * uRippleFreq - uHoldElapsed * uRippleSpeed );
          float holdRipple2 = sin( ( position.z ) * uRippleFreq * 0.6
                                 - uHoldElapsed * uRippleSpeed * 0.7 );
          float holdDispMask = holdBandMask * uIsHeld;

          // Displacement is a FRACTION (uWarpAmount/uRippleAmount) of the model's
          // local size (uModelScale), so it is scale-invariant. Applying it in local
          // units lets the node transform (this asset's 100x scale) carry it to world
          // space correctly instead of blowing the mesh off-screen.
          float holdWarpLocal = uWarpAmount * uModelScale;
          float holdRippleLocal = uRippleAmount * uModelScale;
          float holdDisplace = holdWarpLocal + holdRippleLocal * ( holdRipple * 0.5 + holdRipple2 * 0.35 );

          // Leftward push toward WORLD -X (screen-left), mapped to OBJECT space via the
          // inverse model matrix so it stays "leftward" regardless of the model's baked
          // rotation/scale. Front faces warp too (no side gate).
          vec3 holdLeftObj = normalize( mat3( inverse( modelMatrix ) ) * vec3( -1.0, 0.0, 0.0 ) );
          transformed += holdLeftObj * holdDisplace * holdDispMask;

          // Perturb the normal from the analytic partials of the ripple wave, along
          // the object-space displacement direction, so reflections catch the motion.
          float holdGradAxis = -holdDispMask * holdRippleLocal * 0.5 * uRippleFreq * holdZSpan
                             * cos( holdHeight * uRippleFreq - uHoldElapsed * uRippleSpeed );
          vec3 holdPerturbedObjN = normalize( normal - holdLeftObj * holdGradAxis * normal.x );

          vHoldSideMask = holdSideMask;
          vHoldSweepMask = holdBandMask;
          vHoldViewNormal = normalize( normalMatrix * holdPerturbedObjN );
        }
        `
      );

    // ---------------------------------------------------------------- FRAGMENT
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
        #include <common>
        uniform float uIsHeld;
        uniform float uFlux;
        uniform float uSideMaskMin;
        uniform float uSideMaskMax;
        uniform float uFrontMaskMin;
        uniform float uFrontMaskMax;
        uniform float uSpecularBoost;
        uniform float uRoughnessShift;
        uniform float uRimBoost;
        uniform float uRimPower;
        uniform float uFlareIntensity;
        uniform vec3 uGlowColor;
        uniform float uGlowStrength;
        varying float vHoldSideMask;
        varying float vHoldSweepMask;
        varying vec3 vHoldViewNormal;
        `
      )
      .replace(
        // Modulate the physical material BEFORE the direct/indirect light is solved,
        // so the glossiness shift actually feeds the specular response.
        '#include <lights_fragment_begin>',
        `
        {
          vec3 holdNV = normalize( vHoldViewNormal );
          float holdSide = smoothstep( uSideMaskMin, uSideMaskMax, abs( holdNV.x ) )
                         * ( 1.0 - smoothstep( uFrontMaskMin, uFrontMaskMax, holdNV.z ) );
          float holdActive = clamp( vHoldSweepMask * holdSide * uIsHeld, 0.0, 1.0 );

          // Glossiness shift: glossy + boosted reflectivity inside the sweep flare.
          material.roughness = max(
            mix( material.roughness, 0.045, holdActive * uRoughnessShift ), 0.03 );
          material.specularColor *= ( 1.0 + uSpecularBoost * holdActive );
          material.specularF90 = mix( material.specularF90, 1.0, holdActive * 0.6 );
        }
        #include <lights_fragment_begin>
        `
      )
      .replace(
        // Add the rim boost and near-white HDR flare as it hits passing edges.
        '#include <opaque_fragment>',
        `
        {
          // Dim the scene while held, leaving the torchlight flare to punch through.
          outgoingLight *= mix( 1.0, uFlux, uIsHeld );

          vec3 holdNV = normalize( vHoldViewNormal );
          float holdNdotV = clamp( dot( holdNV, geometryViewDir ), 0.0, 1.0 );
          float holdSide = smoothstep( uSideMaskMin, uSideMaskMax, abs( holdNV.x ) )
                         * ( 1.0 - smoothstep( uFrontMaskMin, uFrontMaskMax, holdNV.z ) );
          float holdActive = clamp( vHoldSweepMask * holdSide * uIsHeld, 0.0, 1.0 );

          // Rim-light boost, exclusively on the active side region.
          float holdRim = pow( 1.0 - holdNdotV, uRimPower );
          outgoingLight += uGlowColor * uGlowStrength * uRimBoost * holdRim * holdActive;

          // Near-white (> 2.5 HDR) specular spike on passing silhouette features
          // (ears, glasses frames, hoodie borders).
          float holdEdge = pow( 1.0 - holdNdotV, 1.7 ) * ( 0.35 + 0.65 * holdActive );
          outgoingLight += vec3( uFlareIntensity ) * holdEdge * holdActive;
        }
        #include <opaque_fragment>
        `
      );
  };

  material.needsUpdate = true;
  return uniforms;
}

export function ResponsiveRig() {
  const { camera, gl } = useThree();

  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    function handleResize() {
      const aspect = window.innerWidth / window.innerHeight;
      camera.fov = aspect < 0.72 ? MOBILE_FOV : BASE_FOV;
      camera.updateProjectionMatrix();
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [camera, gl]);

  return null;
}

function Model({ keyLightRef }) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);

  const fitRef = useRef();
  const floatRef = useRef();
  const normalizedScaleRef = useRef(1);

  const floatTimeRef = useRef(0);
  const holdElapsedRef = useRef(0);
  const isHeldRef = useRef(false);
  const [isHeld, setIsHeld] = useState(false);

  const holdUniforms = useRef(createHoldUniforms());

  const { scene, bottomY } = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // The vertex shader routes the torchlight beam using the LOCAL (object-space)
    // `position` attribute, so the sweep bounds must come from the geometry-local
    // AABBs — NOT the world-space box (which includes per-node rotation/scale and
    // would misalign the band on FBX2glTF / Tripo meshes that carry a 100x scale).
    // The vertical sweep uses the local axis that becomes world-up (here: local Z).
    const geomMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const geomMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    cloned.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      child.geometry.computeBoundingBox();
      const bb = child.geometry.boundingBox;
      geomMin.min(bb.min);
      geomMax.max(bb.max);
    });
    holdUniforms.current.uMinZ.value = geomMin.z;
    holdUniforms.current.uMaxZ.value = geomMax.z;
    // The leftward push is resolved in the shader from world -X via inverse(modelMatrix),
    // so no JS-side transform is needed here.
    // Deformation is expressed as a fraction of the model's LOCAL size, so the
    // shader multiplies uWarpAmount/uRippleAmount by this scale. Using the largest
    // local dimension keeps it robust across any mesh authoring scale.
    holdUniforms.current.uModelScale.value = Math.max(
      geomMax.x - geomMin.x,
      geomMax.y - geomMin.y,
      geomMax.z - geomMin.z,
      1e-4
    );

    const patchedMaterials = new Set();
    cloned.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (patchedMaterials.has(mat)) return;
        patchedMaterials.add(mat);
        holdUniforms.current = installHoldShader(mat, holdUniforms.current);
      });
    });

    cloned.position.sub(center);
    cloned.rotation.y = MODEL_ROTATION_Y;

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    normalizedScaleRef.current = 1 / maxDim;

    return { scene: cloned, bottomY: -size.y / 2 / maxDim };
  }, [gltf]);

  useFrame((state, delta) => {
    const { viewport } = state;
    const responsiveScale = Math.min(viewport.width, viewport.height) * VIEWPORT_FIT_FACTOR;
    fitRef.current.scale.setScalar(normalizedScaleRef.current * responsiveScale);

    if (!isHeldRef.current) {
      floatTimeRef.current += delta;
      floatRef.current.position.y = Math.sin(floatTimeRef.current * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    }

    if (isHeldRef.current) {
      holdElapsedRef.current += delta;
    }

    const flux = HOLD_DARKEN_BASE - HOLD_DARKEN_SWING * Math.cos(
      (Math.PI * holdElapsedRef.current) / HOLD_SCAN_DURATION
    );

    const u = holdUniforms.current;
    u.uHoldElapsed.value = holdElapsedRef.current;
    u.uIsHeld.value = isHeldRef.current ? 1 : 0;
    u.uFlux.value = flux;

    if (keyLightRef && keyLightRef.current) {
      keyLightRef.current.intensity = isHeldRef.current
        ? KEY_LIGHT_INTENSITY * flux
        : KEY_LIGHT_INTENSITY;
    }
  });

  const beginHold = useCallback(() => {
    holdElapsedRef.current = 0;
    isHeldRef.current = true;
    setIsHeld(true);
  }, []);

  const endHold = useCallback(() => {
    isHeldRef.current = false;
    setIsHeld(false);
  }, []);

  const handlePointerDown = useCallback((event) => {
    event.stopPropagation();
    beginHold();
  }, [beginHold]);

  const handlePointerUp = useCallback((event) => {
    event.stopPropagation();
    endHold();
  }, [endHold]);

  const handlePointerLeave = useCallback(() => {
    endHold();
  }, [endHold]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.code === 'Enter' || event.code === 'Space') && !isHeldRef.current) {
        beginHold();
      }
    }
    function onKeyUp(event) {
      if (event.code === 'Enter' || event.code === 'Space') {
        endHold();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [beginHold, endHold]);

  useEffect(() => {
    window.addEventListener('pointerup', endHold);
    window.addEventListener('pointercancel', endHold);
    return () => {
      window.removeEventListener('pointerup', endHold);
      window.removeEventListener('pointercancel', endHold);
    };
  }, [endHold]);

  return (
    <group ref={fitRef}>
      <ContactShadows
        position={[0, bottomY, 0]}
        opacity={0.32}
        scale={1.85}
        blur={2.5}
        far={1.7}
        resolution={768}
        color="#111316"
      />
      <group
        ref={floatRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <primitive object={scene} />
      </group>
    </group>
  );
}

export function Scene() {
  const keyLightRef = useRef();

  return (
    <>
      {/* Local HDR studio environment: keeps the improved PBR presentation available offline. */}
      <Environment
        files={`${import.meta.env.BASE_URL}models/persona-model/studio_small_08_1k.hdr`}
        environmentIntensity={0.88}
      />

      {/* Restrained studio key light retained for the original held-state modulation. */}
      <directionalLight
        ref={keyLightRef}
        position={[3.8, 5.5, 4.5]}
        intensity={KEY_LIGHT_INTENSITY}
        color="#fffaf4"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0001}
      />

      {/* Soft cool fill and restrained back light for material separation. */}
      <directionalLight
        position={[-3.5, 3.2, -4.5]}
        intensity={1.15}
        color="#cbd7ff"
      />
      <directionalLight
        position={[2.5, 4.2, -3.5]}
        intensity={1.4}
        color="#eef0ff"
      />
      <hemisphereLight args={["#d9dde2", "#1b1d20", 0.32]} />

      <Suspense fallback={null}>
        <Model keyLightRef={keyLightRef} />
      </Suspense>
    </>
  );
}
