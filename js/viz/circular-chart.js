import { svgEl, arcPath, pointOnCircle } from './svg-utils.js';
import { ohengColor, branchToElement, RELATION_COLORS } from './color-scales.js';

const JIJI_HANJA = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

/** Hidden stems (지장간) for each branch: [stemName, element, proportion] */
const JIJANGGAN = [
  /* 子(0) */ [['임', '수', 0.30], ['계', '수', 0.70]],
  /* 丑(1) */ [['계', '수', 0.30], ['신', '금', 0.10], ['기', '토', 0.60]],
  /* 寅(2) */ [['무', '토', 0.20], ['병', '화', 0.20], ['갑', '목', 0.60]],
  /* 卯(3) */ [['갑', '목', 0.30], ['을', '목', 0.70]],
  /* 辰(4) */ [['을', '목', 0.30], ['계', '수', 0.10], ['무', '토', 0.60]],
  /* 巳(5) */ [['무', '토', 0.20], ['경', '금', 0.20], ['병', '화', 0.60]],
  /* 午(6) */ [['병', '화', 0.30], ['정', '화', 0.70]],
  /* 未(7) */ [['정', '화', 0.30], ['을', '목', 0.10], ['기', '토', 0.60]],
  /* 申(8) */ [['무', '토', 0.20], ['임', '수', 0.20], ['경', '금', 0.60]],
  /* 酉(9) */ [['경', '금', 0.30], ['신', '금', 0.70]],
  /* 戌(10) */ [['신', '금', 0.30], ['정', '화', 0.10], ['무', '토', 0.60]],
  /* 亥(11) */ [['무', '토', 0.20], ['갑', '목', 0.20], ['임', '수', 0.60]],
];

