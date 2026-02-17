/**
 * ===================================================================
 * fortune-explorer.js — 신 사주 차트
 * ===================================================================
 * 연도 슬라이더 + 원국 vs 운세 비교 뷰 + 운세 기둥(대운/세운) 표시.
 * 좌: 사주원국 오행/십성 + 원형 차트
 * 우: 운세 적용 오행/십성 + 원형 차트(대운/세운)
 * 슬라이더를 드래그하면 우측 바 차트 + 운세 기둥이 실시간 갱신.
 */

import { OHENG_COLORS } from './color-scales.js';
import { formatPillar } from '../utils/format.js';
import { getTwelveStage, stageToEnergy } from '../core/twelve-stage-matrix.js';
import { SajuCalculator } from '../lib/sajuwiki/calculator.js';
import { CHEONGAN, JIJI, JIJANGGAN } from '../lib/sajuwiki/constants.js';

const OHENG_LABELS = ['목', '화', '토', '금', '수'];

const SIPSUNG_GROUPS = [
  { key: '비겁', members: ['비견', '겁재'] },
  { key: '식상', members: ['식신', '상관'] },
  { key: '재성', members: ['편재', '정재'] },
  { key: '관성', members: ['편관', '정관'] },
  { key: '인성', members: ['편인', '정인'] },
];

const SIPSUNG_GROUP_COLOR = {
  비겁: '#6366F1',
  식상: '#EC4899',
  재성: '#F59E0B',
  관성: '#10B981',
  인성: '#3B82F6',
};

function ohengColor(elIdx) {
  const colors = ['#34C759', '#FF3B30', '#C8A000', '#A0A0A8', '#0071E3'];
  return colors[elIdx] || '#e8e8f0';
}

function stemToElement(stemIdx) {
  return Math.floor(stemIdx / 2);
}

function branchToElement(branchIdx) {
  const map = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  return map[branchIdx];
}

export class FortuneExplorer {
  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    this._data = null;
    this._natalProfile = null;
    this._dayStemIdx = null;
    this._rafId = null;
    this._pendingVal = null;
    this._built = false;
    this._onSliderChangeCallback = null;

    // Fortune pillar DOM
    this._fortunePillarEl = document.getElementById('fe-fortune-pillars');

