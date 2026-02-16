/** Five element colors — Apple HIG inspired, optimized for light backgrounds */
export const OHENG_COLORS = {
  목: { main: '#28A745', light: '#6DD58C', dark: '#1B7A30', bg: 'rgba(40,167,69,0.12)' },
  화: { main: '#E8352E', light: '#FF7A73', dark: '#B81E18', bg: 'rgba(232,53,46,0.12)' },
  토: { main: '#A07800', light: '#D4A800', dark: '#7A5C00', bg: 'rgba(160,120,0,0.12)' },
  금: { main: '#6D6D72', light: '#8E8E93', dark: '#48484A', bg: 'rgba(109,109,114,0.12)' },
  수: { main: '#0066CC', light: '#3399FF', dark: '#004C99', bg: 'rgba(0,102,204,0.12)' },
};

/** Map element name to color */
export function ohengColor(element, variant = 'main') {
  return OHENG_COLORS[element]?.[variant] || '#888';
}

/** Map twelve-stage energy (0-1) to heatmap color */
export function energyToColor(energy) {
  // Cold blue (low) -> warm red (high)
  const hue = 220 - energy * 220;      // 220=blue to 0=red
  const sat = 60 + energy * 20;         // 60-80% saturation
  const light = 25 + energy * 30;       // 25-55% lightness
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/** Map twelve-stage energy to text color (for readability on heatmap) */
export function energyToTextColor(energy) {
  return energy > 0.5 ? '#fff' : '#ddd';
}

/** Map branch index to its primary element */
export function branchToElement(branchIdx) {
  const JIJI_OHENG = ['수', '토', '목', '목', '토', '화', '화', '토', '금', '금', '토', '수'];
  return JIJI_OHENG[branchIdx];
}

/** Map stem index to its element */
export function stemToElement(stemIdx) {
  const CHEONGAN_OHENG = ['목', '목', '화', '화', '토', '토', '금', '금', '수', '수'];
  return CHEONGAN_OHENG[stemIdx];
}

/** Relationship line colors */
export const RELATION_COLORS = {
  combine: '#4CAF50',   // 합 = green
  clash: '#F44336',     // 충 = red
  punishment: '#FF9800', // 형 = orange
  harm: '#9C27B0',      // 해 = purple
  break: '#795548',     // 파 = brown
};
