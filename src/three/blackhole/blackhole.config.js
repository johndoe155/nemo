/**
 * ============================================================================
 * BLACK HOLE SIMULATION - DEDICATED CONFIGURATION FILE
 * ============================================================================
 *
 * SINGLE SOURCE OF TRUTH for every simulation parameter.
 *
 * The Tweakpane "Black Hole Controls" menu has been removed from the
 * user-facing UI. All parameters it managed (sliders, toggles, color
 * pickers, and buttons) now live in this static file so developers can
 * still tweak every single parameter.
 *
 * HOW TO TWEAK:
 *   1. Edit the value you want in the nested groups below.
 *   2. Save and reload the page — main.js and blackhole.js read from
 *      this file at startup.
 *
 * For parameters that had a UI control, the original control's label and
 * valid range (min/max/step) are documented inline so values can be kept
 * in a sensible range.
 *
 * NOTE ON VALUES:
 *   Values below are the exact values previously held in the app's
 *   defaultConfig (the values the UI initialized with).
 *
 * CONSUMERS:
 *   - main.js        imports `flatSimulationConfig` (bloom, cinematic mode)
 *   - blackhole.js   imports `flatSimulationConfig` (all shader uniforms)
 *
 * The flat form (`flatSimulationConfig`) is what the simulation reads;
 * it is built automatically from the nested groups above, so editing the
 * nested groups is all you ever need to do.
 */

// ============================================================================
// NESTED, HUMAN-ORGANIZED CONFIGURATION (edit this section)
// ============================================================================

