/**
 * ===================================================================
 * oheng-sipsung-panel.js — 오행/십성 요약 패널
 * ===================================================================
 * 원국의 오행/십성 분포를 수평 바 차트로 표시하고,
 * 신강/신약 및 용신 분석 결과를 요약한다.
 */

import { OHENG_COLORS } from './color-scales.js';

const OHENG_LABELS = ['목', '화', '토', '금', '수'];
const SIPSUNG_GROUPS = [
  { key: '비겁', label: '비겁', members: ['비견', '겁재'], desc: '자아·독립' },
  { key: '식상', label: '식상', members: ['식신', '상관'], desc: '표현·창조' },
  { key: '재성', label: '재성', members: ['편재', '정재'], desc: '재물·현실' },
  { key: '관성', label: '관성', members: ['편관', '정관'], desc: '규율·책임' },
  { key: '인성', label: '인성', members: ['편인', '정인'], desc: '학문·보호' },
];

export class OhengSipsungPanel {
  constructor(containerId) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
  }

  /**
   * @param {Object} profile - computeProfile() 결과
   * @param {Object} [yongsin] - YongsinAnalyzer 결과
   */
  render(profile, yongsin) {
    if (!this.container) return;

    const oh = profile.oheng.percent;
    const sipGrouped = profile.sipsung.grouped;
    const sipDetail = profile.sipsung.percent;

    let html = '<div class="osp-grid">';

    // ── 오행 분포 ──
    html += '<div class="osp-section">';
    html += '<h4 class="osp-section-title">오행 분포</h4>';
    for (const el of OHENG_LABELS) {
      const pct = oh[el] || 0;
      const color = OHENG_COLORS[el]?.main || '#888';
      html += `
        <div class="osp-bar-row">
          <span class="osp-bar-label" style="color:${color}">${el}</span>
          <div class="osp-bar-track">
            <div class="osp-bar-fill" style="width:${Math.min(pct * 2, 100)}%;background:${color}"></div>
          </div>
          <span class="osp-bar-value">${pct.toFixed(1)}%</span>
        </div>`;
    }
    html += '</div>';

    // ── 십성 분포 ──
    html += '<div class="osp-section">';
    html += '<h4 class="osp-section-title">십성 분포</h4>';
    for (const grp of SIPSUNG_GROUPS) {
      const pct = sipGrouped[grp.key] || 0;
      const m1 = grp.members[0];
      const m2 = grp.members[1];
      const d1 = sipDetail[m1] || 0;
      const d2 = sipDetail[m2] || 0;
      html += `
        <div class="osp-bar-row">
          <span class="osp-bar-label osp-sip-label">${grp.label}</span>
          <div class="osp-bar-track">
            <div class="osp-bar-fill osp-sip-fill" style="width:${Math.min(pct * 2.5, 100)}%"></div>
          </div>
          <span class="osp-bar-value">${pct.toFixed(1)}%</span>
          <span class="osp-bar-detail">${m1} ${d1.toFixed(1)} / ${m2} ${d2.toFixed(1)}</span>
        </div>`;
    }
    html += '</div>';

    html += '</div>';

    // ── 용신 요약 ──
    if (yongsin) {
      const strength = yongsin.isStrong ? '신강' : '신약';
      const yongsinEl = yongsin.yongsin || '—';
      const reason = yongsin.reason || '';
      html += `
        <div class="osp-yongsin">
          <span class="osp-yongsin-badge ${yongsin.isStrong ? 'strong' : 'weak'}">${strength}</span>
          <span class="osp-yongsin-text">용신: <strong>${yongsinEl}</strong></span>
          ${reason ? `<span class="osp-yongsin-reason">${reason}</span>` : ''}
        </div>`;
    }

    this.container.innerHTML = html;
  }
}
