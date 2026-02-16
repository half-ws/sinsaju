/**
 * ===================================================================
 * sinsaju-calculator - Oheng Waveform Generator
 * ===================================================================
 * Generates wave data for the 오행 waveform visualization chart.
 *
 * Each of the five elements traces a continuous wave around the
 * 360-degree circle, peaking where their associated branches sit.
 * These waves are used by the visualization layer to render the
 * characteristic "five-element spectrum" of a birth chart.
 */

import { ohengStrengthAtAngle } from './trig-engine.js';
import { CHEONGAN_OHENG, STEM_W, BR_W } from '../lib/sajuwiki/constants.js';
import { angleDiff, toRad } from '../utils/math.js';

/** Oheng keys in canonical order */
const OHENG_KEYS = ['목', '화', '토', '금', '수'];

/** Wave-only keys (토 excluded — rendered as background band) */
const WAVE_KEYS = ['수', '목', '화', '금'];

/** Peak angles for the four seasonal elements (shifted +10° = 1/3 branch rightward) */
const ELEMENT_PEAKS = { 수: 10, 목: 100, 화: 190, 금: 280 };

/** Peak angles for the 천간 (heavenly stem) elements — between each pair */
const CHEONGAN_PEAKS = { 목: 18, 화: 90, 토: 162, 금: 234, 수: 306 };
const CHEONGAN_HALF_WIDTH = 72; // 360° / 5 elements

// ===================================================================
// Wave Generation — Pure cos² trigonometric model
// ===================================================================

/**
 * Pure cosine-squared element strength.
 * Differentiable everywhere (C¹ continuous at zero crossings).
 *
 * f(θ) = cos²(θ - peak) when |θ - peak| < 90°, else 0.
 * At transition points: both value AND derivative are 0.
 *
 * Adjacent elements satisfy cos²(x) + sin²(x) = 1 in overlap zones,
 * guaranteeing the four elements partition the full circle smoothly.
 */
function elementStrength(theta, peakAngle) {
  const delta = angleDiff(theta, peakAngle);
  if (Math.abs(delta) >= 90) return 0;
  const c = Math.cos(toRad(delta));
  return c * c;
}

/**
 * Generate full 360-degree oheng wave data using pure cos² trig.
 *
 * Only 4 elements (목/화/금/수) are generated as waves.
 * 토 is generated separately via generateToWave().
 *
 * @param {number} [resolution=360] - sample points
 * @returns {{ angles: number[], waves: { 수, 목, 화, 금 } }}
 */
export function generateOhengWaves(resolution = 360) {
  const angles = new Array(resolution);
  const waves = {};
  for (const key of WAVE_KEYS) waves[key] = new Array(resolution);

  const step = 360 / resolution;

  for (let i = 0; i < resolution; i++) {
    const angle = i * step;
    angles[i] = angle;

    for (const key of WAVE_KEYS) {
      waves[key][i] = elementStrength(angle, ELEMENT_PEAKS[key]);
    }
  }

  return { angles, waves };
}

/**
 * Sample oheng strengths at a single angle (full 5-element version).
 * Uses the branch-profile-based calculation for non-wave uses.
 */
export function sampleOhengAtAngle(angle) {
  return ohengStrengthAtAngle(angle);
}

// ===================================================================
// 천간 (Heavenly Stem) Wave Generation
// ===================================================================

/**
 * Generate 360-degree 천간 oheng wave data.
 *
 * Maps the 10 heavenly stems to a 360° circle (each stem = 36°).
 * 5 elements peak at the midpoint between their stem pair:
 *   목: 18° (甲-乙), 화: 90° (丙-丁), 토: 162° (戊-己),
 *   금: 234° (庚-辛), 수: 306° (壬-癸)
 *
 * Each wave has half-width 72° (= 360°/5), so adjacent waves
 * tile the circle smoothly: cos²(x) + cos²(π/2 - x) = 1.
 *
 * @param {number} [resolution=360] - sample points
 * @returns {{ angles: number[], waves: { 목, 화, 토, 금, 수 } }}
 */
export function generateCheonganWaves(resolution = 360) {
  const angles = new Array(resolution);
  const waves = {};
  for (const key of OHENG_KEYS) waves[key] = new Array(resolution);

  const step = 360 / resolution;

  for (let i = 0; i < resolution; i++) {
    const angle = i * step;
    angles[i] = angle;

    for (const key of OHENG_KEYS) {
      const delta = angleDiff(angle, CHEONGAN_PEAKS[key]);
      if (Math.abs(delta) >= CHEONGAN_HALF_WIDTH) {
        waves[key][i] = 0;
      } else {
        const c = Math.cos(delta * Math.PI / (2 * CHEONGAN_HALF_WIDTH));
        waves[key][i] = c * c;
      }
    }
  }

  return { angles, waves };
}

