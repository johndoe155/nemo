// Shared framing math for the precomputed preview and the full persona mesh.
// Keep this file free of browser-only APIs: the offline point generator imports
// the same functions that the runtime scene uses.

export const MODEL_ROTATION_Y = -Math.PI / 2;
export const VIEWPORT_FIT_FACTOR = 0.78;

export function boundsFromBox(box) {
  return {
    xrange: [box.min.x, box.max.x],
    yrange: [box.min.y, box.max.y],
    zrange: [box.min.z, box.max.z],
  };
}

export function boundsMaxDimension(bounds) {
  return Math.max(
    bounds.xrange[1] - bounds.xrange[0],
    bounds.yrange[1] - bounds.yrange[0],
    bounds.zrange[1] - bounds.zrange[0],
    1e-4,
  );
}

/** Match the donor's static object transform exactly: its unrotated world-box
 * center is assigned as the root translation, then the root receives the fixed
 * Y rotation. This intentionally preserves Three's compose order rather than
 * re-deriving an apparently equivalent point formula. */
export function applyStaticModelTransform(object, center) {
  object.position.sub(center);
  object.rotation.y = MODEL_ROTATION_Y;
  object.updateMatrixWorld(true);
  return object;
}

export function viewportFitScale(viewport, bounds) {
  return (
    (Math.min(viewport.width, viewport.height) * VIEWPORT_FIT_FACTOR) /
    boundsMaxDimension(bounds)
  );
}
