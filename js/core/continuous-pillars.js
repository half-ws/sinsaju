/**
 * ===================================================================
 * sinsaju-calculator - Continuous Pillars (Boundary Blending)
 * ===================================================================
 * Handles smooth transitions at pillar boundaries.
 *
 * Traditional saju uses hard boundaries: one second you're in 축시,
 * the next you're in 인시. This module applies cosine-smoothed
 * blending so that births near boundaries get a mix of both pillars.
 */

import { clamp, normalizeAngle } from '../utils/math.js';
import { computeContinuousSnapshot } from './trig-engine.js';

// ===================================================================
// Blend Primitives
// ===================================================================

/**
 * Cosine smoothstep blend factor.
 *
 * Returns a value in [0, 1] indicating how far past a boundary
 * the given angle is, with smooth cosine easing.
 *
 *   angle < boundary - width/2  ->  0  (fully "before")
 *   angle = boundary            ->  0.5  (exactly at boundary)
 *   angle > boundary + width/2  ->  1  (fully "after")
 *
 * @param {number} angle - current angle in degrees
 * @param {number} boundaryAngle - center of the transition zone
 * @param {number} transitionWidth - total width of the blend zone (default 30)
 * @returns {number} blend factor in [0, 1]
 */
export function blendFactor(angle, boundaryAngle, transitionWidth = 30) {
  const halfWidth = transitionWidth / 2;
  const diff = normalizeAngleSigned(angle - boundaryAngle);
  const t = clamp((diff + halfWidth) / transitionWidth, 0, 1);
  // Cosine smoothstep: smoother than linear, no discontinuity in derivative
  return 0.5 - 0.5 * Math.cos(t * Math.PI);
}

/**
 * Normalize angle to [-180, 180) for signed comparisons.
 * @param {number} deg
 * @returns {number}
 */
function normalizeAngleSigned(deg) {
  let d = ((deg % 360) + 540) % 360 - 180;
  return d;
}

// ===================================================================
// Hour-Day Blend (자시 Day Boundary)
// ===================================================================

/**
 * Compute the day-pillar blend factor for births during 자시.
 *
 * In traditional saju, 자시 (23:00-01:00) spans two calendar days.
 * Births at 23:00 belong to the next day's pillar, but this creates
 * a hard discontinuity. This function returns a smooth blend:
 *
 *   23:00 -> 0.0 (fully current day)
 *   00:00 -> 0.5 (equal blend)
 *   01:00 -> 1.0 (fully next day -- but in practice 01:00 is already
 *            past 자시, so blend stays at 1 which means "next day confirmed")
 *
 * Outside the 23:00-01:00 window, returns 0 (no blending needed).
 *
 * @param {number} hour - birth hour (0-23)
 * @param {number} minute - birth minute (0-59)
 * @returns {{ blend: number, smoothBlend: number, needsBlend: boolean }}
 */
export function hourDayBlend(hour, minute) {
  const totalMinutes = hour * 60 + minute;

  // 자시 window: 23:00 (1380 min) to 01:00 (60 min next day)
  // Total window = 120 minutes
  let blend;
  let needsBlend;

  if (hour >= 23) {
    // 23:00 ~ 23:59: 0.0 to ~0.5
    blend = (totalMinutes - 23 * 60) / 120;
    needsBlend = true;
  } else if (hour < 1) {
    // 00:00 ~ 00:59: ~0.5 to ~1.0
    blend = (totalMinutes + 60) / 120;
    needsBlend = true;
  } else {
    blend = 0;
    needsBlend = false;
  }

  blend = clamp(blend, 0, 1);

  // Apply cosine smoothing for perceptually even transition
  const smoothBlend = 0.5 - 0.5 * Math.cos(blend * Math.PI);

  return { blend, smoothBlend, needsBlend };
}

// ===================================================================
// Month Blend (절기 Boundary)
// ===================================================================

/**
 * Compute the month-pillar blend factor for births near 절기 boundaries.
 *
 * When a birth falls in the first or last 10% of a solar-term month,
 * it blends with the adjacent month's pillar.
 *
 * @param {Date|number} birthKST - birth date (KST)
 * @param {Date|number} curTermDate - start of current solar term
 * @param {Date|number} nextTermDate - start of next solar term
 * @returns {{ fraction: number, blendPrev: number, blendNext: number, phase: string }}
 *   - fraction: position within the month [0, 1]
 *   - blendPrev: blend factor toward previous month [0, 1] (only > 0 near start)
 *   - blendNext: blend factor toward next month [0, 1] (only > 0 near end)
 *   - phase: "entering" | "stable" | "exiting"
 */
