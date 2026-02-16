/**
 * ===================================================================
 * sinsaju-calculator - Trigonometric Saju Engine
 * ===================================================================
 * CORE INNOVATION: Maps all saju cycles (year, month, day, hour)
 * onto continuous trigonometric functions on a 360-degree circle.
 *
 * Each of the 12 earthly branches (지지) occupies a 30-degree arc.
 * Instead of hard boundaries, influence tapers smoothly via cosine,
 * giving every birth moment a unique continuous fingerprint.
 */

import { toRad, angleDiff, normalizeAngle, clamp } from '../utils/math.js';
import {
  JIJI, CHEONGAN_OHENG, OHENG, BR_EL, STEM_W, BR_W
} from '../lib/sajuwiki/constants.js';

// ===================================================================
// Constants
// ===================================================================

/**
 * Center angle for each of the 12 earthly branches.
 * 자(子)=0, 축(丑)=30, 인(寅)=60, ..., 해(亥)=330
 */
export const BRANCH_ANGLES = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330
];

/**
 * Oheng (오행) ratios per branch, derived from 지장간 (JIJANGGAN) data.
 * Hardcoded here to avoid circular dependencies with branch-profile.js.
 * Keys: 목, 화, 토, 금, 수
 * Index matches JIJI order: 0=자, 1=축, ..., 11=해
 */
export const BRANCH_OHENG_RATIOS = [
  /* 0  자 */ { 목: 0,   화: 0,   토: 0,   금: 0,   수: 1.0 },
  /* 1  축 */ { 목: 0,   화: 0,   토: 0.6, 금: 0.1, 수: 0.3 },
  /* 2  인 */ { 목: 0.6, 화: 0.2, 토: 0.2, 금: 0,   수: 0   },
  /* 3  묘 */ { 목: 1.0, 화: 0,   토: 0,   금: 0,   수: 0   },
  /* 4  진 */ { 목: 0.3, 화: 0,   토: 0.6, 금: 0,   수: 0.1 },
  /* 5  사 */ { 목: 0,   화: 0.6, 토: 0.2, 금: 0.2, 수: 0   },
  /* 6  오 */ { 목: 0,   화: 1.0, 토: 0,   금: 0,   수: 0   },
  /* 7  미 */ { 목: 0.1, 화: 0.3, 토: 0.6, 금: 0,   수: 0   },
  /* 8  신 */ { 목: 0,   화: 0,   토: 0.2, 금: 0.6, 수: 0.2 },
  /* 9  유 */ { 목: 0,   화: 0,   토: 0,   금: 1.0, 수: 0   },
  /* 10 술 */ { 목: 0,   화: 0.1, 토: 0.6, 금: 0.3, 수: 0   },
  /* 11 해 */ { 목: 0.2, 화: 0,   토: 0.2, 금: 0,   수: 0.6 }
];

/** Oheng keys in canonical order */
const OHENG_KEYS = ['목', '화', '토', '금', '수'];

// ===================================================================
// Core Trigonometric Functions
// ===================================================================

/**
 * Compute the influence of a single branch at a given angle.
 *
 * Uses cosine falloff: peak influence (1.0) at the branch center,
 * tapering to 0 at 90 degrees away.
 *
 * Example values:
 *   center (0 deg offset)   -> 1.000
 *   boundary (15 deg)       -> 0.966
 *   adjacent center (30 deg)-> 0.866
 *   60 deg away             -> 0.500
 *   90 deg away             -> 0.000
 *
 * @param {number} theta - current angle in degrees [0, 360)
 * @param {number} branchIdx - branch index (0-11)
 * @returns {number} influence value in [0, 1]
 */
export function branchInfluence(theta, branchIdx) {
  const peak = branchIdx * 30;
  const delta = angleDiff(theta, peak);
  if (Math.abs(delta) >= 90) return 0;
  return Math.cos(toRad(delta));
}

/**
 * Compute influence values for all 12 branches at a given angle.
 * @param {number} theta - current angle in degrees [0, 360)
 * @returns {number[]} array of 12 influence values
 */
export function allBranchInfluences(theta) {
  const influences = new Array(12);
  for (let i = 0; i < 12; i++) {
    influences[i] = branchInfluence(theta, i);
  }
  return influences;
}

