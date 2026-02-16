import { ohengStrengthAtAngle, allBranchInfluences } from '../core/trig-engine.js';
import { stageToEnergy } from '../core/twelve-stage-matrix.js';
import { generateOhengWaves } from '../core/oheng-waves.js';
import { OHENG_COLORS } from '../viz/color-scales.js';
import { formatPillar } from '../utils/format.js';
import { WaveformChart } from '../viz/waveform-chart.js';

const JIJI_HANJA = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const JIJI_OHENG = ['수','토','목','목','토','화','화','토','금','금','토','수'];

export class FortuneModule {
  constructor() {
    this._fortuneWaveform = null;
  }

  _enhancePeriod(period) {
    if (!period) return period;
    const idx60 = period.idx60 ?? period.idx ?? period.pillarIdx ?? null;
    if (idx60 === null) return period;
    const branchIdx = idx60 % 12;
    const angle = branchIdx * 30;
    return {
      ...period,
      branchIdx,
      branchAngle: angle,
      oheng: ohengStrengthAtAngle(angle),
      energy: stageToEnergy(period.ts || ''),
    };
  }

  renderTimeline(container, fortuneData, birthMoment) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    const daeunList = fortuneData.daeun || [];
    const saeunList = fortuneData.saeun || [];

    let html = '<div class="fortune-timeline">';

    // ── 대운 cards ──
    if (daeunList.length > 0) {
      html += '<h4 class="fortune-section-title">대운 (10년 주기)</h4>';
      html += '<div class="fortune-daeun-track">';
      for (const d of daeunList) {
        const enhanced = this._enhancePeriod(d);
        const pillarInfo = this._getPillarDisplay(d);
        const age = d.age ?? d.startAge ?? '?';
        const oheng = enhanced.oheng || {};
        const maxEl = this._getMaxElement(oheng);
        const color = maxEl ? (OHENG_COLORS[maxEl]?.main || '#888') : '#888';

        html += `<div class="fortune-daeun-card" style="border-top: 3px solid ${color}">
          <span class="fortune-age">${age}세~</span>
          <span class="fortune-pillar">${pillarInfo}</span>
          <span class="fortune-ts">${d.ts || d.tsSelf || ''}</span>
        </div>`;
      }
      html += '</div>';

      // ── 대운 circular chart ──
      html += '<div class="fortune-viz-row">';
      html += '<div class="fortune-circle-wrap">';
      html += this._renderFortuneCircle(daeunList, '대운');
      html += '</div>';

      // ── 대운 waveform container ──
      html += '<div class="fortune-wave-wrap" id="fortune-daeun-wave"></div>';
      html += '</div>';
    }

    // ── 세운 cards ──
    if (saeunList.length > 0) {
      const currentYear = new Date().getFullYear();
      html += '<h4 class="fortune-section-title">세운 (연간)</h4>';
      html += '<div class="fortune-saeun-track">';
      for (const s of saeunList) {
        const enhanced = this._enhancePeriod(s);
        const year = s.year ?? s.calYear ?? '?';
        const isCurrent = year === currentYear;
        const pillarInfo = this._getPillarDisplay(s);
        const oheng = enhanced.oheng || {};
        const maxEl = this._getMaxElement(oheng);
        const color = maxEl ? (OHENG_COLORS[maxEl]?.main || '#888') : '#888';

        html += `<div class="fortune-saeun-card ${isCurrent ? 'fortune-current' : ''}" style="border-left: 3px solid ${color}">
          <span class="fortune-year">${year}</span>
          <span class="fortune-pillar">${pillarInfo}</span>
        </div>`;
      }
      html += '</div>';
    }

    if (daeunList.length === 0 && saeunList.length === 0) {
      html += '<p style="color:var(--text-dim);text-align:center;">대운/세운 데이터가 없습니다.</p>';
    }

    html += '</div>';
    el.innerHTML = html;

