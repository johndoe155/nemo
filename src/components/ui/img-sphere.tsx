import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motionValue, useMotionValueEvent, useVelocity, useReducedMotion, type MotionValue } from 'framer-motion';
import { useFocusTrap } from '@/lib/hooks';
import { lockPage, unlockPage } from '@/lib/scroll';
import { haptic, HAPTIC } from '@/lib/haptics';

/* MotionValue stand-in so the gust channel's hooks run unconditionally when
   no scroll-gust is wired (DESIGN_AUDIT P3.2b). */
const ZERO = motionValue(0);

/**
 * SphereImageGrid - Interactive 3D Image Sphere Component
 *
 * A React TypeScript component that displays images arranged in a 3D sphere layout.
 * Images are distributed using Fibonacci sphere distribution for optimal coverage.
 * Supports drag-to-rotate, momentum physics, auto-rotation, and modal image viewing.
 *
 * Features:
 * - 3D sphere layout with Fibonacci distribution for even image placement
 * - Smooth drag-to-rotate interaction with momentum physics
 * - Auto-rotation capability with configurable speed
 * - Dynamic scaling based on position and visibility
 * - Collision detection to prevent image overlap
 * - Modal view for enlarged image display
 * - Touch support for mobile devices
 * - Customizable appearance and behavior
 * - Performance optimized with proper z-indexing and visibility culling
 *
 * Usage:
 * ```tsx
 * <SphereImageGrid
 *   images={imageArray}
 *   containerSize={600}
 *   sphereRadius={200}
 *   autoRotate={true}
 *   dragSensitivity={0.8}
 * />
 * ```
 */

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface SphericalPosition {
  theta: number;  // Azimuth angle in degrees
  phi: number;    // Polar angle in degrees
  radius: number; // Distance from center
}

export interface WorldPosition extends Position3D {
  scale: number;
  zIndex: number;
  isVisible: boolean;
  fadeOpacity: number;
  originalIndex: number;
}

export interface ImageData {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
}

export interface SphereImageGridProps {
  images?: ImageData[];
  containerSize?: number;
  sphereRadius?: number;
  dragSensitivity?: number;
  momentumDecay?: number;
  maxRotationSpeed?: number;
  baseImageScale?: number;
  hoverScale?: number;
  perspective?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  className?: string;
  /** Page-scroll position (px). Its velocity nudges the idle spin — the
   *  rotunda keeps a little momentum from simply being scrolled past
   *  (the same gust channel the hanging roster cards consume). */
  gust?: MotionValue<number>;
  /** Region label for assistive tech; the keyboard contract is appended. */
  ariaLabel?: string;
  /** Fires when a plate is being inspected. The rotunda is a museum volume:
   *  while one work is under the spotlight the section quiets everything
   *  around the stage. */
  onInspect?: (inspecting: boolean) => void;
}

interface RotationState {
  x: number;
  y: number;
  z: number;
}

interface VelocityState {
  x: number;
  y: number;
}

interface MousePosition {
  x: number;
  y: number;
}

const SPHERE_MATH = {
  degreesToRadians: (degrees: number): number => degrees * (Math.PI / 180),
  radiansToDegrees: (radians: number): number => radians * (180 / Math.PI),

  sphericalToCartesian: (radius: number, theta: number, phi: number): Position3D => ({
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta)
  }),

  calculateDistance: (pos: Position3D, center: Position3D = { x: 0, y: 0, z: 0 }): number => {
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    const dz = pos.z - center.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  normalizeAngle: (angle: number): number => {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }
};