/**
 * Compute the five-element (오행) strength at a given angle.
 *
 * For each branch, its influence at the angle is multiplied by the
 * branch's oheng ratios, then summed across all 12 branches.
 *
 * @param {number} theta - angle in degrees [0, 360)
 * @returns {{ 목: number, 화: number, 토: number, 금: number, 수: number }}
 */
export function ohengStrengthAtAngle(theta) {
  const result = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (let i = 0; i < 12; i++) {
    const inf = branchInfluence(theta, i);
    if (inf === 0) continue;
    const ratios = BRANCH_OHENG_RATIOS[i];
    for (const key of OHENG_KEYS) {
      result[key] += inf * ratios[key];
    }
  }
  return result;
}

// ===================================================================
// Time / Date -> Angle Converters
// ===================================================================

/**
 * Convert clock time (hour:minute) to the hour-cycle angle.
 *
 * 자시 center (midnight 00:00) = 0 degrees
 * Each clock hour = 15 degrees, each minute = 0.25 degrees.
 *
 * Examples:
 *   00:00 ->   0 deg (자)
 *   03:00 ->  45 deg (축~인 boundary)
 *   06:00 ->  90 deg (묘)
 *   12:00 -> 180 deg (오)
 *   18:00 -> 270 deg (유)
 *
 * @param {number} hour - hour (0-23)
 * @param {number} minute - minute (0-59)
 * @returns {number} angle in [0, 360)
 */
export function timeToHourAngle(hour, minute) {
  return (hour * 15 + minute * 0.25) % 360;
}

/**
 * Convert a birth date within a solar-term month to the month-cycle angle.
 *
 * At the midpoint of the month (fraction=0.5), the angle equals the
 * exact branch center -- peak influence. Near the 절기 boundaries
 * (fraction near 0 or 1), the angle drifts toward the neighboring
 * branch, creating natural blending.
 *
 * @param {Date|number} birthKST - birth date/time (KST) as Date or ms timestamp
 * @param {Date|number} curTermDate - start of current solar term (절기)
 * @param {Date|number} nextTermDate - start of next solar term
 * @param {number} monthBranchIdx - branch index for this month (0-11)
 * @returns {number} angle in [0, 360)
 */
export function dateToMonthAngle(birthKST, curTermDate, nextTermDate, monthBranchIdx) {
  const birth = typeof birthKST === 'number' ? birthKST : birthKST.getTime();
  const cur = typeof curTermDate === 'number' ? curTermDate : curTermDate.getTime();
  const next = typeof nextTermDate === 'number' ? nextTermDate : nextTermDate.getTime();

  const span = next - cur;
  if (span <= 0) {
    // Degenerate case: return branch center
    return normalizeAngle(monthBranchIdx * 30);
  }

  const fraction = clamp((birth - cur) / span, 0, 1);
  // At fraction=0.5 -> exactly at branch center
  // At fraction=0.0 -> 15 degrees before center (blending with previous)
  // At fraction=1.0 -> 15 degrees after center (blending with next)
  const monthAngle = monthBranchIdx * 30 + (fraction - 0.5) * 30;
  return normalizeAngle(monthAngle);
}

/**
 * Convert a birth date within a year to the year-cycle angle.
 *
 * Same logic as dateToMonthAngle but for the year cycle, using
 * 입춘 (Ipchun, start of spring) as the year boundary.
 *
 * @param {Date|number} birthKST - birth date/time (KST)
 * @param {Date|number} ipchunThisDate - 입춘 of the current year
 * @param {Date|number} ipchunNextDate - 입춘 of the next year
 * @param {number} yearBranchIdx - branch index for this year (0-11)
 * @returns {number} angle in [0, 360)
 */
export function dateToYearAngle(birthKST, ipchunThisDate, ipchunNextDate, yearBranchIdx) {
  const birth = typeof birthKST === 'number' ? birthKST : birthKST.getTime();
  const cur = typeof ipchunThisDate === 'number' ? ipchunThisDate : ipchunThisDate.getTime();
  const next = typeof ipchunNextDate === 'number' ? ipchunNextDate : ipchunNextDate.getTime();

  const span = next - cur;
  if (span <= 0) {
    return normalizeAngle(yearBranchIdx * 30);
  }

  const fraction = clamp((birth - cur) / span, 0, 1);
  const yearAngle = yearBranchIdx * 30 + (fraction - 0.5) * 30;
  return normalizeAngle(yearAngle);
}

// ===================================================================
// Dominant Branch Helper
// ===================================================================

