/**
 * pillar-display.js — Traditional 4-pillar HTML renderer
 * Renders 시주/일주/월주/년주 in right-to-left traditional layout.
 * Shows each pillar's OWN stem-branch twelve-stage (not day-stem-based).
 */

import { formatPillar } from '../utils/format.js';
import { getTwelveStage, stageToEnergy, ENERGY_MAP } from '../core/twelve-stage-matrix.js';

const PILLAR_LABELS = ['시주', '일주', '월주', '년주'];

function stemToElement(stemIdx) {
  return Math.floor(stemIdx / 2);
}

function branchToElement(branchIdx) {
  const map = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  return map[branchIdx];
}

function ohengColor(elIdx) {
  const colors = ['#34C759', '#FF3B30', '#C8A000', '#A0A0A8', '#0071E3'];
  return colors[elIdx] || '#e8e8f0';
}

export class PillarDisplay {
  constructor(container) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
  }

  render(discreteResult, hasTime) {
    const pillars = ['hour', 'day', 'month', 'year'];
    let html = '<div class="pillar-grid">';

    for (let i = 0; i < 4; i++) {
      const key = pillars[i];

      if (!hasTime && key === 'hour') {
        html += `<div class="pillar-card pillar-unknown">
          <span class="pillar-label">시주</span>
          <span class="pillar-unknown-text">시간 미상</span>
        </div>`;
        continue;
      }

      const idx60 = discreteResult.idxs[key];
      const { kr, hanja, stemIdx, branchIdx } = formatPillar(idx60);
      const stemEl = stemToElement(stemIdx);
      const branchEl = branchToElement(branchIdx);
      const tgStem = discreteResult.tgStem?.[key] || '';
      const tgBranch = discreteResult.tgBranch?.[key] || '';

      // Self-pillar twelve-stage: this pillar's own stem in its own branch
      const { stage } = getTwelveStage(stemIdx, branchIdx);
      const energy = stageToEnergy(stage);
      const energyPct = Math.round(energy * 100);

      html += `<div class="pillar-card ${key === 'day' ? 'pillar-card-day' : ''}">
        <span class="pillar-label">${PILLAR_LABELS[i]}</span>
        <div class="pillar-tengod">${tgStem || ''}</div>
        <div class="pillar-stem" style="color:${ohengColor(stemEl)}">
          <span class="pillar-hanja">${hanja[0]}</span>
          <span class="pillar-kr">${kr[0]}</span>
        </div>
        <div class="pillar-branch" style="color:${ohengColor(branchEl)}">
          <span class="pillar-hanja">${hanja[1]}</span>
          <span class="pillar-kr">${kr[1]}</span>
        </div>
        <div class="pillar-tengod-branch">${tgBranch || ''}</div>
        <div class="pillar-ts">
          <span class="pillar-ts-name">${stage}</span>
          <span class="pillar-ts-bar"><span class="pillar-ts-fill" style="width:${energyPct}%"></span></span>
        </div>
      </div>`;
    }

    html += '</div>';
    this.container.innerHTML = html;
  }
}
