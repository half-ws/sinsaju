import { CircularChart } from './circular-chart.js';
import { svgEl, arcPath, pointOnCircle } from './svg-utils.js';
import { ohengColor, branchToElement } from './color-scales.js';

const JIJI_HANJA = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function resolveIdx60(entry) {
  const v = entry.idx60 ?? entry.idx ?? entry.pillarIdx;
  return v != null ? v : null;
}

/**
 * Convert a 60갑자 index to a continuous angle within its branch's 30° zone.
 * Same principle as natal pillar birth markers:
 *   - Branch center = branchIdx * 30
 *   - Position within branch is determined by the stem's relative position
 *     in the 5-stem cycle that maps to this branch.
 * idx60 % 12 gives branchIdx, idx60 % 10 gives stemIdx.
 * The stem offset within the 30° zone: (stemIdx % 5) / 5 mapped to [-12, +12] degrees.
 */
function idx60ToContinuousAngle(idx60) {
  const branchIdx = idx60 % 12;
  const stemIdx = idx60 % 10;
  const branchCenter = branchIdx * 30;
  // Position the stem within the branch's territory:
  // Each branch hosts ~5 different stems across the 60-cycle.
  // Use the stem's offset to spread entries within the 30° zone.
  const stemFraction = (stemIdx % 5) / 5;
  const offset = (stemFraction - 0.5) * 24; // spread across ±12°
  return ((branchCenter + offset) % 360 + 360) % 360;
}

export class FortuneOverlayChart extends CircularChart {
  constructor(container, options = {}) {
    super(container, options);
  }

  render(chartData, fortuneData) {
    this._fortuneData = fortuneData || null;

    if (!fortuneData) {
      super.render(chartData);
      return;
    }

    // ── Create SVG ──
    this.container.innerHTML = '';
    this.svg = svgEl('svg', {
      viewBox: `0 0 ${this.size} ${this.size}`,
      width: '100%', height: '100%',
      style: 'max-width: 100%; border-radius: 50%;'
    });

    this._addDefs();

    this.svg.appendChild(svgEl('circle', {
      cx: this.cx, cy: this.cy, r: this.size / 2 - 2,
      fill: '#ffffff', stroke: '#ddd', 'stroke-width': 1
    }));

    // ── Ring layout: 2 fortune outer + 4 natal + 지장간 + center ──
    const maxR = this.size / 2 - this.padding;
    const fRW = maxR * 0.07;      // fortune ring width
    const nRW = maxR * 0.14;      // natal ring width
    const gap = maxR * 0.012;
    const secGap = maxR * 0.025;   // gap between fortune and natal
    const jjRW = maxR * 0.05;

    const daeunRing = { r: maxR, inner: maxR - fRW };
    const saeunRing = { r: daeunRing.inner - gap, inner: daeunRing.inner - gap - fRW };

    const nStart = saeunRing.inner - secGap;
    const natalRings = [];
    for (let i = 0; i < 4; i++) {
      const outer = nStart - i * (nRW + gap);
      natalRings.push({ label: ['년','월','일','시'][i], r: outer, inner: outer - nRW });
    }

    const jjRing = { r: natalRings[3].inner - gap, inner: natalRings[3].inner - gap - jjRW };
    const centerR = jjRing.inner - gap;

    // ── Draw ──
    const currentYear = new Date().getFullYear();
    const birthYear = fortuneData.birthYear;
    const currentAge = birthYear != null ? currentYear - birthYear : null;

    // 1. Fortune outer rings
    this._drawFortuneRing(daeunRing, fortuneData.daeun, 'daeun', currentAge, currentYear);
    this._drawFortuneRing(saeunRing, fortuneData.saeun, 'saeun', currentAge, currentYear);

    // 2. Branch labels (outside fortune rings)
    this._drawBranchLabels(maxR + 14);

    // 3. Natal rings
    const pillarKeys = ['year', 'month', 'day', 'hour'];
    natalRings.forEach((ring, idx) => {
      const pillarData = chartData.continuous?.[pillarKeys[idx]];
      this._drawRing(ring, pillarData, idx);
    });

    // 4. 지장간
    this._drawJijangganRing(jjRing);

    // 5. Center
    this._drawCenter(centerR);

    // 6. Relations
    if (this.showRelations && chartData.discrete) {
      this._drawRelations(chartData, natalRings);
    }

    this.container.appendChild(this.svg);
  }