/**
 * Find the branch index with the highest influence from an array of 12.
 * @param {number[]} influences - array of 12 influence values
 * @returns {number} branch index (0-11)
 */
function findDominantBranch(influences) {
  let maxIdx = 0;
  let maxVal = influences[0];
  for (let i = 1; i < 12; i++) {
    if (influences[i] > maxVal) {
      maxVal = influences[i];
      maxIdx = i;
    }
  }
  return maxIdx;
}

// ===================================================================
// Pillar Weight Constants
// ===================================================================

/**
 * Weights for combining the four pillar cycles into a single oheng profile.
 * These match sajuwiki's BR_W + STEM_W combined proportions:
 *   month=30%, day=20%, hour=15%, year=15%, stems(天干)=20%
 */
const PILLAR_WEIGHTS = {
  month: 0.30,
  day: 0.20,
  hour: 0.15,
  year: 0.15,
  stems: 0.20
};

// ===================================================================
// Continuous Snapshot
// ===================================================================

/**
 * Compute a full continuous snapshot from a discrete saju result.
 *
 * Takes the output of SajuCalculator.calculate() plus the birth time
 * and returns rich continuous data for all four pillars, including
 * per-pillar branch influences, oheng distributions, and a combined
 * weighted oheng profile.
 *
 * @param {Object} discreteResult - output from SajuCalculator.calculate()
 *   Expected shape: {
 *     idxs: { year, month, day, hour },        // 60-갑자 indices
 *     branches: { year, month, day, hour },     // branch indices (0-11)
 *     stems: { year, month, day, hour },        // stem indices (0-9)
 *     monthTermDates?: { cur, next },           // optional: solar term dates
 *     yearIpchunDates?: { cur, next },          // optional: 입춘 dates
 *   }
 * @param {number} hour - birth hour (0-23)
 * @param {number} minute - birth minute (0-59)
 * @returns {Object} continuous snapshot
 */
