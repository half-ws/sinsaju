import { setupCanvas, drawSmoothLine, drawDashedLine } from './canvas-utils.js';
import { OHENG_COLORS } from './color-scales.js';

const BRANCH_LABELS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 4 seasonal element wave colors (토 shown as separate sub-graph)
const WAVE_ELEMENTS = ['수', '목', '화', '금'];

// 지장간 data indexed by branch (0=子 through 11=亥)
const JIJANGGAN_DATA = [
  [{ s:'임', e:'수', r:3 }, { s:'계', e:'수', r:7 }],                         // 子
  [{ s:'계', e:'수', r:3 }, { s:'신', e:'금', r:1 }, { s:'기', e:'토', r:6 }], // 丑
  [{ s:'무', e:'토', r:2 }, { s:'병', e:'화', r:2 }, { s:'갑', e:'목', r:6 }], // 寅
  [{ s:'갑', e:'목', r:3 }, { s:'을', e:'목', r:7 }],                         // 卯
  [{ s:'을', e:'목', r:3 }, { s:'계', e:'수', r:1 }, { s:'무', e:'토', r:6 }], // 辰
  [{ s:'무', e:'토', r:2 }, { s:'경', e:'금', r:2 }, { s:'병', e:'화', r:6 }], // 巳
  [{ s:'병', e:'화', r:3 }, { s:'정', e:'화', r:7 }],                         // 午
  [{ s:'정', e:'화', r:3 }, { s:'을', e:'목', r:1 }, { s:'기', e:'토', r:6 }], // 未
  [{ s:'무', e:'토', r:2 }, { s:'임', e:'수', r:2 }, { s:'경', e:'금', r:6 }], // 申
  [{ s:'경', e:'금', r:3 }, { s:'신', e:'금', r:7 }],                         // 酉
  [{ s:'신', e:'금', r:3 }, { s:'정', e:'화', r:1 }, { s:'무', e:'토', r:6 }], // 戌
  [{ s:'무', e:'토', r:2 }, { s:'갑', e:'목', r:2 }, { s:'임', e:'수', r:6 }], // 亥
];

// Display order matching waveform x-axis (寅 start → 丑 end)
const JJ_DISPLAY_ORDER = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];

// Pillar birth marker styles
const PILLAR_MARKERS = {
  year:  { color: '#E88AED', label: '년', dash: [10, 4] },
  month: { color: '#34C759', label: '월', dash: [8, 4] },
  day:   { color: '#FFD700', label: '일', dash: [6, 3] },
  hour:  { color: '#0071E3', label: '시', dash: [5, 3] },
};

