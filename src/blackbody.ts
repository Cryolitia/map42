/**
 * Converts centrality (0-1) to an RGB color representing blackbody radiation temperature.
 * Geared towards a "cosmic starry sky" visualization where most nodes are low-value (Red/Orange)
 * and high-value nodes are Blue/White.
 */
export const getcolor = (centrality: number): { r: number; g: number; b: number } => {

  // --- Tuning Constants ---
  const MAX_EXPECTED_CENTRALITY = 0.5; // Upper bound for normalization
  const MIN_TEMP_KELVIN = 800;        // Deep Red (Cool stars/Brown Dwarfs)
  const MAX_TEMP_KELVIN = 30000;       // Blue Giant (O-type stars)

  // Non-linear scaling factor.
  // < 1.0 expands the color variance for small centrality values.
  // 0.4 makes 0.001 visible as dim red, 0.0x as orange/yellow.
  const DISTRIBUTION_EXPONENT = 0.4;

  // --- Logic ---

  // 1. Normalize centrality based on expected distribution max
  const normalized = Math.min(centrality / MAX_EXPECTED_CENTRALITY, 1.0);

  // 2. Apply non-linear scaling to handle the "long tail" of small values
  // This ensures the 0.0x nodes aren't all identically dark red
  const scalar = Math.pow(normalized, DISTRIBUTION_EXPONENT);

  // 3. Map to Temperature (Kelvin)
  const temperature = MIN_TEMP_KELVIN + (scalar * (MAX_TEMP_KELVIN - MIN_TEMP_KELVIN));

  // 4. Convert Kelvin to RGB (Approximation)
  return kelvinToRgb(temperature);
};

/**
 * Standard algorithm to convert Color Temperature (Kelvin) to RGB.
 * Adapted from Tanner Helland's algorithm.
 */
const kelvinToRgb = (kelvin: number): { r: number; g: number; b: number } => {
  // Work with scaled temperature
  const temp = kelvin / 100;

  let r: number, g: number, b: number;

  // Calculate Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
  }

  // Calculate Green
  if (temp <= 66) {
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
  } else {
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
  }

  // Calculate Blue
  if (temp >= 66) {
    b = 255;
  } else {
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  }

  return {
    r: clamp(r),
    g: clamp(g),
    b: clamp(b)
  };
};

// Helper to keep values in valid RGB range
const clamp = (val: number): number => {
  return Math.min(255, Math.max(0, Math.round(val)));
};