export function computeContinuousSnapshot(discreteResult, hour, minute) {
  const { idxs } = discreteResult;
  // Extract branch/stem indices from 60갑자 indices
  const branches = {
    year: idxs.year % 12,
    month: idxs.month % 12,
    day: idxs.day % 12,
    hour: idxs.hour >= 0 ? idxs.hour % 12 : 0
  };
  const stems = {
    year: idxs.year % 10,
    month: idxs.month % 10,
    day: idxs.day % 10,
    hour: idxs.hour >= 0 ? idxs.hour % 10 : 0
  };

  // --- Hour pillar (시주) ---
  const hourAngle = timeToHourAngle(hour, minute);
  const hourInfluences = allBranchInfluences(hourAngle);
  const hourOheng = ohengStrengthAtAngle(hourAngle);

  // --- Month pillar (월주) ---
  let monthAngle;
  if (discreteResult.curTermDt && discreteResult.nextTermDt) {
    monthAngle = dateToMonthAngle(
      discreteResult.birthKST || new Date(),
      discreteResult.curTermDt,
      discreteResult.nextTermDt,
      branches.month
    );
  } else if (discreteResult.monthTermDates) {
    monthAngle = dateToMonthAngle(
      discreteResult.birthKST || new Date(),
      discreteResult.monthTermDates.cur,
      discreteResult.monthTermDates.next,
      branches.month
    );
  } else {
    // Fallback: place at exact branch center
    monthAngle = normalizeAngle(branches.month * 30);
  }
  const monthInfluences = allBranchInfluences(monthAngle);
  const monthOheng = ohengStrengthAtAngle(monthAngle);

  // --- Year pillar (년주) ---
  // Year position is determined by the month's position within the year cycle.
  // The year cycle starts at the beginning of the 인 sector (45° = 인 center
  // 60° minus half-sector 15°). The month angle tells us how far through the
  // year we are; that fraction maps to position within the year branch's 30°
  // sector. Reference is always 인.
  const CYCLE_START = 45; // start of 인 sector: 60° - 15°
  const yearFraction = normalizeAngle(monthAngle - CYCLE_START) / 360;
  const yearAngle = normalizeAngle(branches.year * 30 + (yearFraction - 0.5) * 30);
  const yearInfluences = allBranchInfluences(yearAngle);
  const yearOheng = ohengStrengthAtAngle(yearAngle);

  // --- Day pillar (일주) ---
  // Day position is determined by the hour's position within the day cycle.
  // The day cycle starts at the beginning of the 인시 sector (45° = 인 center
  // 60° minus half-sector 15°). The hour angle tells us how far through the
  // day we are; that fraction maps to position within the day branch's 30° sector.
  const dayFraction = normalizeAngle(hourAngle - CYCLE_START) / 360;
  const dayAngle = normalizeAngle(branches.day * 30 + (dayFraction - 0.5) * 30);
  const dayInfluences = allBranchInfluences(dayAngle);
  const dayOheng = ohengStrengthAtAngle(dayAngle);

  const maturityAngle = hourAngle;
  const dayPhase = getDayPhase(maturityAngle);

  // --- Stem (천간) contributions ---
  const stemOheng = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const stemPositions = ['year', 'month', 'day', 'hour'];
  const stemWeightByPos = { year: STEM_W.year, month: STEM_W.month, day: STEM_W.day, hour: STEM_W.hour };
  let totalStemWeight = 0;

  for (const pos of stemPositions) {
    const stemIdx = stems[pos];
    if (stemIdx == null) continue;
    const elemKey = CHEONGAN_OHENG[stemIdx];
    const w = stemWeightByPos[pos];
    stemOheng[elemKey] += w;
    totalStemWeight += w;
  }

  // Normalize stem oheng to proportions
  if (totalStemWeight > 0) {
    for (const key of OHENG_KEYS) {
      stemOheng[key] /= totalStemWeight;
    }
  }

  // --- Combined oheng (weighted combination of all 4 pillars + stems) ---
  const combined = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const key of OHENG_KEYS) {
    combined[key] =
      monthOheng[key] * PILLAR_WEIGHTS.month +
      dayOheng[key]   * PILLAR_WEIGHTS.day +
      hourOheng[key]  * PILLAR_WEIGHTS.hour +
      yearOheng[key]  * PILLAR_WEIGHTS.year +
      stemOheng[key]  * PILLAR_WEIGHTS.stems;
  }

  // Normalize combined to percentages summing to 100
  const combinedTotal = OHENG_KEYS.reduce((s, k) => s + combined[k], 0);
  if (combinedTotal > 0) {
    for (const key of OHENG_KEYS) {
      combined[key] = (combined[key] / combinedTotal) * 100;
    }
  }

  return {
    hour: {
      angle: hourAngle,
      branchInfluences: hourInfluences,
      dominantBranch: findDominantBranch(hourInfluences),
      oheng: hourOheng
    },
    day: {
      angle: dayAngle,
      branchInfluences: dayInfluences,
      dominantBranch: findDominantBranch(dayInfluences),
      idx60: idxs.day,
      maturityAngle,
      phase: dayPhase,
      oheng: dayOheng
    },
    month: {
      angle: monthAngle,
      branchInfluences: monthInfluences,
      dominantBranch: findDominantBranch(monthInfluences),
      oheng: monthOheng
    },
    year: {
      angle: yearAngle,
      branchInfluences: yearInfluences,
      dominantBranch: findDominantBranch(yearInfluences),
      oheng: yearOheng
    },
    combined: {
      oheng: combined
    }
  };
}

// ===================================================================
// Day Phase Helper
// ===================================================================

/**
 * Determine the qualitative day phase from the maturity angle.
 *
 * The traditional saju day begins at 인시 (03:00 = 60 degrees).
 * Phases map roughly to the 12-stage life cycle (십이운성):
 *   - 생욕대 (birth/growth): early day, morning
 *   - 관록왕 (peak/power): midday
 *   - 쇠병사 (decline): evening
 *   - 묘절태양 (dormancy/renewal): late night
 *
 * @param {number} maturityAngle - hour angle in degrees [0, 360)
 * @returns {string} phase name
 */
function getDayPhase(maturityAngle) {
  // Shift so that 인시 start (60 deg) becomes 0
  const shifted = normalizeAngle(maturityAngle - 60);

  if (shifted < 90)  return '생욕대';    // 03:00 ~ 09:00 (birth / growth)
  if (shifted < 150) return '관록왕';    // 09:00 ~ 13:00 (peak / power)
  if (shifted < 225) return '쇠병사';    // 13:00 ~ 18:00 (decline)
  if (shifted < 300) return '묘절태양';  // 18:00 ~ 23:00 (dormancy / renewal)
  return '생욕대';                       // 23:00 ~ 03:00 wraps to growth transition
}