const SphereImageGrid: React.FC<SphereImageGridProps> = ({
  images = [],
  containerSize = 400,
  sphereRadius = 200,
  dragSensitivity = 0.5,
  momentumDecay = 0.95,
  maxRotationSpeed = 5,
  baseImageScale = 0.12,
  hoverScale = 1.2,
  perspective = 1000,
  autoRotate = false,
  autoRotateSpeed = 0.3,
  className = '',
  gust,
  ariaLabel,
  onInspect
}) => {
  const reduce = useReducedMotion() ?? false;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [rotation, setRotation] = useState<RotationState>({ x: 15, y: 15, z: 0 });
  const [velocity, setVelocity] = useState<VelocityState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [imagePositions, setImagePositions] = useState<SphericalPosition[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  /* THE OVERHAUL'S "SPOTLIGHT INSPECTION" (blueprint §3.6). The rotunda is a
     museum volume, not a browser: while one plate is being inspected, every
     other plate quiets (dims and desaturates) so the hovered work is the only
     lit object on the sphere. `onInspect` lets the section quiet the room
     around the stage too (its hint line, its badges) from one signal. */
  const [inspecting, setInspecting] = useState(false);
  /* Read inside the per-frame loop that already owns rotation, so stopping
     the ambient spin schedules nothing new. */
  const inspectingRef = useRef(false);
  inspectingRef.current = inspecting;
  useEffect(() => {
    onInspect?.(inspecting);
  }, [inspecting, onInspect]);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef<MousePosition>({ x: 0, y: 0 });
  const animationFrame = useRef<number | null>(null);

  /* ---- keyboard + gust state (DESIGN_AUDIT P2.1) -------------------------
     stepTarget: a pending rotation goal the per-frame loop eases toward —
     the same authority loop drag and momentum already ride, so a keypress
     can never fight a live drag (drag-start clears it).
     gustBoost: decaying angular nudge fed by page-scroll velocity (P3.2b). */
  const stepTarget = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
  /* Mirror of the rotation state for the frame loop: the loop runs between
     commits, and reading the live binding here (rather than closing over
     state) is what keeps step-solving off the state updater. */
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  const gustBoost = useRef(0);

  const actualSphereRadius = sphereRadius || containerSize * 0.5;
  const baseImageSize = containerSize * baseImageScale;

  /* The gust: scroll velocity (px/ms) folds into the idle spin as a damped
     angular nudge. Reduced motion never feeds it, and a live drag or a
     pending keyboard step swallows it (both own the rotation while active). */
  const gustVelocity = useVelocity(gust ?? ZERO);
  useMotionValueEvent(gustVelocity, 'change', (v) => {
    if (reduceRef.current || isDragging) return;
    if (stepTarget.current.x !== null || stepTarget.current.y !== null) return;
    const clamped = Math.max(-1.4, Math.min(1.4, v * 0.5));
    gustBoost.current = gustBoost.current * 0.6 + clamped * 0.4;
  });

  const generateSpherePositions = useCallback((): SphericalPosition[] => {
    const positions: SphericalPosition[] = [];
    const imageCount = images.length;

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = 2 * Math.PI / goldenRatio;

    for (let i = 0; i < imageCount; i++) {
      const t = i / imageCount;
      const inclination = Math.acos(1 - 2 * t);
      const azimuth = angleIncrement * i;

      let phi = inclination * (180 / Math.PI);
      let theta = (azimuth * (180 / Math.PI)) % 360;

      // Better pole coverage - reach poles but avoid extreme mathematical issues
      const poleBonus = Math.pow(Math.abs(phi - 90) / 90, 0.6) * 35; // Moderate boost toward poles
      if (phi < 90) {
        phi = Math.max(5, phi - poleBonus); // Reach closer to top pole (15° minimum)
      } else {
        phi = Math.min(175, phi + poleBonus); // Reach closer to bottom pole (165° maximum)
      }

      phi = 15 + (phi / 180) * 150; // Map to 15-165 degrees for pole coverage with stability

      const randomOffset = (Math.random() - 0.5) * 20;
      theta = (theta + randomOffset) % 360;
      phi = Math.max(0, Math.min(180, phi + (Math.random() - 0.5) * 10));

      positions.push({
        theta: theta,
        phi: phi,
        radius: actualSphereRadius
      });
    }

    return positions;
  }, [images.length, actualSphereRadius]);

  const calculateWorldPositions = useCallback((): WorldPosition[] => {
    const positions = imagePositions.map((pos, index) => {
      const thetaRad = SPHERE_MATH.degreesToRadians(pos.theta);
      const phiRad = SPHERE_MATH.degreesToRadians(pos.phi);
      const rotXRad = SPHERE_MATH.degreesToRadians(rotation.x);
      const rotYRad = SPHERE_MATH.degreesToRadians(rotation.y);

      let x = pos.radius * Math.sin(phiRad) * Math.cos(thetaRad);
      let y = pos.radius * Math.cos(phiRad);
      let z = pos.radius * Math.sin(phiRad) * Math.sin(thetaRad);

      const x1 = x * Math.cos(rotYRad) + z * Math.sin(rotYRad);
      const z1 = -x * Math.sin(rotYRad) + z * Math.cos(rotYRad);
      x = x1;
      z = z1;

      const y2 = y * Math.cos(rotXRad) - z * Math.sin(rotXRad);
      const z2 = y * Math.sin(rotXRad) + z * Math.cos(rotXRad);
      y = y2;
      z = z2;

      const worldPos: Position3D = { x, y, z };

      const fadeZoneStart = -10;  // Start fading out
      const fadeZoneEnd = -30;    // Completely hidden
      const isVisible = worldPos.z > fadeZoneEnd;

      let fadeOpacity = 1;
      if (worldPos.z <= fadeZoneStart) {
        fadeOpacity = Math.max(0, (worldPos.z - fadeZoneEnd) / (fadeZoneStart - fadeZoneEnd));
      }

      const isPoleImage = pos.phi < 30 || pos.phi > 150; // Images from extreme angles

      const distanceFromCenter = Math.sqrt(worldPos.x * worldPos.x + worldPos.y * worldPos.y);
      const maxDistance = actualSphereRadius;
      const distanceRatio = Math.min(distanceFromCenter / maxDistance, 1);

      const distancePenalty = isPoleImage ? 0.4 : 0.7; // Less penalty for pole images
      const centerScale = Math.max(0.3, 1 - distanceRatio * distancePenalty);

      const depthScale = (worldPos.z + actualSphereRadius) / (2 * actualSphereRadius);
      const scale = centerScale * Math.max(0.5, 0.8 + depthScale * 0.3);

      return {
        ...worldPos,
        scale,
        zIndex: Math.round(1000 + worldPos.z),
        isVisible,
        fadeOpacity,
        originalIndex: index
      };
    });

    const adjustedPositions = [...positions];

    for (let i = 0; i < adjustedPositions.length; i++) {
      const pos = adjustedPositions[i];
      if (!pos.isVisible) continue;

      let adjustedScale = pos.scale;
      const imageSize = baseImageSize * adjustedScale;

      for (let j = 0; j < adjustedPositions.length; j++) {
        if (i === j) continue;

        const other = adjustedPositions[j];
        if (!other.isVisible) continue;

        const otherSize = baseImageSize * other.scale;

        const dx = pos.x - other.x;
        const dy = pos.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const minDistance = (imageSize + otherSize) / 2 + 25;

        if (distance < minDistance && distance > 0) {
          const overlap = minDistance - distance;
          const reductionFactor = Math.max(0.4, 1 - (overlap / minDistance) * 0.6);
          adjustedScale = Math.min(adjustedScale, adjustedScale * reductionFactor);
        }
      }

      adjustedPositions[i] = {
        ...pos,
        scale: Math.max(0.25, adjustedScale) // Ensure minimum scale
      };
    }

    return adjustedPositions;
  }, [imagePositions, rotation, actualSphereRadius, baseImageSize]);

  const clampRotationSpeed = useCallback((speed: number): number => {
    return Math.max(-maxRotationSpeed, Math.min(maxRotationSpeed, speed));
  }, [maxRotationSpeed]);

  /* Shortest signed angular delta in degrees. */
  const deltaAngle = (from: number, to: number): number => ((to - from + 540) % 360) - 180;

  /** The plate whose projected depth is greatest — the "front" plate.
     Mirrors calculateWorldPositions' own Z solve: rotating Y to bring a
     plate front means maximizing sin(theta − rotationY), i.e. landing
     rotationY on theta − 90°. */
  const frontPlateIndex = useCallback((): number => {
    let best = 0;
    let bestZ = -Infinity;
    imagePositions.forEach((pos, i) => {
      const z =
        Math.sin(SPHERE_MATH.degreesToRadians(pos.theta - rotation.y)) *
        Math.sin(SPHERE_MATH.degreesToRadians(pos.phi));
      if (z > bestZ) {
        bestZ = z;
        best = i;
      }
    });
    return best;
  }, [imagePositions, rotation.y]);

  const rotateToIndex = useCallback(
    (index: number) => {
      const pos = imagePositions[index];
      if (!pos) return;
      stepTarget.current = { x: null, y: pos.theta - 90 };
    },
    [imagePositions]
  );

  /* Spotlight open/close as a shared-element move (audit 2.5 — "same trick
     for the rotunda plate spotlight", taken through its documented fallback):
     sixty plates re-render every rotation frame, so mounting framer's layout
     projection across all of them is exactly the "too invasive" case the
     audit pre-authorizes View Transitions for. The trick is a name handoff:
     the plate is named synchronously before the OLD snapshot; inside the
     transition callback React mounts/unmounts the modal (statically named)
     and the plate name toggles in the same synchronous pass, so each
     snapshot holds exactly ONE named element and the UA morphs the box
     itself — geometry included. Zero cost at rest. Feature-detected: no VT
     (or reduced motion) is the plain swap, which the modal's own CSS
     crossfade already animates. */
  const lastVtNode = useRef<HTMLElement | null>(null);
  const openFrom = useRef<string | null>(null);

  const namePlate = useCallback((id: string | null) => {
    if (id) {
      const node =
        containerRef.current?.querySelector<HTMLElement>(
          `[data-plate-id="${CSS.escape(id)}"]`
        ) ?? null;
      if (node) {
        node.style.viewTransitionName = 'plate-active';
        lastVtNode.current = node;
      }
    } else if (lastVtNode.current) {
      lastVtNode.current.style.viewTransitionName = '';
      lastVtNode.current = null;
    }
  }, []);

  const swapWithPlateMorph = useCallback(
    (next: ImageData | null) => {
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      };
      const openId = next ? next.id : openFrom.current;
      if (reduceRef.current || !doc.startViewTransition || !openId) {
        setSelectedImage(next);
        openFrom.current = null;
        return;
      }
      openFrom.current = next ? openId : null;
      if (next) haptic(HAPTIC.dialogOpen); // same beat as the roster dialog (P4.16)
      if (next) namePlate(openId); // the plate is the OLD side of the morph
      const t = doc.startViewTransition(() => {
        setSelectedImage(next);
        // New snapshot, exactly one named element per direction:
        if (next) namePlate(null);
        else namePlate(openId);
      });
      // belt-and-braces: whatever the transition outcome, no plate keeps a
      // stale name into the steady state (the rotation loop re-renders it
      // without the property anyway; this just beats any long-running race).
      window.setTimeout(() => namePlate(null), 900);
      void t;
    },
    [namePlate]
  );

  /** Arrow Left/Right walk the plate sequence; Up/Down tilt the axis;
     Home/End jump to first/last; Enter/Space open what faces the viewer.
     Every move rides stepTarget — the same per-frame loop drag and
     momentum use — so nothing ever teleports. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!images.length) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowLeft': {
          e.preventDefault();
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          rotateToIndex((frontPlateIndex() + dir + images.length) % images.length);
          break;
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          const next = Math.max(-32, Math.min(45, rotation.x + (e.key === 'ArrowUp' ? -10 : 10)));
          stepTarget.current = { x: next, y: null };
          break;
        }
        case 'Home':
          e.preventDefault();
          rotateToIndex(0);
          break;
        case 'End':
          e.preventDefault();
          rotateToIndex(images.length - 1);
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const idx = frontPlateIndex();
          if (imagePositions[idx]) swapWithPlateMorph(images[idx]);
          break;
        }
        default:
      }
    },
    [images, rotation.x, rotateToIndex, frontPlateIndex, imagePositions, swapWithPlateMorph]
  );

  const updateMomentum = useCallback(() => {
    if (isDragging) return;

    /* A keyboard step owns the rotation while it settles — auto-rotation,
       leftover flick momentum and the gust are all suppressed so the plate
       arrives at the front and stops, on the reduce path without any ease. */
    const stepping = stepTarget.current.x !== null || stepTarget.current.y !== null;

    if (stepping) {
      /* Solve against the rotation ref, not inside the state updater:
         React may invoke updaters more than once (StrictMode), and a ref
         consumption (the step is CLEAR when it lands) must not be doubled. */
      const k = reduceRef.current ? 1 : 0.18;
      const step = stepTarget.current;
      const prev = rotationRef.current;
      let x = prev.x;
      let y = prev.y;
      if (step.x !== null) {
        const dx = deltaAngle(prev.x, step.x);
        if (Math.abs(dx) < 0.35) {
          x = step.x;
          step.x = null;
        } else {
          x = prev.x + dx * k;
        }
      }
      if (step.y !== null) {
        const dy = deltaAngle(prev.y, step.y);
        if (Math.abs(dy) < 0.35) {
          y = step.y;
          step.y = null;
        } else {
          y = prev.y + dy * k;
        }
      }
      setRotation({ x: SPHERE_MATH.normalizeAngle(x), y: SPHERE_MATH.normalizeAngle(y), z: prev.z });
      setVelocity({ x: 0, y: 0 });
      return;
    }

    setVelocity(prev => {
      const newVelocity = {
        x: prev.x * momentumDecay,
        y: prev.y * momentumDecay
      };

      // Stop animation if velocity is too low and auto-rotate is off
      if (!autoRotate && Math.abs(newVelocity.x) < 0.01 && Math.abs(newVelocity.y) < 0.01) {
        return { x: 0, y: 0 };
      }

      return newVelocity;
    });

    /* Read + decay the gust OUTSIDE the updater (same double-invoke rule
       as the stepping branch); the updater itself stays pure. */
    const gust = gustBoost.current;
    if (gust !== 0) {
      gustBoost.current = Math.abs(gust * 0.92) < 0.01 ? 0 : gust * 0.92;
    }

    setRotation(prev => {
      let newY = prev.y;

      // Add auto-rotation to Y axis (horizontal rotation)
      if (autoRotate && !inspectingRef.current) {
        newY += autoRotateSpeed;
      }

      // Scroll-gust: a decaying nudge so the sphere reacts to being
      // scrolled past (P3.2b) — same weak channel the roster hangs on.
      newY += gust;

      // Add momentum-based rotation
      newY += clampRotationSpeed(velocity.y);

      return {
        x: SPHERE_MATH.normalizeAngle(prev.x + clampRotationSpeed(velocity.x)),
        y: SPHERE_MATH.normalizeAngle(newY),
        z: prev.z
      };
    });
  }, [isDragging, momentumDecay, velocity, clampRotationSpeed, autoRotate, autoRotateSpeed]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    stepTarget.current = { x: null, y: null }; // a grab outranks a pending key-step
    setIsDragging(true);
    setVelocity({ x: 0, y: 0 });
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    const rotationDelta = {
      x: -deltaY * dragSensitivity,
      y: deltaX * dragSensitivity
    };

    setRotation(prev => ({
      x: SPHERE_MATH.normalizeAngle(prev.x + clampRotationSpeed(rotationDelta.x)),
      y: SPHERE_MATH.normalizeAngle(prev.y + clampRotationSpeed(rotationDelta.y)),
      z: prev.z
    }));

    // Update velocity for momentum
    setVelocity({
      x: clampRotationSpeed(rotationDelta.x),
      y: clampRotationSpeed(rotationDelta.y)
    });

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [isDragging, dragSensitivity, clampRotationSpeed]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    /* No preventDefault: a thumb landing on the rotunda must still be able
       to scroll the page (the singularity section established this policy —
       "a thumb landing mid-page scrolls the page, never the camera").
       Horizontal intent is claimed in touchmove instead. */
    const touch = e.touches[0];
    if (!touch) return;
    stepTarget.current = { x: null, y: null };
    setIsDragging(true);
    setVelocity({ x: 0, y: 0 });
    lastMousePos.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    if (!touch) return;

    /* Claim the gesture only when it is horizontal-dominant — that IS the
       rotate gesture. A vertical drag belongs to the page and is never
       preventDefault'ed, so native scroll momentum survives the sphere. */
    const deltaX = touch.clientX - lastMousePos.current.x;
    const deltaY = touch.clientY - lastMousePos.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) e.preventDefault();

    const rotationDelta = {
      x: -deltaY * dragSensitivity,
      y: deltaX * dragSensitivity
    };

    setRotation(prev => ({
      x: SPHERE_MATH.normalizeAngle(prev.x + clampRotationSpeed(rotationDelta.x)),
      y: SPHERE_MATH.normalizeAngle(prev.y + clampRotationSpeed(rotationDelta.y)),
      z: prev.z
    }));

    setVelocity({
      x: clampRotationSpeed(rotationDelta.x),
      y: clampRotationSpeed(rotationDelta.y)
    });

    lastMousePos.current = { x: touch.clientX, y: touch.clientY };
  }, [isDragging, dragSensitivity, clampRotationSpeed]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setImagePositions(generateSpherePositions());
  }, [generateSpherePositions]);

  useEffect(() => {
    const animate = () => {
      updateMomentum();
      animationFrame.current = requestAnimationFrame(animate);
    };

    if (isMounted) {
      animationFrame.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [isMounted, updateMomentum]);

  useEffect(() => {
    if (!isMounted) return;

    const container = containerRef.current;
    if (!container) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMounted, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const worldPositions = calculateWorldPositions();

  const renderImageNode = useCallback((image: ImageData, index: number) => {
    const position = worldPositions[index];

    if (!position || !position.isVisible) return null;

    const imageSize = baseImageSize * position.scale;
    const isHovered = hoveredIndex === index;
    const finalScale = isHovered ? Math.min(hoverScale, hoverScale / position.scale) : 1;

    return (
      <div
        key={image.id}
        className="absolute sphere-plate cursor-pointer select-none transition-transform duration-200 ease-out"
        aria-hidden="true"
        data-plate-id={image.id}
        style={{
          width: `${imageSize}px`,
          height: `${imageSize}px`,
          left: `${containerSize/2 + position.x}px`,
          top: `${containerSize/2 + position.y}px`,
          opacity:
            hoveredIndex === null
              ? position.fadeOpacity
              : isHovered
                ? Math.min(1, position.fadeOpacity * 1.6)
                : position.fadeOpacity * 0.28,
          filter: hoveredIndex === null || isHovered ? 'none' : 'saturate(0.35) brightness(0.6)',
          transform: `translate(-50%, -50%) scale(${finalScale})`,
          zIndex: position.zIndex
        }}
        onMouseEnter={() => {
          setHoveredIndex(index);
          setInspecting(true);
        }}
        onMouseLeave={() => {
          setHoveredIndex(null);
          setInspecting(false);
        }}
        onClick={() => swapWithPlateMorph(image)}
      >
        <div className="relative w-full h-full rounded-full overflow-hidden shadow-lg border-2 border-white/20">
          <img
            src={image.src}
            alt={image.alt}
            className="w-full h-full object-cover"
            draggable={false}
            loading={index < 3 ? 'eager' : 'lazy'}
          />
        </div>
      </div>
    );
  }, [worldPositions, baseImageSize, containerSize, hoveredIndex, hoverScale]);



  /* Spotlight = a real dialog now (P2.1): focus trapped, Escape closes, the
     trigger is restored on close, and the page is locked through the shared
     lib/scroll channel so the engine freezes with the viewport. */
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(!!selectedImage, spotlightRef, { onEscape: () => swapWithPlateMorph(null) });
  useEffect(() => {
    if (!selectedImage) return;
    lockPage('sphere-spotlight');
    return () => unlockPage('sphere-spotlight');
  }, [selectedImage]);

  const renderSpotlightModal = () => {
    if (!selectedImage) return null;

    /* PORTALLED, like the universe dialog. <main> is a stacking context
       (`z-index: 1`), so a fixed child mounted inside the rotunda could never
       paint above the archive bar (z-index 100) — and `z-50` (50) was below it
       even in the root context, which put the close button behind the bar.
       The inline zIndex matches .dialog-backdrop's layer. */
    return createPortal(
      <div
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/30"
        onClick={() => swapWithPlateMorph(null)}
        data-lenis-prevent
        style={{
          zIndex: 110,
          animation: 'fadeIn 0.3s ease-out'
        }}
      >
        <div
          ref={spotlightRef}
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.title || selectedImage.alt}
          className="bg-white rounded-xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          style={{
            animation: 'scaleIn 0.3s ease-out'
          }}
        >
          <div className="relative aspect-square" data-vt-target style={{ viewTransitionName: 'plate-active' }}>
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => swapWithPlateMorph(null)}
              aria-label="Close plate"
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full text-white flex items-center justify-center hover:bg-black/70 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {(selectedImage.title || selectedImage.description) && (
            <div className="p-6">
              {selectedImage.title && (
                <h3 className="text-xl font-bold mb-2">{selectedImage.title}</h3>
              )}
              {selectedImage.description && (
                <p className="text-gray-600">{selectedImage.description}</p>
              )}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  };

  if (!isMounted) {
    return (
      <div
        className="bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div
        className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
        style={{ width: containerSize, height: containerSize }}
      >
        <div className="text-gray-400 text-center">
          <p>No images provided</p>
          <p className="text-sm">Add images to the images prop</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        ref={containerRef}
        className={`relative select-none cursor-grab active:cursor-grabbing ${className}`}
        style={{
          width: containerSize,
          height: containerSize,
          perspective: `${perspective}px`,
          /* Vertical pans belong to the page (the singularity's touch
             policy, applied here too). */
          touchAction: 'pan-y'
        }}
        role="region"
        aria-roledescription="3D carousel"
        aria-label={
          ariaLabel ??
          `Suspended plate sphere — ${images.length} plates. Left and right arrows bring the next plate to the front, up and down tilt the axis, Enter inspects the front plate.`
        }
        tabIndex={0}
        data-cursor="SPIN"
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="relative w-full h-full" style={{ zIndex: 10 }} aria-hidden="true">
          {images.map((image, index) => renderImageNode(image, index))}
        </div>
      </div>

      {renderSpotlightModal()}
    </>
  );
};

export default SphereImageGrid;
