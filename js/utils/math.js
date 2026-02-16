/**
 * ===================================================================
 * sinsaju-calculator - Math Utilities
 * ===================================================================
 * Pure math helper functions for the trigonometric saju engine.
 * All angle operations work in degrees unless noted otherwise.
 */

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** Convert degrees to radians */
export function toRad(deg) { return deg * DEG_TO_RAD; }

/** Convert radians to degrees */
export function toDeg(rad) { return rad * RAD_TO_DEG; }

/**
 * Shortest angular distance between two angles in degrees.
 * Result is in [-180, 180].
 * Positive means `a` is clockwise from `b`.
 * @param {number} a - first angle (degrees)
 * @param {number} b - second angle (degrees)
 * @returns {number} signed angular distance
 */
export function angleDiff(a, b) {
  let d = ((a - b) % 360 + 540) % 360 - 180;
  return d;
}

/** Linear interpolation from a to b by factor t in [0,1] */
export function lerp(a, b, t) { return a + (b - a) * t; }

/** Clamp value to [min, max] */
export function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

/**
 * Normalize angle to [0, 360).
 * Handles negative values and values >= 360.
 * @param {number} deg - angle in degrees
 * @returns {number} normalized angle in [0, 360)
 */
export function normalizeAngle(deg) { return ((deg % 360) + 360) % 360; }