export function monthBlend(birthKST, curTermDate, nextTermDate) {
  const birth = typeof birthKST === 'number' ? birthKST : birthKST.getTime();
  const cur = typeof curTermDate === 'number' ? curTermDate : curTermDate.getTime();
  const next = typeof nextTermDate === 'number' ? nextTermDate : nextTermDate.getTime();

  const span = next - cur;
  if (span <= 0) {
    return { fraction: 0.5, blendPrev: 0, blendNext: 0, phase: 'stable' };
  }

  const fraction = clamp((birth - cur) / span, 0, 1);

  let blendPrev = 0;
  let blendNext = 0;
  let phase = 'stable';

  // Transition zone: first 10% and last 10% of the month
  const TRANSITION_ZONE = 0.1;

  if (fraction < TRANSITION_ZONE) {
    // Near the beginning: blending in from previous month
    const t = fraction / TRANSITION_ZONE; // 0 at boundary, 1 at end of zone
    blendPrev = 0.5 + 0.5 * Math.cos(t * Math.PI); // 1 at boundary, 0 at zone end
    phase = 'entering';
  } else if (fraction > (1 - TRANSITION_ZONE)) {
    // Near the end: blending out toward next month
    const t = (fraction - (1 - TRANSITION_ZONE)) / TRANSITION_ZONE; // 0 at zone start, 1 at boundary
    blendNext = 0.5 - 0.5 * Math.cos(t * Math.PI); // 0 at zone start, 1 at boundary
    phase = 'exiting';
  }

  return { fraction, blendPrev, blendNext, phase };
}

// ===================================================================
// Year Blend
// ===================================================================

/**
 * Compute the year-pillar blend factor for births near 입춘.
 * Same logic as monthBlend but for the year cycle.
 *
 * @param {Date|number} birthKST
 * @param {Date|number} ipchunThisDate - 입춘 of current year
 * @param {Date|number} ipchunNextDate - 입춘 of next year
 * @returns {{ fraction: number, blendPrev: number, blendNext: number, phase: string }}
 */
export function yearBlend(birthKST, ipchunThisDate, ipchunNextDate) {
  // Reuse monthBlend logic -- year boundaries work the same way
  return monthBlend(birthKST, ipchunThisDate, ipchunNextDate);
}

// ===================================================================
// Main Entry: Enhance Discrete Result
// ===================================================================

/**
 * Enhance a discrete saju result with continuous trigonometric data.
 *
 * This is the main entry point for the continuous pillars system.
 * It takes the raw output of SajuCalculator.calculate(), adds a
 * `.continuous` property containing:
 *   - Full trigonometric snapshot (angles, influences, oheng)
 *   - Blend factors for each pillar
 *   - Day phase information
 *
 * The original discrete result is not modified; a new object is returned.
 *
 * @param {Object} discreteResult - output from SajuCalculator.calculate()
 * @param {number} hour - birth hour (0-23)
 * @param {number} minute - birth minute (0-59)
 * @returns {Object} enhanced result with `.continuous` property
 */
export function enhanceWithContinuous(discreteResult, hour, minute) {
  // Compute the full continuous snapshot
  const snapshot = computeContinuousSnapshot(discreteResult, hour, minute);

  // Compute blend factors
  const hourDayBlendInfo = hourDayBlend(hour, minute);

  let monthBlendInfo = { fraction: 0.5, blendPrev: 0, blendNext: 0, phase: 'stable' };
  if (discreteResult.monthTermDates) {
    monthBlendInfo = monthBlend(
      discreteResult.birthKST || Date.now(),
      discreteResult.monthTermDates.cur,
      discreteResult.monthTermDates.next
    );
  }

  let yearBlendInfo = { fraction: 0.5, blendPrev: 0, blendNext: 0, phase: 'stable' };
  if (discreteResult.yearIpchunDates) {
    yearBlendInfo = yearBlend(
      discreteResult.birthKST || Date.now(),
      discreteResult.yearIpchunDates.cur,
      discreteResult.yearIpchunDates.next
    );
  }

  // Build the continuous enhancement object
  const continuous = {
    snapshot,
    blends: {
      hour: {
        dayTransition: hourDayBlendInfo
      },
      month: monthBlendInfo,
      year: yearBlendInfo
    },
    // Quick-access combined oheng (same as snapshot.combined.oheng)
    combinedOheng: snapshot.combined.oheng,
    // Metadata
    meta: {
      hourAngle: snapshot.hour.angle,
      monthAngle: snapshot.month.angle,
      yearAngle: snapshot.year.angle,
      dayAngle: snapshot.day.angle,
      dayPhase: snapshot.day.phase,
      maturityAngle: snapshot.day.maturityAngle
    }
  };

  // Return a new object with the continuous property appended
  return Object.assign({}, discreteResult, { continuous });
}
