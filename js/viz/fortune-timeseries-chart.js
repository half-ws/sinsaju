/**
 * ===================================================================
 * fortune-timeseries-chart.js — 운세 시계열 Canvas 차트
 * ===================================================================
 * X축: 연도 (출생 ~ 출생+80)
 * Y축: 오행 비율(%) 또는 십성 비율(%)
 *
 * 원국 기준선(점선) + 대운/세운 반영 실선.
 * 대운 경계에 수직선, 합충 이벤트에 마커.
 */

import { setupCanvas, drawSmoothLine, drawDashedLine } from './canvas-utils.js';
import { OHENG_COLORS } from './color-scales.js';

const OHENG_KEYS = ['목', '화', '토', '금', '수'];
const SIPSUNG_KEYS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];

const SIPSUNG_COLORS = {
  비견: '#6366F1', 겁재: '#A78BFA',
  식신: '#EC4899', 상관: '#F9A8D4',
  편재: '#F59E0B', 정재: '#FBBF24',
  편관: '#10B981', 정관: '#6EE7B7',
  편인: '#3B82F6', 정인: '#93C5FD',
};

export class FortuneTimeSeriesChart {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;
    this.width = options.width || 900;
    this.height = options.height || 400;
    this.padding = { top: 80, right: 36, bottom: 50, left: 60 };
    this.canvas = null;
    this.ctx = null;
    this._hoverX = null;
    this._data = null;
    this._mode = 'oheng';
  }

  /**
   * @param {Object} timeSeriesData - generateFortuneTimeSeries() 결과
   * @param {string} mode - 'oheng' | 'sipsung'
   */
  render(timeSeriesData, mode = 'oheng') {
    this._data = timeSeriesData;
    this._mode = mode;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.style.borderRadius = '12px';
      this.canvas.style.background = '#ffffff';
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);
      this._setupInteraction();
    }

    this.ctx = setupCanvas(this.canvas, this.width, this.height);
    this._draw();
  }

  setMode(mode) {
    this._mode = mode;
    if (this._data) {
      this.ctx = setupCanvas(this.canvas, this.width, this.height);
      this._draw();
    }
  }

  _draw() {
    const ctx = this.ctx;
    const { top, right, bottom, left } = this.padding;
    const w = this.width - left - right;
    const h = this.height - top - bottom;
    const data = this._data;
    const mode = this._mode;

    ctx.clearRect(0, 0, this.width, this.height);
    if (!data || !data.yearly || data.yearly.length === 0) return;

    const yearly = data.yearly;
    const natal = data.natal;
    const boundaries = data.daeunBoundaries || [];
    const isOheng = mode === 'oheng';
    const keys = isOheng ? OHENG_KEYS : SIPSUNG_KEYS;
    const colors = isOheng ? OHENG_KEYS.map(k => OHENG_COLORS[k]?.main || '#888') : SIPSUNG_KEYS.map(k => SIPSUNG_COLORS[k]);
    const maxY = isOheng ? 50 : 30;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const isMonthly = !!data._isMonthly;

    const minYear = yearly[0].year;
    const maxYear = yearly[yearly.length - 1].year;
    const yearSpan = maxYear - minYear || 1;

    const toX = (year) => left + ((year - minYear) / yearSpan) * w;
    const toY = (val) => top + h - (val / maxY) * h;

    // ── 1. X축 기준선 ──
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, top + h);
    ctx.lineTo(left + w, top + h);
    ctx.stroke();

    // ── 2. Y축 수평 격자 ──
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    const gridStep = isOheng ? 10 : 10;
    for (let v = gridStep; v <= maxY; v += gridStep) {
      const y = toY(v);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + w, y);
      ctx.stroke();
    }

    // ── 3. 대운 경계 수직선 ──
    for (const b of boundaries) {
      const bYear = b.year;
      if (bYear < minYear || bYear > maxYear) continue;
      const x = toX(bYear);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + h);
      ctx.stroke();
      ctx.setLineDash([]);

      // 대운 라벨
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.font = '20px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.pillar || '', x, top + h + 38);
    }

    // ── 4. 현재 시점 하이라이트 ──
    const currentVal = isMonthly ? currentMonth : currentYear;
    if (currentVal >= minYear && currentVal <= maxYear) {
      const cx = toX(currentVal);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
      ctx.fillRect(cx - 3, top, 6, h);
      drawDashedLine(ctx, cx, top, top + h, '#D4A800', [3, 2]);
    }

    // ── 5. 원국 기준선 (점선) ──
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki];
      const natalVal = isOheng
        ? (natal.oheng.percent[key] || 0)
        : (natal.sipsung.percent[key] || 0);
      const y = toY(natalVal);

      ctx.strokeStyle = colors[ki];
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // ── 6. 오행/십성 곡선 ──
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki];
      const points = yearly.map(d => {
        const val = isOheng
          ? (d.oheng.percent[key] || 0)
          : (d.sipsung.percent[key] || 0);
        return { x: toX(d.year), y: toY(val) };
      });
      drawSmoothLine(ctx, points, colors[ki], 2);
    }

    // ── 7. 합충 마커 ──
    for (const d of yearly) {
      if (!d.interactions || d.interactions.length === 0) continue;
      const hasCombine = d.interactions.some(i => i.type.includes('합'));
      const hasClash = d.interactions.some(i => i.type.includes('충'));
      if (!hasCombine && !hasClash) continue;

      const x = toX(d.year);
      const markerY = top + h + 8;

      if (hasClash) {
        ctx.fillStyle = '#FF3B30';
        ctx.beginPath();
        ctx.arc(x, markerY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (hasCombine) {
        ctx.fillStyle = '#248A3D';
        ctx.beginPath();
        ctx.arc(x, markerY - (hasClash ? 6 : 0), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── 8. 호버 ──
    if (this._hoverX != null) {
      const hoverFraction = (this._hoverX - left) / w;
      if (hoverFraction >= 0 && hoverFraction <= 1) {
        const hoverYear = Math.round(minYear + hoverFraction * yearSpan);
        const hx = toX(hoverYear);

        drawDashedLine(ctx, hx, top, top + h, 'rgba(0,0,0,0.3)', [3, 3]);

        // 해당 연도 데이터 찾기
        const entry = yearly.find(d => d.year === hoverYear);
        if (entry) {
          let tooltipY = top + 6;
          let headerText;
          if (isMonthly) {
            headerText = entry._monthLabel || `${hoverYear}월`;
            if (entry.saeun?.pillar) headerText += ` ${entry.saeun.pillar}`;
          } else {
            const daeunLabel = entry.daeun ? `대운:${entry.daeun.pillar}` : '';
            const saeunLabel = `세운:${entry.saeun.pillar}`;
            headerText = `${hoverYear}년 (${entry.age}세) ${daeunLabel} ${saeunLabel}`;
          }

          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.font = 'bold 22px "Noto Sans KR", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(headerText, hx + 10, tooltipY);
          tooltipY += 26;

          for (let ki = 0; ki < keys.length; ki++) {
            const key = keys[ki];
            const val = isOheng
              ? (entry.oheng.percent[key] || 0)
              : (entry.sipsung.percent[key] || 0);
            const natalBase = isOheng
              ? (natal.oheng.percent[key] || 0)
              : (natal.sipsung.percent[key] || 0);
            const delta = Math.round((val - natalBase) * 10) / 10;
            const sign = delta >= 0 ? '+' : '';

            ctx.fillStyle = colors[ki];
            ctx.font = 'bold 20px "Noto Sans KR", sans-serif';
            ctx.fillText(`${key} ${val.toFixed(1)}% (${sign}${delta.toFixed(1)})`, hx + 10, tooltipY);
            tooltipY += 22;
          }

          // 합충 이벤트
          if (entry.interactions.length > 0) {
            const fortuneInteractions = entry.interactions.filter(i =>
              ['daeun', 'saeun', 'wolun'].some(fp => i.source === fp || i.target === fp)
            );
            if (fortuneInteractions.length > 0) {
              tooltipY += 4;
              ctx.fillStyle = 'rgba(0,0,0,0.5)';
              ctx.font = '18px "Noto Sans KR", sans-serif';
              for (const inter of fortuneInteractions.slice(0, 3)) {
                ctx.fillText(`${inter.type}: ${inter.desc}`, hx + 10, tooltipY);
                tooltipY += 20;
              }
            }
          }
        }
      }
    }

    // ── 9. X축 라벨 ──
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    if (isMonthly) {
      for (const d of yearly) {
        const x = toX(d.year);
        ctx.fillText(`${d.year}월`, x, top + h + 20);
      }
    } else {
      const labelStep = yearSpan > 60 ? 10 : (yearSpan > 30 ? 5 : (yearSpan > 15 ? 2 : 1));
      for (let y = Math.ceil(minYear / labelStep) * labelStep; y <= maxYear; y += labelStep) {
        const x = toX(y);
        ctx.fillText(String(y), x, top + h + 20);
      }
    }

    // ── 10. Y축 라벨 ──
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    for (let v = 0; v <= maxY; v += gridStep) {
      const y = toY(v);
      ctx.fillText(`${v}%`, left - 6, y + 5);
    }

    // ── 11. 범례 ──
    const legendY = isOheng ? 16 : 10;
    ctx.textAlign = 'left';
    let legendX = left;
    let legendRow = 0;
    const legendSpacing = isOheng ? 64 : 76;
    const legendPerRow = isOheng ? 5 : 5;
    for (let ki = 0; ki < keys.length; ki++) {
      if (!isOheng && ki > 0 && ki % legendPerRow === 0) {
        legendRow++;
        legendX = left;
      }
      const ly = legendY + legendRow * 24;
      ctx.fillStyle = colors[ki];
      ctx.fillRect(legendX, ly, 14, 14);
      ctx.font = 'bold 20px "Noto Sans KR", sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(keys[ki], legendX + 18, ly + 12);
      legendX += legendSpacing;
    }

    // 모드 표시
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = '20px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(isOheng ? '오행 변화' : '십성 변화', this.width - right, legendY + 12);
  }

  _setupInteraction() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this._hoverX = e.clientX - rect.left;
      this._draw();
    });
    this.canvas.addEventListener('mouseleave', () => {
      this._hoverX = null;
      this._draw();
    });
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this._data) {
      this.ctx = setupCanvas(this.canvas, this.width, this.height);
      this._draw();
    }
  }
}
