import { BirthMoment } from '../models/birth-moment.js';
import { computeContinuousSnapshot, allBranchInfluences, ohengStrengthAtAngle, timeToHourAngle } from '../core/trig-engine.js';
import { computeTwelveStageMatrix } from '../core/twelve-stage-matrix.js';
import { OHENG_COLORS } from '../viz/color-scales.js';
import { angleDiff } from '../utils/math.js';

/**
 * Angular compatibility analysis using the continuous trig model.
 * Instead of binary 합/충, uses angle difference to determine compatibility degree.
 */

const COMPAT_ZONES = [
  { min: 0, max: 15, label: '강한 합', score: 10, color: '#4CAF50' },
  { min: 15, max: 45, label: '약한 합', score: 5, color: '#8BC34A' },
  { min: 45, max: 75, label: '중립', score: 0, color: '#9E9E9E' },
  { min: 75, max: 135, label: '약한 충', score: -3, color: '#FF9800' },
  { min: 135, max: 180, label: '강한 충', score: -8, color: '#F44336' },
];

function getCompatZone(angleDelta) {
  const absDelta = Math.abs(angleDelta);
  return COMPAT_ZONES.find(z => absDelta >= z.min && absDelta < z.max) || COMPAT_ZONES[4];
}

export class GunghapModule {
  constructor() {}

  /**
   * Full compatibility analysis between two BirthMoments.
   */
  analyze(bmA, bmB) {
    const discA = bmA.computeDiscrete();
    const discB = bmB.computeDiscrete();
    const contA = bmA.computeContinuous();
    const contB = bmB.computeContinuous();
    const matrixA = bmA.computeMatrix();
    const matrixB = bmB.computeMatrix();

    // 1. Angular compatibility per pillar
    const pillarCompat = this._pillarAngularCompat(contA, contB);

    // 2. Oheng complementarity
    const ohengCompat = this._ohengComplementarity(contA, contB);

    // 3. Matrix energy resonance
    const matrixCompat = this._matrixResonance(matrixA, matrixB);

    // 4. Combined score
    const rawScore = pillarCompat.totalScore * 0.4 + ohengCompat.score * 0.35 + matrixCompat.score * 0.25;
    const normalizedScore = Math.round(Math.max(0, Math.min(100, 50 + rawScore)));

    return {
      score: normalizedScore,
      pillarCompat,
      ohengCompat,
      matrixCompat,
      personA: { discrete: discA, continuous: contA, matrix: matrixA },
      personB: { discrete: discB, continuous: contB, matrix: matrixB },
    };
  }

  /**
   * Compare angular positions of each pillar between two people.
   * Closer angles = more compatible (같은 기운을 공유).
   * 180° apart = maximum tension (정반대 기운).
   */
  _pillarAngularCompat(contA, contB) {
    const pillars = ['hour', 'month', 'year'];
    const weights = { hour: 0.25, month: 0.45, year: 0.30 };
    const results = {};
    let totalScore = 0;

    for (const p of pillars) {
      const angleA = contA[p]?.angle ?? 0;
      const angleB = contB[p]?.angle ?? 0;
      const delta = angleDiff(angleA, angleB);
      const zone = getCompatZone(delta);

      results[p] = {
        angleA,
        angleB,
        delta,
        zone: zone.label,
        score: zone.score,
        color: zone.color,
      };
      totalScore += zone.score * weights[p];
    }

    return { pillars: results, totalScore };
  }