/**
 * Generate 토 wave data with precise entry/exit points.
 *
 * 토 enters at the 3/4 point (75%) of each 왕지 (자/묘/오/유) territory:
 *   7.5° (자 75%), 97.5° (묘 75%), 187.5° (오 75%), 277.5° (유 75%)
 * 토 reaches zero at the exact center of each 역마 (인/사/신/해):
 *   60° (인 center), 150° (사 center), 240° (신 center), 330° (해 center)
 *
 * Each bump spans 52.5° with cos² shape. Peak is at the midpoint:
 *   33.75° (축), 123.75° (진), 213.75° (미), 303.75° (술)
 * Maximum value is 0.7 (토 never reaches 1.0 as it's a transitional element).
 *
 * @param {number} [resolution=360] - sample points
 * @returns {number[]} array of 토 strength values (0 to 0.7)
 */
export function generateToWave(resolution = 360) {
  // Each bump: start at 왕지 75%, end at 역마 center — peak is at midpoint
  const TO_BUMPS = [
    { start: 7.5, peak: 33.75, end: 60 },      // 축 area
    { start: 97.5, peak: 123.75, end: 150 },    // 진 area
    { start: 187.5, peak: 213.75, end: 240 },   // 미 area
    { start: 277.5, peak: 303.75, end: 330 },   // 술 area
  ];
  const HALF_WIDTH = 26.25;
  const MAX_TO = 0.7;

  const step = 360 / resolution;
  const values = new Array(resolution);

  for (let i = 0; i < resolution; i++) {
    const angle = i * step;
    let val = 0;
    for (const bump of TO_BUMPS) {
      const delta = angleDiff(angle, bump.peak);
      if (Math.abs(delta) <= HALF_WIDTH) {
        const c = Math.cos(delta * Math.PI / (2 * HALF_WIDTH));
        val = Math.max(val, MAX_TO * c * c);
      }
    }
    values[i] = val;
  }

  return values;
}

// ===================================================================
// Combined Oheng Profile
// ===================================================================

/**
 * Compute a combined oheng profile from a continuous snapshot.
 *
 * Performs a weighted combination of all four pillar cycles' oheng values
 * plus the heavenly stem (천간) contributions. The result is normalized
 * to percentages summing to 100.
 *
 * Weights:
 *   - month (월주 지지): 30%
 *   - day branch (일주 지지): 20%
 *   - hour (시주 지지): 15%
 *   - year (년주 지지): 15%
 *   - stems (천간 합산): 20%
 *
 * @param {Object} continuousSnapshot - output from computeContinuousSnapshot()
 * @param {Object} [discreteResult] - optional discrete result for stem data
 *   If provided and has stems, their 오행 contributions are used.
 *   If not provided, the snapshot's combined.oheng is returned directly.
 * @returns {{ 목: number, 화: number, 토: number, 금: number, 수: number }}
 *   Percentages summing to 100
 */
export function combinedOhengProfile(continuousSnapshot, discreteResult = null) {
  // If no discrete result provided, return the pre-computed combined oheng
  if (!discreteResult || !discreteResult.stems) {
    return { ...continuousSnapshot.combined.oheng };
  }

  const { stems } = discreteResult;
  const { hour, day, month, year } = continuousSnapshot;

  // Branch-based oheng from each pillar's continuous position
  const monthOheng = month.oheng;
  const dayOheng = day.oheng;
  const hourOheng = hour.oheng;
  const yearOheng = year.oheng;

  // Stem-based oheng
  const stemOheng = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const stemPositions = ['year', 'month', 'day', 'hour'];
  const stemWeightByPos = {
    year: STEM_W.year,
    month: STEM_W.month,
    day: STEM_W.day,
    hour: STEM_W.hour
  };
  let totalStemWeight = 0;

  for (const pos of stemPositions) {
    const stemIdx = stems[pos];
    if (stemIdx == null) continue;
    const elemKey = CHEONGAN_OHENG[stemIdx];
    const w = stemWeightByPos[pos];
    stemOheng[elemKey] += w;
    totalStemWeight += w;
  }

  // Normalize stem contributions to proportions
  if (totalStemWeight > 0) {
    for (const key of OHENG_KEYS) {
      stemOheng[key] /= totalStemWeight;
    }
  }

  // Weighted combination
  const WEIGHTS = {
    month: 0.30,
    day: 0.20,
    hour: 0.15,
    year: 0.15,
    stems: 0.20
  };

  const result = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const key of OHENG_KEYS) {
    result[key] =
      monthOheng[key] * WEIGHTS.month +
      dayOheng[key]   * WEIGHTS.day +
      hourOheng[key]  * WEIGHTS.hour +
      yearOheng[key]  * WEIGHTS.year +
      stemOheng[key]  * WEIGHTS.stems;
  }

  // Normalize to percentages summing to 100
  const total = OHENG_KEYS.reduce((s, k) => s + result[k], 0);
  if (total > 0) {
    for (const key of OHENG_KEYS) {
      result[key] = (result[key] / total) * 100;
    }
  }

  return result;
}

// ===================================================================
// Fortune Waves (대운 / 세운)
// ===================================================================

