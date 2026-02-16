const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create SVG element with attributes */
export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Create an arc path for a sector (donut slice) */
export function arcPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  // Convert degrees to radians, adjusting so 0° = top (north)
  const toRad = (deg) => (deg - 90) * Math.PI / 180;
  const startRad = toRad(startAngle);
  const endRad = toRad(endAngle);
  const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;

  const x1o = cx + outerR * Math.cos(startRad);
  const y1o = cy + outerR * Math.sin(startRad);
  const x2o = cx + outerR * Math.cos(endRad);
  const y2o = cy + outerR * Math.sin(endRad);
  const x1i = cx + innerR * Math.cos(endRad);
  const y1i = cy + innerR * Math.sin(endRad);
  const x2i = cx + innerR * Math.cos(startRad);
  const y2i = cy + innerR * Math.sin(startRad);

  return `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
}

/** Get point on circle at angle */
export function pointOnCircle(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Create a gradient arc (for influence zone) */
export function createGradientArc(id, cx, cy, r, centerAngle, spreadDeg, color) {
  // Returns a path with opacity gradient simulated by multiple thin arcs
  const steps = 20;
  const paths = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const angle = centerAngle - spreadDeg/2 + t * spreadDeg;
    const nextAngle = centerAngle - spreadDeg/2 + (t + 1/steps) * spreadDeg;
    const opacity = Math.cos((t - 0.5) * Math.PI); // peak at center
    paths.push({ startAngle: angle, endAngle: nextAngle, opacity: Math.max(0, opacity) });
  }
  return paths;
}

/** Create text on arc */
export function textOnArc(cx, cy, r, angleDeg, text, attrs = {}) {
  const pt = pointOnCircle(cx, cy, r, angleDeg);
  const el = svgEl('text', { x: pt.x, y: pt.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', ...attrs });
  el.textContent = text;
  return el;
}
