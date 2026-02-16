import { setupCanvas, drawSmoothLine, drawDashedLine } from './canvas-utils.js';
import { OHENG_COLORS, ohengColor } from './color-scales.js';

const STEM_LABELS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const STEM_ELEMENTS = ['목','목','화','화','토','토','금','금','수','수'];

const WAVE_ELEMENTS = ['목', '화', '토', '금', '수'];

// Offset so graph starts at beginning of 甲 territory (甲 center=0°, territory starts at -18°)
const X_OFFSET = 18;

const PILLAR_MARKERS = {
  year:  { color: '#E88AED', label: '년', dash: [10, 4] },
  month: { color: '#34C759', label: '월', dash: [8, 4] },
  day:   { color: '#FFD700', label: '일', dash: [6, 3] },
  hour:  { color: '#0071E3', label: '시', dash: [5, 3] },
};

export class CheonganWaveformChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.width = options.width || 900;
    this.height = options.height || 380;
    this.padding = { top: 65, right: 36, bottom: 58, left: 85 };
    this.canvas = null;
    this.ctx = null;
    this._hoverX = null;
    this._waveData = null;
    this._stemData = null;
  }

  /**
   * @param {Object} waveData  – { angles: number[], waves: { 목, 화, 토, 금, 수 } }
   * @param {Object} stemData – { year: { idx60, branchAngle }, ... }
   */
  render(waveData, stemData) {
    this._waveData = waveData;
    this._stemData = stemData;

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

  _draw() {
    const ctx = this.ctx;
    const { top, right, bottom, left } = this.padding;
    const w = this.width - left - right;
    const h = this.height - top - bottom;

    ctx.clearRect(0, 0, this.width, this.height);
    if (!this._waveData) return;

    const { angles, waves } = this._waveData;
    const maxVal = 1.15;

    // toX: shifted so 甲 territory starts at left edge
    const toX = (angle) => {
      const shifted = ((angle + X_OFFSET) % 360 + 360) % 360;
      return left + (shifted / 360) * w;
    };

    const toY = (val) => top + h - (val / maxVal) * h;

    // Ordered indices: start from angle = 360 - X_OFFSET for left-to-right drawing
    const step = angles.length > 1 ? angles[1] - angles[0] : 1;
    const numPts = angles.length;
    const startAngleIdx = Math.round((360 - X_OFFSET) / step) % numPts;
    const orderedIndices = [];
    for (let i = 0; i < numPts; i++) {
      orderedIndices.push((startAngleIdx + i) % numPts);
    }

    // ── 1. X-axis baseline ──
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, top + h);
    ctx.lineTo(left + w, top + h);
    ctx.stroke();

    // ── 2. Horizontal grid lines ──
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (const gv of [0.2, 0.4, 0.6, 0.8, 1.0]) {
      const y = toY(gv);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + w, y);
      ctx.stroke();
    }

    // ── 3. Stem boundary vertical lines ──
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const boundaryAngle = i * 36 + 18;
      const x = toX(boundaryAngle);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + h);
      ctx.stroke();
    }

    // ── 4. Draw 5 element waves ──
    for (const el of WAVE_ELEMENTS) {
      const color = OHENG_COLORS[el].main;
      const points = orderedIndices.map(idx => ({
        x: toX(angles[idx]),
        y: toY(waves[el][idx])
      }));
      drawSmoothLine(ctx, points, color, 2.5);
    }

    // ── 5. Birth angle markers ──
    if (this._stemData) {
      const markerList = [];
      for (const key of ['year', 'month', 'day', 'hour']) {
        const info = this._stemData[key];
        if (info == null) continue;
        const stemAngle = this._computeStemAngle(info);
        markerList.push({ key, angle: stemAngle, x: toX(stemAngle), marker: PILLAR_MARKERS[key] });
      }

      markerList.sort((a, b) => a.x - b.x);

      const MIN_LABEL_GAP = 36;
      for (let mi = 0; mi < markerList.length; mi++) {
        markerList[mi].labelY = top - 12;
      }
      for (let mi = 1; mi < markerList.length; mi++) {
        if (markerList[mi].x - markerList[mi - 1].x < MIN_LABEL_GAP) {
          markerList[mi].labelY = markerList[mi - 1].labelY - 28;
        }
      }

      for (const m of markerList) {
        const bx = m.x;
        drawDashedLine(ctx, bx, top, top + h, m.marker.color, m.marker.dash);

        ctx.save();
        ctx.fillStyle = m.marker.color;
        ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.marker.label, bx, m.labelY);
        ctx.restore();

        // Intersection dots on each wave
        for (const el of WAVE_ELEMENTS) {
          const rawAngle = ((m.angle % 360) + 360) % 360;
          const idx = Math.round(rawAngle / 360 * (angles.length - 1));
          const val = waves[el][Math.min(idx, angles.length - 1)];
          const y = toY(val);

          ctx.beginPath();
          ctx.arc(bx, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = OHENG_COLORS[el].main;
          ctx.fill();
          ctx.strokeStyle = m.marker.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // ── 6. Hover line ──
    if (this._hoverX !== null) {
      const hoverFraction = (this._hoverX - left) / w;
      const hoverAngle = ((hoverFraction * 360 - X_OFFSET) % 360 + 360) % 360;
      if (hoverFraction >= 0 && hoverFraction <= 1) {
        drawDashedLine(ctx, this._hoverX, top, top + h, 'rgba(0,0,0,0.3)', [3, 3]);

        const idx = Math.round(hoverAngle / 360 * (angles.length - 1));
        let tooltipY = top + 6;

        for (const el of WAVE_ELEMENTS) {
          const val = waves[el][Math.min(idx, angles.length - 1)];
          ctx.fillStyle = OHENG_COLORS[el].main;
          ctx.font = 'bold 26px "Noto Sans KR", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${el} ${val.toFixed(2)}`, this._hoverX + 10, tooltipY);
          tooltipY += 30;
        }
      }
    }

    // ── 7. X-axis: stem labels ──
    ctx.font = 'bold 28px "Noto Serif KR", serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 10; i++) {
      const angle = i * 36;
      const x = toX(angle);
      ctx.fillStyle = ohengColor(STEM_ELEMENTS[i], 'main');
      ctx.fillText(STEM_LABELS[i], x, top + h + 38);
    }

    // ── 8. Y-axis labels ──
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'right';
    for (const v of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      const y = toY(v);
      ctx.fillText(v.toFixed(1), left - 6, y + 4);
    }

    // ── 9. Element legend (top-left) ──
    ctx.textAlign = 'left';
    let legendX = left;
    for (const el of WAVE_ELEMENTS) {
      ctx.fillStyle = OHENG_COLORS[el].main;
      ctx.fillRect(legendX, 7, 20, 20);
      ctx.font = 'bold 26px "Noto Sans KR", sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(el, legendX + 24, 22);
      legendX += 68;
    }

    // ── 10. Pillar marker legend (top-right) ──
    let markerLegendX = this.width - 320;
    const pillarOrder = ['년', '월', '일', '시'];
    const pillarColors = [
      PILLAR_MARKERS.year.color,
      PILLAR_MARKERS.month.color,
      PILLAR_MARKERS.day.color,
      PILLAR_MARKERS.hour.color,
    ];
    for (let m = 0; m < 4; m++) {
      ctx.strokeStyle = pillarColors[m];
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(markerLegendX, 18);
      ctx.lineTo(markerLegendX + 20, 18);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pillarColors[m];
      ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(pillarOrder[m], markerLegendX + 20, 24);
      markerLegendX += 70;
    }
  }

  /**
   * Map branch relative position to stem position.
   * Each pillar has a continuous position within its branch's 30° territory;
   * that same fraction is mapped to the stem's 36° territory.
   */
  _computeStemAngle(info) {
    if (typeof info === 'number') return info;

    const { idx60, branchAngle } = info;
    const stemIdx = idx60 % 10;

    if (branchAngle == null) return stemIdx * 36;

    const branchIdx = idx60 % 12;
    const branchCenter = branchIdx * 30;

    // Relative position within branch's 30° territory (0 to 1)
    let offset = branchAngle - branchCenter;
    if (offset > 180) offset -= 360;
    if (offset < -180) offset += 360;
    const fraction = Math.max(0, Math.min(1, offset / 30 + 0.5));

    // Map to stem's 36° territory
    const stemStart = stemIdx * 36 - 18;
    return ((stemStart + fraction * 36) % 360 + 360) % 360;
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
    if (this._waveData) {
      this.ctx = setupCanvas(this.canvas, this.width, this.height);
      this._draw();
    }
  }
}
