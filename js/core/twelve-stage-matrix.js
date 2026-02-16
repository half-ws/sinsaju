/**
 * ===================================================================
 * sinsaju-calculator - Twelve Stage Matrix (십이운성 매트릭스)
 * ===================================================================
 * Computes the 4x4 twelve-stage (십이운성) matrix for a saju chart.
 *
 * Each cell [row, col] represents: "How does the stem of pillar `row`
 * fare in the branch of pillar `col`?"
 *
 * The diagonal (row === col) gives the self-pillar twelve-stage for
 * each of the four pillars. Off-diagonal cells reveal cross-pillar
 * energy relationships.
 *
 * Energy levels and phase categories are provided for heatmap coloring
 * and quick visual interpretation.
 */

import {
  TWELVE_STAGES,
  JANGSEONG_POSITION,
  CHEONGAN,
  JIJI
} from '../lib/sajuwiki/constants.js';

// ===================================================================
// Energy & Phase Maps
// ===================================================================

/**
 * Maps each of the 12 stages (십이운성) to a normalized energy level
 * in [0, 1] for heatmap coloring and comparative analysis.
 *
 * Energy flow follows the life-cycle metaphor:
 *   장생(0.50) -> 목욕(0.40) -> 관대(0.60) -> 건록(0.80) -> 제왕(1.00)
 *   -> 쇠(0.35) -> 병(0.25) -> 사(0.15) -> 묘(0.05) -> 절(0.10)
 *   -> 태(0.20) -> 양(0.30)
 */
export const ENERGY_MAP = {
  '장생': 0.50,
  '목욕': 0.40,
  '관대': 0.60,
  '건록': 0.80,
  '제왕': 1.00,
  '쇠':   0.35,
  '병':   0.25,
  '사':   0.15,
  '묘':   0.05,
  '절':   0.10,
  '태':   0.20,
  '양':   0.30
};

/**
 * Determine the phase category for a given energy level.
 *
 * Phases:
 *   - 'peak':    energy >= 0.6 (관대, 건록, 제왕)
 *   - 'growth':  energy >= 0.3 (장생, 목욕, 쇠, 양)
 *   - 'decline': energy < 0.3  (병, 사, 묘, 절, 태)
 *
 * @param {number} energy - energy level in [0, 1]
 * @returns {string} phase category
 */
function getPhase(energy) {
  if (energy >= 0.6) return 'peak';
  if (energy >= 0.3) return 'growth';
  return 'decline';
}

// ===================================================================
// Core Twelve-Stage Calculation
// ===================================================================

/**
 * Compute the twelve-stage (십이운성) for a given stem and branch.
 *
 * Replicates the traditional logic:
 *   - 양간 (even stem index): count forward from the 장생 position
 *   - 음간 (odd stem index): count backward from the 장생 position
 *
 * @param {number} stemIdx - heavenly stem index (0-9)
 * @param {number} branchIdx - earthly branch index (0-11)
 * @returns {{ stage: string, stageIdx: number }} stage name and index
 */
export function getTwelveStage(stemIdx, branchIdx) {
  const startPos = JANGSEONG_POSITION[stemIdx];
  let position;

  if (stemIdx % 2 === 0) {
    // 양간: 순행 (forward)
    position = ((branchIdx - startPos) % 12 + 12) % 12;
  } else {
    // 음간: 역행 (backward)
    position = ((startPos - branchIdx) % 12 + 12) % 12;
  }

  return {
    stage: TWELVE_STAGES[position],
    stageIdx: position
  };
}

/**
 * Get the energy value for a twelve-stage name.
 *
 * @param {string} stageName - twelve-stage name (e.g. '장생', '제왕')
 * @returns {number} energy value in [0, 1], or 0 if stage not found
 */
export function stageToEnergy(stageName) {
  return ENERGY_MAP[stageName] ?? 0;
}

// ===================================================================
// Matrix Computation
// ===================================================================

/**
 * Compute the 4x4 twelve-stage matrix from a SajuCalculator result.
 *
 * The matrix is organized as:
 *   - Rows = stems from [년, 월, 일, 시] pillars
 *   - Columns = branches from [년, 월, 일, 시] pillars
 *   - Cell [r][c] = twelve-stage of row's stem in column's branch
 *
 * The diagonal cells (r === c) are the self-pillar twelve-stages,
 * which correspond to the traditional 십이운성 displayed on a chart.
 *
 * @param {Object} result - output from SajuCalculator.calculate()
 *   Expected: result.idxs.year/month/day/hour = 60갑자 indices (0-59)
 *   If hour index is -1 or missing, the hour row/column uses index 0.
 * @returns {Object} matrix data bundle
 *   - matrix: 4x4 array of { stage, stageIdx, energy, phase, row, col }
 *   - stemLabels: 4 stem names (천간)
 *   - branchLabels: 4 branch names (지지)
 *   - pillarLabels: ['년', '월', '일', '시']
 *   - diagonal: array of 4 diagonal cells (self-pillar stages)
 *   - totalEnergy: sum of all 16 cells' energy values
 *   - avgEnergy: average energy across all 16 cells
 */
export function computeTwelveStageMatrix(result) {
  const pillarKeys = ['year', 'month', 'day', 'hour'];

  // Extract stem and branch indices from 60갑자 indices.
  // stemIdx = idx60 % 10, branchIdx = idx60 % 12
  const stems = pillarKeys.map(p => {
    const idx60 = result.idxs[p];
    // Handle missing hour (-1 or undefined)
    if (idx60 == null || idx60 < 0) return 0;
    return idx60 % 10;
  });

  const branches = pillarKeys.map(p => {
    const idx60 = result.idxs[p];
    if (idx60 == null || idx60 < 0) return 0;
    return idx60 % 12;
  });

  // Build 4x4 matrix
  const matrix = stems.map((stemIdx, row) =>
    branches.map((branchIdx, col) => {
      const { stage, stageIdx } = getTwelveStage(stemIdx, branchIdx);
      const energy = ENERGY_MAP[stage];
      return {
        stage,
        stageIdx,
        energy,
        phase: getPhase(energy),
        row,
        col
      };
    })
  );

  // Extract diagonal (self-pillar stages)
  const diagonal = matrix.map((row, i) => row[i]);

  // Compute aggregate energy stats
  let totalEnergy = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      totalEnergy += matrix[r][c].energy;
    }
  }
  const avgEnergy = totalEnergy / 16;

  return {
    matrix,
    stemLabels: stems.map(i => CHEONGAN[i]),
    branchLabels: branches.map(i => JIJI[i]),
    pillarLabels: ['년', '월', '일', '시'],
    diagonal,
    totalEnergy,
    avgEnergy
  };
}
