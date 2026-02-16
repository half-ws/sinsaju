/**
 * ===================================================================
 * sinsaju-calculator - BirthMoment Model
 * ===================================================================
 * The main data model class that combines discrete (traditional) and
 * continuous (trigonometric) saju analysis into a single unified object.
 *
 * BirthMoment is the central point of access for all saju computations.
 * It lazily computes each analysis on demand, caching the results for
 * subsequent accesses.
 *
 * Usage:
 *   const moment = new BirthMoment(1990, 5, 15, 14, 30, 'm');
 *   const chart = moment.getChartData();
 *   // chart.discrete  -> traditional saju pillars, ten gods, etc.
 *   // chart.continuous -> continuous trigonometric snapshot
 *   // chart.matrix     -> 4x4 twelve-stage matrix
 *   // chart.ohengWaves -> 360-point oheng wave data
 */

import {
  SajuCalculator,
  OhengAnalyzer,
  YongsinAnalyzer,
  DaeunCalculator,
  SaeunCalculator,
  WolunCalculator
} from '../lib/sajuwiki/calculator.js';

import { computeContinuousSnapshot } from '../core/trig-engine.js';
import { computeTwelveStageMatrix } from '../core/twelve-stage-matrix.js';
import { generateOhengWaves } from '../core/oheng-waves.js';
import { getAllBranchProfiles, getBlendedBranchProfile } from '../core/branch-profile.js';

// ===================================================================
// BirthMoment Class
// ===================================================================

export class BirthMoment {
  /**
   * Create a BirthMoment representing a single birth instant.
   *
   * @param {number} year - birth year (solar calendar)
   * @param {number} month - birth month (1-12, solar calendar)
   * @param {number} day - birth day (1-31, solar calendar)
   * @param {number|null} hour - birth hour (0-23), null if unknown
   * @param {number|null} minute - birth minute (0-59), null if unknown
   * @param {string} gender - 'm' for male, 'f' for female
   * @param {number} [longitude=127.0] - birth location longitude (for future correction)
   */
  constructor(year, month, day, hour, minute, gender, longitude = 127.0) {
    this.year = year;
    this.month = month;
    this.day = day;
    this.hour = hour;
    this.minute = minute;
    this.gender = gender;
    this.longitude = longitude;

    // Whether birth time is known
    this.hasTime = (hour !== null && hour !== undefined);

    // Lazy-computed caches (null = not yet computed)
    this._discrete = null;
    this._continuous = null;
    this._matrix = null;
    this._ohengWaves = null;
    this._oheng = null;
    this._daeun = null;
    this._saeun = null;
  }

  // =================================================================
  // Discrete (Traditional) Saju
  // =================================================================

  /**
   * Compute the traditional discrete saju chart.
   *
   * Uses SajuCalculator from sajuwiki to determine the four pillars,
   * ten gods, twelve stages, hidden stems, and all related data.
   *
   * If birth time is unknown, defaults to noon (12:00) for calculation
   * but flags hasTime = false so downstream code can handle it.
   *
   * @returns {Object} SajuCalculator.calculate() result
   */
  computeDiscrete() {
    if (this._discrete) return this._discrete;

    const h = this.hasTime ? this.hour : 12;
    const m = this.hasTime ? (this.minute ?? 0) : 0;

    this._discrete = SajuCalculator.calculate(
      this.year, this.month, this.day, h, m
    );

    // Store longitude for future Phase 3 correction.
    // When longitude !== 127.0 (Korean Standard Meridian), a time
    // offset will be applied. For now, just attach it to the result.
    this._discrete._longitude = this.longitude;
    this._discrete._hasTime = this.hasTime;

    return this._discrete;
  }

  // =================================================================
  // Continuous (Trigonometric) Snapshot
  // =================================================================

  /**
   * Compute the continuous trigonometric snapshot.
   *
   * Requires the discrete result. If not yet computed, computes it first.
   * The continuous snapshot provides per-pillar branch influences,
   * oheng distributions at exact angles, and a combined weighted profile.
   *
   * @returns {Object} continuous snapshot from trig-engine
   */
  computeContinuous() {
    if (this._continuous) return this._continuous;

    const discrete = this.computeDiscrete();
    const h = this.hasTime ? this.hour : 12;
    const m = this.hasTime ? (this.minute ?? 0) : 0;

    this._continuous = computeContinuousSnapshot(discrete, h, m);

    return this._continuous;
  }

  // =================================================================
  // Twelve-Stage Matrix
  // =================================================================

  /**
   * Compute the 4x4 twelve-stage matrix.
   *
   * Each cell [stem_i, branch_j] gives the twelve-stage of pillar i's
   * stem in pillar j's branch. The diagonal represents each pillar's
   * self twelve-stage.
   *
   * @returns {Object} matrix data from twelve-stage-matrix module
   */
  computeMatrix() {
    if (this._matrix) return this._matrix;

    const discrete = this.computeDiscrete();
    this._matrix = computeTwelveStageMatrix(discrete);

    return this._matrix;
  }