  /**
   * Check if one person's weak elements are supplemented by the other's strong elements.
   * (오행 보완 분석)
   */
  _ohengComplementarity(contA, contB) {
    const ohA = contA.combined?.oheng || {};
    const ohB = contB.combined?.oheng || {};
    const elements = ['목', '화', '토', '금', '수'];

    let complementScore = 0;
    const details = [];

    for (const el of elements) {
      const valA = ohA[el] || 0;
      const valB = ohB[el] || 0;
      const diff = Math.abs(valA - valB);

      // If one is strong where other is weak, that's complementary
      if ((valA > 25 && valB < 15) || (valB > 25 && valA < 15)) {
        complementScore += 3;
        details.push({ element: el, type: 'complement', a: +valA.toFixed(1), b: +valB.toFixed(1) });
      }
      // If both are very similar, that's harmonious
      else if (diff < 5) {
        complementScore += 1;
        details.push({ element: el, type: 'harmony', a: +valA.toFixed(1), b: +valB.toFixed(1) });
      }
      // If both are weak, that's a shared weakness
      else if (valA < 10 && valB < 10) {
        complementScore -= 2;
        details.push({ element: el, type: 'shared_weak', a: +valA.toFixed(1), b: +valB.toFixed(1) });
      }
    }

    return { score: complementScore, details };
  }

  /**
   * Compare 4x4 matrix energy patterns.
   * If the "energy landscape" is similar, the two people resonate.
   */
  _matrixResonance(matrixA, matrixB) {
    let totalDiff = 0;
    let cellCount = 0;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const eA = matrixA.matrix[r]?.[c]?.energy || 0;
        const eB = matrixB.matrix[r]?.[c]?.energy || 0;
        totalDiff += Math.abs(eA - eB);
        cellCount++;
      }
    }

    const avgDiff = totalDiff / cellCount;
    // Lower difference = higher resonance score
    const score = (1 - avgDiff) * 10 - 5; // -5 to +5 range

    return { score, avgDiff };
  }

  /**
   * Generate HTML for the gunghap comparison view.
   */
  renderComparison(container, result) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;

    let html = '<div class="gunghap-result">';

    // Score display
    html += `<div class="gunghap-score-display">
      <div class="gunghap-score-circle" style="--score:${result.score}">
        <span class="gunghap-score-number">${result.score}</span>
        <span class="gunghap-score-label">점</span>
      </div>
      <p class="gunghap-score-desc">${this._scoreDescription(result.score)}</p>
    </div>`;

    // Pillar angular compatibility
    html += '<div class="gunghap-section"><h4>기둥별 각도 호환성</h4>';
    html += '<div class="gunghap-pillars">';
    for (const [p, data] of Object.entries(result.pillarCompat.pillars)) {
      const label = p === 'hour' ? '시주' : p === 'month' ? '월주' : '년주';
      html += `<div class="gunghap-pillar-card">
        <span class="gunghap-pillar-label">${label}</span>
        <span class="gunghap-pillar-delta" style="color:${data.color}">${Math.abs(data.delta).toFixed(1)}°</span>
        <span class="gunghap-pillar-zone" style="color:${data.color}">${data.zone}</span>
      </div>`;
    }
    html += '</div></div>';

    // Oheng complementarity
    html += '<div class="gunghap-section"><h4>오행 보완 분석</h4>';
    html += '<div class="gunghap-oheng-details">';
    for (const d of result.ohengCompat.details) {
      const icon = d.type === 'complement' ? '🔄' : d.type === 'harmony' ? '✨' : '⚠️';
      const typeLabel = d.type === 'complement' ? '보완' : d.type === 'harmony' ? '조화' : '공통 부족';
      html += `<div class="gunghap-oheng-item">
        <span style="color:${OHENG_COLORS[d.element]?.main || '#888'}">${d.element}</span>
        <span>${icon} ${typeLabel}</span>
        <span>A:${d.a}% / B:${d.b}%</span>
      </div>`;
    }
    html += '</div></div>';

    html += '</div>';
    el.innerHTML = html;
  }

  _scoreDescription(score) {
    if (score >= 80) return '매우 좋은 궁합입니다. 서로의 에너지가 조화롭게 어울립니다.';
    if (score >= 65) return '좋은 궁합입니다. 서로를 보완해주는 부분이 많습니다.';
    if (score >= 50) return '평균적인 궁합입니다. 이해와 노력이 필요합니다.';
    if (score >= 35) return '다소 어려운 궁합입니다. 서로 다른 에너지를 존중해야 합니다.';
    return '도전적인 궁합입니다. 성장의 기회로 삼을 수 있습니다.';
  }
}