export class CircularChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.size = options.size || 500;
    this.padding = options.padding || 30;
    this.showRelations = options.showRelations !== false;
    this.svg = null;
    this.cx = this.size / 2;
    this.cy = this.size / 2;
  }

  render(chartData) {
    // Clear previous
    this.container.innerHTML = '';

    // Create SVG
    this.svg = svgEl('svg', {
      viewBox: `0 0 ${this.size} ${this.size}`,
      width: '100%',
      height: '100%',
      style: 'max-width: 100%; border-radius: 50%;'
    });

    // Define gradients
    this._addDefs();

    // Background circle
    this.svg.appendChild(svgEl('circle', {
      cx: this.cx, cy: this.cy, r: this.size/2 - 2,
      fill: '#ffffff', stroke: '#ddd', 'stroke-width': 1
    }));

    // Ring radii (from outer to inner)
    const maxR = this.size/2 - this.padding;
    const ringWidth = maxR * 0.18;
    const gap = maxR * 0.02;
    const rings = [
      { label: '년', r: maxR, inner: maxR - ringWidth },                                    // year (outermost)
      { label: '월', r: maxR - ringWidth - gap, inner: maxR - 2*ringWidth - gap },           // month
      { label: '일', r: maxR - 2*(ringWidth+gap), inner: maxR - 3*ringWidth - 2*gap },       // day
      { label: '시', r: maxR - 3*(ringWidth+gap), inner: maxR - 4*ringWidth - 3*gap },       // hour
    ];

    // Draw each ring
    const pillarKeys = ['year', 'month', 'day', 'hour'];
    const continuous = chartData.continuous;

    rings.forEach((ring, ringIdx) => {
      const key = pillarKeys[ringIdx];
      const pillarData = continuous?.[key];
      this._drawRing(ring, pillarData, ringIdx);
    });

    // Draw 5th innermost ring: 지장간 (hidden stems)
    const hourRingInner = rings[3].inner;
    const centerRadius = hourRingInner - 10;
    const jijangganRing = {
      r: hourRingInner - gap,
      inner: centerRadius + gap
    };
    this._drawJijangganRing(jijangganRing);

    // Branch labels (outside)
    this._drawBranchLabels(maxR + 15);

    // Center: empty circle
    this._drawCenter(centerRadius);

    // Aspect lines for relationships
    if (this.showRelations && chartData.discrete) {
      this._drawRelations(chartData, rings);
    }

    this.container.appendChild(this.svg);
  }

  _addDefs() {
    const defs = svgEl('defs');
    // Radial gradient for birth marker glow
    const grad = svgEl('radialGradient', { id: 'birth-glow', cx: '50%', cy: '50%', r: '50%' });
    grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#FFD700', 'stop-opacity': '0.8' }));
    grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#FFD700', 'stop-opacity': '0' }));
    defs.appendChild(grad);
    this.svg.appendChild(defs);
  }

  _drawRing(ring, pillarData, ringIdx) {
    const g = svgEl('g', { class: `ring ring-${ringIdx}` });

    // 12 sectors — centered on each branch's peak angle (i*30)
    for (let i = 0; i < 12; i++) {
      const startAngle = i * 30 - 15;
      const endAngle = i * 30 + 15;
      const element = branchToElement(i);
      const color = ohengColor(element, 'main');

      const opacity = 0.30;

      const path = svgEl('path', {
        d: arcPath(this.cx, this.cy, ring.inner, ring.r, startAngle, endAngle),
        fill: color,
        opacity: opacity.toFixed(3),
        stroke: '#e0e0e8',
        'stroke-width': 0.5,
      });
      // Tooltip
      path.innerHTML = `<title>${JIJI_HANJA[i]} (${branchToElement(i)})</title>`;
      g.appendChild(path);
    }

    // Birth position marker
    if (pillarData && pillarData.angle !== undefined) {
      this._drawBirthMarker(g, ring, pillarData.angle);
    }

    this.svg.appendChild(g);
  }

  _drawJijangganRing(ring) {
    const g = svgEl('g', { class: 'ring ring-jijanggan' });

    for (let i = 0; i < 12; i++) {
      const sectorStart = i * 30 - 15;
      const sectorSpan = 30;
      const hiddenStems = JIJANGGAN[i];

      let currentAngle = sectorStart;
      for (let s = 0; s < hiddenStems.length; s++) {
        const [stemName, element, proportion] = hiddenStems[s];
        const arcSpan = sectorSpan * proportion;
        const arcEnd = currentAngle + arcSpan;
        const color = ohengColor(element, 'main');

        const path = svgEl('path', {
          d: arcPath(this.cx, this.cy, ring.inner, ring.r, currentAngle, arcEnd),
          fill: color,
          opacity: '0.55',
          stroke: '#e0e0e8',
          'stroke-width': 0.3,
        });
        path.innerHTML = `<title>${stemName} (${element}, ${Math.round(proportion * 100)}%)</title>`;
        g.appendChild(path);

        currentAngle = arcEnd;
      }
    }

    // Sector boundary strokes (between branches)
    for (let i = 0; i < 12; i++) {
      const angle = i * 30 - 15;
      const pInner = pointOnCircle(this.cx, this.cy, ring.inner, angle);
      const pOuter = pointOnCircle(this.cx, this.cy, ring.r, angle);
      g.appendChild(svgEl('line', {
        x1: pInner.x, y1: pInner.y, x2: pOuter.x, y2: pOuter.y,
        stroke: '#e0e0e8', 'stroke-width': 0.5
      }));
    }

    this.svg.appendChild(g);
  }

  _drawBirthMarker(group, ring, angle) {
    // Radial line
    const inner = pointOnCircle(this.cx, this.cy, ring.inner, angle);
    const outer = pointOnCircle(this.cx, this.cy, ring.r, angle);
    group.appendChild(svgEl('line', {
      x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y,
      stroke: '#B8860B', 'stroke-width': 2.5,
      'stroke-linecap': 'round', opacity: '0.9'
    }));

    // Small dot at the midpoint
    const mid = pointOnCircle(this.cx, this.cy, (ring.inner + ring.r) / 2, angle);
    group.appendChild(svgEl('circle', {
      cx: mid.x, cy: mid.y, r: 4,
      fill: '#D4A800', stroke: '#fff', 'stroke-width': 1
    }));

    // Gradient influence arc (+-30 degree spread)
    const spread = 30;
    const steps = 16;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const a1 = angle - spread/2 + t * spread;
      const a2 = angle - spread/2 + (t + 1/steps) * spread;
      const dist = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
      const op = Math.max(0, 0.3 * (1 - dist * dist));

      group.appendChild(svgEl('path', {
        d: arcPath(this.cx, this.cy, ring.inner + 1, ring.r - 1, a1, a2),
        fill: '#FFD700', opacity: op.toFixed(3), 'pointer-events': 'none'
      }));
    }
  }

  _drawBranchLabels(radius) {
    const g = svgEl('g', { class: 'branch-labels' });
    const fontSize = this.size <= 360 ? 32 : 34;
    const discR = fontSize * 0.65;
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

  _drawCenter(radius) {
    const g = svgEl('g', { class: 'center-info' });

    // Empty background circle
    g.appendChild(svgEl('circle', {
      cx: this.cx, cy: this.cy, r: radius,
      fill: '#f8f8fa', stroke: '#ddd', 'stroke-width': 0.5
    }));

    this.svg.appendChild(g);
  }

  _drawRelations(chartData, rings) {
    // Detect 합/충 between pillars using branch indices
    const disc = chartData.discrete;
    const branches = ['year','month','day','hour'].map(k => disc.idxs[k] % 12);

    // Check each pair of pillars for 육합 (combine) and 충 (clash)
    const BRANCH_COMBINE_MAP = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]]; // 자축, 인해, 묘술, 진유, 사신, 오미
    const BRANCH_CLASH_MAP = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];

    const g = svgEl('g', { class: 'relations', opacity: '0.8' });

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const bi = branches[i], bj = branches[j];
        let relType = null;

        for (const [a, b] of BRANCH_COMBINE_MAP) {
          if ((bi === a && bj === b) || (bi === b && bj === a)) { relType = 'combine'; break; }
        }
        if (!relType) {
          for (const [a, b] of BRANCH_CLASH_MAP) {
            if ((bi === a && bj === b) || (bi === b && bj === a)) { relType = 'clash'; break; }
          }
        }

        if (relType) {
          const midRi = (rings[i].inner + rings[i].r) / 2;
          const midRj = (rings[j].inner + rings[j].r) / 2;
          const angleI = chartData.continuous?.[['year','month','day','hour'][i]]?.angle ?? (bi * 30);
          const angleJ = chartData.continuous?.[['year','month','day','hour'][j]]?.angle ?? (bj * 30);

          const p1 = pointOnCircle(this.cx, this.cy, midRi, angleI);
          const p2 = pointOnCircle(this.cx, this.cy, midRj, angleJ);

          g.appendChild(svgEl('line', {
            x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
            stroke: RELATION_COLORS[relType],
            'stroke-width': relType === 'clash' ? 2 : 1.5,
            'stroke-dasharray': relType === 'clash' ? '6,3' : 'none',
            opacity: '0.8'
          }));
        }
      }
    }

    this.svg.appendChild(g);
  }

  /** Update with new data (for animations) */
  update(chartData) {
    this.render(chartData);
  }

  /** Handle resize */
  resize(newSize) {
    this.size = newSize;
    this.cx = newSize / 2;
    this.cy = newSize / 2;
    // Re-render needed
  }
}
