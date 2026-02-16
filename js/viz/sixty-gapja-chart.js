import { svgEl, arcPath, pointOnCircle } from './svg-utils.js';
import { ohengColor } from './color-scales.js';

const CHEONGAN_HANJA = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const CHEONGAN_KR    = ['갑','을','병','정','무','기','경','신','임','계'];
const JIJI_HANJA     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const CHEONGAN_OHENG = ['목','목','화','화','토','토','금','금','수','수'];
const JIJI_OHENG     = ['수','토','목','목','토','화','화','토','금','금','토','수'];

/**
 * Full 60 sexagenary-cycle names (hanja) — e.g. 甲子, 乙丑, ...
 * Built from the 10 stems x 12 branches interleaved cycle.
 */
function gapjaName(idx60) {
  const stemIdx   = idx60 % 10;
  const branchIdx = idx60 % 12;
  return {
    hanja: CHEONGAN_HANJA[stemIdx] + JIJI_HANJA[branchIdx],
    korean: CHEONGAN_KR[stemIdx] + ['자','축','인','묘','진','사','오','미','신','유','술','해'][branchIdx],
    element: CHEONGAN_OHENG[stemIdx],
  };
}

export class SixtyGapjaChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    this.size    = options.size || 500;
    this.padding = options.padding || 30;
    this.svg     = null;
    this.cx      = this.size / 2;
    this.cy      = this.size / 2;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  render(chartData) {
    // 1. Clear container, create SVG
    this.container.innerHTML = '';

    this.svg = svgEl('svg', {
      viewBox: `0 0 ${this.size} ${this.size}`,
      width: '100%',
      height: '100%',
      style: 'max-width: 100%; border-radius: 50%;',
    });

    // 2. Background circle
    this.svg.appendChild(svgEl('circle', {
      cx: this.cx, cy: this.cy, r: this.size / 2 - 2,
      fill: '#ffffff', stroke: '#ddd', 'stroke-width': 1,
    }));

    // 3. Compute ring radii (same proportions as the 12-branch chart)
    const maxR      = this.size / 2 - this.padding;
    const ringWidth = maxR * 0.18;
    const gap       = maxR * 0.02;

    const rings = [
      { label: '년', r: maxR,                              inner: maxR - ringWidth },
      { label: '월', r: maxR - ringWidth - gap,            inner: maxR - 2 * ringWidth - gap },
      { label: '일', r: maxR - 2 * (ringWidth + gap),      inner: maxR - 3 * ringWidth - 2 * gap },
      { label: '시', r: maxR - 3 * (ringWidth + gap),      inner: maxR - 4 * ringWidth - 3 * gap },
    ];

    // 4. Draw each ring with 60 sectors
    const pillarKeys = ['year', 'month', 'day', 'hour'];
    rings.forEach((ring, ringIdx) => {
      const key       = pillarKeys[ringIdx];
      const idx60     = chartData.discrete?.idxs?.[key];
      const contAngle = chartData.continuous?.[key]?.angle;
      this._drawRing(ring, idx60, contAngle, ringIdx);
    });

    // 5. Branch labels on the outer edge
    this._drawBranchLabels(maxR + 15);

    // 6. Center empty circle
    const centerRadius = rings[3].inner - 10;
    this._drawCenter(centerRadius);

    // 7. Append SVG to container
    this.container.appendChild(this.svg);
  }

  update(chartData) {
    this.render(chartData);
  }

  resize(newSize) {
    this.size = newSize;
    this.cx   = newSize / 2;
    this.cy   = newSize / 2;
  }

  /* ------------------------------------------------------------------ */
  /*  Ring drawing                                                       */
  /* ------------------------------------------------------------------ */

  _drawRing(ring, idx60, contAngle, ringIdx) {
    const g = svgEl('g', { class: `ring ring-${ringIdx}` });
    const sectorDeg = 6; // 360 / 60

    // --- 60 coloured sectors ---
    for (let i = 0; i < 60; i++) {
      const startAngle = i * sectorDeg - sectorDeg / 2;
      const endAngle   = i * sectorDeg + sectorDeg / 2;

      const stemIdx   = i % 10;
      const branchIdx = i % 12;
      const color     = ohengColor(CHEONGAN_OHENG[stemIdx], 'main');

      const opacity = (idx60 !== undefined && idx60 !== null && i === idx60) ? 0.7 : 0.25;

      const info = gapjaName(i);

      const path = svgEl('path', {
        d: arcPath(this.cx, this.cy, ring.inner, ring.r, startAngle, endAngle),
        fill: color,
        opacity: opacity.toFixed(3),
        stroke: '#e0e0e8',
        'stroke-width': 0.3,
      });

      path.innerHTML = `<title>${info.hanja} (${info.korean}, ${info.element})</title>`;
      g.appendChild(path);
    }

    // --- Sector-boundary radial lines ---
    for (let i = 0; i < 60; i++) {
      const angle  = i * sectorDeg - sectorDeg / 2;
      const pInner = pointOnCircle(this.cx, this.cy, ring.inner, angle);
      const pOuter = pointOnCircle(this.cx, this.cy, ring.r, angle);

      // Slightly thicker line every 12 sectors (visual rhythm)
      const thick = (i % 12 === 0);

      g.appendChild(svgEl('line', {
        x1: pInner.x, y1: pInner.y, x2: pOuter.x, y2: pOuter.y,
        stroke: thick ? '#bbb' : '#e0e0e8',
        'stroke-width': thick ? 0.8 : 0.3,
      }));
    }

    // --- Birth marker ---
    if (idx60 !== undefined && idx60 !== null && contAngle !== undefined && contAngle !== null) {
      const markerAngle = this._to60Angle(idx60, contAngle);
      this._drawBirthMarker(g, ring, markerAngle);
    }

    this.svg.appendChild(g);
  }

  /* ------------------------------------------------------------------ */
  /*  Angle conversion: 12-branch continuous -> 60갑자 position           */
  /* ------------------------------------------------------------------ */

  _to60Angle(idx60, continuousAngle) {
    const branchCenter = (idx60 % 12) * 30;
    let offset = continuousAngle - branchCenter;
    if (offset >  180) offset -= 360;
    if (offset < -180) offset += 360;
    offset = Math.max(-15, Math.min(15, offset));
    const fraction = offset / 30 + 0.5; // 0 to 1
    return ((idx60 * 6 + (fraction - 0.5) * 6) % 360 + 360) % 360;
  }

  /* ------------------------------------------------------------------ */
  /*  Birth marker (gold line + dot)                                     */
  /* ------------------------------------------------------------------ */

  _drawBirthMarker(group, ring, angle) {
    // Radial line
    const inner = pointOnCircle(this.cx, this.cy, ring.inner, angle);
    const outer = pointOnCircle(this.cx, this.cy, ring.r, angle);
    group.appendChild(svgEl('line', {
      x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y,
      stroke: '#B8860B', 'stroke-width': 2.5,
      'stroke-linecap': 'round', opacity: '0.9',
    }));

    // Small dot at midpoint
    const mid = pointOnCircle(this.cx, this.cy, (ring.inner + ring.r) / 2, angle);
    group.appendChild(svgEl('circle', {
      cx: mid.x, cy: mid.y, r: 4,
      fill: '#D4A800', stroke: '#fff', 'stroke-width': 1,
    }));
  }

  /* ------------------------------------------------------------------ */
  /*  Branch labels at the outer edge (12 hanja, every 30 deg)           */
  /* ------------------------------------------------------------------ */

  _drawBranchLabels(radius) {
    const g = svgEl('g', { class: 'branch-labels' });
    for (let i = 0; i < 12; i++) {
      const angle = i * 30;
      const pt    = pointOnCircle(this.cx, this.cy, radius, angle);
      const text  = svgEl('text', {
        x: pt.x, y: pt.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: ohengColor(JIJI_OHENG[i], 'main'),
        'font-size': '34',
        'font-weight': '700',
        'font-family': "'Noto Serif KR', serif",
      });
      text.textContent = JIJI_HANJA[i];
      g.appendChild(text);
    }
    this.svg.appendChild(g);
  }

  /* ------------------------------------------------------------------ */
  /*  Center: empty circle                                               */
  /* ------------------------------------------------------------------ */

  _drawCenter(radius) {
    const g = svgEl('g', { class: 'center-info' });
    g.appendChild(svgEl('circle', {
      cx: this.cx, cy: this.cy, r: radius,
      fill: '#f8f8fa', stroke: '#ddd', 'stroke-width': 0.5,
    }));
    this.svg.appendChild(g);
  }
}