    // DOM refs
    this._yearLabel = null;
    this._pillarLabel = null;
    this._slider = null;
    this._natalBars = null;
    this._fortuneBars = null;
    this._fortuneTitle = null;
    this._interactionsEl = null;
  }

  /**
   * Set callback for slider changes (for external chart updates).
   * @param {Function} cb - (nearestEntry, interpolated) => void
   */
  onSliderChange(cb) {
    this._onSliderChangeCallback = cb;
  }

  /**
   * @param {Object} timeSeriesData - generateFortuneTimeSeries() 결과
   * @param {Object} natalProfile - computeProfile() 결과 (운세 미적용 원국)
   * @param {number} dayStemIdx - 일간 인덱스 (십성 계산용)
   */
  render(timeSeriesData, natalProfile, dayStemIdx) {
    if (!this.container) return;
    this._data = timeSeriesData;
    this._natalProfile = natalProfile;
    this._dayStemIdx = dayStemIdx ?? null;

    if (!this._built) {
      this._buildDOM();
      this._built = true;
    }

    const yearly = timeSeriesData.yearly;
    if (!yearly || yearly.length === 0) return;

    // 슬라이더 범위 — step="any" for continuous interpolation
    this._slider.min = 0;
    this._slider.max = yearly.length - 1;
    this._slider.step = 'any';

    // 현재 연도 찾기
    const currentYear = new Date().getFullYear();
    let initIdx = 0;
    for (let i = 0; i < yearly.length; i++) {
      if (yearly[i].year >= currentYear) { initIdx = i; break; }
    }
    this._slider.value = initIdx;

    // 원국(좌측) 바 차트 — 한 번만 렌더링
    this._renderNatalBars();

    // 운세(우측) — 초기 연도로 렌더링
    this._updateFortune(initIdx);
  }

  _buildDOM() {
    this.container.innerHTML = '';

    // 슬라이더 영역
    const sliderArea = _el('div', 'fe-slider-area');

    const header = _el('div', 'fe-header');
    this._yearLabel = _el('span', 'fe-year-label');
    this._pillarLabel = _el('span', 'fe-pillar-label');
    header.append(this._yearLabel, this._pillarLabel);

    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.className = 'fe-slider';
    this._slider.addEventListener('input', () => this._onSliderInput());

    sliderArea.append(header, this._slider);

    // 비교 영역
    const compare = _el('div', 'fe-compare');

    // 좌측: 원국
    const natalCol = _el('div', 'fe-col');
    const natalTitle = _el('h4', 'fe-col-title');
    natalTitle.textContent = '사주원국';
    this._natalBars = _el('div', 'fe-bars');
    const natalChartArea = _el('div', 'fe-chart-area');
    natalChartArea.id = 'fe-circular-chart';
    natalCol.append(natalTitle, this._natalBars, natalChartArea);

    // 우측: 운세 적용
    const fortuneCol = _el('div', 'fe-col');
    this._fortuneTitle = _el('h4', 'fe-col-title');
    this._fortuneTitle.textContent = '운세 적용';
    this._fortuneBars = _el('div', 'fe-bars');
    const fortuneChartArea = _el('div', 'fe-chart-area');
    fortuneChartArea.id = 'fe-fortune-overlay-chart';
    fortuneCol.append(this._fortuneTitle, this._fortuneBars, fortuneChartArea);

    compare.append(natalCol, fortuneCol);

    // 합충 영역
    this._interactionsEl = _el('div', 'fe-interactions');

    this.container.append(sliderArea, compare, this._interactionsEl);
  }

  _onSliderInput() {
    const val = parseFloat(this._slider.value);
    this._pendingVal = val;
    if (this._rafId == null) {
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        if (this._pendingVal != null) {
          this._updateFortune(this._pendingVal);
          this._pendingVal = null;
        }
      });
    }
  }

  _updateFortune(val) {
    const yearly = this._data?.yearly;
    if (!yearly || yearly.length === 0) return;

    // Continuous interpolation between adjacent entries
    const floor = Math.max(0, Math.min(Math.floor(val), yearly.length - 1));
    const ceil = Math.min(floor + 1, yearly.length - 1);
    const t = val - floor;

    const entryA = yearly[floor];
    const entryB = yearly[ceil];

    // For labels/pillars, use the nearest integer entry
    const nearest = t < 0.5 ? entryA : entryB;

    // 헤더 갱신
    this._yearLabel.textContent = `${nearest.year}년 (${nearest.age}세)`;
    const daeunStr = nearest.daeun ? `${nearest.daeun.pillar} 대운` : '';
    const saeunStr = nearest.saeun ? `${nearest.saeun.pillar} 세운` : '';
    this._pillarLabel.textContent = [daeunStr, saeunStr].filter(Boolean).join(' · ');

    // 운세 열 제목
    this._fortuneTitle.textContent = `${nearest.year}년 운세 적용`;

    // 보간된 운세 바 차트
    const interpolated = this._interpolate(entryA, entryB, t);
    this._renderFortuneBars(interpolated);

    // 합충 이벤트
    this._renderInteractions(nearest.interactions);

    // 운세 기둥 카드 갱신
    this._updateFortunePillars(nearest);

    // 외부 콜백 (원형 차트 갱신 등)
    if (this._onSliderChangeCallback) {
      this._onSliderChangeCallback(nearest, interpolated);
    }
  }

  /**
   * 두 연도 데이터 사이를 선형 보간.
   */
  _interpolate(a, b, t) {
    if (t <= 0.001 || a === b) return a;
    const lerp = (v1, v2) => v1 + (v2 - v1) * t;

    const oh = {};
    for (const el of OHENG_LABELS) {
      oh[el] = lerp(a.oheng?.percent?.[el] || 0, b.oheng?.percent?.[el] || 0);
    }

    const sg = {};
    const sd = {};
    for (const grp of SIPSUNG_GROUPS) {
      sg[grp.key] = lerp(a.sipsung?.grouped?.[grp.key] || 0, b.sipsung?.grouped?.[grp.key] || 0);
      for (const m of grp.members) {
        sd[m] = lerp(a.sipsung?.percent?.[m] || 0, b.sipsung?.percent?.[m] || 0);
      }
    }

    const dOh = {};
    for (const el of OHENG_LABELS) {
      dOh[el] = lerp(a.delta?.oheng?.[el] || 0, b.delta?.oheng?.[el] || 0);
    }
    const dSip = {};
    for (const grp of SIPSUNG_GROUPS) {
      dSip[grp.key] = lerp(a.delta?.sipsung?.[grp.key] || 0, b.delta?.sipsung?.[grp.key] || 0);
    }

    return {
      ...a,
      oheng: { ...a.oheng, percent: oh },
      sipsung: { ...a.sipsung, grouped: sg, percent: sd },
      delta: { oheng: dOh, sipsung: dSip },
    };
  }

  /**
   * 운세 기둥 카드 (대운 + 세운) 갱신.
   */
  _updateFortunePillars(entry) {
    if (!this._fortunePillarEl) return;

    const daeunIdx = entry.daeun?.idx;
    const saeunIdx = entry.saeun?.idx;
    const row = document.getElementById('pillar-display-row');

    if (daeunIdx == null && saeunIdx == null) {
      this._fortunePillarEl.style.display = 'none';
      if (row) row.classList.remove('has-fortune-pillars');
      return;
    }

    let html = '<div class="pillar-grid fe-pillar-grid">';

    if (daeunIdx != null) {
      html += this._buildPillarCard(daeunIdx, '대운');
    }
    if (saeunIdx != null) {
      html += this._buildPillarCard(saeunIdx, '세운');
    }

    html += '</div>';
    this._fortunePillarEl.innerHTML = html;
    this._fortunePillarEl.style.display = '';
    if (row) row.classList.add('has-fortune-pillars');
  }

  /**
   * 운세 기둥 카드 HTML (사주 명식과 동일 포맷).
   */
  _buildPillarCard(idx60, label) {
    const { kr, hanja, stemIdx, branchIdx } = formatPillar(idx60);
    const stemEl = stemToElement(stemIdx);
    const branchEl = branchToElement(branchIdx);
    const dsi = this._dayStemIdx;

    // 천간 십성 (일간 기준)
    let tgStem = '';
    if (dsi != null) {
      tgStem = SajuCalculator.getTenGod(dsi, stemIdx);
    }

    // 지지 십성 (본기 기준)
    let tgBranch = '';
    if (dsi != null) {
      const branchChar = JIJI[branchIdx];
      const hidden = JIJANGGAN[branchChar];
      if (hidden) {
        const main = hidden.find(h => h.t === '본기') || hidden[0];
        if (main) {
          tgBranch = SajuCalculator.getTenGod(dsi, CHEONGAN.indexOf(main.s));
        }
      }
    }

    // 십이운성 (일간 기준)
    const { stage } = dsi != null
      ? getTwelveStage(dsi, branchIdx)
      : getTwelveStage(stemIdx, branchIdx);
    const energy = stageToEnergy(stage);
    const energyPct = Math.round(energy * 100);

    return `<div class="pillar-card fe-pillar-card">
      <span class="pillar-label">${label}</span>
      <div class="pillar-tengod">${tgStem}</div>
      <div class="pillar-stem" style="color:${ohengColor(stemEl)}">
        <span class="pillar-hanja">${hanja[0]}</span>
        <span class="pillar-kr">${kr[0]}</span>
      </div>
      <div class="pillar-branch" style="color:${ohengColor(branchEl)}">
        <span class="pillar-hanja">${hanja[1]}</span>
        <span class="pillar-kr">${kr[1]}</span>
      </div>
      <div class="pillar-tengod-branch">${tgBranch}</div>
      <div class="pillar-ts">
        <span class="pillar-ts-name">${stage}</span>
        <span class="pillar-ts-bar"><span class="pillar-ts-fill" style="width:${energyPct}%"></span></span>
      </div>
    </div>`;
  }

  _renderNatalBars() {
    const oh = this._natalProfile.oheng.percent;
    const sg = this._natalProfile.sipsung.grouped;
    const sd = this._natalProfile.sipsung.percent;

    let html = '<div class="fe-section-label">오행 분포</div>';
    for (const el of OHENG_LABELS) {
      const pct = oh[el] || 0;
      const color = OHENG_COLORS[el]?.main || '#888';
      html += _barRow(el, pct, color, null, null, false);
    }

    html += '<div class="fe-section-label" style="margin-top:12px">십성 분포</div>';
    for (const grp of SIPSUNG_GROUPS) {
      const pct = sg[grp.key] || 0;
      const color = SIPSUNG_GROUP_COLOR[grp.key];
      const d1 = sd[grp.members[0]] || 0;
      const d2 = sd[grp.members[1]] || 0;
      const detail = `${grp.members[0]} ${d1.toFixed(1)} / ${grp.members[1]} ${d2.toFixed(1)}`;
      html += _barRow(grp.key, pct, color, null, detail, true);
    }

    this._natalBars.innerHTML = html;
  }

  _renderFortuneBars(entry) {
    const oh = entry.oheng?.percent || {};
    const sg = entry.sipsung?.grouped || {};
    const sd = entry.sipsung?.percent || {};
    const dOh = entry.delta?.oheng || {};
    const dSip = entry.delta?.sipsung || {};

    let html = '<div class="fe-section-label">오행 분포</div>';
    for (const el of OHENG_LABELS) {
      const pct = oh[el] || 0;
      const color = OHENG_COLORS[el]?.main || '#888';
      const delta = dOh[el] || 0;
      html += _barRow(el, pct, color, delta, null, false);
    }

    html += '<div class="fe-section-label" style="margin-top:12px">십성 분포</div>';
    for (const grp of SIPSUNG_GROUPS) {
      const pct = sg[grp.key] || 0;
      const color = SIPSUNG_GROUP_COLOR[grp.key];
      const delta = dSip[grp.key] || 0;
      const d1 = sd[grp.members[0]] || 0;
      const d2 = sd[grp.members[1]] || 0;
      const detail = `${grp.members[0]} ${d1.toFixed(1)} / ${grp.members[1]} ${d2.toFixed(1)}`;
      html += _barRow(grp.key, pct, color, delta, detail, true);
    }

    this._fortuneBars.innerHTML = html;
  }

  _renderInteractions(interactions) {
    if (!interactions || interactions.length === 0) {
      this._interactionsEl.innerHTML = '';
      return;
    }

    const badges = interactions.map(i => {
      const isClash = i.type.includes('충');
      const cls = isClash ? 'fe-badge clash' : 'fe-badge combine';
      return `<span class="${cls}">${i.desc} (${i.source}↔${i.target})</span>`;
    }).join('');

    this._interactionsEl.innerHTML = badges;
  }
}