    // Render fortune waveform (after DOM is set)
    if (daeunList.length > 0) {
      this._renderFortuneWaveform(daeunList);
    }
  }

  /**
   * SVG circular chart showing 대운/세운 positions on the 12-branch ring.
   */
  _renderFortuneCircle(periodList, label) {
    const size = 260;
    const cx = size / 2, cy = size / 2;
    const ringR = size / 2 - 30;
    const innerR = ringR - 20;

    let svg = `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px">`;

    // Background
    svg += `<circle cx="${cx}" cy="${cy}" r="${ringR + 16}" fill="#f8f8fa" stroke="#ddd" stroke-width="0.5"/>`;

    // 12 branch sectors
    for (let i = 0; i < 12; i++) {
      const startA = i * 30 - 15;
      const endA = i * 30 + 15;
      const el = JIJI_OHENG[i];
      const color = OHENG_COLORS[el]?.main || '#888';
      svg += this._arcPath(cx, cy, innerR, ringR, startA, endA, color, 0.18);
    }

    // Branch labels
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 - 90) * Math.PI / 180;
      const lx = cx + (ringR + 12) * Math.cos(a);
      const ly = cy + (ringR + 12) * Math.sin(a);
      const el = JIJI_OHENG[i];
      const color = OHENG_COLORS[el]?.main || '#666';
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="22" font-weight="600" font-family="'Noto Serif KR', serif">${JIJI_HANJA[i]}</text>`;
    }

    // 대운 progression path + dots
    const midR = (innerR + ringR) / 2;
    const enhanced = periodList.map(d => this._enhancePeriod(d));
    const points = enhanced.map(d => {
      const aRad = ((d.branchAngle ?? 0) - 90) * Math.PI / 180;
      return { x: cx + midR * Math.cos(aRad), y: cy + midR * Math.sin(aRad) };
    });

    // Path line
    if (points.length > 1) {
      let pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
      }
      svg += `<path d="${pathD}" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    }

    // Dots + age labels
    for (let i = 0; i < enhanced.length; i++) {
      const d = enhanced[i];
      const p = points[i];
      const oheng = d.oheng || {};
      const maxEl = this._getMaxElement(oheng);
      const color = maxEl ? (OHENG_COLORS[maxEl]?.main || '#888') : '#888';
      const age = periodList[i].age ?? periodList[i].startAge ?? '';
      const isFirst = i === 0;

      svg += `<circle cx="${p.x}" cy="${p.y}" r="${isFirst ? 6 : 4.5}" fill="${color}" stroke="white" stroke-width="1.5"/>`;

      // Age label (small, outside)
      const aRad = ((d.branchAngle ?? 0) - 90) * Math.PI / 180;
      const lx = cx + (midR - 16) * Math.cos(aRad);
      const ly = cy + (midR - 16) * Math.sin(aRad);
      svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="rgba(0,0,0,0.4)" font-size="16" font-family="sans-serif">${age}</text>`;
    }

    svg += '</svg>';
    return svg;
  }

  _arcPath(cx, cy, innerR, outerR, startDeg, endDeg, color, opacity) {
    const toRad = d => (d - 90) * Math.PI / 180;
    const s = toRad(startDeg), e = toRad(endDeg);
    const x1o = cx + outerR * Math.cos(s), y1o = cy + outerR * Math.sin(s);
    const x2o = cx + outerR * Math.cos(e), y2o = cy + outerR * Math.sin(e);
    const x1i = cx + innerR * Math.cos(e), y1i = cy + innerR * Math.sin(e);
    const x2i = cx + innerR * Math.cos(s), y2i = cy + innerR * Math.sin(s);
    const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
    const d = `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
    return `<path d="${d}" fill="${color}" opacity="${opacity}" stroke="#e0e0e8" stroke-width="0.3"/>`;
  }

  /**
   * Render a mini waveform showing 대운 positions on the oheng spectrum.
   */
  _renderFortuneWaveform(daeunList) {
    const container = document.getElementById('fortune-daeun-wave');
    if (!container) return;

    const waveData = generateOhengWaves(360);

    // Build birth angles object with 대운 positions
    const enhanced = daeunList.map(d => this._enhancePeriod(d));

    // Use a WaveformChart but with 대운 markers
    const chart = new WaveformChart(container, { width: 600, height: 200 });

    // Create marker angles from 대운 entries
    const fortuneAngles = {};
    // Show first 4 대운 as individual markers, or show current period
    const currentYear = new Date().getFullYear();
    let currentDaeun = null, nextDaeun = null;
    for (let i = 0; i < enhanced.length; i++) {
      const d = enhanced[i];
      const calYear = daeunList[i].calYear;
      const nextCalYear = i + 1 < daeunList.length ? daeunList[i + 1].calYear : calYear + 10;
      if (calYear <= currentYear && currentYear < nextCalYear) {
        currentDaeun = d;
      }
      if (calYear > currentYear && !nextDaeun) {
        nextDaeun = d;
      }
    }

    // Show first, current, and last 대운 as markers
    const markers = {};
    if (enhanced[0]) markers.year = enhanced[0].branchAngle;
    if (currentDaeun) markers.day = currentDaeun.branchAngle;
    if (nextDaeun) markers.month = nextDaeun.branchAngle;
    if (enhanced[enhanced.length - 1]) markers.hour = enhanced[enhanced.length - 1].branchAngle;

    chart.render(waveData, markers);
  }

  _getPillarDisplay(entry) {
    if (entry.pillar) {
      if (typeof entry.pillar === 'string') {
        const idx60 = entry.idx60 ?? entry.idx;
        if (idx60 != null) {
          return formatPillar(idx60).hanja;
        }
        return entry.pillar;
      }
      if (entry.pillar.hanja) return entry.pillar.hanja;
    }
    const idx60 = entry.idx60 ?? entry.idx ?? entry.pillarIdx;
    if (idx60 != null) {
      return formatPillar(idx60).hanja;
    }
    return '';
  }

  _getMaxElement(oheng) {
    let max = -1, maxKey = null;
    for (const [k, v] of Object.entries(oheng)) {
      if (v > max) { max = v; maxKey = k; }
    }
    return maxKey;
  }
}