  /** Override: smaller labels to fit with fortune rings */
  _drawBranchLabels(radius) {
    const g = svgEl('g', { class: 'branch-labels' });
    for (let i = 0; i < 12; i++) {
      const angle = i * 30;
      const pt = pointOnCircle(this.cx, this.cy, radius, angle);
      const text = svgEl('text', {
        x: pt.x, y: pt.y,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: ohengColor(branchToElement(i), 'main'),
        'font-size': '24', 'font-weight': '700',
        'font-family': "'Noto Serif KR', serif"
      });
      text.textContent = JIJI_HANJA[i];
      g.appendChild(text);
    }
    this.svg.appendChild(g);
  }

  _drawFortuneRing(ring, entries, type, currentAge, currentYear) {
    const g = svgEl('g', { class: `ring ring-fortune-${type}` });

    // 12 faint base sectors
    for (let i = 0; i < 12; i++) {
      const sa = i * 30 - 15, ea = i * 30 + 15;
      g.appendChild(svgEl('path', {
        d: arcPath(this.cx, this.cy, ring.inner, ring.r, sa, ea),
        fill: ohengColor(branchToElement(i), 'main'), opacity: '0.10',
        stroke: '#e0e0e8', 'stroke-width': 0.3,
      }));
    }

    // Sector boundaries
    for (let i = 0; i < 12; i++) {
      const a = i * 30 - 15;
      const pI = pointOnCircle(this.cx, this.cy, ring.inner, a);
      const pO = pointOnCircle(this.cx, this.cy, ring.r, a);
      g.appendChild(svgEl('line', {
        x1: pI.x, y1: pI.y, x2: pO.x, y2: pO.y,
        stroke: '#e0e0e8', 'stroke-width': 0.3
      }));
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      this.svg.appendChild(g);
      return;
    }

    // Resolve fortune entries with continuous angles (same principle as natal pillars)
    const points = [];
    for (const entry of entries) {
      const idx60 = resolveIdx60(entry);
      if (idx60 == null) continue;
      const branchIdx = idx60 % 12;
      const angle = idx60ToContinuousAngle(idx60);
      const startAge = entry.startAge ?? entry.age ?? null;
      const year = entry.year ?? entry.calYear ?? null;

      let isCurrent = false;
      if (type === 'daeun' && currentAge != null && startAge != null) {
        isCurrent = currentAge >= startAge && currentAge < startAge + 10;
      } else if (type === 'saeun' && year != null) {
        isCurrent = year === currentYear;
      }

      points.push({ branchIdx, angle, startAge, year, isCurrent, idx60 });
    }

    // Highlight sectors
    for (const p of points) {
      const sa = p.angle - 15, ea = p.angle + 15;
      const color = ohengColor(branchToElement(p.branchIdx), 'main');
      const opacity = p.isCurrent ? 0.60 : 0.30;

      g.appendChild(svgEl('path', {
        d: arcPath(this.cx, this.cy, ring.inner + 0.5, ring.r - 0.5, sa, ea),
        fill: color, opacity: opacity.toFixed(3),
      }));

      if (p.isCurrent) {
        g.appendChild(svgEl('path', {
          d: arcPath(this.cx, this.cy, ring.inner, ring.r, sa, ea),
          fill: 'none', stroke: '#D4A800', 'stroke-width': 2, opacity: '0.9',
        }));
      }
    }

    // Connecting path (대운 only)
    if (type === 'daeun' && points.length > 1) {
      const midR = (ring.inner + ring.r) / 2;
      let d = '';
      for (let i = 0; i < points.length; i++) {
        const pt = pointOnCircle(this.cx, this.cy, midR, points[i].angle);
        d += (i === 0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`;
      }
      g.appendChild(svgEl('path', {
        d, fill: 'none', stroke: '#B8860B', 'stroke-width': 1.5,
        'stroke-dasharray': '4,3', opacity: '0.6'
      }));
    }

    // Dots
    const midR = (ring.inner + ring.r) / 2;
    for (const p of points) {
      const pt = pointOnCircle(this.cx, this.cy, midR, p.angle);
      const elemColor = ohengColor(branchToElement(p.branchIdx), 'main');

      if (p.isCurrent) {
        g.appendChild(svgEl('circle', {
          cx: pt.x, cy: pt.y, r: 7,
          fill: 'none', stroke: '#FFD700', 'stroke-width': 2, opacity: '0.8'
        }));
      }

      g.appendChild(svgEl('circle', {
        cx: pt.x, cy: pt.y, r: p.isCurrent ? 4 : 2.5,
        fill: elemColor,
        stroke: p.isCurrent ? '#FFD700' : '#fff',
        'stroke-width': p.isCurrent ? 1.5 : 0.5,
      }));
    }

    this.svg.appendChild(g);
  }

  update(chartData, fortuneData) {
    this.render(chartData, fortuneData);
  }
}
