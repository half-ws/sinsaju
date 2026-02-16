import { energyToColor, energyToTextColor, ohengColor, stemToElement, branchToElement } from './color-scales.js';

const CHEONGAN = ['갑','을','병','정','무','기','경','신','임','계'];
const JIJI = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const CHEONGAN_HANJA = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JIJI_HANJA = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

export class HeatmapChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.cellSize = options.cellSize || 80;
    this.highlightRow = options.highlightRow ?? 2; // 일간 row by default
  }

  render(matrixData) {
    const { matrix, stemLabels, branchLabels, pillarLabels } = matrixData;

    let html = '<div class="heatmap-wrapper">';
    html += '<table class="heatmap-table">';

    // Header row (branch labels)
    html += '<thead><tr><th class="heatmap-corner"></th>';
    for (let c = 0; c < 4; c++) {
      const brIdx = JIJI.indexOf(branchLabels[c]);
      const el = branchToElement(brIdx);
      html += `<th class="heatmap-header" style="color:${ohengColor(el, 'light')}">
        <span class="heatmap-pillar-label">${pillarLabels[c]}지</span>
        <span class="heatmap-branch-label">${JIJI_HANJA[brIdx]}</span>
        <span class="heatmap-branch-name">${branchLabels[c]}</span>
      </th>`;
    }
    html += '</tr></thead>';

    // Matrix rows (stem labels)
    html += '<tbody>';
    for (let r = 0; r < matrix.length; r++) {
      const stIdx = CHEONGAN.indexOf(stemLabels[r]);
      const el = stemToElement(stIdx);
      const isHighlight = r === this.highlightRow;

      html += `<tr class="${isHighlight ? 'heatmap-highlight-row' : ''}">`;
      html += `<th class="heatmap-row-header" style="color:${ohengColor(el, 'light')}">
        <span class="heatmap-pillar-label">${pillarLabels[r]}간</span>
        <span class="heatmap-stem-label">${CHEONGAN_HANJA[stIdx]}</span>
        <span class="heatmap-stem-name">${stemLabels[r]}</span>
      </th>`;

      for (let c = 0; c < matrix[r].length; c++) {
        const cell = matrix[r][c];
        const bgColor = energyToColor(cell.energy);
        const textColor = energyToTextColor(cell.energy);
        const borderColor = isHighlight ? '#FFD700' : 'transparent';

        html += `<td class="heatmap-cell" style="
          background:${bgColor};
          color:${textColor};
          border: 2px solid ${borderColor};
        ">
          <span class="heatmap-stage">${cell.stage}</span>
          <span class="heatmap-energy">${(cell.energy * 100).toFixed(0)}%</span>
          <span class="heatmap-phase heatmap-phase-${cell.phase}">${cell.phase === 'peak' ? '\u25B2' : cell.phase === 'growth' ? '\u2192' : '\u25BD'}</span>
        </td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    // Legend
    html += '<div class="heatmap-legend">';
    html += '<span class="heatmap-legend-label">\uC5D0\uB108\uC9C0:</span>';
    html += `<span class="heatmap-legend-low" style="background:${energyToColor(0.05)}">\uBB18(\uCD5C\uC800)</span>`;
    html += `<span class="heatmap-legend-mid" style="background:${energyToColor(0.5)}">\uC7A5\uC0DD</span>`;
    html += `<span class="heatmap-legend-high" style="background:${energyToColor(1.0)}">\uC81C\uC655(\uCD5C\uACE0)</span>`;
    html += '</div>';

    html += '</div>';

    this.container.innerHTML = html;
  }

  update(matrixData) {
    this.render(matrixData);
  }
}
