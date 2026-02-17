/**
 * ===================================================================
 * fortune-explorer.js — 운세 탐색기
 * ===================================================================
 * 연도 슬라이더 + 원국 vs 운세 비교 뷰.
 * 좌: 사주원국 오행/십성 + 원형 차트
 * 우: 운세 적용 오행/십성 + 원형 차트(대운/세운)
 * 슬라이더를 드래그하면 우측 바 차트가 실시간 갱신.
 */

import { OHENG_COLORS } from './color-scales.js';

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

export class FortuneExplorer {
  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    this._data = null;
    this._natalProfile = null;
    this._rafId = null;
    this._pendingIdx = null;
    this._built = false;

    // DOM 참조
    this._yearLabel = null;
    this._pillarLabel = null;
    this._slider = null;
    this._natalBars = null;
    this._fortuneBars = null;
    this._fortuneTitle = null;
    this._interactionsEl = null;
  }

  /**
   * @param {Object} timeSeriesData - generateFortuneTimeSeries() 결과
   * @param {Object} natalProfile - computeProfile() 결과 (운세 미적용 원국)
   */
  render(timeSeriesData, natalProfile) {
    if (!this.container) return;
    this._data = timeSeriesData;
    this._natalProfile = natalProfile;

    if (!this._built) {
      this._buildDOM();
      this._built = true;
    }

    const yearly = timeSeriesData.yearly;
    if (!yearly || yearly.length === 0) return;

    // 슬라이더 범위 설정
    this._slider.min = 0;
    this._slider.max = yearly.length - 1;

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
    const idx = parseInt(this._slider.value, 10);
    this._pendingIdx = idx;
    if (this._rafId == null) {
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        if (this._pendingIdx != null) {
          this._updateFortune(this._pendingIdx);
          this._pendingIdx = null;
        }
      });
    }
  }

  _updateFortune(idx) {
    const yearly = this._data?.yearly;
    if (!yearly || idx < 0 || idx >= yearly.length) return;

    const entry = yearly[idx];

    // 헤더 갱신
    this._yearLabel.textContent = `${entry.year}년 (${entry.age}세)`;
    const daeunStr = entry.daeun ? `${entry.daeun.pillar} 대운` : '';
    const saeunStr = entry.saeun ? `${entry.saeun.pillar} 세운` : '';
    this._pillarLabel.textContent = [daeunStr, saeunStr].filter(Boolean).join(' · ');

    // 운세 열 제목
    this._fortuneTitle.textContent = `${entry.year}년 운세 적용`;

    // 운세 바 차트
    this._renderFortuneBars(entry);

    // 합충 이벤트
    this._renderInteractions(entry.interactions);
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
  const fillCls = isSipsung ? 'osp-bar-fill' : 'osp-bar-fill';
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
        <div class="${fillCls}" style="${fillStyle}"></div>
      </div>
      <span class="osp-bar-value">${pct.toFixed(1)}%</span>
      ${deltaHtml}
      ${detailHtml}
    </div>`;
}