export const simulationConfig = {

  // --------------------------------------------------------------------------
  // CAMERA
  // --------------------------------------------------------------------------
  camera: {
    // Formerly the "Start/Stop Cinematic Mode" toggle button in the UI.
    // Set to true to auto-play the cinematic camera flythrough on load.
    cinematicMode: false
  },

  // --------------------------------------------------------------------------
  // BLACK HOLE - core relativistic physics
  // --------------------------------------------------------------------------
  blackHole: {
    // UI: "Mass" slider (range 0.1 - 3.0, step 0.1)
    // Schwarzschild mass; event-horizon radius rs = 2M in simulation units.
    blackHoleMass: 0.4,

    // UI: "Grav. Lensing" slider (range 0.5 - 3.0, step 0.1)
    // Multiplier applied to gravitational light-bending strength.
    gravitationalLensing: 2.4,

    // UI: "Doppler Beaming" slider (range 0.0 - 2.0, step 0.1)
    // Exponent of the relativistic Doppler brightness boost (D^3 scaling).
    dopplerStrength: 1.0
  },

  // --------------------------------------------------------------------------
  // ACCRETION DISK - geometry, appearance, turbulence
  // --------------------------------------------------------------------------
  accretionDisk: {
    // === Geometry (former "Geometry" subfolder) ===

    // UI: "Inner Radius" slider (range 2.0 - 5.0, step 0.1)
    // Inner disk edge (constrained to the ISCO: 3x rs for Schwarzschild).
    diskInnerRadius: 4.1,

    // UI: "Outer Radius" slider (range 6.0 - 20.0, step 0.5)
    diskOuterRadius: 14.5,

    // === Appearance (former "Appearance" subfolder) ===

    // UI: "Brightness" slider (range 0.5 - 5.0, step 0.1)
    diskBrightness: 5,

    // UI: "Peak Temp (kK)" slider (range 1 - 50, step 1, shown as "NNk K")
    // Peak temperature in thousands of Kelvin at the inner edge.
    diskTemperature: 49.78,

    // UI: "Temp Falloff" slider (range 0.25 - 15.0, step 0.01)
    // Temperature falloff exponent: 0.75 = physical (Shakura-Sunyaev).
    temperatureFalloff: 5.22,

    // UI: "Inner Softness" slider (range 0.0 - 0.5, step 0.01)
    diskEdgeSoftnessInner: 0.18,

    // UI: "Outer Softness" slider (range 0.0 - 0.5, step 0.01)
    diskEdgeSoftnessOuter: 0.5,

    // === Turbulence (former "Turbulence" subfolder) ===

    // UI: "Rotation Speed" slider (range -20.0 - 20.0, step 0.1)
    // Keplerian rotation speed; sign sets spin direction.
    diskRotationSpeed: -8.7,

    // UI: "Scale" slider (range 0.1 - 2.0, step 0.01)
    turbulenceScale: 1.81,

    // UI: "Arc Stretch" slider (range 0.1 - 10.0, step 0.01)
    turbulenceStretch: 0.75,

    // UI: "Sharpness" slider (range 0.1 - 10.0, step 0.1)
    turbulenceSharpness: 7.4,

    // UI: "Cycle Time (s)" slider (range 5.0 - 30.0, step 1.0)
    turbulenceCycleTime: 5,

    // UI: "Lacunarity" slider (range 1.0 - 4.0, step 0.1)
    turbulenceLacunarity: 3,

    // UI: "Persistence" slider (range 0.1 - 1.0, step 0.05)
    turbulencePersistence: 0.8
  },

  // --------------------------------------------------------------------------
  // STARS - procedural background star field
  // --------------------------------------------------------------------------
  stars: {
    // UI: "Enable Stars" toggle
    starsEnabled: true,

    // UI: "Background" color picker
    starBackgroundColor: "#000000",

    // UI: "Density" slider (range 0.001 - 0.1, step 0.001)
    starDensity: 0.1,

    // UI: "Size" slider (range 0.5 - 5.0, step 0.1)
    starSize: 1.2,

    // UI: "Brightness" slider (range 0.1 - 3.0, step 0.1)
    starBrightness: 0.1
  },

  // --------------------------------------------------------------------------
  // NEBULA - two-layer FBM background clouds
  // --------------------------------------------------------------------------
  nebula: {
    // UI: "Enable Nebula" toggle
    nebulaEnabled: true,

    // === Layer 1 (former "Layer 1" subfolder) ===

    // UI: "Scale" slider (range 0.5 - 10.0, step 0.5)
    nebula1Scale: 2,

    // UI: "Density" slider (range -1.0 - 1.0, step 0.05)
    nebula1Density: 0.5,

    // UI: "Brightness" slider (range 0.0 - 1.0, step 0.01)
    nebula1Brightness: 0.01,

    // UI: "Color" color picker
    nebula1Color: "#071f44",

    // === Layer 2 (former "Layer 2" subfolder) ===

    // UI: "Scale" slider (range 0.5 - 20.0, step 0.5)
    nebula2Scale: 5.5,

    // UI: "Density" slider (range -1.0 - 1.0, step 0.05)
    nebula2Density: 0.05,

    // UI: "Brightness" slider (range 0.0 - 1.0, step 0.01)
    nebula2Brightness: 0.21,

    // UI: "Color" color picker
    nebula2Color: "#010615"
  },

  // --------------------------------------------------------------------------
  // BLOOM - HDR post-processing
  // --------------------------------------------------------------------------
  bloom: {
    // UI: "Strength" slider (range 0 - 3, step 0.01)
    bloomStrength: 0.68,

    // UI: "Radius" slider (range 0 - 1, step 0.01)
    bloomRadius: 0.2,

    // UI: "Threshold" slider (range 0 - 1, step 0.01)
    bloomThreshold: 0.4
  },

  // --------------------------------------------------------------------------
  // PERFORMANCE
  // --------------------------------------------------------------------------
  performance: {
    // Raymarching step size (used by the shader; was in the old config but
    // never exposed as a UI slider).
    stepSize: 1
  },

  // --------------------------------------------------------------------------
  // LEGACY PARAMETERS (preserved for compatibility, not read by the shader)
  // --------------------------------------------------------------------------
  // These parameters existed in the previous version of the app's config
  // state but are NOT currently consumed by the shader or UI. They are
  // kept here verbatim so no value is lost; delete freely if you want a
  // leaner config.
  legacy: {
    // Disk
    turbulenceBrightness: -0.05,
    diskDensity: 1,
    diskInnerThickness: 0.7,
    diskOuterThickness: 0.5,
    diskRadialFalloff: 2,
    diskOpacityFalloff: 0.5,
    diskInnerColor: "#a84b23",
    diskOuterColor: "#7f1b00",
    diskDifferentialRotation: 1,
    diskTurbulence: 0.9,
    diskThickness: 1.3,
    turbulencePrimaryScale: 0.65,
    turbulenceSecondaryScale: 1.3,
    turbulenceSecondaryStrength: 0.15,
    turbulenceOffset: 0.1,

    // Quality / presets
    qualityPreset: "medium",

    // Photon ring
    ringEnabled: true,
    ringScale: 0.83,
    ringContrast: 0.95,
    ringBrightness: 0.4,
    ringSharpness: 10,
    ringTwist: 10.3,
    ringNoiseEnabled: true,
    ringNoiseScale: 4.5,
    ringNoiseAmplitude: 1.45,
    ringNoiseSharpness: 4,
    ringNoiseOffset: -0.2,
    ringNoiseOctaves: 2,
    ringNoiseLacunarity: 1.9,
    ringNoisePersistence: 0.45,

    // Noise / animation (old scheme)
    noiseAnimFrequency: 4.2,
    noiseAnimAmplitude: 2,
    noiseEvolutionSpeed: 5,

    // Adaptive raymarching (old scheme)
    adaptiveMinStep: 0.15,
    stepJitter: 0,
    raySteps: 68,
    maxRayDistance: 500,
    heightDensityFalloff: 5,
    rayJitter: 1,

    // Nebula (old single-layer scheme)
    nebulaBrightness: 0.07,
    nebulaColor1: "#113844",
    nebulaColor2: "#1b214a",
    nebulaScale1: 3,
    nebulaScale2: 3.5,
    nebulaBlend: 0.55,
    nebulaSpeed: 0.065,
    nebulaDensity: 0.35,
    nebulaScale: 3,
    nebulaDetailScale: 2.4,
    nebulaOffsetX: 0,
    nebulaOffsetY: 0,
    nebulaOffsetZ: 0,

    // Temporal anti-aliasing (old scheme)
    temporalAA: false,
    temporalFrames: 16
  }
};

// ============================================================================
// FLAT CONFIGURATION (auto-generated from the nested groups above)
// ============================================================================
// The simulation code (blackhole.js uniforms, main.js bloom setup) reads
// flat keys, e.g. config.blackHoleMass. Each group owns unique key names,
// so a shallow merge of all groups produces the complete flat config.
// Edit the nested groups only — this is rebuilt automatically.

export const flatSimulationConfig = Object.assign(
  {},
  ...Object.values(simulationConfig)
);