// ─── Helpers ───

function _el(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function _barRow(label, pct, color, delta, detail, isSipsung) {
  const labelCls = isSipsung ? 'osp-bar-label osp-sip-label' : 'osp-bar-label';
  const labelStyle = isSipsung ? '' : ` style="color:${color}"`;
  const fillStyle = isSipsung
    ? `width:${Math.min(pct * 2.5, 100)}%;background:${color};opacity:0.7`
    : `width:${Math.min(pct * 2, 100)}%;background:${color}`;

  let deltaHtml = '';
  if (delta != null) {
    if (Math.abs(delta) >= 0.05) {
      const sign = delta > 0 ? '+' : '';
      const cls = delta > 0 ? 'fe-delta pos' : 'fe-delta neg';
      deltaHtml = `<span class="${cls}">${sign}${delta.toFixed(1)}</span>`;
    }
  }

  let detailHtml = '';
  if (detail) {
    detailHtml = `<span class="osp-bar-detail">${detail}</span>`;
  }

  return `
    <div class="osp-bar-row">
      <span class="${labelCls}"${labelStyle}>${label}</span>
      <div class="osp-bar-track">
        <div class="osp-bar-fill" style="${fillStyle}"></div>
      </div>
      <span class="osp-bar-value">${pct.toFixed(1)}%</span>
      ${deltaHtml}
      ${detailHtml}
    </div>`;
}