  // =================================================================
  // Oheng Waves (360-degree profiles)
  // =================================================================

  /**
   * Compute 360-point oheng wave data.
   *
   * Generates oheng strength values at each degree around the circle,
   * useful for radar charts and wave visualizations.
   *
   * Note: This uses the trig-engine's ohengStrengthAtAngle internally.
   * Since oheng-waves module is not yet available, we compute inline
   * using the trig-engine functions.
   *
   * @returns {Object[]} array of 360 oheng strength objects
   */
  computeOhengWaves() {
    if (this._ohengWaves) return this._ohengWaves;
    this._ohengWaves = generateOhengWaves(360);
    return this._ohengWaves;
  }

  // =================================================================
  // Oheng Analysis (Weighted + Yongsin)
  // =================================================================

  /**
   * Compute weighted oheng distribution and yongsin analysis.
   *
   * Uses sajuwiki's OhengAnalyzer for the traditional weighted five-element
   * distribution (including 합충 transformations), and YongsinAnalyzer for
   * 신강/신약 strength assessment and 용신 recommendation.
   *
   * @returns {{ oheng: Object, yongsin: Object }}
   */
  computeOheng() {
    if (this._oheng) return this._oheng;

    const discrete = this.computeDiscrete();

    const oheng = OhengAnalyzer.calculateWeightedOheng(discrete, this.hasTime);
    const yongsin = YongsinAnalyzer.calculate(discrete, this.hasTime);

    this._oheng = { oheng, yongsin };
    return this._oheng;
  }

  // =================================================================
  // Daeun (대운 - Major Luck Periods)
  // =================================================================

  /**
   * Compute the major luck periods (대운).
   *
   * Requires gender for directionality (양남음녀 = forward, 음남양녀 = backward).
   * Returns 12 ten-year periods with their associated pillars, ten gods,
   * and twelve stages.
   *
   * @returns {Object} daeun data from DaeunCalculator
   */
  computeDaeun() {
    if (this._daeun) return this._daeun;

    const discrete = this.computeDiscrete();
    this._daeun = DaeunCalculator.calculate(discrete, this.gender);

    return this._daeun;
  }

  // =================================================================
  // Saeun (세운 - Annual Luck)
  // =================================================================

  /**
   * Compute annual luck periods (세운) for a range of years.
   *
   * @param {number} startYear - first year to compute
   * @param {number} endYear - last year to compute (inclusive)
   * @returns {Object[]} array of annual luck entries from SaeunCalculator
   */
  computeSaeun(startYear, endYear) {
    // Saeun is not cached because the year range may vary between calls.
    // If the same range is requested, we cache it.
    if (this._saeun &&
        this._saeunRange &&
        this._saeunRange[0] === startYear &&
        this._saeunRange[1] === endYear) {
      return this._saeun;
    }

    const discrete = this.computeDiscrete();
    this._saeun = SaeunCalculator.calculate(discrete, startYear, endYear);
    this._saeunRange = [startYear, endYear];

    return this._saeun;
  }

  // =================================================================
  // Wolun (월운 - Monthly Fortune)
  // =================================================================

  /**
   * Compute monthly fortune pillars (월운) for a given year.
   *
   * @param {number} year - target year
   * @returns {Object[]} array of monthly fortune entries from WolunCalculator
   */
  computeWolun(year) {
    const discrete = this.computeDiscrete();
    return WolunCalculator.calculate(discrete, year);
  }

  // =================================================================
  // Unified Chart Data Bundle
  // =================================================================

  /**
   * Compute everything and return a single data bundle.
   *
   * This is the primary entry point for visualization components.
   * All computations are triggered (if not already cached) and the
   * results are assembled into one object.
   *
   * @returns {Object} complete chart data for all visualizations
   */
  getChartData() {
    const discrete = this.computeDiscrete();
    const continuous = this.computeContinuous();
    const matrix = this.computeMatrix();
    const { oheng, yongsin } = this.computeOheng();
    const daeun = this.computeDaeun();

    // Default saeun range: from birth year to birth year + 100
    const saeunStart = this.year;
    const saeunEnd = this.year + 100;
    const saeun = this.computeSaeun(saeunStart, saeunEnd);

    return {
      // Input parameters
      input: {
        year: this.year,
        month: this.month,
        day: this.day,
        hour: this.hour,
        minute: this.minute,
        gender: this.gender,
        longitude: this.longitude,
        hasTime: this.hasTime
      },

      // Traditional discrete saju
      discrete,

      // Continuous trigonometric snapshot
      continuous,

      // 4x4 twelve-stage matrix
      matrix,

      // Weighted oheng distribution
      oheng,

      // Yongsin (용신) analysis
      yongsin,

      // Major luck periods (대운)
      daeun,

      // Annual luck (세운)
      saeun,

      // All 12 branch profiles (for reference/display)
      branchProfiles: getAllBranchProfiles(),
    };
  }

  // =================================================================
  // Serialization
  // =================================================================

