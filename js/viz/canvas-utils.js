/** Set up canvas for HiDPI displays */
export function setupCanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

/** Draw smooth curve through points */
export function drawSmoothLine(ctx, points, color, lineWidth = 2, dash = null) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  if (dash) ctx.setLineDash(dash);
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  // Last segment
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  if (dash) ctx.setLineDash([]);
}

/** Draw dashed vertical line */
export function drawDashedLine(ctx, x, y1, y2, color, dashPattern = [6, 4]) {
  ctx.beginPath();
  ctx.setLineDash(dashPattern);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Draw filled area under curve */
export function drawFilledArea(ctx, points, color, alpha = 0.1) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.fillStyle = color.replace(')', `,${alpha})`).replace('rgb', 'rgba');
  ctx.moveTo(points[0].x, points[points.length - 1].y); // baseline
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y); // back to baseline
  ctx.closePath();
  ctx.fill();
}
