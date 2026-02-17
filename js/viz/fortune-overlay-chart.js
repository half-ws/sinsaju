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

  render(chartData, fortuneData, targetYear = null) {
    this._fortuneData = fortuneData || null;
    this._targetYear = targetYear;

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
    const currentYear = targetYear ?? new Date().getFullYear();
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

  /** Override: prominent labels outside fortune rings */
  _drawBranchLabels(radius) {
    const g = svgEl('g', { class: 'branch-labels' });
    const fontSize = this.size <= 360 ? 30 : 26;
    const discR = fontSize * 0.7;
    for (let i = 0; i < 12; i++) {
      const angle = i * 30;
      const pt = pointOnCircle(this.cx, this.cy, radius, angle);
      // White disc background for contrast
      g.appendChild(svgEl('circle', {
        cx: pt.x, cy: pt.y, r: discR,
        fill: '#ffffff', opacity: '0.85',
      }));
      const text = svgEl('text', {
        x: pt.x, y: pt.y,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: ohengColor(branchToElement(i), 'main'),
        'font-size': String(fontSize), 'font-weight': '800',
        'font-family': "'Noto Serif KR', serif",
        stroke: ohengColor(branchToElement(i), 'main'),
        'stroke-width': '0.5', 'paint-order': 'stroke',
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

    // Resolve fortune entries — current entry uses time-based progression
    const now = this._targetYear ? null : new Date();

    // 세운: 현재 ±5년으로 제한 (너무 많은 엔트리가 차트를 어지럽히므로)
    let filteredEntries = entries;
    if (type === 'saeun') {
      filteredEntries = entries.filter(e => {
        const y = e.year ?? e.calYear;
        return y != null && Math.abs(y - currentYear) <= 5;
      });
    }

    const points = [];
    for (const entry of filteredEntries) {
      const idx60 = resolveIdx60(entry);
      if (idx60 == null) continue;
      const branchIdx = idx60 % 12;
      const branchCenter = branchIdx * 30;
      const startAge = entry.startAge ?? entry.age ?? null;
      const year = entry.year ?? entry.calYear ?? null;

      let isCurrent = false;
      let angle;

      if (type === 'daeun' && currentAge != null && startAge != null) {
        isCurrent = currentAge >= startAge && currentAge < startAge + 10;
        if (isCurrent) {
          let progression;
          if (now) {
            const monthFrac = (now.getMonth() + now.getDate() / 30) / 12;
            progression = Math.max(0, Math.min(1, (currentAge + monthFrac - startAge) / 10));
          } else {
            // Slider mode: mid-year approximation
            progression = Math.max(0, Math.min(1, (currentAge + 0.5 - startAge) / 10));
          }
          const offset = (progression - 0.5) * 24;
          angle = ((branchCenter + offset) % 360 + 360) % 360;
        } else {
          angle = idx60ToContinuousAngle(idx60);
        }
      } else if (type === 'saeun' && year != null) {
        isCurrent = year === currentYear;
        if (isCurrent) {
          let progression;
          if (now) {
            const ipchun = new Date(currentYear, 1, 4);
            const daysSince = (now - ipchun) / 86400000;
            progression = Math.max(0, Math.min(1, daysSince / 365));
          } else {
            progression = 0.5; // mid-year
          }
          const offset = (progression - 0.5) * 24;
          angle = ((branchCenter + offset) % 360 + 360) % 360;
        } else {
          angle = idx60ToContinuousAngle(idx60);
        }
      } else {
        angle = idx60ToContinuousAngle(idx60);
      }

      points.push({ branchIdx, angle, startAge, year, isCurrent, idx60 });
    }

    // Highlight sectors — 현재 항목만 강조, 나머지는 지지 중심으로 얇게 표시
    for (const p of points) {
      const color = ohengColor(branchToElement(p.branchIdx), 'main');
      if (p.isCurrent) {
        const sa = p.branchIdx * 30 - 15, ea = p.branchIdx * 30 + 15;
        g.appendChild(svgEl('path', {
          d: arcPath(this.cx, this.cy, ring.inner + 0.5, ring.r - 0.5, sa, ea),
          fill: color, opacity: '0.55',
        }));
        g.appendChild(svgEl('path', {
          d: arcPath(this.cx, this.cy, ring.inner, ring.r, sa, ea),
          fill: 'none', stroke: '#D4A800', 'stroke-width': 2, opacity: '0.9',
        }));
      } else {
        // 비현재 엔트리: 지지 중심으로 얇은 표시만
        const sa = p.branchIdx * 30 - 15, ea = p.branchIdx * 30 + 15;
        g.appendChild(svgEl('path', {
          d: arcPath(this.cx, this.cy, ring.inner + 0.5, ring.r - 0.5, sa, ea),
          fill: color, opacity: '0.18',
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

    // Dots — 현재 강조, 비현재는 작은 점만
    const midR = (ring.inner + ring.r) / 2;
    for (const p of points) {
      const pt = pointOnCircle(this.cx, this.cy, midR, p.angle);
      const elemColor = ohengColor(branchToElement(p.branchIdx), 'main');

      if (p.isCurrent) {
        g.appendChild(svgEl('circle', {
          cx: pt.x, cy: pt.y, r: 7,
          fill: 'none', stroke: '#FFD700', 'stroke-width': 2, opacity: '0.8'
        }));
        g.appendChild(svgEl('circle', {
          cx: pt.x, cy: pt.y, r: 4,
          fill: elemColor, stroke: '#FFD700', 'stroke-width': 1.5,
        }));
      } else {
        g.appendChild(svgEl('circle', {
          cx: pt.x, cy: pt.y, r: 2,
          fill: elemColor, opacity: '0.5',
          stroke: '#fff', 'stroke-width': 0.3,
        }));
      }
    }

    this.svg.appendChild(g);
  }

  update(chartData, fortuneData) {
    this.render(chartData, fortuneData);
  }
}