  /**
   * Produce a JSON-serializable snapshot of all computed data.
   *
   * Only includes data that has been computed (lazy caches that are
   * still null are omitted). Useful for saving/restoring state or
   * sending to a worker thread.
   *
   * @returns {Object} serializable snapshot
   */
  toJSON() {
    const json = {
      input: {
        year: this.year,
        month: this.month,
        day: this.day,
        hour: this.hour,
        minute: this.minute,
        gender: this.gender,
        longitude: this.longitude,
        hasTime: this.hasTime
      }
    };

    if (this._discrete) {
      // Clone discrete but strip non-serializable Date objects
      const d = { ...this._discrete };
      if (d.birthKST instanceof Date) {
        d.birthKST = d.birthKST.toISOString();
      }
      if (d.curTermDt instanceof Date) {
        d.curTermDt = d.curTermDt.toISOString();
      }
      if (d.nextTermDt instanceof Date) {
        d.nextTermDt = d.nextTermDt.toISOString();
      }
      json.discrete = d;
    }

    if (this._continuous) {
      json.continuous = this._continuous;
    }

    if (this._matrix) {
      json.matrix = this._matrix;
    }

    if (this._oheng) {
      json.oheng = this._oheng.oheng;
      json.yongsin = this._oheng.yongsin;
    }

    if (this._daeun) {
      json.daeun = this._daeun;
    }

    if (this._saeun) {
      json.saeun = this._saeun;
    }

    return json;
  }

  // =================================================================
  // Factory / Convenience
  // =================================================================

  /**
   * Create a BirthMoment from a plain object (e.g., form data).
   *
   * @param {Object} obj - { year, month, day, hour, minute, gender, longitude }
   * @returns {BirthMoment}
   */
  static fromObject(obj) {
    return new BirthMoment(
      obj.year,
      obj.month,
      obj.day,
      obj.hour ?? null,
      obj.minute ?? null,
      obj.gender ?? 'm',
      obj.longitude ?? 127.0
    );
  }

  /**
   * Get a blended branch profile for a specific continuous angle.
   * Convenience method wrapping the branch-profile module.
   *
   * @param {number} angle - angle in degrees [0, 360)
   * @returns {Object} blended branch profile
   */
  static getBlendedBranchProfile(angle) {
    return getBlendedBranchProfile(angle);
  }
}

// ===================================================================
// Internal Helper (UNUSED — kept for reference, see generateOhengWaves import)
// ===================================================================

function _unused_await_sync_import() {
  // ohengStrengthAtAngle is exported from trig-engine.js,
  // but we only imported computeContinuousSnapshot above.
  // We need to dynamically reference it.
  // For now, provide an inline implementation using the same logic.
  const { toRad, angleDiff } = await_math_sync();
  const BRANCH_OHENG_RATIOS = [
    { 목: 0,   화: 0,   토: 0,   금: 0,   수: 1.0 },
    { 목: 0,   화: 0,   토: 0.6, 금: 0.1, 수: 0.3 },
    { 목: 0.6, 화: 0.2, 토: 0.2, 금: 0,   수: 0   },
    { 목: 1.0, 화: 0,   토: 0,   금: 0,   수: 0   },
    { 목: 0.3, 화: 0,   토: 0.6, 금: 0,   수: 0.1 },
    { 목: 0,   화: 0.6, 토: 0.2, 금: 0.2, 수: 0   },
    { 목: 0,   화: 1.0, 토: 0,   금: 0,   수: 0   },
    { 목: 0.1, 화: 0.3, 토: 0.6, 금: 0,   수: 0   },
    { 목: 0,   화: 0,   토: 0.2, 금: 0.6, 수: 0.2 },
    { 목: 0,   화: 0,   토: 0,   금: 1.0, 수: 0   },
    { 목: 0,   화: 0.1, 토: 0.6, 금: 0.3, 수: 0   },
    { 목: 0.2, 화: 0,   토: 0.2, 금: 0,   수: 0.6 }
  ];
  const OHENG_KEYS = ['목', '화', '토', '금', '수'];

  function ohengStrengthAtAngle(theta) {
    const result = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    for (let i = 0; i < 12; i++) {
      const peak = i * 30;
      const delta = angleDiff(theta, peak);
      if (Math.abs(delta) >= 90) continue;
      const inf = Math.cos(toRad(delta));
      const ratios = BRANCH_OHENG_RATIOS[i];
      for (const key of OHENG_KEYS) {
        result[key] += inf * ratios[key];
      }
    }
    return result;
  }

  return { ohengStrengthAtAngle };
}

/**
 * Internal reference to math utilities (already loaded as ES module deps).
 */
function await_math_sync() {
  // These functions match the signatures in ../utils/math.js
  const DEG_TO_RAD = Math.PI / 180;

  function toRad(deg) { return deg * DEG_TO_RAD; }

  function angleDiff(a, b) {
    return ((a - b) % 360 + 540) % 360 - 180;
  }

  return { toRad, angleDiff };
}

export default BirthMoment;