/**
 * Generate oheng wave data for 대운 (10-year major fortune) and 세운 (yearly fortune).
 *
 * For each 대운 period, the oheng shift is computed over its 10-year span.
 * For each 세운 year, a single oheng snapshot is generated.
 *
 * @param {Array<Object>} daeunList - list of 대운 periods, each with:
 *   { branchIdx: number, stemIdx: number, startAge: number, endAge: number }
 * @param {Array<Object>} saeunList - list of 세운 years, each with:
 *   { branchIdx: number, stemIdx: number, year: number }
 * @returns {{
 *   daeun: Array<{ startAge: number, endAge: number, ohengTimeline: Array<{ age: number, oheng: Object }> }>,
 *   saeun: Array<{ year: number, oheng: Object }>
 * }}
 */
export function generateFortuneWaves(daeunList, saeunList) {
  const daeunWaves = [];
  const saeunWaves = [];

  // Process 대운 (10-year periods)
  for (const daeun of daeunList) {
    const { branchIdx, stemIdx, startAge, endAge } = daeun;
    const branchAngle = branchIdx * 30;

    // Sample oheng at 10 points across the 대운 period
    const span = endAge - startAge;
    const samples = Math.max(span, 1);
    const ohengTimeline = [];

    for (let i = 0; i <= samples; i++) {
      const age = startAge + i;
      // Within a 대운, the angle shifts linearly across the branch's 30-degree arc
      const fraction = samples > 0 ? i / samples : 0.5;
      const angle = branchAngle + (fraction - 0.5) * 30;
      const normalizedAngle = ((angle % 360) + 360) % 360;

      // Base oheng from branch position
      const branchOheng = ohengStrengthAtAngle(normalizedAngle);

      // Add stem contribution
      const combined = { ...branchOheng };
      if (stemIdx != null && stemIdx >= 0 && stemIdx < 10) {
        const stemElem = CHEONGAN_OHENG[stemIdx];
        // Stem adds a fixed contribution (weighted at 20% like in the natal chart)
        const stemBoost = 0.2;
        combined[stemElem] += stemBoost;
      }

      ohengTimeline.push({ age, oheng: combined });
    }

    daeunWaves.push({ startAge, endAge, branchIdx, stemIdx, ohengTimeline });
  }

  // Process 세운 (individual years)
  for (const saeun of saeunList) {
    const { branchIdx, stemIdx, year } = saeun;
    const branchAngle = branchIdx * 30;

    // Oheng at the branch center for this year
    const branchOheng = ohengStrengthAtAngle(branchAngle);
    const combined = { ...branchOheng };

    // Add stem contribution
    if (stemIdx != null && stemIdx >= 0 && stemIdx < 10) {
      const stemElem = CHEONGAN_OHENG[stemIdx];
      combined[stemElem] += 0.2;
    }

    saeunWaves.push({ year, branchIdx, stemIdx, oheng: combined });
  }

  return { daeun: daeunWaves, saeun: saeunWaves };
}

// ===================================================================
// Oheng Wave Comparison
// ===================================================================

/**
 * Compare two oheng profiles and return the difference.
 * Useful for showing how a fortune period changes the natal balance.
 *
 * @param {Object} baseOheng - base profile { 목, 화, 토, 금, 수 }
 * @param {Object} fortuneOheng - fortune period profile { 목, 화, 토, 금, 수 }
 * @returns {{ 목: number, 화: number, 토: number, 금: number, 수: number }}
 *   Signed difference (positive = fortune adds, negative = fortune reduces)
 */
export function ohengDifference(baseOheng, fortuneOheng) {
  const diff = {};
  for (const key of OHENG_KEYS) {
    diff[key] = (fortuneOheng[key] || 0) - (baseOheng[key] || 0);
  }
  return diff;
}

/**
 * Merge a natal oheng profile with a fortune oheng contribution.
 *
 * @param {Object} natalOheng - natal profile { 목, 화, 토, 금, 수 } (percentages)
 * @param {Object} fortuneOheng - fortune oheng (raw strengths)
 * @param {number} [fortuneWeight=0.3] - how much the fortune influences the total
 * @returns {{ 목: number, 화: number, 토: number, 금: number, 수: number }}
 *   Merged percentages summing to 100
 */
export function mergeOhengWithFortune(natalOheng, fortuneOheng, fortuneWeight = 0.3) {
  const natalWeight = 1 - fortuneWeight;
  const merged = {};

  // Normalize fortune oheng to percentages first
  let fortuneTotal = 0;
  for (const key of OHENG_KEYS) {
    fortuneTotal += fortuneOheng[key] || 0;
  }

  const fortuneNormalized = {};
  for (const key of OHENG_KEYS) {
    fortuneNormalized[key] = fortuneTotal > 0
      ? ((fortuneOheng[key] || 0) / fortuneTotal) * 100
      : 20; // Default to even distribution if no data
  }

  for (const key of OHENG_KEYS) {
    merged[key] = (natalOheng[key] || 0) * natalWeight +
                  fortuneNormalized[key] * fortuneWeight;
  }

  // Re-normalize to ensure sum = 100
  const total = OHENG_KEYS.reduce((s, k) => s + merged[k], 0);
  if (total > 0) {
    for (const key of OHENG_KEYS) {
      merged[key] = (merged[key] / total) * 100;
    }
  }

  return merged;
}