export class WaveformChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.width = options.width || 900;
    this.height = options.height || 300;
    this.padding = { top: 65, right: 36, bottom: 78, left: 85 };
    this.canvas = null;
    this.ctx = null;
    this._hoverX = null;
    this._waveData = null;
    this._birthAngles = null;
    this._toStrengths = null;
  }

  render(waveData, birthAngles, toStrengths = null) {
    this._waveData = waveData;
    this._birthAngles = birthAngles;
    this._toStrengths = toStrengths;

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
    this._renderJijangganTable();
  }

  _draw() {
    const ctx = this.ctx;
    const { top, right, bottom, left } = this.padding;
    const w = this.width - left - right;
    const totalH = this.height - top - bottom;

    ctx.clearRect(0, 0, this.width, this.height);
    if (!this._waveData) return;

    const { angles, waves } = this._waveData;
    const hasToGraph = !!this._toStrengths;

    // ── Layout split: main waveform + gap + 토 sub-graph ──
    const mainH = hasToGraph ? Math.round(totalH * 0.72) : totalH;
    const gapH = hasToGraph ? 14 : 0;
    const toH = hasToGraph ? totalH - mainH - gapH : 0;
    const toTop = top + mainH + gapH;
    const totalBottom = hasToGraph ? toTop + toH : top + mainH;

    // ── Y-axis: 0 at bottom, 1.0 at top ──
    const maxVal = 1.15;

    // toX: 45° (寅 start) maps to left edge, wraps around 360°
    const toX = (angle) => {
      const shifted = ((angle - 45) % 360 + 360) % 360;
      return left + (shifted / 360) * w;
    };

    const toY = (val) => top + mainH - (val / maxVal) * mainH;

    // Ordered indices for display (start at 寅 start=45°)
    const step = angles.length > 1 ? angles[1] - angles[0] : 1;
    const startIdx = Math.round(45 / step);
    const numPts = angles.length;
    const orderedIndices = [];
    for (let i = startIdx; i < numPts; i++) orderedIndices.push(i);
    for (let i = 0; i < startIdx; i++) orderedIndices.push(i);

    // ── 1. X-axis baseline (thick black line at y=0) ──
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, top + mainH);
    ctx.lineTo(left + w, top + mainH);
    ctx.stroke();

    // ── 2. Horizontal grid ──
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (const gv of [0.2, 0.4, 0.6, 0.8, 1.0]) {
      const y = toY(gv);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + w, y); ctx.stroke();
    }

    // ── 3. Branch boundary vertical lines (every 30° edge) ──
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const boundaryAngle = i * 30 + 15; // edge between branch i and i+1
      const x = toX(boundaryAngle);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, totalBottom);
      ctx.stroke();
    }

    // ── 4. Draw 4 element waves (lines only, no fill) ──
    for (const el of WAVE_ELEMENTS) {
      const color = OHENG_COLORS[el].main;
      const points = orderedIndices.map(idx => ({
        x: toX(angles[idx]),
        y: toY(waves[el][idx])
      }));
      drawSmoothLine(ctx, points, color, 2.5);
    }

    // ── 5. Birth angle markers (extend through both areas) ──
    if (this._birthAngles) {
      const markerList = [];
      for (const key of ['year', 'month', 'day', 'hour']) {
        const angle = this._birthAngles[key];
        if (angle == null) continue;
        markerList.push({ key, angle, x: toX(angle), marker: PILLAR_MARKERS[key] });
      }

      // Sort by x for overlap detection
      markerList.sort((a, b) => a.x - b.x);

      // Assign label y-offsets to avoid overlap
      const MIN_LABEL_GAP = 36;
      for (let mi = 0; mi < markerList.length; mi++) {
        markerList[mi].labelY = top - 12;
      }
      for (let mi = 1; mi < markerList.length; mi++) {
        if (markerList[mi].x - markerList[mi - 1].x < MIN_LABEL_GAP) {
          markerList[mi].labelY = markerList[mi - 1].labelY - 28;
        }
      }

      // Draw markers
      for (const m of markerList) {
        const bx = m.x;
        drawDashedLine(ctx, bx, top, totalBottom, m.marker.color, m.marker.dash);

        // Label at top
        ctx.save();
        ctx.fillStyle = m.marker.color;
        ctx.font = 'bold 28px "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.marker.label, bx, m.labelY);
        ctx.restore();

        // Intersection dots on each wave
        for (const el of WAVE_ELEMENTS) {
          const idx = Math.round(m.angle / 360 * (angles.length - 1));
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

        // Intersection dot on 토 sub-graph
        if (hasToGraph) {
          const idx = Math.round(m.angle / 360 * (this._toStrengths.length - 1));
          const toVal = this._toStrengths[Math.min(idx, this._toStrengths.length - 1)];
          const toMaxVal = this._getToMax();
          const ty = toTop + toH - (toVal / toMaxVal) * toH;

          ctx.beginPath();
          ctx.arc(bx, ty, 4, 0, Math.PI * 2);
          ctx.fillStyle = OHENG_COLORS['토'].main;
          ctx.fill();
          ctx.strokeStyle = m.marker.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // ── 6. Hover line ──
    if (this._hoverX !== null) {
      const hoverShifted = ((this._hoverX - left) / w) * 360;
      const hoverAngle = ((hoverShifted + 45) % 360 + 360) % 360;
      if (hoverShifted >= 0 && hoverShifted <= 360) {
        drawDashedLine(ctx, this._hoverX, top, totalBottom, 'rgba(0,0,0,0.3)', [3, 3]);

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

        if (this._toStrengths) {
          const toVal = this._toStrengths[Math.min(idx, this._toStrengths.length - 1)];
          ctx.fillStyle = OHENG_COLORS['토'].main;
          ctx.fillText(`토 ${toVal.toFixed(2)}`, this._hoverX + 10, tooltipY);
        }
      }
    }

    // ── 7. X-axis: branch labels ──
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = 'bold 28px "Noto Serif KR", serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 12; i++) {
      const x = toX(i * 30);
      ctx.fillText(BRANCH_LABELS[i], x, totalBottom + 38);
    }

    // ── 8. Y-axis labels ──
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'right';
    for (const v of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
      const y = toY(v);
      ctx.fillText(v.toFixed(1), left - 6, y + 4);
    }

    // ── 9. 토 sub-graph ──
    if (hasToGraph) {
      this._drawToSubGraph(ctx, toX, toTop, toH, w, orderedIndices, angles);
    }

    // ── 10. Element legend (top-left): 목↔금  화↔수  토 ──
    ctx.textAlign = 'left';
    let legendX = left;

    // 목 ↔ 금
    ctx.fillStyle = OHENG_COLORS['목'].main;
    ctx.fillRect(legendX, 7, 20, 20);
    ctx.font = 'bold 26px "Noto Sans KR", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText('목', legendX + 24, 22);
    legendX += 56;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = '22px sans-serif';
    ctx.fillText('↔', legendX, 22);
    legendX += 30;
    ctx.fillStyle = OHENG_COLORS['금'].main;
    ctx.fillRect(legendX, 7, 20, 20);
    ctx.font = 'bold 26px "Noto Sans KR", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText('금', legendX + 24, 22);
    legendX += 72;

    // 화 ↔ 수
    ctx.fillStyle = OHENG_COLORS['화'].main;
    ctx.fillRect(legendX, 7, 20, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText('화', legendX + 24, 22);
    legendX += 56;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = '22px sans-serif';
    ctx.fillText('↔', legendX, 22);
    legendX += 30;
    ctx.fillStyle = OHENG_COLORS['수'].main;
    ctx.fillRect(legendX, 7, 20, 20);
    ctx.font = 'bold 26px "Noto Sans KR", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText('수', legendX + 24, 22);
    legendX += 72;

    // 토
    ctx.fillStyle = OHENG_COLORS['토'].main;
    ctx.fillRect(legendX, 7, 20, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText('토', legendX + 24, 22);

    // ── 11. Pillar marker legend (top-right) ──
    let markerLegendX = this.width - 320;
    const pillarOrder = ['년', '월', '일', '시'];
    const pillarColors = [
      PILLAR_MARKERS.year.color, PILLAR_MARKERS.month.color,
      PILLAR_MARKERS.day.color, PILLAR_MARKERS.hour.color
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

  /* ------------------------------------------------------------------ */
  /*  토 sub-graph: intensity chart below main waveform                  */
  /* ------------------------------------------------------------------ */

  _getToMax() {
    if (!this._toStrengths) return 0.1;
    let max = 0;
    for (const v of this._toStrengths) {
      if (v > max) max = v;
    }
    return Math.max(max * 1.15, 0.1);
  }

  _drawToSubGraph(ctx, toX, toTop, toH, w, orderedIndices, angles) {
    const { left } = this.padding;
    const toStrengths = this._toStrengths;
    const maxTo = this._getToMax();
    const toSubY = (val) => toTop + toH - (val / maxTo) * toH;
    const color = OHENG_COLORS['토'].main;

    // Divider line between main and 토 sub-graph
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, toTop - 2);
    ctx.lineTo(left + w, toTop - 2);
    ctx.stroke();

    // Light background tint
    ctx.fillStyle = 'rgba(200, 170, 60, 0.04)';
    ctx.fillRect(left, toTop, w, toH);

    // Baseline at bottom (thick black)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, toTop + toH);
    ctx.lineTo(left + w, toTop + toH);
    ctx.stroke();

    // Mid grid line
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(left, toSubY(maxTo / 2));
    ctx.lineTo(left + w, toSubY(maxTo / 2));
    ctx.stroke();

    // Build points
    const points = orderedIndices.map(idx => ({
      x: toX(angles[idx]),
      y: toSubY(toStrengths[idx])
    }));

    // Filled area under curve
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(points[0].x, toTop + toH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, toTop + toH);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Curve line
    drawSmoothLine(ctx, points, color, 2);

    // Y-axis label: "토"
    ctx.fillStyle = color;
    ctx.font = 'bold 22px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('토', left - 6, toTop + toH / 2 + 6);

    // Y-axis midpoint tick value
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = '18px sans-serif';
    const midVal = maxTo / 2;
    ctx.fillText(midVal.toFixed(1), left - 6, toSubY(midVal) + 4);
  }

  /* ------------------------------------------------------------------ */
  /*  지장간 비율표 (DOM elements below the canvas)                       */
  /* ------------------------------------------------------------------ */

  _renderJijangganTable() {
    // Only render once (static data)
    if (this.container.querySelector('.jijanggan-wrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'jijanggan-wrap';
    Object.assign(wrap.style, {
      width: '100%',
      maxWidth: this.width + 'px',
      boxSizing: 'border-box',
      marginTop: '8px',
      paddingLeft: this.padding.left + 'px',
      paddingRight: this.padding.right + 'px',
    });

    // Title
    const title = document.createElement('div');
    title.textContent = '지장간 비율';
    Object.assign(title.style, {
      textAlign: 'center',
      fontSize: '13px',
      color: 'rgba(0,0,0,0.45)',
      marginBottom: '5px',
      fontFamily: '"Noto Sans KR", sans-serif',
      fontWeight: '500',
    });
    wrap.appendChild(title);

    // Grid
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '2px',
    });

    for (const branchIdx of JJ_DISPLAY_ORDER) {
      const stems = JIJANGGAN_DATA[branchIdx];
      const col = document.createElement('div');
      col.style.textAlign = 'center';

      // Vertical stacked bar (bottom-up)
      const bar = document.createElement('div');
      Object.assign(bar.style, {
        display: 'flex',
        flexDirection: 'column-reverse',
        height: '80px',
        borderRadius: '3px',
        overflow: 'hidden',
      });

      for (const entry of stems) {
        const seg = document.createElement('div');
        const color = OHENG_COLORS[entry.e].main;
        Object.assign(seg.style, {
          flex: String(entry.r),
          background: color,
          color: '#fff',
          fontSize: entry.r >= 3 ? '10px' : '9px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Noto Sans KR", sans-serif',
          textShadow: '0 0 3px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          lineHeight: '1',
        });
        seg.textContent = entry.r >= 2 ? `${entry.s}${entry.r}` : '';
        seg.title = `${entry.s} (${entry.e}) ${entry.r}/10`;
        bar.appendChild(seg);
      }

      col.appendChild(bar);

      // Ratio text below
      const ratioText = document.createElement('div');
      ratioText.textContent = stems.map(e => e.r).join(' : ');
      Object.assign(ratioText.style, {
        fontSize: '10px',
        color: 'rgba(0,0,0,0.3)',
        marginTop: '2px',
        fontFamily: 'sans-serif',
      });
      col.appendChild(ratioText);

      grid.appendChild(col);
    }

    wrap.appendChild(grid);
    this.container.appendChild(wrap);
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
